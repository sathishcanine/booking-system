const API = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "coastal_admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(`${API}${path}`, { ...init, headers });
  if (r.status === 401) {
    clearAdminToken();
    throw new Error("Session expired — please sign in again");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : data.message || `Request failed (${r.status})`;
    throw new Error(msg);
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

export type AdminActivityListItem = {
  id: number;
  title: string;
  slug: string;
  location_label: string | null;
  duration_minutes: number;
  is_active: boolean;
  ticket_type_count: number;
  slot_count: number;
};

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
  items: { ticket_name: string; quantity: number; unit_price_cents: number }[];
};

export async function adminLogin(password: string) {
  const r = await fetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Invalid password");
  }
  setAdminToken(data.token);
  return data as { token: string };
}

export const admin = {
  dashboard: () => adminFetch<AdminDashboard>("/api/admin/dashboard"),
  activities: {
    list: () => adminFetch<AdminActivityListItem[]>("/api/admin/activities"),
    get: (id: number) => adminFetch<AdminActivity>(`/api/admin/activities/${id}`),
    create: (body: Omit<AdminActivity, "id" | "ticket_types">) =>
      adminFetch<AdminActivity>("/api/admin/activities", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Omit<AdminActivity, "id" | "ticket_types">) =>
      adminFetch<AdminActivity>(`/api/admin/activities/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      adminFetch<{ ok: boolean; deactivated?: boolean; message?: string }>(
        `/api/admin/activities/${id}`,
        { method: "DELETE" }
      ),
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
  bookings: {
    list: (params?: { status?: string; slot_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.slot_id) q.set("slot_id", String(params.slot_id));
      return adminFetch<AdminBooking[]>(`/api/admin/bookings?${q}`);
    },
    cancel: (id: number) =>
      adminFetch<{ ok: boolean; reference: string }>(
        `/api/admin/bookings/${id}/cancel`,
        { method: "PATCH" }
      ),
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
