"""
Unit tests for User model
"""

import pytest
from src.auth.models import User


def test_user_creation(test_db):
    """Test creating a new user."""
    user = User(
        id=None,
        username="newuser",
        email="new@example.com",
        password_hash=User.hash_password("password123"),
    )
    user.save()

    assert user.id is not None
    assert user.username == "newuser"
    assert user.email == "new@example.com"
    assert user.is_admin is False


def test_user_password_hashing(test_db):
    """Test password hashing and verification."""
    password = "SecurePass123"
    hashed = User.hash_password(password)

    # Hash should be different from password
    assert hashed != password

    # Create user to test check_password method
    user = User(
        id=None, username="testpass", email="testpass@example.com", password_hash=hashed
    )

    # Should be able to verify correct password
    assert user.check_password(password)

    # Should not verify incorrect password
    assert not user.check_password("WrongPassword")


def test_user_unique_username(test_db):
    """Test that usernames must be unique."""
    user1 = User(
        id=None,
        username="sameuser",
        email="user1@example.com",
        password_hash=User.hash_password("pass1"),
    )
    user1.save()

    user2 = User(
        id=None,
        username="sameuser",
        email="user2@example.com",
        password_hash=User.hash_password("pass2"),
    )

    with pytest.raises(Exception):  # Should raise UNIQUE constraint error
        user2.save()


def test_user_unique_email(test_db):
    """Test that emails must be unique."""
    user1 = User(
        id=None,
        username="user1",
        email="same@example.com",
        password_hash=User.hash_password("pass1"),
    )
    user1.save()

    user2 = User(
        id=None,
        username="user2",
        email="same@example.com",
        password_hash=User.hash_password("pass2"),
    )

    with pytest.raises(Exception):  # Should raise UNIQUE constraint error
        user2.save()


def test_user_get_by_username(test_db, test_user):
    """Test retrieving user by username."""
    user = User.get_by_username("testuser")

    assert user is not None
    assert user.id == test_user.id
    assert user.username == "testuser"
    assert user.email == "test@example.com"


def test_user_get_by_id(test_db, test_user):
    """Test retrieving user by ID."""
    user = User.get_by_id(test_user.id)

    assert user is not None
    assert user.username == "testuser"
    assert user.email == "test@example.com"


def test_user_get_nonexistent(test_db):
    """Test retrieving non-existent user."""
    user = User.get_by_username("nonexistent")
    assert user is None

    user = User.get_by_id(99999)
    assert user is None


def test_user_admin_flag(test_db):
    """Test admin user creation."""
    admin = User(
        id=None,
        username="admin",
        email="admin@example.com",
        password_hash=User.hash_password("admin123"),
        is_admin=True,
    )
    admin.save()

    assert admin.is_admin is True

    # Regular user should not be admin
    regular = User(
        id=None,
        username="regular",
        email="regular@example.com",
        password_hash=User.hash_password("pass123"),
    )
    regular.save()

    assert regular.is_admin is False


def test_user_update(test_db, test_user):
    """Test updating user information."""
    test_user.email = "updated@example.com"
    test_user.save()

    # Retrieve and verify
    user = User.get_by_id(test_user.id)
    assert user.email == "updated@example.com"


def test_user_delete(test_db):
    """Test deleting a user."""
    from src.database.connection import db

    user = User(
        id=None,
        username="deleteme",
        email="delete@example.com",
        password_hash=User.hash_password("pass123"),
    )
    user.save()
    user_id = user.id

    # Delete from database
    with db.get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    # Should not be able to retrieve
    deleted_user = User.get_by_id(user_id)
    assert deleted_user is None
