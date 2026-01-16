"""User authentication model."""
import bcrypt
from datetime import datetime
from flask_login import UserMixin
from src.database.connection import db


class User(UserMixin):
    """User model for authentication."""

    def __init__(self, id, username, email, password_hash, is_active=True, is_admin=False,
                 created_at=None, last_login=None, updated_at=None, encrypted_dek=None, dek_iv=None):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self._is_active = bool(is_active) if is_active is not None else True
        self._is_admin = bool(is_admin) if is_admin is not None else False
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.last_login = last_login
        self.encrypted_dek = encrypted_dek
        self.dek_iv = dek_iv

    @property
    def is_active(self):
        """Override UserMixin's is_active property."""
        return self._is_active

    @property
    def is_admin(self):
        """Admin status property."""
        return self._is_admin
    
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
        # Note: In a full implementation, we'd also re-encrypt the DEK here
        self.save()

    
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
