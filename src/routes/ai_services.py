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
            img.save(buffered, format="JPEG", quality=80)
            images.append(base64.b64encode(buffered.getvalue()).decode('utf-8'))
        
        pdf_document.close()
        # For images, each image is its own chunk
        return images, "images"
    except Exception as e:
        print(f"PDF processing error: {str(e)}")
        raise Exception(f"Failed to process PDF: {str(e)}")


def resilient_parse_llm_json(text_response, list_key):
    """
    Extremely robust LLM JSON parser.
    Handles markdown, preamble text, trailing text, single objects, and common wrappers.
    """
    if not text_response or not isinstance(text_response, str):
        return []

    clean_text = text_response.strip()
    
    # 1. Try direct JSON parse first (fastest)
    try:
        data = json.loads(clean_text)
        return normalize_to_list(data, list_key)
    except json.JSONDecodeError:
        pass

    # 2. Try markdown extraction
    if "```json" in clean_text:
        try:
            markdown_content = clean_text.split("```json")[1].split("```")[0].strip()
            data = json.loads(markdown_content)
            return normalize_to_list(data, list_key)
        except:
            pass
    elif "```" in clean_text:
        try:
            markdown_content = clean_text.split("```")[1].split("```")[0].strip()
            data = json.loads(markdown_content)
            return normalize_to_list(data, list_key)
        except:
            pass

    # 3. Use regex to find the first JSON-like structure
    import re
    
    # Look for an array first [ ... ]
    array_match = re.search(r'\[\s*\{.*\}\s*\]', clean_text, re.DOTALL)
    if array_match:
        try:
            data = json.loads(array_match.group(0))
            return normalize_to_list(data, list_key)
        except:
            pass

    # Look for a single object { ... }
    obj_match = re.search(r'\{.*\}', clean_text, re.DOTALL)
    if obj_match:
        try:
            full_potential = obj_match.group(0)
            for i in range(len(full_potential), 0, -1):
                if full_potential[i-1] == '}':
                    try:
                        data = json.loads(full_potential[:i])
                        return normalize_to_list(data, list_key)
                    except:
                        continue
        except:
            pass

    # 4. Final Fallback: Regex-based field extraction (for non-JSON or badly malformed output)
    # This is useful if the LLM just lists "Name: X, Amount: Y"
    try:
        # Extract name/description - now with optional quotes
        name_match = re.search(r'"?(?:name|description|payee|institution)"?\s*[:=-]\s*"?([^"\n,]+)"?', clean_text, re.IGNORECASE)
        # Extract amount/value - now with optional quotes
        amount_match = re.search(r'"?(?:amount|value|balance|price|total)"?\s*[:=-]\s*"?([\d,.]+)"?', clean_text, re.IGNORECASE)
        
        if name_match and amount_match:
            name = name_match.group(1)
            # Clean amount (remove commas)
            amount_str = amount_match.group(1).replace(',', '')
            try:
                amount = float(amount_str)
                # Map other common fields
                type_match = re.search(r'"?(?:type|category)"?\s*:\s*"([^"]+)"', clean_text, re.IGNORECASE)
                freq_match = re.search(r'"?frequency"?\s*:\s*"([^"]+)"', clean_text, re.IGNORECASE)
                
                dummy_obj = {
                    'name': name,
                    'amount': amount,
                    'value': amount,
                    'type': type_match.group(1) if type_match else 'other',
                    'category': type_match.group(1) if type_match else 'other',
                    'frequency': freq_match.group(1) if freq_match else 'monthly'
                }
                return [dummy_obj]
            except:
                pass
    except:
        pass

    print(f"Failed to parse LLM response as JSON: {text_response[:200]}...")
    return []

