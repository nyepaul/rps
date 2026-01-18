#!/usr/bin/env python3
"""Copy demo account from dev to production"""

import sqlite3
import json
from datetime import datetime

dev_db = 'data/planning.db'
prod_db = '/var/www/rps.pan2.app/data/planning.db'

def export_demo_data():
    """Export all demo account data from dev"""
    conn = sqlite3.connect(dev_db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get demo user
    cursor.execute('SELECT * FROM users WHERE username = ?', ('demo',))
    demo_user = dict(cursor.fetchone())
    dev_user_id = demo_user['id']

    print(f"📦 Exporting demo account from dev (ID: {dev_user_id})")
    print(f"   Email: {demo_user['email']}")
    print()

    # Get profiles
    cursor.execute('SELECT * FROM profile WHERE user_id = ?', (dev_user_id,))
    profiles = [dict(row) for row in cursor.fetchall()]
    print(f"   Profiles: {len(profiles)}")
    for p in profiles:
        print(f"      - {p['name']} (ID: {p['id']})")

    # Get scenarios
    cursor.execute('SELECT * FROM scenarios WHERE user_id = ?', (dev_user_id,))
    scenarios = [dict(row) for row in cursor.fetchall()]
    print(f"   Scenarios: {len(scenarios)}")

    # Get action items
    cursor.execute('SELECT * FROM action_items WHERE user_id = ?', (dev_user_id,))
    action_items = [dict(row) for row in cursor.fetchall()]
    print(f"   Action Items: {len(action_items)}")

    # Get conversations
    cursor.execute('SELECT * FROM conversations WHERE user_id = ?', (dev_user_id,))
    conversations = [dict(row) for row in cursor.fetchall()]
    print(f"   Conversations: {len(conversations)}")

    # Get feedback
    cursor.execute('SELECT * FROM feedback WHERE user_id = ?', (dev_user_id,))
    feedbacks = [dict(row) for row in cursor.fetchall()]
    feedback_ids = [f['id'] for f in feedbacks]
    print(f"   Feedback: {len(feedbacks)}")

    # Get feedback content
    feedback_contents = []
    if feedback_ids:
        placeholders = ','.join('?' * len(feedback_ids))
        cursor.execute(f'SELECT * FROM feedback_content WHERE feedback_id IN ({placeholders})', feedback_ids)
        feedback_contents = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'user': demo_user,
        'profiles': profiles,
        'scenarios': scenarios,
        'action_items': action_items,
        'conversations': conversations,
        'feedbacks': feedbacks,
        'feedback_contents': feedback_contents
    }

