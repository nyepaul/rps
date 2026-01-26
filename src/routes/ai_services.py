"""AI services routes for image extraction and analysis."""
import base64
import json
import requests
import os
from io import BytesIO
from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user
from PIL import Image
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from src.models.profile import Profile
from src.models.conversation import Conversation
from google import genai
from google.genai import types
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.extensions import limiter

ai_services_bp = Blueprint('ai_services', __name__, url_prefix='/api')


def sanitize_url(url, default_url):
    """Clean up corrupted URLs that might contain masking bullets."""
    if not url or not isinstance(url, str):
        return default_url
    if '•' in url:
        return default_url
    return url


def process_pdf_content(pdf_bytes, max_pages=150):
    """
    Intelligently processes PDF content for LLMs.
    Returns (chunks, content_type) where chunks is a list of strings or images.
    """
    if not fitz:
        raise Exception("PyMuPDF (fitz) is not installed. PDF processing not available.")
    
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        if pdf_document.page_count == 0:
            raise Exception("PDF has no pages.")
        
        # 1. Try text extraction first
        # We'll group pages into larger chunks to keep context manageable but efficient
        text_chunks = []
        current_chunk = ""
        pages_in_chunk = 0
        
        for i in range(min(pdf_document.page_count, max_pages)):
            page_text = pdf_document[i].get_text().strip()
            if page_text:
                current_chunk += f"--- Page {i+1} ---\n{page_text}\n\n"
                pages_in_chunk += 1
                
                # Close chunk every 50 pages or if it gets very large (30k chars)
                if pages_in_chunk >= 50 or len(current_chunk) > 30000:
                    text_chunks.append(current_chunk)
                    current_chunk = ""
                    pages_in_chunk = 0
        
        if current_chunk:
            text_chunks.append(current_chunk)
        
        # If we extracted significant text, return chunks
        if any(len(c.strip()) > 50 for c in text_chunks):
            print(f"Extracted {len(text_chunks)} text chunks from {pdf_document.page_count} pages.")
            pdf_document.close()
            return text_chunks, "text"
        
        # 2. Fallback to images (scanned PDF)
        print("Scanned PDF detected. Rendering pages to images...")
        images = []
        # Limit image conversion to 20 pages for more data coverage
        for i in range(min(pdf_document.page_count, 20)):
            page = pdf_document[i]
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            images.append(base64.b64encode(buffered.getvalue()).decode('utf-8'))
        
        pdf_document.close()
        # For images, each image is its own chunk
        return images, "images"
    except Exception as e:
        print(f"PDF processing error: {str(e)}")
        raise Exception(f"Failed to process PDF: {str(e)}")


def resilient_parse_llm_json(text_response, list_key):
    """
    Robustly parses LLM response to extract a list.
    Handles markdown blocks, nested objects, and common wrappers.
    """
    try:
        # 1. Strip markdown code blocks
        clean_text = text_response.strip()
        if "```json" in clean_text:
            clean_text = clean_text.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_text:
            clean_text = clean_text.split("```")[1].split("```")[0].strip()
        
        # 2. Parse JSON
        data = json.loads(clean_text)
        
        # 3. If it's already a list, return it
        if isinstance(data, list):
            return data
            
        # 4. If it's a dict, look for common list keys
        if isinstance(data, dict):
            # Check the expected key first (e.g. 'assets', 'income')
            if list_key in data and isinstance(data[list_key], list):
                return data[list_key]
            
            # Check other common keys
            for key in ['items', 'data', 'results', 'list']:
                if key in data and isinstance(data[key], list):
                    return data[key]
            
            # If it's a single object that matches the expected structure but not in a list, wrap it
            # (Heuristic: if it has a 'name' and 'value'/'amount')
            if 'name' in data and ('value' in data or 'amount' in data):
                return [data]
                
        return []
    except Exception as e:
        print(f"LLM JSON Parse Error: {str(e)}")
        # If all else fails, try a regex approach or return empty
        return []



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

            # Determine which API version to use
            # v1 is stable for images, but v1beta is required for PDF/Document support via inline_data
            api_version = 'v1'
            if mime_type == 'application/pdf' or (isinstance(image_data, bytes) and image_data[:4] == b'%PDF'):
                api_version = 'v1beta'

            # Call Gemini REST API
            # Model name should already include 'models/' prefix in the path
            url = f'https://generativelanguage.googleapis.com/{api_version}/{model_name}:generateContent?key={api_key}'

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


