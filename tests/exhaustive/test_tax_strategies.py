import pytest
from src.services.tax_optimization_service import (
    TaxCalculator,
    SocialSecurityAnalyzer,
    IRMAACalculator,
    RothConversionOptimizer,
)


def test_tax_calculator_deductions():
    """Test standard deduction logic including age additions."""
    calc = TaxCalculator(filing_status="mfj")
    # Under 65
    assert calc.get_standard_deduction(age=60, spouse_age=60) == 29200
    # One person 65+
    assert calc.get_standard_deduction(age=65, spouse_age=60) == 29200 + 1550
    # Both 65+
    assert calc.get_standard_deduction(age=65, spouse_age=65) == 29200 + 1550 * 2

    calc_single = TaxCalculator(filing_status="single")
    assert calc_single.get_standard_deduction(age=70) == 14600 + 1950


def test_tax_calculator_ltcg_stacking():
    """Test LTCG tax stacking on top of ordinary income."""
    calc = TaxCalculator(filing_status="mfj")
    # 2024 MFJ LTCG: 0% up to $94,050
    # If ordinary income is $50,000 and LTCG is $20,000, total is $70,000 (all 0% for LTCG)
    assert calc.calculate_ltcg_tax(capital_gains=20000, ordinary_income=50000) == 0

    # If ordinary income is $90,000 and LTCG is $10,000
    # $4,050 of LTCG at 0%
    # $5,950 of LTCG at 15%
    tax = calc.calculate_ltcg_tax(capital_gains=10000, ordinary_income=90000)
    assert abs(tax - (5950 * 0.15)) < 1.0


def test_ss_taxability_analyzer():
    """Test Social Security taxation thresholds."""
    analyzer = SocialSecurityAnalyzer(filing_status="mfj")
    # MFJ: $32k / $44k
    # AGI=20k, SS=20k => Prov=30k (< 32k)
    taxable, pct = analyzer.calculate_taxable_ss(agi=20000, ss_benefit=20000)
    assert taxable == 0
    assert pct == 0

    # AGI=100k, SS=40k => Prov=120k (> 44k)
    taxable, pct = analyzer.calculate_taxable_ss(agi=100000, ss_benefit=40000)
    assert taxable == 40000 * 0.85
    assert pct == 0.85


def test_irmaa_surcharges():
    """Test IRMAA surcharge calculations."""
    calc = IRMAACalculator(filing_status="single")
    # Single 2024: Tier 1 starts at $103,000
    surcharge, tier, info = calc.calculate_surcharge(magi=100000)
    assert surcharge == 0
    assert tier == 0

    surcharge, tier, info = calc.calculate_surcharge(magi=110000)
    assert surcharge > 0
    assert tier == 1
    assert info["room_to_next"] == 129000 - 110000


def test_roth_conversion_bracket_space():
    """Test calculation of available tax bracket space."""
    calc = TaxCalculator(filing_status="mfj")
    irmaa = IRMAACalculator(filing_status="mfj")
    optimizer = RothConversionOptimizer(calc, irmaa)

    # MFJ 12% bracket ends at $94,300
    # If taxable income is $50,000, space in 12% is $44,300
    space = optimizer.calculate_bracket_space(current_taxable_income=50000)
    # Find the 12% bracket entry
    entry = next(s for s in space if s["bracket"] == "12%")
    assert abs(entry["space_available"] - 44300) < 1.0
