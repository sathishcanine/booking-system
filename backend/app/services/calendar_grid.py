import calendar
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models import Slot, SlotStatus
from app.schemas import CalendarCellOut, CalendarMonthOut, CalendarSlotOut
from app.services.availability import booking_deadline, effective_cutoff_hours, slot_status
from app.services.booking import pending_holds_for_slot


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    first = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    last = date(year, month, last_day)
    return first, last


def _grid_start(first: date) -> date:
    """Monday-start week containing the 1st of the month."""
    return first - timedelta(days=first.weekday())


def _grid_end(last: date) -> date:
    """Sunday-end week containing the last day of the month."""
    return last + timedelta(days=(6 - last.weekday()))


def slot_to_out(db: Session, slot: Slot) -> CalendarSlotOut:
    holds = pending_holds_for_slot(db, slot.id)
    left = max(0, slot.capacity - slot.booked_count - holds)
    st = slot_status(slot, holds)
    act = slot.activity
    return CalendarSlotOut(
        id=slot.id,
        activity_id=act.id,
        title=act.title,
        location_label=act.location_label,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        card_description=slot.card_description or act.description,
        card_image_url=slot.card_image_url or act.image_url,
        emoji=act.emoji,
        spots_left=left,
        status=st.value,
        promo_text=slot.promo_text,
        duration_minutes=act.duration_minutes,
        is_call_to_book=slot.is_call_to_book,
        call_phone=slot.call_phone,
        brand_label=slot.brand_label,
        urgency_text=slot.urgency_text,
        booking_cutoff_hours=effective_cutoff_hours(slot),
        booking_deadline=booking_deadline(slot),
        booking_closed=st == SlotStatus.CLOSED,
    )


def build_month_calendar(db: Session, year: int, month: int) -> CalendarMonthOut:
    today = date.today()
    first, last = _month_bounds(year, month)
    grid_start = _grid_start(first)
    grid_end = _grid_end(last)

    range_start = datetime.combine(grid_start, datetime.min.time())
    range_end = datetime.combine(grid_end + timedelta(days=1), datetime.min.time())

    slots = (
        db.query(Slot)
        .options(joinedload(Slot.activity))
        .filter(
            Slot.is_cancelled.is_(False),
            Slot.starts_at >= range_start,
            Slot.starts_at < range_end,
        )
        .order_by(Slot.starts_at)
        .all()
    )

    by_date: dict[date, list[CalendarSlotOut]] = {}
    for slot in slots:
        d = slot.starts_at.date()
        by_date.setdefault(d, []).append(slot_to_out(db, slot))

    cells: list[CalendarCellOut] = []
    cursor = grid_start
    while cursor <= grid_end:
        cells.append(
            CalendarCellOut(
                date=cursor,
                in_month=cursor.month == month and cursor.year == year,
                is_today=cursor == today,
                is_past=cursor < today,
                slots=by_date.get(cursor, []),
            )
        )
        cursor += timedelta(days=1)

    return CalendarMonthOut(year=year, month=month, cells=cells)
