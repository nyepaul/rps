"""Admin routes for managing audit logs and system configuration."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
from src.auth.admin_required import admin_required
from src.auth.super_admin_required import super_admin_required
from src.database.connection import db
from src.services.enhanced_audit_logger import enhanced_audit_logger, AuditConfig
from src.services.audit_narrative_generator import audit_narrative_generator
from src.auth.models import User, PasswordResetRequest
from src.models.group import Group
from src.services.encryption_service import EncryptionService
import base64
import json
from datetime import datetime, timedelta
from src.extensions import limiter

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


class AuditConfigSchema(BaseModel):
    """Schema for audit configuration updates."""
    enabled: Optional[bool] = None
    collect: Optional[Dict[str, bool]] = None
    display: Optional[Dict[str, bool]] = None
    retention_days: Optional[int] = None
    log_read_operations: Optional[bool] = None

    @validator('retention_days')
    def validate_retention_days(cls, v):
        if v is not None and (v < 1 or v > 3650):  # 1 day to 10 years
            raise ValueError('Retention days must be between 1 and 3650')
        return v


class UserUpdateSchema(BaseModel):
    """Schema for admin user updates."""
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class PasswordResetSchema(BaseModel):
    """Schema for admin password reset."""
    new_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v


class GroupCreateSchema(BaseModel):
    """Schema for group creation."""
    name: str
    description: Optional[str] = None


class GroupUpdateSchema(BaseModel):
    """Schema for group updates."""
    name: Optional[str] = None
    description: Optional[str] = None


class SmtpConfigSchema(BaseModel):
    """Schema for SMTP configuration."""
    mail_server: str
    mail_port: int
    mail_username: Optional[str] = None
    mail_password: Optional[str] = None
    mail_use_tls: bool = True
    mail_use_ssl: bool = False
    mail_default_sender: str

    @validator('mail_port')
    def validate_port(cls, v):
        if v < 1 or v > 65535:
            raise ValueError('Port must be between 1 and 65535')
        return v



@admin_bp.route('/logs', methods=['GET'])
@limiter.limit("100 per minute")  # Generous limit for log viewing
@login_required
@admin_required
def get_audit_logs():
    """
    Get audit logs with filtering and pagination.

    Query parameters:
        - user_id: Filter by user ID
        - action: Filter by action type
        - table_name: Filter by table name
        - start_date: Filter by start date (ISO format)
        - end_date: Filter by end date (ISO format)
        - ip_address: Filter by IP address
        - limit: Number of records per page (default: 50, max: 500)
        - offset: Pagination offset (default: 0)
    """
    try:
        # Get query parameters
        user_id_param = request.args.get('user_id')

        # Handle special case for filtering unauthenticated users (coward)
        if user_id_param == 'null':
            user_id = 'null'  # Special marker for NULL user_id
        elif user_id_param is not None:
            try:
                user_id = int(user_id_param)
            except ValueError:
                user_id = None
        else:
            user_id = None

        action = request.args.get('action')
        table_name = request.args.get('table_name')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        ip_address = request.args.get('ip_address')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_direction = request.args.get('sort_direction', 'desc')
        limit = min(request.args.get('limit', 50, type=int), 500)  # Cap at 500
        offset = request.args.get('offset', 0, type=int)

        # Get logs
        result = enhanced_audit_logger.get_logs(
            user_id=user_id,
            action=action,
            table_name=table_name,
            start_date=start_date,
            end_date=end_date,
            ip_address=ip_address,
            sort_by=sort_by,
            sort_direction=sort_direction,
            limit=limit,
            offset=offset
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_LOGS',
            details={
                'filters': {
                    'user_id': user_id,
                    'action': action,
                    'table_name': table_name,
                    'start_date': start_date,
                    'end_date': end_date,
                    'ip_address': ip_address
                },
                'limit': limit,
                'offset': offset
            },
            user_id=current_user.id
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/statistics', methods=['GET'])
@limiter.limit("30 per minute")  # Statistics endpoint
@login_required
@admin_required
def get_log_statistics():
    """
    Get audit log statistics.

    Query parameters:
        - days: Number of days to analyze (default: 30)
    """
    try:
        days = request.args.get('days', 30, type=int)
        days = min(max(days, 1), 365)  # Between 1 and 365 days

        stats = enhanced_audit_logger.get_statistics(days=days)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_STATISTICS',
            details={'days': days},
            user_id=current_user.id
        )

        response = jsonify({
            'statistics': stats,
            'period_days': days
        })

        # Prevent browser caching of statistics - always fetch fresh data
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response, 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/ip-locations', methods=['GET'])
@limiter.limit("60 per minute")  # Moderate limit for IP location data
@login_required
@admin_required
def get_ip_locations():
    """
    Get all unique IP addresses with geolocation data for mapping.

    Query Params:
        days (int): Optional lookback period in days

    Returns:
        List of unique IP locations with coordinates and access counts
    """
    try:
        days = request.args.get('days', type=int)
        locations = enhanced_audit_logger.get_unique_ip_locations(days=days)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_IP_LOCATIONS',
            details={'location_count': len(locations), 'days': days},
            user_id=current_user.id
        )

        response = jsonify({
            'locations': locations,
            'total': len(locations)
        })

        # Prevent browser caching - IP locations change frequently
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response, 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/<int:log_id>', methods=['GET'])
@limiter.limit("100 per minute")  # Generous limit for log navigation
@login_required
@admin_required
def get_log_by_id(log_id: int):
    """Get a single audit log by ID with full details."""
    try:
        from src.database.connection import db

        # Query for the specific log
        log = db.execute_one(
            'SELECT * FROM enhanced_audit_log WHERE id = ?',
            (log_id,)
        )

        if not log:
            return jsonify({'error': 'Log not found'}), 404

        # Convert to dict
        log_dict = dict(log)

        # Parse JSON fields if they exist
        import json

        if log_dict.get('details'):
            try:
                # Try to parse as JSON
                log_dict['details'] = json.loads(log_dict['details'])
            except (json.JSONDecodeError, TypeError):
                # If it's plain text or not valid JSON, wrap it in an object
                if isinstance(log_dict['details'], str):
                    log_dict['details'] = {'message': log_dict['details']}
                else:
                    log_dict['details'] = None

        if log_dict.get('device_info'):
            try:
                log_dict['device_info'] = json.loads(log_dict['device_info'])
            except (json.JSONDecodeError, TypeError):
                log_dict['device_info'] = None

        if log_dict.get('geo_location'):
            try:
                log_dict['geo_location'] = json.loads(log_dict['geo_location'])
            except (json.JSONDecodeError, TypeError):
                log_dict['geo_location'] = None

        # Log the view action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_LOG_DETAILS',
            details={'log_id': log_id},
            user_id=current_user.id
        )

        return jsonify(log_dict), 200

    except Exception as e:
        print(f"Error fetching log {log_id}: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/export', methods=['GET'])
@login_required
@admin_required
def export_audit_logs():
    """
    Export audit logs as JSON or CSV.

    Query parameters:
        - format: 'json' or 'csv' (default: 'json')
        - ... same filters as /logs endpoint
    """
    try:
        export_format = request.args.get('format', 'json').lower()

        # Get filters
        user_id = request.args.get('user_id', type=int)
        action = request.args.get('action')
        table_name = request.args.get('table_name')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        ip_address = request.args.get('ip_address')

        # Get logs (no limit for export)
        result = enhanced_audit_logger.get_logs(
            user_id=user_id,
            action=action,
            table_name=table_name,
            start_date=start_date,
            end_date=end_date,
            ip_address=ip_address,
            limit=10000,  # Max export limit
            offset=0
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='EXPORT_LOGS',
            details={
                'format': export_format,
                'record_count': len(result['logs'])
            },
            user_id=current_user.id
        )

        if export_format == 'csv':
            # Convert to CSV
            import csv
            import io

            output = io.StringIO()
            if result['logs']:
                writer = csv.DictWriter(output, fieldnames=result['logs'][0].keys())
                writer.writeheader()
                writer.writerows(result['logs'])

            from flask import Response
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename=audit_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                }
            )
        else:
            # Return as JSON
            return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/config', methods=['GET'])
@login_required
@admin_required
def get_audit_config():
    """Get current audit logging configuration."""
    try:
        config = AuditConfig.get_config()

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_CONFIG',
            user_id=current_user.id
        )

        return jsonify({'config': config}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/config', methods=['PUT'])
@login_required
@admin_required
def update_audit_config():
    """Update audit logging configuration."""
    try:
        # Validate input
        data = AuditConfigSchema(**request.json)

        # Get current config
        config = AuditConfig.get_config()

        # Update only provided fields
        if data.enabled is not None:
            config['enabled'] = data.enabled

        if data.collect is not None:
            config['collect'].update(data.collect)

        if data.display is not None:
            config['display'].update(data.display)

        if data.retention_days is not None:
            config['retention_days'] = data.retention_days

        if data.log_read_operations is not None:
            config['log_read_operations'] = data.log_read_operations

        # Save config
        AuditConfig.set_config(config)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='UPDATE_CONFIG',
            details={'changes': request.json},
            user_id=current_user.id
        )

        return jsonify({
            'message': 'Configuration updated successfully',
            'config': config
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@admin_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def list_users():
    """List all users in the system with their group assignments."""
    try:
        from src.database.connection import db

        if current_user.is_super_admin:
            rows = db.execute('''
                SELECT u.id, u.username, u.email, u.is_active, u.is_admin, u.is_super_admin, u.created_at, u.last_login,
                       GROUP_CONCAT(g.name, ', ') as group_names
                FROM users u
                LEFT JOIN user_groups ug ON u.id = ug.user_id
                LEFT JOIN groups g ON ug.group_id = g.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
            ''')
        else:
            # Only show users in groups managed by this admin
            rows = db.execute('''
                SELECT DISTINCT u.id, u.username, u.email, u.is_active, u.is_admin, u.is_super_admin, u.created_at, u.last_login,
                       (SELECT GROUP_CONCAT(g2.name, ', ') 
                        FROM groups g2 
                        JOIN user_groups ug2 ON g2.id = ug2.group_id 
                        WHERE ug2.user_id = u.id) as group_names
                FROM users u
                JOIN user_groups ug ON u.id = ug.user_id
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ?
                ORDER BY u.created_at DESC
            ''', (current_user.id,))

        users = [dict(row) for row in rows]

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='LIST_USERS',
            details={'count': len(users)},
            user_id=current_user.id
        )

        return jsonify({'users': users}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
@admin_required
def update_user(user_id: int):
    """Update user status (activate/deactivate, promote/demote admin)."""
    try:
        # Check permissions
        if not current_user.can_manage_user(user_id):
            return jsonify({'error': 'Unauthorized to manage this user'}), 403

        # Validate input
        data = UserUpdateSchema(**request.json)

        # Get user
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Prevent demoting a super admin unless requester is also super admin
        if user.is_super_admin and not current_user.is_super_admin:
            return jsonify({'error': 'Only super admins can manage other super admins'}), 403

        # Prevent demoting self from admin
        if user_id == current_user.id and data.is_admin == False:
            return jsonify({'error': 'Cannot demote yourself from admin'}), 400

        # Update user
        if data.is_active is not None:
            user._is_active = data.is_active

        if data.is_admin is not None:
            user._is_admin = data.is_admin

        user.save()

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='UPDATE_USER',
            details={
                'target_user_id': user_id,
                'target_username': user.username,
                'changes': request.json
            },
            user_id=current_user.id
        )

        return jsonify({
            'message': 'User updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'is_admin': user.is_admin
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@admin_bp.route('/users/<int:user_id>/password', methods=['PUT'])
@login_required
@admin_required
def reset_user_password(user_id: int):
    """Reset a user's password (admin only).

    ⚠️ WARNING: Admin password reset cannot re-encrypt user data because the old
    password is not known. This will PERMANENTLY DELETE encrypted data for users
    with password-based encryption enabled.
    """
    try:
        # Validate input
        data = PasswordResetSchema(**request.json)

        # Get user
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Check if user has encrypted data that will be lost
        has_encrypted_data = bool(user.encrypted_dek and user.dek_iv)

        # Force password reset (will lose encrypted data if user had DEK)
        dek_was_lost = user.force_password_reset(data.new_password)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RESET_USER_PASSWORD',
            details={
                'target_user_id': user_id,
                'target_username': user.username,
                'dek_lost': dek_was_lost,
                'warning': 'Encrypted data lost - old password not available' if dek_was_lost else None
            },
            user_id=current_user.id
        )

        message = f'Password reset successfully for user: {user.username}'
        if dek_was_lost:
            message += '. ⚠️ WARNING: User\'s encrypted data is now PERMANENTLY INACCESSIBLE because the old password was not available to re-encrypt it.'

        return jsonify({
            'message': 'Password reset successfully',
            'dek_lost': dek_was_lost
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Group Management Endpoints
# ============================================================================

@admin_bp.route('/groups', methods=['GET'])
@login_required
@admin_required
def list_groups():
    """List all groups (Super Admin sees all, Local Admin sees managed)."""
    try:
        if current_user.is_super_admin:
            groups = Group.get_all()
        else:
            groups = current_user.get_managed_groups()
        
        return jsonify({'groups': [g.to_dict() for g in groups]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups', methods=['POST'])
@login_required
@super_admin_required
def create_group():
    """Create a new user group (Super Admin only)."""
    try:
        data = GroupCreateSchema(**request.json)
        group = Group(None, data.name, data.description)
        group.save()
        
        enhanced_audit_logger.log_admin_action(
            action='CREATE_GROUP',
            details=group.to_dict(),
            user_id=current_user.id
        )
        
        return jsonify({'message': 'Group created successfully', 'group': group.to_dict()}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups/<int:group_id>', methods=['GET'])
@login_required
@admin_required
def get_group(group_id):
    """Get group details and members."""
    try:
        group = Group.get_by_id(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check permissions for local admin
        if not current_user.is_super_admin:
            managed_ids = [g.id for g in current_user.get_managed_groups()]
            if group_id not in managed_ids:
                return jsonify({'error': 'Unauthorized to view this group'}), 403
        
        members = group.get_members()
        return jsonify({
            'group': group.to_dict(),
            'members': [{'id': u.id, 'username': u.username, 'email': u.email} for u in members]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups/<int:group_id>', methods=['PUT'])
@login_required
@super_admin_required
def update_group(group_id):
    """Update group details (Super Admin only)."""
    try:
        group = Group.get_by_id(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        data = GroupUpdateSchema(**request.json)
        if data.name: group.name = data.name
        if data.description: group.description = data.description
        group.save()
        
        enhanced_audit_logger.log_admin_action(
            action='UPDATE_GROUP',
            details=group.to_dict(),
            user_id=current_user.id
        )
        
        return jsonify({'message': 'Group updated successfully', 'group': group.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups/<int:group_id>', methods=['DELETE'])
@login_required
@super_admin_required
def delete_group(group_id):
    """Delete a group (Super Admin only)."""
    try:
        group = Group.get_by_id(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        group.delete()
        
        enhanced_audit_logger.log_admin_action(
            action='DELETE_GROUP',
            details={'group_id': group_id, 'name': group.name},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'Group deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups/<int:group_id>/members/<int:user_id>', methods=['POST'])
@login_required
@super_admin_required
def add_group_member(group_id, user_id):
    """Add a user to a group (Super Admin only)."""
    try:
        group = Group.get_by_id(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        group.add_member(user_id)
        
        enhanced_audit_logger.log_admin_action(
            action='ADD_GROUP_MEMBER',
            details={'group_id': group_id, 'user_id': user_id, 'username': user.username},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'User added to group'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/groups/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
@login_required
@super_admin_required
def remove_group_member(group_id, user_id):
    """Remove a user from a group (Super Admin only)."""
    try:
        group = Group.get_by_id(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
            
        group.remove_member(user_id)
        
        enhanced_audit_logger.log_admin_action(
            action='REMOVE_GROUP_MEMBER',
            details={'group_id': group_id, 'user_id': user_id},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'User removed from group'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/managed-groups/<int:group_id>', methods=['POST'])
@login_required
@super_admin_required
def assign_managed_group(user_id, group_id):
    """Assign a group to be managed by an admin (Super Admin only)."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        if not user.is_admin:
            return jsonify({'error': 'User is not an admin'}), 400
            
        user.add_managed_group(group_id)
        
        enhanced_audit_logger.log_admin_action(
            action='ASSIGN_MANAGED_GROUP',
            details={'admin_id': user_id, 'group_id': group_id},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'Managed group assigned to admin'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/managed-groups/<int:group_id>', methods=['DELETE'])
@login_required
@super_admin_required
def remove_managed_group(user_id, group_id):
    """Remove a managed group from an admin (Super Admin only)."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        user.remove_managed_group(group_id)
        
        enhanced_audit_logger.log_admin_action(
            action='REMOVE_MANAGED_GROUP',
            details={'admin_id': user_id, 'group_id': group_id},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'Managed group removed from admin'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/groups', methods=['GET'])
@login_required
@admin_required
def get_user_groups(user_id):
    """Get groups a user belongs to."""
    try:
        # Check permissions
        if not current_user.can_manage_user(user_id):
            return jsonify({'error': 'Unauthorized'}), 403
            
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        groups = user.get_groups()
        return jsonify({'groups': [g.to_dict() for g in groups]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/managed-groups', methods=['GET'])
@login_required
@admin_required
def get_admin_managed_groups(user_id):
    """Get groups managed by an admin."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        if not user.is_admin:
            return jsonify({'groups': []}), 200
            
        groups = user.get_managed_groups()
        return jsonify({'groups': [g.to_dict() for g in groups]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/super-admin', methods=['PUT'])
@login_required
@super_admin_required
def update_super_admin_status(user_id: int):
    """
    Grant or revoke super admin status (super admin only).

    Only super admins can grant/revoke super admin privileges.
    When granting super admin status, the user is automatically promoted to admin as well.
    Super admins can view feedback content and manage other super admins.

    Request body:
        is_super_admin: boolean
    """
    try:
        from src.database.connection import db

        data = request.json
        if 'is_super_admin' not in data:
            return jsonify({'error': 'is_super_admin field required'}), 400

        is_super_admin = bool(data['is_super_admin'])

        # Get target user
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Prevent self-demotion from super admin
        if user_id == current_user.id and not is_super_admin:
            return jsonify({'error': 'Cannot revoke your own super admin status'}), 400

        # Update super admin status
        # When granting super admin, automatically promote to admin as well
        with db.get_connection() as conn:
            cursor = conn.cursor()
            if is_super_admin:
                # Granting super admin: also set is_admin=1
                cursor.execute(
                    'UPDATE users SET is_super_admin = ?, is_admin = ? WHERE id = ?',
                    (1, 1, user_id)
                )
            else:
                # Revoking super admin: only update is_super_admin
                cursor.execute(
                    'UPDATE users SET is_super_admin = ? WHERE id = ?',
                    (0, user_id)
                )
            conn.commit()

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='UPDATE_SUPER_ADMIN',
            details={
                'target_user_id': user_id,
                'target_username': user.username,
                'is_super_admin': is_super_admin
            },
            user_id=current_user.id
        )

        return jsonify({
            'success': True,
            'message': f"User {'granted' if is_super_admin else 'revoked'} super admin privileges",
            'user': {
                'id': user_id,
                'username': user.username,
                'is_super_admin': is_super_admin
            }
        }), 200

    except Exception as e:
        print(f"Error updating super admin status: {e}")
        return jsonify({'error': 'Failed to update super admin status'}), 500


@admin_bp.route('/users/<int:user_id>/profiles', methods=['GET'])
@login_required
@admin_required
def get_user_profiles(user_id: int):
    """Get all profiles for a specific user (admin view)."""
    try:
        from src.models.profile import Profile

        profiles = Profile.list_by_user(user_id)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_USER_PROFILES',
            details={
                'target_user_id': user_id,
                'profile_count': len(profiles)
            },
            user_id=current_user.id
        )

        return jsonify({'profiles': profiles}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/report', methods=['GET'])
@login_required
@admin_required
def get_user_report(user_id: int):
    """Get comprehensive activity report for a specific user."""
    try:
        from src.database.connection import db

        # Get user info
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        report = {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'is_admin': user.is_admin,
                'is_super_admin': user.is_super_admin,
                'created_at': user.created_at,
                'last_login': user.last_login
            }
        }

        # Count profiles
        result = db.execute_one('SELECT COUNT(*) as count FROM profile WHERE user_id = ?', (user_id,))
        report['profile_count'] = result['count'] if result else 0

        # Get profile list
        profiles = db.execute('SELECT id, name, created_at FROM profile WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
        report['profiles'] = [dict(row) for row in profiles]

        # Count scenarios
        result = db.execute_one('SELECT COUNT(*) as count FROM scenarios WHERE user_id = ?', (user_id,))
        report['scenario_count'] = result['count'] if result else 0

        # Get recent scenarios
        scenarios = db.execute('SELECT id, name, created_at FROM scenarios WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', (user_id,))
        report['recent_scenarios'] = [dict(row) for row in scenarios]

        # Count conversations
        result = db.execute_one('SELECT COUNT(DISTINCT profile_id) as count FROM conversations WHERE user_id = ?', (user_id,))
        report['conversation_count'] = result['count'] if result else 0

        # Count conversation messages
        result = db.execute_one('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?', (user_id,))
        report['conversation_message_count'] = result['count'] if result else 0

        # Count action items
        result = db.execute_one('SELECT COUNT(*) as count FROM action_items WHERE user_id = ?', (user_id,))
        report['action_item_count'] = result['count'] if result else 0

        # Get action item breakdown by status
        action_status = db.execute(
            'SELECT status, COUNT(*) as count FROM action_items WHERE user_id = ? GROUP BY status',
            (user_id,)
        )
        report['action_items_by_status'] = {row['status']: row['count'] for row in action_status}

        # Get recent audit activity (last 20 actions)
        audit_logs = db.execute(
            'SELECT action, table_name, request_method, request_endpoint, status_code, created_at '
            'FROM enhanced_audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            (user_id,)
        )
        report['recent_activity'] = [dict(row) for row in audit_logs]

        # Count total audit log entries
        result = db.execute_one('SELECT COUNT(*) as count FROM enhanced_audit_log WHERE user_id = ?', (user_id,))
        report['total_activity_count'] = result['count'] if result else 0

        # Get activity by action type
        activity_by_action = db.execute(
            'SELECT action, COUNT(*) as count FROM enhanced_audit_log '
            'WHERE user_id = ? GROUP BY action ORDER BY count DESC LIMIT 10',
            (user_id,)
        )
        report['activity_by_action'] = [dict(row) for row in activity_by_action]

        # Get first and last activity dates
        first_activity = db.execute_one(
            'SELECT MIN(created_at) as first_activity FROM enhanced_audit_log WHERE user_id = ?',
            (user_id,)
        )
        last_activity = db.execute_one(
            'SELECT MAX(created_at) as last_activity FROM enhanced_audit_log WHERE user_id = ?',
            (user_id,)
        )
        report['first_activity'] = first_activity['first_activity'] if first_activity else None
        report['last_activity'] = last_activity['last_activity'] if last_activity else None

        # Count feedback submissions
        result = db.execute_one('SELECT COUNT(*) as count FROM feedback WHERE user_id = ?', (user_id,))
        report['feedback_count'] = result['count'] if result else 0

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_USER_REPORT',
            details={'target_user_id': user_id},
            user_id=current_user.id
        )

        return jsonify({'report': report}), 200

    except Exception as e:
        print(f"Error generating user report: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id: int):
    """Delete a user and all associated data (admin only).

    Deletes:
    - User account
    - All user profiles
    - All user scenarios
    - All user action items
    - All user conversations
    - All user audit logs

    Restrictions:
    - Cannot delete yourself
    - Requires admin privileges
    """
    try:
        from src.database.connection import db

        # Prevent self-deletion
        if user_id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400

        # Get user before deletion for logging
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        username = user.username
        email = user.email

        # Delete user and cascade delete related data
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Delete user's profiles (will cascade to scenarios and action items via ON DELETE CASCADE)
            cursor.execute('DELETE FROM profile WHERE user_id = ?', (user_id,))
            profiles_deleted = cursor.rowcount

            # Delete user's conversations
            cursor.execute('DELETE FROM conversations WHERE user_id = ?', (user_id,))
            conversations_deleted = cursor.rowcount

            # Delete user's feedback submissions
            cursor.execute('DELETE FROM feedback WHERE user_id = ?', (user_id,))
            feedback_deleted = cursor.rowcount

            # Delete user's password reset requests (both as requester and processor)
            cursor.execute('DELETE FROM password_reset_requests WHERE user_id = ?', (user_id,))
            cursor.execute('UPDATE password_reset_requests SET processed_by = NULL WHERE processed_by = ?', (user_id,))

            # Delete the user
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))

            if cursor.rowcount == 0:
                return jsonify({'error': 'User not found'}), 404

            conn.commit()

        # Log admin action AFTER successful deletion
        enhanced_audit_logger.log_admin_action(
            action='DELETE_USER',
            details={
                'target_user_id': user_id,
                'target_username': username,
                'target_email': email,
                'profiles_deleted': profiles_deleted,
                'conversations_deleted': conversations_deleted,
                'feedback_deleted': feedback_deleted
            },
            user_id=current_user.id
        )

        return jsonify({
            'message': f'User {username} deleted successfully',
            'deleted': {
                'user': username,
                'profiles': profiles_deleted,
                'conversations': conversations_deleted,
                'feedback': feedback_deleted
            }
        }), 200

    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/groups/<int:group_id>', methods=['POST'])
