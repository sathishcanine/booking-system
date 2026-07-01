import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.admin_login_limiter import (
    check_login_allowed,
    clear_login_attempts,
    record_login_failure,
)
from app.admin_schemas import (
    AdminLoginOut,
    AuthMeOut,
    OwnerGoogleLoginIn,
    OwnerLoginIn,
    OwnerRegisterIn,
    RenterGoogleLoginIn,
    RenterLoginIn,
    RenterRegisterIn,
)
from app.database import get_db
from app.models import Booking, Organization, OrganizationStatus, User, UserRole
from app.passwords import hash_password, verify_password
from app.config import settings
from app.platform_auth import PlatformUser, issue_platform_token, require_platform_user
from app.timeutil import utc_naive, utcnow

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:200] or "org"


_PERSONAL_EMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "icloud.com",
        "live.com",
        "me.com",
        "aol.com",
        "proton.me",
        "protonmail.com",
    }
)


def _is_personal_email(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower().strip()
    return domain in _PERSONAL_EMAIL_DOMAINS


def _owner_org_name_from_google(
    idinfo: dict,
    *,
    organization_name: str | None,
    email: str,
) -> str:
    """Build a listing brand from Google profile — never a random Workspace label on Gmail."""
    if organization_name and organization_name.strip():
        return organization_name.strip()
    given = (idinfo.get("given_name") or "").strip()
    family = (idinfo.get("family_name") or "").strip()
    personal = f"{given} {family}".strip()
    if len(personal) >= 2:
        return personal
    # Personal inboxes: do not trust Google's top-level "name" (often a company/brand).
    if not _is_personal_email(email):
        name = (idinfo.get("name") or "").strip()
        if len(name) >= 2:
            return name
    local = email.split("@")[0].strip().replace(".", " ").replace("_", " ").title()
    return local if len(local) >= 2 else "My Boats"


def _unique_org_slug(db: Session, base: str) -> str:
    slug = base
    n = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


def _role_str(user: User) -> str:
    if user.role == UserRole.OWNER:
        return "owner"
    if user.role == UserRole.RENTER:
        return "renter"
    return "super_admin"


def _auth_out(user: User, org: Organization | None) -> AdminLoginOut:
    role = _role_str(user)
    platform_user = PlatformUser(
        user_id=user.id,
        role=role,  # type: ignore[arg-type]
        organization_id=user.organization_id,
        email=user.email,
    )
    expires_minutes = (
        settings.renter_jwt_expire_minutes if role == "renter" else settings.admin_jwt_expire_minutes
    )
    token, expires_in = issue_platform_token(platform_user, expires_minutes=expires_minutes)
    return AdminLoginOut(
        token=token,
        expires_in=expires_in,
        role=platform_user.role,
        organization_id=platform_user.organization_id,
        organization_name=org.name if org else None,
        display_name=user.display_name,
        email=user.email,
    )


def _link_past_bookings(db: Session, user: User) -> None:
    db.query(Booking).filter(
        Booking.customer_email == user.email,
        Booking.renter_user_id.is_(None),
    ).update({Booking.renter_user_id: user.id}, synchronize_session=False)
    db.flush()


@router.post("/renter/register", response_model=AdminLoginOut)
def register_renter(body: RenterRegisterIn, request: Request, db: Session = Depends(get_db)):
    check_login_allowed(request)
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        record_login_failure(request)
        raise HTTPException(409, "An account with this email already exists")

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        role=UserRole.RENTER,
        organization_id=None,
        is_active=True,
        created_at=utc_naive(utcnow()),
    )
    db.add(user)
    db.flush()
    _link_past_bookings(db, user)
    db.commit()
    db.refresh(user)
    clear_login_attempts(request)
    return _auth_out(user, None)


@router.post("/renter/google", response_model=AdminLoginOut)
def login_renter_google(body: RenterGoogleLoginIn, db: Session = Depends(get_db)):
    from app.services.google_auth import verify_google_credential

    try:
        idinfo = verify_google_credential(body.credential)
    except ValueError as e:
        raise HTTPException(401, str(e)) from e

    google_sub = idinfo.get("sub")
    email = (idinfo.get("email") or "").lower().strip()
    name = (idinfo.get("name") or email.split("@")[0] or "Guest").strip()
    if not google_sub or not email:
        raise HTTPException(401, "Google account missing required profile information")
    if not idinfo.get("email_verified", True):
        raise HTTPException(401, "Please verify your Google email before signing in")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.role != UserRole.RENTER:
                raise HTTPException(409, "This email is registered as a boat owner or admin account")
            user.google_sub = google_sub
            user.auth_provider = "google"
            if not user.display_name:
                user.display_name = name
        else:
            user = User(
                email=email,
                password_hash=secrets.token_hex(32),
                display_name=name,
                google_sub=google_sub,
                auth_provider="google",
                role=UserRole.RENTER,
                organization_id=None,
                is_active=True,
                created_at=utc_naive(utcnow()),
            )
            db.add(user)
            db.flush()
            _link_past_bookings(db, user)

    if not user.is_active:
        raise HTTPException(403, "Account disabled")
    db.commit()
    db.refresh(user)
    return _auth_out(user, None)


