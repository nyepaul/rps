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

import numpy as np

def test_monte_carlo_with_budget():
    p1 = Person("P1", datetime(1980, 1, 1), datetime(2045, 1, 1), 0)
    p2 = Person("P2", datetime(1980, 1, 1), datetime(2045, 1, 1), 0)
    
    # Budget with high expenses to ensure it's picked up
    budget = {
        'expenses': {
            'current': {
                'housing': {'amount': 5000, 'frequency': 'monthly', 'inflation_adjusted': True},
                'food': {'amount': 1000, 'frequency': 'monthly', 'inflation_adjusted': True}
            },
            'future': {
                'housing': {'amount': 3000, 'frequency': 'monthly', 'inflation_adjusted': True},
                'food': {'amount': 800, 'frequency': 'monthly', 'inflation_adjusted': True}
            }
        }
    }
    
    profile = FinancialProfile(
        person1=p1, person2=p2, children=[],
        liquid_assets=100000, traditional_ira=0, roth_ira=0,
        pension_lump_sum=0, pension_annual=0,
        annual_expenses=0, target_annual_income=0, # Should be overridden by budget
        risk_tolerance="moderate", asset_allocation={"stocks": 0.0, "bonds": 0.0}, # All cash
        future_expenses=[], investment_types=[
            {'account': 'Checking', 'value': 100000, 'cost_basis': 100000}
        ],
        budget=budget
    )
    
    model = RetirementModel(profile)
    # 6000/mo = 72000/year. 100k starting. 
    # Should run out of money quickly.
    result = model.monte_carlo_simulation(years=10, simulations=10)
    
    assert result['success_rate'] < 0.5
    assert result['starting_portfolio'] == 100000
