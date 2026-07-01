from datetime import date, timedelta

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session, joinedload

from app.admin_schemas import (
    AdminDashboardOut,
    AdminDayMetric,
    AdminRecentBooking,
    AdminStatusCount,
    AdminTopPromo,
    AdminTopTicket,
    AdminTopTour,
    AdminUpcomingDeparture,
)
from app.models import Activity, Booking, BookingItem, BookingStatus, Slot, TicketType
from app.services.booking import pending_holds_for_slot
from app.timeutil import utcnow


def _paid_filter():
    return (Booking.status == BookingStatus.PAID) & (Booking.is_waitlist.is_(False))


def _activity_ids(db: Session, organization_id: int | None) -> list[int] | None:
    if organization_id is None:
        return None
    return [
        row[0]
        for row in db.query(Activity.id).filter(Activity.organization_id == organization_id).all()
    ]


def _scope_booking(q, activity_ids: list[int] | None):
    q = q.filter(Booking.booking_kind == "rental")
    if activity_ids is not None:
        q = q.filter(Booking.activity_id.in_(activity_ids))
    return q


def _scope_slot(q, activity_ids: list[int] | None):
    if activity_ids is not None:
        q = q.filter(Slot.activity_id.in_(activity_ids))
    return q


def _scope_activity(q, activity_ids: list[int] | None):
    if activity_ids is not None:
        q = q.filter(Activity.id.in_(activity_ids))
    return q


