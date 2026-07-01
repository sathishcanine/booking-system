import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRentalQuote, type BoatDetail, type RentalQuote } from "../api";
import { formatMoney } from "../utils";
import RentalDatePicker, {
  formatRentalDateLabel,
  type RentalDateValue,
} from "./RentalDatePicker";

const DURATIONS = [2, 3, 4, 6, 8];

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 5; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function formatTimeLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

type Props = {
  boat: BoatDetail;
  dateHint?: string;
  captainIncluded: boolean;
  onCaptainIncludedChange: (value: boolean) => void;
  captainedDisabled: boolean;
  bareboatDisabled: boolean;
  showCaptainToggle: boolean;
  captainSlug?: string;
};

export default function BoatInstantBookWidget({
  boat,
  dateHint,
  captainIncluded,
  onCaptainIncludedChange,
  captainedDisabled,
  bareboatDisabled,
  showCaptainToggle,
  captainSlug,
}: Props) {
  const navigate = useNavigate();
  const whenRef = useRef<HTMLDivElement>(null);
  const [dateValue, setDateValue] = useState<RentalDateValue>(() => ({
    startDate: dateHint || defaultDate(),
  }));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const rentalDate = dateValue.startDate;
  const [durationHours, setDurationHours] = useState(boat.min_rental_hours || 2);
  const [startTime, setStartTime] = useState("06:30");
  const [showTimes, setShowTimes] = useState(false);
  const [passengers, setPassengers] = useState(Math.min(4, boat.max_guests || 4));
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);

  const maxGuests = boat.max_guests || 12;
  const hourly = boat.hourly_rate_cents || 35000;
  const effectiveCaptain = boat.captain_required || captainIncluded;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (whenRef.current && !whenRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setLoadingQuote(true);
    setQuoteError("");
    fetchRentalQuote(boat.slug, {
      duration_hours: durationHours,
      passengers,
      captain: effectiveCaptain,
    })
      .then(setQuote)
      .catch((e) => {
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "Could not load price");
      })
      .finally(() => setLoadingQuote(false));
  }, [boat.slug, durationHours, passengers, effectiveCaptain]);

  const headlinePrice = useMemo(() => {
    if (quote) return quote.boat_price_cents + quote.captain_price_cents;
    return (
      hourly * durationHours +
      (effectiveCaptain ? Math.round(hourly * durationHours * 0.2) : 0)
    );
  }, [quote, hourly, durationHours, effectiveCaptain]);

  function instantBook() {
    navigate(`/boats/${boat.slug}/book`, {
      state: {
        rentalDate,
        startTime,
        durationHours,
        passengerCount: passengers,
        captainIncluded: effectiveCaptain,
        captainSlug: effectiveCaptain ? captainSlug : undefined,
      },
    });
  }

  const durationOptions = DURATIONS.filter(
    (h) => h >= (boat.min_rental_hours || 2) && h <= (boat.max_rental_hours || 8)
  );

  return (
    <div className="instant-book-widget">
      <div className="instant-book-price">
        <strong>{formatMoney(headlinePrice)}</strong>
        <span> / {durationHours} hr (excl. fees)</span>
      </div>

      <div className="instant-book-field boat-search-field--when" ref={whenRef}>
        <span>Date</span>
        <button
          type="button"
          className="rental-date-trigger"
          onClick={() => setCalendarOpen((o) => !o)}
        >
          <span className="rental-date-trigger-icon" aria-hidden>
            📅
          </span>
          <span>{formatRentalDateLabel(dateValue)}</span>
        </button>
        {calendarOpen && (
          <RentalDatePicker
            value={dateValue}
            priceFromCents={boat.hourly_rate_cents}
            onApply={(next) => {
              setDateValue(next);
              setCalendarOpen(false);
            }}
            onCancel={() => setCalendarOpen(false)}
          />
        )}
      </div>

      <label className="instant-book-field">
        <span>Duration</span>
        <select
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
        >
          {(durationOptions.length ? durationOptions : DURATIONS).map((h) => (
            <option key={h} value={h}>
              {h} hours
            </option>
          ))}
        </select>
      </label>

      <div className="instant-book-field">
        <span>Start time</span>
        <button
          type="button"
          className="instant-book-time-trigger"
          onClick={() => setShowTimes((v) => !v)}
        >
          {formatTimeLabel(startTime)}
        </button>
        {showTimes && (
          <div className="instant-book-times">
            {TIME_SLOTS.map((t) => (
              <button
                key={t}
                type="button"
                className={`instant-book-time${t === startTime ? " instant-book-time--active" : ""}`}
                onClick={() => {
                  setStartTime(t);
                  setShowTimes(false);
                }}
              >
                {formatTimeLabel(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCaptainToggle && (
        <div className="instant-book-captain">
          <button
            type="button"
            className={
              effectiveCaptain
                ? "instant-book-pill instant-book-pill--active"
                : "instant-book-pill"
            }
            disabled={captainedDisabled}
            onClick={() => onCaptainIncludedChange(true)}
          >
            Captained
          </button>
          <button
            type="button"
            className={
              !effectiveCaptain
                ? "instant-book-pill instant-book-pill--active"
                : "instant-book-pill"
            }
            disabled={bareboatDisabled}
            onClick={() => onCaptainIncludedChange(false)}
          >
            No captain
          </button>
        </div>
      )}

      <div className="instant-book-passengers">
        <button
          type="button"
          aria-label="Fewer passengers"
          disabled={passengers <= 1}
          onClick={() => setPassengers((n) => Math.max(1, n - 1))}
        >
          −
        </button>
        <span>
          {passengers} passenger{passengers === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          aria-label="More passengers"
          disabled={passengers >= maxGuests}
          onClick={() => setPassengers((n) => Math.min(maxGuests, n + 1))}
        >
          +
        </button>
      </div>

      {quote && (
        <div className="instant-book-breakdown">
          <div>
            <span>Boat price</span>
            <span>{formatMoney(quote.boat_price_cents)}</span>
          </div>
          {quote.captain_price_cents > 0 && (
            <div>
              <span>Captain price</span>
              <span>{formatMoney(quote.captain_price_cents)}</span>
            </div>
          )}
          <div className="instant-book-breakdown-total">
            <span>Booking total</span>
            <span>{formatMoney(quote.subtotal_cents)}</span>
          </div>
        </div>
      )}
      {quoteError && <p className="instant-book-error">{quoteError}</p>}

      <button
        type="button"
        className="instant-book-cta"
        onClick={instantBook}
        disabled={loadingQuote || !rentalDate || !startTime}
      >
        <span aria-hidden>⚡</span> INSTANT BOOK
      </button>
      <p className="instant-book-note">You won&apos;t be charged yet.</p>
    </div>
  );
}
