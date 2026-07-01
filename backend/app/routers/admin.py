import re
from datetime import datetime, time

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.admin_auth import require_admin, verify_admin_password
from app.admin_login_limiter import (
    check_login_allowed,
    clear_login_attempts,
    record_login_failure,
)
from app.admin_schemas import (
    AdminActivityIn,
    AdminActivityListItem,
    AdminActivityOut,
    AdminBookingItemOut,
    AdminBookingDetailOut,
    AdminBookingOut,
    AdminBulkSlotsIn,
    AdminCaptainIn,
    AdminCaptainOut,
    AdminDashboardOut,
    AdminOrganizationListItem,
    ConnectStatusOut,
    EarningsBookingOut,
    EarningsOut,
    AdminCancelBookingIn,
    AdminLoginIn,
    AdminLoginOut,
    CancelBookingOut,
    PlatformSettingsIn,
    PlatformSettingsOut,
    AdminPromoIn,
    AdminPromoOut,
    AdminReviewOut,
    AdminReviewRespondIn,
    AdminSlotIn,
    AdminSlotOut,
    AdminTicketTypeIn,
    AdminTicketTypeOut,
    AdminUploadOut,
)
from app.database import get_db
from app.marketplace_config import MARKET_CITY, MARKET_LABEL, MARKET_STATE
from app.models import (
    Activity,
    Booking,
    BookingItem,
    BookingStatus,
    Captain,
    ListingStatus,
    Organization,
    PromoCode,
    Review,
    Slot,
    TicketType,
)
from app.services.captains import compute_captain_stats, slugify_captain, unique_captain_slug
from app.platform_auth import PlatformUser, issue_platform_token, require_super_admin
from app.services.cancellation import apply_cancellation
from app.services.listing_uploads import save_captain_photo, save_listing_photo
from app.tenant import (
    DashboardScope,
    activities_query,
    captains_query,
    dashboard_organization_id,
    hydrate_platform_user,
    bookings_query,
    get_activity as load_activity,
    get_captain,
    get_promo,
    get_slot,
    get_ticket_type,
    promos_query,
    resolve_org_id,
    slots_query,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:200] or "tour"


def _unique_slug(db: Session, base: str, org_id: int, exclude_id: int | None = None) -> str:
    slug = base
    n = 1
    while True:
        q = db.query(Activity).filter(Activity.slug == slug, Activity.organization_id == org_id)
        if exclude_id:
            q = q.filter(Activity.id != exclude_id)
        if not q.first():
            return slug
        n += 1
        slug = f"{base}-{n}"


def _parse_hm(value: str) -> time:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise HTTPException(400, "Time must be HH:MM")
    return time(int(parts[0]), int(parts[1]))


def _apply_activity_fields(act: Activity, body: AdminActivityIn) -> None:
    act.title = body.title.strip()
    act.description = body.description
    act.duration_minutes = body.duration_minutes
    act.emoji = body.emoji
    act.meeting_instructions = body.meeting_instructions
    act.is_active = body.is_active
    act.max_guests = body.max_guests
    act.boat_type = body.boat_type
    act.boat_make = body.boat_make.strip()
    act.boat_model = body.boat_model.strip()
    act.marina_name = body.marina_name
    act.city = MARKET_CITY
    act.state = MARKET_STATE
    act.location_label = body.location_label.strip() if body.location_label and body.location_label.strip() else MARKET_LABEL
    act.captain_required = body.captain_required
    act.hourly_rate_cents = body.hourly_rate_cents
    act.length_ft = body.length_ft
    act.min_rental_hours = body.min_rental_hours
    act.max_rental_hours = max(body.max_rental_hours, body.min_rental_hours)
    act.instant_book = body.instant_book
    act.bareboat_allowed = body.bareboat_allowed
    act.activity_tags = json_list_to_db(body.activity_tags)
    act.amenities = json_list_to_db(body.amenities)
    act.photo_urls = json_list_to_db(body.photo_urls)
    photos = body.photo_urls or []
    act.image_url = body.image_url or (photos[0] if photos else None)


def _activity_out(act: Activity) -> AdminActivityOut:
    tickets = sorted(act.ticket_types, key=lambda t: t.sort_order)
    return AdminActivityOut(
        id=act.id,
        title=act.title,
        slug=act.slug,
        description=act.description,
        duration_minutes=act.duration_minutes,
        location_label=act.location_label,
        image_url=act.image_url,
        emoji=act.emoji,
        meeting_instructions=act.meeting_instructions,
        is_active=act.is_active,
        listing_status=act.listing_status.value,
        max_guests=act.max_guests,
        boat_type=act.boat_type,
        boat_make=act.boat_make,
        boat_model=act.boat_model,
        marina_name=act.marina_name,
        city=act.city,
        state=act.state,
        amenities=json_list_from_db(act.amenities),
        photo_urls=json_list_from_db(act.photo_urls),
        captain_required=act.captain_required,
        hourly_rate_cents=act.hourly_rate_cents,
        length_ft=act.length_ft,
        min_rental_hours=act.min_rental_hours or 2,
        max_rental_hours=act.max_rental_hours or 8,
        instant_book=bool(act.instant_book),
        bareboat_allowed=bool(act.bareboat_allowed),
        activity_tags=json_list_from_db(act.activity_tags),
        ticket_types=[AdminTicketTypeOut.model_validate(t) for t in tickets],
    )