def build_admin_dashboard(db: Session, organization_id: int | None = None) -> AdminDashboardOut:
    now = utcnow()
    today = now.date()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_7d = today_start - timedelta(days=7)
    start_30d = today_start - timedelta(days=30)
    activity_ids = _activity_ids(db, organization_id)

    paid = _paid_filter()

    def revenue_since(dt):
        q = db.query(func.coalesce(func.sum(Booking.total_cents), 0))
        q = _scope_booking(q, activity_ids).filter(paid, Booking.created_at >= dt)
        return int(q.scalar() or 0)

    def bookings_since(dt, status_filter=None):
        q = db.query(func.count(Booking.id)).filter(Booking.created_at >= dt)
        q = _scope_booking(q, activity_ids)
        if status_filter is not None:
            q = q.filter(status_filter)
        return int(q.scalar() or 0)

    total_revenue_q = _scope_booking(
        db.query(func.coalesce(func.sum(Booking.total_cents), 0)), activity_ids
    ).filter(paid)
    total_revenue_cents = int(total_revenue_q.scalar() or 0)
    paid_count = int(_scope_booking(db.query(func.count(Booking.id)), activity_ids).filter(paid).scalar() or 0)
    avg_order_cents = total_revenue_cents // paid_count if paid_count else 0

    tickets_sold_q = _scope_booking(
        db.query(func.coalesce(func.sum(Booking.passenger_count), 0)),
        activity_ids,
    ).filter(paid)
    tickets_sold = int(tickets_sold_q.scalar() or 0)

    total_attempts = int(
        _scope_booking(db.query(func.count(Booking.id)), activity_ids)
        .filter(Booking.is_waitlist.is_(False))
        .scalar()
        or 0
    )
    conversion_rate = round(100 * paid_count / total_attempts, 1) if total_attempts else 0.0

    marketing_opt_ins = int(
        _scope_booking(db.query(func.count(Booking.id)), activity_ids)
        .filter(paid, Booking.marketing_opt_in.is_(True))
        .scalar()
        or 0
    )
    marketing_opt_in_rate = round(100 * marketing_opt_ins / paid_count, 1) if paid_count else 0.0

    promo_bookings = int(
        _scope_booking(db.query(func.count(Booking.id)), activity_ids)
        .filter(paid, Booking.promo_code.isnot(None), Booking.promo_code != "")
        .scalar()
        or 0
    )

    # Status breakdown
    status_rows = (
        _scope_booking(db.query(Booking.status, func.count(Booking.id)), activity_ids)
        .group_by(Booking.status)
        .all()
    )
    bookings_by_status = [
        AdminStatusCount(status=row[0].value, count=int(row[1])) for row in status_rows
    ]

    paid_case = and_(Booking.status == BookingStatus.PAID, Booking.is_waitlist.is_(False))

    # Revenue & bookings by day (30 days)
    day_rows = (
        _scope_booking(
            db.query(
                func.date(Booking.created_at).label("d"),
                func.coalesce(
                    func.sum(case((paid_case, Booking.total_cents), else_=0)),
                    0,
                ),
                func.count(Booking.id),
                func.coalesce(func.sum(case((paid_case, 1), else_=0)), 0),
            ),
            activity_ids,
        )
        .filter(Booking.created_at >= start_30d)
        .group_by(func.date(Booking.created_at))
        .order_by(func.date(Booking.created_at))
        .all()
    )
    day_map = {
        str(row[0]): AdminDayMetric(
            date=date.fromisoformat(str(row[0])),
            revenue_cents=int(row[1] or 0),
            booking_count=int(row[2] or 0),
            paid_count=int(row[3] or 0),
        )
        for row in day_rows
    }
    revenue_by_day: list[AdminDayMetric] = []
    for i in range(30):
        d = today - timedelta(days=29 - i)
        key = d.isoformat()
        revenue_by_day.append(
            day_map.get(
                key,
                AdminDayMetric(date=d, revenue_cents=0, booking_count=0, paid_count=0),
            )
        )

    # Top boats (rental revenue)
    tour_q = (
        db.query(
            Activity.id,
            Activity.title,
            func.count(Booking.id),
            func.coalesce(func.sum(Booking.total_cents), 0),
        )
        .select_from(Booking)
        .join(Activity, Booking.activity_id == Activity.id)
        .filter(paid, Booking.booking_kind == "rental")
    )
    tour_q = _scope_activity(tour_q, activity_ids)
    tour_rows = (
        tour_q.group_by(Activity.id, Activity.title)
        .order_by(func.sum(Booking.total_cents).desc())
        .limit(8)
        .all()
    )
    guest_q = (
        db.query(Activity.id, func.coalesce(func.sum(Booking.passenger_count), 0))
        .select_from(Booking)
        .join(Activity, Booking.activity_id == Activity.id)
        .filter(paid, Booking.booking_kind == "rental")
    )
    guest_q = _scope_activity(guest_q, activity_ids)
    ticket_by_activity = {row[0]: int(row[1] or 0) for row in guest_q.group_by(Activity.id).all()}
    top_tours = [
        AdminTopTour(
            activity_id=row[0],
            title=row[1],
            paid_bookings=int(row[2]),
            revenue_cents=int(row[3] or 0),
            tickets_sold=ticket_by_activity.get(row[0], 0),
        )
        for row in tour_rows
    ]

    # Top ticket types
    ticket_rows_q = (
        db.query(
            BookingItem.ticket_type_id,
            func.max(TicketType.name),
            func.sum(BookingItem.quantity),
            func.coalesce(func.sum(BookingItem.quantity * BookingItem.unit_price_cents), 0),
        )
        .select_from(BookingItem)
        .join(Booking)
        .join(TicketType, BookingItem.ticket_type_id == TicketType.id)
        .filter(paid)
    )
    if activity_ids is not None:
        ticket_rows_q = ticket_rows_q.join(Slot, Booking.slot_id == Slot.id).filter(
            Slot.activity_id.in_(activity_ids)
        )
    ticket_rows = (
        ticket_rows_q.group_by(BookingItem.ticket_type_id)
        .order_by(func.sum(BookingItem.quantity).desc())
        .limit(8)
        .all()
    )
    top_ticket_types = [
        AdminTopTicket(
            ticket_type_id=row[0],
            name=row[1] or "Ticket",
            quantity_sold=int(row[2] or 0),
            gross_cents=int(row[3] or 0),
        )
        for row in ticket_rows
    ]

    # Top promos
    promo_rows = (
        _scope_booking(db.query(Booking.promo_code, func.count(Booking.id)), activity_ids)
        .filter(paid, Booking.promo_code.isnot(None), Booking.promo_code != "")
        .group_by(Booking.promo_code)
        .order_by(func.count(Booking.id).desc())
        .limit(8)
        .all()
    )
    top_promos = [
        AdminTopPromo(code=row[0], uses=int(row[1])) for row in promo_rows
    ]

    # Upcoming schedule stats
    upcoming_slots = (
        _scope_slot(
            db.query(Slot)
            .options(joinedload(Slot.activity))
            .filter(Slot.is_cancelled.is_(False), Slot.starts_at > now),
            activity_ids,
        )
        .order_by(Slot.starts_at)
        .all()
    )
    upcoming_capacity = sum(s.capacity for s in upcoming_slots)
    upcoming_booked = sum(s.booked_count for s in upcoming_slots)
    upcoming_held = sum(pending_holds_for_slot(db, s.id) for s in upcoming_slots[:80])
    spots_remaining = max(0, upcoming_capacity - upcoming_booked - upcoming_held)
    fill_rate = (
        round(100 * (upcoming_booked + upcoming_held) / upcoming_capacity, 1)
        if upcoming_capacity
        else 0.0
    )

    low_stock = 0
    waitlist_ready = 0
    call_to_book = 0
    upcoming_preview: list[AdminUpcomingDeparture] = []

    for slot in upcoming_slots:
        holds = pending_holds_for_slot(db, slot.id)
        left = max(0, slot.capacity - slot.booked_count - holds)
        if left <= 8 and left > 0:
            low_stock += 1
        if left <= 0 and slot.waitlist_enabled:
            waitlist_ready += 1
        if slot.is_call_to_book:
            call_to_book += 1
        if len(upcoming_preview) < 12:
            pct = (
                round(100 * (slot.booked_count + holds) / slot.capacity, 0)
                if slot.capacity
                else 0
            )
            upcoming_preview.append(
                AdminUpcomingDeparture(
                    slot_id=slot.id,
                    activity_title=slot.activity.title if slot.activity else "",
                    starts_at=slot.starts_at,
                    capacity=slot.capacity,
                    booked=slot.booked_count,
                    held=holds,
                    spots_left=left,
                    fill_percent=int(pct),
                    is_call_to_book=slot.is_call_to_book,
                )
            )

    # heard_about breakdown
    heard_rows = (
        _scope_booking(db.query(Booking.heard_about, func.count(Booking.id)), activity_ids)
        .filter(paid, Booking.heard_about.isnot(None), Booking.heard_about != "")
        .group_by(Booking.heard_about)
        .order_by(func.count(Booking.id).desc())
        .limit(6)
        .all()
    )
    heard_about = {row[0]: int(row[1]) for row in heard_rows}

    # Recent bookings
    recent = (
        _scope_booking(
            db.query(Booking).options(
                joinedload(Booking.activity),
                joinedload(Booking.slot).joinedload(Slot.activity),
            ),
            activity_ids,
        )
        .order_by(Booking.created_at.desc())
        .limit(10)
        .all()
    )
    recent_bookings = [
        AdminRecentBooking(
            id=b.id,
            reference=b.reference,
            status=b.status.value,
            customer_name=b.customer_name,
            total_cents=b.total_cents,
            is_waitlist=b.is_waitlist,
            created_at=b.created_at,
            activity_title=(
                b.activity.title
                if b.activity
                else (b.slot.activity.title if b.slot and b.slot.activity else "")
            ),
            slot_starts_at=b.rental_starts_at or (b.slot.starts_at if b.slot else b.created_at),
        )
        for b in recent
    ]

    return AdminDashboardOut(
        generated_at=now,
        activity_count=_scope_activity(
            db.query(Activity).filter(Activity.is_active.is_(True)), activity_ids
        ).count(),
        active_slot_count=_scope_slot(
            db.query(Slot).filter(Slot.is_cancelled.is_(False)), activity_ids
        ).count(),
        upcoming_departure_count=len(upcoming_slots),
        booking_count=int(
            _scope_booking(db.query(func.count(Booking.id)), activity_ids).scalar() or 0
        ),
        paid_booking_count=paid_count,
        pending_booking_count=int(
            _scope_booking(db.query(func.count(Booking.id)), activity_ids)
            .filter(Booking.status == BookingStatus.PENDING)
            .scalar()
            or 0
        ),
        waitlist_count=int(
            _scope_booking(db.query(func.count(Booking.id)), activity_ids)
            .filter(Booking.is_waitlist.is_(True))
            .scalar()
            or 0
        ),
        cancelled_count=int(
            _scope_booking(db.query(func.count(Booking.id)), activity_ids)
            .filter(Booking.status == BookingStatus.CANCELLED)
            .scalar()
            or 0
        ),
        expired_count=int(
            _scope_booking(db.query(func.count(Booking.id)), activity_ids)
            .filter(Booking.status == BookingStatus.EXPIRED)
            .scalar()
            or 0
        ),
        total_revenue_cents=total_revenue_cents,
        revenue_today_cents=revenue_since(today_start),
        revenue_7d_cents=revenue_since(start_7d),
        revenue_30d_cents=revenue_since(start_30d),
        bookings_today=bookings_since(today_start),
        bookings_7d=bookings_since(start_7d),
        bookings_30d=bookings_since(start_30d),
        paid_bookings_7d=bookings_since(start_7d, paid),
        tickets_sold=tickets_sold,
        average_order_cents=avg_order_cents,
        conversion_rate_percent=conversion_rate,
        marketing_opt_ins=marketing_opt_ins,
        marketing_opt_in_rate_percent=marketing_opt_in_rate,
        promo_booking_count=promo_bookings,
        upcoming_capacity=upcoming_capacity,
        upcoming_booked=upcoming_booked,
        upcoming_held_seats=upcoming_held,
        upcoming_spots_remaining=spots_remaining,
        upcoming_fill_rate_percent=fill_rate,
        low_stock_departures=low_stock,
        waitlist_departures=waitlist_ready,
        call_to_book_departures=call_to_book,
        bookings_by_status=bookings_by_status,
        revenue_by_day=revenue_by_day,
        top_tours=top_tours,
        top_ticket_types=top_ticket_types,
        top_promos=top_promos,
        heard_about=heard_about,
        recent_bookings=recent_bookings,
        upcoming_departures=upcoming_preview,
    )
