"""Store listing photos uploaded from the owner/admin boat form."""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import BACKEND_ROOT

LISTING_UPLOAD_DIR = BACKEND_ROOT / "uploads" / "listings"
CAPTAIN_UPLOAD_DIR = BACKEND_ROOT / "uploads" / "captains"
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_BYTES = 8 * 1024 * 1024


def ensure_upload_dir() -> None:
    LISTING_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CAPTAIN_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def save_listing_photo(file: UploadFile, base_url: str) -> str:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(400, "Use a JPEG, PNG, or WebP image")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Image must be 8 MB or smaller")

    ensure_upload_dir()
    filename = f"{secrets.token_hex(16)}{ext}"
    path = LISTING_UPLOAD_DIR / filename
    path.write_bytes(raw)

    base = str(base_url).rstrip("/")
    if not base:
        return f"/uploads/listings/{filename}"
    return f"{base}/uploads/listings/{filename}"


async def save_captain_photo(file: UploadFile, base_url: str) -> str:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(400, "Use a JPEG, PNG, or WebP image")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "Image must be 8 MB or smaller")

    ensure_upload_dir()
    filename = f"{secrets.token_hex(16)}{ext}"
    path = CAPTAIN_UPLOAD_DIR / filename
    path.write_bytes(raw)

    base = str(base_url).rstrip("/")
    if not base:
        return f"/uploads/captains/{filename}"
    return f"{base}/uploads/captains/{filename}"
