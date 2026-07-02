from datetime import date, datetime

from pydantic import BaseModel, Field


class AdminLoginIn(BaseModel):
    password: str


class AdminLoginOut(BaseModel):
    token: str
    expires_in: int
    token_type: str = "bearer"
    role: str | None = None
    organization_id: int | None = None
    organization_name: str | None = None
    display_name: str | None = None
    email: str | None = None


class AdminUploadOut(BaseModel):
    url: str


class OwnerRegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    organization_name: str = Field(min_length=2, max_length=200)


class OwnerLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=128)


class RenterRegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=120)


class RenterLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=128)


class RenterGoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20)


class OwnerGoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20)
    organization_name: str | None = Field(default=None, min_length=2, max_length=200)


class AuthMeOut(BaseModel):
    email: str
    role: str
    organization_id: int | None = None
    organization_name: str | None = None
    organization_status: str | None = None
    display_name: str | None = None


class AdminTicketTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    subtitle: str | None = None
    price_cents: int = Field(ge=0)
    sort_order: int = 0
    max_per_booking: int | None = Field(default=None, ge=1, le=50)


class AdminTicketTypeOut(AdminTicketTypeIn):
    id: int
    activity_id: int

    model_config = {"from_attributes": True}


class AdminActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    description: str | None = None
    duration_minutes: int = Field(default=150, ge=15, le=720)
    location_label: str | None = None
    image_url: str | None = None
    emoji: str | None = None
    meeting_instructions: str | None = None
    is_active: bool = True
    max_guests: int | None = Field(default=None, ge=1, le=500)
    boat_type: str | None = Field(default=None, max_length=80)
    boat_make: str = Field(min_length=1, max_length=80)
    boat_model: str = Field(min_length=1, max_length=120)
    marina_name: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=80)
    amenities: list[str] = Field(default_factory=list)
    photo_urls: list[str] = Field(default_factory=list)
    captain_required: bool = False
    hourly_rate_cents: int | None = Field(default=None, ge=0)
    length_ft: int | None = Field(default=None, ge=1, le=500)
    min_rental_hours: int = Field(default=2, ge=1, le=24)
    max_rental_hours: int = Field(default=8, ge=1, le=24)
    instant_book: bool = True
    bareboat_allowed: bool = True
    activity_tags: list[str] = Field(default_factory=list)


class AdminActivityOut(AdminActivityIn):
    id: int
    listing_status: str
    ticket_types: list[AdminTicketTypeOut] = []

    model_config = {"from_attributes": True}


class AdminActivityListItem(BaseModel):
    id: int
    title: str
    slug: str
    location_label: str | None
    city: str | None = None
    duration_minutes: int
    is_active: bool
    listing_status: str
    boat_type: str | None = None
    max_guests: int | None = None
    hourly_rate_cents: int | None = None
    organization_name: str | None = None
    ticket_type_count: int = 0
    slot_count: int = 0

    model_config = {"from_attributes": True}


class AdminSlotIn(BaseModel):
    activity_id: int
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(ge=1, le=500)
    waitlist_enabled: bool = True
    promo_text: str | None = None
    card_image_url: str | None = None
    card_description: str | None = None
    is_call_to_book: bool = False
    call_phone: str | None = None
    brand_label: str | None = None
    urgency_text: str | None = None
    booking_cutoff_hours: int | None = Field(
        default=None,
        ge=0,
        le=168,
        description="Hours before departure to stop online booking; null uses site default",
    )


class AdminSlotOut(AdminSlotIn):
    id: int
    booked_count: int
    is_cancelled: bool
    activity_title: str | None = None

    model_config = {"from_attributes": True}


