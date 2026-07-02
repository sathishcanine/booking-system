import calendar
import json
import random
import secrets
from datetime import date, datetime, timedelta

from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.marketplace_config import CAPTAIN_ALTERNATIVES, MARKET_CITY, MARKET_LABEL, MARKET_STATE
from app.models import (
    Activity,
    Booking,
    BookingItem,
    BookingStatus,
    Captain,
    ListingStatus,
    Organization,
    OrganizationStatus,
    PlatformSettings,
    PromoCode,
    Review,
    Slot,
    TicketType,
    User,
    UserRole,
)
from app.services.captains import unique_captain_slug
from app.listings import json_list_to_db
from app.passwords import hash_password
from app.timeutil import utc_naive, utcnow

SATHISH_OWNER_EMAIL = "sathishcanine@gmail.com"
SATHISH_ORG_SLUG = "sathish-marine"

random.seed(42)

PHONE = "+1-727-555-0199"
DEFAULT_ORG_SLUG = "coastal-booking"
DEFAULT_ORG_NAME = "Alis Adventures"

SLOT_TEMPLATES = [
    ("sunset", 19, 0, 24, "2.5hr sunset cruise with dolphin watching.", None, None, None, None),
    ("sandbar", 10, 0, 20, "4hr sandbar party — drinks included.", "brand", "SKYBEACH RESORT", None, None),
    ("sandbar", 14, 15, 20, "4hr afternoon sandbar party.", None, None, "Save $10", None),
    ("charter", 0, 0, 1, "Private water sports charter.", None, None, None, "call"),
    ("charter", 9, 0, 1, "Morning charter — call to reserve.", None, None, None, "call"),
    ("egmont", 9, 30, 18, "Full-day Egmont Key adventure.", "image", None, None, None),
    ("float_party", 11, 0, 22, "Family float party at Shell Key.", "image", None, "Almost Sold Out!", None),
    ("booze", 19, 30, 16, "Evening booze cruise — 21+ only.", None, None, None, None),
    ("sunset", 7, 0, 24, "Early bird sunset dolphin tour.", None, None, None, None),
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
        ("booking_cutoff_hours", "INTEGER"),
    ]
    with engine.begin() as conn:
        for name, typedef in alters:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE slots ADD COLUMN {name} {typedef}"))


def _ensure_platform_columns():
    """Add multi-tenant columns to existing SQLite DBs."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "activities" in tables:
            cols = {c["name"] for c in insp.get_columns("activities")}
            if "organization_id" not in cols:
                conn.execute(text("ALTER TABLE activities ADD COLUMN organization_id INTEGER"))
        if "promo_codes" in tables:
            cols = {c["name"] for c in insp.get_columns("promo_codes")}
            if "organization_id" not in cols:
                conn.execute(text("ALTER TABLE promo_codes ADD COLUMN organization_id INTEGER"))


def _ensure_listing_columns():
    """Add boat listing columns (Phase 2) to existing SQLite DBs."""
    insp = inspect(engine)
    if "activities" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("activities")}
    alters = [
        ("listing_status", "VARCHAR(20) DEFAULT 'draft'"),
        ("max_guests", "INTEGER"),
        ("boat_type", "VARCHAR(80)"),
        ("marina_name", "VARCHAR(200)"),
        ("city", "VARCHAR(120)"),
        ("state", "VARCHAR(80)"),
        ("amenities", "TEXT"),
        ("photo_urls", "TEXT"),
        ("captain_required", "BOOLEAN DEFAULT 0"),
    ]
    with engine.begin() as conn:
        for name, typedef in alters:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE activities ADD COLUMN {name} {typedef}"))


def _ensure_listing_detail_columns():
    """Boat detail page — crew, policies, allowed-on-boat."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "organizations" in tables:
            org_cols = {c["name"] for c in insp.get_columns("organizations")}
            for name, typedef in [
                ("owner_response_rate_percent", "REAL DEFAULT 100"),
                ("owner_avg_response_time", "VARCHAR(80)"),
                ("owner_bio", "TEXT"),
                ("phone_verified", "BOOLEAN DEFAULT 1"),
            ]:
                if name not in org_cols:
                    conn.execute(text(f"ALTER TABLE organizations ADD COLUMN {name} {typedef}"))
        if "activities" not in tables:
            return
        act_cols = {c["name"] for c in insp.get_columns("activities")}
        for name, typedef in [
            ("allowed_on_boat", "TEXT"),
            ("cancellation_tier", "VARCHAR(40)"),
            ("security_deposit_cents", "INTEGER"),
            ("is_commercial_owner", "BOOLEAN DEFAULT 0"),
            ("default_captain_name", "VARCHAR(120)"),
            ("default_captain_rating", "REAL"),
            ("default_captain_review_count", "INTEGER DEFAULT 0"),
            ("default_captain_trips", "INTEGER DEFAULT 0"),
            ("captain_coast_guard_verified", "BOOLEAN DEFAULT 1"),
            ("default_captain_id", "INTEGER"),
        ]:
            if name not in act_cols:
                conn.execute(text(f"ALTER TABLE activities ADD COLUMN {name} {typedef}"))


