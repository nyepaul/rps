"""fix_password_reset_fks

Revision ID: f7d2e3b4a5c6
Revises: 5a368c84f95e
Create Date: 2026-01-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7d2e3b4a5c6'
down_revision: Union[str, Sequence[str], None] = '5a368c84f95e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add ON DELETE actions to password_reset_requests."""
    
    # SQLite requires table recreation to modify foreign keys
    op.execute('DROP TABLE IF EXISTS password_reset_requests_new')
    op.execute('''
        CREATE TABLE password_reset_requests_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending' NOT NULL,
            request_ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (processed_by) REFERENCES users (id) ON DELETE SET NULL
        )
    ''')
    
    # Copy data from old table
    op.execute('''
        INSERT INTO password_reset_requests_new (
            id, user_id, status, request_ip, created_at, processed_at, processed_by
        )
        SELECT id, user_id, status, request_ip, created_at, processed_at, processed_by
        FROM password_reset_requests
    ''')
    
    op.execute('DROP TABLE password_reset_requests')
    op.execute('ALTER TABLE password_reset_requests_new RENAME TO password_reset_requests')


def downgrade() -> None:
    """Downgrade schema - remove ON DELETE actions."""
    
    op.execute('DROP TABLE IF EXISTS password_reset_requests_new')
    op.execute('''
        CREATE TABLE password_reset_requests_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending' NOT NULL,
            request_ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (processed_by) REFERENCES users (id)
        )
    ''')
    
    op.execute('''
        INSERT INTO password_reset_requests_new (
            id, user_id, status, request_ip, created_at, processed_at, processed_by
        )
        SELECT id, user_id, status, request_ip, created_at, processed_at, processed_by
        FROM password_reset_requests
    ''')
    
    op.execute('DROP TABLE password_reset_requests')
    op.execute('ALTER TABLE password_reset_requests_new RENAME TO password_reset_requests')
