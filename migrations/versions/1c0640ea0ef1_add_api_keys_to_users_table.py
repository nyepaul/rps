"""add api keys to users table

Revision ID: 1c0640ea0ef1
Revises: g8e3f4a5b6c7
Create Date: 2026-01-31 10:19:14.808484

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1c0640ea0ef1'
down_revision: Union[str, Sequence[str], None] = 'g8e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('api_keys', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('api_keys_iv', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('api_keys_iv')
        batch_op.drop_column('api_keys')
