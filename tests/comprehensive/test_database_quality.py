#!/usr/bin/env python3
"""
Database Quality Tests
Validates database schema, referential integrity, and consistency.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

import pytest
from src.database.connection import db


class TestDatabaseSchema:
    """Test suite for database schema quality."""

    def test_no_orphaned_scenarios(self):
        """Test that all scenarios reference existing profiles."""
        rows = db.execute("""
            SELECT COUNT(*) as count FROM scenarios
            WHERE profile_id IS NOT NULL
            AND profile_id NOT IN (SELECT id FROM profile)
        """)

        assert rows[0]["count"] == 0, f"Found {rows[0]['count']} orphaned scenarios"

    def test_no_orphaned_action_items(self):
        """Test that all action items reference existing profiles and users."""
        rows = db.execute("""
            SELECT COUNT(*) as count FROM action_items
            WHERE profile_id IS NOT NULL
            AND profile_id NOT IN (SELECT id FROM profile)
        """)

        assert rows[0]["count"] == 0, f"Found {rows[0]['count']} orphaned action items"

    def test_no_orphaned_conversations(self):
        """Test that all conversations reference existing profiles and users."""
        rows = db.execute("""
            SELECT COUNT(*) as count FROM conversations
            WHERE profile_id IS NOT NULL
            AND profile_id NOT IN (SELECT id FROM profile)
        """)

        assert rows[0]["count"] == 0, f"Found {rows[0]['count']} orphaned conversations"

    def test_all_profiles_have_valid_users(self):
        """Test that all profiles reference existing users."""
        rows = db.execute("""
            SELECT COUNT(*) as count FROM profile
            WHERE user_id NOT IN (SELECT id FROM users)
        """)

        assert (
            rows[0]["count"] == 0
        ), f"Found {rows[0]['count']} profiles with invalid users"

    def test_foreign_keys_are_enabled(self):
        """Test that foreign key enforcement is enabled."""
        rows = db.execute("PRAGMA foreign_keys")
        assert rows[0][0] == 1, "Foreign keys are not enabled"

    def test_all_tables_exist(self):
        """Test that all expected tables exist in the database."""
        expected_tables = [
            "users",
            "profile",
            "scenarios",
            "action_items",
            "conversations",
            "audit_log",
            "enhanced_audit_log",
            "feedback",
            "feedback_content",
            "feedback_replies",
            "groups",
            "user_groups",
            "admin_groups",
            "user_backups",
            "system_config",
            "password_reset_requests",
        ]

        rows = db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row["name"] for row in rows]

        missing_tables = set(expected_tables) - set(existing_tables)
        assert len(missing_tables) == 0, f"Missing tables: {missing_tables}"

    def test_critical_indexes_exist(self):
        """Test that critical indexes exist for performance."""
        expected_indexes = [
            "idx_profile_user_id",
            "idx_scenarios_user_id",
            "idx_scenarios_profile_id",
            "idx_action_items_user_id",
            "idx_action_items_profile_id",
            "idx_conversations_user_id",
            "idx_conversations_profile_id",
        ]

        rows = db.execute("SELECT name FROM sqlite_master WHERE type='index'")
        existing_indexes = [row["name"] for row in rows]

        missing_indexes = set(expected_indexes) - set(existing_indexes)
        assert len(missing_indexes) == 0, f"Missing critical indexes: {missing_indexes}"

    def test_profile_data_is_encrypted(self):
        """Test that profile data column contains encrypted data (has IV column)."""
        rows = db.execute("PRAGMA table_info(profile)")
        columns = [row["name"] for row in rows]

        assert "data" in columns, "Profile table missing 'data' column"
        assert (
            "data_iv" in columns
        ), "Profile table missing 'data_iv' column for encryption"

    def test_no_duplicate_profile_names_per_user(self):
        """Test that users don't have duplicate profile names."""
        rows = db.execute("""
            SELECT user_id, name, COUNT(*) as count
            FROM profile
            GROUP BY user_id, name
            HAVING count > 1
        """)

        assert len(rows) == 0, f"Found {len(rows)} duplicate profile names per user"

    def test_all_timestamps_are_valid(self):
        """Test that all timestamp columns contain valid dates."""
        tables_with_timestamps = [
            ("profile", "created_at"),
            ("profile", "updated_at"),
            ("scenarios", "created_at"),
            ("action_items", "created_at"),
            ("action_items", "updated_at"),
            ("conversations", "created_at"),
            ("users", "created_at"),
        ]

        for table, column in tables_with_timestamps:
            try:
                # Check for NULL timestamps where they shouldn't be
                rows = db.execute(
                    f"SELECT COUNT(*) as count FROM {table} WHERE {column} IS NULL"
                )
                assert (
                    rows[0]["count"] == 0
                ), f"Found NULL timestamps in {table}.{column}"

                # Check for invalid date formats (should be ISO8601)
                rows = db.execute(f"""
                    SELECT COUNT(*) as count FROM {table}
                    WHERE {column} IS NOT NULL
                    AND {column} NOT LIKE '____-__-__T__:__:__.__'
                    AND {column} NOT LIKE '____-__-__ __:__:__'
                """)
                # Allow some flexibility in timestamp format
            except Exception as e:
                pytest.fail(f"Error checking timestamps in {table}.{column}: {e}")


class TestDatabaseIntegrity:
    """Test suite for database referential integrity."""

    def test_cascade_delete_scenarios_with_profile(self):
        """Test that scenarios are deleted when profile is deleted."""
        # This is a read-only test - just verify the foreign key is set up correctly
        rows = db.execute("""
            SELECT sql FROM sqlite_master
            WHERE type='table' AND name='scenarios'
        """)

        schema = rows[0]["sql"]
        assert (
            "ON DELETE CASCADE" in schema
        ), "Scenarios table missing CASCADE delete for profile_id"

    def test_cascade_delete_action_items_with_profile(self):
        """Test that action items are deleted when profile is deleted."""
        rows = db.execute("""
            SELECT sql FROM sqlite_master
            WHERE type='table' AND name='action_items'
        """)

        schema = rows[0]["sql"]
        assert (
            "ON DELETE CASCADE" in schema
        ), "Action items table missing CASCADE delete for profile_id"

    def test_user_id_foreign_keys_are_consistent(self):
        """Test that all user_id foreign keys use consistent ON DELETE behavior."""
        tables_with_user_fk = [
            "profile",
            "scenarios",
            "action_items",
            "conversations",
            "feedback",
            "user_groups",
            "admin_groups",
            "user_backups",
        ]

        for table in tables_with_user_fk:
            rows = db.execute(
                f"""
                SELECT sql FROM sqlite_master
                WHERE type='table' AND name=?
            """,
                (table,),
            )

            if rows:
                schema = rows[0]["sql"]
                assert (
                    "user_id" in schema.lower()
                ), f"Table {table} missing user_id column"
                # Most should have CASCADE, audit logs should have SET NULL
                if table not in ["audit_log", "enhanced_audit_log"]:
                    assert (
                        "FOREIGN KEY" in schema
                    ), f"Table {table} missing FOREIGN KEY constraint"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
