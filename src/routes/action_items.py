"""Action item routes for tasks and recommendations."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator, root_validator
from typing import Optional
from src.models.action_item import ActionItem
from src.models.profile import Profile

action_items_bp = Blueprint('action_items', __name__, url_prefix='/api')


class ActionItemCreateSchema(BaseModel):
    """Schema for creating an action item."""
    profile_name: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = 'medium'
    status: Optional[str] = 'pending'
    due_date: Optional[str] = None
    action_data: Optional[dict] = None
    subtasks: Optional[list] = None

    @root_validator(pre=True)
    def check_title_or_description(cls, values):
        title = values.get('title')
        description = values.get('description')
        
        if not description and not title:
            raise ValueError('Description or title is required')
            
        if not description and title:
            values['description'] = title
            
        return values

    @validator('description')
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Description must be less than 500 characters')
        return v.strip() if v else v

    @validator('priority')
    def validate_priority(cls, v):
        if v not in ['high', 'medium', 'low']:
            raise ValueError('Priority must be one of: high, medium, low')
        return v

    @validator('status')
    def validate_status(cls, v):
        if v not in ['pending', 'in_progress', 'completed']:
            raise ValueError('Status must be one of: pending, in_progress, completed')
        return v


class ActionItemUpdateSchema(BaseModel):
    """Schema for updating an action item."""
    category: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    action_data: Optional[dict] = None
    subtasks: Optional[list] = None

    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Description cannot be empty')
            if len(v) > 500:
                raise ValueError('Description must be less than 500 characters')
            return v.strip()
        return v

    @validator('priority')
    def validate_priority(cls, v):
        if v is not None and v not in ['high', 'medium', 'low']:
            raise ValueError('Priority must be one of: high, medium, low')
        return v

    @validator('status')
    def validate_status(cls, v):
        if v is not None and v not in ['pending', 'in_progress', 'completed']:
            raise ValueError('Status must be one of: pending, in_progress, completed')
        return v


from src.services.action_item_service import ActionItemService

@action_items_bp.route('/action-items/generate', methods=['POST'])
@login_required
def generate_action_items():
    """Generate automated action items for a profile."""
    try:
        profile_name = request.json.get('profile_name')
        if not profile_name:
            return jsonify({'error': 'profile_name is required'}), 400

        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        # Generate and sync items
        ActionItemService.sync_generated_items(current_user.id, profile)
        
        # Get all items (new and existing)
        action_items = ActionItem.list_by_user(current_user.id, profile.id)

        return jsonify({
            'message': 'Action items generated successfully',
            'action_items': [item.to_dict() for item in action_items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@action_items_bp.route('/action-items', methods=['GET'])
@login_required
def list_action_items():
    """List action items for the current user."""
    try:
        profile_name = request.args.get('profile_name')
        profile_id = None

        # If profile_name provided, resolve to profile_id
        if profile_name:
            profile = Profile.get_by_name(profile_name, current_user.id)
            if not profile:
                return jsonify({'error': 'Profile not found'}), 404
            profile_id = profile.id

        action_items = ActionItem.list_by_user(current_user.id, profile_id)

        return jsonify({
            'action_items': [item.to_dict() for item in action_items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@action_items_bp.route('/action-item/<int:item_id>', methods=['GET'])
@login_required
def get_action_item(item_id: int):
    """Get a specific action item by ID (with ownership check)."""
    try:
        item = ActionItem.get_by_id(item_id, current_user.id)
        if not item:
            return jsonify({'error': 'Action item not found'}), 404

        return jsonify({'action_item': item.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@action_items_bp.route('/action-items', methods=['POST'])
@login_required
def create_action_item():
    """Create a new action item for the current user."""
    try:
        data = ActionItemCreateSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Resolve profile_id if profile_name provided
        profile_id = None
        if data.profile_name:
            profile = Profile.get_by_name(data.profile_name, current_user.id)
            if not profile:
                return jsonify({'error': 'Profile not found'}), 404
            profile_id = profile.id

        # Create new action item
        item = ActionItem(
            user_id=current_user.id,
            profile_id=profile_id,
            category=data.category,
            description=data.description,
            priority=data.priority,
            status=data.status,
            due_date=data.due_date,
            action_data=data.action_data,
            subtasks=data.subtasks
        )
        item.save()

        return jsonify({
            'message': 'Action item created successfully',
            'action_item': item.to_dict()
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@action_items_bp.route('/action-item/<int:item_id>', methods=['PUT'])
@login_required
def update_action_item(item_id: int):
    """Update an action item (with ownership check)."""
    try:
        data = ActionItemUpdateSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Get action item with ownership check
        item = ActionItem.get_by_id(item_id, current_user.id)
        if not item:
            return jsonify({'error': 'Action item not found'}), 404

        # Update fields if provided
        if data.category is not None:
            item.category = data.category

        if data.description is not None:
            item.description = data.description

        if data.priority is not None:
            item.priority = data.priority

        if data.status is not None:
            item.status = data.status

        if data.due_date is not None:
            item.due_date = data.due_date

        if data.action_data is not None:
            item.action_data = data.action_data

        if data.subtasks is not None:
            item.subtasks = data.subtasks

        item.save()

        return jsonify({
            'message': 'Action item updated successfully',
            'action_item': item.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@action_items_bp.route('/action-item/<int:item_id>', methods=['DELETE'])
@login_required
def delete_action_item(item_id: int):
    """Delete an action item (with ownership check)."""
    try:
        # Get action item with ownership check
        item = ActionItem.get_by_id(item_id, current_user.id)
        if not item:
            return jsonify({'error': 'Action item not found'}), 404

        item.delete()

        return jsonify({'message': 'Action item deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
