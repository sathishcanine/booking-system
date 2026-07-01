from pathlib import Path

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_ROOT / 'bookings.db'}"
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    seed_demo_data: bool | None = None
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    frontend_url: str = "http://localhost:5173"
    tax_rate_percent: float = 13.0
    platform_fee_percent: float = 15.0
    booking_hold_minutes: int = 3
    default_booking_cutoff_hours: int = 2
    site_timezone: str = "America/New_York"
    admin_password: str = "changeme"
    admin_jwt_secret: str = Field(
        default="dev-jwt-secret-change-me-in-production",
        validation_alias=AliasChoices("ADMIN_JWT_SECRET", "ADMIN_API_KEY"),
    )
    admin_jwt_expire_minutes: int = 30
    renter_jwt_expire_minutes: int = 60 * 24 * 7  # 7 days — guest marketplace sessions
    admin_login_max_attempts: int = 5
    admin_login_window_seconds: int = 900
    require_strong_admin_secrets: bool = False
    super_admin_email: str = "admin@localhost"
    super_admin_password: str = ""
    google_client_id: str = ""
    # Optional SMTP — booking confirmation emails (leave SMTP_HOST empty to disable)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    # Public API rate limit (requests per minute per IP; 0 = disabled)
    rate_limit_per_minute: int = 120

    @field_validator("database_url", mode="before")
    @classmethod
    def resolve_sqlite_path(cls, url: str) -> str:
        """Turn sqlite:///./bookings.db into an absolute path (cwd-independent)."""
        prefix = "sqlite:///./"
        if isinstance(url, str) and url.startswith(prefix):
            path = BACKEND_ROOT / url[len(prefix) :]
            return f"sqlite:///{path}"
        return url

    @field_validator("app_env")
    @classmethod
    def normalize_app_env(cls, value: str) -> str:
        env = (value or "development").strip().lower()
        if env not in {"development", "staging", "production"}:
            return "development"
        return env

    @model_validator(mode="after")
    def apply_environment_defaults(self) -> "Settings":
        if self.seed_demo_data is None:
            self.seed_demo_data = self.app_env == "development"
        if self.app_env == "production":
            self.require_strong_admin_secrets = True
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
