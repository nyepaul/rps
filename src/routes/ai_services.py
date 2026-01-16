"""AI services routes for image extraction and analysis."""
from flask import Blueprint, request, jsonify
from flask_login import login_required
import os
import json
import base64
from io import BytesIO
from PIL import Image

ai_services_bp = Blueprint('ai_services', __name__, url_prefix='/api')


def call_gemini_with_fallback(prompt, api_key, image_data=None):
    """Calls Gemini with a prioritized list of models and fallback logic."""
    from google import genai

    models = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ]

    last_error = None
    client = genai.Client(api_key=api_key)

    for model_name in models:
        try:
            print(f"Attempting Gemini model: {model_name}")
            if image_data:
                # Image extraction case
                if isinstance(image_data, str):
                    image_bytes = base64.b64decode(image_data)
                else:
                    image_bytes = image_data

                # Create image for Gemini
                image = Image.open(BytesIO(image_bytes))
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, image]
                )
            else:
                # Text generation case
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )

            return response.text
        except Exception as e:
            last_error = e
            print(f"Model {model_name} failed: {str(e)}")
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
        return jsonify({'error': 'profile_name and message are required'}), 400

    # Get API key
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({
            'error': 'Missing GEMINI_API_KEY environment variable. Please run ./bin/setup-api-keys'
        }), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

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

        # Format history for Gemini
        gemini_history = []
        for msg in history:
            role = 'user' if msg.role == 'user' else 'model'
            gemini_history.append({'role': role, 'parts': [msg.to_dict()['content']]})

        # Call Gemini
        from google import genai
        client = genai.Client(api_key=api_key)
        
        # Save user message
        user_msg = Conversation(
            user_id=current_user.id,
            profile_id=profile.id,
            role='user',
            content=user_message
        )
        user_msg.save()

        # Generate response
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp',
            contents=gemini_history + [{'role': 'user', 'parts': [user_message]}],
            config={'system_instruction': system_prompt}
        )
        
        assistant_text = response.text

        # Save assistant message
        assistant_msg = Conversation(
            user_id=current_user.id,
            profile_id=profile.id,
            role='assistant',
            content=assistant_text
        )
        assistant_msg.save()

        return jsonify({
            'response': assistant_text,
            'status': 'success'
        }), 200

    except Exception as e:
        print(f"Advisor chat error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@ai_services_bp.route('/advisor/history', methods=['GET'])
@login_required
def get_advisor_history():
    """Get conversation history for a profile."""
    profile_name = request.args.get('profile_name')
    if not profile_name:
        return jsonify({'error': 'profile_name is required'}), 400

    profile = Profile.get_by_name(profile_name, current_user.id)
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404

    history = Conversation.list_by_profile(current_user.id, profile.id)
    return jsonify({
        'history': [msg.to_dict() for msg in history]
    }), 200


@ai_services_bp.route('/advisor/conversation/<int:profile_id>', methods=['DELETE'])
@login_required
def clear_advisor_history(profile_id: int):
    """Clear conversation history for a profile."""
    Conversation.delete_by_profile(current_user.id, profile_id)
    return jsonify({'message': 'History cleared'}), 200

    """Extract assets from an uploaded image using AI."""
    print("Received extract-assets request")

    data = request.json
    image_b64 = data.get('image')
    provider = data.get('llm_provider', 'gemini')
    existing_assets = data.get('existing_assets', [])

    print(f"Provider: {provider}, Image data length: {len(image_b64) if image_b64 else 0}")

    # Get API key from environment
    if provider == 'gemini':
        api_key = os.environ.get('GEMINI_API_KEY')
    else:
        api_key = os.environ.get('ANTHROPIC_API_KEY')

    if not api_key:
        return jsonify({
            'error': f'Missing {provider.upper()}_API_KEY environment variable. Please run ./bin/setup-api-keys'
        }), 400

    if not image_b64:
        return jsonify({'error': 'No image data provided'}), 400

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

                return jsonify({
                    'assets': merged_assets,
                    'status': 'success'
                }), 200

            except json.JSONDecodeError as e:
                return jsonify({
                    'error': f'Failed to parse AI response as JSON: {str(e)}',
                    'raw_response': text_response[:500]
                }), 500
        else:
            # Claude support (future)
            return jsonify({
                'error': 'Only Gemini is currently supported for image extraction. Set GEMINI_API_KEY.'
            }), 400

    except Exception as e:
        print(f"Extract assets error: {str(e)}")
        return jsonify({'error': str(e)}), 500
