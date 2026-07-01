import logging

import stripe

from app.config import settings
from app.models import Organization

logger = logging.getLogger(__name__)

stripe.api_key = settings.stripe_secret_key


def connect_configured() -> bool:
    return bool(settings.stripe_secret_key)


def sync_connect_status(db, org: Organization) -> Organization:
    if not org.stripe_connect_account_id or not connect_configured():
        return org
    try:
        acct = stripe.Account.retrieve(org.stripe_connect_account_id)
        org.stripe_connect_charges_enabled = bool(acct.get("charges_enabled"))
        org.stripe_connect_payouts_enabled = bool(acct.get("payouts_enabled"))
        org.stripe_connect_details_submitted = bool(acct.get("details_submitted"))
        db.commit()
        db.refresh(org)
    except stripe.error.StripeError:
        logger.exception("Failed to sync Connect status for org %s", org.id)
    return org


def ensure_connect_account(db, org: Organization, email: str | None = None) -> str:
    if org.stripe_connect_account_id:
        return org.stripe_connect_account_id
    if not connect_configured():
        raise ValueError("Stripe is not configured on the server")

    account = stripe.Account.create(
        type="express",
        country="US",
        email=email or org.contact_email,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_profile={"name": org.name[:200]},
        metadata={"organization_id": str(org.id)},
    )
    org.stripe_connect_account_id = account.id
    db.commit()
    return account.id


def create_onboarding_link(org: Organization, refresh_url: str, return_url: str) -> str:
    if not org.stripe_connect_account_id:
        raise ValueError("Connect account not created")
    link = stripe.AccountLink.create(
        account=org.stripe_connect_account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type="account_onboarding",
    )
    return link.url


def create_login_link(org: Organization) -> str | None:
    """Express Dashboard link for onboarded owners."""
    if not org.stripe_connect_account_id or not org.stripe_connect_details_submitted:
        return None
    try:
        link = stripe.Account.create_login_link(org.stripe_connect_account_id)
        return link.url
    except stripe.error.StripeError:
        logger.exception("Failed to create Connect login link for org %s", org.id)
        return None


def connect_ready(org: Organization | None) -> bool:
    return bool(
        org
        and org.stripe_connect_account_id
        and org.stripe_connect_charges_enabled
    )


def stripe_connect_user_message(exc: Exception) -> str:
    """Turn Stripe API failures into guidance owners and admins can act on."""
    if isinstance(exc, stripe.error.InvalidRequestError):
        text = (getattr(exc, "user_message", None) or str(exc)).lower()
        if "signed up for connect" in text:
            return (
                "Stripe Connect is not activated on this marketplace yet. "
                "The platform administrator must enable Connect at "
                "dashboard.stripe.com/connect (Get started), then owners can link their bank."
            )
        if "url" in text and ("invalid" in text or "redirect" in text):
            return (
                "Stripe could not use the return URL for onboarding. "
                "The platform team should verify FRONTEND_URL in server settings."
            )
        user_msg = getattr(exc, "user_message", None)
        if user_msg:
            return str(user_msg)
    if isinstance(exc, stripe.error.AuthenticationError):
        return "Stripe API keys on the server are invalid. Contact the platform administrator."
    if isinstance(exc, stripe.error.PermissionError):
        return (
            "This Stripe account does not have permission to create Connect accounts. "
            "Enable Stripe Connect on the platform Stripe dashboard."
        )
    if isinstance(exc, stripe.error.StripeError):
        user_msg = getattr(exc, "user_message", None)
        if user_msg:
            return str(user_msg)
        return "Stripe returned an error. Please try again in a few minutes."
    if isinstance(exc, ValueError):
        return str(exc)
    return "Could not start Stripe onboarding. Try again or contact support."
