from app.config import Settings


def test_production_enforces_strong_secrets(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
    s = Settings(
        admin_password="strong-password-here",
        admin_jwt_secret="x" * 32,
    )
    assert s.is_production
    assert s.seed_demo_data is False
    assert s.require_strong_admin_secrets is True


def test_development_seeds_demo_by_default(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
    s = Settings()
    assert s.seed_demo_data is True
    assert s.require_strong_admin_secrets is False


def test_seed_demo_data_override(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    s = Settings()
    assert s.seed_demo_data is True


def test_validate_admin_auth_rejects_weak_password(monkeypatch):
    import pytest

    from app.admin_auth import validate_admin_auth_config
    from app.config import settings

    monkeypatch.setattr(settings, "admin_password", "changeme")
    monkeypatch.setattr(settings, "admin_jwt_secret", "x" * 32)
    monkeypatch.setattr(settings, "require_strong_admin_secrets", True)
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        validate_admin_auth_config()
