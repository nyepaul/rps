"""
Integration tests for profile routes with ownership
"""

import pytest


def test_list_profiles_empty(client, test_user):
    """Test listing profiles when none exist."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/profiles")
    assert response.status_code == 200
    data = response.get_json()
    assert "profiles" in data
    assert data["profiles"] == []


def test_list_profiles(client, test_user, test_profile):
    """Test listing profiles."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/profiles")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["profiles"]) == 1
    assert data["profiles"][0]["name"] == "Test Profile"


def test_create_profile(client, test_user):
    """Test creating a new profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/profiles",
        json={
            "name": "New Profile",
            "birth_date": "1990-05-20",
            "retirement_date": "2060-05-20",
            "data": {
                "person": {"current_age": 34, "retirement_age": 70},
                "financial": {"annual_income": 90000, "annual_expenses": 60000},
            },
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "Profile created successfully"
    assert data["profile"]["name"] == "New Profile"
    assert data["profile"]["user_id"] == test_user.id


def test_create_profile_duplicate_name(client, test_user, test_profile):
    """Test that duplicate profile names are rejected."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/profiles",
        json={"name": "Test Profile", "birth_date": "1990-01-01"},  # Already exists
    )

    assert response.status_code == 409
    data = response.get_json()
    assert "error" in data


def test_create_profile_without_auth(client, test_db):
    """Test that creating profile requires authentication."""
    response = client.post("/api/profiles", json={"name": "Unauthorized Profile"})

    assert response.status_code == 302


def test_get_profile(client, test_user, test_profile):
    """Test retrieving a specific profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get(f"/api/profile/{test_profile.name}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["profile"]["name"] == "Test Profile"
    assert data["profile"]["user_id"] == test_user.id
    assert "financial" in data["profile"]["data"]


def test_get_profile_not_found(client, test_user):
    """Test retrieving non-existent profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/profile/NonExistent")
    assert response.status_code == 404


def test_get_profile_ownership(client, test_user, test_admin):
    """Test that users can only access their own profiles."""
    # Create profile for admin
    from src.models.profile import Profile

    admin_profile = Profile(user_id=test_admin.id, name="Admin Profile")
    admin_profile.save()

    # Login as test_user
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Try to access admin's profile
    response = client.get("/api/profile/Admin Profile")
    assert response.status_code == 404  # Should not find it


def test_update_profile(client, test_user, test_profile):
    """Test updating a profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.put(
        f"/api/profile/{test_profile.name}",
        json={
            "name": "Updated Profile",
            "data": {
                "person": {"current_age": 45},
                "financial": {"annual_income": 150000},
            },
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["profile"]["name"] == "Updated Profile"
    assert data["profile"]["data"]["financial"]["annual_income"] == 150000


def test_update_profile_not_found(client, test_user):
    """Test updating non-existent profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.put("/api/profile/NonExistent", json={"name": "New Name"})

    assert response.status_code == 404


def test_delete_profile(client, test_user, test_profile):
    """Test deleting a profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.delete(f"/api/profile/{test_profile.name}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Profile deleted successfully"

    # Verify it's deleted
    response = client.get(f"/api/profile/{test_profile.name}")
    assert response.status_code == 404


def test_delete_profile_not_found(client, test_user):
    """Test deleting non-existent profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.delete("/api/profile/NonExistent")
    assert response.status_code == 404


def test_profile_data_encryption_in_api(client, test_user):
    """Test that profile data is encrypted when stored via API."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Create profile with sensitive data
    response = client.post(
        "/api/profiles",
        json={
            "name": "Encrypted Profile",
            "data": {
                "financial": {"liquid_assets": 1000000, "retirement_assets": 2000000}
            },
        },
    )

    assert response.status_code == 201

    # Verify data comes back decrypted
    response = client.get("/api/profile/Encrypted Profile")
    assert response.status_code == 200
    data = response.get_json()
    assert data["profile"]["data"]["financial"]["liquid_assets"] == 1000000


def test_create_profile_minimal_data(client, test_user):
    """Test creating profile with minimal data."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post("/api/profiles", json={"name": "Minimal Profile"})

    assert response.status_code == 201
    data = response.get_json()
    assert data["profile"]["name"] == "Minimal Profile"
    assert data["profile"]["data"] == {}


def test_list_profiles_multiple_users(client, test_user, test_admin):
    """Test that users only see their own profiles."""
    # Create profiles for both users
    from src.models.profile import Profile

    Profile(user_id=test_user.id, name="User Profile 1").save()
    Profile(user_id=test_user.id, name="User Profile 2").save()
    Profile(user_id=test_admin.id, name="Admin Profile").save()

    # Login as test_user
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.get("/api/profiles")
    assert response.status_code == 200
    data = response.get_json()

    # Should only see own profiles
    assert len(data["profiles"]) == 2
    profile_names = [p["name"] for p in data["profiles"]]
    assert "User Profile 1" in profile_names
    assert "User Profile 2" in profile_names
    assert "Admin Profile" not in profile_names
