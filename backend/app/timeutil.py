from datetime import datetime, timezone

UTC = timezone.utc


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(dt: datetime | None) -> datetime | None:
    """Treat naive DB datetimes as UTC; normalize aware values to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def utc_naive(dt: datetime | None) -> datetime | None:
    """Store/compare as UTC naive (SQLite-friendly)."""
    if dt is None:
        return None
    return as_utc(dt).replace(tzinfo=None)


def utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return as_utc(dt).isoformat().replace("+00:00", "Z")


def hold_seconds_remaining(expires_at: datetime | None) -> int:
    if expires_at is None:
        return 0
    delta = as_utc(expires_at) - utcnow()
    return max(0, int(delta.total_seconds()))
