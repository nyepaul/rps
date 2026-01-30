"""User authentication model."""

import bcrypt
import sqlite3
import secrets
import string
import jwt
from datetime import datetime, timedelta
from flask_login import UserMixin
from src.database import connection


class User(UserMixin):
    """User model for authentication."""

    def __init__(
        self,
        id,
        username,
        email,
        password_hash,
        is_active=True,
        is_admin=False,
        created_at=None,
        last_login=None,
        updated_at=None,
        encrypted_dek=None,
        dek_iv=None,
        reset_token=None,
        reset_token_expires=None,
        is_super_admin=False,
        recovery_encrypted_dek=None,
        recovery_iv=None,
        recovery_salt=None,
        email_encrypted_dek=None,
        email_iv=None,
        email_salt=None,
        preferences=None,
        email_verified=False,
        email_verification_sent_at=None,
        temp_recovery_code=None,
        recovery_code_shown=False,
        **kwargs,
    ):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self._is_active = bool(is_active) if is_active is not None else True
        self._is_admin = bool(is_admin) if is_admin is not None else False
        self._is_super_admin = (
            bool(is_super_admin) if is_super_admin is not None else False
        )
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
        self.preferences = preferences
        self.email_verified = (
            bool(email_verified) if email_verified is not None else False
        )
        self.email_verification_sent_at = email_verification_sent_at
        self.temp_recovery_code = temp_recovery_code
        self.recovery_code_shown = bool(recovery_code_shown) if recovery_code_shown is not None else False

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
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Check if provided password matches hash."""
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    @staticmethod
    def get_by_id(user_id: int):
        """Get user by ID."""
        row = connection.db.execute_one("SELECT * FROM users WHERE id = ?", (user_id,))
        if row:
            return User(**dict(row))
        return None

    @staticmethod
    def get_by_username(username: str):
        """Get user by username."""
        row = connection.db.execute_one("SELECT * FROM users WHERE username = ?", (username,))
        if row:
            return User(**dict(row))
        return None

    @staticmethod
    def get_by_email(email: str):
        """Get user by email."""
        row = connection.db.execute_one("SELECT * FROM users WHERE email = ?", (email,))
        if row:
            return User(**dict(row))
        return None

    def generate_verification_token(self, expiry_hours=24):
        """Generate a secure, signed email verification token (JWT)."""
        import jwt
        from flask import current_app

        payload = {
            "user_id": self.id,
            "email": self.email,
            "exp": datetime.utcnow() + timedelta(hours=expiry_hours),
            "iat": datetime.utcnow(),
            "purpose": "email_verification",
        }

        token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
        return token

    def confirm_email(self, token):
        """Verify the email verification token."""
        import jwt
        from flask import current_app

        try:
            payload = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )

            if payload.get("purpose") != "email_verification":
                return False

            if payload.get("user_id") != self.id:
                return False

            if payload.get("email") != self.email:
                return False

            self.email_verified = True
            self.save()
            return True

        except Exception:
            return False

    def save(self):
        """Save or update user in database."""
        with connection.db.get_connection() as conn:
            cursor = conn.cursor()
            if self.id is None:
                # Insert new user
                cursor.execute(
                    """
                    INSERT INTO users (username, email, password_hash, is_active, is_admin, is_super_admin, created_at, updated_at, 
                                     encrypted_dek, dek_iv, recovery_encrypted_dek, recovery_iv, recovery_salt,
                                     email_encrypted_dek, email_iv, email_salt, preferences, email_verified,
                                     temp_recovery_code, recovery_code_shown)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        self.username,
                        self.email,
                        self.password_hash,
                        1 if self._is_active else 0,
                        1 if self._is_admin else 0,
                        1 if self._is_super_admin else 0,
                        self.created_at,
                        self.updated_at,
                        self.encrypted_dek,
                        self.dek_iv,
                        self.recovery_encrypted_dek,
                        self.recovery_iv,
                        self.recovery_salt,
                        self.email_encrypted_dek,
                        self.email_iv,
                        self.email_salt,
                        self.preferences,
                        1 if self.email_verified else 0,
                        self.temp_recovery_code,
                        1 if self.recovery_code_shown else 0,
                    ),
                )  # Default to 0 for new, but if set explicitly respect it
                self.id = cursor.lastrowid
            else:
                # Update existing user
                cursor.execute(
                    """
                    UPDATE users
                    SET username = ?, email = ?, password_hash = ?, is_active = ?,
                        is_admin = ?, is_super_admin = ?, last_login = ?, encrypted_dek = ?, dek_iv = ?,
                        recovery_encrypted_dek = ?, recovery_iv = ?, recovery_salt = ?,
                        email_encrypted_dek = ?, email_iv = ?, email_salt = ?, preferences = ?,
                        email_verified = ?, temp_recovery_code = ?, recovery_code_shown = ?
                    WHERE id = ?
                """,
                    (
                        self.username,
                        self.email,
                        self.password_hash,
                        1 if self._is_active else 0,
                        1 if self._is_admin else 0,
                        1 if self._is_super_admin else 0,
                        self.last_login,
                        self.encrypted_dek,
                        self.dek_iv,
                        self.recovery_encrypted_dek,
                        self.recovery_iv,
                        self.recovery_salt,
                        self.email_encrypted_dek,
                        self.email_iv,
                        self.email_salt,
                        self.preferences,
                        1 if self.email_verified else 0,
                        self.temp_recovery_code,
                        1 if self.recovery_code_shown else 0,
                        self.id,
                    ),
                )
        return self

    def update_last_login(self):
        """Update last login timestamp."""
        self.last_login = datetime.now().isoformat()
        with connection.db.get_connection() as conn:
            conn.execute(
                "UPDATE users SET last_login = ? WHERE id = ?",
                (self.last_login, self.id),
            )

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
            dek_b64 = base64.b64encode(dek_bytes).decode("utf-8")
            enc_dek, iv = email_service.encrypt(dek_b64)

            # Update fields
            self.email_encrypted_dek = enc_dek
            self.email_iv = iv
            self.email_salt = base64.b64encode(email_salt).decode("utf-8")

        except Exception as e:
            print(f"Failed to update email recovery backup: {e}")

    def get_kek_salt(self) -> bytes:
        """Generate deterministic salt from username and email."""
        from cryptography.hazmat.primitives import hashes

        digest = hashes.Hash(hashes.SHA256())
        digest.update(self.username.encode("utf-8"))
        digest.update(self.email.encode("utf-8"))
        return digest.finalize()

    def get_dek(self, password: str):
        """Get decrypted DEK using password, handling legacy salt and iteration migration."""
        from src.services.encryption_service import EncryptionService
        import base64

        if not self.encrypted_dek or not self.dek_iv:
            return None

        # Decryption attempt strategy:
        # 1. New Salt (User-specific) + 600k iterations
        # 2. New Salt (User-specific) + 100k iterations (Migration needed)
        # 3. Legacy Salt (Generic) + 600k iterations (Migration needed)
        # 4. Legacy Salt (Generic) + 100k iterations (Migration needed)

        new_salt = self.get_kek_salt()
        legacy_salt = b"user-kek-salt"

        configs = [
            (new_salt, 600000, False),  # Preferred
            (new_salt, 100000, True),  # Needs Iteration Migration
            (legacy_salt, 600000, True),  # Needs Salt Migration
            (legacy_salt, 100000, True),  # Needs Full Migration
        ]

        for salt, iterations, needs_migration in configs:
            try:
                kek = EncryptionService.get_kek_from_password(
                    password, salt, iterations=iterations
                )
                service = EncryptionService(key=kek)
                dek_b64 = service.decrypt(self.encrypted_dek, self.dek_iv)

                if dek_b64:
                    dek = base64.b64decode(dek_b64)

                    if needs_migration:
                        # Re-encrypt with new salt AND 600k iterations immediately
                        new_kek = EncryptionService.get_kek_from_password(
                            password, new_salt, iterations=600000
                        )
                        new_service = EncryptionService(key=new_kek)
                        new_enc_dek, new_iv = new_service.encrypt(dek_b64)

                        # Update DB directly to persist migration
                        with connection.db.get_connection() as conn:
                            conn.execute(
                                """
                                UPDATE users 
                                SET encrypted_dek = ?, dek_iv = ? 
                                WHERE id = ?
                            """,
                                (new_enc_dek, new_iv, self.id),
                            )

                        # Update instance
                        self.encrypted_dek = new_enc_dek
                        self.dek_iv = new_iv
                        print(
                            f"Migrated user {self.username} to new encryption config (salt + iterations)"
                        )

                    return dek
            except Exception:
                continue

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
                raise ValueError(
                    "Old password required to re-encrypt data encryption key"
                )

            # Verify old password is correct
            if not self.check_password(old_password):
                raise ValueError("Old password is incorrect")

            try:
                # Get DEK (handles migration logic internally)
                dek = self.get_dek(old_password)

                # Re-encrypt DEK with new password and NEW salt
                new_salt = self.get_kek_salt()
                new_kek = EncryptionService.get_kek_from_password(
                    new_password, new_salt
                )
                new_service = EncryptionService(key=new_kek)

                # Encrypt the base64 string of the DEK (to match existing pattern)
                dek_b64 = base64.b64encode(dek).decode("utf-8")
                new_encrypted_dek, new_dek_iv = new_service.encrypt(dek_b64)

                # Update user's encrypted DEK
                self.encrypted_dek = new_encrypted_dek
                self.dek_iv = new_dek_iv

                # UPDATE EMAIL RECOVERY BACKUP
                self.update_email_recovery_backup(dek)

            except Exception as e:
                raise ValueError(f"Failed to re-encrypt data encryption key: {str(e)}")

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
        """Generate a secure, signed password reset token (JWT).

        Args:
            expiry_hours: Number of hours until token expires (default 1 hour)

        Returns:
            str: The generated reset token (JWT)
        """
        import jwt
        from flask import current_app

        # Generate a random JTI (Token ID) to allow revocation
        jti = secrets.token_urlsafe(16)

        payload = {
            "user_id": self.id,
            "exp": datetime.utcnow() + timedelta(hours=expiry_hours),
            "iat": datetime.utcnow(),
            "jti": jti,
            "purpose": "password_reset",
        }

        token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

        # Store JTI/Hash in DB for revocation (optional but good practice)
        # For now, we store the full token to maintain compatibility with existing flow
        # but the verification relies on the signature.
        self.reset_token = token
        self.reset_token_expires = (
            datetime.now() + timedelta(hours=expiry_hours)
        ).isoformat()

        with connection.db.get_connection() as conn:
            conn.execute(
                """
                UPDATE users
                SET reset_token = ?, reset_token_expires = ?
                WHERE id = ?
            """,
                (self.reset_token, self.reset_token_expires, self.id),
            )

        return token

    def is_reset_token_valid(self, token):
        """Check if a reset token is valid, signed, and not expired.

        Args:
            token: The token to validate

        Returns:
            bool: True if token is valid and not expired
        """
        import jwt
        from flask import current_app

        if not self.reset_token:
            return False

        # 1. Database check (Revocation check)
        # If the token in DB doesn't match, it means a new one was requested or password changed
        if self.reset_token != token:
            return False

        # 2. Signature and Expiration check (JWT)
        try:
            payload = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )

            # Verify purpose
            if payload.get("purpose") != "password_reset":
                return False

            # Verify user ID matches
            if payload.get("user_id") != self.id:
                return False

            return True
        except jwt.ExpiredSignatureError:
            return False
        except jwt.InvalidTokenError:
            return False
        except Exception:
            return False

    @staticmethod
    def get_by_reset_token(token):
        """Get user by valid reset token.

        Args:
            token: The reset token to look up

        Returns:
            User or None: The user if token is valid, None otherwise
        """
        row = connection.db.execute_one("SELECT * FROM users WHERE reset_token = ?", (token,))
        if row:
            user = User(**dict(row))
            # Validate token hasn't expired
            if user.is_reset_token_valid(token):
                return user
        return None

    @staticmethod
    def create_user(
        username: str,
        email: str,
        password: str,
        is_admin: bool = False,
        encrypted_dek=None,
        dek_iv=None,
    ):
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
            dek_iv=dek_iv,
        )
        return user.save()

    def get_groups(self):
        """Get groups this user belongs to."""
        from src.models.group import Group

        rows = connection.db.execute(
            """
            SELECT g.* FROM groups g
            JOIN user_groups ug ON g.id = ug.group_id
            WHERE ug.user_id = ?
        """,
            (self.id,),
        )
        return [Group(**dict(row)) for row in rows]

    def get_managed_groups(self):
        """Get groups this user can manage (for local admins)."""
        from src.models.group import Group

        if self.is_super_admin:
            return Group.get_all()

        rows = connection.db.execute(
            """
            SELECT g.* FROM groups g
            JOIN admin_groups ag ON g.id = ag.group_id
            WHERE ag.user_id = ?
        """,
            (self.id,),
        )
        return [Group(**dict(row)) for row in rows]

    def can_manage_user(self, target_user_id: int):
        """Check if this user can manage the target user."""
        if self.is_super_admin:
            return True
        if not self.is_admin:
            return False

        # Check if target user is in any group managed by this admin
        row = connection.db.execute_one(
            """
            SELECT 1 FROM user_groups ug
            JOIN admin_groups ag ON ug.group_id = ag.group_id
            WHERE ag.user_id = ? AND ug.user_id = ?
        """,
            (self.id, target_user_id),
        )

        return row is not None

    def add_to_group(self, group_id: int):
        """Add user to a group."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)",
                (self.id, group_id),
            )

    def remove_from_group(self, group_id: int):
        """Remove user from a group."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "DELETE FROM user_groups WHERE user_id = ? AND group_id = ?",
                (self.id, group_id),
            )

    def add_managed_group(self, group_id: int):
        """Assign a group to be managed by this admin."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO admin_groups (user_id, group_id) VALUES (?, ?)",
                (self.id, group_id),
            )

    def remove_managed_group(self, group_id: int):
        """Remove a group from being managed by this admin."""
        with connection.db.get_connection() as conn:
            conn.execute(
                "DELETE FROM admin_groups WHERE user_id = ? AND group_id = ?",
                (self.id, group_id),
            )

    @staticmethod
    def get_super_admins():
        """Get all super admin users.

        Returns:
            list[User]: List of super admin User objects
        """
        rows = connection.db.execute(
            "SELECT * FROM users WHERE is_super_admin = 1 AND is_active = 1"
        )
        return [User(**dict(row)) for row in rows]

    @staticmethod
    def get_super_admin_emails():
        """Get email addresses of all active super admins.

        Returns:
            list[str]: List of super admin email addresses
        """
        rows = connection.db.execute(
            "SELECT email FROM users WHERE is_super_admin = 1 AND is_active = 1"
        )
        return [row["email"] for row in rows]

    def __repr__(self):
        return f"<User {self.username}>"


class PasswordResetRequest:
    """Model for admin password reset requests."""

    def __init__(
        self,
        id,
        user_id,
        status="pending",
        request_ip=None,
        created_at=None,
        processed_at=None,
        processed_by=None,
        support_token=None,
        expires_at=None,
    ):
        self.id = id
        self.user_id = user_id
        self.status = status
        self.request_ip = request_ip
        self.created_at = created_at or datetime.now().isoformat()
        self.processed_at = processed_at
        self.processed_by = processed_by
        self.support_token = support_token
        self.expires_at = expires_at

    @staticmethod
    def create(user_id, ip_address=None):
        # Generate a short, readable support token (e.g., "A7X-29P")
        chars = string.ascii_uppercase + string.digits.replace("0", "").replace(
            "1", ""
        ).replace("I", "").replace(
            "O", ""
        )  # Ambiguity reduction
        token_part1 = "".join(secrets.choice(chars) for _ in range(3))
        token_part2 = "".join(secrets.choice(chars) for _ in range(3))
        support_token = f"{token_part1}-{token_part2}"

        expires_at = (datetime.now() + timedelta(hours=48)).isoformat()

        with connection.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO password_reset_requests (user_id, status, request_ip, created_at, support_token, expires_at)
                VALUES (?, 'pending', ?, ?, ?, ?)
            """,
                (
                    user_id,
                    ip_address,
                    datetime.now().isoformat(),
                    support_token,
                    expires_at,
                ),
            )
            return cursor.lastrowid, support_token

    @staticmethod
    def get_pending():
        with connection.db.get_connection() as conn:
            # Return rows as dicts
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT r.*, u.username, u.email 
                FROM password_reset_requests r
                JOIN users u ON r.user_id = u.id
                WHERE r.status = 'pending'
                ORDER BY r.created_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_by_id(request_id):
        row = connection.db.execute_one(
            "SELECT * FROM password_reset_requests WHERE id = ?", (request_id,)
        )
        if row:
            return PasswordResetRequest(**dict(row))
        return None

    def mark_processed(self, admin_id):
        self.status = "processed"
        self.processed_at = datetime.now().isoformat()
        self.processed_by = admin_id
        with connection.db.get_connection() as conn:
            conn.execute(
                """
                UPDATE password_reset_requests 
                SET status = ?, processed_at = ?, processed_by = ?
                WHERE id = ?
            """,
                (self.status, self.processed_at, self.processed_by, self.id),
            )
