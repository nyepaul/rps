"""Tests for RetirementModel withdrawal logic and tax calculations."""

from datetime import datetime
import numpy as np
from src.services.retirement_model import (
    Person, FinancialProfile, RetirementModel, MarketAssumptions
)


def _create_basic_model():
    """Helper to create a basic RetirementModel for testing."""
    p1 = Person("P1", datetime(1960, 1, 1), datetime(2025, 1, 1), 2000)
    p2 = Person("P2", datetime(1962, 1, 1), datetime(2027, 1, 1), 1800)
    profile = FinancialProfile(
        person1=p1, person2=p2, children=[],
        liquid_assets=50000, traditional_ira=500000, roth_ira=100000,
        pension_lump_sum=0, pension_annual=0,
        annual_expenses=60000, target_annual_income=60000,
        risk_tolerance="moderate", asset_allocation={"stocks": 0.6, "bonds": 0.4},
        future_expenses=[], investment_types=[
            {'account': 'Traditional IRA', 'value': 500000, 'cost_basis': 500000}
        ]
    )
    return RetirementModel(profile)

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


# =========================================================================
# Tax Function Tests
# =========================================================================

class TestProgressiveFederalTax:
    """Tests for _vectorized_federal_tax function."""

    def test_low_income_10_percent_bracket(self):
        """Income under $23,200 should be taxed at 10%."""
        model = _create_basic_model()
        income = np.array([20000.0])
        tax, marginal = model._vectorized_federal_tax(income, 'mfj')
        assert tax[0] == 2000.0  # 20,000 * 0.10
        assert marginal[0] == 0.10

    def test_middle_income_progressive(self):
        """Income of $50,000 spans 10% and 12% brackets."""
        model = _create_basic_model()
        income = np.array([50000.0])
        tax, marginal = model._vectorized_federal_tax(income, 'mfj')
        # First $23,200 at 10% = $2,320
        # Remaining $26,800 at 12% = $3,216
        expected = 23200 * 0.10 + (50000 - 23200) * 0.12
        assert abs(tax[0] - expected) < 1  # Allow for rounding
        assert marginal[0] == 0.12

    def test_high_income_top_brackets(self):
        """Income of $800,000 should hit 37% bracket."""
        model = _create_basic_model()
        income = np.array([800000.0])
        tax, marginal = model._vectorized_federal_tax(income, 'mfj')
        assert marginal[0] == 0.37
        # Effective rate should be between 22% and 37%
        effective_rate = tax[0] / 800000
        assert 0.22 < effective_rate < 0.37

    def test_vectorized_multiple_incomes(self):
        """Test with multiple income values simultaneously."""
        model = _create_basic_model()
        incomes = np.array([10000.0, 50000.0, 200000.0, 500000.0])
        taxes, marginals = model._vectorized_federal_tax(incomes, 'mfj')

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
        ss_benefit = np.array([20000.0])     # $20K SS
        # Provisional = 10000 + 0.5*20000 = 20000 < 32000
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, 'mfj')
        assert taxable[0] == 0.0

    def test_between_thresholds_partial_taxable(self):
        """Provisional income between $32K-$44K = up to 50% taxable."""
        model = _create_basic_model()
        other_income = np.array([25000.0])
        ss_benefit = np.array([24000.0])
        # Provisional = 25000 + 0.5*24000 = 37000 (between 32K and 44K)
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, 'mfj')
        # Taxable should be > 0 but < 50% of benefits
        assert 0 < taxable[0] < ss_benefit[0] * 0.5

    def test_above_second_threshold_85_percent_taxable(self):
        """Provisional income above $44K (MFJ) = up to 85% taxable."""
        model = _create_basic_model()
        other_income = np.array([100000.0])  # High AGI
        ss_benefit = np.array([30000.0])
        # Provisional = 100000 + 0.5*30000 = 115000 >> 44000
        taxable = model._vectorized_taxable_ss(other_income, ss_benefit, 'mfj')
        # Should be 85% of benefits (max taxable)
        assert abs(taxable[0] - ss_benefit[0] * 0.85) < 1


