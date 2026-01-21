"""User authentication model."""
import bcrypt
import secrets
import sqlite3
from datetime import datetime, timedelta
from flask_login import UserMixin
from src.database.connection import db


class User(UserMixin):
    """User model for authentication."""

    def __init__(self, id, username, email, password_hash, is_active=True, is_admin=False,
                 created_at=None, last_login=None, updated_at=None, encrypted_dek=None, dek_iv=None,
                 reset_token=None, reset_token_expires=None, is_super_admin=False,
                 recovery_encrypted_dek=None, recovery_iv=None, recovery_salt=None,
                 email_encrypted_dek=None, email_iv=None, email_salt=None):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self._is_active = bool(is_active) if is_active is not None else True
        self._is_admin = bool(is_admin) if is_admin is not None else False
        self._is_super_admin = bool(is_super_admin) if is_super_admin is not None else False
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.last_login = last_login
        self.encrypted_dek = encrypted_dek
        self.dek_iv = dek_iv
        self.reset_token = reset_token
        self.reset_token_expires = reset_token_expires
        self.recovery_encrypted_dek = recovery_encrypted_dek
        self.recovery_iv = recovery_iv
        self.recovery_salt = recovery_salt
        self.email_encrypted_dek = email_encrypted_dek
        self.email_iv = email_iv
        self.email_salt = email_salt

    @property
    def is_active(self):
        """Override UserMixin's is_active property."""
        return self._is_active

    @property
    def is_admin(self):
        """Admin status property."""
        return self._is_admin

    @property
    def is_super_admin(self):
        """Super admin status property."""
        return self._is_super_admin

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """Check if provided password matches hash."""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    @staticmethod
    def get_by_id(user_id: int):
        """Get user by ID."""
        row = db.execute_one(
            'SELECT * FROM users WHERE id = ?',
            (user_id,)
        )
        if row:
            return User(**dict(row))
        return None
    
    @staticmethod
    def get_by_username(username: str):
        """Get user by username."""
        row = db.execute_one(
            'SELECT * FROM users WHERE username = ?',
            (username,)
        )
        if row:
            return User(**dict(row))
        return None
    
    @staticmethod
    def get_by_email(email: str):
        """Get user by email."""
        row = db.execute_one(
            'SELECT * FROM users WHERE email = ?',
            (email,)
        )
        if row:
            return User(**dict(row))
        return None
    
    def save(self):
        """Save or update user in database."""
        with db.get_connection() as conn:
            cursor = conn.cursor()
            if self.id is None:
                # Insert new user
                cursor.execute('''
                    INSERT INTO users (username, email, password_hash, is_active, is_admin, created_at, updated_at, 
                                     encrypted_dek, dek_iv, recovery_encrypted_dek, recovery_iv, recovery_salt,
                                     email_encrypted_dek, email_iv, email_salt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (self.username, self.email, self.password_hash,
                      1 if self._is_active else 0,
                      1 if self._is_admin else 0,
                      self.created_at, self.updated_at,
                      self.encrypted_dek, self.dek_iv,
                      self.recovery_encrypted_dek, self.recovery_iv, self.recovery_salt,
                      self.email_encrypted_dek, self.email_iv, self.email_salt))
                self.id = cursor.lastrowid
            else:
                # Update existing user
                cursor.execute('''
                    UPDATE users
                    SET username = ?, email = ?, password_hash = ?, is_active = ?,
                        is_admin = ?, last_login = ?, encrypted_dek = ?, dek_iv = ?,
                        recovery_encrypted_dek = ?, recovery_iv = ?, recovery_salt = ?,
                        email_encrypted_dek = ?, email_iv = ?, email_salt = ?
                    WHERE id = ?
                ''', (self.username, self.email, self.password_hash,
                      1 if self._is_active else 0,
                      1 if self._is_admin else 0,
                      self.last_login, self.encrypted_dek, self.dek_iv,
                      self.recovery_encrypted_dek, self.recovery_iv, self.recovery_salt,
                      self.email_encrypted_dek, self.email_iv, self.email_salt,
                      self.id))
        return self
    
    def update_last_login(self):
        """Update last login timestamp."""
        self.last_login = datetime.now().isoformat()
        with db.get_connection() as conn:
            conn.execute('UPDATE users SET last_login = ? WHERE id = ?', (self.last_login, self.id))

    def update_email_recovery_backup(self, dek_bytes: bytes):
        """Generate and store DEK backup encrypted with email address."""
        from src.services.encryption_service import EncryptionService
        import base64
        import os

        try:
            # Generate new salt for email key
            email_salt = os.urandom(16)
            
            # Derive KEK from email
            email_kek = EncryptionService.get_email_kek(self.email, email_salt)
            email_service = EncryptionService(key=email_kek)
            
            # Encrypt DEK
            dek_b64 = base64.b64encode(dek_bytes).decode('utf-8')
            enc_dek, iv = email_service.encrypt(dek_b64)
            
            # Update fields
            self.email_encrypted_dek = enc_dek
            self.email_iv = iv
            self.email_salt = base64.b64encode(email_salt).decode('utf-8')
            
        except Exception as e:
            print(f"Failed to update email recovery backup: {e}")

    def get_kek_salt(self) -> bytes:
        """Generate deterministic salt from username and email."""
        from cryptography.hazmat.primitives import hashes
        digest = hashes.Hash(hashes.SHA256())
        digest.update(self.username.encode('utf-8'))
        digest.update(self.email.encode('utf-8'))
        return digest.finalize()

    def get_dek(self, password: str):
        """Get decrypted DEK using password, handling legacy salt migration."""
        from src.services.encryption_service import EncryptionService
        import base64

        if not self.encrypted_dek or not self.dek_iv:
            return None

        # 1. Try with new salt (Username + Email)
        try:
            salt = self.get_kek_salt()
            kek = EncryptionService.get_kek_from_password(password, salt)
            service = EncryptionService(key=kek)
            dek_b64 = service.decrypt(self.encrypted_dek, self.dek_iv)
            if dek_b64:
                return base64.b64decode(dek_b64)
        except Exception:
            pass

        # 2. Try with legacy salt
        try:
            legacy_salt = b'user-kek-salt'
            kek = EncryptionService.get_kek_from_password(password, legacy_salt)
            service = EncryptionService(key=kek)
            dek_b64 = service.decrypt(self.encrypted_dek, self.dek_iv)
            
            if dek_b64:
                # MIGRATION: Re-encrypt with new salt immediately
                dek = base64.b64decode(dek_b64)
                
                new_salt = self.get_kek_salt()
                new_kek = EncryptionService.get_kek_from_password(password, new_salt)
                new_service = EncryptionService(key=new_kek)
                
                new_enc_dek, new_iv = new_service.encrypt(dek_b64)
                
                # Update DB directly to persist migration
                with db.get_connection() as conn:
                    conn.execute('''
                        UPDATE users 
                        SET encrypted_dek = ?, dek_iv = ? 
                        WHERE id = ?
                    ''', (new_enc_dek, new_iv, self.id))
                
                # Update instance
                self.encrypted_dek = new_enc_dek
                self.dek_iv = new_iv
                
                return dek
        except Exception:
            pass

        raise ValueError("Failed to decrypt encryption key with provided password")

    def update_password(self, new_password: str, old_password: str = None):
        """Update the user's password and re-encrypt DEK.

        Args:
            new_password: The new password to set
            old_password: The current password (required if user has encrypted DEK)

        Raises:
            ValueError: If old_password is required but not provided, or if old_password is incorrect
        """
        from src.services.encryption_service import EncryptionService
        import base64

        # If user has encrypted DEK, we must re-encrypt it with new password
        if self.encrypted_dek and self.dek_iv:
            if not old_password:
                raise ValueError('Old password required to re-encrypt data encryption key')

            # Verify old password is correct
            if not self.check_password(old_password):
                raise ValueError('Old password is incorrect')

            try:
                # Get DEK (handles migration logic internally)
                dek = self.get_dek(old_password)

                # Re-encrypt DEK with new password and NEW salt
                new_salt = self.get_kek_salt()
                new_kek = EncryptionService.get_kek_from_password(new_password, new_salt)
                new_service = EncryptionService(key=new_kek)
                
                # Encrypt the base64 string of the DEK (to match existing pattern)
                dek_b64 = base64.b64encode(dek).decode('utf-8')
                new_encrypted_dek, new_dek_iv = new_service.encrypt(dek_b64)

                # Update user's encrypted DEK
                self.encrypted_dek = new_encrypted_dek
                self.dek_iv = new_dek_iv
                
                # UPDATE EMAIL RECOVERY BACKUP
                self.update_email_recovery_backup(dek)

            except Exception as e:
                raise ValueError(f'Failed to re-encrypt data encryption key: {str(e)}')

        # Update password hash
        self.password_hash = User.hash_password(new_password)

        # Clear any reset tokens
        self.reset_token = None
        self.reset_token_expires = None

        self.save()

    def force_password_reset(self, new_password: str):
        """Force password reset WITHOUT re-encrypting DEK (admin use only).

        ⚠️ WARNING: This will make encrypted data PERMANENTLY INACCESSIBLE!
        Use only when:
        - Admin needs to reset a forgotten password
        - User cannot provide old password
        - Data loss is acceptable

        Args:
            new_password: The new password to set

        Returns:
            bool: True if DEK was lost (had encrypted data), False otherwise
        """
        dek_was_lost = bool(self.encrypted_dek and self.dek_iv)

        # Clear encrypted DEK - data is now inaccessible
        if dek_was_lost:
            self.encrypted_dek = None
            self.dek_iv = None

        # Update password hash
        self.password_hash = User.hash_password(new_password)

        # Clear any reset tokens
        self.reset_token = None
        self.reset_token_expires = None

        self.save()

        return dek_was_lost

    def generate_reset_token(self, expiry_hours=1):
        """Generate a secure password reset token.

        Args:
            expiry_hours: Number of hours until token expires (default 1 hour)

        Returns:
            str: The generated reset token
        """
        # Generate a secure random token (32 bytes = 64 hex characters)
        token = secrets.token_urlsafe(32)
        self.reset_token = token
        self.reset_token_expires = (datetime.now() + timedelta(hours=expiry_hours)).isoformat()

        with db.get_connection() as conn:
            conn.execute('''
                UPDATE users
                SET reset_token = ?, reset_token_expires = ?
                WHERE id = ?
            ''', (self.reset_token, self.reset_token_expires, self.id))

        return token

    def is_reset_token_valid(self, token):
        """Check if a reset token is valid and not expired.

        Args:
            token: The token to validate

        Returns:
            bool: True if token is valid and not expired
        """
        if not self.reset_token or not self.reset_token_expires:
            return False

        if self.reset_token != token:
            return False

        # Check if token has expired
        expiry_time = datetime.fromisoformat(self.reset_token_expires)
        if datetime.now() > expiry_time:
            return False

        return True

    @staticmethod
    def get_by_reset_token(token):
        """Get user by valid reset token.

        Args:
            token: The reset token to look up

        Returns:
            User or None: The user if token is valid, None otherwise
        """
        row = db.execute_one(
            'SELECT * FROM users WHERE reset_token = ?',
            (token,)
        )
        if row:
            user = User(**dict(row))
            # Validate token hasn't expired
            if user.is_reset_token_valid(token):
                return user
        return None

    @staticmethod
    def create_user(username: str, email: str, password: str, is_admin: bool = False, encrypted_dek=None, dek_iv=None):
        """Create a new user."""
        password_hash = User.hash_password(password)
        user = User(
            id=None,
            username=username,
            email=email,
            password_hash=password_hash,
            is_active=True,
            is_admin=is_admin,
            encrypted_dek=encrypted_dek,
            dek_iv=dek_iv
        )
        return user.save()
    
    def __repr__(self):
        return f'<User {self.username}>'


class PasswordResetRequest:
    """Model for admin password reset requests."""
    
    def __init__(self, id, user_id, status='pending', request_ip=None, created_at=None, processed_at=None, processed_by=None):
        self.id = id
        self.user_id = user_id
        self.status = status
        self.request_ip = request_ip
        self.created_at = created_at or datetime.now().isoformat()
        self.processed_at = processed_at
        self.processed_by = processed_by

    @staticmethod
    def create(user_id, ip_address=None):
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO password_reset_requests (user_id, status, request_ip, created_at)
                VALUES (?, 'pending', ?, ?)
            ''', (user_id, ip_address, datetime.now()))
            return cursor.lastrowid

    @staticmethod
    def get_pending():
        with db.get_connection() as conn:
            # Return rows as dicts
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT r.*, u.username, u.email 
                FROM password_reset_requests r
                JOIN users u ON r.user_id = u.id
                WHERE r.status = 'pending'
                ORDER BY r.created_at DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_by_id(request_id):
        row = db.execute_one(
            'SELECT * FROM password_reset_requests WHERE id = ?',
            (request_id,)
        )
        if row:
            return PasswordResetRequest(**dict(row))
        return None

    def mark_processed(self, admin_id):
        self.status = 'processed'
        self.processed_at = datetime.now()
        self.processed_by = admin_id
        with db.get_connection() as conn:
            conn.execute('''
                UPDATE password_reset_requests 
                SET status = ?, processed_at = ?, processed_by = ?
                WHERE id = ?
            ''', (self.status, self.processed_at, self.processed_by, self.id))