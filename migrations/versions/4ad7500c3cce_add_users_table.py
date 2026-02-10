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
    # NOTE: Users table is created in ab8f12a95a89_add_users_table.
    # This migration is a no-op to preserve historical revisions without
    # re-creating the users table.
    op.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)')


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('DROP TABLE IF EXISTS users')
