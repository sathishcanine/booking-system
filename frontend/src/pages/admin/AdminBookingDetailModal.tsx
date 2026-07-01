import { useEffect, useState, type ReactNode } from "react";
import { admin, type AdminBookingDetail } from "../../admin/adminApi";
import AdminModal from "../../admin/AdminModal";
import { formatDateTime, formatMoney } from "../../utils";

type Props = {
  bookingId: number | null;
  open: boolean;
  onClose: () => void;
  onCancel?: (id: number, ref: string) => void;
};

function statusBadge(status: string, waitlist: boolean) {
  if (waitlist) return "admin-badge-waitlist";
  if (status === "paid") return "admin-badge-paid";
  if (status === "pending") return "admin-badge-pending";
  return "admin-badge-cancelled";
}

function cancelledByLabel(value: string | null) {
  if (value === "owner") return "Owner";
  if (value === "admin") return "Super admin";
  if (value === "renter") return "Customer";
  return value || "—";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="admin-booking-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function AdminBookingDetailModal({
  bookingId,
  open,
  onClose,
  onCancel,
}: Props) {
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || bookingId == null) {
      setBooking(null);
      setError("");
      return;
    }
    setLoading(true);
    admin.bookings
      .get(bookingId)
      .then(setBooking)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, bookingId]);

  const isRental = booking?.booking_kind === "rental";
  const canCancel =
    booking &&
    booking.status !== "cancelled" &&
    booking.status !== "expired" &&
    !booking.is_waitlist;

  return (
    <AdminModal
      open={open}
      title={booking ? `Booking ${booking.reference}` : "Booking details"}
      onClose={onClose}
      wide
    >
      {loading && <p className="admin-hint">Loading booking…</p>}
      {error && <p className="admin-error">{error}</p>}
      {booking && !loading && (
        <div className="admin-booking-detail">
          <div className="admin-booking-detail-header">
            <span className={`admin-badge ${statusBadge(booking.status, booking.is_waitlist)}`}>
              {booking.is_waitlist ? "waitlist" : booking.status}
            </span>
            <span className="admin-hint">
              Booked {formatDateTime(booking.created_at)}
            </span>
          </div>

          <section className="admin-booking-detail-section">
            <h3 className="admin-subsection-title">Customer</h3>
            <dl className="admin-booking-detail-grid">
              <DetailRow label="Name" value={booking.customer_name} />
              <DetailRow
                label="Email"
                value={
                  <a href={`mailto:${booking.customer_email}`}>{booking.customer_email}</a>
                }
              />
              <DetailRow label="Phone" value={booking.customer_phone} />
              {booking.marketing_opt_in && (
                <DetailRow label="Marketing" value="Opted in" />
              )}
            </dl>
          </section>

          <section className="admin-booking-detail-section">
            <h3 className="admin-subsection-title">
              {isRental ? "Boat rental" : "Trip"}
            </h3>
            <dl className="admin-booking-detail-grid">
              <DetailRow label="Boat" value={booking.activity_title} />
              {booking.organization_name && (
                <DetailRow label="Host" value={booking.organization_name} />
              )}
              <DetailRow label="Departure" value={formatDateTime(booking.slot_starts_at)} />
              {isRental && booking.duration_hours != null && (
                <DetailRow label="Duration" value={`${booking.duration_hours} hours`} />
              )}
              {isRental && booking.passenger_count != null && (
                <DetailRow label="Passengers" value={String(booking.passenger_count)} />
              )}
              {isRental && (
                <DetailRow
                  label="Captain"
                  value={
                    booking.captain_included
                      ? booking.captain_name
                        ? `Captained — ${booking.captain_name}`
                        : "Captained"
                      : "No captain (self-operated)"
                  }
                />
              )}
              {!isRental &&
                booking.items.map((item) => (
                  <DetailRow
                    key={item.ticket_name}
                    label="Tickets"
                    value={`${item.quantity}× ${item.ticket_name} @ ${formatMoney(item.unit_price_cents)}`}
                  />
                ))}
            </dl>
          </section>

          <section className="admin-booking-detail-section">
            <h3 className="admin-subsection-title">Payment</h3>
            <dl className="admin-booking-detail-grid">
              {isRental && booking.boat_price_cents > 0 && (
                <DetailRow label="Boat price" value={formatMoney(booking.boat_price_cents)} />
              )}
              {booking.captain_price_cents > 0 && (
                <DetailRow
                  label="Captain price"
                  value={formatMoney(booking.captain_price_cents)}
                />
              )}
              {booking.insurance_cents > 0 && (
                <DetailRow label="Insurance" value={formatMoney(booking.insurance_cents)} />
              )}
              {booking.addon_cents > 0 && (
                <DetailRow label="Add-ons" value={formatMoney(booking.addon_cents)} />
              )}
              {!isRental && booking.subtotal_cents > 0 && (
                <DetailRow label="Subtotal" value={formatMoney(booking.subtotal_cents)} />
              )}
              {booking.discount_cents > 0 && (
                <DetailRow
                  label={booking.promo_code ? `Promo (${booking.promo_code})` : "Discount"}
                  value={`−${formatMoney(booking.discount_cents)}`}
                />
              )}
              {booking.tax_cents > 0 && (
                <DetailRow label="Tax" value={formatMoney(booking.tax_cents)} />
              )}
              <DetailRow label="Total charged" value={formatMoney(booking.total_cents)} />
              {booking.platform_fee_cents > 0 && (
                <DetailRow
                  label="Platform fee"
                  value={formatMoney(booking.platform_fee_cents)}
                />
              )}
              {booking.owner_payout_cents > 0 && (
                <DetailRow
                  label="Owner payout"
                  value={formatMoney(booking.owner_payout_cents)}
                />
              )}
            </dl>
          </section>

          {booking.status === "cancelled" && (
            <section className="admin-booking-detail-section">
              <h3 className="admin-subsection-title">Cancellation</h3>
              <dl className="admin-booking-detail-grid">
                <DetailRow
                  label="Cancelled at"
                  value={booking.cancelled_at ? formatDateTime(booking.cancelled_at) : "—"}
                />
                <DetailRow
                  label="Cancelled by"
                  value={cancelledByLabel(booking.cancelled_by)}
                />
                <DetailRow label="Reason" value={booking.cancellation_reason} />
                <DetailRow
                  label="Refund amount"
                  value={
                    booking.refund_cents > 0
                      ? formatMoney(booking.refund_cents)
                      : "No refund (per policy)"
                  }
                />
                {booking.stripe_refund_id && (
                  <DetailRow label="Stripe refund ID" value={booking.stripe_refund_id} />
                )}
              </dl>
            </section>
          )}

          {(booking.comments || booking.heard_about || booking.been_before) && (
            <section className="admin-booking-detail-section">
              <h3 className="admin-subsection-title">Customer notes</h3>
              <dl className="admin-booking-detail-grid">
                <DetailRow label="Been before" value={booking.been_before} />
                <DetailRow label="Heard about us" value={booking.heard_about} />
                <DetailRow label="Comments" value={booking.comments} />
              </dl>
            </section>
          )}

          {canCancel && onCancel && (
            <div className="admin-booking-detail-actions">
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => onCancel(booking.id, booking.reference)}
              >
                Cancel booking
              </button>
            </div>
          )}
        </div>
      )}
    </AdminModal>
  );
}
