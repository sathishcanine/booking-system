import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchBoats,
  fetchDestinationPage,
  fetchSearchConfig,
  type BoatCard as Boat,
  type DestinationPage,
  type SearchConfig,
} from "../api";
import BoatCarouselSection from "../components/BoatCarouselSection";
import BoatGridSkeleton from "../components/BoatGridSkeleton";
import BoatResultCard from "../components/BoatResultCard";
import BoatSearchBar from "../components/BoatSearchBar";
import DestinationBreadcrumbs from "../components/DestinationBreadcrumbs";
import MarketplaceNav from "../components/MarketplaceNav";
import MarketplacePromise from "../components/MarketplacePromise";
import SearchCategoryBar from "../components/SearchCategoryBar";
import SearchFilterBar from "../components/SearchFilterBar";
import SearchFiltersModal, {
  type SearchFilters,
} from "../components/SearchFiltersModal";
import { usePageMeta } from "../hooks/usePageMeta";
import { MARKET_CITY, MARKET_LABEL, MARKET_STATE } from "../config/market";

const PAGE_SIZE = 24;

function defaultFilters(guests: string, config: SearchConfig | null): SearchFilters {
  return {
    priceMin: 1,
    priceMax: config ? Math.round(config.price_max_cents / 100) : 1000,
    passengers: guests ? Number(guests) : 4,
    durationHours: null,
    captain: "",
    instantBook: false,
    lengthMaxFt: config?.length_max_ft ?? 70,
    amenity: "",
  };
}

function locationLabel(city: string, state: string) {
  if (city && state) return `${city}, ${state}, United States`;
  return MARKET_LABEL;
}

