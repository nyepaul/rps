"""add_password_reset_fields

Revision ID: c8f3d7e2b9a1
Revises: 08692d3a0001
Create Date: 2026-01-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f3d7e2b9a1'
down_revision: Union[str, Sequence[str], None] = '08692d3a0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add password reset fields to users."""
    op.execute('ALTER TABLE users ADD COLUMN reset_token TEXT')
    op.execute('ALTER TABLE users ADD COLUMN reset_token_expires TEXT')


def downgrade() -> None:
    """Downgrade schema - remove password reset fields from users."""
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
            last_login TEXT,
            encrypted_dek TEXT,
            dek_iv TEXT
        )
    ''')

    op.execute('''
        INSERT INTO users_new SELECT
            id, username, email, password_hash, is_active, is_admin,
            created_at, updated_at, last_login, encrypted_dek, dek_iv
        FROM users
    ''')

    op.execute('DROP TABLE users')
    op.execute('ALTER TABLE users_new RENAME TO users')
    op.execute('CREATE INDEX idx_users_username ON users(username)')
    op.execute('CREATE INDEX idx_users_email ON users(email)')
