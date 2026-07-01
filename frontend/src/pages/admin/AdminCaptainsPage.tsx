import { FormEvent, useEffect, useState } from "react";
import {
  admin,
  getAuthRole,
  uploadCaptainPhoto,
  type AdminCaptain,
  type AdminCaptainInput,
  type AdminOrganization,
} from "../../admin/adminApi";
import RoundImageCropField from "../../components/admin/RoundImageCropField";
import { MARKET_LABEL } from "../../config/market";

const DEFAULT_ORG_NAME = "Alis Adventures";

type CaptainForm = {
  name: string;
  slug: string;
  bio: string;
  photo_url: string | null;
  coast_guard_verified: boolean;
  phone_verified: boolean;
  is_active: boolean;
  organization_id: number | "";
};

const empty: CaptainForm = {
  name: "",
  slug: "",
  bio: "",
  photo_url: null,
  coast_guard_verified: false,
  phone_verified: false,
  is_active: true,
  organization_id: "",
};

function defaultOrganizationId(orgs: AdminOrganization[]): number | "" {
  const exact = orgs.find((o) => o.name === DEFAULT_ORG_NAME);
  if (exact) return exact.id;
  const fuzzy = orgs.find((o) => /alis/i.test(o.name));
  return fuzzy?.id ?? "";
}

function newCaptainForm(orgs: AdminOrganization[]): CaptainForm {
  return { ...empty, organization_id: defaultOrganizationId(orgs) };
}

function toBody(form: CaptainForm, isSuperAdmin: boolean): AdminCaptainInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    bio: form.bio.trim() || null,
    location: MARKET_LABEL,
    photo_url: form.photo_url,
    coast_guard_verified: form.coast_guard_verified,
    phone_verified: form.phone_verified,
    is_active: form.is_active,
    organization_id: isSuperAdmin && form.organization_id ? Number(form.organization_id) : null,
  };
}

function formatRating(rating: number | null) {
  return rating != null ? rating.toFixed(1) : "—";
}

export default function AdminCaptainsPage() {
  const isSuperAdmin = getAuthRole() === "super_admin";
  const [list, setList] = useState<AdminCaptain[]>([]);
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [form, setForm] = useState<CaptainForm>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    admin.captains.list().then(setList).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    if (isSuperAdmin) {
      admin.organizations.list().then((data) => {
        setOrgs(data);
        setForm((current) => {
          if (editingId != null || current.organization_id !== "") return current;
          const defaultId = defaultOrganizationId(data);
          return defaultId ? { ...current, organization_id: defaultId } : current;
        });
      }).catch(() => {});
    }
  }, [isSuperAdmin, editingId]);

  function edit(c: AdminCaptain) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      bio: c.bio || "",
      photo_url: c.photo_url,
      coast_guard_verified: c.coast_guard_verified,
      phone_verified: c.phone_verified,
      is_active: c.is_active,
      organization_id: c.organization_id,
    });
    setError("");
    setMsg("");
  }

  function resetForm() {
    setForm(newCaptainForm(orgs));
    setEditingId(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const body = toBody(form, isSuperAdmin);
      if (editingId) await admin.captains.update(editingId, body);
      else await admin.captains.create(body);
      resetForm();
      load();
      setMsg(editingId ? "Captain updated." : "Captain added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Remove captain ${name}?`)) return;
    setError("");
    try {
      await admin.captains.delete(id);
      if (editingId === id) resetForm();
      load();
      setMsg("Captain removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Captains</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {msg && <p className="admin-msg">{msg}</p>}

      <section className="admin-card">
        <form onSubmit={save}>
          <h2 style={{ marginTop: 0 }}>{editingId ? "Edit captain" : "Add captain"}</h2>
          <p className="admin-hint">
            Add profile details for each licensed skipper. Rating, trips completed, review count,
            and aboard-since year are calculated automatically from paid bookings and guest reviews.
          </p>
          <div className="admin-captain-photo-row">
            <RoundImageCropField
              value={form.photo_url}
              onChange={(photo_url) => setForm({ ...form, photo_url })}
              onUpload={uploadCaptainPhoto}
              fallbackInitial={form.name || "C"}
            />
          </div>
          <div className="admin-form-grid">
            {isSuperAdmin && (
              <div className="admin-field">
                <label>Organization *</label>
                <select
                  required
                  value={form.organization_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      organization_id: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="admin-field">
              <label>Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Captain Marcus"
              />
            </div>
            <div className="admin-field">
              <label>Profile slug</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated from name"
              />
            </div>
            <div className="admin-field">
              <label>Location</label>
              <input value={MARKET_LABEL} readOnly disabled aria-readonly />
            </div>
            <div className="admin-field full">
              <label>Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="USCG-licensed captain specializing in sandbar and sunset trips."
              />
            </div>
            <div className="admin-field">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.coast_guard_verified}
                  onChange={(e) =>
                    setForm({ ...form, coast_guard_verified: e.target.checked })
                  }
                />
                US Coast Guard verified
              </label>
            </div>
            <div className="admin-field">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.phone_verified}
                  onChange={(e) => setForm({ ...form, phone_verified: e.target.checked })}
                />
                Phone verified
              </label>
            </div>
            <div className="admin-field">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>
          <div className="admin-actions">
            <button type="submit" className="admin-btn admin-btn-primary">
              {editingId ? "Save changes" : "Add captain"}
            </button>
            {editingId && (
              <button type="button" className="admin-btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>Your captains</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              {isSuperAdmin && <th>Organization</th>}
              <th>Location</th>
              <th>Rating</th>
              <th>Trips</th>
              <th>Reviews</th>
              <th>Since</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 10 : 9}>No captains yet.</td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="admin-captain-thumb" />
                  ) : (
                    <span className="admin-captain-thumb admin-captain-thumb--empty">
                      {c.name.charAt(0)}
                    </span>
                  )}
                </td>
                <td>
                  <strong>{c.name}</strong>
                  <br />
                  <small>{c.slug}</small>
                </td>
                {isSuperAdmin && <td>{c.organization_name || "—"}</td>}
                <td>{c.location || "—"}</td>
                <td>{formatRating(c.rating)}</td>
                <td>{c.trips_completed.toLocaleString()}</td>
                <td>{c.review_count.toLocaleString()}</td>
                <td>{c.aboard_since_year ?? "—"}</td>
                <td>
                  <span
                    className={`admin-badge ${
                      c.is_active ? "admin-badge-listing-live" : "admin-badge-cancelled"
                    }`}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="admin-actions" style={{ margin: 0, flexWrap: "nowrap" }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => edit(c)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => remove(c.id, c.name)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
