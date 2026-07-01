"""Public marketplace discovery endpoints (Phase 8)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.listings import primary_photo
from app.models import Activity, ListingStatus
from app.marketplace_config import (
    BOAT_CATEGORIES,
    DEFAULT_LENGTH_MAX_FT,
    DEFAULT_PRICE_MAX_CENTS,
    DURATION_FILTER_HOURS,
    MARKET_CITY,
    MARKET_LABEL,
    MARKET_STATE,
    POPULAR_AMENITIES,
)
from app.schemas import DestinationOut, DestinationPageOut, MarketplaceCategoryOut, SearchConfigOut
from app.services.destination_page import build_destination_page
from app.services.platform_settings import get_platform_settings

router = APIRouter(prefix="/api", tags=["marketplace"])


def _published_activities(db: Session):
    return db.query(Activity).filter(
        Activity.listing_status == ListingStatus.PUBLISHED,
        Activity.is_active.is_(True),
    )


@router.get("/search-config", response_model=SearchConfigOut)
def search_config(db: Session = Depends(get_db)):
    min_rate = (
        db.query(func.min(Activity.hourly_rate_cents))
        .filter(
            Activity.listing_status == ListingStatus.PUBLISHED,
            Activity.is_active.is_(True),
            Activity.hourly_rate_cents.isnot(None),
        )
        .scalar()
    )
    return SearchConfigOut(
        categories=[MarketplaceCategoryOut(**c) for c in BOAT_CATEGORIES],
        duration_hours=DURATION_FILTER_HOURS,
        popular_amenities=POPULAR_AMENITIES,
        price_min_cents=int(min_rate or 14_000),
        price_max_cents=DEFAULT_PRICE_MAX_CENTS,
        length_max_ft=DEFAULT_LENGTH_MAX_FT,
        market_city=MARKET_CITY,
        market_state=MARKET_STATE,
        market_label=MARKET_LABEL,
    )


@router.get("/destinations", response_model=list[DestinationOut])
def list_destinations(db: Session = Depends(get_db)):
    count = (
        _published_activities(db)
        .filter(Activity.city.ilike(MARKET_CITY), Activity.state.ilike(MARKET_STATE))
        .count()
    )
    if count == 0:
        return []
    sample = (
        _published_activities(db)
        .filter(Activity.city.ilike(MARKET_CITY), Activity.state.ilike(MARKET_STATE))
        .order_by(Activity.id)
        .first()
    )
    return [
        DestinationOut(
            city=MARKET_CITY,
            state=MARKET_STATE,
            label=MARKET_LABEL,
            boat_count=count,
            image_url=primary_photo(sample) if sample else None,
        )
    ]


@router.get("/destinations/page", response_model=DestinationPageOut)
def destination_page(
    city: str = Query(..., min_length=1),
    state: str | None = Query(None),
    guests: int | None = Query(None, ge=1, le=500),
    db: Session = Depends(get_db),
):
    ps = get_platform_settings(db)
    page = build_destination_page(db, city=city, state=state, guests=guests, ps=ps)
    if page.boat_count == 0:
        raise HTTPException(404, f"No boats found in {page.label}")
    return page


@router.get("/sitemap.xml")
def sitemap_xml(db: Session = Depends(get_db)):
    base = settings.frontend_url.rstrip("/")
    slugs = [a.slug for a in _published_activities(db).order_by(Activity.title).all()]
    static_paths = ["/", "/boats", "/calendar", "/account/login"]
    paths = static_paths + [f"/boats/{slug}" for slug in slugs]

    body = ['<?xml version="1.0" encoding="UTF-8"?>']
    body.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for path in paths:
        body.append(f"  <url><loc>{base}{path}</loc></url>")
    body.append("</urlset>")

    return Response(content="\n".join(body), media_type="application/xml")
