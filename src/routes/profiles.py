"""Profile routes with authentication and ownership checks."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from src.models.profile import Profile

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
