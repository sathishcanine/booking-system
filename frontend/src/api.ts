const API = import.meta.env.VITE_API_URL || "";

export type CalendarSlot = {
  id: number;
  activity_id: number;
  title: string;
  location_label: string | null;
  starts_at: string;
  ends_at: string;
  card_description: string | null;
  card_image_url: string | null;
  emoji: string | null;
  spots_left: number;
  status: string;
  promo_text: string | null;
  duration_minutes: number;
  is_call_to_book: boolean;
  call_phone: string | null;
  brand_label: string | null;
  urgency_text: string | null;
  booking_cutoff_hours: number;
  booking_deadline: string;
  booking_closed: boolean;
};

export type CalendarCell = {
  date: string;
  in_month: boolean;
  is_today: boolean;
  is_past: boolean;
  slots: CalendarSlot[];
};

export type CalendarMonth = {
  year: number;
  month: number;
  cells: CalendarCell[];
};

export type CalendarWeek = {
  start_date: string;
  end_date: string;
  days: { date: string; slots: CalendarSlot[] }[];
};

export type TicketType = {
  id: number;
  name: string;
  subtitle: string | null;
  price_cents: number;
  max_per_booking: number | null;
};

export type SlotDetail = {
  id: number;
  activity_id: number;
  title: string;
  description: string | null;
  location_label: string | null;
  image_url: string | null;
  emoji: string | null;
  duration_minutes: number;
  starts_at: string;
  ends_at: string;
  spots_left: number;
  status: string;
  meeting_instructions: string | null;
  ticket_types: TicketType[];
  max_tickets_per_booking: number;
  booking_cutoff_hours: number;
  booking_deadline: string;
  booking_closed: boolean;
};

export type AppConfig = {
  publishable_key: string;
  tax_rate_percent: number;
  site_timezone: string;
  default_booking_cutoff_hours: number;
  booking_hold_minutes: number;
};

export type BookingSummary = {
  booking_id: number;
  reference: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  client_secret: string | null;
  publishable_key: string;
  is_waitlist: boolean;
  hold_expires_at: string | null;
  hold_seconds_remaining: number;
};

export async function fetchConfig(): Promise<AppConfig> {
  const r = await fetch(`${API}/api/config`);
  if (!r.ok) throw new Error("Failed to load config");
  return r.json();
}

export async function fetchCalendarMonth(
  year: number,
  month: number
): Promise<CalendarMonth> {
  const r = await fetch(`${API}/api/calendar/month?year=${year}&month=${month}`);
  if (!r.ok) throw new Error("Failed to load calendar");
  return r.json();
}

export async function fetchSlot(id: number): Promise<SlotDetail> {
  const r = await fetch(`${API}/api/slots/${id}`);
  if (!r.ok) throw new Error("Slot not found");
  return r.json();
}

export async function validatePromo(
  code: string,
  subtotalCents: number
): Promise<{ valid: boolean; discount_cents: number; message: string }> {
  const r = await fetch(`${API}/api/promo/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, subtotal_cents: subtotalCents }),
  });
  return r.json();
}

export type CreateBookingPayload = {
  slot_id: number;
  lines: { ticket_type_id: number; quantity: number }[];
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  marketing_opt_in: boolean;
  promo_code?: string;
  heard_about?: string;
  been_before?: string;
  comments?: string;
  ack_public_trip: boolean;
  ack_route: boolean;
  join_waitlist: boolean;
};

export async function createBooking(
  payload: CreateBookingPayload
): Promise<BookingSummary> {
  const r = await fetch(`${API}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail[0]?.msg
          : "Booking failed";
    throw new Error(msg || "Booking failed");
  }
  return data;
}

/** Release a pending seat hold (e.g. customer navigated away from checkout). */
export async function releaseBookingHold(reference: string): Promise<void> {
  const r = await fetch(
    `${API}/api/bookings/${encodeURIComponent(reference)}/release`,
    { method: "POST" }
  );
  if (!r.ok && r.status !== 404) {
    const data = await r.json().catch(() => ({}));
    const msg =
      typeof data.detail === "string" ? data.detail : "Could not release seat hold";
    throw new Error(msg);
  }
}

export async function confirmBookingPayment(
  reference: string
): Promise<{ reference: string; status: string }> {
  const r = await fetch(`${API}/api/bookings/${encodeURIComponent(reference)}/confirm`, {
    method: "POST",
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = typeof data.detail === "string" ? data.detail : "Payment confirmation failed";
    throw new Error(msg);
  }
  return data;
}
