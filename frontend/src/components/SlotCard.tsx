import { Link } from "react-router-dom";
import type { CalendarSlot } from "../api";
import { formatTime } from "../utils";

type Props = { slot: CalendarSlot; compact?: boolean };

export default function SlotCard({ slot, compact }: Props) {
  const isWaitlist = slot.status === "waitlist";
  const isLow = slot.status === "low";
  const isCall = slot.is_call_to_book;

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
        {slot.urgency_text && (
          <p className="slot-urgency">{slot.urgency_text}</p>
        )}
        {isLow && !slot.urgency_text && (
          <p className="slot-urgency">{slot.spots_left} spots left</p>
        )}
        {isWaitlist && <span className="slot-waitlist-btn">Waitlist</span>}
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

  return (
    <Link
      to={`/book/${slot.id}`}
      className={`slot-card${compact ? " slot-card--compact" : ""}`}
    >
      {inner}
    </Link>
  );
}
