"""users_schema_parity_for_docker_installs

Revision ID: 7c2a9b1d4e10
Revises: 3b9e6c7d2a11
Create Date: 2026-02-14

Ensure the SQLite users table contains all columns required by the current
User model inserts/updates. This makes fresh Docker installs work without
legacy ad-hoc SQL scripts.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7c2a9b1d4e10"
down_revision: Union[str, Sequence[str], None] = "3b9e6c7d2a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(conn, table: str, col: str) -> bool:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == col for r in rows)


def upgrade() -> None:
    conn = op.get_bind()

    # Authorization / flags
    if not _has_column(conn, "users", "is_super_admin"):
        op.execute("ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0")
    if not _has_column(conn, "users", "is_demo_account"):
        op.execute("ALTER TABLE users ADD COLUMN is_demo_account INTEGER DEFAULT 0")

    # Password reset fields (some DBs created users before these migrations existed)
    if not _has_column(conn, "users", "reset_token"):
        op.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
    if not _has_column(conn, "users", "reset_token_expires"):
        op.execute("ALTER TABLE users ADD COLUMN reset_token_expires TEXT")

    # User DEK backup and recovery mechanisms
    if not _has_column(conn, "users", "recovery_encrypted_dek"):
        op.execute("ALTER TABLE users ADD COLUMN recovery_encrypted_dek TEXT")
    if not _has_column(conn, "users", "recovery_iv"):
        op.execute("ALTER TABLE users ADD COLUMN recovery_iv TEXT")
    if not _has_column(conn, "users", "recovery_salt"):
        op.execute("ALTER TABLE users ADD COLUMN recovery_salt TEXT")

    if not _has_column(conn, "users", "email_encrypted_dek"):
        op.execute("ALTER TABLE users ADD COLUMN email_encrypted_dek TEXT")
    if not _has_column(conn, "users", "email_iv"):
        op.execute("ALTER TABLE users ADD COLUMN email_iv TEXT")
    if not _has_column(conn, "users", "email_salt"):
        op.execute("ALTER TABLE users ADD COLUMN email_salt TEXT")

    # Preferences and verification status
    if not _has_column(conn, "users", "preferences"):
        op.execute("ALTER TABLE users ADD COLUMN preferences TEXT")
    if not _has_column(conn, "users", "email_verified"):
        op.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
    if not _has_column(conn, "users", "email_verification_sent_at"):
        op.execute("ALTER TABLE users ADD COLUMN email_verification_sent_at TEXT")

    # Recovery code reveal-once UX
    if not _has_column(conn, "users", "temp_recovery_code"):
        op.execute("ALTER TABLE users ADD COLUMN temp_recovery_code TEXT")
    if not _has_column(conn, "users", "recovery_code_shown"):
        op.execute("ALTER TABLE users ADD COLUMN recovery_code_shown INTEGER DEFAULT 0")

    # API keys storage (encrypted blob + iv)
    if not _has_column(conn, "users", "api_keys"):
        op.execute("ALTER TABLE users ADD COLUMN api_keys TEXT")
    if not _has_column(conn, "users", "api_keys_iv"):
        op.execute("ALTER TABLE users ADD COLUMN api_keys_iv TEXT")


def downgrade() -> None:
    # SQLite doesn't support DROP COLUMN; keep downgrade safe/no-op.
    pass

