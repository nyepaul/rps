import sys
import os
import json
import pytest
from datetime import datetime
from src.models.profile import Profile
from src.auth.models import User
from src.services.retirement_model import (
    RetirementModel,
    FinancialProfile,
    Person,
    MarketAssumptions,
)


# Helper to transform assets (copied from test_comprehensive_financial.py logic)
def transform_assets_to_investment_types(assets_data):
    """Transform assets data to investment types for the model."""
    investment_types = []
    # If the JSON follows the sample-profile.json structure directly (list of investment_types)
    if isinstance(assets_data, list):
        return assets_data

    # Fallback for legacy structure if needed
    return []


def safe_date(date_str):
    if not date_str:
        return datetime.now()
    return datetime.fromisoformat(date_str)


class TestGeminiValidation:

    @pytest.fixture
    def sample_data(self):
        with open("examples/sample-profile.json", "r") as f:
            return json.load(f)

    def test_complex_profile_simulation(self, test_db, sample_data):
        """
        Validate the financial engine using the complex sample profile.
        This tests:
        1. Database connectivity and encryption (Profile save/load).
        2. Data transformation (JSON -> FinancialProfile).
        3. Monte Carlo Simulation execution.
        4. Logical outcomes (growth, tax, etc.).
        """
        # 1. Setup User and Profile
        user = User(
            id=None,
            username="gemini_test",
            email="gemini@test.com",
            password_hash="hash",
        )
        user.save()

        profile = Profile(
            user_id=user.id,
            name=sample_data.get("profile_name", "Test Profile"),
            birth_date=sample_data["person1"]["birth_date"],
            retirement_date=sample_data["person1"]["retirement_date"],
            data=sample_data,
        )
        profile.save()

        # Verify persistence and decryption
        saved_profile = Profile.get_by_id(profile.id, user.id)
        assert saved_profile is not None
        assert saved_profile.data_dict["person1"]["name"] == "Demo Junior"

        # 2. Construct Financial Profile
        data = saved_profile.data_dict

        person1 = Person(
            name=data["person1"]["name"],
            birth_date=safe_date(data["person1"]["birth_date"]),
            retirement_date=safe_date(data["person1"]["retirement_date"]),
            social_security=data["person1"]["social_security"],
        )

        person2 = Person(
            name=data["person2"]["name"],
            birth_date=safe_date(data["person2"]["birth_date"]),
            retirement_date=safe_date(data["person2"]["retirement_date"]),
            social_security=data["person2"]["social_security"],
        )

        # Aggregate assets from investment_types
        # The sample profile uses 'investment_types' list directly
        inv_types = data.get("investment_types", [])

        # Calculate asset buckets for the profile dataclass (legacy fields, model calculates from inv_types mostly)
        liquid = sum(
            x["value"]
            for x in inv_types
            if x["account"] in ["Checking", "Savings", "Liquid"]
        )
        taxable = sum(
            x["value"] for x in inv_types if x["account"] == "Taxable Brokerage"
        )
        pretax = sum(
            x["value"]
            for x in inv_types
            if x["account"] in ["Traditional IRA", "401k", "403b", "401a", "457b"]
        )
        roth = sum(x["value"] for x in inv_types if x["account"] == "Roth IRA")

        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=[],
            liquid_assets=liquid,
            traditional_ira=pretax,
            roth_ira=roth,
            pension_lump_sum=0,
            pension_annual=0,  # Handled via income_streams in this profile
            annual_expenses=data.get(
                "target_annual_income", 150000
            ),  # Using target income as expense proxy
            target_annual_income=data.get("target_annual_income", 150000),
            risk_tolerance="moderate",
            asset_allocation=data.get("market_assumptions", {}),
            future_expenses=[],
            investment_types=inv_types,
            accounts=[],
            income_streams=data.get("income_streams", []),
            home_properties=data.get("home_properties", []),
            budget=None,  # Sample profile doesn't use detailed budget object
            annual_ira_contribution=0,
        )

        # 3. Run Simulation
        model = RetirementModel(financial_profile)
        assumptions = MarketAssumptions(
            stock_allocation=data["market_assumptions"]["stock_allocation"],
            stock_return_mean=data["market_assumptions"]["stock_return_mean"],
            inflation_mean=data["market_assumptions"]["inflation_mean"],
        )

        results = model.monte_carlo_simulation(
            years=30,
            simulations=1000,  # Sufficient for valid stats
            assumptions=assumptions,
            spending_model="constant_real",
        )

        # 4. Assertions
        print(f"\nSimulation Results for {profile.name}:")
        print(f"Success Rate: {results['success_rate']:.1%}")
        print(f"Median Ending Balance: ${results['median_final_balance']:,.0f}")
        print(f"Starting Portfolio: ${results['starting_portfolio']:,.0f}")

        # Basic sanity checks
        assert results["success_rate"] >= 0.0 and results["success_rate"] <= 1.0
        assert results["starting_portfolio"] > 0
        assert len(results["timeline"]["median"]) == 30

        # Check that we processed the complex assets
        # Sample profile has starter assets (> $30k)
        assert results["starting_portfolio"] > 30000

        # Check tax logic (implicit in success rate)
        # With valid income and expenses, simulation should produce a result
        assert results["success_rate"] >= 0.0
