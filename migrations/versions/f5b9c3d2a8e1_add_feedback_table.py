"""add_feedback_table

Revision ID: f5b9c3d2a8e1
Revises: e7a4f8d9c1b2
Create Date: 2026-01-17 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5b9c3d2a8e1'
down_revision: Union[str, Sequence[str], None] = 'e7a4f8d9c1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create feedback table."""

    # Create feedback table with comprehensive browser and system info
    op.execute('''
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
    ''')

    # Create indexes for efficient queries
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)')


def downgrade() -> None:
    """Downgrade schema - remove feedback table."""

    op.execute('DROP TABLE IF EXISTS feedback')
