"""Marketplace categories, filters, and amenities — configurable catalog metadata."""

# Single-market focus: all listings and search are scoped to St. Petersburg, FL.
MARKET_CITY = "St. Petersburg"
MARKET_STATE = "FL"
MARKET_LABEL = "St. Petersburg, FL"

BOAT_CATEGORIES = [
    {"id": "watersports", "label": "Watersports"},
    {"id": "fishing", "label": "Fishing"},
    {"id": "sailing", "label": "Sailing"},
    {"id": "cruising", "label": "Cruising"},
    {"id": "celebrating", "label": "Celebrating"},
]

DURATION_FILTER_HOURS = [2, 3, 4, 6, 8]

POPULAR_AMENITIES = [
    "Bathroom",
    "Bluetooth audio",
    "Floating mat",
    "Grill",
    "GPS",
    "Refrigerator",
    "Shower",
    "Wakeboard",
    "Cooler",
    "Stereo",
    "Air conditioning",
    "Snorkel gear",
]

DEFAULT_PRICE_MAX_CENTS = 100_000  # $1,000/hr slider cap
DEFAULT_LENGTH_MAX_FT = 70

ALLOWED_ON_BOAT = [
    {"id": "pets", "label": "Pets"},
    {"id": "swimming", "label": "Swimming"},
    {"id": "smoking", "label": "Smoking"},
    {"id": "alcohol", "label": "Alcohol"},
    {"id": "kids_under_12", "label": "Kids under 12"},
    {"id": "fishing", "label": "Fishing"},
    {"id": "glass_bottles", "label": "Glass bottles"},
    {"id": "liveaboard", "label": "Liveaboard"},
]

# Alternate captains offered when guest changes captain on listing page.
CAPTAIN_ALTERNATIVES = [
    {
        "id": "tbd",
        "name": "TBD",
        "rating": 4.9,
        "review_count": 25,
        "trips_completed": 550,
        "coast_guard_verified": True,
        "phone_verified": True,
        "bio": None,
        "location": MARKET_LABEL,
        "aboard_since_year": 2023,
    },
    {
        "id": "marcus",
        "name": "Marcus",
        "rating": 4.8,
        "review_count": 42,
        "trips_completed": 320,
        "coast_guard_verified": True,
        "phone_verified": True,
        "bio": "USCG-licensed captain specializing in Biscayne Bay and sandbar trips.",
        "location": MARKET_LABEL,
        "aboard_since_year": 2021,
    },
    {
        "id": "elena",
        "name": "Elena",
        "rating": 5.0,
        "review_count": 18,
        "trips_completed": 210,
        "coast_guard_verified": True,
        "phone_verified": True,
        "bio": "Yacht captain with 10+ years on South Florida waters.",
        "location": MARKET_LABEL,
        "aboard_since_year": 2020,
    },
]


def captain_by_id(captain_id: str) -> dict | None:
    for captain in CAPTAIN_ALTERNATIVES:
        if captain["id"] == captain_id:
            return captain
    if captain_id == "default":
        return CAPTAIN_ALTERNATIVES[0]
    return None
