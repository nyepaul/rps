"""add_foreign_keys

Revision ID: a90831a8aa09
Revises: ab8f12a95a89
Create Date: 2026-01-13 20:55:21.264812

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a90831a8aa09'
down_revision: Union[str, Sequence[str], None] = 'ab8f12a95a89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add foreign keys to all tables."""

    # Step 1: Recreate profile table with user_id and foreign key
    op.execute('DROP TABLE IF EXISTS profile_new')
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

    # Copy existing data if any, assign all profiles to user id 1 if it exists
    op.execute('''
        INSERT INTO profile_new (id, user_id, name, birth_date, retirement_date, data, updated_at, created_at)
        SELECT id, 1, name, birth_date, retirement_date, data, updated_at, CURRENT_TIMESTAMP
        FROM profile
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
    ''')

    op.execute('DROP TABLE profile')
    op.execute('ALTER TABLE profile_new RENAME TO profile')
    op.execute('CREATE INDEX idx_profile_user_id ON profile(user_id)')

    # Step 2: Recreate scenarios table with user_id, profile_id and foreign keys
    op.execute('DROP TABLE IF EXISTS scenarios_new')
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

    # Copy existing data (scenarios table doesn't have profile_name, so profile_id will be NULL)
    op.execute('''
        INSERT INTO scenarios_new (id, user_id, profile_id, name, parameters, results, created_at)
        SELECT id, 1, NULL, name, parameters, results, created_at
        FROM scenarios
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
    ''')

    op.execute('DROP TABLE scenarios')
    op.execute('ALTER TABLE scenarios_new RENAME TO scenarios')
    op.execute('CREATE INDEX idx_scenarios_user_id ON scenarios(user_id)')
    op.execute('CREATE INDEX idx_scenarios_profile_id ON scenarios(profile_id)')

    # Step 3: Recreate action_items table with user_id, profile_id and foreign keys
    op.execute('DROP TABLE IF EXISTS action_items_new')
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

    # Copy existing data (match profile by profile_name)
    op.execute('''
        INSERT INTO action_items_new (id, user_id, profile_id, category, description, priority, status, due_date, action_data, subtasks, created_at, updated_at)
        SELECT a.id, 1, p.id, a.category, a.description, a.priority, a.status, a.due_date, a.action_data, a.subtasks, a.created_at, CURRENT_TIMESTAMP
        FROM action_items a
        LEFT JOIN profile p ON p.name = a.profile_name AND p.user_id = 1
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
    ''')

    op.execute('DROP TABLE action_items')
    op.execute('ALTER TABLE action_items_new RENAME TO action_items')
    op.execute('CREATE INDEX idx_action_items_user_id ON action_items(user_id)')
    op.execute('CREATE INDEX idx_action_items_profile_id ON action_items(profile_id)')
    op.execute('CREATE INDEX idx_action_items_status ON action_items(status)')

    # Step 4: Recreate conversations table with user_id, profile_id and foreign keys
    op.execute('DROP TABLE IF EXISTS conversations_new')
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

    # Copy existing data (match profile by profile_name)
    op.execute('''
        INSERT INTO conversations_new (id, user_id, profile_id, role, content, created_at)
        SELECT c.id, 1, p.id, c.role, c.content, c.created_at
        FROM conversations c
        LEFT JOIN profile p ON p.name = c.profile_name AND p.user_id = 1
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
    ''')

    op.execute('DROP TABLE conversations')
    op.execute('ALTER TABLE conversations_new RENAME TO conversations')
    op.execute('CREATE INDEX idx_conversations_user_id ON conversations(user_id)')
    op.execute('CREATE INDEX idx_conversations_profile_id ON conversations(profile_id)')


def downgrade() -> None:
    """Downgrade schema - remove foreign keys from all tables."""

    # Recreate tables without foreign keys (reverse of upgrade)

    # Profile table
    op.execute('''
        CREATE TABLE profile_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            birth_date TEXT,
            retirement_date TEXT,
            data TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    op.execute('''
        INSERT INTO profile_new (id, name, birth_date, retirement_date, data, updated_at)
        SELECT id, name, birth_date, retirement_date, data, updated_at
        FROM profile
    ''')

    op.execute('DROP TABLE profile')
    op.execute('ALTER TABLE profile_new RENAME TO profile')

    # Scenarios table
    op.execute('''
        CREATE TABLE scenarios_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            name TEXT,
            parameters TEXT,
            results TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    op.execute('''
        INSERT INTO scenarios_new (id, profile_name, name, parameters, results, created_at)
        SELECT s.id, p.name, s.name, s.parameters, s.results, s.created_at
        FROM scenarios s
        LEFT JOIN profile p ON s.profile_id = p.id
    ''')

    op.execute('DROP TABLE scenarios')
    op.execute('ALTER TABLE scenarios_new RENAME TO scenarios')

    # Action items table
    op.execute('''
        CREATE TABLE action_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            category TEXT,
            description TEXT,
            priority TEXT,
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            action_data TEXT,
            subtasks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    op.execute('''
        INSERT INTO action_items_new (id, profile_name, category, description, priority, status, due_date, action_data, subtasks, created_at, updated_at)
        SELECT a.id, p.name, a.category, a.description, a.priority, a.status, a.due_date, a.action_data, a.subtasks, a.created_at, a.updated_at
        FROM action_items a
        LEFT JOIN profile p ON a.profile_id = p.id
    ''')

    op.execute('DROP TABLE action_items')
    op.execute('ALTER TABLE action_items_new RENAME TO action_items')
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_action_items_unique ON action_items (profile_name, category, description)')

    # Conversations table
    op.execute('''
        CREATE TABLE conversations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            role TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    op.execute('''
        INSERT INTO conversations_new (id, profile_name, role, content, created_at)
        SELECT c.id, p.name, c.role, c.content, c.created_at
        FROM conversations c
        LEFT JOIN profile p ON c.profile_id = p.id
    ''')

    op.execute('DROP TABLE conversations')
    op.execute('ALTER TABLE conversations_new RENAME TO conversations')
