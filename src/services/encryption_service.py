"""AES-256-GCM encryption service for sensitive data."""
import os
import base64
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import json
from typing import Tuple, Optional


from flask import session

class EncryptionService:
    """Service for encrypting and decrypting sensitive data using AES-256-GCM."""

    def __init__(self, key: Optional[bytes] = None):
        """
        Initialize encryption service with a key.

        Args:
            key: 32-byte encryption key. If None, derives from ENCRYPTION_KEY env var.
        """
        if key is None:
            # Get key from environment or use default (change in production!)
            key_material = os.environ.get('ENCRYPTION_KEY', 'default-key-change-in-production')
            key = self._derive_key(key_material)

        self.key = key
        self.aesgcm = AESGCM(key)

    def _derive_key(self, key_material: str, salt: bytes = b'retirement-planning-salt') -> bytes:
        """Derive a 32-byte key from material."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(key_material.encode('utf-8') if isinstance(key_material, str) else key_material)

    @staticmethod
    def generate_dek() -> bytes:
        """Generate a random 32-byte Data Encryption Key."""
        return os.urandom(32)

    @staticmethod
    def generate_recovery_code() -> str:
        """Generate a secure 16-character alphanumeric recovery code."""
        # Generate 12 bytes (approx 16 chars in base32/hex)
        # Using simple hex for readability/typing
        return secrets.token_hex(8).upper()

    @staticmethod
    def get_kek_from_password(password: str, salt: bytes = b'user-kek-salt') -> bytes:
        """Derive a Key Encryption Key (KEK) from a user password."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return kdf.derive(password.encode('utf-8'))

    @staticmethod
    def get_recovery_kek(recovery_code: str, salt: bytes) -> bytes:
        """Derive a Key Encryption Key (KEK) from a recovery code."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=200000,  # Higher iterations for recovery codes
            backend=default_backend()
        )
        # Normalize code (uppercase, strip spaces)
        code = recovery_code.upper().replace(' ', '').replace('-', '').strip()
        return kdf.derive(code.encode('utf-8'))

    def encrypt(self, plaintext: str) -> Tuple[str, str]:
        """
        Encrypt plaintext string using AES-256-GCM.

        Args:
            plaintext: String to encrypt

        Returns:
            Tuple of (base64_ciphertext, base64_iv)
        """
        if not plaintext:
            return None, None

        # Generate random 12-byte IV (recommended for GCM)
        iv = os.urandom(12)

        # Encrypt the data
        ciphertext = self.aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)

        # Return base64-encoded ciphertext and IV
        return (
            base64.b64encode(ciphertext).decode('utf-8'),
            base64.b64encode(iv).decode('utf-8')
        )

    def decrypt(self, ciphertext: str, iv: str) -> Optional[str]:
        """
        Decrypt ciphertext using AES-256-GCM.

        Args:
            ciphertext: Base64-encoded ciphertext
            iv: Base64-encoded initialization vector

        Returns:
            Decrypted plaintext string or None if decryption fails
        """
        if not ciphertext or not iv:
            return None

        try:
            # Decode base64
            ciphertext_bytes = base64.b64decode(ciphertext)
            iv_bytes = base64.b64decode(iv)

            # Decrypt
            plaintext_bytes = self.aesgcm.decrypt(iv_bytes, ciphertext_bytes, None)

            return plaintext_bytes.decode('utf-8')
        except Exception as e:
            # Decryption failed (wrong key, corrupted data, etc.)
            raise ValueError(f"Decryption failed: {str(e)}")

    def encrypt_dict(self, data: dict) -> Tuple[str, str]:
        """
        Encrypt a dictionary by converting to JSON first.

        Args:
            data: Dictionary to encrypt

        Returns:
            Tuple of (base64_ciphertext, base64_iv)
        """
        if not data:
            return None, None

        json_str = json.dumps(data)
        return self.encrypt(json_str)

    def decrypt_dict(self, ciphertext: str, iv: str) -> Optional[dict]:
        """
        Decrypt ciphertext and parse as JSON dictionary.

        Args:
            ciphertext: Base64-encoded ciphertext
            iv: Base64-encoded initialization vector

        Returns:
            Decrypted dictionary or None if decryption fails
        """
        if not ciphertext or not iv:
            return None

        plaintext = self.decrypt(ciphertext, iv)
        if plaintext:
            return json.loads(plaintext)
        return None

    def encrypt_list(self, data: list) -> Tuple[str, str]:
        """
        Encrypt a list by converting to JSON first.

        Args:
            data: List to encrypt

        Returns:
            Tuple of (base64_ciphertext, base64_iv)
        """
        if not data:
            return None, None

        json_str = json.dumps(data)
        return self.encrypt(json_str)

    def decrypt_list(self, ciphertext: str, iv: str) -> Optional[list]:
        """
        Decrypt ciphertext and parse as JSON list.

        Args:
            ciphertext: Base64-encoded ciphertext
            iv: Base64-encoded initialization vector

        Returns:
            Decrypted list or None if decryption fails
        """
        if not ciphertext or not iv:
            return None

        plaintext = self.decrypt(ciphertext, iv)
        if plaintext:
            return json.loads(plaintext)
        return None


# Global encryption service instance
_encryption_service = None


def get_encryption_service() -> EncryptionService:
    """Get or create the global encryption service instance.
    Prefers user-specific DEK from session if available."""
    try:
        # Try to get user DEK from session
        user_dek_b64 = session.get('user_dek')
        if user_dek_b64:
            user_dek = base64.b64decode(user_dek_b64)
            return EncryptionService(key=user_dek)
    except Exception:
        # Session might not be available or dek invalid
        pass

    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


# Convenience functions
def encrypt(plaintext: str) -> Tuple[str, str]:
    """Encrypt plaintext using global or session-based service."""
    return get_encryption_service().encrypt(plaintext)


def decrypt(ciphertext: str, iv: str) -> Optional[str]:
    """Decrypt ciphertext using global or session-based service.
    Attempts session-based first, then falls back to global if session-based fails."""
    service = get_encryption_service()
    try:
        return service.decrypt(ciphertext, iv)
    except Exception:
        # If decryption failed and we were using a user key, try fallback to global
        if 'user_dek' in session:
            global _encryption_service
            if _encryption_service is None:
                _encryption_service = EncryptionService()
            try:
                return _encryption_service.decrypt(ciphertext, iv)
            except Exception:
                pass
        raise


def encrypt_dict(data: dict) -> Tuple[str, str]:
    """Encrypt dictionary using global or session-based service."""
    return get_encryption_service().encrypt_dict(data)


def decrypt_dict(ciphertext: str, iv: str) -> Optional[dict]:
    """Decrypt dictionary using global or session-based service."""
    if not ciphertext or not iv:
        return None
    
    plaintext = decrypt(ciphertext, iv)
    if plaintext:
        return json.loads(plaintext)
    return None


def encrypt_list(data: list) -> Tuple[str, str]:
    """Encrypt list using global or session-based service."""
    return get_encryption_service().encrypt_list(data)


def decrypt_list(ciphertext: str, iv: str) -> Optional[list]:
    """Decrypt list using global or session-based service."""
    if not ciphertext or not iv:
        return None
    
    plaintext = decrypt(ciphertext, iv)
    if plaintext:
        return json.loads(plaintext)
    return None
