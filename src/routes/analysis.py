"""Analysis routes for running retirement simulations."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from src.models.profile import Profile
from src.services.retirement_model import (
    Person, FinancialProfile, MarketAssumptions, RetirementModel
)

analysis_bp = Blueprint('analysis', __name__, url_prefix='/api')


def transform_assets_to_investment_types(assets_data):
    """Transform frontend asset structure to investment_types format for the retirement model.

    Frontend stores assets as:
        assets.retirement_accounts: [{type: 'traditional_ira', value: X}, ...]
        assets.taxable_accounts: [{type: 'brokerage', value: X}, ...]

    Model expects investment_types as:
        [{account: 'Traditional IRA', value: X, cost_basis: X}, ...]
    """
    investment_types = []

    # Mapping from frontend type to backend account names expected by retirement_model.py
    ACCOUNT_MAPPING = {
        # Retirement accounts
        '401k': '401k',
        'roth_401k': 'Roth IRA',  # Roth 401k treated as Roth
        'traditional_ira': 'Traditional IRA',
        'roth_ira': 'Roth IRA',
        'sep_ira': 'Traditional IRA',
        'simple_ira': 'Traditional IRA',
        '403b': '403b',
        '457': '457b',
        # Taxable accounts
        'brokerage': 'Taxable Brokerage',
        'savings': 'Savings',
        'checking': 'Checking',
        'money_market': 'Savings',
        'cd': 'Savings',
        'cash': 'Checking',
    }

    # Process retirement accounts
    for asset in assets_data.get('retirement_accounts', []):
        asset_type = asset.get('type', '').lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, 'Traditional IRA')
        investment_types.append({
            'account': account_name,
            'value': asset.get('value', 0),
            'cost_basis': asset.get('cost_basis', asset.get('value', 0)),
            'name': asset.get('name', '')
        })

    # Process taxable accounts
    for asset in assets_data.get('taxable_accounts', []):
        asset_type = asset.get('type', '').lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, 'Taxable Brokerage')
        investment_types.append({
            'account': account_name,
            'value': asset.get('value', 0),
            'cost_basis': asset.get('cost_basis', asset.get('value', 0)),
            'name': asset.get('name', '')
        })

    return investment_types


class MarketProfileSchema(BaseModel):
    """Schema for market assumptions profile."""
    stock_return_mean: float
    stock_return_std: float
    bond_return_mean: float
    bond_return_std: float
    inflation_mean: float
    inflation_std: float

class AnalysisRequestSchema(BaseModel):
    """Schema for analysis request."""
    profile_name: str
    simulations: Optional[int] = 10000
    market_profile: Optional[MarketProfileSchema] = None

    @validator('simulations')
    def validate_simulations(cls, v):
        if v < 100 or v > 50000:
            raise ValueError('Simulations must be between 100 and 50,000')
        return v


@analysis_bp.route('/analysis', methods=['POST'])
@login_required
def run_analysis():
    """Run Monte Carlo analysis for a profile."""
    try:
        data = AnalysisRequestSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({'error': 'Profile data is empty'}), 400

        # Import datetime for date conversion
        from datetime import datetime

        # Extract person data
        financial_data = profile_data.get('financial', {})
        spouse_data = profile_data.get('spouse', {})
        children_data = profile_data.get('children', [])

        # Create person1 from profile birth_date and retirement_date
        birth_date_str = profile.birth_date if hasattr(profile, 'birth_date') and profile.birth_date else '1980-01-01'
        retirement_date_str = profile.retirement_date if hasattr(profile, 'retirement_date') and profile.retirement_date else '2045-01-01'

        person1 = Person(
            name=profile.name or 'Primary',
            birth_date=datetime.fromisoformat(birth_date_str) if birth_date_str else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(retirement_date_str) if retirement_date_str else datetime(2045, 1, 1),
            social_security=financial_data.get('social_security_benefit', 0)  # Already monthly
        )

        # Create person2 (spouse) if spouse data exists
        spouse_birth = spouse_data.get('birth_date') if spouse_data.get('birth_date') else '1980-01-01'
        spouse_retire = spouse_data.get('retirement_date') if spouse_data.get('retirement_date') else '2045-01-01'

        person2 = Person(
            name=spouse_data.get('name', 'Spouse'),
            birth_date=datetime.fromisoformat(spouse_birth) if spouse_birth else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(spouse_retire) if spouse_retire else datetime(2045, 1, 1),
            social_security=spouse_data.get('social_security_benefit', 0) if spouse_data.get('social_security_benefit') else 0  # Already monthly
        )

        # Get assets from profile and transform to investment_types format
        assets_data = profile_data.get('assets', {})
        investment_types = transform_assets_to_investment_types(assets_data)

        # Calculate totals from assets for display/fallback
        liquid_assets = sum(a.get('value', 0) for a in assets_data.get('taxable_accounts', []))
        traditional_ira = sum(a.get('value', 0) for a in assets_data.get('retirement_accounts', []) if 'traditional' in a.get('type', '').lower() or '401' in a.get('type', '').lower() or '403' in a.get('type', '').lower())
        roth_ira = sum(a.get('value', 0) for a in assets_data.get('retirement_accounts', []) if 'roth' in a.get('type', '').lower())

        # DEBUG: Print what we're working with
        print(f"\n=== ANALYSIS DEBUG ===")
        print(f"Profile name: {profile.name}")
        print(f"Investment types count: {len(investment_types)}")
        print(f"Total investment value: {sum(inv.get('value', 0) for inv in investment_types)}")
        print(f"Liquid assets: {liquid_assets}")
        print(f"Traditional IRA: {traditional_ira}")
        print(f"Roth IRA: {roth_ira}")
        print(f"Annual expenses from financial: {financial_data.get('annual_expenses', 0)}")
        print(f"Annual income from financial: {financial_data.get('annual_income', 0)}")
        print(f"Budget exists: {profile_data.get('budget') is not None}")
        if profile_data.get('budget'):
            print(f"Budget structure: {list(profile_data.get('budget', {}).keys())}")
        print(f"===================\n")

        # Create financial profile matching the FinancialProfile dataclass
        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=children_data,
            liquid_assets=liquid_assets or financial_data.get('liquid_assets', 0),
            traditional_ira=traditional_ira or financial_data.get('retirement_assets', 0),
            roth_ira=roth_ira,
            pension_lump_sum=0,
            pension_annual=financial_data.get('pension_benefit', 0) * 12,  # Convert monthly to annual
            annual_expenses=financial_data.get('annual_expenses', 0),
            target_annual_income=financial_data.get('annual_income', 0),
            risk_tolerance='moderate',
            asset_allocation={'stocks': 0.6, 'bonds': 0.4},
            future_expenses=[],
            investment_types=investment_types,
            accounts=[],
            income_streams=[],
            home_properties=profile_data.get('home_properties', []),
            budget=profile_data.get('budget')
        )

        # Create retirement model
        model = RetirementModel(financial_profile)

        # Calculate years for simulation
        years = max(
            model.calculate_life_expectancy_years(person1),
            model.calculate_life_expectancy_years(person2)
        )

        # Create base market assumptions from request or use defaults
        base_market_kwargs = {}
        if data.market_profile:
            base_market_kwargs = {
                'stock_return_mean': data.market_profile.stock_return_mean,
                'stock_return_std': data.market_profile.stock_return_std,
                'bond_return_mean': data.market_profile.bond_return_mean,
                'bond_return_std': data.market_profile.bond_return_std,
                'inflation_mean': data.market_profile.inflation_mean,
                'inflation_std': data.market_profile.inflation_std
            }

        # Run multiple scenarios (Conservative, Moderate, Aggressive)
        scenarios = {
            'conservative': {
                'name': 'Conservative',
                'stock_allocation': 0.30,
                'description': '30% stocks / 70% bonds - Lower risk, lower expected returns'
            },
            'moderate': {
                'name': 'Moderate',
                'stock_allocation': 0.60,
                'description': '60% stocks / 40% bonds - Balanced risk and returns'
            },
            'aggressive': {
                'name': 'Aggressive',
                'stock_allocation': 0.80,
                'description': '80% stocks / 20% bonds - Higher risk, higher expected returns'
            }
        }

        # Run simulation for each scenario
        scenario_results = {}
        for scenario_key, scenario_config in scenarios.items():
            market_assumptions = MarketAssumptions(
                stock_allocation=scenario_config['stock_allocation'],
                **base_market_kwargs
            )
            scenario_result = model.monte_carlo_simulation(
                years=years,
                simulations=data.simulations,
                assumptions=market_assumptions
            )
            scenario_result['scenario_name'] = scenario_config['name']
            scenario_result['description'] = scenario_config['description']
            scenario_result['stock_allocation'] = scenario_config['stock_allocation']
            scenario_results[scenario_key] = scenario_result

        # Prepare response with all scenarios
        response = {
            'profile_name': data.profile_name,
            'simulations': data.simulations,
            'timestamp': profile.updated_at,
            'scenarios': scenario_results,
            'total_assets': sum(inv.get('value', 0) for inv in investment_types),
            'years_projected': years
        }

        return jsonify(response), 200

    except KeyError as e:
        import traceback
        print(f"KeyError in analysis: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        import traceback
        print(f"Exception in analysis: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/analysis/social-security', methods=['POST'])
@login_required
def analyze_social_security():
    """Analyze optimal Social Security claiming age."""
    try:
        profile_name = request.json.get('profile_name')
        if not profile_name:
            return jsonify({'error': 'profile_name is required'}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({'error': 'Profile data is empty'}), 400

        # Extract data and create model
        person_data = profile_data.get('person', {})
        financial_data = profile_data.get('financial', {})
        market_data = profile_data.get('market_assumptions', {})

        person = Person(
            birth_year=person_data.get('birth_year', 1970),
            retirement_age=person_data.get('retirement_age', 65),
            life_expectancy=person_data.get('life_expectancy', 95),
            current_age=person_data.get('current_age', 40)
        )

        financial_profile = FinancialProfile(
            annual_income=financial_data.get('annual_income', 100000),
            annual_expenses=financial_data.get('annual_expenses', 70000),
            savings_rate=financial_data.get('savings_rate', 0.15),
            liquid_assets=financial_data.get('liquid_assets', 100000),
            retirement_assets=financial_data.get('retirement_assets', 500000),
            social_security_benefit=financial_data.get('social_security_benefit', 30000),
            pension=financial_data.get('pension', 0),
            other_income=financial_data.get('other_income', 0)
        )

        market_assumptions = MarketAssumptions(
            equity_return_mean=market_data.get('equity_return_mean', 0.10),
            equity_return_std=market_data.get('equity_return_std', 0.18),
            bond_return_mean=market_data.get('bond_return_mean', 0.04),
            bond_return_std=market_data.get('bond_return_std', 0.06),
            inflation_mean=market_data.get('inflation_mean', 0.03),
            inflation_std=market_data.get('inflation_std', 0.02),
            equity_allocation=market_data.get('equity_allocation', 0.70)
        )

        model = RetirementModel(person, financial_profile, market_assumptions)

        # Analyze Social Security claiming strategies
        results = model.analyze_social_security_strategies()
        results['profile_name'] = profile_name

        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/analysis/roth-conversion', methods=['POST'])
@login_required
def analyze_roth_conversion():
    """Analyze Roth conversion strategies."""
    try:
        profile_name = request.json.get('profile_name')
        conversion_amount = request.json.get('conversion_amount', 50000)

        if not profile_name:
            return jsonify({'error': 'profile_name is required'}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({'error': 'Profile data is empty'}), 400

        # Extract data and create model
        person_data = profile_data.get('person', {})
        financial_data = profile_data.get('financial', {})
        market_data = profile_data.get('market_assumptions', {})

        person = Person(
            birth_year=person_data.get('birth_year', 1970),
            retirement_age=person_data.get('retirement_age', 65),
            life_expectancy=person_data.get('life_expectancy', 95),
            current_age=person_data.get('current_age', 40)
        )

        financial_profile = FinancialProfile(
            annual_income=financial_data.get('annual_income', 100000),
            annual_expenses=financial_data.get('annual_expenses', 70000),
            savings_rate=financial_data.get('savings_rate', 0.15),
            liquid_assets=financial_data.get('liquid_assets', 100000),
            retirement_assets=financial_data.get('retirement_assets', 500000),
            social_security_benefit=financial_data.get('social_security_benefit', 30000),
            pension=financial_data.get('pension', 0),
            other_income=financial_data.get('other_income', 0)
        )

        market_assumptions = MarketAssumptions(
            equity_return_mean=market_data.get('equity_return_mean', 0.10),
            equity_return_std=market_data.get('equity_return_std', 0.18),
            bond_return_mean=market_data.get('bond_return_mean', 0.04),
            bond_return_std=market_data.get('bond_return_std', 0.06),
            inflation_mean=market_data.get('inflation_mean', 0.03),
            inflation_std=market_data.get('inflation_std', 0.02),
            equity_allocation=market_data.get('equity_allocation', 0.70)
        )

        model = RetirementModel(person, financial_profile, market_assumptions)

        # Analyze Roth conversion
        results = model.analyze_roth_conversion(conversion_amount)
        results['profile_name'] = profile_name

        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
