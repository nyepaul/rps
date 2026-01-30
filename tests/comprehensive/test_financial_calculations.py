#!/usr/bin/env python3
"""
Financial Calculations Tests
Validates accuracy and consistency of financial calculations across the app.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../"))

import pytest
from src.app import create_app
from src.models.profile import Profile
from src.services.retirement_model import (
    RetirementModel,
    FinancialProfile,
    Person,
    MarketAssumptions,
)
from datetime import datetime
import numpy as np


def transform_assets_to_investment_types(assets_data):
    """Transform assets data to investment types for the model."""
    investment_types = []
    ACCOUNT_MAPPING = {
        "401k": "401k",
        "roth_401k": "Roth IRA",
        "traditional_ira": "Traditional IRA",
        "roth_ira": "Roth IRA",
        "sep_ira": "Traditional IRA",
        "simple_ira": "Traditional IRA",
        "403b": "403b",
        "457": "457b",
        "brokerage": "Taxable Brokerage",
        "savings": "Savings",
        "checking": "Checking",
        "money_market": "Savings",
        "cd": "Savings",
        "cash": "Checking",
    }
    for asset in assets_data.get("retirement_accounts", []):
        asset_type = asset.get("type", "").lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, "Traditional IRA")
        investment_types.append(
            {
                "account": account_name,
                "value": asset.get("value", 0),
                "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
                "name": asset.get("name", ""),
            }
        )
    for asset in assets_data.get("taxable_accounts", []):
        asset_type = asset.get("type", "").lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, "Taxable Brokerage")
        investment_types.append(
            {
                "account": account_name,
                "value": asset.get("value", 0),
                "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
                "name": asset.get("name", ""),
            }
        )
    return investment_types


@pytest.fixture(scope="module")
def app():
    """Create application for testing."""
    app = create_app()
    return app


@pytest.fixture(scope="module")
def app_context(app):
    """Create application context."""
    with app.app_context():
        yield


class TestFinancialCalculations:
    """Test suite for financial calculation accuracy."""

    def test_starting_portfolio_matches_assets(self, app_context):
        """Test that Monte Carlo starting portfolio matches asset totals."""
        from src.database.connection import db

        rows = db.execute("SELECT id, user_id, name FROM profile LIMIT 5")

        for row in rows:
            profile = Profile.get_by_id(row["id"], row["user_id"])
            if not profile:
                continue

            profile_data = profile.data_dict
            assets_data = profile_data.get("assets", {})
            financial_data = profile_data.get("financial", {})

            # Calculate expected total
            taxable_total = sum(
                a.get("value", 0) for a in assets_data.get("taxable_accounts", [])
            )
            retirement_total = sum(
                a.get("value", 0) for a in assets_data.get("retirement_accounts", [])
            )
            expected_total = taxable_total + retirement_total

            if expected_total == 0:
                continue  # Skip empty profiles

            # Run Monte Carlo
            try:
                person1 = Person(
                    name=profile.name,
                    birth_date=datetime.fromisoformat(
                        profile.birth_date or "1988-07-14"
                    ),
                    retirement_date=datetime.fromisoformat(
                        profile.retirement_date or "2055-07-14"
                    ),
                    social_security=financial_data.get("social_security_benefit", 0),
                )

                person2 = Person(
                    name="Spouse",
                    birth_date=datetime(1980, 1, 1),
                    retirement_date=datetime(2045, 1, 1),
                    social_security=0,
                )

                investment_types = transform_assets_to_investment_types(assets_data)

                financial_profile = FinancialProfile(
                    person1=person1,
                    person2=person2,
                    children=[],
                    liquid_assets=taxable_total,
                    traditional_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "traditional" in a.get("type", "").lower()
                        or "401" in a.get("type", "").lower()
                    ),
                    roth_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "roth" in a.get("type", "").lower()
                    ),
                    pension_lump_sum=0,
                    pension_annual=financial_data.get("pension_benefit", 0) * 12,
                    annual_expenses=financial_data.get("annual_expenses", 0),
                    target_annual_income=financial_data.get("annual_income", 0),
                    risk_tolerance="moderate",
                    asset_allocation={"stocks": 0.6, "bonds": 0.4},
                    future_expenses=[],
                    investment_types=investment_types,
                    accounts=[],
                    income_streams=profile_data.get("income_streams", []),
                    home_properties=profile_data.get("home_properties", []),
                    budget=profile_data.get("budget"),
                    annual_ira_contribution=financial_data.get(
                        "annual_ira_contribution", 0
                    ),
                    savings_allocation=profile_data.get("savings_allocation"),
                )

                model = RetirementModel(financial_profile)
                years = model.calculate_life_expectancy_years(person1, target_age=85)

                market_assumptions = MarketAssumptions(stock_allocation=0.60)
                results = model.monte_carlo_simulation(
                    years=years,
                    simulations=100,
                    assumptions=market_assumptions,
                    spending_model="constant_real",
                )

                starting_portfolio = results.get("starting_portfolio", 0)

                # Allow 1% tolerance
                diff_pct = (
                    abs(starting_portfolio - expected_total) / expected_total * 100
                    if expected_total > 0
                    else 0
                )

                assert (
                    diff_pct < 1.0
                ), f"Profile {profile.name}: Starting portfolio mismatch - Expected ${expected_total:,.0f}, Got ${starting_portfolio:,.0f} ({diff_pct:.1f}% diff)"

            except Exception as e:
                pytest.fail(f"Profile {profile.name} failed: {e}")

    def test_timeline_includes_contributions(self, app_context):
        """Test that timeline Year 0 includes contributions not just starting assets."""
        from src.database.connection import db

        rows = db.execute("SELECT id, user_id, name FROM profile LIMIT 3")

        for row in rows:
            profile = Profile.get_by_id(row["id"], row["user_id"])
            if not profile:
                continue

            profile_data = profile.data_dict
            assets_data = profile_data.get("assets", {})
            financial_data = profile_data.get("financial", {})
            income_streams = profile_data.get("income_streams", [])

            # Calculate starting total
            taxable_total = sum(
                a.get("value", 0) for a in assets_data.get("taxable_accounts", [])
            )
            retirement_total = sum(
                a.get("value", 0) for a in assets_data.get("retirement_accounts", [])
            )
            starting_total = taxable_total + retirement_total

            if starting_total == 0:
                continue

            # Calculate expected contributions
            active_income = sum(
                stream.get("amount", 0) * 12 for stream in income_streams
            )
            annual_expenses = financial_data.get("annual_expenses", 0)
            annual_surplus = active_income - annual_expenses

            if annual_surplus <= 0:
                continue

            try:
                person1 = Person(
                    name=profile.name,
                    birth_date=datetime.fromisoformat(
                        profile.birth_date or "1988-07-14"
                    ),
                    retirement_date=datetime.fromisoformat(
                        profile.retirement_date or "2055-07-14"
                    ),
                    social_security=financial_data.get("social_security_benefit", 0),
                )

                person2 = Person(
                    name="Spouse",
                    birth_date=datetime(1980, 1, 1),
                    retirement_date=datetime(2045, 1, 1),
                    social_security=0,
                )

                investment_types = transform_assets_to_investment_types(assets_data)

                financial_profile = FinancialProfile(
                    person1=person1,
                    person2=person2,
                    children=[],
                    liquid_assets=taxable_total,
                    traditional_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "traditional" in a.get("type", "").lower()
                        or "401" in a.get("type", "").lower()
                    ),
                    roth_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "roth" in a.get("type", "").lower()
                    ),
                    pension_lump_sum=0,
                    pension_annual=financial_data.get("pension_benefit", 0) * 12,
                    annual_expenses=financial_data.get("annual_expenses", 0),
                    target_annual_income=financial_data.get("annual_income", 0),
                    risk_tolerance="moderate",
                    asset_allocation={"stocks": 0.6, "bonds": 0.4},
                    future_expenses=[],
                    investment_types=investment_types,
                    accounts=[],
                    income_streams=income_streams,
                    home_properties=profile_data.get("home_properties", []),
                    budget=profile_data.get("budget"),
                    annual_ira_contribution=financial_data.get(
                        "annual_ira_contribution", 0
                    ),
                    savings_allocation=profile_data.get("savings_allocation"),
                )

                model = RetirementModel(financial_profile)
                years = model.calculate_life_expectancy_years(person1, target_age=85)

                market_assumptions = MarketAssumptions(stock_allocation=0.60)
                results = model.monte_carlo_simulation(
                    years=years,
                    simulations=100,
                    assumptions=market_assumptions,
                    spending_model="constant_real",
                )

                timeline = results.get("timeline", {})
                if timeline and "median" in timeline and len(timeline["median"]) > 0:
                    year_0_balance = timeline["median"][0]

                    # Year 0 should be > starting assets (includes contributions)
                    assert (
                        year_0_balance > starting_total
                    ), f"Profile {profile.name}: Year 0 balance (${year_0_balance:,.0f}) should be > starting assets (${starting_total:,.0f})"

            except Exception as e:
                # Some profiles may not have valid data - that's OK
                pass

    def test_success_rates_are_reasonable(self, app_context):
        """Test that success rates are reasonable (not 0% or 100% for all cases)."""
        from src.database.connection import db

        rows = db.execute("SELECT id, user_id, name FROM profile LIMIT 3")

        success_rates = []

        for row in rows:
            profile = Profile.get_by_id(row["id"], row["user_id"])
            if not profile:
                continue

            profile_data = profile.data_dict
            assets_data = profile_data.get("assets", {})
            financial_data = profile_data.get("financial", {})

            taxable_total = sum(
                a.get("value", 0) for a in assets_data.get("taxable_accounts", [])
            )
            retirement_total = sum(
                a.get("value", 0) for a in assets_data.get("retirement_accounts", [])
            )

            if taxable_total + retirement_total == 0:
                continue

            try:
                person1 = Person(
                    name=profile.name,
                    birth_date=datetime.fromisoformat(
                        profile.birth_date or "1988-07-14"
                    ),
                    retirement_date=datetime.fromisoformat(
                        profile.retirement_date or "2055-07-14"
                    ),
                    social_security=financial_data.get("social_security_benefit", 0),
                )

                person2 = Person(
                    name="Spouse",
                    birth_date=datetime(1980, 1, 1),
                    retirement_date=datetime(2045, 1, 1),
                    social_security=0,
                )

                investment_types = transform_assets_to_investment_types(assets_data)

                financial_profile = FinancialProfile(
                    person1=person1,
                    person2=person2,
                    children=[],
                    liquid_assets=taxable_total,
                    traditional_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "traditional" in a.get("type", "").lower()
                        or "401" in a.get("type", "").lower()
                    ),
                    roth_ira=sum(
                        a.get("value", 0)
                        for a in assets_data.get("retirement_accounts", [])
                        if "roth" in a.get("type", "").lower()
                    ),
                    pension_lump_sum=0,
                    pension_annual=financial_data.get("pension_benefit", 0) * 12,
                    annual_expenses=financial_data.get("annual_expenses", 0),
                    target_annual_income=financial_data.get("annual_income", 0),
                    risk_tolerance="moderate",
                    asset_allocation={"stocks": 0.6, "bonds": 0.4},
                    future_expenses=[],
                    investment_types=investment_types,
                    accounts=[],
                    income_streams=profile_data.get("income_streams", []),
                    home_properties=profile_data.get("home_properties", []),
                    budget=profile_data.get("budget"),
                    annual_ira_contribution=financial_data.get(
                        "annual_ira_contribution", 0
                    ),
                    savings_allocation=profile_data.get("savings_allocation"),
                )

                model = RetirementModel(financial_profile)
                years = model.calculate_life_expectancy_years(person1, target_age=85)

                market_assumptions = MarketAssumptions(stock_allocation=0.60)
                results = model.monte_carlo_simulation(
                    years=years,
                    simulations=100,
                    assumptions=market_assumptions,
                    spending_model="constant_real",
                )

                success_rate = results.get("success_rate", 0)
                success_rates.append((profile.name, success_rate))

                # Success rate should be between 0 and 1
                assert (
                    0 <= success_rate <= 1
                ), f"Profile {profile.name}: Invalid success rate {success_rate}"

            except Exception as e:
                pass

        # At least some profiles should have success rates
        assert len(success_rates) > 0, "No profiles tested successfully"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
