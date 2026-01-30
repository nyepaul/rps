"""
Unit tests for Profile model with encryption
"""

import pytest
from src.models.profile import Profile


def test_profile_creation(test_db, test_user):
    """Test creating a new profile."""
    profile = Profile(
        user_id=test_user.id,
        name="My Profile",
        birth_date="1985-06-15",
        retirement_date="2055-06-15",
    )
    profile.save()

    assert profile.id is not None
    assert profile.user_id == test_user.id
    assert profile.name == "My Profile"
    assert profile.birth_date == "1985-06-15"


def test_profile_with_data(test_db, test_user):
    """Test creating profile with financial data."""
    profile_data = {
        "person": {"current_age": 39, "retirement_age": 67, "life_expectancy": 90},
        "financial": {
            "annual_income": 100000,
            "annual_expenses": 70000,
            "liquid_assets": 150000,
            "retirement_assets": 350000,
        },
    }

    profile = Profile(user_id=test_user.id, name="Profile with Data", data=profile_data)
    profile.save()

    # Retrieve and verify data
    retrieved = Profile.get_by_id(profile.id, test_user.id)
    assert retrieved.data_dict == profile_data
    assert retrieved.data_dict["person"]["current_age"] == 39
    assert retrieved.data_dict["financial"]["annual_income"] == 100000


def test_profile_data_encryption(test_db, test_user):
    """Test that profile data is encrypted in database."""
    profile_data = {
        "financial": {"liquid_assets": 500000, "retirement_assets": 1000000}
    }

    profile = Profile(user_id=test_user.id, name="Encrypted Profile", data=profile_data)
    profile.save()

    # Check database directly - data should be encrypted
    with test_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT data, data_iv FROM profile WHERE id = ?", (profile.id,))
        row = cursor.fetchone()

        # Should have both encrypted data and IV
        assert row[0] is not None  # data (encrypted)
        assert row[1] is not None  # data_iv

        # Encrypted data should not contain plaintext
        assert b"500000" not in row[0].encode() if isinstance(row[0], str) else row[0]
        assert b"1000000" not in row[0].encode() if isinstance(row[0], str) else row[0]


def test_profile_get_by_name(test_db, test_user):
    """Test retrieving profile by user_id and name."""
    profile = Profile(user_id=test_user.id, name="Named Profile")
    profile.save()

    retrieved = Profile.get_by_name("Named Profile", test_user.id)

    assert retrieved is not None
    assert retrieved.id == profile.id
    assert retrieved.name == "Named Profile"


def test_profile_list_by_user(test_db, test_user):
    """Test listing all profiles for a user."""
    # Create multiple profiles
    for i in range(3):
        profile = Profile(user_id=test_user.id, name=f"Profile {i}")
        profile.save()

    profiles = Profile.list_by_user(test_user.id)

    assert len(profiles) == 3
    assert all(p["name"] in ["Profile 0", "Profile 1", "Profile 2"] for p in profiles)


def test_profile_unique_name_per_user(test_db, test_user):
    """Test that profile names must be unique per user."""
    profile1 = Profile(user_id=test_user.id, name="Same Name")
    profile1.save()

    profile2 = Profile(user_id=test_user.id, name="Same Name")

    with pytest.raises(Exception):  # Should raise UNIQUE constraint error
        profile2.save()


def test_profile_same_name_different_users(test_db, test_user, test_admin):
    """Test that different users can have profiles with same name."""
    profile1 = Profile(user_id=test_user.id, name="Common Name")
    profile1.save()

    profile2 = Profile(user_id=test_admin.id, name="Common Name")
    profile2.save()

    # Both should exist
    assert profile1.id != profile2.id
    assert Profile.get_by_name("Common Name", test_user.id).id == profile1.id
    assert Profile.get_by_name("Common Name", test_admin.id).id == profile2.id


def test_profile_update(test_db, test_user):
    """Test updating profile data."""
    profile = Profile(user_id=test_user.id, name="Update Test", data={"old": "value"})
    profile.save()

    # Update data
    profile.data_dict = {"new": "value"}
    profile.save()

    # Retrieve and verify
    retrieved = Profile.get_by_id(profile.id, test_user.id)
    assert retrieved.data_dict == {"new": "value"}
    assert "old" not in retrieved.data_dict


def test_profile_delete(test_db, test_user):
    """Test deleting a profile."""
    profile = Profile(user_id=test_user.id, name="Delete Me")
    profile.save()
    profile_id = profile.id

    profile.delete()

    # Should not be retrievable
    deleted = Profile.get_by_id(profile_id, test_user.id)
    assert deleted is None


def test_profile_cascade_delete(test_db, test_user):
    """Test that deleting user cascades to profiles."""
    profile = Profile(user_id=test_user.id, name="Cascade Test")
    profile.save()
    profile_id = profile.id

    # Delete user (via database, should cascade)
    with test_db.get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (test_user.id,))

    # Profile should also be deleted via CASCADE
    deleted_profile = Profile.get_by_id(profile_id, test_user.id)
    assert deleted_profile is None


def test_profile_empty_data(test_db, test_user):
    """Test profile with no data."""
    profile = Profile(user_id=test_user.id, name="Empty Data")
    profile.save()

    retrieved = Profile.get_by_id(profile.id, test_user.id)
    assert retrieved.data_dict == {}