def _slot_out(slot: Slot) -> AdminSlotOut:
    return AdminSlotOut(
        id=slot.id,
        activity_id=slot.activity_id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        capacity=slot.capacity,
        booked_count=slot.booked_count,
        waitlist_enabled=slot.waitlist_enabled,
        promo_text=slot.promo_text,
        card_image_url=slot.card_image_url,
        card_description=slot.card_description,
        is_call_to_book=slot.is_call_to_book,
        call_phone=slot.call_phone,
        brand_label=slot.brand_label,
        urgency_text=slot.urgency_text,
        booking_cutoff_hours=slot.booking_cutoff_hours,
        is_cancelled=slot.is_cancelled,
        activity_title=slot.activity.title if slot.activity else None,
    )


def _login_out(
    user: PlatformUser,
    email: str | None = None,
    org_name: str | None = None,
    display_name: str | None = None,
) -> AdminLoginOut:
    token, expires_in = issue_platform_token(user)
    return AdminLoginOut(
        token=token,
        expires_in=expires_in,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org_name,
        display_name=display_name,
        email=email or user.email,
    )


@router.post("/login", response_model=AdminLoginOut)
def admin_login(body: AdminLoginIn, request: Request):
    check_login_allowed(request)
    if not verify_admin_password(body.password):
        record_login_failure(request)
        raise HTTPException(401, "Invalid password")
    clear_login_attempts(request)
    user = PlatformUser(user_id=None, role="super_admin", organization_id=None, email=None)
    return _login_out(user)


