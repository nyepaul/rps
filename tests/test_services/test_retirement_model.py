"""Tests for RetirementModel withdrawal logic."""

from datetime import datetime
from src.services.retirement_model import (
    Person, FinancialProfile, RetirementModel, MarketAssumptions
)

def test_rmd_calculation():
    p1 = Person("P1", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)
    p2 = Person("P2", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)
    
    profile = FinancialProfile(
        person1=p1, person2=p2, children=[],
        liquid_assets=0, traditional_ira=1000000, roth_ira=0,
        pension_lump_sum=0, pension_annual=0,
        annual_expenses=50000, target_annual_income=50000,
        risk_tolerance="moderate", asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[], investment_types=[
            {'account': 'Traditional IRA', 'value': 1000000, 'cost_basis': 1000000}
        ]
    )
    
    model = RetirementModel(profile)
    # At age 76 (2026 - 1950), RMD factor is 23.7
    # 1,000,000 / 23.7 = 42,194
    # Our model splits it: (1,000,000 / 2) / 23.7 * 2 = 42,194
    rmd = model.calculate_rmd(76, 1000000)
    assert round(rmd) == 42194

def test_monte_carlo_success_rate():
    # Basic sanity test for monte carlo
    p1 = Person("P1", datetime(1980, 1, 1), datetime(2045, 1, 1), 3000)
    p2 = Person("P2", datetime(1980, 1, 1), datetime(2045, 1, 1), 3000)
    
    profile = FinancialProfile(
        person1=p1, person2=p2, children=[],
        liquid_assets=1000000, traditional_ira=1000000, roth_ira=500000,
        pension_lump_sum=0, pension_annual=0,
        annual_expenses=100000, target_annual_income=100000,
        risk_tolerance="moderate", asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[], investment_types=[
            {'account': 'Liquid', 'value': 1000000, 'cost_basis': 1000000},
            {'account': 'Traditional IRA', 'value': 1000000, 'cost_basis': 1000000},
            {'account': 'Roth IRA', 'value': 500000, 'cost_basis': 500000}
        ]
    )
    
    model = RetirementModel(profile)
    result = model.monte_carlo_simulation(years=30, simulations=100)
    
    assert result['success_rate'] > 0.9
    assert result['median_final_balance'] > 0
