import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StarRatingInput } from "../../components/StarRating";
import MarketplaceNav from "../../components/MarketplaceNav";
import { useRenterAuth } from "../../renter/RenterAuth";
import {
  renter,
  type CancellationPreview,
  type RenterBooking,
  type SavedBoat,
} from "../../renter/renterApi";
import { formatDateTime, formatMoney } from "../../utils";

function statusLabel(status: string, waitlist: boolean) {
  if (waitlist) return "Waitlist";
  if (status === "paid") return "Confirmed";
  if (status === "pending") return "Pending payment";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  return status;
}

export default function AccountPage() {
  const { profile, logout } = useRenterAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<RenterBooking[]>([]);
  const [saved, setSaved] = useState<SavedBoat[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trips" | "saved">("trips");
  const [cancelRef, setCancelRef] = useState<string | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancellationPreview | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [reviewRef, setReviewRef] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([renter.bookings(), renter.savedBoats()])
      .then(([b, s]) => {
        setBookings(b);
        setSaved(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCancel(reference: string) {
    setCancelRef(reference);
    setCancelPreview(null);
    setCancelMsg("");
    setCancelLoading(true);
    try {
      const preview = await renter.cancelPreview(reference);
      setCancelPreview(preview);
      if (!preview.can_cancel) {
        setCancelMsg(preview.message || "This booking cannot be cancelled");
      }
    } catch (e) {
      setCancelMsg(e instanceof Error ? e.message : "Could not load cancellation details");
    } finally {
      setCancelLoading(false);
    }
  }

  function closeCancel() {
    setCancelRef(null);
    setCancelPreview(null);
    setCancelMsg("");
  }

  async function confirmCancel() {
    if (!cancelRef) return;
    setCancelLoading(true);
    setCancelMsg("");
    try {
      const result = await renter.cancelBooking(cancelRef);
      setCancelMsg(result.message || "Booking cancelled");
      closeCancel();
      load();
    } catch (e) {
      setCancelMsg(e instanceof Error ? e.message : "Cancellation failed");
    } finally {
      setCancelLoading(false);
    }
  }

  function openReview(reference: string) {
    setReviewRef(reference);
    setReviewRating(5);
    setReviewBody("");
    setReviewMsg("");
  }

  function closeReview() {
    setReviewRef(null);
    setReviewMsg("");
  }

  async function submitReview() {
    if (!reviewRef || reviewRating < 1) return;
    setReviewLoading(true);
    setReviewMsg("");
    try {
      await renter.submitReview(reviewRef, reviewRating, reviewBody.trim() || undefined);
      closeReview();
      load();
    } catch (e) {
      setReviewMsg(e instanceof Error ? e.message : "Could not submit review");
    } finally {
      setReviewLoading(false);
    }
  }

  async function removeSaved(activityId: number) {
    try {
      await renter.unsaveBoat(activityId);
      setSaved((prev) => prev.filter((b) => b.activity_id !== activityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    }
  }

  return (
    <div className="mp-page">
      <MarketplaceNav />
      <div className="account-page">
        <header className="account-header">
          <div>
            <h1>My account</h1>
            <p>
              {profile.name || "Guest"} · {profile.email}
            </p>
          </div>
          <button
            type="button"
            className="boats-btn"
            onClick={() => {
              logout();
              navigate("/boats", { replace: true });
            }}
          >
            Sign out
          </button>
        </header>

        <div className="account-tabs">
          <button
            type="button"
            className={tab === "trips" ? "account-tab account-tab--active" : "account-tab"}
            onClick={() => setTab("trips")}
          >
            My bookings ({bookings.length})
          </button>
          <button
            type="button"
            className={tab === "saved" ? "account-tab account-tab--active" : "account-tab"}
            onClick={() => setTab("saved")}
          >
            Saved boats ({saved.length})
          </button>
        </div>

        {error && <p className="account-error">{error}</p>}
        {loading && <p className="boats-hint">Loading…</p>}

        {!loading && tab === "trips" && (
          <section className="account-section">
            {bookings.length === 0 ? (
              <div className="boats-empty">
                <h2>No bookings yet</h2>
                <p>
                  Book a boat rental and it will appear here — including past bookings on this email.
                </p>
                <Link to="/boats" className="boats-btn boats-btn-primary">
                  Browse boats
                </Link>
              </div>
            ) : (
              <div className="account-trip-list">
                {bookings.map((b) => (
                  <article key={b.reference} className="account-trip-card">
                    <div>
                      <p className="account-trip-meta">
                        {statusLabel(b.status, b.is_waitlist)} · {b.reference}
                        {b.status === "cancelled" && b.refund_cents > 0 && (
                          <> · Refunded {formatMoney(b.refund_cents)}</>
                        )}
                      </p>
                      <h2>
                        <Link to={`/boats/${b.activity_slug}`}>{b.activity_title}</Link>
                      </h2>
                      <p>{formatDateTime(b.slot_starts_at)}</p>
                    </div>
                    <div className="account-trip-side">
                      <strong>{b.is_waitlist ? "Waitlist" : formatMoney(b.total_cents)}</strong>
                      {b.status === "paid" && (
                        <Link to={`/success/${b.reference}`} className="account-link">
                          View confirmation
                        </Link>
                      )}
                      {b.can_cancel && (
                        <button
                          type="button"
                          className="account-cancel-btn"
                          onClick={() => openCancel(b.reference)}
                        >
                          Cancel booking
                        </button>
                      )}
                      {b.can_review && (
                        <button
                          type="button"
                          className="account-review-btn"
                          onClick={() => openReview(b.reference)}
                        >
                          Leave a review
                        </button>
                      )}
                      {b.has_review && (
                        <span className="account-reviewed">Reviewed</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && tab === "saved" && (
          <section className="account-section">
            {saved.length === 0 ? (
              <div className="boats-empty">
                <h2>No saved boats</h2>
                <p>Tap the heart on a boat listing to save it for later.</p>
                <Link to="/boats" className="boats-btn boats-btn-primary">
                  Browse boats
                </Link>
              </div>
            ) : (
              <div className="boats-grid">
                {saved.map((boat) => (
                  <article key={boat.activity_id} className="boat-card">
                    <Link to={`/boats/${boat.slug}`}>
                      <div
                        className="boat-card-image"
                        style={{
                          backgroundImage: boat.image_url
                            ? `url(${boat.image_url})`
                            : "linear-gradient(135deg, #0ea5e9, #0369a1)",
                        }}
                      />
                    </Link>
                    <div className="boat-card-body">
                      <h2>
                        <Link to={`/boats/${boat.slug}`}>{boat.title}</Link>
                      </h2>
                      <p className="boat-card-location">
                        {[boat.city, boat.state].filter(Boolean).join(", ") || "Florida"}
                      </p>
                      {boat.starting_price_cents != null && (
                        <p className="boat-card-price">
                          From <strong>{formatMoney(boat.starting_price_cents)}</strong>
                        </p>
                      )}
                      <div className="boat-card-actions">
                        <button
                          type="button"
                          className="boats-btn"
                          onClick={() => removeSaved(boat.activity_id)}
                        >
                          Remove
                        </button>
                        <Link
                          to={`/boats/${boat.slug}`}
                          className="boats-btn boats-btn-primary"
                        >
                          View boat
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {reviewRef && (
        <div className="cancel-modal-backdrop" onClick={closeReview}>
          <div
            className="cancel-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="review-title"
          >
            <h2 id="review-title">Review your trip</h2>
            <p className="boats-hint">Booking {reviewRef}</p>
            <div className="account-field">
              <label>Your rating</label>
              <StarRatingInput value={reviewRating} onChange={setReviewRating} />
            </div>
            <div className="account-field">
              <label htmlFor="review-body">Comments (optional)</label>
              <textarea
                id="review-body"
                rows={4}
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="How was the captain, boat, and experience?"
                maxLength={2000}
              />
            </div>
            {reviewMsg && <p className="account-error">{reviewMsg}</p>}
            <div className="cancel-modal-actions">
              <button type="button" className="boats-btn" onClick={closeReview}>
                Cancel
              </button>
              <button
                type="button"
                className="boats-btn boats-btn-primary"
                onClick={submitReview}
                disabled={reviewLoading || reviewRating < 1}
              >
                {reviewLoading ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelRef && (
        <div className="cancel-modal-backdrop" onClick={closeCancel}>
          <div
            className="cancel-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="cancel-title"
          >
            <h2 id="cancel-title">Cancel booking {cancelRef}</h2>
            {cancelLoading && !cancelPreview && <p className="boats-hint">Loading…</p>}
            {cancelPreview && (
              <>
                <p className="cancel-modal-policy">{cancelPreview.policy_summary}</p>
                {cancelPreview.can_cancel ? (
                  <p className="cancel-modal-refund">
                    {cancelPreview.refund_cents > 0 ? (
                      <>
                        Estimated refund:{" "}
                        <strong>{formatMoney(cancelPreview.refund_cents)}</strong>
                        {cancelPreview.refund_percent < 100 && (
                          <> ({cancelPreview.refund_percent}% of total)</>
                        )}
                      </>
                    ) : (
                      <>No refund applies for this cancellation.</>
                    )}
                  </p>
                ) : (
                  <p className="account-error">{cancelPreview.message}</p>
                )}
              </>
            )}
            {cancelMsg && <p className="account-error">{cancelMsg}</p>}
            <div className="cancel-modal-actions">
              <button type="button" className="boats-btn" onClick={closeCancel}>
                Keep booking
              </button>
              {cancelPreview?.can_cancel && (
                <button
                  type="button"
                  className="boats-btn boats-btn-danger"
                  onClick={confirmCancel}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? "Cancelling…" : "Confirm cancellation"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
