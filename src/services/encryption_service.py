"""AES-256-GCM encryption service for sensitive data."""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import json
from typing import Tuple, Optional


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

            # Derive a proper 32-byte key using PBKDF2HMAC
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'retirement-planning-salt',  # Fixed salt for consistency
                iterations=100000,
                backend=default_backend()
            )
            key = kdf.derive(key_material.encode('utf-8'))

        self.key = key
        self.aesgcm = AESGCM(key)

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
    """Get or create the global encryption service instance."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


# Convenience functions
def encrypt(plaintext: str) -> Tuple[str, str]:
    """Encrypt plaintext using global service."""
    return get_encryption_service().encrypt(plaintext)


def decrypt(ciphertext: str, iv: str) -> Optional[str]:
    """Decrypt ciphertext using global service."""
    return get_encryption_service().decrypt(ciphertext, iv)


def encrypt_dict(data: dict) -> Tuple[str, str]:
    """Encrypt dictionary using global service."""
    return get_encryption_service().encrypt_dict(data)


def decrypt_dict(ciphertext: str, iv: str) -> Optional[dict]:
    """Decrypt dictionary using global service."""
    return get_encryption_service().decrypt_dict(ciphertext, iv)


def encrypt_list(data: list) -> Tuple[str, str]:
    """Encrypt list using global service."""
    return get_encryption_service().encrypt_list(data)


def decrypt_list(ciphertext: str, iv: str) -> Optional[list]:
    """Decrypt list using global service."""
    return get_encryption_service().decrypt_list(ciphertext, iv)
