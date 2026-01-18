"""User authentication model."""
import bcrypt
import secrets
from datetime import datetime, timedelta
from flask_login import UserMixin
from src.database.connection import db


class User(UserMixin):
    """User model for authentication."""

    def __init__(self, id, username, email, password_hash, is_active=True, is_admin=False,
                 created_at=None, last_login=None, updated_at=None, encrypted_dek=None, dek_iv=None,
                 reset_token=None, reset_token_expires=None, is_super_admin=False):
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
            row_dict = dict(row)
            print(f"DEBUG User.get_by_id({user_id}): row_dict['is_admin'] = {row_dict.get('is_admin')}, type = {type(row_dict.get('is_admin'))}")
            return User(**row_dict)
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
                    INSERT INTO users (username, email, password_hash, is_active, is_admin, created_at, updated_at, encrypted_dek, dek_iv)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (self.username, self.email, self.password_hash,
                      1 if self._is_active else 0,
                      1 if self._is_admin else 0,
                      self.created_at, self.updated_at,
                      self.encrypted_dek, self.dek_iv))
                self.id = cursor.lastrowid
            else:
                # Update existing user
                cursor.execute('''
                    UPDATE users
                    SET username = ?, email = ?, password_hash = ?, is_active = ?,
                        is_admin = ?, last_login = ?, encrypted_dek = ?, dek_iv = ?
                    WHERE id = ?
                ''', (self.username, self.email, self.password_hash,
                      1 if self._is_active else 0,
                      1 if self._is_admin else 0,
                      self.last_login, self.encrypted_dek, self.dek_iv, self.id))
        return self
    
    def update_last_login(self):
        """Update last login timestamp."""
        self.last_login = datetime.now().isoformat()
        with db.get_connection() as conn:
            conn.execute('UPDATE users SET last_login = ? WHERE id = ?', (self.last_login, self.id))
    
    def update_password(self, new_password: str):
        """Update the user's password."""
        self.password_hash = User.hash_password(new_password)
        # Clear any reset tokens
        self.reset_token = None
        self.reset_token_expires = None
        # Note: In a full implementation, we'd also re-encrypt the DEK here
        self.save()

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
