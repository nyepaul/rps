"""AI services routes for image extraction and analysis."""
from flask import Blueprint, request, jsonify
from flask_login import login_required
import os
import json
import base64
from io import BytesIO
from PIL import Image
import requests
from google import genai
from google.genai import types
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.extensions import limiter

ai_services_bp = Blueprint('ai_services', __name__, url_prefix='/api')


def call_gemini_with_fallback(prompt, api_key, image_data=None, mime_type=None):
    """Calls Gemini with a prioritized list of models and fallback logic using REST API."""
    # Use full model resource names for v1 API
    # Prioritize Flash models (higher free tier quotas) over Pro models
    models = [
        'models/gemini-2.0-flash',               # Gemini 2.0 Flash - latest stable, good for vision
        'models/gemini-1.5-flash',               # Gemini 1.5 Flash - reliable, high quota
        'models/gemini-1.5-flash-latest',        # Gemini 1.5 Flash latest alias
        'models/gemini-1.5-pro',                 # Gemini 1.5 Pro - better quality, lower quota
        'models/gemini-1.5-pro-latest',          # Gemini 1.5 Pro latest alias
    ]

    last_error = None

    for model_name in models:
        try:
            print(f"Attempting Gemini model: {model_name}")

            # Build request based on whether we have image data
            if image_data:
                # File extraction case (images, PDFs, etc.)
                if isinstance(image_data, str):
                    file_bytes = base64.b64decode(image_data)
                else:
                    file_bytes = image_data

                # Convert to base64 for API
                file_b64 = base64.b64encode(file_bytes).decode('utf-8')

                # Determine MIME type if not provided
                if not mime_type:
                    mime_type = 'image/png'
                    try:
                        img = Image.open(BytesIO(file_bytes))
                        if img.format == 'JPEG':
                            mime_type = 'image/jpeg'
                        elif img.format == 'PNG':
                            mime_type = 'image/png'
                        elif img.format == 'WEBP':
                            mime_type = 'image/webp'
                    except:
                        # If it's not an image, check for PDF magic bytes
                        if file_bytes[:4] == b'%PDF':
                            mime_type = 'application/pdf'

                # For CSV files, include content as text in the prompt
                if mime_type == 'text/csv':
                    csv_content = file_bytes.decode('utf-8', errors='replace')
                    enhanced_prompt = f"{prompt}\n\nCSV Data:\n```\n{csv_content}\n```"
                    payload = {
                        'contents': [{
                            'parts': [{'text': enhanced_prompt}]
                        }]
                    }
                else:
                    # Images and PDFs can be sent as inline_data
                    payload = {
                        'contents': [{
                            'parts': [
                                {'text': prompt},
                                {
                                    'inline_data': {
                                        'mime_type': mime_type,
                                        'data': file_b64
                                    }
                                }
                            ]
                        }]
                    }
            else:
                # Text-only case
                payload = {
                    'contents': [{
                        'parts': [{'text': prompt}]
                    }]
                }

            # Call Gemini REST API v1 (stable)
            # Model name should already include 'models/' prefix in the path
            url = f'https://generativelanguage.googleapis.com/v1/{model_name}:generateContent?key={api_key}'

            response = requests.post(url, json=payload, timeout=60)

            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and len(result['candidates']) > 0:
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    print(f"Success with model: {model_name}")
                    return text
                else:
                    raise Exception(f"No candidates in response: {result}")
            else:
                error_detail = response.json() if response.text else {'error': response.text}
                raise Exception(f"{response.status_code} {error_detail}")

        except Exception as e:
            last_error = e
            error_str = str(e)
            print(f"Model {model_name} failed: {error_str}")

            # Check for quota errors - don't retry other models if quota exceeded
            if '429' in error_str or 'quota' in error_str.lower() or 'RESOURCE_EXHAUSTED' in error_str:
                raise Exception("Gemini API quota exceeded. Please wait a few minutes or upgrade your API plan.")

            # Continue trying other models
            continue

    # If all models failed
    last_error_str = str(last_error)
    if '429' in last_error_str or 'quota' in last_error_str.lower():
        raise Exception("Gemini API quota exceeded. Please wait a few minutes or upgrade your API plan.")
    raise Exception(f"All Gemini models failed. Last error: {last_error_str}")


