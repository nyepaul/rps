import pytest
import threading
import time
import numpy as np
from datetime import datetime
from src.services.retirement_model import (
    RetirementModel,
    FinancialProfile,
    Person,
    MarketAssumptions,
)


def create_test_profile(
    person1_name="Test Person",
    annual_expenses=80000,
    liquid_assets=500000,
    income_streams=None,
):
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
        liquid_assets=liquid_assets,
        traditional_ira=200000,
        roth_ira=50000,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=annual_expenses,
        target_annual_income=annual_expenses * 1.2,
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[],
        income_streams=income_streams or [],
    )


def test_high_simulation_load():
    """Stress test the engine with a high number of simulations."""
    profile = create_test_profile(person1_name="Stress Test", liquid_assets=500000)
    model = RetirementModel(profile)

    start_time = time.time()
    # Run 10,000 simulations
    results = model.monte_carlo_simulation(
        years=40, simulations=10000, assumptions=MarketAssumptions()
    )
    duration = time.time() - start_time

    assert results["success_rate"] >= 0
    assert len(results["timeline"]["median"]) == 40
    # Should complete within a reasonable time (vectorized numpy is fast)
    assert duration < 5.0  # 10k simulations should take < 5s on modern hardware


def test_complex_profile_load():
    """Test engine with a large number of assets and income streams."""
    # Add 50 income streams
    income_streams = []
    for i in range(50):
        income_streams.append(
            {
                "name": f"Stream {i}",
                "type": "other",
                "amount": 100,
                "frequency": "monthly",
            }
        )

    profile = create_test_profile(
        person1_name="Complex Test", income_streams=income_streams
    )
    model = RetirementModel(profile)

    results = model.monte_carlo_simulation(years=30, simulations=100)
    assert results["success_rate"] >= 0


def test_long_horizon_load():
    """Test very long retirement horizon."""
    # 100 year retirement
    profile = create_test_profile(person1_name="Long Test", liquid_assets=5000000)
    # Adjust dates for long horizon
    profile.person1.retirement_date = datetime(2025, 1, 1)

    model = RetirementModel(profile)

    results = model.monte_carlo_simulation(years=100, simulations=100)
    assert len(results["timeline"]["median"]) == 100


def test_concurrent_simulations(app):
    """Simulate concurrent requests to the analysis engine."""

    def run_request():
        with app.app_context():
            profile = create_test_profile(person1_name="Thread Test")
            model = RetirementModel(profile)
            model.monte_carlo_simulation(years=30, simulations=100)

    threads = []
    for i in range(5):  # 5 concurrent simulations
        t = threading.Thread(target=run_request)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # If we reached here without crash, success
    assert True
