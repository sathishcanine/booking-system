import { apiFetch } from "../lib/apiFetch";

const API = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "coastal_renter_token";
const EXPIRES_KEY = "coastal_renter_expires_at";
const NAME_KEY = "coastal_renter_name";
const EMAIL_KEY = "coastal_renter_email";

function isTokenExpired(): boolean {
  const raw = localStorage.getItem(EXPIRES_KEY);
  if (!raw) return true;
  return Date.now() >= Number(raw);
}

export function getRenterToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || isTokenExpired()) {
    clearRenterSession();
    return null;
  }
  return token;
}

export function clearRenterSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function getRenterProfile(): { name: string | null; email: string | null } {
  return {
    name: localStorage.getItem(NAME_KEY),
    email: localStorage.getItem(EMAIL_KEY),
  };
}

type AuthResponse = {
  token: string;
  expires_in: number;
  email?: string;
  role?: string;
};

function storeSession(data: AuthResponse, displayName?: string) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(EXPIRES_KEY, String(Date.now() + data.expires_in * 1000));
  if (data.email) localStorage.setItem(EMAIL_KEY, data.email);
  if (displayName) localStorage.setItem(NAME_KEY, displayName);
}

async function renterFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getRenterToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const r = await apiFetch(`${API}${path}`, { ...init, headers });
  if (r.status === 401) {
    clearRenterSession();
    throw new Error("Session expired — please sign in again");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      typeof data.detail === "string" ? data.detail : `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export type RenterBooking = {
  reference: string;
  status: string;
  total_cents: number;
  is_waitlist: boolean;
  created_at: string;
  activity_title: string;
  activity_slug: string;
  slot_starts_at: string;
  slot_id: number;
  refund_cents: number;
  can_cancel: boolean;
  can_review: boolean;
  has_review: boolean;
};

export type ReviewResult = {
  id: number;
  rating: number;
  body: string | null;
  reviewer_name: string;
  created_at: string;
};

export type CancellationPreview = {
  reference: string;
  can_cancel: boolean;
  message: string | null;
  refund_cents: number;
  refund_percent: number;
  total_cents: number;
  hours_until_departure: number | null;
  policy_summary: string;
};

export type CancelBookingResult = {
  ok: boolean;
  reference: string;
  status: string;
  refund_cents: number;
  message: string | null;
};

export type SavedBoat = {
  activity_id: number;
  slug: string;
  title: string;
  image_url: string | null;
  city: string | null;
  state: string | null;
  starting_price_cents: number | null;
  saved_at: string;
};

export async function renterRegister(
  email: string,
  password: string,
  displayName: string
) {
  const r = await apiFetch(`${API}/api/auth/renter/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      display_name: displayName,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Registration failed");
  }
  const auth = data as AuthResponse;
  storeSession(auth, displayName);
  return auth;
}

export async function renterGoogleLogin(credential: string) {
  const r = await apiFetch(`${API}/api/auth/renter/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Google sign-in failed");
  }
  const auth = data as AuthResponse;
  storeSession(auth);
  try {
    const me = await renterFetch<{ display_name?: string | null }>("/api/auth/me");
    if (me.display_name) localStorage.setItem(NAME_KEY, me.display_name);
  } catch {
    /* profile optional */
  }
  return auth;
}

export async function renterLogin(email: string, password: string) {
  const r = await apiFetch(`${API}/api/auth/renter/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Invalid email or password");
  }
  const auth = data as AuthResponse;
  storeSession(auth);
  try {
    const me = await renterFetch<{ display_name?: string | null }>("/api/auth/me");
    if (me.display_name) localStorage.setItem(NAME_KEY, me.display_name);
  } catch {
    /* profile optional */
  }
  return auth;
}

export const renter = {
  bookings: () => renterFetch<RenterBooking[]>("/api/renter/bookings"),
  cancelPreview: (reference: string) =>
    renterFetch<CancellationPreview>(`/api/renter/bookings/${reference}/cancel-preview`),
  cancelBooking: (reference: string) =>
    renterFetch<CancelBookingResult>(`/api/renter/bookings/${reference}/cancel`, {
      method: "POST",
    }),
  submitReview: (reference: string, rating: number, body?: string) =>
    renterFetch<ReviewResult>(`/api/renter/bookings/${reference}/review`, {
      method: "POST",
      body: JSON.stringify({ rating, body: body || null }),
    }),
  savedBoats: () => renterFetch<SavedBoat[]>("/api/renter/saved-boats"),
  saveBoat: (activityId: number) =>
    renterFetch<SavedBoat>(`/api/renter/saved-boats/${activityId}`, { method: "POST" }),
  unsaveBoat: (activityId: number) =>
    renterFetch<{ ok: boolean }>(`/api/renter/saved-boats/${activityId}`, {
      method: "DELETE",
    }),
};
