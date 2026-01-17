import sqlite3
import bcrypt
from datetime import datetime
import os
import sys

# Ensure we can import from src if needed, though we just need standard libs + bcrypt
# bcrypt is installed in the target venv

db_path = '/var/www/rps.pan2.app/data/planning.db'

def create_or_update_user():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    username = 'demo'
    password = '***REMOVED***'
    email = 'demo@example.com'
    
    try:
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()

        if user:
            print(f"User '{username}' exists (ID: {user[0]}). Updating password.")
            cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (password_hash, username))
        else:
            print(f"Creating user '{username}'.")
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, is_active, is_admin, created_at, updated_at)
                VALUES (?, ?, ?, 1, 0, ?, ?)
            """, (username, email, password_hash, datetime.now().isoformat(), datetime.now().isoformat()))

        conn.commit()
        print("Success: Demo account ready.")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    create_or_update_user()
