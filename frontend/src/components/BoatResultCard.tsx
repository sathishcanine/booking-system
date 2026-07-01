import { Link } from "react-router-dom";
import type { BoatCard as Boat } from "../api";
import BoatSaveHeart from "./BoatSaveHeart";
import StarRating from "./StarRating";

type Props = {
  boat: Boat;
  dateHint?: string;
  captainHint?: "" | "captained" | "bareboat";
};

function locationUpper(boat: Boat) {
  const city = boat.city?.toUpperCase();
  const st = boat.state?.toUpperCase();
  if (city && st) return `${city}, ${st}`;
  return (boat.location_label || "FLORIDA").toUpperCase();
}

function rentalLine(boat: Boat) {
  const min = boat.min_rental_hours || 2;
  const max = boat.max_rental_hours || 8;
  const hours =
    min === max ? `${min} hours rental` : `${min} – ${max} hours rental`;
  const captain =
    boat.captain_required || !boat.bareboat_allowed ? "Captained" : "Captain optional";
  return `${hours} • ${captain}`;
}

function buildDetailUrl(slug: string, dateHint?: string, captainHint?: string) {
  const params = new URLSearchParams();
  if (dateHint) params.set("date", dateHint);
  if (captainHint) params.set("captain", captainHint);
  const q = params.toString();
  return q ? `/boats/${slug}?${q}` : `/boats/${slug}`;
}

export default function BoatResultCard({ boat, dateHint, captainHint }: Props) {
  const detailTo = buildDetailUrl(boat.slug, dateHint, captainHint || undefined);
  const hourly = boat.hourly_rate_cents
    ? `$${Math.round(boat.hourly_rate_cents / 100).toLocaleString()}+/hour`
    : null;
  const photoCount = boat.photo_urls.length || (boat.image_url ? 1 : 0);

  return (
    <article className="boat-result-card">
      <div className="boat-result-card-image-wrap">
        <Link to={detailTo} className="boat-result-card-image-link" aria-label={boat.title}>
          {boat.image_url ? (
            <img src={boat.image_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="boat-result-card-fallback" aria-hidden />
          )}
          {boat.instant_book && (
            <span className="boat-result-badge boat-result-badge--instant">
              ⚡ INSTANT BOOK
            </span>
          )}
          {photoCount > 1 && (
            <span className="boat-result-photo-count">1 / {photoCount}</span>
          )}
          {hourly && <span className="boat-result-price-tag">{hourly}</span>}
        </Link>
        <BoatSaveHeart activityId={boat.id} returnPath={detailTo} />
      </div>
      <div className="boat-result-card-body">
        <div className="boat-result-card-meta">
          <span className="boat-result-location">{locationUpper(boat)}</span>
          {boat.review_count > 0 && boat.average_rating != null && (
            <span className="boat-result-rating">
              <StarRating rating={boat.average_rating} showValue size="sm" />
              <span className="boat-result-bookings">({boat.review_count} bookings)</span>
            </span>
          )}
        </div>
        <h2>
          <Link to={detailTo}>{boat.title}</Link>
        </h2>
        <p className="boat-result-rental-line">{rentalLine(boat)}</p>
      </div>
    </article>
  );
}
