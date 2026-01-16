"""add_encryption_columns_to_users

Revision ID: 08692d3a0001
Revises: 4ad7500c3cce
Create Date: 2026-01-15 19:54:30.892307

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08692d3a0001'
down_revision: Union[str, Sequence[str], None] = '4ad7500c3cce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add encryption columns to users."""
    op.execute('ALTER TABLE users ADD COLUMN encrypted_dek TEXT')
    op.execute('ALTER TABLE users ADD COLUMN dek_iv TEXT')


def downgrade() -> None:
    """Downgrade schema - remove encryption columns from users."""
    # SQLite doesn't support DROP COLUMN directly
    op.execute('''
        CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            last_login TEXT
        )
    ''')

    op.execute('''
        INSERT INTO users_new SELECT id, username, email, password_hash, is_active, is_admin, created_at, updated_at, last_login
        FROM users
    ''')

    op.execute('DROP TABLE users')
    op.execute('ALTER TABLE users_new RENAME TO users')
    op.execute('CREATE INDEX idx_users_username ON users(username)')
    op.execute('CREATE INDEX idx_users_email ON users(email)')
