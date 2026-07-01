import type { MarketplacePromise as PromiseData } from "../api";

type Props = {
  promise: PromiseData;
};

export default function MarketplacePromise({ promise }: Props) {
  if (!promise.items.length) return null;

  return (
    <section className="dest-promise">
      <h2>{promise.title}</h2>
      <div className="dest-promise-grid">
        {promise.items.map((item) => (
          <div key={item.title} className="dest-promise-item">
            <span className="dest-promise-check" aria-hidden>
              ✓
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