from src.models.profile import Profile
from src.models.conversation import Conversation
from flask_login import current_user

def call_llm(provider, prompt, api_key, history=None, system_prompt=None, ollama_url=None, lmstudio_url=None, localai_url=None, ollama_model=None):
    """Unified interface to call various LLM providers."""
    if provider == 'gemini':
        return call_gemini(prompt, api_key, history, system_prompt)
    elif provider == 'claude':
        return call_claude(prompt, api_key, history, system_prompt)
    elif provider == 'ollama':
        return call_ollama(prompt, ollama_url, history, system_prompt, ollama_model)
    elif provider == 'lmstudio':
        return call_lmstudio(prompt, lmstudio_url, history, system_prompt)
    elif provider == 'localai':
        return call_localai(prompt, localai_url, history, system_prompt)
    else:
        # OpenAI-compatible providers
        return call_openai_compatible(provider, prompt, api_key, history, system_prompt)


def call_gemini(prompt, api_key, history=None, system_prompt=None):
    """Calls Gemini using the official client."""
    client = genai.Client(api_key=api_key)
    
    contents = []
    if history:
        for msg in history:
            role = 'user' if msg.role == 'user' else 'model'
            msg_content = msg.to_dict().get('content', '')
            if msg_content:
                contents.append(types.Content(role=role, parts=[types.Part(text=msg_content)]))
    
    contents.append(types.Content(role='user', parts=[types.Part(text=prompt)]))

    models_to_try = [
        'models/gemini-2.0-flash', 
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro'
    ]

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7
                )
            )
            return response.text
        except Exception as e:
            if '429' in str(e) or 'quota' in str(e).lower():
                continue
            raise e
    raise Exception("All Gemini models failed or rate limited.")


def call_claude(prompt, api_key, history=None, system_prompt=None):
    """Calls Anthropic Claude API."""
    messages = []
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    models = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
    
    for model in models:
        try:
            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                json={
                    'model': model,
                    'max_tokens': 4096,
                    'system': system_prompt,
                    'messages': messages
                },
                timeout=60
            )
            if response.status_code == 200:
                return response.json()['content'][0]['text']
        except Exception:
            continue
    raise Exception("Claude API call failed.")


def call_openai_compatible(provider, prompt, api_key, history=None, system_prompt=None):
    """Calls OpenAI-compatible APIs (OpenAI, DeepSeek, OpenRouter, etc.)."""
    endpoints = {
        'openai': ('https://api.openai.com/v1/chat/completions', 'gpt-4o'),
        'deepseek': ('https://api.deepseek.com/chat/completions', 'deepseek-chat'),
        'openrouter': ('https://openrouter.ai/api/v1/chat/completions', 'google/gemini-2.0-flash-001'),
        'grok': ('https://api.x.ai/v1/chat/completions', 'grok-beta'),
        'mistral': ('https://api.mistral.ai/v1/chat/completions', 'mistral-large-latest'),
        'together': ('https://api.together.xyz/v1/chat/completions', 'mistralai/Mixtral-8x7B-Instruct-v0.1'),
        'huggingface': ('https://api-inference.huggingface.co/v1/chat/completions', 'meta-llama/Llama-3-70b-chat-hf')
    }
    
    url, default_model = endpoints.get(provider, (None, None))
    if not url:
        raise Exception(f"Unsupported provider: {provider}")

    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    try:
        response = requests.post(
            url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': default_model,
                'messages': messages,
                'temperature': 0.7
            },
            timeout=60
        )
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            raise Exception(f"{provider.capitalize()} API error: {response.text}")
    except Exception as e:
        raise Exception(f"Failed to call {provider}: {str(e)}")


