import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  admin,
  BOAT_AMENITIES,
  BOAT_TYPES,
  MARKETPLACE_CATEGORIES,
  getAuthRole,
  LISTING_STATUS_LABELS,
  uploadListingPhoto,
  type AdminActivityListItem,
  type ListingStatus,
} from "../../admin/adminApi";
import AdminModal from "../../admin/AdminModal";
import BoatMakeModelSelect from "../../components/BoatMakeModelSelect";
import PlacesAutocompleteInput from "../../components/PlacesAutocompleteInput";
import { MARKET_CITY, MARKET_LABEL, MARKET_STATE } from "../../config/market";
import {
  ALL_BOAT_MAKES,
  modelsForMake,
  TOP_BOAT_MAKES,
} from "../../data/boatMakesModels";
import { showToast } from "../../toast";
import { formatMoney } from "../../utils";
import type { PlaceSelection } from "../../utils/placeLocation";

function reportError(setError: (msg: string) => void, message: string) {
  setError(message);
  showToast(message);
}

const emptyActivity = {
  title: "",
  slug: "",
  description: "",
  image_url: "",
  meeting_instructions: "",
  is_active: true,
  listing_status: "draft" as ListingStatus,
  max_guests: null as number | null,
  boat_type: "pontoon",
  boat_make: "",
  boat_model: "",
  marina_name: "",
  city: MARKET_CITY,
  state: MARKET_STATE,
  amenities: [] as string[],
  photos_text: "",
  captain_required: false,
  hourly_rate_dollars: "",
  length_ft: null as number | null,
  min_rental_hours: 2,
  max_rental_hours: 8,
  instant_book: true,
  bareboat_allowed: true,
  activity_tags: [] as string[],
};

type CaptainMode = "captained" | "bareboat";

function captainModeFromActivity(activity: {
  captain_required: boolean;
  bareboat_allowed: boolean;
}): CaptainMode {
  return activity.bareboat_allowed && !activity.captain_required ? "bareboat" : "captained";
}

function activityWithCaptainMode<T extends typeof emptyActivity>(
  activity: T,
  mode: CaptainMode
): T {
  if (mode === "bareboat") {
    return { ...activity, captain_required: false, bareboat_allowed: true };
  }
  return { ...activity, captain_required: true, bareboat_allowed: false };
}

function applyLocationPlace(
  current: typeof emptyActivity,
  place: PlaceSelection,
  field: "marina" | "city"
) {
  if (field === "marina") {
    return {
      ...current,
      marina_name: place.marinaName || place.label,
      city: place.city,
      state: place.state || current.state,
    };
  }
  return {
    ...current,
    city: place.city,
    state: place.state || current.state,
  };
}

function listingBadgeClass(status: ListingStatus) {
  if (status === "published") return "admin-badge-listing-live";
  if (status === "pending_review") return "admin-badge-listing-pending";
  if (status === "delisted") return "admin-badge-listing-delisted";
  return "admin-badge-listing-draft";
}

