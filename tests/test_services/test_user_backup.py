"""
Tests for user-specific data backups and restores.
"""

import pytest
import json
import os
from src.auth.models import User
from src.models.profile import Profile
from src.services.user_backup_service import UserBackupService


def test_user_backup_creation(test_db, test_user):
    """Test that a user can create a backup of their data."""
    # Add some data for the user
    Profile(user_id=test_user.id, name="Backup Profile").save()

    # Create backup
    result = UserBackupService.create_backup(test_user.id, "My Test Backup")

    assert result["filename"] is not None
    assert result["size_bytes"] > 0

    # Check DB entry
    backups = UserBackupService.list_backups(test_user.id)
    assert len(backups) == 1
    assert backups[0]["label"] == "My Test Backup"


def test_user_backup_restore(test_db, test_user):
    """Test that a user can restore their data from a backup."""
    # 1. Create initial state
    Profile(user_id=test_user.id, name="Old Profile").save()
    UserBackupService.create_backup(test_user.id, "Original State")

    backups = UserBackupService.list_backups(test_user.id)
    backup_id = backups[0]["id"]

    # 2. Modify state
    Profile(user_id=test_user.id, name="New Profile").save()
    from src.database.connection import db

    db.execute("DELETE FROM profile WHERE name = 'Old Profile'")

    # Verify modification
    profiles = db.execute("SELECT * FROM profile WHERE user_id = ?", (test_user.id,))
    assert any(p["name"] == "New Profile" for p in profiles)
    assert not any(p["name"] == "Old Profile" for p in profiles)

    # 3. Restore
    UserBackupService.restore_backup(test_user.id, backup_id)

    # 4. Verify restoration
    profiles = db.execute("SELECT * FROM profile WHERE user_id = ?", (test_user.id,))
    assert any(p["name"] == "Old Profile" for p in profiles)
    assert not any(p["name"] == "New Profile" for p in profiles)


def test_user_backup_admin_isolation(test_db, test_user, test_admin):
    """Test that regular users cannot access each other's backups."""
    UserBackupService.create_backup(test_user.id, "Secret Backup")

    # Create another user
    user2 = User(None, "user2", "u2@ex.com", "hash").save()

    # Check that user2 sees no backups
    assert len(UserBackupService.list_backups(user2.id)) == 0

    # Verify deletion unauthorized
    backup_id = UserBackupService.list_backups(test_user.id)[0]["id"]
    with pytest.raises(ValueError):
        UserBackupService.delete_backup(user2.id, backup_id)
