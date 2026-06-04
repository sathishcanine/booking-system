import calendar
import random
from datetime import date, datetime, timedelta

from sqlalchemy import inspect, text

from app.database import Base, SessionLocal, engine
from app.models import Activity, PromoCode, Slot, TicketType
from app.timeutil import utcnow

random.seed(42)

PHONE = "+1-727-555-0199"

SLOT_TEMPLATES = [
    ("sunset", 19, 0, 24, "2.5hr sunset cruise with dolphin watching.", None, None, None, None),
    ("sandbar", 10, 0, 20, "4hr sandbar party — drinks included.", "brand", "SKYBEACH RESORT", None, None),
    ("sandbar", 14, 15, 20, "4hr afternoon sandbar party.", None, None, "Save $10", None),
    ("charter", 0, 0, 1, "Private water sports charter.", None, None, None, "call"),
    ("charter", 9, 0, 1, "Morning charter — call to reserve.", None, None, None, "call"),
    ("egmont", 9, 30, 18, "Full-day Egmont Key adventure.", "image", None, None, None),
    ("float_party", 11, 0, 22, "Family float party at Shell Key.", "image", None, "Almost Sold Out!", None),
    ("booze", 19, 30, 16, "Evening booze cruise — 21+ only.", None, None, None, None),
    ("sunset", 7, 0, 24, "Early bird sunset dolphin tour.", None, None, "7 spots left", None),
]

def _ensure_slot_columns():
    """Add new columns to existing SQLite DBs without full reset."""
    insp = inspect(engine)
    if "slots" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("slots")}
    alters = [
        ("is_call_to_book", "BOOLEAN DEFAULT 0"),
        ("call_phone", "VARCHAR(30)"),
        ("brand_label", "VARCHAR(80)"),
        ("urgency_text", "VARCHAR(120)"),
    ]
    with engine.begin() as conn:
        for name, typedef in alters:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE slots ADD COLUMN {name} {typedef}"))


def _demo_month_pairs(today: date) -> list[tuple[int, int]]:
    """Current month and the next — good default for calendar demos."""
    pairs = [(today.year, today.month)]
    if today.month == 12:
        pairs.append((today.year + 1, 1))
    else:
        pairs.append((today.year, today.month + 1))
    return pairs


def _month_has_slots(db, year: int, month: int) -> bool:
    month_start = datetime(year, month, 1)
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    return (
        db.query(Slot.id)
        .filter(Slot.starts_at >= month_start, Slot.starts_at < month_end)
        .first()
        is not None
    )


def seed_month_slots(
    db,
    activities: list[Activity],
    year: int,
    month: int,
    today: date | None = None,
) -> int:
    """Populate one calendar month with sample departures. Returns slots created."""
    today = today or utcnow().date()
    by_slug = {a.slug: a for a in activities}
    act_map = {
        "sunset": by_slug["dolphin-island-sunset"],
        "sandbar": by_slug["sandbar-party"],
        "charter": by_slug["water-sports-charter"],
        "egmont": by_slug["egmont-key"],
        "float_party": by_slug["float-party"],
        "booze": by_slug["booze-cruise"],
    }
    templates = [
        (act_map[key], hour, minute, cap, desc, kind, brand, promo, mode)
        for key, hour, minute, cap, desc, kind, brand, promo, mode in SLOT_TEMPLATES
    ]

    _, days_in_month = calendar.monthrange(year, month)
    month_start = datetime(year, month, 1)
    created = 0

    for day_num in range(1, days_in_month + 1):
        day = month_start.replace(day=day_num)
        extra = 2 if day.weekday() >= 5 else 0
        picks = list(templates)
        if extra:
            picks.extend(random.sample(templates, min(extra, len(templates))))

        for act, hour, minute, cap, desc, kind, brand, promo, mode in picks:
            start = day.replace(hour=hour, minute=minute)
            booked = random.randint(0, max(0, cap - 1))
            if (
                year == today.year
                and month == today.month
                and day_num == today.day
                and hour < 12
            ):
                booked = cap

            is_call = mode == "call"
            if not is_call and booked >= cap:
                booked = cap
            if mode == "waitlist":
                booked = cap

            urgency = None
            if promo == "Almost Sold Out!":
                urgency = promo
                promo = None
            elif promo and "spots left" in promo:
                urgency = promo
                promo = None

            left = cap - booked
            if left <= 2 and left > 0 and not is_call:
                urgency = urgency or f"{left} spots left"
            if left == 0 and not is_call:
                booked = cap

            db.add(
                Slot(
                    activity_id=act.id,
                    starts_at=start,
                    ends_at=start + timedelta(minutes=act.duration_minutes),
                    capacity=cap,
                    booked_count=booked,
                    card_description=desc,
                    card_image_url=act.image_url if kind == "image" else None,
                    promo_text=promo if promo and "spots" not in promo else None,
                    brand_label=brand,
                    urgency_text=urgency,
                    is_call_to_book=is_call,
                    call_phone=PHONE if is_call else None,
                    waitlist_enabled=not is_call,
                )
            )
            created += 1

        heavy_day = day_num == 19 or (
            year == today.year and month == today.month and day_num == today.day
        )
        if heavy_day:
            for hour in [0, 1, 2, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]:
                act = random.choice(activities)
                start = day.replace(hour=hour, minute=0)
                db.add(
                    Slot(
                        activity_id=act.id,
                        starts_at=start,
                        ends_at=start + timedelta(minutes=act.duration_minutes),
                        capacity=20,
                        booked_count=random.randint(5, 18),
                        card_description=act.description,
                        card_image_url=act.image_url,
                    )
                )
                created += 1

    return created


