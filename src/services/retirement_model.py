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
    def monte_carlo_simulation(self, years: int, simulations: int = 10000, assumptions: MarketAssumptions = None, effective_tax_rate: float = 0.22):
        """Run Monte Carlo simulation with granular account logic and expert tax modeling"""
        if assumptions is None:
            assumptions = MarketAssumptions()
        stock_pct = assumptions.stock_allocation
        returns_mean_adj = stock_pct * assumptions.stock_return_mean + (1 - stock_pct) * assumptions.bond_return_mean
        returns_std_adj = stock_pct * assumptions.stock_return_std + (1 - stock_pct) * assumptions.bond_return_std
        # Initial bucket values from investment_types for granularity
        # 1. Cash (Checking/Savings) - No market growth, just inflation protection
        start_cash = 0
        # 2. Taxable (Taxable Brokerage + legacy Liquid)
        start_taxable_val = 0
        start_taxable_basis = 0
        # 3. Pre-Tax (Standard: IRA, 401k, 403b, 401a)
        start_pretax_std = 0
        # 4. Pre-Tax (457b: No early penalty)
        start_pretax_457 = 0
        # 5. Roth
        start_roth = 0
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
                start_pretax_std += val # Treat pension lump sum as pre-tax standard
        # Guaranteed Income
        base_ss = (self.profile.person1.social_security + self.profile.person2.social_security) * 12
        base_pension = self.profile.pension_annual
        # Pre-process income streams
        stream_data = []
        if self.profile.income_streams:
            for s in self.profile.income_streams:
                try:
                    start_year = datetime.fromisoformat(s['start_date']).year
                    stream_data.append({
                        'name': s['name'],
                        'amount': float(s['amount']),
                        'start_year': start_year,
                        'inflation_adjusted': s.get('inflation_adjusted', True)
                    })
                except: pass
        # Pre-process home properties
        home_properties = []
        if self.profile.home_properties:
            for prop in self.profile.home_properties:
                prop_dict = {
                    'value': float(prop.get('current_value', 0)),
                    'mortgage': float(prop.get('mortgage_balance', 0)),
                    'appreciation_rate': prop.get('appreciation_rate') if prop.get('appreciation_rate') is not None else assumptions.inflation_mean,
                    'annual_costs': (
                        float(prop.get('annual_property_tax', 0)) +
                        float(prop.get('annual_insurance', 0)) +
                        float(prop.get('annual_maintenance', 0)) +
                        float(prop.get('annual_hoa', 0))
                    ),
                    'property_type': prop.get('property_type', 'Primary Residence'),
                    'purchase_price': float(prop.get('purchase_price', prop.get('current_value', 0))),
                    'replacement_cost': float(prop.get('replacement_value', 0)),
                    'sale_year': None
                }
                # Calculate sale year from planned_sale_date
                if prop.get('planned_sale_date'):
                    try:
                        sale_year = datetime.fromisoformat(prop['planned_sale_date']).year
                        prop_dict['sale_year'] = sale_year
                    except: pass
                home_properties.append(prop_dict)
        success_count = 0
        ending_balances = []
        all_paths = np.zeros((simulations, years))
        ORDINARY_TAX = effective_tax_rate
        CAP_GAINS_TAX = 0.15
        EARLY_PENALTY = 0.10
        CASH_INTEREST = 0.015  # 1.5% interest on cash (savings account rate)
        for sim in range(simulations):
            cash = start_cash
            taxable_val = start_taxable_val
            taxable_basis = start_taxable_basis
            pretax_std = start_pretax_std
            pretax_457 = start_pretax_457
            roth = start_roth
            # Deep copy home properties for this simulation
            sim_home_properties = [prop.copy() for prop in home_properties]
            p1_birth_year = self.profile.person1.birth_date.year
            current_cpi = 1.0
            for year in range(years):
                current_age = (self.current_year + year) - p1_birth_year
                simulation_year = self.current_year + year
                annual_return = np.random.normal(returns_mean_adj, returns_std_adj)
                inflation = np.random.normal(assumptions.inflation_mean, assumptions.inflation_std)
                if year > 0: current_cpi *= (1 + inflation)
                # Grow all buckets
                cash *= (1 + CASH_INTEREST)  # Low interest rate for cash accounts
                taxable_val *= (1 + annual_return)
                # Basis stays same (simplified - no reinvestment of dividends modeling)
                pretax_std *= (1 + annual_return)
                pretax_457 *= (1 + annual_return)
                roth *= (1 + annual_return)
                # Grow home values with their appreciation rates
                for prop in sim_home_properties:
                    if prop['value'] > 0:  # Not yet sold
                        annual_appreciation = np.random.normal(prop['appreciation_rate'], 0.05)
                        prop['value'] *= (1 + annual_appreciation)
                # Calculate housing costs from unsold properties
                housing_costs = sum(prop['annual_costs'] for prop in sim_home_properties if prop['value'] > 0)

                # Determine if retired this year
                retirement_year = self.profile.person1.retirement_date.year
                is_retired = simulation_year >= retirement_year

                # Calculate income and expenses
                if self.profile.budget:
                    # Use budget-based calculations
                    budget_income = self.calculate_budget_income(simulation_year, current_cpi, is_retired)
                    income_this_year = (base_ss + base_pension) * current_cpi + budget_income
                    target_spending = self.calculate_budget_expenses(simulation_year, current_cpi, is_retired, housing_costs)
                else:
                    # Legacy fallback: use existing logic
                    target_spending = (self.profile.target_annual_income + housing_costs) * current_cpi
                    income_this_year = (base_ss + base_pension) * current_cpi
                    for s in stream_data:
                        if simulation_year >= s['start_year']:
                            income_this_year += (s['amount'] * (current_cpi if s['inflation_adjusted'] else 1.0))

                shortfall = max(0, target_spending - income_this_year)
                # 0. Check for planned home sales
                for prop in sim_home_properties:
                    if prop['value'] > 0 and prop['sale_year'] and simulation_year == prop['sale_year']:
                        # Calculate sale proceeds
                        gross_proceeds = prop['value']
                        mortgage_payoff = prop['mortgage']
                        transaction_costs = gross_proceeds * 0.06  # 6% realtor fees

                        # Calculate capital gains tax
                        gain = gross_proceeds - prop['purchase_price']

                        # Section 121 exclusion for primary residence
                        # Assume married for now (could check marital status from profile)
                        if prop['property_type'] == 'Primary Residence':
                            exclusion = 500000  # Married filing jointly
                            taxable_gain = max(0, gain - exclusion)
                        else:
                            taxable_gain = gain

                        capital_gains_tax = max(0, taxable_gain * CAP_GAINS_TAX)

                        # Net proceeds after costs
                        net_proceeds = (gross_proceeds - mortgage_payoff -
                                      transaction_costs - capital_gains_tax)

                        # Purchase replacement home if specified
                        replacement_cost = prop['replacement_cost']
                        available_proceeds = net_proceeds - replacement_cost

                        # Add to taxable investments
                        taxable_val += max(0, available_proceeds)

                        # Mark property as sold
                        prop['value'] = 0
                        prop['mortgage'] = 0
                        prop['annual_costs'] = 0
                # 1. RMD Logic (Age 73+) - applies to both pretax buckets
                if current_age >= 73:
                    rmd_std = self.calculate_rmd(current_age, pretax_std)
                    rmd_457 = self.calculate_rmd(current_age, pretax_457)
                    total_rmd = rmd_std + rmd_457
                    pretax_std -= rmd_std
                    pretax_457 -= rmd_457
                    net_rmd = total_rmd * (1 - ORDINARY_TAX)
                    used_for_shortfall = min(shortfall, net_rmd)
                    shortfall -= used_for_shortfall
                    taxable_val += (net_rmd - used_for_shortfall) # Reinvest excess RMD
                # 2. Sequential Withdrawal Strategy
                if shortfall > 0:
                    # Strategy: Use Cash FIRST (checking/savings - no tax, no penalty)
                    from_cash = min(shortfall, cash)
                    cash -= from_cash
                    shortfall -= from_cash
                if shortfall > 0:
                    # Strategy: Use 457(b) if under 59.5 to avoid penalties on others
                    if current_age < 59.5:
                        gross_needed = shortfall / (1 - ORDINARY_TAX)
                        from_457 = min(gross_needed, pretax_457)
                        pretax_457 -= from_457
                        shortfall -= (from_457 * (1 - ORDINARY_TAX))
                if shortfall > 0:
                    # Strategy: Use Taxable Assets
                    # Tax modeling: Withdrawal = Cash_Needed + LTCG_Tax
                    # Tax = (Withdrawal * Gain_Ratio) * 0.15
                    gain_ratio = max(0, (taxable_val - taxable_basis) / taxable_val) if taxable_val > 0 else 0
                    # X = shortfall / (1 - (gain_ratio * 0.15))
                    gross_taxable_needed = shortfall / (1 - (gain_ratio * CAP_GAINS_TAX))
                    from_taxable = min(gross_taxable_needed, taxable_val)
                    taxable_val -= from_taxable
                    # Reduce basis proportionally
                    taxable_basis -= (from_taxable * (taxable_basis / (taxable_val + from_taxable))) if (taxable_val + from_taxable) > 0 else 0
                    shortfall -= (from_taxable * (1 - (gain_ratio * CAP_GAINS_TAX)))
                if shortfall > 0:
                    # Strategy: Use Pre-Tax Standard (IRA/401k)
                    tax_rate = ORDINARY_TAX + (EARLY_PENALTY if current_age < 59.5 else 0)
                    gross_std_needed = shortfall / (1 - tax_rate)
                    from_std = min(gross_std_needed, pretax_std)
                    pretax_std -= from_std
                    shortfall -= (from_std * (1 - tax_rate))
                if shortfall > 0:
                    # Strategy: Use remaining 457(b) (if any left after early access or if over 59.5)
                    gross_457_needed = shortfall / (1 - ORDINARY_TAX)
                    from_457 = min(gross_457_needed, pretax_457)
                    pretax_457 -= from_457
                    shortfall -= (from_457 * (1 - ORDINARY_TAX))
                if shortfall > 0:
                    # Strategy: Use Roth (Tax-Free)
                    from_roth = min(shortfall, roth)
                    roth -= from_roth
                    shortfall -= from_roth
                total_portfolio = cash + taxable_val + pretax_std + pretax_457 + roth
                if total_portfolio <= 0:
                    total_portfolio = 0
                    all_paths[sim, year] = 0
                    break
                all_paths[sim, year] = total_portfolio
            if (cash + taxable_val + pretax_std + pretax_457 + roth) > 0:
                success_count += 1
            ending_balances.append(cash + taxable_val + pretax_std + pretax_457 + roth)
        success_rate = success_count / simulations  # Return as decimal (0-1) not percentage
        ending_balances_array = np.array(ending_balances)
        return {
            'success_rate': success_rate,
            'median_final_balance': float(np.median(ending_balances_array)),
            'percentile_10': float(np.percentile(ending_balances_array, 10)),
            'percentile_90': float(np.percentile(ending_balances_array, 90)),
            'expected_value': float(np.mean(ending_balances_array)),
            'std_deviation': float(np.std(ending_balances_array)),
            'starting_portfolio': start_cash + start_taxable_val + start_pretax_std + start_pretax_457 + start_roth,
            'annual_withdrawal_need': self.profile.target_annual_income - (base_ss + base_pension),
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

    def calculate_budget_income(self, simulation_year: int, current_cpi: float, is_retired: bool) -> float:
        """Calculate total income from budget categories for a given year"""
        if not self.profile.budget:
            return 0

        budget = self.profile.budget
        income_section = budget.get('income', {})
        period = 'future' if is_retired else 'current'

        total_income = 0

        # Employment income (current only)
        if period == 'current':
            employment = income_section.get('current', {}).get('employment', {})
            total_income += employment.get('primary_person', 0)
            total_income += employment.get('spouse', 0)

        # Other income categories
        for category in ['rental_income', 'part_time_consulting', 'business_income',
                        'investment_income', 'other_income']:
            items = income_section.get(period, {}).get(category, [])
            for item in items:
                try:
                    # Check if income is active this year
                    start_year = datetime.fromisoformat(item['start_date']).year
                    end_year = datetime.fromisoformat(item['end_date']).year if item.get('end_date') else 9999

                    if start_year <= simulation_year <= end_year:
                        amount = self._annual_amount(item['amount'], item.get('frequency', 'monthly'))
                        if item.get('inflation_adjusted', True):
                            amount *= current_cpi
                        total_income += amount
                except:
                    pass  # Skip invalid income items

        return total_income

    def calculate_budget_expenses(self, simulation_year: int, current_cpi: float, is_retired: bool, housing_costs: float) -> float:
        """Calculate total expenses from budget categories for a given year"""
        if not self.profile.budget:
            return 0

        budget = self.profile.budget
        expenses_section = budget.get('expenses', {})
        period = 'future' if is_retired else 'current'

        total_expenses = 0

        for category in ['housing', 'transportation', 'food', 'healthcare',
                        'insurance', 'discretionary', 'other']:
            cat_data = expenses_section.get(period, {}).get(category, {})
            amount = cat_data.get('amount', 0)
            amount = self._annual_amount(amount, cat_data.get('frequency', 'monthly'))

            if cat_data.get('inflation_adjusted', True):
                amount *= current_cpi

            total_expenses += amount

        # Override housing with real estate costs if available
        if housing_costs > 0:
            # Subtract budget housing, add actual housing costs
            housing_budget = expenses_section.get(period, {}).get('housing', {}).get('amount', 0)
            housing_budget_annual = self._annual_amount(housing_budget, 'monthly')
            if expenses_section.get(period, {}).get('housing', {}).get('inflation_adjusted', True):
                housing_budget_annual *= current_cpi
            total_expenses = total_expenses - housing_budget_annual + housing_costs

        return total_expenses
