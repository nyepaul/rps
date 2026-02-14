"""Normalize schema parity between development and production databases.

Revision ID: d2f8c0a4b7e9
Revises: 9c4b1a2d7e11
Create Date: 2026-02-11 20:25:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2f8c0a4b7e9"
down_revision: Union[str, Sequence[str], None] = "9c4b1a2d7e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table_name: str) -> bool:
    return (
        conn.execute(
            sa.text(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name LIMIT 1"
            ),
            {"name": table_name},
        ).fetchone()
        is not None
    )


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table_name})")).fetchall()
    return any(row[1] == column_name for row in rows)


def upgrade() -> None:
    conn = op.get_bind()

    # Keep admin SMTP/system config storage available in both environments.
    if not _table_exists(conn, "system_config"):
        op.execute(
            """
            CREATE TABLE system_config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT,
                updated_by INTEGER
            )
            """
        )

    # Ensure users table always carries demo-account marker.
    if not _column_exists(conn, "users", "is_demo_account"):
        op.add_column(
            "users", sa.Column("is_demo_account", sa.Integer(), server_default="0")
        )
    op.execute("UPDATE users SET is_demo_account = 1 WHERE lower(username) = 'demo'")

    # Feedback metadata parity.
    if not _column_exists(conn, "feedback", "email_sent"):
        op.add_column(
            "feedback", sa.Column("email_sent", sa.Boolean(), server_default="0")
        )
    if not _column_exists(conn, "feedback", "last_reply_at"):
        op.add_column("feedback", sa.Column("last_reply_at", sa.TIMESTAMP(), nullable=True))

    # Password-reset support token parity.
    if not _column_exists(conn, "password_reset_requests", "support_token"):
        op.add_column(
            "password_reset_requests", sa.Column("support_token", sa.Text(), nullable=True)
        )
    if not _column_exists(conn, "password_reset_requests", "expires_at"):
        op.add_column(
            "password_reset_requests", sa.Column("expires_at", sa.Text(), nullable=True)
        )

    # Ensure feedback_replies exists for fresh installs.
    # Older environments may have created this table via ad-hoc SQL.
    if not _table_exists(conn, "feedback_replies"):
        op.execute(
            """
            CREATE TABLE feedback_replies (
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
            "CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON feedback_replies(feedback_id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_feedback_replies_admin_id ON feedback_replies(admin_id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_feedback_replies_created_at ON feedback_replies(created_at)"
        )

    # Index parity.
    if _table_exists(conn, "feedback_replies") and _column_exists(conn, "feedback_replies", "is_private"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_feedback_replies_is_private ON feedback_replies(is_private)"
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token ON password_reset_requests(support_token)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_action ON enhanced_audit_log(action)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_created_at ON enhanced_audit_log(created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_ip_address ON enhanced_audit_log(ip_address)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_table_name ON enhanced_audit_log(table_name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_enhanced_audit_log_user_id ON enhanced_audit_log(user_id)"
    )


def downgrade() -> None:
    # SQLite does not support DROP COLUMN directly; keep downgrade safe/no-op.
    pass
