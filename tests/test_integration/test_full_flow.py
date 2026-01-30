"""
End-to-end integration test for complete user journey
"""

import pytest


def test_complete_user_journey(client, test_db):
    """
    Test complete user flow from registration to profile management.

    This test simulates a real user workflow:
    1. Register new user
    2. Login
    3. Create profile with financial data
    4. Update profile
    5. Create action items
    6. Mark action item as complete
    7. Delete action item
    8. Delete profile
    9. Logout
    """

    # Step 1: Register new user
    register_response = client.post(
        "/api/auth/register",
        json={
            "username": "journeyuser",
            "email": "journey@example.com",
            "password": "JourneyPass123",
        },
    )
    assert register_response.status_code == 201
    user_data = register_response.get_json()
    assert user_data["user"]["username"] == "journeyuser"

    # Verify email manually
    test_db.execute(
        "UPDATE users SET email_verified = 1 WHERE username = 'journeyuser'"
    )

    # Step 2: Login
    login_response = client.post(
        "/api/auth/login",
        json={"username": "journeyuser", "password": "JourneyPass123"},
    )
    assert login_response.status_code == 200

    # Step 3: Verify session
    session_response = client.get("/api/auth/session")
    assert session_response.status_code == 200
    assert session_response.get_json()["authenticated"] is True

    # Step 4: Create first profile with financial data
    profile1_response = client.post(
        "/api/profiles",
        json={
            "name": "Primary Retirement Plan",
            "birth_date": "1975-03-15",
            "retirement_date": "2045-03-15",
            "data": {
                "person": {
                    "current_age": 49,
                    "retirement_age": 70,
                    "life_expectancy": 95,
                },
                "financial": {
                    "annual_income": 150000,
                    "annual_expenses": 100000,
                    "liquid_assets": 300000,
                    "retirement_assets": 800000,
                    "social_security_benefit": 3000,
                },
            },
        },
    )
    assert profile1_response.status_code == 201
    profile1 = profile1_response.get_json()["profile"]
    assert profile1["name"] == "Primary Retirement Plan"
    assert profile1["data"]["financial"]["liquid_assets"] == 300000

    # Step 5: Create second profile (for comparison scenarios)
    profile2_response = client.post(
        "/api/profiles",
        json={
            "name": "Early Retirement Plan",
            "data": {
                "person": {
                    "current_age": 49,
                    "retirement_age": 60,
                    "life_expectancy": 95,
                }
            },
        },
    )
    assert profile2_response.status_code == 201

    # Step 6: List all profiles
    list_response = client.get("/api/profiles")
    assert list_response.status_code == 200
    profiles = list_response.get_json()["profiles"]
    assert len(profiles) == 2
    profile_names = [p["name"] for p in profiles]
    assert "Primary Retirement Plan" in profile_names
    assert "Early Retirement Plan" in profile_names

    # Step 7: Update profile data
    update_response = client.put(
        "/api/profile/Primary Retirement Plan",
        json={
            "name": "Primary Retirement Plan",
            "data": {
                "person": {
                    "current_age": 49,
                    "retirement_age": 70,
                    "life_expectancy": 95,
                },
                "financial": {
                    "annual_income": 160000,  # Updated income
                    "annual_expenses": 100000,
                    "liquid_assets": 350000,  # Updated assets
                    "retirement_assets": 850000,  # Updated assets
                    "social_security_benefit": 3000,
                },
            },
        },
    )
    assert update_response.status_code == 200
    updated_profile = update_response.get_json()["profile"]
    assert updated_profile["data"]["financial"]["annual_income"] == 160000
    assert updated_profile["data"]["financial"]["liquid_assets"] == 350000

    # Step 8: Create action items
    action1_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Primary Retirement Plan",
            "title": "Increase 401k contribution to max",
            "description": "Update payroll to contribute $23,000 annually",
            "priority": "high",
            "status": "pending",
            "due_date": "2026-02-01",
        },
    )
    assert action1_response.status_code == 201
    action1 = action1_response.get_json()["action_item"]

    action2_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Primary Retirement Plan",
            "title": "Review and rebalance portfolio",
            "description": "Adjust asset allocation to target 70/30 stocks/bonds",
            "priority": "medium",
            "status": "pending",
        },
    )
    assert action2_response.status_code == 201
    action2 = action2_response.get_json()["action_item"]

    action3_response = client.post(
        "/api/action-items",
        json={
            "profile_name": "Primary Retirement Plan",
            "title": "Schedule meeting with financial advisor",
            "priority": "low",
            "status": "pending",
        },
    )
    assert action3_response.status_code == 201

    # Step 9: List action items
    actions_response = client.get("/api/action-items")
    assert actions_response.status_code == 200
    actions = actions_response.get_json()["action_items"]
    assert len(actions) == 3

    # Step 10: Filter action items by profile
    filtered_response = client.get(
        "/api/action-items?profile_name=Primary Retirement Plan"
    )
    assert filtered_response.status_code == 200
    filtered_actions = filtered_response.get_json()["action_items"]
    assert len(filtered_actions) == 3

    # Step 11: Complete first action item
    complete_response = client.put(
        f'/api/action-item/{action1["id"]}', json={"status": "completed"}
    )
    assert complete_response.status_code == 200
    completed_action = complete_response.get_json()["action_item"]
    assert completed_action["status"] == "completed"

    # Step 12: Update second action item priority
    update_action_response = client.put(
        f'/api/action-item/{action2["id"]}', json={"priority": "high"}
    )
    assert update_action_response.status_code == 200
    updated_action = update_action_response.get_json()["action_item"]
    assert updated_action["priority"] == "high"

    # Step 13: Delete third action item
    delete_action_response = client.delete(
        f'/api/action-item/{action3_response.get_json()["action_item"]["id"]}'
    )
    assert delete_action_response.status_code == 200

    # Verify only 2 action items remain
    remaining_response = client.get("/api/action-items")
    assert len(remaining_response.get_json()["action_items"]) == 2

    # Step 14: Get specific profile
    get_profile_response = client.get("/api/profile/Primary Retirement Plan")
    assert get_profile_response.status_code == 200
    retrieved_profile = get_profile_response.get_json()["profile"]
    assert retrieved_profile["name"] == "Primary Retirement Plan"
    assert retrieved_profile["data"]["financial"]["annual_income"] == 160000

    # Step 15: Delete second profile
    delete_profile2_response = client.delete("/api/profile/Early Retirement Plan")
    assert delete_profile2_response.status_code == 200

    # Verify only 1 profile remains
    remaining_profiles_response = client.get("/api/profiles")
    assert len(remaining_profiles_response.get_json()["profiles"]) == 1

    # Step 16: Delete primary profile (should cascade delete action items)
    delete_profile1_response = client.delete("/api/profile/Primary Retirement Plan")
    assert delete_profile1_response.status_code == 200

    # Verify no profiles remain
    final_profiles_response = client.get("/api/profiles")
    assert len(final_profiles_response.get_json()["profiles"]) == 0

    # Verify action items were cascade deleted
    final_actions_response = client.get("/api/action-items")
    assert len(final_actions_response.get_json()["action_items"]) == 0

    # Step 17: Logout
    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    # Verify session is cleared
    session_check_response = client.get("/api/auth/session")
    assert session_check_response.status_code == 200
    assert session_check_response.get_json()["authenticated"] is False

    # Step 18: Verify cannot access protected routes after logout
    protected_response = client.get("/api/profiles")
    assert protected_response.status_code == 302


