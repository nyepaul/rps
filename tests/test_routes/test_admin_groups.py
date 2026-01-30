"""
Tests for Admin Group management routes.
"""

import pytest
from src.models.group import Group
from src.auth.models import User


def test_list_groups_super_admin(client, test_super_admin):
    """Super Admin should see all groups."""
    Group(None, "Super Group 1").save()

    # Login super admin
    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )

    response = client.get("/api/admin/groups")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["groups"]) >= 1


def test_list_groups_local_admin(client, test_admin):
    """Local Admin should only see their managed groups."""
    g1 = Group(None, "Local Managed").save()
    g2 = Group(None, "Hidden Group").save()

    test_admin.add_managed_group(g1.id)

    # Login local admin
    client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )

    response = client.get("/api/admin/groups")
    assert response.status_code == 200
    data = response.get_json()
    assert any(g["name"] == "Local Managed" for g in data["groups"])
    assert not any(g["name"] == "Hidden Group" for g in data["groups"])


def test_create_group_permissions(client, test_admin, test_super_admin):
    """Only Super Admin can create groups."""
    # Try with local admin
    client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )
    response = client.post("/api/admin/groups", json={"name": "New Group"})
    assert response.status_code == 403

    # Try with super admin
    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )
    response = client.post("/api/admin/groups", json={"name": "Super New Group"})
    assert response.status_code == 201


def test_manage_user_group_assignment(client, test_super_admin, test_user):
    """Test assigning users to groups via API."""
    g1 = Group(None, "Assignment Test").save()

    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )

    # Add user to group (as super admin)
    response = client.post(f"/api/admin/users/{test_user.id}/groups/{g1.id}")
    assert response.status_code == 200

    # Verify in list
    response = client.get("/api/admin/users")
    users = response.get_json()["users"]
    test_user_entry = next(u for u in users if u["id"] == test_user.id)
    assert "Assignment Test" in test_user_entry["group_names"]


def test_local_admin_user_isolation(client, test_admin, test_user, test_super_admin):
    """Local admin should only see users in their managed groups."""
    g1 = Group(None, "Admin Group").save()
    test_admin.add_managed_group(g1.id)

    # User not in group yet
    client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )
    response = client.get("/api/admin/users")
    assert not any(u["id"] == test_user.id for u in response.get_json()["users"])

    # Add user to group (as super admin)
    client.post(
        "/api/auth/login", json={"username": "superadmin", "password": "SuperPass123"}
    )
    client.post(f"/api/admin/users/{test_user.id}/groups/{g1.id}")

    # Check again as local admin
    client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )
    response = client.get("/api/admin/users")
    assert any(u["id"] == test_user.id for u in response.get_json()["users"])
