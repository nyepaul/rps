import time
import numpy as np
from datetime import datetime
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)


def benchmark_monte_carlo():
    print("--- Performance Benchmark (10,000 Simulations) ---")

    p1 = Person("Benchmark", datetime(1985, 1, 1), datetime(2050, 1, 1), 2500)
    profile = FinancialProfile(
        person1=p1,
        person2=p1,
        children=[],
        liquid_assets=500000.0,
        traditional_ira=500000.0,
        roth_ira=200000.0,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=80000.0,
        target_annual_income=80000.0,
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[],
        investment_types=[
            {"account": "Taxable Brokerage", "value": 500000.0, "cost_basis": 400000.0},
            {"account": "Traditional IRA", "value": 500000.0},
            {"account": "Roth IRA", "value": 200000.0},
        ],
    )

    model = RetirementModel(profile)

    start_time = time.time()
    result = model.monte_carlo_simulation(years=30, simulations=10000)
    end_time = time.time()

    duration = end_time - start_time
    print(f"Success Rate: {result['success_rate']*100}%")
    print(f"Execution Time: {duration:.4f} seconds")
    print(f"Time per simulation: {duration/10000:.6f} seconds")

    # Target: Should be under 1 second for 10k sims (vectorized)
    if duration < 1.0:
        print("✅ Performance Target Met!")
    else:
        print("⚠️ Performance Warning: Under 1s target missed.")


if __name__ == "__main__":
    benchmark_monte_carlo()
