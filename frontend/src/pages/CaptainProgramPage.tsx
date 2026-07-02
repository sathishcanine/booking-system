import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCaptains, type CaptainListItem } from "../api";
import CaptainCard from "../components/CaptainCard";
import HomeAudienceCards from "../components/HomeAudienceCards";
import MarketplaceNav from "../components/MarketplaceNav";
import {
  CAPTAIN_EXPERIENCE_OPTIONS,
  CAPTAIN_LICENSE_TYPES,
  CAPTAIN_SPECIALIZATIONS,
} from "../config/captainProfile";
import { MARKET_CITY } from "../config/market";
import { usePageMeta } from "../hooks/usePageMeta";

const PAGE_SIZE = 8;

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function CaptainProgramPage() {
  usePageMeta({
    title: "Captain Program",
    description: `Browse verified captains in ${MARKET_CITY} — USCG licensed professionals for your next adventure.`,
  });

  const [params, setParams] = useSearchParams();
  const [captains, setCaptains] = useState<CaptainListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const licenseFilter = useMemo(
    () => params.getAll("license"),
    [params]
  );
  const experienceFilter = params.get("experience") || "";
  const specializationFilter = useMemo(
    () => params.getAll("specialization"),
    [params]
  );

  const updateParams = useCallback(
    (next: Record<string, string | string[]>) => {
      const merged = new URLSearchParams(params);
      for (const [key, value] of Object.entries(next)) {
        merged.delete(key);
        if (Array.isArray(value)) {
          for (const item of value) merged.append(key, item);
        } else if (value) {
          merged.set(key, value);
        }
      }
      setParams(merged, { replace: true });
      setVisibleCount(PAGE_SIZE);
    },
    [params, setParams]
  );

  useEffect(() => {
    setLoading(true);
    fetchCaptains({
      license: licenseFilter.length ? licenseFilter : undefined,
      experience: experienceFilter || undefined,
      specialization: specializationFilter.length ? specializationFilter : undefined,
      limit: 100,
    })
      .then(setCaptains)
      .catch(() => setCaptains([]))
      .finally(() => setLoading(false));
  }, [licenseFilter, experienceFilter, specializationFilter]);

  const visible = captains.slice(0, visibleCount);
  const hasMore = visibleCount < captains.length;

  return (
    <div className="mp-page mp-page--captains">
      <section className="captains-hero">
        <div className="captains-hero-bg" aria-hidden />
        <div className="captains-hero-inner">
          <MarketplaceNav variant="hero" />
          <div className="captains-hero-content">
            <p className="captains-hero-eyebrow">Party · Cruise · Memories</p>
            <h1>Travel with Alis Adventure</h1>
          </div>
        </div>
      </section>

      <div className="captains-layout">
        <aside className="captains-filters" aria-label="Filter captains">
          <div className="captains-filter-group">
            <h2>License type</h2>
            {CAPTAIN_LICENSE_TYPES.map((item) => (
              <label key={item.id} className="captains-filter-check">
                <input
                  type="checkbox"
                  checked={licenseFilter.includes(item.id)}
                  onChange={() =>
                    updateParams({ license: toggleValue(licenseFilter, item.id) })
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="captains-filter-group">
            <h2>Experience</h2>
            {CAPTAIN_EXPERIENCE_OPTIONS.map((item) => (
              <label key={item.id} className="captains-filter-check">
                <input
                  type="radio"
                  name="captain-experience"
                  checked={experienceFilter === item.id}
                  onChange={() =>
                    updateParams({ experience: experienceFilter === item.id ? "" : item.id })
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="captains-filter-group">
            <h2>Specializations</h2>
            <div className="captains-filter-chips">
              {CAPTAIN_SPECIALIZATIONS.map((item) => {
                const active = specializationFilter.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`captains-filter-chip${active ? " captains-filter-chip--active" : ""}`}
                    onClick={() =>
                      updateParams({
                        specialization: toggleValue(specializationFilter, item.id),
                      })
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="captains-main" aria-labelledby="captains-heading">
          <header className="captains-main-head">
            <h2 id="captains-heading">Expert Captains of {MARKET_CITY}</h2>
            <p>
              &ldquo;The sea, once it casts its spell, holds one in its net of wonder forever.&rdquo;
              Our curated mariners are the reliable hands that guide your journey safely.
            </p>
          </header>

          {loading ? (
            <p className="captains-loading">Loading captains…</p>
          ) : visible.length === 0 ? (
            <p className="captains-empty">No captains match these filters.</p>
          ) : (
            <div className="captains-grid">
              {visible.map((captain) => (
                <CaptainCard key={captain.id} captain={captain} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="captains-load-more-wrap">
              <button
                type="button"
                className="captains-load-more"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Load more captains
              </button>
            </div>
          )}
        </section>
      </div>

      <HomeAudienceCards />
    </div>
  );
}
