from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_ROOT / 'bookings.db'}"

    @field_validator("database_url", mode="before")
    @classmethod
    def resolve_sqlite_path(cls, url: str) -> str:
        """Turn sqlite:///./bookings.db into an absolute path (cwd-independent)."""
        prefix = "sqlite:///./"
        if isinstance(url, str) and url.startswith(prefix):
            path = BACKEND_ROOT / url[len(prefix) :]
            return f"sqlite:///{path}"
        return url
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    frontend_url: str = "http://localhost:5173"
    tax_rate_percent: float = 13.0
    booking_hold_minutes: int = 15
    site_timezone: str = "America/New_York"
    admin_password: str = "changeme"
    admin_api_key: str = "dev-admin-change-me-in-production"


settings = Settings()
