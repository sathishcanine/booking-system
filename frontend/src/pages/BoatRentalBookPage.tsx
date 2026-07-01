import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { createRental, fetchBoat, fetchRentalQuote, type BoatDetail, type RentalQuote } from "../api";
import GoogleSignInButton from "../components/GoogleSignInButton";
import MarketplaceNav from "../components/MarketplaceNav";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRenterAuth } from "../renter/RenterAuth";
import { getRenterToken, renterGoogleLogin } from "../renter/renterApi";
import { formatMoney } from "../utils";

export type RentalDraft = {
  rentalDate: string;
  startTime: string;
  durationHours: number;
  passengerCount: number;
  captainIncluded: boolean;
  captainSlug?: string;
};

export default function BoatRentalBookPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const draft = location.state as RentalDraft | null;
  const { isAuthenticated, refresh, profile } = useRenterAuth();

  const [boat, setBoat] = useState<BoatDetail | null>(null);
  const [insurance, setInsurance] = useState(true);
  const [waterScooter, setWaterScooter] = useState(false);
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  usePageMeta({ title: boat ? `Book ${boat.title}` : "Book your trip" });

  useEffect(() => {
    if (!slug) return;
    fetchBoat(slug).then(setBoat).catch(() => setError("Boat not found"));
  }, [slug]);

  useEffect(() => {
    if (!slug || !draft) return;
    fetchRentalQuote(slug, {
      duration_hours: draft.durationHours,
      passengers: draft.passengerCount,
      captain: draft.captainIncluded,
      insurance,
      water_scooter: waterScooter,
    })
      .then(setQuote)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load pricing"));
  }, [slug, draft, insurance, waterScooter]);

  if (!draft || !slug) {
    return <Navigate to={`/boats/${slug || ""}`} replace />;
  }

  async function handleGoogle(credential: string) {
    setAuthError("");
    try {
      await renterGoogleLogin(credential);
      refresh();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Google sign-in failed");
    }
  }

  async function handleContinue(e: FormEvent) {
    e.preventDefault();
    if (!draft || !slug) return;
    if (!getRenterToken()) {
      refresh();
      setAuthError("Your session expired. Please sign in with Google again.");
      return;
    }
    setSubmitting(true);
    setError("");
    setAuthError("");
    try {
      const summary = await createRental({
        activity_slug: slug,
        rental_date: draft.rentalDate,
        start_time: draft.startTime,
        duration_hours: draft.durationHours,
        passenger_count: draft.passengerCount,
        captain_included: draft.captainIncluded,
        captain_slug: draft.captainIncluded ? draft.captainSlug : undefined,
        insurance_selected: insurance,
        water_scooter_addon: waterScooter,
      });
      navigate(`/boats/${slug}/pay/${summary.reference}`, {
        state: { summary, email: profile.email },
        replace: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start checkout";
      if (message.toLowerCase().includes("sign in")) {
        refresh();
        setAuthError(message);
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const addonsTotal = (quote?.insurance_cents || 0) + (quote?.addon_cents || 0);

  return (
    <div className="mp-page">
      <MarketplaceNav />
      <div className="rental-checkout">
        <nav className="boat-detail-breadcrumb">
          <Link to={`/boats/${slug}`}>{boat?.title || "Boat"}</Link>
          <span aria-hidden> / </span>
          <span>Add-ons &amp; insurance</span>
        </nav>

        <div className="rental-checkout-layout">
          <form className="rental-checkout-main" onSubmit={handleContinue}>
            {!isAuthenticated && (
              <section className="rental-auth-gate">
                <h2>Sign in to book</h2>
                <p>Use your Google account to reserve this boat. You&apos;ll pay on the next step.</p>
                <GoogleSignInButton onSuccess={handleGoogle} onError={setAuthError} />
              </section>
            )}

            {isAuthenticated && (
              <p className="rental-signed-in">
                Signed in as <strong>{profile.name || profile.email}</strong>
              </p>
            )}

            <section className="rental-section">
              <h2>Add-ons</h2>
              <p className="rental-section-sub">Want more? Enhance your trip.</p>
              <label className="rental-option">
                <input
                  type="checkbox"
                  checked={waterScooter}
                  onChange={(e) => setWaterScooter(e.target.checked)}
                />
                <span>
                  <strong>Water scooter</strong>
                  <small>Jet-ski available — {formatMoney(17000)} per booking</small>
                </span>
              </label>
            </section>

            <section className="rental-section">
              <h2>Renter&apos;s insurance</h2>
              <p className="rental-section-sub">
                Optional coverage for your trip duration.
              </p>
              <label className="rental-option rental-option--radio">
                <input
                  type="radio"
                  name="insurance"
                  checked={insurance}
                  onChange={() => setInsurance(true)}
                />
                <span>
                  <strong>Yes</strong> — est. {formatMoney(16986)}
                  <small>Up to $1,000,000 liability coverage per occurrence</small>
                </span>
              </label>
              <label className="rental-option rental-option--radio">
                <input
                  type="radio"
                  name="insurance"
                  checked={!insurance}
                  onChange={() => setInsurance(false)}
                />
                <span>
                  <strong>No, I will take the risk</strong>
                </span>
              </label>
            </section>

            {authError && <p className="instant-book-error">{authError}</p>}
            {error && <p className="instant-book-error">{error}</p>}

            <div className="rental-checkout-actions">
              <button
                type="submit"
                className="instant-book-cta"
                disabled={submitting || !isAuthenticated}
              >
                {submitting ? "Starting checkout…" : "ADD & CONTINUE"}
              </button>
              {addonsTotal > 0 && (
                <span className="rental-addons-total">Add-ons total {formatMoney(addonsTotal)}</span>
              )}
            </div>
          </form>

          <aside className="rental-checkout-aside">
            <h3>Pricing information</h3>
            {quote ? (
              <>
                <div className="rental-price-lines">
                  <div>
                    <span>Boat price</span>
                    <span>{formatMoney(quote.boat_price_cents)}</span>
                  </div>
                  {quote.captain_price_cents > 0 && (
                    <div>
                      <span>Captain price</span>
                      <span>{formatMoney(quote.captain_price_cents)}</span>
                    </div>
                  )}
                  {quote.insurance_cents > 0 && (
                    <div>
                      <span>Renter&apos;s insurance</span>
                      <span>{formatMoney(quote.insurance_cents)}</span>
                    </div>
                  )}
                  {quote.addon_cents > 0 && (
                    <div>
                      <span>Add-ons</span>
                      <span>{formatMoney(quote.addon_cents)}</span>
                    </div>
                  )}
                </div>
                <div className="rental-price-total">
                  <span>Booking total</span>
                  <strong>{formatMoney(quote.subtotal_cents)}</strong>
                </div>
                <p className="rental-price-note">Taxes and fees at checkout.</p>
              </>
            ) : (
              <p className="boats-hint">Loading prices…</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
