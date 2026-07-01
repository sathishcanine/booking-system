from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Literal

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
TOKEN_TYPE = "access"
Role = Literal["owner", "super_admin", "renter"]


@dataclass(frozen=True)
class PlatformUser:
    user_id: int | None
    role: Role
    organization_id: int | None
    email: str | None

    @property
    def is_super_admin(self) -> bool:
        return self.role == "super_admin"


def issue_platform_token(
    user: PlatformUser,
    *,
    expires_minutes: int | None = None,
) -> tuple[str, int]:
    if not settings.admin_jwt_secret:
        raise HTTPException(503, "JWT secret not configured on server")

    now = int(time.time())
    minutes = expires_minutes if expires_minutes is not None else settings.admin_jwt_expire_minutes
    expires_in = minutes * 60
    payload = {
        "sub": str(user.user_id) if user.user_id is not None else "legacy",
        "role": user.role,
        "org_id": user.organization_id,
        "email": user.email,
        "type": TOKEN_TYPE,
        "iat": now,
        "exp": now + expires_in,
    }
    token = jwt.encode(payload, settings.admin_jwt_secret, algorithm=ALGORITHM)
    return token, expires_in


def decode_platform_token(token: str) -> PlatformUser:
    if not settings.admin_jwt_secret:
        raise HTTPException(503, "JWT secret not configured")

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
        raise HTTPException(401, "Invalid token") from e

    if payload.get("type") != TOKEN_TYPE:
        raise HTTPException(401, "Invalid token")

    sub = payload.get("sub")
    role = payload.get("role")
    if role is None and sub in ("admin", "legacy"):
        role = "super_admin"
    elif role not in ("owner", "super_admin", "renter"):
        raise HTTPException(401, "Invalid token role")
    user_id: int | None
    if sub == "legacy":
        user_id = None
    else:
        try:
            user_id = int(sub)
        except (TypeError, ValueError) as e:
            raise HTTPException(401, "Invalid token subject") from e

    org_raw = payload.get("org_id")
    organization_id = int(org_raw) if org_raw is not None else None

    return PlatformUser(
        user_id=user_id,
        role=role,
        organization_id=organization_id,
        email=payload.get("email"),
    )


def require_platform_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> PlatformUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing bearer token")
    return decode_platform_token(creds.credentials)


def require_super_admin(user: PlatformUser = Depends(require_platform_user)) -> PlatformUser:
    if not user.is_super_admin:
        raise HTTPException(403, "Super admin access required")
    return user


def require_owner(user: PlatformUser = Depends(require_platform_user)) -> PlatformUser:
    if user.role != "owner" or user.organization_id is None:
        raise HTTPException(403, "Boat owner access required")
    return user


def require_renter(user: PlatformUser = Depends(require_platform_user)) -> PlatformUser:
    if user.role != "renter" or user.user_id is None:
        raise HTTPException(403, "Sign in to your guest account")
    return user


def optional_renter_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> PlatformUser | None:
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        user = decode_platform_token(creds.credentials)
    except HTTPException:
        return None
    if user.role != "renter":
        return None
    return user
