"""
Sanity check tests to verify testing infrastructure
"""

import os


def test_environment(test_db):
    """Test that test database is set up correctly."""
    # Check that DATABASE_PATH env var is set
    assert "DATABASE_PATH" in os.environ

    # Check that test_db instance exists
    assert test_db is not None

    # Check that we can execute a query
    result = test_db.execute("SELECT 1 as test")
    assert len(result) == 1
    assert result[0]["test"] == 1


def test_database_isolation(test_db):
    """Test that each test gets a fresh database."""
    # Insert a user directly via SQL
    with test_db.get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
        """,
            ("sanity_user", "sanity@test.com", "hash123"),
        )

    # Verify user exists
    result = test_db.execute("SELECT * FROM users WHERE username = ?", ("sanity_user",))
    assert len(result) == 1


def test_database_isolation_second_test(test_db):
    """Test that previous test's data doesn't persist."""
    # Check that the user from previous test doesn't exist
    result = test_db.execute("SELECT * FROM users WHERE username = ?", ("sanity_user",))
    assert len(result) == 0, "Previous test's data persisted - database not isolated!"
