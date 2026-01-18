#!/usr/bin/env python3
"""Add is_super_admin flag to users table"""

import sqlite3
import sys
import os

db_path = 'data/planning.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding is_super_admin column to users table...")
    cursor.execute('''
        ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0
    ''')

    print("Setting admin user as super admin...")
    # Set the 'admin' user as super admin
    cursor.execute('''
        UPDATE users SET is_super_admin = 1
        WHERE username = 'admin' OR id = 1
    ''')

    conn.commit()
    print("✓ Super admin flag added successfully!")

    # Show current super admins
    cursor.execute('SELECT id, username, is_admin, is_super_admin FROM users WHERE is_super_admin = 1')
    super_admins = cursor.fetchall()
    print("\nCurrent super admins:")
    for sa in super_admins:
        print(f"  - User #{sa[0]}: {sa[1]} (admin={sa[2]}, super_admin={sa[3]})")

except Exception as e:
    print(f"✗ Error: {e}")
    if conn:
        conn.rollback()
    sys.exit(1)
finally:
    if conn:
        conn.close()
