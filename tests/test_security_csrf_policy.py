"""CSRF policy tests for auth and event endpoints."""

import os
import secrets
import pytest

from src.app import create_app
from src.auth.models import User

TEST_USER_PASSWORD = f"Csrf-{secrets.token_urlsafe(12)}-A1!"
TEST_RESET_PASSWORD = f"Reset-{secrets.token_urlsafe(12)}-B2!"
INVALID_LOGIN_PASSWORD = f"Invalid-{secrets.token_urlsafe(8)}-C3!"


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
        password_hash=User.hash_password(TEST_USER_PASSWORD),
        email_verified=True,
    )
    user.save()
    return user


def _login(client):
    return client.post(
        "/api/auth/login",
        json={"username": "csrfuser", "password": TEST_USER_PASSWORD},
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
            "password": TEST_USER_PASSWORD,
        },
    )
    assert response.status_code == 201


def test_password_reset_request_requires_csrf_token(client_csrf):
    """Password reset request should require a CSRF token (security fix 2026-02-16)."""
    # Should fail without token
    response_no_token = client_csrf.post(
        "/api/auth/password-reset/request",
        json={"username": "nouser", "email": "nouser@example.com"},
    )
    assert response_no_token.status_code == 400

    # Should pass (or at least not be CSRF blocked) with token
    response_with_token = client_csrf.post(
        "/api/auth/password-reset/request",
        json={"username": "nouser", "email": "nouser@example.com"},
        headers=_csrf_headers(client_csrf)
    )
    assert response_with_token.status_code == 200


def test_login_is_csrf_exempt(client_csrf):
    """Login should remain CSRF exempt for unauthenticated flow."""
    response = client_csrf.post(
        "/api/auth/login",
        json={"username": "missing-user", "password": INVALID_LOGIN_PASSWORD},
    )
    # Invalid credentials, but not CSRF-blocked.
    assert response.status_code == 401


def test_password_reset_endpoints_require_csrf_token(client_csrf):
    """Reset/validate endpoints should require CSRF tokens (security fix 2026-02-16)."""
    # Validate should fail without token
    validate_no_token = client_csrf.post(
        "/api/auth/password-reset/validate-token",
        json={"token": "invalid-token"},
    )
    assert validate_no_token.status_code == 400

    # Validate should fail by token semantics (not CSRF) with token
    validate_with_token = client_csrf.post(
        "/api/auth/password-reset/validate-token",
        json={"token": "invalid-token"},
        headers=_csrf_headers(client_csrf)
    )
    assert validate_with_token.status_code == 400

    # Reset should fail without token
    reset_no_token = client_csrf.post(
        "/api/auth/password-reset/reset",
        json={"token": "invalid-token", "password": TEST_RESET_PASSWORD},
    )
    assert reset_no_token.status_code == 400

    # Reset should fail by token semantics (not CSRF) with token
    reset_with_token = client_csrf.post(
        "/api/auth/password-reset/reset",
        json={"token": "invalid-token", "password": TEST_RESET_PASSWORD},
        headers=_csrf_headers(client_csrf)
    )
    assert reset_with_token.status_code == 400


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
