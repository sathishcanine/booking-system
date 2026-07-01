import { useRef } from "react";
import { Link } from "react-router-dom";
import type { Destination } from "../api";

type Props = {
  destinations: Destination[];
};

export default function DestinationCarousel({ destinations }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  if (destinations.length === 0) return null;

  return (
    <section className="alis-destinations">
      <div className="alis-section-inner">
        <div className="alis-destinations-head">
          <div>
            <h2>Explore destinations by boat</h2>
            <p>Book a private boat rental, just about anywhere.</p>
          </div>
          <div className="alis-carousel-controls">
            <button
              type="button"
              className="alis-carousel-btn"
              onClick={() => scroll(-1)}
              aria-label="Previous destinations"
            >
              ‹
            </button>
            <button
              type="button"
              className="alis-carousel-btn"
              onClick={() => scroll(1)}
              aria-label="Next destinations"
            >
              ›
            </button>
          </div>
        </div>
        <div className="alis-carousel-track" ref={trackRef}>
          {destinations.map((d) => (
            <Link
              key={`${d.city}-${d.state || ""}`}
              to={`/boats?city=${encodeURIComponent(d.city)}${d.state ? `&state=${encodeURIComponent(d.state)}` : ""}`}
              className="alis-destination-card"
            >
              <div
                className="alis-destination-image"
                style={{
                  backgroundImage: d.image_url
                    ? `url(${d.image_url})`
                    : "linear-gradient(135deg, #0ea5e9, #1a438d)",
                }}
              />
              <strong>{d.city}</strong>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
