"""Tax optimization service for analyzing tax strategies.

Provides comprehensive tax analysis including:
- Federal and state income tax calculations
- Social Security taxation analysis
- Roth conversion optimization
- IRMAA threshold calculations
- Capital gains management
- RMD projections

Authored by: pan
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date
import math


# 2024 Federal Tax Brackets (Married Filing Jointly)
FEDERAL_BRACKETS_MFJ_2024 = [
    (0, 23200, 0.10),
    (23200, 94300, 0.12),
    (94300, 201050, 0.22),
    (201050, 383900, 0.24),
    (383900, 487450, 0.32),
    (487450, 731200, 0.35),
    (731200, float('inf'), 0.37),
]

# 2024 Federal Tax Brackets (Single)
FEDERAL_BRACKETS_SINGLE_2024 = [
    (0, 11600, 0.10),
    (11600, 47150, 0.12),
    (47150, 100525, 0.22),
    (100525, 191950, 0.24),
    (191950, 243725, 0.32),
    (243725, 609350, 0.35),
    (609350, float('inf'), 0.37),
]

# 2024 Federal Tax Brackets (Married Filing Separately)
FEDERAL_BRACKETS_MFS_2024 = [
    (0, 11600, 0.10),
    (11600, 47150, 0.12),
    (47150, 100525, 0.22),
    (100525, 191950, 0.24),
    (191950, 243725, 0.32),
    (243725, 365600, 0.35),
    (365600, float('inf'), 0.37),
]

# 2024 Federal Tax Brackets (Head of Household)
FEDERAL_BRACKETS_HOH_2024 = [
    (0, 16550, 0.10),
    (16550, 63100, 0.12),
    (63100, 100500, 0.22),
    (100500, 191950, 0.24),
    (191950, 243700, 0.32),
    (243700, 609350, 0.35),
    (609350, float('inf'), 0.37),
]

# Standard Deductions 2024
STANDARD_DEDUCTIONS_2024 = {
    'single': 14600,
    'mfj': 29200,
    'mfs': 14600,
    'hoh': 21900,
}

# Additional deduction for age 65+
ADDITIONAL_DEDUCTION_65_PLUS = {
    'single': 1950,
    'mfj': 1550,  # Per person
    'mfs': 1550,
    'hoh': 1950,
}

# Long-term Capital Gains Brackets 2024 (MFJ)
LTCG_BRACKETS_MFJ_2024 = [
    (0, 94050, 0.0),
    (94050, 583750, 0.15),
    (583750, float('inf'), 0.20),
]

# Long-term Capital Gains Brackets 2024 (Single)
LTCG_BRACKETS_SINGLE_2024 = [
    (0, 47025, 0.0),
    (47025, 518900, 0.15),
    (518900, float('inf'), 0.20),
]

# IRMAA Thresholds 2024 (based on 2022 income)
IRMAA_THRESHOLDS_MFJ_2024 = [
    (0, 206000, 0),           # No surcharge
    (206000, 258000, 839.40),   # Tier 1: $69.90/month * 12
    (258000, 322000, 2097.60),  # Tier 2: $174.80/month * 12
    (322000, 386000, 3355.20),  # Tier 3: $279.60/month * 12
    (386000, 750000, 4612.80),  # Tier 4: $384.40/month * 12
    (750000, float('inf'), 5030.40),  # Tier 5: $419.20/month * 12
]

IRMAA_THRESHOLDS_SINGLE_2024 = [
    (0, 103000, 0),
    (103000, 129000, 839.40),
    (129000, 161000, 2097.60),
    (161000, 193000, 3355.20),
    (193000, 500000, 4612.80),
    (500000, float('inf'), 5030.40),
]

# Social Security Taxation Thresholds (Combined Income = AGI + 50% SS + Tax-exempt interest)
SS_TAXATION_THRESHOLDS_MFJ = [
    (0, 32000, 0.0),      # 0% of SS taxable
    (32000, 44000, 0.50),  # Up to 50% taxable
    (44000, float('inf'), 0.85),  # Up to 85% taxable
]

SS_TAXATION_THRESHOLDS_SINGLE = [
    (0, 25000, 0.0),
    (25000, 34000, 0.50),
    (34000, float('inf'), 0.85),
]

# State income tax rates (simplified - top marginal rate)
STATE_TAX_RATES = {
    'AL': 0.05, 'AK': 0.0, 'AZ': 0.025, 'AR': 0.047, 'CA': 0.1230,
    'CO': 0.044, 'CT': 0.0699, 'DE': 0.066, 'FL': 0.0, 'GA': 0.055,
    'HI': 0.11, 'ID': 0.058, 'IL': 0.0495, 'IN': 0.0315, 'IA': 0.057,
    'KS': 0.057, 'KY': 0.04, 'LA': 0.0425, 'ME': 0.0715, 'MD': 0.0575,
    'MA': 0.05, 'MI': 0.0425, 'MN': 0.0985, 'MS': 0.05, 'MO': 0.048,
    'MT': 0.0575, 'NE': 0.0584, 'NV': 0.0, 'NH': 0.0, 'NJ': 0.1075,
    'NM': 0.059, 'NY': 0.109, 'NC': 0.0475, 'ND': 0.025, 'OH': 0.035,
    'OK': 0.0475, 'OR': 0.099, 'PA': 0.0307, 'RI': 0.0599, 'SC': 0.064,
    'SD': 0.0, 'TN': 0.0, 'TX': 0.0, 'UT': 0.0465, 'VT': 0.0875,
    'VA': 0.0575, 'WA': 0.0, 'WV': 0.055, 'WI': 0.0765, 'WY': 0.0,
    'DC': 0.1075,
}

# States with no income tax
NO_INCOME_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']

# RMD Life Expectancy Table (Uniform Lifetime Table - age -> divisor)
RMD_UNIFORM_TABLE = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
    79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
    86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
    93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
    100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
    107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
    114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}


@dataclass
class TaxSettings:
    """User's tax settings."""
    filing_status: str = 'mfj'  # single, mfj, mfs, hoh
    state: str = 'CA'
    age: int = 65
    spouse_age: int = 65


