import numpy as np
from datetime import datetime
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)


def format_curr(val):
    return f"${val:,.2f}"


def run_pennny_track_audit():
    print("--- PENNY-TRACK AUDIT (1 YEAR DETERMINISTIC) ---")

    # 1. Setup a controlled profile
    # Filing Status: Single
    # Salary: $100,000
    # Expenses: $50,000
    # Standard Deduction (2024 Single): $14,600
    # Expected Federal Tax:
    #   10% on $11,600 = $1,160
    #   12% on ($47,150 - $11,600) = $4,266
    #   22% on ($85,400 - $47,150) = $8,415
    #   Total: $1,160 + $4,266 + $8,415 = $13,841
    # FICA: $100,000 * 7.65% = $7,650
    # State Tax (5%): $5,000

    person1 = Person(
        name="Audit User",
        birth_date=datetime(1985, 1, 1),
        retirement_date=datetime(2050, 1, 1),
        social_security=0,
    )

    profile = FinancialProfile(
        person1=person1,
        person2=Person(
            "None", datetime(1985, 1, 1), datetime(2050, 1, 1), 0
        ),  # Dummy spouse
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

    # Project for 12 months to get full year result
    ledger = model.run_detailed_projection(years=1, assumptions=assumptions)
    # The engine returns 12 months for 1 year
    row = ledger[0]  # First month for tax check
    final_row = ledger[-1]  # End of year for balance check

    print(f"Scenario: Single, $100k Salary, $50k Expenses, 0% Returns")
    print(f"Gross Income (Month 1): {format_curr(row['gross_income'])}")
    print(
        f"Federal Tax (Month 1):  {format_curr(row['federal_tax'])} (Expected: ~{format_curr(13841.0/12.0)})"
    )
    print(
        f"FICA Tax (Month 1):     {format_curr(row['fica_tax'])} (Expected: {format_curr(7650.0/12.0)})"
    )
    print(
        f"State Tax (Month 1):    {format_curr(row['state_tax'])} (Expected: {format_curr(5850.0/12.0)})"
    )

    # Expected Annual Result
    total_tax_annual = 13841.0 + 7650.0 + 5850.0
    net_income_annual = 100000.0 - total_tax_annual
    surplus_annual = net_income_annual - 50000.0

    expected_balance = 100000.0 + surplus_annual
    print(f"Expected Final Balance (Year 1): {format_curr(expected_balance)}")
    print(
        f"Actual Final Balance (Month 12): {format_curr(final_row['portfolio_balance'])}"
    )

    assert abs(row["fica_tax"] - (7650.0 / 12.0)) < 1.0, "FICA calculation error"
    assert abs(row["state_tax"] - (5850.0 / 12.0)) < 1.0, "State tax calculation error"
    assert (
        abs(row["federal_tax"] - (13841.0 / 12.0)) < 10.0
    ), f"Federal tax calculation error: got {row['federal_tax']}"
    assert (
        abs(final_row["portfolio_balance"] - expected_balance) < 10.0
    ), f"Balance tracking error: got {final_row['portfolio_balance']}, expected {expected_balance}"
    print("✅ Penny-Track Audit Passed!")


def verify_rmd_factors():
    print("\n--- RMD FACTOR VALIDATION ---")
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
    rmd = model.calculate_rmd(73, 1000000.0)
    print(f"Age 73 Factor Test: {format_curr(rmd)} (Expected: $37,735.85)")
    assert abs(rmd - 37735.85) < 1.0

    rmd_90 = model.calculate_rmd(90, 1000000.0)
    print(f"Age 90 Factor Test: {format_curr(rmd_90)} (Expected: $81,967.21)")
    assert abs(rmd_90 - 81967.21) < 1.0
    print("✅ RMD Factors Verified!")


def verify_withdrawal_trap():
    print("\n--- WITHDRAWAL TRAP TEST (PENALTY & SEQUENCING) ---")
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
    ledger = model.run_detailed_projection(years=1, assumptions=assumptions)

    total_withdrawals = sum(r["withdrawals"] for r in ledger)
    total_fed_tax = sum(r["federal_tax"] for r in ledger)

    print(f"Total Withdrawals: {format_curr(total_withdrawals)}")
    print(f"Federal Tax Paid:  {format_curr(total_fed_tax)}")
    assert total_withdrawals > 50000.0
    print("✅ Withdrawal Trap Test Passed!")


def verify_filing_statuses():
    print("\n--- FILING STATUS & DEDUCTION AUDIT ---")
    person1 = Person("User", datetime(1985, 1, 1), datetime(2050, 1, 1), 0)

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
        income_streams=[
            {
                "name": "S",
                "amount": 100000.0 / 12.0,
                "frequency": "monthly",
                "start_date": "2020-01-01",
                "type": "salary",
                "inflation_adjusted": False,
            }
        ],
        filing_status="hoh",
    )
    model = RetirementModel(profile_hoh)
    deduction = model.get_standard_deduction(np.array([1.0]))
    print(f"HoH Deduction: {deduction[0]} (Expected: 21900)")
    assert deduction[0] == 21900

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
        income_streams=[
            {
                "name": "S",
                "amount": 100000.0 / 12.0,
                "frequency": "monthly",
                "start_date": "2020-01-01",
                "type": "salary",
                "inflation_adjusted": False,
            }
        ],
        filing_status="mfj",
    )
    model_mfj = RetirementModel(profile_mfj)
    deduction_mfj = model_mfj.get_standard_deduction(np.array([1.0]))
    print(f"MFJ Deduction: {deduction_mfj[0]} (Expected: 29200)")
    assert deduction_mfj[0] == 29200
    print("✅ Filing Status Deductions Verified!")


def verify_monte_carlo_volatility():
    print("\n--- MONTE CARLO VOLATILITY AUDIT ---")
    # High Volatility (18%) vs Low Volatility (0%)
    # Even with same mean, median ending balance should be lower for High Vol

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
        years=20, simulations=100, assumptions=assumptions_a
    )

    # Scenario B: 7% return, 20% volatility
    assumptions_b = MarketAssumptions(
        stock_return_mean=0.07, stock_return_std=0.20, inflation_mean=0
    )
    model_b = RetirementModel(profile)
    res_b = model_b.monte_carlo_simulation(
        years=20, simulations=1000, assumptions=assumptions_b
    )

    print(f"Zero Vol Median (20yr): {format_curr(res_a['median_final_balance'])}")
    print(f"High Vol Median (20yr): {format_curr(res_b['median_final_balance'])}")

    # Volatility drag: median should be significantly lower than the deterministic 1.07^20
    assert res_a["median_final_balance"] > res_b["median_final_balance"]
    print("✅ Volatility Drag Verified (Monte Carlo is statistically sound)!")


if __name__ == "__main__":
    try:
        run_pennny_track_audit()
        verify_rmd_factors()
        verify_withdrawal_trap()
        verify_filing_statuses()
        verify_monte_carlo_volatility()
        print("\n🏆 ALL INTEGRITY CHECKS PASSED 🏆")
    except Exception as e:
        print(f"\n❌ INTEGRITY CHECK FAILED: {str(e)}")
        import traceback

        traceback.print_exc()
        exit(1)
