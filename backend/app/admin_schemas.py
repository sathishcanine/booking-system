from datetime import date, datetime

from pydantic import BaseModel, Field


class AdminLoginIn(BaseModel):
    password: str


class AdminLoginOut(BaseModel):
    token: str


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


class AdminActivityOut(AdminActivityIn):
    id: int
    ticket_types: list[AdminTicketTypeOut] = []

    model_config = {"from_attributes": True}


class AdminActivityListItem(BaseModel):
    id: int
    title: str
    slug: str
    location_label: str | None
    duration_minutes: int
    is_active: bool
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
    items: list[AdminBookingItemOut] = []

    model_config = {"from_attributes": True}


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
