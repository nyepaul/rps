"""Tax optimization routes for tax planning analysis.

Authored by: pan
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional, List
from src.models.profile import Profile
from src.services.tax_optimization_service import TaxOptimizationService

tax_optimization_bp = Blueprint(
    "tax_optimization", __name__, url_prefix="/api/tax-optimization"
)


class TaxAnalysisRequest(BaseModel):
    """Schema for tax analysis request."""

    profile_name: str
    filing_status: Optional[str] = None  # None = use profile default
    state: Optional[str] = None  # None = use profile's address/tax_settings


class RothConversionRequest(BaseModel):
    """Schema for Roth conversion analysis request."""

    profile_name: str
    conversion_amounts: Optional[List[float]] = None
    filing_status: Optional[str] = None  # None = use profile default
    state: Optional[str] = None  # None = use profile's address/tax_settings


class SocialSecurityRequest(BaseModel):
    """Schema for Social Security analysis request."""

    profile_name: str
    life_expectancy: Optional[int] = 90
    filing_status: Optional[str] = None  # None = use profile default


@tax_optimization_bp.route("/analyze", methods=["POST"])
@login_required
def analyze_taxes():
    """Run comprehensive tax analysis for a profile."""
    try:
        data = TaxAnalysisRequest(**request.json)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get tax settings from profile or request
        # Priority: request param -> profile address -> tax_settings -> default
        tax_settings = profile_data.get("tax_settings", {})
        address = profile_data.get("address", {})
        filing_status = data.filing_status or tax_settings.get("filing_status", "mfj")

        # Resolve state with explicit None checks (empty string is valid and should not fallback)
        state = data.state
        if state is None:
            state = address.get("state")
        if not state:  # None or empty string
            state = tax_settings.get("state")
        if not state:  # Still None or empty
            state = "CA"  # Final fallback

        # Calculate age from birth date
        age = 65
        spouse_age = 65
        if hasattr(profile, "birth_date") and profile.birth_date:
            from datetime import datetime

            try:
                birth = datetime.fromisoformat(profile.birth_date)
                age = (datetime.now() - birth).days // 365
            except Exception:
                pass

        # Get spouse age if available
        spouse_data = (
            profile_data.get("spouse") or {}
        )  # Handle None spouse for single profiles
        if spouse_data.get("birth_date"):
            from datetime import datetime

            try:
                spouse_birth = datetime.fromisoformat(spouse_data["birth_date"])
                spouse_age = (datetime.now() - spouse_birth).days // 365
            except Exception:
                pass

        # Create service and run analysis
        service = TaxOptimizationService(
            filing_status=filing_status, state=state, age=age, spouse_age=spouse_age
        )

        result = service.get_comprehensive_analysis(profile_data)
        result["profile_name"] = data.profile_name

        return jsonify(result), 200

    except Exception as e:
        import traceback

        # Log error for debugging but don't expose details to client
        import logging

        logging.error(f"Tax analysis failed: {str(e)}", exc_info=True)
        return (
            jsonify(
                {
                    "error": "Tax analysis failed. Please check your inputs and try again."
                }
            ),
            500,
        )


@tax_optimization_bp.route("/roth-conversion", methods=["POST"])
@login_required
def analyze_roth_conversion():
    """Analyze Roth conversion opportunities."""
    try:
        data = RothConversionRequest(**request.json)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get financial data
        financial = profile_data.get("financial", {})
        assets = profile_data.get("assets", {})
        tax_settings = profile_data.get("tax_settings", {})
        address = profile_data.get("address", {})

        # Calculate current taxable income
        gross_income = financial.get("annual_income", 0) or 0
        pension = (financial.get("pension_benefit", 0) or 0) * 12
        ss_benefit = (financial.get("social_security_benefit", 0) or 0) * 12

        filing_status = data.filing_status or tax_settings.get("filing_status", "mfj")

        # Resolve state with explicit None checks
        state = data.state
        if state is None:
            state = address.get("state")
        if not state:
            state = tax_settings.get("state")
        if not state:
            state = "CA"

        # Create service
        service = TaxOptimizationService(filing_status=filing_status, state=state)

        # Get tax snapshot to find taxable income
        snapshot = service.calculate_tax_snapshot(
            gross_income=gross_income + pension, social_security=ss_benefit
        )
        current_taxable = snapshot["summary"]["taxable_income"]

        # Calculate traditional IRA balance
        traditional_balance = sum(
            a.get("value", 0)
            for a in assets.get("retirement_accounts", [])
            if "traditional" in a.get("type", "").lower()
            or "401k" in a.get("type", "").lower()
        )

        # Run Roth conversion analysis
        result = service.analyze_roth_conversion(
            current_taxable_income=current_taxable,
            traditional_balance=traditional_balance,
            conversion_amounts=data.conversion_amounts,
        )
        result["profile_name"] = data.profile_name

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/social-security-timing", methods=["POST"])
@login_required
def analyze_social_security_timing():
    """Analyze Social Security claiming strategies."""
    try:
        data = SocialSecurityRequest(**request.json)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get Social Security data
        financial = profile_data.get("financial", {})
        ss_benefit = financial.get("social_security_benefit", 0) or 0  # Monthly PIA

        # Calculate current age
        current_age = 65
        if hasattr(profile, "birth_date") and profile.birth_date:
            from datetime import datetime

            try:
                birth = datetime.fromisoformat(profile.birth_date)
                current_age = (datetime.now() - birth).days // 365
            except Exception:
                pass

        filing_status = data.filing_status or "mfj"

        # Create service
        service = TaxOptimizationService(filing_status=filing_status)

        # Analyze Social Security claiming strategies
        result = service.analyze_social_security(
            pia_at_fra=ss_benefit,  # Assuming this is PIA at FRA
            current_age=current_age,
            full_retirement_age=67,  # Default for those born 1960+
            life_expectancy=data.life_expectancy,
        )
        result["profile_name"] = data.profile_name

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/snapshot", methods=["POST"])
@login_required
def get_tax_snapshot():
    """Get current tax snapshot without full analysis."""
    try:
        profile_name = request.json.get("profile_name")
        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get financial data
        financial = profile_data.get("financial", {})
        tax_settings = profile_data.get("tax_settings", {})
        address = profile_data.get("address", {})

        gross_income = financial.get("annual_income", 0) or 0
        pension = (financial.get("pension_benefit", 0) or 0) * 12
        ss_benefit = (financial.get("social_security_benefit", 0) or 0) * 12

        filing_status = tax_settings.get("filing_status", "mfj")

        # Resolve state with explicit None checks
        state = address.get("state")
        if not state:
            state = tax_settings.get("state")
        if not state:
            state = "CA"

        # Create service
        service = TaxOptimizationService(filing_status=filing_status, state=state)

        # Get snapshot
        result = service.calculate_tax_snapshot(
            gross_income=gross_income + pension, social_security=ss_benefit
        )
        result["profile_name"] = profile_name

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/state-comparison", methods=["POST"])
@login_required
def compare_states():
    """Compare tax burden across states."""
    try:
        profile_name = request.json.get("profile_name")
        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get tax settings
        tax_settings = profile_data.get("tax_settings", {})
        address = profile_data.get("address", {})
        filing_status = tax_settings.get("filing_status", "mfj")

        # Resolve state with explicit None checks
        current_state = address.get("state")
        if not current_state:
            current_state = tax_settings.get("state")
        if not current_state:
            current_state = "CA"

        # Get taxable income
        financial = profile_data.get("financial", {})
        gross_income = financial.get("annual_income", 0) or 0
        pension = (financial.get("pension_benefit", 0) or 0) * 12
        ss_benefit = (financial.get("social_security_benefit", 0) or 0) * 12

        # Create service
        service = TaxOptimizationService(
            filing_status=filing_status, state=current_state
        )

        # Get snapshot to calculate taxable income
        snapshot = service.calculate_tax_snapshot(
            gross_income=gross_income + pension, social_security=ss_benefit
        )
        taxable_income = snapshot["summary"]["taxable_income"]

        # Compare states
        comparison = service.compare_states(taxable_income)

        return (
            jsonify(
                {
                    "profile_name": profile_name,
                    "current_state": current_state,
                    "taxable_income": taxable_income,
                    "comparison": comparison,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/rmd-projection", methods=["POST"])
@login_required
def project_rmds():
    """Project Required Minimum Distributions."""
    try:
        profile_name = request.json.get("profile_name")
        growth_rate = request.json.get("growth_rate", 0.05)
        years = request.json.get("years", 20)

        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Calculate age
        age = 65
        if hasattr(profile, "birth_date") and profile.birth_date:
            from datetime import datetime

            try:
                birth = datetime.fromisoformat(profile.birth_date)
                age = (datetime.now() - birth).days // 365
            except Exception:
                pass

        # Get traditional balance
        assets = profile_data.get("assets", {})
        traditional_balance = sum(
            a.get("value", 0)
            for a in assets.get("retirement_accounts", [])
            if "traditional" in a.get("type", "").lower()
            or "401k" in a.get("type", "").lower()
        )

        # Create service and run analysis
        service = TaxOptimizationService()
        result = service.analyze_rmd(age, traditional_balance, growth_rate)
        result["profile_name"] = profile_name

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
