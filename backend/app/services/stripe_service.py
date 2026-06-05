import stripe

from app.config import settings
from app.models import Booking, BookingStatus
from app.services.promo import record_promo_use

stripe.api_key = settings.stripe_secret_key


def create_payment_intent(booking: Booking) -> str | None:
    if booking.is_waitlist or booking.total_cents <= 0:
        return None
    if not settings.stripe_secret_key:
        return None

    intent = stripe.PaymentIntent.create(
        amount=booking.total_cents,
        currency="usd",
        metadata={
            "booking_id": str(booking.id),
            "reference": booking.reference,
        },
        receipt_email=booking.customer_email,
        automatic_payment_methods={"enabled": True},
    )
    return intent.client_secret


def attach_payment_intent(db, booking: Booking) -> str | None:
    if booking.stripe_payment_intent_id:
        intent = stripe.PaymentIntent.retrieve(booking.stripe_payment_intent_id)
        return intent.client_secret

    if booking.is_waitlist or booking.total_cents <= 0:
        return None

    intent = stripe.PaymentIntent.create(
        amount=booking.total_cents,
        currency="usd",
        metadata={
            "booking_id": str(booking.id),
            "reference": booking.reference,
        },
        receipt_email=booking.customer_email,
        automatic_payment_methods={"enabled": True},
    )
    booking.stripe_payment_intent_id = intent.id
    # reference also on intent for client redirect without extra API call
    db.commit()
    return intent.client_secret


def confirm_booking_paid(db, booking_id: int, payment_intent_id: str) -> bool:
    from sqlalchemy.orm import joinedload

    from app.models import BookingItem, Slot

    booking = (
        db.query(Booking)
        .options(joinedload(Booking.items))
        .filter(Booking.id == booking_id)
        .with_for_update()
        .first()
    )
    if not booking or booking.status == BookingStatus.PAID:
        return False

    if booking.stripe_payment_intent_id != payment_intent_id:
        return False

    if booking.is_waitlist:
        booking.status = BookingStatus.PAID
        record_promo_use(db, booking.promo_code)
        db.commit()
        return True

    slot = db.query(Slot).filter(Slot.id == booking.slot_id).with_for_update().first()
    qty = sum(i.quantity for i in booking.items)
    if slot.booked_count + qty > slot.capacity:
        # Overbooked — refund should be handled manually / via Stripe dashboard
        booking.status = BookingStatus.CANCELLED
        db.commit()
        return False

    slot.booked_count += qty
    booking.status = BookingStatus.PAID
    record_promo_use(db, booking.promo_code)
    db.commit()
    return True
