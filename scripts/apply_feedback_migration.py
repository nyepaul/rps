#!/usr/bin/env python3
"""Apply feedback table migration"""

import sqlite3
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

db_path = 'data/planning.db'

# Create feedback table
create_table_sql = '''
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('comment', 'feature', 'bug')),
        content TEXT NOT NULL,
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
'''

indexes = [
    'CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type)',
    'CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)',
    'CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)'
]

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Creating feedback table...")
    cursor.execute(create_table_sql)

    print("Creating indexes...")
    for index_sql in indexes:
        cursor.execute(index_sql)

    conn.commit()
    print("✓ Feedback table created successfully!")

except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)
finally:
    if conn:
        conn.close()
