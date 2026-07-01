import { useState } from "react";
import type { BoatCaptainProfile, BoatDetail } from "../api";
import { formatMoney } from "../utils";
import CaptainChangeModal from "./CaptainChangeModal";
import CaptainProfileModal from "./CaptainProfileModal";
import OwnerProfileModal from "./OwnerProfileModal";
import StarRating from "./StarRating";

type Props = {
  boat: BoatDetail;
  captainIncluded: boolean;
  selectedCaptain: BoatCaptainProfile | null;
  onCaptainChange: (captain: BoatCaptainProfile) => void;
};

function tierLabel(tier: string) {
  return tier.replace(/_/g, " ").toUpperCase();
}

export default function BoatCrewSection({
  boat,
  captainIncluded,
  selectedCaptain,
  onCaptainChange,
}: Props) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [ownerProfileOpen, setOwnerProfileOpen] = useState(false);
  const [captainProfileOpen, setCaptainProfileOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<"allowed" | "cancel" | "commercial" | "deposit" | "">(
    "allowed"
  );

  const owner = boat.owner;
  const policies = boat.policies;
  const captainOptions =
    boat.captain_alternatives.length > 0
      ? boat.captain_alternatives
      : boat.default_captain
        ? [boat.default_captain]
        : [];

  const captain = captainIncluded ? selectedCaptain : null;

  return (
    <section className="boat-crew-section">
      <h2 className="boat-crew-heading">Your crew</h2>

      <div className="boat-crew-grid">
        {owner && (
          <article className="boat-crew-card">
            <h3>Boat owner</h3>
            <div className="boat-crew-profile">
              <span className="boat-crew-avatar" aria-hidden>
                {owner.name.charAt(0)}
              </span>
              <div>
                <strong>{owner.name}</strong>
                {owner.rating != null && owner.review_count > 0 && (
                  <p className="boat-crew-rating">
                    <StarRating rating={owner.rating} showValue size="sm" />
                    <span>({owner.review_count} booking{owner.review_count === 1 ? "" : "s"})</span>
                  </p>
                )}
              </div>
            </div>
            <div className="boat-crew-actions">
              <button
                type="button"
                className="boat-crew-link"
                onClick={() => setOwnerProfileOpen(true)}
              >
                See profile
              </button>
              <button type="button" className="boat-crew-btn-outline">
                Message owner
              </button>
            </div>
            <ul className="boat-crew-stats">
              <li>Response rate: {Math.round(owner.response_rate_percent)}%</li>
              <li>Avg. response time: {owner.avg_response_time}</li>
            </ul>
          </article>
        )}

        {captainIncluded && captain && (
          <article className="boat-crew-card">
            <h3>Your captain</h3>
            <div className="boat-crew-profile">
              <span className="boat-crew-avatar boat-crew-avatar--captain" aria-hidden>
                {captain.name.charAt(0)}
              </span>
              <div>
                <strong>{captain.name}</strong>
                {captain.rating != null && (
                  <p className="boat-crew-rating">
                    <StarRating rating={captain.rating} showValue size="sm" />
                    <span>({captain.review_count} bookings)</span>
                  </p>
                )}
              </div>
            </div>
            <div className="boat-crew-actions">
              <button
                type="button"
                className="boat-crew-link"
                onClick={() => setCaptainProfileOpen(true)}
              >
                See profile
              </button>
              {captainOptions.length > 1 && (
                <button
                  type="button"
                  className="boat-crew-link"
                  onClick={() => setChangeOpen(true)}
                >
                  Change captain
                </button>
              )}
            </div>
            <ul className="boat-crew-stats">
              <li>Trips completed: {captain.trips_completed.toLocaleString()}</li>
              {captain.coast_guard_verified && <li>US Coast Guard: Verified</li>}
            </ul>
          </article>
        )}

        {!captainIncluded && boat.bareboat_allowed && (
          <article className="boat-crew-card boat-crew-card--bareboat">
            <h3>Your captain</h3>
            <p className="boat-crew-bareboat-note">
              You&apos;re operating this boat yourself — no captain is included with this booking.
            </p>
          </article>
        )}
      </div>

      {policies && (
        <div className="boat-things-section">
          <h2 className="boat-crew-heading">Things to know</h2>

          <div className="boat-things-accordion">
            <details open={openPanel === "allowed"} onToggle={(e) => e.currentTarget.open && setOpenPanel("allowed")}>
              <summary>Allowed on boat</summary>
              <ul className="boat-allowed-grid">
                {policies.allowed_on_boat.map((item) => (
                  <li
                    key={item.id}
                    className={item.allowed ? "boat-allowed-yes" : "boat-allowed-no"}
                  >
                    <span aria-hidden>{item.allowed ? "✓" : "✕"}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </details>

            <details open={openPanel === "cancel"} onToggle={(e) => e.currentTarget.open && setOpenPanel("cancel")}>
              <summary>
                Cancellation policy
                <span className={`boat-policy-badge boat-policy-badge--${policies.cancellation_tier}`}>
                  {tierLabel(policies.cancellation_tier)}
                </span>
              </summary>
              {policies.cancellation_summary && (
                <p className="boat-things-body">{policies.cancellation_summary}</p>
              )}
            </details>

            {policies.is_commercial_owner && (
              <details
                open={openPanel === "commercial"}
                onToggle={(e) => e.currentTarget.open && setOpenPanel("commercial")}
              >
                <summary>Commercial owner</summary>
                {policies.commercial_owner_summary && (
                  <p className="boat-things-body">{policies.commercial_owner_summary}</p>
                )}
              </details>
            )}

            {policies.security_deposit_cents != null && policies.security_deposit_cents > 0 && (
              <details
                open={openPanel === "deposit"}
                onToggle={(e) => e.currentTarget.open && setOpenPanel("deposit")}
              >
                <summary>Security deposit</summary>
                <p className="boat-things-body">
                  A refundable security deposit of{" "}
                  <strong>{formatMoney(policies.security_deposit_cents)}</strong> may be held on your
                  card until the trip is completed.
                </p>
              </details>
            )}
          </div>
        </div>
      )}

      <CaptainChangeModal
        open={changeOpen}
        captains={captainOptions}
        selectedId={captain?.id || ""}
        onClose={() => setChangeOpen(false)}
        onSelect={onCaptainChange}
      />

      <OwnerProfileModal
        open={ownerProfileOpen}
        boatSlug={boat.slug}
        onClose={() => setOwnerProfileOpen(false)}
      />

      {captain && (
        <CaptainProfileModal
          open={captainProfileOpen}
          boatSlug={boat.slug}
          captainId={captain.id}
          onClose={() => setCaptainProfileOpen(false)}
        />
      )}
    </section>
  );
}
