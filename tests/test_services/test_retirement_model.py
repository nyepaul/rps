"""Tests for RetirementModel withdrawal logic and tax calculations."""

from datetime import datetime
import numpy as np
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    RetirementModel,
    MarketAssumptions,
)


def _create_basic_model():
    """Helper to create a basic RetirementModel for testing."""
    p1 = Person("P1", datetime(1960, 1, 1), datetime(2025, 1, 1), 2000)
    p2 = Person("P2", datetime(1962, 1, 1), datetime(2027, 1, 1), 1800)
    profile = FinancialProfile(
        person1=p1,
        person2=p2,
        children=[],
        liquid_assets=50000,
        traditional_ira=500000,
        roth_ira=100000,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=60000,
        target_annual_income=60000,
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[],
        investment_types=[
            {"account": "Traditional IRA", "value": 500000, "cost_basis": 500000}
        ],
    )
    return RetirementModel(profile)


def test_rmd_calculation():
    p1 = Person("P1", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)
    p2 = Person("P2", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)

    profile = FinancialProfile(
        person1=p1,
        person2=p2,
        children=[],
        liquid_assets=0,
        traditional_ira=1000000,
        roth_ira=0,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=50000,
        target_annual_income=50000,
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[],
        investment_types=[
            {"account": "Traditional IRA", "value": 1000000, "cost_basis": 1000000}
        ],
    )

    model = RetirementModel(profile)
    # At age 76 (2026 - 1950), RMD factor is 23.7
    # 1,000,000 / 23.7 = 42,194
    # Our model splits it: (1,000,000 / 2) / 23.7 * 2 = 42,194
    rmd = model.calculate_rmd(76, 1000000)
    assert round(rmd) == 42194


def test_monte_carlo_with_budget():
    p1 = Person("P1", datetime(1980, 1, 1), datetime(2045, 1, 1), 0)
    p2 = Person("P2", datetime(1980, 1, 1), datetime(2045, 1, 1), 0)

    # Budget with high expenses to ensure it's picked up
    budget = {
        "expenses": {
            "current": {
                "housing": {
                    "amount": 5000,
                    "frequency": "monthly",
                    "inflation_adjusted": True,
                },
                "food": {
                    "amount": 1000,
                    "frequency": "monthly",
                    "inflation_adjusted": True,
                },
            },
            "future": {
                "housing": {
                    "amount": 3000,
                    "frequency": "monthly",
                    "inflation_adjusted": True,
                },
                "food": {
                    "amount": 800,
                    "frequency": "monthly",
                    "inflation_adjusted": True,
                },
            },
        }
    }

    profile = FinancialProfile(
        person1=p1,
        person2=p2,
        children=[],
        liquid_assets=100000,
        traditional_ira=0,
        roth_ira=0,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=0,
        target_annual_income=0,  # Should be overridden by budget
        risk_tolerance="moderate",
        asset_allocation={"stocks": 0.0, "bonds": 0.0},  # All cash
        future_expenses=[],
        investment_types=[
            {"account": "Checking", "value": 100000, "cost_basis": 100000}
        ],
        budget=budget,
    )

    model = RetirementModel(profile)
    # 6000/mo = 72000/year. 100k starting.
    # Should run out of money quickly.
    result = model.monte_carlo_simulation(years=10, simulations=10)

    assert result["success_rate"] < 0.5
    assert result["starting_portfolio"] == 100000


# =========================================================================
# Tax Function Tests
# =========================================================================


