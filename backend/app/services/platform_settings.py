from sqlalchemy.orm import Session

from app.config import settings
from app.models import PlatformSettings


def get_platform_settings(db: Session) -> PlatformSettings:
    row = db.query(PlatformSettings).filter(PlatformSettings.id == 1).first()
    if row:
        return row
    row = PlatformSettings(
        id=1,
        platform_fee_percent=settings.platform_fee_percent,
        tax_rate_percent=settings.tax_rate_percent,
    )
    db.add(row)
    db.flush()
    return row
