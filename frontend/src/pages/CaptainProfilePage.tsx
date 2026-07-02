import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCaptainBySlug, type CaptainProfilePage as CaptainProfile } from "../api";
import HomeAudienceCards from "../components/HomeAudienceCards";
import MarketplaceNav from "../components/MarketplaceNav";
import StarRating from "../components/StarRating";
import {
  captainExperienceLabel,
  captainLicenseLabels,
  captainSpecializationLabels,
} from "../config/captainProfile";
import { MARKET_CITY } from "../config/market";
import { usePageMeta } from "../hooks/usePageMeta";

const DOSSIER_SECTIONS = [
  { id: "identity", label: "Identity", icon: "👤" },
  { id: "certification", label: "Certification", icon: "⚓" },
  { id: "vessel", label: "Vessel", icon: "🛥" },
  { id: "reviews", label: "Review", icon: "✓" },
] as const;

const AMENITIES = [
  { icon: "🔊", label: "Premium Audio" },
  { icon: "🧊", label: "Cooler & Ice" },
  { icon: "🎣", label: "Fishing Gear" },
  { icon: "☀", label: "Sun Deck" },
];

function formatReviewDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CaptainProfilePage() {
  const { slug = "" } = useParams();
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<string>("identity");

  usePageMeta({
    title: profile ? `${profile.name} — Captain` : "Captain Profile",
  });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError("");
    fetchCaptainBySlug(slug)
      .then(setProfile)
      .catch((e) => {
        setProfile(null);
        setError(e instanceof Error ? e.message : "Could not load profile");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const primaryBoat = profile?.boats[0] ?? null;
  const licenseLabels = profile ? captainLicenseLabels(profile.license_types) : [];
  const experience = profile ? captainExperienceLabel(profile.experience) : null;
  const specializations = profile ? captainSpecializationLabels(profile.specializations) : [];

  return (
    <div className="mp-page mp-page--captain-profile">
      <section className="captains-hero captains-hero--compact">
        <div className="captains-hero-bg" aria-hidden />
        <div className="captains-hero-inner">
          <MarketplaceNav variant="hero" />
          <div className="captains-hero-content">
            <p className="captains-hero-eyebrow">Party · Cruise · Memories</p>
            <h1>Travel with Alis Adventure</h1>
          </div>
        </div>
      </section>

      <div className="captain-profile-shell">
        <header className="captain-profile-intro">
          <h2>Expert Captains of {MARKET_CITY}</h2>
          <p>
            &ldquo;The sea, once it casts its spell, holds one in its net of wonder forever.&rdquo;
            Our curated mariners are the reliable hands that guide your journey safely.
          </p>
        </header>

        {loading && <p className="captains-loading">Loading captain profile…</p>}
        {error && <p className="captains-empty">{error}</p>}

        {profile && (
          <div className="captain-profile-layout">
            <aside className="captain-dossier" aria-label="Captain dossier">
              <p className="captain-dossier-label">Captain&apos;s Dossier</p>
              <p className="captain-dossier-sub">Application Stage</p>
              <nav className="captain-dossier-nav">
                {DOSSIER_SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`captain-dossier-link${
                      activeSection === section.id ? " captain-dossier-link--active" : ""
                    }`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <span aria-hidden>{section.icon}</span>
                    {section.label}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="captain-profile-content">
              <section id="identity" className="captain-profile-section">
                <div className="captain-identity-head">
                  <div className="captain-identity-photo-wrap">
                    {profile.photo_url ? (
                      <img src={profile.photo_url} alt="" className="captain-identity-photo" />
                    ) : (
                      <div className="captain-identity-photo captain-identity-photo--placeholder">
                        {profile.name.charAt(0)}
                      </div>
                    )}
                    <span className="captain-identity-badge">✓ Captain</span>
                  </div>
                  <div>
                    <h3>{profile.name}</h3>
                    <p className="captain-identity-tagline">
                      &ldquo;Guardian of the {profile.location || `${MARKET_CITY} coastlines`}.&rdquo;
                    </p>
                  </div>
                </div>

                <div className="captain-identity-stats">
                  <div>
                    <span>Experience</span>
                    <strong>{experience || "Professional"}</strong>
                  </div>
                  <div>
                    <span>License</span>
                    <strong>{licenseLabels[0] || "USCG Licensed"}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{profile.location || `${MARKET_CITY}, FL`}</strong>
                  </div>
                </div>

                <div className="captain-identity-bio">
                  <p>{profile.bio}</p>
                  {specializations.length > 0 && (
                    <div className="captain-specialization-row">
                      {specializations.map((item) => (
                        <span key={item} className="captain-specialization-pill">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section id="certification" className="captain-profile-section captain-cert-panel">
                <h4>Certifications &amp; Safety Protocols</h4>
                <div className="captain-cert-grid">
                  {licenseLabels.map((label) => (
                    <article key={label} className="captain-cert-card">
                      <span className="captain-cert-icon" aria-hidden>
                        🏅
                      </span>
                      <strong>{label.toUpperCase()}</strong>
                      <p>U.S. Coast Guard Certified Captain</p>
                    </article>
                  ))}
                  {profile.coast_guard_verified && licenseLabels.length === 0 && (
                    <article className="captain-cert-card">
                      <span className="captain-cert-icon" aria-hidden>
                        🏅
                      </span>
                      <strong>USCG VERIFIED</strong>
                      <p>U.S. Coast Guard Certified Captain</p>
                    </article>
                  )}
                  <article className="captain-cert-card">
                    <span className="captain-cert-icon" aria-hidden>
                      🩹
                    </span>
                    <strong>CPR / FIRST AID</strong>
                    <p>American Red Cross Professional Responder</p>
                  </article>
                  <article className="captain-cert-card">
                    <span className="captain-cert-icon" aria-hidden>
                      🛡
                    </span>
                    <strong>DRUG CONSORTIUM</strong>
                    <p>Enrolled &amp; Compliant Member</p>
                  </article>
                </div>
              </section>

              {primaryBoat && (
                <section id="vessel" className="captain-profile-section captain-vessel-panel">
                  <div className="captain-vessel-grid">
                    {primaryBoat.image_url && (
                      <img
                        src={primaryBoat.image_url}
                        alt=""
                        className="captain-vessel-photo"
                      />
                    )}
                    <div>
                      <p className="captain-vessel-label">Primary vessel</p>
                      <h4>{primaryBoat.title}</h4>
                      <p className="captain-vessel-sub">
                        {primaryBoat.hourly_rate_cents != null
                          ? `Hourly from $${Math.round(primaryBoat.hourly_rate_cents / 100)}/hr`
                          : "View vessel for pricing"}
                      </p>
                      <div className="captain-vessel-stats">
                        <div>
                          <span>Capacity</span>
                          <strong>{primaryBoat.max_guests} Passengers</strong>
                        </div>
                        <div>
                          <span>Duration</span>
                          <strong>
                            {primaryBoat.min_rental_hours}–{primaryBoat.max_rental_hours} Hours
                          </strong>
                        </div>
                        {primaryBoat.average_rating != null && (
                          <div>
                            <span>Rating</span>
                            <strong>{primaryBoat.average_rating.toFixed(1)} ★</strong>
                          </div>
                        )}
                        <div>
                          <span>Trips</span>
                          <strong>{profile.trips_completed || "—"}</strong>
                        </div>
                      </div>
                      <Link to={`/boats/${primaryBoat.slug}`} className="captain-vessel-btn">
                        View full vessel details
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              <section className="captain-profile-section captain-amenities-panel">
                <h4>Curated Amenities</h4>
                <div className="captain-amenities-grid">
                  {AMENITIES.map((item) => (
                    <article key={item.label} className="captain-amenity-card">
                      <span aria-hidden>{item.icon}</span>
                      <p>{item.label}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section id="reviews" className="captain-profile-section captain-reviews-panel">
                <div className="captain-reviews-head">
                  <div>
                    <h4>Guest Testimonials</h4>
                    {profile.rating != null && profile.review_count > 0 ? (
                      <p className="captain-reviews-summary">
                        <StarRating rating={profile.rating} showValue size="sm" />
                        <span>({profile.review_count} Reviews)</span>
                      </p>
                    ) : (
                      <p className="captain-reviews-summary">No reviews yet</p>
                    )}
                  </div>
                  <Link to="/boats" className="captain-reviews-write">
                    Write a review
                  </Link>
                </div>

                {profile.reviews.length === 0 ? (
                  <p className="captain-reviews-empty">
                    Be the first to review {profile.name.split(" ").pop()}.
                  </p>
                ) : (
                  <div className="captain-reviews-list">
                    {profile.reviews.map((review) => (
                      <article key={review.id} className="captain-review-card">
                        <div className="captain-review-head">
                          <span className="captain-review-avatar" aria-hidden>
                            {review.reviewer_name.charAt(0)}
                          </span>
                          <div>
                            <strong>{review.reviewer_name}</strong>
                            <p>
                              Verified Renter · {formatReviewDate(review.created_at)}
                            </p>
                          </div>
                          <StarRating rating={review.rating} size="sm" />
                        </div>
                        {review.body && <p>{review.body}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <HomeAudienceCards />
    </div>
  );
}
