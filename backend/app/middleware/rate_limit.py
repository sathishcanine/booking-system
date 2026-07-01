"""Simple in-memory rate limiting per client IP."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit_per_minute: int | None = None):
        super().__init__(app)
        self.limit = limit_per_minute if limit_per_minute is not None else settings.rate_limit_per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if self.limit <= 0 or not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Skip static uploads and health-style config reads are still limited — OK
        if request.method == "OPTIONS":
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client = forwarded.split(",")[0].strip()

        now = time.time()
        window_start = now - 60.0
        bucket = self._hits[client]
        bucket[:] = [t for t in bucket if t >= window_start]

        if len(bucket) >= self.limit:
            return JSONResponse(
                {"detail": "Too many requests. Please try again shortly."},
                status_code=429,
                headers={"Retry-After": "60"},
            )

        bucket.append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - len(bucket)))
        return response