@login_required
@super_admin_required
def add_user_to_group(user_id, group_id):
    """Add a user to a group (Super Admin only)."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.add_to_group(group_id)
        
        enhanced_audit_logger.log_admin_action(
            action='ADD_USER_TO_GROUP',
            details={'user_id': user_id, 'username': user.username, 'group_id': group_id},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'User added to group'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/groups/<int:group_id>', methods=['DELETE'])
@login_required
@super_admin_required
def remove_user_from_group(user_id, group_id):
    """Remove a user from a group (Super Admin only)."""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        user.remove_from_group(group_id)
        
        enhanced_audit_logger.log_admin_action(
            action='REMOVE_USER_FROM_GROUP',
            details={'user_id': user_id, 'username': user.username, 'group_id': group_id},
            user_id=current_user.id
        )
        
        return jsonify({'message': 'User removed from group'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/system/info', methods=['GET'])
@login_required
@admin_required
def get_system_info():
    """Get system information and health metrics."""
    try:
        from src.database.connection import db
        from src.__version__ import __version__, __release_date__
        import os
        import sys

        # Database stats
        stats = {}

        # Count users
        result = db.execute_one('SELECT COUNT(*) as count FROM users')
        stats['total_users'] = result['count'] if result else 0

        # Count profiles
        result = db.execute_one('SELECT COUNT(*) as count FROM profile')
        stats['total_profiles'] = result['count'] if result else 0

        # Count scenarios
        result = db.execute_one('SELECT COUNT(*) as count FROM scenarios')
        stats['total_scenarios'] = result['count'] if result else 0

        # Count audit logs
        result = db.execute_one('SELECT COUNT(*) as count FROM enhanced_audit_log')
        stats['total_audit_logs'] = result['count'] if result else 0

        # Database size
        db_path = os.path.join(os.path.dirname(__file__), '../../data/planning.db')
        if os.path.exists(db_path):
            stats['database_size_mb'] = round(os.path.getsize(db_path) / (1024 * 1024), 2)

        # System info
        stats['app_version'] = __version__
        stats['release_date'] = __release_date__
        stats['python_version'] = sys.version
        stats['system_platform'] = sys.platform

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_SYSTEM_INFO',
            user_id=current_user.id
        )

        return jsonify({'system_info': stats}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/database/schema', methods=['GET'])
@login_required
@admin_required
def get_database_schema():
    """Get complete database schema with tables and relationships."""
    import re

    def validate_identifier(name: str) -> bool:
        """Validate SQLite identifier to prevent SQL injection in PRAGMA statements."""
        # Only allow alphanumeric characters and underscores
        return bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name))

    try:
        from src.database.connection import db

        schema = {
            'tables': []
        }

        # Get all tables
        tables_result = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )

        for table_row in tables_result:
            table_name = table_row['name']

            # Validate table name before using in PRAGMA
            if not validate_identifier(table_name):
                continue

            # Get table info (columns)
            info_query = f"PRAGMA table_info({table_name})"
            columns_result = db.execute(info_query)
            columns = []

            for col in columns_result:
                columns.append({
                    'name': col['name'],
                    'type': col['type'],
                    'not_null': bool(col['notnull']),
                    'default_value': col['dflt_value'],
                    'primary_key': bool(col['pk'])
                })

            # Get foreign keys
            fk_query = f"PRAGMA foreign_key_list({table_name})"
            fk_result = db.execute(fk_query)
            foreign_keys = []

            for fk in fk_result:
                # Convert Row to dict to safely access values
                fk_dict = dict(fk)
                foreign_keys.append({
                    'column': fk_dict['from'],
                    'referenced_table': fk_dict['table'],
                    'referenced_column': fk_dict['to'],
                    'on_delete': fk_dict.get('on_delete', 'NO ACTION'),
                    'on_update': fk_dict.get('on_update', 'NO ACTION')
                })

            # Get indexes
            indexes_query = f"PRAGMA index_list({table_name})"
            indexes_result = db.execute(indexes_query)
            indexes = []

            for idx in indexes_result:
                idx_name = idx['name']
                # Validate index name before using in PRAGMA
                if not validate_identifier(idx_name):
                    continue
                idx_query = f"PRAGMA index_info({idx_name})"
                idx_info = db.execute(idx_query)
                index_columns = [col['name'] for col in idx_info]
                indexes.append({
                    'name': idx_name,
                    'unique': bool(idx['unique']),
                    'columns': index_columns
                })

            schema['tables'].append({
                'name': table_name,
                'columns': columns,
                'foreign_keys': foreign_keys,
                'indexes': indexes
            })

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_DATABASE_SCHEMA',
            user_id=current_user.id
        )

        return jsonify({'schema': schema}), 200

    except Exception as e:
        print(f"Error fetching database schema: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/reset-demo-account', methods=['POST'])
@login_required
@admin_required
def reset_demo_account():
    """Reset the demo account using the seed_demo_data.py script."""
    try:
        import subprocess
        import os
        import sys
        
        # Path to the seed script
        script_path = os.path.join(os.path.dirname(__file__), '../../scripts/seed_demo_data.py')
        
        if not os.path.exists(script_path):
            return jsonify({'error': f'Seed script not found at {script_path}'}), 500

        # Execute the script
        # Use the same python interpreter as the running app
        result = subprocess.run(
            [sys.executable, script_path], 
            capture_output=True, 
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            print(f"Demo reset script failed: {result.stderr}")
            return jsonify({'error': f'Script failed: {result.stderr}'}), 500

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RESET_DEMO_ACCOUNT',
            details={'script_output': result.stdout},
            user_id=current_user.id
        )

        return jsonify({
            'message': 'Demo account reset successfully',
            'username': 'demo',
            'password': 'demo',
            'profiles': ['Demo Junior', 'Demo Thompson', 'Demo Starman', 'Demo Dudeman']
        }), 200

    except Exception as e:
        print(f"Error resetting demo account: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/timeline', methods=['GET'])
@login_required
@admin_required
def get_user_activity_timeline(user_id: int):
    """
    Generate a human-readable narrative timeline of user actions.

    Query params:
        start_date: Optional start date (ISO format)
        end_date: Optional end date (ISO format)
        limit: Maximum number of events (default: 1000)

    Returns:
        JSON with narrative timeline describing user actions in plain English
    """
    try:
        # Get query params
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 1000, type=int)

        # Validate limit
        if limit < 1 or limit > 10000:
            return jsonify({'error': 'Limit must be between 1 and 10000'}), 400

        # Verify user exists
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Generate timeline
        timeline = audit_narrative_generator.generate_user_timeline(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )

        # Add user info
        timeline['user_info'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_active': user.is_active,
            'is_admin': user.is_admin
        }

        # Log admin access
        enhanced_audit_logger.log(
            action='ADMIN_VIEW_USER_TIMELINE',
            table_name='enhanced_audit_log',
            record_id=None,
            details={
                'target_user_id': user_id,
                'target_username': user.username,
                'start_date': start_date,
                'end_date': end_date,
                'limit': limit,
                'events_returned': timeline.get('event_count', 0)
            },
            status_code=200
        )

        return jsonify(timeline), 200

    except Exception as e:
        print(f"Error generating user timeline: {e}")
        return jsonify({'error': 'Failed to generate user timeline'}), 500


@admin_bp.route('/documentation/<doc_name>', methods=['GET'])
@login_required
@admin_required
def get_documentation(doc_name: str):
    """Serve documentation files for admin panel."""
    try:
        import os
        from flask import send_file, request

        # Whitelist of allowed documentation files
        allowed_docs = {
            'system-security': 'docs/security/SYSTEM_SECURITY_DOCUMENTATION.md',
            'user-profile-relationship': 'docs/reference/USER_PROFILE_SCENARIO_RELATIONSHIP.md',
            'asset-fields': 'docs/reference/ASSET_FIELDS_REFERENCE.md'
        }

        if doc_name not in allowed_docs:
            return jsonify({'error': 'Documentation not found'}), 404

        # Get file path relative to project root
        file_name = allowed_docs[doc_name]
        file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), file_name)

        if not os.path.exists(file_path):
            return jsonify({'error': 'Documentation file not found'}), 404

        # Check if download is requested
        download = request.args.get('download', 'false').lower() == 'true'

        # Log access
        action = 'DOWNLOAD_DOCUMENTATION' if download else 'VIEW_DOCUMENTATION'
        enhanced_audit_logger.log_admin_action(
            action=action,
            details={'document': file_name},
            user_id=current_user.id
        )

        # Serve file for inline viewing or download
        if download:
            return send_file(
                file_path,
                mimetype='text/markdown',
                as_attachment=True,
                download_name=file_name
            )
        else:
            return send_file(
                file_path,
                mimetype='text/plain',
                as_attachment=False
            )

    except Exception as e:
        print(f"Error serving documentation: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/smtp/config', methods=['GET'])
@login_required
@super_admin_required
def get_smtp_config():
    """Get current SMTP configuration (super admin only)."""
    try:
        from src.database.connection import db
        import json

        row = db.execute_one('SELECT value FROM system_config WHERE key = ?', ('smtp_config',))
        
        config = {}
        if row and row['value']:
            try:
                config = json.loads(row['value'])
            except:
                pass
        
        # Mask password
        if config.get('mail_password'):
            config['mail_password'] = '********'
            
        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_SMTP_CONFIG',
            user_id=current_user.id
        )
        
        return jsonify({'config': config}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/smtp/config', methods=['PUT'])
@login_required
@super_admin_required
def update_smtp_config():
    """Update SMTP configuration (super admin only)."""
    try:
        from src.database.connection import db
        import json
        
        # Validate input
        data = SmtpConfigSchema(**request.json)
        
        # Get existing config to handle password update
        row = db.execute_one('SELECT value FROM system_config WHERE key = ?', ('smtp_config',))
        existing_config = {}
        if row and row['value']:
            try:
                existing_config = json.loads(row['value'])
            except:
                pass
        
        # Prepare new config
        new_config = data.dict()
        
        # Handle password: if None or masked, keep existing
        if not new_config.get('mail_password') or new_config['mail_password'] == '********':
            new_config['mail_password'] = existing_config.get('mail_password')
            
        # Save to database
        config_json = json.dumps(new_config)
        
        with db.get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO system_config (key, value, updated_at, updated_by)
                VALUES (?, ?, ?, ?)
            ''', ('smtp_config', config_json, datetime.now().isoformat(), current_user.id))
            
        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='UPDATE_SMTP_CONFIG',
            details={'server': new_config.get('mail_server')},
            user_id=current_user.id
        )
        
        # Return config with masked password
        response_config = new_config.copy()
        if response_config.get('mail_password'):
            response_config['mail_password'] = '********'
            
        return jsonify({
            'message': 'SMTP configuration updated successfully',
            'config': response_config
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ============================================================================
# Backup Management Endpoints (Super Admin Only)
# ============================================================================

@admin_bp.route('/backups', methods=['GET'])
@login_required
@super_admin_required
def list_backups():
    """
    List all available backups.

    Query parameters:
        - type: Filter by type ('full', 'data', 'system', or 'all')
    """
    try:
        import os
        import glob
        from pathlib import Path

        backup_type = request.args.get('type', 'all')

        project_root = Path(__file__).parent.parent.parent
        backups_dir = project_root / 'backups'

        backups = []

        # Get full backups
        if backup_type in ['all', 'full']:
            full_backup_dir = backups_dir
            for backup_file in sorted(glob.glob(str(full_backup_dir / 'rps_backup_*.tar.gz')), reverse=True):
                stat_info = os.stat(backup_file)
                backups.append({
                    'type': 'full',
                    'filename': os.path.basename(backup_file),
                    'path': backup_file,
                    'size': stat_info.st_size,
                    'size_human': f"{stat_info.st_size / 1024:.1f} KB",
                    'created_at': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                    'timestamp': stat_info.st_mtime
                })

        # Get data backups
        if backup_type in ['all', 'data']:
            data_backup_dir = backups_dir / 'data'
            if data_backup_dir.exists():
                for backup_file in sorted(glob.glob(str(data_backup_dir / 'rps_data_*.tar.gz')), reverse=True):
                    stat_info = os.stat(backup_file)
                    backups.append({
                        'type': 'data',
                        'filename': os.path.basename(backup_file),
                        'path': backup_file,
                        'size': stat_info.st_size,
                        'size_human': f"{stat_info.st_size / 1024:.1f} KB",
                        'created_at': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        'timestamp': stat_info.st_mtime
                    })

        # Get system backups
        if backup_type in ['all', 'system']:
            system_backup_dir = backups_dir / 'system'
            if system_backup_dir.exists():
                for backup_file in sorted(glob.glob(str(system_backup_dir / 'rps_system_*.tar.gz')), reverse=True):
                    stat_info = os.stat(backup_file)
                    backups.append({
                        'type': 'system',
                        'filename': os.path.basename(backup_file),
                        'path': backup_file,
                        'size': stat_info.st_size,
                        'size_human': f"{stat_info.st_size / 1024:.1f} KB",
                        'created_at': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        'timestamp': stat_info.st_mtime
                    })

        # Sort by timestamp (newest first)
        backups.sort(key=lambda x: x['timestamp'], reverse=True)

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='LIST_BACKUPS',
            details={'backup_type': backup_type, 'count': len(backups)},
            user_id=current_user.id
        )

        return jsonify({
            'backups': backups,
            'total': len(backups)
        }), 200

    except Exception as e:
        print(f"Error listing backups: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/data', methods=['POST'])
@login_required
@super_admin_required
def run_data_backup():
    """Run a data-only backup (database)."""
    try:
        import subprocess
        import os
        from pathlib import Path

        project_root = Path(__file__).parent.parent.parent
        backup_script = project_root / 'bin' / 'backup-data'

        if not backup_script.exists():
            return jsonify({'error': 'Backup script not found'}), 500

        # Set up environment with proper PATH
        env = os.environ.copy()
        env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

        # Run backup script
        result = subprocess.run(
            [str(backup_script)],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
            cwd=str(project_root)
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RUN_DATA_BACKUP',
            details={
                'success': result.returncode == 0,
                'output': result.stdout[-500:] if result.stdout else None
            },
            user_id=current_user.id
        )

        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'Data backup completed successfully',
                'output': result.stdout
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Data backup failed',
                'error': result.stderr
            }), 500

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Backup timed out'}), 500
    except Exception as e:
        print(f"Error running data backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/system', methods=['POST'])
@login_required
@super_admin_required
def run_system_backup():
    """Run a system-only backup (configuration and scripts)."""
    try:
        import subprocess
        import os
        from pathlib import Path

        project_root = Path(__file__).parent.parent.parent
        backup_script = project_root / 'bin' / 'backup-system'

        if not backup_script.exists():
            return jsonify({'error': 'Backup script not found'}), 500

        # Set up environment with proper PATH
        env = os.environ.copy()
        env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

        # Run backup script
        result = subprocess.run(
            [str(backup_script)],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
            cwd=str(project_root)
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RUN_SYSTEM_BACKUP',
            details={
                'success': result.returncode == 0,
                'output': result.stdout[-500:] if result.stdout else None
            },
            user_id=current_user.id
        )

        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'System backup completed successfully',
                'output': result.stdout
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'System backup failed',
                'error': result.stderr
            }), 500

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Backup timed out'}), 500
    except Exception as e:
        print(f"Error running system backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/full', methods=['POST'])
@login_required
@super_admin_required
def run_full_backup():
    """Run a full backup (database, configuration, and scripts)."""
    try:
        import subprocess
        import os
        from pathlib import Path

        project_root = Path(__file__).parent.parent.parent
        backup_script = project_root / 'bin' / 'backup'

        if not backup_script.exists():
            return jsonify({'error': 'Backup script not found'}), 500

        # Set up environment with proper PATH
        env = os.environ.copy()
        env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

        # Run backup script
        result = subprocess.run(
            [str(backup_script)],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
            cwd=str(project_root)
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RUN_FULL_BACKUP',
            details={
                'success': result.returncode == 0,
                'output': result.stdout[-500:] if result.stdout else None
            },
            user_id=current_user.id
        )

        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'Full backup completed successfully',
                'output': result.stdout
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Full backup failed',
                'error': result.stderr
            }), 500

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Backup timed out'}), 500
    except Exception as e:
        print(f"Error running full backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/schedule', methods=['GET'])
@login_required
@super_admin_required
def get_backup_schedule():
    """Get current backup schedule configuration."""
    try:
        import subprocess
        from pathlib import Path

        # Check if systemd timer is installed
        result = subprocess.run(
            ['systemctl', 'list-timers', 'rps-backup.timer', '--no-pager'],
            capture_output=True,
            text=True
        )

        timer_active = 'rps-backup.timer' in result.stdout

        # Get timer details if active
        next_run = None
        last_run = None

        if timer_active:
            # Get next run time
            next_result = subprocess.run(
                ['systemctl', 'show', 'rps-backup.timer', '--property=NextElapseUSecRealtime', '--value'],
                capture_output=True,
                text=True
            )

            # Get last run time
            last_result = subprocess.run(
                ['systemctl', 'show', 'rps-backup.timer', '--property=LastTriggerUSec', '--value'],
                capture_output=True,
                text=True
            )

            next_run = next_result.stdout.strip() if next_result.returncode == 0 else None
            last_run = last_result.stdout.strip() if last_result.returncode == 0 else None

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_BACKUP_SCHEDULE',
            details={'timer_active': timer_active},
            user_id=current_user.id
        )

        return jsonify({
            'timer_installed': timer_active,
            'enabled': timer_active,
            'next_run': next_run,
            'last_run': last_run,
            'schedule': 'Daily at 2:00 AM' if timer_active else None
        }), 200

    except Exception as e:
        print(f"Error getting backup schedule: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/<backup_type>/<filename>/metadata', methods=['GET'])
@login_required
@super_admin_required
def get_backup_metadata(backup_type: str, filename: str):
    """Get metadata from a backup file."""
    try:
        import tarfile
        import tempfile
        from pathlib import Path

        # Validate backup type
        if backup_type not in ['full', 'data', 'system']:
            return jsonify({'error': 'Invalid backup type'}), 400

        # Construct path
        project_root = Path(__file__).parent.parent.parent
        if backup_type == 'full':
            backup_path = project_root / 'backups' / filename
        else:
            backup_path = project_root / 'backups' / backup_type / filename

        if not backup_path.exists():
            return jsonify({'error': 'Backup file not found'}), 404

        # Extract metadata from backup
        with tarfile.open(backup_path, 'r:gz') as tar:
            # Find metadata file
            metadata_files = [m for m in tar.getmembers() if m.name.endswith('backup_metadata.txt')]

            if metadata_files:
                metadata_file = metadata_files[0]
                f = tar.extractfile(metadata_file)
                metadata_content = f.read().decode('utf-8')

                # Parse metadata into dict
                metadata = {}
                for line in metadata_content.split('\n'):
                    if ':' in line:
                        key, value = line.split(':', 1)
                        metadata[key.strip()] = value.strip()

                # Get list of files in backup
                files = [m.name for m in tar.getmembers() if m.isfile()]

                return jsonify({
                    'metadata': metadata,
                    'files': files,
                    'file_count': len(files)
                }), 200
            else:
                return jsonify({'error': 'No metadata found in backup'}), 404

    except Exception as e:
        print(f"Error getting backup metadata: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/restore', methods=['POST'])
@login_required
@super_admin_required
def restore_backup():
    """
    Restore from a backup file.

    Request body:
        - backup_type: 'full', 'data', or 'system'
        - filename: Name of the backup file
        - restore_type: 'full', 'database', or 'config' (optional, defaults to based on backup_type)
    """
    try:
        import subprocess
        import os
        from pathlib import Path

        data = request.get_json()
        backup_type = data.get('backup_type')
        filename = data.get('filename')
        restore_type = data.get('restore_type', 'full')

        if not backup_type or not filename:
            return jsonify({'error': 'Missing required parameters'}), 400

        if backup_type not in ['full', 'data', 'system']:
            return jsonify({'error': 'Invalid backup type'}), 400

        # Construct backup path
        project_root = Path(__file__).parent.parent.parent
        if backup_type == 'full':
            backup_path = project_root / 'backups' / filename
        else:
            backup_path = project_root / 'backups' / backup_type / filename

        if not backup_path.exists():
            return jsonify({'error': 'Backup file not found'}), 404

        # Use the restore script
        restore_script = project_root / 'bin' / 'restore'
        if not restore_script.exists():
            return jsonify({'error': 'Restore script not found'}), 500

        # Set up environment
        env = os.environ.copy()
        env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

        # Build command arguments
        cmd = [
            str(restore_script),
            '--backup', str(backup_path),
            '--type', restore_type,
            '--yes'  # Skip confirmation prompts
        ]

        # Run restore script
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 2 minutes for restore
            env=env,
            cwd=str(project_root)
        )

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RESTORE_BACKUP',
            details={
                'backup_type': backup_type,
                'filename': filename,
                'restore_type': restore_type,
                'success': result.returncode == 0,
                'output': result.stdout[-500:] if result.stdout else None
            },
            user_id=current_user.id
        )

        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'Restore completed successfully',
                'output': result.stdout,
                'warning': 'Please restart the application for changes to take effect'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Restore failed',
                'error': result.stderr,
                'output': result.stdout
            }), 500

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Restore timed out'}), 500
    except Exception as e:
        print(f"Error restoring backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/<backup_type>/<filename>', methods=['DELETE'])
@login_required
@super_admin_required
def delete_backup(backup_type: str, filename: str):
    """
    Delete a backup file.

    Path parameters:
        - backup_type: 'full', 'data', or 'system'
        - filename: Name of the backup file to delete
    """
    try:
        import os
        from pathlib import Path

        # Validate backup type
        if backup_type not in ['full', 'data', 'system']:
            return jsonify({'error': 'Invalid backup type'}), 400

        # Validate filename to prevent directory traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400

        # Construct path
        project_root = Path(__file__).parent.parent.parent
        if backup_type == 'full':
            backup_path = project_root / 'backups' / filename
        else:
            backup_path = project_root / 'backups' / backup_type / filename

        if not backup_path.exists():
            return jsonify({'error': 'Backup file not found'}), 404

        # Get file info before deletion
        file_size = backup_path.stat().st_size

        # Delete the file
        os.remove(str(backup_path))

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='DELETE_BACKUP',
            details={
                'backup_type': backup_type,
                'filename': filename,
                'size_bytes': file_size
            },
            user_id=current_user.id
        )

        return jsonify({
            'success': True,
            'message': f'Backup {filename} deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting backup: {e}")
        return jsonify({'error': str(e)}), 500


# ==========================================
# REPORTS
# ==========================================

@admin_bp.route('/reports/users-by-location', methods=['GET'])
@login_required
@super_admin_required
def get_users_by_location_report():
    """
    Generate a comprehensive report showing which users access the system from which locations.

    Super-admin only endpoint that provides:
    - User access patterns by location
    - Multiple location detection
    - Security alerts for unusual patterns
    - Timeline of location changes

    Query parameters:
        - days: Number of days to analyze (default: 30, max: 365)
    """
    try:
        days = request.args.get('days', 30, type=int)
        days = min(max(days, 1), 365)  # Between 1 and 365 days

        from src.database.connection import db
        from src.auth.models import User

        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()

        # Get all users with their access patterns by location
        # Include all actions with geolocation data to get complete IP/location picture
        query = '''
            SELECT
                l.user_id,
                l.ip_address,
                l.geo_location,
                COUNT(*) as access_count,
                MIN(l.created_at) as first_access,
                MAX(l.created_at) as last_access,
                l.action
            FROM enhanced_audit_log l
            WHERE l.created_at >= ?
            AND l.user_id IS NOT NULL
            AND l.geo_location IS NOT NULL
            AND l.ip_address IS NOT NULL
            GROUP BY l.user_id, l.ip_address, l.geo_location
            ORDER BY l.user_id, access_count DESC
        '''

        rows = db.execute(query, (cutoff_date,))

        # Organize data by user
        users_by_location = {}

        for row in rows:
            user_id = row['user_id']

            if user_id not in users_by_location:
                # Get user details
                user = User.get_by_id(user_id)
                if not user:
                    continue

                users_by_location[user_id] = {
                    'user_id': user_id,
                    'username': user.username,
                    'email': user.email,
                    'is_active': user.is_active,
                    'locations': [],
                    'total_accesses': 0,
                    'unique_locations': 0,
                    'unique_ips': set(),
                    'first_seen': None,
                    'last_seen': None,
                    'security_flags': []
                }

            # Parse geolocation
            try:
                geo = json.loads(row['geo_location'])

                # Only process if we have valid coordinates
                if not (geo.get('lat') and geo.get('lon')):
                    continue

                location_data = {
                    'ip_address': row['ip_address'],
                    'city': geo.get('city', 'Unknown'),
                    'region': geo.get('region', 'Unknown'),
                    'country': geo.get('country', 'Unknown'),
                    'lat': geo.get('lat'),
                    'lon': geo.get('lon'),
                    'access_count': row['access_count'],
                    'first_access': row['first_access'],
                    'last_access': row['last_access']
                }

                users_by_location[user_id]['locations'].append(location_data)
                users_by_location[user_id]['total_accesses'] += row['access_count']
                users_by_location[user_id]['unique_ips'].add(row['ip_address'])

                # Update first/last seen
                if not users_by_location[user_id]['first_seen'] or row['first_access'] < users_by_location[user_id]['first_seen']:
                    users_by_location[user_id]['first_seen'] = row['first_access']

                if not users_by_location[user_id]['last_seen'] or row['last_access'] > users_by_location[user_id]['last_seen']:
                    users_by_location[user_id]['last_seen'] = row['last_access']

            except (json.JSONDecodeError, TypeError):
                continue

        # Calculate security flags and finalize data
        for user_id, user_data in users_by_location.items():
            user_data['unique_locations'] = len(user_data['locations'])
            user_data['unique_ips'] = len(user_data['unique_ips'])

            # Security flags
            if user_data['unique_locations'] > 5:
                user_data['security_flags'].append({
                    'type': 'MULTIPLE_LOCATIONS',
                    'severity': 'medium',
                    'message': f"User accessed from {user_data['unique_locations']} different locations"
                })

            if user_data['unique_ips'] > 10:
                user_data['security_flags'].append({
                    'type': 'MULTIPLE_IPS',
                    'severity': 'medium',
                    'message': f"User accessed from {user_data['unique_ips']} different IP addresses"
                })

            # Check for rapid location changes (within 1 hour from different locations)
            locations_sorted = sorted(user_data['locations'], key=lambda x: x['last_access'])
            for i in range(len(locations_sorted) - 1):
                loc1 = locations_sorted[i]
                loc2 = locations_sorted[i + 1]

                # Different cities within short time
                if loc1['city'] != loc2['city']:
                    time1 = datetime.fromisoformat(loc1['last_access'])
                    time2 = datetime.fromisoformat(loc2['first_access'])

                    if (time2 - time1).total_seconds() < 3600:  # Less than 1 hour
                        user_data['security_flags'].append({
                            'type': 'RAPID_LOCATION_CHANGE',
                            'severity': 'high',
                            'message': f"Location changed from {loc1['city']} to {loc2['city']} within 1 hour"
                        })
                        break  # Only flag once

        # Convert to list and sort by total accesses
        result = sorted(users_by_location.values(), key=lambda x: x['total_accesses'], reverse=True)

        # Generate summary statistics
        # Calculate unique IPs across all users
        all_unique_ips = set()
        for u in result:
            all_unique_ips.update(u['unique_ips'] if isinstance(u.get('unique_ips'), set) else
                                [loc['ip_address'] for loc in u.get('locations', [])])

        summary = {
            'total_users': len(result),
            'total_locations': sum(u['unique_locations'] for u in result),
            'unique_ip_addresses': len(all_unique_ips),
            'users_with_multiple_locations': len([u for u in result if u['unique_locations'] > 1]),
            'users_with_security_flags': len([u for u in result if u['security_flags']]),
            'period_days': days,
            'generated_at': datetime.now().isoformat()
        }

        # Log the report access
        enhanced_audit_logger.log_admin_action(
            action='VIEW_USERS_BY_LOCATION_REPORT',
            details={'period_days': days, 'users_analyzed': len(result)},
            user_id=current_user.id
        )

        response = jsonify({
            'summary': summary,
            'users': result
        })

        # Prevent browser caching - report data changes frequently
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response, 200

    except Exception as e:
        print(f"Error generating users-by-location report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/reports/user-activity', methods=['GET'])
@login_required
@admin_required
@limiter.limit("100 per minute")
def get_user_activity_report():
    """
    Generate comprehensive user activity report with filtering.

    Query Parameters:
    - user_ids: Comma-separated list of user IDs to filter (optional)
    - start_date: ISO format start date (optional)
    - end_date: ISO format end date (optional)
    - action_types: Comma-separated list of action types to filter (optional)
    - days: Number of days to look back (default: 30)
    """
    try:
        # Parse query parameters
        user_ids_param = request.args.get('user_ids', '')
        user_ids = [int(uid.strip()) for uid in user_ids_param.split(',') if uid.strip().isdigit()] if user_ids_param else []

        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        action_types_param = request.args.get('action_types', '')
        action_types = [at.strip() for at in action_types_param.split(',') if at.strip()] if action_types_param else []

        days = int(request.args.get('days', 30))
        if days < 1 or days > 365:
            days = 30

        # Calculate date range if not provided
        if not start_date:
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')

        # Build base query - get activity grouped by user
        where_clauses = ["al.created_at >= ? AND al.created_at <= ?"]
        params = [start_date + ' 00:00:00', end_date + ' 23:59:59']

        # Filter by user_ids if provided
        if user_ids:
            placeholders = ','.join(['?'] * len(user_ids))
            where_clauses.append(f"al.user_id IN ({placeholders})")
            params.extend(user_ids)

        # Filter by action types if provided
        if action_types:
            placeholders = ','.join(['?'] * len(action_types))
            where_clauses.append(f"al.action IN ({placeholders})")
            params.extend(action_types)

        where_sql = ' AND '.join(where_clauses)

        # Query for user activity summary
        activity_query = f"""
            SELECT
                u.id as user_id,
                u.username,
                u.email,
                COUNT(*) as total_actions,
                COUNT(DISTINCT DATE(al.created_at)) as active_days,
                MIN(al.created_at) as first_activity,
                MAX(al.created_at) as last_activity,
                COUNT(DISTINCT al.ip_address) as unique_ips,
                SUM(CASE WHEN al.status_code >= 400 THEN 1 ELSE 0 END) as failed_actions,
                SUM(CASE WHEN al.action = 'LOGIN_ATTEMPT' THEN 1 ELSE 0 END) as login_attempts,
                SUM(CASE WHEN al.action = 'CREATE' THEN 1 ELSE 0 END) as creates,
                SUM(CASE WHEN al.action = 'UPDATE' THEN 1 ELSE 0 END) as updates,
                SUM(CASE WHEN al.action = 'DELETE' THEN 1 ELSE 0 END) as deletes,
                SUM(CASE WHEN al.action = 'READ' THEN 1 ELSE 0 END) as reads,
                SUM(CASE WHEN al.action LIKE 'ADMIN%' THEN 1 ELSE 0 END) as admin_actions
            FROM enhanced_audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE {where_sql}
            GROUP BY u.id, u.username, u.email
            ORDER BY total_actions DESC
        """

        user_activity_rows = db.execute(activity_query, params)
        users_activity = []

        for row in user_activity_rows:
            user_data = dict(row)

            # Get top actions for this user
            top_actions_query = f"""
                SELECT action, COUNT(*) as count
                FROM enhanced_audit_log
                WHERE user_id = ?
                AND created_at >= ? AND created_at <= ?
                {'AND action IN (' + ','.join(['?'] * len(action_types)) + ')' if action_types else ''}
                GROUP BY action
                ORDER BY count DESC
                LIMIT 5
            """
            top_actions_params = [user_data['user_id'], start_date + ' 00:00:00', end_date + ' 23:59:59']
            if action_types:
                top_actions_params.extend(action_types)

            top_actions_rows = db.execute(top_actions_query, top_actions_params)
            user_data['top_actions'] = [{'action': r['action'], 'count': r['count']} for r in top_actions_rows]

            # Get most active tables for this user
            top_tables_query = f"""
                SELECT table_name, COUNT(*) as count
                FROM enhanced_audit_log
                WHERE user_id = ?
                AND created_at >= ? AND created_at <= ?
                AND table_name IS NOT NULL
                {'AND action IN (' + ','.join(['?'] * len(action_types)) + ')' if action_types else ''}
                GROUP BY table_name
                ORDER BY count DESC
                LIMIT 5
            """
            top_tables_params = [user_data['user_id'], start_date + ' 00:00:00', end_date + ' 23:59:59']
            if action_types:
                top_tables_params.extend(action_types)

            top_tables_rows = db.execute(top_tables_query, top_tables_params)
            user_data['top_tables'] = [{'table': r['table_name'], 'count': r['count']} for r in top_tables_rows]

            # Get daily activity pattern
            daily_query = f"""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM enhanced_audit_log
                WHERE user_id = ?
                AND created_at >= ? AND created_at <= ?
                {'AND action IN (' + ','.join(['?'] * len(action_types)) + ')' if action_types else ''}
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            """
            daily_params = [user_data['user_id'], start_date + ' 00:00:00', end_date + ' 23:59:59']
            if action_types:
                daily_params.extend(action_types)

            daily_rows = db.execute(daily_query, daily_params)
            user_data['daily_activity'] = [{'date': r['date'], 'count': r['count']} for r in daily_rows]

            users_activity.append(user_data)

        # Generate summary statistics
        total_users = len(users_activity)
        total_actions = sum(u['total_actions'] for u in users_activity)
        total_failed = sum(u['failed_actions'] for u in users_activity)
        total_login_attempts = sum(u['login_attempts'] for u in users_activity)
        avg_actions_per_user = total_actions / total_users if total_users > 0 else 0
        most_active_user = users_activity[0] if users_activity else None

        # Get overall action distribution
        action_dist_query = f"""
            SELECT action, COUNT(*) as count
            FROM enhanced_audit_log al
            WHERE {where_sql}
            GROUP BY action
            ORDER BY count DESC
        """
        action_dist_rows = db.execute(action_dist_query, params)
        action_distribution = [{'action': r['action'], 'count': r['count']} for r in action_dist_rows]

        summary = {
            'total_users': total_users,
            'total_actions': total_actions,
            'total_failed_actions': total_failed,
            'total_login_attempts': total_login_attempts,
            'avg_actions_per_user': round(avg_actions_per_user, 2),
            'most_active_user': most_active_user['username'] if most_active_user else None,
            'most_active_user_actions': most_active_user['total_actions'] if most_active_user else 0,
            'period_start': start_date,
            'period_end': end_date,
            'action_distribution': action_distribution,
            'generated_at': datetime.now().isoformat()
        }

        # Log report access
        enhanced_audit_logger.log_admin_action(
            action='VIEW_USER_ACTIVITY_REPORT',
            details={
                'user_count': total_users,
                'filtered_user_ids': user_ids if user_ids else 'all',
                'date_range': f"{start_date} to {end_date}",
                'action_types': action_types if action_types else 'all'
            },
            user_id=current_user.id
        )

        response = jsonify({
            'summary': summary,
            'users': users_activity
        })

        # Prevent browser caching
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response, 200

    except Exception as e:
        print(f"Error generating user activity report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/password-requests', methods=['GET'])
@admin_required
def list_password_requests():
    """List pending password reset requests."""
    requests = PasswordResetRequest.get_pending()
    return jsonify(requests), 200

@admin_bp.route('/password-requests/<int:request_id>/reset', methods=['POST'])
@admin_required
def process_password_reset(request_id):
    """Process a password reset request."""
    # ... existing implementation ...
    pass # placeholder for search match

# ============================================================================
# User Backup Summary & Bulk Operations
# ============================================================================

@admin_bp.route('/backups/users/summary', methods=['GET'])
@login_required
@admin_required
def get_users_backup_summary():
    """Get summary of users and their backup status for bulk management."""
    try:
        from src.database.connection import db
        
        # Base query for users managed by this admin
        if current_user.is_super_admin:
            sql = '''
                SELECT u.id, u.username, u.email, 
                       (SELECT COUNT(*) FROM profile WHERE user_id = u.id) as profile_count,
                       (SELECT COUNT(*) FROM user_backups WHERE user_id = u.id) as backup_count,
                       (SELECT MAX(created_at) FROM user_backups WHERE user_id = u.id) as last_backup
                FROM users u
                ORDER BY u.username
            '''
            params = ()
        else:
             # Local admin: only users in their managed groups
             sql = '''
                SELECT DISTINCT u.id, u.username, u.email,
                       (SELECT COUNT(*) FROM profile WHERE user_id = u.id) as profile_count,
                       (SELECT COUNT(*) FROM user_backups WHERE user_id = u.id) as backup_count,
                       (SELECT MAX(created_at) FROM user_backups WHERE user_id = u.id) as last_backup
                FROM users u
                JOIN user_groups ug ON u.id = ug.user_id
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ?
                ORDER BY u.username
             '''
             params = (current_user.id,)
             
        rows = db.execute(sql, params)
        users = [dict(row) for row in rows]
        return jsonify({'users': users}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backups/users/bulk-create', methods=['POST'])
@login_required
@admin_required
def bulk_create_user_backups():
    """Create backups for multiple users."""
    from src.services.user_backup_service import UserBackupService
    data = request.json
    user_ids = data.get('user_ids', [])
    label = data.get('label', f"Bulk Backup {datetime.now().strftime('%Y-%m-%d')}")
    
    results = []
    success_count = 0
    
    for uid in user_ids:
        # Check permissions
        if not current_user.can_manage_user(uid):
            results.append({'user_id': uid, 'status': 'error', 'error': 'Unauthorized'})
            continue
            
        try:
            res = UserBackupService.create_backup(uid, label)
            results.append({'user_id': uid, 'status': 'success'})
            success_count += 1
        except Exception as e:
            results.append({'user_id': uid, 'status': 'error', 'error': str(e)})
            
    enhanced_audit_logger.log_admin_action(
        action='BULK_CREATE_BACKUP',
        details={'count': success_count, 'total_requested': len(user_ids)},
        user_id=current_user.id
    )
    
    return jsonify({'results': results, 'success_count': success_count}), 200


@admin_bp.route('/backups/users/bulk-restore', methods=['POST'])
@login_required
@admin_required
def bulk_restore_user_backups():
    """Restore the latest backup for multiple users."""
    from src.services.user_backup_service import UserBackupService
    data = request.json
    user_ids = data.get('user_ids', [])
    
    results = []
    success_count = 0
    
    for uid in user_ids:
        if not current_user.can_manage_user(uid):
            results.append({'user_id': uid, 'status': 'error', 'error': 'Unauthorized'})
            continue

        try:
            # Get latest backup
            backups = UserBackupService.list_backups(uid)
            if not backups:
                results.append({'user_id': uid, 'status': 'error', 'error': 'No backups found'})
                continue
                
            latest_backup = backups[0]
            
            # Create safety backup
            try:
                UserBackupService.create_backup(uid, f"Pre-restore Safety (Bulk Admin)")
            except Exception as e:
                print(f"Safety backup failed for user {uid}: {e}")
            
            # Restore
            UserBackupService.restore_backup(uid, latest_backup['id'])
            results.append({'user_id': uid, 'status': 'success', 'restored_backup_id': latest_backup['id']})
            success_count += 1
            
        except Exception as e:
            results.append({'user_id': uid, 'status': 'error', 'error': str(e)})

    enhanced_audit_logger.log_admin_action(
        action='BULK_RESTORE_BACKUP',
        details={'count': success_count, 'total_requested': len(user_ids)},
        user_id=current_user.id
    )

    return jsonify({'results': results, 'success_count': success_count}), 200


# ============================================================================
# User-Specific Backup Management (Admin)
# ============================================================================

@admin_bp.route('/users/<int:user_id>/backups', methods=['GET'])
@login_required
@admin_required
def list_user_backups(user_id):
    """List all backups for a specific user."""
    from src.services.user_backup_service import UserBackupService
    try:
        # Check permissions
        if not current_user.is_super_admin:
            # Check if user is in a group managed by this admin
            from src.database.connection import db
            managed = db.execute_one('''
                SELECT 1 FROM user_groups ug
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ? AND ug.user_id = ?
            ''', (current_user.id, user_id))
            if not managed:
                return jsonify({'error': 'Unauthorized to manage this user'}), 403

        backups = UserBackupService.list_backups(user_id)
        return jsonify({'backups': backups}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/backups', methods=['POST'])
@login_required
@admin_required
def create_user_backup(user_id):
    """Create a new backup for a specific user."""
    from src.services.user_backup_service import UserBackupService
    try:
        # Check permissions
        if not current_user.is_super_admin:
            from src.database.connection import db
            managed = db.execute_one('''
                SELECT 1 FROM user_groups ug
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ? AND ug.user_id = ?
            ''', (current_user.id, user_id))
            if not managed:
                return jsonify({'error': 'Unauthorized to manage this user'}), 403

        data = request.json or {}
        label = data.get('label', f"Admin Backup by {current_user.username}")
        
        result = UserBackupService.create_backup(user_id, label)
        
        enhanced_audit_logger.log_admin_action(
            action='CREATE_USER_BACKUP_ADMIN',
            details={'target_user_id': user_id, 'backup': result},
            user_id=current_user.id
        )
        
        return jsonify({
            'message': 'Backup created successfully',
            'backup': result
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/backups/<int:backup_id>/restore', methods=['POST'])
@login_required
@admin_required
def restore_user_backup(user_id, backup_id):
    """Restore data from a specific backup for a user."""
    from src.services.user_backup_service import UserBackupService
    try:
        # Check permissions
        if not current_user.is_super_admin:
            from src.database.connection import db
            managed = db.execute_one('''
                SELECT 1 FROM user_groups ug
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ? AND ug.user_id = ?
            ''', (current_user.id, user_id))
            if not managed:
                return jsonify({'error': 'Unauthorized to manage this user'}), 403

        # Create safety backup first
        try:
            UserBackupService.create_backup(user_id, f"Pre-restore Safety Backup (Admin: {current_user.username})")
        except Exception as e:
            print(f"Admin safety backup failed: {e}")

        result = UserBackupService.restore_backup(user_id, backup_id)
        
        enhanced_audit_logger.log_admin_action(
            action='RESTORE_USER_BACKUP_ADMIN',
            details={'target_user_id': user_id, 'backup_id': backup_id, 'result': result},
            user_id=current_user.id
        )
        
        return jsonify({
            'message': 'User data restored successfully',
            'details': result
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/backups/<int:backup_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user_backup(user_id, backup_id):
    """Delete a user backup."""
    from src.services.user_backup_service import UserBackupService
    try:
        # Check permissions
        if not current_user.is_super_admin:
            from src.database.connection import db
            managed = db.execute_one('''
                SELECT 1 FROM user_groups ug
                JOIN admin_groups ag ON ug.group_id = ag.group_id
                WHERE ag.user_id = ? AND ug.user_id = ?
            ''', (current_user.id, user_id))
            if not managed:
                return jsonify({'error': 'Unauthorized to manage this user'}), 403

        UserBackupService.delete_backup(user_id, backup_id)

        enhanced_audit_logger.log_admin_action(
            action='DELETE_USER_BACKUP_ADMIN',
            details={'target_user_id': user_id, 'backup_id': backup_id},
            user_id=current_user.id
        )

        return jsonify({'message': 'Backup deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# Selective Backup Routes (Profile/Group-based backups)
# =============================================================================

@admin_bp.route('/backup/selective/profiles', methods=['GET'])
@limiter.limit("60 per minute")
@login_required
@super_admin_required
def get_profiles_for_backup():
    """Get all profiles with user and group information for backup selection."""
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        profiles = SelectiveBackupService.get_all_profiles_with_details()
        return jsonify({'profiles': profiles}), 200
    except Exception as e:
        print(f"Error getting profiles for backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective/groups', methods=['GET'])
@limiter.limit("60 per minute")
@login_required
@super_admin_required
def get_groups_for_backup():
    """Get all groups with member and profile counts for backup selection."""
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        groups = SelectiveBackupService.get_all_groups_with_profile_counts()
        return jsonify({'groups': groups}), 200
    except Exception as e:
        print(f"Error getting groups for backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective', methods=['GET'])
@limiter.limit("60 per minute")
@login_required
@super_admin_required
def list_selective_backups():
    """List all selective backups."""
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        backups = SelectiveBackupService.list_backups()

        enhanced_audit_logger.log_admin_action(
            action='LIST_SELECTIVE_BACKUPS',
            details={'count': len(backups)},
            user_id=current_user.id
        )

        return jsonify({'backups': backups}), 200
    except Exception as e:
        print(f"Error listing selective backups: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective', methods=['POST'])
@limiter.limit("10 per minute")
@login_required
@super_admin_required
def create_selective_backup():
    """
    Create a selective backup of specific profiles or groups.

    Request body:
        - profile_ids: List of profile IDs to backup (optional)
        - group_ids: List of group IDs to backup all profiles from (optional)
        - label: Optional label for the backup
    """
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        data = request.get_json() or {}
        profile_ids = data.get('profile_ids', [])
        group_ids = data.get('group_ids', [])
        label = data.get('label')

        if not profile_ids and not group_ids:
            return jsonify({'error': 'Must specify profile_ids or group_ids'}), 400

        result = SelectiveBackupService.create_backup(
            profile_ids=profile_ids,
            group_ids=group_ids,
            label=label,
            created_by=current_user.id
        )

        enhanced_audit_logger.log_admin_action(
            action='CREATE_SELECTIVE_BACKUP',
            details={
                'profile_ids': profile_ids,
                'group_ids': group_ids,
                'label': label,
                'result': result
            },
            user_id=current_user.id
        )

        return jsonify({
            'success': True,
            'message': f"Backup created with {result['profile_count']} profiles",
            'backup': result
        }), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Error creating selective backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective/<filename>', methods=['GET'])
@limiter.limit("60 per minute")
@login_required
@super_admin_required
def get_selective_backup_details(filename: str):
    """Get detailed information about a selective backup."""
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        details = SelectiveBackupService.get_backup_details(filename)
        return jsonify(details), 200
    except FileNotFoundError:
        return jsonify({'error': 'Backup not found'}), 404
    except Exception as e:
        print(f"Error getting selective backup details: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective/<filename>/restore', methods=['POST'])
@limiter.limit("5 per minute")
@login_required
@super_admin_required
def restore_selective_backup(filename: str):
    """
    Restore profiles from a selective backup.

    Request body:
        - profile_ids: Optional list of profile IDs to restore (restores all if not specified)
        - restore_mode: 'merge' (default) or 'replace'
    """
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        data = request.get_json() or {}
        profile_ids = data.get('profile_ids')
        restore_mode = data.get('restore_mode', 'merge')

        if restore_mode not in ['merge', 'replace']:
            return jsonify({'error': 'Invalid restore_mode. Must be "merge" or "replace"'}), 400

        result = SelectiveBackupService.restore_backup(
            filename=filename,
            profile_ids=profile_ids,
            restore_mode=restore_mode
        )

        enhanced_audit_logger.log_admin_action(
            action='RESTORE_SELECTIVE_BACKUP',
            details={
                'filename': filename,
                'profile_ids': profile_ids,
                'restore_mode': restore_mode,
                'result': result
            },
            user_id=current_user.id
        )

        if result.get('success'):
            return jsonify({
                'success': True,
                'message': f"Restored {result['profiles_restored']} profiles, updated {result['profiles_updated']}",
                'result': result
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Restore completed with errors',
                'result': result
            }), 207  # Multi-Status

    except FileNotFoundError:
        return jsonify({'error': 'Backup not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"Error restoring selective backup: {e}")
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/backup/selective/<filename>', methods=['DELETE'])
@limiter.limit("10 per minute")
@login_required
@super_admin_required
def delete_selective_backup(filename: str):
    """Delete a selective backup file."""
    from src.services.selective_backup_service import SelectiveBackupService

    try:
        SelectiveBackupService.delete_backup(filename)

        enhanced_audit_logger.log_admin_action(
            action='DELETE_SELECTIVE_BACKUP',
            details={'filename': filename},
            user_id=current_user.id
        )

        return jsonify({
            'success': True,
            'message': 'Backup deleted successfully'
        }), 200

    except FileNotFoundError:
        return jsonify({'error': 'Backup not found'}), 404
    except Exception as e:
        print(f"Error deleting selective backup: {e}")
        return jsonify({'error': str(e)}), 500
