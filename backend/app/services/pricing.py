from app.config import settings
from app.models import PromoCode


def calc_tax(subtotal_after_discount_cents: int) -> int:
    rate = settings.tax_rate_percent / 100.0
    return int(round(subtotal_after_discount_cents * rate))


def apply_promo(promo: PromoCode | None, subtotal_cents: int) -> int:
    if not promo:
        return 0
    if promo.discount_percent:
        return int(round(subtotal_cents * promo.discount_percent / 100))
    if promo.discount_cents:
        return min(promo.discount_cents, subtotal_cents)
    return 0
