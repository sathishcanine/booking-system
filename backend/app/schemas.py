from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class TicketTypeOut(BaseModel):
    id: int
    name: str
    subtitle: str | None
    price_cents: int
    max_per_booking: int | None

    model_config = {"from_attributes": True}


class CalendarSlotOut(BaseModel):
    id: int
    activity_id: int
    title: str
    location_label: str | None
    starts_at: datetime
    ends_at: datetime
    card_description: str | None
    card_image_url: str | None
    emoji: str | None
    spots_left: int
    status: str
    promo_text: str | None
    duration_minutes: int
    is_call_to_book: bool = False
    call_phone: str | None = None
    brand_label: str | None = None
    urgency_text: str | None = None
    booking_cutoff_hours: int
    booking_deadline: datetime
    booking_closed: bool


class CalendarCellOut(BaseModel):
    date: date
    in_month: bool
    is_today: bool
    is_past: bool
    slots: list[CalendarSlotOut]


class CalendarMonthOut(BaseModel):
    year: int
    month: int
    cells: list[CalendarCellOut]


class CalendarDayOut(BaseModel):
    date: date
    slots: list[CalendarSlotOut]


class CalendarWeekOut(BaseModel):
    start_date: date
    end_date: date
    days: list[CalendarDayOut]


class SlotDetailOut(BaseModel):
    id: int
    activity_id: int
    title: str
    description: str | None
    location_label: str | None
    image_url: str | None
    emoji: str | None
    duration_minutes: int
    starts_at: datetime
    ends_at: datetime
    spots_left: int
    status: str
    meeting_instructions: str | None
    ticket_types: list[TicketTypeOut]
    max_tickets_per_booking: int
    booking_cutoff_hours: int
    booking_deadline: datetime
    booking_closed: bool


class BookingLineIn(BaseModel):
    ticket_type_id: int
    quantity: int = Field(ge=0, le=50)


class CreateBookingIn(BaseModel):
    slot_id: int
    lines: list[BookingLineIn]
    customer_name: str = Field(min_length=2, max_length=200)
    customer_email: EmailStr
    customer_phone: str | None = None
    marketing_opt_in: bool = False
    promo_code: str | None = None
    heard_about: str | None = None
    been_before: str | None = None
    comments: str | None = None
    ack_public_trip: bool = False
    ack_route: bool = False
    join_waitlist: bool = False


class BookingSummaryOut(BaseModel):
    booking_id: int
    reference: str
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    client_secret: str | None
    publishable_key: str
    is_waitlist: bool
    hold_expires_at: datetime | None
    hold_seconds_remaining: int = 0


class PromoValidateIn(BaseModel):
    code: str
    subtotal_cents: int
    slot_id: int | None = None


class PromoValidateOut(BaseModel):
    valid: bool
    discount_cents: int = 0
    message: str = ""


class CancellationPolicyOut(BaseModel):
    full_refund_hours: float
    partial_refund_hours: float
    partial_refund_percent: float
    summary: str


class CancellationPreviewOut(BaseModel):
    reference: str
    can_cancel: bool
    message: str | None = None
    refund_cents: int
    refund_percent: int
    total_cents: int
    hours_until_departure: float | None = None
    policy_summary: str


class ReviewOut(BaseModel):
    id: int
    rating: int
    body: str | None
    reviewer_name: str
    created_at: datetime
    owner_response: str | None = None
    owner_response_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str | None = Field(default=None, max_length=2000)


class RenterBookingOut(BaseModel):
    reference: str
    status: str
    total_cents: int
    is_waitlist: bool
    created_at: datetime
    activity_title: str
    activity_slug: str
    slot_starts_at: datetime
    slot_id: int | None = None
    booking_kind: str = "departure"
    refund_cents: int = 0
    can_cancel: bool = False
    can_review: bool = False
    has_review: bool = False


class SavedBoatOut(BaseModel):
    activity_id: int
    slug: str
    title: str
    image_url: str | None
    city: str | None
    state: str | None
    starting_price_cents: int | None
    saved_at: datetime


class ConfigOut(BaseModel):
    publishable_key: str
    tax_rate_percent: float
    site_timezone: str
    default_booking_cutoff_hours: int
    booking_hold_minutes: int
    trip_protection_summary: str
    google_client_id: str = ""


class RentalQuoteOut(BaseModel):
    boat_price_cents: int
    captain_price_cents: int
    insurance_cents: int
    addon_cents: int
    subtotal_cents: int
    duration_hours: int
    hourly_rate_cents: int
    captain_included: bool