def import_demo_data(data):
    """Import demo account data to production"""
    conn = sqlite3.connect(prod_db)
    cursor = conn.cursor()

    try:
        # Get production demo user ID
        cursor.execute('SELECT id FROM users WHERE username = ?', ('demo',))
        result = cursor.fetchone()
        if not result:
            print("❌ Demo user not found in production!")
            return False

        prod_user_id = result[0]
        print(f"\n📥 Importing to production (ID: {prod_user_id})")
        print()

        # Delete existing demo data in production
        print("🗑️  Clearing existing demo data in production...")
        cursor.execute('DELETE FROM feedback_content WHERE feedback_id IN (SELECT id FROM feedback WHERE user_id = ?)', (prod_user_id,))
        cursor.execute('DELETE FROM feedback WHERE user_id = ?', (prod_user_id,))
        cursor.execute('DELETE FROM action_items WHERE user_id = ?', (prod_user_id,))
        cursor.execute('DELETE FROM conversations WHERE user_id = ?', (prod_user_id,))
        cursor.execute('DELETE FROM scenarios WHERE user_id = ?', (prod_user_id,))
        cursor.execute('DELETE FROM profile WHERE user_id = ?', (prod_user_id,))
        print("   ✓ Cleared")
        print()

        # Import profiles
        print(f"📋 Importing {len(data['profiles'])} profiles...")
        profile_id_map = {}
        for profile in data['profiles']:
            old_id = profile['id']
            cursor.execute('''
                INSERT INTO profile (user_id, name, data, birth_date, retirement_date,
                                   created_at, updated_at, data_iv)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                prod_user_id, profile['name'], profile['data'], profile['birth_date'],
                profile['retirement_date'], profile['created_at'],
                profile['updated_at'], profile.get('data_iv')
            ))
            new_id = cursor.lastrowid
            profile_id_map[old_id] = new_id
            print(f"   ✓ {profile['name']} (dev ID {old_id} → prod ID {new_id})")

        # Import scenarios
        print(f"📊 Importing {len(data['scenarios'])} scenarios...")
        scenario_id_map = {}
        for scenario in data['scenarios']:
            old_id = scenario['id']
            old_profile_id = scenario.get('profile_id')
            new_profile_id = profile_id_map.get(old_profile_id) if old_profile_id else None

            cursor.execute('''
                INSERT INTO scenarios (user_id, profile_id, name, parameters, results,
                                     created_at, parameters_iv, results_iv)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                prod_user_id, new_profile_id, scenario['name'], scenario.get('parameters'),
                scenario.get('results'), scenario['created_at'], scenario.get('parameters_iv'),
                scenario.get('results_iv')
            ))
            new_id = cursor.lastrowid
            scenario_id_map[old_id] = new_id
            print(f"   ✓ {scenario['name']} (dev ID {old_id} → prod ID {new_id})")

        # Import action items
        print(f"✅ Importing {len(data['action_items'])} action items...")
        for item in data['action_items']:
            old_profile_id = item.get('profile_id')
            new_profile_id = profile_id_map.get(old_profile_id) if old_profile_id else None

            cursor.execute('''
                INSERT INTO action_items (user_id, profile_id, title, description, priority,
                                        status, due_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                prod_user_id, new_profile_id, item['title'], item['description'],
                item['priority'], item['status'], item['due_date'], item['created_at'],
                item['updated_at']
            ))
        print(f"   ✓ Imported {len(data['action_items'])} action items")

        # Import conversations
        print(f"💬 Importing {len(data['conversations'])} conversations...")
        for conv in data['conversations']:
            old_profile_id = conv.get('profile_id')
            new_profile_id = profile_id_map.get(old_profile_id) if old_profile_id else None

            cursor.execute('''
                INSERT INTO conversations (user_id, profile_id, messages, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                prod_user_id, new_profile_id, conv['messages'], conv['created_at'],
                conv['updated_at']
            ))
        print(f"   ✓ Imported {len(data['conversations'])} conversations")

        # Import feedback
        print(f"📢 Importing {len(data['feedbacks'])} feedback items...")
        feedback_id_map = {}
        for feedback in data['feedbacks']:
            old_id = feedback['id']
            cursor.execute('''
                INSERT INTO feedback (user_id, type, status, admin_notes, ip_address, user_agent,
                                    browser_name, browser_version, os_name, os_version, device_type,
                                    screen_resolution, viewport_size, timezone, language, referrer,
                                    current_url, session_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                prod_user_id, feedback['type'], feedback['status'], feedback['admin_notes'],
                feedback['ip_address'], feedback['user_agent'], feedback['browser_name'],
                feedback['browser_version'], feedback['os_name'], feedback['os_version'],
                feedback['device_type'], feedback['screen_resolution'], feedback['viewport_size'],
                feedback['timezone'], feedback['language'], feedback['referrer'],
                feedback['current_url'], feedback['session_id'], feedback['created_at'],
                feedback['updated_at']
            ))
            new_id = cursor.lastrowid
            feedback_id_map[old_id] = new_id

        # Import feedback content
        for content in data['feedback_contents']:
            old_feedback_id = content['feedback_id']
            new_feedback_id = feedback_id_map.get(old_feedback_id)
            if new_feedback_id:
                cursor.execute('''
                    INSERT INTO feedback_content (feedback_id, content, created_at)
                    VALUES (?, ?, ?)
                ''', (new_feedback_id, content['content'], content['created_at']))

        print(f"   ✓ Imported {len(data['feedbacks'])} feedback items")

        conn.commit()
        print()
        print("✨ Demo account successfully copied to production!")
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    print("="*60)
    print("Demo Account Replication: Dev → Production")
    print("="*60)
    print()

    data = export_demo_data()
    import_demo_data(data)