def normalize_to_list(data, list_key):
    """Helper to convert various JSON shapes into a consistent list of objects."""
    if data is None:
        return []
        
    # If it's already a list, return it
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
        
    # If it's a dict, look for common list keys
    if isinstance(data, dict):
        # Check the expected key first (e.g. 'assets', 'income')
        if list_key in data and isinstance(data[list_key], list):
            return data[list_key]
        
        # Check other common keys
        for key in ['items', 'data', 'results', 'list', 'expenses', 'assets', 'income', 'transactions', 'records', 'rows', 'entries']:
            if key in data and isinstance(data[key], list):
                return data[key]
        
        # Recursive fallback: find ANY list in the dictionary
        for val in data.values():
            if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                return val
        
        # If it's a single object that matches the expected structure but not in a list, wrap it
        # Heuristic: check for common financial keys
        keys = data.keys()
        # Look for name-like keys and amount-like keys
        has_name = any(k in keys for k in ['name', 'description', 'institution', 'date', 'payee', 'memo', 'type'])
        has_value = any(k in keys for k in ['value', 'amount', 'balance', 'price', 'total'])
        
        if has_name and has_value:
            # Map 'description' or 'payee' to 'name' if name is missing
            if 'name' not in data:
                for alt in ['description', 'payee', 'institution', 'memo', 'type']:
                    if alt in data:
                        data['name'] = data[alt]
                        break
            return [data]
            
    return []



def call_gemini_with_fallback(prompt, api_key, image_data=None, mime_type=None, model=None):
    """Calls Gemini with a prioritized list of models and fallback logic using REST API."""
    # Use full model resource names for v1 API
    # Frontier models for 2026
    models = [
        'gemini-3-flash-preview', 
        'gemini-3-pro-preview',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
    ]

    # If specific model requested, try it first
    if model:
        if model in models:
            models.remove(model)
        models.insert(0, model)

    last_error = None

    for model_name in models:
        try:
            # DESTROY 404s: Ensure model name is formatted correctly for v1beta
            # Must be 'models/model-id'
            model_id = model_name.replace('models/', '')
            full_model_path = f"models/{model_id}"
            
            print(f"Attempting Gemini model: {full_model_path}")

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

                # For text files (CSV, TXT, etc.), include content in the prompt
                if mime_type in ['text/csv', 'text/plain']:
                    text_content = file_bytes.decode('utf-8', errors='replace')
                    enhanced_prompt = f"{prompt}\n\nDocument Data:\n```\n{text_content}\n```"
                    payload = {
                        'contents': [{
                            'parts': [{'text': enhanced_prompt}]
                        }],
                        'generationConfig': {
                            'response_mime_type': 'application/json'
                        }
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
                        }],
                        'generationConfig': {
                            'response_mime_type': 'application/json'
                        }
                    }
            else:
                # Text-only case
                payload = {
                    'contents': [{
                        'parts': [{'text': prompt}]
                    }],
                    'generationConfig': {
                        'response_mime_type': 'application/json'
                    }
                }

            # Use v1beta for all calls - it's more robust and required for PDF/Document support
            api_version = 'v1beta'

            # Call Gemini REST API
            url = f'https://generativelanguage.googleapis.com/{api_version}/{full_model_path}:generateContent?key={api_key}'

            # Log request details
            print(f"  Gemini API Request:")
            print(f"    URL: {url[:80]}...")
            print(f"    Payload has generationConfig: {'generationConfig' in payload}")
            if 'contents' in payload and payload['contents']:
                parts = payload['contents'][0].get('parts', [])
                print(f"    Parts count: {len(parts)}")
                for i, part in enumerate(parts):
                    if 'text' in part:
                        print(f"    Part {i}: text ({len(part['text'])} chars)")
                    elif 'inline_data' in part:
                        print(f"    Part {i}: inline_data (mime={part['inline_data'].get('mime_type')})")

            response = requests.post(url, json=payload, timeout=60)

            print(f"  Gemini API Response: status={response.status_code}")

            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and len(result['candidates']) > 0:
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    print(f"  Success with model: {model_name}, response length: {len(text)}")
                    return text
                else:
                    print(f"  No candidates in response: {json.dumps(result)[:500]}")
                    raise Exception(f"No candidates in response: {result}")
            else:
                error_text = response.text[:500] if response.text else 'No response body'
                print(f"  Gemini API Error: {response.status_code} - {error_text}")
                error_detail = response.json() if response.text else {'error': response.text}
                raise Exception(f"{response.status_code} {error_detail}")

        except Exception as e:
            last_error = e
            error_str = str(e)
            print(f"Model {model_name} failed: {error_str}")

            # Check for quota errors - try other models if quota exceeded on this specific one
            if '429' in error_str or 'quota' in error_str.lower() or 'RESOURCE_EXHAUSTED' in error_str:
                # Often flash is rate limited but pro isn't, or vice-versa
                continue

            # Continue trying other models
            continue

    # If all models failed
    last_error_str = str(last_error)
    if '429' in last_error_str or 'quota' in last_error_str.lower():
        raise Exception("Gemini API quota exceeded. Please wait a few minutes or upgrade your API plan.")
    raise Exception(f"All Gemini models failed. Last error: {last_error_str}")