def call_claude_with_vision(prompt, api_key, image_b64, mime_type):
    """Calls Anthropic Claude with vision support."""
    url = 'https://api.anthropic.com/v1/messages'
    headers = {
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
    }
    
    # Handle CSV case: Include as text in the prompt instead of an image
    if mime_type == 'text/csv':
        try:
            csv_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
            payload = {
                'model': 'claude-3-5-sonnet-20241022',
                'max_tokens': 4096,
                'messages': [
                    {
                        'role': 'user',
                        'content': f"{prompt}\n\nCSV Data:\n```\n{csv_content}\n```"
                    }
                ]
            }
        except Exception as e:
            raise Exception(f"Failed to decode CSV data: {str(e)}")
    else:
        # Map mime_type to Anthropic supported types
        # Anthropic supports image/jpeg, image/png, image/gif, and image/webp
        anthropic_mime = mime_type
        if mime_type == 'image/jpg':
            anthropic_mime = 'image/jpeg'

        payload = {
            'model': 'claude-3-5-sonnet-20241022',
            'max_tokens': 4096,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': anthropic_mime,
                                'data': image_b64,
                            },
                        },
                        {
                            'type': 'text',
                            'text': prompt
                        }
                    ],
                }
            ]
        }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            return response.json()['content'][0]['text']
        else:
            raise Exception(f"Claude Vision error: {response.status_code} {response.text}")
    except Exception as e:
        raise Exception(f"Failed to call Claude Vision: {str(e)}")


