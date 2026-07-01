from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Booking, User
from app.platform_auth import PlatformUser, require_renter
from app.schemas import BookingSummaryOut, CreateRentalIn
from app.services.boat_rental import create_rental_booking, load_published_activity
from app.services.stripe_service import attach_payment_intent
from app.timeutil import as_utc, hold_seconds_remaining


def expire_stale_holds(db: Session):
    from app.main import expire_stale_holds as _expire

    _expire(db)


def _booking_summary(booking: Booking, client_secret: str | None) -> BookingSummaryOut:
    return BookingSummaryOut(
        booking_id=booking.id,
        reference=booking.reference,
        subtotal_cents=booking.subtotal_cents,
        discount_cents=booking.discount_cents,
        tax_cents=booking.tax_cents,
        total_cents=booking.total_cents,
        client_secret=client_secret,
        publishable_key=settings.stripe_publishable_key,
        is_waitlist=booking.is_waitlist,
        hold_expires_at=as_utc(booking.hold_expires_at),
        hold_seconds_remaining=hold_seconds_remaining(booking.hold_expires_at),
    )

router = APIRouter(prefix="/api/rentals", tags=["rentals"])


@router.post("", response_model=BookingSummaryOut)
def create_rental(
    body: CreateRentalIn,
    db: Session = Depends(get_db),
    renter: PlatformUser = Depends(require_renter),
):
    expire_stale_holds(db)
    activity = load_published_activity(db, body.activity_slug)
    if not activity:
        raise HTTPException(404, "Boat not found")

    user = db.query(User).filter(User.id == renter.user_id).first()
    if not user:
        raise HTTPException(401, "User not found")

    display = user.display_name or user.email.split("@")[0]
    try:
        booking = create_rental_booking(
            db,
            activity,
            body,
            renter_user_id=user.id,
            customer_name=display,
            customer_email=user.email,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    client_secret = None
    try:
        client_secret = attach_payment_intent(db, booking)
    except Exception:
        raise HTTPException(502, "Payment setup failed") from None

    summary = _booking_summary(booking, client_secret)
    if summary.total_cents > 0 and summary.hold_seconds_remaining <= 0:
        raise HTTPException(409, "Hold expired — please try again.")
    return summary


@router.get("/{reference}/summary")
def rental_summary(reference: str, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.reference == reference.upper()).first()
    if not booking or booking.booking_kind != "rental":
        raise HTTPException(404, "Rental not found")
    return {
        "reference": booking.reference,
        "status": booking.status.value,
        "boat_price_cents": booking.boat_price_cents,
        "captain_price_cents": booking.captain_price_cents,
        "insurance_cents": booking.insurance_cents,
        "addon_cents": booking.addon_cents,
        "subtotal_cents": booking.subtotal_cents,
        "tax_cents": booking.tax_cents,
        "total_cents": booking.total_cents,
        "duration_hours": booking.duration_hours,
        "passenger_count": booking.passenger_count,
        "captain_included": booking.captain_included,
        "rental_starts_at": booking.rental_starts_at,
    }
