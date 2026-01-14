"""add_encryption_columns

Revision ID: bb12bf639ceb
Revises: a90831a8aa09
Create Date: 2026-01-13 21:03:40.391028

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb12bf639ceb'
down_revision: Union[str, Sequence[str], None] = 'a90831a8aa09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add encryption IV columns."""

    # Add IV column for profile.data encryption
    op.execute('ALTER TABLE profile ADD COLUMN data_iv TEXT')

    # Add IV columns for scenarios encryption
    op.execute('ALTER TABLE scenarios ADD COLUMN parameters_iv TEXT')
    op.execute('ALTER TABLE scenarios ADD COLUMN results_iv TEXT')

    # Add IV columns for action_items encryption
    op.execute('ALTER TABLE action_items ADD COLUMN action_data_iv TEXT')
    op.execute('ALTER TABLE action_items ADD COLUMN subtasks_iv TEXT')

    # Add IV column for conversations encryption
    op.execute('ALTER TABLE conversations ADD COLUMN content_iv TEXT')


def downgrade() -> None:
    """Downgrade schema - remove encryption IV columns."""

    # SQLite doesn't support DROP COLUMN directly, so we need to recreate tables

    # Remove IV from profile
    op.execute('''
        CREATE TABLE profile_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            birth_date TEXT,
            retirement_date TEXT,
            data TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
    ''')

    op.execute('''
        INSERT INTO profile_new SELECT id, user_id, name, birth_date, retirement_date, data, updated_at, created_at
        FROM profile
    ''')

    op.execute('DROP TABLE profile')
    op.execute('ALTER TABLE profile_new RENAME TO profile')
    op.execute('CREATE INDEX idx_profile_user_id ON profile(user_id)')

    # Remove IVs from scenarios
    op.execute('''
        CREATE TABLE scenarios_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            profile_id INTEGER,
            name TEXT NOT NULL,
            parameters TEXT,
            results TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
        )
    ''')

    op.execute('''
        INSERT INTO scenarios_new SELECT id, user_id, profile_id, name, parameters, results, created_at
        FROM scenarios
    ''')

    op.execute('DROP TABLE scenarios')
    op.execute('ALTER TABLE scenarios_new RENAME TO scenarios')
    op.execute('CREATE INDEX idx_scenarios_user_id ON scenarios(user_id)')
    op.execute('CREATE INDEX idx_scenarios_profile_id ON scenarios(profile_id)')

    # Remove IVs from action_items
    op.execute('''
        CREATE TABLE action_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            profile_id INTEGER,
            category TEXT,
            description TEXT,
            priority TEXT,
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            action_data TEXT,
            subtasks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
        )
    ''')

    op.execute('''
        INSERT INTO action_items_new SELECT id, user_id, profile_id, category, description, priority, status, due_date, action_data, subtasks, created_at, updated_at
        FROM action_items
    ''')

    op.execute('DROP TABLE action_items')
    op.execute('ALTER TABLE action_items_new RENAME TO action_items')
    op.execute('CREATE INDEX idx_action_items_user_id ON action_items(user_id)')
    op.execute('CREATE INDEX idx_action_items_profile_id ON action_items(profile_id)')
    op.execute('CREATE INDEX idx_action_items_status ON action_items(status)')

    # Remove IV from conversations
    op.execute('''
        CREATE TABLE conversations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            profile_id INTEGER,
            role TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (profile_id) REFERENCES profile (id) ON DELETE CASCADE
        )
    ''')

    op.execute('''
        INSERT INTO conversations_new SELECT id, user_id, profile_id, role, content, created_at
        FROM conversations
    ''')

    op.execute('DROP TABLE conversations')
    op.execute('ALTER TABLE conversations_new RENAME TO conversations')
    op.execute('CREATE INDEX idx_conversations_user_id ON conversations(user_id)')
    op.execute('CREATE INDEX idx_conversations_profile_id ON conversations(profile_id)')
