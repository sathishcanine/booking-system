from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.admin_schemas import CancelBookingOut
from app.database import get_db
from app.listings import primary_photo
from app.models import Activity, Booking, BookingStatus, ListingStatus, SavedBoat, Slot, User
from app.platform_auth import PlatformUser, require_renter
from app.schemas import CancellationPreviewOut, ReviewIn, ReviewOut, RenterBookingOut, SavedBoatOut
from app.services.cancellation import apply_cancellation, preview_cancellation
from app.services.platform_settings import get_platform_settings
from app.services.reviews import booking_reviewable, create_review, has_review
from app.timeutil import utc_naive, utcnow

router = APIRouter(prefix="/api/renter", tags=["renter"])


def _starting_price(activity: Activity) -> int | None:
    if not activity.ticket_types:
        return None
    return min(t.price_cents for t in activity.ticket_types)


def _load_renter_booking(db: Session, user: PlatformUser, reference: str) -> Booking:
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.items), joinedload(Booking.slot))
        .filter(
            Booking.reference == reference.upper(),
            Booking.renter_user_id == user.user_id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


def _booking_activity(booking: Booking, db: Session) -> Activity | None:
    if booking.activity_id:
        return db.query(Activity).filter(Activity.id == booking.activity_id).first()
    if booking.slot and booking.slot.activity:
        return booking.slot.activity
    return None


def _renter_booking_out(booking: Booking, db: Session) -> RenterBookingOut:
    act = _booking_activity(booking, db)
    ps = get_platform_settings(db)
    preview = preview_cancellation(booking, booking.slot, ps)
    starts = (
        booking.rental_starts_at
        if booking.booking_kind == "rental" and booking.rental_starts_at
        else booking.slot.starts_at
        if booking.slot
        else booking.created_at
    )
    return RenterBookingOut(
        reference=booking.reference,
        status=booking.status.value,
        total_cents=booking.total_cents,
        is_waitlist=booking.is_waitlist,
        created_at=booking.created_at,
        activity_title=act.title if act else "",
        activity_slug=act.slug if act else "",
        slot_starts_at=starts,
        slot_id=booking.slot_id,
        booking_kind=booking.booking_kind,
        refund_cents=booking.refund_cents,
        can_cancel=preview.can_cancel,
        can_review=booking_reviewable(booking) and not has_review(db, booking.id),
        has_review=has_review(db, booking.id),
    )


@router.get("/bookings", response_model=list[RenterBookingOut])
def list_renter_bookings(
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Booking)
        .options(joinedload(Booking.slot).joinedload(Slot.activity))
        .filter(Booking.renter_user_id == user.user_id)
        .order_by(Booking.created_at.desc())
        .limit(100)
        .all()
    )
    return [_renter_booking_out(b, db) for b in rows]


@router.get("/bookings/{reference}/cancel-preview", response_model=CancellationPreviewOut)
def renter_cancel_preview(
    reference: str,
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    booking = _load_renter_booking(db, user, reference)
    ps = get_platform_settings(db)
    preview = preview_cancellation(booking, booking.slot, ps)
    return CancellationPreviewOut(
        reference=booking.reference,
        can_cancel=preview.can_cancel,
        message=preview.message,
        refund_cents=preview.refund_cents,
        refund_percent=preview.refund_percent,
        total_cents=booking.total_cents,
        hours_until_departure=preview.hours_until_departure,
        policy_summary=preview.policy_summary,
    )


@router.post("/bookings/{reference}/cancel", response_model=CancelBookingOut)
def renter_cancel_booking(
    reference: str,
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    booking = _load_renter_booking(db, user, reference)
    try:
        booking = apply_cancellation(db, booking, cancelled_by="renter")
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    msg = None
    if booking.refund_cents > 0:
        msg = f"Refund of ${booking.refund_cents / 100:.2f} will appear on your card in 5–10 business days"
    elif booking.status == BookingStatus.CANCELLED and booking.total_cents > 0:
        msg = "Booking cancelled — no refund per cancellation policy"

    return CancelBookingOut(
        reference=booking.reference,
        status=booking.status.value,
        refund_cents=booking.refund_cents,
        message=msg,
    )


@router.post("/bookings/{reference}/review", response_model=ReviewOut)
def renter_submit_review(
    reference: str,
    body: ReviewIn,
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    booking = _load_renter_booking(db, user, reference)
    renter = db.query(User).filter(User.id == user.user_id).first()
    if not renter:
        raise HTTPException(401, "User not found")
    try:
        review = create_review(db, booking, renter, body.rating, body.body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return ReviewOut(
        id=review.id,
        rating=review.rating,
        body=review.body,
        reviewer_name=review.reviewer_name,
        created_at=review.created_at,
        owner_response=review.owner_response,
        owner_response_at=review.owner_response_at,
    )


@router.get("/saved-boats", response_model=list[SavedBoatOut])
def list_saved_boats(
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SavedBoat)
        .options(joinedload(SavedBoat.activity).joinedload(Activity.ticket_types))
        .filter(SavedBoat.user_id == user.user_id)
        .order_by(SavedBoat.created_at.desc())
        .all()
    )
    out: list[SavedBoatOut] = []
    for row in rows:
        act = row.activity
        if not act or act.listing_status != ListingStatus.PUBLISHED:
            continue
        out.append(
            SavedBoatOut(
                activity_id=act.id,
                slug=act.slug,
                title=act.title,
                image_url=primary_photo(act),
                city=act.city,
                state=act.state,
                starting_price_cents=_starting_price(act),
                saved_at=row.created_at,
            )
        )
    return out


@router.post("/saved-boats/{activity_id}", response_model=SavedBoatOut)
def save_boat(
    activity_id: int,
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    act = (
        db.query(Activity)
        .options(joinedload(Activity.ticket_types))
        .filter(
            Activity.id == activity_id,
            Activity.listing_status == ListingStatus.PUBLISHED,
            Activity.is_active.is_(True),
        )
        .first()
    )
    if not act:
        raise HTTPException(404, "Boat not found")

    existing = (
        db.query(SavedBoat)
        .filter(SavedBoat.user_id == user.user_id, SavedBoat.activity_id == activity_id)
        .first()
    )
    if existing:
        row = existing
    else:
        row = SavedBoat(
            user_id=user.user_id,
            activity_id=activity_id,
            created_at=utc_naive(utcnow()),
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    return SavedBoatOut(
        activity_id=act.id,
        slug=act.slug,
        title=act.title,
        image_url=primary_photo(act),
        city=act.city,
        state=act.state,
        starting_price_cents=_starting_price(act),
        saved_at=row.created_at,
    )


@router.delete("/saved-boats/{activity_id}")
def unsave_boat(
    activity_id: int,
    user: PlatformUser = Depends(require_renter),
    db: Session = Depends(get_db),
):
    row = (
        db.query(SavedBoat)
        .filter(SavedBoat.user_id == user.user_id, SavedBoat.activity_id == activity_id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}
