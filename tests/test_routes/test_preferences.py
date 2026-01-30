"""
Tests for user preferences persistence.
"""

import pytest
import json
from src.auth.models import User


def test_user_preferences_persistence(test_db, test_user):
    """Test that user preferences are saved and loaded correctly."""
    # Set initial preferences
    prefs = {"theme": "high-contrast", "display_density": "compact"}
    test_user.preferences = json.dumps(prefs)
    test_user.save()

    # Load user from DB
    loaded_user = User.get_by_id(test_user.id)
    assert loaded_user.preferences is not None
    loaded_prefs = json.loads(loaded_user.preferences)
    assert loaded_prefs["theme"] == "high-contrast"
    assert loaded_prefs["display_density"] == "compact"


def test_preferences_api(client, test_user):
    """Test the preferences API endpoints."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    # Get initial preferences (empty)
    response = client.get("/api/auth/preferences")
    assert response.status_code == 200
    assert response.get_json()["preferences"] == {}

    # Update preferences
    new_prefs = {"theme": "dark", "sidebar_collapsed": True}
    response = client.put("/api/auth/preferences", json=new_prefs)
    assert response.status_code == 200
    assert response.get_json()["preferences"]["theme"] == "dark"
    assert response.get_json()["preferences"]["sidebar_collapsed"] is True

    # Verify persistence
    response = client.get("/api/auth/preferences")
    assert response.status_code == 200
    data = response.get_json()
    assert data["preferences"]["theme"] == "dark"
    assert data["preferences"]["sidebar_collapsed"] is True

    # Partial update (merge)
    response = client.put("/api/auth/preferences", json={"theme": "high-contrast"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["preferences"]["theme"] == "high-contrast"
    assert data["preferences"]["sidebar_collapsed"] is True  # Still there