def call_ollama(prompt, url, history=None, system_prompt=None, model=None):
    """Calls local Ollama API."""
    if not url:
        url = "http://localhost:11434"
    if not model:
        model = "qwen:latest"
    
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    try:
        response = requests.post(
            f"{url}/api/chat",
            json={
                'model': model,
                'messages': messages,
                'stream': False
            },
            timeout=120
        )
        if response.status_code == 200:
            return response.json()['message']['content']
        else:
            raise Exception(f"Ollama error: {response.text}")
    except Exception as e:
        raise Exception(f"Failed to connect to Ollama at {url}: {str(e)}")


def call_lmstudio(prompt, url, history=None, system_prompt=None):
    """Calls local LM Studio API (OpenAI compatible)."""
    if not url:
        url = "http://localhost:1234"
    
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    try:
        response = requests.post(
            f"{url}/v1/chat/completions",
            json={
                'messages': messages,
                'temperature': 0.7
            },
            timeout=120
        )
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            raise Exception(f"LM Studio error: {response.text}")
    except Exception as e:
        raise Exception(f"Failed to connect to LM Studio at {url}: {str(e)}")


def call_localai(prompt, url, history=None, system_prompt=None):
    """Calls local LocalAI API (OpenAI compatible)."""
    if not url:
        url = "http://localhost:8080"
    
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    try:
        response = requests.post(
            f"{url}/v1/chat/completions",
            json={
                'messages': messages,
                'temperature': 0.7
            },
            timeout=120
        )
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            raise Exception(f"LocalAI error: {response.text}")
    except Exception as e:
        raise Exception(f"Failed to connect to LocalAI at {url}: {str(e)}")


