import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createBooking,
  fetchConfig,
  fetchSlot,
  releaseBookingHold,
  validatePromo,
  type AppConfig,
  type SlotDetail,
} from "../api";
import CheckoutForm from "../components/CheckoutForm";
import HoldCountdown from "../components/HoldCountdown";
import OrderSummary from "../components/OrderSummary";
import { showToast } from "../toast";
import { formatDateTime, formatMoney, formatSlotRange } from "../utils";

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
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdSecondsRemaining, setHoldSecondsRemaining] = useState(0);
  const [checkoutActive, setCheckoutActive] = useState(false);
  const checkoutSessionRef = useRef(0);
  const activeHoldRef = useRef<string | null>(null);

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

  const releaseActiveHold = useCallback(() => {
    const ref = activeHoldRef.current;
    if (!ref) return;
    activeHoldRef.current = null;
    void releaseBookingHold(ref).catch(() => {
      /* best-effort — hold also expires server-side */
    });
  }, []);

  const resetCheckout = useCallback(() => {
    releaseActiveHold();
    setClientSecret(null);
    setHoldExpiresAt(null);
    setHoldSecondsRemaining(0);
    setBookingRef("");
    setCheckoutActive(false);
    checkoutSessionRef.current += 1;
  }, [releaseActiveHold]);

  useEffect(() => {
    return () => {
      releaseActiveHold();
    };
  }, [releaseActiveHold]);

  useEffect(() => {
    const id = Number(slotId);
    if (!id) return;
    resetCheckout();
    setError("");
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
  }, [slotId, resetCheckout]);

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
  const isWaitlistTrip = slot?.status === "waitlist";
  const isBookingClosed = slot?.booking_closed ?? false;

  function maxForTicket(ticketId: number): number {
    if (!slot || isWaitlistTrip) return 20;
    const tt = slot.ticket_types.find((t) => t.id === ticketId);
    const otherTotal = totalTickets - (qty[ticketId] ?? 0);
    const remainingForBooking = Math.max(0, maxSelectable - otherTotal);
    const perType = tt?.max_per_booking ?? remainingForBooking;
    return Math.max(0, Math.min(perType, remainingForBooking));
  }

  function setQuantity(ticketId: number, value: number) {
    if (!slot) return;
    const cap = maxForTicket(ticketId);
    const next = { ...qty, [ticketId]: Math.min(Math.max(0, value), cap) };
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
        activeHoldRef.current = null;
        navigate(`/success/${summary.reference}?waitlist=1`);
        return;
      }

      if (!summary.hold_expires_at || summary.hold_seconds_remaining <= 0) {
        throw new Error("Could not reserve seats in time. Please try again.");
      }

      checkoutSessionRef.current += 1;
      activeHoldRef.current = summary.reference;
      setBookingRef(summary.reference);
      setClientSecret(summary.client_secret);
      setPublishableKey(summary.publishable_key);
      setHoldExpiresAt(summary.hold_expires_at);
      setHoldSecondsRemaining(summary.hold_seconds_remaining);
      setCheckoutActive(true);
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

  const handleHoldExpired = useCallback(() => {
    activeHoldRef.current = null;
    setClientSecret(null);
    setHoldExpiresAt(null);
    setHoldSecondsRemaining(0);
    setBookingRef("");
    setCheckoutActive(false);
    checkoutSessionRef.current += 1;
    showToast(
      "Your seat hold expired. Please choose your trip again on the calendar to reserve seats."
    );
    navigate("/", { replace: true });
  }, [navigate]);

  const onCheckoutHoldExpired = useCallback(() => {
    if (!checkoutActive) return;
    handleHoldExpired();
  }, [checkoutActive, handleHoldExpired]);

  if (error && !slot) return <p className="error">{error}</p>;
  if (!slot) return <p className="loading">Loading…</p>;

  const showPayment = Boolean(
    checkoutActive &&
      clientSecret &&
      stripePromise &&
      holdExpiresAt &&
      holdSecondsRemaining > 0
  );

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
            {isBookingClosed ? (
              <p className="urgency booking-closed">
                Online booking is closed for this departure.
                {slot.booking_cutoff_hours > 0 ? (
                  <>
                    {" "}
                    Book at least {slot.booking_cutoff_hours}{" "}
                    {slot.booking_cutoff_hours === 1 ? "hour" : "hours"} before sail time
                    (deadline was {formatDateTime(slot.booking_deadline)}).
                  </>
                ) : (
                  <> This departure has already started or ended.</>
                )}
              </p>
            ) : isWaitlistTrip ? (
              <p className="urgency waitlist">This trip is full — join the waitlist.</p>
            ) : slot.spots_left > 0 ? (
              <p className={`urgency${slot.status === "low" ? "" : " availability"}`}>
                {slot.spots_left} {slot.spots_left === 1 ? "spot" : "spots"} left
                {slot.status === "low" ? " — book soon!" : ""}
              </p>
            ) : null}
          </div>
        </section>

        {isBookingClosed && !showPayment ? (
          <section className="booking-form card">
            <p className="error" style={{ margin: 0 }}>
              This departure is not available for online booking. Choose another time on the
              calendar or call us to inquire.
            </p>
          </section>
        ) : null}

        {!showPayment && !isBookingClosed ? (
          <form className="booking-form" onSubmit={onSubmit}>
            <h2>Plan your experience</h2>
            {!isWaitlistTrip && maxSelectable > 0 && (
              <p className="ticket-cap-hint">
                You can book up to {maxSelectable}{" "}
                {maxSelectable === 1 ? "seat" : "seats"} on this departure
                {totalTickets > 0 && (
                  <>
                    {" "}
                    ({maxSelectable - totalTickets} remaining in this order)
                  </>
                )}
                .
              </p>
            )}
            {slot.ticket_types.map((t) => (
              <div className="ticket-row" key={t.id}>
                <select
                  value={qty[t.id] ?? 0}
                  onChange={(e) => setQuantity(t.id, Number(e.target.value))}
                  className="qty-select"
                >
                  {Array.from({ length: maxForTicket(t.id) + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
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
          clientSecret &&
          holdExpiresAt && (
            <>
              <HoldCountdown
                key={checkoutSessionRef.current}
                expiresAt={holdExpiresAt}
                initialSeconds={holdSecondsRemaining}
                onExpired={onCheckoutHoldExpired}
              />
              <button
                type="button"
                className="btn-text edit-booking-btn"
                onClick={() => resetCheckout()}
              >
                ← Edit booking
              </button>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  email={form.email}
                  reference={bookingRef}
                  onSuccess={(ref) => {
                    activeHoldRef.current = null;
                    navigate(`/success/${ref}`);
                  }}
                />
              </Elements>
            </>
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
          holdExpiresAt={showPayment ? holdExpiresAt : null}
          holdSecondsRemaining={showPayment ? holdSecondsRemaining : undefined}
        />
      </aside>
    </div>
  );
}
