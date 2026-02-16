import pytest
from src.models.profile import Profile
from src.auth.models import User


class TestSecurityComprehensive:

    def test_password_reset_request_does_not_leak_account_metadata(self, client):
        """Password reset request should not expose account/admin/email-match metadata."""
        user = User(
            id=None,
            username="recover_me",
            email="recover@example.com",
            password_hash=User.hash_password("StrongPass123A"),
            email_verified=True,
        )
        user.save()

        matched = client.post(
            "/api/auth/password-reset/request",
            json={"username": "recover_me", "email": "recover@example.com"},
        )
        assert matched.status_code == 200
        matched_json = matched.get_json()
        assert "message" in matched_json
        assert "username" not in matched_json
        assert "is_admin" not in matched_json
        assert "email_sent" not in matched_json

        missing = client.post(
            "/api/auth/password-reset/request",
            json={"username": "no_user", "email": "no_user@example.com"},
        )
        assert missing.status_code == 200
        missing_json = missing.get_json()
        assert "message" in missing_json
        assert "username" not in missing_json
        assert "is_admin" not in missing_json
        assert "email_sent" not in missing_json

    def test_unauthorized_access(self, client):
        """Test that critical endpoints reject unauthenticated requests."""
        endpoints = [
            ("GET", "/api/profiles"),
            ("POST", "/api/profiles"),
            ("GET", "/api/profile/SomeName"),
            ("POST", "/api/advisor/chat"),
            ("POST", "/api/extract-items/assets"),
            ("GET", "/api/admin/users"),
        ]

        for method, url in endpoints:
            if method == "GET":
                response = client.get(url)
            else:
                response = client.post(url)

            # Should be 401 Unauthorized or 302 Redirect to login
            assert response.status_code in [
                401,
                302,
            ], f"Endpoint {url} accessible without auth"

    def test_profile_ownership_isolation(self, client, test_db):
        """Test that users cannot access each other's profiles."""
        # Create User A and Profile A
        user_a = User(
            id=None,
            username="user_a",
            email="a@test.com",
            password_hash=User.hash_password("pass"),
            email_verified=True,
        )
        user_a.save()
        profile_a = Profile(user_id=user_a.id, name="ProfileA", data={})
        profile_a.save()

        # Create User B
        user_b = User(
            id=None,
            username="user_b",
            email="b@test.com",
            password_hash=User.hash_password("pass"),
            email_verified=True,
        )
        user_b.save()

        # Login as User B
        client.post("/api/auth/login", json={"username": "user_b", "password": "pass"})

        # Try to access Profile A (should mask existence with 404 or deny with 403)
        response = client.get("/api/profile/ProfileA")
        assert response.status_code in [403, 404]

        # Try to update Profile A
        response = client.put("/api/profile/ProfileA", json={"name": "HackedA"})
        assert response.status_code in [403, 404]

    def test_api_key_masking(self, client, test_user, test_profile):
        """Test that API keys are stripped from profile responses."""
        # Set a real API key in the database
        test_profile.data = {
            'api_keys': {
                'gemini_api_key': 'GEMINI_TEST_KEY_PLACEHOLDER_12345',
                'claude_api_key': 'CLAUDE_TEST_KEY_PLACEHOLDER_54321'
            }
        }
        test_profile.save()
        
        # Login
        client.post('/api/auth/login', json={'username': 'testuser', 'password': 'TestPass123'})
        
        # Get Profile
        response = client.get(f'/api/profile/{test_profile.name}')
        assert response.status_code == 200
        data = response.get_json()['profile']['data']
        
        # Verify keys are NOT returned (Security Best Practice)
        api_keys = data.get('api_keys')
        assert api_keys is None, "API keys should be stripped from profile response"

    def test_profile_name_validation(self, client, test_user):
        """Test input validation for profile names."""
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        # Test Path Traversal
        response = client.post(
            "/api/profiles", json={"name": "../etc/passwd", "birth_date": "1980-01-01"}
        )
        assert response.status_code == 400

        # Test Invalid Characters
        response = client.post(
            "/api/profiles",
            json={
                "name": "Profile<script>alert(1)</script>",
                "birth_date": "1980-01-01",
            },
        )
        assert response.status_code == 400

        # Test SQL Injection chars (basic check)
        response = client.post(
            "/api/profiles",
            json={"name": "Profile'; DROP TABLE users; --", "birth_date": "1980-01-01"},
        )
        assert response.status_code == 400

    def test_admin_privilege_escalation(self, client, test_user):
        """Test that regular users cannot access admin routes."""
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        # Access an admin-only endpoint
        response = client.get("/api/admin/users")
        assert response.status_code in [
            403,
            401,
        ], "Regular user accessed admin endpoint"
