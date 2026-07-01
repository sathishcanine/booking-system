def calc_booking_split(
    subtotal_cents: int,
    discount_cents: int,
    platform_fee_percent: float,
) -> tuple[int, int]:
    """Return (platform_fee_cents, owner_payout_cents) on pre-tax net."""
    net = max(0, subtotal_cents - discount_cents)
    platform_fee = int(round(net * platform_fee_percent / 100.0))
    owner_payout = max(0, net - platform_fee)
    return platform_fee, owner_payout
