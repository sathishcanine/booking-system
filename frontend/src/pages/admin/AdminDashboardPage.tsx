import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin, type AdminDashboard } from "../../admin/adminApi";
import { formatMoney, formatTime } from "../../utils";

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
  const showLabels = days.length <= 14;

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
                  className="dash-bar dash-bar--revenue"
                  style={{ height: `${Math.max(h, d.revenue_cents > 0 ? 4 : 0)}%` }}
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
  return (
    <article className={`dash-kpi dash-kpi--${accent || "blue"}`}>
      <span className="dash-kpi-label">{label}</span>
      <strong className="dash-kpi-value">{value}</strong>
      {sub && <span className="dash-kpi-sub">{sub}</span>}
    </article>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    admin
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updated = stats ? new Date(stats.generated_at).toLocaleString() : "";
  const peakRevenue = stats
    ? Math.max(...stats.revenue_by_day.map((d) => d.revenue_cents))
    : 0;

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Analytics dashboard</h1>
          {updated && (
            <p className="admin-hint" style={{ margin: "0.25rem 0 0" }}>
              Updated {updated}
            </p>
          )}
        </div>
        <div className="admin-actions" style={{ margin: 0 }}>
          <button type="button" className="admin-btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/admin/slots" className="admin-btn admin-btn-primary">
            + Add departure
          </Link>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {loading && !stats && <p className="admin-hint">Loading analytics…</p>}

      {stats && (
        <>
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
              label="Tickets sold"
              value={String(stats.tickets_sold)}
              sub={`Avg order ${formatMoney(stats.average_order_cents)}`}
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
              label="Waitlist"
              value={String(stats.waitlist_count)}
              sub={`${stats.waitlist_departures} full departures`}
            />
            <KpiCard
              accent="orange"
              label="Upcoming fill rate"
              value={`${stats.upcoming_fill_rate_percent}%`}
              sub={`${stats.upcoming_spots_remaining} spots left of ${stats.upcoming_capacity}`}
            />
          </section>

          <section className="dash-grid-2">
            <div className="admin-card dash-panel">
              <h2>Revenue — last 30 days</h2>
              <RevenueChart days={stats.revenue_by_day} />
              <p className="dash-panel-foot">Peak day: {formatMoney(peakRevenue)}</p>
            </div>

            <div className="admin-card dash-panel">
              <h2>Bookings by status</h2>
              <div className="dash-donut-legend">
                {stats.bookings_by_status.map((s) => (
                  <div className="dash-legend-row" key={s.status}>
                    <span className={`admin-badge ${statusClass(s.status, false)}`}>{s.status}</span>
                    <strong>{s.count}</strong>
                  </div>
                ))}
              </div>
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
              <h2>Top tours (revenue)</h2>
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
              <h2>Top ticket types</h2>
              {stats.top_ticket_types.length === 0 ? (
                <p className="admin-hint">No ticket sales yet.</p>
              ) : (
                <HorizontalBars
                  items={stats.top_ticket_types.map((t) => ({
                    label: t.name,
                    value: t.quantity_sold,
                  }))}
                  formatValue={(n) => `${n} sold`}
                />
              )}
            </div>
          </section>

          <section className="dash-grid-2">
            <div className="admin-card dash-panel">
              <h2>How customers heard about you</h2>
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
              <h2>Promo codes used</h2>
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

          <section className="dash-grid-2">
            <div className="admin-card dash-panel">
              <h2>Schedule health</h2>
              <div className="dash-health-grid">
                <div>
                  <strong>{stats.upcoming_departure_count}</strong>
                  <span>Upcoming departures</span>
                </div>
                <div>
                  <strong>{stats.low_stock_departures}</strong>
                  <span>Low stock (≤8 left)</span>
                </div>
                <div>
                  <strong>{stats.call_to_book_departures}</strong>
                  <span>Call to book</span>
                </div>
                <div>
                  <strong>{stats.activity_count}</strong>
                  <span>Active tours</span>
                </div>
                <div>
                  <strong>{stats.upcoming_held_seats}</strong>
                  <span>Seats on hold (checkout)</span>
                </div>
                <div>
                  <strong>{stats.upcoming_booked}</strong>
                  <span>Seats confirmed</span>
                </div>
              </div>
              <Link to="/admin/slots" className="admin-btn admin-btn-sm" style={{ marginTop: "1rem" }}>
                Manage departures →
              </Link>
            </div>

            <div className="admin-card dash-panel">
              <h2>Next departures</h2>
              <table className="admin-table dash-compact-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Tour</th>
                    <th>Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcoming_departures.map((s) => (
                    <tr key={s.slot_id}>
                      <td>
                        {new Date(s.starts_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {formatTime(s.starts_at)}
                      </td>
                      <td>
                        {s.activity_title}
                        {s.is_call_to_book && (
                          <span className="admin-badge admin-badge-pending"> Call</span>
                        )}
                      </td>
                      <td>
                        <div className="dash-fill-cell">
                          <div className="dash-fill-bar">
                            <span style={{ width: `${s.fill_percent}%` }} />
                          </div>
                          <small>{s.spots_left} left</small>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card dash-panel">
            <div className="dash-panel-head">
              <h2 style={{ margin: 0 }}>Recent bookings</h2>
              <Link to="/admin/bookings">View all →</Link>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Trip</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.reference}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#5c6570" }}>
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
    </>
  );
}
