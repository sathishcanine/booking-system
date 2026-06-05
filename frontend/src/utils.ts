export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** 24h style: 09:00, 19:00 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Parse API UTC timestamps (with or without Z / offset). */
export function parseUtcMs(iso: string): number {
  if (!iso) return 0;
  const hasZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  const normalized = hasZone ? iso : `${iso}Z`;
  return new Date(normalized).getTime();
}

export function secondsUntilUtc(iso: string): number {
  const ms = parseUtcMs(iso) - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

export function formatDateTime(iso: string): string {
  return new Date(parseUtcMs(iso)).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSlotRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} @ ${t1} – ${t2}`;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLabel(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}
