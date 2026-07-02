import { apiFetch } from "../lib/apiFetch";

const API = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "coastal_admin_token";
const EXPIRES_KEY = "coastal_admin_expires_at";
const ROLE_KEY = "coastal_auth_role";
const ORG_NAME_KEY = "coastal_auth_org_name";
const DISPLAY_NAME_KEY = "coastal_auth_display_name";
const EMAIL_KEY = "coastal_auth_email";

export type AuthRole = "owner" | "super_admin";

function isTokenExpired(): boolean {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return true;
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() >= expiresAt;
}

export function getAdminToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || isTokenExpired()) {
    clearAdminToken();
    return null;
  }
  return token;
}

export function setAdminToken(token: string, expiresInSeconds: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    EXPIRES_KEY,
    String(Date.now() + Math.max(0, expiresInSeconds) * 1000)
  );
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ORG_NAME_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function getAuthRole(): AuthRole | null {
  const role = localStorage.getItem(ROLE_KEY);
  return role === "owner" || role === "super_admin" ? role : null;
}

export function getAuthOrgName(): string | null {
  return localStorage.getItem(ORG_NAME_KEY);
}

export function getAuthDisplayName(): string | null {
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function getAuthEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

/** Seconds until the stored session expires (0 if missing/expired). */
export function adminSessionSecondsRemaining(): number {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return 0;
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

function formatApiError(data: unknown, status: number): string {
  if (!data || typeof data !== "object") return `Request failed (${status})`;
  const d = data as { detail?: unknown; message?: string };
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) {
    const parts = d.detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const e = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(e.loc)
          ? e.loc.filter((x) => typeof x === "string" && x !== "body").join(".")
          : "";
        return field && e.msg ? `${field}: ${e.msg}` : e.msg || null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (d.message) return d.message;
  return `Request failed (${status})`;
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !headers["Content-Type"] && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  const r = await apiFetch(`${API}${path}`, { ...init, headers });
  if (r.status === 401) {
    clearAdminToken();
    throw new Error("Session expired — please sign in again");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(formatApiError(data, r.status));
  }
  return data as T;
}

export type AdminDashboard = {
  generated_at: string;
  activity_count: number;
  active_slot_count: number;
  upcoming_departure_count: number;
  booking_count: number;
  paid_booking_count: number;
  pending_booking_count: number;
  waitlist_count: number;
  cancelled_count: number;
  expired_count: number;
  total_revenue_cents: number;
  revenue_today_cents: number;
  revenue_7d_cents: number;
  revenue_30d_cents: number;
  bookings_today: number;
  bookings_7d: number;
  bookings_30d: number;
  paid_bookings_7d: number;
  tickets_sold: number;
  average_order_cents: number;
  conversion_rate_percent: number;
  marketing_opt_ins: number;
  marketing_opt_in_rate_percent: number;
  promo_booking_count: number;
  upcoming_capacity: number;
  upcoming_booked: number;
  upcoming_held_seats: number;
  upcoming_spots_remaining: number;
  upcoming_fill_rate_percent: number;
  low_stock_departures: number;
  waitlist_departures: number;
  call_to_book_departures: number;
  bookings_by_status: { status: string; count: number }[];
  revenue_by_day: {
    date: string;
    revenue_cents: number;
    booking_count: number;
    paid_count: number;
  }[];
  top_tours: {
    activity_id: number;
    title: string;
    paid_bookings: number;
    revenue_cents: number;
    tickets_sold: number;
  }[];
  top_ticket_types: {
    ticket_type_id: number;
    name: string;
    quantity_sold: number;
    gross_cents: number;
  }[];
  top_promos: { code: string; uses: number }[];
  heard_about: Record<string, number>;
  recent_bookings: {
    id: number;
    reference: string;
    status: string;
    customer_name: string;
    total_cents: number;
    is_waitlist: boolean;
    created_at: string;
    activity_title: string;
    slot_starts_at: string;
  }[];
  upcoming_departures: {
    slot_id: number;
    activity_title: string;
    starts_at: string;
    capacity: number;
    booked: number;
    held: number;
    spots_left: number;
    fill_percent: number;
    is_call_to_book: boolean;
  }[];
};

export type ListingStatus = "draft" | "pending_review" | "published" | "delisted";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Live",
  delisted: "Delisted",
};

export const BOAT_TYPES = [
  { value: "pontoon", label: "Pontoon" },
  { value: "deck_boat", label: "Deck boat" },
  { value: "yacht", label: "Yacht" },
  { value: "sailboat", label: "Sailboat" },
  { value: "fishing", label: "Fishing boat" },
  { value: "jet_ski", label: "Jet ski / PWC" },
  { value: "catamaran", label: "Catamaran" },
  { value: "other", label: "Other" },
] as const;

export const MARKETPLACE_CATEGORIES = [
  { id: "watersports", label: "Watersports" },
  { id: "fishing", label: "Fishing" },
  { id: "sailing", label: "Sailing" },
  { id: "cruising", label: "Cruising" },
  { id: "celebrating", label: "Celebrating" },
] as const;

export const BOAT_AMENITIES = [
  "GPS",
  "Bluetooth speakers",
  "Cooler",
  "Bimini top",
  "Restroom",
  "Snorkel gear",
  "Wakeboard tower",
  "Grill",
] as const;

export type AdminActivityListItem = {
  id: number;
  title: string;
  slug: string;
  location_label: string | null;
  city: string | null;
  duration_minutes: number;
  is_active: boolean;
  listing_status: ListingStatus;
  boat_type: string | null;
  max_guests: number | null;
  hourly_rate_cents: number | null;
  organization_name: string | null;
  ticket_type_count: number;
  slot_count: number;
};

export type AdminActivityInput = Omit<AdminActivity, "id" | "ticket_types" | "listing_status">;

export type AdminTicketType = {
  id: number;
  activity_id: number;
  name: string;
  subtitle: string | null;
  price_cents: number;
  sort_order: number;
  max_per_booking: number | null;
};

export type AdminActivity = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  location_label: string | null;
  image_url: string | null;
  emoji: string | null;
  meeting_instructions: string | null;
  is_active: boolean;
  listing_status: ListingStatus;
  max_guests: number | null;
  boat_type: string | null;
  boat_make: string;
  boat_model: string;
  marina_name: string | null;
  city: string | null;
  state: string | null;
  amenities: string[];
  photo_urls: string[];
  captain_required: boolean;
  hourly_rate_cents: number | null;
  length_ft: number | null;
  min_rental_hours: number;
  max_rental_hours: number;
  instant_book: boolean;
  bareboat_allowed: boolean;
  activity_tags: string[];
  ticket_types: AdminTicketType[];
};

