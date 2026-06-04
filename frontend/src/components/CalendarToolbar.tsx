import { monthLabel } from "../utils";

type Props = {
  year: number;
  month: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

export default function CalendarToolbar({
  year,
  month,
  onMonthChange,
  onYearChange,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar-left">
        <button type="button" className="btn-book-online">
          Book online
        </button>
      </div>
      <div className="cal-toolbar-center">
        <select
          className="cal-select"
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          aria-label="Month"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          className="cal-select"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Year"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="cal-toolbar-right">
        <span className="realtime-badge">
          <span className="realtime-dot" aria-hidden />
          Real-time availability
        </span>
        <div className="cal-nav-arrows">
          <button type="button" className="cal-arrow" onClick={onPrev} aria-label="Previous month">
            ‹
          </button>
          <button type="button" className="cal-arrow" onClick={onNext} aria-label="Next month">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
