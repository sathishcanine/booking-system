"""Filter published boat listings for marketplace search."""

from __future__ import annotations

from app.listings import json_list_from_db
from app.models import Activity


def activity_matches_captain(activity: Activity, captain: str | None) -> bool:
    if not captain or captain == "any":
        return True
    if captain == "captained":
        return activity.captain_required or not activity.bareboat_allowed
    if captain == "bareboat":
        return activity.bareboat_allowed and not activity.captain_required
    return True


def activity_matches_filters(
    activity: Activity,
    *,
    category: str | None = None,
    price_min_cents: int | None = None,
    price_max_cents: int | None = None,
    duration_hours: int | None = None,
    captain: str | None = None,
    guests: int | None = None,
    instant_book: bool | None = None,
    length_min_ft: int | None = None,
    length_max_ft: int | None = None,
    amenity: str | None = None,
) -> bool:
    if guests:
        if activity.max_guests is None or activity.max_guests < guests:
            return False

    if instant_book is True and not activity.instant_book:
        return False

    if category:
        tags = json_list_from_db(activity.activity_tags)
        if category not in tags:
            return False

    from app.services.boat_rental import hourly_rate_cents

    rate = hourly_rate_cents(activity)

    if price_min_cents is not None and rate < price_min_cents:
        return False
    if price_max_cents is not None and rate > price_max_cents:
        return False

    if duration_hours is not None:
        if duration_hours < activity.min_rental_hours or duration_hours > activity.max_rental_hours:
            return False

    if not activity_matches_captain(activity, captain):
        return False

    if length_min_ft is not None and activity.length_ft and activity.length_ft < length_min_ft:
        return False
    if length_max_ft is not None and activity.length_ft and activity.length_ft > length_max_ft:
        return False

    if amenity:
        amenities = [a.lower() for a in json_list_from_db(activity.amenities)]
        if amenity.lower() not in amenities:
            return False

    return True
