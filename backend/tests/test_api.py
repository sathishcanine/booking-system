from fastapi.testclient import TestClient


def test_health_endpoint():
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "env" in data


def test_security_headers_on_api():
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_config_endpoint():
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "site_timezone" in data


def test_contact_inquiry_submission():
    from app.main import app

    with TestClient(app) as client:
        response = client.post(
            "/api/contact",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane@example.com",
                "phone": "+1 555 0100",
                "message": "Interested in a sunset cruise.",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert isinstance(data["id"], int)
