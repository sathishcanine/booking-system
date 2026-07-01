import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { admin, type AdminDashboard } from "../../admin/adminApi";
import { formatMoney } from "../../utils";

function pctWidth(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function statusClass(status: string, waitlist: boolean) {
  if (waitlist) return "admin-badge-waitlist";
  if (status === "paid") return "admin-badge-paid";
  if (status === "pending") return "admin-badge-pending";
  return "admin-badge-cancelled";
}

function RevenueChart({ days }: { days: AdminDashboard["revenue_by_day"] }) {
  const maxRev = Math.max(...days.map((d) => d.revenue_cents), 1);
  const hasRevenue = days.some((d) => d.revenue_cents > 0);
  const showLabels = days.length <= 14;

  if (!hasRevenue) {
    return (
      <div className="dash-chart-empty">
        <span className="dash-chart-empty__icon" aria-hidden>
          📈
        </span>
        <p>No paid revenue in this period yet.</p>
        <small>Bars will appear as customers complete bookings.</small>
      </div>
    );
  }

  return (
    <div className="dash-chart dash-chart--revenue">
      <div className="dash-chart-bars">
        {days.map((d) => {
          const h = pctWidth(d.revenue_cents, maxRev);
          const label = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <div className="dash-bar-col" key={d.date} title={`${label}: ${formatMoney(d.revenue_cents)}`}>
              <div className="dash-bar-wrap">
                <div
                  className={`dash-bar dash-bar--revenue${d.revenue_cents > 0 ? " dash-bar--active" : ""}`}
                  style={{ height: `${Math.max(h, d.revenue_cents > 0 ? 6 : 0)}%` }}
                />
              </div>
              {showLabels && <span className="dash-bar-label">{label.split(" ")[1]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBreakdown({ items }: { items: AdminDashboard["bookings_by_status"] }) {
  const total = items.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <p className="admin-hint">No bookings yet.</p>;
  }

  return (
    <div className="dash-status">
      <div className="dash-status-bar" aria-hidden>
        {items.map((s) => (
          <span
            key={s.status}
            className={`dash-status-segment dash-status-segment--${s.status}`}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="dash-donut-legend">
        {items.map((s) => (
          <div className="dash-legend-row" key={s.status}>
            <span className={`admin-badge ${statusClass(s.status, false)}`}>{s.status}</span>
            <strong>{s.count}</strong>
            <span className="dash-legend-pct">{Math.round((s.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  formatValue,
}: {
  items: { label: string; value: number }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = formatValue || ((n: number) => String(n));

  return (
    <div className="dash-hbars">
      {items.map((item) => (
        <div className="dash-hbar-row" key={item.label}>
          <span className="dash-hbar-label" title={item.label}>
            {item.label}
          </span>
          <div className="dash-hbar-track">
            <div className="dash-hbar-fill" style={{ width: `${pctWidth(item.value, max)}%` }} />
          </div>
          <span className="dash-hbar-value">{fmt(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

const KPI_ICONS: Record<string, string> = {
  green: "◆",
  blue: "◇",
  orange: "◎",
  purple: "✦",
  warn: "◷",
};

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "blue" | "orange" | "purple" | "warn";
}) {
  const tone = accent || "blue";
  return (
    <article className={`dash-kpi dash-kpi--${tone}`}>
      <span className="dash-kpi-icon" aria-hidden>
        {KPI_ICONS[tone]}
      </span>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <strong className="dash-kpi-value">{value}</strong>
        {sub && <span className="dash-kpi-sub">{sub}</span>}
      </div>
    </article>
  );
}

type DashboardScope = "overall" | "own";

export default function AdminDashboardPage() {
  const location = useLocation();
  const basePath = useMemo(
    () => (location.pathname.startsWith("/owner") ? "/owner" : "/admin"),
    [location.pathname]
  );
  const isPlatformAdmin = basePath === "/admin";
  const [scope, setScope] = useState<DashboardScope>("overall");
  const [stats, setStats] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    admin
      .dashboard(isPlatformAdmin ? scope : "overall")
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isPlatformAdmin, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const updated = stats ? new Date(stats.generated_at).toLocaleString() : "";
  const peakRevenue = stats
    ? Math.max(...stats.revenue_by_day.map((d) => d.revenue_cents))
    : 0;

  return (
    <div className="dash-page">
      <header className="dash-hero">
        <div className="dash-hero__text">
          <p className="dash-hero__eyebrow">{isPlatformAdmin ? "Platform" : "Owner"}</p>
          <h1>{isPlatformAdmin ? "Marketplace dashboard" : "Analytics dashboard"}</h1>
          {isPlatformAdmin && (
            <div className="dash-scope-toggle" role="group" aria-label="Dashboard scope">
              <button
                type="button"
                className={`dash-scope-btn${scope === "overall" ? " dash-scope-btn--active" : ""}`}
                aria-pressed={scope === "overall"}
                onClick={() => setScope("overall")}
              >
                Overall
              </button>
              <button
                type="button"
                className={`dash-scope-btn${scope === "own" ? " dash-scope-btn--active" : ""}`}
                aria-pressed={scope === "own"}
                onClick={() => setScope("own")}
              >
                Own boats
              </button>
            </div>
          )}
          {updated && (
            <p className="dash-hero__meta">
              {isPlatformAdmin
                ? scope === "overall"
                  ? "All owners · "
                  : "Your boats · "
                : ""}
              Last updated {updated}
            </p>
          )}
        </div>
        <div className="dash-hero__actions">
          <button type="button" className="admin-btn dash-btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <Link to={`${basePath}/activities`} className="admin-btn admin-btn-primary">
            {isPlatformAdmin ? "Manage boats" : "+ Add boat"}
          </Link>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {loading && !stats && (
        <div className="dash-loading">
          <div className="dash-loading__pulse" />
          <p>Loading analytics…</p>
        </div>
      )}

      {stats && (
        <>
          {((!isPlatformAdmin && stats.activity_count === 0) ||
            (isPlatformAdmin && scope === "own" && stats.activity_count === 0)) && (
            <section className="admin-card dash-welcome">
              <h2>Welcome — list your first boat</h2>
              <p className="admin-hint">
                Your dashboard is empty. Add a boat listing to start receiving bookings and
                revenue here.
              </p>
              <Link to={`${basePath}/activities`} className="admin-btn admin-btn-primary">
                + Add boat
              </Link>
            </section>
          )}

          <section className="dash-kpi-grid">
            <KpiCard
              accent="green"
              label="Total revenue"
              value={formatMoney(stats.total_revenue_cents)}
              sub={`${formatMoney(stats.revenue_30d_cents)} last 30 days`}
            />
            <KpiCard
              accent="blue"
              label="Today"
              value={formatMoney(stats.revenue_today_cents)}
              sub={`${stats.bookings_today} booking attempts`}
            />
            <KpiCard
              accent="blue"
              label="Last 7 days"
              value={formatMoney(stats.revenue_7d_cents)}
              sub={`${stats.paid_bookings_7d} paid · ${stats.bookings_7d} total`}
            />
            <KpiCard
              accent="purple"
              label="Guests booked"
              value={String(stats.tickets_sold)}
              sub={`Avg booking ${formatMoney(stats.average_order_cents)}`}
            />
            <KpiCard
              accent="green"
              label="Paid bookings"
              value={String(stats.paid_booking_count)}
              sub={`${stats.conversion_rate_percent}% conversion`}
            />
            <KpiCard
              accent="warn"
              label="Pending payment"
              value={String(stats.pending_booking_count)}
              sub="Active checkout holds"
            />
            <KpiCard
              accent="purple"
              label="Listed boats"
              value={String(stats.activity_count)}
              sub={`${stats.paid_booking_count} paid rentals`}
            />
          </section>

          <section className="dash-grid-2">
            <div className="admin-card dash-panel dash-panel--chart">
              <div className="dash-panel__head">
                <h2>Revenue — last 30 days</h2>
                <span className="dash-panel__tag">30d</span>
              </div>
              <RevenueChart days={stats.revenue_by_day} />
              <p className="dash-panel-foot">
                Peak day <strong>{formatMoney(peakRevenue)}</strong>
              </p>
            </div>

            <div className="admin-card dash-panel">
              <div className="dash-panel__head">
                <h2>Bookings by status</h2>
              </div>
              <StatusBreakdown items={stats.bookings_by_status} />
              <div className="dash-mini-stats">
                <span>Cancelled: {stats.cancelled_count}</span>
                <span>Expired holds: {stats.expired_count}</span>
                <span>Promo used: {stats.promo_booking_count}</span>
                <span>Email opt-in: {stats.marketing_opt_in_rate_percent}%</span>
              </div>
            </div>
          </section>

          <section className="dash-grid-2">
            <div className="admin-card dash-panel">
              <div className="dash-panel__head">
                <h2>Top boats (revenue)</h2>
              </div>
              {stats.top_tours.length === 0 ? (
                <p className="admin-hint">No paid bookings yet.</p>
              ) : (
                <HorizontalBars
                  items={stats.top_tours.map((t) => ({
                    label: `${t.title} (${t.paid_bookings} bookings)`,
                    value: t.revenue_cents,
                  }))}
                  formatValue={(n) => formatMoney(n)}
                />
              )}
            </div>

            <div className="admin-card dash-panel">
              <div className="dash-panel__head">
                <h2>Booking funnel</h2>
              </div>
              <div className="dash-mini-stats" style={{ marginTop: 0 }}>
                <span>Conversion: {stats.conversion_rate_percent}%</span>
                <span>Waitlist: {stats.waitlist_count}</span>
                <span>Promo used: {stats.promo_booking_count}</span>
                <span>Email opt-in: {stats.marketing_opt_in_rate_percent}%</span>
              </div>
            </div>
          </section>

          <section className="dash-grid-2">
            <div className="admin-card dash-panel">
              <div className="dash-panel__head">
                <h2>How customers heard about you</h2>
              </div>
              {Object.keys(stats.heard_about).length === 0 ? (
                <p className="admin-hint">No survey data yet.</p>
              ) : (
                <HorizontalBars
                  items={Object.entries(stats.heard_about).map(([label, value]) => ({
                    label,
                    value,
                  }))}
                />
              )}
            </div>

            <div className="admin-card dash-panel">
              <div className="dash-panel__head">
                <h2>Promo codes used</h2>
              </div>
              {stats.top_promos.length === 0 ? (
                <p className="admin-hint">No promo usage yet.</p>
              ) : (
                <HorizontalBars
                  items={stats.top_promos.map((p) => ({ label: p.code, value: p.uses }))}
                  formatValue={(n) => `${n}×`}
                />
              )}
            </div>
          </section>

          <section className="admin-card dash-panel dash-panel--table">
            <div className="dash-panel-head">
              <h2>Recent bookings</h2>
              <Link to={`${basePath}/bookings`} className="dash-link">
                View all →
              </Link>
            </div>
            <table className="admin-table dash-recent-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Boat</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong className="dash-ref">{b.reference}</strong>
                      <div className="dash-ref-time">
                        {new Date(b.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td>{b.customer_name}</td>
                    <td>{b.activity_title}</td>
                    <td>{formatMoney(b.total_cents)}</td>
                    <td>
                      <span className={`admin-badge ${statusClass(b.status, b.is_waitlist)}`}>
                        {b.is_waitlist ? "waitlist" : b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.recent_bookings.length === 0 && <p className="admin-hint">No bookings yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