export default function AdminActivitiesPage() {
  const { pathname } = useLocation();
  const isOwnerMode = pathname.startsWith("/owner");
  const isSuperAdmin = getAuthRole() === "super_admin";
  const [list, setList] = useState<AdminActivityListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activity, setActivity] = useState(emptyActivity);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const photoUrls = useMemo(
    () =>
      activity.photos_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [activity.photos_text]
  );

  function closeModal() {
    setModalOpen(false);
  }

  const loadList = useCallback(() => {
    admin.activities
      .list()
      .then(setList)
      .catch((e) => reportError(setError, e.message));
  }, []);

  const loadActivity = useCallback((id: number) => {
    admin.activities
      .get(id)
      .then((a) => {
        setActivity({
          title: a.title,
          slug: a.slug,
          description: a.description || "",
          image_url: a.image_url || "",
          meeting_instructions: a.meeting_instructions || "",
          is_active: a.is_active,
          listing_status: a.listing_status,
          max_guests: a.max_guests,
          boat_type: a.boat_type || "pontoon",
          boat_make: a.boat_make || "",
          boat_model: a.boat_model || "",
          marina_name: a.marina_name || "",
          city: a.city || "",
          state: a.state || "FL",
          amenities: a.amenities || [],
          photos_text: (a.photo_urls?.length ? a.photo_urls : []).join("\n"),
          captain_required: a.captain_required,
          hourly_rate_dollars: a.hourly_rate_cents
            ? String(a.hourly_rate_cents / 100)
            : "",
          length_ft: a.length_ft,
          min_rental_hours: a.min_rental_hours ?? 2,
          max_rental_hours: a.max_rental_hours ?? 8,
          instant_book: a.instant_book ?? true,
          bareboat_allowed: a.bareboat_allowed ?? true,
          activity_tags: a.activity_tags ?? [],
        });
        setSelectedId(id);
        setModalOpen(true);
      })
      .catch((e) => reportError(setError, e.message));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function newActivity() {
    setSelectedId(null);
    setActivity({ ...emptyActivity });
    setModalOpen(true);
    setError("");
    setMsg("");
  }

  function setPhotoUrls(urls: string[]) {
    setActivity({
      ...activity,
      photos_text: urls.join("\n"),
      image_url: activity.image_url && urls.includes(activity.image_url)
        ? activity.image_url
        : urls[0] || "",
    });
  }

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingPhotos(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { url } = await uploadListingPhoto(file);
        uploaded.push(url);
      }
      setPhotoUrls([...photoUrls, ...uploaded]);
      setMsg(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? "" : "s"}`);
    } catch (err) {
      reportError(
        setError,
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls(photoUrls.filter((u) => u !== url));
  }

  function setCoverPhoto(url: string) {
    setActivity({ ...activity, image_url: url });
  }

  async function saveActivity(e: FormEvent) {
    e.preventDefault();
    setError("");
    const photo_urls = activity.photos_text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!activity.boat_make.trim()) {
      reportError(setError, "Make is required");
      return;
    }
    if (!activity.boat_model.trim()) {
      reportError(setError, "Model is required");
      return;
    }
    const body = {
      title: activity.title,
      slug: activity.slug || "",
      description: activity.description || null,
      duration_minutes: activity.max_rental_hours * 60,
      location_label:
        activity.marina_name ||
        [activity.city, activity.state].filter(Boolean).join(", ") ||
        null,
      image_url: activity.image_url || null,
      emoji: null,
      meeting_instructions: activity.meeting_instructions || null,
      is_active: activity.is_active,
      max_guests: activity.max_guests,
      boat_type: activity.boat_type || null,
      boat_make: activity.boat_make.trim(),
      boat_model: activity.boat_model.trim(),
      marina_name: activity.marina_name || null,
      city: MARKET_CITY,
      state: MARKET_STATE,
      amenities: activity.amenities,
      photo_urls,
      captain_required: activity.captain_required,
      hourly_rate_cents: activity.hourly_rate_dollars
        ? Math.round(parseFloat(activity.hourly_rate_dollars) * 100)
        : null,
      length_ft: activity.length_ft,
      min_rental_hours: activity.min_rental_hours,
      max_rental_hours: activity.max_rental_hours,
      instant_book: activity.instant_book,
      bareboat_allowed: activity.bareboat_allowed,
      activity_tags: activity.activity_tags,
    };
    try {
      if (selectedId) {
        await admin.activities.update(selectedId, body);
        setMsg(isOwnerMode ? "Boat updated" : "Listing updated");
        loadActivity(selectedId);
      } else {
        const created = await admin.activities.create(body);
        setMsg(isOwnerMode ? "Boat created" : "Listing created");
        setSelectedId(created.id);
        loadActivity(created.id);
      }
      loadList();
    } catch (err) {
      reportError(setError, err instanceof Error ? err.message : "Save failed");
    }
  }

  async function runListingAction(
    action: "submitReview" | "approve" | "reject" | "delist",
    id: number
  ) {
    setError("");
    try {
      const fn = admin.activities[action];
      await fn(id);
      const successMsg =
        action === "submitReview"
          ? "Submitted for review"
          : action === "approve"
            ? "Listing approved — now live"
            : action === "reject"
              ? "Listing returned to draft"
              : "Listing delisted";
      setMsg(successMsg);
      showToast(successMsg);
      loadList();
      if (action === "submitReview" && selectedId === id) {
        closeModal();
        setSelectedId(null);
      } else if (selectedId === id) {
        loadActivity(id);
      }
    } catch (err) {
      reportError(setError, err instanceof Error ? err.message : "Action failed");
    }
  }

  function toggleAmenity(name: string) {
    setActivity((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(name)
        ? prev.amenities.filter((a) => a !== name)
        : [...prev.amenities, name],
    }));
  }

  async function deleteActivity() {
    if (!selectedId || !confirm("Delete this boat listing?")) return;
    try {
      const res = await admin.activities.delete(selectedId);
      setMsg(res.message || "Deleted");
      closeModal();
      setSelectedId(null);
      loadList();
    } catch (err) {
      reportError(setError, err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <h1>{isOwnerMode ? "My boats" : "Boats"}</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => newActivity()}>
          + Add boat
        </button>
      </header>
      {error && <p className="admin-error">{error}</p>}
      {msg && <p className="admin-hint" style={{ color: "#1e7e34" }}>{msg}</p>}

      <section className="admin-card">
        <p className="admin-hint" style={{ marginTop: 0 }}>
          {isOwnerMode
            ? "Add photos, hourly rate, and rental options. Submit for review when ready — a platform admin will approve your listing before it appears on the marketplace."
            : "Review and manage boat listings from all owners. Approve pending listings before they go live on the marketplace."}
        </p>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Boat</th>
              {isSuperAdmin && <th>Owner</th>}
              <th>Status</th>
              <th>Type</th>
              <th>Location</th>
              <th>Hourly</th>
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
                {isSuperAdmin && <td>{a.organization_name || "—"}</td>}
                <td>
                  <span className={`admin-badge ${listingBadgeClass(a.listing_status)}`}>
                    {LISTING_STATUS_LABELS[a.listing_status]}
                  </span>
                </td>
                <td>{BOAT_TYPES.find((t) => t.value === a.boat_type)?.label || "—"}</td>
                <td>{a.city || "—"}</td>
                <td>{a.hourly_rate_cents ? formatMoney(a.hourly_rate_cents) : "—"}</td>
                <td>
                  <div className="admin-actions" style={{ margin: 0, flexWrap: "nowrap" }}>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={() => loadActivity(a.id)}>
                      Edit
                    </button>
                    {isSuperAdmin && a.listing_status === "pending_review" && (
                      <>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          onClick={() => runListingAction("approve", a.id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          onClick={() => runListingAction("reject", a.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AdminModal
        open={modalOpen}
        title={selectedId ? "Edit boat" : "New boat"}
        onClose={closeModal}
        wide={Boolean(selectedId)}
      >
          <form onSubmit={saveActivity}>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Listing title *</label>
                <input
                  required
                  value={activity.title}
                  onChange={(e) => setActivity({ ...activity, title: e.target.value })}
                  placeholder="Give title to your boat for listing"
                />
              </div>
              <BoatMakeModelSelect
                label="Make"
                value={activity.boat_make}
                options={[...ALL_BOAT_MAKES]}
                topOptions={[...TOP_BOAT_MAKES]}
                topSectionLabel="Top makes"
                required
                placeholder="Search or select make"
                onChange={(boat_make) =>
                  setActivity({
                    ...activity,
                    boat_make,
                    boat_model:
                      activity.boat_make !== boat_make ? "" : activity.boat_model,
                  })
                }
              />
              <BoatMakeModelSelect
                label="Model"
                value={activity.boat_model}
                options={modelsForMake(activity.boat_make)}
                required
                disabled={!activity.boat_make.trim()}
                placeholder={
                  activity.boat_make.trim()
                    ? "Search or select model"
                    : "Choose make first"
                }
                onChange={(boat_model) => setActivity({ ...activity, boat_model })}
              />
              <div className="admin-field">
                <label>Boat type</label>
                <select
                  value={activity.boat_type}
                  onChange={(e) => setActivity({ ...activity, boat_type: e.target.value })}
                >
                  {BOAT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label>Max guests *</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={activity.max_guests ?? ""}
                  onChange={(e) =>
                    setActivity({
                      ...activity,
                      max_guests: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="12"
                />
              </div>
              <div className="admin-field">
                <label>Boat location</label>
                <PlacesAutocompleteInput
                  mode="marina"
                  value={activity.marina_name}
                  onChange={(v) => setActivity({ ...activity, marina_name: v })}
                  onPlaceSelect={(place) =>
                    setActivity((current) => applyLocationPlace(current, place, "marina"))
                  }
                  placeholder="Search marina, dock, or address"
                />
                <p className="admin-hint">
                  Pick from Google Maps to auto-fill city and state.
                </p>
              </div>
              <div className="admin-field">
                <label>City</label>
                <input value={MARKET_CITY} readOnly disabled aria-readonly />
                <p className="admin-hint">All listings are in {MARKET_LABEL}.</p>
              </div>
              <div className="admin-field">
                <label>State</label>
                <input value={MARKET_STATE} readOnly disabled aria-readonly />
              </div>
              <div className="admin-field">
                <label>URL slug</label>
                <input
                  value={activity.slug}
                  onChange={(e) => setActivity({ ...activity, slug: e.target.value })}
                  placeholder="auto-generated if empty"
                />
              </div>
              <div className="admin-field full">
                <label>Boat photos</label>
                <p className="admin-hint">
                  Upload JPEG, PNG, or WebP images (max 8 MB). The cover photo appears on search
                  cards — set it with &ldquo;Use as cover&rdquo;.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploadingPhotos}
                  onChange={handlePhotoUpload}
                />
                {uploadingPhotos && <p className="admin-hint">Uploading…</p>}
                {photoUrls.length > 0 && (
                  <div className="listing-photo-grid">
                    {photoUrls.map((url) => (
                      <div
                        key={url}
                        className={`listing-photo-thumb${
                          activity.image_url === url ? " listing-photo-thumb--cover" : ""
                        }`}
                      >
                        <img src={url} alt="" loading="lazy" />
                        <div className="listing-photo-thumb-actions">
                          {activity.image_url === url ? (
                            <span className="listing-photo-cover-badge">Cover</span>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm"
                              onClick={() => setCoverPhoto(url)}
                            >
                              Use as cover
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-danger"
                            onClick={() => removePhoto(url)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-field full">
                <label>Photo URLs (optional)</label>
                <textarea
                  value={activity.photos_text}
                  onChange={(e) => {
                    const text = e.target.value;
                    const urls = text
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setActivity({
                      ...activity,
                      photos_text: text,
                      image_url: activity.image_url || urls[0] || "",
                    });
                  }}
                  rows={2}
                  placeholder="Or paste image URLs, one per line"
                />
              </div>
              <div className="admin-field full">
                <label>Amenities</label>
                <div className="amenity-chips">
                  {BOAT_AMENITIES.map((name) => (
                    <label key={name} className="amenity-chip">
                      <input
                        type="checkbox"
                        checked={activity.amenities.includes(name)}
                        onChange={() => toggleAmenity(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-field full">
                <h3 className="admin-subsection-title">Pricing</h3>
                <p className="admin-hint">
                  Hourly rate appears on search cards, the date calendar, and checkout quotes.
                </p>
              </div>
              <div className="admin-field">
                <label>Hourly rate ($)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={activity.hourly_rate_dollars}
                  onChange={(e) =>
                    setActivity({ ...activity, hourly_rate_dollars: e.target.value })
                  }
                  placeholder="303"
                  required
                />
              </div>
              <div className="admin-field">
                <label>Length (ft)</label>
                <input
                  type="number"
                  min={1}
                  value={activity.length_ft ?? ""}
                  onChange={(e) =>
                    setActivity({
                      ...activity,
                      length_ft: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="admin-field">
                <label>Min rental (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={activity.min_rental_hours}
                  onChange={(e) =>
                    setActivity({ ...activity, min_rental_hours: Number(e.target.value) })
                  }
                />
              </div>
              <div className="admin-field">
                <label>Max rental (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={activity.max_rental_hours}
                  onChange={(e) =>
                    setActivity({ ...activity, max_rental_hours: Number(e.target.value) })
                  }
                />
              </div>
              <div className="admin-field full">
                <label>Categories (search browse)</label>
                <div className="amenity-chips">
                  {MARKETPLACE_CATEGORIES.map((c) => (
                    <label key={c.id} className="amenity-chip">
                      <input
                        type="checkbox"
                        checked={activity.activity_tags.includes(c.id)}
                        onChange={() => {
                          const tags = activity.activity_tags.includes(c.id)
                            ? activity.activity_tags.filter((t) => t !== c.id)
                            : [...activity.activity_tags, c.id];
                          setActivity({ ...activity, activity_tags: tags });
                        }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-field">
                <label>
                  <input
                    type="checkbox"
                    checked={activity.instant_book}
                    onChange={(e) =>
                      setActivity({ ...activity, instant_book: e.target.checked })
                    }
                  />{" "}
                  Instant book
                </label>
              </div>
              <div className="admin-field full">
                <label>Captain</label>
                <p className="search-filter-popover-hint" style={{ marginTop: "0.35rem" }}>
                  Select if renters need a captain or can operate the boat themselves.
                </p>
                <div className="search-filter-popover-btns">
                  {(
                    [
                      ["captained", "Captained"],
                      ["bareboat", "No captain"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={`search-filter-chip${
                        captainModeFromActivity(activity) === mode
                          ? " search-filter-chip--active"
                          : ""
                      }`}
                      onClick={() =>
                        setActivity(activityWithCaptainMode(activity, mode))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
                  Active on marketplace
                </label>
              </div>
            </div>
            <div className="admin-actions">
              <button type="submit" className="admin-btn admin-btn-primary">
                Save boat
              </button>
              {selectedId && isOwnerMode && activity.listing_status === "draft" && (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => runListingAction("submitReview", selectedId)}
                >
                  Submit for review
                </button>
              )}
              {selectedId && isOwnerMode && activity.listing_status === "published" && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => runListingAction("delist", selectedId)}
                >
                  Delist
                </button>
              )}
              {selectedId && isSuperAdmin && activity.listing_status === "pending_review" && (
                <>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => runListingAction("approve", selectedId)}
                  >
                    Approve listing
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => runListingAction("reject", selectedId)}
                  >
                    Reject
                  </button>
                </>
              )}
              {selectedId && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={deleteActivity}>
                  Delete
                </button>
              )}
              <button type="button" className="admin-btn" onClick={closeModal}>
                Cancel
              </button>
            </div>
            {selectedId && (
              <p className="admin-hint" style={{ marginTop: "0.75rem" }}>
                Status:{" "}
                <span className={`admin-badge ${listingBadgeClass(activity.listing_status)}`}>
                  {LISTING_STATUS_LABELS[activity.listing_status]}
                </span>
              </p>
            )}
          </form>

      </AdminModal>
    </>
  );
}
