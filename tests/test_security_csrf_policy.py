"""CSRF policy tests for auth and event endpoints."""

import os
import pytest

from src.app import create_app
from src.auth.models import User


@pytest.fixture(scope="function")
def app_csrf(test_db):
    """Create app with CSRF enforcement enabled."""
    os.environ["RPS_TESTING"] = "True"
    app = create_app("testing")
    app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=True,
        WTF_CSRF_CHECK_DEFAULT=True,
        RATELIMIT_ENABLED=False,
        RATELIMIT_STORAGE_URI="memory://",
    )
    return app


@pytest.fixture(scope="function")
def client_csrf(app_csrf):
    return app_csrf.test_client()


def _create_user():
    user = User(
        id=None,
        username="csrfuser",
        email="csrf@example.com",
        password_hash=User.hash_password("CsrfPass123"),
        email_verified=True,
    )
    user.save()
    return user


def _login(client):
    return client.post(
        "/api/auth/login",
        json={"username": "csrfuser", "password": "CsrfPass123"},
    )


def _csrf_headers(client):
    token_resp = client.get("/api/csrf")
    token = token_resp.get_json()["csrf_token"]
    return {"X-CSRF-Token": token}


def test_register_is_csrf_exempt(client_csrf):
    """Registration should remain CSRF exempt for unauthenticated flow."""
    response = client_csrf.post(
        "/api/auth/register",
        json={
            "username": "csrfnew",
            "email": "csrfnew@example.com",
            "password": "CsrfPass123",
        },
    )
    assert response.status_code == 201


def test_password_reset_request_is_csrf_exempt(client_csrf):
    """Password reset request should remain CSRF exempt for recovery flow."""
    response = client_csrf.post(
        "/api/auth/password-reset/request",
        json={"username": "nouser", "email": "nouser@example.com"},
    )
    assert response.status_code == 200


def test_login_is_csrf_exempt(client_csrf):
    """Login should remain CSRF exempt for unauthenticated flow."""
    response = client_csrf.post(
        "/api/auth/login",
        json={"username": "missing-user", "password": "bad-pass"},
    )
    # Invalid credentials, but not CSRF-blocked.
    assert response.status_code == 401


def test_password_reset_endpoints_are_csrf_exempt(client_csrf):
    """Reset/validate endpoints should fail by token semantics, not CSRF."""
    validate = client_csrf.post(
        "/api/auth/password-reset/validate-token",
        json={"token": "invalid-token"},
    )
    assert validate.status_code == 400

    reset = client_csrf.post(
        "/api/auth/password-reset/reset",
        json={"token": "invalid-token", "password": "Newpass123"},
    )
    assert reset.status_code == 400


def test_logout_requires_csrf_token(client_csrf):
    """Logout should reject missing CSRF token and accept valid token."""
    _create_user()
    login_resp = _login(client_csrf)
    assert login_resp.status_code == 200

    no_token = client_csrf.post("/api/auth/logout")
    assert no_token.status_code == 400

    with_token = client_csrf.post("/api/auth/logout", headers=_csrf_headers(client_csrf))
    assert with_token.status_code == 200


def test_events_require_trusted_origin(client_csrf):
    """CSRF-exempt events endpoints must still enforce trusted origin checks."""
    _create_user()
    login_resp = _login(client_csrf)
    assert login_resp.status_code == 200

    blocked = client_csrf.post("/api/events/click", json={"element_type": "button"})
    assert blocked.status_code == 403

    allowed = client_csrf.post(
        "/api/events/click",
        json={"element_type": "button"},
        headers={"Origin": "http://localhost"},
    )
    assert allowed.status_code == 200
