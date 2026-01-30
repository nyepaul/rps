"""
Integration tests for action items routes
"""

import pytest


def test_list_action_items_empty(client, test_user):
    """Test listing action items when none exist."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/action-items")
    assert response.status_code == 200
    data = response.get_json()
    assert "action_items" in data
    assert data["action_items"] == []


def test_create_action_item(client, test_user, test_profile):
    """Test creating an action item."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Review 401k allocation",
            "priority": "high",
            "status": "pending",
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Action item created successfully"
    assert data["action_item"]["description"] == "Review 401k allocation"
    assert data["action_item"]["priority"] == "high"
    assert data["action_item"]["user_id"] == test_user.id


def test_list_action_items(client, test_user, test_profile):
    """Test listing action items."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create multiple action items
    for i in range(3):
        client.post(
            "/api/action-items",
            json={
                "profile_name": "Test Profile",
                "description": f"Action {i}",
                "priority": "medium",
                "status": "pending",
            },
        )

    response = client.get("/api/action-items")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["action_items"]) == 3


def test_list_action_items_by_profile(client, test_user, test_profile):
    """Test listing action items filtered by profile."""
    from src.models.profile import Profile

    # Create another profile
    profile2 = Profile(user_id=test_user.id, name="Profile 2")
    profile2.save()

    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create action items for both profiles
    client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Action for Profile 1",
            "status": "pending",
        },
    )

    client.post(
        "/api/action-items",
        json={
            "profile_name": "Profile 2",
            "description": "Action for Profile 2",
            "status": "pending",
        },
    )

    # List all
    response = client.get("/api/action-items")
    assert len(response.get_json()["action_items"]) == 2

    # List filtered by profile
    response = client.get("/api/action-items?profile_name=Test Profile")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["action_items"]) == 1
    assert data["action_items"][0]["description"] == "Action for Profile 1"


def test_get_action_item(client, test_user, test_profile):
    """Test retrieving a specific action item."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create action item
    create_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Test Action",
            "status": "pending",
        },
    )

    item_id = create_response.get_json()["action_item"]["id"]

    # Get action item
    response = client.get(f"/api/action-item/{item_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["action_item"]["description"] == "Test Action"


def test_get_action_item_not_found(client, test_user):
    """Test retrieving non-existent action item."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/action-item/99999")
    assert response.status_code == 404


def test_update_action_item(client, test_user, test_profile):
    """Test updating an action item."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create action item
    create_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Original Title",
            "status": "pending",
            "priority": "low",
        },
    )

    item_id = create_response.get_json()["action_item"]["id"]

    # Update action item
    response = client.put(
        f"/api/action-item/{item_id}",
        json={
            "description": "Updated Title",
            "status": "completed",
            "priority": "high",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["action_item"]["description"] == "Updated Title"
    assert data["action_item"]["status"] == "completed"
    assert data["action_item"]["priority"] == "high"


def test_delete_action_item(client, test_user, test_profile):
    """Test deleting an action item."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create action item
    create_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "To Delete",
            "status": "pending",
        },
    )

    item_id = create_response.get_json()["action_item"]["id"]

    # Delete action item
    response = client.delete(f"/api/action-item/{item_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Action item deleted successfully"

    # Verify it's deleted
    response = client.get(f"/api/action-item/{item_id}")
    assert response.status_code == 404


def test_action_item_ownership(client, test_user, test_admin):
    """Test that users can only access their own action items."""
    from src.models.profile import Profile
    from src.models.action_item import ActionItem

    # Create profiles for both users
    admin_profile = Profile(user_id=test_admin.id, name="Admin Profile").save()

    # Create action item for admin
    admin_action = ActionItem(
        user_id=test_admin.id,
        profile_id=admin_profile.id,
        description="Admin Action",
        status="pending",
    )
    admin_action.save()

    # Login as test_user
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Try to access admin's action item
    response = client.get(f"/api/action-item/{admin_action.id}")
    assert response.status_code == 404


def test_action_item_profile_linking(client, test_user, test_profile):
    """Test that action items are properly linked to profiles."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Linked Action",
            "status": "pending",
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["action_item"]["profile_id"] == test_profile.id


def test_create_action_item_without_profile(client, test_user):
    """Test creating action item without profile (optional)."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/action-items", json={"description": "General Action", "status": "pending"}
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["action_item"]["profile_id"] is None


def test_action_item_cascade_delete(client, test_user, test_profile):
    """Test that deleting profile cascades to action items."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create action item
    create_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Test Profile",
            "description": "Will be deleted",
            "status": "pending",
        },
    )

    item_id = create_response.get_json()["action_item"]["id"]

    # Delete profile
    client.delete(f"/api/profile/{test_profile.name}")

    # Action item should also be deleted
    response = client.get(f"/api/action-item/{item_id}")
    assert response.status_code == 404
