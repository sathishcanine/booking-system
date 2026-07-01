import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  fetchBoat,
  fetchBoatReviews,
  type BoatCaptainProfile,
  type BoatDetail,
  type BoatReview,
  type CaptainPref,
} from "../api";
import { BOAT_TYPES } from "../admin/adminApi";
import BoatCrewSection from "../components/BoatCrewSection";
import MarketplaceNav from "../components/MarketplaceNav";
import BoatInstantBookWidget from "../components/BoatInstantBookWidget";
import StarRating from "../components/StarRating";
import { useRenterAuth } from "../renter/RenterAuth";
import { renter } from "../renter/renterApi";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatDateTime } from "../utils";
import { resolveCaptainSelection } from "../utils/captain";

function boatTypeLabel(value: string | null) {
  return BOAT_TYPES.find((t) => t.value === value)?.label || value || "Boat";
}

export default function BoatDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateHint = searchParams.get("date") || undefined;
  const captainPref = (searchParams.get("captain") as CaptainPref | null) || undefined;
  const { isAuthenticated } = useRenterAuth();
  const [boat, setBoat] = useState<BoatDetail | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [reviews, setReviews] = useState<BoatReview[]>([]);
  const [captainIncluded, setCaptainIncluded] = useState(false);
  const [selectedCaptain, setSelectedCaptain] = useState<BoatCaptainProfile | null>(null);

  const captainState = useMemo(
    () => (boat ? resolveCaptainSelection(boat, captainPref) : null),
    [boat, captainPref]
  );

  useEffect(() => {
    if (!boat || !captainState) return;
    setCaptainIncluded(captainState.captainIncluded);
    setSelectedCaptain(boat.default_captain);
  }, [boat, captainState]);

  const locationLine = boat
    ? [boat.city, boat.state].filter(Boolean).join(", ") || boat.location_label
    : "";
  usePageMeta({
    title: boat?.title,
    description: boat
      ? `${boat.title}${locationLine ? ` in ${locationLine}` : ""} — book online with real-time availability and secure checkout.`
      : undefined,
  });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    Promise.all([fetchBoat(slug), fetchBoatReviews(slug)])
      .then(([b, revs]) => {
        setBoat(b);
        setReviews(revs);
        setActivePhoto(0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated || !boat) return;
    renter
      .savedBoats()
      .then((list) => setIsSaved(list.some((b) => b.activity_id === boat.id)))
      .catch(() => {});
  }, [isAuthenticated, boat]);

  async function toggleSave() {
    if (!boat) return;
    if (!isAuthenticated) {
      navigate("/account/login", { state: { from: `/boats/${slug}` } });
      return;
    }
    setSaveBusy(true);
    try {
      if (isSaved) {
        await renter.unsaveBoat(boat.id);
        setIsSaved(false);
      } else {
        await renter.saveBoat(boat.id);
        setIsSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update saved boat");
    } finally {
      setSaveBusy(false);
    }
  }

  const photos =
    boat && boat.photo_urls.length > 0
      ? boat.photo_urls
      : boat?.image_url
        ? [boat.image_url]
        : [];

  return (
    <div className="mp-page">
      <MarketplaceNav />
      <div className="boat-detail">
        {loading && <p className="boats-hint">Loading boat…</p>}
        {error && (
          <div className="boats-empty">
            <h2>Boat not found</h2>
            <p>{error}</p>
            <Link to="/boats" className="boats-btn">
              Browse all boats
            </Link>
          </div>
        )}
        {boat && (
          <>
            <nav className="boat-detail-breadcrumb">
              <Link to="/boats">Boats</Link>
              <span aria-hidden> / </span>
              <span>{boat.title}</span>
            </nav>

            <div className="boat-detail-gallery">
              <div
                className="boat-detail-hero-img"
                style={{
                  backgroundImage: photos[activePhoto]
                    ? `url(${photos[activePhoto]})`
                    : "linear-gradient(135deg, #0ea5e9, #0369a1)",
                }}
              >
                {boat.emoji && <span className="boat-card-emoji">{boat.emoji}</span>}
              </div>
              {photos.length > 1 && (
                <div className="boat-detail-thumbs">
                  {photos.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      className={`boat-detail-thumb${i === activePhoto ? " boat-detail-thumb--active" : ""}`}
                      style={{ backgroundImage: `url(${url})` }}
                      onClick={() => setActivePhoto(i)}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="boat-detail-layout">
              <div className="boat-detail-main">
                <p className="boat-card-meta">
                  {boatTypeLabel(boat.boat_type)}
                  {boat.max_guests ? ` · up to ${boat.max_guests} guests` : ""}
                  {boat.captain_required ? " · Captain included" : ""}
                </p>
                <div className="boat-detail-title-row">
                  <h1>{boat.title}</h1>
                  <button
                    type="button"
                    className={`boat-save-btn${isSaved ? " boat-save-btn--saved" : ""}`}
                    onClick={toggleSave}
                    disabled={saveBusy}
                    aria-pressed={isSaved}
                  >
                    {isSaved ? "♥ Saved" : "♡ Save"}
                  </button>
                </div>
                <p className="boat-detail-location">
                  {[boat.marina_name, boat.city, boat.state].filter(Boolean).join(" · ") ||
                    boat.location_label}
                </p>
                {boat.organization_name && (
                  <p className="boat-card-host">Hosted by {boat.organization_name}</p>
                )}
                {boat.review_count > 0 && boat.average_rating != null && (
                  <div className="boat-detail-rating">
                    <StarRating
                      rating={boat.average_rating}
                      showValue
                      count={boat.review_count}
                    />
                  </div>
                )}
                <div className="boat-detail-specs">
                  {boat.length_ft != null && (
                    <div className="boat-detail-spec">
                      <span className="boat-detail-spec-label">Boat length</span>
                      <span>{boat.length_ft} ft</span>
                    </div>
                  )}
                  {boat.max_guests != null && (
                    <div className="boat-detail-spec">
                      <span className="boat-detail-spec-label">Passengers</span>
                      <span>Up to {boat.max_guests}</span>
                    </div>
                  )}
                  <div className="boat-detail-spec">
                    <span className="boat-detail-spec-label">Captained</span>
                    <span>
                      {boat.captain_required
                        ? "This boat is rented with a captain"
                        : captainIncluded
                          ? "Captain included with this booking"
                          : boat.bareboat_allowed
                            ? "Self-operated (no captain)"
                            : "Captain optional"}
                    </span>
                  </div>
                </div>
                {boat.description && (
                  <div className="boat-detail-section">
                    <h2>About this experience</h2>
                    <p className="boat-detail-desc">{boat.description}</p>
                  </div>
                )}
                {boat.amenities.length > 0 && (
                  <div className="boat-detail-section">
                    <h2>Amenities</h2>
                    <ul className="boat-detail-amenities">
                      {boat.amenities.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {boat.meeting_instructions && (
                  <div className="boat-detail-section">
                    <h2>Meeting point</h2>
                    <p className="boat-detail-desc">{boat.meeting_instructions}</p>
                  </div>
                )}
              </div>

              <aside className="boat-detail-aside">
                {captainState && (
                  <BoatInstantBookWidget
                    boat={boat}
                    dateHint={dateHint}
                    captainIncluded={captainIncluded}
                    onCaptainIncludedChange={setCaptainIncluded}
                    captainedDisabled={captainState.captainedDisabled}
                    bareboatDisabled={captainState.bareboatDisabled}
                    showCaptainToggle={captainState.showToggle}
                    captainSlug={selectedCaptain?.id}
                  />
                )}
              </aside>
            </div>

            {captainState && (
              <BoatCrewSection
                boat={boat}
                captainIncluded={captainIncluded || boat.captain_required}
                selectedCaptain={selectedCaptain}
                onCaptainChange={setSelectedCaptain}
              />
            )}

            {reviews.length > 0 && (
              <section className="boat-detail-section boat-detail-reviews">
                <h2>Reviews</h2>
                <div className="review-list">
                  {reviews.map((r) => (
                    <article key={r.id} className="review-card">
                      <header className="review-card-header">
                        <StarRating rating={r.rating} size="sm" />
                        <strong>{r.reviewer_name}</strong>
                        <span className="review-card-date">
                          {formatDateTime(r.created_at)}
                        </span>
                      </header>
                      {r.body && <p className="review-card-body">{r.body}</p>}
                      {r.owner_response && (
                        <div className="review-owner-response">
                          <strong>Owner response</strong>
                          <p>{r.owner_response}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
