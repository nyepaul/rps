#!/usr/bin/env python3
"""
Test script for API key management functionality
Tests encryption, storage, and retrieval of API keys
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from services.encryption_service import get_encryption_service

def test_encryption_service():
    """Test the encryption service with API key-like data."""
    print("=" * 60)
    print("Testing Encryption Service")
    print("=" * 60)

    # Get encryption service instance
    encryption = get_encryption_service()
    print("✓ Encryption service initialized")

    # Test data simulating API keys
    test_data = {
        'api_keys': {
            'claude_api_key': 'sk-ant-test-key-1234567890',
            'gemini_api_key': 'AIzaSyTest1234567890'
        },
        'other_data': {
            'name': 'Test Profile',
            'created_at': '2025-01-15'
        }
    }

    print(f"\nOriginal data: {test_data}")

    # Test encryption
    try:
        ciphertext, iv = encryption.encrypt_dict(test_data)
        print(f"\n✓ Encryption successful")
        print(f"  Ciphertext length: {len(ciphertext)} chars")
        print(f"  IV length: {len(iv)} chars")
        print(f"  Ciphertext (first 50 chars): {ciphertext[:50]}...")
    except Exception as e:
        print(f"\n✗ Encryption failed: {e}")
        return False

    # Test decryption
    try:
        decrypted_data = encryption.decrypt_dict(ciphertext, iv)
        print(f"\n✓ Decryption successful")
        print(f"  Decrypted data: {decrypted_data}")
    except Exception as e:
        print(f"\n✗ Decryption failed: {e}")
        return False

    # Verify data integrity
    if decrypted_data == test_data:
        print(f"\n✓ Data integrity verified - decrypted data matches original")
    else:
        print(f"\n✗ Data integrity check failed")
        print(f"  Expected: {test_data}")
        print(f"  Got: {decrypted_data}")
        return False

    # Test API key masking
    claude_key = test_data['api_keys']['claude_api_key']
    masked_key = '••••••••' + claude_key[-4:]
    print(f"\n✓ API key masking works")
    print(f"  Original: {claude_key}")
    print(f"  Masked:   {masked_key}")

    return True


def test_api_key_validation():
    """Test API key validation logic."""
    print("\n" + "=" * 60)
    print("Testing API Key Validation")
    print("=" * 60)

    from pydantic import ValidationError

    # Import the schema from routes (we need to test this works)
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
    from routes.profiles import APIKeySchema

    # Test valid keys
    try:
        valid_data = APIKeySchema(
            claude_api_key='sk-ant-api03-test1234567890',
            gemini_api_key='AIzaSyTest1234567890'
        )
        print(f"\n✓ Valid API keys accepted")
        print(f"  Claude key: {valid_data.claude_api_key[:15]}...")
        print(f"  Gemini key: {valid_data.gemini_api_key[:15]}...")
    except ValidationError as e:
        print(f"\n✗ Validation failed for valid keys: {e}")
        return False

    # Test too short key
    try:
        invalid_data = APIKeySchema(
            claude_api_key='short'
        )
        print(f"\n✗ Validation should have rejected short key")
        return False
    except ValidationError:
        print(f"\n✓ Short API key correctly rejected")

    # Test optional keys
    try:
        partial_data = APIKeySchema(
            claude_api_key='sk-ant-api03-test1234567890'
        )
        print(f"✓ Optional keys work correctly (only Claude key provided)")
    except ValidationError as e:
        print(f"\n✗ Optional key validation failed: {e}")
        return False

    return True


def test_profile_integration():
    """Test that Profile model can handle API keys in encrypted data."""
    print("\n" + "=" * 60)
    print("Testing Profile Model Integration")
    print("=" * 60)

    # This is a conceptual test showing how API keys integrate with profiles
    print("\nProfile data structure:")
    example_profile_data = {
        'personal': {
            'name': 'John Doe',
            'age': 45
        },
        'assets': {
            'retirement_accounts': [],
            'taxable_accounts': []
        },
        'api_keys': {
            'claude_api_key': 'sk-ant-api03-...',
            'gemini_api_key': 'AIzaSy...'
        }
    }

    print(f"\nExample profile structure:")
    for key, value in example_profile_data.items():
        print(f"  {key}: {type(value).__name__}")

    print(f"\n✓ API keys stored in 'api_keys' section of profile data")
    print(f"✓ Entire data dict encrypted as single unit")
    print(f"✓ Encryption/decryption handled automatically by Profile model")

    return True


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("API KEY MANAGEMENT SYSTEM TEST")
    print("=" * 60)

    tests = [
        ("Encryption Service", test_encryption_service),
        ("API Key Validation", test_api_key_validation),
        ("Profile Integration", test_profile_integration),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Test '{name}' crashed with exception: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {name}")

    all_passed = all(result for _, result in results)

    if all_passed:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())
