import { Link } from "react-router-dom";
import type { BoatCard as Boat } from "../api";
import BoatSaveHeart from "./BoatSaveHeart";
import StarRating from "./StarRating";

function locationLabel(boat: Boat) {
  if (boat.city && boat.state) return `${boat.city}, ${boat.state}`;
  return boat.location_label || boat.marina_name || "";
}

function hourlyPrice(boat: Boat): string {
  const cents = boat.hourly_rate_cents || boat.starting_price_cents;
  if (!cents) return "";
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString()}+/hour`;
}

type Props = {
  boat: Boat;
  dateHint?: string;
};

export default function BoatCarouselCard({ boat, dateHint }: Props) {
  const detailTo = dateHint
    ? `/boats/${boat.slug}?date=${encodeURIComponent(dateHint)}`
    : `/boats/${boat.slug}`;

  const guestLine = [
    boat.max_guests ? `${boat.max_guests} guests` : null,
    boat.captain_required ? "Captained" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <article className="boat-carousel-card">
      <div className="boat-carousel-card-image">
        <Link to={detailTo} className="boat-carousel-card-image-link" aria-label={boat.title}>
          {boat.image_url ? (
            <img src={boat.image_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="boat-carousel-card-fallback" aria-hidden />
          )}
          {boat.emoji && <span className="boat-card-emoji">{boat.emoji}</span>}
        </Link>
        <BoatSaveHeart activityId={boat.id} returnPath={detailTo} />
      </div>
      <Link to={detailTo} className="boat-carousel-card-body">
        <div className="boat-carousel-card-meta">
          <span>{locationLabel(boat)}</span>
          {boat.review_count > 0 && boat.average_rating != null && (
            <StarRating rating={boat.average_rating} showValue size="sm" />
          )}
        </div>
        <h3>{boat.title}</h3>
        {guestLine && <p className="boat-carousel-card-guests">{guestLine}</p>}
        {hourlyPrice(boat) && (
          <p className="boat-carousel-card-price">{hourlyPrice(boat)}</p>
        )}
      </Link>
    </article>
  );
}
