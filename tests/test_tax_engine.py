import pytest
import numpy as np
from datetime import datetime
from src.services.retirement_model import RetirementModel, FinancialProfile, Person


@pytest.fixture
def mock_profile():
    """Create a basic mock profile for initializing RetirementModel."""
    person1 = Person(
        name="Test",
        birth_date=datetime(1980, 1, 1),
        retirement_date=datetime(2045, 1, 1),
        social_security=0,
    )
    person2 = Person(
        name="Spouse",
        birth_date=datetime(1980, 1, 1),
        retirement_date=datetime(2045, 1, 1),
        social_security=0,
    )
    return FinancialProfile(
        person1=person1,
        person2=person2,
        children=[],
        liquid_assets=0,
        traditional_ira=0,
        roth_ira=0,
        pension_lump_sum=0,
        pension_annual=0,
        annual_expenses=0,
        target_annual_income=0,
        risk_tolerance="moderate",
        asset_allocation={},
        future_expenses=[],
        investment_types=[],
        accounts=[],
        income_streams=[],
        home_properties=[],
        budget={},
        filing_status="mfj",
        state="NY",
    )


class TestTaxEngine:
    """Test suite for the vectorized tax engine in RetirementModel."""

    def test_federal_tax_brackets_single_2024(self, mock_profile):
        """Test Federal Tax Brackets for Single filers (2024)."""
        mock_profile.filing_status = "single"
        model = RetirementModel(mock_profile)

        # Test cases: Income exactly at top of brackets (cumulative tax check)
        # Brackets: 10% up to 11,600 | 12% up to 47,150 | 22% up to 100,525 ...

        # Case 1: $10,000 (10% bracket) -> $1,000 tax
        income = np.array([10000.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="single")
        assert tax[0] == 1000.0
        assert rate[0] == 0.10

        # Case 2: $11,600 (Top of 10%) -> $1,160 tax
        income = np.array([11600.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="single")
        assert tax[0] == 1160.0
        assert (
            rate[0] == 0.10
        )  # Technically marginal rate is still 10% for the last dollar

        # Case 3: $47,150 (Top of 12%)
        # Tax = 1,160 (10% on 11,600) + 12% on (47,150 - 11,600 = 35,550)
        # Tax = 1,160 + 4,266 = 5,426
        income = np.array([47150.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="single")
        assert abs(tax[0] - 5426.0) < 1.0
        assert rate[0] == 0.12

        # Case 4: $100,000 (In 22% bracket)
        # Tax = 5,426 (up to 47,150) + 22% on (100,000 - 47,150 = 52,850)
        # Tax = 5,426 + 11,627 = 17,053
        income = np.array([100000.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="single")
        assert abs(tax[0] - 17053.0) < 1.0
        assert rate[0] == 0.22

    def test_federal_tax_brackets_mfj_2024(self, mock_profile):
        """Test Federal Tax Brackets for MFJ filers (2024)."""
        mock_profile.filing_status = "mfj"
        model = RetirementModel(mock_profile)

        # Brackets: 10% up to 23,200 | 12% up to 94,300 ...

        # Case 1: $20,000 (10% bracket) -> $2,000 tax
        income = np.array([20000.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="mfj")
        assert tax[0] == 2000.0

        # Case 2: $100,000 (In 22% bracket)
        # Tax = 10% on 23,200 ($2,320) + 12% on (94,300 - 23,200 = 71,100 -> $8,532)
        # + 22% on (100,000 - 94,300 = 5,700 -> $1,254)
        # Total = 2,320 + 8,532 + 1,254 = 12,106
        income = np.array([100000.0])
        tax, rate = model._vectorized_federal_tax(income, filing_status="mfj")
        assert abs(tax[0] - 12106.0) < 1.0
        assert rate[0] == 0.22

    def test_social_security_taxability_mfj(self, mock_profile):
        """Test Social Security taxability thresholds for MFJ."""
        mock_profile.filing_status = "mfj"
        model = RetirementModel(mock_profile)

        # Thresholds MFJ: 32,000 and 44,000
        # Provisional Income = Other + 0.5 * SS

        # Case 1: Low Income (0% taxable)
        # Other: 20k, SS: 20k -> Prov: 30k (< 32k)
        other_income = np.array([20000.0])
        ss_benefit = np.array([20000.0])
        taxable_ss = model._vectorized_taxable_ss(
            other_income, ss_benefit, filing_status="mfj"
        )
        assert taxable_ss[0] == 0.0

        # Case 2: Middle Income (Up to 50% taxable)
        # Other: 30k, SS: 20k -> Prov: 40k
        # Between 32k and 44k is 8k. 50% of 8k is 4k.
        # Max taxable is 50% of SS (10k). So 4k.
        other_income = np.array([30000.0])
        ss_benefit = np.array([20000.0])
        taxable_ss = model._vectorized_taxable_ss(
            other_income, ss_benefit, filing_status="mfj"
        )
        assert taxable_ss[0] == 4000.0

        # Case 3: High Income (Up to 85% taxable)
        # Other: 100k, SS: 30k -> Prov: 115k
        # Base taxable (up to 44k threshold): (44k - 32k) * 0.5 = 6k
        # Excess above 44k: 115k - 44k = 71k. 85% of 71k = 60,350
        # Total calculated: 66,350
        # BUT limited to 85% of SS Benefit: 30k * 0.85 = 25,500
        other_income = np.array([100000.0])
        ss_benefit = np.array([30000.0])
        taxable_ss = model._vectorized_taxable_ss(
            other_income, ss_benefit, filing_status="mfj"
        )
        assert taxable_ss[0] == 25500.0

    def test_ltcg_tax_stacking_single(self, mock_profile):
        """Test Long Term Capital Gains stacking and brackets for Single."""
        mock_profile.filing_status = "single"
        model = RetirementModel(mock_profile)

        # Thresholds Single: 0% up to 47,025 | 15% up to 518,900

        # Case 1: Pure LTCG within 0% bracket
        # Ordinary: 0, Gains: 40,000 -> Total 40,000 (< 47,025) -> Tax 0
        ordinary = np.array([0.0])
        gains = np.array([40000.0])
        tax = model._vectorized_ltcg_tax(gains, ordinary, filing_status="single")
        assert tax[0] == 0.0

        # Case 2: Ordinary fills 0% bucket, Gains pushed to 15%
        # Ordinary: 50,000 (> 47,025), Gains: 10,000
        # All gains sit above 50k, so all are taxed at 15%
        # Tax = 10,000 * 0.15 = 1,500
        ordinary = np.array([50000.0])
        gains = np.array([10000.0])
        tax = model._vectorized_ltcg_tax(gains, ordinary, filing_status="single")
        assert tax[0] == 1500.0

        # Case 3: Splitting the bracket
        # Ordinary: 40,000. Room in 0% bucket: 7,025
        # Gains: 10,000.
        # 7,025 taxed at 0%.
        # Remaining 2,975 taxed at 15% -> 446.25
        ordinary = np.array([40000.0])
        gains = np.array([10000.0])
        tax = model._vectorized_ltcg_tax(gains, ordinary, filing_status="single")
        assert abs(tax[0] - 446.25) < 1.0

    def test_irmaa_surcharges(self, mock_profile):
        """Test Medicare IRMAA surcharges."""
        mock_profile.filing_status = "mfj"
        model = RetirementModel(mock_profile)

        # MFJ Thresholds:
        # <= 206k: 0
        # > 206k <= 258k: Level 1

        # Case 1: Below threshold
        magi = np.array([200000.0])
        surcharge = model._vectorized_irmaa(magi, filing_status="mfj")
        assert surcharge[0] == 0.0

        # Case 2: First Tier
        # Surcharge is typically around $1k+ per person per year.
        # The code implementation might use specific 2024 constants.
        # Checking if it returns non-zero.
        magi = np.array([210000.0])
        surcharge = model._vectorized_irmaa(magi, filing_status="mfj")
        assert surcharge[0] > 0

        # Verify doubling for couple
        surcharge_single_coverage = model._vectorized_irmaa(
            magi, filing_status="mfj", both_on_medicare=False
        )
        assert abs(surcharge[0] - 2 * surcharge_single_coverage[0]) < 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
