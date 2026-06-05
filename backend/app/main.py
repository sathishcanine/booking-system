import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, joinedload

import stripe

from app.admin_auth import validate_admin_auth_config
from app.config import settings
from app.database import get_db
from app.models import Activity, Booking, BookingStatus, PromoCode, Slot
from app.schemas import (
    BookingSummaryOut,
    CalendarDayOut,
    CalendarMonthOut,
    CalendarSlotOut,
    CalendarWeekOut,
    ConfigOut,
    CreateBookingIn,
    PromoValidateIn,
    PromoValidateOut,
    SlotDetailOut,
    TicketTypeOut,
)
from app.services.calendar_grid import (
    build_month_calendar,
    public_calendar_min_starts_at,
    slot_on_public_calendar,
    slot_to_out,
)
from app.seed import seed
from app.services.availability import (
    booking_deadline,
    effective_cutoff_hours,
    is_slot_departed,
    slot_status,
    spots_left,
)
from app.timeutil import UTC
from app.services.booking import create_booking, pending_holds_for_slot, release_booking_hold
from app.services.pricing import apply_promo
from app.services.promo import is_promo_exhausted
from app.routers import admin as admin_router
from app.services.stripe_service import attach_payment_intent, confirm_booking_paid

logger = logging.getLogger(__name__)


def _booking_summary(booking: Booking, client_secret: str | None) -> BookingSummaryOut:
    from app.timeutil import as_utc, hold_seconds_remaining

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


def expire_stale_holds(db: Session):
    from app.timeutil import utc_naive, utcnow

    stale = (
        db.query(Booking)
        .filter(
            Booking.status == BookingStatus.PENDING,
            Booking.hold_expires_at < utc_naive(utcnow()),
        )
        .all()
    )
    if not stale:
        return
    for b in stale:
        if b.stripe_payment_intent_id and settings.stripe_secret_key:
            try:
                intent = stripe.PaymentIntent.retrieve(b.stripe_payment_intent_id)
                if intent.status == "succeeded" and confirm_booking_paid(
                    db, b.id, intent.id
                ):
                    continue
            except Exception:
                logger.exception("Stripe check failed for booking %s", b.reference)
        b.status = BookingStatus.EXPIRED
    try:
        db.commit()
    except OperationalError:
        db.rollback()
        logger.warning("Could not expire stale booking holds (database not writable)")


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_admin_auth_config()
    seed()
    yield


app = FastAPI(title="Alis-Adventures Booking API", lifespan=lifespan)
app.include_router(admin_router.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https://.*\.ngrok-free\.app|https://.*\.ngrok\.io|https://.*\.ngrok\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/config", response_model=ConfigOut)
def get_config():
    return ConfigOut(
        publishable_key=settings.stripe_publishable_key,
        tax_rate_percent=settings.tax_rate_percent,
        site_timezone=settings.site_timezone,
        default_booking_cutoff_hours=settings.default_booking_cutoff_hours,
        booking_hold_minutes=settings.booking_hold_minutes,
    )


@app.get("/api/calendar/month", response_model=CalendarMonthOut)
def get_calendar_month(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
):
    expire_stale_holds(db)
    today = date.today()
    y = year or today.year
    m = month or today.month
    if m < 1 or m > 12:
        raise HTTPException(400, "Month must be 1–12")
    return build_month_calendar(db, y, m)


@app.get("/api/calendar", response_model=CalendarWeekOut)
def get_calendar(week_start: date | None = None, db: Session = Depends(get_db)):
    expire_stale_holds(db)
    today = date.today()
    start = week_start or today
    if start < today:
        start = today
    end = start + timedelta(days=6)

    range_start = max(
        datetime.combine(start, datetime.min.time(), tzinfo=UTC),
        public_calendar_min_starts_at(today),
    )
    range_end = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC)

    slots = (
        db.query(Slot)
        .options(joinedload(Slot.activity))
        .filter(
            Slot.is_cancelled.is_(False),
            Slot.starts_at >= range_start,
            Slot.starts_at < range_end,
        )
        .order_by(Slot.starts_at)
        .all()
    )

    days_map: dict[date, list[CalendarSlotOut]] = {}
    for offset in range(7):
        d = start + timedelta(days=offset)
        days_map[d] = []

    for slot in slots:
        if not slot_on_public_calendar(slot, today):
            continue
        d = slot.starts_at.date()
        if d not in days_map or d < today:
            continue
        days_map[d].append(slot_to_out(db, slot))

    return CalendarWeekOut(
        start_date=start,
        end_date=end,
        days=[CalendarDayOut(date=d, slots=days_map[d]) for d in sorted(days_map)],
    )


