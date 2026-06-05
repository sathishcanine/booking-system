import { FormEvent, useEffect, useState } from "react";
import { admin, type AdminPromo } from "../../admin/adminApi";
import { formatMoney } from "../../utils";

type PromoForm = {
  code: string;
  discount_percent: number | null;
  discount_cents: number | null;
  max_uses: number | null;
  valid_until: string;
  is_active: boolean;
};

const empty: PromoForm = {
  code: "",
  discount_percent: null,
  discount_cents: 1000,
  max_uses: null,
  valid_until: "",
  is_active: true,
};

export default function AdminPromosPage() {
  const [list, setList] = useState<AdminPromo[]>([]);
  const [form, setForm] = useState<PromoForm>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function load() {
    admin.promos.list().then(setList).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  function edit(p: AdminPromo) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      discount_percent: p.discount_percent,
      discount_cents: p.discount_cents,
      max_uses: p.max_uses,
      valid_until: p.valid_until ? p.valid_until.slice(0, 16) : "",
      is_active: p.is_active,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const body = {
      code: form.code,
      discount_percent: form.discount_percent,
      discount_cents: form.discount_cents,
      max_uses: form.max_uses,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      is_active: form.is_active,
    };
    try {
      if (editingId) await admin.promos.update(editingId, body);
      else await admin.promos.create(body);
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete promo code?")) return;
    await admin.promos.delete(id);
    load();
  }

  async function resetUsage(id: number, code: string) {
    if (!confirm(`Reset usage count for ${code}?`)) return;
    try {
      await admin.promos.resetUsage(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Promo codes</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        <form onSubmit={save}>
          <h2 style={{ marginTop: 0 }}>{editingId ? "Edit promo" : "Add promo"}</h2>
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>Code</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SAVE10"
              />
            </div>
            <div className="admin-field">
              <label>Discount ($ cents)</label>
              <input
                type="number"
                value={form.discount_cents ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_cents: e.target.value ? Number(e.target.value) : null,
                    discount_percent: null,
                  })
                }
              />
              {form.discount_cents != null && <small>{formatMoney(form.discount_cents)}</small>}
            </div>
            <div className="admin-field">
              <label>Or discount %</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.discount_percent ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_percent: e.target.value ? Number(e.target.value) : null,
                    discount_cents: null,
                  })
                }
              />
            </div>
            <div className="admin-field">
              <label>Max uses</label>
              <input
                type="number"
                value={form.max_uses ?? ""}
                onChange={(e) =>
                  setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="admin-field">
              <label>Valid until</label>
              <input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />{" "}
                Active
              </label>
            </div>
          </div>
          <div className="admin-actions">
            <button type="submit" className="admin-btn admin-btn-primary">
              {editingId ? "Update" : "Create"}
            </button>
            {editingId && (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setEditingId(null);
                  setForm(empty);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Uses</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.code}</strong>
                </td>
                <td>
                  {p.discount_cents != null
                    ? formatMoney(p.discount_cents)
                    : `${p.discount_percent}%`}
                </td>
                <td>
                  {p.used_count}
                  {p.max_uses != null ? ` / ${p.max_uses}` : ""}
                  {p.max_uses != null && p.used_count >= p.max_uses && (
                    <span className="admin-badge admin-badge-expired"> Exhausted</span>
                  )}
                </td>
                <td>{p.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <button type="button" className="admin-btn admin-btn-sm" onClick={() => edit(p)}>
                    Edit
                  </button>{" "}
                  {p.used_count > 0 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => resetUsage(p.id, p.code)}
                    >
                      Reset uses
                    </button>
                  )}{" "}
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => remove(p.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
