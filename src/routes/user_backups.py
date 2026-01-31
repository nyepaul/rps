"""
Routes for user-specific data backups.
"""

from flask import Blueprint, jsonify, request, send_file
from flask_login import login_required, current_user
from src.services.user_backup_service import UserBackupService
from src.services.enhanced_audit_logger import EnhancedAuditLogger
import json
import os

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


@user_backups_bp.route("/<int:backup_id>/download", methods=["GET"])
@login_required
def download_backup(backup_id):
    """Download a specific backup file."""
    try:
        # Verify ownership and get filename
        from src.database import connection
        row = connection.db.execute_one(
            "SELECT filename, label FROM user_backups WHERE id = ? AND user_id = ?",
            (backup_id, current_user.id),
        )
        if not row:
            return jsonify({"error": "Backup not found or unauthorized"}), 404

        filename = row["filename"]
        backup_path = UserBackupService.get_backup_dir() / filename

        if not backup_path.exists():
            return jsonify({"error": "Backup file not found on disk"}), 404

        # Log download
        EnhancedAuditLogger.log(
            action="DOWNLOAD_USER_BACKUP",
            table_name="user_backups",
            record_id=backup_id,
            user_id=current_user.id,
            details=json.dumps({"filename": filename, "label": row["label"]}),
            status_code=200,
        )

        return send_file(
            backup_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/json"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_backups_bp.route("/import", methods=["POST"])
@login_required
def import_backup():
    """Upload and import a backup file."""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        if file:
            # Read and validate JSON
            try:
                backup_data = json.load(file)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid backup file (not valid JSON)"}), 400

            # Basic validation of backup structure
            if "metadata" not in backup_data or "profiles" not in backup_data:
                return jsonify({"error": "Invalid backup file structure"}), 400

            # Create a safety backup of current state first
            UserBackupService.create_backup(current_user.id, "Pre-import Automatic Backup")

            # Perform the restore using the uploaded data
            # We need to adapt UserBackupService.restore_backup to accept data directly or save it first
            # For simplicity, let's save it as a new backup first, then restore it
            
            label = backup_data.get("metadata", {}).get("label") or "Imported Backup"
            import_label = f"Imported: {label}"
            
            # Save the uploaded file to the backup directory
            import_result = UserBackupService.save_imported_backup(current_user.id, backup_data, import_label)
            
            # Now restore from this new backup
            result = UserBackupService.restore_backup(current_user.id, import_result["id"])

            EnhancedAuditLogger.log(
                action="IMPORT_USER_BACKUP",
                table_name="user_backups",
                user_id=current_user.id,
                details=json.dumps(result),
                status_code=200,
            )

            return jsonify({
                "message": "Backup imported and restored successfully",
                "details": result
            }), 200

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
