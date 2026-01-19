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
@dataclass
class MarketAssumptions:
    """Market and economic assumptions for financial modeling"""
    stock_allocation: float = 0.5
    stock_return_mean: float = 0.10
    bond_return_mean: float = 0.04
    inflation_mean: float = 0.03
    stock_return_std: float = 0.18
    bond_return_std: float = 0.06
    inflation_std: float = 0.01
    ss_discount_rate: float = 0.03
class RetirementModel:
    def __init__(self, profile: FinancialProfile):
        self.profile = profile
        self.current_year = datetime.now().year
    def calculate_life_expectancy_years(self, person: Person, target_age: int = 90):
        age_now = (datetime.now() - person.birth_date).days / 365.25
        return int(target_age - age_now)

    # =========================================================================
    # Vectorized Tax Helper Functions
    # =========================================================================

    def _vectorized_federal_tax(self, taxable_income: np.ndarray,
                                filing_status: str = 'mfj') -> tuple:
        """Calculate federal income tax using progressive brackets.

        Args:
            taxable_income: Array of taxable income values (after deductions)
            filing_status: 'mfj' (married filing jointly), 'single', 'mfs', 'hoh'

        Returns:
            Tuple of (total_tax array, marginal_rate array)
        """
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

        total_tax = np.zeros_like(taxable_income)
        marginal_rate = np.zeros_like(taxable_income)

        for lower, upper, rate in brackets:
            # Income in this bracket
            in_bracket = np.clip(taxable_income - lower, 0, upper - lower)
            total_tax += in_bracket * rate
            # Update marginal rate for incomes above this bracket's lower bound
            marginal_rate = np.where(taxable_income > lower, rate, marginal_rate)

        return total_tax, marginal_rate

    def _vectorized_taxable_ss(self, other_income: np.ndarray,
                               ss_benefit: np.ndarray,
                               filing_status: str = 'mfj') -> np.ndarray:
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
        # Calculate provisional income
        provisional = other_income + (ss_benefit * 0.5)

        # Thresholds depend on filing status
        if filing_status == 'mfj':
            threshold_1 = 32000  # Below: 0% taxable
            threshold_2 = 44000  # Above: up to 85% taxable
        else:  # single
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
                             filing_status: str = 'mfj') -> np.ndarray:
        """Calculate long-term capital gains tax with income stacking.

        LTCG rates depend on total income (ordinary + gains stacked on top).

        Args:
            gains: Array of long-term capital gains
            ordinary_income: Array of ordinary taxable income (before LTCG)
            filing_status: 'mfj' or 'single'

        Returns:
            Array of LTCG tax amounts
        """
        # 2024 LTCG brackets (thresholds for total taxable income including gains)
        if filing_status == 'mfj':
            threshold_0 = 94050    # 0% up to here
            threshold_15 = 583750  # 15% up to here, 20% above
        else:  # single
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
                          filing_status: str = 'mfj',
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
        else:  # single
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
                                  state_rate: float = 0.05) -> np.ndarray:
        """Estimate total taxes on employment income.

        Includes:
        - FICA (Social Security 6.2% up to wage base + Medicare 1.45%)
        - Estimated federal income tax
        - State income tax (flat rate approximation)

        Args:
            gross_income: Array of gross employment income
            state_rate: State income tax rate (default 5%)

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
        # Assume standard deduction of $29,200 for MFJ
        standard_deduction = 29200
        taxable = np.maximum(0, gross_income - standard_deduction)
        federal_tax, _ = self._vectorized_federal_tax(taxable, 'mfj')

        # State tax (simplified flat rate)
        state_tax = gross_income * state_rate

        return fica + federal_tax + state_tax

    def monte_carlo_simulation(self, years: int, simulations: int = 10000, assumptions: MarketAssumptions = None, effective_tax_rate: float = 0.22, spending_model: str = 'constant_real'):
        """Run Monte Carlo simulation using vectorized NumPy operations for high performance."""
        if assumptions is None:
            assumptions = MarketAssumptions()
            
        stock_pct = assumptions.stock_allocation
        returns_mean_adj = stock_pct * assumptions.stock_return_mean + (1 - stock_pct) * assumptions.bond_return_mean
        returns_std_adj = stock_pct * assumptions.stock_return_std + (1 - stock_pct) * assumptions.bond_return_std

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
        # Returns
        market_returns = np.random.normal(returns_mean_adj, returns_std_adj, (simulations, years))
        # Inflation
        inflation_rates = np.random.normal(assumptions.inflation_mean, assumptions.inflation_std, (simulations, years))
        
        # Calculate cumulative CPI (Inflation Index)
        # cpi[:, 0] is 1.0. cpi[:, t] = product(1+inf) up to t-1
        # We'll calculate year-by-year in the loop for simplicity with other logic, 
        # or we could cumprod. Let's maintain a 'current_cpi' vector.
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
                        'inflation_adjusted': s.get('inflation_adjusted', True)
                    })
                except: pass

        # Prepare Homes data structure (Vectorized)
        # We need to track value, mortgage, costs per simulation
        # home_props_state: List of dicts, where values are arrays
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
        # Note: ORDINARY_TAX kept as fallback but progressive rates used when possible
        ORDINARY_TAX = effective_tax_rate
        EARLY_PENALTY = 0.10
        CASH_INTEREST = 0.015
        STANDARD_DEDUCTION_MFJ = 29200  # 2024 MFJ standard deduction
        
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
            p1_age = (self.current_year + year_idx) - p1_birth_year
            p2_age = (self.current_year + year_idx) - p2_birth_year
            
            # Independent Retirement Tracking
            p1_retired = simulation_year >= p1_retirement_year
            p2_retired = simulation_year >= p2_retirement_year
            
            # A. Update CPI (except year 0)
            if year_idx > 0:
                current_cpi *= (1 + inflation_rates[:, year_idx])

            # B. Calculate Income with Proper Tax Treatment
            # Track income components separately for accurate tax calculations

            # B1. Social Security Benefits (inflation-adjusted)
            p1_ss = (self.profile.person1.social_security * 12) if p1_retired else 0
            p2_ss = (self.profile.person2.social_security * 12) if p2_retired else 0
            gross_ss = (p1_ss + p2_ss) * current_cpi  # Total SS before taxation

            # B2. Pension Income (taxable as ordinary income)
            active_pension = (base_pension if p1_retired else 0) * current_cpi

            # B3. Other Income Streams (pensions, annuities - taxable)
            other_taxable_income = np.zeros(simulations)
            for stream in income_streams_data:
                if simulation_year >= stream['start_year']:
                    if stream['inflation_adjusted']:
                        other_taxable_income += stream['amount'] * current_cpi
                    else:
                        other_taxable_income += stream['amount']

            # B4. Budget Income (employment, rental, etc.)
            budget_income = np.zeros(simulations)
            employment_income_gross = np.zeros(simulations)
            if self.profile.budget:
                budget_income = self.calculate_budget_income(simulation_year, current_cpi, p1_retired, p2_retired)
                # Track employment income separately for tax calculation
                current_employment = self.profile.budget.get('income', {}).get('current', {}).get('employment', {})
                if not p1_retired:
                    employment_income_gross += current_employment.get('primary_person', 0)
                if not p2_retired:
                    employment_income_gross += current_employment.get('spouse', 0)

            # B5. Employment Tax Deduction (FICA + Federal + State)
            # During working years, employment income is reduced by payroll and income taxes
            employment_tax = np.zeros(simulations)
            if np.any(employment_income_gross > 0):
                employment_tax = self._calculate_employment_tax(employment_income_gross)

            # B6. Calculate Taxable Social Security
            # Provisional income = Other AGI + 50% of SS benefits
            # Other AGI at this point includes pension + other income (RMDs added later)
            provisional_income_base = active_pension + other_taxable_income
            taxable_ss = self._vectorized_taxable_ss(provisional_income_base, gross_ss, 'mfj')

            # B7. IRMAA Surcharges for Medicare-eligible retirees (age 65+)
            # Based on prior year MAGI - we use current income as proxy
            irmaa_expense = np.zeros(simulations)
            p1_medicare_eligible = p1_age >= 65
            p2_medicare_eligible = p2_age >= 65
            if p1_medicare_eligible or p2_medicare_eligible:
                # Estimate MAGI for IRMAA (includes taxable SS, pension, other income)
                estimated_magi = taxable_ss + active_pension + other_taxable_income
                both_on_medicare = p1_medicare_eligible and p2_medicare_eligible
                irmaa_expense = self._vectorized_irmaa(estimated_magi, 'mfj', both_on_medicare)

            # B8. Calculate Total Spendable Income
            # Net SS = Gross SS - Tax on taxable portion
            # For now, estimate SS tax using effective rate on taxable portion
            # (We'll refine this when we know total income including withdrawals)
            ss_tax_estimate = np.zeros_like(taxable_ss)
            if np.any(taxable_ss > 0):
                # Estimate tax rate for SS (will be refined with total income)
                ss_tax_estimate = taxable_ss * 0.22  # Conservative estimate

            net_ss = gross_ss - ss_tax_estimate

            # Total available income (after taxes)
            # Pension and other income taxed at ordinary rates (estimated)
            ordinary_income_pretax = active_pension + other_taxable_income
            ordinary_tax_estimate = np.zeros_like(ordinary_income_pretax)
            if np.any(ordinary_income_pretax > 0):
                taxable_ordinary = np.maximum(0, ordinary_income_pretax - STANDARD_DEDUCTION_MFJ)
                ordinary_tax_estimate, _ = self._vectorized_federal_tax(taxable_ordinary, 'mfj')

            # Employment income net of taxes
            net_employment = employment_income_gross - employment_tax
            net_other_budget = budget_income - employment_income_gross  # Non-employment budget income

            total_income = net_ss + (ordinary_income_pretax - ordinary_tax_estimate) + net_employment + net_other_budget

            # Track ordinary income for later tax calculations (RMDs, withdrawals)
            # This is the taxable ordinary income before additional withdrawals
            year_ordinary_income = taxable_ss + ordinary_income_pretax

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
                        capital_gains_tax = self._vectorized_ltcg_tax(taxable_gain, year_ordinary_income, 'mfj')
                        net_proceeds = gross_proceeds - mortgage_payoff - transaction_costs - capital_gains_tax
                        available_proceeds = net_proceeds - prop['replacement_cost']
                        taxable_val = np.where(active_mask, taxable_val + np.maximum(0, available_proceeds), taxable_val)
                        prop['is_sold'] = np.where(active_mask, True, prop['is_sold'])
                        prop['values'] = np.where(active_mask, 0, prop['values'])

            # F. RMD Logic (Age 73+ for either spouse)
            # Each spouse's RMD is calculated from their half of pretax assets
            # IMPORTANT: Use original balance for both calculations to avoid double-counting bug
            total_rmd = np.zeros(simulations)
            original_pretax = pretax_std.copy()  # Store original balance before RMD calculations
            rmd_factors = {
                73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
                78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
                83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
                88: 13.7, 89: 12.9, 90: 12.2
            }
            for age in [p1_age, p2_age]:
                if age >= 73:
                    factor = rmd_factors.get(int(age), 12.2)
                    # Each spouse's RMD based on their half of original pretax balance
                    curr_rmd = (original_pretax / 2.0) / factor
                    total_rmd += curr_rmd
            # Deduct total RMD from pretax balance (after both are calculated)
            pretax_std -= total_rmd
            
            if np.any(total_rmd > 0):
                # Use progressive tax on RMDs (stacked on existing ordinary income)
                # Calculate tax on total income with RMD vs without
                taxable_with_rmd = np.maximum(0, year_ordinary_income + total_rmd - STANDARD_DEDUCTION_MFJ)
                taxable_without_rmd = np.maximum(0, year_ordinary_income - STANDARD_DEDUCTION_MFJ)
                tax_with_rmd, _ = self._vectorized_federal_tax(taxable_with_rmd, 'mfj')
                tax_without_rmd, _ = self._vectorized_federal_tax(taxable_without_rmd, 'mfj')
                rmd_tax = tax_with_rmd - tax_without_rmd
                net_rmd = total_rmd - rmd_tax
                # Update year_ordinary_income to include RMD for future stacking
                year_ordinary_income = year_ordinary_income + total_rmd
                used_for_shortfall = np.minimum(shortfall, net_rmd)
                shortfall -= used_for_shortfall
                taxable_val += (net_rmd - used_for_shortfall)

            # G. Optimized Withdrawal Strategy (Waterfall)
            # Sequence: Cash -> Taxable -> Pre-Tax -> Roth
            # (457b has special rules allowing early withdrawal without penalty)
            # Track cumulative taxable income for progressive tax stacking
            cumulative_ordinary = year_ordinary_income.copy()

            # 1. Cash (Already taxed, no growth)
            mask = shortfall > 0
            if np.any(mask):
                withdrawal = np.minimum(shortfall, cash)
                cash -= withdrawal
                shortfall -= withdrawal

            # 2. 457b (Special case: No early withdrawal penalty if separated from service)
            mask = (shortfall > 0)
            if np.any(mask) and p1_age < 59.5:
                # Calculate marginal tax rate based on current ordinary income
                taxable_now = np.maximum(0, cumulative_ordinary - STANDARD_DEDUCTION_MFJ)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now, 'mfj')
                # Estimate effective rate for withdrawal (use marginal as approximation)
                eff_rate = np.where(marginal_rate > 0, marginal_rate, 0.12)  # Default to 12%
                gross_needed = shortfall / (1 - eff_rate)
                withdrawal = np.minimum(gross_needed, pretax_457)
                pretax_457 -= withdrawal
                # Calculate actual tax on withdrawal using stacked income
                taxable_after = np.maximum(0, cumulative_ordinary + withdrawal - STANDARD_DEDUCTION_MFJ)
                tax_after, _ = self._vectorized_federal_tax(taxable_after, 'mfj')
                tax_before, _ = self._vectorized_federal_tax(taxable_now, 'mfj')
                actual_tax = tax_after - tax_before
                net_withdrawal = withdrawal - actual_tax
                cumulative_ordinary += withdrawal
                shortfall -= net_withdrawal

            # 3. Taxable Brokerage (Pay capital gains tax stacked on ordinary income)
            mask = shortfall > 0
            if np.any(mask):
                denom = np.where(taxable_val > 0, taxable_val, 1.0)
                gain_ratio = np.maximum(0, (taxable_val - taxable_basis) / denom)
                gain_ratio = np.where(taxable_val > 0, gain_ratio, 0)

                # Estimate withdrawal needed (iterate once for better estimate)
                # First pass: estimate with flat 15% LTCG rate
                est_tax_rate = gain_ratio * 0.15
                gross_needed = shortfall / np.maximum(0.01, 1 - est_tax_rate)
                withdrawal = np.minimum(gross_needed, taxable_val)
                gains_realized = withdrawal * gain_ratio

                # Calculate actual LTCG tax using income stacking
                ltcg_tax = self._vectorized_ltcg_tax(gains_realized, cumulative_ordinary, 'mfj')
                net_withdrawal = withdrawal - ltcg_tax

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

                # Calculate marginal rate for estimation
                taxable_now = np.maximum(0, cumulative_ordinary - STANDARD_DEDUCTION_MFJ)
                _, marginal_rate = self._vectorized_federal_tax(taxable_now, 'mfj')
                eff_rate = np.where(marginal_rate > 0, marginal_rate, 0.12) + penalty

                gross_needed = shortfall / np.maximum(0.01, 1 - eff_rate)
                withdrawal = np.minimum(gross_needed, pretax_std)
                pretax_std -= withdrawal

                # Calculate actual tax on withdrawal using stacked income
                taxable_after = np.maximum(0, cumulative_ordinary + withdrawal - STANDARD_DEDUCTION_MFJ)
                tax_after, _ = self._vectorized_federal_tax(taxable_after, 'mfj')
                tax_before, _ = self._vectorized_federal_tax(taxable_now, 'mfj')
                actual_tax = (tax_after - tax_before) + (withdrawal * penalty)
                net_withdrawal = withdrawal - actual_tax
                cumulative_ordinary += withdrawal
                shortfall -= net_withdrawal

            # 5. Roth Assets (Tax-free, last resort to preserve tax-free growth)
            mask = shortfall > 0
            if np.any(mask):
                withdrawal = np.minimum(shortfall, roth)
                roth -= withdrawal
                shortfall -= withdrawal

            # H. Growth & Balances
            # Apply growth
            year_returns = market_returns[:, year_idx]
            
            cash *= (1 + CASH_INTEREST)
            taxable_val *= (1 + year_returns)
            pretax_std *= (1 + year_returns)
            pretax_457 *= (1 + year_returns)
            roth *= (1 + year_returns)
            
            # Grow homes
            for prop in home_props_state:
                # Only grow if not sold
                # Generate random appreciation for each sim/home
                # We can't reuse the main inflation/return matrices directly as home appreciation 
                # usually tracks inflation + variance, or specific rate.
                # Let's generate a vector of appreciation for this property/year
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
            'warnings': [],
            'recommendations': []
        }
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

    def calculate_budget_income(self, simulation_year: int, current_cpi: np.ndarray, p1_retired: bool, p2_retired: bool) -> np.ndarray:
        """Calculate total income from budget categories for a given year (Vectorized)"""
        if not self.profile.budget:
            return np.zeros_like(current_cpi)

        budget = self.profile.budget
        income_section = budget.get('income', {})

        # Initialize result vector
        total_income = np.zeros_like(current_cpi)

        # 1. Employment income - strictly tied to individual retirement status
        current_employment = income_section.get('current', {}).get('employment', {})
        if not p1_retired:
            total_income += current_employment.get('primary_person', 0)
        if not p2_retired:
            total_income += current_employment.get('spouse', 0)

        # 2. Dynamic Income Streams with Blended Logic
        # Blended Budget Logic (matching expense logic):
        # Both working -> 100% current
        # One retired -> 50% current / 50% future
        # Both retired -> 100% future
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

        return total_income

    def calculate_budget_expenses(self, simulation_year: int, current_cpi: np.ndarray, p1_retired: bool, p2_retired: bool, housing_costs: np.ndarray) -> np.ndarray:
        """Calculate total expenses from budget categories for a given year (Vectorized)"""
        if not self.profile.budget:
            return housing_costs

        budget = self.profile.budget
        expenses_section = budget.get('expenses', {})

        # Blended Budget Logic:
        # Both working -> 100% current
        # One retired -> 50% current / 50% future
        # Both retired -> 100% future
        retirement_weight = 0.0
        if p1_retired: retirement_weight += 0.5
        if p2_retired: retirement_weight += 0.5

        def get_period_expenses(period):
            period_total = np.zeros_like(current_cpi)
            period_expenses = expenses_section.get(period, {})

            # Iterate through all categories (including custom ones)
            for category in period_expenses.keys():
                cat_data = period_expenses.get(category, {})

                # Handle both array (new format) and object (legacy format) structures
                expense_items = []
                if isinstance(cat_data, list):
                    # New format: array of expense items
                    expense_items = cat_data
                elif isinstance(cat_data, dict) and cat_data.get('amount'):
                    # Legacy format: single expense object
                    expense_items = [cat_data]

                # Process each expense item in this category
                for item in expense_items:
                    amount = item.get('amount', 0)
                    amount = self._annual_amount(amount, item.get('frequency', 'monthly'))

                    # Check if expense is active in this simulation year
                    if not self._is_expense_active(item, simulation_year):
                        continue

                    if category == 'housing' and np.any(housing_costs > 0):
                        period_total += housing_costs
                    else:
                        if item.get('inflation_adjusted', True):
                            period_total += amount * current_cpi
                        else:
                            period_total += amount
            return period_total

        if retirement_weight == 0:
            return get_period_expenses('current')
        elif retirement_weight == 1.0:
            return get_period_expenses('future')
        else:
            # Weighted average of current and future budgets
            current_exp = get_period_expenses('current')
            future_exp = get_period_expenses('future')
            return (current_exp * 0.5) + (future_exp * 0.5)
