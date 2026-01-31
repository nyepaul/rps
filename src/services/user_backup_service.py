"""
User-specific backup and restore service.
"""

import os
import json
import base64
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.database import connection
from src.auth.models import User


class UserBackupService:
    """Service for handling per-user data backups and restores."""

    @staticmethod
    def get_backup_dir() -> Path:
        """Get the directory where user backups are stored."""
        project_root = Path(__file__).parent.parent.parent
        backup_dir = project_root / "data" / "user_backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir

    @staticmethod
    def create_backup(user_id: int, label: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a backup of all data for a specific user.
        Includes profiles, scenarios, action items, conversations, and preferences.
        """
        # Get user data
        user = User.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        # Collect all data
        backup_data = {
            "metadata": {
                "user_id": user_id,
                "username": user.username,
                "version": "1.0",
                "created_at": datetime.now().isoformat(),
                "label": label,
            },
            "preferences": user.preferences,
            "api_keys": user.api_keys,
            "api_keys_iv": user.api_keys_iv,
            "profiles": [],
            "scenarios": [],
            "action_items": [],
            "conversations": [],
        }

        # Fetch profiles
        profiles = connection.db.execute("SELECT * FROM profile WHERE user_id = ?", (user_id,))
        profile_map = {}  # Maps old ID to new ID during restore, not used here
        for p in profiles:
            p_dict = dict(p)
            backup_data["profiles"].append(p_dict)

        # Fetch scenarios
        scenarios = connection.db.execute("SELECT * FROM scenarios WHERE user_id = ?", (user_id,))
        for s in scenarios:
            backup_data["scenarios"].append(dict(s))

        # Fetch action items
        action_items = connection.db.execute(
            "SELECT * FROM action_items WHERE user_id = ?", (user_id,)
        )
        for ai in action_items:
            backup_data["action_items"].append(dict(ai))

        # Fetch conversations
        conversations = connection.db.execute(
            "SELECT * FROM conversations WHERE user_id = ?", (user_id,)
        )
        for c in conversations:
            backup_data["conversations"].append(dict(c))

        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"user_{user_id}_{timestamp}.json"
        if label:
            safe_label = (
                "".join(c for c in label if c.isalnum() or c in (" ", "_", "-"))
                .strip()
                .replace(" ", "_")
            )
            filename = f"user_{user_id}_{timestamp}_{safe_label}.json"

        # Save to file
        backup_path = UserBackupService.get_backup_dir() / filename
        with open(backup_path, "w") as f:
            json.dump(backup_data, f, indent=2)

        # Record in database
        size_bytes = backup_path.stat().st_size
        connection.db.execute(
            """
            INSERT INTO user_backups (user_id, filename, label, size_bytes)
            VALUES (?, ?, ?, ?)
        """,
            (user_id, filename, label, size_bytes),
        )

        return {
            "filename": filename,
            "size_bytes": size_bytes,
            "created_at": backup_data["metadata"]["created_at"],
        }

    @staticmethod
    def save_imported_backup(user_id: int, backup_data: Dict[str, Any], label: str) -> Dict[str, Any]:
        """Save imported backup data to a file and record in DB."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"user_{user_id}_{timestamp}_imported.json"
        
        backup_path = UserBackupService.get_backup_dir() / filename
        with open(backup_path, "w") as f:
            json.dump(backup_data, f, indent=2)

        # Record in database
        size_bytes = backup_path.stat().st_size
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_backups (user_id, filename, label, size_bytes)
                VALUES (?, ?, ?, ?)
            """,
                (user_id, filename, label, size_bytes),
            )
            backup_id = cursor.lastrowid
            conn.commit()

        return {
            "id": backup_id,
            "filename": filename,
            "size_bytes": size_bytes
        }

    @staticmethod
    def list_backups(user_id: int) -> List[Dict[str, Any]]:
        """List all backups for a user."""
        rows = connection.db.execute(
            """
            SELECT * FROM user_backups 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        """,
            (user_id,),
        )
        return [dict(row) for row in rows]

    @staticmethod
    def delete_backup(user_id: int, backup_id: int):
        """Delete a backup."""
        row = connection.db.execute_one(
            "SELECT * FROM user_backups WHERE id = ? AND user_id = ?",
            (backup_id, user_id),
        )
        if not row:
            raise ValueError("Backup not found or unauthorized")

        filename = row["filename"]
        backup_path = UserBackupService.get_backup_dir() / filename

        # Delete file
        if backup_path.exists():
            backup_path.unlink()

        # Delete from DB
        connection.db.execute("DELETE FROM user_backups WHERE id = ?", (backup_id,))

    @staticmethod
    def restore_backup(user_id: int, backup_id: int) -> Dict[str, Any]:
        """
        Restore data from a backup.
        WARNING: This replaces current user data.
        """
        row = connection.db.execute_one(
            "SELECT * FROM user_backups WHERE id = ? AND user_id = ?",
            (backup_id, user_id),
        )
        if not row:
            raise ValueError("Backup not found or unauthorized")

        filename = row["filename"]
        backup_path = UserBackupService.get_backup_dir() / filename

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file {filename} not found on disk")

        with open(backup_path, "r") as f:
            backup_data = json.load(f)

        # Start transaction
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()

            # 1. Clear existing data
            cursor.execute("DELETE FROM profile WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM action_items WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM scenarios WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))

            # 2. Restore preferences and API keys
            cursor.execute(
                "UPDATE users SET preferences = ?, api_keys = ?, api_keys_iv = ? WHERE id = ?",
                (
                    backup_data.get("preferences"),
                    backup_data.get("api_keys"),
                    backup_data.get("api_keys_iv"),
                    user_id,
                ),
            )

            # 3. Restore profiles and build ID map
            profile_id_map = {}
            for p in backup_data.get("profiles", []):
                old_id = p.get("id")
                # Remove ID to let DB autoincrement
                p_copy = p.copy()
                p_copy.pop("id", None)
                p_copy["user_id"] = user_id  # Ensure correct user_id

                fields = list(p_copy.keys())
                placeholders = ", ".join(["?" for _ in fields])
                query = (
                    f"INSERT INTO profile ({', '.join(fields)}) VALUES ({placeholders})"
                )
                cursor.execute(query, tuple(p_copy.values()))
                new_id = cursor.lastrowid
                if old_id:
                    profile_id_map[old_id] = new_id

            # 4. Restore scenarios
            for s in backup_data.get("scenarios", []):
                s_copy = s.copy()
                s_copy.pop("id", None)
                s_copy["user_id"] = user_id
                # Map profile ID
                old_p_id = s_copy.get("profile_id")
                s_copy["profile_id"] = profile_id_map.get(old_p_id)

                fields = list(s_copy.keys())
                placeholders = ", ".join(["?" for _ in fields])
                query = f"INSERT INTO scenarios ({', '.join(fields)}) VALUES ({placeholders})"
                cursor.execute(query, tuple(s_copy.values()))

            # 5. Restore action items
            for ai in backup_data.get("action_items", []):
                ai_copy = ai.copy()
                ai_copy.pop("id", None)
                ai_copy["user_id"] = user_id
                # Map profile ID
                old_p_id = ai_copy.get("profile_id")
                ai_copy["profile_id"] = profile_id_map.get(old_p_id)

                fields = list(ai_copy.keys())
                placeholders = ", ".join(["?" for _ in fields])
                query = f"INSERT INTO action_items ({', '.join(fields)}) VALUES ({placeholders})"
                cursor.execute(query, tuple(ai_copy.values()))

            # 6. Restore conversations
            for c in backup_data.get("conversations", []):
                c_copy = c.copy()
                c_copy.pop("id", None)
                c_copy["user_id"] = user_id
                # Map profile ID
                old_p_id = c_copy.get("profile_id")
                c_copy["profile_id"] = profile_id_map.get(old_p_id)

                fields = list(c_copy.keys())
                placeholders = ", ".join(["?" for _ in fields])
                query = f"INSERT INTO conversations ({', '.join(fields)}) VALUES ({placeholders})"
                cursor.execute(query, tuple(c_copy.values()))

            conn.commit()

        return {
            "success": True,
            "profiles_restored": len(backup_data.get("profiles", [])),
            "scenarios_restored": len(backup_data.get("scenarios", [])),
            "action_items_restored": len(backup_data.get("action_items", [])),
        }
