import { useEffect, useState } from "react";
import { admin, type AdminBooking } from "../../admin/adminApi";
import AdminBookingDetailModal from "./AdminBookingDetailModal";
import { formatMoney } from "../../utils";

const STATUS_OPTIONS = ["", "paid", "pending", "cancelled", "expired", "waitlist"];

function statusBadge(status: string, waitlist: boolean) {
  if (waitlist) return "admin-badge-waitlist";
  if (status === "paid") return "admin-badge-paid";
  if (status === "pending") return "admin-badge-pending";
  return "admin-badge-cancelled";
}

export default function AdminBookingsPage() {
  const [list, setList] = useState<AdminBooking[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);

  function load() {
    admin.bookings
      .list(status ? { status: status === "waitlist" ? undefined : status } : undefined)
      .then((rows) => {
        if (status === "waitlist") setList(rows.filter((b) => b.is_waitlist));
        else setList(rows);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [status]);

  async function cancelBooking(id: number, ref: string) {
    if (!confirm(`Cancel booking ${ref}?`)) return;
    const fullRefund = confirm(
      `Issue a full refund (weather or owner cancellation)?\n\n` +
        `OK = Full refund to customer\n` +
        `Cancel = Apply standard cancellation policy`
    );
    const reason = fullRefund
      ? "Weather or owner cancellation"
      : prompt("Optional reason for cancellation:", "") || undefined;
    try {
      const result = await admin.bookings.cancel(id, {
        full_refund: fullRefund,
        reason,
      });
      setError("");
      setViewId(null);
      alert(result.message || `Booking ${ref} cancelled`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Bookings</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        <div className="admin-field" style={{ maxWidth: 220 }}>
          <label>Filter by status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Boat</th>
              <th>Details</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.reference}</strong>
                  <div style={{ fontSize: "0.8rem", color: "#5c6570" }}>
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </td>
                <td>
                  {b.customer_name}
                  <br />
                  <a href={`mailto:${b.customer_email}`}>{b.customer_email}</a>
                  {b.customer_phone && <div>{b.customer_phone}</div>}
                </td>
                <td>
                  <strong>{b.activity_title}</strong>
                  <div style={{ fontSize: "0.85rem" }}>
                    {new Date(b.slot_starts_at).toLocaleString()}
                  </div>
                </td>
                <td>
                  {b.items.length > 0 ? (
                    b.items.map((i) => (
                      <div key={i.ticket_name}>
                        {i.quantity}× {i.ticket_name}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: "#5c6570" }}>Boat rental</span>
                  )}
                </td>
                <td>{formatMoney(b.total_cents)}</td>
                <td>
                  <span className={`admin-badge ${statusBadge(b.status, b.is_waitlist)}`}>
                    {b.is_waitlist ? "waitlist" : b.status}
                  </span>
                  {b.status === "cancelled" && b.refund_cents > 0 && (
                    <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                      Refunded {formatMoney(b.refund_cents)}
                    </div>
                  )}
                </td>
                <td>
                  <div className="admin-table-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => setViewId(b.id)}
                    >
                      View
                    </button>
                    {b.status !== "cancelled" && b.status !== "expired" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => cancelBooking(b.id, b.reference)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="admin-hint">No bookings found.</p>}
      </section>

      <AdminBookingDetailModal
        bookingId={viewId}
        open={viewId != null}
        onClose={() => setViewId(null)}
        onCancel={cancelBooking}
      />
    </>
  );
}
