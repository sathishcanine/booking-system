from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Activity, ListingStatus, Review
from app.marketplace_config import MARKET_CITY, MARKET_STATE
from app.schemas import (
    BoatCardOut,
    BoatDetailOut,
    BoatsPageOut,
    CaptainProfilePageOut,
    OwnerProfilePageOut,
    RentalQuoteOut,
    ReviewOut,
)
from app.services.boat_catalog import boat_card, published_activities_query
from app.services.boat_rental import quote_rental
from app.services.boat_search import activity_matches_filters
from app.services.reviews import rating_aggregates

router = APIRouter(prefix="/api/boats", tags=["boats"])


def _sort_cards(cards: list[BoatCardOut], sort: str | None) -> list[BoatCardOut]:
    if sort == "price_asc":
        cards.sort(key=lambda c: (c.starting_price_cents is None, c.starting_price_cents or 0))
    elif sort == "price_desc":
        cards.sort(
            key=lambda c: (c.starting_price_cents is None, -(c.starting_price_cents or 0))
        )
    elif sort == "rating":
        cards.sort(
            key=lambda c: (
                c.review_count == 0,
                -(c.average_rating or 0),
                -c.review_count,
            )
        )
    else:
        cards.sort(key=lambda c: c.title.lower())
    return cards


@router.get("", response_model=BoatsPageOut)
def list_boats(
    city: str | None = Query(None),
    state: str | None = Query(None),
    boat_type: str | None = Query(None),
    category: str | None = Query(None),
    guests: int | None = Query(None, ge=1, le=500),
    price_min: int | None = Query(None, ge=0, description="Min hourly rate in cents"),
    price_max: int | None = Query(None, ge=0, description="Max hourly rate in cents"),
    duration_hours: int | None = Query(None, ge=1, le=24),
    captain: str | None = Query(None, pattern="^(captained|bareboat)$"),
    instant_book: bool | None = Query(None),
    length_min_ft: int | None = Query(None, ge=0),
    length_max_ft: int | None = Query(None, ge=1),
    amenity: str | None = Query(None),
    sort: str | None = Query(None, pattern="^(price_asc|price_desc|title|rating)$"),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = published_activities_query(db).filter(
        Activity.city.ilike(MARKET_CITY),
        Activity.state.ilike(MARKET_STATE),
    )
    if boat_type:
        q = q.filter(Activity.boat_type == boat_type.strip().lower())
    if guests:
        q = q.filter(Activity.max_guests.isnot(None), Activity.max_guests >= guests)
    rows = q.order_by(Activity.title).all()
    rows = [
        a
        for a in rows
        if activity_matches_filters(
            a,
            category=category,
            price_min_cents=price_min,
            price_max_cents=price_max,
            duration_hours=duration_hours,
            captain=captain,
            guests=guests,
            instant_book=instant_book,
            length_min_ft=length_min_ft,
            length_max_ft=length_max_ft,
            amenity=amenity,
        )
    ]
    ratings = rating_aggregates(db, [a.id for a in rows])
    cards = _sort_cards([boat_card(a, ratings) for a in rows], sort)
    page = cards[offset : offset + limit]
    return BoatsPageOut(items=page, total=len(cards), limit=limit, offset=offset)


@router.get("/featured", response_model=list[BoatCardOut])
def featured_boats(
    limit: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    rows = (
        published_activities_query(db)
        .filter(Activity.city.ilike(MARKET_CITY), Activity.state.ilike(MARKET_STATE))
        .order_by(Activity.title)
        .all()
    )
    ratings = rating_aggregates(db, [a.id for a in rows])
    cards = [boat_card(a, ratings) for a in rows]
    cards.sort(
        key=lambda c: (
            c.review_count == 0,
            -(c.average_rating or 0),
            -c.review_count,
            c.title.lower(),
        )
    )
    return cards[:limit]


@router.get("/{slug}/reviews", response_model=list[ReviewOut])
def list_boat_reviews(
    slug: str,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    activity = published_activities_query(db).filter(Activity.slug == slug).first()
    if not activity:
        raise HTTPException(404, "Boat not found")
    rows = (
        db.query(Review)
        .filter(Review.activity_id == activity.id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ReviewOut(
            id=r.id,
            rating=r.rating,
            body=r.body,
            reviewer_name=r.reviewer_name,
            created_at=r.created_at,
            owner_response=r.owner_response,
            owner_response_at=r.owner_response_at,
        )
        for r in rows
    ]


@router.get("/{slug}/rental-quote", response_model=RentalQuoteOut)
def boat_rental_quote(
    slug: str,
    duration_hours: int = Query(2, ge=1, le=12),
    passengers: int = Query(4, ge=1, le=50),
    captain: bool = Query(True),
    insurance: bool = Query(False),
    water_scooter: bool = Query(False),
    db: Session = Depends(get_db),
):
    activity = published_activities_query(db).filter(Activity.slug == slug).first()
    if not activity:
        raise HTTPException(404, "Boat not found")
    captain_included = captain or activity.captain_required
    try:
        return quote_rental(
            activity,
            duration_hours=duration_hours,
            passenger_count=passengers,
            captain_included=captain_included,
            insurance_selected=insurance,
            water_scooter_addon=water_scooter,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/{slug}", response_model=BoatDetailOut)
def get_boat(slug: str, db: Session = Depends(get_db)):
    from app.services.boat_detail import build_listing_policies, build_owner_profile
    from app.services.captains import build_captain_alternatives, build_default_captain
    from app.services.cancellation import policy_summary_text
    from app.services.platform_settings import get_platform_settings

    activity = (
        published_activities_query(db)
        .filter(Activity.slug == slug)
        .first()
    )
    if not activity:
        raise HTTPException(404, "Boat not found")
    ratings = rating_aggregates(db, [activity.id])
    avg, count = ratings.get(activity.id, (None, 0))
    card = boat_card(activity, ratings)
    cancel_summary = policy_summary_text(get_platform_settings(db))
    return BoatDetailOut(
        **card.model_dump(),
        description=activity.description,
        meeting_instructions=activity.meeting_instructions,
        owner=build_owner_profile(activity, count, avg),
        default_captain=build_default_captain(db, activity),
        captain_alternatives=build_captain_alternatives(db, activity),
        policies=build_listing_policies(activity, db, cancel_summary),
    )


@router.get("/{slug}/owner-profile", response_model=OwnerProfilePageOut)
def get_boat_owner_profile(slug: str, db: Session = Depends(get_db)):
    from app.services.crew_profiles import build_owner_profile_page

    profile = build_owner_profile_page(db, slug)
    if not profile:
        raise HTTPException(404, "Owner profile not found")
    return profile


@router.get("/{slug}/captains/{captain_id}/profile", response_model=CaptainProfilePageOut)
def get_boat_captain_profile(slug: str, captain_id: str, db: Session = Depends(get_db)):
    from app.services.crew_profiles import build_captain_profile_page

    profile = build_captain_profile_page(db, captain_id, slug)
    if not profile:
        raise HTTPException(404, "Captain profile not found")
    return profile
