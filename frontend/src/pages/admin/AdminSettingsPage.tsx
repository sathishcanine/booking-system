import { FormEvent, useEffect, useState } from "react";
import { admin, type Earnings, type PlatformSettings } from "../../admin/adminApi";
import { formatMoney } from "../../utils";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([admin.platformSettings.get(), admin.earnings()])
      .then(([s, e]) => {
        setSettings(s);
        setEarnings(e);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const updated = await admin.platformSettings.update(settings);
      setSettings(updated);
      setMsg("Platform settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Platform settings</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {msg && <p className="admin-hint" style={{ color: "#1e7e34" }}>{msg}</p>}

      {settings && (
        <form className="admin-card" onSubmit={onSubmit}>
          <h2 style={{ marginTop: 0 }}>Fees &amp; tax</h2>
          <p className="admin-hint">
            These apply to all owner bookings. Tax is collected on the platform account;
            owners receive the net amount minus the platform fee.
          </p>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label htmlFor="platform-fee">Platform fee (%)</label>
              <input
                id="platform-fee"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={settings.platform_fee_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform_fee_percent: Number(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="tax-rate">Tax rate (%)</label>
              <input
                id="tax-rate"
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={settings.tax_rate_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    tax_rate_percent: Number(e.target.value),
                  })
                }
                required
              />
            </div>
          </div>
          <h2>Cancellation policy</h2>
          <p className="admin-hint">
            Applied when renters cancel from their account. Owners can override with a full
            refund for weather or mechanical issues.
          </p>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label htmlFor="cancel-full">Full refund if cancelled at least (hours before)</label>
              <input
                id="cancel-full"
                type="number"
                min={1}
                max={336}
                step={1}
                value={settings.cancel_full_refund_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cancel_full_refund_hours: Number(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="cancel-partial">Partial refund window starts (hours before)</label>
              <input
                id="cancel-partial"
                type="number"
                min={0}
                max={336}
                step={1}
                value={settings.cancel_partial_refund_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cancel_partial_refund_hours: Number(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="cancel-pct">Partial refund (%)</label>
              <input
                id="cancel-pct"
                type="number"
                min={0}
                max={100}
                step={5}
                value={settings.cancel_partial_refund_percent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cancel_partial_refund_percent: Number(e.target.value),
                  })
                }
                required
              />
            </div>
          </div>
          <h2>Trip protection</h2>
          <p className="admin-hint">
            Shown on checkout and boat listings. Keep it concise — this is simplified v1 copy,
            not a legal policy document.
          </p>
          <div className="admin-field">
            <label htmlFor="trip-protection">Trip protection summary</label>
            <textarea
              id="trip-protection"
              rows={3}
              value={settings.trip_protection_summary || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  trip_protection_summary: e.target.value || null,
                })
              }
              placeholder="Trip protection is included on every booking…"
            />
          </div>
          <h2>Destination pages</h2>
          <p className="admin-hint">
            Copy shown on location browse pages (e.g. after a renter searches Miami). Use{" "}
            <code>{"{location}"}</code> and <code>{"{type}"}</code> in section title templates.
          </p>
          <div className="admin-field">
            <label htmlFor="dest-best-title">Best rentals section title</label>
            <input
              id="dest-best-title"
              type="text"
              value={settings.destination_best_title_template || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  destination_best_title_template: e.target.value || null,
                })
              }
              placeholder="Best boat rentals in {location}"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="dest-type-title">Boat type section title</label>
            <input
              id="dest-type-title"
              type="text"
              value={settings.destination_type_title_template || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  destination_type_title_template: e.target.value || null,
                })
              }
              placeholder="{type} boat rentals"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="promise-title">Marketplace promise heading</label>
            <input
              id="promise-title"
              type="text"
              value={settings.marketplace_promise_title || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  marketplace_promise_title: e.target.value || null,
                })
              }
            />
          </div>
          {(settings.marketplace_promise_items || []).map((item, i) => (
            <div key={i} className="admin-card" style={{ marginTop: "0.75rem" }}>
              <div className="admin-field">
                <label>Promise item {i + 1} title</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const items = [...(settings.marketplace_promise_items || [])];
                    items[i] = { ...items[i], title: e.target.value };
                    setSettings({ ...settings, marketplace_promise_items: items });
                  }}
                />
              </div>
              <div className="admin-field">
                <label>Body</label>
                <textarea
                  rows={2}
                  value={item.body}
                  onChange={(e) => {
                    const items = [...(settings.marketplace_promise_items || [])];
                    items[i] = { ...items[i], body: e.target.value };
                    setSettings({ ...settings, marketplace_promise_items: items });
                  }}
                />
              </div>
            </div>
          ))}
          <div className="admin-actions">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      )}

      {earnings && (
        <section className="admin-card" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Marketplace revenue</h2>
          <div className="admin-card-grid payouts-kpis">
            <div className="payouts-kpi">
              <span className="payouts-kpi-label">Total GMV</span>
              <strong>{formatMoney(earnings.gross_revenue_cents)}</strong>
            </div>
            <div className="payouts-kpi">
              <span className="payouts-kpi-label">Platform fees earned</span>
              <strong>{formatMoney(earnings.platform_fees_cents)}</strong>
            </div>
            <div className="payouts-kpi">
              <span className="payouts-kpi-label">Owner payouts</span>
              <strong>{formatMoney(earnings.net_earnings_cents)}</strong>
            </div>
            <div className="payouts-kpi">
              <span className="payouts-kpi-label">Tax collected</span>
              <strong>{formatMoney(earnings.tax_collected_cents)}</strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
