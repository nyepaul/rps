"""Tax optimization routes for tax planning analysis.

Authored by: pan
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, ValidationError
from typing import Optional, List
from datetime import datetime
from src.models.profile import Profile
from src.services.tax_optimization_service import TaxOptimizationService
from src.utils.error_sanitizer import sanitize_pydantic_error

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
    ladder_years: Optional[int] = 5
    ladder_growth_rate: Optional[float] = 0.05
    ladder_max_rate: Optional[float] = 0.24


class SocialSecurityRequest(BaseModel):
    """Schema for Social Security analysis request."""

    profile_name: str
    life_expectancy: Optional[int] = 90
    filing_status: Optional[str] = None  # None = use profile default
    annual_earned_income: Optional[float] = 0.0
    apply_wep: Optional[bool] = False
    apply_gpo: Optional[bool] = False
    noncovered_pension_annual: Optional[float] = 0.0


@tax_optimization_bp.route("/analyze", methods=["POST"])
@login_required
def analyze_taxes():
    """Run comprehensive tax analysis for a profile."""
    json_data = request.get_json(silent=True) or {}
    try:
        data = TaxAnalysisRequest(**json_data)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

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
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

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
            try:
                spouse_birth = datetime.fromisoformat(spouse_data["birth_date"])
                spouse_age = (datetime.now() - spouse_birth).days // 365
            except Exception:
                pass

        # Create service and run analysis
        service = TaxOptimizationService(
            filing_status=filing_status, state=state, age=age, spouse_age=spouse_age, tax_year=tax_year
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
    json_data = request.get_json(silent=True) or {}
    try:
        data = RothConversionRequest(**json_data)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

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
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
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
        service = TaxOptimizationService(filing_status=filing_status, state=state, tax_year=tax_year)

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
            ladder_years=int(data.ladder_years or 5),
            ladder_growth_rate=float(data.ladder_growth_rate or 0.05),
            ladder_max_rate=float(data.ladder_max_rate or 0.24),
        )
        result["profile_name"] = data.profile_name

        return jsonify(result), 200

    except Exception as e:
        from flask import current_app
        current_app.logger.error("Roth conversion analysis failed", exc_info=True)
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/social-security-timing", methods=["POST"])
@login_required
def analyze_social_security_timing():
    """Analyze Social Security claiming strategies."""
    json_data = request.get_json(silent=True) or {}
    try:
        data = SocialSecurityRequest(**json_data)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Get Social Security data
        person = profile_data.get("person", {})
        spouse = profile_data.get("spouse", {})
        financial = profile_data.get("financial", {})
        primary_ss = (
            financial.get("social_security_benefit")
            or person.get("social_security_benefit")
            or 0
        )  # Monthly PIA
        spouse_ss = spouse.get("social_security_benefit", 0) or 0

        # Calculate current age
        current_age = 65
        if hasattr(profile, "birth_date") and profile.birth_date:
            try:
                birth = datetime.fromisoformat(profile.birth_date)
                current_age = (datetime.now() - birth).days // 365
            except Exception:
                pass
        elif person.get("current_age") is not None:
            current_age = int(person.get("current_age"))

        spouse_age = current_age
        if spouse.get("birth_date"):
            try:
                spouse_birth = datetime.fromisoformat(spouse.get("birth_date"))
                spouse_age = (datetime.now() - spouse_birth).days // 365
            except Exception:
                spouse_age = int(spouse.get("current_age") or current_age)
        elif spouse.get("current_age") is not None:
            spouse_age = int(spouse.get("current_age"))

        tax_settings = profile_data.get("tax_settings", {})
        filing_status = data.filing_status or tax_settings.get("filing_status", "mfj")
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

        # Create service
        service = TaxOptimizationService(filing_status=filing_status, tax_year=tax_year)

        # Analyze primary and spouse strategies separately.
        wep = service.apply_wep_adjustment(
            pia_at_fra=float(primary_ss if primary_ss > 0 else 0.0),
            noncovered_pension_annual=float(data.noncovered_pension_annual or 0.0),
        )
        primary_pia = wep["pia_after_wep"] if data.apply_wep else float(primary_ss)
        gpo_offset_monthly = (
            ((data.noncovered_pension_annual or 0.0) / 12.0) * (2.0 / 3.0)
            if data.apply_gpo
            else 0.0
        )

        primary_analysis = (
            service.analyze_social_security(
                pia_at_fra=primary_pia,
                current_age=current_age,
                full_retirement_age=67,
                life_expectancy=data.life_expectancy,
            )
            if primary_pia > 0
            else None
        )
        if primary_analysis:
            primary_analysis = service.apply_earnings_test_penalty(
                primary_analysis,
                annual_earned_income=float(data.annual_earned_income or 0.0),
            )
        spouse_analysis = (
            service.analyze_social_security(
                pia_at_fra=float(spouse_ss),
                current_age=spouse_age,
                full_retirement_age=67,
                life_expectancy=data.life_expectancy,
            )
            if spouse_ss > 0
            else None
        )
        if spouse_analysis:
            spouse_analysis = service.apply_earnings_test_penalty(
                spouse_analysis,
                annual_earned_income=float(data.annual_earned_income or 0.0),
            )

        household_analysis = service.analyze_household_social_security(
            person={**person, "life_expectancy": data.life_expectancy},
            spouse={**spouse, "life_expectancy": data.life_expectancy},
            financial=financial,
            current_age=current_age,
            spouse_age=spouse_age,
            gpo_offset_monthly=gpo_offset_monthly,
        )
        tax_torpedo = service.analyze_tax_torpedo(
            non_ss_income=float((financial.get("annual_income") or 0.0) + ((financial.get("pension_benefit") or 0.0) * 12.0)),
            ss_benefit=float((primary_ss or 0.0) + (spouse_ss or 0.0)),
        )

        # Backward-compatible top-level response mirrors primary analysis if present.
        base = primary_analysis or spouse_analysis
        if base is None:
            return (
                jsonify(
                    {
                        "profile_name": data.profile_name,
                        "analyses": [],
                        "optimal": None,
                        "comparison": {},
                        "recommendation": "Add Social Security benefit estimates to compare claiming strategies.",
                        "primary_analysis": None,
                        "spouse_analysis": None,
                        "household_analysis": household_analysis.get("household"),
                        "adjustments": {
                            "wep": wep,
                            "gpo_offset_monthly": round(gpo_offset_monthly, 2),
                            "annual_earned_income": round(float(data.annual_earned_income or 0.0), 2),
                        },
                        "tax_torpedo": tax_torpedo,
                    }
                ),
                200,
            )

        result = {
            **base,
            "profile_name": data.profile_name,
            "primary_analysis": primary_analysis,
            "spouse_analysis": spouse_analysis,
            "household_analysis": household_analysis.get("household"),
            "adjustments": {
                "wep": wep,
                "gpo_offset_monthly": round(gpo_offset_monthly, 2),
                "annual_earned_income": round(float(data.annual_earned_income or 0.0), 2),
            },
            "tax_torpedo": tax_torpedo,
        }
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tax_optimization_bp.route("/snapshot", methods=["POST"])
@login_required
def get_tax_snapshot():
    """Get current tax snapshot without full analysis."""
    json_data = request.get_json(silent=True) or {}
    try:
        profile_name = json_data.get("profile_name")
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

        gross_income = (financial.get("annual_income", 0) or 0)
        pension = (financial.get("pension_benefit", 0) or 0) * 12
        ss_benefit = (financial.get("social_security_benefit", 0) or 0) * 12

        filing_status = tax_settings.get("filing_status", "mfj")
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

        # Resolve state with explicit None checks
        state = address.get("state")
        if not state:
            state = tax_settings.get("state")
        if not state:
            state = "CA"

        # Create service
        service = TaxOptimizationService(filing_status=filing_status, state=state, tax_year=tax_year)

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
    json_data = request.get_json(silent=True) or {}
    try:
        profile_name = json_data.get("profile_name")
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
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

        # Get taxable income
        financial = profile_data.get("financial", {})
        gross_income = (financial.get("annual_income", 0) or 0)
        pension = (financial.get("pension_benefit", 0) or 0) * 12
        ss_benefit = (financial.get("social_security_benefit", 0) or 0) * 12

        # Create service
        service = TaxOptimizationService(
            filing_status=filing_status, state=current_state, tax_year=tax_year
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
    json_data = request.get_json(silent=True) or {}
    try:
        profile_name = json_data.get("profile_name")
        growth_rate = json_data.get("growth_rate", 0.05)
        years = json_data.get("years", 20)
        annual_charitable_giving = json_data.get("annual_charitable_giving")

        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        tax_settings = profile_data.get("tax_settings", {})
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

        # Calculate age
        age = 65
        if hasattr(profile, "birth_date") and profile.birth_date:
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
        service = TaxOptimizationService(tax_year=tax_year)
        if annual_charitable_giving is None:
            annual_charitable_giving = service.infer_annual_charitable_giving(profile_data)
        result = service.analyze_rmd(
            age,
            traditional_balance,
            growth_rate=growth_rate,
            years=years,
            annual_charitable_giving=float(annual_charitable_giving or 0.0),
        )
        result["profile_name"] = profile_name

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
