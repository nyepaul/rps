from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict
import sqlite3
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import io
import os
import google.generativeai as genai

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Use local data directory if not in Docker
if os.path.exists('/app/data'):
    DB_PATH = '/app/data/planning.db'
else:
    DB_PATH = './data/planning.db'

@app.route('/')
def index():
    return send_file('index.html')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS profile
                 (id INTEGER PRIMARY KEY,
                  name TEXT,
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
                  category TEXT,
                  description TEXT,
                  priority TEXT,
                  status TEXT,
                  due_date TEXT,
                  created_at TEXT)''')

    c.execute('''CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY,
                  role TEXT,
                  content TEXT,
                  created_at TEXT)''')

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
    annual_expenses: float
    target_annual_income: float
    risk_tolerance: str
    asset_allocation: Dict[str, float]
    future_expenses: List[Dict]
    investment_types: List[Dict] = None
    accounts: List[Dict] = None

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
    
    def monte_carlo_simulation(self, years: int, simulations: int = 10000, assumptions: MarketAssumptions = None):
        """Run Monte Carlo simulation with configurable market assumptions"""
        if assumptions is None:
            assumptions = MarketAssumptions()

        # Use assumptions for stock allocation and returns
        stock_pct = assumptions.stock_allocation

        returns_mean_adj = stock_pct * assumptions.stock_return_mean + (1 - stock_pct) * assumptions.bond_return_mean
        returns_std_adj = stock_pct * assumptions.stock_return_std + (1 - stock_pct) * assumptions.bond_return_std
        
        # Total portfolio includes pension lump sum
        starting_portfolio = (self.profile.traditional_ira + 
                            self.profile.roth_ira + 
                            self.profile.liquid_assets +
                            self.profile.pension_lump_sum)
        
        # Social Security only (no pension income)
        # At FRA (age 67): $3,700 + $3,300 = $7,000/mo = $84k/year
        # Delayed to 70 (1.24x): $4,588 + $4,092 = $8,680/mo = $104k/year
        # Using delayed strategy
        annual_income = 8680 * 12
        
        annual_shortfall = self.profile.target_annual_income - annual_income
        
        success_count = 0
        ending_balances = []
        failure_years = []
        
        for sim in range(simulations):
            portfolio = starting_portfolio
            years_data = []
            
            for year in range(years):
                annual_return = np.random.normal(returns_mean_adj, returns_std_adj)

                inflation = np.random.normal(assumptions.inflation_mean, assumptions.inflation_std)
                expenses = annual_shortfall * (1 + inflation) ** year
                
                portfolio = portfolio * (1 + annual_return) - expenses
                years_data.append(portfolio)
                
                if portfolio <= 0:
                    failure_years.append(year)
                    break
            
            if portfolio > 0:
                success_count += 1
            
            ending_balances.append(max(0, portfolio))
        
        success_rate = (success_count / simulations) * 100
        
        return {
            'success_rate': success_rate,
            'median_ending_balance': np.median(ending_balances),
            'percentile_5': np.percentile(ending_balances, 5),
            'percentile_95': np.percentile(ending_balances, 95),
            'average_failure_year': np.mean(failure_years) if failure_years else None,
            'starting_portfolio': starting_portfolio,
            'annual_withdrawal_need': annual_shortfall
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
        
        current_income = 390000
        # Pension income is $120k/year (annual, not lump sum)
        pension_annual = 120000
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
        annual_expenses=data['annual_expenses'],
        target_annual_income=data['target_annual_income'],
        risk_tolerance=data.get('risk_tolerance', 'moderate'),
        asset_allocation=data.get('asset_allocation', {'stocks': 0.5, 'bonds': 0.5}),
        future_expenses=data.get('future_expenses', []),
        investment_types=data.get('investment_types', []),
        accounts=data.get('accounts', [])
    )
    
    model = RetirementModel(profile)

    years = 30
    monte_carlo = model.monte_carlo_simulation(years, assumptions=assumptions)
    ss_optimization = model.optimize_social_security(assumptions=assumptions)
    roth_conversion = model.calculate_roth_conversion_opportunity()
    wealth_transfer = model.calculate_wealth_transfer_strategy()
    
    person1_age_now = (datetime.now() - person1.birth_date).days / 365.25
    current_rmd = model.calculate_rmd(int(person1_age_now), profile.traditional_ira)
    
    return jsonify({
        'monte_carlo': monte_carlo,
        'social_security_optimization': ss_optimization[:3],
        'roth_conversion': roth_conversion,
        'wealth_transfer': wealth_transfer,
        'current_rmd': current_rmd,
        'total_net_worth': (profile.liquid_assets + profile.traditional_ira +
                           profile.roth_ira + profile.pension_lump_sum),
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

@app.route('/api/action-items', methods=['GET', 'POST', 'PUT', 'DELETE'])
def action_items():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('''INSERT INTO action_items 
                     (category, description, priority, status, due_date, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)''',
                  (data['category'], data['description'], data['priority'],
                   data.get('status', 'pending'), data.get('due_date'),
                   datetime.now().isoformat()))
        conn.commit()
        item_id = c.lastrowid
        conn.close()
        return jsonify({'id': item_id, 'status': 'success'})
    
    elif request.method == 'GET':
        c.execute('SELECT * FROM action_items ORDER BY priority, due_date')
        rows = c.fetchall()
        conn.close()
        
        items = []
        for row in rows:
            items.append({
                'id': row[0],
                'category': row[1],
                'description': row[2],
                'priority': row[3],
                'status': row[4],
                'due_date': row[5],
                'created_at': row[6]
            })
        
        return jsonify(items)
    
    elif request.method == 'PUT':
        data = request.json
        c.execute('''UPDATE action_items 
                     SET status = ? 
                     WHERE id = ?''',
                  (data['status'], data['id']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    
    elif request.method == 'DELETE':
        data = request.json
        c.execute('DELETE FROM action_items WHERE id = ?', (data['id'],))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})

@app.route('/api/generate-action-items', methods=['POST'])
def generate_action_items():
    data = request.json
    analysis = data.get('analysis', {})
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    items = []
    
    roth = analysis.get('roth_conversion', {})
    if roth.get('opportunity') == 'excellent':
        items.append({
            'category': 'Tax Planning',
            'description': f"Execute Roth conversion of ${roth.get('annual_conversion_12_bracket', 0):,.0f} in 12% bracket",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=90)).isoformat()
        })
    
    items.append({
        'category': 'Estate Planning',
        'description': 'Create Healthcare Power of Attorney and Living Will',
        'priority': 'critical',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=30)).isoformat()
    })
    
    items.append({
        'category': 'Estate Planning',
        'description': 'Create Durable Financial Power of Attorney',
        'priority': 'critical',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=30)).isoformat()
    })
    
    items.append({
        'category': 'Estate Planning',
        'description': 'Draft Revocable Living Trust and Pour-Over Will',
        'priority': 'high',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=60)).isoformat()
    })
    
    items.append({
        'category': 'Estate Planning',
        'description': 'Review and update all beneficiary designations',
        'priority': 'high',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=45)).isoformat()
    })
    
    wealth = analysis.get('wealth_transfer', {})
    if wealth.get('annual_gift_capacity', 0) > 0:
        items.append({
            'category': 'Wealth Transfer',
            'description': f"Begin annual gifts of ${wealth['annual_gift_capacity']:,.0f} to sons",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=60)).isoformat()
        })
    
    items.append({
        'category': 'Insurance',
        'description': 'Evaluate long-term care insurance options',
        'priority': 'medium',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=90)).isoformat()
    })
    
    items.append({
        'category': 'Insurance',
        'description': 'Review life insurance coverage and beneficiaries',
        'priority': 'medium',
        'status': 'pending',
        'due_date': (datetime.now() + timedelta(days=60)).isoformat()
    })
    
    monte = analysis.get('monte_carlo', {})
    if monte.get('success_rate', 100) < 85:
        items.append({
            'category': 'Retirement Planning',
            'description': f"Review spending plan - success rate is {monte['success_rate']:.0f}%, target 90%+",
            'priority': 'high',
            'status': 'pending',
            'due_date': (datetime.now() + timedelta(days=30)).isoformat()
        })
    
    items_created = 0
    for item in items:
        # Check if this action item already exists
        c.execute('''SELECT COUNT(*) FROM action_items
                     WHERE category = ? AND description = ?''',
                  (item['category'], item['description']))
        exists = c.fetchone()[0] > 0

        # Only insert if it doesn't already exist
        if not exists:
            c.execute('''INSERT INTO action_items
                         (category, description, priority, status, due_date, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)''',
                      (item['category'], item['description'], item['priority'],
                       item['status'], item['due_date'], datetime.now().isoformat()))
            items_created += 1

    conn.commit()
    conn.close()

    return jsonify({'status': 'success', 'items_created': items_created})

@app.route('/api/perform-self-assessment', methods=['POST'])
def perform_self_assessment():
    """Uses Gemini to assess the plan against available skills and generate todos"""
    data = request.json
    api_key = os.environ.get('GEMINI_API_KEY') or data.get('api_key')
    
    if not api_key:
        return jsonify({'error': 'GEMINI_API_KEY not set'}), 400

    try:
        genai.configure(api_key=api_key)
        
        # 1. Gather Context
        # A. Profile
        profile_name = data.get('profile_name', 'main')
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT data FROM profile WHERE name = ?', (profile_name,))
        row = c.fetchone()
        
        # Fallback to any profile if specific one not found
        if not row:
             c.execute('SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1')
             row = c.fetchone()

        profile_data = json.loads(row[0]) if row else {}
        
        # B. Existing Action Items
        c.execute('SELECT category, description, status FROM action_items')
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
{skills_content[:20000]}  # Truncate to avoid token limits if necessary, but skills are priority

INSTRUCTIONS:
1. Compare the Profile + Current Items against the Skills.
2. Find specific strategies mentioned in the Skills that are NOT in the Profile or Action Items.
3. Output a JSON list of new action items. format:
[
  {{
    "category": "Category Name",
    "description": "Specific action to take",
    "priority": "high|medium|low",
    "due_date_days": 30  # days from now
  }}
]
Do not output markdown formatting, just the raw JSON.
"""

        # 3. Call Gemini
        model = genai.GenerativeModel('gemini-3-flash-preview')
        response = model.generate_content(prompt)
        
        # 4. Parse and Save
        text = response.text
        # Strip markdown code blocks if present
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
                         WHERE description = ?''', (item['description'],))
            if c.fetchone()[0] == 0:
                due_date = (datetime.now() + timedelta(days=item.get('due_date_days', 30))).isoformat()
                c.execute('''INSERT INTO action_items 
                             (category, description, priority, status, due_date, created_at)
                             VALUES (?, ?, ?, ?, ?, ?)''',
                          ('AI Assessment', item['description'], item['priority'], 
                           'pending', due_date, datetime.now().isoformat()))
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

    # Get API key from environment or request
    api_key = os.environ.get('GEMINI_API_KEY') or data.get('api_key')
    if not api_key:
        return jsonify({'error': 'GEMINI_API_KEY not set. Please set it as an environment variable or pass it in the request.'}), 400

    try:
        # Configure Gemini API
        genai.configure(api_key=api_key)

        # Load conversation history from database
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT role, content FROM conversations ORDER BY id ASC')
        history_rows = c.fetchall()

        # Build financial context if requested
        system_prompt = """You are an expert financial advisor specializing in retirement planning, tax optimization, estate planning, and wealth transfer strategies.

You provide personalized, actionable advice based on the user's specific financial situation. Your guidance should be:
- Clear and easy to understand (avoid jargon unless explaining it)
- Based on current tax laws and financial planning best practices
- Focused on actionable recommendations with specific next steps
- Balanced between optimism and realistic risk assessment
- Comprehensive, considering tax, legal, and financial implications

When discussing strategies, explain both the benefits and potential drawbacks. Always remind users to consult with their own tax advisor, attorney, or financial planner before making major financial decisions."""

        financial_context = ""

        if include_context:
            # Get user profile
            profile_name = data.get('profile_name', 'main')
            c.execute('SELECT data FROM profile WHERE name = ?', (profile_name,))
            profile_row = c.fetchone()
            
            # Fallback
            if not profile_row:
                 c.execute('SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1')
                 profile_row = c.fetchone()

            if profile_row:
                profile_data = json.loads(profile_row[0])

                # Build detailed financial context
                financial_context = f"""

## USER'S FINANCIAL PROFILE

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
- Total Net Worth: ${profile_data.get('liquid_assets', 0) + profile_data.get('traditional_ira', 0) + profile_data.get('roth_ira', 0) + profile_data.get('pension_lump_sum', 0):,.2f}

### Income & Expenses
- Annual Expenses: ${profile_data.get('annual_expenses', 0):,.2f}
- Target Annual Income: ${profile_data.get('target_annual_income', 0):,.2f}
- Risk Tolerance: {profile_data.get('risk_tolerance', 'N/A')}
- Asset Allocation: Stocks {profile_data.get('asset_allocation', {}).get('stocks', 0.5)*100:.0f}%, Bonds {profile_data.get('asset_allocation', {}).get('bonds', 0.5)*100:.0f}%

### Analysis Summary (from Monte Carlo simulation and optimization models)

The system has run comprehensive analysis including:
- Monte Carlo simulation (10,000 scenarios over 30 years)
- Social Security claiming optimization (9 strategies)
- Roth conversion opportunity analysis
- Wealth transfer planning

Note: For the most current detailed analysis results, the user can run a new analysis in the Analysis tab.

### Key Planning Considerations

**Social Security Strategy**: The user can claim at ages 62, 67 (FRA), or 70. Delaying to 70 provides a 24% increase in benefits (both spouses combined: ~$8,680/month or $104,160/year).

**Roth Conversion Window**: Between retirement and age 73 (RMD age), there's opportunity to convert Traditional IRA to Roth IRA at lower tax rates.

**Tax Brackets (2024 - Married Filing Jointly)**:
- Standard Deduction: $29,200 + $3,100 (over 65) = $32,300
- 12% bracket: Up to $94,300
- 22% bracket: $94,300 to $201,050
- 24% bracket: $201,050 to $383,900

**Annual Gift Exclusion**: $18,000 per person per recipient (2024). Both spouses can each gift $18,000 to each child ($36,000 per child total).

**RMD Age**: Required Minimum Distributions begin at age 73 (SECURE Act 2.0).
"""

        full_system_prompt = system_prompt + financial_context

        # Create model - use gemini-3-flash-preview (latest model with frontier performance)
        model = genai.GenerativeModel('gemini-3-flash-preview')

        # Build conversation history for Gemini
        # Prepend system prompt as the first exchange if no history exists
        gemini_history = []

        if len(history_rows) == 0:
            # First message - add system context
            gemini_history.append({
                'role': 'user',
                'parts': [full_system_prompt + "\n\nUnderstood. I'm ready to provide financial advice."]
            })
            gemini_history.append({
                'role': 'model',
                'parts': ["I understand. I'm your financial advisor with access to your complete financial profile. I'll provide personalized retirement planning advice. How can I help you today?"]
            })

        for role, content in history_rows:
            gemini_role = 'user' if role == 'user' else 'model'
            gemini_history.append({
                'role': gemini_role,
                'parts': [content]
            })

        # Start chat with history
        chat = model.start_chat(history=gemini_history)

        # Send message with context reminder if this is continuation
        if len(history_rows) > 0:
            response = chat.send_message(user_message)
        else:
            # First real user message - remind of context
            response = chat.send_message(f"Context: {full_system_prompt}\n\nUser question: {user_message}")

        assistant_message = response.text

        # Store conversation in database
        c.execute('''INSERT INTO conversations (role, content, created_at)
                     VALUES (?, ?, ?)''',
                  ('user', user_message, datetime.now().isoformat()))
        c.execute('''INSERT INTO conversations (role, content, created_at)
                     VALUES (?, ?, ?)''',
                  ('assistant', assistant_message, datetime.now().isoformat()))

        conn.commit()
        conn.close()

        return jsonify({
            'response': assistant_message,
            'status': 'success'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/advisor/clear', methods=['POST'])
def clear_conversation():
    """Clear conversation history"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM conversations')
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/advisor/history', methods=['GET'])
def get_conversation_history():
    """Get full conversation history"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT role, content, created_at FROM conversations ORDER BY id ASC')
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

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    # Create data directory
    data_dir = os.path.dirname(DB_PATH)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    init_db()
    app.run(host='0.0.0.0', port=8080, debug=False)
