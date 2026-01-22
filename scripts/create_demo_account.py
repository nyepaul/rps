#!/usr/bin/env python3
"""
Create a demo account and copy all data from paul's account.
"""
import sys
import os
import sqlite3
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import bcrypt

def create_demo_account(db_path, source_username='paul', demo_username='demo', demo_password='demo'):
    """Create demo account and copy all data from source user."""

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        print(f"=== Creating Demo Account ===")
        print(f"Source user: {source_username}")
        print(f"Demo user: {demo_username}")
        print()

        # Get source user
        cursor.execute("SELECT id, username, email FROM users WHERE username = ?", (source_username,))
        source_user = cursor.fetchone()

        if not source_user:
            print(f"❌ Error: Source user '{source_username}' not found")
            return False

        source_user_id = source_user['id']
        print(f"✓ Found source user: {source_user['username']} (ID: {source_user_id})")

        # Check if demo user already exists
        cursor.execute("SELECT id FROM users WHERE username = ?", (demo_username,))
        existing_demo = cursor.fetchone()

        if existing_demo:
            print(f"⚠ Demo user '{demo_username}' already exists (ID: {existing_demo['id']})")
            response = input("Delete and recreate? (yes/no): ").strip().lower()
            if response == 'yes':
                demo_user_id = existing_demo['id']
                # Delete existing demo user (manual delete of records without CASCADE)
                cursor.execute("DELETE FROM password_reset_requests WHERE user_id = ? OR processed_by = ?", (demo_user_id, demo_user_id))
                cursor.execute("DELETE FROM users WHERE id = ?", (demo_user_id,))
                print(f"✓ Deleted existing demo user and all related data")
            else:
                print("Aborted.")
                return False

        # Create demo user
        password_hash = bcrypt.hashpw(demo_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        demo_email = f"{demo_username}@example.com"

        cursor.execute("""
            INSERT INTO users (username, email, password_hash, is_active, is_admin, created_at, updated_at)
            VALUES (?, ?, ?, 1, 0, ?, ?)
        """, (demo_username, demo_email, password_hash, datetime.now().isoformat(), datetime.now().isoformat()))

        demo_user_id = cursor.lastrowid
        print(f"✓ Created demo user: {demo_username} (ID: {demo_user_id})")
        print()

        # Copy profiles
        print("=== Copying Profiles ===")
        cursor.execute("SELECT * FROM profile WHERE user_id = ?", (source_user_id,))
        profiles = cursor.fetchall()

        profile_id_map = {}  # Map old profile IDs to new profile IDs

        for profile in profiles:
            cursor.execute("""
                INSERT INTO profile (user_id, name, birth_date, retirement_date, data, data_iv, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                demo_user_id,
                profile['name'],
                profile['birth_date'],
                profile['retirement_date'],
                profile['data'],
                profile['data_iv'],
                profile['created_at'],
                profile['updated_at']
            ))

            new_profile_id = cursor.lastrowid
            profile_id_map[profile['id']] = new_profile_id
            print(f"  ✓ Copied profile: {profile['name']} (ID: {profile['id']} -> {new_profile_id})")

        print(f"✓ Copied {len(profiles)} profile(s)")
        print()

        # Copy scenarios
        print("=== Copying Scenarios ===")
        cursor.execute("SELECT * FROM scenarios WHERE user_id = ?", (source_user_id,))
        scenarios = cursor.fetchall()

        for scenario in scenarios:
            old_profile_id = scenario['profile_id']
            new_profile_id = profile_id_map.get(old_profile_id)

            cursor.execute("""
                INSERT INTO scenarios (user_id, profile_id, name, parameters, parameters_iv, results, results_iv, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                demo_user_id,
                new_profile_id,
                scenario['name'],
                scenario['parameters'],
                scenario['parameters_iv'],
                scenario['results'],
                scenario['results_iv'],
                scenario['created_at']
            ))

            print(f"  ✓ Copied scenario: {scenario['name']}")

        print(f"✓ Copied {len(scenarios)} scenario(s)")
        print()

        # Copy action items
        print("=== Copying Action Items ===")
        cursor.execute("SELECT * FROM action_items WHERE user_id = ?", (source_user_id,))
        action_items = cursor.fetchall()

        for item in action_items:
            old_profile_id = item['profile_id']
            new_profile_id = profile_id_map.get(old_profile_id) if old_profile_id else None

            cursor.execute("""
                INSERT INTO action_items (
                    user_id, profile_id, category, description, priority, status,
                    due_date, action_data, action_data_iv, subtasks, subtasks_iv,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                demo_user_id,
                new_profile_id,
                item['category'],
                item['description'],
                item['priority'],
                item['status'],
                item['due_date'],
                item['action_data'],
                item['action_data_iv'],
                item['subtasks'],
                item['subtasks_iv'],
                item['created_at'],
                item['updated_at']
            ))

            print(f"  ✓ Copied action item: {item['description'][:50]}...")

        print(f"✓ Copied {len(action_items)} action item(s)")
        print()

        # Copy conversations
        print("=== Copying Conversations ===")
        cursor.execute("SELECT * FROM conversations WHERE user_id = ?", (source_user_id,))
        conversations = cursor.fetchall()

        for conv in conversations:
            old_profile_id = conv['profile_id']
            new_profile_id = profile_id_map.get(old_profile_id) if old_profile_id else None

            cursor.execute("""
                INSERT INTO conversations (user_id, profile_id, role, content, content_iv, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                demo_user_id,
                new_profile_id,
                conv['role'],
                conv['content'],
                conv['content_iv'],
                conv['created_at']
            ))

        print(f"✓ Copied {len(conversations)} conversation message(s)")
        print()

        # Commit all changes
        conn.commit()

        print("=== Summary ===")
        print(f"✓ Demo user created: {demo_username}")
        print(f"✓ Profiles copied: {len(profiles)}")
        print(f"✓ Scenarios copied: {len(scenarios)}")
        print(f"✓ Action items copied: {len(action_items)}")
        print(f"✓ Conversations copied: {len(conversations)}")
        print()
        print(f"Login credentials:")
        print(f"  Username: {demo_username}")
        print(f"  Password: {demo_password}")
        print()

        return True

    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        conn.close()


if __name__ == '__main__':
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'planning.db')

    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)

    print(f"Database: {db_path}")
    print()

    # Create demo account
    success = create_demo_account(db_path)

    sys.exit(0 if success else 1)
