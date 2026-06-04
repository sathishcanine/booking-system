import { useCallback, useEffect, useState } from "react";
import { fetchCalendarMonth, type CalendarCell, type CalendarMonth } from "../api";
import CalendarToolbar from "../components/CalendarToolbar";
import SlotCard from "../components/SlotCard";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const VISIBLE_SLOTS = 3;

function useMonthNav(initial = new Date()) {
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);

  const goPrev = () => {
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

  return { year, month, setYear, setMonth, goPrev, goNext };
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
  const visible = expanded ? cell.slots : cell.slots.slice(0, VISIBLE_SLOTS);
  const hidden = cell.slots.length - VISIBLE_SLOTS;

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

export default function CalendarPage() {
  const nav = useMonthNav();
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCalendarMonth(nav.year, nav.month)
      .then((m) => {
        setData(m);
        setExpanded({});
      })
      .catch(() => setError("Could not load schedule. Is the API running?"))
      .finally(() => setLoading(false));
  }, [nav.year, nav.month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="calendar-month-page">
      <h1 className="calendar-hero-title">BOOK YOUR ADVENTURE</h1>

      <CalendarToolbar
        year={nav.year}
        month={nav.month}
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
