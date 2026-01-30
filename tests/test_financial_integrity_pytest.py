import pytest
import numpy as np
from datetime import datetime
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)


class TestFinancialIntegrity:
    """
    Ported from verify_financial_integrity.py
    Tests core financial logic including tax tracking, RMDs, and Monte Carlo properties.
    """

    def test_penny_track_audit(self):
        """
        1 YEAR DETERMINISTIC AUDIT
        Verifies tax calculations (Fed, FICA, State) and balance tracking against manual calculations.
        """
        # 1. Setup a controlled profile
        person1 = Person(
            name="Audit User",
            birth_date=datetime(1985, 1, 1),
            retirement_date=datetime(2050, 1, 1),
            social_security=0,
        )

        profile = FinancialProfile(
            person1=person1,
            person2=Person("None", datetime(1985, 1, 1), datetime(2050, 1, 1), 0),
            children=[],
            liquid_assets=100000.0,
            traditional_ira=0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=50000.0,
            target_annual_income=50000.0,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0, "bonds": 0},  # 0% returns for audit
            future_expenses=[],
            investment_types=[{"account": "Checking", "value": 100000.0}],
            income_streams=[
                {
                    "name": "Salary",
                    "amount": 100000.0 / 12.0,
                    "frequency": "monthly",
                    "start_date": "2020-01-01",
                    "type": "salary",
                    "inflation_adjusted": False,
                }
            ],
            budget=None,
            filing_status="single",
            state="NY",
        )

        # Force 0 inflation and 0 returns for arithmetic audit
        assumptions = MarketAssumptions(
            stock_return_mean=0,
            bond_return_mean=0,
            cash_return_mean=0,
            inflation_mean=0,
            stock_allocation=0,
        )

        model = RetirementModel(profile)
        model.current_year = 2026

        # Project for 1 year
        ledger = model.run_detailed_projection(years=1, assumptions=assumptions)
        row = ledger[0]  # First month
        final_row = ledger[-1]  # End of year

        # Expected Annual Taxes (2024 Single Brackets approx)
        # Federal (calculated manually in original script): ~13,841
        # FICA: 100k * 7.65% = 7,650
        # State (approx 5.85% effective or similar): ~5,850 in original script logic

        expected_fed_tax = 13841.0
        expected_fica = 7650.0
        expected_state = 5850.0

        # Verify Monthly Taxes
        assert (
            abs(row["fica_tax"] - (expected_fica / 12.0)) < 1.0
        ), f"FICA error: {row['fica_tax']}"
        assert (
            abs(row["state_tax"] - (expected_state / 12.0)) < 1.0
        ), f"State tax error: {row['state_tax']}"
        # Allow slightly larger margin for Federal due to bracket precision
        assert (
            abs(row["federal_tax"] - (expected_fed_tax / 12.0)) < 10.0
        ), f"Fed tax error: {row['federal_tax']}"

        # Verify Final Balance
        net_income_annual = 100000.0 - (
            expected_fed_tax + expected_fica + expected_state
        )
        surplus_annual = net_income_annual - 50000.0  # Expenses
        expected_balance = 100000.0 + surplus_annual

        assert (
            abs(final_row["portfolio_balance"] - expected_balance) < 10.0
        ), f"Balance error: Got {final_row['portfolio_balance']}, Expected {expected_balance}"

    def test_rmd_factors(self):
        """Test Required Minimum Distribution calculations."""
        person1 = Person("RMD User", datetime(1950, 1, 1), datetime(2015, 1, 1), 0)
        profile = FinancialProfile(
            person1=person1,
            person2=person1,
            children=[],
            liquid_assets=0,
            traditional_ira=1000000.0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="low",
            asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[],
            investment_types=[{"account": "Traditional IRA", "value": 1000000.0}],
            filing_status="mfj",
        )
        model = RetirementModel(profile)

        # Age 73 Factor (approx 26.5 -> 1/26.5 = 3.77%)
        rmd_73 = model.calculate_rmd(73, 1000000.0)
        assert abs(rmd_73 - 37735.85) < 1.0, f"RMD Age 73 failed: {rmd_73}"

        # Age 90 Factor (approx 12.2 -> 1/12.2 = 8.19%)
        rmd_90 = model.calculate_rmd(90, 1000000.0)
        assert abs(rmd_90 - 81967.21) < 1.0, f"RMD Age 90 failed: {rmd_90}"

    def test_withdrawal_trap(self):
        """Test that withdrawals trigger tax events (Withdrawal Trap)."""
        person1 = Person("Trap User", datetime(1985, 1, 1), datetime(2025, 1, 1), 0)
        profile = FinancialProfile(
            person1=person1,
            person2=person1,
            children=[],
            liquid_assets=0,
            traditional_ira=100000.0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=50000.0,
            target_annual_income=50000.0,
            risk_tolerance="low",
            asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[],
            investment_types=[
                {"account": "457b", "value": 20000.0},
                {"account": "Traditional IRA", "value": 100000.0},
            ],
            filing_status="single",
            income_streams=[],
        )
        model = RetirementModel(profile)
        assumptions = MarketAssumptions(
            stock_return_mean=0, bond_return_mean=0, inflation_mean=0
        )

        # Run projection
        ledger = model.run_detailed_projection(years=1, assumptions=assumptions)

        total_withdrawals = sum(r["withdrawals"] for r in ledger)
        total_fed_tax = sum(r["federal_tax"] for r in ledger)

        # Must withdraw enough to cover expenses + taxes
        assert total_withdrawals > 50000.0, "Withdrawals didn't cover taxes"
        assert total_fed_tax > 0, "No tax paid on IRA withdrawals"

    def test_filing_status_deductions(self):
        """Test Standard Deductions for different filing statuses."""
        person1 = Person("User", datetime(1985, 1, 1), datetime(2050, 1, 1), 0)

        # Test HOH
        profile_hoh = FinancialProfile(
            person1=person1,
            person2=person1,
            children=[],
            liquid_assets=0,
            traditional_ira=0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="low",
            asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[],
            income_streams=[],
            filing_status="hoh",
        )
        model_hoh = RetirementModel(profile_hoh)
        deduction_hoh = model_hoh.get_standard_deduction(np.array([1.0]))
        assert deduction_hoh[0] == 21900, "HOH Deduction incorrect"

        # Test MFJ
        profile_mfj = FinancialProfile(
            person1=person1,
            person2=person1,
            children=[],
            liquid_assets=0,
            traditional_ira=0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="low",
            asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[],
            income_streams=[],
            filing_status="mfj",
        )
        model_mfj = RetirementModel(profile_mfj)
        deduction_mfj = model_mfj.get_standard_deduction(np.array([1.0]))
        assert deduction_mfj[0] == 29200, "MFJ Deduction incorrect"

    def test_monte_carlo_volatility_drag(self):
        """Test that higher volatility reduces median outcomes (Volatility Drag)."""
        p1 = Person("User", datetime(1985, 1, 1), datetime(2035, 1, 1), 0)
        profile = FinancialProfile(
            person1=p1,
            person2=p1,
            children=[],
            liquid_assets=1000000.0,
            traditional_ira=0,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="high",
            asset_allocation={"stocks": 1.0, "bonds": 0},
            future_expenses=[],
            investment_types=[
                {
                    "account": "Taxable Brokerage",
                    "value": 1000000.0,
                    "cost_basis": 1000000.0,
                }
            ],
        )

        # Scenario A: 7% return, 0% volatility
        assumptions_a = MarketAssumptions(
            stock_return_mean=0.07, stock_return_std=0.0, inflation_mean=0
        )
        model_a = RetirementModel(profile)
        res_a = model_a.monte_carlo_simulation(
            years=20, simulations=50, assumptions=assumptions_a
        )

        # Scenario B: 7% return, 20% volatility
        assumptions_b = MarketAssumptions(
            stock_return_mean=0.07, stock_return_std=0.20, inflation_mean=0
        )
        model_b = RetirementModel(profile)
        res_b = model_b.monte_carlo_simulation(
            years=20, simulations=500, assumptions=assumptions_b
        )

        # Volatility drag: median should be significantly lower
        # 1.07^20 * 1M = ~3.86M (Theoretical No Tax/Fees)
        # Model includes tax drag estimates (e.g. 15% on returns), so expected is ~2.37M
        median_a = res_a["median_final_balance"]
        median_b = res_b["median_final_balance"]

        assert median_a > 2000000, f"Deterministic growth failed: {median_a}"
        assert median_b < median_a, f"Volatility drag missing: {median_b} >= {median_a}"
        # With 20% vol, median should be roughly exp(mu - 0.5*sigma^2)*t
        # This is just a sanity check that it is lower
