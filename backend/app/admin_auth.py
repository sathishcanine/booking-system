from __future__ import annotations

import logging
import secrets
import time

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
ADMIN_SUBJECT = "admin"
TOKEN_TYPE = "access"

_WEAK_PASSWORDS = frozenset({"changeme", ""})
_WEAK_SECRETS = frozenset(
    {
        "",
        "dev-admin-change-me-in-production",
        "dev-jwt-secret-change-me-in-production",
    }
)


def verify_admin_password(password: str) -> bool:
    if not settings.admin_password:
        return False
    return secrets.compare_digest(password, settings.admin_password)


def validate_admin_auth_config() -> None:
    """Warn or fail when admin auth uses unsafe defaults."""
    if not settings.admin_password:
        logger.warning("ADMIN_PASSWORD is not set — admin login is disabled")
        return

    weak_password = settings.admin_password in _WEAK_PASSWORDS
    weak_secret = (
        len(settings.admin_jwt_secret) < 32
        or settings.admin_jwt_secret in _WEAK_SECRETS
    )

    if settings.require_strong_admin_secrets:
        if weak_password:
            raise RuntimeError(
                "ADMIN_PASSWORD must be set to a strong value when "
                "REQUIRE_STRONG_ADMIN_SECRETS=true"
            )
        if weak_secret:
            raise RuntimeError(
                "ADMIN_JWT_SECRET must be at least 32 characters when "
                "REQUIRE_STRONG_ADMIN_SECRETS=true"
            )
    else:
        if weak_password:
            logger.warning(
                "ADMIN_PASSWORD is a default/weak value — change before production"
            )
        if weak_secret:
            logger.warning(
                "ADMIN_JWT_SECRET is missing or weak — set a 32+ character secret"
            )


def issue_admin_token() -> tuple[str, int]:
    if not settings.admin_jwt_secret:
        raise HTTPException(503, "Admin JWT secret not configured on server")

    now = int(time.time())
    expires_in = settings.admin_jwt_expire_minutes * 60
    payload = {
        "sub": ADMIN_SUBJECT,
        "type": TOKEN_TYPE,
        "iat": now,
        "exp": now + expires_in,
    }
    token = jwt.encode(payload, settings.admin_jwt_secret, algorithm=ALGORITHM)
    return token, expires_in


def decode_admin_token(token: str) -> dict:
    if not settings.admin_jwt_secret:
        raise HTTPException(503, "Admin API not configured")
    try:
        payload = jwt.decode(
            token,
            settings.admin_jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(401, "Session expired — please sign in again") from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, "Invalid admin token") from e

    if payload.get("sub") != ADMIN_SUBJECT or payload.get("type") != TOKEN_TYPE:
        raise HTTPException(401, "Invalid admin token")
    return payload


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not settings.admin_jwt_secret:
        raise HTTPException(503, "Admin API not configured")
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing admin token")
    decode_admin_token(creds.credentials)
