import logging

import stripe
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Activity, Booking, BookingStatus, Organization, Slot
from app.services.connect import connect_ready
from app.services.promo import record_promo_use

logger = logging.getLogger(__name__)
stripe.api_key = settings.stripe_secret_key


def _load_booking_org(db: Session, booking: Booking) -> Organization | None:
    if booking.organization_id:
        return db.query(Organization).filter(Organization.id == booking.organization_id).first()
    if booking.activity_id:
        activity = db.query(Activity).filter(Activity.id == booking.activity_id).first()
        if activity:
            return db.query(Organization).filter(Organization.id == activity.organization_id).first()
    slot = (
        db.query(Slot)
        .options(joinedload(Slot.activity))
        .filter(Slot.id == booking.slot_id)
        .first()
    )
    if not slot or not slot.activity:
        return None
    return db.query(Organization).filter(Organization.id == slot.activity.organization_id).first()


def _intent_params(booking: Booking, org: Organization | None) -> dict:
    params: dict = {
        "amount": booking.total_cents,
        "currency": "usd",
        "metadata": {
            "booking_id": str(booking.id),
            "reference": booking.reference,
            "organization_id": str(booking.organization_id or ""),
        },
        "receipt_email": booking.customer_email,
        "automatic_payment_methods": {"enabled": True},
    }
    if connect_ready(org):
        params["application_fee_amount"] = booking.platform_fee_cents + booking.tax_cents
        params["transfer_data"] = {"destination": org.stripe_connect_account_id}
    return params


def create_payment_intent(db: Session, booking: Booking) -> str | None:
    if booking.is_waitlist or booking.total_cents <= 0:
        return None
    if not settings.stripe_secret_key:
        return None

    org = _load_booking_org(db, booking)
    intent = stripe.PaymentIntent.create(**_intent_params(booking, org))
    return intent.client_secret


def attach_payment_intent(db: Session, booking: Booking) -> str | None:
    if booking.stripe_payment_intent_id:
        intent = stripe.PaymentIntent.retrieve(booking.stripe_payment_intent_id)
        if intent.status == "canceled":
            booking.stripe_payment_intent_id = None
            db.commit()
        elif intent.status in (
            "requires_payment_method",
            "requires_confirmation",
            "requires_action",
            "processing",
            "succeeded",
        ):
            return intent.client_secret
        else:
            booking.stripe_payment_intent_id = None
            db.commit()

    if booking.is_waitlist or booking.total_cents <= 0:
        return None
    if not settings.stripe_secret_key:
        return None

    org = _load_booking_org(db, booking)
    intent = stripe.PaymentIntent.create(**_intent_params(booking, org))
    booking.stripe_payment_intent_id = intent.id
    db.commit()
    return intent.client_secret


def confirm_booking_paid(db, booking_id: int, payment_intent_id: str) -> bool:
    from sqlalchemy.orm import joinedload

    from app.models import BookingItem

    booking = (
        db.query(Booking)
        .options(joinedload(Booking.items))
        .filter(Booking.id == booking_id)
        .with_for_update()
        .first()
    )
    if not booking:
        return False
    if booking.status == BookingStatus.PAID:
        return True

    if booking.stripe_payment_intent_id != payment_intent_id:
        return False

    if booking.status not in (BookingStatus.PENDING, BookingStatus.CANCELLED):
        return False

    if booking.is_waitlist:
        booking.status = BookingStatus.PAID
        record_promo_use(db, booking.promo_code)
        db.commit()
        return True

    if booking.booking_kind == "rental" and booking.activity_id and booking.rental_starts_at:
        from app.services.boat_rental import assert_rental_available, rental_ends_at_booking

        try:
            assert_rental_available(
                db,
                booking.activity_id,
                booking.rental_starts_at,
                rental_ends_at_booking(booking),
                exclude_booking_id=booking.id,
            )
        except ValueError:
            if booking.status == BookingStatus.PENDING:
                booking.status = BookingStatus.CANCELLED
                db.commit()
            return False

    slot = db.query(Slot).filter(Slot.id == booking.slot_id).with_for_update().first()
    if not slot:
        if booking.status == BookingStatus.PENDING:
            booking.status = BookingStatus.CANCELLED
            db.commit()
        return False

    db.refresh(booking)
    if booking.status == BookingStatus.PAID:
        return True

    qty = sum(i.quantity for i in booking.items)
    if booking.booking_kind == "rental":
        qty = 1
        if slot.capacity != 1:
            slot.capacity = 1

    seats_needed = 0 if booking.status == BookingStatus.CANCELLED else qty
    if slot.booked_count + seats_needed > slot.capacity:
        db.refresh(booking)
        if booking.status == BookingStatus.PAID:
            return True
        if booking.status == BookingStatus.PENDING:
            booking.status = BookingStatus.CANCELLED
            db.commit()
        return False

    if booking.status == BookingStatus.CANCELLED:
        # Recovery path: payment succeeded but a concurrent confirm cancelled the row.
        other_paid = (
            db.query(Booking)
            .filter(
                Booking.slot_id == slot.id,
                Booking.id != booking.id,
                Booking.status == BookingStatus.PAID,
            )
            .count()
        )
        if other_paid > 0 or slot.booked_count + qty > slot.capacity:
            if other_paid == 0 and slot.booked_count >= qty:
                # Capacity already consumed by this booking during the race — just restore PAID.
                pass
            else:
                return False
        else:
            slot.booked_count += qty
    else:
        slot.booked_count += qty

    booking.status = BookingStatus.PAID
    record_promo_use(db, booking.promo_code)
    db.commit()
    return True


def refund_booking_payment(db: Session, booking: Booking, refund_cents: int) -> str | None:
    """Issue a Stripe refund for a paid booking (supports Connect destination charges)."""
    if refund_cents <= 0 or not booking.stripe_payment_intent_id:
        return None
    if not settings.stripe_secret_key:
        logger.warning("Stripe not configured — skipping refund for %s", booking.reference)
        return None

    org = _load_booking_org(db, booking)
    params: dict = {
        "payment_intent": booking.stripe_payment_intent_id,
        "amount": refund_cents,
        "metadata": {
            "booking_id": str(booking.id),
            "reference": booking.reference,
        },
    }
    if connect_ready(org):
        params["reverse_transfer"] = True
        params["refund_application_fee"] = True

    refund = stripe.Refund.create(**params)
    return refund.id