def _ensure_captain_booking_column():
    insp = inspect(engine)
    if "bookings" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("bookings")}
    if "captain_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN captain_id INTEGER"))


def _ensure_captain_photo_column():
    insp = inspect(engine)
    if "captains" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("captains")}
    if "photo_url" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE captains ADD COLUMN photo_url VARCHAR(500)"))


def _ensure_captain_profile_columns():
    insp = inspect(engine)
    if "captains" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("captains")}
    alters = [
        ("experience", "VARCHAR(40)"),
        ("license_types", "TEXT"),
        ("specializations", "TEXT"),
    ]
    pending = [(name, typedef) for name, typedef in alters if name not in existing]
    if not pending:
        return
    with engine.begin() as conn:
        for name, typedef in pending:
            conn.execute(text(f"ALTER TABLE captains ADD COLUMN {name} {typedef}"))


def _seed_org_captains(db, org: Organization) -> None:
    if db.query(Captain).filter(Captain.organization_id == org.id).first():
        return
    now = utcnow()
    for spec in CAPTAIN_ALTERNATIVES:
        slug = unique_captain_slug(db, spec["id"], org.id)
        db.add(
            Captain(
                organization_id=org.id,
                name=spec["name"],
                slug=slug,
                bio=spec.get("bio"),
                location=spec.get("location"),
                coast_guard_verified=bool(spec.get("coast_guard_verified", False)),
                phone_verified=bool(spec.get("phone_verified", False)),
                is_active=True,
                created_at=now,
            )
        )


def _ensure_search_filter_columns():
    """Boat search filter fields (Boatsetter-style browse)."""
    insp = inspect(engine)
    if "activities" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("activities")}
    alters = [
        ("min_rental_hours", "INTEGER DEFAULT 2"),
        ("max_rental_hours", "INTEGER DEFAULT 8"),
        ("instant_book", "BOOLEAN DEFAULT 1"),
        ("bareboat_allowed", "BOOLEAN DEFAULT 1"),
        ("activity_tags", "TEXT"),
        ("boat_make", "VARCHAR(80)"),
        ("boat_model", "VARCHAR(120)"),
    ]
    with engine.begin() as conn:
        for name, typedef in alters:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE activities ADD COLUMN {name} {typedef}"))


def _ensure_marketplace_content_columns():
    """Destination page copy configurable by super admin."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "platform_settings" not in tables:
            return
        cols = {c["name"] for c in insp.get_columns("platform_settings")}
        alters = [
            ("marketplace_promise_title", "TEXT"),
            ("marketplace_promise_items", "TEXT"),
            ("destination_best_title_template", "TEXT"),
            ("destination_type_title_template", "TEXT"),
        ]
        for name, typedef in alters:
            if name not in cols:
                conn.execute(text(f"ALTER TABLE platform_settings ADD COLUMN {name} {typedef}"))


def _ensure_review_columns():
    """Add reviews table and trip protection setting (Phase 7)."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "platform_settings" in tables:
            cols = {c["name"] for c in insp.get_columns("platform_settings")}
            if "trip_protection_summary" not in cols:
                conn.execute(
                    text("ALTER TABLE platform_settings ADD COLUMN trip_protection_summary TEXT")
                )


