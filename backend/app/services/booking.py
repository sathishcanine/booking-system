import secrets
import string
from datetime import datetime, timedelta

from app.timeutil import utc_naive, utcnow

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import (
    Activity,
    Booking,
    BookingItem,
    BookingStatus,
    PromoCode,
    Slot,
    TicketType,
)
from app.schemas import BookingLineIn, CreateBookingIn
from app.services.availability import (
    is_past_booking_cutoff,
    is_slot_departed,
    slot_status,
    spots_left,
)
from app.services.pricing import apply_promo, calc_tax
from app.services.promo import is_promo_exhausted


def _ref() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "CC" + "".join(secrets.choice(alphabet) for _ in range(8))


def pending_holds_for_slot(db: Session, slot_id: int) -> int:
    """Seats held by unpaid bookings that haven't expired."""
    now = utc_naive(utcnow())
    rows = (
        db.query(func.coalesce(func.sum(BookingItem.quantity), 0))
        .join(Booking)
        .filter(
            Booking.slot_id == slot_id,
            Booking.status == BookingStatus.PENDING,
            Booking.hold_expires_at > now,
        )
        .scalar()
    )
    return int(rows or 0)


def validate_lines(
    db: Session,
    activity: Activity,
    lines: list[BookingLineIn],
    max_total: int,
) -> tuple[list[tuple[TicketType, int]], int]:
    ticket_map = {t.id: t for t in activity.ticket_types}
    total_qty = 0
    resolved: list[tuple[TicketType, int]] = []

    for line in lines:
        if line.quantity <= 0:
            continue
        tt = ticket_map.get(line.ticket_type_id)
        if not tt:
            raise ValueError(f"Invalid ticket type {line.ticket_type_id}")
        if tt.max_per_booking and line.quantity > tt.max_per_booking:
            raise ValueError(f"Max {tt.max_per_booking} for {tt.name}")
        total_qty += line.quantity
        resolved.append((tt, line.quantity))

    if total_qty == 0:
        raise ValueError("Select at least one ticket")
    if total_qty > max_total:
        raise ValueError(f"Only {max_total} spots available")

    return resolved, total_qty


def create_booking(db: Session, payload: CreateBookingIn) -> Booking:
    slot = (
        db.query(Slot)
        .options(joinedload(Slot.activity).joinedload(Activity.ticket_types))
        .filter(Slot.id == payload.slot_id, Slot.is_cancelled.is_(False))
        .with_for_update()
        .first()
    )
    if not slot:
        raise ValueError("Slot not found")
    if is_slot_departed(slot):
        raise ValueError("This departure has already started")
    if is_past_booking_cutoff(slot):
        raise ValueError("Online booking has closed for this departure")

    holds = pending_holds_for_slot(db, slot.id)
    left = spots_left(slot) - holds
    status = slot_status(slot, holds)

    if status.value == "sold_out" and not payload.join_waitlist:
        raise ValueError("This departure is sold out")
    if status.value == "waitlist" and not payload.join_waitlist:
        raise ValueError("Join the waitlist or choose another time")

    if not payload.ack_public_trip or not payload.ack_route:
        raise ValueError("Required acknowledgments must be accepted")

    max_per_booking = min(left, 20) if left > 0 else 20
    resolved, total_qty = validate_lines(db, slot.activity, payload.lines, max_per_booking)

    subtotal = sum(tt.price_cents * qty for tt, qty in resolved)
    promo = None
    if payload.promo_code:
        promo = (
            db.query(PromoCode)
            .filter(
                PromoCode.code == payload.promo_code.upper().strip(),
                PromoCode.is_active.is_(True),
            )
            .first()
        )
        if not promo:
            raise ValueError("Invalid promo code")
        if promo.valid_until and promo.valid_until < utcnow():
            raise ValueError("Promo code expired")
        if is_promo_exhausted(promo):
            raise ValueError("Promo code no longer available")

    discount = apply_promo(promo, subtotal)
    after_discount = max(0, subtotal - discount)
    tax = calc_tax(after_discount)
    total = after_discount + tax

    is_waitlist = left <= 0 and payload.join_waitlist
    hold_until = utc_naive(utcnow() + timedelta(minutes=settings.booking_hold_minutes))

    booking = Booking(
        reference=_ref(),
        slot_id=slot.id,
        status=BookingStatus.PENDING,
        customer_name=payload.customer_name.strip(),
        customer_email=payload.customer_email.lower(),
        customer_phone=payload.customer_phone,
        marketing_opt_in=payload.marketing_opt_in,
        promo_code=payload.promo_code.upper().strip() if payload.promo_code else None,
        subtotal_cents=subtotal,
        discount_cents=discount,
        tax_cents=tax,
        total_cents=total if not is_waitlist else 0,
        hold_expires_at=hold_until,
        is_waitlist=is_waitlist,
        heard_about=payload.heard_about,
        been_before=payload.been_before,
        comments=payload.comments,
        ack_public_trip=payload.ack_public_trip,
        ack_route=payload.ack_route,
        created_at=utc_naive(utcnow()),
    )
    db.add(booking)
    db.flush()

    for tt, qty in resolved:
        db.add(
            BookingItem(
                booking_id=booking.id,
                ticket_type_id=tt.id,
                quantity=qty,
                unit_price_cents=tt.price_cents,
            )
        )

    db.commit()
    db.refresh(booking)
    return booking
