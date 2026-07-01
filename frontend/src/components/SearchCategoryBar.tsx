import type { MarketplaceCategory } from "../api";

const CATEGORY_ICONS: Record<string, string> = {
  watersports: "🏄",
  fishing: "🎣",
  sailing: "⛵",
  cruising: "⚓",
  celebrating: "🎉",
};

type Props = {
  categories: MarketplaceCategory[];
  active: string;
  onSelect: (id: string) => void;
};

export default function SearchCategoryBar({ categories, active, onSelect }: Props) {
  return (
    <div className="search-category-bar">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`search-category-btn${active === c.id ? " search-category-btn--active" : ""}`}
          onClick={() => onSelect(active === c.id ? "" : c.id)}
        >
          <span className="search-category-icon" aria-hidden>
            {CATEGORY_ICONS[c.id] || "🚤"}
          </span>
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}
