"""Scenario routes for what-if analyses."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from src.models.scenario import Scenario
from src.models.profile import Profile
from src.services.enhanced_audit_logger import enhanced_audit_logger

scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/api")


class ScenarioCreateSchema(BaseModel):
    """Schema for creating a scenario."""

    name: str
    profile_name: Optional[str] = None
    parameters: Optional[dict] = None
    results: Optional[dict] = None

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Scenario name is required")
        if len(v) > 200:
            raise ValueError("Scenario name must be less than 200 characters")
        return v.strip()


class ScenarioUpdateSchema(BaseModel):
    """Schema for updating a scenario."""

    name: Optional[str] = None
    parameters: Optional[dict] = None
    results: Optional[dict] = None

    @validator("name")
    def validate_name(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError("Scenario name cannot be empty")
            if len(v) > 200:
                raise ValueError("Scenario name must be less than 200 characters")
            return v.strip()
        return v


@scenarios_bp.route("/scenarios", methods=["GET"])
@login_required
def list_scenarios():
    """List all scenarios for the current user."""
    from flask import current_app

    try:
        scenarios = Scenario.list_by_user(current_user.id)
        current_app.logger.info(
            f"Listed {len(scenarios)} scenarios for user {current_user.id} ({current_user.username})"
        )
        enhanced_audit_logger.log(
            action="LIST_SCENARIOS",
            details={"scenario_count": len(scenarios)},
            status_code=200,
        )
        return jsonify({"scenarios": [s.to_dict() for s in scenarios]}), 200
    except Exception as e:
        current_app.logger.error(
            f"Error listing scenarios for user {current_user.id}: {e}"
        )
        enhanced_audit_logger.log(
            action="LIST_SCENARIOS_ERROR", details={"error": str(e)}, status_code=500
        )
        return jsonify({"error": str(e)}), 500


@scenarios_bp.route("/scenario/<int:scenario_id>", methods=["GET"])
@login_required
def get_scenario(scenario_id: int):
    """Get a specific scenario by ID (with ownership check)."""
    try:
        scenario = Scenario.get_by_id(scenario_id, current_user.id)
        if not scenario:
            enhanced_audit_logger.log(
                action="VIEW_SCENARIO_NOT_FOUND",
                details={"scenario_id": scenario_id},
                status_code=404,
            )
            return jsonify({"error": "Scenario not found"}), 404

        enhanced_audit_logger.log(
            action="VIEW_SCENARIO",
            table_name="scenario",
            record_id=scenario_id,
            details={"scenario_name": scenario.name},
            status_code=200,
        )
        return jsonify({"scenario": scenario.to_dict()}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action="VIEW_SCENARIO_ERROR",
            details={"scenario_id": scenario_id, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@scenarios_bp.route("/scenarios", methods=["POST"])
@login_required
def create_scenario():
    """Create a new scenario for the current user."""
    try:
        data = ScenarioCreateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action="CREATE_SCENARIO_VALIDATION_ERROR",
            details={"error": str(e)},
            status_code=400,
        )
        return jsonify({"error": str(e)}), 400

    try:
        # Resolve profile_id if profile_name provided
        profile_id = None
        if data.profile_name:
            profile = Profile.get_by_name(data.profile_name, current_user.id)
            if not profile:
                enhanced_audit_logger.log(
                    action="CREATE_SCENARIO_PROFILE_NOT_FOUND",
                    details={
                        "profile_name": data.profile_name,
                        "scenario_name": data.name,
                    },
                    status_code=404,
                )
                return jsonify({"error": "Profile not found"}), 404
            profile_id = profile.id

        # Create new scenario
        scenario = Scenario(
            user_id=current_user.id,
            profile_id=profile_id,
            name=data.name,
            parameters=data.parameters,
            results=data.results,
        )
        scenario.save()

        enhanced_audit_logger.log(
            action="CREATE_SCENARIO",
            table_name="scenario",
            record_id=scenario.id,
            details={
                "scenario_name": data.name,
                "profile_name": data.profile_name,
                "profile_id": profile_id,
            },
            status_code=201,
        )
        return (
            jsonify(
                {
                    "message": "Scenario created successfully",
                    "scenario": scenario.to_dict(),
                }
            ),
            201,
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="CREATE_SCENARIO_ERROR",
            details={"scenario_name": data.name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@scenarios_bp.route("/scenario/<int:scenario_id>", methods=["PUT"])
@login_required
def update_scenario(scenario_id: int):
    """Update a scenario (with ownership check)."""
    try:
        data = ScenarioUpdateSchema(**request.json)
    except Exception as e:
        enhanced_audit_logger.log(
            action="UPDATE_SCENARIO_VALIDATION_ERROR",
            details={"scenario_id": scenario_id, "error": str(e)},
            status_code=400,
        )
        return jsonify({"error": str(e)}), 400

    try:
        # Get scenario with ownership check
        scenario = Scenario.get_by_id(scenario_id, current_user.id)
        if not scenario:
            enhanced_audit_logger.log(
                action="UPDATE_SCENARIO_NOT_FOUND",
                details={"scenario_id": scenario_id},
                status_code=404,
            )
            return jsonify({"error": "Scenario not found"}), 404

        # Track what fields are being updated
        updated_fields = []

        if data.name is not None:
            updated_fields.append("name")
            scenario.name = data.name

        if data.parameters is not None:
            updated_fields.append("parameters")
            scenario.parameters = data.parameters

        if data.results is not None:
            updated_fields.append("results")
            scenario.results = data.results

        scenario.save()

        enhanced_audit_logger.log(
            action="UPDATE_SCENARIO",
            table_name="scenario",
            record_id=scenario_id,
            details={"scenario_name": scenario.name, "updated_fields": updated_fields},
            status_code=200,
        )
        return (
            jsonify(
                {
                    "message": "Scenario updated successfully",
                    "scenario": scenario.to_dict(),
                }
            ),
            200,
        )
    except Exception as e:
        enhanced_audit_logger.log(
            action="UPDATE_SCENARIO_ERROR",
            details={"scenario_id": scenario_id, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


@scenarios_bp.route("/scenario/<int:scenario_id>", methods=["DELETE"])
@login_required
def delete_scenario(scenario_id: int):
    """Delete a scenario (with ownership check)."""
    try:
        # Get scenario with ownership check
        scenario = Scenario.get_by_id(scenario_id, current_user.id)
        if not scenario:
            enhanced_audit_logger.log(
                action="DELETE_SCENARIO_NOT_FOUND",
                details={"scenario_id": scenario_id},
                status_code=404,
            )
            return jsonify({"error": "Scenario not found"}), 404

        scenario_name = scenario.name
        scenario.delete()

        enhanced_audit_logger.log(
            action="DELETE_SCENARIO",
            table_name="scenario",
            record_id=scenario_id,
            details={"scenario_name": scenario_name},
            status_code=200,
        )
        return jsonify({"message": "Scenario deleted successfully"}), 200
    except Exception as e:
        enhanced_audit_logger.log(
            action="DELETE_SCENARIO_ERROR",
            details={"scenario_id": scenario_id, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500
