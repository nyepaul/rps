"""Profile model with user ownership, encryption, and audit logging."""
from datetime import datetime
from typing import Optional
import json
from src.database.connection import db
from src.services.encryption_service import encrypt_dict, decrypt_dict
from src.database.audit_logger import log_create, log_update, log_delete, log_read


class Profile:
    """Financial profile model."""
    
    def __init__(self, id=None, user_id=None, name=None, birth_date=None,
                 retirement_date=None, data=None, data_iv=None, updated_at=None, created_at=None):
        self.id = id
        self.user_id = user_id
        self.name = name
        self.birth_date = birth_date
        self.retirement_date = retirement_date
        self.data = data  # Encrypted ciphertext (base64)
        self.data_iv = data_iv  # Initialization vector (base64)
        self._decrypted_data = None  # Cache for decrypted data
        self.updated_at = updated_at or datetime.now().isoformat()
        self.created_at = created_at or datetime.now().isoformat()
    
    @property
    def data_dict(self):
        """Get data as dictionary (decrypts if encrypted)."""
        # Return cached decrypted data if available
        if self._decrypted_data is not None:
            return self._decrypted_data

        # If we have both data and data_iv, it's encrypted
        if self.data and self.data_iv:
            try:
                self._decrypted_data = decrypt_dict(self.data, self.data_iv)
                return self._decrypted_data or {}
            except Exception:
                # Decryption failed, might be plain JSON (for backward compatibility)
                pass

        # Fallback: treat as plain JSON
        if isinstance(self.data, str):
            try:
                self._decrypted_data = json.loads(self.data)
                return self._decrypted_data
            except json.JSONDecodeError:
                return {}

        return self.data or {}

    @data_dict.setter
    def data_dict(self, value):
        """Set data from dictionary (will be encrypted on save)."""
        self._decrypted_data = value
        # Don't encrypt yet - will be done in save()
    
    @staticmethod
    def get_by_id(profile_id: int, user_id: int):
        """Get profile by ID (with ownership check)."""
        row = db.execute_one(
            'SELECT * FROM profile WHERE id = ? AND user_id = ?',
            (profile_id, user_id)
        )
        if row:
            return Profile(**dict(row))
        return None
    
    @staticmethod
    def get_by_name(name: str, user_id: int):
        """Get profile by name (with ownership check)."""
        row = db.execute_one(
            'SELECT * FROM profile WHERE name = ? AND user_id = ?',
            (name, user_id)
        )
        if row:
            return Profile(**dict(row))
        return None
    
    @staticmethod
    def list_by_user(user_id: int):
        """List all profiles for a user."""
        rows = db.execute(
            'SELECT id, name, updated_at FROM profile WHERE user_id = ? ORDER BY updated_at DESC',
            (user_id,)
        )
        return [dict(row) for row in rows]
    
    def save(self):
        """Save or update profile (encrypts data and logs action)."""
        is_new = self.id is None

        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Encrypt data if we have decrypted data cached
            if self._decrypted_data is not None:
                encrypted_data, data_iv = encrypt_dict(self._decrypted_data)
                self.data = encrypted_data
                self.data_iv = data_iv
            elif isinstance(self.data, dict):
                # Data is a plain dict, encrypt it
                encrypted_data, data_iv = encrypt_dict(self.data)
                self.data = encrypted_data
                self.data_iv = data_iv
            # Otherwise, data is already encrypted (or plain JSON from old records)

            if is_new:
                # Insert new profile
                cursor.execute('''
                    INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (self.user_id, self.name, self.birth_date, self.retirement_date,
                      self.data, self.data_iv, self.created_at, self.updated_at))
                self.id = cursor.lastrowid
                # Log creation
                log_create('profile', self.id, self.user_id, f'Created profile: {self.name}')
            else:
                # Update existing profile
                cursor.execute('''
                    UPDATE profile
                    SET name = ?, birth_date = ?, retirement_date = ?, data = ?, data_iv = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                ''', (self.name, self.birth_date, self.retirement_date, self.data, self.data_iv,
                      datetime.now().isoformat(), self.id, self.user_id))
                # Log update
                log_update('profile', self.id, self.user_id, f'Updated profile: {self.name}')
        return self
    
    def delete(self):
        """Delete profile (logs action)."""
        if self.id:
            # Log deletion before deleting
            log_delete('profile', self.id, self.user_id, f'Deleted profile: {self.name}')
            with db.get_connection() as conn:
                conn.execute('DELETE FROM profile WHERE id = ? AND user_id = ?',
                           (self.id, self.user_id))
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'birth_date': self.birth_date,
            'retirement_date': self.retirement_date,
            'data': self.data_dict,
            'updated_at': self.updated_at,
            'created_at': self.created_at
        }