@ai_services_bp.route('/advisor/chat', methods=['POST'])
@login_required
@limiter.limit("20 per hour")
def advisor_chat():
    """AI advisor endpoint that provides personalized financial guidance."""
    data = request.json
    profile_name = data.get('profile_name')
    user_message = data.get('message')
    conversation_id = data.get('conversation_id')
    requested_provider = data.get('provider') # Optional provider selection

    if not profile_name or not user_message:
        return jsonify({'error': 'profile_name and message are required'}), 400

    try:
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})
        
        # Determine provider: priority = request > profile preference > Gemini (if key exists)
        provider = requested_provider or data_dict.get('preferred_ai_provider')
        
        # If no preferred provider, find first available key
        if not provider:
            for p in ['gemini', 'claude', 'openai', 'openrouter', 'deepseek', 'ollama', 'lmstudio', 'localai']:
                key_name = f"{p}_api_key" if p not in ['ollama', 'lmstudio', 'localai'] else f"{p}_url"
                if api_keys.get(key_name):
                    provider = p
                    break
        
        if not provider:
            provider = 'gemini' # Fallback to gemini

        # Get the appropriate key/url
        api_key = api_keys.get(f"{provider}_api_key")
        ollama_url = api_keys.get("ollama_url")
        ollama_model = api_keys.get("ollama_model")
        lmstudio_url = api_keys.get("lmstudio_url")
        localai_url = api_keys.get("localai_url")

        if not api_key and provider not in ['ollama', 'lmstudio', 'localai']:
            return jsonify({
                'error': f'{provider.capitalize()} API key not configured. Please configure in AI Settings.'
            }), 400

        # Get conversation history
        history = Conversation.list_by_profile(current_user.id, profile.id)
        
        # Prepare context from profile
        profile_data = profile.data_dict
        financial = profile_data.get('financial', {})
        assets = profile_data.get('assets', {})
        
        context = f"""
        USER PROFILE CONTEXT:
        Name: {profile.name}
        Birth Date: {profile.birth_date}
        Retirement Date: {profile.retirement_date}
        
        FINANCIALS:
        Annual Income: ${financial.get('annual_income', 0):,}
        Annual Expenses: ${financial.get('annual_expenses', 0):,}
        Social Security (monthly): ${financial.get('social_security_benefit', 0):,}
        
        ASSETS:
        Retirement: ${sum(a.get('value', 0) for a in assets.get('retirement_accounts', [])):,}
        Taxable: ${sum(a.get('value', 0) for a in assets.get('taxable_accounts', [])):,}
        Real estate: ${sum(a.get('value', 0) for a in assets.get('real_estate', [])):,}
        """

        system_prompt = f"""You are an expert financial advisor specializing in retirement planning, tax optimization, and estate planning.
        {context}

        Provide professional, clear, and actionable advice. Always include a disclaimer that you are an AI and the user should consult with a human professional for final decisions.
        """

        # Save user message
        user_msg = Conversation(
            user_id=current_user.id,
            profile_id=profile.id,
            role='user',
            content=user_message
        )
        user_msg.save()

        # Call the selected LLM
        assistant_text = call_llm(provider, user_message, api_key, history, system_prompt, ollama_url, lmstudio_url, localai_url, ollama_model)

        # Save assistant message
        assistant_msg = Conversation(
            user_id=current_user.id,
            profile_id=profile.id,
            role='assistant',
            content=assistant_text
        )
        assistant_msg.save()

        enhanced_audit_logger.log(
            action='AI_ADVISOR_CHAT',
            table_name='conversation',
            record_id=profile.id,
            details={
                'profile_name': profile_name,
                'provider': provider,
                'message_length': len(user_message),
                'response_length': len(assistant_text)
            },
            status_code=200
        )
        return jsonify({
            'response': assistant_text,
            'provider': provider,
            'status': 'success'
        }), 200

    except Exception as e:
        print(f"Advisor chat error: {str(e)}")
        return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Advisor chat error: {str(e)}")
        enhanced_audit_logger.log(
            action='AI_ADVISOR_CHAT_ERROR',
            details={'profile_name': profile_name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/advisor/history', methods=['GET'])
@login_required
def get_advisor_history():
    """Get conversation history for a profile."""
    profile_name = request.args.get('profile_name')
    if not profile_name:
        enhanced_audit_logger.log(
            action='VIEW_ADVISOR_HISTORY_VALIDATION_ERROR',
            details={'error': 'profile_name is required'},
            status_code=400
        )
        return jsonify({'error': 'profile_name is required'}), 400

    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile:
        enhanced_audit_logger.log(
            action='VIEW_ADVISOR_HISTORY_NOT_FOUND',
            details={'profile_name': profile_name},
            status_code=404
        )
        return jsonify({'error': 'Profile not found'}), 404

    history = Conversation.list_by_profile(current_user.id, profile.id)
    enhanced_audit_logger.log(
        action='VIEW_ADVISOR_HISTORY',
        table_name='conversation',
        record_id=profile.id,
        details={
            'profile_name': profile_name,
            'message_count': len(history)
        },
        status_code=200
    )
    return jsonify({
        'history': [msg.to_dict() for msg in history]
    }), 200


@ai_services_bp.route('/advisor/conversation/<int:profile_id>', methods=['DELETE'])
@login_required
def clear_advisor_history(profile_id: int):
    """Clear conversation history for a profile."""
    # Verify user owns this profile before deleting
    profile = Profile.get_by_id(profile_id, current_user.id)
    if not profile:
        return jsonify({'error': 'Profile not found or access denied'}), 404

    Conversation.delete_by_profile(current_user.id, profile_id)
    enhanced_audit_logger.log(
        action='CLEAR_ADVISOR_HISTORY',
        table_name='conversation',
        record_id=profile_id,
        details={'profile_id': profile_id},
        status_code=200
    )
    return jsonify({'message': 'History cleared'}), 200


@ai_services_bp.route('/extract-assets', methods=['POST'])
@login_required
@limiter.limit("10 per hour")
def extract_assets():
    """Extract assets from an uploaded file (image, PDF, or CSV) using AI."""
    print("Received extract-assets request")

    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    provider = data.get('llm_provider', 'gemini')
    existing_assets = data.get('existing_assets', [])
    profile_name = data.get('profile_name')

    print(f"Provider: {provider}, MIME type: {mime_type}, Data length: {len(image_b64) if image_b64 else 0}")

    if not image_b64:
        enhanced_audit_logger.log(
            action='EXTRACT_ASSETS_NO_IMAGE',
            details={'profile_name': profile_name},
            status_code=400
        )
        return jsonify({'error': 'No image data provided'}), 400

    if not profile_name:
        enhanced_audit_logger.log(
            action='EXTRACT_ASSETS_NO_PROFILE',
            details={'error': 'No profile_name provided'},
            status_code=400
        )
        return jsonify({'error': 'No profile_name provided'}), 400

    # Get API key from profile
    try:
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})

        if provider == 'gemini':
            api_key = api_keys.get('gemini_api_key')
            if not api_key:
                return jsonify({'error': 'Gemini API key not configured. Please configure in Settings.'}), 400
        else:
            api_key = api_keys.get('claude_api_key')
            if not api_key:
                return jsonify({'error': 'Claude API key not configured. Please configure in Settings.'}), 400

    except Exception as e:
        return jsonify({'error': f'Error loading API key: {str(e)}'}), 500

    try:
        # Decode base64 file data
        file_bytes = base64.b64decode(image_b64)

        # Extraction prompt - works with images, PDFs, and CSVs
        prompt = """
        Analyze this financial document (image, PDF, or CSV data).
        Extract a list of investment accounts or assets.

        CRITICAL RULES - ONLY UPDATE VERIFIABLE FIELDS:
        1. Ignore "Total", "Grand Total", "Subtotal", "Margin", or "Buying Power" lines.
        2. Clean all values: remove "$", "USD", and commas. Return as numbers only.
        3. For each asset, extract ONLY the fields you can clearly see and verify:
           - "name": The specific name (e.g., "Cash & Money Market", "Vanguard 500"). REQUIRED.
           - "type": One of: "traditional_ira", "roth_ira", "401k", "403b", "457", "brokerage", "savings", "checking".
             ⚠️ ONLY include "type" if it is EXPLICITLY stated (e.g., "IRA", "401k" visible in account name/label).
             If the account type is not clearly visible, set "type" to "brokerage".
           - "value": The current balance as a number. REQUIRED if visible.
           - "cost_basis": Only include if explicitly shown (rare). Otherwise set to null.
           - "institution": The financial institution name if visible (e.g., "Wells Fargo", "Vanguard").
           - "account_number": The last 4 digits of the account number if visible (e.g., "1234"). Otherwise null.

        4. DO NOT GUESS or INFER field values. If a field is not clearly visible, use null or default.
        5. Return ONLY a JSON array of objects with the structure:
           [{"name": "...", "type": "...", "value": ..., "cost_basis": null, "institution": "...", "account_number": null or "1234"}]
        """

        if provider == 'gemini':
            text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)

            try:
                # Clean markdown code blocks
                json_str = text_response.replace('```json', '').replace('```', '').strip()
                extracted_assets = json.loads(json_str)

                # Merge with existing assets
                merged_assets = []
                for extracted in extracted_assets:
                    # Find matching existing asset by name (case-insensitive)
                    existing = next(
                        (a for a in existing_assets if a.get('name', '').lower() == extracted.get('name', '').lower()),
                        None
                    )

                    if existing:
                        # Merge: use extracted values if present, otherwise keep existing
                        merged = {
                            'name': extracted.get('name') or existing.get('name'),
                            'type': extracted.get('type') or existing.get('type', 'brokerage'),
                            'value': extracted.get('value') if extracted.get('value') is not None else existing.get('value', 0),
                            'cost_basis': extracted.get('cost_basis') if extracted.get('cost_basis') is not None else existing.get('cost_basis', 0),
                            'institution': extracted.get('institution') or existing.get('institution', '')
                        }
                    else:
                        # New asset: use extracted data with defaults
                        merged = {
                            'name': extracted.get('name', 'Unknown Asset'),
                            'type': extracted.get('type') or 'brokerage',
                            'value': extracted.get('value', 0),
                            'cost_basis': extracted.get('cost_basis', 0),
                            'institution': extracted.get('institution', '')
                        }

                    merged_assets.append(merged)

                enhanced_audit_logger.log(
                    action='EXTRACT_ASSETS_AI',
                    table_name='profile',
                    record_id=profile.id,
                    details={
                        'profile_name': profile_name,
                        'provider': 'gemini',
                        'assets_extracted': len(merged_assets),
                        'existing_assets_count': len(existing_assets)
                    },
                    status_code=200
                )
                return jsonify({
                    'assets': merged_assets,
                    'status': 'success'
                }), 200

            except json.JSONDecodeError as e:
                enhanced_audit_logger.log(
                    action='EXTRACT_ASSETS_PARSE_ERROR',
                    details={'profile_name': profile_name, 'provider': 'gemini', 'error': str(e)},
                    status_code=500
                )
                return jsonify({
                    'error': f'Failed to parse AI response as JSON: {str(e)}',
                    'raw_response': text_response[:500]
                }), 500
        else:
            # Claude support with vision models
            import requests

            # Latest Claude models with vision support
            claude_models = [
                'claude-opus-4-5-20251101',      # Claude Opus 4.5 (Nov 2025) - most capable, best for complex analysis
                'claude-sonnet-4-5-20250929',    # Claude Sonnet 4.5 (Sep 2025) - excellent balance of speed & quality
                'claude-sonnet-4-20250514',      # Claude Sonnet 4 (May 2025) - fallback
                'claude-sonnet-3-5-20241022'     # Claude Sonnet 3.5 (Oct 2024) - legacy fallback
            ]

            last_error = None
            for model in claude_models:
                try:
                    print(f"Attempting Claude model: {model}")

                    # Convert image to base64 if needed
                    if isinstance(image_bytes, bytes):
                        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
                    else:
                        image_b64 = image_bytes

                    # Determine MIME type
                    mime_type = 'image/png'
                    try:
                        img = Image.open(BytesIO(base64.b64decode(image_b64)))
                        if img.format == 'JPEG':
                            mime_type = 'image/jpeg'
                        elif img.format == 'PNG':
                            mime_type = 'image/png'
                        elif img.format == 'WEBP':
                            mime_type = 'image/webp'
                    except:
                        pass

                    response = requests.post(
                        'https://api.anthropic.com/v1/messages',
                        headers={
                            'x-api-key': api_key,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json'
                        },
                        json={
                            'model': model,
                            'max_tokens': 4096,
                            'messages': [{
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'image',
                                        'source': {
                                            'type': 'base64',
                                            'media_type': mime_type,
                                            'data': image_b64
                                        }
                                    },
                                    {
                                        'type': 'text',
                                        'text': prompt
                                    }
                                ]
                            }]
                        },
                        timeout=60
                    )

                    if response.status_code == 200:
                        result = response.json()
                        text_response = result['content'][0]['text']
                        print(f"Success with Claude model: {model}")

                        # Parse JSON response (same as Gemini)
                        try:
                            json_str = text_response.replace('```json', '').replace('```', '').strip()
                            extracted_assets = json.loads(json_str)

                            # Merge with existing assets (same logic as Gemini)
                            merged_assets = []
                            for extracted in extracted_assets:
                                existing = next(
                                    (a for a in existing_assets if a.get('name', '').lower() == extracted.get('name', '').lower()),
                                    None
                                )

                                if existing:
                                    merged = {
                                        'name': extracted.get('name') or existing.get('name'),
                                        'type': extracted.get('type') or existing.get('type', 'brokerage'),
                                        'value': extracted.get('value') if extracted.get('value') is not None else existing.get('value', 0),
                                        'cost_basis': extracted.get('cost_basis') if extracted.get('cost_basis') is not None else existing.get('cost_basis', 0),
                                        'institution': extracted.get('institution') or existing.get('institution', '')
                                    }
                                else:
                                    merged = {
                                        'name': extracted.get('name', 'Unknown Asset'),
                                        'type': extracted.get('type') or 'brokerage',
                                        'value': extracted.get('value', 0),
                                        'cost_basis': extracted.get('cost_basis', 0),
                                        'institution': extracted.get('institution', '')
                                    }

                                merged_assets.append(merged)

                            enhanced_audit_logger.log(
                                action='EXTRACT_ASSETS_AI',
                                table_name='profile',
                                record_id=profile.id,
                                details={
                                    'profile_name': profile_name,
                                    'provider': 'claude',
                                    'assets_extracted': len(merged_assets),
                                    'existing_assets_count': len(existing_assets)
                                },
                                status_code=200
                            )
                            return jsonify({
                                'assets': merged_assets,
                                'status': 'success'
                            }), 200

                        except json.JSONDecodeError as e:
                            enhanced_audit_logger.log(
                                action='EXTRACT_ASSETS_PARSE_ERROR',
                                details={'profile_name': profile_name, 'provider': 'claude', 'error': str(e)},
                                status_code=500
                            )
                            return jsonify({
                                'error': f'Failed to parse AI response as JSON: {str(e)}',
                                'raw_response': text_response[:500]
                            }), 500
                    else:
                        error_detail = response.json() if response.text else {'error': response.text}
                        raise Exception(f"{response.status_code} {error_detail}")

                except Exception as e:
                    last_error = e
                    print(f"Claude model {model} failed: {str(e)}")
                    continue

            # All Claude models failed
            enhanced_audit_logger.log(
                action='EXTRACT_ASSETS_ALL_MODELS_FAILED',
                details={'profile_name': profile_name, 'provider': 'claude', 'error': str(last_error)},
                status_code=500
            )
            return jsonify({
                'error': f'All Claude models failed. Last error: {str(last_error)}'
            }), 500

    except Exception as e:
        print(f"Extract assets error: {str(e)}")
        enhanced_audit_logger.log(
            action='EXTRACT_ASSETS_ERROR',
            details={'profile_name': profile_name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/extract-income', methods=['POST'])
@login_required
@limiter.limit("10 per hour")
def extract_income():
    """Extract income streams from an uploaded file (image, PDF, or CSV) using AI."""
    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    provider = data.get('llm_provider', 'gemini')
    profile_name = data.get('profile_name')

    if not image_b64 or not profile_name:
        return jsonify({'error': 'image and profile_name are required'}), 400

    # Get API key
    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile: return jsonify({'error': 'Profile not found'}), 404
    api_key = profile.data_dict.get('api_keys', {}).get('gemini_api_key' if provider == 'gemini' else 'claude_api_key')
    if not api_key: return jsonify({'error': f'{provider.capitalize()} API key not configured'}), 400

    prompt = """
    Analyze this financial document (image, PDF, or CSV data) of a pay stub, bank statement, or tax document.
    Extract a list of regular income streams.

    FREQUENCY DETECTION - Look for these patterns:
    - Keywords: "monthly", "bi-weekly", "weekly", "annual", "yearly", "quarterly", "semi-monthly"
    - Pay stubs: Check pay period dates. If ~2 weeks apart = "bi-weekly", ~1 month = "monthly"
    - Bank statements: Look for recurring deposits on similar dates each month
    - Tax documents (W-2, 1099): Annual amounts - set frequency to "annual"
    - Salary/wages typically: "bi-weekly" or "semi-monthly" (24 pay periods/year)
    - Rental income, dividends, Social Security: typically "monthly"

    RULES:
    1. Extract for each income source:
       - "name": Descriptive name (e.g., "Salary - Acme Corp", "Rental Income - 123 Main St", "Social Security")
       - "amount": The per-period amount as a number (not annual total unless frequency is "annual")
       - "frequency": One of "weekly", "bi-weekly", "semi-monthly", "monthly", "quarterly", "annual"
    2. Clean values: numbers only for amount, no $ or commas.
    3. If frequency is unclear, default to "monthly" for regular income, "annual" for one-time or tax documents.
    4. Return ONLY a JSON array: [{"name": "...", "amount": ..., "frequency": "..."}]
    """

    try:
        file_bytes = base64.b64decode(image_b64)
        if provider == 'gemini':
            text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)
        else:
            # Simple Claude placeholder for now - consistent with extract_assets
            return jsonify({'error': 'Claude extraction for income not yet fully implemented'}), 501

        json_str = text_response.replace('```json', '').replace('```', '').strip()
        extracted_income = json.loads(json_str)
        
        return jsonify({'income': extracted_income, 'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/extract-expenses', methods=['POST'])
@login_required
@limiter.limit("10 per hour")
def extract_expenses():
    """Extract expenses from an uploaded file (image, PDF, or CSV) using AI."""
    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    provider = data.get('llm_provider', 'gemini')
    profile_name = data.get('profile_name')

    if not image_b64 or not profile_name:
        return jsonify({'error': 'image and profile_name are required'}), 400

    # Get API key
    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile: return jsonify({'error': 'Profile not found'}), 404
    api_key = profile.data_dict.get('api_keys', {}).get('gemini_api_key' if provider == 'gemini' else 'claude_api_key')
    if not api_key: return jsonify({'error': f'{provider.capitalize()} API key not configured'}), 400

    prompt = """
    Analyze this financial document (image, PDF, or CSV data) of a receipt, credit card statement, or bill.
    Extract a list of recurring or significant expenses.

    FREQUENCY DETECTION - Look for these patterns:
    - Keywords on bills: "monthly", "annual", "yearly", "quarterly", "weekly", "due monthly"
    - Subscriptions (Netflix, Spotify, gym): typically "monthly" or "annual"
    - Utilities (electric, gas, water, internet): typically "monthly"
    - Insurance premiums: check if "monthly", "quarterly", "semi-annual", or "annual"
    - Mortgage/rent: typically "monthly"
    - Property taxes: typically "annual" or "semi-annual"
    - Car payments, loan payments: typically "monthly"
    - Credit card statements: Look for recurring charges on similar dates
    - Bank statements: Identify repeating transactions with same payee/amount

    RULES:
    1. Extract for each expense:
       - "name": Descriptive name (e.g., "Electric Bill - PG&E", "Netflix Subscription", "Mortgage - Chase")
       - "amount": The per-period amount as a number
       - "frequency": One of "weekly", "bi-weekly", "monthly", "quarterly", "semi-annual", "annual"
       - "category": Map to one of: housing, utilities, transportation, food, dining_out, healthcare, insurance, travel, entertainment, personal_care, clothing, gifts, childcare_education, charitable_giving, subscriptions, pet_care, home_maintenance, debt_payments, taxes, discretionary, other
    2. Clean values: numbers only for amount, no $ or commas.
    3. If frequency is unclear: utilities/subscriptions/rent default to "monthly", insurance/taxes consider "annual".
    4. Return ONLY a JSON array: [{"name": "...", "amount": ..., "frequency": "...", "category": "..."}]
    """

    try:
        file_bytes = base64.b64decode(image_b64)
        if provider == 'gemini':
            text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)
        else:
            return jsonify({'error': 'Claude extraction for expenses not yet fully implemented'}), 501

        json_str = text_response.replace('```json', '').replace('```', '').strip()
        extracted_expenses = json.loads(json_str)
        
        return jsonify({'expenses': extracted_expenses, 'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
