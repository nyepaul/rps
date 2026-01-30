"""
Debug test to understand User model issues
"""

from src.auth.models import User


def test_database_path_in_user_creation(test_db):
    """Debug: Check what database the User model is using."""
    # Check database is empty
    result = test_db.execute("SELECT * FROM users")
    print(f"Users in database before creation: {len(result)}")
    assert len(result) == 0

    # Create user
    user = User(
        id=None, username="debuguser", email="debug@test.com", password_hash="hash123"
    )

    print(f"User created: {user.username}, {user.email}")

    # Save user
    user.save()

    print(f"User saved with ID: {user.id}")

    # Check database after save
    result = test_db.execute("SELECT * FROM users")
    print(f"Users in database after save: {len(result)}")
    for row in result:
        print(f"  User: {dict(row)}")

    assert len(result) == 1
    assert result[0]["username"] == "debuguser"


def test_second_user_creation(test_db):
    """Debug: Verify second test gets fresh database."""
    # Check database is empty (should be fresh)
    result = test_db.execute("SELECT * FROM users")
    print(f"Users in database at start of second test: {len(result)}")
    assert len(result) == 0, "Database not fresh!"

    # Create different user
    user = User(
        id=None, username="debuguser2", email="debug2@test.com", password_hash="hash456"
    )
    user.save()

    result = test_db.execute("SELECT * FROM users")
    assert len(result) == 1
    assert result[0]["username"] == "debuguser2"
