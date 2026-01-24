"""Retirement planning business logic and financial modeling.

Authored by: pan

Key Features:
- Monte Carlo simulation for retirement planning
- Pre-retirement: Salary covers expenses, surplus goes to retirement accounts
- Post-retirement: Expenses funded from investment returns/withdrawals
- 401k/IRA contributions with employer matching
- Tax-optimized withdrawal strategies
- Home equity and property management
- Social Security and pension integration
"""
import numpy as np
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict


def safe_float(value, default=0.0):
    """Safely convert a value to float, handling None and invalid values."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


@dataclass
class Person:
    name: str
    birth_date: datetime
    retirement_date: datetime
    social_security: float
    ss_claiming_age: int = 67  # New: Social Security claiming age
    annual_401k_contribution: float = 0.0  # Annual 401k/403b contribution
    employer_match_rate: float = 0.0  # Employer match as % of salary (e.g., 0.06 for 6%)
@dataclass
class FinancialProfile:
    person1: Person
    person2: Person
    children: List[Dict]
    liquid_assets: float
    traditional_ira: float
    roth_ira: float
    pension_lump_sum: float
    pension_annual: float
    annual_expenses: float
    target_annual_income: float
    risk_tolerance: str
    asset_allocation: Dict[str, float]
    future_expenses: List[Dict]
    investment_types: List[Dict] = None
    accounts: List[Dict] = None
    income_streams: List[Dict] = None
    home_properties: List[Dict] = None
    budget: Dict = None
    annual_ira_contribution: float = 0.0  # Annual IRA contribution
    savings_allocation: Dict[str, float] = None  # How to allocate surplus: {'pretax': 0.7, 'roth': 0.2, 'taxable': 0.1}
    filing_status: str = 'mfj'  # 'mfj', 'single', 'hoh'
    state: str = 'NY'  # State for tax calculations
@dataclass
class MarketAssumptions:
    """Market and economic assumptions for financial modeling"""
    # Allocations (Sum should ideally be 1.0)
    stock_allocation: float = 0.5
    bond_allocation: float = 0.4
    cash_allocation: float = 0.1
    reit_allocation: float = 0.0
    gold_allocation: float = 0.0
    crypto_allocation: float = 0.0

    # Returns (Mean)
    stock_return_mean: float = 0.10
    bond_return_mean: float = 0.04
    cash_return_mean: float = 0.015
    reit_return_mean: float = 0.08
    gold_return_mean: float = 0.04
    crypto_return_mean: float = 0.20
    inflation_mean: float = 0.03

    # Risk (Std Dev)
    stock_return_std: float = 0.18
    bond_return_std: float = 0.06
    cash_return_std: float = 0.005
    reit_return_std: float = 0.15
    gold_return_std: float = 0.15
    crypto_return_std: float = 0.60
    inflation_std: float = 0.01
    ss_discount_rate: float = 0.03
class RetirementModel:
    def __init__(self, profile: FinancialProfile):
        self.profile = profile
        self.current_year = datetime.now().year
    def calculate_life_expectancy_years(self, person: Person, target_age: int = 90):
        age_now = (datetime.now() - person.birth_date).days / 365.25
        return int(target_age - age_now)

    def get_standard_deduction(self, current_cpi: np.ndarray = 1.0) -> np.ndarray:
        """Get inflation-adjusted standard deduction based on filing status."""
        filing_status = getattr(self.profile, 'filing_status', 'mfj')
        if filing_status == 'single':
            base = 14600
        elif filing_status == 'hoh':
            base = 21900
        else:  # mfj
            base = 29200
        return base * current_cpi

    # =========================================================================
    # Vectorized Tax Helper Functions
    # =========================================================================

    def _vectorized_federal_tax(self, taxable_income: np.ndarray,
                                filing_status: str = None) -> tuple:
        """Calculate federal income tax using progressive brackets.

        Args:
            taxable_income: Array of taxable income values (after deductions)
            filing_status: 'mfj', 'single', 'mfs', 'hoh'. If None, use profile default.

        Returns:
            Tuple of (total_tax array, marginal_rate array)
        """
        if filing_status is None:
            filing_status = getattr(self.profile, 'filing_status', 'mfj')

        # 2024 MFJ brackets (default) - can be extended for other statuses
        if filing_status == 'single':
            brackets = [
                (0, 11600, 0.10),
                (11600, 47150, 0.12),
                (47150, 100525, 0.22),
                (100525, 191950, 0.24),
                (191950, 243725, 0.32),
                (243725, 609350, 0.35),
                (609350, float('inf'), 0.37),
            ]
        elif filing_status == 'hoh':
            brackets = [
                (0, 16550, 0.10),
                (16550, 63100, 0.12),
                (63100, 100500, 0.22),
                (100500, 191950, 0.24),
                (191950, 243700, 0.32),
                (243700, 609350, 0.35),
                (609350, float('inf'), 0.37),
            ]
        else:  # MFJ (default for retired couples)
            brackets = [
                (0, 23200, 0.10),
                (23200, 94300, 0.12),
                (94300, 201050, 0.22),
                (201050, 383900, 0.24),
                (383900, 487450, 0.32),
                (487450, 731200, 0.35),
                (731200, float('inf'), 0.37),
            ]

        total_tax = np.zeros_like(taxable_income, dtype=float)
        marginal_rate = np.zeros_like(taxable_income, dtype=float)

        for lower, upper, rate in brackets:
            # Income in this bracket
            in_bracket = np.clip(taxable_income - lower, 0, upper - lower)
            total_tax += in_bracket * rate
            # Update marginal rate for incomes above this bracket's lower bound
            marginal_rate = np.where(taxable_income > lower, rate, marginal_rate)

        return total_tax, marginal_rate

    def _vectorized_taxable_ss(self, other_income: np.ndarray,
                               ss_benefit: np.ndarray,
                               filing_status: str = None) -> np.ndarray:
        """Calculate taxable portion of Social Security benefits.

        Uses provisional income formula:
        Provisional = AGI (excluding SS) + 50% of SS + tax-exempt interest

        Args:
            other_income: Array of AGI excluding SS (pensions, RMDs, withdrawals, etc.)
            ss_benefit: Array of total SS benefits received
            filing_status: 'mfj' or 'single'

        Returns:
            Array of taxable SS amounts (0%, 50%, or 85% of benefits)
        """
        if filing_status is None:
            filing_status = getattr(self.profile, 'filing_status', 'mfj')

        # Calculate provisional income
        provisional = other_income + (ss_benefit * 0.5)

        # Thresholds depend on filing status
        if filing_status == 'mfj':
            threshold_1 = 32000  # Below: 0% taxable
            threshold_2 = 44000  # Above: up to 85% taxable
        else:  # single/hoh
            threshold_1 = 25000
            threshold_2 = 34000

        # Calculate taxable portion (complex IRS formula simplified)
        taxable_ss = np.zeros_like(ss_benefit)

        # Between threshold_1 and threshold_2: up to 50% taxable
        in_middle = (provisional > threshold_1) & (provisional <= threshold_2)
        excess_1 = np.maximum(0, provisional - threshold_1)
        taxable_ss = np.where(in_middle,
                              np.minimum(ss_benefit * 0.5, excess_1 * 0.5),
                              taxable_ss)

        # Above threshold_2: up to 85% taxable
        above_threshold_2 = provisional > threshold_2
        excess_2 = np.maximum(0, provisional - threshold_2)
        # Start with 50% of amount between thresholds
        base_taxable = (threshold_2 - threshold_1) * 0.5
        # Add 85% of excess above threshold_2
        additional = excess_2 * 0.85
        max_85 = ss_benefit * 0.85
        taxable_ss = np.where(above_threshold_2,
                              np.minimum(max_85, base_taxable + additional),
                              taxable_ss)

        return taxable_ss

    def _vectorized_ltcg_tax(self, gains: np.ndarray,
                             ordinary_income: np.ndarray,
                             filing_status: str = None) -> np.ndarray:
        """Calculate long-term capital gains tax with income stacking.

        LTCG rates depend on total income (ordinary + gains stacked on top).

        Args:
            gains: Array of long-term capital gains
            ordinary_income: Array of ordinary taxable income (before LTCG)
            filing_status: 'mfj' or 'single'

        Returns:
            Array of LTCG tax amounts
        """
        if filing_status is None:
            filing_status = getattr(self.profile, 'filing_status', 'mfj')

        # 2024 LTCG brackets (thresholds for total taxable income including gains)
        if filing_status == 'mfj':
            threshold_0 = 94050    # 0% up to here
            threshold_15 = 583750  # 15% up to here, 20% above
        else:  # single/hoh
            threshold_0 = 47025
            threshold_15 = 518900

        total_income = ordinary_income + gains
        ltcg_tax = np.zeros_like(gains)

        # Calculate how much of gains falls in each bracket
        # Gains "stack" on top of ordinary income

        # Room in 0% bracket
        room_0 = np.maximum(0, threshold_0 - ordinary_income)
        gains_at_0 = np.minimum(gains, room_0)
        remaining_gains = gains - gains_at_0

        # Room in 15% bracket (after 0% bracket filled)
        income_after_0 = np.maximum(ordinary_income, threshold_0)
        room_15 = np.maximum(0, threshold_15 - income_after_0)
        gains_at_15 = np.minimum(remaining_gains, room_15)
        remaining_gains = remaining_gains - gains_at_15

        # Remainder at 20%
        gains_at_20 = remaining_gains

        # Calculate total LTCG tax
        ltcg_tax = (gains_at_0 * 0.0) + (gains_at_15 * 0.15) + (gains_at_20 * 0.20)

        return ltcg_tax

    def _vectorized_irmaa(self, magi: np.ndarray,
                          filing_status: str = None,
                          both_on_medicare: bool = True) -> np.ndarray:
        """Calculate Medicare IRMAA surcharges based on MAGI.

        IRMAA = Income-Related Monthly Adjustment Amount
        Applies to Medicare Part B and Part D premiums for high earners.

        Args:
            magi: Array of Modified AGI (2 years prior, but we use current as proxy)
            filing_status: 'mfj' or 'single'
            both_on_medicare: If True, doubles surcharge for married couples

        Returns:
            Array of annual IRMAA surcharges
        """
        if filing_status is None:
            filing_status = getattr(self.profile, 'filing_status', 'mfj')

        # 2024 IRMAA thresholds and annual surcharges (Part B + Part D combined)
        if filing_status == 'mfj':
            thresholds = [
                (0, 206000, 0),           # No surcharge
                (206000, 258000, 839.40),  # Tier 1
                (258000, 322000, 2097.60), # Tier 2
                (322000, 386000, 3355.20), # Tier 3
                (386000, 750000, 4612.80), # Tier 4
                (750000, float('inf'), 5030.40),  # Tier 5
            ]
        else:  # single/hoh
            thresholds = [
                (0, 103000, 0),
                (103000, 129000, 839.40),
                (129000, 161000, 2097.60),
                (161000, 193000, 3355.20),
                (193000, 500000, 4612.80),
                (500000, float('inf'), 5030.40),
            ]

        irmaa = np.zeros_like(magi)
        for lower, upper, surcharge in thresholds:
            in_tier = (magi > lower) & (magi <= upper)
            irmaa = np.where(in_tier, surcharge, irmaa)

        # Handle top tier (above highest threshold)
        top_threshold = thresholds[-1][0]
        top_surcharge = thresholds[-1][2]
        irmaa = np.where(magi > top_threshold, top_surcharge, irmaa)

        # Double if both spouses on Medicare
        if both_on_medicare and filing_status == 'mfj':
            irmaa = irmaa * 2

        return irmaa

    def _calculate_employment_tax(self, gross_income: np.ndarray,
                                  state_rate: float = 0.05,
                                  current_cpi: np.ndarray = 1.0) -> np.ndarray:
        """Estimate total taxes on employment income.

        Includes:
        - FICA (Social Security 6.2% up to wage base + Medicare 1.45%)
        - Estimated federal income tax
        - State income tax (flat rate approximation)

        Args:
            gross_income: Array of gross employment income
            state_rate: State income tax rate (default 5%)
            current_cpi: CPI multiplier for standard deduction

        Returns:
            Array of estimated total employment taxes
        """
        # 2024 Social Security wage base
        SS_WAGE_BASE = 168600
        SS_RATE = 0.062
        MEDICARE_RATE = 0.0145

        # FICA taxes
        ss_tax = np.minimum(gross_income, SS_WAGE_BASE) * SS_RATE
        medicare_tax = gross_income * MEDICARE_RATE
        fica = ss_tax + medicare_tax

        # Estimate federal tax (using progressive brackets on AGI estimate)
        std_deduction = self.get_standard_deduction(current_cpi)
        taxable = np.maximum(0, gross_income - std_deduction)
        federal_tax, _ = self._vectorized_federal_tax(taxable)

        # State tax (simplified flat rate)
        state_tax = gross_income * state_rate

        return fica + federal_tax + state_tax

    def _validate_market_periods(self, years: int, market_periods: Dict = None) -> List[str]:
        """Validate market periods and return warnings for unrealistic scenarios.

        Args:
            years: Total years to simulate
            market_periods: Market period definitions

        Returns:
            List of warning messages
        """
        warnings = []

        if not market_periods:
            return warnings

        period_type = market_periods.get('type', 'timeline')

        if period_type == 'timeline':
            periods = market_periods.get('periods', [])

            # Check for unrealistic duration of extreme market conditions
            for period in periods:
                duration = period['end_year'] - period['start_year'] + 1
                assumptions = period.get('assumptions', {})

                # Warn about prolonged recessions (>5 years)
                stock_return = assumptions.get('stock_return_mean', 0.10)
                if stock_return < 0.06 and duration > 5:
                    warnings.append(
                        f"⚠️ Unrealistic: {duration}-year recession ({period['start_year']}-{period['end_year']}). "
                        f"Historical recessions typically last 1-3 years."
                    )

                # Warn about prolonged bull markets (>15 years)
                if stock_return > 0.12 and duration > 15:
                    warnings.append(
                        f"⚠️ Unrealistic: {duration}-year bull market ({period['start_year']}-{period['end_year']}). "
                        f"Sustained high returns over such long periods are historically rare."
                    )

                # Warn about extremely long single-period scenarios
                if duration >= years * 0.8:  # Period covers 80%+ of retirement
                    warnings.append(
                        f"⚠️ Warning: Single market condition spans {duration} of {years} years. "
                        f"Consider modeling multiple market cycles for more realistic projections."
                    )

            # Check for gaps in timeline
            sorted_periods = sorted(periods, key=lambda p: p['start_year'])
            for i in range(len(sorted_periods) - 1):
                current_end = sorted_periods[i]['end_year']
                next_start = sorted_periods[i + 1]['start_year']
                if next_start > current_end + 1:
                    gap_years = next_start - current_end - 1
                    warnings.append(
                        f"ℹ️ Gap detected: {gap_years} years between periods ({current_end + 1}-{next_start - 1}). "
                        f"Historical market assumptions will be used for these years."
                    )

        elif period_type == 'cycle':
            pattern = market_periods.get('pattern', [])

            # Check cycle realism
            cycle_length = sum(p.get('duration', 0) for p in pattern)

            if cycle_length < 3:
                warnings.append(
                    f"⚠️ Very short market cycle ({cycle_length} years). "
                    f"Real market cycles typically span 7-10 years."
                )

            # Check for unrealistic pattern elements
            for idx, pattern_elem in enumerate(pattern):
                duration = pattern_elem.get('duration', 0)
                assumptions = pattern_elem.get('assumptions', {})
                stock_return = assumptions.get('stock_return_mean', 0.10)

                if stock_return < 0.06 and duration > 5:
                    warnings.append(
                        f"⚠️ Pattern element {idx + 1}: {duration}-year recession phase is unrealistically long. "
                        f"Consider 1-3 years for recession phases."
                    )

        return warnings

    def _build_period_assumptions_lookup(self, years: int, market_periods: Dict = None, default_assumptions: MarketAssumptions = None) -> Dict[int, MarketAssumptions]:
        """Build a year-by-year lookup of market assumptions from period definitions.

        Args:
            years: Total number of years to simulate
            market_periods: Dict with either 'timeline' or 'cycle' periods
            default_assumptions: Fallback assumptions if no periods defined

        Returns:
            Dict mapping year_index -> MarketAssumptions for that year
        """
        if default_assumptions is None:
            default_assumptions = MarketAssumptions()

        year_assumptions = {}

        if not market_periods:
            # No periods defined - use default assumptions for all years
            for year_idx in range(years):
                year_assumptions[year_idx] = default_assumptions
            return year_assumptions

        period_type = market_periods.get('type', 'timeline')

        if period_type == 'timeline':
            # Timeline: explicit year ranges with specific assumptions
            periods = market_periods.get('periods', [])

            # Sort periods by start_year
            sorted_periods = sorted(periods, key=lambda p: p.get('start_year', 0))

            # Build year-by-year lookup
            for year_idx in range(years):
                simulation_year = self.current_year + year_idx
                found_period = False

                # Find which period this year falls into
                for period in sorted_periods:
                    if period['start_year'] <= simulation_year <= period['end_year']:
                        # Use this period's assumptions
                        period_data = period['assumptions']
                        year_assumptions[year_idx] = MarketAssumptions(
                            stock_return_mean=period_data.get('stock_return_mean', default_assumptions.stock_return_mean),
                            stock_return_std=period_data.get('stock_return_std', default_assumptions.stock_return_std),
                            bond_return_mean=period_data.get('bond_return_mean', default_assumptions.bond_return_mean),
                            bond_return_std=period_data.get('bond_return_std', default_assumptions.bond_return_std),
                            inflation_mean=period_data.get('inflation_mean', default_assumptions.inflation_mean),
                            inflation_std=period_data.get('inflation_std', default_assumptions.inflation_std),
                            stock_allocation=default_assumptions.stock_allocation  # Use base allocation
                        )
                        found_period = True
                        break

                # If no period defined for this year, use default
                if not found_period:
                    year_assumptions[year_idx] = default_assumptions

        elif period_type == 'cycle':
            # Cycle: repeating pattern of market conditions
            pattern = market_periods.get('pattern', [])
            repeat = market_periods.get('repeat', True)

            if not pattern:
                # No pattern - use default
                for year_idx in range(years):
                    year_assumptions[year_idx] = default_assumptions
                return year_assumptions

            # Calculate total cycle length
            cycle_length = sum(p.get('duration', 0) for p in pattern)

            if cycle_length == 0:
                # Invalid cycle - use default
                for year_idx in range(years):
                    year_assumptions[year_idx] = default_assumptions
                return year_assumptions

            # Build year-by-year lookup
            for year_idx in range(years):
                if repeat:
                    # Repeating cycle - use modulo to wrap around
                    cycle_position = year_idx % cycle_length
                else:
                    # Non-repeating - after cycle completes, use default
                    if year_idx >= cycle_length:
                        year_assumptions[year_idx] = default_assumptions
                        continue
                    cycle_position = year_idx

                # Find which pattern element this position falls into
                cumulative_duration = 0
                for pattern_elem in pattern:
                    duration = pattern_elem.get('duration', 0)
                    if cycle_position < cumulative_duration + duration:
                        # This is the active pattern element
                        period_data = pattern_elem['assumptions']
                        year_assumptions[year_idx] = MarketAssumptions(
                            stock_return_mean=period_data.get('stock_return_mean', default_assumptions.stock_return_mean),
                            stock_return_std=period_data.get('stock_return_std', default_assumptions.stock_return_std),
                            bond_return_mean=period_data.get('bond_return_mean', default_assumptions.bond_return_mean),
                            bond_return_std=period_data.get('bond_return_std', default_assumptions.bond_return_std),
                            inflation_mean=period_data.get('inflation_mean', default_assumptions.inflation_mean),
                            inflation_std=period_data.get('inflation_std', default_assumptions.inflation_std),
                            stock_allocation=default_assumptions.stock_allocation
                        )
                        break
                    cumulative_duration += duration

        return year_assumptions

    def monte_carlo_simulation(self, years: int, simulations: int = 10000, assumptions: MarketAssumptions = None, effective_tax_rate: float = 0.22, spending_model: str = 'constant_real', market_periods: Dict = None):
        """Run Monte Carlo simulation using vectorized NumPy operations for high performance.

        Args:
            years: Number of years to simulate
            simulations: Number of Monte Carlo simulations to run
            assumptions: Base market assumptions (used if market_periods not provided)
            effective_tax_rate: Effective tax rate for calculations
            spending_model: Spending pattern model ('constant_real', 'retirement_smile', 'conservative_decline')
            market_periods: Optional period-based market conditions (timeline or cycle)
        """
        if assumptions is None:
            assumptions = MarketAssumptions()

        base_stock_pct = assumptions.stock_allocation

        # Validate market periods and collect warnings
        period_warnings = self._validate_market_periods(years, market_periods)

        # Build year-by-year market assumptions lookup
        period_assumptions = self._build_period_assumptions_lookup(years, market_periods, assumptions)
        
        # 1. Initialize Account Vectors (shape: (simulations,))
        start_cash = 0.0
        start_taxable_val = 0.0
        start_taxable_basis = 0.0
        start_pretax_std = 0.0
        start_pretax_457 = 0.0
        start_roth = 0.0

        inv_types = self.profile.investment_types or []
        for inv in inv_types:
            acc = inv.get('account', 'Liquid')
            val = safe_float(inv.get('value', 0))
            basis = safe_float(inv.get('cost_basis', 0))
            
            if acc in ['Checking', 'Savings']:
                start_cash += val
            elif acc in ['Liquid', 'Taxable Brokerage']:
                start_taxable_val += val
                start_taxable_basis += basis
            elif acc in ['Traditional IRA', '401k', '403b', '401a']:
                start_pretax_std += val
            elif acc == '457b':
                start_pretax_457 += val
            elif acc == 'Roth IRA':
                start_roth += val
            elif acc == 'Pension':
                start_pretax_std += val  # Lump sum opportunity

        # Initialize vectors
        cash = np.full(simulations, start_cash)
        taxable_val = np.full(simulations, start_taxable_val)
        taxable_basis = np.full(simulations, start_taxable_basis)
        pretax_std = np.full(simulations, start_pretax_std)
        pretax_457 = np.full(simulations, start_pretax_457)
        roth = np.full(simulations, start_roth)

        # 2. Pre-calculate Market Factors (shape: (simulations, years))
        # Inflation - now period-specific
        inflation_rates = np.zeros((simulations, years))
        for year_idx in range(years):
            year_assumptions = period_assumptions.get(year_idx, assumptions)
            inflation_rates[:, year_idx] = np.random.normal(year_assumptions.inflation_mean, year_assumptions.inflation_std, simulations)
        
        # Calculate Returns per year (Dynamic stock pct based on glide path)
        # cpi[:, 0] is 1.0. cpi[:, t] = product(1+inf) up to t-1
        current_cpi = np.ones(simulations)

        # 3. Income & Expense Constants
        base_ss = (self.profile.person1.social_security + self.profile.person2.social_security) * 12
        base_pension = self.profile.pension_annual
        
        # Prepare Income Streams data structure for fast access
        income_streams_data = []
        if self.profile.income_streams:
            for s in self.profile.income_streams:
                try:
                    start_year = datetime.fromisoformat(s['start_date']).year
                    income_streams_data.append({
                        'amount': safe_float(s.get('amount', 0)),
                        'start_year': start_year,
                        'inflation_adjusted': s.get('inflation_adjusted', True),
                        'type': s.get('type', 'other')
                    })
                except: pass

        # Prepare Homes data structure (Vectorized)
        home_props_state = []
        if self.profile.home_properties:
            for prop in self.profile.home_properties:
                prop_val = safe_float(prop.get('current_value', 0))
                prop_mort = safe_float(prop.get('mortgage_balance', 0))
                prop_costs = (
                    safe_float(prop.get('annual_property_tax', 0)) +
                    safe_float(prop.get('annual_insurance', 0)) +
                    safe_float(prop.get('annual_maintenance', 0)) +
                    safe_float(prop.get('annual_hoa', 0))
                )

                sale_year = None
                if prop.get('planned_sale_date'):
                    try:
                        sale_year = datetime.fromisoformat(prop['planned_sale_date']).year
                    except: pass

                home_props_state.append({
                    'values': np.full(simulations, prop_val),
                    'mortgages': np.full(simulations, prop_mort),
                    'annual_costs': np.full(simulations, prop_costs),
                    'appreciation_rate': safe_float(prop.get('appreciation_rate') or assumptions.inflation_mean),
                    'sale_year': sale_year,
                    'purchase_price': safe_float(prop.get('purchase_price') or prop_val),
                    'property_type': prop.get('property_type', 'Primary Residence'),
                    'replacement_cost': safe_float(prop.get('replacement_value', 0)),
                    'is_sold': np.zeros(simulations, dtype=bool) # Track sold state
                })

        # Constants
        EARLY_PENALTY = 0.10
        CASH_INTEREST = 0.015
        STANDARD_DEDUCTION_BASE = 29200  # 2024 MFJ standard deduction
        
        # Result Storage
        all_paths = np.zeros((simulations, years))
        p1_birth_year = self.profile.person1.birth_date.year
        p2_birth_year = self.profile.person2.birth_date.year
        p1_retirement_year = self.profile.person1.retirement_date.year
        p2_retirement_year = self.profile.person2.retirement_date.year

        # Pre-calculate Spending Multipliers based on Model
        spending_multipliers = np.ones(years)
        if spending_model == 'retirement_smile':
            for i in range(years):
                age = (self.current_year + i) - p1_birth_year
                if age < 70:
                    spending_multipliers[i] = 1.0
                elif 70 <= age < 80:
                    spending_multipliers[i] = 1.0 - ((age - 70) * 0.02)
                else: 
                    spending_multipliers[i] = 0.8 + ((age - 80) * 0.02)
        elif spending_model == 'conservative_decline':
            for i in range(years):
                age = (self.current_year + i) - p1_birth_year
                if age > 70:
                    spending_multipliers[i] = max(0.6, 1.0 - ((age - 70) * 0.01))

        # 4. Simulation Loop (Year by Year)
        for year_idx in range(years):
            simulation_year = self.current_year + year_idx
            p1_age = simulation_year - p1_birth_year
            p2_age = simulation_year - p2_birth_year
            
            # Dynamic Asset Allocation (Glide Path)
            # Reduce stock pct by 1% each year after 65, down to min 20%
            stock_pct = base_stock_pct
            if p1_age > 65:
                reduction = (p1_age - 65) * 0.01
                stock_pct = max(0.20, base_stock_pct - reduction)

            # Get market assumptions for this specific year
            year_assumptions = period_assumptions.get(year_idx, assumptions)

            # --- Multi-Asset Portfolio Calculation ---
            # Basic allocation from assumptions
            allocs = {
                'stock': year_assumptions.stock_allocation,
                'bond': year_assumptions.bond_allocation,
                'cash': year_assumptions.cash_allocation,
                'reit': year_assumptions.reit_allocation,
                'gold': year_assumptions.gold_allocation,
                'crypto': year_assumptions.crypto_allocation
            }
            
            # Apply Dynamic Glide Path (Equity reduction after 65)
            if p1_age > 65:
                reduction = (p1_age - 65) * 0.01
                old_stock = allocs['stock']
                new_stock = max(0.20, old_stock - reduction)
                allocs['stock'] = new_stock
                
                # Re-distribute the reduction to bonds (conservative shift)
                allocs['bond'] += (old_stock - new_stock)

            # Calculate Portfolio Mean Return
            ret_mean = (
                allocs['stock'] * year_assumptions.stock_return_mean +
                allocs['bond'] * year_assumptions.bond_return_mean +
                allocs['cash'] * year_assumptions.cash_return_mean +
                allocs['reit'] * year_assumptions.reit_return_mean +
                allocs['gold'] * year_assumptions.gold_return_mean +
                allocs['crypto'] * year_assumptions.crypto_return_mean
            )

            # Calculate Portfolio Volatility (Variance-Covariance)
            # Simplification: Use weighted average of variances for additional assets 
            # to avoid huge correlation matrix requirement. 
            # Stock/Bond correlation remains 0.3.
            stock_var = (allocs['stock'] * year_assumptions.stock_return_std) ** 2
            bond_var = (allocs['bond'] * year_assumptions.bond_return_std) ** 2
            sb_cov = 2 * allocs['stock'] * allocs['bond'] * 0.3 * year_assumptions.stock_return_std * year_assumptions.bond_return_std
            
            other_var = (
                (allocs['cash'] * year_assumptions.cash_return_std) ** 2 +
                (allocs['reit'] * year_assumptions.reit_return_std) ** 2 +
                (allocs['gold'] * year_assumptions.gold_return_std) ** 2 +
                (allocs['crypto'] * year_assumptions.crypto_return_std) ** 2
            )
            
            ret_std = np.sqrt(stock_var + bond_var + sb_cov + other_var)

            annual_returns = np.random.normal(ret_mean, ret_std, simulations)

            # Independent Retirement Tracking
            p1_retired = simulation_year >= p1_retirement_year
            p2_retired = simulation_year >= p2_retirement_year
            
            # A. Update CPI (except year 0)
            if year_idx > 0:
                current_cpi *= (1 + inflation_rates[:, year_idx])

            # Inflation-indexed tax thresholds (prevent bracket creep)
            std_deduction = self.get_standard_deduction(current_cpi)

            # B. Calculate Income with Proper Tax Treatment
            # Track income components separately for accurate tax calculations

            # B1. Social Security Benefits (inflation-adjusted)
            p1_ss_eligible = p1_age >= self.profile.person1.ss_claiming_age
            p2_ss_eligible = p2_age >= self.profile.person2.ss_claiming_age
            
            p1_ss_amt = (self.profile.person1.social_security * 12) if p1_ss_eligible else 0
            p2_ss_amt = (self.profile.person2.social_security * 12) if p2_ss_eligible else 0
            gross_ss = (p1_ss_amt + p2_ss_amt) * current_cpi  # Total SS before taxation

            # B2. Pension Income (taxable as ordinary income)
            active_pension = (base_pension if p1_retired else 0) * current_cpi

            # B3. Other Income Streams (pensions, annuities, salary - taxable)
            other_taxable_income = np.zeros(simulations)
            employment_income_from_streams = np.zeros(simulations)
            for stream in income_streams_data:
                if simulation_year >= stream['start_year']:
                    amount = stream['amount'] * (current_cpi if stream['inflation_adjusted'] else 1.0)
                    if stream.get('type') == 'salary':
                        employment_income_from_streams += amount
                    else:
                        other_taxable_income += amount

            # B4. Budget Income (employment, rental, etc.)
            employment_income_from_budget = np.zeros(simulations)
            budget_income_other = np.zeros(simulations)
            if self.profile.budget:
                budget_income_total, employment_income_from_budget = self.calculate_budget_income(simulation_year, current_cpi, p1_retired, p2_retired)
                # Budget income that is not employment (rental, etc.)
                budget_income_other = budget_income_total - employment_income_from_budget

            # Combined employment income (Salary from streams + Budget employment)
            employment_income_gross = employment_income_from_streams + employment_income_from_budget
            # Combined non-employment ordinary income (Pension + Other Streams + Rental/Other Budget)
            other_ordinary_income_gross = active_pension + other_taxable_income + budget_income_other

            # --- Tax step 1: FICA and State Tax (Applied to gross income) ---
            fica_tax = np.zeros(simulations)
            state_tax_paid = np.zeros(simulations)
            
            # FICA only on employment income
            if np.any(employment_income_gross > 0):
                SS_WAGE_BASE = 168600
                ss_tax = np.minimum(employment_income_gross, SS_WAGE_BASE) * 0.062
                med_tax = employment_income_gross * 0.0145
                fica_tax = ss_tax + med_tax
            
            # State tax on ALL taxable ordinary income (Simplified flat rate)
            state_rate = 0.05 # Default
            state_tax_paid = (employment_income_gross + other_ordinary_income_gross) * state_rate

            # --- Tax Step 2: Social Security Taxation ---
            taxable_ss = self._vectorized_taxable_ss(employment_income_gross + other_ordinary_income_gross, gross_ss)

            # --- Tax Step 3: Combined Federal Income Tax ---
            total_ordinary_taxable_gross = employment_income_gross + other_ordinary_income_gross + taxable_ss
            taxable_income_federal = np.maximum(0, total_ordinary_taxable_gross - std_deduction)
            
            fed_tax_paid, _ = self._vectorized_federal_tax(taxable_income_federal)

            # --- Tax Step 4: IRMAA ---
            irmaa_expense = np.zeros(simulations)
            if p1_age >= 65 or p2_age >= 65:
                # MAGI ≈ AGI (Total Ordinary Taxable Gross)
                both_on_medicare = (p1_age >= 65) and (p2_age >= 65)
                irmaa_expense = self._vectorized_irmaa(total_ordinary_taxable_gross, both_on_medicare=both_on_medicare)

            # --- Net Cash Available Before Withdrawals ---
            total_tax_on_income = fed_tax_paid + state_tax_paid + fica_tax
            total_income = (total_ordinary_taxable_gross + (gross_ss - taxable_ss)) - total_tax_on_income

            # Track cumulative ordinary income for stacking withdrawals later
            cumulative_ordinary_gross = total_ordinary_taxable_gross.copy()


            # C. Calculate Expenses
            current_housing_costs = np.zeros(simulations)
            for prop in home_props_state:
                unsold_mask = ~prop['is_sold']
                current_housing_costs += np.where(unsold_mask, prop['annual_costs'], 0)
            
            current_housing_costs *= current_cpi
            spending_mult = spending_multipliers[year_idx]

            # Calculate expenses based on profile data
            # Spending strategy (constant_real, retirement_smile, conservative_decline) acts as a MULTIPLIER
            # on actual expenses (excluding housing which remains constant)
            if self.profile.budget:
                # Use actual expenses from Budget/Expenses tab
                target_spending = self.calculate_budget_expenses(simulation_year, current_cpi, p1_retired, p2_retired, current_housing_costs)
                # Apply spending multiplier to non-housing expenses
                # This models how spending patterns change (e.g., less travel when older, more healthcare)
                if spending_mult != 1.0:
                    target_spending = ((target_spending - current_housing_costs) * spending_mult) + current_housing_costs
            else:
                # Fallback to simple target income approach
                target_spending = (self.profile.target_annual_income * current_cpi * spending_mult) + current_housing_costs

            # Add IRMAA surcharges for high-income Medicare beneficiaries
            target_spending += irmaa_expense

            # D. Calculate Shortfall/Surplus
            # During working years: income typically exceeds expenses → surplus saved to investments
            # During retirement: expenses typically exceed income → shortfall withdrawn from investments
            net_cash_flow = total_income - target_spending
            shortfall = np.maximum(0, -net_cash_flow)  # Positive when expenses > income (need withdrawals)
            surplus = np.maximum(0, net_cash_flow)     # Positive when income > expenses (can save)

            # D2. Handle Pre-Retirement Contributions and Surplus
            # When working: add salary surplus and retirement contributions to investment accounts
            # This grows the portfolio before retirement, accounting for:
            # - 401k/403b contributions (pre-tax)
            # - Employer matching contributions (free money!)
            # - IRA contributions (split between traditional and Roth)
            # - General savings from surplus income
            if not p1_retired or not p2_retired:
                # Get employment income for calculating employer match
                employment_income = 0
                if self.profile.budget:
                    current_employment = self.profile.budget.get('income', {}).get('current', {}).get('employment', {})
                    if not p1_retired:
                        employment_income += current_employment.get('primary_person', 0)
                    if not p2_retired:
                        employment_income += current_employment.get('spouse', 0)

                # Person 1 contributions (if working)
                if not p1_retired:
                    p1_401k = safe_float(self.profile.person1.annual_401k_contribution, 0)
                    if p1_401k > 0:
                        pretax_std += p1_401k  # Add 401k contribution
                        # Add employer match
                        p1_salary = employment_income if not p2_retired else current_employment.get('primary_person', 0)
                        employer_match = p1_salary * safe_float(self.profile.person1.employer_match_rate, 0)
                        pretax_std += employer_match

                # Person 2 contributions (if working)
                if not p2_retired:
                    # For person2, we need to extract their salary separately
                    if self.profile.budget:
                        p2_salary = current_employment.get('spouse', 0)
                        # Note: Person dataclass doesn't have person2-specific 401k fields yet
                        # For now, use person1's fields as template - can be extended later

                # IRA contributions (from profile level)
                ira_contrib = safe_float(self.profile.annual_ira_contribution, 0)
                if ira_contrib > 0:
                    # Split between pretax and Roth based on allocation or default 50/50
                    pretax_std += ira_contrib * 0.5
                    roth += ira_contrib * 0.5

                # Handle remaining surplus - allocate to investment accounts
                if np.any(surplus > 0):
                    # Default allocation if not specified
                    savings_alloc = self.profile.savings_allocation or {
                        'pretax': 0.50,  # 50% to pre-tax (Traditional IRA/401k)
                        'roth': 0.30,    # 30% to Roth
                        'taxable': 0.20  # 20% to taxable brokerage
                    }

                    pretax_std += surplus * savings_alloc.get('pretax', 0.50)
                    roth += surplus * savings_alloc.get('roth', 0.30)
                    taxable_val += surplus * savings_alloc.get('taxable', 0.20)
                    # Note: For taxable, also increase basis since this is new money
                    taxable_basis += surplus * savings_alloc.get('taxable', 0.20)

            # E. Home Sales Logic
            for prop in home_props_state:
                if prop['sale_year'] and simulation_year == prop['sale_year']:
                    active_mask = ~prop['is_sold']
                    if np.any(active_mask):
                        gross_proceeds = prop['values']
                        mortgage_payoff = prop['mortgages']
                        transaction_costs = gross_proceeds * 0.06
                        gain = gross_proceeds - prop['purchase_price']
                        exclusion = 500000 if prop['property_type'] == 'Primary Residence' else 0
                        taxable_gain = np.maximum(0, gain - exclusion)
                        # Use income-stacked LTCG tax instead of flat 15%
                        capital_gains_tax = self._vectorized_ltcg_tax(taxable_gain, year_ordinary_income)
                        net_proceeds = gross_proceeds - mortgage_payoff - transaction_costs - capital_gains_tax
                        available_proceeds = net_proceeds - prop['replacement_cost']
                        taxable_val = np.where(active_mask, taxable_val + np.maximum(0, available_proceeds), taxable_val)
                        prop['is_sold'] = np.where(active_mask, True, prop['is_sold'])
                        prop['values'] = np.where(active_mask, 0, prop['values'])

            # F. RMD Logic (Age 73+ for either spouse)
            total_rmd = np.zeros(simulations)
            original_pretax = pretax_std.copy()
            rmd_factors = {
                73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
                78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
                83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
                88: 13.7, 89: 12.9, 90: 12.2
            }
            for age in [p1_age, p2_age]:
                if age >= 73:
                    factor = rmd_factors.get(int(age), 12.2)
                    curr_rmd = (original_pretax / 2.0) / factor
                    total_rmd += curr_rmd
            
            pretax_std -= total_rmd
            
            if np.any(total_rmd > 0):
                # Calculate tax on RMD (Stacked on existing ordinary income)
                taxable_with_rmd = np.maximum(0, cumulative_ordinary_gross + total_rmd - std_deduction)
                taxable_without_rmd = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                tax_with_rmd, _ = self._vectorized_federal_tax(taxable_with_rmd)
                tax_without_rmd, _ = self._vectorized_federal_tax(taxable_without_rmd)
                
                rmd_tax_fed = tax_with_rmd - tax_without_rmd
                rmd_tax_state = total_rmd * state_rate
                
                net_rmd = total_rmd - (rmd_tax_fed + rmd_tax_state)
                # Update cumulative ordinary income for future stacking
                cumulative_ordinary_gross += total_rmd
                
                used_for_shortfall = np.minimum(shortfall, net_rmd)
                shortfall -= used_for_shortfall
                taxable_val += (net_rmd - used_for_shortfall)

            # G. Optimized Withdrawal Strategy (Waterfall)
            # Sequence: Cash -> Taxable -> Pre-Tax -> Roth

            # 1. Cash (Already taxed, no growth)
            mask = shortfall > 0
            if np.any(mask):
                withdrawal = np.minimum(shortfall, cash)
                cash -= withdrawal
                shortfall -= withdrawal

            # 2. 457b (Special case: No early withdrawal penalty if separated from service)
            mask = (shortfall > 0)
            if np.any(mask) and p1_age < 59.5:
                # Estimate tax rate based on current stacked income
                taxable_now = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now)
                eff_rate = np.maximum(0.10, marginal_rate) + state_rate
                
                gross_needed = shortfall / np.maximum(0.01, 1 - eff_rate)
                withdrawal = np.minimum(gross_needed, pretax_457)
                pretax_457 -= withdrawal
                
                # Actual Tax Calculation
                tax_after, _ = self._vectorized_federal_tax(np.maximum(0, cumulative_ordinary_gross + withdrawal - std_deduction))
                tax_before, _ = self._vectorized_federal_tax(taxable_now)
                actual_fed_tax = tax_after - tax_before
                actual_state_tax = withdrawal * state_rate
                
                net_withdrawal = withdrawal - (actual_fed_tax + actual_state_tax)
                cumulative_ordinary_gross += withdrawal
                shortfall -= net_withdrawal

            # 3. Taxable Brokerage (Pay capital gains tax stacked on ordinary income)
            mask = shortfall > 0
            if np.any(mask):
                # Use large floor value to prevent numerical instability when account near zero
                STABILITY_FLOOR = 1000.0
                denom = np.where(taxable_val > STABILITY_FLOOR, taxable_val, 1e10)
                gain_ratio = np.maximum(0, (taxable_val - taxable_basis) / denom)
                gain_ratio = np.where(taxable_val > STABILITY_FLOOR, gain_ratio, 0)

                est_tax_rate = gain_ratio * 0.15 + state_rate
                gross_needed = shortfall / np.maximum(0.01, 1 - est_tax_rate)
                withdrawal = np.minimum(gross_needed, taxable_val)
                gains_realized = withdrawal * gain_ratio

                # Actual LTCG Tax
                ltcg_tax = self._vectorized_ltcg_tax(gains_realized, cumulative_ordinary_gross)
                state_gain_tax = gains_realized * state_rate
                net_withdrawal = withdrawal - (ltcg_tax + state_gain_tax)

                basis_ratio = np.where(taxable_val > 0, taxable_basis / taxable_val, 0)
                basis_reduction = withdrawal * basis_ratio

                taxable_val -= withdrawal
                taxable_basis -= basis_reduction
                shortfall -= net_withdrawal

            # 4. Pre-Tax (Traditional IRA/401k) - Subject to Ordinary Income Tax
            mask = shortfall > 0
            if np.any(mask):
                # Apply 10% penalty if under 59.5 (excluding 457b handled above)
                penalty = np.where(p1_age < 59.5, EARLY_PENALTY, 0)

                # Estimate tax rate based on current stacked income
                taxable_now = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now)
                eff_rate = np.maximum(0.10, marginal_rate) + state_rate + penalty

                gross_needed = shortfall / np.maximum(0.01, 1 - eff_rate)
                withdrawal = np.minimum(gross_needed, pretax_std)
                pretax_std -= withdrawal

                # Actual Tax Calculation
                tax_after, _ = self._vectorized_federal_tax(np.maximum(0, cumulative_ordinary_gross + withdrawal - std_deduction))
                tax_before, _ = self._vectorized_federal_tax(taxable_now)
                actual_fed_tax = (tax_after - tax_before) + (withdrawal * penalty)
                actual_state_tax = withdrawal * state_rate
                
                net_withdrawal = withdrawal - (actual_fed_tax + actual_state_tax)
                cumulative_ordinary_gross += withdrawal
                shortfall -= net_withdrawal

            # 5. Roth Assets (Tax-free, last resort to preserve tax-free growth)
            mask = shortfall > 0
            if np.any(mask):
                withdrawal = np.minimum(shortfall, roth)
                roth -= withdrawal
                shortfall -= withdrawal

            # H. Growth & Balances
            # Apply growth
            year_returns = annual_returns

            cash *= (1 + assumptions.cash_return_mean)

            # Taxable accounts: Apply tax drag
            TAX_DRAG_RATE = 0.15
            taxable_growth = np.where(year_returns > 0,
                                     year_returns * (1 - TAX_DRAG_RATE),
                                     year_returns)
            taxable_val *= (1 + taxable_growth)
            taxable_basis *= (1 + taxable_growth)

            pretax_std *= (1 + year_returns)
            pretax_457 *= (1 + year_returns)
            roth *= (1 + year_returns)
            
            # Grow homes
            for prop in home_props_state:
                apprec_mean = prop['appreciation_rate']
                apprec_std = 0.05
                apprec_vec = np.random.normal(apprec_mean, apprec_std, simulations)
                
                mask_unsold = ~prop['is_sold']
                prop['values'] = np.where(mask_unsold, prop['values'] * (1 + apprec_vec), 0)

            # Record total
            total_portfolio = cash + taxable_val + pretax_std + pretax_457 + roth
            # Floor at 0
            total_portfolio = np.maximum(0, total_portfolio)
            all_paths[:, year_idx] = total_portfolio

        # 5. Final Statistics
        ending_balances = all_paths[:, -1]
        success_count = np.sum(ending_balances > 0)
        success_rate = success_count / simulations

        # Add market period warnings to any other warnings
        all_warnings = period_warnings.copy() if period_warnings else []

        return {
            'success_rate': float(success_rate),
            'median_final_balance': float(np.median(ending_balances)),
            'percentile_10': float(np.percentile(ending_balances, 10)),
            'percentile_90': float(np.percentile(ending_balances, 90)),
            'expected_value': float(np.mean(ending_balances)),
            'std_deviation': float(np.std(ending_balances)),
            'starting_portfolio': float(start_cash + start_taxable_val + start_pretax_std + start_pretax_457 + start_roth),
            'annual_withdrawal_need': float(self.profile.target_annual_income - (base_ss + base_pension)),
            'simulations': simulations,
            'timeline': {
                'years': list(range(self.current_year, self.current_year + years)),
                'p5': np.percentile(all_paths, 5, axis=0).tolist(),
                'median': np.median(all_paths, axis=0).tolist(),
                'p95': np.percentile(all_paths, 95, axis=0).tolist()
            },
            'warnings': all_warnings,
            'recommendations': []
        }

    def run_detailed_projection(self, years: int, assumptions: MarketAssumptions = None, spending_model: str = 'constant_real'):
        """
        Run a SINGLE deterministic projection to capture granular details like tax breakdown.
        Used for the Cashflow visualization to show exactly where money goes.
        """
        if assumptions is None:
            assumptions = MarketAssumptions()

        # Use 1D arrays (size 1) to reuse the vectorized tax functions
        simulations = 1
        
        # 1. Initialize Balances
        start_cash = 0.0
        start_taxable_val = 0.0
        start_taxable_basis = 0.0
        start_pretax_std = 0.0
        start_pretax_457 = 0.0
        start_roth = 0.0

        inv_types = self.profile.investment_types or []
        for inv in inv_types:
            acc = inv.get('account', 'Liquid')
            val = safe_float(inv.get('value', 0))
            basis = safe_float(inv.get('cost_basis', 0))
            
            if acc in ['Checking', 'Savings']:
                start_cash += val
            elif acc in ['Liquid', 'Taxable Brokerage']:
                start_taxable_val += val
                start_taxable_basis += basis
            elif acc in ['Traditional IRA', '401k', '403b', '401a']:
                start_pretax_std += val
            elif acc == '457b':
                start_pretax_457 += val
            elif acc == 'Roth IRA':
                start_roth += val
            elif acc == 'Pension':
                start_pretax_std += val

        # Vectors of size 1
        cash = np.full(simulations, start_cash)
        taxable_val = np.full(simulations, start_taxable_val)
        taxable_basis = np.full(simulations, start_taxable_basis)
        pretax_std = np.full(simulations, start_pretax_std)
        pretax_457 = np.full(simulations, start_pretax_457)
        roth = np.full(simulations, start_roth)

        # 2. Setup Deterministic Factors
        current_cpi = np.ones(simulations)
        
        # Income/Expense Lookups
        p1_birth_year = self.profile.person1.birth_date.year
        p2_birth_year = self.profile.person2.birth_date.year
        p1_retirement_year = self.profile.person1.retirement_date.year
        p2_retirement_year = self.profile.person2.retirement_date.year
        
        base_ss = (self.profile.person1.social_security + self.profile.person2.social_security) * 12
        base_pension = self.profile.pension_annual

        # Prepare Income Streams data structure for fast access
        income_streams_data = []
        if self.profile.income_streams:
            for s in self.profile.income_streams:
                try:
                    start_year = datetime.fromisoformat(s['start_date']).year
                    income_streams_data.append({
                        'amount': safe_float(s.get('amount', 0)),
                        'start_year': start_year,
                        'inflation_adjusted': s.get('inflation_adjusted', True),
                        'type': s.get('type', 'other')
                    })
                except: pass

        # Prepare Homes
        home_props_state = []
        if self.profile.home_properties:
            for prop in self.profile.home_properties:
                prop_val = safe_float(prop.get('current_value', 0))
                prop_mort = safe_float(prop.get('mortgage_balance', 0))
                prop_costs = (
                    safe_float(prop.get('annual_property_tax', 0)) +
                    safe_float(prop.get('annual_insurance', 0)) +
                    safe_float(prop.get('annual_maintenance', 0)) +
                    safe_float(prop.get('annual_hoa', 0))
                )
                sale_year = None
                if prop.get('planned_sale_date'):
                    try:
                        sale_year = datetime.fromisoformat(prop['planned_sale_date']).year
                    except: pass

                home_props_state.append({
                    'values': np.full(simulations, prop_val),
                    'mortgages': np.full(simulations, prop_mort),
                    'annual_costs': np.full(simulations, prop_costs),
                    'appreciation_rate': safe_float(prop.get('appreciation_rate') or assumptions.inflation_mean),
                    'sale_year': sale_year,
                    'purchase_price': safe_float(prop.get('purchase_price') or prop_val),
                    'property_type': prop.get('property_type', 'Primary Residence'),
                    'replacement_cost': safe_float(prop.get('replacement_value', 0)),
                    'is_sold': np.zeros(simulations, dtype=bool)
                })

        detailed_ledger = []

        # 3. Simulation Loop
        for year_idx in range(years):
            simulation_year = self.current_year + year_idx
            p1_age = simulation_year - p1_birth_year
            p2_age = simulation_year - p2_birth_year
            
            p1_retired = simulation_year >= p1_retirement_year
            p2_retired = simulation_year >= p2_retirement_year

            # Update CPI
            if year_idx > 0:
                current_cpi *= (1 + assumptions.inflation_mean)
            
            # Standard deduction depends on filing status and inflation
            std_deduction = self.get_standard_deduction(current_cpi)

            # --- Income Calculation ---
            p1_ss_eligible = p1_age >= self.profile.person1.ss_claiming_age
            p2_ss_eligible = p2_age >= self.profile.person2.ss_claiming_age
            
            p1_ss_amt = (self.profile.person1.social_security * 12) if p1_ss_eligible else 0
            p2_ss_amt = (self.profile.person2.social_security * 12) if p2_ss_eligible else 0
            gross_ss = (p1_ss_amt + p2_ss_amt) * current_cpi
            
            active_pension = (base_pension if p1_retired else 0) * current_cpi
            
            # Sum all ordinary income streams
            other_taxable_income = np.zeros(simulations)
            employment_income_from_streams = np.zeros(simulations)
            for stream in income_streams_data:
                if simulation_year >= stream['start_year']:
                    amount = stream['amount'] * (current_cpi if stream['inflation_adjusted'] else 1.0)
                    if stream.get('type') == 'salary':
                        employment_income_from_streams += amount
                    else:
                        other_taxable_income += amount

            # Budget employment income
            budget_income_other = np.zeros(simulations)
            employment_income_from_budget = np.zeros(simulations)
            if self.profile.budget:
                budget_income_total, employment_income_from_budget = self.calculate_budget_income(simulation_year, current_cpi, p1_retired, p2_retired)
                # Budget income that is not employment (rental, etc.)
                budget_income_other = budget_income_total - employment_income_from_budget

            # Combined employment income (Salary from streams + Budget employment)
            employment_income_gross = employment_income_from_streams + employment_income_from_budget
            # Combined non-employment ordinary income (Pension + Other Streams + Rental/Other Budget)
            other_ordinary_income_gross = active_pension + other_taxable_income + budget_income_other

            # --- Tax Step 2: Social Security Taxation ---
            # Stacking non-SS ordinary income to see how much SS is taxable
            taxable_ss = self._vectorized_taxable_ss(employment_income_gross + other_ordinary_income_gross, gross_ss)

            # --- Combined Taxable Ordinary Income ---
            # IMPORTANT: Aggregate all ordinary income components before applying standard deduction
            total_ordinary_taxable_gross = employment_income_gross + other_ordinary_income_gross + taxable_ss
            
            # Use profile-specific standard deduction
            std_deduction = self.get_standard_deduction(current_cpi)
            taxable_income_federal = np.maximum(0, total_ordinary_taxable_gross - std_deduction)
            
            # Federal and State Tax on the combined ordinary income
            fed_tax_paid, marginal_rate_current = self._vectorized_federal_tax(taxable_income_federal)
            
            # State tax - use profile state or default (Simplified)
            state_rate = 0.05 # Default
            if getattr(self.profile, 'state', 'NY') == 'NY':
                state_rate = 0.0585 # NY approx
                
            state_tax_paid = (employment_income_gross + other_ordinary_income_gross) * state_rate

            # FICA only on employment income
            fica_tax = np.zeros(simulations)
            if np.any(employment_income_gross > 0):
                SS_WAGE_BASE = 168600
                ss_fica = np.minimum(employment_income_gross, SS_WAGE_BASE) * 0.062
                med_fica = employment_income_gross * 0.0145
                fica_tax = ss_fica + med_fica

            # --- Tax Step 4: IRMAA ---
            irmaa_expense = np.zeros(simulations)
            if p1_age >= 65 or p2_age >= 65:
                # MAGI ≈ AGI (Total Ordinary Taxable Gross)
                both_on_medicare = (p1_age >= 65) and (p2_age >= 65)
                irmaa_expense = self._vectorized_irmaa(total_ordinary_taxable_gross, both_on_medicare=both_on_medicare)

            # --- Net Cash Available Before Withdrawals ---
            total_tax_on_income = fed_tax_paid + state_tax_paid + fica_tax
            total_available_cash = (total_ordinary_taxable_gross + (gross_ss - taxable_ss)) - total_tax_on_income

            # Track cumulative ordinary income for stacking withdrawals later
            cumulative_ordinary_gross = total_ordinary_taxable_gross


            # --- Expenses ---
            current_housing_costs = np.zeros(simulations)
            for prop in home_props_state:
                unsold_mask = ~prop['is_sold']
                current_housing_costs += np.where(unsold_mask, prop['annual_costs'], 0)
            
            current_housing_costs *= current_cpi
            
            # Spending Multiplier
            spending_mult = 1.0
            if spending_model == 'retirement_smile':
                age = simulation_year - p1_birth_year
                if age < 70: spending_mult = 1.0
                elif 70 <= age < 80: spending_mult = 1.0 - ((age - 70) * 0.02)
                else: spending_mult = 0.8 + ((age - 80) * 0.02)
            elif spending_model == 'conservative_decline':
                age = simulation_year - p1_birth_year
                if age > 70: spending_mult = max(0.6, 1.0 - ((age - 70) * 0.01))

            if self.profile.budget:
                target_spending = self.calculate_budget_expenses(simulation_year, current_cpi, p1_retired, p2_retired, current_housing_costs)
                if spending_mult != 1.0:
                    target_spending = ((target_spending - current_housing_costs) * spending_mult) + current_housing_costs
            else:
                target_spending = (self.profile.target_annual_income * current_cpi * spending_mult) + current_housing_costs

            target_spending += irmaa_expense

            # --- Shortfall / Surplus ---
            net_cash_flow = total_available_cash - target_spending
            shortfall = np.maximum(0, -net_cash_flow)
            surplus = np.maximum(0, net_cash_flow)
            
            # LTCG tax paid this year
            ltcg_tax_paid = np.zeros(simulations)

            # --- Contributions ---
            if not p1_retired or not p2_retired:
                # IRA contributions
                ira_contrib = safe_float(self.profile.annual_ira_contribution, 0)
                if ira_contrib > 0:
                    pretax_std += ira_contrib * 0.5
                    roth += ira_contrib * 0.5

                # surplus allocation
                if np.any(surplus > 0):
                    savings_alloc = self.profile.savings_allocation or {'pretax': 0.50, 'roth': 0.30, 'taxable': 0.20}
                    pretax_std += surplus * savings_alloc.get('pretax', 0.50)
                    roth += surplus * savings_alloc.get('roth', 0.30)
                    taxable_val += surplus * savings_alloc.get('taxable', 0.20)
                    taxable_basis += surplus * savings_alloc.get('taxable', 0.20)

            # --- RMDs ---
            total_rmd = np.zeros(simulations)
            original_pretax = pretax_std.copy()
            rmd_factors = {
                73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
                78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
                83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
                88: 13.7, 89: 12.2
            }
            for age in [p1_age, p2_age]:
                if age >= 73:
                    factor = rmd_factors.get(int(age), 12.2)
                    curr_rmd = (original_pretax / 2.0) / factor
                    total_rmd += curr_rmd
            
            pretax_std -= total_rmd

            if np.any(total_rmd > 0):
                # Calculate tax on RMD (Stacked on existing ordinary income)
                taxable_with_rmd = np.maximum(0, cumulative_ordinary_gross + total_rmd - std_deduction)
                taxable_without_rmd = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                tax_with_rmd, _ = self._vectorized_federal_tax(taxable_with_rmd)
                tax_without_rmd, _ = self._vectorized_federal_tax(taxable_without_rmd)
                
                rmd_tax_fed = tax_with_rmd - tax_without_rmd
                rmd_tax_state = total_rmd * state_rate
                
                fed_tax_paid += rmd_tax_fed
                state_tax_paid += rmd_tax_state
                
                net_rmd = total_rmd - (rmd_tax_fed + rmd_tax_state)
                # Update cumulative ordinary income for future stacking
                cumulative_ordinary_gross += total_rmd
                
                used_for_shortfall = np.minimum(shortfall, net_rmd)
                shortfall -= used_for_shortfall
                taxable_val += (net_rmd - used_for_shortfall)

            # --- Withdrawals ---
            total_withdrawals = np.zeros(simulations)

            # 1. Cash
            if np.any(shortfall > 0):
                w = np.minimum(shortfall, cash)
                cash -= w
                shortfall -= w
                total_withdrawals += w

            # 2. 457b
            if np.any(shortfall > 0) and p1_age < 59.5:
                # Estimate tax rate based on current stacked income
                taxable_now = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now)
                eff_rate = np.maximum(0.10, marginal_rate) + state_rate
                
                gross_needed = shortfall / (1 - eff_rate)
                w = np.minimum(gross_needed, pretax_457)
                pretax_457 -= w
                
                # Actual Tax Calculation
                tax_after, _ = self._vectorized_federal_tax(np.maximum(0, cumulative_ordinary_gross + w - std_deduction))
                tax_before, _ = self._vectorized_federal_tax(taxable_now)
                actual_fed_tax = tax_after - tax_before
                actual_state_tax = w * state_rate
                
                fed_tax_paid += actual_fed_tax
                state_tax_paid += actual_state_tax
                
                net_w = w - (actual_fed_tax + actual_state_tax)
                cumulative_ordinary_gross += w
                shortfall -= net_w
                total_withdrawals += w

            # 3. Taxable
            if np.any(shortfall > 0):
                STABILITY_FLOOR = 1000.0
                denom = np.where(taxable_val > STABILITY_FLOOR, taxable_val, 1e10)
                gain_ratio = np.maximum(0, (taxable_val - taxable_basis) / denom)
                gain_ratio = np.where(taxable_val > STABILITY_FLOOR, gain_ratio, 0)
                
                est_tax_rate = gain_ratio * 0.15 + state_rate # Gains tax + State
                gross_needed = shortfall / np.maximum(0.01, 1 - est_tax_rate)
                w = np.minimum(gross_needed, taxable_val)
                gains_realized = w * gain_ratio
                
                # Actual LTCG Tax
                ltcg = self._vectorized_ltcg_tax(gains_realized, cumulative_ordinary_gross)
                ltcg_tax_paid += ltcg
                # State tax on gains (simplified)
                state_gain_tax = gains_realized * state_rate
                
                state_tax_paid += state_gain_tax
                
                net_w = w - (ltcg + state_gain_tax)
                basis_ratio = np.where(taxable_val > 0, taxable_basis / taxable_val, 0)
                taxable_val -= w
                taxable_basis -= w * basis_ratio
                shortfall -= net_w
                total_withdrawals += w

            # 4. Pre-Tax
            if np.any(shortfall > 0):
                penalty = np.where(p1_age < 59.5, 0.10, 0)
                taxable_now = np.maximum(0, cumulative_ordinary_gross - std_deduction)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now)
                eff_rate = np.maximum(0.10, marginal_rate) + state_rate + penalty
                
                gross_needed = shortfall / np.maximum(0.01, 1 - eff_rate)
                w = np.minimum(gross_needed, pretax_std)
                pretax_std -= w
                
                # Actual Tax Calculation
                tax_after, _ = self._vectorized_federal_tax(np.maximum(0, cumulative_ordinary_gross + w - std_deduction))
                tax_before, _ = self._vectorized_federal_tax(taxable_now)
                actual_fed_tax = (tax_after - tax_before) + (w * penalty)
                actual_state_tax = w * state_rate
                
                fed_tax_paid += actual_fed_tax
                state_tax_paid += actual_state_tax
                
                net_w = w - (actual_fed_tax + actual_state_tax)
                cumulative_ordinary_gross += w
                shortfall -= net_w
                total_withdrawals += w

            # 5. Roth
            if np.any(shortfall > 0):
                w = np.minimum(shortfall, roth)
                roth -= w
                shortfall -= w
                total_withdrawals += w

            # --- Growth ---
            # Weighted average return of all asset classes
            ret = (
                assumptions.stock_allocation * assumptions.stock_return_mean +
                assumptions.bond_allocation * assumptions.bond_return_mean +
                assumptions.cash_allocation * assumptions.cash_return_mean +
                assumptions.reit_allocation * assumptions.reit_return_mean +
                assumptions.gold_allocation * assumptions.gold_return_mean +
                assumptions.crypto_allocation * assumptions.crypto_return_mean
            )
            
            cash *= (1 + assumptions.cash_return_mean)
            taxable_val *= (1 + ret * 0.85) # Tax drag applied to the blended return
            taxable_basis *= (1 + ret * 0.85)
            pretax_std *= (1 + ret)
            pretax_457 *= (1 + ret)
            roth *= (1 + ret)

            # --- Record Data ---
            # Total Gross Income = All Ordinary Taxable + Gross SS + LTCG Realized + Penalties
            # Note: total_withdrawals is the GROSS amount taken from accounts
            detailed_ledger.append({
                'year': int(simulation_year),
                'age': int(p1_age),
                'gross_income': float(total_ordinary_taxable_gross[0] + (gross_ss[0] - taxable_ss[0]) + total_withdrawals[0]),
                'expenses_excluding_tax': float(target_spending[0]),
                'federal_tax': float(fed_tax_paid[0]),
                'state_tax': float(state_tax_paid[0]),
                'fica_tax': float(fica_tax[0]),
                'ltcg_tax': float(ltcg_tax_paid[0]),
                'portfolio_balance': float(cash[0] + taxable_val[0] + pretax_std[0] + pretax_457[0] + roth[0]),
                'withdrawals': float(total_withdrawals[0])
            })

        return detailed_ledger

        return detailed_ledger

    def calculate_rmd(self, age: int, ira_balance: float):
        rmd_factors = {
            73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
            78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
            83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
            88: 13.7, 89: 12.9, 90: 12.2
        }
        if age < 73:
            return 0
        factor = rmd_factors.get(age, 12.2)
        return ira_balance / factor
    def optimize_social_security(self, assumptions: MarketAssumptions = None):
        """Optimize Social Security claiming strategy with configurable discount rate"""
        if assumptions is None:
            assumptions = MarketAssumptions()
        person1_fra_benefit = self.profile.person1.social_security
        person2_fra_benefit = self.profile.person2.social_security
        strategies = []
        for p1_age in [62, 67, 70]:
            for p2_age in [62, 67, 70]:
                p1_multiplier = {62: 0.70, 67: 1.0, 70: 1.24}[p1_age]
                p2_multiplier = {62: 0.70, 67: 1.0, 70: 1.24}[p2_age]
                p1_monthly = person1_fra_benefit * p1_multiplier
                p2_monthly = person2_fra_benefit * p2_multiplier
                p1_birth_year = self.profile.person1.birth_date.year
                p2_birth_year = self.profile.person2.birth_date.year
                total_lifetime = 0
                for year in range(30):
                    current_year = datetime.now().year + year
                    p1_current_age = current_year - p1_birth_year
                    p2_current_age = current_year - p2_birth_year
                    yearly_benefit = 0
                    if p1_current_age >= p1_age and p1_current_age <= 90:
                        yearly_benefit += p1_monthly * 12
                    if p2_current_age >= p2_age and p2_current_age <= 90:
                        yearly_benefit += p2_monthly * 12
                    total_lifetime += yearly_benefit / ((1 + assumptions.ss_discount_rate) ** year)
                strategies.append({
                    'person1_claim_age': p1_age,
                    'person2_claim_age': p2_age,
                    'person1_monthly': p1_monthly,
                    'person2_monthly': p2_monthly,
                    'lifetime_benefit_npv': total_lifetime
                })
        return sorted(strategies, key=lambda x: x['lifetime_benefit_npv'], reverse=True)
    def calculate_roth_conversion_opportunity(self):
        years_until_rmd = 73 - ((datetime.now() - self.profile.person1.birth_date).days / 365.25)
        if years_until_rmd <= 0:
            return {'opportunity': 'none', 'reason': 'Already past RMD age'}
        # Use target annual income as a proxy for retirement taxable income baseline
        # This is a simplification but better than hardcoding
        current_income = self.profile.target_annual_income
        pension_annual = self.profile.pension_annual
        # Include dynamic income streams starting before or at RMD age (73)
        p1_birth_year = self.profile.person1.birth_date.year
        rmd_year = p1_birth_year + 73
        if self.profile.income_streams:
            for s in self.profile.income_streams:
                try:
                    start_year = datetime.fromisoformat(s['start_date']).year
                    if start_year <= rmd_year:
                        pension_annual += safe_float(s.get('amount', 0))
                except: pass
        retirement_income = (self.profile.person1.social_security * 12 +
                           self.profile.person2.social_security * 12 +
                           pension_annual)
        years_to_retirement = (self.profile.person1.retirement_date - datetime.now()).days / 365.25
        if years_to_retirement > 0:
            conversion_years = int(years_until_rmd - years_to_retirement)
            standard_deduction = 29200 + 3100
            top_of_12_bracket = 94300
            top_of_22_bracket = 201050
            available_12_bracket = top_of_12_bracket - standard_deduction - retirement_income
            available_22_bracket = top_of_22_bracket - top_of_12_bracket
            annual_conversion_12 = max(0, available_12_bracket)
            annual_conversion_22 = available_22_bracket
            total_12_bracket = annual_conversion_12 * conversion_years
            total_22_bracket = annual_conversion_22 * conversion_years
            tax_cost_12 = total_12_bracket * 0.12
            tax_cost_22 = total_22_bracket * 0.22
            return {
                'opportunity': 'excellent',
                'conversion_years': conversion_years,
                'annual_conversion_12_bracket': annual_conversion_12,
                'annual_conversion_22_bracket': annual_conversion_22,
                'total_convertible_12': total_12_bracket,
                'total_convertible_22': total_22_bracket,
                'tax_cost_12': tax_cost_12,
                'tax_cost_22': tax_cost_22,
                'recommendation': f'Convert ${annual_conversion_12:,.0f}/year in 12% bracket for {conversion_years} years'
            }
        else:
            return {'opportunity': 'limited', 'reason': 'Already retired or retiring soon'}
    def calculate_wealth_transfer_strategy(self):
        annual_gift_per_child = 18000 * 2
        total_annual_gifts = annual_gift_per_child * len(self.profile.children)
        years_until_90 = min(
            self.calculate_life_expectancy_years(self.profile.person1),
            self.calculate_life_expectancy_years(self.profile.person2)
        )
        total_lifetime_gifts = total_annual_gifts * years_until_90
        net_worth = (self.profile.liquid_assets + 
                    self.profile.traditional_ira + 
                    self.profile.roth_ira)
        return {
            'annual_gift_capacity': total_annual_gifts,
            'lifetime_gift_capacity': total_lifetime_gifts,
            'per_child_annual': annual_gift_per_child,
            'years_of_gifting': years_until_90,
            'net_worth': net_worth,
            'percentage_transferred': (total_lifetime_gifts / net_worth * 100) if net_worth > 0 else 0,
            'recommendation': f'Gift ${total_annual_gifts:,.0f}/year (${annual_gift_per_child:,.0f} per child) starting immediately'
        }

    def _annual_amount(self, amount: float, frequency: str) -> float:
        """Convert amount to annual based on frequency"""
        if frequency == 'monthly':
            return amount * 12
        elif frequency == 'quarterly':
            return amount * 4
        elif frequency == 'annual':
            return amount
        return amount  # Default to amount as-is

    def _is_expense_active(self, expense_data: dict, simulation_year: int) -> bool:
        """Check if an expense is active in the given simulation year"""
        # If ongoing is True or not specified, expense is always active
        ongoing = expense_data.get('ongoing', True)
        if ongoing:
            return True

        # If not ongoing, check start and end dates
        start_date = expense_data.get('start_date')
        end_date = expense_data.get('end_date')

        # Parse start year (if blank, assume "today" - current year)
        start_year = None
        if start_date:
            try:
                start_year = datetime.fromisoformat(start_date).year
            except:
                pass
        else:
            # If no start date specified, assume current year (today)
            start_year = datetime.now().year

        # Parse end year
        end_year = None
        if end_date:
            try:
                end_year = datetime.fromisoformat(end_date).year
            except:
                pass

        # Check if simulation year is within range
        if start_year is not None and simulation_year < start_year:
            return False
        if end_year is not None and simulation_year > end_year:
            return False

        return True

    def calculate_budget_income(self, simulation_year: int, current_cpi: np.ndarray, p1_retired: bool, p2_retired: bool) -> tuple:
        """Calculate total income from budget categories for a given year (Vectorized)
        Returns: (total_income, employment_income)
        """
        if not self.profile.budget:
            return np.zeros_like(current_cpi), np.zeros_like(current_cpi)

        budget = self.profile.budget
        income_section = budget.get('income', {})

        # 1. Employment income - strictly tied to individual retirement status
        employment_income = np.zeros_like(current_cpi)
        current_employment = income_section.get('current', {}).get('employment', {})
        if not p1_retired:
            employment_income += current_employment.get('primary_person', 0)
        if not p2_retired:
            employment_income += current_employment.get('spouse', 0)

        # Initialize total result vector
        total_income = employment_income.copy()

        # 2. Dynamic Income Streams with Blended Logic
        retirement_weight = 0.0
        if p1_retired: retirement_weight += 0.5
        if p2_retired: retirement_weight += 0.5

        def get_period_income(period):
            period_total = np.zeros_like(current_cpi)
            # Other income categories
            for category in ['rental_income', 'part_time_consulting', 'business_income', 'other_income']:
                items = income_section.get(period, {}).get(category, [])
                for item in items:
                    try:
                        start_year = datetime.fromisoformat(item['start_date']).year
                        end_year = datetime.fromisoformat(item['end_date']).year if item.get('end_date') else 9999

                        if start_year <= simulation_year <= end_year:
                            amount = self._annual_amount(item['amount'], item.get('frequency', 'monthly'))
                            if item.get('inflation_adjusted', True):
                                period_total += amount * current_cpi
                            else:
                                period_total += amount
                    except:
                        pass
            return period_total

        # Apply blended logic to other income streams
        if retirement_weight == 0:
            total_income += get_period_income('current')
        elif retirement_weight == 1.0:
            total_income += get_period_income('future')
        else:
            # Transition period (one retired) - blend 50/50
            current_inc = get_period_income('current')
            future_inc = get_period_income('future')
            total_income += (current_inc * 0.5) + (future_inc * 0.5)

        return total_income, employment_income

    def calculate_budget_expenses(self, simulation_year: int, current_cpi: np.ndarray, p1_retired: bool, p2_retired: bool, housing_costs: np.ndarray) -> np.ndarray:
        """Calculate total expenses from budget categories for a given year (Vectorized)"""
        if not self.profile.budget:
            return housing_costs

        budget = self.profile.budget
        expenses_section = budget.get('expenses', {})

        # Define category weights for partial retirement
        # 1.0 = transition fully when first person retires
        # 0.5 = transition halfway when first person retires
        # 0.0 = transition only when both people retire
        CATEGORY_WEIGHTS = {
            'transportation': 0.8, # Commuting drops early
            'food': 0.5,           # Gradual shift
            'dining_out': 0.5,
            'travel': 0.3,         # Increases mostly when both retire
            'healthcare': 0.5,
            'personal_care': 0.5,
            'entertainment': 0.4,
            'utilities': 0.2       # House stays same size
        }

        def get_period_expenses(period):
            period_data = {}
            period_expenses = expenses_section.get(period, {})

            for category, cat_data in period_expenses.items():
                category_total = np.zeros_like(current_cpi)
                expense_items = cat_data if isinstance(cat_data, list) else ([cat_data] if isinstance(cat_data, dict) and cat_data.get('amount') else [])

                for item in expense_items:
                    amount = item.get('amount', 0)
                    amount = self._annual_amount(amount, item.get('frequency', 'monthly'))

                    if not self._is_expense_active(item, simulation_year):
                        continue

                    if category == 'housing' and np.any(housing_costs > 0):
                        category_total += housing_costs
                    else:
                        if item.get('inflation_adjusted', True):
                            category_total += amount * current_cpi
                        else:
                            category_total += amount
                period_data[category] = category_total
            return period_data

        if not p1_retired and not p2_retired:
            # Both working: 100% current
            current_map = get_period_expenses('current')
            return sum(current_map.values()) if current_map else np.zeros_like(current_cpi)
        
        if p1_retired and p2_retired:
            # Both retired: 100% future
            future_map = get_period_expenses('future')
            return sum(future_map.values()) if future_map else np.zeros_like(current_cpi)

        # Partial Retirement: One is retired, one is working
        current_map = get_period_expenses('current')
        future_map = get_period_expenses('future')
        total_expenses = np.zeros_like(current_cpi)
        
        all_categories = set(current_map.keys()) | set(future_map.keys())
        
        for cat in all_categories:
            c_val = current_map.get(cat, np.zeros_like(current_cpi))
            f_val = future_map.get(cat, np.zeros_like(current_cpi))
            
            # Use specific weight or default to 0.5
            weight = CATEGORY_WEIGHTS.get(cat, 0.5)
            
            # Blended value for this category
            total_expenses += (c_val * (1 - weight)) + (f_val * weight)
            
        return total_expenses
