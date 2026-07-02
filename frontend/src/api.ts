import { apiFetch } from "./lib/apiFetch";
import { getRenterToken } from "./renter/renterApi";
import { MARKET_CITY, MARKET_STATE } from "./config/market";

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
  trip_protection_summary: string;
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
  const r = await apiFetch(`${API}/api/config`);
  if (!r.ok) throw new Error("Failed to load config");
  return r.json();
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  activityId?: number
): Promise<CalendarMonth> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (activityId) q.set("activity_id", String(activityId));
  const r = await apiFetch(`${API}/api/calendar/month?${q}`);
  if (!r.ok) throw new Error("Failed to load calendar");
  return r.json();
}

export type BoatCard = {
  id: number;
  slug: string;
  title: string;
  boat_type: string | null;
  max_guests: number | null;
  city: string | null;
  state: string | null;
  marina_name: string | null;
  location_label: string | null;
  duration_minutes: number;
  image_url: string | null;
  photo_urls: string[];
  amenities: string[];
  captain_required: boolean;
  hourly_rate_cents: number | null;
  length_ft: number | null;
  organization_name: string | null;
  starting_price_cents: number | null;
  emoji: string | null;
  average_rating: number | null;
  review_count: number;
  min_rental_hours: number;
  max_rental_hours: number;
  instant_book: boolean;
  bareboat_allowed: boolean;
  activity_tags: string[];
};

export type MarketplaceCategory = {
  id: string;
  label: string;
};

export type SearchConfig = {
  categories: MarketplaceCategory[];
  duration_hours: number[];
  popular_amenities: string[];
  price_min_cents: number;
  price_max_cents: number;
  length_max_ft: number;
  market_city: string;
  market_state: string;
  market_label: string;
};

export type BoatReview = {
  id: number;
  rating: number;
  body: string | null;
  reviewer_name: string;
  created_at: string;
  owner_response: string | null;
  owner_response_at: string | null;
};

export type BoatOwnerProfile = {
  name: string;
  rating: number | null;
  review_count: number;
  response_rate_percent: number;
  avg_response_time: string;
};

export type BoatCaptainProfile = {
  id: string;
  name: string;
  rating: number | null;
  review_count: number;
  trips_completed: number;
  coast_guard_verified: boolean;
  experience: string | null;
  license_types: string[];
  specializations: string[];
};

export type AllowedOnBoatItem = {
  id: string;
  label: string;
  allowed: boolean;
};

export type BoatListingPolicies = {
  allowed_on_boat: AllowedOnBoatItem[];
  cancellation_tier: string;
  cancellation_summary: string | null;
  is_commercial_owner: boolean;
  commercial_owner_summary: string | null;
  security_deposit_cents: number | null;
};

export type BoatDetail = BoatCard & {
  description: string | null;
  meeting_instructions: string | null;
  owner: BoatOwnerProfile | null;
  default_captain: BoatCaptainProfile | null;
  captain_alternatives: BoatCaptainProfile[];
  policies: BoatListingPolicies | null;
};

export type ProfileBoat = {
  slug: string;
  title: string;
  image_url: string | null;
  photo_count: number;
  hourly_rate_cents: number | null;
  min_rental_hours: number;
  max_rental_hours: number;
  max_guests: number | null;
  average_rating: number | null;
  review_count: number;
};

export type ProfileReview = {
  id: number;
  reviewer_name: string;
  rating: number;
  body: string | null;
  created_at: string;
  boat_title: string;
  boat_slug: string;
};

export type OwnerProfilePage = {
  name: string;
  rating: number | null;
  review_count: number;
  phone_verified: boolean;
  bio: string | null;
  aboard_since_year: number | null;
  boats: ProfileBoat[];
  reviews: ProfileReview[];
};

export type CaptainProfilePage = {
  id: string;
  name: string;
  photo_url: string | null;
  rating: number | null;
  review_count: number;
  phone_verified: boolean;
  coast_guard_verified: boolean;
  bio: string | null;
  aboard_since_year: number | null;
  location: string | null;
  trips_completed: number;
  experience: string | null;
  license_types: string[];
  specializations: string[];
  boats: ProfileBoat[];
  reviews: ProfileReview[];
};

export type CaptainListItem = {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  rating: number | null;
  review_count: number;
  coast_guard_verified: boolean;
  bio: string | null;
  location: string | null;
  experience: string | null;
  license_types: string[];
  specializations: string[];
};

export type CaptainSearchParams = {
  license?: string[];
  experience?: string;
  specialization?: string[];
  limit?: number;
  offset?: number;
};

export type CaptainPref = "captained" | "bareboat";

export type BoatSearchParams = {
  city?: string;
  state?: string;
  boat_type?: string;
  category?: string;
  guests?: number;
  price_min?: number;
  price_max?: number;
  duration_hours?: number;
  captain?: "captained" | "bareboat";
  instant_book?: boolean;
  length_max_ft?: number;
  amenity?: string;
  sort?: "price_asc" | "price_desc" | "title" | "rating";
  limit?: number;
  offset?: number;
};

