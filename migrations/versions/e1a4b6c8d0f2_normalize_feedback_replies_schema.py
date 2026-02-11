"""Normalize feedback_replies schema across environments.

Revision ID: e1a4b6c8d0f2
Revises: d2f8c0a4b7e9
Create Date: 2026-02-11 20:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a4b6c8d0f2"
down_revision: Union[str, Sequence[str], None] = "d2f8c0a4b7e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _needs_rebuild(conn) -> bool:
    cols = conn.execute(sa.text("PRAGMA table_info(feedback_replies)")).fetchall()
    is_private = next((row for row in cols if row[1] == "is_private"), None)
    col_type = (is_private[2] if is_private else "").upper()

    fk_rows = conn.execute(sa.text("PRAGMA foreign_key_list(feedback_replies)")).fetchall()
    admin_fk = next((row for row in fk_rows if row[3] == "admin_id"), None)
    admin_on_delete = (admin_fk[6] if admin_fk else "").upper()

    return col_type != "INTEGER" or admin_on_delete != "CASCADE"


def upgrade() -> None:
    conn = op.get_bind()
    if not _needs_rebuild(conn):
        return

    op.execute("PRAGMA foreign_keys=OFF")

    op.execute(
        """
        CREATE TABLE feedback_replies_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedback_id INTEGER NOT NULL,
            admin_id INTEGER NOT NULL,
            reply_text TEXT NOT NULL,
            is_private INTEGER DEFAULT 0 CHECK(is_private IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    op.execute(
        """
        INSERT INTO feedback_replies_new
            (id, feedback_id, admin_id, reply_text, is_private, created_at, updated_at)
        SELECT
            id,
            feedback_id,
            admin_id,
            reply_text,
            CASE
                WHEN CAST(COALESCE(is_private, 0) AS INTEGER) != 0 THEN 1
                ELSE 0
            END,
            created_at,
            updated_at
        FROM feedback_replies
        """
    )

    op.execute("DROP TABLE feedback_replies")
    op.execute("ALTER TABLE feedback_replies_new RENAME TO feedback_replies")

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON feedback_replies(feedback_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_replies_admin_id ON feedback_replies(admin_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_replies_created_at ON feedback_replies(created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_replies_is_private ON feedback_replies(is_private)"
    )

    op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    # Deliberately no-op; previous schema variants were inconsistent across environments.
    pass
