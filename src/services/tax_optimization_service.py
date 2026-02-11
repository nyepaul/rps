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

from src.services.tax_policy import get_tax_policy
from src.services.tax_engine_refactor import TaxEngine

# State income tax rates (simplified - top marginal rate)
STATE_TAX_RATES = {
    "AL": 0.05,
    "AK": 0.0,
    "AZ": 0.025,
    "AR": 0.047,
    "CA": 0.1230,
    "CO": 0.044,
    "CT": 0.0699,
    "DE": 0.066,
    "FL": 0.0,
    "GA": 0.055,
    "HI": 0.11,
    "ID": 0.058,
    "IL": 0.0495,
    "IN": 0.0315,
    "IA": 0.057,
    "KS": 0.057,
    "KY": 0.04,
    "LA": 0.0425,
    "ME": 0.0715,
    "MD": 0.0575,
    "MA": 0.05,
    "MI": 0.0425,
    "MN": 0.0985,
    "MS": 0.05,
    "MO": 0.048,
    "MT": 0.0575,
    "NE": 0.0584,
    "NV": 0.0,
    "NH": 0.0,
    "NJ": 0.1075,
    "NM": 0.059,
    "NY": 0.109,
    "NC": 0.0475,
    "ND": 0.025,
    "OH": 0.035,
    "OK": 0.0475,
    "OR": 0.099,
    "PA": 0.0307,
    "RI": 0.0599,
    "SC": 0.064,
    "SD": 0.0,
    "TN": 0.0,
    "TX": 0.0,
    "UT": 0.0465,
    "VT": 0.0875,
    "VA": 0.0575,
    "WA": 0.0,
    "WV": 0.055,
    "WI": 0.0765,
    "WY": 0.0,
    "DC": 0.1075,
}

# States with no income tax
NO_INCOME_TAX_STATES = ["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"]



@dataclass
class TaxSettings:
    """User's tax settings."""

    filing_status: str = "mfj"  # single, mfj, mfs, hoh
    state: str = "CA"
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

    def __init__(self, filing_status: str = "mfj", state: str = "CA", tax_year: Optional[int] = None):
        self.filing_status = filing_status.lower()
        self.state = state.upper()
        self.tax_year = tax_year or datetime.now().year
        self.policy = get_tax_policy(self.tax_year)

    def get_brackets(self) -> List[Tuple[float, float, float]]:
        """Get federal tax brackets based on filing status."""
        return self.policy.federal_brackets.get(
            self.filing_status, self.policy.federal_brackets["mfj"]
        )

    def get_standard_deduction(self, age: int = 65, spouse_age: int = 65) -> float:
        """Calculate standard deduction including age-based additions."""
        return TaxEngine.calculate_standard_deduction(
            self.tax_year, self.filing_status, p1_age=age, p2_age=spouse_age
        )

    def calculate_federal_tax(
        self, taxable_income: float
    ) -> Tuple[float, List[Dict], float]:
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
                    breakdown.append(
                        {
                            "bracket": f"{int(rate * 100)}%",
                            "range": (
                                f"${lower:,.0f} - ${upper:,.0f}"
                                if upper < float("inf")
                                else f"${lower:,.0f}+"
                            ),
                            "income_in_bracket": bracket_income,
                            "tax": bracket_tax,
                        }
                    )

                remaining_income -= bracket_income

        return total_tax, breakdown, marginal_rate

    def calculate_state_tax(self, taxable_income: float) -> float:
        """Calculate state income tax (simplified flat rate approximation)."""
        rate = STATE_TAX_RATES.get(self.state, 0.05)
        return taxable_income * rate

    def calculate_ltcg_tax(self, capital_gains: float, ordinary_income: float) -> float:
        """Calculate long-term capital gains tax."""
        brackets = self.policy.ltcg_brackets.get(
            self.filing_status, self.policy.ltcg_brackets["mfj"]
        )

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

    def __init__(self, filing_status: str = "mfj", tax_year: Optional[int] = None):
        self.filing_status = filing_status.lower()
        self.tax_year = tax_year or datetime.now().year
        self.policy = get_tax_policy(self.tax_year)

    def calculate_taxable_ss(
        self, agi: float, ss_benefit: float, tax_exempt_interest: float = 0
    ) -> Tuple[float, float]:
        """
        Calculate taxable portion of Social Security benefits.

        Returns:
            Tuple of (taxable_ss_amount, taxable_percentage)
        """
        # Provisional income = AGI + 50% of SS + tax-exempt interest
        provisional_income = agi + (ss_benefit * 0.5) + tax_exempt_interest

        thresholds = self.policy.ss_taxability.get(
            self.filing_status, self.policy.ss_taxability["mfj"]
        )
        threshold_1, threshold_2 = thresholds

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

    def analyze_claiming_ages(
        self, full_retirement_age: int, pia_at_fra: float, life_expectancy: int = 90
    ) -> List[Dict]:
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
                    reduction = months_early * (5 / 9) * 0.01
                else:
                    reduction = (
                        36 * (5 / 9) * 0.01 + (months_early - 36) * (5 / 12) * 0.01
                    )
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

            analyses.append(
                {
                    "claiming_age": claim_age,
                    "monthly_benefit": round(monthly_benefit, 2),
                    "annual_benefit": round(monthly_benefit * 12, 2),
                    "lifetime_benefit": round(lifetime_benefit, 2),
                    "years_receiving": years_receiving,
                    "vs_fra_pct": (
                        round((monthly_benefit / pia_at_fra - 1) * 100, 1)
                        if pia_at_fra > 0
                        else 0.0
                    ),
                }
            )

        # Find breakeven ages
        for i, analysis in enumerate(analyses):
            if i > 0:
                prev = analyses[i - 1]
                # Calculate when waiting pays off
                if analysis["monthly_benefit"] > prev["monthly_benefit"]:
                    monthly_diff = analysis["monthly_benefit"] - prev["monthly_benefit"]
                    annual_diff = monthly_diff * 12
                    lost_benefits = prev["annual_benefit"]  # One year of waiting
                    breakeven_years = (
                        lost_benefits / annual_diff if annual_diff > 0 else 999
                    )
                    analysis["breakeven_age"] = round(
                        analysis["claiming_age"] + breakeven_years, 1
                    )

        return analyses


