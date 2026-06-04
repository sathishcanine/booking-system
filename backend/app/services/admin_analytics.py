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


def build_admin_dashboard(db: Session) -> AdminDashboardOut:
    now = utcnow()
    today = now.date()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_7d = today_start - timedelta(days=7)
    start_30d = today_start - timedelta(days=30)

    paid = _paid_filter()

    def revenue_since(dt):
        return int(
            db.query(func.coalesce(func.sum(Booking.total_cents), 0))
            .filter(paid, Booking.created_at >= dt)
            .scalar()
            or 0
        )

    def bookings_since(dt, status_filter=None):
        q = db.query(func.count(Booking.id)).filter(Booking.created_at >= dt)
        if status_filter is not None:
            q = q.filter(status_filter)
        return int(q.scalar() or 0)

    total_revenue_cents = int(
        db.query(func.coalesce(func.sum(Booking.total_cents), 0)).filter(paid).scalar() or 0
    )
    paid_count = int(db.query(func.count(Booking.id)).filter(paid).scalar() or 0)
    avg_order_cents = total_revenue_cents // paid_count if paid_count else 0

    tickets_sold = int(
        db.query(func.coalesce(func.sum(BookingItem.quantity), 0))
        .join(Booking)
        .filter(paid)
        .scalar()
        or 0
    )

    total_attempts = int(
        db.query(func.count(Booking.id))
        .filter(Booking.is_waitlist.is_(False))
        .scalar()
        or 0
    )
    conversion_rate = round(100 * paid_count / total_attempts, 1) if total_attempts else 0.0

    marketing_opt_ins = int(
        db.query(func.count(Booking.id)).filter(paid, Booking.marketing_opt_in.is_(True)).scalar() or 0
    )
    marketing_opt_in_rate = round(100 * marketing_opt_ins / paid_count, 1) if paid_count else 0.0

    promo_bookings = int(
        db.query(func.count(Booking.id))
        .filter(paid, Booking.promo_code.isnot(None), Booking.promo_code != "")
        .scalar()
        or 0
    )

    # Status breakdown
    status_rows = (
        db.query(Booking.status, func.count(Booking.id))
        .group_by(Booking.status)
        .all()
    )
    bookings_by_status = [
        AdminStatusCount(status=row[0].value, count=int(row[1])) for row in status_rows
    ]

    paid_case = and_(Booking.status == BookingStatus.PAID, Booking.is_waitlist.is_(False))

    # Revenue & bookings by day (30 days)
    day_rows = (
        db.query(
            func.date(Booking.created_at).label("d"),
            func.coalesce(
                func.sum(case((paid_case, Booking.total_cents), else_=0)),
                0,
            ),
            func.count(Booking.id),
            func.coalesce(func.sum(case((paid_case, 1), else_=0)), 0),
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

    # Top tours
    tour_rows = (
        db.query(
            Activity.id,
            Activity.title,
            func.count(Booking.id),
            func.coalesce(func.sum(Booking.total_cents), 0),
        )
        .select_from(Booking)
        .join(Slot, Booking.slot_id == Slot.id)
        .join(Activity, Slot.activity_id == Activity.id)
        .filter(paid)
        .group_by(Activity.id, Activity.title)
        .order_by(func.sum(Booking.total_cents).desc())
        .limit(8)
        .all()
    )
    ticket_by_activity = {
        row[0]: int(row[1] or 0)
        for row in (
            db.query(Activity.id, func.coalesce(func.sum(BookingItem.quantity), 0))
            .select_from(BookingItem)
            .join(Booking)
            .join(Slot, Booking.slot_id == Slot.id)
            .join(Activity, Slot.activity_id == Activity.id)
            .filter(paid)
            .group_by(Activity.id)
            .all()
        )
    }
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
    ticket_rows = (
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
        .group_by(BookingItem.ticket_type_id)
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
        db.query(Booking.promo_code, func.count(Booking.id))
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
        db.query(Slot)
        .options(joinedload(Slot.activity))
        .filter(Slot.is_cancelled.is_(False), Slot.starts_at > now)
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
        db.query(Booking.heard_about, func.count(Booking.id))
        .filter(paid, Booking.heard_about.isnot(None), Booking.heard_about != "")
        .group_by(Booking.heard_about)
        .order_by(func.count(Booking.id).desc())
        .limit(6)
        .all()
    )
    heard_about = {row[0]: int(row[1]) for row in heard_rows}

    # Recent bookings
    recent = (
        db.query(Booking)
        .options(joinedload(Booking.slot).joinedload(Slot.activity))
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
            activity_title=b.slot.activity.title if b.slot and b.slot.activity else "",
            slot_starts_at=b.slot.starts_at if b.slot else b.created_at,
        )
        for b in recent
    ]

    return AdminDashboardOut(
        generated_at=now,
        activity_count=db.query(Activity).filter(Activity.is_active.is_(True)).count(),
        active_slot_count=db.query(Slot).filter(Slot.is_cancelled.is_(False)).count(),
        upcoming_departure_count=len(upcoming_slots),
        booking_count=int(db.query(func.count(Booking.id)).scalar() or 0),
        paid_booking_count=paid_count,
        pending_booking_count=int(
            db.query(func.count(Booking.id))
            .filter(Booking.status == BookingStatus.PENDING)
            .scalar()
            or 0
        ),
        waitlist_count=int(
            db.query(func.count(Booking.id)).filter(Booking.is_waitlist.is_(True)).scalar() or 0
        ),
        cancelled_count=int(
            db.query(func.count(Booking.id))
            .filter(Booking.status == BookingStatus.CANCELLED)
            .scalar()
            or 0
        ),
        expired_count=int(
            db.query(func.count(Booking.id))
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
