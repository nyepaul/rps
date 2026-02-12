"""
Routes for user-specific data backups.
"""

from flask import Blueprint, jsonify, request, send_file, current_app
from flask_login import login_required, current_user
from src.services.user_backup_service import UserBackupService
from src.services.enhanced_audit_logger import EnhancedAuditLogger
import json
import os

user_backups_bp = Blueprint("user_backups", __name__, url_prefix="/api/backups")
MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_IMPORT_MIME_TYPES = {
    "application/json",
    "text/json",
    "text/plain",
    "application/octet-stream",
}


@user_backups_bp.route("", methods=["GET"])
@login_required
def list_backups():
    """List all backups for the current user."""
    try:
        backups = UserBackupService.list_backups(current_user.id)
        return jsonify({"backups": backups}), 200
    except Exception as e:
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


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
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


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
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


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
            if not file.filename.lower().endswith(".json"):
                return jsonify({"error": "Only .json backup files are supported"}), 400

            if file.mimetype not in ALLOWED_IMPORT_MIME_TYPES:
                return jsonify({"error": "Unsupported backup file type"}), 400

            # Read and validate JSON
            try:
                payload = file.read(MAX_IMPORT_SIZE_BYTES + 1)
                if not payload:
                    return jsonify({"error": "Backup file is empty"}), 400
                if len(payload) > MAX_IMPORT_SIZE_BYTES:
                    return jsonify({"error": "Backup file is too large"}), 400

                backup_data = json.loads(payload.decode("utf-8"))
                if not isinstance(backup_data, dict):
                    return jsonify({"error": "Invalid backup file structure"}), 400
            except UnicodeDecodeError:
                return jsonify({"error": "Backup file must be UTF-8 encoded JSON"}), 400
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid backup file (not valid JSON)"}), 400

            # Validate and sanitize backup structure
            try:
                backup_data = UserBackupService._sanitize_backup_data(
                    current_user.id, backup_data
                )
            except ValueError as e:
                return jsonify({"error": "Invalid request data"}), 400

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
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


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
            current_app.logger.error(f"Failed to create safety backup: {e}")

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
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500


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
        current_app.logger.error(f"Admin route error: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