@router.post("/renter/login", response_model=AdminLoginOut)
def login_renter(body: RenterLoginIn, request: Request, db: Session = Depends(get_db)):
    check_login_allowed(request)
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if not user or user.role != UserRole.RENTER:
        record_login_failure(request)
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        record_login_failure(request)
        raise HTTPException(401, "Invalid email or password")
    _link_past_bookings(db, user)
    db.commit()
    clear_login_attempts(request)
    return _auth_out(user, None)


@router.post("/owner/google", response_model=AdminLoginOut)
def login_owner_google(body: OwnerGoogleLoginIn, db: Session = Depends(get_db)):
    from app.services.google_auth import verify_google_credential

    try:
        idinfo = verify_google_credential(body.credential)
    except ValueError as e:
        raise HTTPException(401, str(e)) from e

    google_sub = idinfo.get("sub")
    email = (idinfo.get("email") or "").lower().strip()
    name = (idinfo.get("name") or email.split("@")[0] or "Owner").strip()
    if not google_sub or not email:
        raise HTTPException(401, "Google account missing required profile information")
    if not idinfo.get("email_verified", True):
        raise HTTPException(401, "Please verify your Google email before signing in")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    org: Organization | None = None

    if user and user.role != UserRole.OWNER:
        if user.role == UserRole.RENTER:
            raise HTTPException(
                409,
                "This Google account is registered as a guest renter. "
                "Use a different Google account to list boats, or sign in at /account.",
            )
        raise HTTPException(409, "This email cannot be used for boat owner sign-in")

    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.role == UserRole.OWNER:
                user.google_sub = google_sub
                user.auth_provider = "google"
                if not user.display_name:
                    user.display_name = name
            elif user.role == UserRole.RENTER:
                raise HTTPException(
                    409,
                    "This email is registered as a renter. Use another Google account to list boats.",
                )
            else:
                raise HTTPException(409, "This email cannot be used for boat owner sign-in")
        else:
            org_name = _owner_org_name_from_google(
                idinfo, organization_name=body.organization_name, email=email
            )
            base_slug = _slugify(org_name)
            org = Organization(
                name=org_name,
                slug=_unique_org_slug(db, base_slug),
                status=OrganizationStatus.APPROVED,
                contact_email=email,
                created_at=utc_naive(utcnow()),
            )
            db.add(org)
            db.flush()
            user = User(
                email=email,
                password_hash=hash_password(secrets.token_hex(32)),
                display_name=name,
                google_sub=google_sub,
                auth_provider="google",
                role=UserRole.OWNER,
                organization_id=org.id,
                is_active=True,
                created_at=utc_naive(utcnow()),
            )
            db.add(user)

    if not user.is_active:
        raise HTTPException(403, "Account disabled")

    if user.role != UserRole.OWNER:
        raise HTTPException(403, "Boat owner access required")

    if user.organization_id is None:
        org_name = _owner_org_name_from_google(
            idinfo, organization_name=body.organization_name, email=email
        )
        base_slug = _slugify(org_name)
        org = Organization(
            name=org_name,
            slug=_unique_org_slug(db, base_slug),
            status=OrganizationStatus.APPROVED,
            contact_email=email,
            created_at=utc_naive(utcnow()),
        )
        db.add(org)
        db.flush()
        user.organization_id = org.id

    if user.organization_id and org is None:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org and org.status == OrganizationStatus.SUSPENDED:
            raise HTTPException(403, "This organization has been suspended")

    db.commit()
    db.refresh(user)
    if org is None and user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return _auth_out(user, org)


@router.post("/register", response_model=AdminLoginOut)
def register_owner(body: OwnerRegisterIn, request: Request, db: Session = Depends(get_db)):
    check_login_allowed(request)
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        record_login_failure(request)
        raise HTTPException(409, "An account with this email already exists")

    base_slug = _slugify(body.organization_name)
    org = Organization(
        name=body.organization_name.strip(),
        slug=_unique_org_slug(db, base_slug),
        status=OrganizationStatus.APPROVED,
        contact_email=email,
        created_at=utc_naive(utcnow()),
    )
    db.add(org)
    db.flush()

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.OWNER,
        organization_id=org.id,
        is_active=True,
        created_at=utc_naive(utcnow()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    clear_login_attempts(request)
    return _auth_out(user, org)


@router.post("/login", response_model=AdminLoginOut)
def login_owner(body: OwnerLoginIn, request: Request, db: Session = Depends(get_db)):
    check_login_allowed(request)
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if not user or user.role != UserRole.OWNER:
        record_login_failure(request)
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        record_login_failure(request)
        raise HTTPException(401, "Invalid email or password")

    org = None
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org and org.status == OrganizationStatus.SUSPENDED:
            raise HTTPException(403, "This organization has been suspended")

    clear_login_attempts(request)
    return _auth_out(user, org)


@router.get("/me", response_model=AuthMeOut)
def auth_me(
    user: PlatformUser = Depends(require_platform_user),
    db: Session = Depends(get_db),
):
    if user.user_id is None:
        return AuthMeOut(
            email=user.email or "super@admin",
            role=user.role,
        )
    row = db.query(User).filter(User.id == user.user_id).first()
    if not row:
        raise HTTPException(401, "User not found")
    org = None
    if row.organization_id:
        org = db.query(Organization).filter(Organization.id == row.organization_id).first()
    return AuthMeOut(
        email=row.email,
        role=user.role,
        organization_id=row.organization_id,
        organization_name=org.name if org else None,
        organization_status=org.status.value if org else None,
        display_name=row.display_name,
    )
