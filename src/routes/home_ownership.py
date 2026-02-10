"""
Home Ownership (Rent vs. Own) Scenario API routes.
"""

from flask import Blueprint, request, jsonify
from flask_login import current_user
from src.services.home_ownership_service import HomeOwnershipService
from src.models.scenario import Scenario
from src.models.profile import Profile
from src.database.audit_logger import log_read, log_create, log_update, log_delete
from src.utils.auth_utils import login_required
from src.utils.validation import validate_json_content

home_ownership_bp = Blueprint('home_ownership', __name__)

@home_ownership_bp.route('/api/home-ownership/scenario', methods=['POST'])
@login_required
def create_home_ownership_scenario():
    """
    Creates and runs a new Rent vs. Own scenario.
    Expects scenario parameters in the request body.
    """
    user_id = current_user.id
    
    # Validate request body
    data = validate_json_content(request)
    
    profile_name = data.get('profile_name')
    scenario_name = data.get('name')
    scenario_params = data.get('parameters')

    if not profile_name:
        return jsonify({"error": "Profile name is required."}), 400
    if not scenario_name:
        return jsonify({"error": "Scenario name is required."}), 400
    if not scenario_params or not isinstance(scenario_params, dict):
        return jsonify({"error": "Scenario parameters (dict) are required."}), 400

    # Retrieve profile
    profile = Profile.get_by_name(profile_name, user_id)
    if not profile:
        return jsonify({"error": "Profile not found."}), 404
    
    # Ensure profile has home_asset data if 'base_home_asset_id' is used
    if scenario_params.get("base_home_asset_id") and not profile.data_dict.get("home_asset"):
        return jsonify({"error": "Base home asset not found in profile."}), 400

    # Run the analysis
    try:
        home_service = HomeOwnershipService(profile.data_dict)
        analysis_results = home_service.analyze_scenario(scenario_params)
    except Exception as e:
        return jsonify({"error": f"Error running home ownership analysis: {str(e)}"}), 500

    # Save the scenario results
    scenario = Scenario(
        user_id=user_id,
        profile_id=profile.id,
        name=scenario_name,
        parameters=scenario_params,  # Store the input parameters
        results=analysis_results,
    )
    scenario.save()
    log_create("scenario", scenario.id, user_id, f"Created Rent vs. Own scenario: {scenario_name}")

    return jsonify({"message": "Scenario created and analyzed successfully.", "scenario": scenario.to_dict()}), 201

@home_ownership_bp.route('/api/home-ownership/scenario/<int:scenario_id>', methods=['GET'])
@login_required
def get_home_ownership_scenario(scenario_id):
    """Retrieves a specific Rent vs. Own scenario by ID."""
    user_id = current_user.id
    scenario = Scenario.get_by_id(scenario_id, user_id)

    if not scenario:
        return jsonify({"error": "Rent vs. Own Scenario not found."}), 404

    scenario_data = scenario.to_dict()
    if (scenario_data.get("parameters") or {}).get("type") != "rent_vs_own":
        return jsonify({"error": "Rent vs. Own Scenario not found."}), 404
    
    log_read("scenario", scenario_id, user_id, f"Viewed Rent vs. Own scenario: {scenario.name}")
    return jsonify({"scenario": scenario_data}), 200

@home_ownership_bp.route('/api/home-ownership/scenarios', methods=['GET'])
@login_required
def list_home_ownership_scenarios():
    """Lists all Rent vs. Own scenarios for the current user."""
    user_id = current_user.id
    
    # Filter by `parameters.type` marker since Scenario model has no dedicated type column.
    all_scenarios = Scenario.list_by_user(user_id)
    rent_vs_own_scenarios = []
    for scenario in all_scenarios:
        scenario_data = scenario.to_dict()
        if (scenario_data.get("parameters") or {}).get("type") == "rent_vs_own":
            rent_vs_own_scenarios.append(scenario_data)
    
    log_read("scenarios", None, user_id, "Listed all Rent vs. Own scenarios.")
    return jsonify({"scenarios": rent_vs_own_scenarios}), 200

# Additional endpoints for updating/deleting specific scenarios can be added here if needed.
