import re
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.admin_auth import issue_admin_token, require_admin, verify_admin_password
from app.admin_schemas import (
    AdminActivityIn,
    AdminActivityListItem,
    AdminActivityOut,
    AdminBookingOut,
    AdminBulkSlotsIn,
    AdminDashboardOut,
    AdminLoginIn,
    AdminLoginOut,
    AdminPromoIn,
    AdminPromoOut,
    AdminSlotIn,
    AdminSlotOut,
    AdminTicketTypeIn,
    AdminTicketTypeOut,
)
from app.database import get_db
from app.models import Activity, Booking, BookingItem, BookingStatus, PromoCode, Slot, TicketType
router = APIRouter(prefix="/api/admin", tags=["admin"])


def _slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:200] or "tour"


def _unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    slug = base
    n = 1
    while True:
        q = db.query(Activity).filter(Activity.slug == slug)
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
        is_cancelled=slot.is_cancelled,
        activity_title=slot.activity.title if slot.activity else None,
    )


@router.post("/login", response_model=AdminLoginOut)
def admin_login(body: AdminLoginIn):
    if not verify_admin_password(body.password):
        raise HTTPException(401, "Invalid password")
    return AdminLoginOut(token=issue_admin_token())


@router.get("/dashboard", response_model=AdminDashboardOut, dependencies=[Depends(require_admin)])
def admin_dashboard(db: Session = Depends(get_db)):
    from app.services.admin_analytics import build_admin_dashboard

    return build_admin_dashboard(db)


# --- Activities ---


@router.get("/activities", response_model=list[AdminActivityListItem], dependencies=[Depends(require_admin)])
def list_activities(db: Session = Depends(get_db)):
    rows = db.query(Activity).order_by(Activity.title).all()
    out: list[AdminActivityListItem] = []
    for a in rows:
        out.append(
            AdminActivityListItem(
                id=a.id,
                title=a.title,
                slug=a.slug,
                location_label=a.location_label,
                duration_minutes=a.duration_minutes,
                is_active=a.is_active,
                ticket_type_count=len(a.ticket_types),
                slot_count=db.query(Slot).filter(Slot.activity_id == a.id).count(),
            )
        )
    return out


@router.get(
    "/activities/{activity_id}",
    response_model=AdminActivityOut,
    dependencies=[Depends(require_admin)],
)
def get_activity(activity_id: int, db: Session = Depends(get_db)):
    act = (
        db.query(Activity)
        .options(joinedload(Activity.ticket_types))
        .filter(Activity.id == activity_id)
        .first()
    )
    if not act:
        raise HTTPException(404, "Activity not found")
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
        ticket_types=[AdminTicketTypeOut.model_validate(t) for t in tickets],
    )


