type Props = {
  rating: number;
  max?: number;
  size?: "sm" | "md";
  showValue?: boolean;
  count?: number;
};

export default function StarRating({
  rating,
  max = 5,
  size = "md",
  showValue = false,
  count,
}: Props) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars: string[] = [];
  for (let i = 1; i <= max; i++) {
    if (i <= full) stars.push("★");
    else if (i === full + 1 && half) stars.push("★");
    else stars.push("☆");
  }

  return (
    <span
      className={`star-rating star-rating--${size}`}
      aria-label={`${rating} out of ${max} stars`}
    >
      <span className="star-rating-stars" aria-hidden>
        {stars.join("")}
      </span>
      {showValue && (
        <span className="star-rating-value">
          {rating.toFixed(1)}
          {count != null && count > 0 && (
            <span className="star-rating-count"> ({count})</span>
          )}
        </span>
      )}
    </span>
  );
}

type InputProps = {
  value: number;
  onChange: (rating: number) => void;
};

export function StarRatingInput({ value, onChange }: InputProps) {
  return (
    <div className="star-rating-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-rating-input-btn${n <= value ? " star-rating-input-btn--on" : ""}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-checked={n === value}
          role="radio"
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
