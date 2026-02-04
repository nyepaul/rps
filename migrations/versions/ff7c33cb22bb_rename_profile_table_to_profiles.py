"""Rename profile table to profiles

Revision ID: ff7c33cb22bb
Revises: 1c0640ea0ef1
Create Date: 2026-02-04 15:59:24.355646

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff7c33cb22bb'
down_revision: Union[str, Sequence[str], None] = '1c0640ea0ef1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table('profile', 'profiles')


def downgrade() -> None:
    """Downgrade schema."""
    op.rename_table('profiles', 'profile')
