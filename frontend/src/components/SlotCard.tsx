import { Link } from "react-router-dom";
import type { CalendarSlot } from "../api";
import { formatTime } from "../utils";

type Props = { slot: CalendarSlot; compact?: boolean };

export default function SlotCard({ slot, compact }: Props) {
  const isWaitlist = slot.status === "waitlist";
  const isLow = slot.status === "low";
  const isCall = slot.is_call_to_book;
  const isClosed = slot.booking_closed && !isCall;
  // Ignore static marketing copy like "7 spots left" — calendar must match live inventory.
  const marketingUrgency =
    slot.urgency_text && !/\d+\s+spots?\s+left/i.test(slot.urgency_text)
      ? slot.urgency_text
      : null;

  const inner = (
    <>
      {slot.brand_label && (
        <div className="slot-brand-banner">{slot.brand_label}</div>
      )}
      {slot.card_image_url && !slot.brand_label && (
        <img src={slot.card_image_url} alt="" className="slot-card-img" />
      )}
      <div className="slot-card-body">
        <div className="slot-card-top">
          <span className="slot-time">{formatTime(slot.starts_at)}</span>
          {slot.promo_text && <span className="slot-promo">{slot.promo_text}</span>}
        </div>
        <h3 className="slot-title">{slot.title}</h3>
        {slot.location_label && (
          <p className="slot-location">({slot.location_label})</p>
        )}
        {slot.card_description && (
          <p className="slot-desc">
            {slot.card_description}
            {slot.emoji && ` ${slot.emoji}`}
          </p>
        )}
        {marketingUrgency && (
          <p className="slot-urgency">{marketingUrgency}</p>
        )}
        {isClosed && (
          <p className="slot-urgency slot-urgency--closed">Online booking closed</p>
        )}
        {!isClosed && !isWaitlist && slot.spots_left > 0 && (
          <p className={`slot-urgency${isLow ? "" : " slot-urgency--muted"}`}>
            {slot.spots_left} {slot.spots_left === 1 ? "spot" : "spots"} left
          </p>
        )}
        {!isClosed && isWaitlist && <span className="slot-waitlist-btn">Waitlist</span>}
        {isCall && <span className="slot-call-book">Call to book</span>}
      </div>
    </>
  );

  if (isCall && slot.call_phone) {
    return (
      <a
        href={`tel:${slot.call_phone.replace(/\D/g, "")}`}
        className="slot-card slot-card--call"
      >
        {inner}
      </a>
    );
  }

  if (isCall) {
    return <div className="slot-card slot-card--call">{inner}</div>;
  }

  if (isClosed) {
    return (
      <div className={`slot-card slot-card--closed${compact ? " slot-card--compact" : ""}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={`/book/${slot.id}`}
      className={`slot-card${compact ? " slot-card--compact" : ""}`}
    >
      {inner}
    </Link>
  );
}
