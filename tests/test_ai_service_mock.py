import pytest
from unittest.mock import MagicMock, patch
import json
from src.models.profile import Profile
from src.models.conversation import Conversation
from src.auth.models import User


@pytest.fixture
def auth_headers(client, test_user):
    """Get authentication headers for test user."""
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    # Extract session cookie handled by client automatically
    return {}


class TestAIServices:

    @patch("src.routes.ai_services.requests.post")
    def test_call_gemini_fallback_success(
        self, mock_post, client, test_user, test_profile, encryption_service
    ):
        """Test call_gemini_with_fallback succeeds with first model."""

        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "[]"}]}}]
        }
        mock_post.return_value = mock_response

        # Use the extract-items endpoint which calls call_gemini_with_fallback
        # Setup profile with API key
        test_profile.data = {
            "api_keys": {"gemini_api_key": "test_key"},
            "assets": {"taxable_accounts": []},
        }
        test_profile.save()

        # Login
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        response = client.post(
            "/api/extract-items/assets",
            json={
                "image": "SGVsbG8=",
                "llm_provider": "gemini",
                "profile_name": test_profile.name,
            },
        )

        assert response.status_code == 200
        assert mock_post.called
        # Verify it called the first model in the list
        args, kwargs = mock_post.call_args
        assert "gemini-2.5-flash" in args[0]

    @patch("src.routes.ai_services.requests.post")
    def test_call_gemini_specific_model(
        self, mock_post, client, test_user, test_profile, encryption_service
    ):
        """Test extract-items with a specific requested model."""

        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "[]"}]}}]
        }
        mock_post.return_value = mock_response

        # Setup profile
        test_profile.data = {
            "api_keys": {"gemini_api_key": "test_key"},
            "assets": {"taxable_accounts": []},
        }
        test_profile.save()

        # Login
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        # Request a specific model
        response = client.post(
            "/api/extract-items/assets",
            json={
                "image": "SGVsbG8=",
                "llm_provider": "gemini",
                "llm_model": "gemini-1.5-pro",
                "profile_name": test_profile.name,
            },
        )

        assert response.status_code == 200
        assert mock_post.called
        # Verify it called the requested model
        args, kwargs = mock_post.call_args
        assert "gemini-1.5-pro" in args[0]

    @patch("src.routes.ai_services.requests.post")
    def test_call_gemini_fallback_failover(
        self, mock_post, client, test_user, test_profile, encryption_service
    ):
        """Test call_gemini_with_fallback fails over to next model."""

        # Mock responses: First fail, Second success
        fail_response = MagicMock()
        fail_response.status_code = 500
        fail_response.text = "Internal Server Error"

        success_response = MagicMock()
        success_response.status_code = 200
        success_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "[]"}]}}]
        }

        mock_post.side_effect = [fail_response, success_response]

        # Setup profile
        test_profile.data = {
            "api_keys": {"gemini_api_key": "test_key"},
            "assets": {"taxable_accounts": []},
        }
        test_profile.save()

        # Login
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        response = client.post(
            "/api/extract-items/assets",
            json={
                "image": "SGVsbG8=",
                "llm_provider": "gemini",
                "profile_name": test_profile.name,
            },
        )

        assert response.status_code == 200
        assert mock_post.call_count == 2

        # Check call args
        calls = mock_post.call_args_list
        assert "gemini-2.5-flash" in calls[0][0][0]
        assert "gemini-2.0-flash" in calls[1][0][0]

    @patch("src.routes.ai_services.genai")
    def test_advisor_chat_success(
        self, mock_genai, client, test_user, test_profile, encryption_service
    ):
        """Test advisor_chat endpoint with mocked Google GenAI client."""

        # Mock Client and response
        mock_client_instance = MagicMock()
        mock_genai.Client.return_value = mock_client_instance

        mock_response = MagicMock()
        mock_response.text = "Here is some financial advice."
        mock_client_instance.models.generate_content.return_value = mock_response

        # Setup profile with API key
        test_profile.data = {
            "api_keys": {"gemini_api_key": "test_key"},
            "financial": {"annual_income": 100000},
        }
        test_profile.save()

        # Login
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        response = client.post(
            "/api/advisor/chat",
            json={"profile_name": test_profile.name, "message": "Should I retire?"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["response"] == "Here is some financial advice."

        # Verify conversation was saved
        msgs = Conversation.list_by_profile(test_user.id, test_profile.id)
        assert len(msgs) == 2  # User + Assistant
        # Content is encrypted in the object, assume to_dict decrypts it
        assert msgs[1].to_dict()["content"] == "Here is some financial advice."

    def test_advisor_chat_no_api_key(self, client, test_user, test_profile):
        """Test advisor_chat fails gracefully without API key."""

        # Setup profile WITHOUT API key
        test_profile.data = {"financial": {"annual_income": 100000}}
        test_profile.save()

        # Login
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        response = client.post(
            "/api/advisor/chat",
            json={"profile_name": test_profile.name, "message": "Should I retire?"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "configure in AI Settings" in data["error"]

    def test_extract_assets_input_validation(self, client, test_user):
        """Test validation for extract-items."""
        client.post(
            "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
        )

        # No image
        response = client.post(
            "/api/extract-items/assets", json={"profile_name": "Test Profile"}
        )
        assert response.status_code == 400
        assert "required" in response.get_json()["error"]

        # No profile name
        response = client.post("/api/extract-items/assets", json={"image": "data"})
        assert response.status_code == 400
        assert "required" in response.get_json()["error"]
