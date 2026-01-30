"""
Unit tests for Encryption Service
"""

import pytest
import json
from src.services.encryption_service import (
    EncryptionService,
    encrypt_dict,
    decrypt_dict,
)


def test_encryption_service_creation():
    """Test creating encryption service with custom key."""
    key = b"0" * 32  # 32 bytes for AES-256
    service = EncryptionService(key=key)
    assert service.key == key


def test_encryption_service_default_key():
    """Test creating encryption service with default key."""
    service = EncryptionService()
    assert service.key is not None
    assert len(service.key) == 32  # Should be 256 bits


def test_encrypt_decrypt_string(encryption_service):
    """Test encrypting and decrypting a string."""
    plaintext = "Hello, World!"

    # Encrypt
    ciphertext, iv = encryption_service.encrypt(plaintext)

    assert ciphertext != plaintext
    assert iv is not None
    assert isinstance(iv, str)  # IV is base64-encoded

    # Decrypt
    decrypted = encryption_service.decrypt(ciphertext, iv)
    assert decrypted == plaintext


def test_encrypt_decrypt_json(encryption_service):
    """Test encrypting and decrypting JSON data."""
    data = {
        "name": "John Doe",
        "age": 45,
        "assets": 500000,
        "nested": {"income": 120000, "expenses": 80000},
    }

    json_str = json.dumps(data)

    # Encrypt
    ciphertext, iv = encryption_service.encrypt(json_str)
    assert ciphertext != json_str

    # Decrypt
    decrypted = encryption_service.decrypt(ciphertext, iv)
    assert decrypted == json_str

    # Verify data integrity
    decrypted_data = json.loads(decrypted)
    assert decrypted_data == data


def test_encrypt_dict_helper(encryption_service):
    """Test encrypt_dict helper function."""
    data = {"sensitive": "information", "amount": 1000000}

    ciphertext, iv = encrypt_dict(data)

    assert ciphertext is not None
    assert iv is not None
    assert isinstance(ciphertext, str)
    assert isinstance(iv, str)

    # Should not contain plaintext
    assert "sensitive" not in ciphertext
    assert "1000000" not in ciphertext


def test_decrypt_dict_helper(encryption_service):
    """Test decrypt_dict helper function."""
    data = {"key1": "value1", "key2": "value2", "number": 42}

    ciphertext, iv = encrypt_dict(data)
    decrypted = decrypt_dict(ciphertext, iv)

    assert decrypted == data


def test_encrypt_decrypt_empty_string(encryption_service):
    """Test that empty strings return None (not encrypted)."""
    plaintext = ""

    ciphertext, iv = encryption_service.encrypt(plaintext)

    # Empty strings are not encrypted, return None
    assert ciphertext is None
    assert iv is None


def test_encrypt_decrypt_unicode(encryption_service):
    """Test encrypting unicode characters."""
    plaintext = "Hello 世界 🌍"

    ciphertext, iv = encryption_service.encrypt(plaintext)
    decrypted = encryption_service.decrypt(ciphertext, iv)

    assert decrypted == plaintext


def test_different_ivs_produce_different_ciphertext(encryption_service):
    """Test that same plaintext with different IVs produces different ciphertext."""
    plaintext = "Same message"

    ciphertext1, iv1 = encryption_service.encrypt(plaintext)
    ciphertext2, iv2 = encryption_service.encrypt(plaintext)

    # IVs should be different
    assert iv1 != iv2

    # Ciphertexts should be different
    assert ciphertext1 != ciphertext2

    # But both should decrypt to same plaintext
    assert encryption_service.decrypt(ciphertext1, iv1) == plaintext
    assert encryption_service.decrypt(ciphertext2, iv2) == plaintext


def test_decrypt_with_wrong_iv(encryption_service):
    """Test that decryption with wrong IV fails."""
    plaintext = "Secret message"

    ciphertext, iv = encryption_service.encrypt(plaintext)

    # Create wrong IV
    wrong_iv = b"0" * 12

    # Should raise exception
    with pytest.raises(Exception):
        encryption_service.decrypt(ciphertext, wrong_iv)


def test_decrypt_with_tampered_ciphertext(encryption_service):
    """Test that tampered ciphertext fails decryption."""
    plaintext = "Important data"

    ciphertext, iv = encryption_service.encrypt(plaintext)

    # Tamper with ciphertext
    tampered = ciphertext[:-1] + "X"

    # Should raise exception
    with pytest.raises(Exception):
        encryption_service.decrypt(tampered, iv)


def test_encrypt_large_data(encryption_service):
    """Test encrypting large data."""
    large_data = {"items": [{"id": i, "value": f"item_{i}"} for i in range(1000)]}

    json_str = json.dumps(large_data)
    ciphertext, iv = encryption_service.encrypt(json_str)
    decrypted = encryption_service.decrypt(ciphertext, iv)

    assert json.loads(decrypted) == large_data


def test_encrypt_dict_none_returns_none():
    """Test that encrypting None returns None."""
    ciphertext, iv = encrypt_dict(None)
    assert ciphertext is None
    assert iv is None


def test_decrypt_dict_none_returns_none():
    """Test that decrypting None returns None."""
    decrypted = decrypt_dict(None, None)
    assert decrypted is None


def test_encryption_determinism(encryption_service):
    """Test that encryption is not deterministic (due to random IV)."""
    plaintext = "Test message"

    results = []
    for _ in range(5):
        ciphertext, iv = encryption_service.encrypt(plaintext)
        results.append((ciphertext, iv))

    # All should be unique
    unique_ciphertexts = set(c for c, _ in results)
    unique_ivs = set(iv for _, iv in results)

    assert len(unique_ciphertexts) == 5
    assert len(unique_ivs) == 5