def ensure_demo_months(months: list[tuple[int, int]] | None = None) -> int:
    """Backfill demo slots for months that have none (e.g. after month rollover)."""
    today = utcnow().date()
    months = months or _demo_month_pairs(today)
    db = SessionLocal()
    activities = db.query(Activity).all()
    if not activities:
        db.close()
        return 0

    total = 0
    for year, month in months:
        if _month_has_slots(db, year, month):
            continue
        total += seed_month_slots(db, activities, year, month, today)
    if total:
        db.commit()
        print(f"Added {total} demo slots for {months}.")
    db.close()
    return total


def seed():
    Base.metadata.create_all(bind=engine)
    _ensure_slot_columns()
    db = SessionLocal()
    if db.query(Activity).first():
        db.close()
        ensure_demo_months()
        return

    activities = [
        Activity(
            title="Dolphin Watching & Island Sunset",
            slug="dolphin-island-sunset",
            description="2.5hr Dolphin Watching & Island Sunset 🐬🌴🌅",
            duration_minutes=150,
            location_label="Gulfport Marina Location",
            image_url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400",
            emoji="🐬🌴🌅",
            meeting_instructions="Meet at Gulfport Marina, 4635 29th Ave S, Gulfport, FL 33711.",
        ),
        Activity(
            title="Sandbar Party",
            slug="sandbar-party",
            description="Boat #1: 4hr Sandbar Party with All You Can Drink! 🍹",
            duration_minutes=240,
            location_label="SkyBeach Resort Location",
            image_url="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400",
            emoji="🍹🌴",
            meeting_instructions="SkyBeach Resort dock — check in 20 minutes early.",
        ),
        Activity(
            title="Water Sports Charter",
            slug="water-sports-charter",
            description="Private charter — wakeboard, tubes, and more. 🚤",
            duration_minutes=180,
            location_label="Gulfport Marina Location",
            emoji="🚤",
        ),
        Activity(
            title="Egmont Key Island Adventure",
            slug="egmont-key",
            description="Explore Egmont Key with snorkeling and wildlife. 🏝️",
            duration_minutes=300,
            location_label="Gulfport Marina Location",
            image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
            emoji="🏝️🐬",
        ),
        Activity(
            title="Shell Key Dolphin Float Party",
            slug="float-party",
            description="The ultimate family beach day by boat! 🐬☀️",
            duration_minutes=240,
            location_label="SkyBeach Resort Location",
            image_url="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
            emoji="🐬☀️",
        ),
        Activity(
            title="Booze Cruise",
            slug="booze-cruise",
            description="2.5hr Booze Cruise with All You Can Drink! 🍹🌅",
            duration_minutes=150,
            location_label="SkyBeach Resort Location",
            emoji="🍹🌅",
        ),
    ]
    db.add_all(activities)
    db.flush()

    sunset, sandbar, charter, egmont, float_party, booze = activities

    db.add_all(
        [
            TicketType(
                activity_id=sunset.id,
                name="Island Sunset Cruise - Adults",
                subtitle="Shell Island Sunset Cruise",
                price_cents=5000,
                sort_order=1,
            ),
            TicketType(
                activity_id=sunset.id,
                name="Island Sunset Cruise - Children",
                subtitle="12 & Under",
                price_cents=2500,
                sort_order=2,
            ),
            TicketType(
                activity_id=sandbar.id,
                name="Adults",
                subtitle="21+",
                price_cents=8900,
                sort_order=1,
            ),
            TicketType(
                activity_id=charter.id,
                name="Charter (up to 6 guests)",
                subtitle="Price per boat",
                price_cents=59900,
                sort_order=1,
                max_per_booking=1,
            ),
            TicketType(
                activity_id=egmont.id,
                name="Adults",
                subtitle="Full day adventure",
                price_cents=7500,
                sort_order=1,
            ),
            TicketType(
                activity_id=float_party.id,
                name="Adults",
                subtitle="Float & dolphin experience",
                price_cents=6500,
                sort_order=1,
            ),
            TicketType(
                activity_id=booze.id,
                name="Adults",
                subtitle="21+",
                price_cents=5500,
                sort_order=1,
            ),
        ]
    )
    db.add(PromoCode(code="SAVE10", discount_cents=1000, max_uses=100))

    today = utcnow().date()
    total = 0
    for year, month in _demo_month_pairs(today):
        total += seed_month_slots(db, activities, year, month, today)

    db.commit()
    db.close()
    print(f"Database seeded with {total} demo slots across current and next month.")
