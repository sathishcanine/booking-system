import type { BoatCaptainProfile } from "../api";
import StarRating from "./StarRating";

type Props = {
  open: boolean;
  captains: BoatCaptainProfile[];
  selectedId: string;
  onClose: () => void;
  onSelect: (captain: BoatCaptainProfile) => void;
};

export default function CaptainChangeModal({
  open,
  captains,
  selectedId,
  onClose,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div className="captain-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="captain-modal"
        role="dialog"
        aria-labelledby="captain-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="captain-modal-header">
          <h2 id="captain-modal-title">Choose your captain</h2>
          <button type="button" className="captain-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <ul className="captain-modal-list">
          {captains.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`captain-modal-option${c.id === selectedId ? " captain-modal-option--active" : ""}`}
                onClick={() => {
                  onSelect(c);
                  onClose();
                }}
              >
                <span className="captain-modal-avatar" aria-hidden>
                  {c.name.charAt(0)}
                </span>
                <span className="captain-modal-option-body">
                  <strong>{c.name}</strong>
                  {c.rating != null && (
                    <span className="captain-modal-rating">
                      <StarRating rating={c.rating} showValue size="sm" />
                      <span>({c.review_count} bookings)</span>
                    </span>
                  )}
                  <span className="captain-modal-meta">
                    Trips completed: {c.trips_completed.toLocaleString()}
                    {c.coast_guard_verified && " · US Coast Guard: Verified"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
