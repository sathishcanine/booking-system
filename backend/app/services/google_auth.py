from google.auth.transport import requests
from google.oauth2 import id_token

from app.config import settings


def verify_google_credential(credential: str) -> dict:
    if not settings.google_client_id:
        raise ValueError("Google sign-in is not configured on the server")
    return id_token.verify_oauth2_token(
        credential,
        requests.Request(),
        settings.google_client_id,
    )
