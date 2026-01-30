"""ActionItem model with user and profile ownership and encryption."""

from datetime import datetime
import json
from src.database import connection
from src.services.encryption_service import (
    encrypt_dict,
    decrypt_dict,
    encrypt_list,
    decrypt_list,
)


class ActionItem:
    """Action item model for tasks and recommendations."""

    def __init__(
        self,
        id=None,
        user_id=None,
        profile_id=None,
        category=None,
        description=None,
        priority=None,
        status="pending",
        due_date=None,
        action_data=None,
        action_data_iv=None,
        subtasks=None,
        subtasks_iv=None,
        created_at=None,
        updated_at=None,
    ):
        self.id = id
        self.user_id = user_id
        self.profile_id = profile_id
        self.category = category
        self.description = description
        self.priority = priority  # 'high', 'medium', 'low'
        self.status = status  # 'pending', 'in_progress', 'completed'
        self.due_date = due_date
        self.action_data = action_data  # Encrypted ciphertext
        self.action_data_iv = action_data_iv  # IV for action_data
        self.subtasks = subtasks  # Encrypted ciphertext
        self.subtasks_iv = subtasks_iv  # IV for subtasks
        self._decrypted_action_data = None
        self._decrypted_subtasks = None
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()

    @staticmethod
    def get_by_id(item_id: int, user_id: int):
        """Get action item by ID (with ownership check)."""
        row = connection.db.execute_one(
            "SELECT * FROM action_items WHERE id = ? AND user_id = ?",
            (item_id, user_id),
        )
        if row:
            return ActionItem(**dict(row))
        return None

    @staticmethod
    def list_by_user(user_id: int, profile_id: int = None):
        """List action items for a user, optionally filtered by profile."""
        if profile_id:
            rows = connection.db.execute(
                """SELECT * FROM action_items 
                   WHERE user_id = ? AND profile_id = ? 
                   ORDER BY status, priority, due_date""",
                (user_id, profile_id),
            )
        else:
            rows = connection.db.execute(
                "SELECT * FROM action_items WHERE user_id = ? ORDER BY status, priority, due_date",
                (user_id,),
            )
        return [ActionItem(**dict(row)) for row in rows]

    def save(self):
        """Save or update action item (encrypts data)."""
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()

            # Encrypt action_data if needed
            if self._decrypted_action_data is not None:
                self.action_data, self.action_data_iv = encrypt_dict(
                    self._decrypted_action_data
                )
            elif isinstance(self.action_data, dict):
                self.action_data, self.action_data_iv = encrypt_dict(self.action_data)

            # Encrypt subtasks if needed
            if self._decrypted_subtasks is not None:
                self.subtasks, self.subtasks_iv = encrypt_list(self._decrypted_subtasks)
            elif isinstance(self.subtasks, list):
                self.subtasks, self.subtasks_iv = encrypt_list(self.subtasks)

            if self.id is None:
                cursor.execute(
                    """
                    INSERT INTO action_items
                    (user_id, profile_id, category, description, priority, status,
                     due_date, action_data, action_data_iv, subtasks, subtasks_iv, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        self.user_id,
                        self.profile_id,
                        self.category,
                        self.description,
                        self.priority,
                        self.status,
                        self.due_date,
                        self.action_data,
                        self.action_data_iv,
                        self.subtasks,
                        self.subtasks_iv,
                        self.created_at,
                        self.updated_at,
                    ),
                )
                self.id = cursor.lastrowid
            else:
                cursor.execute(
                    """
                    UPDATE action_items
                    SET category = ?, description = ?, priority = ?, status = ?,
                        due_date = ?, action_data = ?, action_data_iv = ?, subtasks = ?, subtasks_iv = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                """,
                    (
                        self.category,
                        self.description,
                        self.priority,
                        self.status,
                        self.due_date,
                        self.action_data,
                        self.action_data_iv,
                        self.subtasks,
                        self.subtasks_iv,
                        datetime.now().isoformat(),
                        self.id,
                        self.user_id,
                    ),
                )
        return self

    def delete(self):
        """Delete action item."""
        if self.id:
            with connection.db.get_connection() as conn:
                conn.execute(
                    "DELETE FROM action_items WHERE id = ? AND user_id = ?",
                    (self.id, self.user_id),
                )

    def to_dict(self):
        """Convert to dictionary (decrypts data)."""
        # Decrypt action_data
        action_data_decrypted = None
        if self.action_data and self.action_data_iv:
            try:
                action_data_decrypted = decrypt_dict(
                    self.action_data, self.action_data_iv
                )
            except Exception:
                # Fallback to plain JSON
                if isinstance(self.action_data, str):
                    try:
                        action_data_decrypted = json.loads(self.action_data)
                    except json.JSONDecodeError:
                        pass
        elif isinstance(self.action_data, str):
            try:
                action_data_decrypted = json.loads(self.action_data)
            except json.JSONDecodeError:
                pass
        else:
            action_data_decrypted = self.action_data

        # Decrypt subtasks
        subtasks_decrypted = None
        if self.subtasks and self.subtasks_iv:
            try:
                subtasks_decrypted = decrypt_list(self.subtasks, self.subtasks_iv)
            except Exception:
                # Fallback to plain JSON
                if isinstance(self.subtasks, str):
                    try:
                        subtasks_decrypted = json.loads(self.subtasks)
                    except json.JSONDecodeError:
                        pass
        elif isinstance(self.subtasks, str):
            try:
                subtasks_decrypted = json.loads(self.subtasks)
            except json.JSONDecodeError:
                pass
        else:
            subtasks_decrypted = self.subtasks

        return {
            "id": self.id,
            "user_id": self.user_id,
            "profile_id": self.profile_id,
            "category": self.category,
            "description": self.description,
            "priority": self.priority,
            "status": self.status,
            "due_date": self.due_date,
            "action_data": action_data_decrypted,
            "subtasks": subtasks_decrypted,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
