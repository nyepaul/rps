#!/usr/bin/env python3
"""Check what API key is actually stored in the profile"""
import sys
import sqlite3

db_path = "/var/www/rps.pan2.app/data/planning.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get profiles
cursor.execute("SELECT id, name, data FROM profile")
profiles = cursor.fetchall()

print("=== Profile API Keys Check ===\n")
for profile_id, profile_name, encrypted_data in profiles:
    print(f"Profile: {profile_name} (ID: {profile_id})")
    print(f"  Data length: {len(encrypted_data) if encrypted_data else 0} bytes")

    # Try to decrypt and check
    if encrypted_data:
        try:
            # Import encryption service
            sys.path.insert(0, '/var/www/rps.pan2.app')
            from src.services.encryption_service import get_encryption_service

            enc_service = get_encryption_service()
            decrypted = enc_service.decrypt(encrypted_data)

            if 'api_keys' in decrypted:
                api_keys = decrypted['api_keys']
                print(f"  API keys configured: {list(api_keys.keys())}")

                for key_name, key_value in api_keys.items():
                    if key_value:
                        # Check for masked keys
                        has_bullets = '•' in key_value or '●' in key_value
                        print(f"    {key_name}: {key_value[:10]}...{key_value[-4:]} (len={len(key_value)}, masked={has_bullets})")
            else:
                print("  No api_keys section")
        except Exception as e:
            print(f"  Error decrypting: {e}")
    print()

conn.close()
