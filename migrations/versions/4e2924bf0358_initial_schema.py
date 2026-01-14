"""initial schema

Revision ID: 4e2924bf0358
Revises: 
Create Date: 2026-01-13 20:42:03.825117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e2924bf0358'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create profile table
    op.execute('''
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            birth_date TEXT,
            retirement_date TEXT,
            data TEXT,
            updated_at TEXT
        )
    ''')

    # Create scenarios table
    op.execute('''
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            parameters TEXT,
            results TEXT,
            created_at TEXT
        )
    ''')

    # Create action_items table
    op.execute('''
        CREATE TABLE IF NOT EXISTS action_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            category TEXT,
            description TEXT,
            priority TEXT,
            status TEXT,
            due_date TEXT,
            created_at TEXT,
            action_data TEXT,
            subtasks TEXT
        )
    ''')

    # Create conversations table
    op.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            role TEXT,
            content TEXT,
            created_at TEXT
        )
    ''')

    # Create system_settings table
    op.execute('''
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Create index for action_items
    op.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_action_items_unique
        ON action_items (profile_name, category, description)
    ''')


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('DROP TABLE IF EXISTS action_items')
    op.execute('DROP TABLE IF EXISTS conversations')
    op.execute('DROP TABLE IF EXISTS scenarios')
    op.execute('DROP TABLE IF EXISTS profile')
    op.execute('DROP TABLE IF EXISTS system_settings')