class AdminPromoIn(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    discount_percent: int | None = Field(default=None, ge=1, le=100)
    discount_cents: int | None = Field(default=None, ge=0)
    max_uses: int | None = Field(default=None, ge=1)
    valid_until: datetime | None = None
    is_active: bool = True


class AdminPromoOut(AdminPromoIn):
    id: int
    used_count: int

    model_config = {"from_attributes": True}


class AdminOrganizationListItem(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class AdminCaptainIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=80)
    bio: str | None = None
    location: str | None = Field(default=None, max_length=120)
    photo_url: str | None = Field(default=None, max_length=500)
    experience: str | None = Field(default=None, max_length=40)
    license_types: list[str] = Field(default_factory=list)
    specializations: list[str] = Field(default_factory=list)
    coast_guard_verified: bool = False
    phone_verified: bool = False
    is_active: bool = True
    organization_id: int | None = None


class AdminCaptainOut(BaseModel):
    id: int
    organization_id: int
    organization_name: str | None = None
    slug: str
    name: str
    bio: str | None = None
    location: str | None = None
    photo_url: str | None = None
    experience: str | None = None
    license_types: list[str] = Field(default_factory=list)
    specializations: list[str] = Field(default_factory=list)
    rating: float | None = None
    review_count: int = 0
    trips_completed: int = 0
    coast_guard_verified: bool = False
    phone_verified: bool = False
    aboard_since_year: int | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class AdminBookingItemOut(BaseModel):
    ticket_name: str
    quantity: int
    unit_price_cents: int

    model_config = {"from_attributes": True}


class AdminBookingOut(BaseModel):
    id: int
    reference: str
    status: str
    customer_name: str
    customer_email: str
    customer_phone: str | None
    total_cents: int
    is_waitlist: bool
    created_at: datetime
    slot_id: int
    activity_title: str
    slot_starts_at: datetime
    refund_cents: int = 0
    cancelled_at: datetime | None = None
    cancelled_by: str | None = None
    items: list[AdminBookingItemOut] = []

    model_config = {"from_attributes": True}


class AdminBookingDetailOut(AdminBookingOut):
    booking_kind: str = "departure"
    activity_slug: str | None = None
    organization_name: str | None = None
    rental_starts_at: datetime | None = None
    duration_hours: int | None = None
    passenger_count: int | None = None
    captain_included: bool = False
    captain_name: str | None = None
    boat_price_cents: int = 0
    captain_price_cents: int = 0
    insurance_cents: int = 0
    addon_cents: int = 0
    subtotal_cents: int = 0
    discount_cents: int = 0
    tax_cents: int = 0
    platform_fee_cents: int = 0
    owner_payout_cents: int = 0
    promo_code: str | None = None
    cancellation_reason: str | None = None
    stripe_refund_id: str | None = None
    comments: str | None = None
    heard_about: str | None = None
    been_before: str | None = None
    marketing_opt_in: bool = False


class AdminStatusCount(BaseModel):
    status: str
    count: int


class AdminDayMetric(BaseModel):
    date: date
    revenue_cents: int
    booking_count: int
    paid_count: int


class AdminTopTour(BaseModel):
    activity_id: int
    title: str
    paid_bookings: int
    revenue_cents: int
    tickets_sold: int


class AdminTopTicket(BaseModel):
    ticket_type_id: int
    name: str
    quantity_sold: int
    gross_cents: int


class AdminTopPromo(BaseModel):
    code: str
    uses: int


class AdminRecentBooking(BaseModel):
    id: int
    reference: str
    status: str
    customer_name: str
    total_cents: int
    is_waitlist: bool
    created_at: datetime
    activity_title: str
    slot_starts_at: datetime


class AdminUpcomingDeparture(BaseModel):
    slot_id: int
    activity_title: str
    starts_at: datetime
    capacity: int
    booked: int
    held: int
    spots_left: int
    fill_percent: int
    is_call_to_book: bool


class AdminDashboardOut(BaseModel):
    generated_at: datetime
    activity_count: int
    active_slot_count: int
    upcoming_departure_count: int
    booking_count: int
    paid_booking_count: int
    pending_booking_count: int
    waitlist_count: int
    cancelled_count: int
    expired_count: int
    total_revenue_cents: int
    revenue_today_cents: int
    revenue_7d_cents: int
    revenue_30d_cents: int
    bookings_today: int
    bookings_7d: int
    bookings_30d: int
    paid_bookings_7d: int
    tickets_sold: int
    average_order_cents: int
    conversion_rate_percent: float
    marketing_opt_ins: int
    marketing_opt_in_rate_percent: float
    promo_booking_count: int
    upcoming_capacity: int
    upcoming_booked: int
    upcoming_held_seats: int
    upcoming_spots_remaining: int
    upcoming_fill_rate_percent: float
    low_stock_departures: int
    waitlist_departures: int
    call_to_book_departures: int
    bookings_by_status: list[AdminStatusCount]
    revenue_by_day: list[AdminDayMetric]
    top_tours: list[AdminTopTour]
    top_ticket_types: list[AdminTopTicket]
    top_promos: list[AdminTopPromo]
    heard_about: dict[str, int]
    recent_bookings: list[AdminRecentBooking]
    upcoming_departures: list[AdminUpcomingDeparture]


class AdminBulkSlotsIn(BaseModel):
    """Create the same departure time on multiple dates."""

    activity_id: int
    dates: list[date] = Field(min_length=1, max_length=31)
    start_time: str = Field(description="HH:MM 24h")
    end_time: str = Field(description="HH:MM 24h")
    capacity: int = Field(ge=1, le=500)
    waitlist_enabled: bool = True
    promo_text: str | None = None
    card_description: str | None = None
    is_call_to_book: bool = False
    call_phone: str | None = None
    brand_label: str | None = None
    urgency_text: str | None = None
    booking_cutoff_hours: int | None = Field(default=None, ge=0, le=168)


class MarketplacePromiseItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=1000)