def _ensure_optional_review_booking():
    """Allow sample reviews without a backing booking row."""
    insp = inspect(engine)
    if "reviews" not in insp.get_table_names():
        return
    booking_col = next((c for c in insp.get_columns("reviews") if c["name"] == "booking_id"), None)
    if booking_col and booking_col.get("nullable"):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE reviews_new (
                    id INTEGER PRIMARY KEY,
                    booking_id INTEGER REFERENCES bookings(id),
                    activity_id INTEGER NOT NULL REFERENCES activities(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    rating INTEGER NOT NULL,
                    body TEXT,
                    reviewer_name VARCHAR(120) NOT NULL,
                    owner_response TEXT,
                    owner_response_at DATETIME,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO reviews_new (
                    id, booking_id, activity_id, user_id, rating, body,
                    reviewer_name, owner_response, owner_response_at, created_at
                )
                SELECT
                    id, booking_id, activity_id, user_id, rating, body,
                    reviewer_name, owner_response, owner_response_at, created_at
                FROM reviews
                """
            )
        )
        conn.execute(text("DROP TABLE reviews"))
        conn.execute(text("ALTER TABLE reviews_new RENAME TO reviews"))
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_review_booking "
                "ON reviews(booking_id) WHERE booking_id IS NOT NULL"
            )
        )


def _ensure_cancellation_columns():
    """Add cancellation policy and refund tracking columns (Phase 6)."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "platform_settings" in tables:
            cols = {c["name"] for c in insp.get_columns("platform_settings")}
            ps_alters = [
                ("cancel_full_refund_hours", "REAL DEFAULT 48"),
                ("cancel_partial_refund_hours", "REAL DEFAULT 24"),
                ("cancel_partial_refund_percent", "REAL DEFAULT 50"),
            ]
            for name, typedef in ps_alters:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE platform_settings ADD COLUMN {name} {typedef}"))
        if "bookings" in tables:
            cols = {c["name"] for c in insp.get_columns("bookings")}
            booking_alters = [
                ("cancelled_at", "DATETIME"),
                ("refund_cents", "INTEGER DEFAULT 0"),
                ("cancellation_reason", "VARCHAR(200)"),
                ("cancelled_by", "VARCHAR(20)"),
                ("stripe_refund_id", "VARCHAR(100)"),
            ]
            for name, typedef in booking_alters:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {name} {typedef}"))


def _ensure_rental_columns():
    """Add boat rental booking columns."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "activities" in tables:
            cols = {c["name"] for c in insp.get_columns("activities")}
            for name, typedef in [
                ("hourly_rate_cents", "INTEGER"),
                ("length_ft", "INTEGER"),
            ]:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE activities ADD COLUMN {name} {typedef}"))
        if "users" in tables:
            cols = {c["name"] for c in insp.get_columns("users")}
            for name, typedef in [
                ("google_sub", "VARCHAR(128)"),
                ("auth_provider", "VARCHAR(20) DEFAULT 'password'"),
            ]:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {typedef}"))
        if "bookings" in tables:
            cols = {c["name"] for c in insp.get_columns("bookings")}
            for name, typedef in [
                ("activity_id", "INTEGER"),
                ("booking_kind", "VARCHAR(20) DEFAULT 'departure'"),
                ("rental_starts_at", "DATETIME"),
                ("duration_hours", "INTEGER"),
                ("passenger_count", "INTEGER"),
                ("captain_included", "BOOLEAN DEFAULT 0"),
                ("insurance_cents", "INTEGER DEFAULT 0"),
                ("addon_cents", "INTEGER DEFAULT 0"),
                ("boat_price_cents", "INTEGER DEFAULT 0"),
                ("captain_price_cents", "INTEGER DEFAULT 0"),
            ]:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {name} {typedef}"))
            # SQLite cannot ALTER COLUMN nullability — new rentals use null slot_id via create_all


def _ensure_renter_columns():
    """Add renter account columns (Phase 5)."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "users" in tables:
            cols = {c["name"] for c in insp.get_columns("users")}
            if "display_name" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR(120)"))
        if "bookings" in tables:
            cols = {c["name"] for c in insp.get_columns("bookings")}
            if "renter_user_id" not in cols:
                conn.execute(text("ALTER TABLE bookings ADD COLUMN renter_user_id INTEGER"))


def _ensure_connect_columns():
    """Add Stripe Connect and payment split columns (Phase 4)."""
    insp = inspect(engine)
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "organizations" in tables:
            cols = {c["name"] for c in insp.get_columns("organizations")}
            org_alters = [
                ("stripe_connect_account_id", "VARCHAR(100)"),
                ("stripe_connect_charges_enabled", "BOOLEAN DEFAULT 0"),
                ("stripe_connect_payouts_enabled", "BOOLEAN DEFAULT 0"),
                ("stripe_connect_details_submitted", "BOOLEAN DEFAULT 0"),
            ]
            for name, typedef in org_alters:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE organizations ADD COLUMN {name} {typedef}"))
        if "bookings" in tables:
            cols = {c["name"] for c in insp.get_columns("bookings")}
            booking_alters = [
                ("organization_id", "INTEGER"),
                ("platform_fee_cents", "INTEGER DEFAULT 0"),
                ("owner_payout_cents", "INTEGER DEFAULT 0"),
            ]
            for name, typedef in booking_alters:
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {name} {typedef}"))


def _ensure_platform_settings_row(db) -> None:
    if not db.query(PlatformSettings).filter(PlatformSettings.id == 1).first():
        db.add(
            PlatformSettings(
                id=1,
                platform_fee_percent=settings.platform_fee_percent,
                tax_rate_percent=settings.tax_rate_percent,
            )
        )
        db.flush()


def _backfill_booking_org_ids(db) -> None:
    for booking in db.query(Booking).filter(Booking.organization_id.is_(None)).all():
        slot = db.query(Slot).filter(Slot.id == booking.slot_id).first()
        if not slot:
            continue
        activity = db.query(Activity).filter(Activity.id == slot.activity_id).first()
        if activity:
            booking.organization_id = activity.organization_id
    db.flush()


def _backfill_search_defaults(db) -> None:
    tag_map = {
        "dolphin-island-sunset": ["cruising", "celebrating"],
        "sandbar-party": ["celebrating", "cruising"],
        "water-sports-charter": ["watersports"],
        "egmont-key": ["cruising", "fishing"],
        "float-party": ["celebrating", "watersports"],
        "booze-cruise": ["celebrating", "cruising"],
    }
    for act in db.query(Activity).all():
        if act.min_rental_hours is None or act.min_rental_hours < 1:
            act.min_rental_hours = 2
        if act.max_rental_hours is None or act.max_rental_hours < act.min_rental_hours:
            act.max_rental_hours = max(8, act.min_rental_hours)
        if act.instant_book is None:
            act.instant_book = True
        if act.bareboat_allowed is None:
            act.bareboat_allowed = not act.captain_required
        if not act.activity_tags and act.slug in tag_map:
            act.activity_tags = json_list_to_db(tag_map[act.slug])
    db.flush()


def _normalize_market_location(db) -> None:
    """Ensure every listing is scoped to the St. Petersburg market."""
    for act in db.query(Activity).all():
        act.city = MARKET_CITY
        act.state = MARKET_STATE
        if not act.location_label or "miami" in (act.location_label or "").lower():
            act.location_label = MARKET_LABEL
    db.flush()


def _ensure_sathish_owner_boats(db) -> None:
    """Demo owner account with St. Petersburg listings for marketplace search UI."""
    org = db.query(Organization).filter(Organization.slug == SATHISH_ORG_SLUG).first()
    if not org:
        org = Organization(
            name="Sathish Marine",
            slug=SATHISH_ORG_SLUG,
            status=OrganizationStatus.APPROVED,
            contact_email=SATHISH_OWNER_EMAIL,
            created_at=utc_naive(utcnow()),
            owner_response_rate_percent=100.0,
            owner_avg_response_time="< 1 hour",
            owner_bio="St. Petersburg charter operator — yachts, pontoons, and sandbar trips from the municipal marina.",
            phone_verified=True,
        )
        db.add(org)
        db.flush()
    else:
        org.owner_response_rate_percent = 100.0
        org.owner_avg_response_time = "< 1 hour"
        org.phone_verified = True
        if not org.owner_bio:
            org.owner_bio = (
                "St. Petersburg charter operator — yachts, pontoons, and sandbar trips from the municipal marina."
            )

    user = db.query(User).filter(User.email == SATHISH_OWNER_EMAIL).first()
    if not user:
        user = User(
            email=SATHISH_OWNER_EMAIL,
            password_hash=hash_password(settings.admin_password),
            display_name="Sathish",
            role=UserRole.OWNER,
            organization_id=org.id,
            is_active=True,
            created_at=utc_naive(utcnow()),
        )
        db.add(user)
        db.flush()
    elif user.organization_id != org.id:
        user.organization_id = org.id
        user.role = UserRole.OWNER

    # Boatsetter-style listing photos (verified Unsplash URLs)
    _yacht_cruise = "https://images.unsplash.com/photo-1763877320106-803a588a0e72?w=800&q=80"
    _yacht_miami = "https://images.unsplash.com/photo-1740482881422-899f17e54d61?w=800&q=80"
    _yacht_docked = "https://images.unsplash.com/photo-1645448650081-1d2c65e69699?w=800&q=80"
    _fishing_boat = "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"
    _wake_boat = "https://images.unsplash.com/photo-1779521725282-8425b80e26ab?w=800&q=80"
    _catamaran = "https://images.unsplash.com/photo-1769610352818-cf8fa29ccf9a?w=800&q=80"
    _catamaran_beach = "https://images.unsplash.com/photo-1763402084814-e6a988900ba2?w=800&q=80"
    _sandbar = "https://images.unsplash.com/photo-1747607470024-79b6678a1a67?w=800&q=80"
    _sandbar_aerial = "https://images.unsplash.com/photo-1616984366240-479bd31d60ef?w=800&q=80"

    st_pete_boats = [
        {
            "slug": "galeon-45ft-miami",
            "title": "Luxury New Galeon 45ft Yacht, Professional staff, paddleboard",
            "description": "Contemporary Galeon yacht with elegant cabins, climate control, and pro crew.",
            "hourly_rate_cents": 30300,
            "length_ft": 45,
            "max_guests": 13,
            "captain_required": True,
            "bareboat_allowed": False,
            "min_rental_hours": 2,
            "max_rental_hours": 8,
            "activity_tags": ["cruising", "celebrating"],
            "boat_type": "yacht",
            "amenities": ["Bathroom", "Bluetooth audio", "Floating mat", "GPS", "Grill"],
            "image_url": _yacht_cruise,
            "photo_urls": [_yacht_cruise, _yacht_miami, _yacht_docked],
        },
        {
            "slug": "azimut-45ft-miami",
            "title": "Miami's Magic Unfolds Aboard a 45ft Azimut!",
            "description": "Azimut flybridge — perfect for Biscayne Bay and sandbar days.",
            "hourly_rate_cents": 29000,
            "length_ft": 45,
            "max_guests": 12,
            "captain_required": True,
            "bareboat_allowed": False,
            "min_rental_hours": 3,
            "max_rental_hours": 8,
            "activity_tags": ["cruising", "celebrating"],
            "boat_type": "yacht",
            "amenities": ["Bathroom", "Bluetooth audio", "Refrigerator", "GPS"],
            "image_url": _yacht_docked,
            "photo_urls": [_yacht_docked, _yacht_miami, _yacht_cruise],
        },
        {
            "slug": "miami-fishing-charter",
            "title": "Offshore Fishing — 32ft Center Console",
            "description": "Reef and offshore fishing with rods, bait, and experienced captain.",
            "hourly_rate_cents": 18500,
            "length_ft": 32,
            "max_guests": 6,
            "captain_required": True,
            "bareboat_allowed": False,
            "min_rental_hours": 4,
            "max_rental_hours": 8,
            "activity_tags": ["fishing"],
            "boat_type": "fishing",
            "amenities": ["GPS", "Cooler", "Bathroom"],
            "image_url": _fishing_boat,
            "photo_urls": [
                _fishing_boat,
                "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
            ],
        },
        {
            "slug": "miami-wake-sports",
            "title": "Wake & Tube Adventure — 24ft Bowrider",
            "description": "Watersports day with wakeboard, tubes, and floating mat.",
            "hourly_rate_cents": 16500,
            "length_ft": 24,
            "max_guests": 8,
            "captain_required": False,
            "bareboat_allowed": False,
            "min_rental_hours": 2,
            "max_rental_hours": 6,
            "activity_tags": ["watersports"],
            "boat_type": "deck_boat",
            "amenities": ["Bluetooth audio", "Wakeboard", "Floating mat", "Cooler"],
            "image_url": _wake_boat,
            "photo_urls": [
                _wake_boat,
                "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80",
            ],
        },
        {
            "slug": "miami-sail-sunset",
            "title": "Sunset Sail — 38ft Catamaran",
            "description": "Relaxing sunset sail on a stable catamaran with captain.",
            "hourly_rate_cents": 22000,
            "length_ft": 38,
            "max_guests": 10,
            "captain_required": True,
            "bareboat_allowed": False,
            "min_rental_hours": 2,
            "max_rental_hours": 6,
            "activity_tags": ["sailing", "cruising"],
            "boat_type": "catamaran",
            "amenities": ["Bluetooth audio", "Cooler", "Floating mat"],
            "image_url": _catamaran,
            "photo_urls": [_catamaran, _catamaran_beach],
        },
        {
            "slug": "miami-party-pontoon",
            "title": "Party Pontoon — Biscayne Sandbar",
            "description": "Big group pontoon for sandbar parties with captain and cooler.",
            "hourly_rate_cents": 14000,
            "length_ft": 28,
            "max_guests": 14,
            "captain_required": False,
            "bareboat_allowed": True,
            "min_rental_hours": 2,
            "max_rental_hours": 8,
            "activity_tags": ["celebrating", "cruising"],
            "boat_type": "pontoon",
            "amenities": ["Bluetooth audio", "Grill", "Cooler", "Floating mat"],
            "image_url": _sandbar,
            "photo_urls": [_sandbar, _sandbar_aerial],
            "allowed_on_boat": ["swimming", "alcohol", "kids_under_12", "fishing", "pets"],
            "cancellation_tier": "flexible",
            "security_deposit_cents": 50000,
            "is_commercial_owner": True,
            "default_captain_name": "TBD",
            "default_captain_rating": 4.9,
            "default_captain_review_count": 25,
            "default_captain_trips": 550,
        },
    ]

    listing_detail_defaults = {
        "allowed_on_boat": ["swimming", "alcohol", "kids_under_12"],
        "cancellation_tier": "flexible",
        "security_deposit_cents": 75000,
        "is_commercial_owner": True,
        "default_captain_name": "TBD",
        "default_captain_rating": 4.9,
        "default_captain_review_count": 25,
        "default_captain_trips": 550,
        "captain_coast_guard_verified": True,
    }

    for spec in st_pete_boats:
        act = (
            db.query(Activity)
            .filter(Activity.organization_id == org.id, Activity.slug == spec["slug"])
            .first()
        )
        photos = spec.get("photo_urls") or ([spec["image_url"]] if spec.get("image_url") else [])
        fields = {
            "organization_id": org.id,
            "title": spec["title"],
            "slug": spec["slug"],
            "description": spec["description"],
            "duration_minutes": spec["max_rental_hours"] * 60,
            "location_label": MARKET_LABEL,
            "city": MARKET_CITY,
            "state": MARKET_STATE,
            "marina_name": "St. Petersburg Municipal Marina",
            "listing_status": ListingStatus.PUBLISHED,
            "is_active": True,
            "max_guests": spec["max_guests"],
            "boat_type": spec["boat_type"],
            "captain_required": spec["captain_required"],
            "bareboat_allowed": spec["bareboat_allowed"],
            "hourly_rate_cents": spec["hourly_rate_cents"],
            "length_ft": spec["length_ft"],
            "min_rental_hours": spec["min_rental_hours"],
            "max_rental_hours": spec["max_rental_hours"],
            "instant_book": True,
            "activity_tags": json_list_to_db(spec["activity_tags"]),
            "amenities": json_list_to_db(spec["amenities"]),
            "photo_urls": json_list_to_db(photos),
            "image_url": spec.get("image_url") or (photos[0] if photos else None),
            "meeting_instructions": "Meet at St. Petersburg Municipal Marina — details sent after booking.",
            **{
                k: v
                for k, v in listing_detail_defaults.items()
                if k not in spec and k != "allowed_on_boat"
            },
        }
        allowed = spec.get("allowed_on_boat", listing_detail_defaults["allowed_on_boat"])
        fields["allowed_on_boat"] = json_list_to_db(allowed)
        if act:
            for k, v in fields.items():
                setattr(act, k, v)
        else:
            db.add(Activity(**fields))
    db.flush()


def _backfill_hourly_rates(db) -> None:
    for activity in db.query(Activity).all():
        if activity.hourly_rate_cents:
            continue
        if activity.ticket_types:
            min_price = min(t.price_cents for t in activity.ticket_types)
            guests = activity.max_guests or 1
            activity.hourly_rate_cents = max(35000, (min_price * guests) // 2)
        else:
            activity.hourly_rate_cents = 35000
    db.flush()


def _backfill_listing_defaults(db) -> None:
    for act in db.query(Activity).all():
        if act.listing_status is None:
            act.listing_status = ListingStatus.PUBLISHED
            continue
        if act.listing_status == ListingStatus.DRAFT:
            has_slots = db.query(Slot.id).filter(Slot.activity_id == act.id).first()
            if has_slots:
                act.listing_status = ListingStatus.PUBLISHED
    db.flush()


def _backfill_activity_geo(db) -> None:
    """Set city/state on legacy rows missing geo (Phase 8 destinations)."""
    slug_geo = {
        "dolphin-island-sunset": (MARKET_CITY, MARKET_STATE),
        "sandbar-party": (MARKET_CITY, MARKET_STATE),
        "private-charter": (MARKET_CITY, MARKET_STATE),
        "egmont-key": (MARKET_CITY, MARKET_STATE),
        "float-party": (MARKET_CITY, MARKET_STATE),
        "booze-cruise": (MARKET_CITY, MARKET_STATE),
    }
    for act in db.query(Activity).filter(
        (Activity.city.is_(None)) | (Activity.city == "")
    ).all():
        if act.slug in slug_geo:
            act.city, act.state = slug_geo[act.slug]
            continue
        label = (act.location_label or "").lower()
        if "gulfport" in label:
            act.city, act.state = "Gulfport", "FL"
        elif "skybeach" in label or "treasure" in label:
            act.city, act.state = "Treasure Island", "FL"
        elif "marinemax" in label or "st. pete" in label:
            act.city, act.state = "St. Petersburg", "FL"
        elif act.marina_name:
            act.city = act.marina_name.split()[0]
            act.state = "FL"
    db.flush()


def _ensure_default_platform_org(db) -> Organization:
    org = db.query(Organization).filter(Organization.slug == DEFAULT_ORG_SLUG).first()
    if not org:
        org = Organization(
            name=DEFAULT_ORG_NAME,
            slug=DEFAULT_ORG_SLUG,
            status=OrganizationStatus.APPROVED,
            contact_email=settings.super_admin_email,
            created_at=utc_naive(utcnow()),
        )
        db.add(org)
        db.flush()
    elif org.name in ("Coastal Booking Platform", "Alis-Adventure"):
        org.name = DEFAULT_ORG_NAME

    for act in db.query(Activity).filter(Activity.organization_id.is_(None)).all():
        act.organization_id = org.id
    for promo in db.query(PromoCode).filter(PromoCode.organization_id.is_(None)).all():
        promo.organization_id = org.id
    db.flush()
    return org


def _ensure_super_admin_user(db, org: Organization) -> None:
    email = settings.super_admin_email.lower().strip()
    password = settings.super_admin_password or settings.admin_password
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return
    db.add(
        User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.SUPER_ADMIN,
            organization_id=None,
            is_active=True,
            created_at=utc_naive(utcnow()),
        )
    )


def _demo_month_pairs(today: date) -> list[tuple[int, int]]:
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


def _ensure_demo_tours(db, org) -> list[Activity]:
    """Create classic tour/cruise demo listings if not already present."""
    if db.query(Activity).filter(Activity.slug == "dolphin-island-sunset").first():
        return db.query(Activity).filter(Activity.slug.in_(DEMO_TOUR_SLUGS)).all()

    activities = [
        Activity(
            organization_id=org.id,
            listing_status=ListingStatus.PUBLISHED,
            max_guests=24,
            boat_type="pontoon",
            city="Gulfport",
            state="FL",
            marina_name="Gulfport Marina",
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
            organization_id=org.id,
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
            organization_id=org.id,
            title="Water Sports Charter",
            slug="water-sports-charter",
            description="Private charter — wakeboard, tubes, and more. 🚤",
            duration_minutes=180,
            location_label="Gulfport Marina Location",
            emoji="🚤",
        ),
        Activity(
            organization_id=org.id,
            title="Egmont Key Island Adventure",
            slug="egmont-key",
            description="Explore Egmont Key with snorkeling and wildlife. 🏝️",
            duration_minutes=300,
            location_label="Gulfport Marina Location",
            image_url="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400",
            emoji="🏝️🐬",
        ),
        Activity(
            organization_id=org.id,
            title="Shell Key Dolphin Float Party",
            slug="float-party",
            description="The ultimate family beach day by boat! 🐬☀️",
            duration_minutes=240,
            location_label="SkyBeach Resort Location",
            image_url="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
            emoji="🐬☀️",
        ),
        Activity(
            organization_id=org.id,
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
    if not db.query(PromoCode).filter(PromoCode.code == "SAVE10").first():
        db.add(
            PromoCode(
                organization_id=org.id,
                code="SAVE10",
                discount_cents=1000,
                max_uses=100,
            )
        )

    today = utcnow().date()
    total = 0
    for year, month in _demo_month_pairs(today):
        total += seed_month_slots(db, activities, year, month, today)
    if total:
        print(f"Added {total} demo tour slots for new listings.")
    return activities


DEMO_TOUR_SLUGS = frozenset(
    {
        "dolphin-island-sunset",
        "sandbar-party",
        "water-sports-charter",
        "egmont-key",
        "float-party",
        "booze-cruise",
    }
)


def ensure_demo_months(months: list[tuple[int, int]] | None = None) -> int:
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


def _purge_all_bookings(db) -> int:
    """Remove all booking rows and reset slot occupancy."""
    db.query(Review).filter(Review.booking_id.isnot(None)).delete(synchronize_session=False)
    db.query(BookingItem).delete(synchronize_session=False)
    removed = db.query(Booking).delete(synchronize_session=False)
    db.query(Slot).update({Slot.booked_count: 0}, synchronize_session=False)
    db.flush()
    return removed


def _ensure_demo_renter(db) -> User:
    email = "demo.renter@alis.example"
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(
        email=email,
        password_hash=hash_password(secrets.token_hex(16)),
        display_name="Demo Renter",
        role=UserRole.RENTER,
        organization_id=None,
        is_active=True,
        created_at=utc_naive(utcnow()),
    )
    db.add(user)
    db.flush()
    return user


# slug, rating, body, reviewer_name, days_ago, owner_response
SAMPLE_BOAT_REVIEWS = [
    (
        "galeon-45ft-miami",
        5,
        "The Galeon was immaculate — climate-controlled cabins, pro crew, and the floating mat was a hit. Instant book made planning easy.",
        "Reanna",
        18,
        "Thank you Reanna! Glad your group enjoyed the paddleboard and crew.",
    ),
    (
        "azimut-45ft-miami",
        5,
        "Miami's Magic lived up to the name. Flybridge views of Biscayne Bay were incredible and checkout through Alis was seamless.",
        "Marcus",
        24,
        None,
    ),
    (
        "miami-fishing-charter",
        5,
        "Captain put us on fish within an hour. Rods, bait, and cooler were ready — great half-day charter for our group.",
        "Elena",
        12,
        None,
    ),
    (
        "miami-wake-sports",
        4,
        "Wakeboard and tube runs were a blast. Boat was clean, stereo pumped, and bareboat option worked for our experienced driver.",
        "Jake",
        9,
        None,
    ),
    (
        "miami-sail-sunset",
        5,
        "Peaceful sunset sail on the catamaran. Captain was knowledgeable and the steady ride was perfect for our anniversary.",
        "Priya",
        30,
        "Congrats on the anniversary — thanks for sailing with us!",
    ),
    (
        "miami-party-pontoon",
        5,
        "Sandbar day with 12 friends — grill, cooler, and Bluetooth speakers were perfect. Captain optional pricing was clear upfront.",
        "Tyler",
        7,
        None,
    ),
    (
        "miami-party-pontoon",
        4,
        "Rented without captain for a calm morning. Easy pickup at Miami Beach Marina and the hourly rate was fair.",
        "Sofia",
        21,
        None,
    ),
]


def _seed_demo_reviews(db) -> None:
    """Sample boat reviews for published listings (no backing booking rows)."""
    renter = _ensure_demo_renter(db)
    deleted = db.query(Review).delete()
    db.flush()

    created = 0
    for spec in SAMPLE_BOAT_REVIEWS:
        slug, rating, body, reviewer_name, days_ago, owner_resp = spec
        activity = (
            db.query(Activity)
            .filter(Activity.slug == slug, Activity.listing_status == ListingStatus.PUBLISHED)
            .first()
        )
        if not activity:
            continue

        review = Review(
            booking_id=None,
            activity_id=activity.id,
            user_id=renter.id,
            rating=rating,
            body=body,
            reviewer_name=reviewer_name,
            owner_response=owner_resp,
            owner_response_at=utc_naive(utcnow()) if owner_resp else None,
            created_at=utc_naive(utcnow()) - timedelta(days=max(1, days_ago - 1)),
        )
        db.add(review)
        created += 1

    if created or deleted:
        db.flush()
        print(f"Seeded {created} boat reviews (removed {deleted} prior reviews).")


def seed():
    Base.metadata.create_all(bind=engine)
    _ensure_slot_columns()
    _ensure_platform_columns()
    _ensure_listing_columns()
    _ensure_connect_columns()
    _ensure_renter_columns()
    _ensure_rental_columns()
    _ensure_search_filter_columns()
    _ensure_listing_detail_columns()
    _ensure_marketplace_content_columns()
    _ensure_cancellation_columns()
    _ensure_review_columns()
    _ensure_optional_review_booking()
    _ensure_captain_booking_column()
    _ensure_captain_photo_column()
    _ensure_captain_profile_columns()
    db = SessionLocal()
    org = _ensure_default_platform_org(db)
    _ensure_super_admin_user(db, org)
    _ensure_platform_settings_row(db)
    _seed_org_captains(db, org)
    for extra_org in db.query(Organization).filter(Organization.id != org.id).all():
        _seed_org_captains(db, extra_org)
    _backfill_listing_defaults(db)
    _backfill_hourly_rates(db)
    _backfill_activity_geo(db)
    _backfill_booking_org_ids(db)
    _backfill_search_defaults(db)
    _ensure_sathish_owner_boats(db)
    _normalize_market_location(db)
    db.commit()

    if not settings.seed_demo_data:
        db.close()
        print("Skipping demo listings (SEED_DEMO_DATA=false / APP_ENV=production).")
        return

    _ensure_demo_tours(db, org)
    _seed_demo_reviews(db)
    db.commit()
    ensure_demo_months()
    db.close()
