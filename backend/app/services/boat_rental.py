"""Instant boat rental quotes and bookings."""

from __future__ import annotations

import secrets
import string
from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Activity, Booking, BookingItem, BookingStatus, ListingStatus, Slot, TicketType
from app.services.booking import pending_holds_for_slot
from app.schemas import CreateRentalIn, RentalQuoteOut
from app.services.fees import calc_booking_split
from app.services.platform_settings import get_platform_settings
from app.services.pricing import calc_tax
from app.timeutil import utc_naive, utcnow

INSURANCE_CENTS = 16_986
WATER_SCOOTER_CENTS = 17_000
CAPTAIN_RATE = 0.20
DEFAULT_HOURLY_CENTS = 35_000


def _ref() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "CC" + "".join(secrets.choice(alphabet) for _ in range(8))


def hourly_rate_cents(activity: Activity) -> int:
    if activity.hourly_rate_cents:
        return activity.hourly_rate_cents
    if activity.ticket_types:
        min_price = min(t.price_cents for t in activity.ticket_types)
        guests = activity.max_guests or 1
        return max(DEFAULT_HOURLY_CENTS, (min_price * guests) // 2)
    return DEFAULT_HOURLY_CENTS


def parse_start_time(value: str) -> time:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise ValueError("Invalid start time")
    hour, minute = int(parts[0]), int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Invalid start time")
    return time(hour=hour, minute=minute)


def rental_starts_at(rental_date: date, start_time: str) -> datetime:
    t = parse_start_time(start_time)
    return datetime.combine(rental_date, t)


def rental_ends_at(starts_at: datetime, duration_hours: int) -> datetime:
    return starts_at + timedelta(hours=duration_hours)


def rental_ends_at_booking(booking: Booking) -> datetime:
    starts = booking.rental_starts_at or booking.created_at
    return rental_ends_at(starts, booking.duration_hours or 0)


def _windows_overlap(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    return a_start < b_end and b_start < a_end


def rental_window_is_available(
    db: Session,
    activity_id: int,
    starts_at: datetime,
    ends_at: datetime,
    *,
    exclude_booking_id: int | None = None,
) -> bool:
    """One boat cannot be double-booked for overlapping rental windows."""
    now = utc_naive(utcnow())
    rows = (
        db.query(Booking)
        .filter(
            Booking.activity_id == activity_id,
            Booking.booking_kind == "rental",
            Booking.rental_starts_at.isnot(None),
            or_(
                Booking.status == BookingStatus.PAID,
                and_(
                    Booking.status == BookingStatus.PENDING,
                    Booking.hold_expires_at > now,
                ),
            ),
        )
        .all()
    )
    for booking in rows:
        if exclude_booking_id and booking.id == exclude_booking_id:
            continue
        if _windows_overlap(
            starts_at,
            ends_at,
            booking.rental_starts_at,
            rental_ends_at_booking(booking),
        ):
            return False
    return True


def assert_rental_available(
    db: Session,
    activity_id: int,
    starts_at: datetime,
    ends_at: datetime,
    *,
    exclude_booking_id: int | None = None,
) -> None:
    if not rental_window_is_available(
        db, activity_id, starts_at, ends_at, exclude_booking_id=exclude_booking_id
    ):
        raise ValueError("This boat is already reserved for that time")


def quote_rental(
    activity: Activity,
    *,
    duration_hours: int,
    passenger_count: int,
    captain_included: bool,
    insurance_selected: bool = False,
    water_scooter_addon: bool = False,
) -> RentalQuoteOut:
    if activity.max_guests and passenger_count > activity.max_guests:
        raise ValueError(f"This boat allows up to {activity.max_guests} passengers")

    rate = hourly_rate_cents(activity)
    boat_cents = rate * duration_hours
    captain_cents = int(boat_cents * CAPTAIN_RATE) if captain_included else 0
    insurance_cents = INSURANCE_CENTS if insurance_selected else 0
    addon_cents = WATER_SCOOTER_CENTS if water_scooter_addon else 0
    subtotal = boat_cents + captain_cents + insurance_cents + addon_cents

    return RentalQuoteOut(
        boat_price_cents=boat_cents,
        captain_price_cents=captain_cents,
        insurance_cents=insurance_cents,
        addon_cents=addon_cents,
        subtotal_cents=subtotal,
        duration_hours=duration_hours,
        hourly_rate_cents=rate,
        captain_included=captain_included,
    )


def ensure_rental_ticket_type(db: Session, activity: Activity) -> TicketType:
    tt = (
        db.query(TicketType)
        .filter(TicketType.activity_id == activity.id)
        .order_by(TicketType.sort_order, TicketType.id)
        .first()
    )
    if tt:
        return tt
    tt = TicketType(
        activity_id=activity.id,
        name="Boat rental",
        subtitle="Hourly charter",
        price_cents=hourly_rate_cents(activity),
        sort_order=0,
    )
    db.add(tt)
    db.flush()
    return tt


def _get_or_create_rental_slot(
    db: Session,
    activity: Activity,
    starts_at: datetime,
    duration_hours: int,
) -> Slot:
    ends_at = starts_at + timedelta(hours=duration_hours)
    slot = (
        db.query(Slot)
        .filter(
            Slot.activity_id == activity.id,
            Slot.starts_at == starts_at,
            Slot.ends_at == ends_at,
        )
        .with_for_update()
        .first()
    )
    if slot:
        if slot.is_cancelled:
            raise ValueError("This time is no longer available")
        return slot

    slot = Slot(
        activity_id=activity.id,
        starts_at=starts_at,
        ends_at=ends_at,
        capacity=1,
        booked_count=0,
        waitlist_enabled=False,
    )
    db.add(slot)
    db.flush()
    return slot


def create_rental_booking(
    db: Session,
    activity: Activity,
    payload: CreateRentalIn,
    renter_user_id: int,
    customer_name: str,
    customer_email: str,
) -> Booking:
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity.id)
        .with_for_update()
        .first()
    )
    if not activity or activity.listing_status != ListingStatus.PUBLISHED or not activity.is_active:
        raise ValueError("This boat is not available for booking")

    starts_at = rental_starts_at(payload.rental_date, payload.start_time)
    ends_at = rental_ends_at(starts_at, payload.duration_hours)
    if starts_at < utc_naive(utcnow()):
        raise ValueError("Cannot book a trip in the past")

    assert_rental_available(db, activity.id, starts_at, ends_at)

    quote = quote_rental(
        activity,
        duration_hours=payload.duration_hours,
        passenger_count=payload.passenger_count,
        captain_included=payload.captain_included,
        insurance_selected=payload.insurance_selected,
        water_scooter_addon=payload.water_scooter_addon,
    )

    slot = _get_or_create_rental_slot(db, activity, starts_at, payload.duration_hours)
    if slot.capacity != 1:
        slot.capacity = 1
    holds = pending_holds_for_slot(db, slot.id)
    if slot.booked_count + holds >= slot.capacity:
        raise ValueError("This time is no longer available")

    ps = get_platform_settings(db)
    tax = calc_tax(quote.subtotal_cents, ps.tax_rate_percent)
    platform_fee, owner_payout = calc_booking_split(
        quote.subtotal_cents, 0, ps.platform_fee_percent
    )
    total = quote.subtotal_cents + tax
    hold_until = utc_naive(utcnow() + timedelta(minutes=settings.booking_hold_minutes))

    from app.services.captains import resolve_captain_id_for_booking

    captain_id = resolve_captain_id_for_booking(
        db, activity, payload.captain_slug, payload.captain_included
    )

    booking = Booking(
        reference=_ref(),
        organization_id=activity.organization_id,
        renter_user_id=renter_user_id,
        activity_id=activity.id,
        slot_id=slot.id,
        booking_kind="rental",
        rental_starts_at=starts_at,
        duration_hours=payload.duration_hours,
        passenger_count=payload.passenger_count,
        captain_id=captain_id,
        captain_included=payload.captain_included,
        insurance_cents=quote.insurance_cents,
        addon_cents=quote.addon_cents,
        boat_price_cents=quote.boat_price_cents,
        captain_price_cents=quote.captain_price_cents,
        status=BookingStatus.PENDING,
        customer_name=customer_name.strip(),
        customer_email=customer_email.lower(),
        subtotal_cents=quote.subtotal_cents,
        discount_cents=0,
        tax_cents=tax,
        total_cents=total,
        platform_fee_cents=platform_fee,
        owner_payout_cents=owner_payout,
        hold_expires_at=hold_until,
        is_waitlist=False,
        ack_public_trip=True,
        ack_route=True,
        created_at=utc_naive(utcnow()),
    )
    db.add(booking)
    db.flush()

    tt = ensure_rental_ticket_type(db, activity)
    db.add(
        BookingItem(
            booking_id=booking.id,
            ticket_type_id=tt.id,
            quantity=1,
            unit_price_cents=quote.subtotal_cents,
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


def load_published_activity(db: Session, slug: str) -> Activity | None:
    return (
        db.query(Activity)
        .options(joinedload(Activity.ticket_types), joinedload(Activity.organization))
        .filter(
            Activity.slug == slug,
            Activity.listing_status == ListingStatus.PUBLISHED,
            Activity.is_active.is_(True),
        )
        .first()
    )
