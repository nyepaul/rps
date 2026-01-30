import pytest
from datetime import datetime, timedelta
from src.services.action_item_service import ActionItemService
from src.models.profile import Profile


@pytest.fixture
def base_profile_data():
    return {
        "person": {"name": "Test User"},
        "financial": {"annual_income": 100000, "annual_expenses": 80000},
        "assets": {
            "retirement_accounts": [{"value": 100000}],
            "taxable_accounts": [{"value": 20000}],
        },
        "spouse": {},
        "children": [],
    }


def test_generate_items_age_50_plus(base_profile_data):
    """Test items generated for age 50+ (catch-up contributions)."""
    # Set birth date to make age 52
    birth_date = (datetime.now() - timedelta(days=52 * 365.25)).isoformat()
    profile = Profile(
        user_id=1, name="Test", birth_date=birth_date, data=base_profile_data
    )
    profile.id = 1

    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    # Should have catch-up contribution item
    assert any("catch-up contributions" in item.description for item in items)


def test_generate_items_low_emergency_fund(base_profile_data):
    """Test emergency fund warning."""
    # Expenses 80k/year => ~6.6k/month. 3 months = 20k.
    # Total liquid assets 20k => barely 3 months.
    # Let's reduce liquid to 10k.
    base_profile_data["assets"]["taxable_accounts"] = [{"value": 10000}]
    profile = Profile(user_id=1, name="Test", data=base_profile_data)
    profile.id = 1

    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    assert any("Build emergency fund" in item.description for item in items)


def test_generate_items_high_net_worth(base_profile_data):
    """Test high net worth items."""
    # Assets > $1M
    base_profile_data["assets"]["taxable_accounts"] = [{"value": 1200000}]
    profile = Profile(user_id=1, name="Test", data=base_profile_data)
    profile.id = 1

    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    assert any("High net worth detected" in item.description for item in items)
    # Assets > $2M => living trust
    base_profile_data["assets"]["taxable_accounts"] = [{"value": 2200000}]
    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    assert any("revocable living trust" in item.description for item in items)


def test_generate_items_family(base_profile_data):
    """Test family-based items."""
    base_profile_data["children"] = [{"name": "Kid", "age": 10}]
    profile = Profile(user_id=1, name="Test", data=base_profile_data)
    profile.id = 1

    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    assert any("estate planning documents" in item.description for item in items)
    assert any("college savings strategies" in item.description for item in items)


def test_generate_items_missing_expenses(base_profile_data):
    """Test missing data warning."""
    base_profile_data["financial"]["annual_expenses"] = 0
    profile = Profile(user_id=1, name="Test", data=base_profile_data)
    profile.id = 1

    items = ActionItemService.generate_for_profile(user_id=1, profile=profile)
    assert any("Complete your expense profile" in item.description for item in items)
