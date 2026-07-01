import { useRef } from "react";
import { Link } from "react-router-dom";
import type { BoatCard as Boat } from "../api";
import BoatCarouselCard from "./BoatCarouselCard";

type Props = {
  title: string;
  boats: Boat[];
  moreHref?: string | null;
  dateHint?: string;
};

export default function BoatCarouselSection({ title, boats, moreHref, dateHint }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    trackRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  }

  if (boats.length === 0) return null;

  return (
    <section className="dest-section">
      <div className="dest-section-head">
        <h2>{title}</h2>
        <div className="dest-section-controls">
          <button
            type="button"
            className="alis-carousel-btn"
            onClick={() => scroll(-1)}
            aria-label={`Previous ${title}`}
          >
            ‹
          </button>
          <button
            type="button"
            className="alis-carousel-btn"
            onClick={() => scroll(1)}
            aria-label={`Next ${title}`}
          >
            ›
          </button>
        </div>
      </div>
      <div className="dest-carousel-track" ref={trackRef}>
        {boats.map((boat) => (
          <BoatCarouselCard key={boat.id} boat={boat} dateHint={dateHint} />
        ))}
      </div>
      {moreHref && (
        <Link to={moreHref} className="dest-more-link">
          More like this →
        </Link>
      )}
    </section>
  );
}