@dataclass
class TaxSnapshot:
    """Current tax situation snapshot."""
    federal_tax: float
    state_tax: float
    total_tax: float
    effective_rate: float
    marginal_rate: float
    bracket_breakdown: List[Dict]
    irmaa_surcharge: float
    social_security_taxable_pct: float
    capital_gains_tax: float


class TaxCalculator:
    """Calculates federal and state taxes."""

    def __init__(self, filing_status: str = 'mfj', state: str = 'CA'):
        self.filing_status = filing_status.lower()
        self.state = state.upper()

    def get_brackets(self) -> List[Tuple[float, float, float]]:
        """Get federal tax brackets based on filing status."""
        if self.filing_status == 'single':
            return FEDERAL_BRACKETS_SINGLE_2024
        elif self.filing_status == 'mfs':
            return FEDERAL_BRACKETS_MFS_2024
        elif self.filing_status == 'hoh':
            return FEDERAL_BRACKETS_HOH_2024
        else:  # mfj
            return FEDERAL_BRACKETS_MFJ_2024

    def get_standard_deduction(self, age: int = 65, spouse_age: int = 65) -> float:
        """Calculate standard deduction including age-based additions."""
        base = STANDARD_DEDUCTIONS_2024.get(self.filing_status, 29200)
        additional = 0

        # Add additional deduction for 65+
        additional_per_person = ADDITIONAL_DEDUCTION_65_PLUS.get(self.filing_status, 1550)

        if age >= 65:
            additional += additional_per_person

        if self.filing_status in ['mfj', 'mfs'] and spouse_age >= 65:
            additional += additional_per_person

        return base + additional

    def calculate_federal_tax(self, taxable_income: float) -> Tuple[float, List[Dict], float]:
        """
        Calculate federal income tax.

        Returns:
            Tuple of (total_tax, bracket_breakdown, marginal_rate)
        """
        brackets = self.get_brackets()
        total_tax = 0.0
        breakdown = []
        marginal_rate = 0.10
        remaining_income = taxable_income

        for lower, upper, rate in brackets:
            if remaining_income <= 0:
                break

            bracket_income = min(remaining_income, upper - lower)
            if lower < taxable_income:
                bracket_tax = bracket_income * rate
                total_tax += bracket_tax
                marginal_rate = rate

                if bracket_income > 0:
                    breakdown.append({
                        'bracket': f'{int(rate * 100)}%',
                        'range': f'${lower:,.0f} - ${upper:,.0f}' if upper < float('inf') else f'${lower:,.0f}+',
                        'income_in_bracket': bracket_income,
                        'tax': bracket_tax,
                    })

                remaining_income -= bracket_income

        return total_tax, breakdown, marginal_rate

    def calculate_state_tax(self, taxable_income: float) -> float:
        """Calculate state income tax (simplified flat rate approximation)."""
        rate = STATE_TAX_RATES.get(self.state, 0.05)
        return taxable_income * rate

    def calculate_ltcg_tax(self, capital_gains: float, ordinary_income: float) -> float:
        """Calculate long-term capital gains tax."""
        if self.filing_status == 'single':
            brackets = LTCG_BRACKETS_SINGLE_2024
        else:
            brackets = LTCG_BRACKETS_MFJ_2024

        # LTCG is stacked on top of ordinary income
        total_income = ordinary_income + capital_gains
        tax = 0.0

        for lower, upper, rate in brackets:
            if total_income <= lower:
                break

            # Calculate how much of the gains falls in this bracket
            bracket_start = max(lower, ordinary_income)
            bracket_end = min(upper, total_income)

            if bracket_end > bracket_start:
                gains_in_bracket = min(capital_gains, bracket_end - bracket_start)
                tax += gains_in_bracket * rate

        return tax


