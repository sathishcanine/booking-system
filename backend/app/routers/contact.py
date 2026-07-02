"""Public contact form submissions."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContactInquiry
from app.schemas import ContactInquiryIn, ContactInquiryOut
from app.timeutil import utc_naive, utcnow

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("", response_model=ContactInquiryOut)
def submit_contact_inquiry(body: ContactInquiryIn, db: Session = Depends(get_db)):
    row = ContactInquiry(
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        email=body.email.strip().lower(),
        phone=body.phone.strip(),
        message=(body.message or "").strip() or None,
        is_read=False,
        created_at=utc_naive(utcnow()),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ContactInquiryOut(id=row.id)
