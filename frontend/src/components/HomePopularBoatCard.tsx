import { Link } from "react-router-dom";
import type { BoatCard as Boat } from "../api";
import { BOAT_TYPES } from "../admin/adminApi";
import BoatSaveHeart from "./BoatSaveHeart";
import StarRating from "./StarRating";

function boatTypeLabel(value: string | null) {
  return BOAT_TYPES.find((t) => t.value === value)?.label || value || "Boat";
}

type Props = {
  boat: Boat;
};

export default function HomePopularBoatCard({ boat }: Props) {
  const detailTo = `/boats/${boat.slug}`;
  const hourly = boat.hourly_rate_cents ?? boat.starting_price_cents;

  return (
    <article className="home-boat-card">
      <div className="home-boat-card-media">
        <Link to={detailTo} className="home-boat-card-image-link" aria-label={boat.title}>
          {boat.image_url ? (
            <img src={boat.image_url} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="home-boat-card-image-fallback" aria-hidden />
          )}
        </Link>
        {boat.captain_required && (
          <span className="home-boat-card-badge">Captain included</span>
        )}
        <BoatSaveHeart activityId={boat.id} returnPath={detailTo} />
      </div>

      <div className="home-boat-card-body">
        <div className="home-boat-card-title-row">
          <h3>
            <Link to={detailTo}>{boat.title}</Link>
          </h3>
          {boat.review_count > 0 && boat.average_rating != null && (
            <StarRating rating={boat.average_rating} showValue size="sm" />
          )}
        </div>

        <div className="home-boat-card-specs">
          {boat.max_guests != null && (
            <span className="home-boat-card-spec">
              <span className="home-boat-card-spec-icon" aria-hidden>
                👥
              </span>
              {boat.max_guests} guest
            </span>
          )}
          <span className="home-boat-card-spec">
            <span className="home-boat-card-spec-icon" aria-hidden>
              ⛵
            </span>
            {boatTypeLabel(boat.boat_type)}
          </span>
        </div>

        <div className="home-boat-card-footer">
          {hourly != null && (
            <p className="home-boat-card-price">
              <strong>${Math.round(hourly / 100).toLocaleString()}</strong>
              <span>/hr</span>
            </p>
          )}
          <Link to={detailTo} className="home-boat-card-book">
            Book now
          </Link>
        </div>
      </div>
    </article>
  );
}