@router.post("/activities", response_model=AdminActivityOut, dependencies=[Depends(require_admin)])
def create_activity(body: AdminActivityIn, db: Session = Depends(get_db)):
    base_slug = body.slug or _slugify(body.title)
    act = Activity(
        title=body.title.strip(),
        slug=_unique_slug(db, base_slug),
        description=body.description,
        duration_minutes=body.duration_minutes,
        location_label=body.location_label,
        image_url=body.image_url,
        emoji=body.emoji,
        meeting_instructions=body.meeting_instructions,
        is_active=body.is_active,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return get_activity(act.id, db)


@router.put(
    "/activities/{activity_id}",
    response_model=AdminActivityOut,
    dependencies=[Depends(require_admin)],
)
def update_activity(activity_id: int, body: AdminActivityIn, db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(404, "Activity not found")
    act.title = body.title.strip()
    if body.slug:
        act.slug = _unique_slug(db, body.slug, exclude_id=activity_id)
    act.description = body.description
    act.duration_minutes = body.duration_minutes
    act.location_label = body.location_label
    act.image_url = body.image_url
    act.emoji = body.emoji
    act.meeting_instructions = body.meeting_instructions
    act.is_active = body.is_active
    db.commit()
    return get_activity(activity_id, db)


@router.delete("/activities/{activity_id}", dependencies=[Depends(require_admin)])
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(404, "Activity not found")
    paid = (
        db.query(Booking)
        .join(Slot)
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


@router.post(
    "/activities/{activity_id}/ticket-types",
    response_model=AdminTicketTypeOut,
    dependencies=[Depends(require_admin)],
)
def create_ticket_type(
    activity_id: int, body: AdminTicketTypeIn, db: Session = Depends(get_db)
):
    if not db.query(Activity).filter(Activity.id == activity_id).first():
        raise HTTPException(404, "Activity not found")
    tt = TicketType(activity_id=activity_id, **body.model_dump())
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return AdminTicketTypeOut.model_validate(tt)


@router.put(
    "/ticket-types/{ticket_type_id}",
    response_model=AdminTicketTypeOut,
    dependencies=[Depends(require_admin)],
)
def update_ticket_type(
    ticket_type_id: int, body: AdminTicketTypeIn, db: Session = Depends(get_db)
):
    tt = db.query(TicketType).filter(TicketType.id == ticket_type_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
    for k, v in body.model_dump().items():
        setattr(tt, k, v)
    db.commit()
    db.refresh(tt)
    return AdminTicketTypeOut.model_validate(tt)


@router.delete("/ticket-types/{ticket_type_id}", dependencies=[Depends(require_admin)])
def delete_ticket_type(ticket_type_id: int, db: Session = Depends(get_db)):
    tt = db.query(TicketType).filter(TicketType.id == ticket_type_id).first()
    if not tt:
        raise HTTPException(404, "Ticket type not found")
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


@router.get("/slots", response_model=list[AdminSlotOut], dependencies=[Depends(require_admin)])
def list_slots(
    year: int | None = None,
    month: int | None = None,
    activity_id: int | None = None,
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Slot).options(joinedload(Slot.activity))
    if not include_cancelled:
        q = q.filter(Slot.is_cancelled.is_(False))
    if activity_id:
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


@router.post("/slots", response_model=AdminSlotOut, dependencies=[Depends(require_admin)])
def create_slot(body: AdminSlotIn, db: Session = Depends(get_db)):
    if body.ends_at <= body.starts_at:
        raise HTTPException(400, "End time must be after start time")
    act = db.query(Activity).filter(Activity.id == body.activity_id).first()
    if not act:
        raise HTTPException(404, "Activity not found")
    slot = Slot(**body.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    slot.activity = act
    return _slot_out(slot)


@router.post("/slots/bulk", response_model=list[AdminSlotOut], dependencies=[Depends(require_admin)])
def bulk_create_slots(body: AdminBulkSlotsIn, db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == body.activity_id).first()
    if not act:
        raise HTTPException(404, "Activity not found")
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
        )
        db.add(slot)
        db.flush()
        slot.activity = act
        created.append(_slot_out(slot))
    db.commit()
    return created


@router.put("/slots/{slot_id}", response_model=AdminSlotOut, dependencies=[Depends(require_admin)])
def update_slot(slot_id: int, body: AdminSlotIn, db: Session = Depends(get_db)):
    slot = db.query(Slot).options(joinedload(Slot.activity)).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    if body.ends_at <= body.starts_at:
        raise HTTPException(400, "End time must be after start time")
    if body.capacity < slot.booked_count:
        raise HTTPException(400, f"Capacity cannot be below {slot.booked_count} already booked")
    for k, v in body.model_dump().items():
        setattr(slot, k, v)
    db.commit()
    db.refresh(slot)
    return _slot_out(slot)


@router.delete("/slots/{slot_id}", dependencies=[Depends(require_admin)])
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(Slot).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    slot.is_cancelled = True
    db.commit()
    return {"ok": True, "cancelled": True}


@router.post("/slots/{slot_id}/restore", dependencies=[Depends(require_admin)])
def restore_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(Slot).filter(Slot.id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    slot.is_cancelled = False
    db.commit()
    return {"ok": True}


# --- Promos ---


@router.get("/promos", response_model=list[AdminPromoOut], dependencies=[Depends(require_admin)])
def list_promos(db: Session = Depends(get_db)):
    return [
        AdminPromoOut.model_validate(p)
        for p in db.query(PromoCode).order_by(PromoCode.code).all()
    ]


@router.post("/promos", response_model=AdminPromoOut, dependencies=[Depends(require_admin)])
def create_promo(body: AdminPromoIn, db: Session = Depends(get_db)):
    if not body.discount_percent and not body.discount_cents:
        raise HTTPException(400, "Set discount_percent or discount_cents")
    code = body.code.upper().strip()
    if db.query(PromoCode).filter(PromoCode.code == code).first():
        raise HTTPException(400, "Promo code already exists")
    promo = PromoCode(code=code, **{k: v for k, v in body.model_dump().items() if k != "code"})
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return AdminPromoOut.model_validate(promo)


@router.put("/promos/{promo_id}", response_model=AdminPromoOut, dependencies=[Depends(require_admin)])
def update_promo(promo_id: int, body: AdminPromoIn, db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promo not found")
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


@router.delete("/promos/{promo_id}", dependencies=[Depends(require_admin)])
def delete_promo(promo_id: int, db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not promo:
        raise HTTPException(404, "Promo not found")
    db.delete(promo)
    db.commit()
    return {"ok": True}


# --- Bookings ---


@router.get("/bookings", response_model=list[AdminBookingOut], dependencies=[Depends(require_admin)])
def list_bookings(
    status: str | None = None,
    slot_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = (
        db.query(Booking)
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
        q = q.filter(Booking.slot_id == slot_id)
    rows = q.all()
    out: list[AdminBookingOut] = []
    for b in rows:
        out.append(
            AdminBookingOut(
                id=b.id,
                reference=b.reference,
                status=b.status.value,
                customer_name=b.customer_name,
                customer_email=b.customer_email,
                customer_phone=b.customer_phone,
                total_cents=b.total_cents,
                is_waitlist=b.is_waitlist,
                created_at=b.created_at,
                slot_id=b.slot_id,
                activity_title=b.slot.activity.title if b.slot else "",
                slot_starts_at=b.slot.starts_at if b.slot else b.created_at,
                items=[
                    AdminBookingItemOut(
                        ticket_name=i.ticket_type.name if i.ticket_type else "?",
                        quantity=i.quantity,
                        unit_price_cents=i.unit_price_cents,
                    )
                    for i in b.items
                ],
            )
        )
    return out


@router.patch("/bookings/{booking_id}/cancel", dependencies=[Depends(require_admin)])
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.items))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.status == BookingStatus.PAID:
        slot = db.query(Slot).filter(Slot.id == booking.slot_id).with_for_update().first()
        if slot:
            qty = sum(i.quantity for i in booking.items)
            slot.booked_count = max(0, slot.booked_count - qty)
    booking.status = BookingStatus.CANCELLED
    db.commit()
    return {"ok": True, "reference": booking.reference}
