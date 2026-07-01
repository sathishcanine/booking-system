import { Link } from "react-router-dom";
import type { ProfileBoat } from "../api";
import StarRating from "./StarRating";

type Props = {
  boats: ProfileBoat[];
  heading: string;
};

function priceLine(boat: ProfileBoat) {
  const rate = boat.hourly_rate_cents
    ? `$${Math.round(boat.hourly_rate_cents / 100).toLocaleString()}+/hour`
    : null;
  const hours =
    boat.min_rental_hours === boat.max_rental_hours
      ? `${boat.min_rental_hours} hr`
      : `${boat.min_rental_hours}–${boat.max_rental_hours} hr`;
  const guests = boat.max_guests ? `1–${boat.max_guests} passengers` : null;
  return [rate, hours, guests].filter(Boolean).join(" • ");
}

export default function ProfileBoatGrid({ boats, heading }: Props) {
  if (boats.length === 0) return null;

  return (
    <section className="profile-modal-section">
      <h3>{heading}</h3>
      <div className="profile-boat-grid">
        {boats.map((boat) => (
          <article key={boat.slug} className="profile-boat-card">
            <Link to={`/boats/${boat.slug}`} className="profile-boat-card-image">
              {boat.image_url ? (
                <img src={boat.image_url} alt="" loading="lazy" />
              ) : (
                <div className="profile-boat-card-fallback" aria-hidden />
              )}
              {boat.photo_count > 1 && (
                <span className="profile-boat-photo-count">{boat.photo_count} Photos</span>
              )}
            </Link>
            <div className="profile-boat-card-body">
              <h4>
                <Link to={`/boats/${boat.slug}`}>{boat.title}</Link>
              </h4>
              <p className="profile-boat-meta">{priceLine(boat)}</p>
              {boat.review_count > 0 && boat.average_rating != null && (
                <StarRating rating={boat.average_rating} showValue size="sm" />
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
