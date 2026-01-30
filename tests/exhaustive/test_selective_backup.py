import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch
from src.services.selective_backup_service import SelectiveBackupService
from src.models.profile import Profile
from src.auth.models import User
from src.models.group import Group


@pytest.fixture
def temp_backup_dir(tmp_path):
    """Fixture to provide a temporary backup directory."""
    os.environ["TEST_BACKUP_DIR"] = str(tmp_path)
    yield tmp_path
    if "TEST_BACKUP_DIR" in os.environ:
        del os.environ["TEST_BACKUP_DIR"]


def test_get_profiles_and_groups_details(test_db, test_user, test_profile):
    """Test fetching profiles and groups with details."""
    # Create a group and add user to it
    group = Group(id=None, name="Premium Users", description="VIPs").save()
    with test_db.get_connection() as conn:
        conn.execute(
            "INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)",
            (test_user.id, group.id),
        )
        conn.commit()

    profiles = SelectiveBackupService.get_all_profiles_with_details()
    assert len(profiles) > 0
    # Find our specific profile
    p_details = next((p for p in profiles if p["id"] == test_profile.id), None)
    assert p_details is not None
    assert any(g["name"] == "Premium Users" for g in p_details.get("groups", []))

    groups = SelectiveBackupService.get_all_groups_with_profile_counts()
    assert len(groups) > 0
    assert any(g["name"] == "Premium Users" for g in groups)
    target_group = next(g for g in groups if g["name"] == "Premium Users")
    assert target_group["profile_count"] >= 1


def test_create_and_list_backup(temp_backup_dir, test_user, test_profile):
    """Test creating a selective backup and listing it."""
    result = SelectiveBackupService.create_backup(
        profile_ids=[test_profile.id], label="Test Backup", created_by=test_user.id
    )

    assert result["profile_count"] == 1
    assert (temp_backup_dir / result["filename"]).exists()

    backups = SelectiveBackupService.list_backups()
    assert len(backups) == 1
    assert backups[0]["filename"] == result["filename"]
    assert backups[0]["label"] == "Test Backup"


def test_restore_backup_replace(temp_backup_dir, test_user, test_profile):
    """Test restoring a backup in replace mode."""
    print(f"\nDebug: Patch dir: {SelectiveBackupService.get_backup_dir()}")
    # 1. Create a backup
    backup_result = SelectiveBackupService.create_backup(profile_ids=[test_profile.id])
    print(
        f"Debug: Backup created: {backup_result['filename']} for profile_id {test_profile.id}"
    )

    # 2. Modify the profile in DB
    original_birth_date = test_profile.birth_date
    print(f"Debug: Original birth date: {original_birth_date}")
    test_profile.birth_date = "2000-01-01"
    test_profile.save()

    # Verify modification
    mod_profile = Profile.get_by_id(test_profile.id, test_user.id)
    print(
        f"Debug: Modified birth date in DB: {mod_profile.birth_date} for ID {mod_profile.id}"
    )

    # 3. Restore the backup
    restore_result = SelectiveBackupService.restore_backup(
        filename=backup_result["filename"], restore_mode="replace"
    )
    print(f"Debug: Restore result: {restore_result}")

    assert restore_result["success"]

    # 4. Verify data is restored
    restored_profile = Profile.get_by_id(test_profile.id, test_user.id)
    print(f"Debug: Restored birth date in DB: {restored_profile.birth_date}")
    assert restored_profile.birth_date == original_birth_date


def test_delete_backup(temp_backup_dir, test_user, test_profile):
    """Test deleting a backup file."""
    result = SelectiveBackupService.create_backup(profile_ids=[test_profile.id])
    assert (temp_backup_dir / result["filename"]).exists()

    SelectiveBackupService.delete_backup(result["filename"])
    assert not (temp_backup_dir / result["filename"]).exists()