def call_openai_with_vision(prompt, api_key, image_b64, mime_type):
    """Calls OpenAI GPT-4o with vision support."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Handle CSV case: Include as text in the prompt instead of an image URL
    if mime_type == 'text/csv':
        try:
            csv_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "user",
                        "content": f"{prompt}\n\nCSV Data:\n```\n{csv_content}\n```"
                    }
                ],
                "max_tokens": 4000
            }
        except Exception as e:
            raise Exception(f"Failed to decode CSV data: {str(e)}")
    else:
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1000
        }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            raise Exception(f"OpenAI Vision error: {response.status_code} {response.text}")
    except Exception as e:
        raise Exception(f"Failed to call OpenAI Vision: {str(e)}")


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
        'huggingface': ('https://api-inference.huggingface.co/v1/chat/completions', 'meta-llama/Llama-3-70b-chat-hf'),
        'zhipu': ('https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-4-flash')
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
            for p in ['gemini', 'claude', 'openai', 'openrouter', 'deepseek', 'ollama', 'zhipu', 'lmstudio', 'localai']:
                key_name = f"{p}_api_key" if p not in ['ollama', 'lmstudio', 'localai'] else f"{p}_url"
                if api_keys.get(key_name):
                    provider = p
                    break
        
        if not provider:
            provider = 'gemini' # Fallback to gemini

        # Get the appropriate key/url
        api_key = api_keys.get(f"{provider}_api_key")
        ollama_url = sanitize_url(api_keys.get("ollama_url"), "http://localhost:11434")
        # Use model from request if provided (e.g. from chat selector), else use profile default
        ollama_model = data.get('ollama_model') or api_keys.get("ollama_model")
        lmstudio_url = sanitize_url(api_keys.get("lmstudio_url"), "http://localhost:1234")
        localai_url = sanitize_url(api_keys.get("localai_url"), "http://localhost:8080")

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


@ai_services_bp.route('/ollama/models', methods=['GET'])
@login_required
@limiter.exempt
def list_ollama_models():
    """List available models from local Ollama instance."""
    url = request.args.get('url', 'http://localhost:11434')
    try:
        response = requests.get(f"{url}/api/tags", timeout=5)
        if response.status_code == 200:
            return jsonify(response.json()), 200
        enhanced_audit_logger.log(
            action='OLLAMA_MODELS_FETCH_FAILED',
            details={'status_code': response.status_code, 'url': url},
            status_code=response.status_code
        )
        return jsonify({'error': f'Ollama error: {response.status_code}'}), response.status_code
    except Exception as e:
        enhanced_audit_logger.log(
            action='OLLAMA_MODELS_CONNECTION_ERROR',
            details={'error': str(e), 'url': url},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/ollama/pull', methods=['POST'])
@login_required
@limiter.exempt
def pull_ollama_model():
    """Pull/update a model in local Ollama instance."""
    data = request.json
    url = sanitize_url(data.get('url'), 'http://localhost:11434')
    model = data.get('model')
    
    if not model:
        return jsonify({'error': 'Model name is required'}), 400
        
    try:
        # We use stream=True because pulling can take a long time
        # Using a longer timeout for pulls as they involve large downloads
        response = requests.post(f"{url}/api/pull", json={'name': model, 'stream': False}, timeout=600)
        if response.status_code == 200:
            return jsonify({'status': 'success', 'message': f'Model {model} updated successfully'}), 200
        
        enhanced_audit_logger.log(
            action='OLLAMA_PULL_FAILED',
            details={'status_code': response.status_code, 'model': model, 'response': response.text},
            status_code=response.status_code
        )
        return jsonify({'error': f'Ollama error: {response.status_code}', 'details': response.text}), response.status_code
    except Exception as e:
        enhanced_audit_logger.log(
            action='OLLAMA_PULL_EXCEPTION',
            details={'error': str(e), 'model': model},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/extract-assets', methods=['POST'])
@login_required
@limiter.limit("50 per hour")
def extract_assets():
    """Extract assets from an uploaded file (image, PDF, or CSV) using AI."""
    print("Received extract-assets request")

    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    requested_provider = data.get('llm_provider')
    existing_assets = data.get('existing_assets', [])
    profile_name = data.get('profile_name')

    if not image_b64:
        return jsonify({'error': 'No image data provided'}), 400

    if not profile_name:
        return jsonify({'error': 'No profile_name provided'}), 400

    # Get API key or Local URL from profile
    try:
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})
        
        # Determine provider: priority = request > profile preference > Gemini (fallback)
        provider = requested_provider or data_dict.get('preferred_ai_provider') or 'gemini'
        
        print(f"Provider: {provider}, MIME type: {mime_type}, Data length: {len(image_b64) if image_b64 else 0}")

        api_key = None
        ollama_url = sanitize_url(api_keys.get('ollama_url'), 'http://localhost:11434')
        # Use llama3.2-vision for extraction if using Ollama, as it's specifically for this task
        # We prefer the setting if it contains 'vision' or 'vl', otherwise default to llama3.2-vision
        configured_model = api_keys.get('ollama_model', '')
        if 'vision' in configured_model.lower() or 'vl' in configured_model.lower():
            ollama_model = configured_model
        else:
            ollama_model = 'llama3.2-vision'

        if provider == 'gemini':
            api_key = api_keys.get('gemini_api_key')
            if not api_key:
                return jsonify({'error': 'Gemini API key not configured. Please configure in AI Settings.'}), 400
        elif provider == 'claude':
            api_key = api_keys.get('claude_api_key')
            if not api_key:
                return jsonify({'error': 'Claude API key not configured. Please configure in AI Settings.'}), 400
        elif provider == 'openai':
            api_key = api_keys.get('openai_api_key')
            if not api_key:
                return jsonify({'error': 'OpenAI API key not configured. Please configure in AI Settings.'}), 400
        elif provider == 'ollama':
            # Ollama doesn't need an API key
            pass
        else:
            return jsonify({'error': f'Provider {provider} not supported for asset extraction yet.'}), 400

    except Exception as e:
        return jsonify({'error': f'Error loading AI configuration: {str(e)}'}), 500

    prompt = """
    Analyze this financial document. Extract a list of investment accounts or assets.
    Return ONLY a JSON array of objects with the structure:
    [{"name": "...", "type": "...", "value": ..., "cost_basis": null, "institution": "...", "account_number": null}]
    Clean all values: remove symbols and commas. 
    Supported types: "traditional_ira", "roth_ira", "401k", "403b", "457", "brokerage", "savings", "checking".
    """

    def generate():
        try:
            if (mime_type == 'application/pdf' or image_b64.startswith('JVBERi')) and mime_type != 'text/csv':
                # Handle multi-page PDF for ALL providers
                all_extracted = []
                print(f"Processing multi-page PDF for {provider}...")
                file_bytes = base64.b64decode(image_b64)
                chunks, content_type = process_pdf_content(file_bytes)
                
                num_chunks = len(chunks)
                for idx, chunk in enumerate(chunks):
                    progress = int(((idx) / num_chunks) * 100)
                    yield json.dumps({'status': 'processing', 'progress': progress, 'message': f'Analyzing page group {idx+1}/{num_chunks}...'}) + '\n'
                    
                    chunk_text_response = ""
                    if provider == 'gemini':
                        image_data = base64.b64decode(chunk) if content_type == "images" else None
                        current_prompt = prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}"
                        chunk_text_response = call_gemini_with_fallback(current_prompt, api_key, image_data=image_data, mime_type="image/png" if content_type == "images" else None)
                    elif provider == 'claude':
                        if content_type == "images":
                            chunk_text_response = call_claude_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'openai':
                        if content_type == "images":
                            chunk_text_response = call_openai_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'ollama':
                        payload = {
                            'model': ollama_model,
                            'messages': [{
                                'role': 'user',
                                'content': prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}",
                            }],
                            'stream': False,
                            'format': 'json'
                        }
                        if content_type == "images":
                            payload['messages'][0]['images'] = [chunk]

                        response = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=600)
                        if response.status_code == 200:
                            chunk_text_response = response.json()['message']['content']
                        else:
                            print(f"Warning: Chunk {idx+1} failed: {response.text}")

                    if chunk_text_response:
                        chunk_items = resilient_parse_llm_json(chunk_text_response, 'assets')
                        all_extracted.extend(chunk_items)
                
                yield json.dumps({'assets': all_extracted, 'status': 'success', 'progress': 100}) + '\n'
            else:
                # Standard single-shot path
                text_response = ""
                if provider == 'gemini':
                    file_bytes = base64.b64decode(image_b64)
                    text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)
                elif provider == 'claude':
                    text_response = call_claude_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'openai':
                    text_response = call_openai_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'ollama':
                    # Single image case
                    response = requests.post(
                        f"{ollama_url}/api/chat",
                        json={
                            'model': ollama_model,
                            'messages': [{'role': 'user', 'content': prompt, 'images': [image_b64]}],
                            'stream': False,
                            'format': 'json'
                        },
                        timeout=180
                    )
                    if response.status_code == 200:
                        text_response = response.json()['message']['content']
                    else:
                        raise Exception(f"Ollama Vision error: {response.text}")

                extracted_assets = resilient_parse_llm_json(text_response, 'assets')
                yield json.dumps({'assets': extracted_assets, 'status': 'success', 'progress': 100}) + '\n'

        except Exception as e:
            print(f"Extract assets error: {str(e)}")
            enhanced_audit_logger.log(
                action='EXTRACT_ASSETS_ERROR',
                details={'profile_name': profile_name, 'error': str(e)},
                status_code=500
            )
            yield json.dumps({'error': str(e)}) + '\n'

    return Response(generate(), mimetype='application/x-ndjson')


@ai_services_bp.route('/extract-income', methods=['POST'])
@login_required
@limiter.limit("50 per hour")
def extract_income():
    """Extract income streams from an uploaded file (image, PDF, or CSV) using AI."""
    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    requested_provider = data.get('llm_provider')
    profile_name = data.get('profile_name')

    if not image_b64 or not profile_name:
        return jsonify({'error': 'image and profile_name are required'}), 400

    # Get API key
    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile: return jsonify({'error': 'Profile not found'}), 404
    
    data_dict = profile.data_dict
    api_keys = data_dict.get('api_keys', {})
    
    # Determine provider: priority = request > profile preference > Gemini (fallback)
    provider = requested_provider or data_dict.get('preferred_ai_provider') or 'gemini'
    
    api_key = None
    ollama_url = sanitize_url(api_keys.get('ollama_url'), 'http://localhost:11434')
    # Use llama3.2-vision for extraction if using Ollama, as it's specifically for this task
    configured_model = api_keys.get('ollama_model', '')
    if 'vision' in configured_model.lower() or 'vl' in configured_model.lower():
        ollama_model = configured_model
    else:
        ollama_model = 'llama3.2-vision'
    
    if provider == 'gemini':
        api_key = api_keys.get('gemini_api_key')
    elif provider == 'claude':
        api_key = api_keys.get('claude_api_key')
    elif provider == 'openai':
        api_key = api_keys.get('openai_api_key')
        
    if not api_key and provider not in ['ollama', 'lmstudio', 'localai']: 
        return jsonify({'error': f'{provider.capitalize()} API key not configured. Please configure in AI Settings.'}), 400

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
    
    def generate():
        try:
            if (mime_type == 'application/pdf' or image_b64.startswith('JVBERi')) and mime_type != 'text/csv':
                # Handle multi-page PDF for ALL providers
                all_extracted = []
                print(f"Processing multi-page PDF for {provider}...")
                file_bytes = base64.b64decode(image_b64)
                chunks, content_type = process_pdf_content(file_bytes)
                
                num_chunks = len(chunks)
                for idx, chunk in enumerate(chunks):
                    progress = int(((idx) / num_chunks) * 100)
                    yield json.dumps({'status': 'processing', 'progress': progress, 'message': f'Analyzing page group {idx+1}/{num_chunks}...'}) + '\n'
                    
                    chunk_text_response = ""
                    if provider == 'gemini':
                        image_data = base64.b64decode(chunk) if content_type == "images" else None
                        current_prompt = prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}"
                        chunk_text_response = call_gemini_with_fallback(current_prompt, api_key, image_data=image_data, mime_type="image/png" if content_type == "images" else None)
                    elif provider == 'claude':
                        if content_type == "images":
                            chunk_text_response = call_claude_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'openai':
                        if content_type == "images":
                            chunk_text_response = call_openai_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'ollama':
                        payload = {
                            'model': ollama_model,
                            'messages': [{
                                'role': 'user',
                                'content': prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}",
                            }],
                            'stream': False,
                            'format': 'json'
                        }
                        if content_type == "images":
                            payload['messages'][0]['images'] = [chunk]

                        response = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=600)
                        if response.status_code == 200:
                            chunk_text_response = response.json()['message']['content']
                        else:
                            print(f"Warning: Chunk {idx+1} failed: {response.text}")

                    if chunk_text_response:
                        chunk_items = resilient_parse_llm_json(chunk_text_response, 'income')
                        all_extracted.extend(chunk_items)
                
                yield json.dumps({'income': all_extracted, 'status': 'success', 'progress': 100}) + '\n'
            else:
                # Standard single-shot path
                text_response = ""
                if provider == 'gemini':
                    file_bytes = base64.b64decode(image_b64)
                    text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)
                elif provider == 'claude':
                    text_response = call_claude_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'openai':
                    text_response = call_openai_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'ollama':
                    # Single image case
                    response = requests.post(
                        f"{ollama_url}/api/chat",
                        json={
                            'model': ollama_model,
                            'messages': [{'role': 'user', 'content': prompt, 'images': [image_b64]}],
                            'stream': False,
                            'format': 'json'
                        },
                        timeout=180
                    )
                    if response.status_code == 200:
                        text_response = response.json()['message']['content']
                    else:
                        raise Exception(f"Ollama Vision error: {response.text}")

                extracted_income = resilient_parse_llm_json(text_response, 'income')
                yield json.dumps({'income': extracted_income, 'status': 'success', 'progress': 100}) + '\n'

        except Exception as e:
            print(f"Extract income error: {str(e)}")
            enhanced_audit_logger.log(
                action='EXTRACT_INCOME_ERROR',
                details={'profile_name': profile_name, 'error': str(e)},
                status_code=500
            )
            yield json.dumps({'error': str(e)}) + '\n'
    
    return Response(generate(), mimetype='application/x-ndjson')


@ai_services_bp.route('/extract-expenses', methods=['POST'])
@login_required
@limiter.limit("50 per hour")
def extract_expenses():
    """Extract expenses from an uploaded file (image, PDF, or CSV) using AI."""
    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    requested_provider = data.get('llm_provider')
    profile_name = data.get('profile_name')

    if not image_b64 or not profile_name:
        return jsonify({'error': 'image and profile_name are required'}), 400

    # Get API key
    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile: return jsonify({'error': 'Profile not found'}), 404
    
    data_dict = profile.data_dict
    api_keys = data_dict.get('api_keys', {})
    
    # Determine provider: priority = request > profile preference > Gemini (fallback)
    provider = requested_provider or data_dict.get('preferred_ai_provider') or 'gemini'
    
    api_key = None
    ollama_url = sanitize_url(api_keys.get('ollama_url'), 'http://localhost:11434')
    # Use llama3.2-vision for extraction if using Ollama, as it's specifically for this task
    configured_model = api_keys.get('ollama_model', '')
    if 'vision' in configured_model.lower() or 'vl' in configured_model.lower():
        ollama_model = configured_model
    else:
        ollama_model = 'llama3.2-vision'
    
    if provider == 'gemini':
        api_key = api_keys.get('gemini_api_key')
    elif provider == 'claude':
        api_key = api_keys.get('claude_api_key')
    elif provider == 'openai':
        api_key = api_keys.get('openai_api_key')
        
    if not api_key and provider not in ['ollama', 'lmstudio', 'localai']: 
        return jsonify({'error': f'{provider.capitalize()} API key not configured. Please configure in AI Settings.'}), 400

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

    def generate():
        try:
            if (mime_type == 'application/pdf' or image_b64.startswith('JVBERi')) and mime_type != 'text/csv':
                # Handle multi-page PDF for ALL providers
                all_extracted = []
                print(f"Processing multi-page PDF for {provider}...")
                file_bytes = base64.b64decode(image_b64)
                chunks, content_type = process_pdf_content(file_bytes)
                
                num_chunks = len(chunks)
                for idx, chunk in enumerate(chunks):
                    progress = int(((idx) / num_chunks) * 100)
                    yield json.dumps({'status': 'processing', 'progress': progress, 'message': f'Analyzing page group {idx+1}/{num_chunks}...'}) + '\n'
                    
                    chunk_text_response = ""
                    if provider == 'gemini':
                        # For Gemini, if it's images, we pass as image data. If text, we pass as text.
                        image_data = base64.b64decode(chunk) if content_type == "images" else None
                        current_prompt = prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}"
                        chunk_text_response = call_gemini_with_fallback(current_prompt, api_key, image_data=image_data, mime_type="image/png" if content_type == "images" else None)
                    elif provider == 'claude':
                        if content_type == "images":
                            chunk_text_response = call_claude_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'openai':
                        if content_type == "images":
                            chunk_text_response = call_openai_with_vision(prompt, api_key, chunk, "image/png")
                    elif provider == 'ollama':
                        payload = {
                            'model': ollama_model,
                            'messages': [{
                                'role': 'user',
                                'content': prompt if content_type == "images" else f"{prompt}\n\nDocument Text (Chunk {idx+1}):\n{chunk}",
                            }],
                            'stream': False,
                            'format': 'json'
                        }
                        if content_type == "images":
                            payload['messages'][0]['images'] = [chunk]

                        response = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=600)
                        if response.status_code == 200:
                            chunk_text_response = response.json()['message']['content']
                        else:
                            print(f"Warning: Chunk {idx+1} failed: {response.text}")

                    if chunk_text_response:
                        chunk_items = resilient_parse_llm_json(chunk_text_response, 'expenses')
                        all_extracted.extend(chunk_items)
                
                yield json.dumps({'expenses': all_extracted, 'status': 'success', 'progress': 100}) + '\n'
            else:
                # Standard single-shot path for images/CSVs
                text_response = ""
                if provider == 'gemini':
                    file_bytes = base64.b64decode(image_b64)
                    text_response = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type)
                elif provider == 'claude':
                    text_response = call_claude_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'openai':
                    text_response = call_openai_with_vision(prompt, api_key, image_b64, mime_type)
                elif provider == 'ollama':
                    # Single image case
                    response = requests.post(
                        f"{ollama_url}/api/chat",
                        json={
                            'model': ollama_model,
                            'messages': [{'role': 'user', 'content': prompt, 'images': [image_b64]}],
                            'stream': False,
                            'format': 'json'
                        },
                        timeout=180
                    )
                    if response.status_code == 200:
                        text_response = response.json()['message']['content']
                    else:
                        raise Exception(f"Ollama Vision error: {response.text}")

                extracted_expenses = resilient_parse_llm_json(text_response, 'expenses')
                yield json.dumps({'expenses': extracted_expenses, 'status': 'success', 'progress': 100}) + '\n'

        except Exception as e:
            print(f"Extract expenses error: {str(e)}")
            enhanced_audit_logger.log(
                action='EXTRACT_EXPENSES_ERROR',
                details={'profile_name': profile_name, 'error': str(e)},
                status_code=500
            )
            yield json.dumps({'error': str(e)}) + '\n'
    
    return Response(generate(), mimetype='application/x-ndjson')
