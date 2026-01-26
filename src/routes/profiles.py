"""Profile routes with authentication and ownership checks."""
from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from src.models.profile import Profile
from src.services.asset_service import assets_to_csv, csv_to_assets, merge_assets, sync_legacy_arrays
from src.services.encryption_service import get_encryption_service
from src.services.enhanced_audit_logger import enhanced_audit_logger

profiles_bp = Blueprint('profiles', __name__, url_prefix='/api')


class ProfileCreateSchema(BaseModel):
    """Schema for creating a profile."""
    name: str
    birth_date: Optional[str] = None
    retirement_date: Optional[str] = None
    data: Optional[dict] = None

    @validator('name')
    def validate_name(cls, v):
        import re
        if not v or not v.strip():
            raise ValueError('Profile name is required')
        if len(v) > 100:
            raise ValueError('Profile name must be less than 100 characters')
        # Prevent path traversal attacks - reject any path separators or traversal sequences
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError('Profile name cannot contain path traversal characters')
        # Additional security: only allow alphanumeric, spaces, hyphens, underscores, and basic punctuation
        if not re.match(r'^[a-zA-Z0-9 _\-\(\)\.]+$', v):
            raise ValueError('Profile name contains invalid characters')
        return v.strip()

    @validator('birth_date', 'retirement_date')
    def validate_date(cls, v):
        if v:
            try:
                datetime.fromisoformat(v)
            except ValueError:
                raise ValueError('Invalid date format. Use ISO format (YYYY-MM-DD)')
        return v


class ProfileUpdateSchema(BaseModel):
    """Schema for updating a profile."""
    name: Optional[str] = None
    birth_date: Optional[str] = None
    retirement_date: Optional[str] = None
    data: Optional[dict] = None

    @validator('name')
    def validate_name(cls, v):
        import re
        if v is not None:
            if not v.strip():
                raise ValueError('Profile name cannot be empty')
            if len(v) > 100:
                raise ValueError('Profile name must be less than 100 characters')
            # Prevent path traversal attacks - reject any path separators or traversal sequences
            if '..' in v or '/' in v or '\\' in v:
                raise ValueError('Profile name cannot contain path traversal characters')
            # Additional security: only allow alphanumeric, spaces, hyphens, underscores, and basic punctuation
            if not re.match(r'^[a-zA-Z0-9 _\-\(\)\.]+$', v):
                raise ValueError('Profile name contains invalid characters')
            return v.strip()
        return v

    @validator('birth_date', 'retirement_date')
    def validate_date(cls, v):
        if v:
            try:
                datetime.fromisoformat(v)
            except ValueError:
                raise ValueError('Invalid date format. Use ISO format (YYYY-MM-DD)')
        return v


