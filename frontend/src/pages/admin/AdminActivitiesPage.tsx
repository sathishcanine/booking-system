import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  admin,
  COASTAL_LOCATIONS,
  SAMPLE_TOURS,
  type AdminActivityListItem,
  type AdminTicketType,
} from "../../admin/adminApi";
import AdminModal from "../../admin/AdminModal";
import { formatDollarInput, formatMoney, parseDollarInput } from "../../utils";

const emptyActivity = {
  title: "",
  slug: "",
  description: "",
  duration_minutes: 150,
  location_label: COASTAL_LOCATIONS[0],
  image_url: "",
  emoji: "",
  meeting_instructions: "",
  is_active: true,
};

const emptyTicket = {
  name: "",
  subtitle: "",
  price_dollars: "",
  sort_order: 0,
  max_per_booking: null as number | null,
};

export default function AdminActivitiesPage() {
  const [list, setList] = useState<AdminActivityListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activity, setActivity] = useState(emptyActivity);
  const [tickets, setTickets] = useState<AdminTicketType[]>([]);
  const [ticketForm, setTicketForm] = useState(emptyTicket);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  function closeModal() {
    setModalOpen(false);
    setEditingTicketId(null);
    setTicketForm(emptyTicket);
  }

  const loadList = useCallback(() => {
    admin.activities.list().then(setList).catch((e) => setError(e.message));
  }, []);

  const loadActivity = useCallback((id: number) => {
    admin.activities
      .get(id)
      .then((a) => {
        setActivity({
          title: a.title,
          slug: a.slug,
          description: a.description || "",
          duration_minutes: a.duration_minutes,
          location_label: a.location_label || "",
          image_url: a.image_url || "",
          emoji: a.emoji || "",
          meeting_instructions: a.meeting_instructions || "",
          is_active: a.is_active,
        });
        setTickets(a.ticket_types);
        setSelectedId(id);
        setModalOpen(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function newActivity(template?: (typeof SAMPLE_TOURS)[0]) {
    setSelectedId(null);
    setActivity(
      template
        ? {
            ...emptyActivity,
            title: template.title,
            emoji: template.emoji,
            duration_minutes: template.duration,
            location_label: template.location,
            description: `${template.duration / 60}hr ${template.title}`,
          }
        : { ...emptyActivity }
    );
    setTickets([]);
    setModalOpen(true);
    setError("");
    setMsg("");
  }

  async function saveActivity(e: FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      ...activity,
      slug: activity.slug || "",
      description: activity.description || null,
      location_label: activity.location_label || null,
      image_url: activity.image_url || null,
      emoji: activity.emoji || null,
      meeting_instructions: activity.meeting_instructions || null,
    };
    try {
      if (selectedId) {
        await admin.activities.update(selectedId, body);
        setMsg("Tour updated");
        loadActivity(selectedId);
      } else {
        const created = await admin.activities.create(body);
        setMsg("Tour created — add ticket types below");
        setSelectedId(created.id);
        loadActivity(created.id);
      }
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteActivity() {
    if (!selectedId || !confirm("Delete this tour? Slots may be removed.")) return;
    try {
      const res = await admin.activities.delete(selectedId);
      setMsg(res.message || "Deleted");
      closeModal();
      setSelectedId(null);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function saveTicket(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("Save the tour first");
      return;
    }
    const price_cents = parseDollarInput(ticketForm.price_dollars);
    if (price_cents === null) {
      setError("Enter a valid price (e.g. 55.55 or 0.55)");
      return;
    }
    const body = {
      name: ticketForm.name,
      subtitle: ticketForm.subtitle || null,
      price_cents,
      sort_order: ticketForm.sort_order,
      max_per_booking: ticketForm.max_per_booking || null,
    };
    try {
      if (editingTicketId) {
        await admin.ticketTypes.update(editingTicketId, body);
      } else {
        await admin.ticketTypes.create(selectedId, body);
      }
      setTicketForm(emptyTicket);
      setEditingTicketId(null);
      loadActivity(selectedId);
      setMsg("Ticket type saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function editTicket(t: AdminTicketType) {
    setEditingTicketId(t.id);
    setTicketForm({
      name: t.name,
      subtitle: t.subtitle || "",
      price_dollars: formatDollarInput(t.price_cents),
      sort_order: t.sort_order,
      max_per_booking: t.max_per_booking,
    });
  }

  async function deleteTicket(id: number) {
    if (!confirm("Delete this ticket type?")) return;
    try {
      await admin.ticketTypes.delete(id);
      if (selectedId) loadActivity(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Tours &amp; ticket types</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => newActivity()}>
          + New tour
        </button>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {msg && <p className="admin-hint" style={{ color: "#1e7e34" }}>{msg}</p>}

      <section className="admin-card">
        <p className="admin-hint" style={{ marginTop: 0 }}>
          Quick add popular St. Pete tours:
        </p>
        <div className="admin-actions">
          {SAMPLE_TOURS.map((t) => (
            <button
              key={t.title}
              type="button"
              className="admin-btn admin-btn-sm"
              onClick={() => newActivity(t)}
            >
              {t.emoji} {t.title}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tour</th>
              <th>Location</th>
              <th>Tickets</th>
              <th>Slots</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.title}</strong>
                  {!a.is_active && <span className="admin-badge admin-badge-cancelled"> inactive</span>}
                </td>
                <td>{a.location_label}</td>
                <td>{a.ticket_type_count}</td>
                <td>{a.slot_count}</td>
                <td>
                  <button type="button" className="admin-btn admin-btn-sm" onClick={() => loadActivity(a.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AdminModal
        open={modalOpen}
        title={selectedId ? "Edit tour" : "New tour"}
        onClose={closeModal}
        wide={Boolean(selectedId)}
      >
          <form onSubmit={saveActivity}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Title *</label>
                <input
                  required
                  value={activity.title}
                  onChange={(e) => setActivity({ ...activity, title: e.target.value })}
                  placeholder="Island Sunset & Skyway Light Show"
                />
              </div>
              <div className="admin-field">
                <label>URL slug</label>
                <input
                  value={activity.slug}
                  onChange={(e) => setActivity({ ...activity, slug: e.target.value })}
                  placeholder="auto-generated if empty"
                />
              </div>
              <div className="admin-field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min={15}
                  value={activity.duration_minutes}
                  onChange={(e) =>
                    setActivity({ ...activity, duration_minutes: Number(e.target.value) })
                  }
                />
              </div>
              <div className="admin-field">
                <label>Departure location</label>
                <select
                  value={activity.location_label}
                  onChange={(e) => setActivity({ ...activity, location_label: e.target.value })}
                >
                  {COASTAL_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label>Emoji</label>
                <input
                  value={activity.emoji}
                  onChange={(e) => setActivity({ ...activity, emoji: e.target.value })}
                  placeholder="🐬🌅"
                />
              </div>
              <div className="admin-field">
                <label>Image URL</label>
                <input
                  value={activity.image_url}
                  onChange={(e) => setActivity({ ...activity, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="admin-field full">
                <label>Description (booking page)</label>
                <textarea
                  value={activity.description}
                  onChange={(e) => setActivity({ ...activity, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="admin-field full">
                <label>Meeting / route instructions</label>
                <textarea
                  value={activity.meeting_instructions}
                  onChange={(e) =>
                    setActivity({ ...activity, meeting_instructions: e.target.value })
                  }
                  rows={4}
                  placeholder="Check-in 6:30pm, boarding 6:45pm at SkyBeach..."
                />
              </div>
              <div className="admin-field">
                <label>
                  <input
                    type="checkbox"
                    checked={activity.is_active}
                    onChange={(e) => setActivity({ ...activity, is_active: e.target.checked })}
                  />{" "}
                  Active on calendar
                </label>
              </div>
            </div>
            <div className="admin-actions">
              <button type="submit" className="admin-btn admin-btn-primary">
                Save tour
              </button>
              {selectedId && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={deleteActivity}>
                  Delete tour
                </button>
              )}
              <button type="button" className="admin-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </form>

          {selectedId && (
            <div className="admin-ticket-list">
              <h3>Ticket types (Adults, Children, Group, etc.)</h3>
              {tickets.map((t) => (
                <div className="admin-ticket-row" key={t.id}>
                  <div>
                    <strong>{t.name}</strong>
                    {t.subtitle && <div style={{ color: "#5c6570", fontSize: "0.85rem" }}>{t.subtitle}</div>}
                    <div>{formatMoney(t.price_cents)}</div>
                  </div>
                  <div className="admin-actions" style={{ margin: 0 }}>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => editTicket(t)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => deleteTicket(t.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              <form onSubmit={saveTicket} style={{ marginTop: "1rem" }}>
                <h4>{editingTicketId ? "Edit ticket" : "Add ticket type"}</h4>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Name *</label>
                    <input
                      required
                      value={ticketForm.name}
                      onChange={(e) => setTicketForm({ ...ticketForm, name: e.target.value })}
                      placeholder="Adults — Ages 13 & Up"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Price ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={ticketForm.price_dollars}
                      onChange={(e) =>
                        setTicketForm({ ...ticketForm, price_dollars: e.target.value })
                      }
                      placeholder="55.55"
                    />
                  </div>
                  <div className="admin-field full">
                    <label>Subtitle / notes</label>
                    <input
                      value={ticketForm.subtitle}
                      onChange={(e) => setTicketForm({ ...ticketForm, subtitle: e.target.value })}
                      placeholder="Save 10% when booking 6+ together"
                    />
                  </div>
                  <div className="admin-field">
                    <label>Sort order</label>
                    <input
                      type="number"
                      value={ticketForm.sort_order}
                      onChange={(e) =>
                        setTicketForm({ ...ticketForm, sort_order: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label>Max per booking</label>
                    <input
                      type="number"
                      min={1}
                      value={ticketForm.max_per_booking ?? ""}
                      onChange={(e) =>
                        setTicketForm({
                          ...ticketForm,
                          max_per_booking: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="admin-actions">
                  <button type="submit" className="admin-btn admin-btn-primary">
                    {editingTicketId ? "Update ticket" : "Add ticket"}
                  </button>
                  {editingTicketId && (
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => {
                        setEditingTicketId(null);
                        setTicketForm(emptyTicket);
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
      </AdminModal>
    </>
  );
}
