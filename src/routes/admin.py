"""Admin routes for managing audit logs and system configuration."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
from src.auth.admin_required import admin_required
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

        rows = db.execute('SELECT id, username, email, is_active, is_admin, created_at, last_login FROM users ORDER BY created_at DESC')
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