@app.get("/api/slots/{slot_id}", response_model=SlotDetailOut)
def get_slot(slot_id: int, db: Session = Depends(get_db)):
    expire_stale_holds(db)
    slot = (
        db.query(Slot)
        .options(joinedload(Slot.activity).joinedload(Activity.ticket_types))
        .filter(Slot.id == slot_id)
        .first()
    )
    if not slot or slot.is_cancelled:
        raise HTTPException(404, "Slot not found")
    if not slot_on_public_calendar(slot, date.today()) or is_slot_departed(slot):
        raise HTTPException(404, "Slot not found")

    holds = pending_holds_for_slot(db, slot.id)
    left = max(0, slot.capacity - slot.booked_count - holds)
    st = slot_status(slot, holds)
    tickets = sorted(slot.activity.ticket_types, key=lambda t: t.sort_order)

    return SlotDetailOut(
        id=slot.id,
        activity_id=slot.activity.id,
        title=slot.activity.title,
        description=slot.activity.description,
        location_label=slot.activity.location_label,
        image_url=slot.activity.image_url,
        emoji=slot.activity.emoji,
        duration_minutes=slot.activity.duration_minutes,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        spots_left=left,
        status=st.value,
        meeting_instructions=slot.activity.meeting_instructions,
        ticket_types=[TicketTypeOut.model_validate(t) for t in tickets],
        max_tickets_per_booking=min(left, 20) if left > 0 else 20,
        booking_cutoff_hours=effective_cutoff_hours(slot),
        booking_deadline=booking_deadline(slot),
        booking_closed=st.value == "closed",
    )


@app.post("/api/promo/validate", response_model=PromoValidateOut)
def validate_promo(body: PromoValidateIn, db: Session = Depends(get_db)):
    from app.timeutil import utcnow

    promo = (
        db.query(PromoCode)
        .filter(PromoCode.code == body.code.upper().strip(), PromoCode.is_active.is_(True))
        .first()
    )
    if not promo:
        return PromoValidateOut(valid=False, message="Invalid promo code")
    if promo.valid_until and promo.valid_until < utcnow():
        return PromoValidateOut(valid=False, message="Promo expired")
    if is_promo_exhausted(promo):
        return PromoValidateOut(valid=False, message="Promo code no longer available")
    discount = apply_promo(promo, body.subtotal_cents)
    return PromoValidateOut(valid=True, discount_cents=discount, message="Promo applied")


@app.post("/api/bookings", response_model=BookingSummaryOut)
def post_booking(body: CreateBookingIn, db: Session = Depends(get_db)):
    expire_stale_holds(db)
    try:
        booking = create_booking(db, body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    client_secret = None
    try:
        client_secret = attach_payment_intent(db, booking)
    except Exception:
        if not booking.is_waitlist:
            raise HTTPException(502, "Payment setup failed") from None

    summary = _booking_summary(booking, client_secret)
    if not summary.is_waitlist and summary.total_cents > 0 and summary.hold_seconds_remaining <= 0:
        raise HTTPException(409, "Seat hold expired before checkout could start. Please try again.")
    return summary


@app.post("/api/bookings/{reference}/release")
def release_booking(reference: str, db: Session = Depends(get_db)):
    """Release seats when the customer leaves checkout before paying."""
    booking = db.query(Booking).filter(Booking.reference == reference.upper()).first()
    if not booking:
        return {"ok": True}
    if booking.status != BookingStatus.PENDING:
        return {"ok": True, "status": booking.status.value}
    release_booking_hold(db, booking)
    return {"ok": True, "status": BookingStatus.EXPIRED.value}


@app.post("/api/bookings/{reference}/confirm")
def confirm_booking_payment(reference: str, db: Session = Depends(get_db)):
    """Mark booking paid after Stripe succeeds (webhook backup for local dev)."""
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Payments not configured")

    booking = db.query(Booking).filter(Booking.reference == reference.upper()).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.status == BookingStatus.PAID:
        return {"reference": booking.reference, "status": "paid"}
    if booking.status != BookingStatus.PENDING:
        raise HTTPException(409, f"Booking is {booking.status.value}")
    if not booking.stripe_payment_intent_id:
        raise HTTPException(400, "No payment in progress for this booking")

    intent = stripe.PaymentIntent.retrieve(booking.stripe_payment_intent_id)
    if intent.status != "succeeded":
        raise HTTPException(402, "Payment not completed yet")

    if not confirm_booking_paid(db, booking.id, intent.id):
        db.refresh(booking)
        if booking.status == BookingStatus.PAID:
            return {"reference": booking.reference, "status": "paid"}
        raise HTTPException(409, "Could not confirm booking — contact support with your reference")

    return {"reference": booking.reference, "status": "paid"}


@app.get("/api/bookings/{reference}")
def get_booking(reference: str, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.reference == reference.upper()).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    return {
        "reference": booking.reference,
        "status": booking.status.value,
        "total_cents": booking.total_cents,
        "is_waitlist": booking.is_waitlist,
    }


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(400, "Invalid payload") from e
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(400, "Invalid signature") from e

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        booking_id = int(pi["metadata"].get("booking_id", 0))
        confirm_booking_paid(db, booking_id, pi["id"])

    return {"received": True}
