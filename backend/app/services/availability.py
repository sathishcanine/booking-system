from datetime import datetime, timedelta

from app.config import settings
from app.timeutil import UTC, utcnow

from app.models import Slot, SlotStatus


LOW_STOCK_THRESHOLD = 8


def effective_cutoff_hours(slot: Slot) -> int:
    if slot.booking_cutoff_hours is not None:
        return slot.booking_cutoff_hours
    return settings.default_booking_cutoff_hours


def booking_deadline(slot: Slot) -> datetime:
    """Last moment online booking is accepted (UTC-aware)."""
    start = slot.starts_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    hours = effective_cutoff_hours(slot)
    if hours <= 0:
        return start
    return start - timedelta(hours=hours)


def is_slot_departed(slot: Slot) -> bool:
    now = utcnow()
    start = slot.starts_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return start <= now


def is_past_booking_cutoff(slot: Slot) -> bool:
    if slot.is_call_to_book:
        return False
    return utcnow() >= booking_deadline(slot)


def is_slot_in_past(slot: Slot) -> bool:
    """True when departure has started (legacy name)."""
    return is_slot_departed(slot)


def spots_left(slot: Slot) -> int:
    pending_holds = getattr(slot, "_pending_holds", 0)
    return max(0, slot.capacity - slot.booked_count - pending_holds)


def slot_status(slot: Slot, pending_holds: int = 0) -> SlotStatus:
    if slot.is_cancelled:
        return SlotStatus.SOLD_OUT
    if is_past_booking_cutoff(slot) or is_slot_departed(slot):
        return SlotStatus.CLOSED
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
    if status == SlotStatus.CLOSED:
        return "Booking closed"
    return ""
