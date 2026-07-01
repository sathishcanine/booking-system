from sqlalchemy.orm import Session, joinedload

from app.listings import json_list_from_db, primary_photo
from app.models import Activity, ListingStatus, Organization
from app.schemas import BoatCardOut
from app.services.boat_rental import hourly_rate_cents


def starting_price_cents(activity: Activity) -> int | None:
    if not activity.ticket_types:
        return None
    return min(t.price_cents for t in activity.ticket_types)


def boat_card(
    activity: Activity,
    ratings: dict[int, tuple[float | None, int]],
) -> BoatCardOut:
    org = activity.organization
    avg, count = ratings.get(activity.id, (None, 0))
    return BoatCardOut(
        id=activity.id,
        slug=activity.slug,
        title=activity.title,
        boat_type=activity.boat_type,
        max_guests=activity.max_guests,
        city=activity.city,
        state=activity.state,
        marina_name=activity.marina_name,
        location_label=activity.location_label,
        duration_minutes=activity.duration_minutes,
        image_url=primary_photo(activity),
        photo_urls=json_list_from_db(activity.photo_urls),
        amenities=json_list_from_db(activity.amenities),
        captain_required=activity.captain_required,
        hourly_rate_cents=hourly_rate_cents(activity),
        length_ft=activity.length_ft,
        organization_name=org.name if org else None,
        starting_price_cents=starting_price_cents(activity),
        emoji=activity.emoji,
        average_rating=avg,
        review_count=count,
        min_rental_hours=activity.min_rental_hours or 2,
        max_rental_hours=activity.max_rental_hours or 8,
        instant_book=bool(activity.instant_book),
        bareboat_allowed=bool(activity.bareboat_allowed),
        activity_tags=json_list_from_db(activity.activity_tags),
    )


def published_activities_query(db: Session):
    return (
        db.query(Activity)
        .options(
            joinedload(Activity.organization).joinedload(Organization.users),
            joinedload(Activity.ticket_types),
        )
        .filter(
            Activity.listing_status == ListingStatus.PUBLISHED,
            Activity.is_active.is_(True),
        )
    )
