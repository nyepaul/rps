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


@ai_services_bp.route('/extract-assets', methods=['POST'])
@login_required
def extract_assets():
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
