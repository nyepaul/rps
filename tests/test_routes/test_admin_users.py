"""
Tests for Admin User management routes.
"""

import pytest
from src.auth.models import User
from src.models.group import Group


def test_list_users_permissions(client, test_user, test_admin, test_super_admin):
    """Test user listing permissions."""
    # Regular user cannot list users
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    response = client.get("/api/admin/users")
    assert response.status_code == 403

    # Super Admin sees everyone
    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )
    response = client.get("/api/admin/users")
    assert response.status_code == 200
    assert len(response.get_json()["users"]) >= 3


def test_update_user_permissions(client, test_user, test_admin, test_super_admin):
    """Test user update permissions and restrictions."""
    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )

    # Super admin can promote to admin
    response = client.put(f"/api/admin/users/{test_user.id}", json={"is_admin": True})
    assert response.status_code == 200
    assert User.get_by_id(test_user.id).is_admin is True

    # Super admin can toggle active
    response = client.put(f"/api/admin/users/{test_user.id}", json={"is_active": False})
    assert response.status_code == 200
    assert User.get_by_id(test_user.id).is_active is False


def test_super_admin_protection(client, test_admin, test_super_admin):
    """Super admins cannot be managed by regular admins."""
    # Login regular admin
    client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )

    # Try to deactivate super admin (assuming admin manages a group SA is in? No, admin shouldn't manage SA)
    # Actually, can_manage_user returns False for SA unless requester is also SA
    response = client.put(
        f"/api/admin/users/{test_super_admin.id}", json={"is_active": False}
    )
    assert response.status_code == 403


def test_force_password_reset_data_loss(client, test_super_admin, test_user):
    """Test admin password reset warning/logic."""
    # Setup user with encrypted data
    user = User.get_by_id(test_user.id)
    user.encrypted_dek = "secret"
    user.dek_iv = "iv"
    user.save()

    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )

    # Reset password
    response = client.put(
        f"/api/admin/users/{test_user.id}/password",
        json={"new_password": "NewAdminResetPass123"},
    )
    assert response.status_code == 200
    assert response.get_json()["dek_lost"] is True

    # Verify DEK is gone in DB immediately
    updated_user = User.get_by_id(test_user.id)
    assert updated_user.encrypted_dek is None
    assert updated_user.dek_iv is None

    # Verify user can login with new pass (this will trigger auto-migration/new DEK)
    client.post("/api/auth/logout")
    login_res = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "NewAdminResetPass123"},
    )
    assert login_res.status_code == 200
