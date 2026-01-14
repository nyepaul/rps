#!/usr/bin/env python3
"""Create an admin user for the retirement planning system."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.auth.models import User
from src.database.connection import db
import getpass


def create_admin():
    """Create an admin user interactively."""
    print("=" * 50)
    print("Create Admin User")
    print("=" * 50)
    print()
    
    # Get username
    while True:
        username = input("Username: ").strip()
        if not username:
            print("Username cannot be empty")
            continue
        if len(username) < 3:
            print("Username must be at least 3 characters")
            continue
        
        # Check if username exists
        existing = User.get_by_username(username)
        if existing:
            print(f"User '{username}' already exists")
            continue
        break
    
    # Get email
    while True:
        email = input("Email: ").strip()
        if not email or '@' not in email:
            print("Please enter a valid email address")
            continue
        
        # Check if email exists
        existing = User.get_by_email(email)
        if existing:
            print(f"Email '{email}' already in use")
            continue
        break
    
    # Get password
    while True:
        password = getpass.getpass("Password: ")
        if len(password) < 8:
            print("Password must be at least 8 characters")
            continue
        
        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("Passwords do not match")
            continue
        break
    
    # Create admin user
    print()
    print("Creating admin user...")
    try:
        user = User.create_user(
            username=username,
            email=email,
            password=password,
            is_admin=True
        )
        print()
        print("✅ Admin user created successfully!")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Admin: {user.is_admin}")
        print()
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        sys.exit(1)


if __name__ == '__main__':
    # Check if users table exists
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            if not cursor.fetchone():
                print("❌ Users table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                sys.exit(1)
    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    
    create_admin()
