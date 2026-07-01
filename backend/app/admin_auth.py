from __future__ import annotations

import logging
import secrets

from fastapi import Depends, HTTPException

from app.config import settings
from app.platform_auth import (
    PlatformUser,
    issue_platform_token,
    require_platform_user,
)

logger = logging.getLogger(__name__)

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
    """Legacy super-admin token (env password login)."""
    user = PlatformUser(
        user_id=None,
        role="super_admin",
        organization_id=None,
        email=None,
    )
    return issue_platform_token(user)


def require_admin(user: PlatformUser = Depends(require_platform_user)) -> PlatformUser:
    if user.role == "renter":
        raise HTTPException(403, "Boat owner or admin access required")
    return user
