type Props = {
  count?: number;
};

export default function BoatGridSkeleton({ count = 6 }: Props) {
  return (
    <div className="boats-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="boat-card boat-card--skeleton">
          <div className="boat-card-image boat-skeleton-block" />
          <div className="boat-card-body">
            <div className="boat-skeleton-line boat-skeleton-line--short" />
            <div className="boat-skeleton-line boat-skeleton-line--title" />
            <div className="boat-skeleton-line" />
            <div className="boat-skeleton-line boat-skeleton-line--btn" />
          </div>
        </div>
      ))}
    </div>
  );
}
