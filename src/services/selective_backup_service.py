"""
Selective backup service for profile and group-based backups.
Allows admins to backup/restore specific profiles or groups of profiles.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.database.connection import db
from src.auth.models import User
from src.models.group import Group


class SelectiveBackupService:
    """Service for handling selective profile/group-based backups."""

    @staticmethod
    def get_backup_dir() -> Path:
        """Get the directory where selective backups are stored."""
        project_root = Path(__file__).parent.parent.parent
        backup_dir = project_root / "backups" / "selective"
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir

    @staticmethod
    def get_all_profiles_with_details() -> List[Dict[str, Any]]:
        """
        Get all profiles with user and group information for selection UI.
        Returns a list of profiles with associated user and group data.
        """
        # Get profiles with user info
        rows = db.execute("""
            SELECT
                p.id, p.name, p.user_id, p.birth_date, p.retirement_date,
                p.updated_at, p.created_at,
                u.username, u.email
            FROM profile p
            JOIN users u ON p.user_id = u.id
            ORDER BY u.username, p.name
        """)

        profiles = []
        for row in rows:
            profile = dict(row)
            # Get groups for this user
            groups = db.execute(
                """
                SELECT g.id, g.name
                FROM groups g
                JOIN user_groups ug ON g.id = ug.group_id
                WHERE ug.user_id = ?
            """,
                (profile["user_id"],),
            )
            profile["groups"] = [dict(g) for g in groups]
            profiles.append(profile)

        return profiles

    @staticmethod
    def get_all_groups_with_profile_counts() -> List[Dict[str, Any]]:
        """
        Get all groups with member and profile counts for selection UI.
        """
        rows = db.execute("""
            SELECT
                g.id, g.name, g.description,
                (SELECT COUNT(DISTINCT ug.user_id) FROM user_groups ug WHERE ug.group_id = g.id) as member_count,
                (SELECT COUNT(DISTINCT p.id) FROM profile p
                 JOIN user_groups ug ON p.user_id = ug.user_id
                 WHERE ug.group_id = g.id) as profile_count
            FROM groups g
            ORDER BY g.name
        """)
        return [dict(row) for row in rows]

    @staticmethod
    def create_backup(
        profile_ids: Optional[List[int]] = None,
        group_ids: Optional[List[int]] = None,
        label: Optional[str] = None,
        created_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a backup of selected profiles.

        Args:
            profile_ids: List of profile IDs to backup
            group_ids: List of group IDs (all profiles from users in these groups will be backed up)
            label: Optional label for the backup
            created_by: User ID of admin creating the backup
        """
        if not profile_ids and not group_ids:
            raise ValueError("Must specify either profile_ids or group_ids")

        # Collect all profile IDs to backup
        all_profile_ids = set(profile_ids or [])

        # Add profiles from specified groups
        if group_ids:
            for group_id in group_ids:
                group_profiles = db.execute(
                    """
                    SELECT DISTINCT p.id
                    FROM profile p
                    JOIN user_groups ug ON p.user_id = ug.user_id
                    WHERE ug.group_id = ?
                """,
                    (group_id,),
                )
                for row in group_profiles:
                    all_profile_ids.add(row["id"])

        if not all_profile_ids:
            raise ValueError("No profiles found for the specified selection")

        # Collect backup data
        backup_data = {
            "metadata": {
                "version": "1.0",
                "type": "selective",
                "created_at": datetime.now().isoformat(),
                "created_by": created_by,
                "label": label,
                "profile_ids": list(all_profile_ids),
                "group_ids": group_ids or [],
            },
            "users": {},
            "profiles": [],
            "scenarios": [],
            "action_items": [],
            "conversations": [],
        }

        # Track users whose data we're backing up
        user_ids = set()

        # Fetch profiles with all data
        for profile_id in all_profile_ids:
            profile = db.execute_one(
                "SELECT * FROM profile WHERE id = ?", (profile_id,)
            )
            if profile:
                p_dict = dict(profile)
                backup_data["profiles"].append(p_dict)
                user_ids.add(p_dict["user_id"])

        # Fetch user info
        for user_id in user_ids:
            user = db.execute_one(
                "SELECT id, username, email FROM users WHERE id = ?", (user_id,)
            )
            if user:
                backup_data["users"][user_id] = dict(user)

        # Fetch related scenarios
        for profile_id in all_profile_ids:
            scenarios = db.execute(
                "SELECT * FROM scenarios WHERE profile_id = ?", (profile_id,)
            )
            for s in scenarios:
                backup_data["scenarios"].append(dict(s))

        # Fetch related action items
        for profile_id in all_profile_ids:
            action_items = db.execute(
                "SELECT * FROM action_items WHERE profile_id = ?", (profile_id,)
            )
            for ai in action_items:
                backup_data["action_items"].append(dict(ai))

        # Fetch related conversations
        for profile_id in all_profile_ids:
            conversations = db.execute(
                "SELECT * FROM conversations WHERE profile_id = ?", (profile_id,)
            )
            for c in conversations:
                backup_data["conversations"].append(dict(c))

        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if label:
            safe_label = (
                "".join(c for c in label if c.isalnum() or c in (" ", "_", "-"))
                .strip()
                .replace(" ", "_")
            )
            filename = f"selective_{timestamp}_{safe_label}.json"
        else:
            filename = f"selective_{timestamp}.json"

        # Save to file
        backup_path = SelectiveBackupService.get_backup_dir() / filename
        with open(backup_path, "w") as f:
            json.dump(backup_data, f, indent=2)

        size_bytes = backup_path.stat().st_size

        return {
            "filename": filename,
            "size_bytes": size_bytes,
            "created_at": backup_data["metadata"]["created_at"],
            "profile_count": len(backup_data["profiles"]),
            "user_count": len(backup_data["users"]),
            "scenario_count": len(backup_data["scenarios"]),
            "action_item_count": len(backup_data["action_items"]),
        }

    @staticmethod
    def list_backups() -> List[Dict[str, Any]]:
        """List all selective backups."""
        backup_dir = SelectiveBackupService.get_backup_dir()
        backups = []

        for backup_file in sorted(backup_dir.glob("selective_*.json"), reverse=True):
            try:
                stat_info = backup_file.stat()

                # Read metadata from file
                with open(backup_file, "r") as f:
                    data = json.load(f)
                    metadata = data.get("metadata", {})

                backups.append(
                    {
                        "filename": backup_file.name,
                        "size_bytes": stat_info.st_size,
                        "size_human": SelectiveBackupService._format_size(
                            stat_info.st_size
                        ),
                        "created_at": metadata.get(
                            "created_at",
                            datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        ),
                        "label": metadata.get("label"),
                        "profile_count": len(data.get("profiles", [])),
                        "user_count": len(data.get("users", {})),
                        "group_ids": metadata.get("group_ids", []),
                    }
                )
            except Exception as e:
                print(f"Error reading backup {backup_file}: {e}")
                continue

        return backups

    @staticmethod
    def get_backup_details(filename: str) -> Dict[str, Any]:
        """Get detailed information about a specific backup."""
        backup_path = SelectiveBackupService.get_backup_dir() / filename

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file {filename} not found")

        with open(backup_path, "r") as f:
            data = json.load(f)

        # Build profile summary
        profiles_summary = []
        for profile in data.get("profiles", []):
            user_info = data.get("users", {}).get(str(profile.get("user_id")), {})
            if not user_info:
                user_info = data.get("users", {}).get(profile.get("user_id"), {})
            profiles_summary.append(
                {
                    "id": profile.get("id"),
                    "name": profile.get("name"),
                    "user_id": profile.get("user_id"),
                    "username": user_info.get("username", "Unknown"),
                    "updated_at": profile.get("updated_at"),
                }
            )

        return {
            "metadata": data.get("metadata", {}),
            "profiles": profiles_summary,
            "scenario_count": len(data.get("scenarios", [])),
            "action_item_count": len(data.get("action_items", [])),
            "conversation_count": len(data.get("conversations", [])),
        }

    @staticmethod
    def restore_backup(
        filename: str,
        profile_ids: Optional[List[int]] = None,
        restore_mode: str = "merge",
    ) -> Dict[str, Any]:
        """
        Restore profiles from a selective backup.

        Args:
            filename: Name of the backup file
            profile_ids: Optional list of profile IDs to restore (restores all if None)
            restore_mode: 'merge' (add/update) or 'replace' (delete existing first)
        """
        backup_path = SelectiveBackupService.get_backup_dir() / filename

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file {filename} not found")

        with open(backup_path, "r") as f:
            backup_data = json.load(f)

        profiles_to_restore = backup_data.get("profiles", [])

        # Filter to specific profiles if requested
        if profile_ids:
            profiles_to_restore = [
                p for p in profiles_to_restore if p.get("id") in profile_ids
            ]

        if not profiles_to_restore:
            raise ValueError("No profiles to restore")

        results = {
            "profiles_restored": 0,
            "profiles_updated": 0,
            "scenarios_restored": 0,
            "action_items_restored": 0,
            "conversations_restored": 0,
            "errors": [],
        }

        with db.get_connection() as conn:
            cursor = conn.cursor()

            for profile in profiles_to_restore:
                try:
                    profile_id = profile.get("id")
                    user_id = profile.get("user_id")

                    # Check if profile exists
                    existing = cursor.execute(
                        "SELECT id FROM profile WHERE id = ?", (profile_id,)
                    ).fetchone()

                    if existing:
                        if restore_mode == "replace":
                            # Delete related data first
                            cursor.execute(
                                "DELETE FROM scenarios WHERE profile_id = ?",
                                (profile_id,),
                            )
                            cursor.execute(
                                "DELETE FROM action_items WHERE profile_id = ?",
                                (profile_id,),
                            )
                            cursor.execute(
                                "DELETE FROM conversations WHERE profile_id = ?",
                                (profile_id,),
                            )

                            # Update profile
                            # Update profile
                            cursor.execute(
                                """
                                UPDATE profile
                                SET name = ?, birth_date = ?, retirement_date = ?,
                                    data = ?, data_iv = ?, updated_at = ?
                                WHERE id = ?
                            """,
                                (
                                    profile.get("name"),
                                    profile.get("birth_date"),
                                    profile.get("retirement_date"),
                                    profile.get("data"),
                                    profile.get("data_iv"),
                                    datetime.now().isoformat(),
                                    profile_id,
                                ),
                            )
                            results["profiles_updated"] += 1
                        else:
                            # Merge mode - just update if exists
                            # Update profile
                            cursor.execute(
                                """
                                UPDATE profile
                                SET name = ?, birth_date = ?, retirement_date = ?,
                                    data = ?, data_iv = ?, updated_at = ?
                                WHERE id = ?
                            """,
                                (
                                    profile.get("name"),
                                    profile.get("birth_date"),
                                    profile.get("retirement_date"),
                                    profile.get("data"),
                                    profile.get("data_iv"),
                                    datetime.now().isoformat(),
                                    profile_id,
                                ),
                            )
                            results["profiles_updated"] += 1
                    else:
                        # Insert new profile
                        cursor.execute(
                            """
                            INSERT INTO profile (id, user_id, name, birth_date, retirement_date,
                                                data, data_iv, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                            (
                                profile_id,
                                user_id,
                                profile.get("name"),
                                profile.get("birth_date"),
                                profile.get("retirement_date"),
                                profile.get("data"),
                                profile.get("data_iv"),
                                profile.get("created_at", datetime.now().isoformat()),
                                datetime.now().isoformat(),
                            ),
                        )
                        results["profiles_restored"] += 1

                    # Restore related scenarios
                    for scenario in backup_data.get("scenarios", []):
                        if scenario.get("profile_id") == profile_id:
                            # Check if exists
                            existing_scenario = cursor.execute(
                                "SELECT id FROM scenarios WHERE id = ?",
                                (scenario.get("id"),),
                            ).fetchone()

                            if existing_scenario and restore_mode == "replace":
                                cursor.execute(
                                    "DELETE FROM scenarios WHERE id = ?",
                                    (scenario.get("id"),),
                                )

                            if not existing_scenario or restore_mode == "replace":
                                fields = (
                                    [k for k in scenario.keys() if k != "id"]
                                    if not existing_scenario
                                    else list(scenario.keys())
                                )
                                if "id" not in fields and scenario.get("id"):
                                    fields.insert(0, "id")
                                placeholders = ", ".join(["?" for _ in fields])
                                cursor.execute(
                                    f"INSERT OR REPLACE INTO scenarios ({', '.join(fields)}) VALUES ({placeholders})",
                                    tuple(scenario.get(f) for f in fields),
                                )
                                results["scenarios_restored"] += 1

                    # Restore related action items
                    for ai in backup_data.get("action_items", []):
                        if ai.get("profile_id") == profile_id:
                            existing_ai = cursor.execute(
                                "SELECT id FROM action_items WHERE id = ?",
                                (ai.get("id"),),
                            ).fetchone()

                            if existing_ai and restore_mode == "replace":
                                cursor.execute(
                                    "DELETE FROM action_items WHERE id = ?",
                                    (ai.get("id"),),
                                )

                            if not existing_ai or restore_mode == "replace":
                                fields = list(ai.keys())
                                placeholders = ", ".join(["?" for _ in fields])
                                cursor.execute(
                                    f"INSERT OR REPLACE INTO action_items ({', '.join(fields)}) VALUES ({placeholders})",
                                    tuple(ai.get(f) for f in fields),
                                )
                                results["action_items_restored"] += 1

                    # Restore related conversations
                    for conv in backup_data.get("conversations", []):
                        if conv.get("profile_id") == profile_id:
                            existing_conv = cursor.execute(
                                "SELECT id FROM conversations WHERE id = ?",
                                (conv.get("id"),),
                            ).fetchone()

                            if existing_conv and restore_mode == "replace":
                                cursor.execute(
                                    "DELETE FROM conversations WHERE id = ?",
                                    (conv.get("id"),),
                                )

                            if not existing_conv or restore_mode == "replace":
                                fields = list(conv.keys())
                                placeholders = ", ".join(["?" for _ in fields])
                                cursor.execute(
                                    f"INSERT OR REPLACE INTO conversations ({', '.join(fields)}) VALUES ({placeholders})",
                                    tuple(conv.get(f) for f in fields),
                                )
                                results["conversations_restored"] += 1

                except Exception as e:
                    results["errors"].append(
                        {
                            "profile_id": profile.get("id"),
                            "profile_name": profile.get("name"),
                            "error": str(e),
                        }
                    )

            conn.commit()

        results["success"] = len(results["errors"]) == 0
        return results

    @staticmethod
    def delete_backup(filename: str) -> bool:
        """Delete a selective backup file."""
        backup_path = SelectiveBackupService.get_backup_dir() / filename

        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file {filename} not found")

        backup_path.unlink()
        return True

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """Format file size in human-readable format."""
        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"
