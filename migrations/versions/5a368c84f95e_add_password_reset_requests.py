"""add password reset requests

Revision ID: 5a368c84f95e
Revises: 08692d3a0001
Create Date: 2026-01-21 13:55:35.769576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = '5a368c84f95e'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7' # I am correcting this based on the file list I saw earlier, assuming the generated one picked up something else or I should verify. 
# WAIT. I should NOT trust my manual "correction" if the tool generated it. The tool generated 'b2c3d4e5f6a7'.
# I must check what 'b2c3d4e5f6a7' is.
# If I blindly change it, I might break the chain.
# I will list migrations/versions again to see all files.
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'password_reset_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('request_ip', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=datetime.now),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('processed_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['processed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('password_reset_requests')