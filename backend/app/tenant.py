"""Multi-tenant query helpers for marketplace Phase 1."""

from __future__ import annotations

from typing import Literal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.config import settings
from app.models import Activity, Booking, Captain, Organization, PromoCode, Slot, TicketType, User
from app.platform_auth import PlatformUser

DashboardScope = Literal["overall", "own"]


def hydrate_platform_user(db: Session, user: PlatformUser) -> PlatformUser:
    """Reload role/org from the database so stale JWTs cannot leak cross-tenant data."""
    if user.user_id is None:
        return user
    row = db.query(User).filter(User.id == user.user_id).first()
    if not row:
        return user
    return PlatformUser(
        user_id=row.id,
        role=row.role.value,  # type: ignore[arg-type]
        organization_id=row.organization_id,
        email=row.email,
    )


def super_admin_own_org_id(db: Session, user: PlatformUser) -> int | None:
    """Organization whose listings belong to this platform admin."""
    if user.organization_id is not None:
        return user.organization_id

    email = (user.email or settings.super_admin_email or "").lower().strip()
    if email:
        org = (
            db.query(Organization)
            .filter(func.lower(Organization.contact_email) == email)
            .order_by(Organization.id)
            .first()
        )
        if org:
            return org.id

    org = db.query(Organization).order_by(Organization.id).first()
    return org.id if org else None


def dashboard_organization_id(
    db: Session,
    user: PlatformUser,
    *,
    scope: DashboardScope = "overall",
) -> int | None:
    if not user.is_super_admin:
        if user.organization_id is None:
            raise HTTPException(403, "Organization context required")
        return user.organization_id
    if scope == "own":
        org_id = super_admin_own_org_id(db, user)
        if org_id is None:
            raise HTTPException(404, "No organization linked to this admin account")
        return org_id
    return None


def _tenant_org_id(user: PlatformUser) -> int:
    if user.organization_id is None:
        raise HTTPException(403, "Organization context required")
    return user.organization_id


def activities_query(db: Session, user: PlatformUser) -> Query:
    q = db.query(Activity)
    if not user.is_super_admin:
        q = q.filter(Activity.organization_id == _tenant_org_id(user))
    return q


def get_activity(db: Session, user: PlatformUser, activity_id: int) -> Activity:
    act = activities_query(db, user).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(404, "Boat not found")
    return act


def slots_query(db: Session, user: PlatformUser) -> Query:
    q = db.query(Slot).join(Activity, Slot.activity_id == Activity.id)
    if not user.is_super_admin:
        q = q.filter(Activity.organization_id == _tenant_org_id(user))
    return q


def get_slot(db: Session, user: PlatformUser, slot_id: int) -> Slot:
    slot = slots_query(db, user).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Booking slot not found")
    return slot


def promos_query(db: Session, user: PlatformUser) -> Query:
    q = db.query(PromoCode)
    if not user.is_super_admin:
        q = q.filter(PromoCode.organization_id == _tenant_org_id(user))
    return q


def get_promo(db: Session, user: PlatformUser, promo_id: int) -> PromoCode:
    promo = promos_query(db, user).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promo code not found")
    return promo


def bookings_query(db: Session, user: PlatformUser) -> Query:
    q = (
        db.query(Booking)
        .join(Slot, Booking.slot_id == Slot.id)
        .join(Activity, Slot.activity_id == Activity.id)
    )
    if not user.is_super_admin:
        q = q.filter(Activity.organization_id == _tenant_org_id(user))
    return q


def get_booking(db: Session, user: PlatformUser, booking_id: int) -> Booking:
    booking = bookings_query(db, user).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


def assert_org_id(user: PlatformUser) -> int:
    if user.organization_id is None:
        raise HTTPException(403, "Organization context required")
    return user.organization_id


def resolve_org_id(db: Session, user: PlatformUser) -> int:
    user = hydrate_platform_user(db, user)
    if user.is_super_admin:
        org = db.query(Organization).order_by(Organization.id).first()
        if not org:
            raise HTTPException(503, "No organization configured")
        return org.id
    return _tenant_org_id(user)


def captains_query(db: Session, user: PlatformUser) -> Query:
    q = db.query(Captain)
    if not user.is_super_admin:
        q = q.filter(Captain.organization_id == _tenant_org_id(user))
    return q


def get_captain(db: Session, user: PlatformUser, captain_id: int) -> Captain:
    captain = captains_query(db, user).filter(Captain.id == captain_id).first()
    if not captain:
        raise HTTPException(404, "Captain not found")
    return captain


def get_ticket_type(db: Session, user: PlatformUser, ticket_type_id: int) -> TicketType:
    q = (
        db.query(TicketType)
        .join(Activity, TicketType.activity_id == Activity.id)
        .filter(TicketType.id == ticket_type_id)
    )
    if not user.is_super_admin:
        q = q.filter(Activity.organization_id == _tenant_org_id(user))
    tt = q.first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    return tt