class CreateRentalIn(BaseModel):
    activity_slug: str = Field(min_length=1, max_length=200)
    rental_date: date
    start_time: str = Field(min_length=4, max_length=5, pattern=r"^\d{1,2}:\d{2}$")
    duration_hours: int = Field(ge=1, le=12)
    passenger_count: int = Field(ge=1, le=50)
    captain_included: bool = True
    captain_slug: str | None = Field(default=None, max_length=80)
    insurance_selected: bool = False
    water_scooter_addon: bool = False


class BoatCardOut(BaseModel):
    id: int
    slug: str
    title: str
    boat_type: str | None = None
    max_guests: int | None = None
    city: str | None = None
    state: str | None = None
    marina_name: str | None = None
    location_label: str | None = None
    duration_minutes: int
    image_url: str | None = None
    photo_urls: list[str] = []
    amenities: list[str] = []
    captain_required: bool = False
    hourly_rate_cents: int | None = None
    length_ft: int | None = None
    organization_name: str | None = None
    starting_price_cents: int | None = None
    emoji: str | None = None
    average_rating: float | None = None
    review_count: int = 0
    min_rental_hours: int = 2
    max_rental_hours: int = 8
    instant_book: bool = True
    bareboat_allowed: bool = True
    activity_tags: list[str] = []


class AllowedOnBoatItemOut(BaseModel):
    id: str
    label: str
    allowed: bool


class BoatOwnerProfileOut(BaseModel):
    name: str
    rating: float | None = None
    review_count: int = 0
    response_rate_percent: float = 100.0
    avg_response_time: str = "< 1 hour"


class BoatCaptainProfileOut(BaseModel):
    id: str
    name: str
    photo_url: str | None = None
    rating: float | None = None
    review_count: int = 0
    trips_completed: int = 0
    coast_guard_verified: bool = True


class BoatListingPoliciesOut(BaseModel):
    allowed_on_boat: list[AllowedOnBoatItemOut] = []
    cancellation_tier: str = "flexible"
    cancellation_summary: str | None = None
    is_commercial_owner: bool = False
    commercial_owner_summary: str | None = None
    security_deposit_cents: int | None = None


class ProfileBoatOut(BaseModel):
    slug: str
    title: str
    image_url: str | None = None
    photo_count: int = 0
    hourly_rate_cents: int | None = None
    min_rental_hours: int = 2
    max_rental_hours: int = 8
    max_guests: int | None = None
    average_rating: float | None = None
    review_count: int = 0


class ProfileReviewOut(BaseModel):
    id: int
    reviewer_name: str
    rating: int
    body: str | None = None
    created_at: datetime
    boat_title: str
    boat_slug: str


class OwnerProfilePageOut(BaseModel):
    name: str
    rating: float | None = None
    review_count: int = 0
    phone_verified: bool = True
    bio: str | None = None
    aboard_since_year: int | None = None
    boats: list[ProfileBoatOut] = []
    reviews: list[ProfileReviewOut] = []


class CaptainProfilePageOut(BaseModel):
    id: str
    name: str
    photo_url: str | None = None
    rating: float | None = None
    review_count: int = 0
    phone_verified: bool = True
    coast_guard_verified: bool = True
    bio: str | None = None
    aboard_since_year: int | None = None
    location: str | None = None
    trips_completed: int = 0
    boats: list[ProfileBoatOut] = []


class BoatDetailOut(BoatCardOut):
    description: str | None = None
    meeting_instructions: str | None = None
    owner: BoatOwnerProfileOut | None = None
    default_captain: BoatCaptainProfileOut | None = None
    captain_alternatives: list[BoatCaptainProfileOut] = []
    policies: BoatListingPoliciesOut | None = None


class BoatsPageOut(BaseModel):
    items: list[BoatCardOut]
    total: int
    limit: int
    offset: int


class DestinationOut(BaseModel):
    city: str
    state: str | None
    label: str
    boat_count: int
    image_url: str | None


class BreadcrumbOut(BaseModel):
    label: str
    href: str | None = None


class DestinationSectionOut(BaseModel):
    id: str
    title: str
    boat_type: str | None = None
    boats: list[BoatCardOut]
    more_href: str | None = None


class MarketplacePromiseItemOut(BaseModel):
    title: str
    body: str


class MarketplacePromiseOut(BaseModel):
    title: str
    items: list[MarketplacePromiseItemOut]


class MarketplaceCategoryOut(BaseModel):
    id: str
    label: str


class SearchConfigOut(BaseModel):
    categories: list[MarketplaceCategoryOut]
    duration_hours: list[int]
    popular_amenities: list[str]
    price_min_cents: int
    price_max_cents: int
    length_max_ft: int
    market_city: str
    market_state: str
    market_label: str


class DestinationPageOut(BaseModel):
    city: str
    state: str | None
    label: str
    boat_count: int
    breadcrumbs: list[BreadcrumbOut]
    sections: list[DestinationSectionOut]
    promise: MarketplacePromiseOut
