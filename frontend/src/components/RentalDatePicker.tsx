import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "../utils";

export type RentalDateValue = {
  startDate: string;
};

type Props = {
  value: RentalDateValue;
  priceFromCents?: number | null;
  minDate?: string;
  monthCount?: 1 | 2;
  onApply: (value: RentalDateValue) => void;
  onCancel: () => void;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isBeforeYmd(a: string, b: string): boolean {
  return a < b;
}

export function formatRentalDateLabel(value: RentalDateValue): string {
  if (!value.startDate) return "Add date";
  return parseYmd(value.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type MonthGrid = {
  year: number;
  month: number;
  label: string;
  cells: { ymd: string; day: number; inMonth: boolean }[];
};

function buildMonthGrid(view: Date): MonthGrid {
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);
  const cells: MonthGrid["cells"] = [];

  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - (firstDow - i));
    cells.push({ ymd: formatYmd(d), day: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ ymd: formatYmd(new Date(year, month, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = parseYmd(cells[cells.length - 1].ymd);
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ ymd: formatYmd(d), day: d.getDate(), inMonth: false });
  }

  return {
    year,
    month,
    label: view.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    cells,
  };
}

export default function RentalDatePicker({
  value,
  priceFromCents,
  minDate,
  monthCount = 2,
  onApply,
  onCancel,
}: Props) {
  const todayYmd = formatYmd(new Date());
  const minYmd = minDate || todayYmd;

  const [draft, setDraft] = useState<RentalDateValue>(value);
  const [viewStart, setViewStart] = useState(() => {
    const base = value.startDate ? parseYmd(value.startDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const months = useMemo(() => {
    const count = monthCount === 1 ? 1 : 2;
    return Array.from({ length: count }, (_, i) => buildMonthGrid(addMonths(viewStart, i)));
  }, [viewStart, monthCount]);

  const singleMonth = monthCount === 1;

  function selectDate(ymd: string) {
    if (isBeforeYmd(ymd, minYmd)) return;
    setDraft({ startDate: ymd });
  }

  function dayClass(ymd: string, inMonth: boolean): string {
    const parts = ["rental-cal-day"];
    if (!inMonth) parts.push("rental-cal-day--muted");
    if (isBeforeYmd(ymd, minYmd)) parts.push("rental-cal-day--disabled");
    if (draft.startDate && ymd === draft.startDate) parts.push("rental-cal-day--edge");
    if (ymd === todayYmd) parts.push("rental-cal-day--today");
    return parts.join(" ");
  }

  return (
    <div
      className={`rental-date-picker${singleMonth ? " rental-date-picker--single" : ""}`}
      role="dialog"
      aria-label="Choose date"
    >
      <div className={`rental-cal-nav${singleMonth ? " rental-cal-nav--single" : ""}`}>
        <button
          type="button"
          className="rental-cal-nav-btn"
          aria-label="Previous month"
          onClick={() => setViewStart(addMonths(viewStart, -1))}
        >
          ‹
        </button>
        {singleMonth && (
          <h3 className="rental-cal-month-title rental-cal-month-title--inline">{months[0].label}</h3>
        )}
        <button
          type="button"
          className="rental-cal-nav-btn"
          aria-label="Next month"
          onClick={() => setViewStart(addMonths(viewStart, 1))}
        >
          ›
        </button>
      </div>

      <div className={`rental-cal-months${singleMonth ? " rental-cal-months--single" : ""}`}>
        {months.map((m) => (
          <div key={`${m.year}-${m.month}`} className="rental-cal-month">
            {!singleMonth && <h3 className="rental-cal-month-title">{m.label}</h3>}
            <div className="rental-cal-weekdays">
              {WEEKDAYS.map((w, i) => (
                <span key={`${m.month}-${i}`}>{w}</span>
              ))}
            </div>
            <div className="rental-cal-grid">
              {m.cells.map((cell) => (
                <button
                  key={cell.ymd}
                  type="button"
                  className={dayClass(cell.ymd, cell.inMonth)}
                  disabled={!cell.inMonth || isBeforeYmd(cell.ymd, minYmd)}
                  onClick={() => selectDate(cell.ymd)}
                >
                  <span className="rental-cal-day-num">{cell.day}</span>
                  {priceFromCents != null && cell.inMonth && !isBeforeYmd(cell.ymd, minYmd) && (
                    <span className="rental-cal-day-price">
                      {formatMoney(priceFromCents).replace(".00", "")}+
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rental-date-picker-footer">
        <button type="button" className="rental-date-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="rental-date-apply"
          disabled={!draft.startDate}
          onClick={() => onApply(draft)}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