@profiles_bp.route('/profiles', methods=['GET'])
@login_required
def list_profiles():
    """List all profiles for the current user."""
    try:
        profiles = Profile.list_by_user(current_user.id)
        enhanced_audit_logger.log(
            action='LIST_PROFILES',
            details={'profile_count': len(profiles)},
            status_code=200
        )
        return jsonify({'profiles': profiles}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action='LIST_PROFILES_ERROR',
            details={'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['GET'])
@login_required
def get_profile(name: str):
    """Get a specific profile by name (with ownership check)."""
    try:
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='VIEW_PROFILE_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        enhanced_audit_logger.log(
            action='VIEW_PROFILE',
            table_name='profile',
            record_id=profile.id,
            details={'profile_name': name},
            status_code=200
        )
        return jsonify({'profile': profile.to_dict()}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action='VIEW_PROFILE_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profiles', methods=['POST'])
@login_required
def create_profile():
    """Create a new profile for the current user."""
    try:
        data = ProfileCreateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action='CREATE_PROFILE_VALIDATION_ERROR',
            details={'error': str(e)},
            status_code=400
        )
        return jsonify({'error': str(e)}), 400

    try:
        # Check if profile with same name already exists for this user
        existing = Profile.get_by_name(data.name, current_user.id)
        if existing:
            enhanced_audit_logger.log(
                action='CREATE_PROFILE_DUPLICATE',
                details={'profile_name': data.name},
                status_code=409
            )
            return jsonify({'error': 'Profile with this name already exists'}), 409

        # Create new profile
        profile = Profile(
            user_id=current_user.id,
            name=data.name,
            birth_date=data.birth_date,
            retirement_date=data.retirement_date,
            data=data.data
        )
        profile.save()

        enhanced_audit_logger.log(
            action='CREATE_PROFILE',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': data.name,
                'birth_date': data.birth_date,
                'retirement_date': data.retirement_date
            },
            status_code=201
        )
        return jsonify({
            'message': 'Profile created successfully',
            'profile': profile.to_dict()
        }), 201
    except Exception as e:
        enhanced_audit_logger.log(
            action='CREATE_PROFILE_ERROR',
            details={'profile_name': data.name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['PUT'])
@login_required
def update_profile(name: str):
    """Update a profile (with ownership check)."""
    try:
        data = ProfileUpdateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action='UPDATE_PROFILE_VALIDATION_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=400
        )
        return jsonify({'error': str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='UPDATE_PROFILE_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Track what fields are being updated
        updated_fields = []

        # Update fields if provided
        if data.name is not None:
            # Check if new name conflicts with another profile
            if data.name != profile.name:
                existing = Profile.get_by_name(data.name, current_user.id)
                if existing:
                    enhanced_audit_logger.log(
                        action='UPDATE_PROFILE_NAME_CONFLICT',
                        details={'profile_name': name, 'new_name': data.name},
                        status_code=409
                    )
                    return jsonify({'error': 'Profile with this name already exists'}), 409
                updated_fields.append('name')
            profile.name = data.name

        if data.birth_date is not None:
            updated_fields.append('birth_date')
            profile.birth_date = data.birth_date

        if data.retirement_date is not None:
            updated_fields.append('retirement_date')
            profile.retirement_date = data.retirement_date

        if data.data is not None:
            updated_fields.append('data')
            profile.data = data.data

        profile.save()

        enhanced_audit_logger.log(
            action='UPDATE_PROFILE',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': name,
                'updated_fields': updated_fields
            },
            status_code=200
        )
        return jsonify({
            'message': 'Profile updated successfully',
            'profile': profile.to_dict()
        }), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action='UPDATE_PROFILE_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['DELETE'])
@login_required
def delete_profile(name: str):
    """Delete a profile (with ownership check)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='DELETE_PROFILE_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        profile_id = profile.id
        profile.delete()

        enhanced_audit_logger.log(
            action='DELETE_PROFILE',
            table_name='profile',
            record_id=profile_id,
            details={'profile_name': name},
            status_code=200
        )
        return jsonify({'message': 'Profile deleted successfully'}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action='DELETE_PROFILE_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>/clone', methods=['POST'])
@login_required
def clone_profile(name: str):
    """Clone an existing profile (with ownership check)."""
    try:
        # Get source profile with ownership check
        source_profile = Profile.get_by_name(name, current_user.id)
        if not source_profile:
            enhanced_audit_logger.log(
                action='CLONE_PROFILE_NOT_FOUND',
                details={'source_profile': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get new profile name from request body
        new_name = request.json.get('new_name', f"{name} (Copy)")

        # Validate new name
        if not new_name or not new_name.strip():
            enhanced_audit_logger.log(
                action='CLONE_PROFILE_VALIDATION_ERROR',
                details={'source_profile': name, 'error': 'New profile name is required'},
                status_code=400
            )
            return jsonify({'error': 'New profile name is required'}), 400

        new_name = new_name.strip()
        if len(new_name) > 100:
            enhanced_audit_logger.log(
                action='CLONE_PROFILE_VALIDATION_ERROR',
                details={'source_profile': name, 'error': 'Name too long'},
                status_code=400
            )
            return jsonify({'error': 'Profile name must be less than 100 characters'}), 400

        # Check if profile with new name already exists
        existing = Profile.get_by_name(new_name, current_user.id)
        if existing:
            enhanced_audit_logger.log(
                action='CLONE_PROFILE_DUPLICATE',
                details={'source_profile': name, 'new_name': new_name},
                status_code=409
            )
            return jsonify({'error': 'Profile with this name already exists'}), 409

        # Clone the profile data
        cloned_data = source_profile.data_dict.copy() if source_profile.data_dict else {}

        # Create new profile with cloned data
        cloned_profile = Profile(
            user_id=current_user.id,
            name=new_name,
            birth_date=source_profile.birth_date,
            retirement_date=source_profile.retirement_date,
            data=cloned_data
        )
        cloned_profile.save()

        enhanced_audit_logger.log(
            action='CLONE_PROFILE',
            table_name='profile',
            record_id=cloned_profile.id,
            details={
                'source_profile': name,
                'source_profile_id': source_profile.id,
                'new_profile_name': new_name
            },
            status_code=201
        )
        return jsonify({
            'message': f'Profile cloned successfully as "{new_name}"',
            'profile': cloned_profile.to_dict()
        }), 201
    except Exception as e:
        enhanced_audit_logger.log(
            action='CLONE_PROFILE_ERROR',
            details={'source_profile': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>/assets/export', methods=['GET'])
@login_required
def export_assets_csv(name: str):
    """Export all assets as CSV file."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='EXPORT_ASSETS_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get assets from profile data
        data_dict = profile.data_dict
        assets = data_dict.get('assets', {
            'retirement_accounts': [],
            'taxable_accounts': [],
            'real_estate': [],
            'pensions_annuities': [],
            'other_assets': []
        })

        # Count assets for logging
        asset_count = sum(len(v) for v in assets.values() if isinstance(v, list))

        # Convert to CSV
        csv_content = assets_to_csv(assets)

        # Create response with CSV content
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{name.replace(' ', '_')}_assets_{timestamp}.csv"

        enhanced_audit_logger.log(
            action='EXPORT_ASSETS_CSV',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': name,
                'asset_count': asset_count,
                'filename': filename
            },
            status_code=200
        )
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={filename}'
            }
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action='EXPORT_ASSETS_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>/assets/import', methods=['POST'])
@login_required
def import_assets_csv(name: str):
    """Import assets from CSV file (appends to existing assets)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='IMPORT_ASSETS_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Check if file was uploaded
        if 'file' not in request.files:
            enhanced_audit_logger.log(
                action='IMPORT_ASSETS_NO_FILE',
                details={'profile_name': name},
                status_code=400
            )
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            enhanced_audit_logger.log(
                action='IMPORT_ASSETS_NO_FILE',
                details={'profile_name': name},
                status_code=400
            )
            return jsonify({'error': 'No file selected'}), 400

        # Read and parse CSV
        csv_content = file.read().decode('utf-8')

        try:
            new_assets = csv_to_assets(csv_content)
        except ValueError as e:
            enhanced_audit_logger.log(
                action='IMPORT_ASSETS_INVALID_CSV',
                details={'profile_name': name, 'filename': file.filename, 'error': str(e)},
                status_code=400
            )
            return jsonify({'error': f'Invalid CSV format: {str(e)}'}), 400

        # Get current profile data
        data_dict = profile.data_dict

        # Merge new assets with existing ones
        existing_assets = data_dict.get('assets', {
            'retirement_accounts': [],
            'taxable_accounts': [],
            'real_estate': [],
            'pensions_annuities': [],
            'other_assets': []
        })

        merged_assets = merge_assets(existing_assets, new_assets)

        # Update profile data
        data_dict['assets'] = merged_assets

        # Sync legacy arrays for backward compatibility
        data_dict = sync_legacy_arrays(data_dict)

        # Save profile
        profile.data = data_dict
        profile.save()

        # Count imported assets
        imported_count = sum(len(v) for v in new_assets.values())

        enhanced_audit_logger.log(
            action='IMPORT_ASSETS_CSV',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': name,
                'filename': file.filename,
                'imported_count': imported_count
            },
            status_code=200
        )
        return jsonify({
            'message': f'Successfully imported {imported_count} assets',
            'assets': merged_assets,
            'profile': profile.to_dict()
        }), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action='IMPORT_ASSETS_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


class APIKeySchema(BaseModel):
    """Schema for API key management."""
    claude_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    mistral_api_key: Optional[str] = None
    together_api_key: Optional[str] = None
    huggingface_api_key: Optional[str] = None
    ollama_url: Optional[str] = None
    ollama_model: Optional[str] = None
    lmstudio_url: Optional[str] = None
    localai_url: Optional[str] = None
    preferred_ai_provider: Optional[str] = None

    @validator('claude_api_key', 'gemini_api_key', 'openai_api_key', 'grok_api_key', 
               'openrouter_api_key', 'deepseek_api_key', 'mistral_api_key', 
               'together_api_key', 'huggingface_api_key')
    def validate_api_key(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) < 8:  # Some keys might be short
                raise ValueError('API key must be at least 8 characters')
            if len(v) > 500:
                raise ValueError('API key is too long')
        return v

    @validator('ollama_url', 'lmstudio_url', 'localai_url')
    def validate_local_urls(cls, v):
        if v is not None:
            v = v.strip()
            if not v.startswith(('http://', 'https://')):
                raise ValueError('URL must start with http:// or https://')
        return v


@profiles_bp.route('/profiles/<name>/api-keys', methods=['GET'])
@login_required
def get_api_keys(name: str):
    """Get API keys for a profile (returns masked versions for display)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='VIEW_API_KEYS_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get profile data
        data_dict = profile.data_dict
        api_keys = data_dict.get('api_keys', {})

        # Return masked versions (last 4 characters only)
        result = {}
        keys_configured = []
        if api_keys.get('claude_api_key'):
            result['claude_api_key'] = api_keys['claude_api_key'][-4:]
            keys_configured.append('claude')
        if api_keys.get('gemini_api_key'):
            result['gemini_api_key'] = api_keys['gemini_api_key'][-4:]
            keys_configured.append('gemini')
        if api_keys.get('openai_api_key'):
            result['openai_api_key'] = api_keys['openai_api_key'][-4:]
            keys_configured.append('openai')
        if api_keys.get('grok_api_key'):
            result['grok_api_key'] = api_keys['grok_api_key'][-4:]
            keys_configured.append('grok')
        if api_keys.get('openrouter_api_key'):
            result['openrouter_api_key'] = api_keys['openrouter_api_key'][-4:]
            keys_configured.append('openrouter')
        if api_keys.get('deepseek_api_key'):
            result['deepseek_api_key'] = api_keys['deepseek_api_key'][-4:]
            keys_configured.append('deepseek')
        if api_keys.get('mistral_api_key'):
            result['mistral_api_key'] = api_keys['mistral_api_key'][-4:]
            keys_configured.append('mistral')
        if api_keys.get('together_api_key'):
            result['together_api_key'] = api_keys['together_api_key'][-4:]
            keys_configured.append('together')
        if api_keys.get('huggingface_api_key'):
            result['huggingface_api_key'] = api_keys['huggingface_api_key'][-4:]
            keys_configured.append('huggingface')
        if api_keys.get('ollama_url'):
            result['ollama_url'] = api_keys['ollama_url']
            result['ollama_model'] = api_keys.get('ollama_model', 'qwen:latest')
            keys_configured.append('ollama')
        if api_keys.get('lmstudio_url'):
            result['lmstudio_url'] = api_keys['lmstudio_url']
            keys_configured.append('lmstudio')
        if api_keys.get('localai_url'):
            result['localai_url'] = api_keys['localai_url']
            keys_configured.append('localai')
        
        if data_dict.get('preferred_ai_provider'):
            result['preferred_ai_provider'] = data_dict['preferred_ai_provider']

        enhanced_audit_logger.log(
            action='VIEW_API_KEYS',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': name,
                'keys_configured': keys_configured
            },
            status_code=200
        )
        return jsonify(result), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action='VIEW_API_KEYS_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profiles/<name>/api-keys', methods=['POST'])
