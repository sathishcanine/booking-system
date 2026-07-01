from app.services import email_service


def test_smtp_not_configured_by_default():
    assert email_service.smtp_configured() is False
