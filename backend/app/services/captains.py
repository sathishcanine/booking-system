import re
from typing import TypedDict

from sqlalchemy.orm import Session

from app.listings import json_list_from_db
from app.models import Activity, Booking, BookingStatus, Captain, Review
from app.schemas import BoatCaptainProfileOut


class CaptainStats(TypedDict):
    rating: float | None
    review_count: int
    trips_completed: int
    aboard_since_year: int | None


def slugify_captain(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return base or "captain"


def unique_captain_slug(
    db: Session, base: str, org_id: int, exclude_id: int | None = None
) -> str:
    slug = base
    n = 2
    while True:
        q = db.query(Captain).filter(Captain.slug == slug, Captain.organization_id == org_id)
        if exclude_id is not None:
            q = q.filter(Captain.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def compute_captain_stats(db: Session, captain: Captain) -> CaptainStats:
    trips_completed = (
        db.query(Booking)
        .filter(
            Booking.captain_id == captain.id,
            Booking.status == BookingStatus.PAID,
        )
        .count()
    )
    ratings = [
        row[0]
        for row in (
            db.query(Review.rating)
            .join(Booking, Review.booking_id == Booking.id)
            .filter(Booking.captain_id == captain.id)
            .all()
        )
    ]
    review_count = len(ratings)
    rating = round(sum(ratings) / review_count, 1) if review_count else None
    aboard_since_year = captain.created_at.year if captain.created_at else None
    return {
        "rating": rating,
        "review_count": review_count,
        "trips_completed": trips_completed,
        "aboard_since_year": aboard_since_year,
    }


def captain_to_profile(db: Session, captain: Captain) -> BoatCaptainProfileOut:
    stats = compute_captain_stats(db, captain)
    return BoatCaptainProfileOut(
        id=captain.slug,
        name=captain.name,
        photo_url=captain.photo_url,
        rating=stats["rating"],
        review_count=stats["review_count"],
        trips_completed=stats["trips_completed"],
        coast_guard_verified=captain.coast_guard_verified,
        experience=captain.experience,
        license_types=json_list_from_db(captain.license_types),
        specializations=json_list_from_db(captain.specializations),
    )


def org_captains_query(db: Session, org_id: int):
    return (
        db.query(Captain)
        .filter(Captain.organization_id == org_id, Captain.is_active.is_(True))
        .order_by(Captain.name)
    )


def resolve_org_captain(
    db: Session, org_id: int, captain_id: str, activity: Activity | None = None
) -> Captain | None:
    if captain_id == "default":
        if activity and activity.default_captain_id:
            return (
                db.query(Captain)
                .filter(
                    Captain.id == activity.default_captain_id,
                    Captain.organization_id == org_id,
                    Captain.is_active.is_(True),
                )
                .first()
            )
        first = org_captains_query(db, org_id).first()
        return first
    return (
        db.query(Captain)
        .filter(
            Captain.organization_id == org_id,
            Captain.slug == captain_id,
            Captain.is_active.is_(True),
        )
        .first()
    )


def resolve_captain_id_for_booking(
    db: Session,
    activity: Activity,
    captain_slug: str | None,
    captain_included: bool,
) -> int | None:
    if not captain_included:
        return None
    if captain_slug:
        captain = resolve_org_captain(db, activity.organization_id, captain_slug, activity)
        if captain:
            return captain.id
    if activity.default_captain_id:
        return activity.default_captain_id
    first = org_captains_query(db, activity.organization_id).first()
    return first.id if first else None


def build_default_captain(db: Session, activity: Activity) -> BoatCaptainProfileOut | None:
    if not activity.captain_required and activity.bareboat_allowed:
        return None

    if activity.default_captain_id:
        linked = (
            db.query(Captain)
            .filter(
                Captain.id == activity.default_captain_id,
                Captain.organization_id == activity.organization_id,
                Captain.is_active.is_(True),
            )
            .first()
        )
        if linked:
            return captain_to_profile(db, linked)

    first = org_captains_query(db, activity.organization_id).first()
    if first:
        return captain_to_profile(db, first)

    return BoatCaptainProfileOut(
        id="default",
        name="TBD",
        rating=None,
        review_count=0,
        trips_completed=0,
        coast_guard_verified=True,
    )


def build_captain_alternatives(db: Session, activity: Activity) -> list[BoatCaptainProfileOut]:
    captains = org_captains_query(db, activity.organization_id).all()
    return [captain_to_profile(db, c) for c in captains]
