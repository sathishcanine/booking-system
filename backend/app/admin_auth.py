import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


def verify_admin_password(password: str) -> bool:
    if not settings.admin_password:
        return False
    return secrets.compare_digest(password, settings.admin_password)


def issue_admin_token() -> str:
    if not settings.admin_api_key:
        raise HTTPException(503, "Admin API key not configured on server")
    return settings.admin_api_key


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(503, "Admin API not configured")
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing admin token")
    if not secrets.compare_digest(creds.credentials, settings.admin_api_key):
        raise HTTPException(401, "Invalid admin token")
