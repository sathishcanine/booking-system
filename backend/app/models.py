import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
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
    CLOSED = "closed"  # past online booking cutoff


class BookingStatus(str, enum.Enum):
    PENDING = "pending"  # hold placed, awaiting payment
    PAID = "paid"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class OrganizationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"


class UserRole(str, enum.Enum):
    OWNER = "owner"
    SUPER_ADMIN = "super_admin"
    RENTER = "renter"


class ListingStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    DELISTED = "delisted"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[OrganizationStatus] = mapped_column(
        Enum(OrganizationStatus), default=OrganizationStatus.APPROVED
    )
    contact_email: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    stripe_connect_account_id: Mapped[str | None] = mapped_column(String(100))
    stripe_connect_charges_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    stripe_connect_payouts_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    stripe_connect_details_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_response_rate_percent: Mapped[float] = mapped_column(default=100.0)
    owner_avg_response_time: Mapped[str | None] = mapped_column(String(80))
    owner_bio: Mapped[str | None] = mapped_column(Text)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=True)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    activities: Mapped[list["Activity"]] = relationship(back_populates="organization")
    captains: Mapped[list["Captain"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("google_sub", name="uq_users_google_sub"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    display_name: Mapped[str | None] = mapped_column(String(120))
    google_sub: Mapped[str | None] = mapped_column(String(128))
    auth_provider: Mapped[str] = mapped_column(String(20), default="password")
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    organization: Mapped["Organization | None"] = relationship(back_populates="users")
    saved_boats: Mapped[list["SavedBoat"]] = relationship(back_populates="user")


class SavedBoat(Base):
    __tablename__ = "saved_boats"
    __table_args__ = (UniqueConstraint("user_id", "activity_id", name="uq_saved_boat_user_activity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="saved_boats")
    activity: Mapped["Activity"] = relationship()


class PlatformSettings(Base):
    """Singleton row (id=1) for marketplace fee and tax configuration."""

    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform_fee_percent: Mapped[float] = mapped_column(default=15.0)
    tax_rate_percent: Mapped[float] = mapped_column(default=13.0)
    cancel_full_refund_hours: Mapped[float] = mapped_column(default=48.0)
    cancel_partial_refund_hours: Mapped[float] = mapped_column(default=24.0)
    cancel_partial_refund_percent: Mapped[float] = mapped_column(default=50.0)
    trip_protection_summary: Mapped[str | None] = mapped_column(Text)
    marketplace_promise_title: Mapped[str | None] = mapped_column(Text)
    marketplace_promise_items: Mapped[str | None] = mapped_column(Text)
    destination_best_title_template: Mapped[str | None] = mapped_column(Text)
    destination_type_title_template: Mapped[str | None] = mapped_column(Text)


class Captain(Base):
    __tablename__ = "captains"
    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_captain_org_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80))
    bio: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(120))
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    trips_completed: Mapped[int] = mapped_column(Integer, default=0)
    coast_guard_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    aboard_since_year: Mapped[int | None] = mapped_column(Integer)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    organization: Mapped["Organization"] = relationship(back_populates="captains")


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_activity_org_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"))
    title: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(default=150)
    location_label: Mapped[str | None] = mapped_column(String(200))
    image_url: Mapped[str | None] = mapped_column(String(500))
    emoji: Mapped[str | None] = mapped_column(String(50))
    meeting_instructions: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    listing_status: Mapped[ListingStatus] = mapped_column(
        Enum(
            ListingStatus,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=ListingStatus.DRAFT,
    )
    max_guests: Mapped[int | None] = mapped_column(Integer)
    boat_type: Mapped[str | None] = mapped_column(String(80))
    boat_make: Mapped[str | None] = mapped_column(String(80))
    boat_model: Mapped[str | None] = mapped_column(String(120))
    marina_name: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(80))
    amenities: Mapped[str | None] = mapped_column(Text)  # JSON string[]
    photo_urls: Mapped[str | None] = mapped_column(Text)  # JSON string[]
    captain_required: Mapped[bool] = mapped_column(Boolean, default=False)
    hourly_rate_cents: Mapped[int | None] = mapped_column(Integer)
    length_ft: Mapped[int | None] = mapped_column(Integer)
    min_rental_hours: Mapped[int] = mapped_column(Integer, default=2)
    max_rental_hours: Mapped[int] = mapped_column(Integer, default=8)
    instant_book: Mapped[bool] = mapped_column(Boolean, default=True)
    bareboat_allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    activity_tags: Mapped[str | None] = mapped_column(Text)  # JSON string[] category ids
    allowed_on_boat: Mapped[str | None] = mapped_column(Text)  # JSON string[] feature ids
    cancellation_tier: Mapped[str | None] = mapped_column(String(40))
    security_deposit_cents: Mapped[int | None] = mapped_column(Integer)
    is_commercial_owner: Mapped[bool] = mapped_column(Boolean, default=False)
    default_captain_id: Mapped[int | None] = mapped_column(ForeignKey("captains.id"))
    default_captain_name: Mapped[str | None] = mapped_column(String(120))
    default_captain_rating: Mapped[float | None] = mapped_column(Float)
    default_captain_review_count: Mapped[int] = mapped_column(Integer, default=0)
    default_captain_trips: Mapped[int] = mapped_column(Integer, default=0)
    captain_coast_guard_verified: Mapped[bool] = mapped_column(Boolean, default=True)

    organization: Mapped["Organization"] = relationship(back_populates="activities")
    default_captain: Mapped["Captain | None"] = relationship(foreign_keys=[default_captain_id])
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
    booking_cutoff_hours: Mapped[int | None] = mapped_column(Integer)

    activity: Mapped["Activity"] = relationship(back_populates="slots")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="slot")


class PromoCode(Base):
    __tablename__ = "promo_codes"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_promo_org_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"))
    code: Mapped[str] = mapped_column(String(50))
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
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"))
    renter_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id"))
    slot_id: Mapped[int] = mapped_column(ForeignKey("slots.id"))
    booking_kind: Mapped[str] = mapped_column(String(20), default="departure")
    rental_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_hours: Mapped[int | None] = mapped_column(Integer)
    passenger_count: Mapped[int | None] = mapped_column(Integer)
    captain_id: Mapped[int | None] = mapped_column(ForeignKey("captains.id"))
    captain_included: Mapped[bool] = mapped_column(Boolean, default=False)
    insurance_cents: Mapped[int] = mapped_column(Integer, default=0)
    addon_cents: Mapped[int] = mapped_column(Integer, default=0)
    boat_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    captain_price_cents: Mapped[int] = mapped_column(Integer, default=0)
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
    platform_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    owner_payout_cents: Mapped[int] = mapped_column(Integer, default=0)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(100))
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_waitlist: Mapped[bool] = mapped_column(Boolean, default=False)
    heard_about: Mapped[str | None] = mapped_column(String(100))
    been_before: Mapped[str | None] = mapped_column(String(50))
    comments: Mapped[str | None] = mapped_column(Text)
    ack_public_trip: Mapped[bool] = mapped_column(Boolean, default=False)
    ack_route: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refund_cents: Mapped[int] = mapped_column(Integer, default=0)
    cancellation_reason: Mapped[str | None] = mapped_column(String(200))
    cancelled_by: Mapped[str | None] = mapped_column(String(20))
    stripe_refund_id: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    slot: Mapped["Slot"] = relationship(back_populates="bookings")
    activity: Mapped["Activity | None"] = relationship()
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


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("booking_id", name="uq_review_booking"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int] = mapped_column(Integer)
    body: Mapped[str | None] = mapped_column(Text)
    reviewer_name: Mapped[str] = mapped_column(String(120))
    owner_response: Mapped[str | None] = mapped_column(Text)
    owner_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    booking: Mapped["Booking | None"] = relationship()
    activity: Mapped["Activity"] = relationship()
    user: Mapped["User"] = relationship()
