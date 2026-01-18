#!/usr/bin/env python3
"""Apply feedback content separation migration"""

import sqlite3
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

db_path = 'data/planning.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Creating feedback_content table...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS feedback_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedback_id INTEGER NOT NULL UNIQUE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
        )
    ''')

    print("Creating index on feedback_content...")
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_content_feedback_id ON feedback_content(feedback_id)')

    print("Migrating existing content to feedback_content table...")
    cursor.execute('''
        INSERT INTO feedback_content (feedback_id, content, created_at)
        SELECT id, content, created_at FROM feedback WHERE content IS NOT NULL
    ''')

    print("Creating new feedback table without content column...")
    cursor.execute('''
        CREATE TABLE feedback_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('comment', 'feature', 'bug')),
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved', 'closed')),
            admin_notes TEXT,
            ip_address TEXT,
            user_agent TEXT,
            browser_name TEXT,
            browser_version TEXT,
            os_name TEXT,
            os_version TEXT,
            device_type TEXT,
            screen_resolution TEXT,
            viewport_size TEXT,
            timezone TEXT,
            language TEXT,
            referrer TEXT,
            current_url TEXT,
            session_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    print("Copying data to new feedback table...")
    cursor.execute('''
        INSERT INTO feedback_new (
            id, user_id, type, status, admin_notes, ip_address, user_agent,
            browser_name, browser_version, os_name, os_version, device_type,
            screen_resolution, viewport_size, timezone, language, referrer,
            current_url, session_id, created_at, updated_at
        )
        SELECT
            id, user_id, type, status, admin_notes, ip_address, user_agent,
            browser_name, browser_version, os_name, os_version, device_type,
            screen_resolution, viewport_size, timezone, language, referrer,
            current_url, session_id, created_at, updated_at
        FROM feedback
    ''')

    print("Replacing old feedback table...")
    cursor.execute('DROP TABLE feedback')
    cursor.execute('ALTER TABLE feedback_new RENAME TO feedback')

    print("Recreating indexes on feedback table...")
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)')

    conn.commit()
    print("✓ Feedback content separation completed successfully!")

except Exception as e:
    print(f"✗ Error: {e}")
    if conn:
        conn.rollback()
    sys.exit(1)
finally:
    if conn:
        conn.close()