@router.post("/refresh", response_model=AdminLoginOut)
def admin_refresh(user: PlatformUser = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models import Organization, User

    user = hydrate_platform_user(db, user)
    org_name = None
    display_name = None
    if user.user_id is not None:
        row = db.query(User).filter(User.id == user.user_id).first()
        display_name = row.display_name if row else None
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        org_name = org.name if org else None
    return _login_out(user, org_name=org_name, display_name=display_name)


@router.get("/dashboard", response_model=AdminDashboardOut)
def admin_dashboard(
    scope: DashboardScope = Query("overall", pattern="^(overall|own)$"),
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.admin_analytics import build_admin_dashboard

    user = hydrate_platform_user(db, user)
    if not user.is_super_admin and scope == "own":
        scope = "overall"
    org_id = dashboard_organization_id(db, user, scope=scope)
    return build_admin_dashboard(db, organization_id=org_id)


@router.post("/uploads/listing-photo", response_model=AdminUploadOut)
async def upload_listing_photo(
    request: Request,
    file: UploadFile = File(...),
    user: PlatformUser = Depends(require_admin),
):
    _ = user
    # Relative URL so photos work through the frontend dev proxy / single ngrok tunnel.
    url = await save_listing_photo(file, "")
    return AdminUploadOut(url=url)


@router.post("/uploads/captain-photo", response_model=AdminUploadOut)
async def upload_captain_photo(
    file: UploadFile = File(...),
    user: PlatformUser = Depends(require_admin),
):
    _ = user
    url = await save_captain_photo(file, "")
    return AdminUploadOut(url=url)


# --- Activities ---


@router.get("/activities", response_model=list[AdminActivityListItem])
def list_activities(user: PlatformUser = Depends(require_admin), db: Session = Depends(get_db)):
    user = hydrate_platform_user(db, user)
    rows = (
        activities_query(db, user)
        .options(joinedload(Activity.organization))
        .order_by(Activity.title)
        .all()
    )
    out: list[AdminActivityListItem] = []
    for a in rows:
        out.append(
            AdminActivityListItem(
                id=a.id,
                title=a.title,
                slug=a.slug,
                location_label=a.location_label,
                city=a.city,
                duration_minutes=a.duration_minutes,
                is_active=a.is_active,
                listing_status=a.listing_status.value,
                boat_type=a.boat_type,
                max_guests=a.max_guests,
                hourly_rate_cents=a.hourly_rate_cents,
                organization_name=a.organization.name if a.organization else None,
                ticket_type_count=len(a.ticket_types),
                slot_count=db.query(Slot).filter(Slot.activity_id == a.id).count(),
            )
        )
    return out


@router.get("/activities/{activity_id}", response_model=AdminActivityOut)
def get_activity(
    activity_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = hydrate_platform_user(db, user)
    act = (
        activities_query(db, user)
        .options(joinedload(Activity.ticket_types))
        .filter(Activity.id == activity_id)
        .first()
    )
    if not act:
        raise HTTPException(404, "Activity not found")
    return _activity_out(act)


@router.post("/activities", response_model=AdminActivityOut)
def create_activity(
    body: AdminActivityIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = hydrate_platform_user(db, user)
    org_id = resolve_org_id(db, user)
    base_slug = body.slug or _slugify(body.title)
    act = Activity(
        organization_id=org_id,
        slug=_unique_slug(db, base_slug, org_id),
        listing_status=(
            ListingStatus.PUBLISHED if user.is_super_admin else ListingStatus.DRAFT
        ),
    )
    _apply_activity_fields(act, body)
    db.add(act)
    db.flush()
    _ensure_listing_pricing(db, act)
    db.commit()
    db.refresh(act)
    return get_activity(act.id, user, db)


@router.put("/activities/{activity_id}", response_model=AdminActivityOut)
def update_activity(
    activity_id: int,
    body: AdminActivityIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = hydrate_platform_user(db, user)
    act = load_activity(db, user, activity_id)
    if body.slug:
        act.slug = _unique_slug(db, body.slug, act.organization_id, exclude_id=activity_id)
    _apply_activity_fields(act, body)
    _ensure_listing_pricing(db, act)
    db.commit()
    return get_activity(activity_id, user, db)


def _ensure_listing_pricing(db: Session, act: Activity) -> None:
    """Boat rentals use hourly_rate_cents in the owner form; sync a ticket row for checkout."""
    if act.ticket_types:
        return
    if act.hourly_rate_cents and act.hourly_rate_cents > 0:
        from app.services.boat_rental import ensure_rental_ticket_type

        ensure_rental_ticket_type(db, act)


def _require_listing_ready(act: Activity) -> None:
    if not act.title.strip():
        raise HTTPException(400, "Boat title is required")
    if not (act.boat_make or "").strip():
        raise HTTPException(400, "Boat make is required before publishing")
    if not (act.boat_model or "").strip():
        raise HTTPException(400, "Boat model is required before publishing")
    if not act.description:
        raise HTTPException(400, "Description is required before publishing")
    if not act.max_guests:
        raise HTTPException(400, "Max guests is required before publishing")
    photos = json_list_from_db(act.photo_urls)
    if not photos and not act.image_url:
        raise HTTPException(400, "At least one photo is required before publishing")
    has_pricing = bool(act.ticket_types) or bool(act.hourly_rate_cents and act.hourly_rate_cents > 0)
    if not has_pricing:
        raise HTTPException(400, "Set an hourly rate before publishing")


@router.post("/activities/{activity_id}/submit-review", response_model=AdminActivityOut)
def submit_listing_for_review(
    activity_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user.is_super_admin:
        raise HTTPException(400, "Super admins can publish directly")
    act = (
        activities_query(db, user)
        .options(joinedload(Activity.ticket_types))
        .filter(Activity.id == activity_id)
        .first()
    )
    if not act:
        raise HTTPException(404, "Boat not found")
    if act.listing_status not in (ListingStatus.DRAFT, ListingStatus.DELISTED):
        raise HTTPException(400, "Only draft or delisted boats can be submitted")
    _ensure_listing_pricing(db, act)
    _require_listing_ready(act)
    act.listing_status = ListingStatus.PENDING_REVIEW
    db.commit()
    return get_activity(activity_id, user, db)


@router.post("/activities/{activity_id}/approve", response_model=AdminActivityOut)
def approve_listing(
    activity_id: int,
    user: PlatformUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    act = (
        db.query(Activity)
        .options(joinedload(Activity.ticket_types))
        .filter(Activity.id == activity_id)
        .first()
    )
    if not act:
        raise HTTPException(404, "Boat not found")
    if act.listing_status != ListingStatus.PENDING_REVIEW:
        raise HTTPException(400, "Only pending listings can be approved")
    _ensure_listing_pricing(db, act)
    _require_listing_ready(act)
    act.listing_status = ListingStatus.PUBLISHED
    act.is_active = True
    db.commit()
    return _activity_out(act)


@router.post("/activities/{activity_id}/reject", response_model=AdminActivityOut)
def reject_listing(
    activity_id: int,
    user: PlatformUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(404, "Boat not found")
    if act.listing_status != ListingStatus.PENDING_REVIEW:
        raise HTTPException(400, "Only pending listings can be rejected")
    act.listing_status = ListingStatus.DRAFT
    db.commit()
    db.refresh(act)
    return _activity_out(act)


@router.post("/activities/{activity_id}/delist", response_model=AdminActivityOut)
def delist_boat(
    activity_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    act = load_activity(db, user, activity_id)
    if act.listing_status != ListingStatus.PUBLISHED:
        raise HTTPException(400, "Only published boats can be delisted")
    act.listing_status = ListingStatus.DELISTED
    db.commit()
    db.refresh(act)
    return _activity_out(act)


@router.delete("/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    act = load_activity(db, user, activity_id)
    paid = (
        bookings_query(db, user)
        .filter(Slot.activity_id == activity_id, Booking.status == BookingStatus.PAID)
        .count()
    )
    if paid > 0:
        act.is_active = False
        db.commit()
        return {"ok": True, "deactivated": True, "message": "Has paid bookings — marked inactive"}
    db.query(Slot).filter(Slot.activity_id == activity_id).delete()
    db.query(TicketType).filter(TicketType.activity_id == activity_id).delete()
    db.delete(act)
    db.commit()
    return {"ok": True, "deactivated": False}


# --- Ticket types ---


@router.post("/activities/{activity_id}/ticket-types", response_model=AdminTicketTypeOut)
def create_ticket_type(
    activity_id: int,
    body: AdminTicketTypeIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    load_activity(db, user, activity_id)
    tt = TicketType(activity_id=activity_id, **body.model_dump())
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return AdminTicketTypeOut.model_validate(tt)


@router.put("/ticket-types/{ticket_type_id}", response_model=AdminTicketTypeOut)
def update_ticket_type(
    ticket_type_id: int,
    body: AdminTicketTypeIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tt = get_ticket_type(db, user, ticket_type_id)
    for k, v in body.model_dump().items():
        setattr(tt, k, v)
    db.commit()
    db.refresh(tt)
    return AdminTicketTypeOut.model_validate(tt)


@router.delete("/ticket-types/{ticket_type_id}")
def delete_ticket_type(
    ticket_type_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tt = get_ticket_type(db, user, ticket_type_id)
    used = (
        db.query(BookingItem)
        .filter(BookingItem.ticket_type_id == ticket_type_id)
        .count()
    )
    if used > 0:
        raise HTTPException(400, "Cannot delete — used in existing bookings")
    db.delete(tt)
    db.commit()
    return {"ok": True}


# --- Slots ---


@router.get("/slots", response_model=list[AdminSlotOut])
def list_slots(
    year: int | None = None,
    month: int | None = None,
    activity_id: int | None = None,
    include_cancelled: bool = False,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = slots_query(db, user).options(joinedload(Slot.activity))
    if not include_cancelled:
        q = q.filter(Slot.is_cancelled.is_(False))
    if activity_id:
        load_activity(db, user, activity_id)
        q = q.filter(Slot.activity_id == activity_id)
    if year and month:
        start = datetime(year, month, 1)
        if month == 12:
            end = datetime(year + 1, 1, 1)
        else:
            end = datetime(year, month + 1, 1)
        q = q.filter(Slot.starts_at >= start, Slot.starts_at < end)
    q = q.order_by(Slot.starts_at)
    return [_slot_out(s) for s in q.all()]


@router.post("/slots", response_model=AdminSlotOut)
def create_slot(
    body: AdminSlotIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.ends_at <= body.starts_at:
        raise HTTPException(400, "End time must be after start time")
    act = load_activity(db, user, body.activity_id)
    slot = Slot(**body.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    slot.activity = act
    return _slot_out(slot)


@router.post("/slots/bulk", response_model=list[AdminSlotOut])
def bulk_create_slots(
    body: AdminBulkSlotsIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    act = load_activity(db, user, body.activity_id)
    start_t = _parse_hm(body.start_time)
    end_t = _parse_hm(body.end_time)
    created: list[AdminSlotOut] = []
    for d in body.dates:
        starts = datetime.combine(d, start_t)
        ends = datetime.combine(d, end_t)
        if ends <= starts:
            raise HTTPException(400, f"Invalid times for {d}")
        slot = Slot(
            activity_id=body.activity_id,
            starts_at=starts,
            ends_at=ends,
            capacity=body.capacity,
            waitlist_enabled=body.waitlist_enabled,
            promo_text=body.promo_text,
            card_description=body.card_description,
            is_call_to_book=body.is_call_to_book,
            call_phone=body.call_phone,
            brand_label=body.brand_label,
            urgency_text=body.urgency_text,
            booking_cutoff_hours=body.booking_cutoff_hours,
        )
        db.add(slot)
        db.flush()
        slot.activity = act
        created.append(_slot_out(slot))
    db.commit()
    return created


@router.put("/slots/{slot_id}", response_model=AdminSlotOut)
def update_slot(
    slot_id: int,
    body: AdminSlotIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    slot = get_slot(db, user, slot_id)
    load_activity(db, user, body.activity_id)
    if body.ends_at <= body.starts_at:
        raise HTTPException(400, "End time must be after start time")
    if body.capacity < slot.booked_count:
        raise HTTPException(400, f"Capacity cannot be below {slot.booked_count} already booked")
    for k, v in body.model_dump().items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    slot = (
        slots_query(db, user)
        .options(joinedload(Slot.activity))
        .filter(Slot.id == slot_id)
        .first()
    )
    return _slot_out(slot)


@router.delete("/slots/{slot_id}")
def delete_slot(
    slot_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    slot = get_slot(db, user, slot_id)
    slot.is_cancelled = True
    db.commit()
    return {"ok": True, "cancelled": True}


@router.post("/slots/{slot_id}/restore")
def restore_slot(
    slot_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    slot = get_slot(db, user, slot_id)
    slot.is_cancelled = False
    db.commit()
    return {"ok": True}


# --- Promos ---


@router.get("/promos", response_model=list[AdminPromoOut])
def list_promos(user: PlatformUser = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        AdminPromoOut.model_validate(p)
        for p in promos_query(db, user).order_by(PromoCode.code).all()
    ]


@router.post("/promos", response_model=AdminPromoOut)
def create_promo(
    body: AdminPromoIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not body.discount_percent and not body.discount_cents:
        raise HTTPException(400, "Set discount_percent or discount_cents")
    code = body.code.upper().strip()
    org_id = None if user.is_super_admin else resolve_org_id(db, user)
    q = promos_query(db, user).filter(PromoCode.code == code)
    if org_id is not None:
        q = q.filter(PromoCode.organization_id == org_id)
    if q.first():
        raise HTTPException(400, "Promo code already exists")
    promo = PromoCode(
        organization_id=org_id,
        code=code,
        **{k: v for k, v in body.model_dump().items() if k != "code"},
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return AdminPromoOut.model_validate(promo)


@router.put("/promos/{promo_id}", response_model=AdminPromoOut)
def update_promo(
    promo_id: int,
    body: AdminPromoIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promo = get_promo(db, user, promo_id)
    if not body.discount_percent and not body.discount_cents:
        raise HTTPException(400, "Set discount_percent or discount_cents")
    promo.code = body.code.upper().strip()
    promo.discount_percent = body.discount_percent
    promo.discount_cents = body.discount_cents
    promo.max_uses = body.max_uses
    promo.valid_until = body.valid_until
    promo.is_active = body.is_active
    db.commit()
    db.refresh(promo)
    return AdminPromoOut.model_validate(promo)


@router.post("/promos/{promo_id}/reset-usage")
def reset_promo_usage(
    promo_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promo = get_promo(db, user, promo_id)
    promo.used_count = 0
    db.commit()
    db.refresh(promo)
    return AdminPromoOut.model_validate(promo)


@router.delete("/promos/{promo_id}")
def delete_promo(
    promo_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promo = get_promo(db, user, promo_id)
    db.delete(promo)
    db.commit()
    return {"ok": True}


# --- Captains ---


def _captain_out(db: Session, captain: Captain) -> AdminCaptainOut:
    stats = compute_captain_stats(db, captain)
    return AdminCaptainOut(
        id=captain.id,
        organization_id=captain.organization_id,
        organization_name=captain.organization.name if captain.organization else None,
        slug=captain.slug,
        name=captain.name,
        bio=captain.bio,
        location=captain.location,
        photo_url=captain.photo_url,
        rating=stats["rating"],
        review_count=stats["review_count"],
        trips_completed=stats["trips_completed"],
        coast_guard_verified=captain.coast_guard_verified,
        phone_verified=captain.phone_verified,
        aboard_since_year=stats["aboard_since_year"],
        is_active=captain.is_active,
    )


def _resolve_captain_org_id(
    db: Session, user: PlatformUser, body: AdminCaptainIn
) -> int:
    user = hydrate_platform_user(db, user)
    if user.is_super_admin:
        if body.organization_id is None:
            raise HTTPException(400, "organization_id is required for platform admins")
        org = db.query(Organization).filter(Organization.id == body.organization_id).first()
        if not org:
            raise HTTPException(400, "Organization not found")
        return org.id
    return resolve_org_id(db, user)


def _apply_captain_fields(captain: Captain, body: AdminCaptainIn) -> None:
    captain.name = body.name.strip()
    captain.bio = body.bio
    captain.location = MARKET_LABEL
    captain.photo_url = body.photo_url
    captain.coast_guard_verified = body.coast_guard_verified
    captain.phone_verified = body.phone_verified
    captain.is_active = body.is_active


@router.get("/organizations", response_model=list[AdminOrganizationListItem])
def list_organizations(
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not user.is_super_admin:
        raise HTTPException(403, "Super admin only")
    return [
        AdminOrganizationListItem.model_validate(o)
        for o in db.query(Organization).order_by(Organization.name).all()
    ]


@router.get("/captains", response_model=list[AdminCaptainOut])
def list_captains(user: PlatformUser = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        captains_query(db, user)
        .options(joinedload(Captain.organization))
        .order_by(Captain.name)
        .all()
    )
    return [_captain_out(db, c) for c in rows]


@router.post("/captains", response_model=AdminCaptainOut)
def create_captain(
    body: AdminCaptainIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org_id = _resolve_captain_org_id(db, user, body)
    base_slug = body.slug or slugify_captain(body.name)
    from app.timeutil import utcnow

    captain = Captain(
        organization_id=org_id,
        slug=unique_captain_slug(db, base_slug, org_id),
        created_at=utcnow(),
    )
    _apply_captain_fields(captain, body)
    db.add(captain)
    db.commit()
    db.refresh(captain)
    captain = (
        captains_query(db, user)
        .options(joinedload(Captain.organization))
        .filter(Captain.id == captain.id)
        .first()
    )
    return _captain_out(db, captain)


@router.put("/captains/{captain_id}", response_model=AdminCaptainOut)
def update_captain(
    captain_id: int,
    body: AdminCaptainIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    captain = get_captain(db, user, captain_id)
    if body.slug:
        captain.slug = unique_captain_slug(
            db, body.slug, captain.organization_id, exclude_id=captain.id
        )
    _apply_captain_fields(captain, body)
    db.commit()
    db.refresh(captain)
    captain = (
        captains_query(db, user)
        .options(joinedload(Captain.organization))
        .filter(Captain.id == captain.id)
        .first()
    )
    return _captain_out(db, captain)


@router.delete("/captains/{captain_id}")
def delete_captain(
    captain_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    captain = get_captain(db, user, captain_id)
    linked = (
        db.query(Activity)
        .filter(Activity.default_captain_id == captain.id)
        .count()
    )
    if linked:
        raise HTTPException(
            400,
            "Captain is assigned as default on one or more boats. Reassign those boats first.",
        )
    db.delete(captain)
    db.commit()
    return {"ok": True}


# --- Bookings ---


def _booking_activity(booking: Booking, db: Session) -> Activity | None:
    if booking.slot and booking.slot.activity:
        return booking.slot.activity
    if booking.activity_id:
        return db.query(Activity).filter(Activity.id == booking.activity_id).first()
    return None


def _booking_departure_at(booking: Booking) -> datetime:
    if booking.booking_kind == "rental" and booking.rental_starts_at:
        return booking.rental_starts_at
    if booking.slot:
        return booking.slot.starts_at
    return booking.created_at


def _admin_booking_items(booking: Booking) -> list[AdminBookingItemOut]:
    return [
        AdminBookingItemOut(
            ticket_name=i.ticket_type.name if i.ticket_type else "?",
            quantity=i.quantity,
            unit_price_cents=i.unit_price_cents,
        )
        for i in booking.items
    ]


def _admin_booking_base(booking: Booking, db: Session) -> dict:
    act = _booking_activity(booking, db)
    return {
        "id": booking.id,
        "reference": booking.reference,
        "status": booking.status.value,
        "customer_name": booking.customer_name,
        "customer_email": booking.customer_email,
        "customer_phone": booking.customer_phone,
        "total_cents": booking.total_cents,
        "is_waitlist": booking.is_waitlist,
        "created_at": booking.created_at,
        "slot_id": booking.slot_id,
        "activity_title": act.title if act else "",
        "slot_starts_at": _booking_departure_at(booking),
        "refund_cents": booking.refund_cents,
        "cancelled_at": booking.cancelled_at,
        "cancelled_by": booking.cancelled_by,
        "items": _admin_booking_items(booking),
    }


def _admin_booking_detail_out(booking: Booking, db: Session) -> AdminBookingDetailOut:
    act = _booking_activity(booking, db)
    org_name = act.organization.name if act and act.organization else None
    captain_name: str | None = None
    if booking.captain_id:
        cap = db.query(Captain).filter(Captain.id == booking.captain_id).first()
        captain_name = cap.name if cap else None
    return AdminBookingDetailOut(
        **_admin_booking_base(booking, db),
        booking_kind=booking.booking_kind,
        activity_slug=act.slug if act else None,
        organization_name=org_name,
        rental_starts_at=booking.rental_starts_at,
        duration_hours=booking.duration_hours,
        passenger_count=booking.passenger_count,
        captain_included=booking.captain_included,
        captain_name=captain_name,
        boat_price_cents=booking.boat_price_cents,
        captain_price_cents=booking.captain_price_cents,
        insurance_cents=booking.insurance_cents,
        addon_cents=booking.addon_cents,
        subtotal_cents=booking.subtotal_cents,
        discount_cents=booking.discount_cents,
        tax_cents=booking.tax_cents,
        platform_fee_cents=booking.platform_fee_cents,
        owner_payout_cents=booking.owner_payout_cents,
        promo_code=booking.promo_code,
        cancellation_reason=booking.cancellation_reason,
        stripe_refund_id=booking.stripe_refund_id,
        comments=booking.comments,
        heard_about=booking.heard_about,
        been_before=booking.been_before,
        marketing_opt_in=booking.marketing_opt_in,
    )


@router.get("/bookings", response_model=list[AdminBookingOut])
def list_bookings(
    status: str | None = None,
    slot_id: int | None = None,
    limit: int = 100,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = (
        bookings_query(db, user)
        .options(
            joinedload(Booking.items).joinedload(BookingItem.ticket_type),
            joinedload(Booking.slot).joinedload(Slot.activity),
        )
        .order_by(Booking.created_at.desc())
        .limit(min(limit, 500))
    )
    if status:
        try:
            st = BookingStatus(status)
            q = q.filter(Booking.status == st)
        except ValueError:
            raise HTTPException(400, "Invalid status") from None
    if slot_id:
        get_slot(db, user, slot_id)
        q = q.filter(Booking.slot_id == slot_id)
    rows = q.all()
    return [AdminBookingOut(**_admin_booking_base(b, db)) for b in rows]


@router.get("/bookings/{booking_id}", response_model=AdminBookingDetailOut)
def get_booking_detail(
    booking_id: int,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = (
        bookings_query(db, user)
        .options(
            joinedload(Booking.items).joinedload(BookingItem.ticket_type),
            joinedload(Booking.slot).joinedload(Slot.activity).joinedload(Activity.organization),
            joinedload(Booking.activity).joinedload(Activity.organization),
        )
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    return _admin_booking_detail_out(booking, db)


@router.patch("/bookings/{booking_id}/cancel", response_model=CancelBookingOut)
def cancel_booking(
    booking_id: int,
    body: AdminCancelBookingIn | None = None,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = (
        bookings_query(db, user)
        .options(joinedload(Booking.items))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(404, "Booking not found")

    cancelled_by = "owner" if user.role == "owner" else "admin"
    opts = body or AdminCancelBookingIn()
    try:
        booking = apply_cancellation(
            db,
            booking,
            cancelled_by=cancelled_by,
            reason=opts.reason,
            force_full_refund=opts.full_refund,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    msg = None
    if booking.refund_cents > 0:
        msg = f"Refund of ${booking.refund_cents / 100:.2f} initiated"
    elif booking.total_cents > 0 and booking.status == BookingStatus.CANCELLED:
        msg = "Cancelled with no refund per policy"

    return CancelBookingOut(
        reference=booking.reference,
        status=booking.status.value,
        refund_cents=booking.refund_cents,
        message=msg,
    )


# --- Platform settings (super admin) ---


@router.get("/platform-settings", response_model=PlatformSettingsOut)
def get_platform_settings_admin(
    user: PlatformUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    from app.services.platform_settings import get_platform_settings

    ps = get_platform_settings(db)
    return _platform_settings_out(ps)


@router.patch("/platform-settings", response_model=PlatformSettingsOut)
def update_platform_settings_admin(
    body: PlatformSettingsIn,
    user: PlatformUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    from app.services.platform_settings import get_platform_settings

    if body.cancel_partial_refund_hours > body.cancel_full_refund_hours:
        raise HTTPException(
            400, "Partial-refund window must be shorter than the full-refund window"
        )

    ps = get_platform_settings(db)
    ps.platform_fee_percent = body.platform_fee_percent
    ps.tax_rate_percent = body.tax_rate_percent
    ps.cancel_full_refund_hours = body.cancel_full_refund_hours
    ps.cancel_partial_refund_hours = body.cancel_partial_refund_hours
    ps.cancel_partial_refund_percent = body.cancel_partial_refund_percent
    ps.trip_protection_summary = body.trip_protection_summary
    ps.marketplace_promise_title = body.marketplace_promise_title
    ps.destination_best_title_template = body.destination_best_title_template
    ps.destination_type_title_template = body.destination_type_title_template
    if body.marketplace_promise_items is not None:
        import json

        ps.marketplace_promise_items = json.dumps(
            [item.model_dump() for item in body.marketplace_promise_items]
        )
    db.commit()
    db.refresh(ps)
    return _platform_settings_out(ps)


def _platform_settings_out(ps) -> PlatformSettingsOut:
    import json

    from app.admin_schemas import MarketplacePromiseItemIn
    from app.services.destination_page import DEFAULT_PROMISE_ITEMS, DEFAULT_PROMISE_TITLE

    items_raw = ps.marketplace_promise_items
    items: list[MarketplacePromiseItemIn] | None = None
    if items_raw:
        try:
            parsed = json.loads(items_raw)
            if isinstance(parsed, list):
                items = [MarketplacePromiseItemIn(**row) for row in parsed if isinstance(row, dict)]
        except json.JSONDecodeError:
            items = None
    if items is None:
        items = [MarketplacePromiseItemIn(**row) for row in DEFAULT_PROMISE_ITEMS]

    return PlatformSettingsOut(
        platform_fee_percent=ps.platform_fee_percent,
        tax_rate_percent=ps.tax_rate_percent,
        cancel_full_refund_hours=ps.cancel_full_refund_hours,
        cancel_partial_refund_hours=ps.cancel_partial_refund_hours,
        cancel_partial_refund_percent=ps.cancel_partial_refund_percent,
        trip_protection_summary=ps.trip_protection_summary,
        marketplace_promise_title=ps.marketplace_promise_title or DEFAULT_PROMISE_TITLE,
        marketplace_promise_items=items,
        destination_best_title_template=ps.destination_best_title_template
        or "Best boat rentals in {location}",
        destination_type_title_template=ps.destination_type_title_template
        or "{type} boat rentals",
    )


# --- Reviews ---


@router.get("/reviews", response_model=list[AdminReviewOut])
def list_reviews(
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = hydrate_platform_user(db, user)
    q = db.query(Review).options(joinedload(Review.activity), joinedload(Review.booking))
    if not user.is_super_admin and user.organization_id is not None:
        q = q.join(Activity, Review.activity_id == Activity.id).filter(
            Activity.organization_id == user.organization_id
        )
    rows = q.order_by(Review.created_at.desc()).limit(100).all()
    return [
        AdminReviewOut(
            id=r.id,
            rating=r.rating,
            body=r.body,
            reviewer_name=r.reviewer_name,
            created_at=r.created_at,
            owner_response=r.owner_response,
            owner_response_at=r.owner_response_at,
            activity_id=r.activity_id,
            activity_title=r.activity.title if r.activity else "",
            booking_reference=r.booking.reference if r.booking else "",
        )
        for r in rows
    ]


@router.patch("/reviews/{review_id}/respond", response_model=AdminReviewOut)
def respond_to_review(
    review_id: int,
    body: AdminReviewRespondIn,
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.timeutil import utc_naive, utcnow

    review = (
        db.query(Review)
        .options(joinedload(Review.activity), joinedload(Review.booking))
        .filter(Review.id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(404, "Review not found")
    if user.role == "owner":
        if not review.activity or review.activity.organization_id != user.organization_id:
            raise HTTPException(403, "Not your listing")

    review.owner_response = body.response.strip()
    review.owner_response_at = utc_naive(utcnow())
    db.commit()
    db.refresh(review)
    return AdminReviewOut(
        id=review.id,
        rating=review.rating,
        body=review.body,
        reviewer_name=review.reviewer_name,
        created_at=review.created_at,
        owner_response=review.owner_response,
        owner_response_at=review.owner_response_at,
        activity_id=review.activity_id,
        activity_title=review.activity.title if review.activity else "",
        booking_reference=review.booking.reference if review.booking else "",
    )


# --- Earnings ---


@router.get("/earnings", response_model=EarningsOut)
def get_earnings(
    user: PlatformUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models import Organization
    from app.services.connect import connect_configured, create_login_link, sync_connect_status

    paid = BookingStatus.PAID
    q = (
        bookings_query(db, user)
        .filter(Booking.status == paid, Booking.is_waitlist.is_(False))
    )
    rows = q.all()

    gross = sum(b.total_cents for b in rows)
    fees = sum(b.platform_fee_cents for b in rows)
    net = sum(b.owner_payout_cents for b in rows)
    tax = sum(b.tax_cents for b in rows)

    recent_q = (
        bookings_query(db, user)
        .options(joinedload(Booking.slot).joinedload(Slot.activity))
        .filter(Booking.status == paid)
        .order_by(Booking.created_at.desc())
        .limit(12)
    )
    recent = [
        EarningsBookingOut(
            id=b.id,
            reference=b.reference,
            customer_name=b.customer_name,
            total_cents=b.total_cents,
            platform_fee_cents=b.platform_fee_cents,
            owner_payout_cents=b.owner_payout_cents,
            tax_cents=b.tax_cents,
            created_at=b.created_at,
            activity_title=b.slot.activity.title if b.slot and b.slot.activity else "",
        )
        for b in recent_q.all()
    ]

    connect_out = None
    if not user.is_super_admin and user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org and org.stripe_connect_account_id:
            sync_connect_status(db, org)
        if org:
            ready = bool(org.stripe_connect_charges_enabled and org.stripe_connect_account_id)
            connect_out = ConnectStatusOut(
                stripe_configured=connect_configured(),
                account_id=org.stripe_connect_account_id,
                charges_enabled=org.stripe_connect_charges_enabled,
                payouts_enabled=org.stripe_connect_payouts_enabled,
                details_submitted=org.stripe_connect_details_submitted,
                ready_for_payments=ready,
                dashboard_url=create_login_link(org) if ready else None,
            )
    elif user.is_super_admin:
        connect_out = ConnectStatusOut(
            stripe_configured=connect_configured(),
            ready_for_payments=connect_configured(),
        )

    return EarningsOut(
        gross_revenue_cents=gross,
        platform_fees_cents=fees,
        net_earnings_cents=net,
        tax_collected_cents=tax,
        paid_booking_count=len(rows),
        connect=connect_out,
        recent_bookings=recent,
    )
