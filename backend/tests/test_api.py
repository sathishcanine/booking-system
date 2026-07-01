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
