import { useCallback, useEffect, useState } from "react";
import { fetchCalendarMonth, type CalendarCell, type CalendarMonth } from "../api";
import CalendarToolbar from "./CalendarToolbar";
import SlotCard from "./SlotCard";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const VISIBLE_SLOTS = 3;

function useMonthNav(initial = new Date()) {
  const now = new Date();
  const minYear = now.getFullYear();
  const minMonth = now.getMonth() + 1;

  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);

  const clampMonthYear = (y: number, m: number) => {
    if (y < minYear || (y === minYear && m < minMonth)) {
      return { year: minYear, month: minMonth };
    }
    return { year: y, month: m };
  };

  const setYearClamped = (y: number) => {
    const next = clampMonthYear(y, month);
    setYear(next.year);
    setMonth(next.month);
  };

  const setMonthClamped = (m: number) => {
    const next = clampMonthYear(year, m);
    setYear(next.year);
    setMonth(next.month);
  };

  const canGoPrev = year > minYear || (year === minYear && month > minMonth);

  const goPrev = () => {
    if (!canGoPrev) return;
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };

  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  return {
    year,
    month,
    minYear,
    minMonth,
    canGoPrev,
    setYear: setYearClamped,
    setMonth: setMonthClamped,
    goPrev,
    goNext,
  };
}

function DayCell({
  cell,
  expanded,
  onToggleExpand,
}: {
  cell: CalendarCell;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const dayNum = new Date(cell.date + "T12:00:00").getDate();
  const slots = cell.is_past ? [] : cell.slots;
  const visible = expanded ? slots : slots.slice(0, VISIBLE_SLOTS);
  const hidden = slots.length - VISIBLE_SLOTS;

  return (
    <div
      className={[
        "month-cell",
        !cell.in_month && "month-cell--outside",
        cell.is_past && cell.in_month && "month-cell--past",
        cell.is_today && "month-cell--today",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {cell.in_month && (
        <span className={`month-date${cell.is_today ? " month-date--today" : ""}`}>
          {dayNum}
        </span>
      )}
      {cell.in_month && (
        <div className="month-slots">
          {visible.map((slot) => (
            <SlotCard key={slot.id} slot={slot} compact />
          ))}
          {!expanded && hidden > 0 && (
            <button type="button" className="show-more" onClick={onToggleExpand}>
              Show {hidden} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  activityId?: number;
  heading?: string;
  initialDate?: string;
  compactToolbar?: boolean;
};

export default function MonthCalendar({
  activityId,
  heading,
  initialDate,
  compactToolbar,
}: Props) {
  const start = initialDate ? new Date(initialDate + "T12:00:00") : new Date();
  const nav = useMonthNav(start);
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCalendarMonth(nav.year, nav.month, activityId)
      .then((m) => {
        setData(m);
        setExpanded({});
      })
      .catch(() => setError("Could not load schedule. Is the API running?"))
      .finally(() => setLoading(false));
  }, [nav.year, nav.month, activityId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`month-calendar-block${compactToolbar ? " month-calendar-block--compact" : ""}`}>
      {heading && <h2 className="month-calendar-heading">{heading}</h2>}
      <CalendarToolbar
        year={nav.year}
        month={nav.month}
        minYear={nav.minYear}
        minMonth={nav.minMonth}
        canGoPrev={nav.canGoPrev}
        onMonthChange={nav.setMonth}
        onYearChange={nav.setYear}
        onPrev={nav.goPrev}
        onNext={nav.goNext}
      />
      <div className="month-calendar-wrap">
        <div className="month-weekdays">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        {error && <p className="error calendar-error">{error}</p>}
        {loading && !data && <p className="loading">Loading schedule…</p>}
        {data && (
          <div className="month-grid">
            {data.cells.map((cell) => (
              <DayCell
                key={cell.date}
                cell={cell}
                expanded={!!expanded[cell.date]}
                onToggleExpand={() =>
                  setExpanded((e) => ({ ...e, [cell.date]: !e[cell.date] }))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
