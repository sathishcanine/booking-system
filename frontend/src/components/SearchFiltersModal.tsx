import type { SearchConfig } from "../api";

export type SearchFilters = {
  priceMin: number;
  priceMax: number;
  passengers: number;
  durationHours: number | null;
  captain: "" | "captained" | "bareboat";
  instantBook: boolean;
  lengthMaxFt: number;
  amenity: string;
};

type Props = {
  open: boolean;
  config: SearchConfig;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
};

export default function SearchFiltersModal({
  open,
  config,
  filters,
  onChange,
  onClose,
  onApply,
  onClear,
}: Props) {
  if (!open) return null;

  const priceMaxDollars = Math.round(config.price_max_cents / 100);

  return (
    <div className="search-filters-backdrop" onClick={onClose} role="presentation">
      <div
        className="search-filters-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <h2>Filters</h2>

        <label className="search-filter-row search-filter-toggle">
          <span>⚡ Instant Book</span>
          <input
            type="checkbox"
            checked={filters.instantBook}
            onChange={(e) => onChange({ ...filters, instantBook: e.target.checked })}
          />
        </label>

        <div className="search-filter-block">
          <label>
            Price (hourly) — ${filters.priceMin} – ${filters.priceMax >= priceMaxDollars ? `${priceMaxDollars}+` : filters.priceMax}
          </label>
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

        <div className="search-filter-block">
          <label>Passengers</label>
          <div className="search-filter-stepper">
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

        <div className="search-filter-block">
          <label>Duration</label>
          <div className="search-filter-chips">
            {config.duration_hours.map((h) => (
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
        </div>

        <div className="search-filter-block">
          <label>Captain</label>
          <div className="search-filter-chips">
            {(
              [
                ["captained", "Captained"],
                ["bareboat", "No captain"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`search-filter-chip${filters.captain === value ? " search-filter-chip--active" : ""}`}
                onClick={() =>
                  onChange({
                    ...filters,
                    captain: filters.captain === value ? "" : value,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="search-filter-block">
          <label>Boat length — up to {filters.lengthMaxFt} ft</label>
          <input
            type="range"
            min={20}
            max={config.length_max_ft}
            value={filters.lengthMaxFt}
            onChange={(e) =>
              onChange({ ...filters, lengthMaxFt: Number(e.target.value) })
            }
          />
        </div>

        <div className="search-filter-actions">
          <button type="button" className="search-filter-clear" onClick={onClear}>
            Clear all
          </button>
          <button type="button" className="search-filter-apply" onClick={onApply}>
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
