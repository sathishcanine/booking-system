from app.models import Activity
from app.services.boat_search import activity_matches_filters


def _activity(**kwargs) -> Activity:
    defaults = dict(
        max_guests=12,
        hourly_rate_cents=50000,
        min_rental_hours=2,
        max_rental_hours=8,
        instant_book=True,
        captain_required=False,
        bareboat_allowed=True,
        activity_tags='["yacht"]',
        amenities='["wifi"]',
        length_ft=45,
    )
    defaults.update(kwargs)
    return Activity(title="Test Boat", slug="test-boat", organization_id=1, **defaults)


def test_guests_filter_excludes_null_max_guests():
    boat = _activity(max_guests=None)
    assert activity_matches_filters(boat, guests=32) is False


def test_guests_filter_excludes_insufficient_capacity():
    boat = _activity(max_guests=10)
    assert activity_matches_filters(boat, guests=12) is False


def test_guests_filter_allows_sufficient_capacity():
    boat = _activity(max_guests=12)
    assert activity_matches_filters(boat, guests=12) is True


def test_instant_book_filter():
    boat = _activity(instant_book=False)
    assert activity_matches_filters(boat, instant_book=True) is False
    assert activity_matches_filters(boat, instant_book=False) is True