class SocialSecurityAnalyzer:
    """Analyzes Social Security taxation and claiming strategies."""

    def __init__(self, filing_status: str = 'mfj'):
        self.filing_status = filing_status.lower()

    def calculate_taxable_ss(self, agi: float, ss_benefit: float, tax_exempt_interest: float = 0) -> Tuple[float, float]:
        """
        Calculate taxable portion of Social Security benefits.

        Returns:
            Tuple of (taxable_ss_amount, taxable_percentage)
        """
        # Provisional income = AGI + 50% of SS + tax-exempt interest
        provisional_income = agi + (ss_benefit * 0.5) + tax_exempt_interest

        if self.filing_status == 'single' or self.filing_status == 'hoh':
            threshold_1 = 25000  # Below: 0% taxable
            threshold_2 = 34000  # Above: up to 85% taxable
        else:
            threshold_1 = 32000  # MFJ
            threshold_2 = 44000  # MFJ

        # Implement correct IRS formula
        taxable_amount = 0.0

        if provisional_income <= threshold_1:
            # Below first threshold: 0% taxable
            taxable_amount = 0.0
        elif provisional_income <= threshold_2:
            # Between thresholds: up to 50% of SS is taxable
            # Lesser of (50% of SS) or (50% of excess over threshold_1)
            excess_1 = provisional_income - threshold_1
            taxable_amount = min(ss_benefit * 0.5, excess_1 * 0.5)
        else:
            # Above second threshold: up to 85% of SS is taxable
            # Calculate base amount from middle tier
            base_taxable = (threshold_2 - threshold_1) * 0.5  # 50% of middle tier
            # Add 85% of excess above threshold_2
            excess_2 = provisional_income - threshold_2
            additional = excess_2 * 0.85
            # Lesser of 85% of SS, or base + additional
            max_85 = ss_benefit * 0.85
            taxable_amount = min(max_85, base_taxable + additional)

        taxable_pct = (taxable_amount / ss_benefit) if ss_benefit > 0 else 0.0
        return taxable_amount, taxable_pct

    def analyze_claiming_ages(self, full_retirement_age: int, pia_at_fra: float,
                              life_expectancy: int = 90) -> List[Dict]:
        """
        Analyze different claiming ages and their lifetime benefit.

        Args:
            full_retirement_age: FRA (typically 67 for those born 1960+)
            pia_at_fra: Primary Insurance Amount at FRA (monthly)
            life_expectancy: Expected age of death

        Returns:
            List of claiming age analyses
        """
        analyses = []

        for claim_age in range(62, 71):
            # Calculate monthly benefit based on claiming age
            if claim_age < full_retirement_age:
                # Early claiming reduction
                months_early = (full_retirement_age - claim_age) * 12
                if months_early <= 36:
                    reduction = months_early * (5/9) * 0.01
                else:
                    reduction = 36 * (5/9) * 0.01 + (months_early - 36) * (5/12) * 0.01
                monthly_benefit = pia_at_fra * (1 - reduction)
            elif claim_age > full_retirement_age:
                # Delayed credits (8% per year)
                years_delayed = claim_age - full_retirement_age
                monthly_benefit = pia_at_fra * (1 + 0.08 * years_delayed)
            else:
                monthly_benefit = pia_at_fra

            # Calculate lifetime benefit
            years_receiving = life_expectancy - claim_age
            lifetime_benefit = monthly_benefit * 12 * years_receiving

            analyses.append({
                'claiming_age': claim_age,
                'monthly_benefit': round(monthly_benefit, 2),
                'annual_benefit': round(monthly_benefit * 12, 2),
                'lifetime_benefit': round(lifetime_benefit, 2),
                'years_receiving': years_receiving,
                'vs_fra_pct': round((monthly_benefit / pia_at_fra - 1) * 100, 1),
            })

        # Find breakeven ages
        for i, analysis in enumerate(analyses):
            if i > 0:
                prev = analyses[i - 1]
                # Calculate when waiting pays off
                if analysis['monthly_benefit'] > prev['monthly_benefit']:
                    monthly_diff = analysis['monthly_benefit'] - prev['monthly_benefit']
                    annual_diff = monthly_diff * 12
                    lost_benefits = prev['annual_benefit']  # One year of waiting
                    breakeven_years = lost_benefits / annual_diff if annual_diff > 0 else 999
                    analysis['breakeven_age'] = round(analysis['claiming_age'] + breakeven_years, 1)

        return analyses


