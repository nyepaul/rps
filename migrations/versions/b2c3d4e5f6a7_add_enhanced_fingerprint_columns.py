"""add_enhanced_fingerprint_columns

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-21 12:00:00.000000

Adds new columns to enhanced_audit_log for:
- Response timing (response_time_ms)
- Client fingerprint hash (for quick matching)
- Engagement score
- Screen/viewport dimensions
- Network type
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new columns for enhanced fingerprinting and analytics."""

    # Add response timing column
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN response_time_ms REAL')
    except Exception:
        pass  # Column may already exist

    # Add client fingerprint hash for quick matching
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN fingerprint_hash INTEGER')
    except Exception:
        pass

    # Add engagement score for session analytics
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN engagement_score INTEGER')
    except Exception:
        pass

    # Add screen dimensions
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN screen_width INTEGER')
    except Exception:
        pass

    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN screen_height INTEGER')
    except Exception:
        pass

    # Add viewport dimensions
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN viewport_width INTEGER')
    except Exception:
        pass

    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN viewport_height INTEGER')
    except Exception:
        pass

    # Add timezone offset
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN timezone_offset INTEGER')
    except Exception:
        pass

    # Add network type (4g, 3g, wifi, etc.)
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN network_type TEXT')
    except Exception:
        pass

    # Add color scheme preference (dark/light)
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN color_scheme TEXT')
    except Exception:
        pass

    # Add device pixel ratio
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN device_pixel_ratio REAL')
    except Exception:
        pass

    # Add touch capability flag
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN is_touch_device INTEGER')
    except Exception:
        pass

    # Add webdriver detection flag (bot indicator)
    try:
        op.execute('ALTER TABLE enhanced_audit_log ADD COLUMN is_webdriver INTEGER')
    except Exception:
        pass

    # Create index on fingerprint_hash for quick matching
    try:
        op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_fingerprint_hash ON enhanced_audit_log(fingerprint_hash)')
    except Exception:
        pass

    # Create index on response_time_ms for performance analysis
    try:
        op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_response_time ON enhanced_audit_log(response_time_ms)')
    except Exception:
        pass

    # Create composite index for session analytics queries
    try:
        op.execute('CREATE INDEX IF NOT EXISTS idx_enhanced_audit_session_analytics ON enhanced_audit_log(user_id, created_at, engagement_score)')
    except Exception:
        pass


def downgrade() -> None:
    """Remove added columns (SQLite doesn't support DROP COLUMN easily)."""
    # Note: SQLite doesn't support DROP COLUMN before version 3.35.0
    # For full downgrade, would need to recreate the table
    # These columns are safe to leave in place as they're optional

    # Drop indexes
    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_fingerprint_hash')
    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_response_time')
    op.execute('DROP INDEX IF EXISTS idx_enhanced_audit_session_analytics')
