"""AI services routes for image extraction and analysis."""
from flask import Blueprint, request, jsonify
from flask_login import login_required
import os
import json
import base64
from io import BytesIO
from PIL import Image
from src.services.enhanced_audit_logger import enhanced_audit_logger

ai_services_bp = Blueprint('ai_services', __name__, url_prefix='/api')


def call_gemini_with_fallback(prompt, api_key, image_data=None):
    """Calls Gemini with a prioritized list of models and fallback logic using REST API."""
    import requests

    # Use full model resource names for v1 API - latest models first
    models = [
        'models/gemini-3-flash-preview',         # Latest Gemini 3 Flash (Dec 2025) - balanced speed & intelligence
        'models/gemini-2.5-pro',                 # Gemini 2.5 Pro - best reasoning for complex analysis
        'models/gemini-2.5-flash',               # Gemini 2.5 Flash - stable production, best price-performance
        'models/gemini-2.0-flash-exp',           # Gemini 2.0 experimental (fallback)
        'models/gemini-1.5-flash-latest',        # Legacy stable 1.5 flash (fallback)
        'models/gemini-1.5-pro-latest'           # Legacy stable 1.5 pro (fallback)
    ]

    last_error = None

    for model_name in models:
        try:
            print(f"Attempting Gemini model: {model_name}")

            # Build request based on whether we have image data
            if image_data:
                # Image extraction case
                if isinstance(image_data, str):
                    image_bytes = base64.b64decode(image_data)
                else:
                    image_bytes = image_data

                # Convert image to base64 for API
                image_b64 = base64.b64encode(image_bytes).decode('utf-8')

                # Determine MIME type
                mime_type = 'image/png'
                try:
                    img = Image.open(BytesIO(image_bytes))
                    if img.format == 'JPEG':
                        mime_type = 'image/jpeg'
                    elif img.format == 'PNG':
                        mime_type = 'image/png'
                    elif img.format == 'WEBP':
                        mime_type = 'image/webp'
                except:
                    pass

                payload = {
                    'contents': [{
                        'parts': [
                            {'text': prompt},
                            {
                                'inline_data': {
                                    'mime_type': mime_type,
                                    'data': image_b64
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

            # Continue trying other models
            continue

    # If all models failed
    raise Exception(f"All Gemini models failed. Last error: {str(last_error)}")


from src.models.profile import Profile
from src.models.conversation import Conversation
from flask_login import current_user

@ai_services_bp.route('/advisor/chat', methods=['POST'])
@login_required
def advisor_chat():
    """AI advisor endpoint that provides personalized financial guidance."""
    data = request.json
    profile_name = data.get('profile_name')
    user_message = data.get('message')
    conversation_id = data.get('conversation_id')

    if not profile_name or not user_message:
        enhanced_audit_logger.log(
            action='AI_ADVISOR_VALIDATION_ERROR',
            details={'profile_name': profile_name, 'error': 'profile_name and message are required'},
            status_code=400
        )
        return jsonify({'error': 'profile_name and message are required'}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='AI_ADVISOR_PROFILE_NOT_FOUND',
                details={'profile_name': profile_name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get API key from profile
        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})
        api_key = api_keys.get('gemini_api_key')

        if not api_key:
            enhanced_audit_logger.log(
                action='AI_ADVISOR_NO_API_KEY',
                details={'profile_name': profile_name},
                status_code=400
            )
            return jsonify({
                'error': 'Gemini API key not configured. Please configure in Settings.'
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
        Real Estate: ${sum(a.get('value', 0) for a in assets.get('real_estate', [])):,}
        """

        system_prompt = f"""You are an expert financial advisor specializing in retirement planning, tax optimization, and estate planning.
        {context}

        Provide professional, clear, and actionable advice. Always include a disclaimer that you are an AI and the user should consult with a human professional for final decisions.
        """

        # Call Gemini with fallback models
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Save user message
        user_msg = Conversation(
            user_id=current_user.id,
            profile_id=profile.id,
            role='user',
            content=user_message
        )
        user_msg.save()

        # Format history for Gemini using proper Content objects
        contents = []
        try:
            for msg in history:
                role = 'user' if msg.role == 'user' else 'model'
                msg_content = msg.to_dict().get('content', '')
                if msg_content:  # Only add non-empty messages
                    contents.append(types.Content(role=role, parts=[types.Part(text=msg_content)]))
        except Exception as e:
            print(f"Warning: Error loading conversation history: {e}. Starting fresh conversation.")
            contents = []

        # Add current user message
        contents.append(types.Content(role='user', parts=[types.Part(text=user_message)]))

        # Try models with fallback for rate limits - latest models first
        models_to_try = [
            'models/gemini-3-flash-preview',         # Latest Gemini 3 Flash (Dec 2025) - balanced speed & intelligence
            'models/gemini-2.5-pro',                 # Gemini 2.5 Pro - best reasoning for complex analysis
            'models/gemini-2.5-flash',               # Gemini 2.5 Flash - stable production, best price-performance
            'models/gemini-2.0-flash-exp',           # Gemini 2.0 experimental (fallback)
            'models/gemini-1.5-flash-latest',        # Legacy stable 1.5 flash (fallback)
            'models/gemini-1.5-pro-latest'           # Legacy stable 1.5 pro (fallback)
        ]

        last_error = None
        response = None

        for model_name in models_to_try:
            try:
                print(f"Attempting Gemini model: {model_name}")
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.7
                    )
                )
                print(f"Success with model: {model_name}")
                break  # Success, exit loop
            except Exception as e:
                error_str = str(e)
                print(f"Model {model_name} failed: {error_str}")
                last_error = e

                # If it's a rate limit error, try next model immediately
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str or 'quota' in error_str.lower():
                    print(f"Rate limit hit for {model_name}, trying next model...")
                    continue
                else:
                    # For other errors, re-raise immediately
                    raise e

        if response is None:
            # All models failed
            raise Exception(f"All Gemini models failed or rate limited. Last error: {str(last_error)}")
        
        assistant_text = response.text

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
                'message_length': len(user_message),
                'response_length': len(assistant_text),
                'history_count': len(history)
            },
            status_code=200
        )
        return jsonify({
            'response': assistant_text,
            'status': 'success'
        }), 200

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
def extract_assets():
    """Extract assets from an uploaded image using AI."""
    print("Received extract-assets request")

    data = request.json
    image_b64 = data.get('image')
    provider = data.get('llm_provider', 'gemini')
    existing_assets = data.get('existing_assets', [])
    profile_name = data.get('profile_name')

    print(f"Provider: {provider}, Image data length: {len(image_b64) if image_b64 else 0}")

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
        # Decode base64 image
        image_bytes = base64.b64decode(image_b64)

        # Extraction prompt
        prompt = """
        Analyze this image of a financial statement or dashboard.
        Extract a list of investment accounts or assets.

        CRITICAL RULES - ONLY UPDATE VERIFIABLE FIELDS:
        1. Ignore "Total", "Grand Total", "Subtotal", "Margin", or "Buying Power" lines.
        2. Clean all values: remove "$", "USD", and commas. Return as numbers only.
        3. For each asset, extract ONLY the fields you can clearly see and verify:
           - "name": The specific name (e.g., "Cash & Money Market", "Vanguard 500"). REQUIRED.
           - "type": One of: "traditional_ira", "roth_ira", "401k", "403b", "457", "brokerage", "savings", "checking".
             ⚠️ ONLY include "type" if it is EXPLICITLY stated in the image (e.g., "IRA", "401k" visible in account name/label).
             If the account type is not clearly visible, set "type" to "brokerage".
           - "value": The current balance as a number. REQUIRED if visible.
           - "cost_basis": Only include if explicitly shown (rare). Otherwise set to null.
           - "institution": The financial institution name if visible (e.g., "Wells Fargo", "Vanguard").

        4. DO NOT GUESS or INFER field values. If a field is not clearly visible, use null or default.
        5. Return ONLY a JSON array of objects with the structure:
           [{"name": "...", "type": "...", "value": ..., "cost_basis": null or ..., "institution": "..."}]
        """

        if provider == 'gemini':
            text_response = call_gemini_with_fallback(prompt, api_key, image_data=image_bytes)

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
