import { Link } from "react-router-dom";

const OWNER_FEATURES = [
  "Upload boat details",
  "Manage pricing & dates",
  "Direct payouts",
];

const RENTER_FEATURES = [
  "Browse premium boats",
  "Instant online booking",
  "Verified local guides",
];

export default function HomeAudienceCards() {
  return (
    <section className="home-audience" aria-labelledby="home-audience-heading">
      <h2 id="home-audience-heading" className="visually-hidden">
        For boat owners and renters
      </h2>
      <div className="home-audience-grid">
        <article className="home-audience-card home-audience-card--owners">
          <div className="home-audience-card-bg" aria-hidden />
          <div className="home-audience-card-content">
            <h3>Boat Owners</h3>
            <p>
              Turn your boat into a high-earning asset. We handle the logistics while you earn.
            </p>
            <ul className="home-audience-list">
              {OWNER_FEATURES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link to="/owner/register" className="home-audience-btn home-audience-btn--primary">
              List your boat
            </Link>
          </div>
        </article>

        <article className="home-audience-card home-audience-card--renters">
          <div className="home-audience-card-bg" aria-hidden />
          <div className="home-audience-card-content">
            <h3>Renters</h3>
            <p>Find your perfect nautical adventure in St. Pete with just a few clicks.</p>
            <ul className="home-audience-list">
              {RENTER_FEATURES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link to="/boats" className="home-audience-btn home-audience-btn--light">
              Rent a boat
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
