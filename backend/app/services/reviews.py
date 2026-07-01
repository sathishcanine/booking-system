"""Review eligibility, aggregates, and creation."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Review, User
from app.services.availability import is_slot_departed
from app.timeutil import utc_naive, utcnow


DEFAULT_TRIP_PROTECTION = (
    "Trip protection is included on every booking — coverage for eligible on-water "
    "incidents and mechanical issues. Terms apply at checkout."
)


def trip_protection_text(raw: str | None) -> str:
    return (raw or "").strip() or DEFAULT_TRIP_PROTECTION


def booking_reviewable(booking: Booking) -> bool:
    if booking.status != BookingStatus.PAID or booking.is_waitlist:
        return False
    slot = booking.slot
    return bool(slot and is_slot_departed(slot))


def has_review(db: Session, booking_id: int) -> bool:
    return (
        db.query(Review.id).filter(Review.booking_id == booking_id).first() is not None
    )


def rating_aggregates(
    db: Session, activity_ids: list[int]
) -> dict[int, tuple[float | None, int]]:
    if not activity_ids:
        return {}
    rows = (
        db.query(
            Review.activity_id,
            func.avg(Review.rating),
            func.count(Review.id),
        )
        .filter(Review.activity_id.in_(activity_ids))
        .group_by(Review.activity_id)
        .all()
    )
    out: dict[int, tuple[float | None, int]] = {}
    for activity_id, avg_rating, count in rows:
        out[activity_id] = (round(float(avg_rating), 1) if avg_rating else None, int(count))
    return out


def create_review(
    db: Session,
    booking: Booking,
    user: User,
    rating: int,
    body: str | None,
) -> Review:
    if not booking_reviewable(booking):
        raise ValueError("This trip is not eligible for a review yet")
    if has_review(db, booking.id):
        raise ValueError("You already reviewed this trip")
    if booking.renter_user_id != user.id:
        raise ValueError("Only the renter who booked can leave a review")
    if rating < 1 or rating > 5:
        raise ValueError("Rating must be between 1 and 5")

    text = (body or "").strip()
    if len(text) > 2000:
        raise ValueError("Review is too long (max 2000 characters)")

    slot = booking.slot
    if not slot:
        raise ValueError("Booking has no departure")

    reviewer_name = (user.display_name or user.email.split("@")[0] or "Renter").strip()
    review = Review(
        booking_id=booking.id,
        activity_id=slot.activity_id,
        user_id=user.id,
        rating=rating,
        body=text or None,
        reviewer_name=reviewer_name[:120],
        created_at=utc_naive(utcnow()),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