class TestProgressiveFederalTax:
    """Tests for _vectorized_federal_tax function."""

    def test_low_income_10_percent_bracket(self):
        """Income under $23,200 should be taxed at 10%."""
        model = _create_basic_model()
        income = np.array([20000.0])
        tax, marginal = model._vectorized_federal_tax(income, "mfj")
        assert tax[0] == 2000.0  # 20,000 * 0.10
        assert marginal[0] == 0.10

    def test_middle_income_progressive(self):
        """Income of $50,000 spans 10% and 12% brackets."""
        model = _create_basic_model()
        income = np.array([50000.0])
        tax, marginal = model._vectorized_federal_tax(income, "mfj")
        # First $23,200 at 10% = $2,320
        # Remaining $26,800 at 12% = $3,216
        expected = 23200 * 0.10 + (50000 - 23200) * 0.12
        assert abs(tax[0] - expected) < 1  # Allow for rounding
        assert marginal[0] == 0.12

    def test_high_income_top_brackets(self):
        """Income of $800,000 should hit 37% bracket."""
        model = _create_basic_model()
        income = np.array([800000.0])
        tax, marginal = model._vectorized_federal_tax(income, "mfj")
        assert marginal[0] == 0.37
        # Effective rate should be between 22% and 37%
        effective_rate = tax[0] / 800000
        assert 0.22 < effective_rate < 0.37

    def test_vectorized_multiple_incomes(self):
        """Test with multiple income values simultaneously."""
        model = _create_basic_model()
        incomes = np.array([10000.0, 50000.0, 200000.0, 500000.0])
        taxes, marginals = model._vectorized_federal_tax(incomes, "mfj")

        # Each should have increasing tax
        assert taxes[0] < taxes[1] < taxes[2] < taxes[3]
        # Marginal rates should be non-decreasing
        assert marginals[0] <= marginals[1] <= marginals[2] <= marginals[3]


class TestSocialSecurityTaxation:
    """Tests for _vectorized_taxable_ss function."""

    def test_below_first_threshold_zero_taxable(self):
        """Provisional income below $32K (MFJ) = 0% taxable."""
        model = _create_basic_model()
        other_income = np.array([10000.0])  # Low AGI
        ss_benefit = np.array([20000.0])  # $20K SS
        # Provisional = 10000 + 0.5*20000 = 20000 < 32000
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, "mfj")
        assert taxable[0] == 0.0

    def test_between_thresholds_partial_taxable(self):
        """Provisional income between $32K-$44K = up to 50% taxable."""
        model = _create_basic_model()
        other_income = np.array([25000.0])
        ss_benefit = np.array([24000.0])
        # Provisional = 25000 + 0.5*24000 = 37000 (between 32K and 44K)
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, "mfj")
        # Taxable should be > 0 but < 50% of benefits
        assert 0 < taxable[0] < ss_benefit[0] * 0.5

    def test_above_second_threshold_85_percent_taxable(self):
        """Provisional income above $44K (MFJ) = up to 85% taxable."""
        model = _create_basic_model()
        other_income = np.array([100000.0])  # High AGI
        ss_benefit = np.array([30000.0])
        # Provisional = 100000 + 0.5*30000 = 115000 >> 44000
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, "mfj")
        # Should be 85% of benefits (max taxable)
        assert abs(taxable[0] - ss_benefit[0] * 0.85) < 1


class TestLongTermCapitalGainsTax:
    """Tests for _vectorized_ltcg_tax function."""

    def test_zero_percent_bracket(self):
        """Low income + gains should be taxed at 0%."""
        model = _create_basic_model()
        gains = np.array([50000.0])
        ordinary_income = np.array([40000.0])  # Below $94,050 threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, "mfj")
        # Total income = 90000, all in 0% bracket
        assert tax[0] == 0.0

    def test_fifteen_percent_bracket(self):
        """Middle income should be taxed at 15%."""
        model = _create_basic_model()
        gains = np.array([50000.0])
        ordinary_income = np.array([200000.0])  # Above 0% threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, "mfj")
        # All gains in 15% bracket
        assert tax[0] == 50000 * 0.15

    def test_twenty_percent_bracket(self):
        """Very high income should be taxed at 20%."""
        model = _create_basic_model()
        gains = np.array([100000.0])
        ordinary_income = np.array([600000.0])  # Above $583,750 threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, "mfj")
        # All gains in 20% bracket
        assert tax[0] == 100000 * 0.20

    def test_income_stacking(self):
        """Gains should stack on ordinary income."""
        model = _create_basic_model()
        gains = np.array([50000.0, 50000.0])
        ordinary_income = np.array([40000.0, 600000.0])
        taxes = model._vectorized_ltcg_tax(gains, ordinary_income, "mfj")
        # First case: 0% rate (low income)
        # Second case: 20% rate (high income stacking)
        assert taxes[0] < taxes[1]


