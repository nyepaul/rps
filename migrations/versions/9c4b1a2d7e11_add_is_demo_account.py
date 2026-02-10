"""add_is_demo_account

Revision ID: 9c4b1a2d7e11
Revises: ff7c33cb22bb
Create Date: 2026-02-10 12:00:00.000000

Adds is_demo_account flag to users and backfills existing demo usernames.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9c4b1a2d7e11"
down_revision: Union[str, Sequence[str], None] = "ff7c33cb22bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN is_demo_account INTEGER DEFAULT 0
        """
    )
    op.execute(
        """
        UPDATE users
        SET is_demo_account = 1
        WHERE LOWER(username) = 'demo'
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # SQLite does not support DROP COLUMN; leave in place.
    pass
