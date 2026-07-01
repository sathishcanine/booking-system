"""Boat listing helpers for Phase 2 marketplace."""

from __future__ import annotations

import json

from app.models import Activity, ListingStatus


def json_list_to_db(items: list[str] | None) -> str | None:
    cleaned = [s.strip() for s in (items or []) if s and s.strip()]
    return json.dumps(cleaned) if cleaned else None


def json_list_from_db(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        val = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(val, list):
        return []
    return [str(x) for x in val if x]


def primary_photo(activity: Activity) -> str | None:
    photos = json_list_from_db(activity.photo_urls)
    if photos:
        return photos[0]
    return activity.image_url


def is_listing_public(activity: Activity) -> bool:
    return activity.listing_status == ListingStatus.PUBLISHED and activity.is_active


BOAT_TYPE_LABELS: dict[str, str] = {
    "pontoon": "Pontoon",
    "fishing": "Fishing",
    "yacht": "Yacht",
    "sailboat": "Sailboat",
    "jet_ski": "Jet ski",
    "kayak": "Kayak",
    "party": "Party",
    "cruising": "Cruising",
}


def boat_type_label(value: str | None) -> str:
    if not value:
        return "Boat"
    return BOAT_TYPE_LABELS.get(value.lower(), value.replace("_", " ").title())
