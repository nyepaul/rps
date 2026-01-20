"""Reports routes for generating PDF reports."""
from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from src.models.profile import Profile
from src.models.action_item import ActionItem
from src.services.pdf_service_elite import (
    generate_elite_analysis_report as generate_analysis_report
)
from src.services.pdf_service import (
    generate_portfolio_report,
    generate_action_plan_report
)
from src.services.retirement_model import (
    Person, FinancialProfile, MarketAssumptions, RetirementModel
)
from src.services.enhanced_audit_logger import enhanced_audit_logger
from datetime import datetime

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')


def transform_assets_to_investment_types(assets_data):
    """Transform frontend asset structure to investment_types format."""
    investment_types = []

    ACCOUNT_MAPPING = {
        '401k': '401k',
        'roth_401k': 'Roth IRA',
        'traditional_ira': 'Traditional IRA',
        'roth_ira': 'Roth IRA',
        'sep_ira': 'Traditional IRA',
        'simple_ira': 'Traditional IRA',
        '403b': '403b',
        '457': '457b',
        'brokerage': 'Taxable Brokerage',
        'savings': 'Savings',
        'checking': 'Checking',
        'money_market': 'Savings',
        'cd': 'Savings',
        'cash': 'Checking',
    }

    for asset in assets_data.get('retirement_accounts', []):
        asset_type = asset.get('type', '').lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, 'Traditional IRA')
        investment_types.append({
            'account': account_name,
            'value': asset.get('value', 0),
            'cost_basis': asset.get('cost_basis', asset.get('value', 0)),
            'name': asset.get('name', '')
        })

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


