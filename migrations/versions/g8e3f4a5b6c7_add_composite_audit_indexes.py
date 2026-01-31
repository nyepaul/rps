"""add_composite_audit_indexes

Revision ID: g8e3f4a5b6c7
Revises: f7d2e3b4a5c6
Create Date: 2026-01-30 12:00:00.000000

Add composite indexes to enhanced_audit_log for faster range queries.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'g8e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'f7d2e3b4a5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite indexes for common query patterns."""

    # Composite index for user activity queries with date range
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_user_created
        ON enhanced_audit_log(user_id, created_at)
    ''')

    # Composite index for location/IP queries with date range
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_ip_created
        ON enhanced_audit_log(ip_address, created_at)
    ''')

    # Composite index for action + date queries (common in reports)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_action_created
        ON enhanced_audit_log(action, created_at)
    ''')

    # Index for users table admin queries
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_users_is_admin
        ON users(is_admin)
    ''')

    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_users_is_active
        ON users(is_active)
    ''')


def downgrade() -> None:
    """Remove composite indexes."""

    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_user_created')
    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_ip_created')
    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_action_created')
    op.execute('DROP INDEX IF EXISTS idx_users_is_admin')
    op.execute('DROP INDEX IF EXISTS idx_users_is_active')
