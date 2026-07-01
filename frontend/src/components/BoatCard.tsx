import { Link } from "react-router-dom";
import type { BoatCard as Boat } from "../api";
import { BOAT_TYPES } from "../admin/adminApi";
import { formatMoney } from "../utils";
import BoatSaveHeart from "./BoatSaveHeart";
import StarRating from "./StarRating";

function locationLabel(boat: Boat) {
  if (boat.city && boat.state) return `${boat.city}, ${boat.state}`;
  return boat.location_label || boat.marina_name || "Florida";
}

function boatTypeLabel(value: string | null) {
  return BOAT_TYPES.find((t) => t.value === value)?.label || value || "Boat";
}

type Props = {
  boat: Boat;
  dateHint?: string;
};

export default function BoatCard({ boat, dateHint }: Props) {
  const detailTo = dateHint
    ? `/boats/${boat.slug}?date=${encodeURIComponent(dateHint)}`
    : `/boats/${boat.slug}`;

  return (
    <article className="boat-card">
      <div className="boat-card-image">
        <Link to={detailTo} className="boat-card-image-link" aria-label={boat.title}>
          {boat.image_url ? (
            <img
              src={boat.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="boat-card-img"
            />
          ) : (
            <div className="boat-card-image-fallback" aria-hidden />
          )}
          {boat.emoji && <span className="boat-card-emoji">{boat.emoji}</span>}
          {boat.captain_required && (
            <span className="boat-card-badge">Captain included</span>
          )}
        </Link>
        <BoatSaveHeart activityId={boat.id} returnPath={detailTo} />
      </div>
      <div className="boat-card-body">
        <p className="boat-card-meta">
          {boatTypeLabel(boat.boat_type)}
          {boat.max_guests ? ` · up to ${boat.max_guests} guests` : ""}
        </p>
        <h2>
          <Link to={detailTo}>{boat.title}</Link>
        </h2>
        {boat.review_count > 0 && boat.average_rating != null && (
          <StarRating
            rating={boat.average_rating}
            showValue
            count={boat.review_count}
            size="sm"
          />
        )}
        <p className="boat-card-location">{locationLabel(boat)}</p>
        {boat.organization_name && (
          <p className="boat-card-host">Hosted by {boat.organization_name}</p>
        )}
        {(boat.hourly_rate_cents != null || boat.starting_price_cents != null) && (
          <p className="boat-card-price">
            {boat.hourly_rate_cents != null ? (
              <>
                From <strong>${Math.round(boat.hourly_rate_cents / 100).toLocaleString()}+/hour</strong>
              </>
            ) : (
              <>
                From <strong>{formatMoney(boat.starting_price_cents!)}</strong>
              </>
            )}
          </p>
        )}
        <div className="boat-card-actions">
          <Link to={detailTo} className="boats-btn boats-btn-primary">
            Instant book
          </Link>
        </div>
      </div>
    </article>
  );
}
