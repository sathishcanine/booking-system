import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoatGridSkeleton from "../components/BoatGridSkeleton";
import HeroSearchBar from "../components/HeroSearchBar";
import HomeAudienceCards from "../components/HomeAudienceCards";
import HomePopularBoatCard from "../components/HomePopularBoatCard";
import MarketplaceNav from "../components/MarketplaceNav";
import { fetchFeaturedBoats, type BoatCard as Boat } from "../api";
import { MARKET_CITY } from "../config/market";
import { usePageMeta } from "../hooks/usePageMeta";

export default function HomePage() {
  usePageMeta({
    title: "Explore St. Petersburg by Boat",
  });

  const [featured, setFeatured] = useState<Boat[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    fetchFeaturedBoats(3)
      .then(setFeatured)
      .catch(() => setFeatured([]))
      .finally(() => setLoadingFeatured(false));
  }, []);

  return (
    <div className="mp-page mp-page--home">
      <section className="alis-hero alis-hero--home">
        <div className="alis-hero-bg alis-hero-bg--home" aria-hidden />
        <div className="alis-hero-inner">
          <MarketplaceNav variant="hero" />
          <div className="alis-hero-content">
            <p className="alis-hero-eyebrow">
              <span className="alis-hero-eyebrow-line" aria-hidden />
              Welcome to AlisAdventure
              <span className="alis-hero-eyebrow-line" aria-hidden />
            </p>
            <h1>
              <span className="alis-hero-title-main">Explore St. Petersburg</span>
              <span className="alis-hero-title-sub">by Boat</span>
            </h1>
            <HeroSearchBar />
          </div>
        </div>
      </section>

      <HomeAudienceCards />

      <section className="home-popular" aria-labelledby="home-popular-heading">
        <div className="home-popular-inner">
          <div className="home-popular-head">
            <h2 id="home-popular-heading">Popular Boats in {MARKET_CITY}</h2>
            <span className="home-popular-accent" aria-hidden />
          </div>

          {loadingFeatured ? (
            <BoatGridSkeleton count={3} />
          ) : featured.length > 0 ? (
            <div className="home-popular-grid">
              {featured.map((boat) => (
                <HomePopularBoatCard key={boat.id} boat={boat} />
              ))}
            </div>
          ) : (
            <p className="home-popular-empty">
              Boats coming soon.{" "}
              <Link to="/boats" className="mp-link">
                Browse all boats
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
