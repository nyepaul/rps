#!/usr/bin/env python3
"""
Reset user password.

Usage:
  ./bin/reset-password <username> <new_password> [--force]

Example:
  ./bin/reset-password admin "MyNewSecurePassword123"
  ./bin/reset-password john "MyNewSecurePassword123" --force

Use --force to skip confirmation when user has encrypted data (data will be lost)
"""

import sys
import os
import sqlite3
import argparse

# Add parent directory to path to find src package if needed
# (Assuming script is run from project root via bin/ wrapper)
sys.path.insert(0, os.getcwd())

try:
    import bcrypt
except ImportError:
    print("❌ Error: bcrypt module not found")
    print("Please install bcrypt: pip3 install bcrypt")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Reset a user password.')
    parser.add_argument('username', help='Username to reset')
    parser.add_argument('password', help='New password (min 8 chars)')
    parser.add_argument('--force', action='store_true', help='Skip data loss confirmation')
    parser.add_argument('--db-path', default='data/planning.db', help='Path to SQLite database')

    args = parser.parse_args()

    db_path = args.db_path
    username = args.username
    new_password = args.password
    force = args.force

    # Check if database exists
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        print("Please ensure the application has been initialized.")
        sys.exit(1)

    # Validate password
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters!")
        sys.exit(1)

    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if user exists
        cursor.execute('SELECT id, username, is_active, encrypted_dek, dek_iv FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()

        if not user:
            print(f'❌ User "{username}" not found')
            conn.close()
            sys.exit(1)

        user_id, user_name, is_active, encrypted_dek, dek_iv = user
        has_encrypted_data = bool(encrypted_dek and dek_iv)

        print(f'Found user: {user_name} (ID: {user_id}, Active: {is_active})')

        # Warn if user has encrypted data
        if has_encrypted_data:
            print()
            print("⚠️" * 30)
            print("⚠️  CRITICAL WARNING: DATA LOSS!")
            print("⚠️" * 30)
            print()
            print(f"User '{username}' has encrypted data protected by their password.")
            print("Resetting the password WITHOUT the old password will:")
            print("  • PERMANENTLY DELETE all encrypted profile data")
            print("  • Make financial data UNRECOVERABLE")
            print("  • This CANNOT be undone!")
            print()

            if not force:
                print("❌ Password reset cancelled!")
                print()
                print("To proceed with data loss, use the --force flag.")
                conn.close()
                sys.exit(1)
            else:
                print("🔴 Proceeding with password reset (--force flag used)")
                print("   Encrypted data will be permanently deleted!")
                print()

        # Hash the password
        print('Hashing password...')
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Update password and clear DEK if needed
        print('Updating password...')
        if has_encrypted_data:
            # Clear encrypted DEK - data is now inaccessible
            cursor.execute(
                'UPDATE users SET password_hash = ?, encrypted_dek = NULL, dek_iv = NULL WHERE username = ?',
                (password_hash, username)
            )
            print('🗑️  Encrypted data keys cleared (data now inaccessible)')
        else:
            cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, username))

        conn.commit()
        conn.close()

        print()
        print("=" * 60)
        print(f"✅ Password for '{username}' reset successfully!")
        print("=" * 60)
        
        if has_encrypted_data:
            print("🔴 Note: Profile data was cleared due to encryption key reset.")

    except Exception as e:
        print(f'❌ Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
