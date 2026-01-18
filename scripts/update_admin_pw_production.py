#!/usr/bin/env python3
"""Update admin password in production database"""

import sqlite3
import bcrypt
import sys
import getpass

# Production database path
db_path = '/var/www/rps.pan2.app/data/planning.db'
username = 'admin'

# Securely prompt for password
if len(sys.argv) > 1:
    password = sys.argv[1]
else:
    password = getpass.getpass("Enter new admin password: ")
    confirm_password = getpass.getpass("Confirm new admin password: ")

    if password != confirm_password:
        print("❌ Passwords do not match!")
        sys.exit(1)

    if len(password) < 8:
        print("❌ Password must be at least 8 characters!")
        sys.exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if user exists
    cursor.execute('SELECT id, username, is_active FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()

    if not user:
        print(f'✗ User "{username}" not found')
        sys.exit(1)

    print(f'Found user: {user[1]} (ID: {user[0]}, Active: {user[2]})')

    # Hash the password
    print('Hashing password...')
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Update password
    print('Updating password in production database...')
    cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?', (password_hash, username))
    conn.commit()

    # Verify the update
    cursor.execute('SELECT password_hash FROM users WHERE username = ?', (username,))
    stored_hash = cursor.fetchone()[0]

    # Test password verification
    print('Verifying password...')
    if bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        print('✓ Password verification successful!')
        print(f'\n✓ Admin password updated successfully for user: {username}')
        print('\n⚠️  IMPORTANT: Store your admin password securely!')
    else:
        print('✗ Password verification failed!')
        sys.exit(1)

    conn.close()

except Exception as e:
    print(f'✗ Error: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