@login_required
def save_api_keys(name: str):
    """Save encrypted API keys for a profile."""
    try:
        # Validate input
        data = APIKeySchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action='SAVE_API_KEYS_VALIDATION_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=400
        )
        return jsonify({'error': str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='SAVE_API_KEYS_NOT_FOUND',
                details={'profile_name': name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get current profile data
        data_dict = profile.data_dict

        # Initialize api_keys section if not present
        if 'api_keys' not in data_dict:
            data_dict['api_keys'] = {}

        # Track which keys are being updated
        keys_updated = []
        if data.claude_api_key:
            data_dict['api_keys']['claude_api_key'] = data.claude_api_key
            keys_updated.append('claude')
        if data.gemini_api_key:
            data_dict['api_keys']['gemini_api_key'] = data.gemini_api_key
            keys_updated.append('gemini')
        if data.openai_api_key:
            data_dict['api_keys']['openai_api_key'] = data.openai_api_key
            keys_updated.append('openai')
        if data.grok_api_key:
            data_dict['api_keys']['grok_api_key'] = data.grok_api_key
            keys_updated.append('grok')
        if data.openrouter_api_key:
            data_dict['api_keys']['openrouter_api_key'] = data.openrouter_api_key
            keys_updated.append('openrouter')
        if data.deepseek_api_key:
            data_dict['api_keys']['deepseek_api_key'] = data.deepseek_api_key
            keys_updated.append('deepseek')
        if data.mistral_api_key:
            data_dict['api_keys']['mistral_api_key'] = data.mistral_api_key
            keys_updated.append('mistral')
        if data.together_api_key:
            data_dict['api_keys']['together_api_key'] = data.together_api_key
            keys_updated.append('together')
        if data.huggingface_api_key:
            data_dict['api_keys']['huggingface_api_key'] = data.huggingface_api_key
            keys_updated.append('huggingface')
        if data.ollama_url:
            data_dict['api_keys']['ollama_url'] = data.ollama_url
            if data.ollama_model:
                data_dict['api_keys']['ollama_model'] = data.ollama_model
            keys_updated.append('ollama')
        if data.lmstudio_url:
            data_dict['api_keys']['lmstudio_url'] = data.lmstudio_url
            keys_updated.append('lmstudio')
        if data.localai_url:
            data_dict['api_keys']['localai_url'] = data.localai_url
            keys_updated.append('localai')
        
        if data.preferred_ai_provider:
            data_dict['preferred_ai_provider'] = data.preferred_ai_provider
            keys_updated.append('preferred_provider')

        # Save profile (encryption happens automatically via the data property setter)
        profile.data = data_dict
        profile.save()

        enhanced_audit_logger.log(
            action='SAVE_API_KEYS',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': name,
                'keys_updated': keys_updated
            },
            status_code=200
        )
        return jsonify({
            'message': 'API keys saved successfully',
            'encrypted': True
        }), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action='SAVE_API_KEYS_ERROR',
            details={'profile_name': name, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/test-api-key', methods=['POST'])
@login_required
def test_api_key():
    """Test an API key to verify it works."""
    try:
        data = request.json
        provider = data.get('provider')
        api_key = data.get('api_key')

        if not provider or not api_key:
            enhanced_audit_logger.log(
                action='TEST_API_KEY_VALIDATION_ERROR',
                details={'provider': provider, 'error': 'Missing provider or api_key'},
                status_code=400
            )
            return jsonify({'error': 'Missing provider or api_key'}), 400

        enhanced_audit_logger.log(
            action='TEST_API_KEY',
            details={'provider': provider},
            status_code=200
        )

        # Test based on provider
        if provider == 'claude':
            return test_claude_api_key(api_key)
        elif provider == 'gemini':
            return test_gemini_api_key(api_key)
        elif provider == 'openai':
            return test_openai_api_key(api_key)
        elif provider == 'grok':
            return test_grok_api_key(api_key)
        elif provider == 'openrouter':
            return test_openrouter_api_key(api_key)
        elif provider == 'deepseek':
            return test_deepseek_api_key(api_key)
        elif provider == 'mistral':
            return test_mistral_api_key(api_key)
        elif provider == 'together':
            return test_together_api_key(api_key)
        elif provider == 'huggingface':
            return test_huggingface_api_key(api_key)
        elif provider == 'ollama':
            return test_ollama_api_key(api_key, data.get('ollama_model'))
        elif provider == 'lmstudio':
            return test_lmstudio_api_key(api_key)
        elif provider == 'localai':
            return test_localai_api_key(api_key)
        else:
            enhanced_audit_logger.log(
                action='TEST_API_KEY_UNKNOWN_PROVIDER',
                details={'provider': provider},
                status_code=400
            )
            return jsonify({'error': f'Unknown provider: {provider}'}), 400

    except Exception as e:
        enhanced_audit_logger.log(
            action='TEST_API_KEY_ERROR',
            details={'provider': provider if 'provider' in dir() else None, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


def test_claude_api_key(api_key: str):
    """Test Claude API key with a simple request."""
    try:
        import requests

        # Try latest Claude models
        models_to_try = [
            'claude-opus-4-5-20251101',      # Claude Opus 4.5 (Nov 2025) - most capable
            'claude-sonnet-4-5-20250929',    # Claude Sonnet 4.5 (Sep 2025) - excellent balance
            'claude-sonnet-4-20250514',      # Claude Sonnet 4 (May 2025) - fallback
            'claude-sonnet-3-5-20241022',    # Claude Sonnet 3.5 (Oct 2024) - legacy fallback
            'claude-3-5-haiku-20241022'      # Claude Haiku 3.5 (fastest, for quick tests)
        ]

        last_error = None
        for model in models_to_try:
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
                        'max_tokens': 10,
                        'messages': [{'role': 'user', 'content': 'Hi'}]
                    },
                    timeout=10
                )

                if response.status_code == 200:
                    return jsonify({
                        'success': True,
                        'message': f'Claude API key is valid (tested with {model})',
                        'model': model
                    }), 200
                else:
                    last_error = response.json().get('error', {}).get('message', 'Unknown error')
                    # Try next model
                    continue
            except Exception as e:
                last_error = str(e)
                continue

        # All models failed
        return jsonify({
            'success': False,
            'error': f'API Error: {last_error or "All models failed"}'
        }), 400

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_gemini_api_key(api_key: str):
    """Test Gemini API key with a simple request."""
    try:
        import requests

        # Test with a simple models list request
        response = requests.get(
            f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}',
            timeout=10
        )

        if response.status_code == 200:
            models = response.json().get('models', [])
            model_name = models[0]['name'] if models else 'gemini-pro'
            return jsonify({
                'success': True,
                'message': 'Gemini API key is valid',
                'model': model_name
            }), 200
        else:
            error_detail = response.json().get('error', {}).get('message', 'Unknown error')
            return jsonify({
                'success': False,
                'error': f'API Error: {error_detail}'
            }), 400

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_openai_api_key(api_key: str):
    """Test OpenAI API key."""
    try:
        import requests
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4o',
                'messages': [{'role': 'user', 'content': 'Hi'}],
                'max_tokens': 5
            },
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'OpenAI API key is valid'}), 200
        else:
            error_msg = 'Unknown error'
            try:
                error_msg = response.json().get('error', {}).get('message', 'Unknown error')
            except:
                pass
            return jsonify({'success': False, 'error': f"API Error: {error_msg}"}), 400
    except requests.Timeout:
        return jsonify({'success': False, 'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_grok_api_key(api_key: str):
    """Test Grok (xAI) API key."""
    try:
        import requests
        response = requests.post(
            'https://api.x.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'grok-beta',
                'messages': [{'role': 'user', 'content': 'Hi'}],
                'max_tokens': 5
            },
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Grok API key is valid'}), 200
        else:
            error_msg = 'Unknown error'
            try:
                error_msg = response.json().get('error', {}).get('message', 'Unknown error')
            except:
                pass
            return jsonify({'success': False, 'error': f"API Error: {error_msg}"}), 400
    except requests.Timeout:
        return jsonify({'success': False, 'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_openrouter_api_key(api_key: str):
    """Test OpenRouter API key."""
    try:
        import requests
        response = requests.get(
            'https://openrouter.ai/api/v1/models',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'OpenRouter API key is valid'}), 200
        else:
            return jsonify({'success': False, 'error': f"API Error: {response.text}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_deepseek_api_key(api_key: str):
    """Test DeepSeek API key."""
    try:
        import requests
        response = requests.post(
            'https://api.deepseek.com/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': 'Hi'}],
                'max_tokens': 5
            },
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'DeepSeek API key is valid'}), 200
        else:
            return jsonify({'success': False, 'error': f"API Error: {response.text}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_mistral_api_key(api_key: str):
    """Test Mistral API key."""
    try:
        import requests
        response = requests.get(
            'https://api.mistral.ai/v1/models',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Mistral API key is valid'}), 200
        else:
            return jsonify({'success': False, 'error': f"API Error: {response.text}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_together_api_key(api_key: str):
    """Test Together AI API key."""
    try:
        import requests
        response = requests.get(
            'https://api.together.xyz/v1/models',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Together AI API key is valid'}), 200
        else:
            return jsonify({'success': False, 'error': f"API Error: {response.text}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_huggingface_api_key(api_key: str):
    """Test Hugging Face API key."""
    try:
        import requests
        response = requests.get(
            'https://huggingface.co/api/whoami-v2',
            headers={'Authorization': f'Bearer {api_key}'},
            timeout=10
        )
        if response.status_code == 200:
            return jsonify({'success': True, 'message': 'Hugging Face API key is valid'}), 200
        else:
            return jsonify({'success': False, 'error': f"API Error: {response.text}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def test_ollama_api_key(url: str, model: str = None):
    """Test Ollama connection (URL instead of key)."""
    try:
        import requests
        if not model:
            model = 'qwen:latest'
        response = requests.get(f'{url}/api/tags', timeout=5)
        if response.status_code == 200:
            models = response.json().get('models', [])
            return jsonify({
                'success': True, 
                'message': f'Connected to Ollama ({len(models)} models found)',
                'model': models[0]['name'] if models else 'ollama'
            }), 200
        else:
            return jsonify({'success': False, 'error': f"Ollama Error: {response.status_code}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f"Connection failed: {str(e)}"}), 400


def test_lmstudio_api_key(url: str):
    """Test LM Studio connection."""
    try:
        import requests
        # LM Studio is OpenAI compatible, test /v1/models
        response = requests.get(f'{url}/v1/models', timeout=5)
        if response.status_code == 200:
            models = response.json().get('data', [])
            return jsonify({
                'success': True, 
                'message': f'Connected to LM Studio ({len(models)} models found)',
                'model': models[0]['id'] if models else 'lmstudio'
            }), 200
        else:
            return jsonify({'success': False, 'error': f"LM Studio Error: {response.status_code}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f"Connection failed: {str(e)}"}), 400


def test_localai_api_key(url: str):
    """Test LocalAI connection."""
    try:
        import requests
        # LocalAI is OpenAI compatible, test /v1/models
        response = requests.get(f'{url}/v1/models', timeout=5)
        if response.status_code == 200:
            models = response.json().get('data', [])
            return jsonify({
                'success': True, 
                'message': f'Connected to LocalAI ({len(models)} models found)',
                'model': models[0]['id'] if models else 'localai'
            }), 200
        else:
            return jsonify({'success': False, 'error': f"LocalAI Error: {response.status_code}"}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f"Connection failed: {str(e)}"}), 400
