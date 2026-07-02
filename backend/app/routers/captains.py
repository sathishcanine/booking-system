"""Public captain directory for the Captain Program."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import CaptainListItemOut, CaptainProfilePageOut
from app.services.marketplace_captains import get_marketplace_captain, list_marketplace_captains

router = APIRouter(prefix="/api/captains", tags=["captains"])


@router.get("", response_model=list[CaptainListItemOut])
def list_captains(
    license_type: list[str] | None = Query(None, alias="license"),
    experience: str | None = None,
    specialization: list[str] | None = Query(None, alias="specialization"),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    items, _total = list_marketplace_captains(
        db,
        license_types=license_type,
        experience=experience,
        specializations=specialization,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/{slug}", response_model=CaptainProfilePageOut)
def get_captain(slug: str, db: Session = Depends(get_db)):
    profile = get_marketplace_captain(db, slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Captain not found")
    return profile
