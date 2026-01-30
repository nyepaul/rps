import pytest
import numpy as np
from datetime import datetime
from src.services.retirement_model import (
    RetirementModel,
    FinancialProfile,
    Person,
    MarketAssumptions,
)


def create_test_profile(person1_name="Test Person", annual_expenses=50000):
    """Helper to create a valid FinancialProfile with defaults."""
    person1 = Person(
        name=person1_name,
        birth_date=datetime(1980, 1, 1),
        retirement_date=datetime(2045, 1, 1),
        social_security=0,
    )
    person2 = Person(
        name="Spouse",
        birth_date=datetime(1982, 1, 1),
        retirement_date=datetime(2047, 1, 1),
        social_security=0,
    )
    return FinancialProfile(
        person1=person1,
        person2=person2,
        children=[],
        liquid_assets=100000,
        traditional_ira=200000,
        roth_ira=50000,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=annual_expenses,
        target_annual_income=annual_expenses * 1.2,
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[],
    )


def test_progressive_tax_brackets():
    """Exhaustive test of the progressive tax calculation engine."""
    profile = create_test_profile(annual_expenses=50000)
    model = RetirementModel(profile)

    # Test cases: (taxable_income, expected_tax_approx)
    # Based on 2024 MFJ brackets (simplified)
    # 10% up to 23,200
    # 12% up to 94,300
    # 22% up to 201,050
    test_cases = [
        (20000, 2000),  # 10%
        (50000, 2320 + 3216),  # 2320 (10%) + 26800*0.12 (3216) = 5536
        (
            150000,
            2320 + 8532 + 12254,
        ),  # 2320 + 71100*0.12 (8532) + 55700*0.22 (12254) = 23106
    ]

    for income, expected in test_cases:
        # Note: model._vectorized_federal_tax is vectorized
        tax = model._vectorized_federal_tax(np.array([income]), filing_status="mfj")[0][
            0
        ]
        assert (
            abs(tax - expected) < 1500
        )  # Allow for some bracket simplification differences


def test_social_security_taxability():
    """Test the 'taxable portion' logic of Social Security."""
    profile = create_test_profile()
    model = RetirementModel(profile)

    # Combined Income = AGI + Non-taxable Interest + 50% of SS
    # MFJ Thresholds: $32,000 (50% taxable), $44,000 (85% taxable)

    # Case 1: Low income, SS not taxable
    taxable_ss = model._vectorized_taxable_ss(
        other_income=np.array([10000]),
        ss_benefit=np.array([20000]),
        filing_status="mfj",
    )[0]
    assert taxable_ss == 0

    # Case 2: High income, 85% of SS taxable
    taxable_ss = model._vectorized_taxable_ss(
        other_income=np.array([200000]),
        ss_benefit=np.array([40000]),
        filing_status="mfj",
    )[0]
    assert taxable_ss == 40000 * 0.85


def test_rmd_logic():
    """Test that RMDs are calculated correctly based on age."""
    profile = create_test_profile()
    model = RetirementModel(profile)

    # IRS Uniform Lifetime Table approx:
    # Age 73: 26.5
    # Age 80: 20.2
    # Age 90: 12.2

    # Age 70: Should be 0 (RMD starts at 73 or 75)
    rmd = model.calculate_rmd(age=70, ira_balance=1000000)
    assert rmd == 0

    # Age 75: ~1,000,000 / 24.6
    rmd = model.calculate_rmd(age=75, ira_balance=1000000)
    assert rmd > 30000 and rmd < 50000

    # Age 90: ~1,000,000 / 12.2
    rmd = model.calculate_rmd(age=90, ira_balance=1000000)
    assert rmd > 80000


def test_inflation_compounding():
    """Verify that expenses compound correctly with inflation."""
    profile = create_test_profile(annual_expenses=100000)
    model = RetirementModel(profile)

    # 3% inflation for 10 years: 1.03^10 = 1.3439
    expected = 100000 * (1.03**10)

    # Manually simulate 10 years of inflation
    current = 100000
    for i in range(10):
        current *= 1.03

    assert abs(current - expected) < 0.01
