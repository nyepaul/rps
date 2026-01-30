import pytest
import json
from src.auth.models import User, PasswordResetRequest
from src.database.connection import db


def test_user_deletion_with_password_reset_requests(client, test_admin, test_user):
    """Test that deleting a user correctly handles password_reset_requests FK."""
    # 1. Create a password reset request for the test user
    PasswordResetRequest.create(test_user.id, "127.0.0.1")

    # 2. Login as admin
    login_response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )
    assert login_response.status_code == 200

    # 3. Attempt to delete the user
    delete_response = client.delete(f"/api/admin/users/{test_user.id}")

    # This should now succeed with 200 OK because we added manual cleanup or ON DELETE CASCADE
    assert delete_response.status_code == 200

    # 4. Verify user is gone
    assert User.get_by_id(test_user.id) is None

    # 5. Verify request is gone (or processed_by is NULL)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM password_reset_requests WHERE user_id = ?",
            (test_user.id,),
        )
        count = cursor.fetchone()[0]
        assert count == 0


def test_recovery_code_requires_email(client, test_user):
    """Test that recovery code reset requires correct email."""
    # 1. Setup recovery code for user
    # We need to simulate being logged in to generate one, or just set it in DB
    from src.services.encryption_service import EncryptionService
    import base64
    import os

    recovery_code = "A1B2C3D4E5F6G7H8"
    salt = os.urandom(16)
    user = User.get_by_id(test_user.id)
    user.recovery_salt = base64.b64encode(salt).decode("utf-8")
    # Dummy encrypted DEK
    user.recovery_encrypted_dek = "dummy"
    user.recovery_iv = "dummy"
    user.save()

    # 2. Attempt reset with WRONG email
    response = client.post(
        "/api/auth/password-reset/recovery",
        json={
            "username": test_user.username,
            "email": "wrong@email.com",
            "recovery_code": recovery_code,
            "new_password": "NewPassword123!",
        },
    )
    assert response.status_code == 400
    assert "Invalid credentials" in response.get_json()["error"]

    # 3. Attempt reset with CORRECT email (but dummy data will fail at decryption)
    # This at least verifies the email check passes and it reaches the next stage
    response = client.post(
        "/api/auth/password-reset/recovery",
        json={
            "username": test_user.username,
            "email": test_user.email,
            "recovery_code": recovery_code,
            "new_password": "NewPassword123!",
        },
    )
    # Should still be 400 or 500 because dummy data is invalid,
    # but error message should change if email check passed
    assert response.status_code in [400, 500]
    data = response.get_json()
    assert "Invalid credentials" not in data.get("error", "")


def test_manual_token_reset_flow(client, test_user, app):
    """Test the full flow of manual token generation and reset."""
    # 1. Generate token (simulating admin tool)
    with app.app_context():
        token = test_user.generate_reset_token(expiry_hours=1)

    # 2. Validate token
    val_response = client.post(
        "/api/auth/password-reset/validate-token", json={"token": token}
    )
    assert val_response.status_code == 200
    assert val_response.get_json()["valid"] is True
    assert val_response.get_json()["username"] == test_user.username

    # 3. Reset password using token
    reset_response = client.post(
        "/api/auth/password-reset/reset",
        json={"token": token, "password": "NewSecurePass123!"},
    )
    assert reset_response.status_code == 200

    # 4. Verify login with new password
    login_response = client.post(
        "/api/auth/login",
        json={"username": test_user.username, "password": "NewSecurePass123!"},
    )
    assert login_response.status_code == 200
