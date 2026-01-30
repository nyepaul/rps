import pytest
import base64
import json
from unittest.mock import patch, MagicMock
from src.app import create_app
from flask_login import login_user, current_user
from src.auth.models import User
from src.models.profile import Profile


@pytest.fixture
def app():
    app = create_app("testing")
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_client(client, app):
    with app.test_request_context():
        # Create a test user
        user = User(
            id=1, username="testuser", email="test@example.com", password_hash="hash"
        )
        # Create a test profile
        profile = Profile(id=1, user_id=1, name="testprofile")
        profile.data_dict = {
            "api_keys": {
                "gemini_api_key": "test-gemini-key",
                "claude_api_key": "test-claude-key",
                "openai_api_key": "test-openai-key",
                "ollama_url": "http://localhost:11434",
                "ollama_model": "llama3.2-vision",
            }
        }

        with patch("src.auth.models.User.get_by_id", return_value=user):
            with patch("src.models.profile.Profile.get_by_name", return_value=profile):
                with client.session_transaction() as sess:
                    sess["_user_id"] = 1
                    sess["_fresh"] = True
                yield client


def parse_stream(response):
    """Helper to parse NDJSON stream from response."""
    results = []
    full_data = {}
    for line in response.data.decode("utf-8").split("\n"):
        if line.strip():
            data = json.loads(line)
            results.append(data)
            full_data.update(data)
    return full_data


    def test_extract_assets_ollama(auth_client, test_profile):
        """Test asset extraction with Ollama vision."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "message": {
                "content": '[{"name": "401k", "type": "401k", "value": 100000, "institution": "Vanguard"}]'
            }
        }
    
        with patch("requests.post", return_value=mock_response):
            response = auth_client.post(
                "/api/extract-items/assets",
                json={
                    "image": base64.b64encode(b"fake-image-data").decode("utf-8"),
                    "mime_type": "image/png",
                    "llm_provider": "ollama",
                    "profile_name": test_profile.name,
                },
            )
        assert response.status_code == 200
        data = parse_stream(response)
        assert "assets" in data
        assert data["assets"][0]["name"] == "401k"


    def test_extract_assets_gemini(auth_client, test_profile):
        """Test asset extraction with Gemini."""
        with patch(
            "src.routes.ai_services.call_gemini_with_fallback",
            return_value='[{"name": "Roth IRA", "type": "roth_ira", "value": 50000, "institution": "Fidelity"}]',
        ):
            response = auth_client.post(
                "/api/extract-items/assets",
                json={
                    "image": base64.b64encode(b"fake-image-data").decode("utf-8"),
                    "mime_type": "image/png",
                    "llm_provider": "gemini",
                    "profile_name": test_profile.name,
                },
            )
        assert response.status_code == 200
        data = parse_stream(response)
        assert "assets" in data
        assert data["assets"][0]["name"] == "Roth IRA"


    def test_extract_assets_claude(auth_client, test_profile):
        """Test asset extraction with Claude vision."""
        with patch(
            "src.routes.ai_services.call_claude_with_vision",
            return_value='[{"name": "Savings", "type": "savings", "value": 10000, "institution": "Ally"}]',
        ):
            response = auth_client.post(
                "/api/extract-items/assets",
                json={
                    "image": base64.b64encode(b"fake-image-data").decode("utf-8"),
                    "mime_type": "image/png",
                    "llm_provider": "claude",
                    "profile_name": test_profile.name,
                },
            )
        assert response.status_code == 200
        data = parse_stream(response)
        assert data["assets"][0]["name"] == "Savings"


    def test_extract_assets_openai(auth_client, test_profile):
        """Test asset extraction with OpenAI vision."""
        with patch(
            "src.routes.ai_services.call_openai_with_vision",
            return_value='[{"name": "Brokerage", "type": "brokerage", "value": 25000, "institution": "Schwab"}]',
        ):
            response = auth_client.post(
                "/api/extract-items/assets",
                json={
                    "image": base64.b64encode(b"fake-image-data").decode("utf-8"),
                    "mime_type": "image/png",
                    "llm_provider": "openai",
                    "profile_name": test_profile.name,
                },
            )
        assert response.status_code == 200
        data = parse_stream(response)
        assert data["assets"][0]["name"] == "Brokerage"
