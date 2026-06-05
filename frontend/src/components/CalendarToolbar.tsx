import { monthLabel } from "../utils";

type Props = {
  year: number;
  month: number;
  minYear: number;
  minMonth: number;
  canGoPrev: boolean;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function CalendarToolbar({
  year,
  month,
  minYear,
  minMonth,
  canGoPrev,
  onMonthChange,
  onYearChange,
  onPrev,
  onNext,
}: Props) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter(
    (m) => year > minYear || m >= minMonth
  );
  const years = Array.from({ length: 5 }, (_, i) => minYear + i);
  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar-left">
        <span className="realtime-badge">
          <span className="realtime-dot" aria-hidden />
          Real-time availability
        </span>
        <div className="cal-nav-arrows">
          <button
            type="button"
            className="cal-arrow"
            onClick={onPrev}
            disabled={!canGoPrev}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button type="button" className="cal-arrow" onClick={onNext} aria-label="Next month">
            ›
          </button>
        </div>
      </div>
      <div className="cal-toolbar-center">
        <select
          className="cal-select"
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          aria-label="Month"
        >
          {months.map((m) => (
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
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
