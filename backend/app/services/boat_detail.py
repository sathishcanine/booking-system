from sqlalchemy.orm import Session

from app.listings import json_list_from_db
from app.marketplace_config import ALLOWED_ON_BOAT
from app.models import Activity, User, UserRole
from app.schemas import (
    AllowedOnBoatItemOut,
    BoatListingPoliciesOut,
    BoatOwnerProfileOut,
)
from app.services.captains import build_captain_alternatives, build_default_captain


def _owner_user(activity: Activity) -> User | None:
    org = activity.organization
    if not org:
        return None
    for user in org.users:
        if user.role == UserRole.OWNER and user.is_active:
            return user
    return org.users[0] if org.users else None


def build_owner_profile(activity: Activity, review_count: int, avg_rating: float | None) -> BoatOwnerProfileOut:
    org = activity.organization
    owner = _owner_user(activity)
    name = (owner.display_name if owner and owner.display_name else None) or (
        org.name if org else "Boat owner"
    )
    return BoatOwnerProfileOut(
        name=name,
        rating=avg_rating,
        review_count=review_count,
        response_rate_percent=float(org.owner_response_rate_percent if org else 100.0),
        avg_response_time=(org.owner_avg_response_time if org and org.owner_avg_response_time else "< 1 hour"),
    )


def build_listing_policies(activity: Activity, db: Session, cancel_summary: str | None) -> BoatListingPoliciesOut:
    allowed_ids = set(json_list_from_db(activity.allowed_on_boat))
    if not allowed_ids:
        allowed_ids = {"swimming", "alcohol", "kids_under_12", "fishing"}

    tier = (activity.cancellation_tier or "flexible").lower()
    commercial_summary = None
    if activity.is_commercial_owner:
        commercial_summary = (
            "This listing is operated by a licensed commercial charter. "
            "Additional maritime regulations may apply."
        )

    return BoatListingPoliciesOut(
        allowed_on_boat=[
            AllowedOnBoatItemOut(id=item["id"], label=item["label"], allowed=item["id"] in allowed_ids)
            for item in ALLOWED_ON_BOAT
        ],
        cancellation_tier=tier,
        cancellation_summary=cancel_summary,
        is_commercial_owner=bool(activity.is_commercial_owner),
        commercial_owner_summary=commercial_summary,
        security_deposit_cents=activity.security_deposit_cents,
    )
