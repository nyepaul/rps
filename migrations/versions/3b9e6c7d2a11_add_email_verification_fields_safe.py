"""add_email_verification_fields_safe

Revision ID: 3b9e6c7d2a11
Revises: 9c4b1a2d7e11
Create Date: 2026-02-14

This migration safely adds email verification columns if they don't exist.
It is written defensively because some environments may have applied ad-hoc SQL.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3b9e6c7d2a11"
down_revision: Union[str, Sequence[str], None] = "c3f9a6b1d2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, col: str) -> bool:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == col for r in rows)


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, "users", "email_verified"):
        op.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0")
    if not _has_column(conn, "users", "email_verification_sent_at"):
        op.execute("ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT")


def downgrade() -> None:
    # SQLite doesn't support DROP COLUMN; no-op downgrade.
    pass
