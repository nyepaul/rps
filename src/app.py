from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict
import sqlite3
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import io
import os
import shutil
import threading
import time
import google.generativeai as genai
import anthropic
import logging
from logging.handlers import RotatingFileHandler
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16MB limit for image uploads
# Configure logging
handler = RotatingFileHandler('../logs/app.log', maxBytes=10000, backupCount=1)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)
@app.errorhandler(500)
def server_error(e):
    app.logger.error(f"Server Error: {e}", exc_info=True)
    return jsonify(error=str(e)), 500
# Use local data directory if not in Docker
if os.path.exists('/app/data'):
    DB_PATH = '/app/data/planning.db'
    BACKUP_DIR = '/app/backups'
    DATA_DIR = '/app/data'
else:
    DB_PATH = '../data/planning.db'
    BACKUP_DIR = '../backups'
    DATA_DIR = '../data'

# Ensure backup directory exists
os.makedirs(BACKUP_DIR, exist_ok=True)
def call_gemini_with_fallback(prompt, api_key, image_data=None):
    """Calls Gemini with a prioritized list of models and fallback logic."""
    models = [
        'models/gemini-3-pro',
        'models/gemini-3-flash',
        'models/gemini-3-flash-preview'
    ]
    last_error = None
    genai.configure(api_key=api_key)
    for model_name in models:
        try:
            print(f"Attempting Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)
            if image_data:
                # Image extraction case
                image_part = {"mime_type": "image/jpeg", "data": image_data}
                response = model.generate_content([prompt, image_part])
            else:
                # Text generation case
                response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            last_error = str(e)
            print(f"Gemini model {model_name} failed: {last_error}")
            continue
    raise Exception(f"All Gemini models failed. Last error: {last_error}")
def call_claude_with_fallback(prompt, api_key, system_prompt=None, history=None):
    """Calls Claude with a prioritized list of models and fallback logic."""
    models = [
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-latest',
        'claude-3-opus-latest'
    ]
    last_error = None
    client = anthropic.Anthropic(api_key=api_key)
    for model_name in models:
        try:
            print(f"Attempting Claude model: {model_name}")
            messages = []
            if history:
                for role, content in history:
                    messages.append({"role": "user" if role == "user" else "assistant", "content": content})
            messages.append({"role": "user", "content": prompt})
            kwargs = {
                "model": model_name,
                "max_tokens": 2000,
                "messages": messages
            }
            if system_prompt:
                kwargs["system"] = system_prompt
            response = client.messages.create(**kwargs)
            if response and response.content:
                return response.content[0].text
        except Exception as e:
            last_error = str(e)
            print(f"Claude model {model_name} failed: {last_error}")
            continue
    raise Exception(f"All Claude models failed. Last error: {last_error}")
@app.route('/')
def index():
    return send_file('static/index.html')
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS profile
                 (id INTEGER PRIMARY KEY,
                  name TEXT UNIQUE,
                  birth_date TEXT,
                  retirement_date TEXT,
                  data TEXT,
                  updated_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS scenarios
                 (id INTEGER PRIMARY KEY,
                  name TEXT,
                  parameters TEXT,
                  results TEXT,
                  created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS action_items
                 (id INTEGER PRIMARY KEY,
                  profile_name TEXT,
                  category TEXT,
                  description TEXT,
                  priority TEXT,
                  status TEXT,
                  due_date TEXT,
                  created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY,
                  profile_name TEXT,
                  role TEXT,
                  content TEXT,
                  created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS system_settings
                 (key TEXT PRIMARY KEY,
                  value TEXT)''')
    # Migration: Add action_data column if it doesn't exist
    try:
        c.execute('ALTER TABLE action_items ADD COLUMN action_data TEXT')
    except sqlite3.OperationalError:
        pass # Column likely already exists
    # Migration: Add subtasks column if it doesn't exist
    try:
        c.execute('ALTER TABLE action_items ADD COLUMN subtasks TEXT')
    except sqlite3.OperationalError:
        pass
    # Migration: Add profile_name column to action_items and conversations if they don't exist
    for table in ['action_items', 'conversations']:
        try:
            c.execute(f'ALTER TABLE {table} ADD COLUMN profile_name TEXT DEFAULT "main"')
        except sqlite3.OperationalError:
            pass
    # Deduplication Cleanup: Remove items with duplicate profile, category and description
    c.execute('''
        DELETE FROM action_items 
        WHERE id NOT IN (
            SELECT MAX(id) 
            FROM action_items 
            GROUP BY profile_name, category, description
        )
    ''')
    # Migration: Add unique index to prevent future duplicates (now includes profile_name)
    try:
        c.execute('DROP INDEX IF EXISTS idx_action_items_unique')
        c.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_action_items_unique ON action_items (profile_name, category, description)')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()
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
        success_rate = (success_count / simulations) * 100
        return {
            'success_rate': success_rate,
            'median_ending_balance': np.median(ending_balances),
            'percentile_5': np.percentile(ending_balances, 5),
            'percentile_95': np.percentile(ending_balances, 95),
            'starting_portfolio': start_taxable_val + start_pretax_std + start_pretax_457 + start_roth,
            'annual_withdrawal_need': self.profile.target_annual_income - (base_ss + base_pension),
            'timeline': {
                'years': list(range(self.current_year, self.current_year + years)),
                'p5': np.percentile(all_paths, 5, axis=0).tolist(),
                'median': np.median(all_paths, axis=0).tolist(),
                'p95': np.percentile(all_paths, 95, axis=0).tolist()
            }
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
@app.route('/api/extract-assets', methods=['POST'])
def extract_assets():
    print("Received extract-assets request")
    data = request.json
    image_b64 = data.get('image')
    provider = data.get('llm_provider', 'gemini')
    existing_assets = data.get('existing_assets', [])  # Accept existing asset data for merging
    print(f"Provider: {provider}, Image data length: {len(image_b64) if image_b64 else 0}")
    # API keys are now only read from environment variables
    if provider == 'gemini':
        api_key = os.environ.get('GEMINI_API_KEY')
    else:
        api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key or not image_b64:
        return jsonify({'error': f'Missing API key or image data. Set {provider.upper()}_API_KEY environment variable.'}), 400
    try:
        import base64
        # Decode base64 string to raw bytes
        image_bytes = base64.b64decode(image_b64)
        prompt = """
        Analyze this image of a financial statement or dashboard.
        Extract a list of investment accounts or assets.

        CRITICAL RULES - ONLY UPDATE VERIFIABLE FIELDS:
        1. Ignore "Total", "Grand Total", "Subtotal", "Margin", or "Buying Power" lines.
        2. Clean all values: remove "$", "USD", and commas. Return as numbers only.
        3. For each asset, extract ONLY the fields you can clearly see and verify:
           - "name": The specific name (e.g., "Cash & Money Market", "Vanguard 500"). REQUIRED.
           - "type": One of: "Liquid", "Traditional IRA", "Roth IRA", "401k", "403b", "401a", "457b", "Pension".
             ⚠️ ONLY include "type" if it is EXPLICITLY stated in the image (e.g., "IRA", "401k" visible in account name/label).
             If the account type is not clearly visible, set "type" to null.
           - "value": The current balance as a number. REQUIRED if visible.
           - "cost_basis": Only include if explicitly shown (rare). Otherwise set to null.

        4. DO NOT GUESS or INFER field values. If a field is not clearly visible, use null.
        5. Return ONLY a JSON array of objects with the structure: [{"name": "...", "type": null or "...", "value": ..., "cost_basis": null or ...}]
        """
        if provider == 'gemini':
            text_response = call_gemini_with_fallback(prompt, api_key, image_data=image_bytes)
            # Parse JSON
            try:
                # Clean markdown
                json_str = text_response.replace('```json', '').replace('```', '').strip()
                extracted_assets = json.loads(json_str)

                # Merge with existing assets: preserve fields that are null in extracted data
                merged_assets = []
                for extracted in extracted_assets:
                    # Find matching existing asset by name (case-insensitive)
                    existing = next(
                        (a for a in existing_assets if a.get('name', '').lower() == extracted.get('name', '').lower()),
                        None
                    )

                    if existing:
                        # Merge: use extracted values if present, otherwise keep existing
                        merged = {
                            'name': extracted.get('name') or existing.get('name'),
                            'type': extracted.get('type') or existing.get('type', 'Liquid'),
                            'value': extracted.get('value') if extracted.get('value') is not None else existing.get('value', 0),
                            'cost_basis': extracted.get('cost_basis') if extracted.get('cost_basis') is not None else existing.get('cost_basis', 0)
                        }
                    else:
                        # New asset: use extracted data with defaults for null fields
                        merged = {
                            'name': extracted.get('name', 'Unknown Asset'),
                            'type': extracted.get('type') or 'Liquid',  # Default to Liquid if type not visible
                            'value': extracted.get('value', 0),
                            'cost_basis': extracted.get('cost_basis', 0)
                        }
                    merged_assets.append(merged)

                return jsonify({'assets': merged_assets, 'status': 'success'})
            except Exception as e:
                return jsonify({'error': f'Failed to parse LLM response: {str(e)}', 'raw_response': text_response}), 500
        else:
            return jsonify({'error': 'Only Gemini is currently supported for image extraction'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/scenarios', methods=['GET', 'POST'])
def scenarios():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO scenarios (name, parameters, results, created_at) VALUES (?, ?, ?, ?)',
                  (data['name'], json.dumps(data['parameters']), json.dumps(data['results']), datetime.now().isoformat()))
        conn.commit()
        scenario_id = c.lastrowid
        conn.close()
        return jsonify({'status': 'success', 'id': scenario_id})
    else:
        c.execute('SELECT id, name, created_at FROM scenarios ORDER BY created_at DESC')
        rows = c.fetchall()
        conn.close()
        return jsonify([{'id': r[0], 'name': r[1], 'created_at': r[2]} for r in rows])
@app.route('/api/scenarios/<int:id>', methods=['GET', 'DELETE'])
def scenario_detail(id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if request.method == 'DELETE':
        c.execute('DELETE FROM scenarios WHERE id = ?', (id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    else:
        c.execute('SELECT * FROM scenarios WHERE id = ?', (id,))
        row = c.fetchone()
        conn.close()
        if row:
            return jsonify({'id': row[0], 'name': row[1], 'parameters': json.loads(row[2]), 'results': json.loads(row[3]), 'created_at': row[4]})
        return jsonify(None), 404
@app.route('/api/profiles', methods=['GET'])
def list_profiles():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT name, updated_at FROM profile ORDER BY updated_at DESC')
    rows = c.fetchall()
    conn.close()
    profiles = [{'name': row[0], 'updated_at': row[1]} for row in rows]
    return jsonify(profiles)
@app.route('/api/profile/<name>', methods=['GET', 'POST', 'DELETE'])
def manage_profile(name):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        if request.method == 'GET':
            c.execute('SELECT data FROM profile WHERE name = ?', (name,))
            row = c.fetchone()
            conn.close()
            if row:
                return jsonify(json.loads(row[0]))
            else:
                return jsonify(None), 404
        elif request.method == 'POST':
            if not request.is_json:
                return jsonify({'error': 'Request must be JSON'}), 400
            data = request.json
            if data is None:
                 return jsonify({'error': 'No JSON data provided'}), 400
            # Check if exists to update, or insert new
            c.execute('SELECT id FROM profile WHERE name = ?', (name,))
            row = c.fetchone()
            if row:
                c.execute('''UPDATE profile 
                             SET data = ?, updated_at = ? 
                             WHERE name = ?''',
                          (json.dumps(data), datetime.now().isoformat(), name))
            else:
                c.execute('''INSERT INTO profile (name, data, updated_at) 
                             VALUES (?, ?, ?)''',
                          (name, json.dumps(data), datetime.now().isoformat()))
            conn.commit()
            conn.close()
            return jsonify({'status': 'success'})
        elif request.method == 'DELETE':
            c.execute('DELETE FROM profile WHERE name = ?', (name,))
            conn.commit()
            conn.close()
            return jsonify({'status': 'success'})
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500
# Legacy endpoint for backward compatibility (defaults to 'main')
@app.route('/api/profile', methods=['GET', 'POST'])
def profile_legacy():
    if request.method == 'POST':
        return manage_profile('main')
    else:
        return manage_profile('main')

@app.route('/api/load-sample-profile', methods=['POST'])
def load_sample_profile():
    """Load the comprehensive sample profile into the database"""
    try:
        # Read sample profile from file
        sample_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'examples', 'sample-profile.json')
        if not os.path.exists(sample_file_path):
            return jsonify({'error': 'Sample profile file not found'}), 404

        with open(sample_file_path, 'r') as f:
            sample_data = json.load(f)

        profile_name = sample_data.pop('profile_name', 'Sample Family - Complete Demo')

        # Save to database
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        # Check if profile already exists
        c.execute('SELECT id FROM profile WHERE name = ?', (profile_name,))
        row = c.fetchone()

        if row:
            # Update existing
            c.execute('''UPDATE profile
                         SET data = ?, updated_at = ?
                         WHERE name = ?''',
                      (json.dumps(sample_data), datetime.now().isoformat(), profile_name))
        else:
            # Insert new
            c.execute('''INSERT INTO profile (name, data, updated_at)
                         VALUES (?, ?, ?)''',
                      (profile_name, json.dumps(sample_data), datetime.now().isoformat()))

        conn.commit()
        conn.close()

        return jsonify({
            'status': 'success',
            'profile_name': profile_name,
            'message': f'Sample profile "{profile_name}" loaded successfully'
        })
    except Exception as e:
        return jsonify({'error': f'Failed to load sample profile: {str(e)}'}), 500

@app.route('/api/analysis', methods=['POST'])
def analysis():
    data = request.json
    # Extract market assumptions with defaults
    market_assumptions_data = data.get('market_assumptions', {})
    assumptions = MarketAssumptions(
        stock_allocation=market_assumptions_data.get('stock_allocation', 0.5),
        stock_return_mean=market_assumptions_data.get('stock_return_mean', 0.10),
        bond_return_mean=market_assumptions_data.get('bond_return_mean', 0.04),
        inflation_mean=market_assumptions_data.get('inflation_mean', 0.03),
        stock_return_std=market_assumptions_data.get('stock_return_std', 0.18),
        bond_return_std=market_assumptions_data.get('bond_return_std', 0.06),
        inflation_std=market_assumptions_data.get('inflation_std', 0.01),
        ss_discount_rate=market_assumptions_data.get('ss_discount_rate', 0.03)
    )
    # Extract assumed tax rate
    effective_tax_rate = data.get('assumed_tax_rate', 0.22)
    # Extract simulation count (default to 10000 if not provided)
    simulations = int(data.get('simulations', 10000))
    # Clamp to reasonable bounds
    simulations = max(1000, min(50000, simulations))
    person1 = Person(
        name=data['person1']['name'],
        birth_date=datetime.fromisoformat(data['person1']['birth_date']),
        retirement_date=datetime.fromisoformat(data['person1']['retirement_date']),
        social_security=data['person1']['social_security']
    )
    person2 = Person(
        name=data['person2']['name'],
        birth_date=datetime.fromisoformat(data['person2']['birth_date']),
        retirement_date=datetime.fromisoformat(data['person2']['retirement_date']),
        social_security=data['person2']['social_security']
    )
    profile = FinancialProfile(
        person1=person1,
        person2=person2,
        children=data.get('children', []),
        liquid_assets=data['liquid_assets'],
        traditional_ira=data['traditional_ira'],
        roth_ira=data['roth_ira'],
        pension_lump_sum=data.get('pension_lump_sum', 0),
        pension_annual=data.get('pension_annual', 0),
        annual_expenses=data['annual_expenses'],
        target_annual_income=data['target_annual_income'],
        risk_tolerance=data.get('risk_tolerance', 'moderate'),
        asset_allocation=data.get('asset_allocation', {'stocks': 0.5, 'bonds': 0.5}),
        future_expenses=data.get('future_expenses', []),
        investment_types=data.get('investment_types', []),
        accounts=data.get('accounts', []),
        income_streams=data.get('income_streams', []),
        home_properties=data.get('home_properties', [])
    )
    model = RetirementModel(profile)
    years = 30
    monte_carlo = model.monte_carlo_simulation(years, simulations=simulations, assumptions=assumptions, effective_tax_rate=effective_tax_rate)
    # Add simulation count to results for frontend display
    monte_carlo['simulations_run'] = simulations
    ss_optimization = model.optimize_social_security(assumptions=assumptions)
    roth_conversion = model.calculate_roth_conversion_opportunity()
    wealth_transfer = model.calculate_wealth_transfer_strategy()
    person1_age_now = (datetime.now() - person1.birth_date).days / 365.25
    current_rmd = model.calculate_rmd(int(person1_age_now), profile.traditional_ira)
    # Calculate home equity
    total_home_equity = 0
    if profile.home_properties:
        for prop in profile.home_properties:
            total_home_equity += (float(prop.get('current_value', 0)) -
                                 float(prop.get('mortgage_balance', 0)))
    return jsonify({
        'monte_carlo': monte_carlo,
        'social_security_optimization': ss_optimization[:3],
        'roth_conversion': roth_conversion,
        'wealth_transfer': wealth_transfer,
        'current_rmd': current_rmd,
        'total_net_worth': (profile.liquid_assets + profile.traditional_ira +
                           profile.roth_ira + profile.pension_lump_sum + total_home_equity),
        'home_equity': total_home_equity,
        'guaranteed_income': person1.social_security * 12 + person2.social_security * 12,
        'guaranteed_income_delayed': 8680 * 12,  # Both delayed to 70
        'market_assumptions_used': {
            'stock_allocation': assumptions.stock_allocation,
            'stock_return_mean': assumptions.stock_return_mean,
            'bond_return_mean': assumptions.bond_return_mean,
            'inflation_mean': assumptions.inflation_mean,
            'stock_return_std': assumptions.stock_return_std,
            'bond_return_std': assumptions.bond_return_std,
            'inflation_std': assumptions.inflation_std,
            'ss_discount_rate': assumptions.ss_discount_rate
        }
    })
def add_page_header_footer(canvas, doc):
    """Add professional header and footer to each page"""
    canvas.saveState()

    # Header
    canvas.setFillColor(colors.HexColor('#003366'))  # Professional dark blue
    canvas.rect(0, letter[1] - 0.8*inch, letter[0], 0.8*inch, fill=True, stroke=False)

    # Company/System name in header
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 18)
    canvas.drawString(0.75*inch, letter[1] - 0.55*inch, "Retirement Planning System")
    canvas.setFont('Helvetica', 10)
    canvas.drawString(0.75*inch, letter[1] - 0.7*inch, "Comprehensive Wealth & Legacy Analysis")

    # Footer
    canvas.setFillColor(colors.HexColor('#003366'))
    canvas.rect(0, 0, letter[0], 0.5*inch, fill=True, stroke=False)

    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica', 8)
    footer_text = "This report is for informational purposes only and does not constitute financial advice. Consult a qualified advisor before making financial decisions."
    canvas.drawCentredString(letter[0]/2, 0.25*inch, footer_text)

    # Page number
    canvas.setFont('Helvetica', 9)
    canvas.drawRightString(letter[0] - 0.75*inch, letter[1] - 0.55*inch, f"Page {doc.page}")

    canvas.restoreState()

@app.route('/api/report/pdf', methods=['POST'])
def generate_pdf_report():
    data = request.json
    profile_data = data.get('profile', {})
    analysis_data = data.get('analysis', {})

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=1*inch,
        bottomMargin=0.75*inch,
        leftMargin=0.75*inch,
        rightMargin=0.75*inch
    )

    # Custom styles
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#003366'),
        spaceAfter=6,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold'
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#003366'),
        spaceBefore=20,
        spaceAfter=12,
        fontName='Helvetica-Bold',
        borderPadding=(0, 0, 5, 0),
        borderColor=colors.HexColor('#003366'),
        borderWidth=2,
        borderRadius=None
    )

    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#0066CC'),
        spaceBefore=12,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#333333')
    )

    highlight_style = ParagraphStyle(
        'Highlight',
        parent=styles['Normal'],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor('#0066CC'),
        fontName='Helvetica-Bold'
    )

    story = []

    # Cover Page
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("RETIREMENT PLANNING ANALYSIS", title_style))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(f"Prepared for {profile_data.get('person1', {}).get('name', 'Client')}", heading_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(f"<b>Report Date:</b> {datetime.now().strftime('%B %d, %Y')}", body_style))
    story.append(Spacer(1, 2*inch))

    # Executive Summary Box
    exec_summary_data = [[Paragraph("<b>EXECUTIVE SUMMARY</b>", heading_style)]]
    exec_table = Table(exec_summary_data, colWidths=[6.5*inch])
    exec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E8F4F8')),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#003366')),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 0.2*inch))

    # Calculate key metrics
    net_worth = sum([
        profile_data.get('liquid_assets', 0),
        profile_data.get('traditional_ira', 0),
        profile_data.get('roth_ira', 0),
        profile_data.get('pension_lump_sum', 0)
    ])

    # Calculate total home equity
    total_home_equity = 0
    if profile_data.get('home_properties'):
        for prop in profile_data['home_properties']:
            total_home_equity += (float(prop.get('current_value', 0)) -
                                 float(prop.get('mortgage_balance', 0)))

    net_worth += total_home_equity

    mc = analysis_data.get('monte_carlo', {})
    success_rate = mc.get('success_rate', 0)

    # Key metrics table
    key_metrics = [
        ["", ""],
        [Paragraph("<b>Total Net Worth</b>", body_style), Paragraph(f"<b>${net_worth:,.0f}</b>", highlight_style)],
        [Paragraph("<b>Plan Success Rate</b>", body_style), Paragraph(f"<b>{success_rate:.1f}%</b>", highlight_style)],
        [Paragraph("<b>Target Annual Income</b>", body_style), Paragraph(f"<b>${profile_data.get('target_annual_income', 0):,.0f}</b>", highlight_style)],
        [Paragraph("<b>Projected Median Balance (Age 90)</b>", body_style), Paragraph(f"<b>${mc.get('median_ending_balance', 0):,.0f}</b>", highlight_style)]
    ]

    metrics_table = Table(key_metrics, colWidths=[3*inch, 3*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
    ]))
    story.append(metrics_table)

    story.append(PageBreak())

    # Financial Profile Section
    story.append(Paragraph("FINANCIAL PROFILE OVERVIEW", heading_style))
    story.append(Spacer(1, 0.15*inch))

    # Personal Information
    person1 = profile_data.get('person1', {})
    person2 = profile_data.get('person2', {})

    personal_info = [
        [Paragraph("<b>Client Information</b>", subheading_style), ""],
        ["Primary Client", person1.get('name', 'N/A')],
        ["Birth Date", person1.get('birth_date', 'N/A')],
        ["Planned Retirement", person1.get('retirement_date', 'N/A')],
        ["Social Security (Monthly)", f"${person1.get('social_security', 0):,.0f}"],
        ["", ""],
        ["Secondary Client", person2.get('name', 'N/A')],
        ["Birth Date", person2.get('birth_date', 'N/A')],
        ["Planned Retirement", person2.get('retirement_date', 'N/A')],
        ["Social Security (Monthly)", f"${person2.get('social_security', 0):,.0f}"]
    ]

    personal_table = Table(personal_info, colWidths=[2.5*inch, 3.5*inch])
    personal_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('SPAN', (0, 0), (1, 0)),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('LINEABOVE', (0, 6), (-1, 6), 2, colors.HexColor('#003366'))
    ]))
    story.append(personal_table)
    story.append(Spacer(1, 0.3*inch))

    # Asset Allocation
    story.append(Paragraph("Asset Allocation", subheading_style))
    story.append(Spacer(1, 0.1*inch))

    investment_types = profile_data.get('investment_types', [])
    if investment_types:
        asset_data = [["Account Type", "Institution/Name", "Current Value"]]
        for inv in investment_types[:10]:  # Limit to 10 for space
            asset_data.append([
                inv.get('account', 'N/A'),
                inv.get('name', 'N/A'),
                f"${float(inv.get('value', 0)):,.0f}"
            ])

        asset_table = Table(asset_data, colWidths=[2*inch, 2.5*inch, 1.5*inch])
        asset_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066CC')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]))
        story.append(asset_table)

    story.append(PageBreak())

    # Monte Carlo Analysis
    story.append(Paragraph("MONTE CARLO SIMULATION RESULTS", heading_style))
    story.append(Spacer(1, 0.15*inch))

    simulations_run = mc.get('simulations_run', 10000)
    mc_intro = f"""This analysis ran {simulations_run:,} simulations of your retirement using historical market data and probabilistic modeling.
    The results show a <b>{success_rate:.1f}%</b> probability that your assets will last through age 90."""
    story.append(Paragraph(mc_intro, body_style))
    story.append(Spacer(1, 0.2*inch))

    mc_results = [
        [Paragraph("<b>Outcome</b>", body_style), Paragraph("<b>Value</b>", body_style), Paragraph("<b>Interpretation</b>", body_style)],
        ["Best Case (95th %ile)", f"${mc.get('percentile_95', 0):,.0f}", "5% chance of exceeding this amount"],
        ["Median Outcome", f"${mc.get('median_ending_balance', 0):,.0f}", "Most likely ending balance"],
        ["Worst Case (5th %ile)", f"${mc.get('percentile_5', 0):,.0f}", "5% chance of falling below this"],
        ["Plan Success Rate", f"{success_rate:.1f}%", "Probability of success"]
    ]

    mc_table = Table(mc_results, colWidths=[2*inch, 1.8*inch, 2.7*inch])
    mc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066CC')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
    ]))
    story.append(mc_table)

    # Risk Assessment Box
    story.append(Spacer(1, 0.3*inch))
    if success_rate >= 90:
        risk_color = colors.HexColor('#28A745')
        risk_text = "Your plan shows a HIGH probability of success. Your retirement appears financially secure under most scenarios."
    elif success_rate >= 75:
        risk_color = colors.HexColor('#FFC107')
        risk_text = "Your plan shows a MODERATE probability of success. Consider optimizing spending or retirement timing."
    else:
        risk_color = colors.HexColor('#DC3545')
        risk_text = "Your plan shows a LOWER probability of success. We recommend reviewing your spending, retirement date, or investment strategy."

    risk_assessment = [[Paragraph(f"<b>RISK ASSESSMENT:</b> {risk_text}", body_style)]]
    risk_table = Table(risk_assessment, colWidths=[6.5*inch])
    risk_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), risk_color),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('BOX', (0, 0), (-1, -1), 2, risk_color),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
    ]))
    story.append(risk_table)

    # Social Security Strategy
    if analysis_data.get('social_security_optimization'):
        story.append(PageBreak())
        story.append(Paragraph("SOCIAL SECURITY CLAIMING STRATEGY", heading_style))
        story.append(Spacer(1, 0.15*inch))

        ss_opts = analysis_data['social_security_optimization'][:3]
        ss_data = [["Claiming Strategy", "Person 1 Age", "Person 2 Age", "Lifetime Value (NPV)"]]
        for idx, opt in enumerate(ss_opts):
            strategy_name = "Recommended" if idx == 0 else f"Alternative {idx}"
            ss_data.append([
                strategy_name,
                str(opt['person1_claim_age']),
                str(opt['person2_claim_age']),
                f"${opt['lifetime_benefit_npv']:,.0f}"
            ])

        ss_table = Table(ss_data, colWidths=[2.2*inch, 1.3*inch, 1.3*inch, 1.7*inch])
        ss_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066CC')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#E8F4F8')),
            ('BACKGROUND', (0, 2), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC'))
        ]))
        story.append(ss_table)

    # Action Items
    story.append(PageBreak())
    story.append(Paragraph("RECOMMENDED ACTION ITEMS", heading_style))
    story.append(Spacer(1, 0.15*inch))

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    profile_name = profile_data.get('_profile_name', 'main')
    c.execute("SELECT category, description, priority, due_date FROM action_items WHERE profile_name = ? AND status='pending' ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, due_date LIMIT 10", (profile_name,))
    action_rows = c.fetchall()
    conn.close()

    if action_rows:
        action_data = [["Priority", "Category", "Action Item", "Due Date"]]
        for row in action_rows:
            category, description, priority, due_date = row
            # Clean HTML
            clean_desc = description.replace('<br>', ' ').replace('<b>', '').replace('</b>', '')
            if "<a" in clean_desc:
                clean_desc = clean_desc.split("<a")[0]
            clean_desc = clean_desc[:100] + "..." if len(clean_desc) > 100 else clean_desc

            action_data.append([
                priority.upper(),
                category,
                clean_desc,
                due_date[:10] if due_date else 'N/A'
            ])

        action_table = Table(action_data, colWidths=[0.8*inch, 1.3*inch, 3.2*inch, 0.9*inch])
        action_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#28A745')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        story.append(action_table)
    else:
        story.append(Paragraph("No pending action items found. Consider running a self-assessment to identify opportunities.", body_style))

    # Important Disclaimer
    story.append(Spacer(1, 0.4*inch))
    disclaimer = """<b>IMPORTANT DISCLAIMER:</b> This report is provided for informational and educational purposes only.
    It does not constitute financial, legal, tax, or investment advice. All projections are based on assumptions about future market returns,
    inflation, and other economic factors that may not materialize. Past performance does not guarantee future results.
    Please consult with a qualified financial advisor, tax professional, and attorney before making any financial decisions."""

    disclaimer_data = [[Paragraph(disclaimer, ParagraphStyle('Disclaimer', parent=body_style, fontSize=8, leading=11, textColor=colors.HexColor('#666666')))]]
    disclaimer_table = Table(disclaimer_data, colWidths=[6.5*inch])
    disclaimer_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CCCCCC')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F9FA')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(disclaimer_table)

    # Build PDF with header/footer
    doc.build(story, onFirstPage=add_page_header_footer, onLaterPages=add_page_header_footer)

    buffer.seek(0)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'retirement_analysis_{datetime.now().strftime("%Y%m%d")}.pdf',
        mimetype='application/pdf'
    )
@app.route('/api/action-items', methods=['GET', 'POST', 'PUT', 'DELETE'])
def action_items():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    profile_name = request.args.get('profile_name', 'main')
    if request.method == 'POST':
        data = request.json
        category = data['category']
        description = data['description']
        p_name = data.get('profile_name', profile_name)
        # Deduplication check
        c.execute('SELECT id FROM action_items WHERE profile_name = ? AND category = ? AND description = ?', (p_name, category, description))
        existing = c.fetchone()
        if existing:
            conn.close()
            return jsonify({'id': existing[0], 'status': 'exists'})
        action_data = json.dumps(data.get('action_data')) if data.get('action_data') else None
        subtasks = json.dumps(data.get('subtasks')) if data.get('subtasks') else None
        c.execute('''INSERT INTO action_items 
                     (profile_name, category, description, priority, status, due_date, action_data, subtasks, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                  (p_name, category, description, data['priority'],
                   data.get('status', 'pending'), data.get('due_date'),
                   action_data, subtasks,
                   datetime.now().isoformat()))
        conn.commit()
        item_id = c.lastrowid
        conn.close()
        return jsonify({'id': item_id, 'status': 'success'})
    elif request.method == 'GET':
        c.execute('SELECT id, category, description, priority, status, due_date, created_at, action_data, subtasks FROM action_items WHERE profile_name = ? ORDER BY priority, due_date', (profile_name,))
        rows = c.fetchall()
        conn.close()
        items = []
        for row in rows:
            item = {
                'id': row[0],
                'category': row[1],
                'description': row[2],
                'priority': row[3],
                'status': row[4],
                'due_date': row[5],
                'created_at': row[6]
            }
            if row[7]:
                try:
                    item['action_data'] = json.loads(row[7])
                except:
                    item['action_data'] = None
            if row[8]:
                try:
                    item['subtasks'] = json.loads(row[8])
                except:
                    item['subtasks'] = []
            else:
                item['subtasks'] = []
            items.append(item)
        return jsonify(items)
    elif request.method == 'PUT':
        data = request.json
        # Build update query dynamically based on provided fields
        fields = []
        values = []
        if 'status' in data:
            fields.append("status = ?")
            values.append(data['status'])
        if 'action_data' in data:
            fields.append("action_data = ?")
            values.append(json.dumps(data['action_data']))
        if 'subtasks' in data:
            fields.append("subtasks = ?")
            values.append(json.dumps(data['subtasks']))
        if not fields:
            return jsonify({'status': 'no_change'})
        values.append(data['id'])
        query = f"UPDATE action_items SET {', '.join(fields)} WHERE id = ?"
        c.execute(query, tuple(values))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    elif request.method == 'DELETE':
        data = request.json
        c.execute('DELETE FROM action_items WHERE id = ?', (data['id'],))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
@app.route('/api/action-items/cleanup', methods=['POST'])
def cleanup_action_items():
    """Manually trigger deduplication of action items"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        DELETE FROM action_items
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM action_items
            GROUP BY profile_name, category, description
        )
    ''')
    removed = conn.total_changes
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'removed_count': removed})
@app.route('/api/generate-action-items', methods=['POST'])
def generate_action_items():
    data = request.json
    analysis = data.get('analysis', {})
    profile_name = data.get('profile_name', 'main')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    items = []
    roth = analysis.get('roth_conversion', {})
    if roth.get('opportunity') == 'excellent':
        items.append({
            'category': 'Tax Planning',
            'description': f"Execute Roth conversion of ${roth.get('annual_conversion_12_bracket', 0):,.0f} in 12% bracket. <br><a href='https://www.irs.gov/retirement-plans/roth-iras' target='_blank'>IRS Roth IRA Info</a>",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=90)).isoformat()
        })
    items.append({
        'category': 'Estate Planning',
        'description': 'Create Healthcare Power of Attorney and Living Will. <br><a href=\'https://www.nolo.com/legal-encyclopedia/living-wills-healthcare-power-of-attorney-29569.html\' target=\'_blank\'>Guide to Healthcare Directives</a>',
        'priority': 'critical',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=30)).isoformat()
    })
    items.append({
        'category': 'Estate Planning',
        'description': 'Create Durable Financial Power of Attorney. <br><a href=\'https://www.investopedia.com/articles/managing-wealth/04/durable-power-of-attorney.asp\' target=\'_blank\'>Investopedia Guide</a>',
        'priority': 'critical',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=30)).isoformat()
    })
    items.append({
        'category': 'Estate Planning',
        'description': 'Draft Revocable Living Trust and Pour-Over Will. <br><a href=\'https://www.legalzoom.com/articles/living-trust-vs-will\' target=\'_blank\'>Trust vs. Will</a>',
        'priority': 'high',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=60)).isoformat()
    })
    items.append({
        'category': 'Estate Planning',
        'description': 'Review and update all beneficiary designations. <br><a href=\'https://www.schwab.com/learn/story/beneficiary-designations-5-steps-to-protect-your-legacy\' target=\'_blank\'>Beneficiary Guide</a>',
        'priority': 'high',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=45)).isoformat()
    })
    wealth = analysis.get('wealth_transfer', {})
    if wealth.get('annual_gift_capacity', 0) > 0:
        items.append({
            'category': 'Wealth Transfer',
            'description': f"Begin annual gifts of ${wealth['annual_gift_capacity']:,.0f} to sons. <br><a href='https://www.irs.gov/businesses/small-businesses-self-employed/frequently-asked-questions-on-gift-taxes' target='_blank'>IRS Gift Tax FAQs</a>",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=60)).isoformat()
        })
    items.append({
        'category': 'Insurance',
        'description': 'Evaluate long-term care insurance options. <br><a href=\'https://acl.gov/ltc\' target=\'_blank\'>LongTermCare.gov</a>',
        'priority': 'medium',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=90)).isoformat()
    })
    items.append({
        'category': 'Insurance',
        'description': 'Review life insurance coverage and beneficiaries. <br><a href=\'https://www.policygenius.com/life-insurance/\' target=\'_blank\'>Life Insurance Guide</a>',
        'priority': 'medium',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=60)).isoformat()
    })
    monte = analysis.get('monte_carlo', {})
    if monte.get('success_rate', 100) < 85:
        items.append({
            'category': 'Retirement Planning',
            'description': f"Review spending plan - success rate is {monte['success_rate']:.0f}%, target 90%+. <br><a href='https://www.bogleheads.org/wiki/Safe_withdrawal_rates' target='_blank'>Safe Withdrawal Rates</a>",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=30)).isoformat()
        })
    items_created = 0
    for item in items:
        c.execute('''INSERT OR IGNORE INTO action_items
                     (profile_name, category, description, priority, status, due_date, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)''',
                  (profile_name, item['category'], item['description'], item['priority'],
                   item['status'], item['due_date'], datetime.now().isoformat()))
        if c.rowcount > 0:
            items_created += 1
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'items_created': items_created})
@app.route('/api/perform-self-assessment', methods=['POST'])
def perform_self_assessment():
    """Uses LLM to assess the plan against available skills and generate todos"""
    data = request.json
    profile_name = data.get('profile_name', 'main')
    # Get provider and API key
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    llm_provider = data.get('llm_provider')
    if not llm_provider:
        c.execute('SELECT value FROM system_settings WHERE key = "default_llm"')
        row = c.fetchone()
        llm_provider = row[0] if row else 'gemini'
    # API keys are now only read from environment variables
    api_key = None
    if llm_provider == 'gemini':
        api_key = os.environ.get('GEMINI_API_KEY')
    else: # claude
        api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        conn.close()
        return jsonify({'error': f'{llm_provider.capitalize()} API key not configured. Set {llm_provider.upper()}_API_KEY environment variable.'}), 400
    try:
        # 1. Gather Context
        profile_data = data.get('profile_data')
        if not profile_data:
            c.execute('SELECT data FROM profile WHERE name = ?', (profile_name,))
            row = c.fetchone()
            if not row:
                 c.execute('SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1')
                 row = c.fetchone()
            profile_data = json.loads(row[0]) if row else {}
        # B. Existing Action Items (Profile-specific)
        c.execute('SELECT category, description, status FROM action_items WHERE profile_name = ?', (profile_name,))
        existing_items = [{'category': r[0], 'description': r[1], 'status': r[2]} for r in c.fetchall()]
        conn.close()
        # C. Skills Content
        skills_content = ""
        skills_path = Path('../skills')
        if skills_path.exists():
            for skill_file in skills_path.glob('*-SKILL.md'):
                with open(skill_file, 'r') as f:
                    skills_content += f"\n\n--- {skill_file.name} ---\n{f.read()}"
        # 2. Construct Prompt
        prompt = f"""You are an expert financial auditor. Your task is to review a user's financial profile against a library of "Financial Skills" (best practices) and their current to-do list.
Identify GAPS where the user is failing to implement the advice in the skills.
Generate a list of 3-5 high-impact, specific "Action Items" to close these gaps.
CONTEXT:
USER PROFILE:
{json.dumps(profile_data, indent=2)}
CURRENT ACTION ITEMS:
{json.dumps(existing_items, indent=2)}
AVAILABLE SKILLS (Best Practices):
{skills_content[:20000]}
INSTRUCTIONS:
1. Compare the Profile + Current Items against the Skills.
2. Find specific strategies mentioned in the Skills that are NOT in the Profile or Action Items.
3. Output a JSON list of new action items. format:
[
  {{
    "category": "Category Name",
    "description": "Specific action to take",
    "priority": "high|medium|low",
    "due_date_days": 30,
    "action_data": {{ "field": "...", "value": ... }}
  }}
]
Do not output markdown formatting, just the raw JSON.
"""
        text = ""
        if llm_provider == 'gemini':
            text = call_gemini_with_fallback(prompt, api_key)
        else: # Claude
            text = call_claude_with_fallback(prompt, api_key)
        # 4. Parse and Save
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        new_items = json.loads(text.strip())
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        items_created = 0
        for item in new_items:
            # Check for duplicates
            c.execute('''SELECT COUNT(*) FROM action_items 
                         WHERE profile_name = ? AND description = ?''', (profile_name, item['description']))
            if c.fetchone()[0] == 0:
                action_data = json.dumps(item.get('action_data')) if item.get('action_data') else None
                due_date = (datetime.now() + timedelta(days=item.get('due_date_days', 30))).isoformat()
                c.execute('''INSERT INTO action_items 
                             (profile_name, category, description, priority, status, due_date, action_data, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                          (profile_name, item['category'], item['description'], item['priority'], 
                           'pending', due_date, action_data, datetime.now().isoformat()))
                items_created += 1
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'items_created': items_created})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/advisor/chat', methods=['POST'])
def advisor_chat():
    """AI advisor endpoint that provides personalized financial guidance"""
    data = request.json
    user_message = data.get('message', '')
    include_context = data.get('include_context', True)
    profile_name = data.get('profile_name', 'main')
    # Get provider and API key
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Check system settings for default provider if not in request
    llm_provider = data.get('llm_provider')
    if not llm_provider:
        c.execute('SELECT value FROM system_settings WHERE key = "default_llm"')
        row = c.fetchone()
        llm_provider = row[0] if row else 'gemini'
    # API keys are now only read from environment variables
    api_key = None
    if llm_provider == 'gemini':
        api_key = os.environ.get('GEMINI_API_KEY')
    else: # claude
        api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        conn.close()
        return jsonify({'error': f'{llm_provider.capitalize()} API key not configured. Set {llm_provider.upper()}_API_KEY environment variable.'}), 400
    try:
        # Load conversation history from database (Profile-specific)
        c.execute('SELECT role, content FROM conversations WHERE profile_name = ? ORDER BY id ASC', (profile_name,))
        history_rows = c.fetchall()
        # Build financial context if requested
        system_prompt = """You are an expert financial advisor specializing in retirement planning, tax optimization, estate planning, and wealth transfer strategies.
You provide personalized, actionable advice based on the user's specific financial situation. Your guidance should be:
- Clear and easy to understand (avoid jargon unless explaining it)
- Based on current tax laws and financial planning best practices
- Focused on actionable recommendations with specific next steps
- Balanced between optimism and realistic risk assessment
- Comprehensive, considering tax, legal, and financial implications

CRITICAL: When providing recommendations, you MUST consider and advise on:
1. **Retirement Timing**: Analyze whether the current retirement dates are optimal. Consider:
   - Social Security claiming strategies (early at 62, full at 67, delayed to 70)
   - Portfolio sustainability vs. additional working years
   - Healthcare coverage gaps before Medicare (age 65)
   - Tax bracket optimization through retirement date selection

2. **Financial Structure Recommendations**: Provide specific guidance on:
   - Roth conversion strategies and optimal conversion amounts
   - Asset allocation adjustments based on age and risk tolerance
   - Tax-efficient withdrawal sequencing
   - RMD planning and management strategies
   - Income stream optimization (pensions, annuities, Social Security)

3. **Scenario Optimization**: When you identify improvements, provide them in a structured format that can be applied to their profile:
   - Include specific parameter changes with exact values
   - Explain the rationale for each recommendation
   - Quantify expected improvements where possible

IMPORTANT: When you provide specific numerical recommendations (retirement dates, asset allocations, income targets, etc.), format them in a special ACTION_DATA block at the end of your response like this:

```action_data
{
  "retirement_date_p1": "2030-06-01",
  "retirement_date_p2": "2032-01-01",
  "stock_allocation": 0.65,
  "target_annual_income": 180000
}
```

Use these exact field names when applicable:
- retirement_date_p1, retirement_date_p2 (YYYY-MM-DD format)
- stock_allocation (0.0-1.0)
- target_annual_income (number)
- annual_expenses (number)
- p1_ss_monthly, p2_ss_monthly (Social Security monthly amounts)

When discussing strategies, explain both the benefits and potential drawbacks. Always remind users to consult with their own tax advisor, attorney, or financial planner before making major financial decisions."""
        financial_context = ""
        if include_context:
            # 1. Get Profile Data (Prefer request data, fallback to DB)
            profile_data = data.get('profile_data')
            if not profile_data:
                c.execute('SELECT data FROM profile WHERE name = ?', (profile_name,))
                profile_row = c.fetchone()
                if profile_row:
                    profile_data = json.loads(profile_row[0])
            # 2. Get Action Items (Profile-specific)
            c.execute('SELECT category, description, priority, status, due_date FROM action_items WHERE profile_name = ? ORDER BY status DESC, priority', (profile_name,))
            action_rows = c.fetchall()
            action_items_text = ""
            if action_rows:
                action_items_text = "\n### Current Action Items\n"
                for r in action_rows:
                    status_icon = "✅" if r[3] == 'completed' else "⬜"
                    action_items_text += f"- {status_icon} [{r[3].upper()}] {r[0]}: {r[1]} (Priority: {r[2]})\n"
            if profile_data:
                # Build detailed financial context
                financial_context = f"""
## USER'S FINANCIAL PROFILE ({profile_name})
### Personal Information
- Person 1: {profile_data.get('person1', {}).get('name', 'N/A')}
  - Birth Date: {profile_data.get('person1', {}).get('birth_date', 'N/A')}
  - Retirement Date: {profile_data.get('person1', {}).get('retirement_date', 'N/A')}
  - Social Security (monthly): ${profile_data.get('person1', {}).get('social_security', 0):,.2f}
- Person 2: {profile_data.get('person2', {}).get('name', 'N/A')}
  - Birth Date: {profile_data.get('person2', {}).get('birth_date', 'N/A')}
  - Retirement Date: {profile_data.get('person2', {}).get('retirement_date', 'N/A')}
  - Social Security (monthly): ${profile_data.get('person2', {}).get('social_security', 0):,.2f}
- Children: {len(profile_data.get('children', []))} children
### Assets
- Liquid Assets: ${profile_data.get('liquid_assets', 0):,.2f}
- Traditional IRA: ${profile_data.get('traditional_ira', 0):,.2f}
- Roth IRA: ${profile_data.get('roth_ira', 0):,.2f}
- Pension Lump Sum: ${profile_data.get('pension_lump_sum', 0):,.2f}
- Annual Pension Income: ${profile_data.get('pension_annual', 0):,.2f}
- Total Net Worth: ${profile_data.get('liquid_assets', 0) + profile_data.get('traditional_ira', 0) + profile_data.get('roth_ira', 0) + profile_data.get('pension_lump_sum', 0):,.2f}
### Income & Expenses
- Annual Expenses: ${profile_data.get('annual_expenses', 0):,.2f}
- Target Annual Income: ${profile_data.get('target_annual_income', 0):,.2f}
- Risk Tolerance: {profile_data.get('risk_tolerance', 'N/A')}
- Asset Allocation: Stocks {profile_data.get('asset_allocation', {}).get('stocks', 0.5)*100:.0f}%, Bonds {profile_data.get('asset_allocation', {}).get('bonds', 0.5)*100:.0f}%
{action_items_text}
### Key Planning Considerations
- Social Security optimization, Roth conversions, RMD management (age 73), annual gifting.
"""
        full_system_prompt = system_prompt + financial_context
        assistant_message = ""
        if llm_provider == 'gemini':
            # Gemini history needs special formatting
            gemini_history = []
            if len(history_rows) == 0:
                # Add system prompt as a user/model interaction to establish context in flash-preview
                # Or just prepend to the first message. For simplicity with the helper:
                contextual_message = full_system_prompt + "\n\nUser Message: " + user_message
                assistant_message = call_gemini_with_fallback(contextual_message, api_key)
            else:
                # Build context from history
                context_string = full_system_prompt + "\n\nConversation History:\n"
                for role, content in history_rows:
                    context_string += f"{'User' if role == 'user' else 'Assistant'}: {content}\n"
                context_string += f"User: {user_message}"
                assistant_message = call_gemini_with_fallback(context_string, api_key)
        else: # Claude
            assistant_message = call_claude_with_fallback(
                user_message, 
                api_key, 
                system_prompt=full_system_prompt,
                history=history_rows
            )
        # Parse action_data if present
        action_data = None
        import re
        action_data_match = re.search(r'```action_data\s*\n(.*?)\n```', assistant_message, re.DOTALL)
        if action_data_match:
            try:
                action_data = json.loads(action_data_match.group(1))
            except json.JSONDecodeError:
                pass  # Ignore malformed action_data

        # Store conversation in database (Profile-specific)
        c.execute('''INSERT INTO conversations (profile_name, role, content, created_at)
                     VALUES (?, ?, ?, ?)''',
                  (profile_name, 'user', user_message, datetime.now().isoformat()))
        c.execute('''INSERT INTO conversations (profile_name, role, content, created_at)
                     VALUES (?, ?, ?, ?)''',
                  (profile_name, 'assistant', assistant_message, datetime.now().isoformat()))
        conn.commit()
        conn.close()

        result = {
            'response': assistant_message,
            'status': 'success'
        }
        if action_data:
            result['action_data'] = action_data

        return jsonify(result)
    except Exception as e:
        if 'conn' in locals(): conn.close()
        return jsonify({'error': str(e)}), 500
@app.route('/api/advisor/clear', methods=['POST'])
def clear_conversation():
    """Clear conversation history (Profile-specific)"""
    profile_name = request.args.get('profile_name', 'main')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM conversations WHERE profile_name = ?', (profile_name,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})
@app.route('/api/advisor/history', methods=['GET'])
def get_conversation_history():
    """Get full conversation history (Profile-specific)"""
    profile_name = request.args.get('profile_name', 'main')
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT role, content, created_at FROM conversations WHERE profile_name = ? ORDER BY id ASC', (profile_name,))
    rows = c.fetchall()
    conn.close()
    history = []
    for role, content, created_at in rows:
        history.append({
            'role': role,
            'content': content,
            'created_at': created_at
        })
    return jsonify(history)

@app.route('/api/wizard/analyze', methods=['POST'])
def wizard_analyze():
    """Analyze profile completeness and generate questions"""
    try:
        data = request.json
        profile_name = data.get('profile_name', 'main')
        profile = data.get('profile', {})

        # Analyze what's missing or could be improved
        questions = []
        analysis_points = []

        # Check person details
        p1 = profile.get('person1', {})
        p2 = profile.get('person2', {})

        if not p1.get('name'):
            questions.append({'question': 'What is your first name?', 'field': 'person1.name'})
        if not p1.get('birth_date'):
            questions.append({'question': 'What is your date of birth?', 'field': 'person1.birth_date'})
        if p1.get('social_security', 0) == 0:
            questions.append({'question': 'What is your estimated monthly Social Security benefit? (Enter 0 if unknown)', 'field': 'person1.social_security'})

        if p2.get('name') and not p2.get('birth_date'):
            questions.append({'question': f'What is {p2.get("name")}\'s date of birth?', 'field': 'person2.birth_date'})
        if p2.get('name') and p2.get('social_security', 0) == 0:
            questions.append({'question': f'What is {p2.get("name")}\'s estimated monthly Social Security benefit?', 'field': 'person2.social_security'})

        # Check investment details
        investments = profile.get('investment_types', [])
        taxable_accounts = [inv for inv in investments if inv.get('account') in ['Liquid', 'Taxable Brokerage']]

        for i, inv in enumerate(taxable_accounts):
            if not inv.get('cost_basis') or inv.get('cost_basis') == 0:
                questions.append({
                    'question': f'What is the cost basis (original purchase price) for {inv.get("name")}? This helps calculate capital gains taxes.',
                    'field': f'investment_types.{i}.cost_basis'
                })

        # Check for income streams
        income_streams = profile.get('income_streams', [])
        if not income_streams:
            questions.append({
                'question': 'Do you have any pension, annuity, rental income, or other guaranteed income streams in retirement? (yes/no)',
                'field': 'income_streams'
            })

        # Check home properties
        home_properties = profile.get('home_properties', [])
        if not home_properties:
            questions.append({
                'question': 'Do you own your primary home or any real estate properties? (yes/no)',
                'field': 'home_properties'
            })

        # Build analysis summary
        if len(questions) == 0:
            analysis_summary = '✅ Your profile looks comprehensive! All key information is present.'
        else:
            analysis_summary = f'I found {len(questions)} areas where additional information could improve your plan.'

        return jsonify({
            'questions': questions[:5],  # Limit to 5 questions at a time
            'analysis_summary': analysis_summary,
            'total_gaps': len(questions)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/wizard/process', methods=['POST'])
def wizard_process():
    """Process wizard response and update profile"""
    try:
        data = request.json
        profile_name = data.get('profile_name', 'main')
        question = data.get('question', {})
        user_response = data.get('response', '')
        profile = data.get('profile', {})

        field = question.get('field', '')
        profile_updates = {}
        follow_up = None

        # Parse user response based on field
        if 'person1.name' in field:
            profile_updates['p1-name'] = user_response
        elif 'person1.birth_date' in field:
            # Try to parse date
            profile_updates['p1-birth'] = user_response
        elif 'person1.social_security' in field:
            try:
                amount = float(user_response.replace('$', '').replace(',', ''))
                profile_updates['p1-ss'] = amount
            except:
                follow_up = 'Please enter a numeric value for Social Security (e.g., 2500)'
        elif 'person2' in field:
            # Handle person 2 fields
            if 'birth_date' in field:
                profile_updates['p2-birth'] = user_response
            elif 'social_security' in field:
                try:
                    amount = float(user_response.replace('$', '').replace(',', ''))
                    profile_updates['p2-ss'] = amount
                except:
                    follow_up = 'Please enter a numeric value for Social Security (e.g., 2500)'
        elif 'income_streams' in field:
            if user_response.lower() in ['yes', 'y']:
                follow_up = 'What type of income? (e.g., pension, rental, annuity)'
            else:
                # No income streams, that's fine
                pass
        elif 'home_properties' in field:
            if user_response.lower() in ['yes', 'y']:
                follow_up = 'What is the estimated current value of your primary home?'
            else:
                # No property, that's fine
                pass
        elif 'cost_basis' in field:
            try:
                amount = float(user_response.replace('$', '').replace(',', ''))
                # Would need to update specific investment, but complex - skip for now
                profile_updates = {}
            except:
                follow_up = 'Please enter a numeric value (e.g., 500000)'

        return jsonify({
            'update_applied': True,
            'profile_updates': profile_updates,
            'follow_up': follow_up
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})
@app.route('/api/system/settings', methods=['GET', 'POST'])
def system_settings():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if request.method == 'POST':
        data = request.json
        for key, value in data.items():
            c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', (key, str(value)))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    else:
        c.execute('SELECT key, value FROM system_settings')
        rows = c.fetchall()
        conn.close()
        return jsonify({row[0]: row[1] for row in rows})
# ================================
# Auto-Backup System
# ================================

# Global variable to track backup thread
backup_thread = None
backup_stop_event = threading.Event()

def create_backup():
    """Create a timestamped backup of the database and data directory"""
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, timestamp)
        os.makedirs(backup_path, exist_ok=True)

        # Backup database
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, os.path.join(backup_path, 'planning.db'))

        # Backup skills directory if it exists
        skills_dir = os.path.join(os.path.dirname(DATA_DIR), 'skills')
        if os.path.exists(skills_dir):
            shutil.copytree(skills_dir, os.path.join(backup_path, 'skills'))

        # Update last backup timestamp in settings
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
                  ('last_backup_time', datetime.now().isoformat()))
        conn.commit()
        conn.close()

        print(f"Backup created successfully at {backup_path}")
        return backup_path
    except Exception as e:
        print(f"Backup failed: {e}")
        return None

def auto_backup_worker():
    """Background thread for automatic backups"""
    while not backup_stop_event.is_set():
        try:
            # Get backup settings from database
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT value FROM system_settings WHERE key = ?', ('auto_backup_enabled',))
            enabled_row = c.fetchone()

            c.execute('SELECT value FROM system_settings WHERE key = ?', ('auto_backup_interval_hours',))
            interval_row = c.fetchone()
            conn.close()

            auto_backup_enabled = enabled_row and enabled_row[0] == 'true'
            interval_hours = int(interval_row[0]) if interval_row else 24

            if auto_backup_enabled:
                create_backup()

            # Wait for the specified interval or until stop event
            backup_stop_event.wait(timeout=interval_hours * 3600)
        except Exception as e:
            print(f"Auto-backup worker error: {e}")
            backup_stop_event.wait(timeout=3600)  # Wait 1 hour on error

def start_auto_backup_thread():
    """Start the auto-backup background thread"""
    global backup_thread
    if backup_thread is None or not backup_thread.is_alive():
        backup_stop_event.clear()
        backup_thread = threading.Thread(target=auto_backup_worker, daemon=True)
        backup_thread.start()
        print("Auto-backup thread started")

@app.route('/api/backup/create', methods=['POST'])
def api_create_backup():
    """Manually trigger a backup"""
    backup_path = create_backup()
    if backup_path:
        return jsonify({'success': True, 'backup_path': os.path.basename(backup_path)})
    else:
        return jsonify({'success': False, 'error': 'Backup failed'}), 500

@app.route('/api/backup/list', methods=['GET'])
def api_list_backups():
    """List all available backups"""
    try:
        backups = []
        if os.path.exists(BACKUP_DIR):
            for item in sorted(os.listdir(BACKUP_DIR), reverse=True):
                backup_path = os.path.join(BACKUP_DIR, item)
                if os.path.isdir(backup_path):
                    # Get backup size
                    total_size = 0
                    for dirpath, dirnames, filenames in os.walk(backup_path):
                        for f in filenames:
                            fp = os.path.join(dirpath, f)
                            total_size += os.path.getsize(fp)

                    backups.append({
                        'name': item,
                        'timestamp': item,
                        'size_mb': round(total_size / (1024 * 1024), 2)
                    })
        return jsonify({'backups': backups})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/restore/<backup_name>', methods=['POST'])
def api_restore_backup(backup_name):
    """Restore from a specific backup"""
    try:
        backup_path = os.path.join(BACKUP_DIR, backup_name)
        if not os.path.exists(backup_path):
            return jsonify({'error': 'Backup not found'}), 404

        # Restore database
        backup_db = os.path.join(backup_path, 'planning.db')
        if os.path.exists(backup_db):
            shutil.copy2(backup_db, DB_PATH)

        # Restore skills if present
        backup_skills = os.path.join(backup_path, 'skills')
        skills_dir = os.path.join(os.path.dirname(DATA_DIR), 'skills')
        if os.path.exists(backup_skills):
            if os.path.exists(skills_dir):
                shutil.rmtree(skills_dir)
            shutil.copytree(backup_skills, skills_dir)

        return jsonify({'success': True, 'message': f'Restored from backup {backup_name}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/delete/<backup_name>', methods=['DELETE'])
def api_delete_backup(backup_name):
    """Delete a specific backup"""
    try:
        backup_path = os.path.join(BACKUP_DIR, backup_name)
        if not os.path.exists(backup_path):
            return jsonify({'error': 'Backup not found'}), 404

        shutil.rmtree(backup_path)
        return jsonify({'success': True, 'message': f'Deleted backup {backup_name}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup/settings', methods=['GET', 'POST'])
def api_backup_settings():
    """Get or update auto-backup settings"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    if request.method == 'POST':
        data = request.json
        if 'auto_backup_enabled' in data:
            c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
                      ('auto_backup_enabled', 'true' if data['auto_backup_enabled'] else 'false'))
        if 'auto_backup_interval_hours' in data:
            c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
                      ('auto_backup_interval_hours', str(data['auto_backup_interval_hours'])))

        conn.commit()
        conn.close()

        # Restart backup thread if settings changed
        if data.get('auto_backup_enabled'):
            start_auto_backup_thread()

        return jsonify({'success': True})
    else:
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('auto_backup_enabled',))
        enabled_row = c.fetchone()
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('auto_backup_interval_hours',))
        interval_row = c.fetchone()
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('last_backup_time',))
        last_backup_row = c.fetchone()
        conn.close()

        return jsonify({
            'auto_backup_enabled': enabled_row and enabled_row[0] == 'true',
            'auto_backup_interval_hours': int(interval_row[0]) if interval_row else 24,
            'last_backup_time': last_backup_row[0] if last_backup_row else None
        })

if __name__ == '__main__':
    # Create data directory
    data_dir = os.path.dirname(DB_PATH)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)
    init_db()

    # Start auto-backup thread
    start_auto_backup_thread()

    app.run(host='0.0.0.0', port=8080, debug=False)
