from sqlalchemy.orm import Session

from app.listings import json_list_from_db, primary_photo
from app.marketplace_config import captain_by_id
from app.models import Activity, ListingStatus, Organization, Review
from app.schemas import CaptainProfilePageOut, OwnerProfilePageOut, ProfileBoatOut, ProfileReviewOut
from app.services.boat_catalog import published_activities_query
from app.services.boat_detail import _owner_user
from app.services.boat_rental import hourly_rate_cents
from app.services.captains import compute_captain_stats, resolve_org_captain
from app.services.reviews import rating_aggregates


def _aboard_year(org: Organization | None) -> int | None:
    if not org or not org.created_at:
        return None
    return org.created_at.year


def _profile_boats(db: Session, activities: list[Activity]) -> list[ProfileBoatOut]:
    ratings = rating_aggregates(db, [a.id for a in activities])
    boats: list[ProfileBoatOut] = []
    for activity in activities:
        photos = json_list_from_db(activity.photo_urls)
        if not photos and activity.image_url:
            photos = [activity.image_url]
        avg, count = ratings.get(activity.id, (None, 0))
        boats.append(
            ProfileBoatOut(
                slug=activity.slug,
                title=activity.title,
                image_url=primary_photo(activity),
                photo_count=len(photos) or (1 if activity.image_url else 0),
                hourly_rate_cents=hourly_rate_cents(activity),
                min_rental_hours=activity.min_rental_hours or 2,
                max_rental_hours=activity.max_rental_hours or 8,
                max_guests=activity.max_guests,
                average_rating=avg,
                review_count=count,
            )
        )
    return boats


def _org_published_boats(db: Session, org_id: int) -> list[Activity]:
    return (
        published_activities_query(db)
        .filter(Activity.organization_id == org_id)
        .order_by(Activity.title)
        .all()
    )


def _org_reviews(db: Session, org_id: int, limit: int = 20) -> list[ProfileReviewOut]:
    rows = (
        db.query(Review, Activity)
        .join(Activity, Review.activity_id == Activity.id)
        .filter(Activity.organization_id == org_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ProfileReviewOut(
            id=review.id,
            reviewer_name=review.reviewer_name,
            rating=review.rating,
            body=review.body,
            created_at=review.created_at,
            boat_title=activity.title,
            boat_slug=activity.slug,
        )
        for review, activity in rows
    ]


def _owner_aggregate_rating(reviews: list[ProfileReviewOut]) -> tuple[float | None, int]:
    if not reviews:
        return None, 0
    total = sum(r.rating for r in reviews)
    return round(total / len(reviews), 1), len(reviews)


def build_owner_profile_page(db: Session, boat_slug: str) -> OwnerProfilePageOut | None:
    activity = published_activities_query(db).filter(Activity.slug == boat_slug).first()
    if not activity or not activity.organization:
        return None

    org = activity.organization
    owner = _owner_user(activity)
    name = (owner.display_name if owner and owner.display_name else None) or org.name
    boats = _org_published_boats(db, org.id)
    reviews = _org_reviews(db, org.id)
    rating, review_count = _owner_aggregate_rating(reviews)
    if review_count == 0:
        ratings = rating_aggregates(db, [b.id for b in boats])
        total_count = sum(count for _, count in ratings.values())
        if total_count:
            weighted = sum(
                (avg or 0) * count for avg, count in ratings.values() if count
            )
            rating = round(weighted / total_count, 1)
            review_count = total_count

    bio = (org.owner_bio or "").strip() or None
    if not bio:
        bio = f"{name.split()[0] if name else 'This owner'} hasn't completed their profile yet."

    return OwnerProfilePageOut(
        name=name,
        rating=rating,
        review_count=review_count,
        phone_verified=bool(org.phone_verified),
        bio=bio,
        aboard_since_year=_aboard_year(org),
        boats=_profile_boats(db, boats),
        reviews=reviews,
    )


def build_captain_profile_page(
    db: Session, captain_id: str, boat_slug: str
) -> CaptainProfilePageOut | None:
    activity = published_activities_query(db).filter(Activity.slug == boat_slug).first()
    if not activity or not activity.organization:
        return None

    row = resolve_org_captain(db, activity.organization_id, captain_id, activity)
    if row:
        org_boats = _org_published_boats(db, activity.organization_id)
        captained = [b for b in org_boats if b.captain_required or not b.bareboat_allowed]
        if not captained:
            captained = org_boats
        bio = (row.bio or "").strip() or None
        if not bio:
            bio = f"{row.name} hasn't completed their profile yet."
        stats = compute_captain_stats(db, row)
        return CaptainProfilePageOut(
            id=row.slug,
            name=row.name,
            photo_url=row.photo_url,
            rating=stats["rating"],
            review_count=stats["review_count"],
            phone_verified=row.phone_verified,
            coast_guard_verified=row.coast_guard_verified,
            bio=bio,
            aboard_since_year=stats["aboard_since_year"],
            location=row.location,
            trips_completed=stats["trips_completed"],
            experience=row.experience,
            license_types=json_list_from_db(row.license_types),
            specializations=json_list_from_db(row.specializations),
            boats=_profile_boats(db, captained),
        )

    captain = captain_by_id(captain_id)
    if not captain:
        return None

    org_boats = _org_published_boats(db, activity.organization_id)
    captained = [b for b in org_boats if b.captain_required or not b.bareboat_allowed]
    if not captained:
        captained = org_boats

    bio = (captain.get("bio") or "").strip() or None
    if not bio:
        bio = f"{captain['name']} hasn't completed their profile yet."

    return CaptainProfilePageOut(
        id=captain["id"],
        name=captain["name"],
        rating=captain.get("rating"),
        review_count=captain.get("review_count", 0),
        phone_verified=bool(captain.get("phone_verified", True)),
        coast_guard_verified=bool(captain.get("coast_guard_verified", True)),
        bio=bio,
        aboard_since_year=captain.get("aboard_since_year"),
        location=captain.get("location"),
        trips_completed=captain.get("trips_completed", 0),
        boats=_profile_boats(db, captained),
    )
