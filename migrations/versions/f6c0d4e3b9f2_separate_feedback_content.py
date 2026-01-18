"""separate_feedback_content

Revision ID: f6c0d4e3b9f2
Revises: f5b9c3d2a8e1
Create Date: 2026-01-17 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6c0d4e3b9f2'
down_revision: Union[str, Sequence[str], None] = 'f5b9c3d2a8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - separate feedback content into secure table."""

    # Create feedback_content table (only accessible to main admin)
    op.execute('''
        CREATE TABLE IF NOT EXISTS feedback_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedback_id INTEGER NOT NULL UNIQUE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
        )
    ''')

    # Create index for efficient lookups
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_content_feedback_id ON feedback_content(feedback_id)')

    # Migrate existing content from feedback table to feedback_content table
    op.execute('''
        INSERT INTO feedback_content (feedback_id, content, created_at)
        SELECT id, content, created_at FROM feedback WHERE content IS NOT NULL
    ''')

    # Remove content column from feedback table (create new table without content)
    op.execute('''
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

    # Copy data to new table (without content column)
    op.execute('''
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

    # Drop old table and rename new one
    op.execute('DROP TABLE feedback')
    op.execute('ALTER TABLE feedback_new RENAME TO feedback')

    # Recreate indexes on feedback table
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)')


def downgrade() -> None:
    """Downgrade schema - merge content back into feedback table."""

    # Add content column back to feedback
    op.execute('ALTER TABLE feedback ADD COLUMN content TEXT')

    # Restore content from feedback_content table
    op.execute('''
        UPDATE feedback
        SET content = (
            SELECT content FROM feedback_content
            WHERE feedback_content.feedback_id = feedback.id
        )
    ''')

    # Drop feedback_content table
    op.execute('DROP TABLE IF EXISTS feedback_content')
