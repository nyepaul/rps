"""Admin routes for managing audit logs and system configuration."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
from src.auth.admin_required import admin_required
from src.auth.super_admin_required import super_admin_required
from src.services.enhanced_audit_logger import enhanced_audit_logger, AuditConfig
from src.auth.models import User
from datetime import datetime

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


@admin_bp.route('/logs', methods=['GET'])
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
        user_id = request.args.get('user_id', type=int)
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

        return jsonify({
            'statistics': stats,
            'period_days': days
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/<int:log_id>', methods=['GET'])
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
    """List all users in the system."""
    try:
        from src.database.connection import db

        rows = db.execute('SELECT id, username, email, is_active, is_admin, is_super_admin, created_at, last_login FROM users ORDER BY created_at DESC')
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
        # Validate input
        data = UserUpdateSchema(**request.json)

        # Get user
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Prevent self-demotion
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
            'message': message,
            'dek_lost': dek_was_lost,
            'warning': 'User will lose access to all encrypted data' if dek_was_lost else None,
            'user': {
                'id': user.id,
                'username': user.username
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 400


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


@admin_bp.route('/system/info', methods=['GET'])
@login_required
@admin_required
def get_system_info():
    """Get system information and health metrics."""
    try:
        from src.database.connection import db
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
            'system-security': 'SYSTEM_SECURITY_DOCUMENTATION.md',
            'user-profile-relationship': 'USER_PROFILE_SCENARIO_RELATIONSHIP.md',
            'asset-fields': 'ASSET_FIELDS_REFERENCE.md'
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
