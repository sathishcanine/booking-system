import { useEffect, useRef, useState } from "react";
import type { SearchFilters } from "./SearchFiltersModal";

type Props = {
  filters: SearchFilters;
  priceMaxDollars: number;
  onChange: (next: SearchFilters) => void;
  onOpenModal: () => void;
};

export default function SearchFilterBar({
  filters,
  priceMaxDollars,
  onChange,
  onOpenModal,
}: Props) {
  const [openMenu, setOpenMenu] = useState<"" | "price" | "duration" | "captain" | "passengers">(
    ""
  );
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="search-filter-bar" ref={barRef}>
      <button type="button" className="search-filter-pill" onClick={onOpenModal}>
        ☰ Filters
      </button>

      <div className="search-filter-pill-wrap">
        <button
          type="button"
          className={`search-filter-pill${openMenu === "price" ? " search-filter-pill--active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "price" ? "" : "price")}
        >
          Price
        </button>
        {openMenu === "price" && (
          <div className="search-filter-popover">
            <p>Price (hourly)</p>
            <p className="search-filter-popover-value">
              ${filters.priceMin} – $
              {filters.priceMax >= priceMaxDollars ? `${priceMaxDollars}+` : filters.priceMax}
            </p>
            <input
              type="range"
              min={1}
              max={priceMaxDollars}
              value={filters.priceMax}
              onChange={(e) =>
                onChange({ ...filters, priceMax: Number(e.target.value) })
              }
            />
          </div>
        )}
      </div>

      <div className="search-filter-pill-wrap">
        <button
          type="button"
          className={`search-filter-pill${openMenu === "duration" ? " search-filter-pill--active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "duration" ? "" : "duration")}
        >
          Duration
        </button>
        {openMenu === "duration" && (
          <div className="search-filter-popover search-filter-popover--chips">
            {[2, 3, 4, 6, 8].map((h) => (
              <button
                key={h}
                type="button"
                className={`search-filter-chip${filters.durationHours === h ? " search-filter-chip--active" : ""}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    durationHours: filters.durationHours === h ? null : h,
                  })
                }
              >
                {h} hours
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="search-filter-pill-wrap">
        <button
          type="button"
          className={`search-filter-pill${openMenu === "captain" ? " search-filter-pill--active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "captain" ? "" : "captain")}
        >
          Captain
        </button>
        {openMenu === "captain" && (
          <div className="search-filter-popover">
            <p className="search-filter-popover-hint">
              Select if you would like a captain or prefer to operate the boat yourself.
            </p>
            <div className="search-filter-popover-btns">
              <button
                type="button"
                className={`search-filter-chip${filters.captain === "captained" ? " search-filter-chip--active" : ""}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    captain: filters.captain === "captained" ? "" : "captained",
                  })
                }
              >
                Captained
              </button>
              <button
                type="button"
                className={`search-filter-chip${filters.captain === "bareboat" ? " search-filter-chip--active" : ""}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    captain: filters.captain === "bareboat" ? "" : "bareboat",
                  })
                }
              >
                No captain
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="search-filter-pill-wrap">
        <button
          type="button"
          className={`search-filter-pill${openMenu === "passengers" ? " search-filter-pill--active" : ""}`}
          onClick={() => setOpenMenu(openMenu === "passengers" ? "" : "passengers")}
        >
          Passengers
        </button>
        {openMenu === "passengers" && (
          <div className="search-filter-popover">
            <div className="search-filter-stepper">
              <span>Passengers</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, passengers: Math.max(1, filters.passengers - 1) })
                }
              >
                −
              </button>
              <span>{filters.passengers}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filters, passengers: Math.min(50, filters.passengers + 1) })
                }
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
