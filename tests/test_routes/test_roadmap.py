"""Roadmap route tests."""


def _login(client, username, password):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200


def test_create_roadmap_item_rejects_invalid_phase(client, test_super_admin):
    _login(client, "superadmin", "SuperPass123")

    response = client.post(
        "/api/roadmap",
        json={
            "title": "Invalid phase item",
            "category": "Technical Improvements",
            "phase": "completed",
        },
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert "Invalid phase" in payload["error"]


def test_update_roadmap_item_rejects_invalid_phase(client, test_super_admin):
    _login(client, "superadmin", "SuperPass123")

    create = client.post(
        "/api/roadmap",
        json={
            "title": "Valid phase item",
            "category": "Technical Improvements",
            "phase": "phase2",
        },
    )
    assert create.status_code == 201
    item_id = create.get_json()["id"]

    response = client.put(
        f"/api/roadmap/{item_id}",
        json={"phase": "completed"},
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert "Invalid phase" in payload["error"]
