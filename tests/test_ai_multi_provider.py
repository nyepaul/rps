import pytest
import json
from unittest.mock import patch, MagicMock
from src.app import create_app
from src.models.profile import Profile
from src.models.conversation import Conversation
from flask_login import login_user


@pytest.fixture
def app():
    app = create_app()
    app.config.update(
        {"TESTING": True, "LOGIN_DISABLED": True, "WTF_CSRF_ENABLED": False}
    )
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def mock_profile_data(monkeypatch):
    profile = MagicMock()
    profile.id = 1
    profile.name = "test_profile"
    profile.birth_date = "1980-01-01"
    profile.retirement_date = "2045-01-01"
    profile.data_dict = {
        "api_keys": {
            "openai_api_key": "sk-test-key",
            "gemini_api_key": "gemini-test-key",
        },
        "preferred_ai_provider": "openai",
        "financial": {"annual_income": 100000},
        "assets": {
            "retirement_accounts": [],
            "taxable_accounts": [],
            "real_estate": [],
        },
    }

    def mock_get_by_name(name, user_id):
        return profile

    monkeypatch.setattr(Profile, "get_by_name", mock_get_by_name)
    return profile


@pytest.fixture
def mock_auth(monkeypatch):
    user = MagicMock()
    user.id = 1
    user.is_authenticated = True

    # Mock current_user in the specific module where it's used
    monkeypatch.setattr("src.routes.ai_services.current_user", user)
    return user


@patch("requests.post")
def test_advisor_chat_multi_provider(mock_post, client, mock_profile_data, mock_auth):
    # Mock OpenAI response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Test advisor response"}}]
    }
    mock_post.return_value = mock_response

    # Mock Conversation methods
    with patch(
        "src.models.conversation.Conversation.list_by_profile", return_value=[]
    ), patch("src.models.conversation.Conversation.save", return_value=None):

        response = client.post(
            "/api/advisor/chat",
            json={
                "profile_name": "test_profile",
                "message": "Hello AI",
                "provider": "openai",
            },
        )

        if response.status_code != 200:
            print(f"Error Response: {response.get_data(as_text=True)}")

        assert response.status_code == 200
        data = response.get_json()
        assert data["response"] == "Test advisor response"
        assert data["provider"] == "openai"


@patch("requests.get")
def test_test_api_key_endpoint(mock_get, client):
    # Mock OpenRouter models list response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_get.return_value = mock_response

    response = client.post(
        "/api/test-api-key",
        json={"provider": "openrouter", "api_key": "REDACTED_OR_test-key"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "OpenRouter API key is valid" in data["message"]