export default function BoatsBrowsePage() {
  const [params, setParams] = useSearchParams();
  const city = params.get("city") || MARKET_CITY;
  const state = params.get("state") || MARKET_STATE;
  const category = params.get("category") || "";
  const guests = params.get("guests") || "";
  const dateHint = params.get("date") || "";
  const view = params.get("view") || "";
  const durationParam = params.get("duration_hours");
  const captainParam = params.get("captain") as "" | "captained" | "bareboat" | null;
  const priceMaxParam = params.get("price_max");
  const instantBookParam = params.get("instant_book") === "true";

  const isDestinationView = view === "destination";
  const isSearchView = !isDestinationView;

  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [destination, setDestination] = useState<DestinationPage | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(() =>
    defaultFilters(guests, null)
  );

  useEffect(() => {
    fetchSearchConfig()
      .then((c) => {
        setConfig(c);
        setFilters((f) => ({
          ...f,
          priceMax: priceMaxParam
            ? Math.round(Number(priceMaxParam) / 100)
            : Math.round(c.price_max_cents / 100),
          passengers: guests ? Number(guests) : f.passengers,
          durationHours: durationParam ? Number(durationParam) : null,
          captain: captainParam === "captained" || captainParam === "bareboat" ? captainParam : "",
          instantBook: instantBookParam,
          lengthMaxFt: c.length_max_ft,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!guests) return;
    const count = Number(guests);
    if (!Number.isFinite(count) || count < 1) return;
    setFilters((f) => (f.passengers === count ? f : { ...f, passengers: count }));
  }, [guests]);

  const guestCount = guests ? Number(guests) : filters.passengers;

  const searchApiParams = useMemo(
    () => ({
      city: MARKET_CITY,
      state: MARKET_STATE,
      category: category || undefined,
      guests: guestCount >= 1 ? guestCount : undefined,
      price_min: filters.priceMin * 100,
      price_max:
        config && filters.priceMax >= Math.round(config.price_max_cents / 100)
          ? undefined
          : filters.priceMax * 100,
      duration_hours: filters.durationHours || undefined,
      captain: filters.captain || undefined,
      instant_book: filters.instantBook || undefined,
      length_max_ft: filters.lengthMaxFt < (config?.length_max_ft ?? 70) ? filters.lengthMaxFt : undefined,
      amenity: filters.amenity || undefined,
      sort: "rating" as const,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [category, guestCount, filters, config]
  );

  usePageMeta({
    title: `Boats in ${MARKET_CITY}`,
    description: `${total || ""} boat rentals in ${locationLabel(city, state)}`,
  });

  useEffect(() => {
    if (isDestinationView) {
      setLoading(true);
      fetchDestinationPage({ city, state: state || undefined, guests: guests ? Number(guests) : undefined })
        .then(setDestination)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    setError("");
    fetchBoats(searchApiParams)
      .then((page) => {
        setBoats(page.items);
        setTotal(page.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [
    isDestinationView,
    city,
    state,
    guests,
    category,
    filters.passengers,
    filters.priceMax,
    filters.durationHours,
    filters.captain,
    filters.instantBook,
    filters.lengthMaxFt,
    filters.amenity,
    config?.price_max_cents,
    searchApiParams,
  ]);

  function applyFiltersToUrl(next: SearchFilters) {
    const p = new URLSearchParams(params);
    p.set("guests", String(next.passengers));
    if (next.durationHours) p.set("duration_hours", String(next.durationHours));
    else p.delete("duration_hours");
    if (next.captain) p.set("captain", next.captain);
    else p.delete("captain");
    if (next.instantBook) p.set("instant_book", "true");
    else p.delete("instant_book");
    if (config && next.priceMax < Math.round(config.price_max_cents / 100)) {
      p.set("price_max", String(next.priceMax * 100));
    } else p.delete("price_max");
    setParams(p);
    setFilters(next);
  }

  function setCategory(next: string) {
    const p = new URLSearchParams(params);
    if (next) p.set("category", next);
    else p.delete("category");
    setParams(p);
  }

  function loadMore() {
    setLoadingMore(true);
    fetchBoats({ ...searchApiParams, offset: boats.length })
      .then((page) => {
        setTotal(page.total);
        setBoats((prev) => [...prev, ...page.items]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMore(false));
  }

  if (isDestinationView) {
    return (
      <div className="mp-page mp-page--destination">
        <MarketplaceNav />
        <div className="dest-page">
          {loading && <p className="boats-hint">Loading…</p>}
          {error && <p className="boats-error">{error}</p>}
          {destination && (
            <>
              <DestinationBreadcrumbs items={destination.breadcrumbs} />
              {destination.sections.map((section) => (
                <BoatCarouselSection
                  key={section.id}
                  title={section.title}
                  boats={section.boats}
                  moreHref={section.more_href}
                  dateHint={dateHint || undefined}
                />
              ))}
              <MarketplacePromise promise={destination.promise} />
            </>
          )}
        </div>
      </div>
    );
  }

  if (isSearchView) {
    if (!config) {
      return (
        <div className="mp-page mp-page--search">
          <MarketplaceNav />
          <p className="boats-hint" style={{ padding: "2rem" }}>
            Loading search…
          </p>
        </div>
      );
    }
    return (
      <div className="mp-page mp-page--search">
        <MarketplaceNav />
        <div className="search-results-page">
          <div className="search-results-top">
            <BoatSearchBar
              variant="inline"
              initial={{
                city,
                state,
                date: dateHint,
              }}
            />
          </div>

          <SearchCategoryBar
            categories={config.categories}
            active={category}
            onSelect={setCategory}
          />

          <SearchFilterBar
            filters={filters}
            priceMaxDollars={Math.round(config.price_max_cents / 100)}
            onChange={applyFiltersToUrl}
            onOpenModal={() => setFiltersOpen(true)}
          />

          <h1 className="search-results-headline">
            {loading ? "Loading boats…" : `${total}+ boats in ${locationLabel(city, state)}`}
          </h1>

          {error && <p className="boats-error">{error}</p>}
          {loading && <BoatGridSkeleton count={6} />}

          {!loading && boats.length === 0 && (
            <div className="boats-empty">
              <h2>No boats match your filters</h2>
              <p>Try adjusting filters to see more boats in {MARKET_CITY}.</p>
            </div>
          )}

          {!loading && boats.length > 0 && (
            <>
              <div className="search-results-grid">
                {boats.map((boat) => (
                  <BoatResultCard
                    key={boat.id}
                    boat={boat}
                    dateHint={dateHint || undefined}
                    captainHint={filters.captain || undefined}
                  />
                ))}
              </div>
              {boats.length < total && (
                <div className="boats-load-more">
                  <button
                    type="button"
                    className="boats-btn"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : `Load more (${boats.length} of ${total})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <SearchFiltersModal
          open={filtersOpen}
          config={config}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          onClear={() => applyFiltersToUrl(defaultFilters(guests, config))}
          onApply={() => {
            applyFiltersToUrl(filters);
            setFiltersOpen(false);
          }}
        />
      </div>
    );
  }

  return null;
}
