"""Build Boatsetter-style destination browse pages from published listings."""

from __future__ import annotations

import json
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from app.listings import boat_type_label
from app.models import Activity, ListingStatus, PlatformSettings
from app.services.boat_catalog import boat_card, published_activities_query
from app.schemas import (
    BoatCardOut,
    BreadcrumbOut,
    DestinationPageOut,
    DestinationSectionOut,
    MarketplacePromiseItemOut,
    MarketplacePromiseOut,
)
from app.services.reviews import rating_aggregates

DEFAULT_PROMISE_TITLE = "Go boating worry-free, that's the alis promise"

DEFAULT_PROMISE_ITEMS = [
    {
        "title": "Trip protection that works for you",
        "body": (
            "Book with confidence. Cancel before your trip for a full refund when "
            "eligible under our flexible policy."
        ),
    },
    {
        "title": "Safe & secure payments",
        "body": (
            "Seamless checkout with protected transactions on every booking."
        ),
    },
]


def _promise_items(raw: str | None) -> list[MarketplacePromiseItemOut]:
    if not raw:
        return [MarketplacePromiseItemOut(**item) for item in DEFAULT_PROMISE_ITEMS]
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return [MarketplacePromiseItemOut(**item) for item in DEFAULT_PROMISE_ITEMS]
    if not isinstance(parsed, list):
        return [MarketplacePromiseItemOut(**item) for item in DEFAULT_PROMISE_ITEMS]
    items: list[MarketplacePromiseItemOut] = []
    for row in parsed:
        if isinstance(row, dict) and row.get("title"):
            items.append(
                MarketplacePromiseItemOut(
                    title=str(row["title"]),
                    body=str(row.get("body") or ""),
                )
            )
    return items or [MarketplacePromiseItemOut(**item) for item in DEFAULT_PROMISE_ITEMS]


def _location_label(city: str, state: str | None) -> str:
    return f"{city}, {state}" if state else city


def _cards_for_activities(
    activities: list[Activity], ratings: dict[int, tuple[float | None, int]]
) -> list[BoatCardOut]:
    return [boat_card(a, ratings) for a in activities]


def build_destination_page(
    db: Session,
    *,
    city: str,
    state: str | None,
    guests: int | None,
    ps: PlatformSettings,
) -> DestinationPageOut:
    city_clean = city.strip()
    state_clean = state.strip() if state else None
    location = _location_label(city_clean, state_clean)

    q = published_activities_query(db).filter(Activity.city.ilike(city_clean))
    if state_clean:
        q = q.filter(Activity.state.ilike(state_clean))
    if guests:
        q = q.filter(Activity.max_guests >= guests)

    activities = q.order_by(Activity.title).all()
    ratings = rating_aggregates(db, [a.id for a in activities])
    cards = _cards_for_activities(activities, ratings)

    breadcrumbs = [
        BreadcrumbOut(label="Boat Rentals", href="/boats"),
    ]
    if state_clean:
        breadcrumbs.append(
            BreadcrumbOut(
                label=f"{state_clean} Boat Rentals",
                href=f"/boats?state={state_clean}",
            )
        )
    breadcrumbs.append(BreadcrumbOut(label=city_clean, href=None))

    best_template = ps.destination_best_title_template or "Best boat rentals in {location}"
    type_template = ps.destination_type_title_template or "{type} boat rentals"

    sections: list[DestinationSectionOut] = []

    if cards:
        rated = sorted(
            cards,
            key=lambda c: (
                c.review_count == 0,
                -(c.average_rating or 0),
                -c.review_count,
                c.title.lower(),
            ),
        )
        sections.append(
            DestinationSectionOut(
                id="best",
                title=best_template.replace("{location}", location),
                boat_type=None,
                boats=rated[:12],
                more_href=f"/boats?city={city_clean}&state={state_clean or ''}&view=grid&sort=rating",
            )
        )

        by_type: dict[str, list[BoatCardOut]] = defaultdict(list)
        for card in cards:
            key = card.boat_type or "other"
            by_type[key].append(card)

        for boat_type in sorted(by_type.keys(), key=lambda k: boat_type_label(k).lower()):
            type_cards = sorted(by_type[boat_type], key=lambda c: c.title.lower())
            type_label = boat_type_label(boat_type if boat_type != "other" else None)
            sections.append(
                DestinationSectionOut(
                    id=f"type-{boat_type}",
                    title=type_template.replace("{type}", type_label).replace(
                        "{location}", location
                    ),
                    boat_type=None if boat_type == "other" else boat_type,
                    boats=type_cards[:12],
                    more_href=(
                        f"/boats?city={city_clean}&state={state_clean or ''}"
                        f"&boat_type={boat_type}&view=grid"
                    ),
                )
            )

    promise = MarketplacePromiseOut(
        title=ps.marketplace_promise_title or DEFAULT_PROMISE_TITLE,
        items=_promise_items(ps.marketplace_promise_items),
    )

    return DestinationPageOut(
        city=city_clean,
        state=state_clean,
        label=location,
        boat_count=len(cards),
        breadcrumbs=breadcrumbs,
        sections=sections,
        promise=promise,
    )
