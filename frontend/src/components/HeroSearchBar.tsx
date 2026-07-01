import { FormEvent, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { boatsSearchPath } from "../api";
import { MARKET_CITY } from "../config/market";
import RentalDatePicker, {
  formatRentalDateLabel,
  type RentalDateValue,
} from "./RentalDatePicker";

const EXPERIENCES = [
  { value: "", label: "Select" },
  { value: "watersports", label: "Watersports" },
  { value: "fishing", label: "Fishing" },
  { value: "sailing", label: "Sailing" },
  { value: "cruising", label: "Cruising" },
  { value: "celebrating", label: "Celebrating" },
];

function stopMouseDown(e: ReactMouseEvent) {
  e.stopPropagation();
}

export default function HeroSearchBar() {
  const navigate = useNavigate();
  const whenRef = useRef<HTMLDivElement>(null);
  const guestsRef = useRef<HTMLDivElement>(null);
  const [dateValue, setDateValue] = useState<RentalDateValue>({ startDate: "" });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [guests, setGuests] = useState<number | null>(null);
  const [guestDraft, setGuestDraft] = useState(1);
  const [experience, setExperience] = useState("");

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (whenRef.current && !whenRef.current.contains(target)) {
        setCalendarOpen(false);
      }
      if (guestsRef.current && !guestsRef.current.contains(target)) {
        setGuestsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setCalendarOpen(false);
    setGuestsOpen(false);
    navigate(
      boatsSearchPath(
        {
          category: experience || undefined,
          guests: guests || undefined,
        },
        dateValue.startDate ? { start: dateValue.startDate } : undefined
      )
    );
  }

  function openGuestsPopover() {
    setGuestDraft(guests ?? 1);
    setGuestsOpen(true);
    setCalendarOpen(false);
  }

  function closeGuestsPopover(apply: boolean) {
    if (apply) {
      setGuests(guestDraft);
    }
    setGuestsOpen(false);
  }

  const guestLabel = guests ? `${guests} guest${guests === 1 ? "" : "s"}` : "Add guests";

  return (
    <form className="alis-hero-search alis-hero-search--full" onSubmit={onSubmit} role="search">
      <div className="alis-hero-search-fields">
        <div className="alis-hero-search-segment alis-hero-search-segment--location">
          <span className="alis-hero-search-label">Location</span>
          <span className="alis-hero-search-static">{MARKET_CITY}</span>
        </div>

        <div className="alis-hero-search-segment alis-hero-search-segment--dates" ref={whenRef}>
          <span className="alis-hero-search-label">Dates</span>
          <button
            type="button"
            className="alis-hero-search-trigger"
            onClick={() => {
              setCalendarOpen((o) => !o);
              setGuestsOpen(false);
            }}
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
          >
            <span>{formatRentalDateLabel(dateValue)}</span>
            <span className="alis-hero-search-trigger-icon" aria-hidden>
              📅
            </span>
          </button>
          {calendarOpen && (
            <div onMouseDown={stopMouseDown}>
              <RentalDatePicker
                monthCount={1}
                value={dateValue}
                onApply={(next) => {
                  setDateValue(next);
                  setCalendarOpen(false);
                }}
                onCancel={() => setCalendarOpen(false)}
              />
            </div>
          )}
        </div>

        <div className="alis-hero-search-segment alis-hero-search-segment--guests" ref={guestsRef}>
          <span className="alis-hero-search-label">Passengers</span>
          <button
            type="button"
            className="alis-hero-search-trigger"
            onClick={() => {
              if (guestsOpen) {
                closeGuestsPopover(true);
              } else {
                openGuestsPopover();
              }
            }}
            aria-expanded={guestsOpen}
            aria-haspopup="dialog"
          >
            <span>{guestLabel}</span>
            <span className="alis-hero-search-trigger-icon" aria-hidden>
              +
            </span>
          </button>
          {guestsOpen && (
            <div
              className="alis-hero-search-popover alis-hero-search-popover--guests"
              onMouseDown={stopMouseDown}
              role="dialog"
              aria-label="Choose number of guests"
            >
              <div className="alis-hero-guests-row">
                <div className="alis-hero-guests-copy">
                  <p className="alis-hero-guests-label">Guests</p>
                  <p className="alis-hero-guests-hint">Including children</p>
                </div>
                <div className="alis-hero-guests-stepper">
                  <button
                    type="button"
                    className="alis-hero-guests-step"
                    aria-label="Decrease guests"
                    disabled={guestDraft <= 1}
                    onClick={() => setGuestDraft((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span className="alis-hero-guests-count" aria-live="polite">
                    {guestDraft}
                  </span>
                  <button
                    type="button"
                    className="alis-hero-guests-step"
                    aria-label="Increase guests"
                    disabled={guestDraft >= 50}
                    onClick={() => setGuestDraft((n) => Math.min(50, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="alis-hero-guests-done"
                onClick={() => closeGuestsPopover(true)}
              >
                Done
              </button>
            </div>
          )}
        </div>

        <div className="alis-hero-search-segment alis-hero-search-segment--experience">
          <span className="alis-hero-search-label">Experience</span>
          <div className="alis-hero-search-select-wrap">
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              onFocus={() => {
                setCalendarOpen(false);
                setGuestsOpen(false);
              }}
              aria-label="Experience type"
              className="alis-hero-search-select"
            >
              {EXPERIENCES.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="alis-hero-search-select-caret" aria-hidden>
              ▾
            </span>
          </div>
        </div>
      </div>

      <button type="submit" className="alis-hero-search-btn alis-hero-search-btn--gold">
        <span className="alis-hero-search-btn-icon" aria-hidden>
          🔍
        </span>
        Search
      </button>
    </form>
  );
}
