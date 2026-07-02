import { useEffect, useState } from "react";
import { admin, type AdminContactInquiry } from "../../admin/adminApi";
import { formatDateTime } from "../../utils";

export default function AdminContactInquiriesPage() {
  const [list, setList] = useState<AdminContactInquiry[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"" | "unread" | "read">("");

  function load() {
    admin.contactInquiries
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load inquiries"));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = list.filter((row) => {
    if (filter === "unread") return !row.is_read;
    if (filter === "read") return row.is_read;
    return true;
  });

  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null;

  async function markRead(id: number) {
    try {
      await admin.contactInquiries.markRead(id);
      setError("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update inquiry");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Contact inquiries</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        <div className="admin-field" style={{ maxWidth: 220 }}>
          <label>Filter</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </section>

      <div className="admin-contact-layout">
        <section className="admin-card admin-contact-list">
          {filtered.length === 0 ? (
            <p className="admin-hint">No contact messages yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Email</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      selected?.id === row.id
                        ? "admin-contact-row admin-contact-row--active"
                        : "admin-contact-row"
                    }
                    onClick={() => setSelectedId(row.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      {row.first_name} {row.last_name}
                    </td>
                    <td>{row.email}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <span
                        className={
                          row.is_read ? "admin-badge-paid" : "admin-badge-pending"
                        }
                      >
                        {row.is_read ? "Read" : "New"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selected && (
          <section className="admin-card admin-contact-detail">
            <header className="admin-contact-detail-head">
              <div>
                <h2>
                  {selected.first_name} {selected.last_name}
                </h2>
                <p className="admin-review-meta">{formatDateTime(selected.created_at)}</p>
              </div>
              {!selected.is_read && (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => markRead(selected.id)}
                >
                  Mark as read
                </button>
              )}
            </header>

            <dl className="admin-contact-meta">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                </dd>
              </div>
            </dl>

            <div className="admin-contact-message">
              <h3>Message</h3>
              <p>{selected.message || "—"}</p>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