export type AdminSlot = {
  id: number;
  activity_id: number;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  waitlist_enabled: boolean;
  promo_text: string | null;
  card_image_url: string | null;
  card_description: string | null;
  is_call_to_book: boolean;
  call_phone: string | null;
  brand_label: string | null;
  urgency_text: string | null;
  is_cancelled: boolean;
  activity_title: string | null;
  booking_cutoff_hours: number | null;
};

export type AdminPromo = {
  id: number;
  code: string;
  discount_percent: number | null;
  discount_cents: number | null;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
};

export type AdminOrganization = {
  id: number;
  name: string;
};

export type AdminCaptain = {
  id: number;
  organization_id: number;
  organization_name: string | null;
  slug: string;
  name: string;
  bio: string | null;
  location: string | null;
  photo_url: string | null;
  experience: string | null;
  license_types: string[];
  specializations: string[];
  rating: number | null;
  review_count: number;
  trips_completed: number;
  coast_guard_verified: boolean;
  phone_verified: boolean;
  aboard_since_year: number | null;
  is_active: boolean;
};

export type AdminCaptainInput = {
  name: string;
  slug?: string;
  bio?: string | null;
  location?: string | null;
  photo_url?: string | null;
  experience?: string | null;
  license_types?: string[];
  specializations?: string[];
  coast_guard_verified: boolean;
  phone_verified: boolean;
  is_active: boolean;
  organization_id?: number | null;
};

