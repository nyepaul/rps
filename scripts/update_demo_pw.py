#!/usr/bin/env python3
"""
Update demo user password in production database.

Usage:
  python scripts/update_demo_pw.py [password]

If no password is provided, you will be prompted to enter one.
"""

import sqlite3
import bcrypt
import os
import sys
import getpass

db_path = '/var/www/rps.pan2.app/data/planning.db'

# Get password from command line or prompt securely
if len(sys.argv) > 1:
    password = sys.argv[1]
else:
    password = getpass.getpass("Enter new demo user password: ")
    confirm_password = getpass.getpass("Confirm new demo user password: ")

    if password != confirm_password:
        print("❌ Passwords do not match!")
        sys.exit(1)

    if len(password) < 8:
        print("❌ Password must be at least 8 characters!")
        sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

username = 'demo'
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (password_hash, username))
conn.commit()
conn.close()
print("✅ Updated password for demo user successfully!")