class IRMAACalculator:
    """Calculates IRMAA (Income-Related Monthly Adjustment Amount) surcharges."""

    def __init__(self, filing_status: str = "mfj", tax_year: Optional[int] = None):
        self.filing_status = filing_status.lower()
        self.tax_year = tax_year or datetime.now().year
        self.policy = get_tax_policy(self.tax_year)

    def get_thresholds(self) -> List[Tuple[float, float, float]]:
        """Get IRMAA thresholds based on filing status."""
        return self.policy.irmaa.get(
            self.filing_status, self.policy.irmaa["mfj"]
        )

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
                    "current_tier": tier,
                    "current_threshold": lower,
                    "next_threshold": upper if upper < float("inf") else None,
                    "room_to_next": upper - magi if upper < float("inf") else None,
                }
                break
            elif magi > upper:
                continue
            else:
                threshold_info = {
                    "current_tier": tier,
                    "current_threshold": lower,
                    "next_threshold": upper if upper < float("inf") else None,
                    "room_to_next": upper - magi if upper < float("inf") else None,
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
            if upper == float("inf"):
                continue  # Skip the unbounded top bracket

            if current_taxable_income < upper:
                space = upper - max(current_taxable_income, lower)
                if space > 0:
                    space_analysis.append(
                        {
                            "bracket": f"{int(rate * 100)}%",
                            "bracket_range": f"${lower:,.0f} - ${upper:,.0f}",
                            "space_available": space,
                            "tax_on_full_space": space * rate,
                        }
                    )

        return space_analysis

    def analyze_conversion_amount(
        self,
        current_taxable_income: float,
        traditional_balance: float,
        conversion_amount: float,
    ) -> Dict:
        """
        Analyze the tax impact of a specific Roth conversion amount.
        """
        # Current tax without conversion
        current_tax, _, current_marginal = self.calculator.calculate_federal_tax(
            current_taxable_income
        )

        # Tax with conversion
        new_taxable = current_taxable_income + conversion_amount
        new_tax, breakdown, new_marginal = self.calculator.calculate_federal_tax(
            new_taxable
        )

        # IRMAA impact
        current_irmaa, _, _ = self.irmaa_calc.calculate_surcharge(
            current_taxable_income
        )
        new_irmaa, new_tier, irmaa_info = self.irmaa_calc.calculate_surcharge(
            new_taxable
        )

        conversion_tax = new_tax - current_tax
        irmaa_increase = new_irmaa - current_irmaa
        total_cost = conversion_tax + irmaa_increase

        return {
            "conversion_amount": conversion_amount,
            "current_taxable_income": current_taxable_income,
            "new_taxable_income": new_taxable,
            "current_marginal_rate": current_marginal,
            "new_marginal_rate": new_marginal,
            "conversion_tax": round(conversion_tax, 2),
            "irmaa_increase": round(irmaa_increase, 2),
            "total_cost": round(total_cost, 2),
            "effective_rate_on_conversion": (
                round((total_cost / conversion_amount) * 100, 2)
                if conversion_amount > 0
                else 0
            ),
            "traditional_balance_after": traditional_balance - conversion_amount,
            "irmaa_tier": new_tier,
            "bracket_breakdown": breakdown,
        }

    def find_optimal_conversion(
        self,
        current_taxable_income: float,
        traditional_balance: float,
        max_rate: float = 0.24,
    ) -> Dict:
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
                target_ceiling - current_taxable_income, traditional_balance
            )

        result = self.analyze_conversion_amount(
            current_taxable_income, traditional_balance, optimal_amount
        )

        # Add bracket ceiling information for display
        result["bracket_ceiling"] = target_ceiling
        result["max_rate"] = max_rate

        return result


class RMDCalculator:
    """Calculates Required Minimum Distributions."""

    @staticmethod
    def calculate_rmd(age: int, account_balance: float, tax_year: Optional[int] = None) -> Dict:
        """
        Calculate RMD for a given age and account balance.

        Args:
            age: Current age (RMD starts at 73)
            account_balance: End of prior year balance

        Returns:
            RMD calculation details
        """
        policy = get_tax_policy(tax_year or datetime.now().year)
        rmd_age = policy.rmd_age
        rmd_factors = policy.rmd_factors

        if age < rmd_age:
            return {
                "required": False,
                "age": age,
                "rmd_amount": 0,
                "divisor": None,
                "message": f"RMDs begin at age {rmd_age}. You have {rmd_age - age} years before RMDs start.",
            }

        divisor = rmd_factors.get(age, 2.0)  # Default to 2.0 for ages > 120
        rmd_amount = account_balance / divisor

        return {
            "required": True,
            "age": age,
            "account_balance": account_balance,
            "divisor": divisor,
            "rmd_amount": round(rmd_amount, 2),
            "rmd_as_percentage": (
                round((rmd_amount / account_balance) * 100, 2)
                if account_balance > 0
                else 0
            ),
        }

    @staticmethod
    def project_rmds(
        current_age: int,
        current_balance: float,
        growth_rate: float = 0.05,
        years: int = 20,
        tax_year: Optional[int] = None,
    ) -> List[Dict]:
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
        policy = get_tax_policy(tax_year or datetime.now().year)
        rmd_age = policy.rmd_age
        rmd_factors = policy.rmd_factors

        projections = []
        balance = current_balance

        for year in range(years):
            age = current_age + year

            # Calculate RMD if applicable
            if age >= rmd_age:
                divisor = rmd_factors.get(age, 2.0)
                rmd = balance / divisor
            else:
                rmd = 0
                divisor = None

            projections.append(
                {
                    "year": year + 1,
                    "age": age,
                    "start_balance": round(balance, 2),
                    "rmd_amount": round(rmd, 2),
                    "divisor": divisor,
                    "rmd_required": age >= rmd_age,
                }
            )

            # Update balance for next year (growth minus RMD)
            balance = (balance - rmd) * (1 + growth_rate)

        return projections