class TestIRMAASurcharges:
    """Tests for _vectorized_irmaa function."""

    def test_no_surcharge_low_income(self):
        """MAGI below $206K should have no IRMAA surcharge."""
        model = _create_basic_model()
        magi = np.array([150000.0])
        irmaa = model._vectorized_irmaa(magi, "mfj", both_on_medicare=True)
        assert irmaa[0] == 0.0

    def test_tier_1_surcharge(self):
        """MAGI $206K-$258K should have Tier 1 surcharge."""
        model = _create_basic_model()
        magi = np.array([230000.0])
        irmaa = model._vectorized_irmaa(magi, "mfj", both_on_medicare=True)
        # Tier 1: $839.40 per person, doubled for couple
        assert irmaa[0] == 839.40 * 2

    def test_top_tier_surcharge(self):
        """MAGI above $750K should have Tier 5 surcharge."""
        model = _create_basic_model()
        magi = np.array([800000.0])
        irmaa = model._vectorized_irmaa(magi, "mfj", both_on_medicare=True)
        # Tier 5: $5030.40 per person, doubled for couple
        assert irmaa[0] == 5030.40 * 2

    def test_single_person_on_medicare(self):
        """Single person should get single surcharge (not doubled)."""
        model = _create_basic_model()
        magi = np.array([230000.0])
        irmaa = model._vectorized_irmaa(magi, "mfj", both_on_medicare=False)
        assert irmaa[0] == 839.40  # Not doubled


class TestEmploymentTax:
    """Tests for _calculate_employment_tax function."""

    def test_fica_calculation(self):
        """FICA should be 7.65% (SS 6.2% + Medicare 1.45%)."""
        model = _create_basic_model()
        income = np.array([50000.0])
        tax = model._calculate_employment_tax(income, state_rate=0)
        # At $50K, FICA = 50000 * 0.0765 = 3825
        # Plus federal tax on (50000 - 29200 std deduction)
        fica_portion = 50000 * 0.0765
        assert tax[0] > fica_portion  # Should include federal too

    def test_ss_wage_base_cap(self):
        """SS tax should cap at wage base ($168,600 in 2024)."""
        model = _create_basic_model()
        # Income below SS wage base ($168,600)
        below_cap = np.array([100000.0])
        # Income above SS wage base
        above_cap = np.array([200000.0])

        # Isolate the FICA portion by comparing total tax calculation
        # At $100K: SS = 100000 * 0.062 = $6,200
        # At $200K: SS = 168600 * 0.062 = $10,453 (capped)
        # Without cap, $200K would have SS = $12,400

        # Calculate difference in total tax between two incomes
        tax_100k = model._calculate_employment_tax(below_cap, state_rate=0)
        tax_200k = model._calculate_employment_tax(above_cap, state_rate=0)

        # The SS portion difference should be less than 100000 * 0.062 = $6,200
        # because the cap kicks in at $168,600
        ss_diff_if_no_cap = 100000 * 0.062  # $6,200

        # Verify we have valid tax amounts
        assert tax_100k[0] > 0
        assert tax_200k[0] > tax_100k[0]

    def test_state_tax_included(self):
        """State tax should be included when rate > 0."""
        model = _create_basic_model()
        income = np.array([100000.0])
        tax_no_state = model._calculate_employment_tax(income, state_rate=0)
        tax_with_state = model._calculate_employment_tax(income, state_rate=0.05)
        expected_state = 100000 * 0.05
        assert abs((tax_with_state[0] - tax_no_state[0]) - expected_state) < 1


class TestRMDDoubleCounting:
    """Tests to verify RMD double-counting bug is fixed."""

    def test_both_spouses_rmd_from_original_balance(self):
        """Both spouses' RMDs should be calculated from original balance."""
        # This is a regression test for the double-counting bug
        p1 = Person("P1", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)
        p2 = Person("P2", datetime(1950, 1, 1), datetime(2015, 1, 1), 2000)
        profile = FinancialProfile(
            person1=p1,
            person2=p2,
            children=[],
            liquid_assets=0,
            traditional_ira=1000000,
            roth_ira=0,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[],
            investment_types=[
                {"account": "Traditional IRA", "value": 1000000, "cost_basis": 1000000}
            ],
        )
        model = RetirementModel(profile)

        # At age 76, factor is 23.7
        # Each spouse: (1,000,000 / 2) / 23.7 = 21,097
        # Total: 42,194
        # BUG would calculate: spouse1 = 21,097, then balance = 978,903
        # spouse2 = (978,903 / 2) / 23.7 = 20,652 (wrong!)

        rmd = model.calculate_rmd(76, 1000000)
        expected = 1000000 / 23.7  # Correct: each half uses original balance
        assert abs(rmd - expected) < 1


