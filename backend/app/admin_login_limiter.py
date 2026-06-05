"""In-memory rate limiting for admin login attempts (per client IP)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.config import settings

_lock = threading.Lock()
_failures: dict[str, list[float]] = defaultdict(list)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _prune(ip: str, now: float) -> list[float]:
    cutoff = now - settings.admin_login_window_seconds
    recent = [t for t in _failures[ip] if t > cutoff]
    _failures[ip] = recent
    return recent


def check_login_allowed(request: Request) -> None:
    ip = client_ip(request)
    now = time.time()
    with _lock:
        if len(_prune(ip, now)) >= settings.admin_login_max_attempts:
            raise HTTPException(
                429,
                "Too many login attempts. Please try again later.",
            )


def record_login_failure(request: Request) -> None:
    ip = client_ip(request)
    now = time.time()
    with _lock:
        _prune(ip, now)
        _failures[ip].append(now)


def clear_login_attempts(request: Request) -> None:
    ip = client_ip(request)
    with _lock:
        _failures.pop(ip, None)
