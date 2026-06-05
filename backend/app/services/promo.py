from app.models import PromoCode


def is_promo_exhausted(promo: PromoCode) -> bool:
    return bool(promo.max_uses is not None and promo.used_count >= promo.max_uses)


def record_promo_use(db: Session, promo_code: str | None) -> None:
    """Increment usage when a booking is confirmed paid."""
    if not promo_code:
        return
    promo = (
        db.query(PromoCode)
        .filter(PromoCode.code == promo_code)
        .with_for_update()
        .first()
    )
    if promo:
        promo.used_count += 1


def release_promo_use(db: Session, promo_code: str | None) -> None:
    """Return a use when a paid booking is cancelled."""
    if not promo_code:
        return
    promo = (
        db.query(PromoCode)
        .filter(PromoCode.code == promo_code)
        .with_for_update()
        .first()
    )
    if promo and promo.used_count > 0:
        promo.used_count -= 1
