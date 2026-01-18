"""add_feature_roadmap_table

Revision ID: a1b2c3d4e5f6
Revises: f6c0d4e3b9f2
Create Date: 2026-01-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f6c0d4e3b9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add feature roadmap table for super admin planning."""

    # Create feature_roadmap table
    op.execute('''
        CREATE TABLE IF NOT EXISTS feature_roadmap (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL CHECK(category IN (
                'Healthcare & Medical',
                'Tax Planning',
                'Debt Management',
                'Education Funding',
                'Insurance Analysis',
                'Social Security',
                'Estate Planning',
                'Business Owner',
                'Investment Analysis',
                'Life Events',
                'Pension & Annuity',
                'Real Estate',
                'RMD Planning',
                'Cash Flow',
                'Scenario Modeling',
                'Withdrawal Strategy',
                'Family & Legacy',
                'Retirement Lifestyle',
                'Risk Analysis',
                'Compliance & Documentation',
                'Technical Improvements',
                'UI/UX Enhancements'
            )),
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
            phase TEXT DEFAULT 'backlog' CHECK(phase IN ('phase1', 'phase2', 'phase3', 'backlog', 'completed')),
            status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
            impact TEXT CHECK(impact IN ('high', 'medium', 'low')),
            effort TEXT CHECK(effort IN ('small', 'medium', 'large', 'xl')),
            target_version TEXT,
            assigned_to TEXT,
            notes TEXT,
            related_items TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    ''')

    # Create indexes for efficient queries
    op.execute('CREATE INDEX IF NOT EXISTS idx_roadmap_category ON feature_roadmap(category)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON feature_roadmap(priority)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_roadmap_phase ON feature_roadmap(phase)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_roadmap_status ON feature_roadmap(status)')


def downgrade() -> None:
    """Downgrade schema - remove feature roadmap table."""
    op.execute('DROP TABLE IF EXISTS feature_roadmap')