export type AdminBooking = {
  id: number;
  reference: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  total_cents: number;
  is_waitlist: boolean;
  created_at: string;
  slot_id: number;
  activity_title: string;
  slot_starts_at: string;
  refund_cents: number;
  cancelled_at: string | null;
  cancelled_by: string | null;
  items: { ticket_name: string; quantity: number; unit_price_cents: number }[];
};

export type AdminBookingDetail = AdminBooking & {
  booking_kind: string;
  activity_slug: string | null;
  organization_name: string | null;
  rental_starts_at: string | null;
  duration_hours: number | null;
  passenger_count: number | null;
  captain_included: boolean;
  captain_name: string | null;
  boat_price_cents: number;
  captain_price_cents: number;
  insurance_cents: number;
  addon_cents: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  platform_fee_cents: number;
  owner_payout_cents: number;
  promo_code: string | null;
  cancellation_reason: string | null;
  stripe_refund_id: string | null;
  comments: string | null;
  heard_about: string | null;
  been_before: string | null;
  marketing_opt_in: boolean;
};

export type CancelBookingResult = {
  ok: boolean;
  reference: string;
  status: string;
  refund_cents: number;
  message: string | null;
};

type AdminAuthResponse = {
  token: string;
  expires_in: number;
  token_type?: string;
  role?: AuthRole;
  organization_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

function storeAdminAuth(data: AdminAuthResponse) {
  setAdminToken(data.token, data.expires_in);
  if (data.role) localStorage.setItem(ROLE_KEY, data.role);
  if (data.organization_name) {
    localStorage.setItem(ORG_NAME_KEY, data.organization_name);
  } else {
    localStorage.removeItem(ORG_NAME_KEY);
  }
  if (data.display_name) {
    localStorage.setItem(DISPLAY_NAME_KEY, data.display_name);
  } else {
    localStorage.removeItem(DISPLAY_NAME_KEY);
  }
  if (data.email) localStorage.setItem(EMAIL_KEY, data.email);
  else localStorage.removeItem(EMAIL_KEY);
}

export async function ownerRegister(
  email: string,
  password: string,
  organizationName: string
) {
  const r = await apiFetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      organization_name: organizationName,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Registration failed"
    );
  }
  const auth = data as AdminAuthResponse;
  storeAdminAuth(auth);
  return auth;
}

export async function ownerGoogleLogin(credential: string, organizationName?: string) {
  const r = await apiFetch(`${API}/api/auth/owner/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      organization_name: organizationName || undefined,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Google sign-in failed"
    );
  }
  const auth = data as AdminAuthResponse;
  storeAdminAuth(auth);
  return auth;
}

export async function ownerLogin(email: string, password: string) {
  const r = await apiFetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Invalid email or password"
    );
  }
  const auth = data as AdminAuthResponse;
  storeAdminAuth(auth);
  return auth;
}

export async function adminLogin(password: string) {
  const r = await apiFetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Invalid password"
    );
  }
  const auth = { ...(data as AdminAuthResponse), role: "super_admin" as const };
  storeAdminAuth(auth);
  return auth;
}

/** Renew JWT before it expires (requires a valid session). */
export async function adminRefreshSession(): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || isTokenExpired()) {
    clearAdminToken();
    return false;
  }
  try {
    const r = await apiFetch(`${API}/api/admin/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) clearAdminToken();
      return false;
    }
    storeAdminAuth(data as AdminAuthResponse);
    return true;
  } catch {
    return false;
  }
}

export type MarketplacePromiseItem = {
  title: string;
  body: string;
};

export type PlatformSettings = {
  platform_fee_percent: number;
  tax_rate_percent: number;
  cancel_full_refund_hours: number;
  cancel_partial_refund_hours: number;
  cancel_partial_refund_percent: number;
  trip_protection_summary: string | null;
  marketplace_promise_title: string | null;
  marketplace_promise_items: MarketplacePromiseItem[] | null;
  destination_best_title_template: string | null;
  destination_type_title_template: string | null;
};

export type AdminReview = {
  id: number;
  rating: number;
  body: string | null;
  reviewer_name: string;
  created_at: string;
  owner_response: string | null;
  owner_response_at: string | null;
  activity_id: number;
  activity_title: string;
  booking_reference: string;
};

export type AdminContactInquiry = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

