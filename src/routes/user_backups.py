"""
Routes for user-specific data backups.
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from src.services.user_backup_service import UserBackupService
from src.services.enhanced_audit_logger import EnhancedAuditLogger
import json

user_backups_bp = Blueprint("user_backups", __name__, url_prefix="/api/backups")


@user_backups_bp.route("", methods=["GET"])
@login_required
def list_backups():
    """List all backups for the current user."""
    try:
        backups = UserBackupService.list_backups(current_user.id)
        return jsonify({"backups": backups}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_backups_bp.route("", methods=["POST"])
@login_required
def create_backup():
    """Create a new backup for the current user."""
    try:
        data = request.json or {}
        label = data.get("label")

        result = UserBackupService.create_backup(current_user.id, label)

        EnhancedAuditLogger.log(
            action="CREATE_USER_BACKUP",
            table_name="user_backups",
            user_id=current_user.id,
            details=json.dumps(result),
            status_code=201,
        )

        return (
            jsonify({"message": "Backup created successfully", "backup": result}),
            201,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_backups_bp.route("/<int:backup_id>/restore", methods=["POST"])
@login_required
def restore_backup(backup_id):
    """Restore data from a specific backup."""
    try:
        # Create a pre-restore safety backup first
        try:
            UserBackupService.create_backup(
                current_user.id, "Pre-restore Automatic Backup"
            )
        except Exception as e:
            print(f"Failed to create safety backup: {e}")

        result = UserBackupService.restore_backup(current_user.id, backup_id)

        EnhancedAuditLogger.log(
            action="RESTORE_USER_BACKUP",
            table_name="user_backups",
            record_id=backup_id,
            user_id=current_user.id,
            details=json.dumps(result),
            status_code=200,
        )

        return (
            jsonify({"message": "Data restored successfully", "details": result}),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_backups_bp.route("/<int:backup_id>", methods=["DELETE"])
@login_required
def delete_backup(backup_id):
    """Delete a specific backup."""
    try:
        UserBackupService.delete_backup(current_user.id, backup_id)

        EnhancedAuditLogger.log(
            action="DELETE_USER_BACKUP",
            table_name="user_backups",
            record_id=backup_id,
            user_id=current_user.id,
            status_code=200,
        )

        return jsonify({"message": "Backup deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
