"""Conversation model with user and profile ownership and encryption."""

from datetime import datetime
import json
import logging
from src.database import connection
from src.services.encryption_service import encrypt, decrypt

logger = logging.getLogger(__name__)


class Conversation:
    """Conversation model for AI advisor chat history."""

    def __init__(
        self,
        id=None,
        user_id=None,
        profile_id=None,
        role=None,
        content=None,
        content_iv=None,
        created_at=None,
        **kwargs,
    ):
        self.id = id
        self.user_id = user_id
        self.profile_id = profile_id
        self.role = role  # 'user' or 'assistant'
        self.content = content  # Encrypted ciphertext
        self.content_iv = content_iv  # IV for content
        self._decrypted_content = None
        self.created_at = created_at or datetime.now().isoformat()

    @staticmethod
    def get_by_id(conversation_id: int, user_id: int):
        """Get conversation by ID (with ownership check)."""
        row = connection.db.execute_one(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id),
        )
        if row:
            return Conversation(**dict(row))
        return None

    @staticmethod
    def list_by_profile(user_id: int, profile_id: int):
        """List conversation history for a profile."""
        rows = connection.db.execute(
            """SELECT * FROM conversations
               WHERE user_id = ? AND profile_id = ?
               ORDER BY created_at ASC""",
            (user_id, profile_id),
        )
        return [Conversation(**dict(row)) for row in rows]

    @staticmethod
    def list_by_user(user_id: int):
        """List all conversations for a user."""
        rows = connection.db.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
        return [Conversation(**dict(row)) for row in rows]

    def save(self):
        """Save conversation message (encrypts content)."""
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()

            # Encrypt content if needed
            if self._decrypted_content is not None:
                self.content, self.content_iv = encrypt(self._decrypted_content)
            elif isinstance(self.content, str) and not self.content_iv:
                # Plain string content, encrypt it
                self.content, self.content_iv = encrypt(self.content)

            if self.id is None:
                cursor.execute(
                    """
                    INSERT INTO conversations (user_id, profile_id, role, content, content_iv, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (
                        self.user_id,
                        self.profile_id,
                        self.role,
                        self.content,
                        self.content_iv,
                        self.created_at,
                    ),
                )
                self.id = cursor.lastrowid
            else:
                cursor.execute(
                    """
                    UPDATE conversations
                    SET role = ?, content = ?, content_iv = ?
                    WHERE id = ? AND user_id = ?
                """,
                    (self.role, self.content, self.content_iv, self.id, self.user_id),
                )
        return self

    def delete(self):
        """Delete conversation message."""
        if self.id:
            with connection.db.get_connection() as conn:
                conn.execute(
                    "DELETE FROM conversations WHERE id = ? AND user_id = ?",
                    (self.id, self.user_id),
                )

    @staticmethod
    def delete_by_profile(user_id: int, profile_id: int):
        """Delete all conversations for a profile (with ownership check)."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "DELETE FROM conversations WHERE user_id = ? AND profile_id = ?",
                (user_id, profile_id),
            )

    def to_dict(self):
        """Convert to dictionary (decrypts content)."""
        # Decrypt content
        content_decrypted = None
        if self.content and self.content_iv:
            try:
                content_decrypted = decrypt(self.content, self.content_iv)
            except (ValueError, TypeError, json.JSONDecodeError) as e:
                logger.warning("Conversation %s: decryption failed (%s), trying fallback", self.id, e)
                # Fallback: content may be plain text stored with an IV
                if isinstance(self.content, str):
                    try:
                        content_decrypted = json.loads(self.content)
                    except json.JSONDecodeError:
                        content_decrypted = self.content
        elif isinstance(self.content, str):
            try:
                content_decrypted = json.loads(self.content)
            except json.JSONDecodeError:
                content_decrypted = self.content
        else:
            content_decrypted = self.content

        return {
            "id": self.id,
            "user_id": self.user_id,
            "profile_id": self.profile_id,
            "role": self.role,
            "content": content_decrypted,
            "created_at": self.created_at,
        }
