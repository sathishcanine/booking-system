import type { SlotDetail } from "../api";
import { formatMoney, formatSlotRange } from "../utils";

type Props = {
  slot: SlotDetail;
  qty: Record<number, number>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  taxRate: number;
};

export default function OrderSummary({
  slot,
  qty,
  subtotal,
  discount,
  tax,
  total,
  taxRate,
}: Props) {
  return (
    <div className="order-summary card">
      <h3>Summary</h3>
      <p className="summary-title">{slot.title}</p>
      <p className="summary-meta">{formatSlotRange(slot.starts_at, slot.ends_at)}</p>
      {slot.status !== "waitlist" && slot.spots_left > 0 && (
        <p className="summary-availability">
          {slot.spots_left} {slot.spots_left === 1 ? "spot" : "spots"} left
        </p>
      )}
      <ul className="summary-lines">
        {slot.ticket_types.map((t) => {
          const q = qty[t.id] || 0;
          if (!q) return null;
          return (
            <li key={t.id}>
              {q} × {t.name}{" "}
              <span>{formatMoney(q * t.price_cents)}</span>
            </li>
          );
        })}
      </ul>
      <hr />
      <div className="summary-row">
        <span>Subtotal</span>
        <span>{formatMoney(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="summary-row discount">
          <span>Discount</span>
          <span>-{formatMoney(discount)}</span>
        </div>
      )}
      <div className="summary-row">
        <span>Taxes &amp; fees ({taxRate}%)</span>
        <span>{formatMoney(tax)}</span>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  );
}
