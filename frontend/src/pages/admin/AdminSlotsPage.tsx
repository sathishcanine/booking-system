import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchConfig } from "../../api";
import AdminModal from "../../admin/AdminModal";
import { admin, type AdminActivityListItem, type AdminSlot } from "../../admin/adminApi";
import { formatTime } from "../../utils";
import { MONTH_NAMES } from "../../utils";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptySlot = {
  activity_id: 0,
  starts_at: "",
  ends_at: "",
  capacity: 20,
  waitlist_enabled: true,
  promo_text: "",
  card_description: "",
  is_call_to_book: false,
  call_phone: "+1-727-380-0431",
  brand_label: "",
  urgency_text: "",
  booking_cutoff_hours: "" as number | "",
};

export default function AdminSlotsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activities, setActivities] = useState<AdminActivityListItem[]>([]);
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [filterActivity, setFilterActivity] = useState<number | "">("");
  const [form, setForm] = useState(emptySlot);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setBulkDates("");
  }
  const [bulkDates, setBulkDates] = useState("");
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("13:00");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [siteDefaultCutoff, setSiteDefaultCutoff] = useState(2);

  const load = useCallback(() => {
    admin.activities.list().then(setActivities);
    admin.slots
      .list({
        year,
        month,
        activity_id: filterActivity || undefined,
        include_cancelled: true,
      })
      .then(setSlots)
      .catch((e) => setError(e.message));
  }, [year, month, filterActivity]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchConfig()
      .then((c) => setSiteDefaultCutoff(c.default_booking_cutoff_hours))
      .catch(() => {});
  }, []);

  function openNew() {
    setEditingId(null);
    setForm({
      ...emptySlot,
      activity_id: activities[0]?.id || 0,
      booking_cutoff_hours: siteDefaultCutoff,
    });
    setModalOpen(true);
  }

  function openEdit(s: AdminSlot) {
    setEditingId(s.id);
    setForm({
      activity_id: s.activity_id,
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      capacity: s.capacity,
      waitlist_enabled: s.waitlist_enabled,
      promo_text: s.promo_text || "",
      card_description: s.card_description || "",
      is_call_to_book: s.is_call_to_book,
      call_phone: s.call_phone || "+1-727-380-0431",
      brand_label: s.brand_label || "",
      urgency_text: s.urgency_text || "",
      booking_cutoff_hours: s.booking_cutoff_hours ?? "",
    });
    setModalOpen(true);
  }

  function cutoffForApi(): number | null {
    if (form.booking_cutoff_hours === "") return null;
    return Number(form.booking_cutoff_hours);
  }

  function validateSlotForm(): string | null {
    if (!form.starts_at || !form.ends_at) return "Start and end times are required.";
    const starts = new Date(form.starts_at);
    const ends = new Date(form.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      return "Invalid start or end time.";
    }
    if (ends <= starts) return "End time must be after start time.";
    if (form.capacity < 1) return "Capacity must be at least 1.";
    if (form.capacity > 500) return "Capacity cannot exceed 500.";
    if (
      form.booking_cutoff_hours !== "" &&
      (form.booking_cutoff_hours < 0 || form.booking_cutoff_hours > 168)
    ) {
      return "Booking cutoff must be between 0 and 168 hours.";
    }
    return null;
  }

  async function saveSlot(e: FormEvent) {
    e.preventDefault();
    setError("");
    const validationError = validateSlotForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    const body = {
      activity_id: form.activity_id,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      capacity: form.capacity,
      waitlist_enabled: form.waitlist_enabled,
      promo_text: form.promo_text || null,
      card_description: form.card_description || null,
      is_call_to_book: form.is_call_to_book,
      call_phone: form.is_call_to_book ? form.call_phone : null,
      brand_label: form.brand_label || null,
      urgency_text: form.urgency_text || null,
      booking_cutoff_hours: cutoffForApi(),
    };
    try {
      if (editingId) {
        await admin.slots.update(editingId, body);
        setMsg("Departure updated");
      } else {
        await admin.slots.create(body);
        setMsg("Departure created");
      }
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function bulkCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.activity_id) return;
    const validationError = validateSlotForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    const dates = bulkDates
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (!dates.length) {
      setError("Enter at least one date (YYYY-MM-DD)");
      return;
    }
    try {
      const created = await admin.slots.bulk({
        activity_id: form.activity_id,
        dates,
        start_time: bulkStart,
        end_time: bulkEnd,
        capacity: form.capacity,
        waitlist_enabled: form.waitlist_enabled,
        promo_text: form.promo_text || null,
        card_description: form.card_description || null,
        is_call_to_book: form.is_call_to_book,
        call_phone: form.is_call_to_book ? form.call_phone : null,
        brand_label: form.brand_label || null,
        urgency_text: form.urgency_text || null,
        booking_cutoff_hours: cutoffForApi(),
      });
      setMsg(`Created ${created.length} departures`);
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk create failed");
    }
  }

  async function cancelSlot(id: number) {
    if (!confirm("Cancel this departure? It will be hidden from the calendar.")) return;
    await admin.slots.delete(id);
    load();
  }

  async function restoreSlot(id: number) {
    await admin.slots.restore(id);
    load();
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Departures</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={openNew}>
          + Add departure
        </button>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {msg && <p className="admin-hint" style={{ color: "#1e7e34" }}>{msg}</p>}

      <section className="admin-card">
        <div className="admin-form-grid" style={{ alignItems: "end" }}>
          <div className="admin-field">
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Year</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="admin-field">
            <label>Tour filter</label>
            <select
              value={filterActivity}
              onChange={(e) =>
                setFilterActivity(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All tours</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Tour</th>
              <th>Capacity</th>
              <th>Cutoff</th>
              <th>Options</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} style={s.is_cancelled ? { opacity: 0.5 } : undefined}>
                <td>
                  {new Date(s.starts_at).toLocaleDateString()}{" "}
                  {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                </td>
                <td>{s.activity_title}</td>
                <td>
                  {s.booked_count}/{s.capacity}
                </td>
                <td>
                  {s.booking_cutoff_hours != null
                    ? `${s.booking_cutoff_hours}h`
                    : `Default (${siteDefaultCutoff}h)`}
                </td>
                <td>
                  {s.is_call_to_book && <span className="admin-badge admin-badge-pending">Call</span>}
                  {s.promo_text && <span> {s.promo_text}</span>}
                  {s.brand_label && <span> · {s.brand_label}</span>}
                  {s.is_cancelled && <span className="admin-badge admin-badge-cancelled"> Cancelled</span>}
                </td>
                <td>
                  <button type="button" className="admin-btn admin-btn-sm" onClick={() => openEdit(s)}>
                    Edit
                  </button>{" "}
                  <Link to={`/book/${s.id}`} className="admin-btn admin-btn-sm" target="_blank">
                    Preview
                  </Link>{" "}
                  {s.is_cancelled ? (
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => restoreSlot(s.id)}>
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => cancelSlot(s.id)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AdminModal
        open={modalOpen}
        title={editingId ? "Edit departure" : "Create departure"}
        onClose={closeModal}
        wide
      >
          <form onSubmit={saveSlot}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Tour *</label>
                <select
                  required
                  value={form.activity_id}
                  onChange={(e) => setForm({ ...form, activity_id: Number(e.target.value) })}
                >
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label>Starts *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Ends *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
                <small>Maximum 500 per departure.</small>
              </div>
              <div className="admin-field">
                <label>Stop online booking (hours before)</label>
                <input
                  type="number"
                  min={0}
                  max={168}
                  value={form.booking_cutoff_hours}
                  placeholder={`Site default (${siteDefaultCutoff})`}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      booking_cutoff_hours:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <small>
                  Leave empty for site default ({siteDefaultCutoff}h). Use 0 to allow booking
                  until departure starts.
                </small>
              </div>
              <div className="admin-field">
                <label>Promo badge</label>
                <input
                  value={form.promo_text}
                  onChange={(e) => setForm({ ...form, promo_text: e.target.value })}
                  placeholder="Save $10"
                />
              </div>
              <div className="admin-field">
                <label>Urgency text</label>
                <input
                  value={form.urgency_text}
                  onChange={(e) => setForm({ ...form, urgency_text: e.target.value })}
                  placeholder="7 spots left"
                />
              </div>
              <div className="admin-field">
                <label>Brand banner</label>
                <input
                  value={form.brand_label}
                  onChange={(e) => setForm({ ...form, brand_label: e.target.value })}
                  placeholder="SKYBEACH RESORT"
                />
              </div>
              <div className="admin-field full">
                <label>Card description override</label>
                <input
                  value={form.card_description}
                  onChange={(e) => setForm({ ...form, card_description: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.waitlist_enabled}
                    onChange={(e) => setForm({ ...form, waitlist_enabled: e.target.checked })}
                  />{" "}
                  Waitlist when full
                </label>
              </div>
              <div className="admin-field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_call_to_book}
                    onChange={(e) => setForm({ ...form, is_call_to_book: e.target.checked })}
                  />{" "}
                  Call to book (no online checkout)
                </label>
              </div>
              {form.is_call_to_book && (
                <div className="admin-field">
                  <label>Phone</label>
                  <input
                    value={form.call_phone}
                    onChange={(e) => setForm({ ...form, call_phone: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="admin-actions">
              <button type="submit" className="admin-btn admin-btn-primary">
                Save departure
              </button>
              <button type="button" className="admin-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </form>

          {!editingId && (
            <form onSubmit={bulkCreate} style={{ marginTop: "2rem", borderTop: "1px solid #e8ecef", paddingTop: "1rem" }}>
              <h3>Bulk create (same time on multiple dates)</h3>
              <p className="admin-hint">Enter dates one per line (YYYY-MM-DD), comma-separated, or paste a list.</p>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Start time</label>
                  <input value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} placeholder="09:00" />
                </div>
                <div className="admin-field">
                  <label>End time</label>
                  <input value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} placeholder="13:00" />
                </div>
                <div className="admin-field full">
                  <label>Dates</label>
                  <textarea
                    rows={4}
                    value={bulkDates}
                    onChange={(e) => setBulkDates(e.target.value)}
                    placeholder={"2026-05-20\n2026-05-21\n2026-05-22"}
                  />
                </div>
              </div>
              <button type="submit" className="admin-btn admin-btn-primary">
                Bulk create departures
              </button>
            </form>
          )}
      </AdminModal>
    </>
  );
}
