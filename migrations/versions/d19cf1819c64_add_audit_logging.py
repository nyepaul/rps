"""add_audit_logging

Revision ID: d19cf1819c64
Revises: bb12bf639ceb
Create Date: 2026-01-13 21:09:29.781559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd19cf1819c64'
down_revision: Union[str, Sequence[str], None] = 'bb12bf639ceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create audit_log table."""

    op.execute('''
        CREATE TABLE audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            table_name TEXT NOT NULL,
            record_id INTEGER,
            user_id INTEGER,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        )
    ''')

    # Create indexes for common queries
    op.execute('CREATE INDEX idx_audit_log_user_id ON audit_log(user_id)')
    op.execute('CREATE INDEX idx_audit_log_table_name ON audit_log(table_name)')
    op.execute('CREATE INDEX idx_audit_log_action ON audit_log(action)')
    op.execute('CREATE INDEX idx_audit_log_created_at ON audit_log(created_at)')
    op.execute('CREATE INDEX idx_audit_log_record_id ON audit_log(record_id)')


def downgrade() -> None:
    """Downgrade schema - remove audit_log table."""

    op.execute('DROP TABLE IF EXISTS audit_log')
