"""add_users_table

Revision ID: 4ad7500c3cce
Revises: d19cf1819c64
Create Date: 2026-01-14 09:38:39.682622

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ad7500c3cce'
down_revision: Union[str, Sequence[str], None] = 'd19cf1819c64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('''
        CREATE TABLE IF NOT EXISTS users (
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

    op.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)')


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('DROP TABLE IF EXISTS users')
