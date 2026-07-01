import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  fetchConfig,
  refreshBookingCheckout,
  releaseBookingHold,
  type AppConfig,
  type BookingSummary,
} from "../api";
import CheckoutForm from "../components/CheckoutForm";
import HoldCountdown from "../components/HoldCountdown";
import MarketplaceNav from "../components/MarketplaceNav";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRenterAuth } from "../renter/RenterAuth";
import { formatMoney } from "../utils";

export default function BoatRentalPayPage() {
  const { slug, reference } = useParams<{ slug: string; reference: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useRenterAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const holdRef = useRef(reference || null);
  const holdReleasedRef = useRef(false);

  usePageMeta({ title: "Complete payment" });

  useEffect(() => {
    fetchConfig().then(setConfig).catch(() => setError("Could not load payment config"));
  }, []);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    refreshBookingCheckout(reference)
      .then((checkout) => {
        if (cancelled) return;
        holdRef.current = checkout.reference;
        setSummary(checkout);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load checkout");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reference]);

  useEffect(() => {
    const ref = reference;
    if (!ref) return;

    const releaseHold = () => {
      if (holdReleasedRef.current || !holdRef.current) return;
      holdReleasedRef.current = true;
      void releaseBookingHold(holdRef.current);
    };

    const onPageHide = () => releaseHold();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [reference]);

  const stripePromise = useMemo(
    () => (summary?.publishable_key ? loadStripe(summary.publishable_key) : null),
    [summary?.publishable_key]
  );

  if (!isAuthenticated) {
    return <Navigate to={`/boats/${slug}/book`} replace />;
  }

  if (loading) {
    return (
      <div className="mp-page">
        <MarketplaceNav />
        <div className="rental-checkout">
          <p className="rental-section-sub">Loading checkout…</p>
        </div>
      </div>
    );
  }

  if (!reference || !summary?.client_secret) {
    return (
      <div className="mp-page">
        <MarketplaceNav />
        <div className="rental-checkout">
          <p className="instant-book-error">
            {error || "Checkout session not found. Please start booking again."}
          </p>
          <Link to={`/boats/${slug}`} className="boats-btn">
            Back to boat
          </Link>
        </div>
      </div>
    );
  }

  const email = profile.email || "";

  return (
    <div className="mp-page">
      <MarketplaceNav />
      <div className="rental-checkout rental-checkout--pay">
        <nav className="boat-detail-breadcrumb">
          <Link to={`/boats/${slug}`}>Boat</Link>
          <span aria-hidden> / </span>
          <span>Payment</span>
        </nav>

        <div className="rental-checkout-layout">
          <div className="rental-checkout-main">
            <h1>Complete your booking</h1>
            <p className="rental-section-sub">
              Reference <strong>{summary.reference}</strong>
            </p>
            {summary.hold_expires_at && (
              <HoldCountdown expiresAt={summary.hold_expires_at} />
            )}
            {stripePromise && summary.client_secret && (
              <Elements
                key={summary.client_secret}
                stripe={stripePromise}
                options={{ clientSecret: summary.client_secret }}
              >
                <CheckoutForm
                  email={email}
                  reference={summary.reference}
                  onSuccess={(ref) => {
                    holdReleasedRef.current = true;
                    holdRef.current = null;
                    navigate(`/success/${ref}`);
                  }}
                />
              </Elements>
            )}
            {error && <p className="instant-book-error">{error}</p>}
          </div>

          <aside className="rental-checkout-aside">
            <h3>Order total</h3>
            <div className="rental-price-total">
              <span>Due now</span>
              <strong>{formatMoney(summary.total_cents)}</strong>
            </div>
            <div className="rental-price-lines">
              <div>
                <span>Subtotal</span>
                <span>{formatMoney(summary.subtotal_cents)}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>{formatMoney(summary.tax_cents)}</span>
              </div>
            </div>
            {config?.trip_protection_summary && (
              <p className="rental-trip-assurance">{config.trip_protection_summary}</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