def test_multi_user_isolation(client, test_db):
    """
    Test that multiple users' data is properly isolated.
    """

    # Register and create data for user 1
    client.post(
        "/api/auth/register",
        json={
            "username": "user1",
            "email": "user1@example.com",
            "password": "Password123",
        },
    )
    
    test_db.execute("UPDATE users SET email_verified = 1 WHERE username = 'user1'")
    
    client.post(
        "/api/auth/login", json={"username": "user1", "password": "Password123"}
    )

    client.post(
        "/api/profiles",
        json={
            "name": "User1 Profile",
            "data": {"financial": {"liquid_assets": 100000}},
        },
    )

    client.post(
        "/api/action-items",
        json={
            "profile_name": "User1 Profile",
            "title": "User1 Action",
            "status": "pending",
        },
    )

    # Logout user1
    client.post("/api/auth/logout")

    # Register and create data for user 2
    client.post(
        "/api/auth/register",
        json={
            "username": "user2",
            "email": "user2@example.com",
            "password": "Password123",
        },
    )
    
    test_db.execute("UPDATE users SET email_verified = 1 WHERE username = 'user2'")
    
    login_resp = client.post(
        "/api/auth/login", json={"username": "user2", "password": "Password123"}
    )
    assert login_resp.status_code == 200

    create_resp = client.post(
        "/api/profiles",
        json={
            "name": "User2 Profile",
            "data": {"financial": {"liquid_assets": 200000}},
        },
    )
    assert create_resp.status_code == 201

    # User2 should only see their own data
    profiles_response = client.get("/api/profiles")
    assert profiles_response.status_code == 200
    profiles = profiles_response.get_json()["profiles"]
    assert len(profiles) == 1
    assert profiles[0]["name"] == "User2 Profile"

    # Get full profile to check data
    profile_detail = client.get(f'/api/profile/{profiles[0]["name"]}').get_json()[
        "profile"
    ]
    assert profile_detail["data"]["financial"]["liquid_assets"] == 200000

    # User2 should not see User1's action items
    actions_response = client.get("/api/action-items")
    actions = actions_response.get_json()["action_items"]
    assert len(actions) == 0

    # Logout user2
    client.post("/api/auth/logout")

    # Login back as user1
    client.post(
        "/api/auth/login", json={"username": "user1", "password": "Password123"}
    )

    # User1 should still see their own data
    profiles_response = client.get("/api/profiles")
    profiles = profiles_response.get_json()["profiles"]
    assert len(profiles) == 1
    assert profiles[0]["name"] == "User1 Profile"

    # Get full profile
    profile_detail = client.get(f'/api/profile/{profiles[0]["name"]}').get_json()[
        "profile"
    ]
    assert profile_detail["data"]["financial"]["liquid_assets"] == 100000

    actions_response = client.get("/api/action-items")
    actions = actions_response.get_json()["action_items"]
    assert len(actions) == 1
    assert actions[0]["description"] == "User1 Action"