class IRMAACalculator:
    """Calculates IRMAA (Income-Related Monthly Adjustment Amount) surcharges."""

    def __init__(self, filing_status: str = 'mfj'):
        self.filing_status = filing_status.lower()

    def get_thresholds(self) -> List[Tuple[float, float, float]]:
        """Get IRMAA thresholds based on filing status."""
        if self.filing_status == 'single' or self.filing_status == 'hoh':
            return IRMAA_THRESHOLDS_SINGLE_2024
        else:
            return IRMAA_THRESHOLDS_MFJ_2024

    def calculate_surcharge(self, magi: float) -> Tuple[float, int, Dict]:
        """
        Calculate IRMAA surcharge.

        Returns:
            Tuple of (annual_surcharge, tier, threshold_info)
        """
        thresholds = self.get_thresholds()
        surcharge = 0.0
        tier = 0
        threshold_info = {}

        for i, (lower, upper, annual_surcharge) in enumerate(thresholds):
            if magi > lower and magi <= upper:
                surcharge = annual_surcharge
                tier = i
                threshold_info = {
                    'current_tier': tier,
                    'current_threshold': lower,
                    'next_threshold': upper if upper < float('inf') else None,
                    'room_to_next': upper - magi if upper < float('inf') else None,
                }
                break
            elif magi > upper:
                continue
            else:
                threshold_info = {
                    'current_tier': tier,
                    'current_threshold': lower,
                    'next_threshold': upper if upper < float('inf') else None,
                    'room_to_next': upper - magi if upper < float('inf') else None,
                }
                break

        return surcharge, tier, threshold_info


class RothConversionOptimizer:
    """Optimizes Roth conversion strategies."""

    def __init__(self, calculator: TaxCalculator, irmaa_calc: IRMAACalculator):
        self.calculator = calculator
        self.irmaa_calc = irmaa_calc

    def calculate_bracket_space(self, current_taxable_income: float) -> List[Dict]:
        """
        Calculate available space in each tax bracket for Roth conversions.
        """
        brackets = self.calculator.get_brackets()
        space_analysis = []

        for lower, upper, rate in brackets:
            if upper == float('inf'):
                continue  # Skip the unbounded top bracket

            if current_taxable_income < upper:
                space = upper - max(current_taxable_income, lower)
                if space > 0:
                    space_analysis.append({
                        'bracket': f'{int(rate * 100)}%',
                        'bracket_range': f'${lower:,.0f} - ${upper:,.0f}',
                        'space_available': space,
                        'tax_on_full_space': space * rate,
                    })

        return space_analysis

    def analyze_conversion_amount(self, current_taxable_income: float,
                                  traditional_balance: float,
                                  conversion_amount: float) -> Dict:
        """
        Analyze the tax impact of a specific Roth conversion amount.
        """
        # Current tax without conversion
        current_tax, _, current_marginal = self.calculator.calculate_federal_tax(current_taxable_income)

        # Tax with conversion
        new_taxable = current_taxable_income + conversion_amount
        new_tax, breakdown, new_marginal = self.calculator.calculate_federal_tax(new_taxable)

        # IRMAA impact
        current_irmaa, _, _ = self.irmaa_calc.calculate_surcharge(current_taxable_income)
        new_irmaa, new_tier, irmaa_info = self.irmaa_calc.calculate_surcharge(new_taxable)

        conversion_tax = new_tax - current_tax
        irmaa_increase = new_irmaa - current_irmaa
        total_cost = conversion_tax + irmaa_increase

        return {
            'conversion_amount': conversion_amount,
            'current_taxable_income': current_taxable_income,
            'new_taxable_income': new_taxable,
            'current_marginal_rate': current_marginal,
            'new_marginal_rate': new_marginal,
            'conversion_tax': round(conversion_tax, 2),
            'irmaa_increase': round(irmaa_increase, 2),
            'total_cost': round(total_cost, 2),
            'effective_rate_on_conversion': round((total_cost / conversion_amount) * 100, 2) if conversion_amount > 0 else 0,
            'traditional_balance_after': traditional_balance - conversion_amount,
            'irmaa_tier': new_tier,
            'bracket_breakdown': breakdown,
        }

    def find_optimal_conversion(self, current_taxable_income: float,
                                traditional_balance: float,
                                max_rate: float = 0.24) -> Dict:
        """
        Find optimal Roth conversion amount to stay within target marginal rate.

        Args:
            current_taxable_income: Current taxable income before conversion
            traditional_balance: Balance available for conversion
            max_rate: Maximum marginal rate willing to pay (default 24%)

        Returns:
            Optimal conversion analysis
        """
        brackets = self.calculator.get_brackets()

        # Find the target bracket ceiling
        target_ceiling = 0
        for lower, upper, rate in brackets:
            if rate <= max_rate:
                target_ceiling = upper
            else:
                break

        # Calculate optimal conversion
        if current_taxable_income >= target_ceiling:
            optimal_amount = 0
        else:
            optimal_amount = min(
                target_ceiling - current_taxable_income,
                traditional_balance
            )

        return self.analyze_conversion_amount(
            current_taxable_income,
            traditional_balance,
            optimal_amount
        )


