"""
Tests for the Group model.
"""

import pytest
from src.models.group import Group
from src.auth.models import User


def test_group_creation(test_db):
    """Test creating a new group."""
    group = Group(None, "Family A", "The Thompson family")
    group.save()

    assert group.id is not None
    assert group.name == "Family A"
    assert group.description == "The Thompson family"


def test_group_get_by_id(test_db):
    """Test retrieving a group by ID."""
    group = Group(None, "Family B", "Description B")
    group.save()

    fetched = Group.get_by_id(group.id)
    assert fetched is not None
    assert fetched.name == "Family B"


def test_group_get_all(test_db):
    """Test retrieving all groups."""
    Group(None, "Group 1").save()
    Group(None, "Group 2").save()

    groups = Group.get_all()
    assert len(groups) >= 2
    assert any(g.name == "Group 1" for g in groups)
    assert any(g.name == "Group 2" for g in groups)


def test_group_members(test_db, test_user):
    """Test adding and retrieving group members."""
    group = Group(None, "Members Test")
    group.save()

    group.add_member(test_user.id)

    members = group.get_members()
    assert len(members) == 1
    assert members[0].username == test_user.username

    group.remove_member(test_user.id)
    assert len(group.get_members()) == 0


def test_user_groups(test_db, test_user):
    """Test getting groups from the User model."""
    g1 = Group(None, "User Group 1").save()
    g2 = Group(None, "User Group 2").save()

    test_user.add_to_group(g1.id)
    test_user.add_to_group(g2.id)

    groups = test_user.get_groups()
    assert len(groups) == 2
    assert any(g.name == "User Group 1" for g in groups)
    assert any(g.name == "User Group 2" for g in groups)


def test_admin_managed_groups(test_db, test_admin):
    """Test admin group management permissions."""
    g1 = Group(None, "Managed Group 1").save()

    test_admin.add_managed_group(g1.id)

    managed = test_admin.get_managed_groups()
    assert len(managed) == 1
    assert managed[0].name == "Managed Group 1"

    # Test super admin sees all
    super_admin = User(
        None, "sa", "sa@ex.com", "hash", is_admin=True, is_super_admin=True
    ).save()
    assert len(super_admin.get_managed_groups()) >= 1
