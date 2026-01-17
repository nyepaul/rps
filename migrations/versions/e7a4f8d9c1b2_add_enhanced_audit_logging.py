"""add_enhanced_audit_logging

Revision ID: e7a4f8d9c1b2
Revises: c8f3d7e2b9a1
Create Date: 2026-01-17 00:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a4f8d9c1b2'
down_revision: Union[str, Sequence[str], None] = 'c8f3d7e2b9a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create enhanced_audit_log and audit_config tables."""

    # Create enhanced_audit_log table with comprehensive fields
    op.execute('''
        CREATE TABLE IF NOT EXISTS enhanced_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            table_name TEXT,
            record_id INTEGER,
            user_id INTEGER,
            details TEXT,
            status_code INTEGER,
            error_message TEXT,
            ip_address TEXT,
            user_agent TEXT,
            geo_location TEXT,
            device_info TEXT,
            request_method TEXT,
            request_endpoint TEXT,
            request_query TEXT,
            request_size INTEGER,
            referrer TEXT,
            session_id TEXT,
            request_headers TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        )
    ''')

    # Create indexes for common queries
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_user_id ON enhanced_audit_log(user_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_action ON enhanced_audit_log(action)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_table_name ON enhanced_audit_log(table_name)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_created_at ON enhanced_audit_log(created_at)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_ip_address ON enhanced_audit_log(ip_address)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_status_code ON enhanced_audit_log(status_code)')

    # Create audit configuration table
    op.execute('''
        CREATE TABLE IF NOT EXISTS audit_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            config_data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')


def downgrade() -> None:
    """Downgrade schema - remove enhanced_audit_log and audit_config tables."""

    op.execute('DROP TABLE IF EXISTS enhanced_audit_log')
    op.execute('DROP TABLE IF EXISTS audit_config')