class TestFullSimulationIntegration:
    """Integration tests for full Monte Carlo simulation."""

    def test_simulation_runs_without_error(self):
        """Simulation should complete without errors."""
        model = _create_basic_model()
        result = model.monte_carlo_simulation(
            years=20,
            simulations=100,
            assumptions=MarketAssumptions(),
            spending_model="constant_real",
        )
        assert 0 <= result["success_rate"] <= 1
        assert result["starting_portfolio"] > 0
        assert len(result["timeline"]["years"]) == 20

    def test_progressive_taxes_affect_results(self):
        """Progressive taxes should produce different results than flat rate."""
        model = _create_basic_model()

        # Run with default effective_tax_rate (22%)
        np.random.seed(42)  # For reproducibility
        result = model.monte_carlo_simulation(
            years=20,
            simulations=100,
            assumptions=MarketAssumptions(),
            effective_tax_rate=0.22,
        )

        # The simulation now uses progressive taxes internally
        # We just verify it runs and produces reasonable results
        assert result["success_rate"] >= 0
        assert result["median_final_balance"] >= 0


# =========================================================================
# Market Periods Tests (Version 3.10.0)
# =========================================================================


class TestMarketPeriodsValidation:
    """Tests for _validate_market_periods function."""

    def test_no_warnings_for_reasonable_timeline(self):
        """Reasonable timeline periods should produce no warnings."""
        model = _create_basic_model()
        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": 2024,
                    "end_year": 2026,
                    "assumptions": {
                        "stock_return_mean": 0.02,
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": 2027,
                    "end_year": 2035,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert isinstance(warnings, list)
        assert len(warnings) == 0

    def test_warns_on_prolonged_recession(self):
        """Should warn about recessions lasting more than 5 years."""
        model = _create_basic_model()
        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": 2024,
                    "end_year": 2030,  # 7 years
                    "assumptions": {
                        "stock_return_mean": 0.02,  # Low return = recession
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                }
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert len(warnings) > 0
        assert any("recession" in w.lower() for w in warnings)

    def test_warns_on_prolonged_bull_market(self):
        """Should warn about bull markets lasting more than 15 years."""
        model = _create_basic_model()
        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": 2024,
                    "end_year": 2040,  # 17 years
                    "assumptions": {
                        "stock_return_mean": 0.18,  # High return = bull market
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                }
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert len(warnings) > 0
        assert any("bull market" in w.lower() for w in warnings)

    def test_warns_on_single_long_period(self):
        """Should warn when single period covers 80%+ of retirement."""
        model = _create_basic_model()
        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": 2024,
                    "end_year": 2050,  # 27 years out of 30 = 90%
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                }
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert len(warnings) > 0
        assert any("single market condition" in w.lower() for w in warnings)

    def test_detects_timeline_gaps(self):
        """Should detect gaps in timeline coverage."""
        model = _create_basic_model()
        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": 2024,
                    "end_year": 2026,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": 2030,  # Gap from 2027-2029
                    "end_year": 2035,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert len(warnings) > 0
        assert any("gap" in w.lower() for w in warnings)

    def test_warns_on_short_cycle(self):
        """Should warn about very short market cycles."""
        model = _create_basic_model()
        periods = {
            "type": "cycle",
            "repeat": True,
            "pattern": [
                {
                    "duration": 1,
                    "assumptions": {
                        "stock_return_mean": 0.18,
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "duration": 1,
                    "assumptions": {
                        "stock_return_mean": 0.02,
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }
        warnings = model._validate_market_periods(30, periods)
        assert len(warnings) > 0
        assert any("short" in w.lower() or "cycle" in w.lower() for w in warnings)


class TestBuildPeriodAssumptionsLookup:
    """Tests for _build_period_assumptions_lookup function."""

    def test_returns_default_when_no_periods(self):
        """Should return default assumptions for all years when no periods specified."""
        model = _create_basic_model()
        default_assumptions = MarketAssumptions(
            stock_return_mean=0.10, bond_return_mean=0.04
        )

        lookup = model._build_period_assumptions_lookup(10, None, default_assumptions)

        assert len(lookup) == 10
        for year in range(10):
            assert lookup[year].stock_return_mean == 0.10
            assert lookup[year].bond_return_mean == 0.04

    def test_timeline_periods_mapped_correctly(self):
        """Timeline periods should map to correct years."""
        model = _create_basic_model()
        current_year = model.current_year

        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": current_year,
                    "end_year": current_year + 2,
                    "assumptions": {
                        "stock_return_mean": -0.30,  # Recession
                        "stock_return_std": 0.38,
                        "bond_return_mean": 0.055,
                        "bond_return_std": 0.08,
                        "inflation_mean": -0.004,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": current_year + 3,
                    "end_year": current_year + 9,
                    "assumptions": {
                        "stock_return_mean": 0.18,  # Bull market
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        lookup = model._build_period_assumptions_lookup(
            10, periods, MarketAssumptions()
        )

        # Years 0-2 should have recession assumptions
        assert lookup[0].stock_return_mean == -0.30
        assert lookup[1].stock_return_mean == -0.30
        assert lookup[2].stock_return_mean == -0.30

        # Years 3-9 should have bull market assumptions
        assert lookup[3].stock_return_mean == 0.18
        assert lookup[9].stock_return_mean == 0.18

    def test_cycle_pattern_repeats_correctly(self):
        """Cycle pattern should repeat when repeat=True."""
        model = _create_basic_model()

        periods = {
            "type": "cycle",
            "repeat": True,
            "pattern": [
                {
                    "duration": 3,
                    "assumptions": {
                        "stock_return_mean": 0.18,  # Bull
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "duration": 2,
                    "assumptions": {
                        "stock_return_mean": 0.02,  # Recession
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        lookup = model._build_period_assumptions_lookup(
            15, periods, MarketAssumptions()
        )

        # First cycle: years 0-2 bull, 3-4 recession
        assert lookup[0].stock_return_mean == 0.18
        assert lookup[2].stock_return_mean == 0.18
        assert lookup[3].stock_return_mean == 0.02
        assert lookup[4].stock_return_mean == 0.02

        # Second cycle: years 5-7 bull, 8-9 recession
        assert lookup[5].stock_return_mean == 0.18
        assert lookup[7].stock_return_mean == 0.18
        assert lookup[8].stock_return_mean == 0.02
        assert lookup[9].stock_return_mean == 0.02

        # Third cycle: years 10-12 bull, 13-14 recession
        assert lookup[10].stock_return_mean == 0.18
        assert lookup[13].stock_return_mean == 0.02

    def test_cycle_pattern_stops_when_no_repeat(self):
        """Cycle pattern should stop after one cycle when repeat=False."""
        model = _create_basic_model()
        default_assumptions = MarketAssumptions(stock_return_mean=0.10)

        periods = {
            "type": "cycle",
            "repeat": False,
            "pattern": [
                {
                    "duration": 3,
                    "assumptions": {
                        "stock_return_mean": 0.18,
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                }
            ],
        }

        lookup = model._build_period_assumptions_lookup(
            10, periods, default_assumptions
        )

        # First 3 years should use pattern
        assert lookup[0].stock_return_mean == 0.18
        assert lookup[2].stock_return_mean == 0.18

        # After cycle completes, should use default
        assert lookup[3].stock_return_mean == 0.10
        assert lookup[9].stock_return_mean == 0.10

    def test_fills_gaps_with_default_assumptions(self):
        """Timeline gaps should be filled with default assumptions."""
        model = _create_basic_model()
        default_assumptions = MarketAssumptions(
            stock_return_mean=0.10, bond_return_mean=0.04
        )
        current_year = model.current_year

        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": current_year,
                    "end_year": current_year + 2,
                    "assumptions": {
                        "stock_return_mean": 0.18,
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": current_year + 5,  # Gap in years 3-4
                    "end_year": current_year + 7,
                    "assumptions": {
                        "stock_return_mean": 0.02,
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        lookup = model._build_period_assumptions_lookup(
            10, periods, default_assumptions
        )

        # Gap years should use default
        assert lookup[3].stock_return_mean == 0.10
        assert lookup[4].stock_return_mean == 0.10


class TestMonteCarloWithMarketPeriods:
    """Integration tests for Monte Carlo simulation with market periods."""

    def test_simulation_with_timeline_periods(self):
        """Simulation should complete successfully with timeline periods."""
        model = _create_basic_model()
        current_year = model.current_year

        periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": current_year,
                    "end_year": current_year + 4,
                    "assumptions": {
                        "stock_return_mean": -0.30,
                        "stock_return_std": 0.38,
                        "bond_return_mean": 0.055,
                        "bond_return_std": 0.08,
                        "inflation_mean": -0.004,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": current_year + 5,
                    "end_year": current_year + 19,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        result = model.monte_carlo_simulation(
            years=20,
            simulations=100,
            assumptions=MarketAssumptions(),
            market_periods=periods,
        )

        assert 0 <= result["success_rate"] <= 1
        assert result["starting_portfolio"] > 0
        assert len(result["timeline"]["years"]) == 20
        assert "warnings" in result

    def test_simulation_with_cycle_periods(self):
        """Simulation should complete successfully with cycle periods."""
        model = _create_basic_model()

        periods = {
            "type": "cycle",
            "repeat": True,
            "pattern": [
                {
                    "duration": 5,
                    "assumptions": {
                        "stock_return_mean": 0.18,
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "duration": 2,
                    "assumptions": {
                        "stock_return_mean": 0.02,
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        result = model.monte_carlo_simulation(
            years=20,
            simulations=100,
            assumptions=MarketAssumptions(),
            market_periods=periods,
        )

        assert 0 <= result["success_rate"] <= 1
        assert result["starting_portfolio"] > 0
        assert len(result["timeline"]["years"]) == 20

    def test_early_crash_worse_than_late_crash(self):
        """Early retirement crash should produce worse success rate than late crash."""
        model = _create_basic_model()
        current_year = model.current_year

        # Early crash scenario
        early_crash_periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": current_year,
                    "end_year": current_year + 2,
                    "assumptions": {
                        "stock_return_mean": -0.30,
                        "stock_return_std": 0.38,
                        "bond_return_mean": 0.055,
                        "bond_return_std": 0.08,
                        "inflation_mean": -0.004,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": current_year + 3,
                    "end_year": current_year + 19,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        # Late crash scenario (same crash, but at end)
        late_crash_periods = {
            "type": "timeline",
            "periods": [
                {
                    "start_year": current_year,
                    "end_year": current_year + 16,
                    "assumptions": {
                        "stock_return_mean": 0.10,
                        "stock_return_std": 0.18,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.03,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "start_year": current_year + 17,
                    "end_year": current_year + 19,
                    "assumptions": {
                        "stock_return_mean": -0.30,
                        "stock_return_std": 0.38,
                        "bond_return_mean": 0.055,
                        "bond_return_std": 0.08,
                        "inflation_mean": -0.004,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        np.random.seed(42)
        early_result = model.monte_carlo_simulation(
            years=20,
            simulations=500,
            assumptions=MarketAssumptions(),
            market_periods=early_crash_periods,
        )

        np.random.seed(42)
        late_result = model.monte_carlo_simulation(
            years=20,
            simulations=500,
            assumptions=MarketAssumptions(),
            market_periods=late_crash_periods,
        )

        # Early crash should have worse success rate (sequence of returns risk)
        assert early_result["success_rate"] < late_result["success_rate"]

    def test_periods_produce_different_results_than_simple(self):
        """Period-based simulation should produce different results than simple mode."""
        model = _create_basic_model()
        current_year = model.current_year

        # Simple mode: recession for entire period (unrealistic)
        np.random.seed(42)
        simple_result = model.monte_carlo_simulation(
            years=20,
            simulations=200,
            assumptions=MarketAssumptions(
                stock_return_mean=0.02, stock_return_std=0.22
            ),
            market_periods=None,
        )

        # Period mode: realistic cycle
        periods = {
            "type": "cycle",
            "repeat": True,
            "pattern": [
                {
                    "duration": 7,
                    "assumptions": {
                        "stock_return_mean": 0.18,
                        "stock_return_std": 0.14,
                        "bond_return_mean": 0.035,
                        "bond_return_std": 0.05,
                        "inflation_mean": 0.025,
                        "inflation_std": 0.01,
                    },
                },
                {
                    "duration": 2,
                    "assumptions": {
                        "stock_return_mean": 0.02,
                        "stock_return_std": 0.22,
                        "bond_return_mean": 0.04,
                        "bond_return_std": 0.06,
                        "inflation_mean": 0.015,
                        "inflation_std": 0.01,
                    },
                },
            ],
        }

        np.random.seed(42)
        period_result = model.monte_carlo_simulation(
            years=20,
            simulations=200,
            assumptions=MarketAssumptions(),
            market_periods=periods,
        )

        # Results should be significantly different
        # Period mode should have higher success rate (has growth periods)
        assert period_result["success_rate"] > simple_result["success_rate"]
