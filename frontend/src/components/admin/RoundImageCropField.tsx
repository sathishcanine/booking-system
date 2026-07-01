import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import {
  ROUND_CROP_VIEW_SIZE,
  coverScaleForView,
  cropRoundImage,
  loadImageFromFile,
  type RoundCropState,
} from "../../lib/roundImageCrop";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<{ url: string }>;
  label?: string;
  hint?: string;
  fallbackInitial?: string;
  disabled?: boolean;
};

const DEFAULT_CROP: RoundCropState = { scale: 1, offsetX: 0, offsetY: 0 };

export default function RoundImageCropField({
  value,
  onChange,
  onUpload,
  label = "Profile photo",
  hint = "JPEG, PNG, or WebP. Drag to reposition and use the slider to zoom.",
  fallbackInitial = "?",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<RoundCropState>(DEFAULT_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!sourceFile) {
      setSourceUrl(null);
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(sourceFile);
    setSourceUrl(url);
    loadImageFromFile(sourceFile)
      .then((img) => {
        setImage(img);
        setCrop(DEFAULT_CROP);
      })
      .catch(() => setError("Could not load image"));
    return () => URL.revokeObjectURL(url);
  }, [sourceFile]);

  useEffect(() => {
    if (!cropOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        closeCropper();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropOpen, busy]);

  function closeCropper() {
    setCropOpen(false);
    setSourceFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file");
      return;
    }
    setError("");
    setSourceFile(file);
    setCropOpen(true);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!image) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setCrop((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  async function applyCrop() {
    if (!image || !sourceFile) return;
    setBusy(true);
    setError("");
    try {
      const blob = await cropRoundImage(image, ROUND_CROP_VIEW_SIZE, crop);
      const cropped = new File([blob], "captain-photo.jpg", { type: "image/jpeg" });
      const { url } = await onUpload(cropped);
      onChange(url);
      closeCropper();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const previewInitial = fallbackInitial.trim().charAt(0).toUpperCase() || "?";
  const draw =
    image != null
      ? (() => {
          const coverScale = coverScaleForView(image, ROUND_CROP_VIEW_SIZE, crop.scale);
          const w = image.width * coverScale;
          const h = image.height * coverScale;
          return {
            width: w,
            height: h,
            left: ROUND_CROP_VIEW_SIZE / 2 - w / 2 + crop.offsetX,
            top: ROUND_CROP_VIEW_SIZE / 2 - h / 2 + crop.offsetY,
          };
        })()
      : null;

  return (
    <div className="round-crop-field">
      <label className="round-crop-field-label">{label}</label>
      <div className="round-crop-field-row">
        <div className="round-crop-preview" aria-hidden>
          {value ? (
            <img src={value} alt="" className="round-crop-preview-img" />
          ) : (
            <span className="round-crop-preview-fallback">{previewInitial}</span>
          )}
        </div>
        <div className="round-crop-field-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="round-crop-file-input"
            disabled={disabled || busy}
            onChange={onPickFile}
          />
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Change photo" : "Upload photo"}
          </button>
          {value && (
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-danger"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          )}
          {hint && <p className="admin-hint round-crop-field-hint">{hint}</p>}
          {error && !cropOpen && <p className="admin-error">{error}</p>}
        </div>
      </div>

      {cropOpen && sourceUrl && (
        <div className="round-crop-modal" role="dialog" aria-modal="true" aria-label="Crop profile photo">
          <div className="round-crop-modal-backdrop" onClick={() => !busy && closeCropper()} />
          <div className="round-crop-modal-panel">
            <h3 className="round-crop-modal-title">Crop profile photo</h3>
            <p className="admin-hint">Drag the image to reposition. Use the slider to zoom in or out.</p>

            <div
              className="round-crop-viewport"
              style={{ width: ROUND_CROP_VIEW_SIZE, height: ROUND_CROP_VIEW_SIZE }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {draw && (
                <img
                  src={sourceUrl}
                  alt=""
                  draggable={false}
                  className="round-crop-viewport-img"
                  style={{
                    width: draw.width,
                    height: draw.height,
                    left: draw.left,
                    top: draw.top,
                  }}
                />
              )}
              <div className="round-crop-viewport-ring" aria-hidden />
            </div>

            <label className="round-crop-zoom-label">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={crop.scale}
                disabled={busy}
                onChange={(e) =>
                  setCrop((prev) => ({ ...prev, scale: Number(e.target.value) }))
                }
              />
            </label>

            {error && <p className="admin-error">{error}</p>}

            <div className="round-crop-modal-actions">
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={closeCropper}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={busy || !image}
                onClick={() => void applyCrop()}
              >
                {busy ? "Uploading…" : "Apply crop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