export type Breadcrumb = {
  label: string;
  href: string | null;
};

export type DestinationSection = {
  id: string;
  title: string;
  boat_type: string | null;
  boats: BoatCard[];
  more_href: string | null;
};

export type MarketplacePromise = {
  title: string;
  items: { title: string; body: string }[];
};

export type DestinationPage = {
  city: string;
  state: string | null;
  label: string;
  boat_count: number;
  breadcrumbs: Breadcrumb[];
  sections: DestinationSection[];
  promise: MarketplacePromise;
};

export type BoatsPage = {
  items: BoatCard[];
  total: number;
  limit: number;
  offset: number;
};

export type Destination = {
  city: string;
  state: string | null;
  label: string;
  boat_count: number;
  image_url: string | null;
};

export function boatsSearchQuery(params: BoatSearchParams): string {
  const q = new URLSearchParams();
  q.set("city", (params.city?.trim() || MARKET_CITY).trim());
  q.set("state", (params.state?.trim() || MARKET_STATE).trim());
  if (params.boat_type) q.set("boat_type", params.boat_type);
  if (params.category) q.set("category", params.category);
  if (params.guests) q.set("guests", String(params.guests));
  if (params.price_min != null) q.set("price_min", String(params.price_min));
  if (params.price_max != null) q.set("price_max", String(params.price_max));
  if (params.duration_hours) q.set("duration_hours", String(params.duration_hours));
  if (params.captain) q.set("captain", params.captain);
  if (params.instant_book) q.set("instant_book", "true");
  if (params.length_max_ft) q.set("length_max_ft", String(params.length_max_ft));
  if (params.amenity) q.set("amenity", params.amenity);
  if (params.sort) q.set("sort", params.sort);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.offset) q.set("offset", String(params.offset));
  return q.toString();
}

export type BoatSearchDates = {
  start?: string;
};

export function boatsSearchPath(params: BoatSearchParams, dates?: BoatSearchDates): string {
  const q = new URLSearchParams();
  q.set("city", (params.city?.trim() || MARKET_CITY).trim());
  q.set("state", (params.state?.trim() || MARKET_STATE).trim());
  if (params.boat_type) q.set("boat_type", params.boat_type);
  if (params.category) q.set("category", params.category);
  if (params.guests) q.set("guests", String(params.guests));
  if (params.price_min != null) q.set("price_min", String(params.price_min));
  if (params.price_max != null) q.set("price_max", String(params.price_max));
  if (params.duration_hours) q.set("duration_hours", String(params.duration_hours));
  if (params.captain) q.set("captain", params.captain);
  if (params.instant_book) q.set("instant_book", "true");
  if (params.length_max_ft) q.set("length_max_ft", String(params.length_max_ft));
  if (params.amenity) q.set("amenity", params.amenity);
  if (params.sort) q.set("sort", params.sort);
  if (dates?.start) q.set("date", dates.start);
  const qs = q.toString();
  return `/boats${qs ? `?${qs}` : ""}`;
}

export async function fetchBoats(params?: BoatSearchParams): Promise<BoatsPage> {
  const q = boatsSearchQuery(params || {});
  const r = await apiFetch(`${API}/api/boats${q ? `?${q}` : ""}`);
  if (!r.ok) throw new Error("Could not load boats");
  return r.json();
}

export async function fetchFeaturedBoats(limit = 6): Promise<BoatCard[]> {
  const r = await apiFetch(`${API}/api/boats/featured?limit=${limit}`);
  if (!r.ok) throw new Error("Could not load featured boats");
  return r.json();
}

export async function fetchSearchConfig(): Promise<SearchConfig> {
  const r = await apiFetch(`${API}/api/search-config`);
  if (!r.ok) throw new Error("Could not load search config");
  return r.json();
}

export async function fetchDestinations(): Promise<Destination[]> {
  const r = await apiFetch(`${API}/api/destinations`);
  if (!r.ok) throw new Error("Could not load destinations");
  return r.json();
}

export async function fetchDestinationPage(params: {
  city: string;
  state?: string;
  guests?: number;
}): Promise<DestinationPage> {
  const q = new URLSearchParams({ city: params.city.trim() });
  if (params.state?.trim()) q.set("state", params.state.trim());
  if (params.guests) q.set("guests", String(params.guests));
  const r = await apiFetch(`${API}/api/destinations/page?${q}`);
  const data = await r.json();
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Destination not found");
  }
  return data;
}

export async function fetchBoat(slug: string): Promise<BoatDetail> {
  const r = await apiFetch(`${API}/api/boats/${slug}`);
  if (!r.ok) throw new Error("Boat not found");
  return r.json();
}

export async function fetchOwnerProfile(boatSlug: string): Promise<OwnerProfilePage> {
  const r = await apiFetch(`${API}/api/boats/${encodeURIComponent(boatSlug)}/owner-profile`);
  if (!r.ok) throw new Error("Owner profile not found");
  return r.json();
}

