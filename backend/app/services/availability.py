from datetime import datetime

from app.timeutil import UTC, utcnow

from app.models import Slot, SlotStatus


LOW_STOCK_THRESHOLD = 8


def spots_left(slot: Slot) -> int:
    pending_holds = getattr(slot, "_pending_holds", 0)
    return max(0, slot.capacity - slot.booked_count - pending_holds)


def slot_status(slot: Slot, pending_holds: int = 0) -> SlotStatus:
    if slot.is_cancelled:
        return SlotStatus.SOLD_OUT
    left = max(0, slot.capacity - slot.booked_count - pending_holds)
    if left == 0:
        return SlotStatus.WAITLIST if slot.waitlist_enabled else SlotStatus.SOLD_OUT
    if left <= LOW_STOCK_THRESHOLD:
        return SlotStatus.LOW
    return SlotStatus.OPEN


def status_label(status: SlotStatus, spots: int) -> str:
    if status == SlotStatus.LOW:
        return f"{spots} spots left"
    if status == SlotStatus.WAITLIST:
        return "Waitlist"
    if status == SlotStatus.SOLD_OUT:
        return "Sold out"
    return ""


def is_slot_in_past(slot: Slot) -> bool:
    now = utcnow()
    start = slot.starts_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return start < now
