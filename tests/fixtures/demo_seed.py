import pytest


@pytest.fixture(scope="function")
def demo_data(test_db, test_user):
    """Seed Demo Starman profile for testing."""
    import json
    from src.models.profile import Profile

    # Financial Data
    # Taxable: 120k, Retirement: 530k
    # Income: 164,400 total

    data = {
        "person": {
            "name": "Demo Starman",
            "birth_date": "1980-01-01",
            "retirement_age": 65,
        },
        "financial": {
            "annual_income": 164400,
            "annual_expenses": 80000,
            "liquid_assets": 120000,
            "retirement_assets": 530000,
            "social_security_benefit": 3000,
        },
        "assets": {
            "taxable_accounts": [
                {
                    "name": "Brokerage",
                    "type": "brokerage",
                    "value": 120000,
                    "cost_basis": 100000,
                }
            ],
            "retirement_accounts": [
                {"name": "401k", "type": "401k", "value": 530000, "cost_basis": 530000}
            ],
        },
        "income_streams": [
            {
                "name": "Primary Job",
                "amount": 7900,
                "frequency": "monthly",
                "type": "salary",
                "owner": "primary",
            },
            {
                "name": "Spouse Job",
                "amount": 5800,
                "frequency": "monthly",
                "type": "salary",
                "owner": "spouse",
            },
        ],
        "budget": {
            "income": {
                "current": {"employment": {"primary_person": 94800, "spouse": 69600}}
            },
            "expenses": {
                "current": {
                    "housing": [
                        {"name": "Mortgage", "amount": 2500, "frequency": "monthly"}
                    ]
                }
            },
        },
    }

    profile = Profile(
        user_id=test_user.id,
        name="Demo Starman",
        birth_date="1980-01-01",
        retirement_date="2045-01-01",
        data=data,
    )
    profile.save()
    return profile
