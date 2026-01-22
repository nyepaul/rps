"""Admin routes for managing audit logs and system configuration."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
from src.auth.admin_required import admin_required
from src.auth.super_admin_required import super_admin_required
from src.services.enhanced_audit_logger import enhanced_audit_logger, AuditConfig
from src.services.audit_narrative_generator import audit_narrative_generator
from src.auth.models import User, PasswordResetRequest
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

        return jsonify({
            'statistics': stats,
            'period_days': days
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/logs/ip-locations', methods=['GET'])
@limiter.limit("60 per minute")  # Moderate limit for IP location data
@login_required
@admin_required
def get_ip_locations():
    """
    Get all unique IP addresses with geolocation data for mapping.

    Returns:
        List of unique IP locations with coordinates and access counts
    """
    try:
        locations = enhanced_audit_logger.get_unique_ip_locations()

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='VIEW_IP_LOCATIONS',
            details={'location_count': len(locations)},
            user_id=current_user.id
        )

        return jsonify({
            'locations': locations,
            'total': len(locations)
        }), 200

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
            columns_result = db.execute(f"PRAGMA table_info({table_name})")
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
            fk_result = db.execute(f"PRAGMA foreign_key_list({table_name})")
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
            indexes_result = db.execute(f"PRAGMA index_list({table_name})")
            indexes = []

            for idx in indexes_result:
                idx_name = idx['name']
                # Validate index name before using in PRAGMA
                if not validate_identifier(idx_name):
                    continue
                idx_info = db.execute(f"PRAGMA index_info({idx_name})")
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
    """Reset the demo account with comprehensive default profile data."""
    try:
        from src.database.connection import db
        from src.models.profile import Profile
        from datetime import datetime, date
        from dateutil.relativedelta import relativedelta

        # Demo user credentials
        import os
        demo_username = 'demo'
        demo_password = os.environ.get('DEMO_PASSWORD', 'demo1234')  # Default for development
        demo_email = 'demo@example.com'

        # Find or create demo user
        demo_user = User.get_by_username(demo_username)

        if not demo_user:
            # Create demo user
            demo_user = User(
                id=None,
                username=demo_username,
                email=demo_email,
                password_hash=User.hash_password(demo_password),
                is_active=True,
                is_admin=False
            )
            demo_user.save()
            demo_user = User.get_by_username(demo_username)  # Reload to get ID
        else:
            # Reset password
            demo_user.password_hash = User.hash_password(demo_password)
            with db.get_connection() as conn:
                conn.execute(
                    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
                    (demo_user.password_hash, datetime.now().isoformat(), demo_user.id)
                )

        # Delete all existing profiles, action items, scenarios and conversations for demo user
        with db.get_connection() as conn:
            conn.execute('DELETE FROM profile WHERE user_id = ?', (demo_user.id,))
            conn.execute('DELETE FROM action_items WHERE user_id = ?', (demo_user.id,))
            conn.execute('DELETE FROM scenarios WHERE user_id = ?', (demo_user.id,))
            conn.execute('DELETE FROM conversations WHERE user_id = ?', (demo_user.id,))

        # Create comprehensive demo profile
        today = date.today()
        birth_date = date(1971, 1, 18)  # Born January 18, 1971 (age 55 in 2026)
        retirement_date = date(2036, 1, 18)  # Retire at 65
        spouse_birth_date = date(1973, 10, 4)  # Born October 4, 1973 (age 53 in 2026)
        spouse_retirement_date = date(2038, 10, 4)  # Retire at 65

        # Child 1: 18 years old, just starting college
        child1_birth = date(2008, 9, 10)  # Born September 10, 2008 (age 18 in 2026)
        # Child 2: 19 years old, just starting college (2nd year)
        child2_birth = date(2007, 4, 5)  # Born April 5, 2007 (age 19 in 2026)

        demo_data = {
            "person": {
                "name": "Chris Thompson",
                "birth_date": birth_date.isoformat(),
                "retirement_date": retirement_date.isoformat(),
                "current_age": 55,
                "retirement_age": 65,
                "life_expectancy": 95,
                "email": "chris.thompson@example.com",
                "phone": "(415) 555-0123"
            },
            "spouse": {
                "name": "Jamie Thompson",
                "birth_date": spouse_birth_date.isoformat(),
                "retirement_date": spouse_retirement_date.isoformat(),
                "current_age": 53,
                "retirement_age": 65,
                "life_expectancy": 95,
                "email": "jamie.thompson@example.com",
                "phone": "(415) 555-0124",
                "social_security_benefit": 3200,  # Monthly at retirement
                "pension_benefit": 0,
                "employer": "Tech Innovations Inc.",
                "job_title": "Senior Product Manager",
                "years_with_employer": 8,
                "health_insurance": "Through employer"
            },
            "children": [
                {
                    "name": "Alex Thompson",
                    "birth_date": child1_birth.isoformat(),
                    "birth_year": 2008,
                    "relationship": "Child",
                    "email": "alex.thompson@college.edu",
                    "phone": "(415) 555-0125",
                    "in_college": True,
                    "college_name": "University of California, Berkeley",
                    "college_start_year": today.year,
                    "college_end_year": today.year + 4,
                    "major": "Computer Science",
                    "tuition_annual": 36000,
                    "room_board_annual": 18000,
                    "books_supplies_annual": 2000,
                    "total_annual_cost": 56000,
                    "scholarship_amount": 8000,
                    "work_study_income": 4000,
                    "parent_contribution": 44000,
                    "has_529_plan": True,
                    "529_balance": 45000
                },
                {
                    "name": "Jordan Thompson",
                    "birth_date": child2_birth.isoformat(),
                    "birth_year": 2007,
                    "relationship": "Child",
                    "email": "jordan.thompson@college.edu",
                    "phone": "(415) 555-0126",
                    "in_college": True,
                    "college_name": "Stanford University",
                    "college_start_year": today.year - 1,
                    "college_end_year": today.year + 3,
                    "major": "Business Administration",
                    "tuition_annual": 58000,
                    "room_board_annual": 19000,
                    "books_supplies_annual": 2500,
                    "total_annual_cost": 79500,
                    "scholarship_amount": 15000,
                    "work_study_income": 5000,
                    "parent_contribution": 59500,
                    "has_529_plan": True,
                    "529_balance": 35000
                }
            ],
            "address": {
                "street": "2847 Pacific Heights Avenue",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94109",
                "country": "USA"
            },
            "financial": {
                "annual_income": 336000,  # Combined salary: Chris $192k + Jamie $144k
                "annual_expenses": 175000,  # Includes college expenses
                "social_security_benefit": 3800,  # Monthly at retirement (Chris)
                "pension_benefit": 0,
                "emergency_fund": 90000,
                "combined_401k_contribution": 40320,  # Annual: Chris 15% + Jamie 12%
                "net_annual_savings": 120680,  # After expenses and 401k contributions
                "tax_bracket_federal": 0.24,
                "tax_bracket_state": 0.093,
                "health_insurance_premium": 850,  # Monthly family plan
                "life_insurance_premium": 350,  # Monthly term life policies
                "disability_insurance_premium": 180  # Monthly
            },
            "income_streams": [
                {
                    "name": "Chris Salary",
                    "amount": 16000,  # Monthly ($192k annually)
                    "frequency": "monthly",
                    "start_date": (today - relativedelta(years=10)).isoformat(),
                    "end_date": retirement_date.isoformat(),
                    "type": "salary",
                    "description": "Senior Software Engineer at TechCorp"
                },
                {
                    "name": "Jamie Salary",
                    "amount": 12000,  # Monthly ($144k annually)
                    "frequency": "monthly",
                    "start_date": (today - relativedelta(years=8)).isoformat(),
                    "end_date": spouse_retirement_date.isoformat(),
                    "type": "salary",
                    "description": "Senior Product Manager at Tech Innovations"
                }
            ],
            "assets": {
                "taxable_accounts": [
                    {
                        "name": "Vanguard Brokerage",
                        "type": "brokerage",
                        "value": 450000,
                        "institution": "Vanguard",
                        "stock_pct": 0.7,
                        "bond_pct": 0.25,
                        "cash_pct": 0.05
                    },
                    {
                        "name": "High Yield Savings",
                        "type": "savings",
                        "value": 90000,
                        "institution": "Marcus",
                        "stock_pct": 0,
                        "bond_pct": 0,
                        "cash_pct": 1.0
                    }
                ],
                "retirement_accounts": [
                    {
                        "name": "Chris 401(k)",
                        "type": "401k",
                        "value": 850000,
                        "institution": "Fidelity",
                        "stock_pct": 0.8,
                        "bond_pct": 0.15,
                        "cash_pct": 0.05
                    },
                    {
                        "name": "Jamie 401(k)",
                        "type": "401k",
                        "value": 620000,
                        "institution": "Vanguard",
                        "stock_pct": 0.75,
                        "bond_pct": 0.2,
                        "cash_pct": 0.05
                    },
                    {
                        "name": "Roth IRA - Chris",
                        "type": "roth_ira",
                        "value": 180000,
                        "institution": "Fidelity",
                        "stock_pct": 0.85,
                        "bond_pct": 0.1,
                        "cash_pct": 0.05
                    },
                    {
                        "name": "Roth IRA - Jamie",
                        "type": "roth_ira",
                        "value": 165000,
                        "institution": "Vanguard",
                        "stock_pct": 0.85,
                        "bond_pct": 0.1,
                        "cash_pct": 0.05
                    }
                ],
                "real_estate": [
                    {
                        "name": "Primary Residence",
                        "type": "primary_residence",
                        "value": 1850000,
                        "purchase_price": 1200000,
                        "purchase_date": (today - relativedelta(years=12)).isoformat(),
                        "mortgage_balance": 680000,
                        "monthly_payment": 4200
                    }
                ],
                "other_assets": [
                    {
                        "name": "Alex 529 Plan",
                        "type": "529_plan",
                        "value": 45000,
                        "stock_pct": 0.6,
                        "bond_pct": 0.35,
                        "cash_pct": 0.05
                    },
                    {
                        "name": "Jordan 529 Plan",
                        "type": "529_plan",
                        "value": 35000,
                        "stock_pct": 0.5,
                        "bond_pct": 0.45,
                        "cash_pct": 0.05
                    }
                ],
                "pensions_annuities": []
            },
            "budget": {
                "expenses": {
                    "current": {
                        "housing": [{
                            "amount": 4200,
                            "frequency": "monthly",
                            "name": "Mortgage",
                            "ongoing": True
                        }],
                        "utilities": [{
                            "amount": 450,
                            "frequency": "monthly",
                            "name": "Utilities",
                            "ongoing": True
                        }],
                        "transportation": [{
                            "amount": 950,
                            "frequency": "monthly",
                            "name": "Auto Expenses",
                            "ongoing": True
                        }],
                        "food": [{
                            "amount": 1200,
                            "frequency": "monthly",
                            "name": "Groceries",
                            "ongoing": True
                        }],
                        "dining_out": [{
                            "amount": 800,
                            "frequency": "monthly",
                            "name": "Dining & Entertainment",
                            "ongoing": True
                        }],
                        "healthcare": [{
                            "amount": 650,
                            "frequency": "monthly",
                            "name": "Health Costs",
                            "ongoing": True
                        }],
                        "travel": [{
                            "amount": 12000,
                            "frequency": "annual",
                            "name": "Vacations",
                            "ongoing": True
                        }]
                    },
                    "future": {
                        "housing": [{
                            "amount": 1500,
                            "frequency": "monthly",
                            "name": "Taxes & Insurance",
                            "ongoing": True
                        }],
                        "food": [{
                            "amount": 1000,
                            "frequency": "monthly",
                            "name": "Groceries",
                            "ongoing": True
                        }],
                        "travel": [{
                            "amount": 20000,
                            "frequency": "annual",
                            "name": "Retirement Travel",
                            "ongoing": True
                        }]
                    }
                },
                "college_expenses": [
                    {
                        "child_name": "Alex Thompson",
                        "birth_year": 2008,
                        "start_year": today.year,
                        "end_year": today.year + 4,
                        "annual_cost": 44000,
                        "enabled": True
                    },
                    {
                        "child_name": "Jordan Thompson",
                        "birth_year": 2007,
                        "start_year": today.year - 1,
                        "end_year": today.year + 3,
                        "annual_cost": 59500,
                        "enabled": True
                    }
                ]
            },
            "withdrawal_strategy": {
                "withdrawal_rate": 0.04,
                "order": ["taxable", "tax_deferred", "roth"]
            },
            "tax_settings": {
                "filing_status": "mfj",
                "state": "CA"
            }
        }

        # Create profile with unencrypted data (demo data doesn't need encryption)
        import json
        with db.get_connection() as conn:
            cursor = conn.execute('''
                INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
            ''', (
                demo_user.id,
                "Demo Profile",
                birth_date.isoformat(),
                retirement_date.isoformat(),
                json.dumps(demo_data),  # Store as plain JSON (unencrypted)
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            demo_profile_id = cursor.lastrowid

        # Create sample action items
        action_items = [
            {
                "category": "Retirement",
                "description": "Increase 401(k) contribution to 15% to maximize employer match",
                "priority": "high",
                "status": "pending"
            },
            {
                "category": "Tax",
                "description": "Review Roth conversion strategy for low-income years",
                "priority": "medium",
                "status": "pending"
            },
            {
                "category": "Estate",
                "description": "Update living trust and beneficiary designations",
                "priority": "high",
                "status": "completed"
            }
        ]

        with db.get_connection() as conn:
            for item in action_items:
                conn.execute('''
                    INSERT INTO action_items (user_id, profile_id, category, description, priority, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (demo_user.id, demo_profile_id, item['category'], item['description'], 
                      item['priority'], item['status'], datetime.now().isoformat(), datetime.now().isoformat()))

        # Create a sample scenario
        sample_results = {
            "success_rate": 0.92,
            "median_final_balance": 4500000,
            "percentile_10": 1200000,
            "percentile_90": 12500000,
            "simulations": 10000,
            "years_projected": 40
        }

        with db.get_connection() as conn:
            conn.execute('''
                INSERT INTO scenarios (user_id, profile_id, name, results, results_iv, created_at)
                VALUES (?, ?, ?, ?, NULL, ?)
            ''', (demo_user.id, demo_profile_id, "Base Case - 4% Rule", json.dumps(sample_results), datetime.now().isoformat()))

        # Create sample conversation
        conversations = [
            {"role": "user", "content": "How am I doing on my retirement goals?"},
            {"role": "assistant", "content": "Based on your current assets of $2.5M and annual expenses of $175k, your plan has a 92% success rate. You are in excellent shape, but should consider increasing your 401(k) contributions to maximize your tax advantages."}
        ]

        with db.get_connection() as conn:
            for chat in conversations:
                conn.execute('''
                    INSERT INTO conversations (user_id, profile_id, role, content, content_iv, created_at)
                    VALUES (?, ?, ?, ?, NULL, ?)
                ''', (demo_user.id, demo_profile_id, chat['role'], chat['content'], datetime.now().isoformat()))

        # Log admin action
        enhanced_audit_logger.log_admin_action(
            action='RESET_DEMO_ACCOUNT',
            user_id=current_user.id,
            details={
                'demo_user_id': demo_user.id,
                'profile_created': demo_profile_id
            }
        )

        return jsonify({
            'message': 'Demo account reset successfully',
            'username': demo_username,
            'password': demo_password,
            'profile_name': 'Demo Profile'
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
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
            AND l.action IN ('LOGIN_SUCCESS', 'NETWORK_ACCESS')
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
        summary = {
            'total_users': len(result),
            'total_locations': sum(u['unique_locations'] for u in result),
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

        return jsonify({
            'summary': summary,
            'users': result
        }), 200

    except Exception as e:
        print(f"Error generating users-by-location report: {e}")
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
    req = PasswordResetRequest.get_by_id(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404
    
    if req.status != 'pending':
        return jsonify({'error': 'Request already processed'}), 400

    user = User.get_by_id(req.user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.json
    new_password = data.get('new_password')
    
    # Use existing schema validation if possible, or manual
    if not new_password or len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    # Attempt to recover data using email backup
    recovery_method = 'data_loss'
    
    try:
        if user.email_encrypted_dek and user.email_iv and user.email_salt:
            # We can recover!
            try:
                email_salt = base64.b64decode(user.email_salt)
                email_kek = EncryptionService.get_email_kek(user.email, email_salt)
                email_service = EncryptionService(key=email_kek)
                dek_b64 = email_service.decrypt(user.email_encrypted_dek, user.email_iv)
                
                if dek_b64:
                    # Re-encrypt with new password
                    dek = base64.b64decode(dek_b64)
                    
                    new_salt = user.get_kek_salt()
                    new_kek = EncryptionService.get_kek_from_password(new_password, new_salt)
                    new_service = EncryptionService(key=new_kek)
                    
                    new_enc_dek, new_iv = new_service.encrypt(dek_b64)
                    
                    # Update user
                    user.encrypted_dek = new_enc_dek
                    user.dek_iv = new_iv
                    user.password_hash = User.hash_password(new_password)
                    user.reset_token = None
                    user.reset_token_expires = None
                    
                    # Refresh email backup
                    user.update_email_recovery_backup(dek)
                    
                    user.save()
                    recovery_method = 'email_backup'
            except Exception as e:
                print(f"Failed to recover using email backup: {e}")
                # Fallthrough to data_loss
        
        if recovery_method == 'data_loss':
            # Force reset
            user.force_password_reset(new_password)
            
        # Mark request as processed
        req.mark_processed(current_user.id)
        
        EnhancedAuditLogger.log(
            action='ADMIN_PROCESSED_PASSWORD_RESET',
            table_name='users',
            user_id=user.id,
            details=json.dumps({
                'request_id': req.id,
                'method': recovery_method
            }),
            status_code=200
        )
        
        message = 'Password reset successfully.'
        if recovery_method == 'email_backup':
            message += ' Data was preserved/re-encrypted.'
        else:
            message += ' WARNING: Encrypted data was lost.'
            
        return jsonify({
            'message': message,
            'recovery_method': recovery_method,
            'password': new_password
        }), 200

    except Exception as e:
        print(f"Error processing password reset: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500
