import { useEffect, useState } from "react";
import { fetchCaptainProfile, type CaptainProfilePage } from "../api";
import ProfileBoatGrid from "./ProfileBoatGrid";
import ProfileModalShell from "./ProfileModalShell";
import StarRating from "./StarRating";

type Props = {
  open: boolean;
  boatSlug: string;
  captainId: string;
  onClose: () => void;
};

export default function CaptainProfileModal({ open, boatSlug, captainId, onClose }: Props) {
  const [profile, setProfile] = useState<CaptainProfilePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !boatSlug || !captainId) return;
    setLoading(true);
    setError("");
    fetchCaptainProfile(boatSlug, captainId)
      .then(setProfile)
      .catch((e) => {
        setProfile(null);
        setError(e instanceof Error ? e.message : "Could not load profile");
      })
      .finally(() => setLoading(false));
  }, [open, boatSlug, captainId]);

  const firstName = profile?.name.split(" ")[0] || "Captain";

  return (
    <ProfileModalShell open={open} onClose={onClose}>
      {loading && <p className="profile-modal-loading">Loading profile…</p>}
      {error && <p className="profile-modal-error">{error}</p>}
      {profile && (
        <div className="profile-modal-content">
          <header className="profile-modal-header-block">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt=""
                className="profile-modal-avatar profile-modal-avatar--lg profile-modal-avatar--photo"
              />
            ) : (
              <span className="profile-modal-avatar profile-modal-avatar--lg" aria-hidden>
                {profile.name.charAt(0)}
              </span>
            )}
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
              <div className="profile-verified-row">
                {profile.phone_verified && (
                  <span className="profile-verified-badge">✓ Phone Verified</span>
                )}
                {profile.coast_guard_verified && (
                  <span className="profile-verified-badge">✓ USCG Verified</span>
                )}
              </div>
            </div>
          </header>

          <section className="profile-modal-about">
            <h3>About {firstName}</h3>
            <p>{profile.bio}</p>
            <div className="profile-modal-about-meta">
              {profile.aboard_since_year && (
                <p className="profile-modal-muted">Aboard since {profile.aboard_since_year}</p>
              )}
              {profile.location && (
                <p className="profile-modal-muted">From {profile.location}</p>
              )}
            </div>
          </section>

          <ProfileBoatGrid
            boats={profile.boats}
            heading={`${firstName}'s Captained Boats`}
          />
        </div>
      )}
    </ProfileModalShell>
  );
}