def call_claude_with_vision(prompt, api_key, image_b64, mime_type, model=None):
    """Calls Anthropic Claude with vision support."""
    url = 'https://api.anthropic.com/v1/messages'
    headers = {
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
    }
    
    # Use requested model or default
    model_name = model if model else 'claude-sonnet-4-5-20250929'

    # Handle CSV case: Include as text in the prompt instead of an image
    if mime_type == 'text/csv':
        try:
            csv_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
            payload = {
                'model': model_name,
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
            'model': model_name,
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


def call_openai_with_vision(prompt, api_key, image_b64, mime_type, model=None):
    """Calls OpenAI GPT-4o with vision support."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Use requested model or default
    model_name = model if model else 'gpt-5.2-instant'

    # Handle CSV case: Include as text in the prompt instead of an image URL
    if mime_type == 'text/csv':
        try:
            csv_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
            payload = {
                "model": model_name,
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
            "model": model_name,
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

def call_llm(provider, prompt, api_key, history=None, system_prompt=None, lmstudio_url=None, localai_url=None, ollama_url=None, model=None):
    """Unified interface to call various LLM providers."""
    if provider == 'gemini':
        return call_gemini(prompt, api_key, history, system_prompt, model=model)
    elif provider == 'claude':
        return call_claude(prompt, api_key, history, system_prompt, model=model)
    elif provider == 'lmstudio':
        return call_lmstudio(prompt, lmstudio_url, history, system_prompt)
    elif provider == 'localai':
        return call_localai(prompt, localai_url, history, system_prompt)
    elif provider == 'ollama':
        return call_ollama(prompt, ollama_url, history, system_prompt, model=model)
    else:
        # OpenAI-compatible providers
        return call_openai_compatible(provider, prompt, api_key, history, system_prompt, model=model)


def call_gemini(prompt, api_key, history=None, system_prompt=None, model=None):
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
        'models/gemini-3-flash-preview', 
        'models/gemini-3-pro-preview', 
        'models/gemini-2.0-flash'
    ]

    # If specific model requested, try it first
    if model:
        if not model.startswith('models/'):
            model = f'models/{model}'
        if model in models_to_try:
            models_to_try.remove(model)
        models_to_try.insert(0, model)

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                    response_mime_type="application/json"
                )
            )
            return response.text
        except Exception as e:
            if '429' in str(e) or 'quota' in str(e).lower():
                continue
            raise e
    raise Exception("All Gemini models failed or rate limited.")


def call_claude(prompt, api_key, history=None, system_prompt=None, model=None):
    """Calls Anthropic Claude API."""
    messages = []
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    models = [
        'claude-opus-4-5-20251101',
        'claude-sonnet-4-5-20250929',
        'claude-sonnet-4-20250514',
        'claude-3-5-sonnet-20241022'
    ]
    
    if model:
        if model in models:
            models.remove(model)
        models.insert(0, model)

    for model in models:
        try:
            payload = {
                'model': model,
                'max_tokens': 4096,
                'messages': messages
            }
            # Only include system if provided (Anthropic API rejects null)
            if system_prompt:
                payload['system'] = system_prompt

            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                json=payload,
                timeout=60
            )
            if response.status_code == 200:
                return response.json()['content'][0]['text']
            else:
                print(f"Claude API error for {model}: {response.status_code} {response.text[:200]}")
        except Exception as e:
            print(f"Claude API exception for {model}: {str(e)}")
            continue
    raise Exception("Claude API call failed.")


def call_openai_compatible(provider, prompt, api_key, history=None, system_prompt=None, model=None):
    """Calls OpenAI-compatible APIs (OpenAI, DeepSeek, OpenRouter, etc.)."""
    endpoints = {
        'openai': ('https://api.openai.com/v1/chat/completions', 'gpt-5.2'),
        'deepseek': ('https://api.deepseek.com/chat/completions', 'deepseek-chat'), # Maps to V4
        'openrouter': ('https://openrouter.ai/api/v1/chat/completions', 'google/gemini-3-flash-preview'),
        'grok': ('https://api.x.ai/v1/chat/completions', 'grok-5'),
        'mistral': ('https://api.mistral.ai/v1/chat/completions', 'mistral-large-25.12'),
        'together': ('https://api.together.xyz/v1/chat/completions', 'meta-llama/Llama-4-70b-instruct'),
        'huggingface': ('https://api-inference.huggingface.co/v1/chat/completions', 'meta-llama/Llama-4-70b-chat'),
        'zhipu': ('https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-5-flash')
    }
    
    url, default_model = endpoints.get(provider, (None, None))
    if not url:
        raise Exception(f"Unsupported provider: {provider}")

    # Use requested model if provided
    active_model = model if model else default_model

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
                'model': active_model,
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


def call_ollama(prompt, url, history=None, system_prompt=None, model=None):
    """Calls local Ollama API."""
    if not url:
        url = "http://localhost:11434"

    # Default to a good general-purpose model
    model_name = model or "llama3.2"

    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    if history:
        for msg in history:
            messages.append({'role': msg.role, 'content': msg.content})
    messages.append({'role': 'user', 'content': prompt})

    try:
        # Use Ollama's OpenAI-compatible endpoint
        response = requests.post(
            f"{url}/v1/chat/completions",
            json={
                'model': model_name,
                'messages': messages,
                'temperature': 0.7,
                'stream': False
            },
            timeout=180  # Local models can be slow
        )
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content']
        else:
            raise Exception(f"Ollama error: {response.status_code} {response.text}")
    except requests.exceptions.ConnectionError:
        raise Exception(f"Cannot connect to Ollama at {url}. Is Ollama running? Try: ollama serve")
    except Exception as e:
        raise Exception(f"Failed to connect to Ollama at {url}: {str(e)}")


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
            for p in ['gemini', 'claude', 'openai', 'grok', 'openrouter', 'deepseek', 'mistral', 'together', 'huggingface', 'zhipu', 'lmstudio', 'localai', 'ollama']:
                key_name = f"{p}_api_key" if p not in ['lmstudio', 'localai', 'ollama'] else f"{p}_url"
                if api_keys.get(key_name):
                    provider = p
                    break
        
        if not provider:
            provider = 'gemini' # Fallback to gemini

        # Get the appropriate key/url
        api_key = api_keys.get(f"{provider}_api_key")
        lmstudio_url = sanitize_url(api_keys.get("lmstudio_url"), "http://localhost:1234")
        localai_url = sanitize_url(api_keys.get("localai_url"), "http://localhost:8080")
        ollama_url = sanitize_url(api_keys.get("ollama_url"), "http://localhost:11434")

        if not api_key and provider not in ['lmstudio', 'localai', 'ollama']:
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
        assistant_text = call_llm(provider, user_message, api_key, history, system_prompt, lmstudio_url, localai_url, model=data.get('llm_model'))

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


EXTRACT_CONFIGS = {
    'assets': {
        'list_key': 'assets',
        'prompt': """
            TASK: Extract all investment accounts, bank accounts, or assets from this document.
            FORMAT: You must return a JSON array of objects.
            FIELDS PER OBJECT:
            - "name": Account or institution name
            - "type": One of [traditional_ira, roth_ira, 401k, 403b, 457, brokerage, savings, checking]
            - "value": The current balance or value as a number
            - "institution": The bank or company name
            
            EXAMPLE OUTPUT:
            [{"name": "Savings", "type": "savings", "value": 5000, "institution": "Chase"}]
            
            CRITICAL: Return ONLY the JSON array. Do not include any other text.
            """,
        'log_action': 'EXTRACT_ASSETS'
    },
    'income': {
        'list_key': 'income',
        'prompt': """
            TASK: Extract all regular income streams from this document.
            FORMAT: You must return a JSON array of objects.
            FIELDS PER OBJECT:
            - "name": Descriptive name of the income
            - "amount": The per-period dollar amount as a number
            - "frequency": One of [weekly, bi-weekly, semi-monthly, monthly, quarterly, annual]
            
            EXAMPLE OUTPUT:
            [{"name": "Salary", "amount": 3000, "frequency": "monthly"}]
            
            CRITICAL: Return ONLY the JSON array. Do not include any other text.
            """,
        'log_action': 'EXTRACT_INCOME'
    },
    'expenses': {
        'list_key': 'expenses',
        'prompt': """
            TASK: Extract all recurring or significant expenses from this document.
            FORMAT: You must return a JSON array of objects.
            FIELDS PER OBJECT:
            - "name": Descriptive name of the expense
            - "amount": The dollar amount as a number
            - "frequency": One of [weekly, bi-weekly, monthly, quarterly, semi-annual, annual]
            - "category": One of [housing, utilities, transportation, food, dining_out, healthcare, insurance, travel, entertainment, personal_care, clothing, gifts, childcare_education, charitable_giving, subscriptions, pet_care, home_maintenance, debt_payments, taxes, discretionary, other]
            
            EXAMPLE OUTPUT:
            [{"name": "Rent", "amount": 1500, "frequency": "monthly", "category": "housing"}]
            
            CRITICAL: Return ONLY the JSON array. Do not include any other text.
            """,
        'log_action': 'EXTRACT_EXPENSES'
    }
}

@ai_services_bp.route('/extract-items/<item_type>', methods=['POST'])
@login_required
@limiter.limit("50 per hour")
def extract_items(item_type):
    """Unified AI extraction endpoint for any item type."""
    if item_type not in EXTRACT_CONFIGS:
        return jsonify({'error': f'Invalid item type: {item_type}'}), 400

    config = EXTRACT_CONFIGS[item_type]
    data = request.json
    image_b64 = data.get('image')
    mime_type = data.get('mime_type')
    file_name = data.get('file_name', '')
    requested_provider = data.get('llm_provider')
    requested_model = data.get('llm_model')
    profile_name = data.get('profile_name')

    # Detect TXT/CSV
    if not mime_type:
        if file_name.lower().endswith('.csv'): mime_type = 'text/csv'
        elif file_name.lower().endswith('.txt'): mime_type = 'text/plain'
        elif file_name.lower().endswith('.pdf'): mime_type = 'application/pdf'

    if not image_b64 or not profile_name:
        return jsonify({'error': 'image and profile_name are required'}), 400

    try:
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile: return jsonify({'error': 'Profile not found'}), 404
        
        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})
        provider = requested_provider or data_dict.get('preferred_ai_provider') or 'gemini'
        
        # Get the appropriate key/url
        api_key = api_keys.get(f"{provider}_api_key")
        lmstudio_url = sanitize_url(api_keys.get("lmstudio_url"), "http://localhost:1234")
        localai_url = sanitize_url(api_keys.get("localai_url"), "http://localhost:8080")
        ollama_url = sanitize_url(api_keys.get("ollama_url"), "http://localhost:11434")

        if not api_key and provider not in ['lmstudio', 'localai', 'ollama']:
            return jsonify({'error': f'{provider.capitalize()} API key not configured.'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    prompt = config['prompt']

    # Log extraction request details
    print(f"=== EXTRACTION REQUEST ===")
    print(f"  Item type: {item_type}")
    print(f"  Provider: {provider}")
    print(f"  Model: {requested_model}")
    print(f"  MIME type: {mime_type}")
    print(f"  File name: {file_name}")
    print(f"  Data length: {len(image_b64) if image_b64 else 0} chars")
    print(f"  API key present: {bool(api_key)}")

    def generate():
        try:
            # Multi-page PDF Path
            if mime_type == 'application/pdf' or image_b64.startswith('JVBERi'):
                all_extracted = []
                file_bytes = base64.b64decode(image_b64)
                chunks, content_type = process_pdf_content(file_bytes)
                
                num_chunks = len(chunks)
                for idx, chunk in enumerate(chunks):
                    yield json.dumps({'status': 'processing', 'progress': int((idx / num_chunks) * 100), 'message': f'Analyzing page {idx+1}/{num_chunks}...'}) + '\n'
                    
                    response_text = ""
                    if provider == 'gemini':
                        img_data = base64.b64decode(chunk) if content_type == "images" else None
                        p = prompt if content_type == "images" else f"{prompt}\n\nTEXT:\n{chunk}"
                        response_text = call_gemini_with_fallback(p, api_key, image_data=img_data, mime_type="image/png" if content_type == "images" else None, model=requested_model)
                    elif provider in ['claude', 'openai']:
                        fn = call_claude_with_vision if provider == 'claude' else call_openai_with_vision
                        if content_type == "images":
                            response_text = fn(prompt, api_key, chunk, "image/png", model=requested_model)
                        else:
                            # Handle text chunk via unified caller if it's text
                            response_text = call_llm(provider, f"{prompt}\n\nTEXT:\n{chunk}", api_key, model=requested_model, lmstudio_url=lmstudio_url, localai_url=localai_url, ollama_url=ollama_url)
                    else:
                        # Other providers (deepseek, grok, mistral, etc.) - text extraction only
                        if content_type == "text":
                            response_text = call_llm(provider, f"{prompt}\n\nTEXT:\n{chunk}", api_key, model=requested_model, lmstudio_url=lmstudio_url, localai_url=localai_url, ollama_url=ollama_url)
                        else:
                            # Skip image chunks for non-vision providers, continue with warning
                            print(f"WARNING: Provider '{provider}' cannot process image chunks from scanned PDF")
                            continue

                    if response_text:
                        print(f"DEBUG: Response from {provider}: {response_text[:500]}")
                        chunk_items = resilient_parse_llm_json(response_text, config['list_key'])
                        all_extracted.extend(chunk_items)
                
                yield json.dumps({config['list_key']: all_extracted, 'status': 'complete'}) + '\n'
            
            # Single File Path (Images, CSV, TXT)
            else:
                response_text = ""
                is_text_file = mime_type in ['text/csv', 'text/plain']
                print(f"  Processing single file: is_text_file={is_text_file}, mime_type={mime_type}")

                if provider == 'gemini':
                    print(f"  Calling Gemini with file data...")
                    file_bytes = base64.b64decode(image_b64)
                    print(f"  Decoded file: {len(file_bytes)} bytes")
                    response_text = call_gemini_with_fallback(prompt, api_key, image_data=file_bytes, mime_type=mime_type, model=requested_model)
                elif provider in ['claude', 'openai']:
                    if is_text_file:
                        text_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
                        print(f"  Calling {provider} with text content ({len(text_content)} chars)...")
                        response_text = call_llm(provider, f"{prompt}\n\nDATA:\n{text_content}", api_key, model=requested_model, lmstudio_url=lmstudio_url, localai_url=localai_url, ollama_url=ollama_url)
                    else:
                        fn = call_claude_with_vision if provider == 'claude' else call_openai_with_vision
                        print(f"  Calling {provider} with vision...")
                        response_text = fn(prompt, api_key, image_b64, mime_type, model=requested_model)
                elif provider in ['lmstudio', 'localai', 'ollama']:
                    text_content = ""
                    if is_text_file:
                        text_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
                    else:
                        text_content = "[Image provided - vision not supported via local AI yet. Use Gemini/Claude/OpenAI for images.]"
                    print(f"  Calling {provider} with text content ({len(text_content)} chars)...")
                    response_text = call_llm(provider, f"{prompt}\n\nDATA:\n{text_content}", api_key, model=requested_model, lmstudio_url=lmstudio_url, localai_url=localai_url, ollama_url=ollama_url)
                else:
                    if is_text_file:
                        text_content = base64.b64decode(image_b64).decode('utf-8', errors='replace')
                        print(f"  Calling {provider} with text content ({len(text_content)} chars)...")
                        response_text = call_llm(provider, f"{prompt}\n\nDATA:\n{text_content}", api_key, model=requested_model, lmstudio_url=lmstudio_url, localai_url=localai_url, ollama_url=ollama_url)
                    else:
                        raise Exception(f"Provider '{provider}' does not support image extraction. Use Gemini, Claude, or OpenAI for images.")

                # Log response details
                print(f"=== LLM RESPONSE ===")
                print(f"  Response received: {bool(response_text)}")
                print(f"  Response length: {len(response_text) if response_text else 0}")
                if response_text:
                    print(f"  Response preview: {response_text[:500]}")
                else:
                    print(f"  WARNING: Empty response from {provider}!")

                items = resilient_parse_llm_json(response_text, config['list_key'])
                print(f"=== PARSE RESULT ===")
                print(f"  Items extracted: {len(items)}")
                if items:
                    print(f"  First item: {items[0]}")

                yield json.dumps({config['list_key']: items, 'status': 'complete'}) + '\n'

        except Exception as e:
            enhanced_audit_logger.log(action=f"{config['log_action']}_ERROR", details={'error': str(e)}, status_code=500)
            yield json.dumps({'error': str(e)}) + '\n'

    return Response(generate(), mimetype='application/x-ndjson')