class RMDCalculator:
    """Calculates Required Minimum Distributions."""

    @staticmethod
    def calculate_rmd(age: int, account_balance: float) -> Dict:
        """
        Calculate RMD for a given age and account balance.

        Args:
            age: Current age (RMD starts at 73)
            account_balance: End of prior year balance

        Returns:
            RMD calculation details
        """
        if age < 73:
            return {
                'required': False,
                'age': age,
                'rmd_amount': 0,
                'divisor': None,
                'message': f'RMDs begin at age 73. You have {73 - age} years before RMDs start.',
            }

        divisor = RMD_UNIFORM_TABLE.get(age, 2.0)  # Default to 2.0 for ages > 120
        rmd_amount = account_balance / divisor

        return {
            'required': True,
            'age': age,
            'account_balance': account_balance,
            'divisor': divisor,
            'rmd_amount': round(rmd_amount, 2),
            'rmd_as_percentage': round((rmd_amount / account_balance) * 100, 2) if account_balance > 0 else 0,
        }

    @staticmethod
    def project_rmds(current_age: int, current_balance: float,
                     growth_rate: float = 0.05, years: int = 20) -> List[Dict]:
        """
        Project RMDs over multiple years.

        Args:
            current_age: Current age
            current_balance: Current account balance
            growth_rate: Assumed annual growth rate
            years: Number of years to project

        Returns:
            List of yearly RMD projections
        """
        projections = []
        balance = current_balance

        for year in range(years):
            age = current_age + year

            # Calculate RMD if applicable
            if age >= 73:
                divisor = RMD_UNIFORM_TABLE.get(age, 2.0)
                rmd = balance / divisor
            else:
                rmd = 0
                divisor = None

            projections.append({
                'year': year + 1,
                'age': age,
                'start_balance': round(balance, 2),
                'rmd_amount': round(rmd, 2),
                'divisor': divisor,
                'rmd_required': age >= 73,
            })

            # Update balance for next year (growth minus RMD)
            balance = (balance - rmd) * (1 + growth_rate)

        return projections


