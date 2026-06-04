import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createBooking,
  fetchConfig,
  fetchSlot,
  validatePromo,
  type AppConfig,
  type SlotDetail,
} from "../api";
import CheckoutForm from "../components/CheckoutForm";
import OrderSummary from "../components/OrderSummary";
import { formatMoney, formatSlotRange } from "../utils";

type QtyMap = Record<number, number>;

export default function BookingPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const [slot, setSlot] = useState<SlotDetail | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [qty, setQty] = useState<QtyMap>({});
  const [promo, setPromo] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinWaitlist, setJoinWaitlist] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    marketing: false,
    been_before: "",
    heard_about: "",
    comments: "",
    ack_public: false,
    ack_route: false,
  });

  useEffect(() => {
    const id = Number(slotId);
    if (!id) return;
    Promise.all([fetchSlot(id), fetchConfig()])
      .then(([s, c]) => {
        setSlot(s);
        setConfig(c);
        setPublishableKey(c.publishable_key);
        if (s.status === "waitlist") setJoinWaitlist(true);
        const initial: QtyMap = {};
        s.ticket_types.forEach((t) => {
          initial[t.id] = 0;
        });
        setQty(initial);
      })
      .catch(() => setError("This departure is unavailable."));
  }, [slotId]);

  const totalTickets = useMemo(
    () => Object.values(qty).reduce((a, b) => a + b, 0),
    [qty]
  );

  const subtotal = useMemo(() => {
    if (!slot) return 0;
    return slot.ticket_types.reduce(
      (sum, t) => sum + (qty[t.id] || 0) * t.price_cents,
      0
    );
  }, [slot, qty]);

  const tax = useMemo(() => {
    const after = Math.max(0, subtotal - promoDiscount);
    const rate = (config?.tax_rate_percent ?? 13) / 100;
    return Math.round(after * rate);
  }, [subtotal, promoDiscount, config]);

  const total = Math.max(0, subtotal - promoDiscount) + tax;

  const maxSelectable = slot?.max_tickets_per_booking ?? 0;

  function setQuantity(ticketId: number, value: number) {
    if (!slot) return;
    const tt = slot.ticket_types.find((t) => t.id === ticketId);
    const cap = tt?.max_per_booking ?? maxSelectable;
    const next = { ...qty, [ticketId]: Math.min(Math.max(0, value), cap) };
    const newTotal = Object.values(next).reduce((a, b) => a + b, 0);
    if (newTotal > maxSelectable && slot.status !== "waitlist") return;
    setQty(next);
  }

  async function applyPromo() {
    const res = await validatePromo(promo, subtotal);
    if (res.valid) {
      setPromoDiscount(res.discount_cents);
      setPromoMsg(res.message);
    } else {
      setPromoDiscount(0);
      setPromoMsg(res.message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setError("");
    setSubmitting(true);
    try {
      const lines = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([ticket_type_id, quantity]) => ({
          ticket_type_id: Number(ticket_type_id),
          quantity,
        }));

      const summary = await createBooking({
        slot_id: slot.id,
        lines,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone || undefined,
        marketing_opt_in: form.marketing,
        promo_code: promo || undefined,
        heard_about: form.heard_about || undefined,
        been_before: form.been_before || undefined,
        comments: form.comments || undefined,
        ack_public_trip: form.ack_public,
        ack_route: form.ack_route,
        join_waitlist: joinWaitlist,
      });

      if (summary.is_waitlist || !summary.client_secret) {
        navigate(`/success/${summary.reference}?waitlist=1`);
        return;
      }

      setBookingRef(summary.reference);
      setClientSecret(summary.client_secret);
      setPublishableKey(summary.publishable_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  if (error && !slot) return <p className="error">{error}</p>;
  if (!slot) return <p className="loading">Loading…</p>;

  const showPayment = Boolean(clientSecret && stripePromise);

  return (
    <div className="booking-layout">
      <div className="booking-main">
        <section className="tour-hero card">
          {slot.image_url && (
            <img src={slot.image_url} alt="" className="tour-thumb" />
          )}
          <div>
            <h1>{slot.title}</h1>
            <p className="tour-meta">{formatSlotRange(slot.starts_at, slot.ends_at)}</p>
            <p className="tour-desc">
              {slot.description}
              {slot.emoji && ` ${slot.emoji}`}
            </p>
            {slot.status === "low" && (
              <p className="urgency">{slot.spots_left} spots left — book soon!</p>
            )}
            {slot.status === "waitlist" && (
              <p className="urgency waitlist">This trip is full — join the waitlist.</p>
            )}
          </div>
        </section>

        {!showPayment ? (
          <form className="booking-form" onSubmit={onSubmit}>
            <h2>Plan your experience</h2>
            {slot.ticket_types.map((t) => (
              <div className="ticket-row" key={t.id}>
                <select
                  value={qty[t.id] ?? 0}
                  onChange={(e) => setQuantity(t.id, Number(e.target.value))}
                  className="qty-select"
                >
                  {Array.from(
                    { length: (t.max_per_booking ?? maxSelectable) + 1 },
                    (_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    )
                  )}
                </select>
                <div className="ticket-label">
                  <strong>{t.name}</strong>
                  {t.subtitle && <span>{t.subtitle}</span>}
                </div>
                <div className="ticket-price">{formatMoney(t.price_cents)}</div>
              </div>
            ))}

            <h2>Additional information</h2>
            <label className="field">
              Do you have a promo code?
              <div className="promo-row">
                <input
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="SAVE10"
                />
                <button type="button" onClick={applyPromo}>
                  Apply
                </button>
              </div>
              {promoMsg && <small>{promoMsg}</small>}
            </label>

            <label className="field">
              Have you been out with us before?
              <select
                value={form.been_before}
                onChange={(e) => setForm({ ...form, been_before: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="field">
              How did you hear about us?
              <select
                value={form.heard_about}
                onChange={(e) => setForm({ ...form, heard_about: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="google">Google</option>
                <option value="friend">Friend / family</option>
                <option value="social">Social media</option>
                <option value="other">Other</option>
              </select>
            </label>

            {slot.meeting_instructions && (
              <p className="meeting">{slot.meeting_instructions}</p>
            )}

            <label className="field">
              Any additional notes or requests?
              <textarea
                rows={3}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </label>

            <label className="checkbox required">
              <input
                type="checkbox"
                checked={form.ack_public}
                onChange={(e) => setForm({ ...form, ack_public: e.target.checked })}
              />
              <span>
                Public Trip Acknowledgment — I understand this is a shared public cruise.
              </span>
            </label>

            <label className="checkbox required">
              <input
                type="checkbox"
                checked={form.ack_route}
                onChange={(e) => setForm({ ...form, ack_route: e.target.checked })}
              />
              <span>
                Route acknowledgment — I have read the meeting and route details for this trip.
              </span>
            </label>

            <h2>Contact details</h2>
            <label className="field">
              Full name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="field">
              Email address *
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.marketing}
                onChange={(e) => setForm({ ...form, marketing: e.target.checked })}
              />
              <span>Get future email updates about cruises and specials.</span>
            </label>

            {(slot.status === "waitlist" || joinWaitlist) && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={joinWaitlist}
                  onChange={(e) => setJoinWaitlist(e.target.checked)}
                />
                <span>Join waitlist (no charge until a spot opens).</span>
              </label>
            )}

            {error && <p className="error">{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={
                submitting ||
                totalTickets === 0 ||
                !form.ack_public ||
                !form.ack_route
              }
            >
              {submitting ? "Preparing…" : "Continue to payment"}
            </button>
          </form>
        ) : (
          stripePromise &&
          clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm
                email={form.email}
                reference={bookingRef}
                onSuccess={(ref) => navigate(`/success/${ref}`)}
              />
            </Elements>
          )
        )}
      </div>

      <aside className="booking-sidebar">
        <OrderSummary
          slot={slot}
          qty={qty}
          subtotal={subtotal}
          discount={promoDiscount}
          tax={tax}
          total={total}
          taxRate={config?.tax_rate_percent ?? 13}
        />
      </aside>
    </div>
  );
}
