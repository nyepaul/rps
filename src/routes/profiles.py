"""Profile routes with authentication and ownership checks."""
from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from src.models.profile import Profile
from src.services.asset_service import assets_to_csv, csv_to_assets, merge_assets, sync_legacy_arrays

profiles_bp = Blueprint('profiles', __name__, url_prefix='/api')


class ProfileCreateSchema(BaseModel):
    """Schema for creating a profile."""
    name: str
    birth_date: Optional[str] = None
    retirement_date: Optional[str] = None
    data: Optional[dict] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Profile name is required')
        if len(v) > 100:
            raise ValueError('Profile name must be less than 100 characters')
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
        if v is not None:
            if not v.strip():
                raise ValueError('Profile name cannot be empty')
            if len(v) > 100:
                raise ValueError('Profile name must be less than 100 characters')
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
        return jsonify({'profiles': profiles}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['GET'])
@login_required
def get_profile(name: str):
    """Get a specific profile by name (with ownership check)."""
    try:
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        return jsonify({'profile': profile.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profiles', methods=['POST'])
@login_required
def create_profile():
    """Create a new profile for the current user."""
    try:
        data = ProfileCreateSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Check if profile with same name already exists for this user
        existing = Profile.get_by_name(data.name, current_user.id)
        if existing:
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

        return jsonify({
            'message': 'Profile created successfully',
            'profile': profile.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['PUT'])
@login_required
def update_profile(name: str):
    """Update a profile (with ownership check)."""
    try:
        data = ProfileUpdateSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        # Update fields if provided
        if data.name is not None:
            # Check if new name conflicts with another profile
            if data.name != profile.name:
                existing = Profile.get_by_name(data.name, current_user.id)
                if existing:
                    return jsonify({'error': 'Profile with this name already exists'}), 409
            profile.name = data.name

        if data.birth_date is not None:
            profile.birth_date = data.birth_date

        if data.retirement_date is not None:
            profile.retirement_date = data.retirement_date

        if data.data is not None:
            profile.data = data.data

        profile.save()

        return jsonify({
            'message': 'Profile updated successfully',
            'profile': profile.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>', methods=['DELETE'])
@login_required
def delete_profile(name: str):
    """Delete a profile (with ownership check)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        profile.delete()

        return jsonify({'message': 'Profile deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>/assets/export', methods=['GET'])
@login_required
def export_assets_csv(name: str):
    """Export all assets as CSV file."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
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

        # Convert to CSV
        csv_content = assets_to_csv(assets)

        # Create response with CSV content
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{name.replace(' ', '_')}_assets_{timestamp}.csv"

        return Response(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={filename}'
            }
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@profiles_bp.route('/profile/<name>/assets/import', methods=['POST'])
@login_required
def import_assets_csv(name: str):
    """Import assets from CSV file (appends to existing assets)."""
    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read and parse CSV
        csv_content = file.read().decode('utf-8')

        try:
            new_assets = csv_to_assets(csv_content)
        except ValueError as e:
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

        return jsonify({
            'message': f'Successfully imported {imported_count} assets',
            'assets': merged_assets,
            'profile': profile.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
