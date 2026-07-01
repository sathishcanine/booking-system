import { FormEvent, useEffect, useState } from "react";
import { admin, type AdminReview } from "../../admin/adminApi";
import StarRating from "../../components/StarRating";
import { formatDateTime } from "../../utils";

export default function AdminReviewsPage() {
  const [list, setList] = useState<AdminReview[]>([]);
  const [error, setError] = useState("");
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    admin.reviews
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reviews"));
  }

  useEffect(() => {
    load();
  }, []);

  async function onRespond(e: FormEvent, reviewId: number) {
    e.preventDefault();
    if (!responseText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await admin.reviews.respond(reviewId, responseText.trim());
      setRespondingId(null);
      setResponseText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save response");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>Reviews</h1>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        {list.length === 0 ? (
          <p className="admin-hint">No reviews yet — they appear after renters complete trips.</p>
        ) : (
          <div className="admin-review-list">
            {list.map((r) => (
              <article key={r.id} className="admin-review-card">
                <header className="admin-review-card-header">
                  <div>
                    <StarRating rating={r.rating} size="sm" />
                    <strong>{r.reviewer_name}</strong>
                    <span className="admin-review-meta">
                      {r.activity_title} · {r.booking_reference} ·{" "}
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
                </header>
                {r.body && <p className="admin-review-body">{r.body}</p>}
                {r.owner_response ? (
                  <div className="admin-review-response">
                    <strong>Your response</strong>
                    <p>{r.owner_response}</p>
                  </div>
                ) : respondingId === r.id ? (
                  <form className="admin-review-respond-form" onSubmit={(e) => onRespond(e, r.id)}>
                    <textarea
                      rows={3}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Thank the guest or address their feedback…"
                      required
                      maxLength={2000}
                    />
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => {
                          setRespondingId(null);
                          setResponseText("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="admin-btn admin-btn-primary"
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Post response"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => {
                      setRespondingId(r.id);
                      setResponseText("");
                    }}
                  >
                    Respond
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