export async function fetchCaptainProfile(
  boatSlug: string,
  captainId: string
): Promise<CaptainProfilePage> {
  const r = await apiFetch(
    `${API}/api/boats/${encodeURIComponent(boatSlug)}/captains/${encodeURIComponent(captainId)}/profile`
  );
  if (!r.ok) throw new Error("Captain profile not found");
  return r.json();
}

export async function fetchCaptains(params: CaptainSearchParams = {}): Promise<CaptainListItem[]> {
  const q = new URLSearchParams();
  for (const item of params.license ?? []) q.append("license", item);
  if (params.experience) q.set("experience", params.experience);
  for (const item of params.specialization ?? []) q.append("specialization", item);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  const r = await apiFetch(`${API}/api/captains${qs ? `?${qs}` : ""}`);
  if (!r.ok) throw new Error("Could not load captains");
  return r.json();
}

export async function fetchCaptainBySlug(slug: string): Promise<CaptainProfilePage> {
  const r = await apiFetch(`${API}/api/captains/${encodeURIComponent(slug)}`);
  if (!r.ok) throw new Error("Captain profile not found");
  return r.json();
}

export type RentalQuote = {
  boat_price_cents: number;
  captain_price_cents: number;
  insurance_cents: number;
  addon_cents: number;
  subtotal_cents: number;
  duration_hours: number;
  hourly_rate_cents: number;
  captain_included: boolean;
};

export type CreateRentalPayload = {
  activity_slug: string;
  rental_date: string;
  start_time: string;
  duration_hours: number;
  passenger_count: number;
  captain_included: boolean;
  captain_slug?: string;
  insurance_selected: boolean;
  water_scooter_addon: boolean;
};

export async function fetchRentalQuote(
  slug: string,
  params: {
    duration_hours: number;
    passengers: number;
    captain: boolean;
    insurance?: boolean;
    water_scooter?: boolean;
  }
): Promise<RentalQuote> {
  const q = new URLSearchParams({
    duration_hours: String(params.duration_hours),
    passengers: String(params.passengers),
    captain: String(params.captain),
    insurance: String(params.insurance ?? false),
    water_scooter: String(params.water_scooter ?? false),
  });
  const r = await apiFetch(`${API}/api/boats/${encodeURIComponent(slug)}/rental-quote?${q}`);
  const data = await r.json();
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not load price");
  }
  return data;
}

export async function createRental(payload: CreateRentalPayload): Promise<BookingSummary> {
  const token = getRenterToken();
  if (!token) throw new Error("Sign in with Google to book");

  const r = await apiFetch(`${API}/api/rentals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not create booking");
  }
  return data;
}

export async function fetchBoatReviews(slug: string): Promise<BoatReview[]> {
  const r = await apiFetch(`${API}/api/boats/${encodeURIComponent(slug)}/reviews`);
  if (!r.ok) throw new Error("Could not load reviews");
  return r.json();
}

export async function fetchSlot(id: number): Promise<SlotDetail> {
  const r = await apiFetch(`${API}/api/slots/${id}`);
  if (!r.ok) throw new Error("Slot not found");
  return r.json();
}

export async function validatePromo(
  code: string,
  subtotalCents: number,
  slotId?: number
): Promise<{ valid: boolean; discount_cents: number; message: string }> {
  const r = await apiFetch(`${API}/api/promo/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      subtotal_cents: subtotalCents,
      slot_id: slotId ?? null,
    }),
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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const renterToken = getRenterToken();
  if (renterToken) headers.Authorization = `Bearer ${renterToken}`;

  const r = await apiFetch(`${API}/api/bookings`, {
    method: "POST",
    headers,
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

export type CancellationPolicy = {
  full_refund_hours: number;
  partial_refund_hours: number;
  partial_refund_percent: number;
  summary: string;
};

export async function fetchCancellationPolicy(): Promise<CancellationPolicy> {
  const r = await apiFetch(`${API}/api/cancellation-policy`);
  if (!r.ok) throw new Error("Could not load cancellation policy");
  return r.json();
}

/** Refresh checkout session for a pending booking (new Stripe client secret). */
export async function refreshBookingCheckout(
  reference: string
): Promise<BookingSummary> {
  const r = await apiFetch(
    `${API}/api/bookings/${encodeURIComponent(reference)}/checkout`,
    { method: "POST" }
  );
  const data = await r.json();
  if (!r.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : "Could not start checkout";
    throw new Error(msg);
  }
  return data;
}

/** Release a pending seat hold (e.g. customer navigated away from checkout). */
export async function releaseBookingHold(reference: string): Promise<void> {
  const r = await apiFetch(
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
  const r = await apiFetch(`${API}/api/bookings/${encodeURIComponent(reference)}/confirm`, {
    method: "POST",
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = typeof data.detail === "string" ? data.detail : "Payment confirmation failed";
    throw new Error(msg);
  }
  return data;
}

export type ContactInquiryPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message?: string;
};

export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<{ id: number; ok: boolean }> {
  const r = await apiFetch(`${API}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Could not send message");
  }
  return data;
}
