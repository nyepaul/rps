import pytest
from src.models.profile import Profile


def test_refresh_data_api(client, auth_headers, test_profile):
    """Test the API endpoint used by the new Refresh button."""
    from src.database.connection import db

    # 1. Update data directly in DB to simulate backend change
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE profile SET birth_date = '1990-01-01' WHERE id = ?",
            (test_profile.id,),
        )
        conn.commit()

    # 2. Call GET profile API (which the Refresh button uses)
    response = client.get(f"/api/profile/{test_profile.name}", headers=auth_headers)
    assert response.status_code == 200

    # 3. Verify refreshed data
    data = response.get_json()
    assert data["profile"]["birth_date"] == "1990-01-01"


def test_profile_switching_isolation(client, auth_headers, test_user):
    """Test that switching profiles returns correct data for each."""
    # 1. Create two profiles
    p1 = Profile(user_id=test_user.id, name="P1", birth_date="1980-01-01").save()
    p2 = Profile(user_id=test_user.id, name="P2", birth_date="1990-01-01").save()

    # 2. Fetch P1
    resp1 = client.get(f"/api/profile/P1", headers=auth_headers)
    assert resp1.status_code == 200
    assert resp1.get_json()["profile"]["birth_date"] == "1980-01-01"

    # 3. Fetch P2
    resp2 = client.get(f"/api/profile/P2", headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.get_json()["profile"]["birth_date"] == "1990-01-01"


def test_admin_system_info_security(client, auth_headers, test_admin):
    """Test that system info is only accessible to admins."""
    # 1. Try with regular user (test_user from auth_headers)
    resp = client.get("/api/admin/system/info", headers=auth_headers)
    assert resp.status_code == 403  # Forbidden for non-admins

    # 2. Login as admin
    login_resp = client.post(
        "/api/auth/login", json={"username": "admin", "password": "AdminPass123"}
    )
    admin_headers = {"Cookie": login_resp.headers.get("Set-Cookie")}

    # 3. Try with admin
    resp = client.get("/api/admin/system/info", headers=admin_headers)
    assert resp.status_code == 200
    # Check for stats in the response
    data = resp.get_json()
    # The actual response seems to wrap everything in 'system_info'
    assert "total_users" in data["system_info"]
