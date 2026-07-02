import { Link } from "react-router-dom";
import type { CaptainListItem } from "../api";
import {
  captainExperienceLabel,
  captainLicenseLabels,
} from "../config/captainProfile";
import StarRating from "./StarRating";

type Props = {
  captain: CaptainListItem;
};

function primaryLicense(captain: CaptainListItem): string {
  const labels = captainLicenseLabels(captain.license_types);
  if (labels.length > 0) return labels[0].toUpperCase();
  if (captain.coast_guard_verified) return "USCG LICENSED";
  return "LICENSED CAPTAIN";
}

export default function CaptainCard({ captain }: Props) {
  const experience = captainExperienceLabel(captain.experience);

  return (
    <article className="captain-card">
      <div className="captain-card-photo-wrap">
        {captain.photo_url ? (
          <img src={captain.photo_url} alt="" className="captain-card-photo" />
        ) : (
          <div className="captain-card-photo captain-card-photo--placeholder" aria-hidden>
            {captain.name.charAt(0)}
          </div>
        )}
        {captain.coast_guard_verified && (
          <span className="captain-card-verified">Verified</span>
        )}
      </div>

      <div className="captain-card-body">
        <div className="captain-card-head">
          <div>
            <h3 className="captain-card-name">{captain.name}</h3>
            <p className="captain-card-license">{primaryLicense(captain)}</p>
          </div>
          {captain.rating != null && captain.review_count > 0 ? (
            <StarRating rating={captain.rating} showValue size="sm" />
          ) : (
            <span className="captain-card-rating-new">New</span>
          )}
        </div>

        <p className="captain-card-bio">
          {captain.bio ||
            `${captain.name} is a professional captain serving ${captain.location || "St. Petersburg"}.`}
        </p>

        <div className="captain-card-foot">
          <div>
            <span className="captain-card-meta-label">Experience</span>
            <strong>{experience || "Professional"}</strong>
          </div>
          <Link to={`/captains/${captain.slug}`} className="captain-card-btn">
            View profile
          </Link>
        </div>
      </div>
    </article>
  );
}