export type ConnectStatus = {
  stripe_configured: boolean;
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  ready_for_payments: boolean;
  dashboard_url: string | null;
};

export type EarningsBooking = {
  id: number;
  reference: string;
  customer_name: string;
  total_cents: number;
  platform_fee_cents: number;
  owner_payout_cents: number;
  tax_cents: number;
  created_at: string;
  activity_title: string;
};

export type Earnings = {
  gross_revenue_cents: number;
  platform_fees_cents: number;
  net_earnings_cents: number;
  tax_collected_cents: number;
  paid_booking_count: number;
  connect: ConnectStatus | null;
  recent_bookings: EarningsBooking[];
};

export const connectApi = {
  status: () => adminFetch<ConnectStatus>("/api/connect/status"),
  onboard: () =>
    adminFetch<{ url: string }>("/api/connect/onboard", { method: "POST" }),
  refresh: () =>
    adminFetch<ConnectStatus>("/api/connect/refresh", { method: "POST" }),
};

export async function uploadListingPhoto(file: File): Promise<{ url: string }> {
  const token = getAdminToken();
  const body = new FormData();
  body.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await apiFetch(`${API}/api/admin/uploads/listing-photo`, {
    method: "POST",
    headers,
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    clearAdminToken();
    throw new Error("Session expired — please sign in again");
  }
  if (!r.ok) {
    throw new Error(formatApiError(data, r.status));
  }
  return data as { url: string };
}

export async function uploadCaptainPhoto(file: File): Promise<{ url: string }> {
  const token = getAdminToken();
  const body = new FormData();
  body.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await apiFetch(`${API}/api/admin/uploads/captain-photo`, {
    method: "POST",
    headers,
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    clearAdminToken();
    throw new Error("Session expired — please sign in again");
  }
  if (!r.ok) {
    throw new Error(formatApiError(data, r.status));
  }
  return data as { url: string };
}

export const admin = {
  dashboard: (scope: "overall" | "own" = "overall") =>
    adminFetch<AdminDashboard>(
      scope === "own" ? "/api/admin/dashboard?scope=own" : "/api/admin/dashboard"
    ),
  earnings: () => adminFetch<Earnings>("/api/admin/earnings"),
  platformSettings: {
    get: () => adminFetch<PlatformSettings>("/api/admin/platform-settings"),
    update: (body: PlatformSettings) =>
      adminFetch<PlatformSettings>("/api/admin/platform-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  activities: {
    list: () => adminFetch<AdminActivityListItem[]>("/api/admin/activities"),
    get: (id: number) => adminFetch<AdminActivity>(`/api/admin/activities/${id}`),
    create: (body: AdminActivityInput) =>
      adminFetch<AdminActivity>("/api/admin/activities", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: AdminActivityInput) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean; deactivated?: boolean; message?: string }>(
        `/api/admin/activities/${id}`,
        { method: "DELETE" }
      ),
    submitReview: (id: number) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}/submit-review`, {
        method: "POST",
      }),
    approve: (id: number) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}/approve`, {
        method: "POST",
      }),
    reject: (id: number) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}/reject`, {
        method: "POST",
      }),
    delist: (id: number) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}/delist`, {
        method: "POST",
      }),
  },
  ticketTypes: {
    create: (activityId: number, body: Omit<AdminTicketType, "id" | "activity_id">) =>
      adminFetch<AdminTicketType>(`/api/admin/activities/${activityId}/ticket-types`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Omit<AdminTicketType, "id" | "activity_id">) =>
      adminFetch<AdminTicketType>(`/api/admin/ticket-types/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean }>(`/api/admin/ticket-types/${id}`, { method: "DELETE" }),
  },
  slots: {
    list: (params: { year?: number; month?: number; activity_id?: number; include_cancelled?: boolean }) => {
      const q = new URLSearchParams();
      if (params.year) q.set("year", String(params.year));
      if (params.month) q.set("month", String(params.month));
      if (params.activity_id) q.set("activity_id", String(params.activity_id));
      if (params.include_cancelled) q.set("include_cancelled", "true");
      return adminFetch<AdminSlot[]>(`/api/admin/slots?${q}`);
    },
    create: (body: Record<string, unknown>) =>
      adminFetch<AdminSlot>("/api/admin/slots", { method: "POST", body: JSON.stringify(body) }),
    bulk: (body: Record<string, unknown>) =>
      adminFetch<AdminSlot[]>("/api/admin/slots/bulk", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Record<string, unknown>) =>
      adminFetch<AdminSlot>(`/api/admin/slots/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean }>(`/api/admin/slots/${id}`, { method: "DELETE" }),
    restore: (id: number) =>
      adminFetch<{ ok: boolean }>(`/api/admin/slots/${id}/restore`, { method: "POST" }),
  },
  organizations: {
    list: () => adminFetch<AdminOrganization[]>("/api/admin/organizations"),
  },
  captains: {
    list: () => adminFetch<AdminCaptain[]>("/api/admin/captains"),
    create: (body: AdminCaptainInput) =>
      adminFetch<AdminCaptain>("/api/admin/captains", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: AdminCaptainInput) =>
      adminFetch<AdminCaptain>(`/api/admin/captains/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean }>(`/api/admin/captains/${id}`, { method: "DELETE" }),
  },
  promos: {
    list: () => adminFetch<AdminPromo[]>("/api/admin/promos"),
    create: (body: Omit<AdminPromo, "id" | "used_count">) =>
      adminFetch<AdminPromo>("/api/admin/promos", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Omit<AdminPromo, "id" | "used_count">) =>
      adminFetch<AdminPromo>(`/api/admin/promos/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean }>(`/api/admin/promos/${id}`, { method: "DELETE" }),
    resetUsage: (id: number) =>
      adminFetch<AdminPromo>(`/api/admin/promos/${id}/reset-usage`, { method: "POST" }),
  },
  reviews: {
    list: () => adminFetch<AdminReview[]>("/api/admin/reviews"),
    respond: (id: number, response: string) =>
      adminFetch<AdminReview>(`/api/admin/reviews/${id}/respond`, {
        method: "PATCH",
        body: JSON.stringify({ response }),
      }),
  },
  contactInquiries: {
    list: () => adminFetch<AdminContactInquiry[]>("/api/admin/contact-inquiries"),
    markRead: (id: number) =>
      adminFetch<AdminContactInquiry>(`/api/admin/contact-inquiries/${id}/read`, {
        method: "PATCH",
      }),
  },
  bookings: {
    list: (params?: { status?: string; slot_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.slot_id) q.set("slot_id", String(params.slot_id));
      return adminFetch<AdminBooking[]>(`/api/admin/bookings?${q}`);
    },
    get: (id: number) => adminFetch<AdminBookingDetail>(`/api/admin/bookings/${id}`),
    cancel: (
      id: number,
      body?: { reason?: string; full_refund?: boolean }
    ) =>
      adminFetch<CancelBookingResult>(`/api/admin/bookings/${id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify(body ?? {}),
      }),
  },
};

export const COASTAL_LOCATIONS = [
  "Gulfport Marina Location",
  "SkyBeach Resort Location",
  "MarineMax Location",
];

export const SAMPLE_TOURS = [
  {
    title: "Dolphin Watching & Island Sunset",
    emoji: "🐬🌴🌅",
    duration: 150,
    location: "Gulfport Marina Location",
  },
  {
    title: "Island Sunset & Skyway Light Show",
    emoji: "🌅🌉",
    duration: 180,
    location: "SkyBeach Resort Location",
  },
  {
    title: "Egmont Key Island Adventure",
    emoji: "🏝️🐬",
    duration: 300,
    location: "Gulfport Marina Location",
  },
  {
    title: "Sandbar Party",
    emoji: "🍹🌴",
    duration: 240,
    location: "Gulfport Marina Location",
  },
  {
    title: "Booze Cruise",
    emoji: "🍹🌅",
    duration: 150,
    location: "SkyBeach Resort Location",
  },
  {
    title: "Shell Key Dolphin Float Party",
    emoji: "🐬☀️",
    duration: 240,
    location: "SkyBeach Resort Location",
  },
  {
    title: "Water Sports Charter",
    emoji: "🚤",
    duration: 180,
    location: "Gulfport Marina Location",
  },
];