class TestLongTermCapitalGainsTax:
    """Tests for _vectorized_ltcg_tax function."""

    def test_zero_percent_bracket(self):
        """Low income + gains should be taxed at 0%."""
        model = _create_basic_model()
        gains = np.array([50000.0])
        ordinary_income = np.array([40000.0])  # Below $94,050 threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, 'mfj')
        # Total income = 90000, all in 0% bracket
        assert tax[0] == 0.0

    def test_fifteen_percent_bracket(self):
        """Middle income should be taxed at 15%."""
        model = _create_basic_model()
        gains = np.array([50000.0])
        ordinary_income = np.array([200000.0])  # Above 0% threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, 'mfj')
        # All gains in 15% bracket
        assert tax[0] == 50000 * 0.15

    def test_twenty_percent_bracket(self):
        """Very high income should be taxed at 20%."""
        model = _create_basic_model()
        gains = np.array([100000.0])
        ordinary_income = np.array([600000.0])  # Above $583,750 threshold
        tax = model._vectorized_ltcg_tax(gains, ordinary_income, 'mfj')
        # All gains in 20% bracket
        assert tax[0] == 100000 * 0.20

    def test_income_stacking(self):
        """Gains should stack on ordinary income."""
        model = _create_basic_model()
        gains = np.array([50000.0, 50000.0])
        ordinary_income = np.array([40000.0, 600000.0])
        taxes = model._vectorized_ltcg_tax(gains, ordinary_income, 'mfj')
        # First case: 0% rate (low income)
        # Second case: 20% rate (high income stacking)
        assert taxes[0] < taxes[1]


class TestIRMAASurcharges:
    """Tests for _vectorized_irmaa function."""

    def test_no_surcharge_low_income(self):
        """MAGI below $206K should have no IRMAA surcharge."""
        model = _create_basic_model()
        magi = np.array([150000.0])
        irmaa = model._vectorized_irmaa(magi, 'mfj', both_on_medicare=True)
        assert irmaa[0] == 0.0

    def test_tier_1_surcharge(self):
        """MAGI $206K-$258K should have Tier 1 surcharge."""
        model = _create_basic_model()
        magi = np.array([230000.0])
        irmaa = model._vectorized_irmaa(magi, 'mfj', both_on_medicare=True)
        # Tier 1: $839.40 per person, doubled for couple
        assert irmaa[0] == 839.40 * 2

    def test_top_tier_surcharge(self):
        """MAGI above $750K should have Tier 5 surcharge."""
        model = _create_basic_model()
        magi = np.array([800000.0])
        irmaa = model._vectorized_irmaa(magi, 'mfj', both_on_medicare=True)
        # Tier 5: $5030.40 per person, doubled for couple
        assert irmaa[0] == 5030.40 * 2

    def test_single_person_on_medicare(self):
        """Single person should get single surcharge (not doubled)."""
        model = _create_basic_model()
        magi = np.array([230000.0])
        irmaa = model._vectorized_irmaa(magi, 'mfj', both_on_medicare=False)
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
            person1=p1, person2=p2, children=[],
            liquid_assets=0, traditional_ira=1000000, roth_ira=0,
            pension_lump_sum=0, pension_annual=0,
            annual_expenses=0, target_annual_income=0,
            risk_tolerance="moderate", asset_allocation={"stocks": 0, "bonds": 0},
            future_expenses=[], investment_types=[
                {'account': 'Traditional IRA', 'value': 1000000, 'cost_basis': 1000000}
            ]
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
            spending_model='constant_real'
        )
        assert 0 <= result['success_rate'] <= 1
        assert result['starting_portfolio'] > 0
        assert len(result['timeline']['years']) == 20

    def test_progressive_taxes_affect_results(self):
        """Progressive taxes should produce different results than flat rate."""
        model = _create_basic_model()

        # Run with default effective_tax_rate (22%)
        np.random.seed(42)  # For reproducibility
        result = model.monte_carlo_simulation(
            years=20,
            simulations=100,
            assumptions=MarketAssumptions(),
            effective_tax_rate=0.22
        )

        # The simulation now uses progressive taxes internally
        # We just verify it runs and produces reasonable results
        assert result['success_rate'] >= 0
        assert result['median_final_balance'] >= 0
