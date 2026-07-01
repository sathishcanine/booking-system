import os
import tempfile

# Configure test environment before any app imports.
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SEED_DEMO_DATA", "false")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_test_db.name}")
os.environ.setdefault("REQUIRE_STRONG_ADMIN_SECRETS", "false")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "0")