class TaxOptimizationService:
    """Main service for comprehensive tax optimization analysis."""

    def __init__(
        self,
        filing_status: str = "mfj",
        state: str = "CA",
        age: int = 65,
        spouse_age: int = 65,
        tax_year: Optional[int] = None,
    ):
        self.tax_year = tax_year or datetime.now().year
        self.settings = TaxSettings(
            filing_status=filing_status.lower(),
            state=state.upper(),
            age=age,
            spouse_age=spouse_age,
        )
        self.calculator = TaxCalculator(filing_status, state, self.tax_year)
        self.ss_analyzer = SocialSecurityAnalyzer(filing_status, self.tax_year)
        self.irmaa_calc = IRMAACalculator(filing_status, self.tax_year)
        self.roth_optimizer = RothConversionOptimizer(self.calculator, self.irmaa_calc)

    def calculate_tax_snapshot(
        self,
        gross_income: float,
        social_security: float = 0,
        capital_gains: float = 0,
        deductions: float = 0,
    ) -> Dict:
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
        federal_tax, bracket_breakdown, marginal_rate = (
            self.calculator.calculate_federal_tax(taxable_income)
        )

        # Capital gains tax
        ltcg_tax = self.calculator.calculate_ltcg_tax(capital_gains, taxable_income)

        # State tax (simplified)
        state_tax = self.calculator.calculate_state_tax(taxable_income + capital_gains)

        # IRMAA - Use MAGI (AGI + tax-exempt interest + excluded foreign income)
        # For most retirees, MAGI ≈ AGI since they don't have tax-exempt interest or foreign income
        # IMPORTANT: Use taxable_ss (not total SS) since AGI already includes only taxable portion
        magi = agi + capital_gains  # AGI already includes taxable SS and other income
        irmaa_surcharge, irmaa_tier, irmaa_info = self.irmaa_calc.calculate_surcharge(
            magi
        )

        # Total tax
        total_tax = federal_tax + ltcg_tax + state_tax + irmaa_surcharge

        # Effective rate
        total_income = gross_income + social_security + capital_gains
        effective_rate = (total_tax / total_income) * 100 if total_income > 0 else 0

        return {
            "summary": {
                "gross_income": gross_income,
                "social_security": social_security,
                "social_security_taxable": round(taxable_ss, 2),
                "social_security_taxable_pct": round(ss_taxable_pct * 100, 1),
                "capital_gains": capital_gains,
                "agi": round(agi, 2),
                "deduction_used": round(actual_deduction, 2),
                "deduction_type": (
                    "itemized" if deductions > standard_deduction else "standard"
                ),
                "taxable_income": round(taxable_income, 2),
            },
            "taxes": {
                "federal_tax": round(federal_tax, 2),
                "capital_gains_tax": round(ltcg_tax, 2),
                "state_tax": round(state_tax, 2),
                "irmaa_surcharge": round(irmaa_surcharge, 2),
                "total_tax": round(total_tax, 2),
            },
            "rates": {
                "marginal_rate": round(marginal_rate * 100, 1),
                "effective_rate": round(effective_rate, 2),
                "state_rate": round(
                    STATE_TAX_RATES.get(self.settings.state, 0) * 100, 2
                ),
            },
            "bracket_breakdown": bracket_breakdown,
            "irmaa": {
                "tier": irmaa_tier,
                "annual_surcharge": round(irmaa_surcharge, 2),
                **irmaa_info,
            },
            "settings": {
                "filing_status": self.settings.filing_status,
                "state": self.settings.state,
                "age": self.settings.age,
                "spouse_age": self.settings.spouse_age,
            },
        }

    def analyze_roth_conversion(
        self,
        current_taxable_income: float,
        traditional_balance: float,
        conversion_amounts: List[float] = None,
        ladder_years: int = 5,
        ladder_growth_rate: float = 0.05,
        ladder_max_rate: float = 0.24,
    ) -> Dict:
        """
        Analyze Roth conversion scenarios.
        """
        if conversion_amounts is None:
            # Default amounts to analyze
            conversion_amounts = [10000, 25000, 50000, 75000, 100000]

        # Bracket space analysis
        bracket_space = self.roth_optimizer.calculate_bracket_space(
            current_taxable_income
        )

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
        ladder_5y = self.build_roth_conversion_ladder(
            current_taxable_income=current_taxable_income,
            traditional_balance=traditional_balance,
            years=max(1, int(ladder_years)),
            annual_growth=max(-0.5, float(ladder_growth_rate)),
            max_rate=max(0.1, min(0.5, float(ladder_max_rate))),
        )
        ladder_variants = self.build_roth_ladder_variants(
            current_taxable_income=current_taxable_income,
            traditional_balance=traditional_balance,
            years=max(1, int(ladder_years)),
            annual_growth=max(-0.5, float(ladder_growth_rate)),
            base_max_rate=max(0.1, min(0.5, float(ladder_max_rate))),
        )

        return {
            "current_taxable_income": current_taxable_income,
            "traditional_balance": traditional_balance,
            "bracket_space": bracket_space,
            "scenarios": scenarios,
            "optimal_24pct": optimal,
            "conversion_ladder_5y": ladder_5y,
            "ladder_variants": ladder_variants,
            "recommendation": self._get_roth_recommendation(optimal, bracket_space),
        }

    def build_roth_conversion_ladder(
        self,
        current_taxable_income: float,
        traditional_balance: float,
        years: int = 5,
        annual_growth: float = 0.05,
        max_rate: float = 0.24,
    ) -> Dict:
        """Construct a multi-year conversion ladder using the target marginal-rate cap."""
        rows = []
        balance = max(0.0, float(traditional_balance))
        total_converted = 0.0
        total_conversion_tax = 0.0
        total_irmaa = 0.0

        for year in range(1, years + 1):
            if balance <= 0:
                break

            optimal = self.roth_optimizer.find_optimal_conversion(
                current_taxable_income, balance, max_rate=max_rate
            )
            amount = max(0.0, min(balance, float(optimal.get("conversion_amount", 0.0))))
            if amount <= 0:
                break

            analysis = self.roth_optimizer.analyze_conversion_amount(
                current_taxable_income, balance, amount
            )
            end_balance = max(0.0, (balance - amount) * (1 + annual_growth))

            rows.append(
                {
                    "year": year,
                    "start_balance": round(balance, 2),
                    "conversion_amount": round(amount, 2),
                    "conversion_tax": round(float(analysis["conversion_tax"]), 2),
                    "irmaa_increase": round(float(analysis["irmaa_increase"]), 2),
                    "total_cost": round(float(analysis["total_cost"]), 2),
                    "new_marginal_rate": analysis["new_marginal_rate"],
                    "end_balance": round(end_balance, 2),
                }
            )

            total_converted += amount
            total_conversion_tax += float(analysis["conversion_tax"])
            total_irmaa += float(analysis["irmaa_increase"])
            balance = end_balance

        return {
            "years_modeled": years,
            "annual_growth_assumption": annual_growth,
            "max_marginal_rate_target": max_rate,
            "rows": rows,
            "total_converted": round(total_converted, 2),
            "total_conversion_tax": round(total_conversion_tax, 2),
            "total_irmaa_increase": round(total_irmaa, 2),
            "total_cost": round(total_conversion_tax + total_irmaa, 2),
            "ending_balance": round(balance, 2),
            "stopped_reason": (
                "insufficient_bracket_space_or_balance"
                if len(rows) < years
                else "modeled_years_completed"
            ),
        }

    def build_roth_ladder_variants(
        self,
        current_taxable_income: float,
        traditional_balance: float,
        years: int,
        annual_growth: float,
        base_max_rate: float,
    ) -> Dict:
        """Build conservative/balanced/aggressive ladder variants and choose a recommendation."""
        variants = {
            "conservative": min(base_max_rate, 0.22),
            "balanced": base_max_rate,
            "aggressive": max(base_max_rate, 0.28),
        }
        ladders = {}
        metrics = {}
        for name, max_rate in variants.items():
            ladder = self.build_roth_conversion_ladder(
                current_taxable_income=current_taxable_income,
                traditional_balance=traditional_balance,
                years=years,
                annual_growth=annual_growth,
                max_rate=max_rate,
            )
            ladders[name] = ladder
            converted = float(ladder["total_converted"])
            cost = float(ladder["total_cost"])
            metrics[name] = {
                "total_converted": round(converted, 2),
                "total_cost": round(cost, 2),
                "effective_cost_rate": round((cost / converted) if converted > 0 else 0.0, 4),
                "ending_balance": float(ladder["ending_balance"]),
            }

        # Prefer highest converted plan that stays near user-selected max rate (+3pp tolerance).
        allowed = [
            name for name in metrics
            if metrics[name]["effective_cost_rate"] <= (base_max_rate + 0.03)
        ]
        candidate_pool = allowed if allowed else list(metrics.keys())
        recommended = max(
            candidate_pool,
            key=lambda n: (metrics[n]["total_converted"], -metrics[n]["effective_cost_rate"]),
        )

        return {
            "recommended": recommended,
            "metrics": metrics,
            "plans": ladders,
        }

    def analyze_social_security(
        self,
        pia_at_fra: float,
        current_age: int,
        full_retirement_age: int = 67,
        life_expectancy: int = 90,
    ) -> Dict:
        """
        Analyze Social Security claiming strategies.
        """
        analyses = self.ss_analyzer.analyze_claiming_ages(
            full_retirement_age, pia_at_fra, life_expectancy
        )

        # Find optimal claiming age (highest lifetime benefit)
        optimal = max(analyses, key=lambda x: x["lifetime_benefit"])

        # Early vs late analysis
        early = next((a for a in analyses if a["claiming_age"] == 62), None)
        fra = next(
            (a for a in analyses if a["claiming_age"] == full_retirement_age), None
        )
        late = next((a for a in analyses if a["claiming_age"] == 70), None)

        return {
            "pia_at_fra": pia_at_fra,
            "full_retirement_age": full_retirement_age,
            "current_age": current_age,
            "life_expectancy": life_expectancy,
            "analyses": analyses,
            "optimal": optimal,
            "comparison": {
                "early_62": early,
                "fra": fra,
                "delayed_70": late,
            },
            "recommendation": self._get_ss_recommendation(
                optimal, current_age, life_expectancy
            ),
        }

    @staticmethod
    def apply_wep_adjustment(
        pia_at_fra: float, noncovered_pension_annual: float
    ) -> Dict:
        """Approximate WEP reduction on PIA at FRA."""
        monthly_noncovered = max(0.0, noncovered_pension_annual / 12.0)
        reduction = min(600.0, monthly_noncovered * 0.5, pia_at_fra * 0.5)
        adjusted = max(0.0, pia_at_fra - reduction)
        return {
            "applied": reduction > 0,
            "wep_reduction_monthly": round(reduction, 2),
            "pia_before_wep": round(pia_at_fra, 2),
            "pia_after_wep": round(adjusted, 2),
        }

    @staticmethod
    def apply_earnings_test_penalty(
        analysis: Dict,
        annual_earned_income: float,
        annual_limit: float = 22320.0,
    ) -> Dict:
        """Apply pre-FRA earnings test approximation to SS analysis rows."""
        if not analysis:
            return analysis

        fra = int(analysis.get("full_retirement_age", 67))
        rows = []
        for row in analysis.get("analyses", []):
            claim_age = int(row["claiming_age"])
            annual_benefit = float(row["annual_benefit"])
            years_before_fra = max(0, fra - claim_age)
            annual_penalty = 0.0
            if claim_age < fra and annual_earned_income > annual_limit:
                annual_penalty = min((annual_earned_income - annual_limit) / 2.0, annual_benefit)

            adjusted_annual = max(0.0, annual_benefit - annual_penalty)
            adjusted_lifetime = max(
                0.0,
                float(row["lifetime_benefit"]) - (annual_penalty * years_before_fra),
            )
            row = {
                **row,
                "earnings_penalty_annual": round(annual_penalty, 2),
                "annual_benefit_after_earnings_test": round(adjusted_annual, 2),
                "lifetime_benefit_after_earnings_test": round(adjusted_lifetime, 2),
            }
            rows.append(row)

        # recompute optimal under earnings-test-adjusted lifetime
        optimal = max(rows, key=lambda x: x["lifetime_benefit_after_earnings_test"]) if rows else None
        return {
            **analysis,
            "analyses": rows,
            "optimal_after_earnings_test": optimal,
            "earnings_test": {
                "annual_earned_income": round(annual_earned_income, 2),
                "annual_limit": round(annual_limit, 2),
                "applies": annual_earned_income > annual_limit,
            },
        }

    def analyze_tax_torpedo(
        self,
        non_ss_income: float,
        ss_benefit: float,
        tax_exempt_interest: float = 0.0,
    ) -> Dict:
        """Expose Social Security taxability threshold context."""
        provisional_income = non_ss_income + (ss_benefit * 0.5) + tax_exempt_interest
        thresholds = self.ss_analyzer.policy.ss_taxability.get(
            self.settings.filing_status,
            self.ss_analyzer.policy.ss_taxability["mfj"],
        )
        t1, t2 = thresholds
        taxable_ss, taxable_pct = self.ss_analyzer.calculate_taxable_ss(
            non_ss_income, ss_benefit, tax_exempt_interest
        )

        if provisional_income <= t1:
            band = "below_first_threshold"
            room_to_next = t1 - provisional_income
        elif provisional_income <= t2:
            band = "between_thresholds"
            room_to_next = t2 - provisional_income
        else:
            band = "above_second_threshold"
            room_to_next = 0.0

        return {
            "provisional_income": round(provisional_income, 2),
            "thresholds": {"first": t1, "second": t2},
            "band": band,
            "room_to_next_threshold": round(max(0.0, room_to_next), 2),
            "taxable_ss_amount": round(taxable_ss, 2),
            "taxable_ss_pct": round(taxable_pct * 100, 2),
        }

    def analyze_rmd(
        self,
        age: int,
        traditional_balance: float,
        growth_rate: float = 0.05,
        years: int = 20,
        annual_charitable_giving: float = 0.0,
    ) -> Dict:
        """
        Analyze RMD situation and projections.
        """
        policy = get_tax_policy(self.tax_year)
        current_rmd = RMDCalculator.calculate_rmd(
            age, traditional_balance, tax_year=self.tax_year
        )
        projections = RMDCalculator.project_rmds(
            age, traditional_balance, growth_rate, years=years, tax_year=self.tax_year
        )

        # Build QCD-aware projection details.
        qcd_projection = []
        total_rmds = 0.0
        total_qcd = 0.0
        total_taxable_rmd = 0.0
        annual_charitable_giving = max(0.0, annual_charitable_giving or 0.0)

        for proj in projections:
            rmd_amount = proj["rmd_amount"]
            total_rmds += rmd_amount
            qcd_allowed = bool(proj["rmd_required"] and proj["age"] >= policy.qcd_age)
            suggested_qcd = (
                min(rmd_amount, policy.qcd_annual_limit, annual_charitable_giving)
                if qcd_allowed
                else 0.0
            )
            max_qcd = (
                min(rmd_amount, policy.qcd_annual_limit) if qcd_allowed else 0.0
            )
            taxable_rmd_after_qcd = max(0.0, rmd_amount - suggested_qcd)

            total_qcd += suggested_qcd
            total_taxable_rmd += taxable_rmd_after_qcd

            qcd_projection.append(
                {
                    "year": proj["year"],
                    "age": proj["age"],
                    "rmd_amount": round(rmd_amount, 2),
                    "qcd_allowed": qcd_allowed,
                    "qcd_max_allowed": round(max_qcd, 2),
                    "suggested_qcd": round(suggested_qcd, 2),
                    "taxable_rmd_after_qcd": round(taxable_rmd_after_qcd, 2),
                }
            )

        qcd_reduction_pct = (
            (total_qcd / total_rmds) * 100 if total_rmds > 0 else 0.0
        )
        marginal_rate = self.calculator.get_brackets()[-1][2]
        for lower, upper, rate in self.calculator.get_brackets():
            if lower <= max(0.0, traditional_balance / max(1, years)) < upper:
                marginal_rate = rate
                break
        estimated_tax_reduction = total_qcd * marginal_rate

        current_qcd_allowed = bool(
            current_rmd["required"] and age >= policy.qcd_age
        )
        current_suggested_qcd = (
            min(current_rmd["rmd_amount"], policy.qcd_annual_limit, annual_charitable_giving)
            if current_qcd_allowed
            else 0.0
        )
        current_taxable_rmd = max(0.0, current_rmd["rmd_amount"] - current_suggested_qcd)

        return {
            "current": current_rmd,
            "projections": projections,
            "summary": {
                "total_projected_rmds": round(total_rmds, 2),
                "total_projected_qcd": round(total_qcd, 2),
                "total_projected_taxable_rmd": round(total_taxable_rmd, 2),
                "projected_qcd_reduction_pct": round(qcd_reduction_pct, 2),
                "years_until_rmd": max(0, policy.rmd_age - age),
                "current_balance": traditional_balance,
            },
            "qcd_eligible": age >= policy.qcd_age,
            "qcd_annual_limit": policy.qcd_annual_limit,
            "qcd_planning": {
                "annual_charitable_giving_assumption": round(annual_charitable_giving, 2),
                "current_year_qcd_allowed": current_qcd_allowed,
                "current_year_suggested_qcd": round(current_suggested_qcd, 2),
                "current_year_taxable_rmd_after_qcd": round(current_taxable_rmd, 2),
                "estimated_tax_reduction_on_suggested_qcd": round(estimated_tax_reduction, 2),
            },
            "qcd_projection": qcd_projection,
            "recommendation": self._get_rmd_recommendation(current_rmd, age),
        }

    @staticmethod
    def infer_annual_charitable_giving(profile_data: Dict) -> float:
        """Infer annual charitable giving from financial and budget fields."""
        financial = profile_data.get("financial") or {}
        budget = profile_data.get("budget") or {}
        expenses = budget.get("expenses") or {}

        direct = financial.get("annual_charitable_giving")
        if direct is not None:
            return float(direct)

        budget_value = expenses.get("charitable_giving")
        if isinstance(budget_value, (int, float)):
            return float(budget_value) * 12.0
        if isinstance(budget_value, dict):
            amount = float(budget_value.get("amount") or 0.0)
            frequency = (budget_value.get("frequency") or "monthly").lower()
            if frequency == "annual":
                return amount
            if frequency == "weekly":
                return amount * 52.0
            if frequency == "biweekly":
                return amount * 26.0
            return amount * 12.0

        return 0.0

    def compare_states(self, taxable_income: float) -> List[Dict]:
        """
        Compare tax burden across states.
        """
        comparisons = []

        for state, rate in sorted(STATE_TAX_RATES.items(), key=lambda x: x[1]):
            state_tax = taxable_income * rate
            comparisons.append(
                {
                    "state": state,
                    "rate": round(rate * 100, 2),
                    "estimated_tax": round(state_tax, 2),
                    "no_income_tax": state in NO_INCOME_TAX_STATES,
                }
            )

        # Calculate savings vs current state
        current_tax = taxable_income * STATE_TAX_RATES.get(self.settings.state, 0)
        for comp in comparisons:
            comp["savings_vs_current"] = round(current_tax - comp["estimated_tax"], 2)

        return comparisons

    def get_comprehensive_analysis(self, profile_data: Dict) -> Dict:
        """
        Run comprehensive tax analysis on a profile.
        """
        # Extract data from profile
        financial = profile_data.get("financial", {})
        assets = profile_data.get("assets", {})
        tax_settings = profile_data.get("tax_settings", {})
        person = profile_data.get("person", {})
        spouse = profile_data.get("spouse", {})

        # Get income components - try financial first, then calculate from income_streams
        gross_income = financial.get("annual_income", 0) or 0

        # If no annual_income in financial, calculate from income_streams
        if gross_income == 0:
            income_streams = profile_data.get("income_streams", [])
            for stream in income_streams:
                amount = stream.get("amount", 0)
                frequency = stream.get("frequency", "monthly").lower()

                # Convert to annual
                if frequency == "monthly":
                    gross_income += amount * 12
                elif frequency == "annual":
                    gross_income += amount
                elif frequency == "weekly":
                    gross_income += amount * 52
                elif frequency == "biweekly":
                    gross_income += amount * 26

        # Get Social Security - combine primary from financial and spouse from spouse object
        primary_ss = (financial.get("social_security_benefit", 0) or 0) * 12
        spouse_ss = (
            (spouse.get("social_security_benefit", 0) or 0) * 12 if spouse else 0
        )
        ss_benefit = primary_ss + spouse_ss

        # If still 0, try legacy person object for primary
        if ss_benefit == 0:
            person_ss = (person.get("social_security_benefit", 0) or 0) * 12
            ss_benefit = person_ss + spouse_ss

        # Get pension
        pension = (financial.get("pension_benefit", 0) or 0) * 12

        # NOTE: Don't re-read filing_status/state from tax_settings
        # The route already resolved these from address/tax_settings with proper fallback
        # and passed them to __init__, so just use the already-configured self.settings

        # Get age for RMD calculations (use from self.settings which was set in __init__)
        age = self.settings.age
        spouse_age = self.settings.spouse_age

        # Calculate traditional IRA balance
        traditional_balance = sum(
            a.get("value", 0)
            for a in assets.get("retirement_accounts", [])
            if "traditional" in a.get("type", "").lower()
            or "401k" in a.get("type", "").lower()
        )

        # Get tax snapshot
        total_income = gross_income + pension
        snapshot = self.calculate_tax_snapshot(
            gross_income=total_income,
            social_security=ss_benefit,
        )

        # Get Roth conversion analysis
        roth_analysis = self.analyze_roth_conversion(
            current_taxable_income=snapshot["summary"]["taxable_income"],
            traditional_balance=traditional_balance,
        )

        # Get Social Security strategy analysis
        ss_analysis = self.analyze_household_social_security(
            person=person,
            spouse=spouse,
            financial=financial,
            current_age=age,
            spouse_age=spouse_age,
        )
        if ss_analysis.get("available"):
            ss_analysis["tax_torpedo"] = self.analyze_tax_torpedo(
                non_ss_income=float(total_income),
                ss_benefit=float(ss_benefit),
            )

        # Get RMD analysis
        annual_charitable_giving = self.infer_annual_charitable_giving(profile_data)
        rmd_analysis = self.analyze_rmd(
            age, traditional_balance, annual_charitable_giving=annual_charitable_giving
        )

        # Get state comparison
        state_comparison = self.compare_states(snapshot["summary"]["taxable_income"])

        # Generate prioritized recommendations
        recommendations = self._generate_recommendations(
            snapshot, roth_analysis, rmd_analysis, state_comparison
        )

        return {
            "snapshot": snapshot,
            "social_security_analysis": ss_analysis,
            "roth_conversion": roth_analysis,
            "rmd_analysis": rmd_analysis,
            "state_comparison": state_comparison[:10],  # Top 10 states
            "recommendations": recommendations,
        }

    def analyze_household_social_security(
        self,
        *,
        person: Dict,
        spouse: Dict,
        financial: Dict,
        current_age: int,
        spouse_age: int,
        gpo_offset_monthly: float = 0.0,
    ) -> Dict:
        """Build household Social Security claiming analysis."""
        primary_monthly = (
            financial.get("social_security_benefit")
            or person.get("social_security_benefit")
            or 0
        )
        spouse_monthly = spouse.get("social_security_benefit") or 0
        primary_life_expectancy = int(person.get("life_expectancy") or 90)
        spouse_life_expectancy = int(spouse.get("life_expectancy") or 90)

        if primary_monthly <= 0 and spouse_monthly <= 0:
            return {
                "available": False,
                "message": "Add estimated Social Security benefits to unlock claiming optimization.",
            }

        primary_analysis = (
            self.analyze_social_security(
                pia_at_fra=float(primary_monthly),
                current_age=int(current_age),
                life_expectancy=primary_life_expectancy,
            )
            if primary_monthly > 0
            else None
        )
        spouse_analysis = (
            self.analyze_social_security(
                pia_at_fra=float(spouse_monthly),
                current_age=int(spouse_age),
                life_expectancy=spouse_life_expectancy,
            )
            if spouse_monthly > 0
            else None
        )

        household = []
        if primary_analysis or spouse_analysis:
            for age in range(62, 71):
                p = (
                    next(
                        (
                            item
                            for item in (primary_analysis.get("analyses") or [])
                            if item["claiming_age"] == age
                        ),
                        None,
                    )
                    if primary_analysis
                    else None
                )
                s = (
                    next(
                        (
                            item
                            for item in (spouse_analysis.get("analyses") or [])
                            if item["claiming_age"] == age
                        ),
                        None,
                    )
                    if spouse_analysis
                    else None
                )
                if p or s:
                    household.append(
                        {
                            "claiming_age": age,
                            "combined_monthly_benefit": round(
                                (p.get("monthly_benefit", 0) if p else 0)
                                + (s.get("monthly_benefit", 0) if s else 0),
                                2,
                            ),
                        }
                    )

        # Build paired claiming strategy matrix for household optimization.
        key_ages = [62, 67, 70]
        p_by_age = {
            item["claiming_age"]: item
            for item in (primary_analysis.get("analyses") or [])
        } if primary_analysis else {}
        s_by_age = {
            item["claiming_age"]: item
            for item in (spouse_analysis.get("analyses") or [])
        } if spouse_analysis else {}

        strategy_matrix = []
        full_retirement_age = 67

        def _claim_factor(claim_age: Optional[int], fra: int = 67) -> float:
            """Approximate claiming adjustment factor used for spousal-floor modeling."""
            if claim_age is None:
                return 1.0
            if claim_age < fra:
                months_early = (fra - claim_age) * 12
                if months_early <= 36:
                    reduction = months_early * (5 / 9) * 0.01
                else:
                    reduction = 36 * (5 / 9) * 0.01 + (months_early - 36) * (5 / 12) * 0.01
                return max(0.0, 1 - reduction)
            if claim_age > fra:
                years_delayed = claim_age - fra
                return 1 + 0.08 * years_delayed
            return 1.0

        def _spousal_floor_monthly(higher_pia: float, lower_claim_age: Optional[int]) -> float:
            """Approximate spouse benefit floor based on 50% of higher earner PIA at FRA, adjusted for claim age."""
            if lower_claim_age is None:
                return 0.0
            base_floor = higher_pia * 0.5
            floor_factor = _claim_factor(lower_claim_age, full_retirement_age)
            # Spousal benefits do not receive delayed retirement credits; cap at FRA level.
            if lower_claim_age > full_retirement_age:
                floor_factor = 1.0
            return max(0.0, (base_floor * floor_factor) - max(0.0, gpo_offset_monthly))
        for p_age in (key_ages if p_by_age else [None]):
            for s_age in (key_ages if s_by_age else [None]):
                p = p_by_age.get(p_age) if p_age is not None else None
                s = s_by_age.get(s_age) if s_age is not None else None

                independent_monthly = (
                    (p.get("monthly_benefit", 0) if p else 0)
                    + (s.get("monthly_benefit", 0) if s else 0)
                )
                independent_lifetime = (
                    (p.get("lifetime_benefit", 0) if p else 0)
                    + (s.get("lifetime_benefit", 0) if s else 0)
                )

                higher_pia = max(float(primary_monthly or 0), float(spouse_monthly or 0))
                if p and s:
                    lower_claim_age = s_age if primary_monthly >= spouse_monthly else p_age
                    modeled_floor = _spousal_floor_monthly(higher_pia, lower_claim_age)
                    lower_current = min(p.get("monthly_benefit", 0), s.get("monthly_benefit", 0))
                    floor_uplift = max(0.0, modeled_floor - lower_current)
                else:
                    floor_uplift = 0.0

                adjusted_monthly = independent_monthly + floor_uplift
                household_life_expectancy = max(primary_life_expectancy, spouse_life_expectancy)
                years_receiving = max(
                    0,
                    household_life_expectancy - max(p_age or 62, s_age or 62),
                )
                adjusted_lifetime = independent_lifetime + (floor_uplift * 12 * years_receiving)

                strategy_matrix.append(
                    {
                        "primary_claim_age": p_age,
                        "spouse_claim_age": s_age,
                        "label": (
                            f"P{p_age}/S{s_age}" if p_age is not None and s_age is not None
                            else f"P{p_age}" if p_age is not None else f"S{s_age}"
                        ),
                        "combined_monthly_benefit_independent": round(independent_monthly, 2),
                        "combined_monthly_benefit_with_spousal_floor": round(adjusted_monthly, 2),
                        "spousal_floor_uplift_monthly": round(floor_uplift, 2),
                        "combined_lifetime_benefit_independent": round(independent_lifetime, 2),
                        "combined_lifetime_benefit_with_spousal_floor": round(adjusted_lifetime, 2),
                    }
                )

        strategy_matrix = sorted(
            strategy_matrix,
            key=lambda row: row["combined_lifetime_benefit_with_spousal_floor"],
            reverse=True,
        )

        def _extract_breakeven(analysis: Optional[Dict], who: str) -> List[Dict]:
            if not analysis:
                return []
            rows = []
            prev_age = None
            for item in analysis.get("analyses") or []:
                if "breakeven_age" in item:
                    rows.append(
                        {
                            "person": who,
                            "from_claim_age": prev_age,
                            "to_claim_age": item["claiming_age"],
                            "breakeven_age": item["breakeven_age"],
                        }
                    )
                prev_age = item["claiming_age"]
            return rows

        breakeven_crossovers = (
            _extract_breakeven(primary_analysis, "primary")
            + _extract_breakeven(spouse_analysis, "spouse")
        )

        primary_70 = (
            next(
                (
                    item
                    for item in (primary_analysis.get("analyses") or [])
                    if item["claiming_age"] == 70
                ),
                None,
            )
            if primary_analysis
            else None
        )
        spouse_70 = (
            next(
                (
                    item
                    for item in (spouse_analysis.get("analyses") or [])
                    if item["claiming_age"] == 70
                ),
                None,
            )
            if spouse_analysis
            else None
        )
        survivor_estimate = max(
            primary_70.get("monthly_benefit", 0) if primary_70 else 0,
            spouse_70.get("monthly_benefit", 0) if spouse_70 else 0,
        )

        return {
            "available": True,
            "primary": primary_analysis,
            "spouse": spouse_analysis,
            "household": {
                "combined_by_claiming_age": household,
                "strategy_matrix": strategy_matrix,
                "top_strategies": strategy_matrix[:3],
                "breakeven_crossovers": breakeven_crossovers,
                "spousal_floor_model": {
                    "enabled": bool(primary_analysis and spouse_analysis),
                    "description": "Modeled with a spouse-benefit floor near 50% of the higher earner PIA at FRA, adjusted for early claiming.",
                },
                "survivor_monthly_estimate_at_70_strategy": round(survivor_estimate, 2),
                "recommendation": "Delaying the higher earner to age 70 generally improves survivor income protection.",
            },
        }

    def _get_roth_recommendation(self, optimal: Dict, bracket_space: List[Dict]) -> str:
        """Generate Roth conversion recommendation."""
        if optimal["conversion_amount"] == 0:
            return "You're already at your target marginal rate. Consider conversions only if you expect higher rates in the future."

        amount = optimal["conversion_amount"]
        rate = optimal["new_marginal_rate"] * 100

        return f"Consider converting ${amount:,.0f} to stay within the {rate:.0f}% bracket. Tax cost: ${optimal['conversion_tax']:,.0f}"

    def _get_ss_recommendation(
        self, optimal: Dict, current_age: int, life_expectancy: int
    ) -> str:
        """Generate Social Security recommendation."""
        if current_age >= 70:
            return "You should be claiming Social Security now if you haven't already."

        claim_age = optimal["claiming_age"]
        benefit = optimal["monthly_benefit"]

        if life_expectancy >= 85:
            return f"With life expectancy of {life_expectancy}, delaying to age {claim_age} maximizes lifetime benefits (${benefit:,.0f}/month)."
        else:
            return f"Consider your health and financial needs. Earlier claiming may be appropriate if concerned about longevity."

    def _get_rmd_recommendation(self, rmd: Dict, age: int) -> str:
        """Generate RMD recommendation."""
        if not rmd["required"]:
            years_until = get_tax_policy(self.tax_year).rmd_age - age
            return f"Consider Roth conversions during the next {years_until} years before RMDs begin to reduce future required distributions."

        amount = rmd["rmd_amount"]
        policy = get_tax_policy(self.tax_year)
        if age >= policy.qcd_age:
            return (
                f"Your RMD is ${amount:,.0f}. Consider using QCDs (up to "
                f"${policy.qcd_annual_limit:,.0f}) to satisfy RMDs while reducing taxable income."
            )

        return f"Your required RMD is ${amount:,.0f}. Ensure this is withdrawn by December 31st."

    def _generate_recommendations(
        self, snapshot: Dict, roth: Dict, rmd: Dict, states: List[Dict]
    ) -> List[Dict]:
        """Generate prioritized list of tax optimization recommendations."""
        recommendations = []

        # Check for Roth conversion opportunity
        if roth["optimal_24pct"]["conversion_amount"] > 0:
            recommendations.append(
                {
                    "priority": 1,
                    "category": "Roth Conversion",
                    "title": "Tax Bracket Optimization",
                    "description": f"Convert ${roth['optimal_24pct']['conversion_amount']:,.0f} from Traditional to Roth IRA",
                    "impact": f"Tax cost: ${roth['optimal_24pct']['conversion_tax']:,.0f} at {roth['optimal_24pct']['effective_rate_on_conversion']:.1f}% effective rate",
                    "action": "Consider conversion before year-end",
                }
            )

        # Check IRMAA threshold
        irmaa = snapshot["irmaa"]
        if irmaa.get("room_to_next") and irmaa["room_to_next"] < 20000:
            recommendations.append(
                {
                    "priority": 2,
                    "category": "IRMAA",
                    "title": "Medicare Premium Warning",
                    "description": f"You're ${irmaa['room_to_next']:,.0f} away from the next IRMAA tier",
                    "impact": "Could increase Medicare premiums by ~$1,000+/year",
                    "action": "Monitor income to avoid crossing threshold",
                }
            )

        # Check for RMD opportunity
        if not rmd["current"]["required"] and rmd["summary"]["years_until_rmd"] <= 8:
            recommendations.append(
                {
                    "priority": 3,
                    "category": "RMD Planning",
                    "title": "Pre-RMD Conversion Window",
                    "description": f"{rmd['summary']['years_until_rmd']} years until RMDs begin",
                    "impact": "Opportunity to reduce future RMDs through Roth conversions",
                    "action": "Maximize conversions in lower brackets before RMDs start",
                }
            )

        # Check for QCD opportunity
        if rmd["qcd_eligible"] and rmd["current"]["required"]:
            recommendations.append(
                {
                    "priority": 4,
                    "category": "Charitable Giving",
                    "title": "Qualified Charitable Distribution",
                    "description": f"Use QCDs to satisfy ${rmd['current']['rmd_amount']:,.0f} RMD",
                    "impact": "Reduce taxable income while fulfilling charitable goals",
                    "action": "Direct RMD to qualified charities (up to $105,000)",
                }
            )

        # Check state tax savings
        current_state = snapshot["settings"]["state"]
        if current_state not in NO_INCOME_TAX_STATES:
            no_tax_savings = next(
                (s["savings_vs_current"] for s in states if s["no_income_tax"]), 0
            )
            if no_tax_savings > 5000:
                recommendations.append(
                    {
                        "priority": 5,
                        "category": "State Taxes",
                        "title": "State Tax Relocation",
                        "description": f"Moving to a no-income-tax state could save ${no_tax_savings:,.0f}/year",
                        "impact": "Long-term tax savings opportunity",
                        "action": "Consider if relocation aligns with retirement goals",
                    }
                )

        # Check marginal rate
        marginal = snapshot["rates"]["marginal_rate"]
        if marginal >= 32:
            recommendations.append(
                {
                    "priority": 6,
                    "category": "Tax Bracket",
                    "title": "High Marginal Rate Alert",
                    "description": f"Current marginal rate: {marginal}%",
                    "impact": "Consider income timing and deduction strategies",
                    "action": "Review opportunities to defer income or accelerate deductions",
                }
            )

        # Sort by priority
        recommendations.sort(key=lambda x: x["priority"])

        return recommendations
