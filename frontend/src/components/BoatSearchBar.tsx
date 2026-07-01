import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { boatsSearchPath } from "../api";
import { BOAT_TYPES } from "../admin/adminApi";
import { MARKET_CITY, MARKET_LABEL, MARKET_STATE } from "../config/market";
import RentalDatePicker, {
  formatRentalDateLabel,
  type RentalDateValue,
} from "./RentalDatePicker";

type Props = {
  variant?: "hero" | "inline";
  initial?: {
    city?: string;
    state?: string;
    boat_type?: string;
    date?: string;
  };
  priceFromCents?: number | null;
};

function initialDateValue(initial?: Props["initial"]): RentalDateValue {
  return { startDate: initial?.date || "" };
}

export default function BoatSearchBar({ variant = "hero", initial, priceFromCents }: Props) {
  const navigate = useNavigate();
  const whenRef = useRef<HTMLDivElement>(null);
  const [boatType, setBoatType] = useState(initial?.boat_type || "");
  const [dateValue, setDateValue] = useState<RentalDateValue>(() => initialDateValue(initial));
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (whenRef.current && !whenRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(
      boatsSearchPath(
        {
          city: MARKET_CITY,
          state: MARKET_STATE,
          boat_type: boatType || undefined,
        },
        dateValue.startDate ? { start: dateValue.startDate } : undefined
      )
    );
  }

  return (
    <form
      className={`boat-search boat-search--${variant}`}
      onSubmit={onSubmit}
      role="search"
      aria-label="Search boats"
    >
      <div className="boat-search-field boat-search-field--static">
        <label>Location</label>
        <p className="boat-search-static-location" aria-label="Location">
          {MARKET_LABEL}
        </p>
      </div>
      <div className="boat-search-field boat-search-field--when" ref={whenRef}>
        <label htmlFor="search-date-trigger">When</label>
        <button
          id="search-date-trigger"
          type="button"
          className="rental-date-trigger"
          onClick={() => setCalendarOpen((o) => !o)}
          aria-expanded={calendarOpen}
        >
          <span className="rental-date-trigger-icon" aria-hidden>
            📅
          </span>
          <span>{formatRentalDateLabel(dateValue)}</span>
          <span className="rental-date-trigger-caret" aria-hidden>
            {calendarOpen ? "▴" : "▾"}
          </span>
        </button>
        {calendarOpen && (
          <RentalDatePicker
            value={dateValue}
            priceFromCents={priceFromCents}
            onApply={(next) => {
              setDateValue(next);
              setCalendarOpen(false);
            }}
            onCancel={() => setCalendarOpen(false)}
          />
        )}
      </div>
      {variant === "hero" && (
        <div className="boat-search-field">
          <label htmlFor="search-type">Boat type</label>
          <select
            id="search-type"
            value={boatType}
            onChange={(e) => setBoatType(e.target.value)}
          >
            <option value="">Any type</option>
            {BOAT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="boat-search-field boat-search-field--action">
        <span className="boat-search-label-spacer" aria-hidden="true">
          Search
        </span>
        <button type="submit" className="boat-search-submit">
          Search boats
        </button>
      </div>
    </form>
  );
}