class TaxOptimizationService:
    """Main service for comprehensive tax optimization analysis."""

    def __init__(self, filing_status: str = 'mfj', state: str = 'CA',
                 age: int = 65, spouse_age: int = 65):
        self.settings = TaxSettings(
            filing_status=filing_status.lower(),
            state=state.upper(),
            age=age,
            spouse_age=spouse_age
        )
        self.calculator = TaxCalculator(filing_status, state)
        self.ss_analyzer = SocialSecurityAnalyzer(filing_status)
        self.irmaa_calc = IRMAACalculator(filing_status)
        self.roth_optimizer = RothConversionOptimizer(self.calculator, self.irmaa_calc)

    def calculate_tax_snapshot(self, gross_income: float,
                               social_security: float = 0,
                               capital_gains: float = 0,
                               deductions: float = 0) -> Dict:
        """
        Calculate current tax snapshot.

        Args:
            gross_income: Total gross income (excluding SS)
            social_security: Annual Social Security benefits
            capital_gains: Long-term capital gains
            deductions: Itemized deductions (0 to use standard)
        """
        # Calculate taxable Social Security
        taxable_ss, ss_taxable_pct = self.ss_analyzer.calculate_taxable_ss(
            gross_income, social_security
        )

        # Calculate AGI
        agi = gross_income + taxable_ss

        # Apply deductions
        standard_deduction = self.calculator.get_standard_deduction(
            self.settings.age, self.settings.spouse_age
        )
        actual_deduction = max(deductions, standard_deduction)

        # Taxable income (ordinary)
        taxable_income = max(0, agi - actual_deduction)

        # Federal tax on ordinary income
        federal_tax, bracket_breakdown, marginal_rate = self.calculator.calculate_federal_tax(
            taxable_income
        )

        # Capital gains tax
        ltcg_tax = self.calculator.calculate_ltcg_tax(capital_gains, taxable_income)

        # State tax (simplified)
        state_tax = self.calculator.calculate_state_tax(taxable_income + capital_gains)

        # IRMAA - Use MAGI (AGI + tax-exempt interest + excluded foreign income)
        # For most retirees, MAGI ≈ AGI since they don't have tax-exempt interest or foreign income
        # IMPORTANT: Use taxable_ss (not total SS) since AGI already includes only taxable portion
        magi = agi + capital_gains  # AGI already includes taxable SS and other income
        irmaa_surcharge, irmaa_tier, irmaa_info = self.irmaa_calc.calculate_surcharge(magi)

        # Total tax
        total_tax = federal_tax + ltcg_tax + state_tax + irmaa_surcharge

        # Effective rate
        total_income = gross_income + social_security + capital_gains
        effective_rate = (total_tax / total_income) * 100 if total_income > 0 else 0

        return {
            'summary': {
                'gross_income': gross_income,
                'social_security': social_security,
                'social_security_taxable': round(taxable_ss, 2),
                'social_security_taxable_pct': round(ss_taxable_pct * 100, 1),
                'capital_gains': capital_gains,
                'agi': round(agi, 2),
                'deduction_used': round(actual_deduction, 2),
                'deduction_type': 'itemized' if deductions > standard_deduction else 'standard',
                'taxable_income': round(taxable_income, 2),
            },
            'taxes': {
                'federal_tax': round(federal_tax, 2),
                'capital_gains_tax': round(ltcg_tax, 2),
                'state_tax': round(state_tax, 2),
                'irmaa_surcharge': round(irmaa_surcharge, 2),
                'total_tax': round(total_tax, 2),
            },
            'rates': {
                'marginal_rate': round(marginal_rate * 100, 1),
                'effective_rate': round(effective_rate, 2),
                'state_rate': round(STATE_TAX_RATES.get(self.settings.state, 0) * 100, 2),
            },
            'bracket_breakdown': bracket_breakdown,
            'irmaa': {
                'tier': irmaa_tier,
                'annual_surcharge': round(irmaa_surcharge, 2),
                **irmaa_info,
            },
            'settings': {
                'filing_status': self.settings.filing_status,
                'state': self.settings.state,
                'age': self.settings.age,
                'spouse_age': self.settings.spouse_age,
            },
        }

    def analyze_roth_conversion(self, current_taxable_income: float,
                                traditional_balance: float,
                                conversion_amounts: List[float] = None) -> Dict:
        """
        Analyze Roth conversion scenarios.
        """
        if conversion_amounts is None:
            # Default amounts to analyze
            conversion_amounts = [10000, 25000, 50000, 75000, 100000]

        # Bracket space analysis
        bracket_space = self.roth_optimizer.calculate_bracket_space(current_taxable_income)

        # Analyze each conversion amount
        scenarios = []
        for amount in conversion_amounts:
            if amount <= traditional_balance:
                analysis = self.roth_optimizer.analyze_conversion_amount(
                    current_taxable_income, traditional_balance, amount
                )
                scenarios.append(analysis)

        # Find optimal conversion
        optimal = self.roth_optimizer.find_optimal_conversion(
            current_taxable_income, traditional_balance
        )

        return {
            'current_taxable_income': current_taxable_income,
            'traditional_balance': traditional_balance,
            'bracket_space': bracket_space,
            'scenarios': scenarios,
            'optimal_24pct': optimal,
            'recommendation': self._get_roth_recommendation(optimal, bracket_space),
        }

    def analyze_social_security(self, pia_at_fra: float,
                                current_age: int,
                                full_retirement_age: int = 67,
                                life_expectancy: int = 90) -> Dict:
        """
        Analyze Social Security claiming strategies.
        """
        analyses = self.ss_analyzer.analyze_claiming_ages(
            full_retirement_age, pia_at_fra, life_expectancy
        )

        # Find optimal claiming age (highest lifetime benefit)
        optimal = max(analyses, key=lambda x: x['lifetime_benefit'])

        # Early vs late analysis
        early = next((a for a in analyses if a['claiming_age'] == 62), None)
        fra = next((a for a in analyses if a['claiming_age'] == full_retirement_age), None)
        late = next((a for a in analyses if a['claiming_age'] == 70), None)

        return {
            'pia_at_fra': pia_at_fra,
            'full_retirement_age': full_retirement_age,
            'current_age': current_age,
            'life_expectancy': life_expectancy,
            'analyses': analyses,
            'optimal': optimal,
            'comparison': {
                'early_62': early,
                'fra': fra,
                'delayed_70': late,
            },
            'recommendation': self._get_ss_recommendation(optimal, current_age, life_expectancy),
        }

    def analyze_rmd(self, age: int, traditional_balance: float,
                    growth_rate: float = 0.05) -> Dict:
        """
        Analyze RMD situation and projections.
        """
        current_rmd = RMDCalculator.calculate_rmd(age, traditional_balance)
        projections = RMDCalculator.project_rmds(age, traditional_balance, growth_rate)

        # Calculate total RMDs over projection period
        total_rmds = sum(p['rmd_amount'] for p in projections)

        return {
            'current': current_rmd,
            'projections': projections,
            'summary': {
                'total_projected_rmds': round(total_rmds, 2),
                'years_until_rmd': max(0, 73 - age),
                'current_balance': traditional_balance,
            },
            'qcd_eligible': age >= 70.5,
            'qcd_annual_limit': 105000,  # 2024 limit
            'recommendation': self._get_rmd_recommendation(current_rmd, age),
        }

    def compare_states(self, taxable_income: float) -> List[Dict]:
        """
        Compare tax burden across states.
        """
        comparisons = []

        for state, rate in sorted(STATE_TAX_RATES.items(), key=lambda x: x[1]):
            state_tax = taxable_income * rate
            comparisons.append({
                'state': state,
                'rate': round(rate * 100, 2),
                'estimated_tax': round(state_tax, 2),
                'no_income_tax': state in NO_INCOME_TAX_STATES,
            })

        # Calculate savings vs current state
        current_tax = taxable_income * STATE_TAX_RATES.get(self.settings.state, 0)
        for comp in comparisons:
            comp['savings_vs_current'] = round(current_tax - comp['estimated_tax'], 2)

        return comparisons

    def get_comprehensive_analysis(self, profile_data: Dict) -> Dict:
        """
        Run comprehensive tax analysis on a profile.
        """
        # Extract data from profile
        financial = profile_data.get('financial', {})
        assets = profile_data.get('assets', {})
        tax_settings = profile_data.get('tax_settings', {})

        # Get income components
        gross_income = financial.get('annual_income', 0) or 0
        ss_benefit = (financial.get('social_security_benefit', 0) or 0) * 12  # Monthly to annual
        pension = (financial.get('pension_benefit', 0) or 0) * 12

        # NOTE: Don't re-read filing_status/state from tax_settings
        # The route already resolved these from address/tax_settings with proper fallback
        # and passed them to __init__, so just use the already-configured self.settings

        # Get age for RMD calculations (use from self.settings which was set in __init__)
        age = self.settings.age
        spouse_age = self.settings.spouse_age

        # Calculate traditional IRA balance
        traditional_balance = sum(
            a.get('value', 0) for a in assets.get('retirement_accounts', [])
            if 'traditional' in a.get('type', '').lower() or '401k' in a.get('type', '').lower()
        )

        # Get tax snapshot
        total_income = gross_income + pension
        snapshot = self.calculate_tax_snapshot(
            gross_income=total_income,
            social_security=ss_benefit,
        )

        # Get Roth conversion analysis
        roth_analysis = self.analyze_roth_conversion(
            current_taxable_income=snapshot['summary']['taxable_income'],
            traditional_balance=traditional_balance,
        )

        # Get RMD analysis
        rmd_analysis = self.analyze_rmd(age, traditional_balance)

        # Get state comparison
        state_comparison = self.compare_states(snapshot['summary']['taxable_income'])

        # Generate prioritized recommendations
        recommendations = self._generate_recommendations(
            snapshot, roth_analysis, rmd_analysis, state_comparison
        )

        return {
            'snapshot': snapshot,
            'roth_conversion': roth_analysis,
            'rmd_analysis': rmd_analysis,
            'state_comparison': state_comparison[:10],  # Top 10 states
            'recommendations': recommendations,
        }

    def _get_roth_recommendation(self, optimal: Dict, bracket_space: List[Dict]) -> str:
        """Generate Roth conversion recommendation."""
        if optimal['conversion_amount'] == 0:
            return "You're already at your target marginal rate. Consider conversions only if you expect higher rates in the future."

        amount = optimal['conversion_amount']
        rate = optimal['new_marginal_rate'] * 100

        return f"Consider converting ${amount:,.0f} to stay within the {rate:.0f}% bracket. Tax cost: ${optimal['conversion_tax']:,.0f}"

    def _get_ss_recommendation(self, optimal: Dict, current_age: int, life_expectancy: int) -> str:
        """Generate Social Security recommendation."""
        if current_age >= 70:
            return "You should be claiming Social Security now if you haven't already."

        claim_age = optimal['claiming_age']
        benefit = optimal['monthly_benefit']

        if life_expectancy >= 85:
            return f"With life expectancy of {life_expectancy}, delaying to age {claim_age} maximizes lifetime benefits (${benefit:,.0f}/month)."
        else:
            return f"Consider your health and financial needs. Earlier claiming may be appropriate if concerned about longevity."

    def _get_rmd_recommendation(self, rmd: Dict, age: int) -> str:
        """Generate RMD recommendation."""
        if not rmd['required']:
            years_until = 73 - age
            return f"Consider Roth conversions during the next {years_until} years before RMDs begin to reduce future required distributions."

        amount = rmd['rmd_amount']
        if age >= 70.5:
            return f"Your RMD is ${amount:,.0f}. Consider using QCDs (up to $105,000) to satisfy RMDs while reducing taxable income."

        return f"Your required RMD is ${amount:,.0f}. Ensure this is withdrawn by December 31st."

    def _generate_recommendations(self, snapshot: Dict, roth: Dict,
                                  rmd: Dict, states: List[Dict]) -> List[Dict]:
        """Generate prioritized list of tax optimization recommendations."""
        recommendations = []

        # Check for Roth conversion opportunity
        if roth['optimal_24pct']['conversion_amount'] > 0:
            recommendations.append({
                'priority': 1,
                'category': 'Roth Conversion',
                'title': 'Tax Bracket Optimization',
                'description': f"Convert ${roth['optimal_24pct']['conversion_amount']:,.0f} from Traditional to Roth IRA",
                'impact': f"Tax cost: ${roth['optimal_24pct']['conversion_tax']:,.0f} at {roth['optimal_24pct']['effective_rate_on_conversion']:.1f}% effective rate",
                'action': 'Consider conversion before year-end',
            })

        # Check IRMAA threshold
        irmaa = snapshot['irmaa']
        if irmaa.get('room_to_next') and irmaa['room_to_next'] < 20000:
            recommendations.append({
                'priority': 2,
                'category': 'IRMAA',
                'title': 'Medicare Premium Warning',
                'description': f"You're ${irmaa['room_to_next']:,.0f} away from the next IRMAA tier",
                'impact': 'Could increase Medicare premiums by ~$1,000+/year',
                'action': 'Monitor income to avoid crossing threshold',
            })

        # Check for RMD opportunity
        if not rmd['current']['required'] and rmd['summary']['years_until_rmd'] <= 8:
            recommendations.append({
                'priority': 3,
                'category': 'RMD Planning',
                'title': 'Pre-RMD Conversion Window',
                'description': f"{rmd['summary']['years_until_rmd']} years until RMDs begin",
                'impact': 'Opportunity to reduce future RMDs through Roth conversions',
                'action': 'Maximize conversions in lower brackets before RMDs start',
            })

        # Check for QCD opportunity
        if rmd['qcd_eligible'] and rmd['current']['required']:
            recommendations.append({
                'priority': 4,
                'category': 'Charitable Giving',
                'title': 'Qualified Charitable Distribution',
                'description': f"Use QCDs to satisfy ${rmd['current']['rmd_amount']:,.0f} RMD",
                'impact': 'Reduce taxable income while fulfilling charitable goals',
                'action': 'Direct RMD to qualified charities (up to $105,000)',
            })

        # Check state tax savings
        current_state = snapshot['settings']['state']
        if current_state not in NO_INCOME_TAX_STATES:
            no_tax_savings = next(
                (s['savings_vs_current'] for s in states if s['no_income_tax']), 0
            )
            if no_tax_savings > 5000:
                recommendations.append({
                    'priority': 5,
                    'category': 'State Taxes',
                    'title': 'State Tax Relocation',
                    'description': f"Moving to a no-income-tax state could save ${no_tax_savings:,.0f}/year",
                    'impact': 'Long-term tax savings opportunity',
                    'action': 'Consider if relocation aligns with retirement goals',
                })

        # Check marginal rate
        marginal = snapshot['rates']['marginal_rate']
        if marginal >= 32:
            recommendations.append({
                'priority': 6,
                'category': 'Tax Bracket',
                'title': 'High Marginal Rate Alert',
                'description': f"Current marginal rate: {marginal}%",
                'impact': 'Consider income timing and deduction strategies',
                'action': 'Review opportunities to defer income or accelerate deductions',
            })

        # Sort by priority
        recommendations.sort(key=lambda x: x['priority'])

        return recommendations
