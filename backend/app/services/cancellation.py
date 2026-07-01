"""Cancellation policy evaluation and booking cancellation."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import stripe
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Booking, BookingStatus, PlatformSettings, Slot
from app.services.platform_settings import get_platform_settings
from app.services.promo import release_promo_use
from app.services.stripe_service import refund_booking_payment
from app.timeutil import as_utc, utc_naive, utcnow

logger = logging.getLogger(__name__)
stripe.api_key = settings.stripe_secret_key


@dataclass(frozen=True)
class RefundPreview:
    can_cancel: bool
    message: str | None
    refund_cents: int
    refund_percent: int
    hours_until_departure: float | None
    policy_summary: str


def _departure_at(booking: Booking, slot: Slot | None):
    if booking.booking_kind == "rental" and booking.rental_starts_at:
        return booking.rental_starts_at
    if slot:
        return slot.starts_at
    return None


def hours_until_departure(booking: Booking, slot: Slot | None) -> float | None:
    dt = _departure_at(booking, slot)
    if not dt:
        return None
    delta = as_utc(dt) - utcnow()
    return delta.total_seconds() / 3600


def is_departed(booking: Booking, slot: Slot | None) -> bool:
    dt = _departure_at(booking, slot)
    if not dt:
        return False
    return as_utc(dt) <= utcnow()


def policy_summary_text(ps: PlatformSettings) -> str:
    full_h = int(ps.cancel_full_refund_hours)
    partial_h = int(ps.cancel_partial_refund_hours)
    pct = int(ps.cancel_partial_refund_percent)
    return (
        f"Free cancellation with a full refund up to {full_h} hours before departure. "
        f"Between {partial_h} and {full_h} hours before, receive a {pct}% refund. "
        f"Within {partial_h} hours of departure, bookings are non-refundable."
    )


def compute_refund_cents(
    booking: Booking,
    slot: Slot | None,
    ps: PlatformSettings,
    *,
    force_full: bool = False,
) -> int:
    if booking.status != BookingStatus.PAID:
        return 0
    if force_full or booking.is_waitlist:
        return booking.total_cents
    if not slot:
        return 0

    hours = hours_until_departure(booking, slot)
    if hours is None or hours <= 0:
        return 0
    if hours >= ps.cancel_full_refund_hours:
        return booking.total_cents
    if hours >= ps.cancel_partial_refund_hours:
        return int(round(booking.total_cents * ps.cancel_partial_refund_percent / 100))
    return 0


def preview_cancellation(
    booking: Booking,
    slot: Slot | None,
    ps: PlatformSettings,
    *,
    force_full: bool = False,
) -> RefundPreview:
    summary = policy_summary_text(ps)
    hours = hours_until_departure(booking, slot)

    if booking.status == BookingStatus.CANCELLED:
        return RefundPreview(False, "This booking is already cancelled", 0, 0, hours, summary)
    if booking.status == BookingStatus.EXPIRED:
        return RefundPreview(False, "This booking has expired", 0, 0, hours, summary)
    if is_departed(booking, slot):
        return RefundPreview(
            False, "This trip has already started", 0, 0, hours, summary
        )

    if booking.status == BookingStatus.PENDING:
        return RefundPreview(True, None, 0, 0, hours, summary)

    if booking.status != BookingStatus.PAID:
        return RefundPreview(
            False,
            f"Cannot cancel a {booking.status.value} booking",
            0,
            0,
            hours,
            summary,
        )

    refund_cents = compute_refund_cents(booking, slot, ps, force_full=force_full)
    refund_percent = (
        int(round(100 * refund_cents / booking.total_cents)) if booking.total_cents else 0
    )
    return RefundPreview(True, None, refund_cents, refund_percent, hours, summary)


def apply_cancellation(
    db: Session,
    booking: Booking,
    *,
    cancelled_by: str,
    reason: str | None = None,
    force_full_refund: bool = False,
) -> Booking:
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.items))
        .filter(Booking.id == booking.id)
        .with_for_update()
        .first()
    )
    if not booking:
        raise ValueError("Booking not found")

    slot = (
        db.query(Slot)
        .filter(Slot.id == booking.slot_id)
        .with_for_update()
        .first()
    )
    ps = get_platform_settings(db)
    preview = preview_cancellation(booking, slot, ps, force_full=force_full_refund)
    if not preview.can_cancel:
        raise ValueError(preview.message or "Cannot cancel this booking")

    refund_cents = preview.refund_cents
    stripe_refund_id: str | None = None

    if booking.status == BookingStatus.PENDING:
        if booking.stripe_payment_intent_id and settings.stripe_secret_key:
            try:
                intent = stripe.PaymentIntent.retrieve(booking.stripe_payment_intent_id)
                if intent.status not in ("succeeded", "canceled"):
                    stripe.PaymentIntent.cancel(booking.stripe_payment_intent_id)
            except Exception:
                logger.exception(
                    "Could not cancel PaymentIntent for booking %s", booking.reference
                )
        booking.hold_expires_at = None
    elif booking.status == BookingStatus.PAID:
        if slot:
            qty = sum(i.quantity for i in booking.items)
            slot.booked_count = max(0, slot.booked_count - qty)
        release_promo_use(db, booking.promo_code)
        if refund_cents > 0:
            stripe_refund_id = refund_booking_payment(db, booking, refund_cents)
    else:
        raise ValueError(f"Cannot cancel booking with status {booking.status.value}")

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = utc_naive(utcnow())
    booking.refund_cents = refund_cents
    booking.cancellation_reason = reason
    booking.cancelled_by = cancelled_by
    booking.stripe_refund_id = stripe_refund_id
    db.commit()
    db.refresh(booking)
    return booking
