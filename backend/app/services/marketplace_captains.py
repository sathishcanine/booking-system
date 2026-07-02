"""Public marketplace captain directory."""

from sqlalchemy.orm import Session

from app.listings import json_list_from_db
from app.models import Activity, Booking, Captain, Organization, OrganizationStatus, Review
from app.schemas import CaptainListItemOut, CaptainProfilePageOut, ProfileReviewOut
from app.services.captains import compute_captain_stats
from app.services.crew_profiles import _org_published_boats, _profile_boats


def _approved_captains_query(db: Session):
    return (
        db.query(Captain)
        .join(Organization, Captain.organization_id == Organization.id)
        .filter(
            Captain.is_active.is_(True),
            Organization.status == OrganizationStatus.APPROVED,
        )
        .order_by(Captain.name)
    )


def _captain_matches_filters(
    captain: Captain,
    *,
    license_types: list[str] | None,
    experience: str | None,
    specializations: list[str] | None,
) -> bool:
    licenses = json_list_from_db(captain.license_types)
    specs = json_list_from_db(captain.specializations)

    if license_types:
        if not any(item in licenses for item in license_types):
            return False
    if experience and captain.experience != experience:
        return False
    if specializations:
        if not any(item in specs for item in specializations):
            return False
    return True


def _captain_to_list_item(db: Session, captain: Captain) -> CaptainListItemOut:
    stats = compute_captain_stats(db, captain)
    return CaptainListItemOut(
        id=str(captain.id),
        slug=captain.slug,
        name=captain.name,
        photo_url=captain.photo_url,
        rating=stats["rating"],
        review_count=stats["review_count"],
        coast_guard_verified=captain.coast_guard_verified,
        bio=(captain.bio or "").strip() or None,
        location=captain.location,
        experience=captain.experience,
        license_types=json_list_from_db(captain.license_types),
        specializations=json_list_from_db(captain.specializations),
    )


def _captain_reviews(db: Session, captain_id: int, limit: int = 20) -> list[ProfileReviewOut]:
    rows = (
        db.query(Review, Activity)
        .join(Booking, Review.booking_id == Booking.id)
        .join(Activity, Review.activity_id == Activity.id)
        .filter(Booking.captain_id == captain_id)
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


def list_marketplace_captains(
    db: Session,
    *,
    license_types: list[str] | None = None,
    experience: str | None = None,
    specializations: list[str] | None = None,
    limit: int = 24,
    offset: int = 0,
) -> tuple[list[CaptainListItemOut], int]:
    rows = _approved_captains_query(db).all()
    filtered = [
        captain
        for captain in rows
        if _captain_matches_filters(
            captain,
            license_types=license_types,
            experience=experience,
            specializations=specializations,
        )
    ]
    total = len(filtered)
    page = filtered[offset : offset + limit]
    return [_captain_to_list_item(db, captain) for captain in page], total


def get_marketplace_captain(db: Session, slug: str) -> CaptainProfilePageOut | None:
    captain = (
        _approved_captains_query(db)
        .filter(Captain.slug == slug)
        .first()
    )
    if not captain:
        return None

    org_boats = _org_published_boats(db, captain.organization_id)
    captained = [b for b in org_boats if b.captain_required or not b.bareboat_allowed]
    if not captained:
        captained = org_boats

    bio = (captain.bio or "").strip() or None
    if not bio:
        bio = f"{captain.name} hasn't completed their profile yet."

    stats = compute_captain_stats(db, captain)
    return CaptainProfilePageOut(
        id=captain.slug,
        name=captain.name,
        photo_url=captain.photo_url,
        rating=stats["rating"],
        review_count=stats["review_count"],
        phone_verified=captain.phone_verified,
        coast_guard_verified=captain.coast_guard_verified,
        bio=bio,
        aboard_since_year=stats["aboard_since_year"],
        location=captain.location,
        trips_completed=stats["trips_completed"],
        experience=captain.experience,
        license_types=json_list_from_db(captain.license_types),
        specializations=json_list_from_db(captain.specializations),
        boats=_profile_boats(db, captained),
        reviews=_captain_reviews(db, captain.id),
    )
