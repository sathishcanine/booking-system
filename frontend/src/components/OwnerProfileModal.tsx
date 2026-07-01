import { useEffect, useState } from "react";
import { fetchOwnerProfile, type OwnerProfilePage } from "../api";
import { formatDateTime } from "../utils";
import ProfileBoatGrid from "./ProfileBoatGrid";
import ProfileModalShell from "./ProfileModalShell";
import StarRating from "./StarRating";

type Props = {
  open: boolean;
  boatSlug: string;
  onClose: () => void;
};

export default function OwnerProfileModal({ open, boatSlug, onClose }: Props) {
  const [profile, setProfile] = useState<OwnerProfilePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !boatSlug) return;
    setLoading(true);
    setError("");
    fetchOwnerProfile(boatSlug)
      .then(setProfile)
      .catch((e) => {
        setProfile(null);
        setError(e instanceof Error ? e.message : "Could not load profile");
      })
      .finally(() => setLoading(false));
  }, [open, boatSlug]);

  const firstName = profile?.name.split(" ")[0] || "Owner";

  return (
    <ProfileModalShell open={open} onClose={onClose}>
      {loading && <p className="profile-modal-loading">Loading profile…</p>}
      {error && <p className="profile-modal-error">{error}</p>}
      {profile && (
        <div className="profile-modal-content">
          <header className="profile-modal-header-block">
            <span className="profile-modal-avatar profile-modal-avatar--lg" aria-hidden>
              {profile.name.charAt(0)}
            </span>
            <div>
              <h2>{profile.name}</h2>
              {profile.review_count > 0 && profile.rating != null ? (
                <p className="profile-modal-rating-line">
                  <StarRating rating={profile.rating} showValue size="sm" />
                  <span>
                    {profile.review_count} review{profile.review_count === 1 ? "" : "s"}
                  </span>
                </p>
              ) : (
                <p className="profile-modal-rating-line profile-modal-muted">0 reviews</p>
              )}
              {profile.phone_verified && (
                <span className="profile-verified-badge">✓ Phone Verified</span>
              )}
            </div>
          </header>

          <section className="profile-modal-about">
            <h3>About {firstName}</h3>
            <p>{profile.bio}</p>
            {profile.aboard_since_year && (
              <p className="profile-modal-muted">Aboard since {profile.aboard_since_year}</p>
            )}
          </section>

          <ProfileBoatGrid boats={profile.boats} heading={`${firstName}'s Boats`} />

          {profile.reviews.length > 0 && (
            <section className="profile-modal-section">
              <div className="profile-modal-section-head">
                <h3>Reviews of {firstName}</h3>
                <span className="profile-modal-muted">
                  {profile.reviews.length} review{profile.reviews.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="profile-review-list">
                {profile.reviews.map((review) => (
                  <li key={review.id} className="profile-review-card">
                    <header>
                      <strong>{review.reviewer_name}</strong>
                      <span className="profile-review-rating">
                        {review.rating}/5 <StarRating rating={review.rating} size="sm" />
                      </span>
                    </header>
                    <p className="profile-review-boat">{review.boat_title}</p>
                    <time className="profile-modal-muted" dateTime={review.created_at}>
                      {formatDateTime(review.created_at)}
                    </time>
                    {review.body && <p className="profile-review-body">{review.body}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </ProfileModalShell>
  );
}
