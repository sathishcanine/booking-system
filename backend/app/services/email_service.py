"""Optional SMTP emails for booking confirmations."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings
from app.models import Activity, Booking, Slot

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def _format_money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def _booking_title(db, booking: Booking) -> str:
    if booking.activity_id:
        activity = db.query(Activity).filter(Activity.id == booking.activity_id).first()
        if activity:
            return activity.title
    if booking.slot_id:
        slot = db.query(Slot).filter(Slot.id == booking.slot_id).first()
        if slot and slot.activity:
            return slot.activity.title
    return "Your trip"


def send_booking_confirmation(db, booking: Booking) -> bool:
    """Send a confirmation email after payment. Returns True if sent."""
    if not smtp_configured():
        logger.debug("SMTP not configured — skip confirmation for %s", booking.reference)
        return False
    if not booking.customer_email:
        return False

    title = _booking_title(db, booking)
    subject = f"Booking confirmed — {booking.reference}"
    lines = [
        f"Hi {booking.customer_name},",
        "",
        f"Your booking is confirmed. Reference: {booking.reference}",
        f"Experience: {title}",
        f"Total paid: {_format_money(booking.total_cents)}",
        "",
        "Thank you for booking with AlisAdventure.",
        "",
        f"View your booking: {settings.frontend_url.rstrip('/')}/success/{booking.reference}",
    ]
    body = "\n".join(lines)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = booking.customer_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Sent confirmation email for %s to %s", booking.reference, booking.customer_email)
        return True
    except Exception:
        logger.exception("Failed to send confirmation email for %s", booking.reference)
        return False
