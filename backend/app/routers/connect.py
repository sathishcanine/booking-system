import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.admin_schemas import ConnectOnboardOut, ConnectStatusOut
from app.config import settings
from app.database import get_db
from app.models import Organization, User
from app.platform_auth import PlatformUser, require_owner
from app.services.connect import (
    connect_configured,
    create_login_link,
    create_onboarding_link,
    ensure_connect_account,
    stripe_connect_user_message,
    sync_connect_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connect", tags=["connect"])


def _status_out(org: Organization | None) -> ConnectStatusOut:
    if not org:
        return ConnectStatusOut(stripe_configured=connect_configured())
    ready = bool(org.stripe_connect_charges_enabled and org.stripe_connect_account_id)
    return ConnectStatusOut(
        stripe_configured=connect_configured(),
        account_id=org.stripe_connect_account_id,
        charges_enabled=org.stripe_connect_charges_enabled,
        payouts_enabled=org.stripe_connect_payouts_enabled,
        details_submitted=org.stripe_connect_details_submitted,
        ready_for_payments=ready,
        dashboard_url=create_login_link(org) if ready else None,
    )


def _owner_org(db: Session, user: PlatformUser) -> Organization:
    if user.organization_id is None:
        raise HTTPException(403, "Organization required")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@router.get("/status", response_model=ConnectStatusOut)
def connect_status(
    user: PlatformUser = Depends(require_owner),
    db: Session = Depends(get_db),
):
    org = _owner_org(db, user)
    if org.stripe_connect_account_id:
        sync_connect_status(db, org)
    return _status_out(org)


@router.post("/onboard", response_model=ConnectOnboardOut)
def connect_onboard(
    user: PlatformUser = Depends(require_owner),
    db: Session = Depends(get_db),
):
    if not connect_configured():
        raise HTTPException(503, "Stripe is not configured on the server")

    org = _owner_org(db, user)
    owner = db.query(User).filter(User.id == user.user_id).first() if user.user_id else None
    email = owner.email if owner else org.contact_email

    try:
        ensure_connect_account(db, org, email=email)
        base = settings.frontend_url.rstrip("/")
        url = create_onboarding_link(
            org,
            refresh_url=f"{base}/owner/payouts?connect=refresh",
            return_url=f"{base}/owner/payouts?connect=return",
        )
    except Exception as e:
        logger.exception("Connect onboard failed for org %s", org.id)
        raise HTTPException(502, stripe_connect_user_message(e)) from e

    return ConnectOnboardOut(url=url)


@router.post("/refresh", response_model=ConnectStatusOut)
def connect_refresh(
    user: PlatformUser = Depends(require_owner),
    db: Session = Depends(get_db),
):
    org = _owner_org(db, user)
    if org.stripe_connect_account_id:
        sync_connect_status(db, org)
    return _status_out(org)