def run_analysis_for_report(profile):
    """Run Monte Carlo analysis for PDF report generation."""
    profile_data = profile.data_dict
    if not profile_data:
        return None

    financial_data = profile_data.get('financial', {})
    spouse_data = profile_data.get('spouse', {})
    children_data = profile_data.get('children', [])

    birth_date_str = profile.birth_date if hasattr(profile, 'birth_date') and profile.birth_date else '1980-01-01'
    retirement_date_str = profile.retirement_date if hasattr(profile, 'retirement_date') and profile.retirement_date else '2045-01-01'

    person1 = Person(
        name=profile.name or 'Primary',
        birth_date=datetime.fromisoformat(birth_date_str) if birth_date_str else datetime(1980, 1, 1),
        retirement_date=datetime.fromisoformat(retirement_date_str) if retirement_date_str else datetime(2045, 1, 1),
        social_security=financial_data.get('social_security_benefit', 0)
    )

    spouse_birth = spouse_data.get('birth_date') if spouse_data.get('birth_date') else '1980-01-01'
    spouse_retire = spouse_data.get('retirement_date') if spouse_data.get('retirement_date') else '2045-01-01'

    person2 = Person(
        name=spouse_data.get('name', 'Spouse'),
        birth_date=datetime.fromisoformat(spouse_birth) if spouse_birth else datetime(1980, 1, 1),
        retirement_date=datetime.fromisoformat(spouse_retire) if spouse_retire else datetime(2045, 1, 1),
        social_security=spouse_data.get('social_security_benefit', 0) if spouse_data.get('social_security_benefit') else 0
    )

    assets_data = profile_data.get('assets', {})
    investment_types = transform_assets_to_investment_types(assets_data)

    liquid_assets = sum(a.get('value', 0) for a in assets_data.get('taxable_accounts', []))
    traditional_ira = sum(a.get('value', 0) for a in assets_data.get('retirement_accounts', [])
                         if 'traditional' in a.get('type', '').lower() or '401' in a.get('type', '').lower())
    roth_ira = sum(a.get('value', 0) for a in assets_data.get('retirement_accounts', [])
                   if 'roth' in a.get('type', '').lower())

    financial_profile = FinancialProfile(
        person1=person1,
        person2=person2,
        children=children_data,
        liquid_assets=liquid_assets or financial_data.get('liquid_assets', 0),
        traditional_ira=traditional_ira or financial_data.get('retirement_assets', 0),
        roth_ira=roth_ira,
        pension_lump_sum=0,
        pension_annual=financial_data.get('pension_benefit', 0) * 12,
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

    model = RetirementModel(financial_profile)

    years = max(
        model.calculate_life_expectancy_years(person1),
        model.calculate_life_expectancy_years(person2)
    )

    scenarios = {
        'conservative': {'name': 'Conservative', 'stock_allocation': 0.30},
        'moderate': {'name': 'Moderate', 'stock_allocation': 0.60},
        'aggressive': {'name': 'Aggressive', 'stock_allocation': 0.80}
    }

    scenario_results = {}
    for scenario_key, scenario_config in scenarios.items():
        market_assumptions = MarketAssumptions(stock_allocation=scenario_config['stock_allocation'])
        scenario_result = model.monte_carlo_simulation(
            years=years,
            simulations=1000,  # Reduced for faster PDF generation
            assumptions=market_assumptions
        )
        scenario_result['scenario_name'] = scenario_config['name']
        scenario_results[scenario_key] = scenario_result

    return {
        'simulations': 1000,
        'scenarios': scenario_results,
        'total_assets': sum(inv.get('value', 0) for inv in investment_types),
        'years_projected': years
    }


@reports_bp.route('/analysis', methods=['POST'])
@login_required
def generate_analysis():
    """Generate analysis PDF report."""
    try:
        profile_name = request.json.get('profile_name')
        if not profile_name:
            enhanced_audit_logger.log(
                action='GENERATE_ANALYSIS_REPORT_VALIDATION_ERROR',
                details={'error': 'profile_name is required'},
                status_code=400
            )
            return jsonify({'error': 'profile_name is required'}), 400

        # Check if view mode is requested
        view_mode = request.args.get('view', 'false').lower() == 'true'

        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='GENERATE_ANALYSIS_REPORT_PROFILE_NOT_FOUND',
                details={'profile_name': profile_name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Run analysis
        analysis_results = run_analysis_for_report(profile)
        if not analysis_results:
            enhanced_audit_logger.log(
                action='GENERATE_ANALYSIS_REPORT_FAILED',
                details={'profile_name': profile_name},
                status_code=500
            )
            return jsonify({'error': 'Unable to generate analysis'}), 500

        # Build profile data for PDF
        profile_data = profile.data_dict or {}
        profile_data['name'] = profile.name

        # Generate PDF
        pdf_buffer = generate_analysis_report(profile_data, analysis_results)

        enhanced_audit_logger.log(
            action='GENERATE_ANALYSIS_REPORT_PDF',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': profile_name,
                'view_mode': view_mode,
                'total_assets': analysis_results.get('total_assets'),
                'years_projected': analysis_results.get('years_projected')
            },
            status_code=200
        )
        # Return PDF for viewing or downloading
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=not view_mode,
            download_name=f'{profile_name}_analysis_report.pdf'
        )

    except Exception as e:
        import traceback
        print(f"Error generating analysis report: {str(e)}")
        print(traceback.format_exc())
        enhanced_audit_logger.log(
            action='GENERATE_ANALYSIS_REPORT_ERROR',
            details={'profile_name': profile_name if 'profile_name' in dir() else None, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/portfolio', methods=['POST'])
@login_required
def generate_portfolio():
    """Generate portfolio summary PDF report."""
    try:
        profile_name = request.json.get('profile_name')
        if not profile_name:
            enhanced_audit_logger.log(
                action='GENERATE_PORTFOLIO_REPORT_VALIDATION_ERROR',
                details={'error': 'profile_name is required'},
                status_code=400
            )
            return jsonify({'error': 'profile_name is required'}), 400

        # Check if view mode is requested
        view_mode = request.args.get('view', 'false').lower() == 'true'

        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='GENERATE_PORTFOLIO_REPORT_PROFILE_NOT_FOUND',
                details={'profile_name': profile_name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Build profile data for PDF
        profile_data = profile.data_dict or {}
        profile_data['name'] = profile.name

        # Generate PDF
        pdf_buffer = generate_portfolio_report(profile_data)

        enhanced_audit_logger.log(
            action='GENERATE_PORTFOLIO_REPORT_PDF',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': profile_name,
                'view_mode': view_mode
            },
            status_code=200
        )
        # Return PDF for viewing or downloading
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=not view_mode,
            download_name=f'{profile_name}_portfolio_summary.pdf'
        )

    except Exception as e:
        import traceback
        print(f"Error generating portfolio report: {str(e)}")
        print(traceback.format_exc())
        enhanced_audit_logger.log(
            action='GENERATE_PORTFOLIO_REPORT_ERROR',
            details={'profile_name': profile_name if 'profile_name' in dir() else None, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/action-plan', methods=['POST'])
@login_required
def generate_action_plan():
    """Generate action plan PDF report."""
    try:
        profile_name = request.json.get('profile_name')
        if not profile_name:
            enhanced_audit_logger.log(
                action='GENERATE_ACTION_PLAN_REPORT_VALIDATION_ERROR',
                details={'error': 'profile_name is required'},
                status_code=400
            )
            return jsonify({'error': 'profile_name is required'}), 400

        # Check if view mode is requested
        view_mode = request.args.get('view', 'false').lower() == 'true'

        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action='GENERATE_ACTION_PLAN_REPORT_PROFILE_NOT_FOUND',
                details={'profile_name': profile_name},
                status_code=404
            )
            return jsonify({'error': 'Profile not found'}), 404

        # Get action items for this profile
        action_items = ActionItem.list_by_user(current_user.id, profile.id)
        action_items_list = [
            {
                'title': item.description or 'Untitled Action',
                'description': item.description or '',
                'status': item.status,
                'priority': item.priority,
                'due_date': item.due_date,
                'updated_at': item.updated_at
            }
            for item in action_items
        ]

        # Build profile data for PDF
        profile_data = profile.data_dict or {}
        profile_data['name'] = profile.name

        # Generate PDF
        pdf_buffer = generate_action_plan_report(profile_data, action_items_list)

        enhanced_audit_logger.log(
            action='GENERATE_ACTION_PLAN_REPORT_PDF',
            table_name='profile',
            record_id=profile.id,
            details={
                'profile_name': profile_name,
                'view_mode': view_mode,
                'action_items_count': len(action_items_list)
            },
            status_code=200
        )
        # Return PDF for viewing or downloading
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=not view_mode,
            download_name=f'{profile_name}_action_plan.pdf'
        )

    except Exception as e:
        import traceback
        print(f"Error generating action plan report: {str(e)}")
        print(traceback.format_exc())
        enhanced_audit_logger.log(
            action='GENERATE_ACTION_PLAN_REPORT_ERROR',
            details={'profile_name': profile_name if 'profile_name' in dir() else None, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': str(e)}), 500
