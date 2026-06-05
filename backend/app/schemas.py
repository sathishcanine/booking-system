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


class PromoValidateOut(BaseModel):
    valid: bool
    discount_cents: int = 0
    message: str = ""


class ConfigOut(BaseModel):
    publishable_key: str
    tax_rate_percent: float
    site_timezone: str
    default_booking_cutoff_hours: int
    booking_hold_minutes: int
