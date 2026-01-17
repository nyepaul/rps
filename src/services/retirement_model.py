"""Retirement planning business logic and financial modeling."""
import numpy as np
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict

@dataclass
class Person:
    name: str
    birth_date: datetime
    retirement_date: datetime
    social_security: float
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
            val = float(inv.get('value', 0))
            basis = float(inv.get('cost_basis', 0))
            
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
                        'amount': float(s['amount']),
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
                prop_val = float(prop.get('current_value', 0))
                prop_mort = float(prop.get('mortgage_balance', 0))
                prop_costs = (
                    float(prop.get('annual_property_tax', 0)) +
                    float(prop.get('annual_insurance', 0)) +
                    float(prop.get('annual_maintenance', 0)) +
                    float(prop.get('annual_hoa', 0))
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
                    'appreciation_rate': float(prop.get('appreciation_rate', assumptions.inflation_mean)),
                    'sale_year': sale_year,
                    'purchase_price': float(prop.get('purchase_price', prop_val)),
                    'property_type': prop.get('property_type', 'Primary Residence'),
                    'replacement_cost': float(prop.get('replacement_value', 0)),
                    'is_sold': np.zeros(simulations, dtype=bool) # Track sold state
                })

        # Constants
        ORDINARY_TAX = effective_tax_rate
        CAP_GAINS_TAX = 0.15
        EARLY_PENALTY = 0.10
        CASH_INTEREST = 0.015
        
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

            # B. Calculate Income
            # Dynamic Social Security & Pensions
            p1_ss = (self.profile.person1.social_security * 12) if p1_retired else 0
            p2_ss = (self.profile.person2.social_security * 12) if p2_retired else 0
            active_pension = base_pension if p1_retired else 0
            
            total_income = (p1_ss + p2_ss + active_pension) * current_cpi
            
            # Additional Income Streams
            for stream in income_streams_data:
                if simulation_year >= stream['start_year']:
                    if stream['inflation_adjusted']:
                        total_income += stream['amount'] * current_cpi
                    else:
                        total_income += stream['amount']
            
            if self.profile.budget:
                total_income += self.calculate_budget_income(simulation_year, current_cpi, p1_retired, p2_retired)

            # C. Calculate Expenses
            current_housing_costs = np.zeros(simulations)
            for prop in home_props_state:
                unsold_mask = ~prop['is_sold']
                current_housing_costs += np.where(unsold_mask, prop['annual_costs'], 0)
            
            current_housing_costs *= current_cpi
            spending_mult = spending_multipliers[year_idx]

            if self.profile.budget:
                target_spending = self.calculate_budget_expenses(simulation_year, current_cpi, p1_retired, p2_retired, current_housing_costs)
                if spending_mult != 1.0:
                    target_spending = ((target_spending - current_housing_costs) * spending_mult) + current_housing_costs
            else:
                target_spending = (self.profile.target_annual_income * current_cpi * spending_mult) + current_housing_costs

            # D. Calculate Shortfall
            shortfall = np.maximum(0, target_spending - total_income)
            shortfall = np.maximum(0, target_spending - total_income)

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
                        capital_gains_tax = taxable_gain * CAP_GAINS_TAX
                        net_proceeds = gross_proceeds - mortgage_payoff - transaction_costs - capital_gains_tax
                        available_proceeds = net_proceeds - prop['replacement_cost']
                        taxable_val = np.where(active_mask, taxable_val + np.maximum(0, available_proceeds), taxable_val)
                        prop['is_sold'] = np.where(active_mask, True, prop['is_sold'])
                        prop['values'] = np.where(active_mask, 0, prop['values'])

            # F. RMD Logic (Age 73+ for either spouse)
            # This is a simplification assuming joint assets are split or both have IRAs
            total_rmd = np.zeros(simulations)
            for age in [p1_age, p2_age]:
                if age >= 73:
                    factor = 12.2 # default
                    rmd_factors = {
                        73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
                        78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
                        83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
                        88: 13.7, 89: 12.9, 90: 12.2
                    }
                    if int(age) in rmd_factors:
                        factor = rmd_factors[int(age)]
                    
                    # Assume each spouse owns half of pretax assets for RMD purposes if joint
                    # Or just apply to the whole for simplicity in aggregate model
                    curr_rmd = (pretax_std / 2.0) / factor
                    total_rmd += curr_rmd
                    pretax_std -= curr_rmd
            
            if np.any(total_rmd > 0):
                net_rmd = total_rmd * (1 - ORDINARY_TAX)
                used_for_shortfall = np.minimum(shortfall, net_rmd)
                shortfall -= used_for_shortfall
                taxable_val += (net_rmd - used_for_shortfall)

            # G. Optimized Withdrawal Strategy (Waterfall)
            # Sequence: Cash -> Taxable -> Pre-Tax -> Roth
            # (457b has special rules allowing early withdrawal without penalty)
            
            # 1. Cash (Already taxed, no growth)
            mask = shortfall > 0
            if np.any(mask):
                withdrawal = np.minimum(shortfall, cash)
                cash -= withdrawal
                shortfall -= withdrawal

            # 2. 457b (Special case: No early withdrawal penalty if separated from service)
            mask = (shortfall > 0)
            if np.any(mask) and p1_age < 59.5:
                gross_needed = shortfall / (1 - ORDINARY_TAX)
                withdrawal = np.minimum(gross_needed, pretax_457)
                pretax_457 -= withdrawal
                shortfall -= (withdrawal * (1 - ORDINARY_TAX))

            # 3. Taxable Brokerage (Pay only capital gains on growth)
            mask = shortfall > 0
            if np.any(mask):
                denom = np.where(taxable_val > 0, taxable_val, 1.0)
                gain_ratio = np.maximum(0, (taxable_val - taxable_basis) / denom)
                gain_ratio = np.where(taxable_val > 0, gain_ratio, 0)
                
                eff_tax_rate = gain_ratio * CAP_GAINS_TAX
                gross_needed = shortfall / (1 - eff_tax_rate)
                withdrawal = np.minimum(gross_needed, taxable_val)
                
                basis_ratio = np.where(taxable_val > 0, taxable_basis / taxable_val, 0)
                basis_reduction = withdrawal * basis_ratio
                
                taxable_val -= withdrawal
                taxable_basis -= basis_reduction
                shortfall -= (withdrawal * (1 - eff_tax_rate))

            # 4. Pre-Tax (Traditional IRA/401k) - Subject to Ordinary Income Tax
            mask = shortfall > 0
            if np.any(mask):
                # Apply 10% penalty if under 59.5 (excluding 457b handled above)
                penalty = np.where(p1_age < 59.5, EARLY_PENALTY, 0)
                tax_rate = ORDINARY_TAX + penalty
                gross_needed = shortfall / (1 - tax_rate)
                withdrawal = np.minimum(gross_needed, pretax_std)
                pretax_std -= withdrawal
                shortfall -= (withdrawal * (1 - tax_rate))

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
                        pension_annual += float(s['amount'])
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
            for category in ['housing', 'transportation', 'food', 'healthcare',
                            'insurance', 'discretionary', 'other']:
                cat_data = expenses_section.get(period, {}).get(category, {})
                amount = cat_data.get('amount', 0)
                amount = self._annual_amount(amount, cat_data.get('frequency', 'monthly'))

                if category == 'housing' and np.any(housing_costs > 0):
                    period_total += housing_costs
                else:
                    if cat_data.get('inflation_adjusted', True):
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
