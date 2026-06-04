import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SlotStatus(str, enum.Enum):
    OPEN = "open"
    LOW = "low"  # few spots left
    SOLD_OUT = "sold_out"
    WAITLIST = "waitlist"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"  # hold placed, awaiting payment
    PAID = "paid"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(default=150)
    location_label: Mapped[str | None] = mapped_column(String(200))
    image_url: Mapped[str | None] = mapped_column(String(500))
    emoji: Mapped[str | None] = mapped_column(String(50))
    meeting_instructions: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    ticket_types: Mapped[list["TicketType"]] = relationship(back_populates="activity")
    slots: Mapped[list["Slot"]] = relationship(back_populates="activity")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    name: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str | None] = mapped_column(String(300))
    price_cents: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(default=0)
    max_per_booking: Mapped[int | None] = mapped_column(Integer)  # null = no per-type cap

    activity: Mapped["Activity"] = relationship(back_populates="ticket_types")


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)
    booked_count: Mapped[int] = mapped_column(Integer, default=0)
    waitlist_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    promo_text: Mapped[str | None] = mapped_column(String(200))
    card_image_url: Mapped[str | None] = mapped_column(String(500))
    card_description: Mapped[str | None] = mapped_column(Text)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_call_to_book: Mapped[bool] = mapped_column(Boolean, default=False)
    call_phone: Mapped[str | None] = mapped_column(String(30))
    brand_label: Mapped[str | None] = mapped_column(String(80))
    urgency_text: Mapped[str | None] = mapped_column(String(120))

    activity: Mapped["Activity"] = relationship(back_populates="slots")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="slot")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    discount_percent: Mapped[int | None] = mapped_column(Integer)
    discount_cents: Mapped[int | None] = mapped_column(Integer)
    max_uses: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id"))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.PENDING
    )
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_email: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(50))
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    promo_code: Mapped[str | None] = mapped_column(String(50))
    subtotal_cents: Mapped[int] = mapped_column(Integer)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0)
    tax_cents: Mapped[int] = mapped_column(Integer)
    total_cents: Mapped[int] = mapped_column(Integer)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(100))
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_waitlist: Mapped[bool] = mapped_column(Boolean, default=False)
    heard_about: Mapped[str | None] = mapped_column(String(100))
    been_before: Mapped[str | None] = mapped_column(String(50))
    comments: Mapped[str | None] = mapped_column(Text)
    ack_public_trip: Mapped[bool] = mapped_column(Boolean, default=False)
    ack_route: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    slot: Mapped["Slot"] = relationship(back_populates="bookings")
    items: Mapped[list["BookingItem"]] = relationship(back_populates="booking")


class BookingItem(Base):
    __tablename__ = "booking_items"
    __table_args__ = (UniqueConstraint("booking_id", "ticket_type_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"))
    ticket_type_id: Mapped[int] = mapped_column(ForeignKey("ticket_types.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_cents: Mapped[int] = mapped_column(Integer)

    booking: Mapped["Booking"] = relationship(back_populates="items")
    ticket_type: Mapped["TicketType"] = relationship()