class PlatformSettingsOut(BaseModel):
    platform_fee_percent: float
    tax_rate_percent: float
    cancel_full_refund_hours: float
    cancel_partial_refund_hours: float
    cancel_partial_refund_percent: float
    trip_protection_summary: str | None = None
    marketplace_promise_title: str | None = None
    marketplace_promise_items: list[MarketplacePromiseItemIn] | None = None
    destination_best_title_template: str | None = None
    destination_type_title_template: str | None = None


class PlatformSettingsIn(BaseModel):
    platform_fee_percent: float = Field(ge=0, le=50)
    tax_rate_percent: float = Field(ge=0, le=30)
    cancel_full_refund_hours: float = Field(ge=1, le=336)
    cancel_partial_refund_hours: float = Field(ge=0, le=336)
    cancel_partial_refund_percent: float = Field(ge=0, le=100)
    trip_protection_summary: str | None = Field(default=None, max_length=2000)
    marketplace_promise_title: str | None = Field(default=None, max_length=300)
    marketplace_promise_items: list[MarketplacePromiseItemIn] | None = None
    destination_best_title_template: str | None = Field(default=None, max_length=200)
    destination_type_title_template: str | None = Field(default=None, max_length=200)


class AdminReviewOut(BaseModel):
    id: int
    rating: int
    body: str | None
    reviewer_name: str
    created_at: datetime
    owner_response: str | None = None
    owner_response_at: datetime | None = None
    activity_id: int
    activity_title: str
    booking_reference: str


class AdminReviewRespondIn(BaseModel):
    response: str = Field(min_length=1, max_length=2000)


class AdminCancelBookingIn(BaseModel):
    reason: str | None = Field(default=None, max_length=200)
    full_refund: bool = False


class CancelBookingOut(BaseModel):
    ok: bool = True
    reference: str
    status: str
    refund_cents: int
    message: str | None = None


class ConnectStatusOut(BaseModel):
    stripe_configured: bool
    account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    details_submitted: bool = False
    ready_for_payments: bool = False
    dashboard_url: str | None = None


class ConnectOnboardOut(BaseModel):
    url: str


class EarningsBookingOut(BaseModel):
    id: int
    reference: str
    customer_name: str
    total_cents: int
    platform_fee_cents: int
    owner_payout_cents: int
    tax_cents: int
    created_at: datetime
    activity_title: str


class EarningsOut(BaseModel):
    gross_revenue_cents: int
    platform_fees_cents: int
    net_earnings_cents: int
    tax_collected_cents: int
    paid_booking_count: int
    connect: ConnectStatusOut | None = None
    recent_bookings: list[EarningsBookingOut] = []


class AdminContactInquiryOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    message: str | None = None
    is_read: bool
    created_at: datetime
