"""Enforce strict roadmap phase constraint.

Revision ID: c3f9a6b1d2e4
Revises: e1a4b6c8d0f2
Create Date: 2026-02-11 23:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f9a6b1d2e4"
down_revision: Union[str, Sequence[str], None] = "e1a4b6c8d0f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _needs_rebuild(conn) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_roadmap'"
        )
    ).fetchone()
    if not row or not row[0]:
        return False

    ddl = row[0]
    # Rebuild if legacy phase value 'completed' is still allowed or if no phase check exists.
    return "phase IN ('phase1', 'phase2', 'phase3', 'backlog')" not in ddl


def upgrade() -> None:
    conn = op.get_bind()
    if not _needs_rebuild(conn):
        return

    op.execute("PRAGMA foreign_keys=OFF")

    op.execute(
        """
        CREATE TABLE feature_roadmap_new (
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
            phase TEXT DEFAULT 'backlog' CHECK(phase IN ('phase1', 'phase2', 'phase3', 'backlog')),
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
        """
    )

    op.execute(
        """
        INSERT INTO feature_roadmap_new (
            id, title, description, category, priority, phase, status, impact, effort,
            target_version, assigned_to, notes, related_items, created_at, updated_at, completed_at
        )
        SELECT
            id,
            title,
            description,
            category,
            priority,
            CASE
                WHEN phase IN ('phase1', 'phase2', 'phase3', 'backlog') THEN phase
                ELSE 'backlog'
            END,
            status,
            impact,
            effort,
            target_version,
            assigned_to,
            notes,
            related_items,
            created_at,
            updated_at,
            completed_at
        FROM feature_roadmap
        """
    )

    op.execute("DROP TABLE feature_roadmap")
    op.execute("ALTER TABLE feature_roadmap_new RENAME TO feature_roadmap")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_category ON feature_roadmap(category)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON feature_roadmap(priority)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_phase ON feature_roadmap(phase)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_status ON feature_roadmap(status)")

    op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(
        sa.text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='feature_roadmap'"
        )
    ).fetchone()
    if not row or not row[0]:
        return

    ddl = row[0]
    if "phase IN ('phase1', 'phase2', 'phase3', 'backlog')" not in ddl:
        return

    op.execute("PRAGMA foreign_keys=OFF")

    op.execute(
        """
        CREATE TABLE feature_roadmap_old (
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
        """
    )

    op.execute(
        """
        INSERT INTO feature_roadmap_old (
            id, title, description, category, priority, phase, status, impact, effort,
            target_version, assigned_to, notes, related_items, created_at, updated_at, completed_at
        )
        SELECT
            id, title, description, category, priority, phase, status, impact, effort,
            target_version, assigned_to, notes, related_items, created_at, updated_at, completed_at
        FROM feature_roadmap
        """
    )

    op.execute("DROP TABLE feature_roadmap")
    op.execute("ALTER TABLE feature_roadmap_old RENAME TO feature_roadmap")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_category ON feature_roadmap(category)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_priority ON feature_roadmap(priority)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_phase ON feature_roadmap(phase)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roadmap_status ON feature_roadmap(status)")

    op.execute("PRAGMA foreign_keys=ON")
