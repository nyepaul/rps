"""AI provider API key testing helpers."""

from flask import jsonify
import requests
import json

def test_claude_api_key(api_key: str):
    """Test Claude API key with a simple request."""
    try:
        # Try latest Claude models
        models_to_try = [
            "claude-opus-4-5-20251101",  # Claude Opus 4.5 (Nov 2025)
            "claude-sonnet-4-5-20250929",  # Claude Sonnet 4.5 (Sep 2025)
            "claude-4-sonnet-20250514",  # Claude 4.0 Sonnet (May 2025)
            "claude-3-5-sonnet-20241022",  # Legacy fallback
        ]

        last_error = None
        for model in models_to_try:
            try:
                response = requests.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "Hi"}],
                    },
                    timeout=10,
                )

                if response.status_code == 200:
                    return (
                        jsonify(
                            {
                                "success": True,
                                "message": f"Claude API key is valid (tested with {model})",
                                "model": model,
                            }
                        ),
                        200,
                    )
                else:
                    last_error = (
                        response.json().get("error", {}).get("message", "Unknown error")
                    )
                    # Try next model
                    continue
            except Exception as e:
                last_error = str(e)
                continue

        # All models failed
        return (
            jsonify(
                {
                    "success": False,
                    "error": f'API Error: {last_error or "All models failed"}',
                }
            ),
            400,
        )

    except requests.Timeout:
        return jsonify({"success": False, "error": "Request timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_gemini_api_key(api_key: str):
    """Test Gemini API key with a simple request."""
    try:
        # Test with a simple models list request
        response = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            timeout=10,
        )

        if response.status_code == 200:
            models = response.json().get("models", [])
            model_name = models[0]["name"] if models else "gemini-pro"
            return (
                jsonify(
                    {
                        "success": True,
                        "message": "Gemini API key is valid",
                        "model": model_name,
                    }
                ),
                200,
            )
        else:
            error_detail = (
                response.json().get("error", {}).get("message", "Unknown error")
            )
            return (
                jsonify({"success": False, "error": f"API Error: {error_detail}"}),
                400,
            )

    except requests.Timeout:
        return jsonify({"success": False, "error": "Request timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_openai_api_key(api_key: str):
    """Test OpenAI API key."""
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-5.2",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5,
            },
            timeout=10,
        )
        if response.status_code == 200:
            return jsonify({"success": True, "message": "OpenAI API key is valid"}), 200
        else:
            error_msg = "Unknown error"
            try:
                error_msg = (
                    response.json().get("error", {}).get("message", "Unknown error")
                )
            except Exception:
                pass
            return jsonify({"success": False, "error": f"API Error: {error_msg}"}), 400
    except requests.Timeout:
        return jsonify({"success": False, "error": "Request timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_grok_api_key(api_key: str):
    """Test Grok (xAI) API key."""
    try:
        response = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-5",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5,
            },
            timeout=10,
        )
        if response.status_code == 200:
            return jsonify({"success": True, "message": "Grok API key is valid"}), 200
        else:
            error_msg = "Unknown error"
            try:
                error_msg = (
                    response.json().get("error", {}).get("message", "Unknown error")
                )
            except Exception:
                pass
            return jsonify({"success": False, "error": f"API Error: {error_msg}"}), 400
    except requests.Timeout:
        return jsonify({"success": False, "error": "Request timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_openrouter_api_key(api_key: str):
    """Test OpenRouter API key."""
    try:
        response = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.status_code == 200:
            return (
                jsonify({"success": True, "message": "OpenRouter API key is valid"}),
                200,
            )
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_deepseek_api_key(api_key: str):
    """Test DeepSeek API key."""
    try:
        response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 5,
            },
            timeout=10,
        )
        if response.status_code == 200:
            return (
                jsonify({"success": True, "message": "DeepSeek API key is valid"}),
                200,
            )
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_mistral_api_key(api_key: str):
    """Test Mistral API key."""
    try:
        response = requests.get(
            "https://api.mistral.ai/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.status_code == 200:
            return (
                jsonify({"success": True, "message": "Mistral API key is valid"}),
                200,
            )
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_together_api_key(api_key: str):
    """Test Together AI API key."""
    try:
        response = requests.get(
            "https://api.together.xyz/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.status_code == 200:
            return (
                jsonify({"success": True, "message": "Together AI API key is valid"}),
                200,
            )
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_huggingface_api_key(api_key: str):
    """Test Hugging Face API key."""
    try:
        response = requests.get(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.status_code == 200:
            return (
                jsonify({"success": True, "message": "Hugging Face API key is valid"}),
                200,
            )
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_zhipu_api_key(api_key: str):
    """Test Zhipu AI API key."""
    try:
        # Zhipu uses JWT for auth, but we can test with a simple request
        # This is a simplified test
        response = requests.get(
            "https://open.bigmodel.cn/api/paas/v4/model",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if response.status_code == 200:
            return jsonify({"success": True, "message": "Zhipu AI API key is valid"}), 200
        else:
            return (
                jsonify({"success": False, "error": f"API Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


def test_lmstudio_api_key(url: str):
    """Test LM Studio connection."""
    try:
        response = requests.get(f"{url}/v1/models", timeout=5)
        if response.status_code == 200:
            return jsonify({"success": True, "message": "LM Studio is accessible"}), 200
        else:
            return (
                jsonify(
                    {"success": False, "error": f"LM Studio Error: {response.text}"}
                ),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": f"Connection failed: {str(e)}"}), 400


def test_localai_api_key(url: str):
    """Test LocalAI connection."""
    try:
        response = requests.get(f"{url}/v1/models", timeout=5)
        if response.status_code == 200:
            return jsonify({"success": True, "message": "LocalAI is accessible"}), 200
        else:
            return (
                jsonify({"success": False, "error": f"LocalAI Error: {response.text}"}),
                400,
            )
    except Exception as e:
        return jsonify({"success": False, "error": f"Connection failed: {str(e)}"}), 400
