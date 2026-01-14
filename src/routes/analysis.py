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


class AnalysisRequestSchema(BaseModel):
    """Schema for analysis request."""
    profile_name: str
    simulations: Optional[int] = 10000

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

        # Extract person data
        person_data = profile_data.get('person', {})
        person = Person(
            birth_year=person_data.get('birth_year', 1970),
            retirement_age=person_data.get('retirement_age', 65),
            life_expectancy=person_data.get('life_expectancy', 95),
            current_age=person_data.get('current_age', 40)
        )

        # Extract financial profile
        financial_data = profile_data.get('financial', {})
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

        # Extract market assumptions
        market_data = profile_data.get('market_assumptions', {})
        market_assumptions = MarketAssumptions(
            equity_return_mean=market_data.get('equity_return_mean', 0.10),
            equity_return_std=market_data.get('equity_return_std', 0.18),
            bond_return_mean=market_data.get('bond_return_mean', 0.04),
            bond_return_std=market_data.get('bond_return_std', 0.06),
            inflation_mean=market_data.get('inflation_mean', 0.03),
            inflation_std=market_data.get('inflation_std', 0.02),
            equity_allocation=market_data.get('equity_allocation', 0.70)
        )

        # Create retirement model
        model = RetirementModel(person, financial_profile, market_assumptions)

        # Run Monte Carlo simulation
        results = model.run_monte_carlo(data.simulations)

        # Add metadata
        results['profile_name'] = data.profile_name
        results['simulations'] = data.simulations
        results['timestamp'] = profile.updated_at

        return jsonify(results), 200

    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
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
