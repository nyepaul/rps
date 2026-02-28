"""Analysis routes for running retirement simulations."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, field_validator, ValidationError
from typing import Optional, List
from datetime import datetime, date
import math
from src.models.profile import Profile
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)
from src.services.tax_engine_refactor import TaxEngine
from src.services.tax_policy import get_tax_policy, CURRENT_TAX_YEAR
from src.services.rebalancing_service import RebalancingService
from src.services.healthcare_planning_service import HealthcarePlanningService
from src.services.phase1_planning_service import (
    build_debt_payoff_strategy,
    estimate_life_insurance_needs,
    generate_sequence_offsets,
    summarize_sequence_impact,
)
from src.services.phase2_planning_service import (
    build_advanced_scenario_analysis,
    build_advanced_investment_factor_analysis,
    build_annuity_comparison_tool,
    build_529_college_savings_plan,
    build_business_owner_retirement_planning,
    build_cashflow_budget_enhancements,
    build_disability_income_protection,
    build_document_vault_beneficiary_tracking,
    build_dynamic_withdrawal_strategies,
    build_estate_tax_gifting_strategy,
    build_family_legacy_gifting_goals,
    build_investment_fee_impact_analyzer,
    build_life_event_scenario_modeling,
    build_long_term_care_analysis,
    build_longevity_care_path_modeling,
    build_household_collaboration_workflow,
    build_plan_health_monitoring_drift_alerts,
    build_pre65_healthcare_bridge_planner,
    build_part_time_retirement_model,
    build_pension_lump_sum_analysis,
    build_retirement_paycheck_builder,
    build_real_estate_enhancements,
    build_retirement_lifestyle_planning,
    build_risk_analysis_dashboard,
    build_social_security_statement_reconciliation,
    build_secure_act_beneficiary_ira,
    build_tax_law_update_engine,
    build_guaranteed_income_floor_optimizer,
    build_data_aggregation_reconciliation_hub,
    build_charitable_strategy_optimizer,
)
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.utils.error_sanitizer import sanitize_pydantic_error
from src.__version__ import __version__

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api")


EMPLOYMENT_STREAM_TYPES = {"salary", "hourly", "wages", "bonus"}
EMPLOYMENT_STREAM_SOURCES = {"employment"}


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
        "401k": "401k",
        "roth_401k": "Roth IRA",  # Roth 401k treated as Roth
        "traditional_ira": "Traditional IRA",
        "roth_ira": "Roth IRA",
        "sep_ira": "Traditional IRA",
        "simple_ira": "Traditional IRA",
        "403b": "403b",
        "457": "457b",
        # Taxable accounts
        "brokerage": "Taxable Brokerage",
        "savings": "Savings",
        "checking": "Checking",
        "money_market": "Savings",
        "cd": "Savings",
        "cash": "Checking",
    }

    # Process retirement accounts
    for asset in assets_data.get("retirement_accounts", []):
        asset_type = asset.get("type", "").lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, "Traditional IRA")
        investment_types.append(
            {
                "account": account_name,
                "value": asset.get("value", 0),
                "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
                "name": asset.get("name", ""),
                "management_fee_rate": asset.get("management_fee_rate", 0),
            }
        )

    # Process taxable accounts
    for asset in assets_data.get("taxable_accounts", []):
        asset_type = asset.get("type", "").lower()
        account_name = ACCOUNT_MAPPING.get(asset_type, "Taxable Brokerage")
        investment_types.append(
            {
                "account": account_name,
                "value": asset.get("value", 0),
                "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
                "name": asset.get("name", ""),
                "management_fee_rate": asset.get("management_fee_rate", 0),
            }
        )

    # Process other assets (HSA, Crypto, etc.)
    for asset in assets_data.get("other_assets", []):
        asset_type = asset.get("type", "").lower()
        # Map HSA to Roth (tax-free out), others to Taxable/Traditional
        if asset_type == "hsa":
            account_name = "Roth IRA"
        elif asset_type in ["cryptocurrency", "collectible", "business_interest"]:
            account_name = "Taxable Brokerage"
        else:
            account_name = "Taxable Brokerage"

        investment_types.append(
            {
                "account": account_name,
                "value": asset.get("value", 0),
                "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
                "name": asset.get("name", ""),
                "management_fee_rate": asset.get("management_fee_rate", 0),
            }
        )

    return investment_types


def compute_management_fee_drag(investment_types):
    """Compute portfolio-weighted advisory fee drag (decimal, e.g. 0.01 for 1%).

    The form stores management_fee_rate as a percent (e.g. 1.0 for 1%).
    This converts to decimal and weights by account value.
    """
    total_value = sum(inv.get("value", 0) for inv in investment_types)
    if total_value <= 0:
        return 0.0
    weighted_fee = sum(
        inv.get("value", 0) * (inv.get("management_fee_rate", 0) / 100.0)
        for inv in investment_types
    )
    return weighted_fee / total_value


def _annualize_stream_amount(stream):
    """Convert a stream amount to annual dollars using its frequency."""
    amount = float(stream.get("amount", 0) or 0)
    frequency = (stream.get("frequency") or "monthly").lower()
    if frequency == "monthly":
        return amount * 12
    if frequency == "weekly":
        return amount * 52
    if frequency == "biweekly":
        return amount * 26
    if frequency == "quarterly":
        return amount * 4
    if frequency == "annual":
        return amount
    # Keep legacy behavior for unknown frequencies.
    return amount * 12


def _is_employment_stream(stream):
    return (
        stream.get("type") in EMPLOYMENT_STREAM_TYPES
        or stream.get("source") in EMPLOYMENT_STREAM_SOURCES
    )


def _prepare_budget_and_income_streams(profile_data, spouse_data):
    """Normalize budget/income inputs so employment income is counted exactly once."""
    raw_budget = profile_data.get("budget", {})
    budget_data = raw_budget.copy() if isinstance(raw_budget, dict) else {}
    raw_streams = profile_data.get("income_streams", [])
    mc_income_streams = raw_streams[:] if isinstance(raw_streams, list) else []

    if not budget_data:
        return budget_data, mc_income_streams

    def _stream_employment_totals(streams):
        primary_salary = 0.0
        spouse_salary = 0.0
        spouse_first = (
            (spouse_data.get("name") or "").lower().split()[0]
            if spouse_data.get("name")
            else ""
        )
        for stream in streams:
            if not _is_employment_stream(stream):
                continue
            annual_amount = _annualize_stream_amount(stream)
            stream_name = (stream.get("name") or "").lower()
            is_spouse = stream.get("owner") == "spouse" or (
                spouse_first and spouse_first in stream_name
            )
            if is_spouse:
                spouse_salary += annual_amount
            else:
                primary_salary += annual_amount
        return primary_salary, spouse_salary

    def _budget_employment_total(budget_income):
        emp = (budget_income or {}).get("current", {}).get("employment", {}) or {}
        return float(emp.get("primary_person", 0) or 0) + float(emp.get("spouse", 0) or 0)

    stream_primary, stream_spouse = _stream_employment_totals(mc_income_streams)

    # If the budget has no income section, synthesize one from employment streams.
    if not budget_data.get("income"):
        primary_salary = 0
        spouse_salary = 0
        primary_salary = stream_primary
        spouse_salary = stream_spouse

        budget_data["income"] = {
            "current": {
                "employment": {
                    "primary_person": primary_salary,
                    "spouse": spouse_salary,
                }
            },
            "future": {},
        }
    else:
        # If a budget income section exists but doesn't include employment dollars, we can
        # safely synthesize employment from streams to avoid silently dropping income.
        # This occurs when users fill "budget" but only model income via income_streams.
        if _budget_employment_total(budget_data.get("income")) <= 0 and (stream_primary + stream_spouse) > 0:
            budget_data.setdefault("income", {})
            budget_data["income"].setdefault("current", {})
            budget_data["income"]["current"].setdefault("employment", {})
            budget_data["income"]["current"]["employment"].setdefault("primary_person", 0)
            budget_data["income"]["current"]["employment"].setdefault("spouse", 0)

            budget_data["income"]["current"]["employment"]["primary_person"] = float(stream_primary)
            budget_data["income"]["current"]["employment"]["spouse"] = float(stream_spouse)

    # If budget income is present (native or synthesized), strip employment streams
    # so employment does not flow through both pathways.
    if budget_data.get("income"):
        mc_income_streams = [
            s for s in mc_income_streams if not _is_employment_stream(s)
        ]

    return budget_data, mc_income_streams


class MarketProfileSchema(BaseModel):
    """Schema for market assumptions profile."""

    # Allocations
    stock_allocation: Optional[float] = 0.5
    bond_allocation: Optional[float] = 0.4
    cash_allocation: Optional[float] = 0.1
    reit_allocation: Optional[float] = 0.0
    gold_allocation: Optional[float] = 0.0
    crypto_allocation: Optional[float] = 0.0

    # Returns
    stock_return_mean: Optional[float] = 0.10
    stock_return_std: Optional[float] = 0.18
    bond_return_mean: Optional[float] = 0.04
    bond_return_std: Optional[float] = 0.06
    cash_return_mean: Optional[float] = 0.015
    cash_return_std: Optional[float] = 0.005
    reit_return_mean: Optional[float] = 0.08
    reit_return_std: Optional[float] = 0.15
    gold_return_mean: Optional[float] = 0.04
    gold_return_std: Optional[float] = 0.15
    crypto_return_mean: Optional[float] = 0.20
    crypto_return_std: Optional[float] = 0.60
    inflation_mean: Optional[float] = 0.03
    inflation_std: Optional[float] = 0.01
    ss_discount_rate: Optional[float] = 0.03


class MarketPeriodSchema(BaseModel):
    """Schema for a single market period."""

    start_year: Optional[int] = None
    end_year: Optional[int] = None
    duration: Optional[int] = None
    assumptions: MarketProfileSchema


class MarketPeriodsSchema(BaseModel):
    """Schema for period-based market conditions."""

    type: str  # 'timeline' or 'cycle'
    periods: Optional[List[MarketPeriodSchema]] = None  # For timeline type
    pattern: Optional[List[MarketPeriodSchema]] = None  # For cycle type
    repeat: Optional[bool] = True  # For cycle type


class AnalysisRequestSchema(BaseModel):
    """Schema for analysis request."""

    profile_name: str
    simulations: Optional[int] = 10000
    market_profile: Optional[MarketProfileSchema] = None
    market_periods: Optional[MarketPeriodsSchema] = None  # Use specific schema
    spending_model: Optional[str] = "constant_real"

    @field_validator("simulations", mode="before")
    def parse_simulations(cls, v):
        """Normalize simulation count from UI/localStorage values."""
        if v is None:
            return 10000
        if isinstance(v, float) and math.isnan(v):
            return 10000
        if isinstance(v, str):
            cleaned = v.replace(",", "").strip()
            if not cleaned:
                return 10000
            v = cleaned
        try:
            return int(v)
        except (TypeError, ValueError):
            return 10000

    @field_validator("simulations")
    def validate_simulations(cls, v):
        if v < 100 or v > 50000:
            raise ValueError("Simulations must be between 100 and 50,000")
        return v


class HealthcarePlanningRequestSchema(BaseModel):
    """Schema for healthcare planning request."""

    profile_name: str
    years: Optional[int] = 20
    filing_status: Optional[str] = None
    estimated_magi: Optional[float] = None
    annual_out_of_pocket: Optional[float] = None
    initial_hsa_balance: Optional[float] = None
    annual_hsa_contribution: Optional[float] = None
    hsa_growth: Optional[float] = 0.04
    medical_inflation: Optional[float] = 0.055
    income_growth: Optional[float] = 0.02

    @field_validator("years")
    def validate_years(cls, v):
        if v is None:
            return 20
        if v < 1 or v > 40:
            raise ValueError("years must be between 1 and 40")
        return v

    @field_validator("medical_inflation", "income_growth", "hsa_growth")
    def validate_rates(cls, v):
        if v is None:
            return v
        if v < -0.1 or v > 0.25:
            raise ValueError("rate must be between -10% and 25%")
        return v


def _safe_age_from_birth_date(birth_date_str: Optional[str]) -> Optional[int]:
    """Return integer age from ISO date string, or None if parsing fails."""
    if not birth_date_str:
        return None
    try:
        birth_date = datetime.fromisoformat(birth_date_str).date()
        today = date.today()
        return today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )
    except Exception:
        return None


def _build_scenario_assumptions(
    base_market_kwargs: dict, target_stock_allocation: float
) -> MarketAssumptions:
    """Build scenario assumptions by preserving proportional non-stock allocations."""
    remaining = 1.0 - target_stock_allocation
    final_assumptions = {**base_market_kwargs}
    final_assumptions["stock_allocation"] = target_stock_allocation

    if remaining > 0:
        current_b = base_market_kwargs.get("bond_allocation", 0.4)
        current_c = base_market_kwargs.get("cash_allocation", 0.1)
        other_sum = (
            current_b
            + current_c
            + base_market_kwargs.get("reit_allocation", 0)
            + base_market_kwargs.get("gold_allocation", 0)
            + base_market_kwargs.get("crypto_allocation", 0)
        )

        if other_sum > 0:
            scale = remaining / other_sum
            final_assumptions["bond_allocation"] = current_b * scale
            final_assumptions["cash_allocation"] = current_c * scale
            if "reit_allocation" in final_assumptions:
                final_assumptions["reit_allocation"] *= scale
            if "gold_allocation" in final_assumptions:
                final_assumptions["gold_allocation"] *= scale
            if "crypto_allocation" in final_assumptions:
                final_assumptions["crypto_allocation"] *= scale
    else:
        final_assumptions["bond_allocation"] = 0
        final_assumptions["cash_allocation"] = 0

    return MarketAssumptions(**final_assumptions)


@analysis_bp.route("/analysis", methods=["POST"])
@login_required
def run_analysis():
    """Run Monte Carlo analysis for a profile."""
    json_data = request.get_json(silent=True) or {}
    try:
        data = AnalysisRequestSchema(**json_data)
    except ValidationError as e:
        enhanced_audit_logger.log(
            action="RUN_ANALYSIS_VALIDATION_ERROR",
            details={"profile_name": json_data.get("profile_name"), "error": str(e)},
            status_code=400,
        )
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        # Log the unexpected error
        import logging
        logging.error(f"Unexpected analysis validation error: {str(e)}", exc_info=True)
        return jsonify({"error": "Invalid request data"}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="RUN_ANALYSIS_PROFILE_NOT_FOUND",
                details={"profile_name": data.profile_name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Import datetime for date conversion
        from datetime import datetime

        # Extract person data
        # Check both "financial" and "person" keys - seed data uses "person",
        # some profiles may use "financial"
        financial_data = profile_data.get("financial", {})
        person_data = profile_data.get("person", {})
        spouse_data = (
            profile_data.get("spouse") or {}
        )  # Handle None spouse for single profiles
        children_data = profile_data.get("children") or []  # Handle None children

        # Create person1 from profile birth_date and retirement_date
        birth_date_str = (
            profile.birth_date
            if hasattr(profile, "birth_date") and profile.birth_date
            else "1980-01-01"
        )
        retirement_date_str = (
            profile.retirement_date
            if hasattr(profile, "retirement_date") and profile.retirement_date
            else "2045-01-01"
        )

        person1 = Person(
            name=person_data.get("name") or profile.name or "Primary",
            birth_date=(
                datetime.fromisoformat(birth_date_str)
                if birth_date_str
                else datetime(1980, 1, 1)
            ),
            retirement_date=(
                datetime.fromisoformat(retirement_date_str)
                if retirement_date_str
                else datetime(2045, 1, 1)
            ),
            social_security=financial_data.get("social_security_benefit")
            or person_data.get("social_security_benefit")
            or 0,  # Already monthly
            ss_claiming_age=financial_data.get("ss_claiming_age")
            or person_data.get("ss_claiming_age")
            or 67,
            annual_401k_contribution_rate=financial_data.get("annual_401k_contribution_rate")
            or person_data.get("annual_401k_contribution_rate")
            or 0,
            employer_match_rate=financial_data.get("employer_match_rate")
            or person_data.get("employer_match_rate")
            or 0,
        )

        # Estimate Social Security if not explicitly set
        if person1.social_security == 0:
            # Calculate employment income from income_streams for SS estimation
            # Exclude streams belonging to the spouse
            income_streams = profile_data.get("income_streams", [])
            spouse_first_name = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            annual_employment = 0
            for stream in income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    # Skip spouse streams
                    stream_name = (stream.get("name") or "").lower()
                    if stream.get("owner") == "spouse":
                        continue
                    if spouse_first_name and spouse_first_name in stream_name:
                        continue

                    amt = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    if freq == "monthly":
                        annual_employment += amt * 12
                    elif freq == "annual":
                        annual_employment += amt
                    else:
                        annual_employment += amt * 12

            if annual_employment > 0:
                # Simplified PIA estimation using 2025 bend points
                aime = annual_employment / 12
                if aime <= 1226:
                    pia = aime * 0.90
                elif aime <= 7391:
                    pia = 1226 * 0.90 + (aime - 1226) * 0.32
                else:
                    pia = 1226 * 0.90 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15

                # Adjust for claiming age (67 = full PIA)
                claiming_age = person1.ss_claiming_age or 67
                if claiming_age < 67:
                    # ~6.67% reduction per year before 67
                    pia *= 1 - (67 - claiming_age) * 0.0667
                elif claiming_age > 67:
                    # ~8% increase per year after 67, up to 70
                    delay_years = min(claiming_age - 67, 3)
                    pia *= 1 + delay_years * 0.08

                person1.social_security = round(pia, 2)

        # Create person2 (spouse) if spouse data exists
        spouse_birth = (
            spouse_data.get("birth_date")
            if spouse_data.get("birth_date")
            else "1980-01-01"
        )
        spouse_retire = (
            spouse_data.get("retirement_date")
            if spouse_data.get("retirement_date")
            else "2045-01-01"
        )

        person2 = Person(
            name=spouse_data.get("name", "Spouse"),
            birth_date=(
                datetime.fromisoformat(spouse_birth)
                if spouse_birth
                else datetime(1980, 1, 1)
            ),
            retirement_date=(
                datetime.fromisoformat(spouse_retire)
                if spouse_retire
                else datetime(2045, 1, 1)
            ),
            social_security=spouse_data.get("social_security_benefit")
            or 0,  # Already monthly
            ss_claiming_age=spouse_data.get("ss_claiming_age") or 67,
            annual_401k_contribution_rate=spouse_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=spouse_data.get("employer_match_rate") or 0,
        )

        # Estimate Social Security for spouse if not explicitly set
        _has_spouse = bool(
            spouse_data.get("birth_date") or spouse_data.get("name")
            or spouse_data.get("social_security_benefit")
        )
        if _has_spouse and person2.social_security == 0:
            income_streams = profile_data.get("income_streams", [])
            spouse_name = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            spouse_annual_employment = 0
            for stream in income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    # Assign to spouse if stream name contains spouse's first name
                    # or if it doesn't contain primary's first name and we have a spouse name
                    stream_name = (stream.get("name") or "").lower()
                    is_spouse_stream = False
                    if spouse_name and spouse_name in stream_name:
                        is_spouse_stream = True
                    elif stream.get("owner") == "spouse":
                        is_spouse_stream = True
                    if is_spouse_stream:
                        amt = stream.get("amount", 0)
                        freq = stream.get("frequency", "monthly")
                        if freq == "monthly":
                            spouse_annual_employment += amt * 12
                        elif freq == "annual":
                            spouse_annual_employment += amt
                        else:
                            spouse_annual_employment += amt * 12

            if spouse_annual_employment > 0:
                aime = spouse_annual_employment / 12
                if aime <= 1226:
                    pia = aime * 0.90
                elif aime <= 7391:
                    pia = 1226 * 0.90 + (aime - 1226) * 0.32
                else:
                    pia = 1226 * 0.90 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15

                claiming_age = person2.ss_claiming_age or 67
                if claiming_age < 67:
                    pia *= 1 - (67 - claiming_age) * 0.0667
                elif claiming_age > 67:
                    delay_years = min(claiming_age - 67, 3)
                    pia *= 1 + delay_years * 0.08

                person2.social_security = round(pia, 2)

        # Get assets from profile and transform to investment_types format
        assets_data = profile_data.get("assets", {})
        investment_types = transform_assets_to_investment_types(assets_data)
        management_fee_drag = compute_management_fee_drag(investment_types)

        # Calculate totals from assets for display/fallback
        liquid_assets = sum(
            a.get("value", 0) for a in assets_data.get("taxable_accounts", [])
        )
        traditional_ira = sum(
            a.get("value", 0)
            for a in assets_data.get("retirement_accounts", [])
            if "traditional" in a.get("type", "").lower()
            or "401" in a.get("type", "").lower()
            or "403" in a.get("type", "").lower()
        )
        roth_ira = sum(
            a.get("value", 0)
            for a in assets_data.get("retirement_accounts", [])
            if "roth" in a.get("type", "").lower()
        )

        # Create financial profile matching the FinancialProfile dataclass
        # Use explicit None checks to preserve valid zero values
        pension_benefit = (
            financial_data.get("pension_benefit")
            if financial_data.get("pension_benefit") is not None
            else 0
        )
        annual_expenses = (
            financial_data.get("annual_expenses")
            if financial_data.get("annual_expenses") is not None
            else 0
        )
        annual_income = (
            financial_data.get("annual_income")
            if financial_data.get("annual_income") is not None
            else 0
        )
        liquid_assets_val = (
            liquid_assets
            if liquid_assets is not None
            else (
                financial_data.get("liquid_assets")
                if financial_data.get("liquid_assets") is not None
                else 0
            )
        )
        retirement_assets_val = (
            traditional_ira
            if traditional_ira is not None
            else (
                financial_data.get("retirement_assets")
                if financial_data.get("retirement_assets") is not None
                else 0
            )
        )

        # Normalize income paths so employment is counted exactly once.
        budget_data, mc_income_streams = _prepare_budget_and_income_streams(
            profile_data, spouse_data
        )

        # Get tax settings with proper address fallback
        address_data = profile_data.get("address", {})
        tax_settings = profile_data.get("tax_settings", {})

        # Priority: explicit tax settings > auto-detect from spouse > default
        has_spouse_for_filing = bool(
            spouse_data.get("birth_date")
            or spouse_data.get("name")
            or spouse_data.get("social_security_benefit")
        )
        default_filing = "mfj" if has_spouse_for_filing else "single"
        filing_status = tax_settings.get("filing_status") or default_filing
        state = tax_settings.get("state") or address_data.get("state") or "NY"
        tax_year = int(tax_settings.get("tax_year") or CURRENT_TAX_YEAR)

        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=children_data,
            liquid_assets=liquid_assets_val,
            traditional_ira=retirement_assets_val,
            roth_ira=roth_ira or 0,
            pension_lump_sum=0,
            pension_annual=pension_benefit * 12,  # Convert monthly to annual
            annual_expenses=annual_expenses,
            target_annual_income=annual_income,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0.6, "bonds": 0.4},
            future_expenses=[],
            investment_types=investment_types,
            accounts=[],
            income_streams=mc_income_streams,
            home_properties=profile_data.get("home_properties", []),
            budget=budget_data if budget_data else None,
            annual_ira_contribution=financial_data.get("annual_ira_contribution", 0),
            ira_roth_split=financial_data.get("ira_roth_split", 0.5),
            savings_allocation=profile_data.get("savings_allocation"),
            filing_status=filing_status,
            state=state,
            tax_year=tax_year,
        )

        # Create retirement model
        model = RetirementModel(financial_profile)

        # Calculate years for simulation using profile's life expectancy
        person_data = profile_data.get("person", {})
        p1_life_exp = person_data.get("life_expectancy", 90)
        years = model.calculate_life_expectancy_years(person1, target_age=p1_life_exp)

        # Only include spouse in years calc if actual spouse data exists
        has_spouse = bool(
            spouse_data.get("birth_date")
            or spouse_data.get("name")
            or spouse_data.get("social_security_benefit")
        )
        if has_spouse:
            p2_life_exp = spouse_data.get("life_expectancy", 90)
            years = max(years, model.calculate_life_expectancy_years(person2, target_age=p2_life_exp))

        # Create base market assumptions from request or use defaults
        base_market_kwargs = {}
        if data.market_profile:
            base_market_kwargs = data.market_profile.dict()

        # Run multiple scenarios (Conservative, Moderate, Aggressive)
        scenarios = {
            "conservative": {
                "name": "Conservative",
                "stock_allocation": 0.30,
                "description": "30% stocks / 70% bonds - Lower risk, lower expected returns",
            },
            "moderate": {
                "name": "Moderate",
                "stock_allocation": 0.60,
                "description": "60% stocks / 40% bonds - Balanced risk and returns",
            },
            "aggressive": {
                "name": "Aggressive",
                "stock_allocation": 0.80,
                "description": "80% stocks / 20% bonds - Higher risk, higher expected returns",
            },
        }

        # Run simulation for each scenario
        scenario_results = {}
        for scenario_key, scenario_config in scenarios.items():
            target_stock = scenario_config["stock_allocation"]
            market_assumptions = _build_scenario_assumptions(base_market_kwargs, target_stock)
            scenario_result = model.monte_carlo_simulation(
                years=years,
                simulations=data.simulations,
                assumptions=market_assumptions,
                spending_model=data.spending_model,
                market_periods=data.market_periods.dict() if data.market_periods else None,
                management_fee_drag=management_fee_drag,
            )
            scenario_result["scenario_name"] = scenario_config["name"]
            scenario_result["description"] = scenario_config["description"]
            scenario_result["stock_allocation"] = target_stock
            scenario_results[scenario_key] = scenario_result

        # Phase 1 planning add-ons
        life_insurance_estimate = estimate_life_insurance_needs(profile_data)
        debt_management_plan = build_debt_payoff_strategy(profile_data)
        college_529_plan = build_529_college_savings_plan(profile_data)
        pension_lump_sum_analysis = build_pension_lump_sum_analysis(profile_data)
        estate_tax_gifting_strategy = build_estate_tax_gifting_strategy(profile_data)
        investment_fee_impact = build_investment_fee_impact_analyzer(profile_data)
        part_time_retirement_model = build_part_time_retirement_model(profile_data)
        real_estate_enhancements = build_real_estate_enhancements(profile_data)

        current_year = datetime.now().year
        retirement_offset = max(0, person1.retirement_date.year - current_year)
        stress_offsets = generate_sequence_offsets(years, retirement_offset)
        sequence_stress_simulations = max(100, min(int(data.simulations), 2000))
        sequence_baseline = scenario_results.get("moderate", {})
        sequence_case_results = []

        stress_assumptions = _build_scenario_assumptions(base_market_kwargs, 0.60)
        for case in stress_offsets:
            start_year = current_year + case["offset"]
            end_year = min(current_year + years - 1, start_year + 1)
            crash_market_periods = {
                "type": "timeline",
                "periods": [
                    {
                        "start_year": start_year,
                        "end_year": end_year,
                        "assumptions": {
                            "stock_return_mean": -0.24,
                            "stock_return_std": 0.28,
                            "bond_return_mean": 0.015,
                            "bond_return_std": 0.10,
                            "inflation_mean": 0.05,
                            "inflation_std": 0.02,
                        },
                    }
                ],
            }
            stressed = model.monte_carlo_simulation(
                years=years,
                simulations=sequence_stress_simulations,
                assumptions=stress_assumptions,
                spending_model=data.spending_model,
                market_periods=crash_market_periods,
                management_fee_drag=management_fee_drag,
            )
            baseline_success = float(sequence_baseline.get("success_rate", 0.0))
            baseline_median = float(sequence_baseline.get("median_final_balance", 0.0))
            case_success = float(stressed.get("success_rate", 0.0))
            case_median = float(stressed.get("median_final_balance", 0.0))

            sequence_case_results.append(
                {
                    "label": case["label"],
                    "offset_years": case["offset"],
                    "crash_window_years": [start_year, end_year],
                    "success_rate": round(case_success, 4),
                    "success_rate_delta": round(case_success - baseline_success, 4),
                    "median_final_balance": round(case_median, 2),
                    "median_final_balance_delta": round(case_median - baseline_median, 2),
                }
            )

        sequence_summary = summarize_sequence_impact(
            float(sequence_baseline.get("success_rate", 0.0)),
            float(sequence_baseline.get("median_final_balance", 0.0)),
            sequence_case_results,
        )
        advanced_scenario_analysis = build_advanced_scenario_analysis(scenario_results, years)
        dynamic_withdrawal_strategies = build_dynamic_withdrawal_strategies(
            profile_data, scenario_results
        )
        life_event_scenario_modeling = build_life_event_scenario_modeling(
            profile_data, scenario_results
        )
        disability_income_protection = build_disability_income_protection(profile_data)
        long_term_care_analysis = build_long_term_care_analysis(profile_data)
        business_owner_retirement_planning = build_business_owner_retirement_planning(profile_data)
        secure_act_beneficiary_ira = build_secure_act_beneficiary_ira(profile_data)
        annuity_comparison_tool = build_annuity_comparison_tool(profile_data)
        cashflow_budget_enhancements = build_cashflow_budget_enhancements(profile_data)
        retirement_lifestyle_planning = build_retirement_lifestyle_planning(profile_data)
        document_vault_beneficiary_tracking = build_document_vault_beneficiary_tracking(profile_data)
        advanced_investment_factor_analysis = build_advanced_investment_factor_analysis(profile_data)
        family_legacy_gifting_goals = build_family_legacy_gifting_goals(profile_data)
        risk_analysis_dashboard = build_risk_analysis_dashboard(profile_data, scenario_results)
        plan_health_monitoring_drift_alerts = build_plan_health_monitoring_drift_alerts(
            profile_data, scenario_results
        )
        tax_law_update_engine = build_tax_law_update_engine(profile_data)
        pre65_healthcare_bridge_planner = build_pre65_healthcare_bridge_planner(profile_data)
        guaranteed_income_floor_optimizer = build_guaranteed_income_floor_optimizer(
            profile_data, scenario_results
        )
        social_security_statement_reconciliation = build_social_security_statement_reconciliation(
            profile_data
        )
        data_aggregation_reconciliation_hub = build_data_aggregation_reconciliation_hub(profile_data)
        longevity_care_path_modeling = build_longevity_care_path_modeling(profile_data)
        charitable_strategy_optimizer = build_charitable_strategy_optimizer(profile_data)
        household_collaboration_workflow = build_household_collaboration_workflow(profile_data)
        retirement_paycheck_builder = build_retirement_paycheck_builder(profile_data)

        # Prepare response with all scenarios
        response = {
            "profile_name": data.profile_name,
            "simulations": data.simulations,
            "timestamp": profile.updated_at,
            "scenarios": scenario_results,
            "total_assets": sum(inv.get("value", 0) for inv in investment_types),
            "account_breakdown": [
                {"account": inv.get("account", ""), "name": inv.get("name", ""), "value": inv.get("value", 0)}
                for inv in investment_types if inv.get("value", 0) > 0
            ],
            "years_projected": years,
            "life_insurance_estimate": life_insurance_estimate,
            "debt_management_plan": debt_management_plan,
            "college_529_plan": college_529_plan,
            "pension_lump_sum_analysis": pension_lump_sum_analysis,
            "estate_tax_gifting_strategy": estate_tax_gifting_strategy,
            "investment_fee_impact": investment_fee_impact,
            "part_time_retirement_model": part_time_retirement_model,
            "real_estate_enhancements": real_estate_enhancements,
            "advanced_scenario_analysis": advanced_scenario_analysis,
            "dynamic_withdrawal_strategies": dynamic_withdrawal_strategies,
            "life_event_scenario_modeling": life_event_scenario_modeling,
            "disability_income_protection": disability_income_protection,
            "long_term_care_analysis": long_term_care_analysis,
            "business_owner_retirement_planning": business_owner_retirement_planning,
            "secure_act_beneficiary_ira": secure_act_beneficiary_ira,
            "annuity_comparison_tool": annuity_comparison_tool,
            "cashflow_budget_enhancements": cashflow_budget_enhancements,
            "retirement_lifestyle_planning": retirement_lifestyle_planning,
            "document_vault_beneficiary_tracking": document_vault_beneficiary_tracking,
            "advanced_investment_factor_analysis": advanced_investment_factor_analysis,
            "family_legacy_gifting_goals": family_legacy_gifting_goals,
            "risk_analysis_dashboard": risk_analysis_dashboard,
            "plan_health_monitoring_drift_alerts": plan_health_monitoring_drift_alerts,
            "tax_law_update_engine": tax_law_update_engine,
            "pre65_healthcare_bridge_planner": pre65_healthcare_bridge_planner,
            "guaranteed_income_floor_optimizer": guaranteed_income_floor_optimizer,
            "social_security_statement_reconciliation": social_security_statement_reconciliation,
            "data_aggregation_reconciliation_hub": data_aggregation_reconciliation_hub,
            "longevity_care_path_modeling": longevity_care_path_modeling,
            "charitable_strategy_optimizer": charitable_strategy_optimizer,
            "household_collaboration_workflow": household_collaboration_workflow,
            "retirement_paycheck_builder": retirement_paycheck_builder,
            "sequence_risk_visualization": {
                "simulations": sequence_stress_simulations,
                "baseline": {
                    "scenario": "Moderate",
                    "success_rate": round(float(sequence_baseline.get("success_rate", 0.0)), 4),
                    "median_final_balance": round(
                        float(sequence_baseline.get("median_final_balance", 0.0)), 2
                    ),
                },
                "cases": sequence_case_results,
                "summary": sequence_summary,
            },
        }

        enhanced_audit_logger.log(
            action="RUN_MONTE_CARLO_ANALYSIS",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": data.profile_name,
                "simulations": data.simulations,
                "spending_model": data.spending_model,
                "years_projected": years,
                "total_assets": response["total_assets"],
                "scenarios_run": list(scenario_results.keys()),
            },
            status_code=200,
        )
        return jsonify(response), 200

    except KeyError as e:
        profile_name = json_data.get("profile_name")
        enhanced_audit_logger.log(
            action="RUN_ANALYSIS_KEY_ERROR",
            details={"profile_name": profile_name, "error": str(e)},
            status_code=400,
        )
        return jsonify({"error": "Missing required field"}), 400
    except Exception as e:
        profile_name = json_data.get("profile_name")
        enhanced_audit_logger.log(
            action="RUN_ANALYSIS_ERROR",
            details={"profile_name": profile_name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": "An internal error occurred"}), 500


@analysis_bp.route("/analysis/cashflow-details", methods=["POST"])
@login_required
def get_cashflow_details():
    """Run a detailed deterministic projection for cashflow visualization."""
    json_data = request.get_json(silent=True) or {}
    try:
        data = AnalysisRequestSchema(**json_data)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400
    except Exception as e:
        import logging
        logging.error(f"Unexpected cashflow validation error: {str(e)}", exc_info=True)
        return jsonify({"error": "Invalid request data"}), 400

    try:
        # Get profile with ownership check
        profile = Profile.get_by_name(data.profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            return jsonify({"error": "Profile data is empty"}), 400

        # Import datetime for date conversion
        from datetime import datetime

        # Extract person data - check both "financial" and "person" keys
        financial_data = profile_data.get("financial", {})
        person_data = profile_data.get("person", {})
        spouse_data = profile_data.get("spouse") or {}
        children_data = profile_data.get("children") or []

        # Create person1
        birth_date_str = (
            profile.birth_date
            if hasattr(profile, "birth_date") and profile.birth_date
            else "1980-01-01"
        )
        retirement_date_str = (
            profile.retirement_date
            if hasattr(profile, "retirement_date") and profile.retirement_date
            else "2045-01-01"
        )

        person1 = Person(
            name=person_data.get("name") or profile.name or "Primary",
            birth_date=(
                datetime.fromisoformat(birth_date_str)
                if birth_date_str
                else datetime(1980, 1, 1)
            ),
            retirement_date=(
                datetime.fromisoformat(retirement_date_str)
                if retirement_date_str
                else datetime(2045, 1, 1)
            ),
            social_security=financial_data.get("social_security_benefit")
            or person_data.get("social_security_benefit")
            or 0,
            ss_claiming_age=financial_data.get("ss_claiming_age")
            or person_data.get("ss_claiming_age")
            or 67,
            annual_401k_contribution_rate=financial_data.get("annual_401k_contribution_rate")
            or person_data.get("annual_401k_contribution_rate")
            or 0,
            employer_match_rate=financial_data.get("employer_match_rate")
            or person_data.get("employer_match_rate")
            or 0,
        )

        # Estimate Social Security if not explicitly set
        # Exclude spouse streams from person1's estimation
        if person1.social_security == 0:
            income_streams = profile_data.get("income_streams", [])
            spouse_first_name = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            annual_employment = 0
            for stream in income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    # Skip spouse streams
                    stream_name = (stream.get("name") or "").lower()
                    if stream.get("owner") == "spouse":
                        continue
                    if spouse_first_name and spouse_first_name in stream_name:
                        continue

                    amt = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    if freq == "monthly":
                        annual_employment += amt * 12
                    elif freq == "annual":
                        annual_employment += amt
                    else:
                        annual_employment += amt * 12

            if annual_employment > 0:
                aime = annual_employment / 12
                if aime <= 1226:
                    pia = aime * 0.90
                elif aime <= 7391:
                    pia = 1226 * 0.90 + (aime - 1226) * 0.32
                else:
                    pia = 1226 * 0.90 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15

                claiming_age = person1.ss_claiming_age or 67
                if claiming_age < 67:
                    pia *= 1 - (67 - claiming_age) * 0.0667
                elif claiming_age > 67:
                    delay_years = min(claiming_age - 67, 3)
                    pia *= 1 + delay_years * 0.08

                person1.social_security = round(pia, 2)

        # Create person2
        spouse_birth = (
            spouse_data.get("birth_date")
            if spouse_data.get("birth_date")
            else "1980-01-01"
        )
        spouse_retire = (
            spouse_data.get("retirement_date")
            if spouse_data.get("retirement_date")
            else "2045-01-01"
        )

        person2 = Person(
            name=spouse_data.get("name", "Spouse"),
            birth_date=(
                datetime.fromisoformat(spouse_birth)
                if spouse_birth
                else datetime(1980, 1, 1)
            ),
            retirement_date=(
                datetime.fromisoformat(spouse_retire)
                if spouse_retire
                else datetime(2045, 1, 1)
            ),
            social_security=spouse_data.get("social_security_benefit") or 0,
            ss_claiming_age=spouse_data.get("ss_claiming_age") or 67,
            annual_401k_contribution_rate=spouse_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=spouse_data.get("employer_match_rate") or 0,
        )

        # Estimate Social Security for spouse if not explicitly set
        _has_spouse_cf = bool(
            spouse_data.get("birth_date") or spouse_data.get("name")
            or spouse_data.get("social_security_benefit")
        )
        if _has_spouse_cf and person2.social_security == 0:
            income_streams = profile_data.get("income_streams", [])
            spouse_name = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            spouse_annual_employment = 0
            for stream in income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    stream_name = (stream.get("name") or "").lower()
                    is_spouse_stream = False
                    if spouse_name and spouse_name in stream_name:
                        is_spouse_stream = True
                    elif stream.get("owner") == "spouse":
                        is_spouse_stream = True
                    if is_spouse_stream:
                        amt = stream.get("amount", 0)
                        freq = stream.get("frequency", "monthly")
                        if freq == "monthly":
                            spouse_annual_employment += amt * 12
                        elif freq == "annual":
                            spouse_annual_employment += amt
                        else:
                            spouse_annual_employment += amt * 12

            if spouse_annual_employment > 0:
                aime = spouse_annual_employment / 12
                if aime <= 1226:
                    pia = aime * 0.90
                elif aime <= 7391:
                    pia = 1226 * 0.90 + (aime - 1226) * 0.32
                else:
                    pia = 1226 * 0.90 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15

                claiming_age = person2.ss_claiming_age or 67
                if claiming_age < 67:
                    pia *= 1 - (67 - claiming_age) * 0.0667
                elif claiming_age > 67:
                    delay_years = min(claiming_age - 67, 3)
                    pia *= 1 + delay_years * 0.08

                person2.social_security = round(pia, 2)

        # Get assets
        assets_data = profile_data.get("assets", {})
        investment_types = transform_assets_to_investment_types(assets_data)
        management_fee_drag = compute_management_fee_drag(investment_types)

        liquid_assets = sum(
            a.get("value", 0) for a in assets_data.get("taxable_accounts", [])
        )
        traditional_ira = sum(
            a.get("value", 0)
            for a in assets_data.get("retirement_accounts", [])
            if "traditional" in a.get("type", "").lower()
            or "401" in a.get("type", "").lower()
            or "403" in a.get("type", "").lower()
        )
        roth_ira = sum(
            a.get("value", 0)
            for a in assets_data.get("retirement_accounts", [])
            if "roth" in a.get("type", "").lower()
        )

        pension_benefit = (
            financial_data.get("pension_benefit")
            if financial_data.get("pension_benefit") is not None
            else 0
        )
        annual_expenses = (
            financial_data.get("annual_expenses")
            if financial_data.get("annual_expenses") is not None
            else 0
        )
        annual_income = (
            financial_data.get("annual_income")
            if financial_data.get("annual_income") is not None
            else 0
        )
        liquid_assets_val = (
            liquid_assets
            if liquid_assets is not None
            else (
                financial_data.get("liquid_assets")
                if financial_data.get("liquid_assets") is not None
                else 0
            )
        )
        retirement_assets_val = (
            traditional_ira
            if traditional_ira is not None
            else (
                financial_data.get("retirement_assets")
                if financial_data.get("retirement_assets") is not None
                else 0
            )
        )

        # Normalize income paths so employment is counted exactly once.
        budget_data, mc_income_streams = _prepare_budget_and_income_streams(
            profile_data, spouse_data
        )

        # Get tax settings with proper address fallback
        address_data = profile_data.get("address", {})
        tax_settings = profile_data.get("tax_settings", {})

        # Priority: explicit tax settings > auto-detect from spouse > default
        has_spouse_for_filing = bool(
            spouse_data.get("birth_date")
            or spouse_data.get("name")
            or spouse_data.get("social_security_benefit")
        )
        default_filing = "mfj" if has_spouse_for_filing else "single"
        filing_status = tax_settings.get("filing_status") or default_filing
        state = tax_settings.get("state") or address_data.get("state") or "NY"
        tax_year = int(tax_settings.get("tax_year") or CURRENT_TAX_YEAR)

        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=children_data,
            liquid_assets=liquid_assets_val,
            traditional_ira=retirement_assets_val,
            roth_ira=roth_ira or 0,
            pension_lump_sum=0,
            pension_annual=pension_benefit * 12,
            annual_expenses=annual_expenses,
            target_annual_income=annual_income,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0.6, "bonds": 0.4},
            future_expenses=[],
            investment_types=investment_types,
            accounts=[],
            income_streams=mc_income_streams,
            home_properties=profile_data.get("home_properties", []),
            budget=budget_data if budget_data else None,
            annual_ira_contribution=financial_data.get("annual_ira_contribution", 0),
            ira_roth_split=financial_data.get("ira_roth_split", 0.5),
            savings_allocation=profile_data.get("savings_allocation"),
            filing_status=filing_status,
            state=state,
            tax_year=tax_year,
        )

        model = RetirementModel(financial_profile)
        p1_life_exp = person_data.get("life_expectancy", 90)
        years = model.calculate_life_expectancy_years(person1, target_age=p1_life_exp)
        if _has_spouse_cf:
            p2_life_exp = spouse_data.get("life_expectancy", 90)
            years = max(years, model.calculate_life_expectancy_years(person2, target_age=p2_life_exp))

        # Use passed market assumptions or defaults
        base_market_kwargs = {}
        if data.market_profile:
            base_market_kwargs = data.market_profile.dict()

        # Use provided allocation or moderate default
        target_stock = base_market_kwargs.get("stock_allocation", 0.60)
        assumptions = MarketAssumptions(
            **{**base_market_kwargs, "stock_allocation": target_stock}
        )

        # Run detailed projection
        detailed_ledger = model.run_detailed_projection(
            years=years, assumptions=assumptions, spending_model=data.spending_model,
            management_fee_drag=management_fee_drag,
        )

        response = {"profile_name": data.profile_name, "ledger": detailed_ledger}

        enhanced_audit_logger.log(
            action="RUN_DETAILED_CASHFLOW",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": data.profile_name},
            status_code=200,
        )
        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": "An internal error occurred"}), 500


@analysis_bp.route("/analysis/healthcare-planning", methods=["POST"])
@login_required
def analyze_healthcare_planning():
    """Generate deterministic healthcare and Medicare cost projections."""
    json_data = request.get_json(silent=True) or {}
    try:
        data = HealthcarePlanningRequestSchema(**json_data)
    except ValidationError as e:
        return jsonify({"error": sanitize_pydantic_error(e)}), 400

    profile = Profile.get_by_name(data.profile_name, current_user.id)
    if not profile:
        return jsonify({"error": "Profile not found"}), 404

    profile_data = profile.data_dict or {}
    person_data = profile_data.get("person") or {}
    spouse_data = profile_data.get("spouse") or {}
    tax_settings = profile_data.get("tax_settings") or {}

    # Prefer explicit dates, then fallback to profile columns and age fields.
    primary_age = _safe_age_from_birth_date(
        person_data.get("birth_date") or getattr(profile, "birth_date", None)
    )
    if primary_age is None:
        primary_age = int(person_data.get("current_age") or 45)

    spouse_age = _safe_age_from_birth_date(spouse_data.get("birth_date"))
    if spouse_age is None and spouse_data.get("current_age") is not None:
        spouse_age = int(spouse_data.get("current_age"))
    if spouse_age is not None and spouse_age <= 0:
        spouse_age = None

    filing_status = (
        data.filing_status
        or tax_settings.get("filing_status")
        or ("mfj" if spouse_age is not None else "single")
    )

    service = HealthcarePlanningService(filing_status=filing_status)
    base_magi = (
        float(data.estimated_magi)
        if data.estimated_magi is not None
        else service.infer_base_magi(profile_data)
    )
    base_out_of_pocket = (
        float(data.annual_out_of_pocket)
        if data.annual_out_of_pocket is not None
        else service.infer_base_out_of_pocket(profile_data)
    )
    initial_hsa_balance = (
        float(data.initial_hsa_balance)
        if data.initial_hsa_balance is not None
        else service.infer_hsa_balance(profile_data)
    )
    annual_hsa_contribution = (
        float(data.annual_hsa_contribution)
        if data.annual_hsa_contribution is not None
        else service.infer_hsa_contribution(profile_data)
    )

    projection = service.project(
        current_age=primary_age,
        spouse_age=spouse_age,
        years=data.years or 20,
        inflation_medical=float(data.medical_inflation or 0.055),
        income_growth=float(data.income_growth or 0.02),
        base_magi=base_magi,
        base_out_of_pocket=base_out_of_pocket,
        initial_hsa_balance=initial_hsa_balance,
        annual_hsa_contribution=annual_hsa_contribution,
        hsa_growth=float(data.hsa_growth or 0.04),
    )

    enhanced_audit_logger.log(
        action="RUN_HEALTHCARE_PLANNING",
        table_name="profile",
        record_id=profile.id,
        details={
            "profile_name": data.profile_name,
            "years": data.years,
            "filing_status": filing_status,
        },
        status_code=200,
    )

    return jsonify({"profile_name": data.profile_name, **projection}), 200


@analysis_bp.route("/analysis/social-security", methods=["POST"])
@login_required
def analyze_social_security():
    """Analyze optimal Social Security claiming age."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None
    try:
        profile_name = json_data.get("profile_name")
        if not profile_name:
            enhanced_audit_logger.log(
                action="ANALYZE_SS_VALIDATION_ERROR",
                details={"error": "profile_name is required"},
                status_code=400,
            )
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="ANALYZE_SS_PROFILE_NOT_FOUND",
                details={"profile_name": profile_name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            enhanced_audit_logger.log(
                action="ANALYZE_SS_EMPTY_PROFILE",
                details={"profile_name": profile_name},
                status_code=400,
            )
            return jsonify({"error": "Profile data is empty"}), 400

        # Extract data and create model
        person_data = profile_data.get("person", {})
        financial_data = profile_data.get("financial", {})
        spouse_data = profile_data.get("spouse") or {}

        birth_date_str = person_data.get("birth_date") or (
            profile.birth_date if hasattr(profile, "birth_date") and profile.birth_date else "1980-01-01"
        )
        retirement_date_str = person_data.get("retirement_date") or (
            profile.retirement_date if hasattr(profile, "retirement_date") and profile.retirement_date else "2045-01-01"
        )

        person1 = Person(
            name=person_data.get("name") or profile.name or "Primary",
            birth_date=datetime.fromisoformat(birth_date_str) if birth_date_str else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(retirement_date_str) if retirement_date_str else datetime(2045, 1, 1),
            social_security=financial_data.get("social_security_benefit") or person_data.get("social_security_benefit", 0) or 0,
            ss_claiming_age=financial_data.get("ss_claiming_age") or person_data.get("ss_claiming_age", 67) or 67,
        )

        spouse_birth = spouse_data.get("birth_date") or "1980-01-01"
        spouse_retire = spouse_data.get("retirement_date") or "2045-01-01"
        person2 = Person(
            name=spouse_data.get("name", "Spouse"),
            birth_date=datetime.fromisoformat(spouse_birth) if spouse_birth else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(spouse_retire) if spouse_retire else datetime(2045, 1, 1),
            social_security=spouse_data.get("social_security_benefit", 0) or 0,
            ss_claiming_age=spouse_data.get("ss_claiming_age", 67) or 67,
        )

        # Build a minimal FinancialProfile for analysis
        assets_data = profile_data.get("assets", {})
        income_streams = profile_data.get("income_streams", [])
        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=profile_data.get("children") or [],
            liquid_assets=sum(a.get("value", 0) for a in assets_data.get("taxable_accounts", [])),
            traditional_ira=sum(a.get("value", 0) for a in assets_data.get("retirement_accounts", []) if a.get("type") in ("traditional_ira", "401k", "403b")),
            roth_ira=sum(a.get("value", 0) for a in assets_data.get("retirement_accounts", []) if a.get("type") in ("roth_ira", "roth_401k")),
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0.6, "bonds": 0.4},
            future_expenses=[],
            income_streams=income_streams,
        )

        model = RetirementModel(financial_profile)

        # Return Social Security analysis summary
        # (analyze_social_security_strategies is not implemented in the model,
        #  so return estimated benefits for different claiming ages)
        results = {
            "profile_name": profile_name,
            "person1": {
                "name": person1.name,
                "social_security_monthly": person1.social_security,
                "claiming_age": person1.ss_claiming_age,
            },
        }
        if spouse_data.get("name"):
            results["person2"] = {
                "name": person2.name,
                "social_security_monthly": person2.social_security,
                "claiming_age": person2.ss_claiming_age,
            }

        enhanced_audit_logger.log(
            action="ANALYZE_SOCIAL_SECURITY",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": profile_name},
            status_code=200,
        )
        return jsonify(results), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action="ANALYZE_SS_ERROR",
            details={
                "profile_name": profile_name if "profile_name" in dir() else None,
                "error": str(e),
            },
            status_code=500,
        )
        return jsonify({"error": "An internal error occurred"}), 500


@analysis_bp.route("/analysis/roth-conversion", methods=["POST"])
@login_required
def analyze_roth_conversion():
    """Analyze Roth conversion strategies."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None
    try:
        profile_name = json_data.get("profile_name")
        conversion_amount = json_data.get("conversion_amount", 50000)

        if not profile_name:
            enhanced_audit_logger.log(
                action="ANALYZE_ROTH_VALIDATION_ERROR",
                details={"error": "profile_name is required"},
                status_code=400,
            )
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="ANALYZE_ROTH_PROFILE_NOT_FOUND",
                details={"profile_name": profile_name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        if not profile_data:
            enhanced_audit_logger.log(
                action="ANALYZE_ROTH_EMPTY_PROFILE",
                details={"profile_name": profile_name},
                status_code=400,
            )
            return jsonify({"error": "Profile data is empty"}), 400

        # Extract data and create model
        person_data = profile_data.get("person", {})
        financial_data = profile_data.get("financial", {})
        spouse_data = profile_data.get("spouse") or {}

        birth_date_str = person_data.get("birth_date") or (
            profile.birth_date if hasattr(profile, "birth_date") and profile.birth_date else "1980-01-01"
        )
        retirement_date_str = person_data.get("retirement_date") or (
            profile.retirement_date if hasattr(profile, "retirement_date") and profile.retirement_date else "2045-01-01"
        )

        person1 = Person(
            name=person_data.get("name") or profile.name or "Primary",
            birth_date=datetime.fromisoformat(birth_date_str) if birth_date_str else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(retirement_date_str) if retirement_date_str else datetime(2045, 1, 1),
            social_security=financial_data.get("social_security_benefit") or person_data.get("social_security_benefit", 0) or 0,
            ss_claiming_age=financial_data.get("ss_claiming_age") or person_data.get("ss_claiming_age", 67) or 67,
        )

        spouse_birth = spouse_data.get("birth_date") or "1980-01-01"
        spouse_retire = spouse_data.get("retirement_date") or "2045-01-01"
        person2 = Person(
            name=spouse_data.get("name", "Spouse"),
            birth_date=datetime.fromisoformat(spouse_birth) if spouse_birth else datetime(1980, 1, 1),
            retirement_date=datetime.fromisoformat(spouse_retire) if spouse_retire else datetime(2045, 1, 1),
            social_security=spouse_data.get("social_security_benefit", 0) or 0,
            ss_claiming_age=spouse_data.get("ss_claiming_age", 67) or 67,
        )

        assets_data = profile_data.get("assets", {})
        traditional_ira = sum(
            a.get("value", 0) for a in assets_data.get("retirement_accounts", [])
            if a.get("type") in ("traditional_ira", "401k", "403b")
        )
        roth_ira = sum(
            a.get("value", 0) for a in assets_data.get("retirement_accounts", [])
            if a.get("type") in ("roth_ira", "roth_401k")
        )

        financial_profile = FinancialProfile(
            person1=person1,
            person2=person2,
            children=profile_data.get("children") or [],
            liquid_assets=sum(a.get("value", 0) for a in assets_data.get("taxable_accounts", [])),
            traditional_ira=traditional_ira,
            roth_ira=roth_ira,
            pension_lump_sum=0,
            pension_annual=0,
            annual_expenses=0,
            target_annual_income=0,
            risk_tolerance="moderate",
            asset_allocation={"stocks": 0.6, "bonds": 0.4},
            future_expenses=[],
            income_streams=profile_data.get("income_streams", []),
            tax_year=int(profile_data.get("tax_settings", {}).get("tax_year") or CURRENT_TAX_YEAR),
        )

        # Calculate Roth conversion tax impact
        # Get current income for tax bracket estimation
        income_streams = profile_data.get("income_streams", [])
        current_income = sum(s.get("amount", 0) * 12 for s in income_streams)
        tax_settings = profile_data.get("tax_settings", {})
        filing_status = tax_settings.get("filing_status", "mfj")
        tax_year = int(tax_settings.get("tax_year") or CURRENT_TAX_YEAR)

        # Estimate tax on conversion
        tax_before = TaxEngine.calculate_federal_tax(current_income, tax_year, filing_status)
        tax_after = TaxEngine.calculate_federal_tax(current_income + conversion_amount, tax_year, filing_status)
        conversion_tax = tax_after - tax_before

        results = {
            "profile_name": profile_name,
            "conversion_amount": conversion_amount,
            "estimated_tax": round(conversion_tax, 2),
            "effective_rate": round((conversion_tax / conversion_amount * 100) if conversion_amount > 0 else 0, 1),
            "traditional_balance": traditional_ira,
            "roth_balance": roth_ira,
        }

        enhanced_audit_logger.log(
            action="ANALYZE_ROTH_CONVERSION",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": profile_name,
                "conversion_amount": conversion_amount,
            },
            status_code=200,
        )
        return jsonify(results), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action="ANALYZE_ROTH_ERROR",
            details={
                "profile_name": profile_name if "profile_name" in dir() else None,
                "error": str(e),
            },
            status_code=500,
        )
        return jsonify({"error": "An internal error occurred"}), 500


@analysis_bp.route("/analysis/rebalance", methods=["POST"])
@login_required
def analyze_rebalancing():
    """Analyze current allocation and suggest rebalancing."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None
    try:
        profile_name = json_data.get("profile_name")
        target_allocation = json_data.get(
            "target_allocation", {"stocks": 0.6, "bonds": 0.4, "cash": 0.0}
        )

        if not profile_name:
            enhanced_audit_logger.log(
                action="ANALYZE_REBALANCE_VALIDATION_ERROR",
                details={"error": "profile_name is required"},
                status_code=400,
            )
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            enhanced_audit_logger.log(
                action="ANALYZE_REBALANCE_PROFILE_NOT_FOUND",
                details={"profile_name": profile_name},
                status_code=404,
            )
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        assets = profile_data.get("assets", {})

        service = RebalancingService(assets)
        results = service.suggest_rebalancing(target_allocation)
        results["profile_name"] = profile_name

        enhanced_audit_logger.log(
            action="ANALYZE_REBALANCING",
            table_name="profile",
            record_id=profile.id,
            details={
                "profile_name": profile_name,
                "target_allocation": target_allocation,
            },
            status_code=200,
        )
        return jsonify(results), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action="ANALYZE_REBALANCE_ERROR",
            details={
                "profile_name": profile_name if "profile_name" in dir() else None,
                "error": str(e),
            },
            status_code=500,
        )
        return jsonify({"error": "An internal error occurred"}), 500


@analysis_bp.route("/analysis/calculation-report", methods=["POST"])
@login_required
def get_calculation_report():
    """Generate detailed calculation report showing all income, expenses, taxes, and portfolio calculations."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None
    import logging
    logger = logging.getLogger(__name__)

    # Quick version check - return immediately if version check requested
    if json_data.get("version_check"):
        return jsonify({"version": __version__, "status": "ok"}), 200

    # TEMPORARY: Return minimal hardcoded response to test endpoint (testing only)
    if json_data.get("minimal_test"):
        from flask import current_app
        if not (current_app.config.get("TESTING") or current_app.config.get("DEBUG")):
            return jsonify({"error": "minimal_test is only available in testing"}), 400
        return jsonify({
            "profile_name": "Test",
            "generated_at": datetime.now().isoformat(),
            "sections": [
                {
                    "title": "Test Section",
                    "items": [
                        {"label": "Status", "value": "Endpoint is working"}
                    ]
                }
            ]
        }), 200

    try:
        profile_name = json_data.get("profile_name")

        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        # Wrap data access in try-except
        try:
            profile_data = profile.data_dict

            # Debug: log the structure we're receiving
            logger.info(f"Profile data type: {type(profile_data)}")
            logger.info(f"Profile data keys: {list(profile_data.keys()) if isinstance(profile_data, dict) else 'NOT A DICT'}")

            # Ensure profile_data is a dict
            if not isinstance(profile_data, dict):
                logger.error(f"profile_data is not a dict! Type: {type(profile_data)}, Value: {profile_data}")
                return jsonify({"error": "Invalid profile data structure"}), 500

            # Profile data comes back as {"data": {...}} from to_dict()
            # But data_dict returns the actual data content
            # So we should access fields directly from profile_data, not profile_data["data"]
            person_data = profile_data.get("person", {})
            spouse_data = profile_data.get("spouse", {})
            financial_data = profile_data.get("financial", {})
            budget_data = profile_data.get("budget", {})
            income_streams = profile_data.get("income_streams", [])
            assets_data = profile_data.get("assets", {})
            children_data = profile_data.get("children") or []
            tax_settings = profile_data.get("tax_settings", {})
            address_data = profile_data.get("address", {})
            has_spouse_for_filing = bool(spouse_data.get("birth_date") or spouse_data.get("name") or spouse_data.get("social_security_benefit"))
            default_filing = "mfj" if has_spouse_for_filing else "single"
            tax_year = int(tax_settings.get("tax_year") or CURRENT_TAX_YEAR)
            contrib_limits = TaxEngine.get_contribution_limits(tax_year)

            logger.info(f"Income streams type: {type(income_streams)}, count: {len(income_streams) if isinstance(income_streams, list) else 'NOT A LIST'}")
            logger.info(f"Assets data type: {type(assets_data)}")

        except Exception as e:
            logger.error(f"Error accessing profile data: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({"error": "Error accessing profile data"}), 500

        # Build report sections
        report = {
            "profile_name": profile.name,
            "generated_at": datetime.now().isoformat(),
            "sections": []
        }

        # Wrap each section in try-except to isolate errors
        def add_section_safely(section_builder, section_name):
            try:
                section = section_builder()
                if section:
                    report["sections"].append(section)
            except Exception as e:
                logger.error(f"Error building {section_name}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                report["sections"].append({
                    "title": f"⚠️ {section_name} (Error)",
                    "items": [{"label": "Error", "value": str(e)}]
                })

        # Calculate ages (used by multiple sections)
        try:
            current_age = 40  # default
            retirement_age = 65  # default
            spouse_age = 40  # default

            if profile.birth_date:
                try:
                    birth_dt = datetime.fromisoformat(str(profile.birth_date))
                    current_age = int((datetime.now() - birth_dt).days // 365)
                except Exception as e:
                    logger.error(f"Error calculating current_age from {profile.birth_date}: {e}")
                    current_age = 40

            if profile.retirement_date and profile.birth_date:
                try:
                    birth_dt = datetime.fromisoformat(str(profile.birth_date))
                    retirement_dt = datetime.fromisoformat(str(profile.retirement_date))
                    retirement_age = int((retirement_dt - birth_dt).days // 365)
                except Exception as e:
                    logger.error(f"Error calculating retirement_age: {e}")
                    retirement_age = 65

            if spouse_data.get("name") and spouse_data.get("birth_date"):
                try:
                    spouse_birth_dt = datetime.fromisoformat(str(spouse_data["birth_date"]))
                    spouse_age = int((datetime.now() - spouse_birth_dt).days // 365)
                except Exception as e:
                    logger.error(f"Error calculating spouse_age: {e}")
                    spouse_age = 40

            # Ensure these are integers, not lists
            current_age = int(current_age) if not isinstance(current_age, list) else 40
            retirement_age = int(retirement_age) if not isinstance(retirement_age, list) else 65
            spouse_age = int(spouse_age) if not isinstance(spouse_age, list) else 40

        except Exception as e:
            logger.error(f"Fatal error in age calculations: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Set safe defaults
            current_age = 40
            retirement_age = 65
            spouse_age = 40

        # 1. PROFILE SUMMARY
        def build_profile_summary():
            section = {
                "title": "Profile Summary",
                "items": [
                    {"label": "Primary Person", "value": profile.name},
                    {"label": "Current Age", "value": f"{current_age} years"},
                    {"label": "Retirement Age", "value": f"{retirement_age} years"},
                    {"label": "Years to Retirement", "value": f"{max(0, retirement_age - current_age)} years"},
                ]
            }

            if spouse_data.get("name"):
                section["items"].extend([
                    {"label": "Spouse", "value": spouse_data.get("name")},
                    {"label": "Spouse Age", "value": f"{spouse_age} years"},
                ])

            return section

        add_section_safely(build_profile_summary, "Profile Summary")

        # 2. INCOME SOURCES (Annual) - Read from income_streams
        income_section = {
            "title": "Annual Income Sources",
            "items": [],
            "total": 0
        }

        # Calculate current active income from income_streams
        # For now, include ALL income streams (skip date filtering to avoid errors)
        work_income_annual = 0
        employment_income_annual = 0  # Track employment-only income for FICA

        logger.info(f"Income streams count: {len(income_streams)}")

        # Infer stream owner from name when not explicitly set
        spouse_first_name = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""

        def _infer_owner(stream):
            """Determine stream owner: explicit owner > name-based inference > default primary."""
            if stream.get("owner"):
                return stream["owner"]
            if spouse_first_name:
                stream_name = (stream.get("name") or "").lower()
                if spouse_first_name in stream_name:
                    return "spouse"
            return "primary"

        for stream in income_streams:
            raw_amount = stream.get("amount", 0)
            freq = stream.get("frequency", "monthly").lower()
            if freq == "monthly":
                amount_annual = raw_amount * 12
            elif freq == "weekly":
                amount_annual = raw_amount * 52
            elif freq == "biweekly":
                amount_annual = raw_amount * 26
            elif freq == "quarterly":
                amount_annual = raw_amount * 4
            else:
                amount_annual = raw_amount
            work_income_annual += amount_annual

            # Track employment income separately for FICA
            if stream.get("source") in ("employment",) or stream.get("type") in (
                "salary", "hourly", "wages", "bonus",
            ):
                employment_income_annual += amount_annual

            owner = _infer_owner(stream)
            label = f"{stream.get('name', 'Income')} ({owner.title()})"
            income_section["items"].append({
                "label": label,
                "value": f"${amount_annual:,.0f}",
                "amount": amount_annual
            })

        # Social Security (if eligible)
        p1_ss_annual = 0
        p2_ss_annual = 0
        p1_claiming_age = financial_data.get("ss_claiming_age") or person_data.get("ss_claiming_age", 67)

        # Ensure claiming age is an integer
        try:
            p1_claiming_age = int(p1_claiming_age) if p1_claiming_age else 67
        except (ValueError, TypeError):
            p1_claiming_age = 67

        if current_age >= p1_claiming_age:
            p1_ss_annual = (financial_data.get("social_security_benefit") or person_data.get("social_security_benefit", 0) or 0) * 12
            if p1_ss_annual > 0:
                income_section["items"].append({
                    "label": "Social Security (Primary)",
                    "value": f"${p1_ss_annual:,.0f}",
                    "amount": p1_ss_annual
                })

        if spouse_data.get("name"):
            # Use the spouse_age we already calculated above, don't re-read from data
            p2_claiming_age = spouse_data.get("ss_claiming_age", 67)

            # Ensure claiming age is an integer
            try:
                p2_claiming_age = int(p2_claiming_age) if p2_claiming_age else 67
            except (ValueError, TypeError):
                p2_claiming_age = 67

            if spouse_age >= p2_claiming_age:
                p2_ss_annual = (spouse_data.get("social_security_benefit", 0) or 0) * 12
                if p2_ss_annual > 0:
                    income_section["items"].append({
                        "label": "Social Security (Spouse)",
                        "value": f"${p2_ss_annual:,.0f}",
                        "amount": p2_ss_annual
                    })

        # Pension (if retired)
        pension_annual = 0
        if current_age >= retirement_age:
            pension_annual = (financial_data.get("pension_benefit") or person_data.get("pension_benefit", 0) or 0) * 12
            if pension_annual > 0:
                income_section["items"].append({
                    "label": "Pension Income",
                    "value": f"${pension_annual:,.0f}",
                    "amount": pension_annual
                })

        total_income_annual = work_income_annual + p1_ss_annual + p2_ss_annual + pension_annual
        income_section["total"] = total_income_annual
        income_section["items"].append({
            "label": "TOTAL INCOME",
            "value": f"${total_income_annual:,.0f}",
            "amount": total_income_annual,
            "is_total": True
        })
        report["sections"].append(income_section)

        # 3. RETIREMENT CONTRIBUTIONS (Annual)
        contributions_section = {
            "title": "Retirement Contributions (Pre-Tax)",
            "items": [],
            "total": 0
        }

        # 401k Contributions - Calculate from actual income streams
        contrib_rate_p1 = float(financial_data.get("annual_401k_contribution_rate") or person_data.get("annual_401k_contribution_rate", 0) or 0)
        match_rate_p1 = float(financial_data.get("employer_match_rate") or person_data.get("employer_match_rate", 0) or 0)

        if current_age < retirement_age:
            # Calculate primary person's salary from income streams
            primary_salary = 0
            spouse_salary = 0

            for stream in income_streams:
                # Only count employment income for 401k base salary
                if stream.get("source") not in ("employment",) and stream.get("type") not in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    continue
                amount_annual = stream.get("amount", 0) * 12
                owner = _infer_owner(stream)
                if owner == "primary":
                    primary_salary += amount_annual
                elif owner == "spouse":
                    spouse_salary += amount_annual

            # Primary 401k - apply IRS limits (including SECURE 2.0 super-catchup 60-63)
            p1_401k_limit = contrib_limits["401k_base"]
            if current_age >= contrib_limits["catchup_age"]:
                super_catchup = contrib_limits.get("401k_super_catchup", 0)
                super_min = int(contrib_limits.get("super_catchup_age_min", 999))
                super_max = int(contrib_limits.get("super_catchup_age_max", -1))
                if super_catchup > 0 and super_min <= current_age <= super_max:
                    p1_401k_limit += super_catchup
                else:
                    p1_401k_limit += contrib_limits["401k_catchup"]
            p1_401k_raw = primary_salary * contrib_rate_p1
            p1_401k = min(p1_401k_raw, p1_401k_limit)

            p1_match = primary_salary * match_rate_p1
            # Cap total (employee + employer) at Section 415(c)
            p1_415c_limit = contrib_limits["section_415c"]
            if current_age >= contrib_limits["catchup_age"]:
                p1_415c_limit = contrib_limits["section_415c_catchup"]
            p1_match = min(p1_match, max(0, p1_415c_limit - p1_401k))

            if p1_401k > 0:
                label = "401k Employee Contribution (Primary)"
                if p1_401k_raw > p1_401k:
                    label += f" (capped from ${p1_401k_raw:,.0f})"
                contributions_section["items"].append({
                    "label": label,
                    "value": f"${p1_401k:,.0f}",
                    "amount": p1_401k
                })
            if p1_match > 0:
                contributions_section["items"].append({
                    "label": "401k Employer Match (Primary)",
                    "value": f"${p1_match:,.0f}",
                    "amount": p1_match,
                    "note": "Free money!"
                })

            # Spouse 401k - apply IRS limits
            contrib_rate_p2 = float(spouse_data.get("annual_401k_contribution_rate", 0) or 0)
            match_rate_p2 = float(spouse_data.get("employer_match_rate", 0) or 0)
            if spouse_data.get("name") and spouse_salary > 0:
                p2_401k_limit = contrib_limits["401k_base"]
                if spouse_age >= contrib_limits["catchup_age"]:
                    super_catchup = contrib_limits.get("401k_super_catchup", 0)
                    super_min = int(contrib_limits.get("super_catchup_age_min", 999))
                    super_max = int(contrib_limits.get("super_catchup_age_max", -1))
                    if super_catchup > 0 and super_min <= spouse_age <= super_max:
                        p2_401k_limit += super_catchup
                    else:
                        p2_401k_limit += contrib_limits["401k_catchup"]
                p2_401k_raw = spouse_salary * contrib_rate_p2
                p2_401k = min(p2_401k_raw, p2_401k_limit)

                p2_match = spouse_salary * match_rate_p2
                # Cap total at Section 415(c)
                p2_415c_limit = contrib_limits["section_415c"]
                if spouse_age >= contrib_limits["catchup_age"]:
                    p2_415c_limit = contrib_limits["section_415c_catchup"]
                p2_match = min(p2_match, max(0, p2_415c_limit - p2_401k))

                if p2_401k > 0:
                    label = "401k Employee Contribution (Spouse)"
                    if p2_401k_raw > p2_401k:
                        label += f" (capped from ${p2_401k_raw:,.0f})"
                    contributions_section["items"].append({
                        "label": label,
                        "value": f"${p2_401k:,.0f}",
                        "amount": p2_401k
                    })
                if p2_match > 0:
                    contributions_section["items"].append({
                        "label": "401k Employer Match (Spouse)",
                        "value": f"${p2_match:,.0f}",
                        "amount": p2_match,
                        "note": "Free money!"
                    })

        # IRA Contributions - apply IRS limits
        ira_annual = financial_data.get("annual_ira_contribution", 0) or 0
        if ira_annual > 0 and current_age < retirement_age:
            ira_limit = contrib_limits["ira_base"]
            if max(current_age, spouse_age) >= contrib_limits["catchup_age"]:
                ira_limit += contrib_limits["ira_catchup"]
            # MFJ with both working gets double IRA limit (must match simulation logic)
            filing_status_ira = tax_settings.get("filing_status") or financial_data.get("filing_status") or default_filing
            spouse_is_working = False
            if spouse_data.get("name") and spouse_data.get("retirement_date"):
                try:
                    sp_retire_dt = datetime.fromisoformat(str(spouse_data["retirement_date"]))
                    sp_birth_dt = datetime.fromisoformat(str(spouse_data["birth_date"]))
                    sp_retire_age = int((sp_retire_dt - sp_birth_dt).days // 365)
                    spouse_is_working = spouse_age < sp_retire_age
                except Exception:
                    spouse_is_working = spouse_age < retirement_age
            elif spouse_data.get("name"):
                spouse_is_working = spouse_age < retirement_age
            if spouse_is_working and filing_status_ira == "mfj":
                ira_limit *= 2
            ira_capped = min(ira_annual, ira_limit)
            label = "IRA Contribution"
            if ira_annual > ira_capped:
                label += f" (capped from ${ira_annual:,.0f})"
            contributions_section["items"].append({
                "label": label,
                "value": f"${ira_capped:,.0f}",
                "amount": ira_capped,
                "note": "Post-tax contribution"
            })

        total_contributions = sum(item["amount"] for item in contributions_section["items"])
        contributions_section["total"] = total_contributions
        if total_contributions > 0:
            contributions_section["items"].append({
                "label": "TOTAL CONTRIBUTIONS",
                "value": f"${total_contributions:,.0f}",
                "amount": total_contributions,
                "is_total": True
            })
            report["sections"].append(contributions_section)

        # 4. EXPENSES (Annual)
        expenses_section = {
            "title": "Annual Expenses",
            "items": [],
            "total": 0
        }

        # Calculate from budget
        if budget_data.get("expenses"):
            current_expenses = budget_data["expenses"].get("current", {})
            # Known display names for common categories
            category_labels = {
                "housing": "Housing",
                "utilities": "Utilities",
                "transportation": "Transportation",
                "food": "Food/Groceries",
                "dining_out": "Dining Out",
                "healthcare": "Healthcare",
                "insurance": "Insurance",
                "travel": "Travel/Vacation",
                "entertainment": "Entertainment",
                "personal_care": "Personal Care",
                "personal": "Personal",
                "clothing": "Clothing",
                "gifts": "Gifts/Donations",
                "childcare_education": "Childcare/Education",
                "childcare": "Childcare",
                "education": "Education",
                "charitable_giving": "Charitable Giving",
                "subscriptions": "Subscriptions",
                "pet_care": "Pet Care",
                "home_maintenance": "Home Maintenance",
                "debt_payments": "Debt Payments",
                "discretionary": "Discretionary",
                "other": "Other",
            }
            # Use actual keys from budget data, preserving order of known categories
            # then appending any unknown categories
            seen_keys = set()
            expense_categories = []
            for key in category_labels:
                if key in current_expenses:
                    expense_categories.append((key, category_labels[key]))
                    seen_keys.add(key)
            for key in current_expenses:
                if key not in seen_keys:
                    expense_categories.append((key, key.replace("_", " ").title()))

            total_expenses_annual = 0
            for key, label in expense_categories:
                amount_monthly = current_expenses.get(key, 0)

                # Handle case where expense value might be a list (of dicts or numbers)
                if isinstance(amount_monthly, list):
                    total = 0
                    for item in amount_monthly:
                        if isinstance(item, dict):
                            total += float(item.get("amount", 0) or 0)
                        elif isinstance(item, (int, float)):
                            total += float(item)
                    amount_monthly = total
                elif isinstance(amount_monthly, dict):
                    amount_monthly = float(amount_monthly.get("amount", 0) or 0)

                # Ensure it's a number
                try:
                    amount_monthly = float(amount_monthly) if amount_monthly else 0
                except (ValueError, TypeError):
                    amount_monthly = 0

                amount_annual = amount_monthly * 12
                if amount_annual > 0:
                    expenses_section["items"].append({
                        "label": label,
                        "value": f"${amount_annual:,.0f}",
                        "amount": amount_annual
                    })
                    total_expenses_annual += amount_annual

            expenses_section["total"] = total_expenses_annual
            expenses_section["items"].append({
                "label": "TOTAL LIVING EXPENSES",
                "value": f"${total_expenses_annual:,.0f}",
                "amount": total_expenses_annual,
                "is_total": True
            })

        report["sections"].append(expenses_section)

        # 5. TAX CALCULATIONS (Annual)
        tax_section = {
            "title": "Estimated Annual Taxes",
            "items": [],
            "total": 0,
            "note": "Simplified calculation - actual taxes may vary"
        }

        # Calculate taxable income
        # Calculate taxable SS using IRS provisional income formula
        total_ss = p1_ss_annual + p2_ss_annual
        other_income = total_income_annual - total_ss  # income excluding SS
        provisional_income = other_income + (total_ss * 0.5)
        tax_settings = profile_data.get("tax_settings", {})
        has_spouse_for_filing = bool(spouse_data.get("birth_date") or spouse_data.get("name") or spouse_data.get("social_security_benefit"))
        default_filing = "mfj" if has_spouse_for_filing else "single"
        filing_status = tax_settings.get("filing_status") or financial_data.get("filing_status") or default_filing
        _ss_thresholds = get_tax_policy(tax_year).ss_taxability
        _fs_key = filing_status if filing_status in _ss_thresholds else ("mfj" if filing_status in ("mfj", "mqw") else "single")
        threshold1, threshold2 = _ss_thresholds[_fs_key]

        if provisional_income <= threshold1:
            taxable_ss = 0
        elif provisional_income <= threshold2:
            taxable_ss = min(total_ss * 0.5, (provisional_income - threshold1) * 0.5)
        else:
            taxable_ss = min(total_ss * 0.85,
                             (provisional_income - threshold2) * 0.85 + min(total_ss * 0.5, (threshold2 - threshold1) * 0.5))
        ordinary_income = work_income_annual + pension_annual + taxable_ss

        # Apply 401k deductions
        ordinary_income_after_401k = ordinary_income - sum(
            item["amount"] for item in contributions_section.get("items", [])
            if "Employee Contribution" in item["label"]
        )

        # Standard deduction (with 65+ additional) - from tax policy (year-correct)
        std_deduction = TaxEngine.calculate_standard_deduction(
            tax_year, filing_status, p1_age=current_age, p2_age=spouse_age
        )
        taxable_income = max(0, ordinary_income_after_401k - std_deduction)

        tax_section["items"].append({
            "label": "Gross Ordinary Income",
            "value": f"${ordinary_income:,.0f}",
            "amount": ordinary_income
        })
        tax_section["items"].append({
            "label": "Less: 401k Contributions",
            "value": f"$({sum(item['amount'] for item in contributions_section.get('items', []) if 'Employee Contribution' in item['label']):,.0f})",
            "amount": 0
        })
        tax_section["items"].append({
            "label": "Less: Standard Deduction",
            "value": f"$({std_deduction:,.0f})",
            "amount": 0
        })
        tax_section["items"].append({
            "label": "Taxable Income",
            "value": f"${taxable_income:,.0f}",
            "amount": taxable_income
        })

        # Federal Tax (progressive brackets)
        federal_tax = TaxEngine.calculate_federal_tax(taxable_income, tax_year, filing_status)
        effective_rate = (federal_tax / taxable_income * 100) if taxable_income > 0 else 0
        tax_section["items"].append({
            "label": f"Federal Income Tax ({effective_rate:.1f}% effective)",
            "value": f"${federal_tax:,.0f}",
            "amount": federal_tax
        })

        # State Tax - use profile state if available, then tax_settings override
        _profile_state = address_data.get("state") or tax_settings.get("state") or "NY"
        _explicit_state_rate = tax_settings.get("tax_bracket_state") or financial_data.get("tax_bracket_state")
        if _explicit_state_rate:
            state_rate = float(_explicit_state_rate)
        else:
            state_rate = TaxEngine.get_state_tax_rate(_profile_state)
        state_tax = taxable_income * state_rate
        tax_section["items"].append({
            "label": f"State Income Tax ({state_rate*100:.2g}% rate, {_profile_state})",
            "value": f"${state_tax:,.0f}",
            "amount": state_tax
        })

        # FICA (on employment income only, if under retirement) - use tax policy for wage base
        fica_tax = 0
        if current_age < retirement_age and employment_income_annual > 0:
            _fica_policy = get_tax_policy(tax_year).fica
            ss_wage_base = _fica_policy["ss_wage_base"]
            ss_tax = min(employment_income_annual, ss_wage_base) * _fica_policy["ss_rate"]
            medicare_tax = employment_income_annual * _fica_policy["medicare_rate"]
            # Additional Medicare tax: 0.9% on employment income over $200K (single) / $250K (MFJ)
            additional_medicare_threshold = 250000 if filing_status in ("mfj", "mqw") else 200000
            additional_medicare = max(0, employment_income_annual - additional_medicare_threshold) * 0.009
            fica_tax = ss_tax + medicare_tax + additional_medicare
            fica_rate = (fica_tax / employment_income_annual * 100) if employment_income_annual > 0 else 0
            tax_section["items"].append({
                "label": f"FICA Tax ({fica_rate:.1f}% effective on employment income)",
                "value": f"${fica_tax:,.0f}",
                "amount": fica_tax
            })

        total_tax = federal_tax + state_tax + fica_tax
        tax_section["total"] = total_tax
        tax_section["items"].append({
            "label": "TOTAL TAXES",
            "value": f"${total_tax:,.0f}",
            "amount": total_tax,
            "is_total": True
        })

        report["sections"].append(tax_section)

        # 6. NET CASH FLOW
        net_section = {
            "title": "Annual Net Cash Flow",
            "items": []
        }

        gross_income = total_income_annual
        employee_contributions = sum(
            item["amount"] for item in contributions_section.get("items", [])
            if "Employee Contribution" in item["label"]
        )
        ira_contrib = sum(
            item["amount"] for item in contributions_section.get("items", [])
            if "IRA" in item["label"]
        )
        living_expenses = expenses_section["total"]
        taxes = total_tax

        net_section["items"].append({
            "label": "Gross Income",
            "value": f"${gross_income:,.0f}",
            "amount": gross_income
        })
        net_section["items"].append({
            "label": "Less: 401k Contributions",
            "value": f"$({employee_contributions:,.0f})",
            "amount": -employee_contributions
        })
        net_section["items"].append({
            "label": "Less: IRA Contributions",
            "value": f"$({ira_contrib:,.0f})",
            "amount": -ira_contrib
        })
        net_section["items"].append({
            "label": "Less: Taxes",
            "value": f"$({taxes:,.0f})",
            "amount": -taxes
        })
        net_section["items"].append({
            "label": "Less: Living Expenses",
            "value": f"$({living_expenses:,.0f})",
            "amount": -living_expenses
        })

        net_cash_flow = gross_income - employee_contributions - ira_contrib - taxes - living_expenses
        net_section["items"].append({
            "label": "NET CASH FLOW",
            "value": f"${net_cash_flow:,.0f}",
            "amount": net_cash_flow,
            "is_total": True,
            "color": "positive" if net_cash_flow > 0 else "negative"
        })

        # Portfolio additions
        employer_match = sum(
            item["amount"] for item in contributions_section.get("items", [])
            if "Employer Match" in item["label"]
        )
        total_to_portfolio = net_cash_flow + employee_contributions + ira_contrib + employer_match

        net_section["items"].append({
            "label": "Add: 401k Employee Contributions",
            "value": f"${employee_contributions:,.0f}",
            "amount": employee_contributions
        })
        net_section["items"].append({
            "label": "Add: 401k Employer Match",
            "value": f"${employer_match:,.0f}",
            "amount": employer_match
        })
        net_section["items"].append({
            "label": "Add: IRA Contributions",
            "value": f"${ira_contrib:,.0f}",
            "amount": ira_contrib
        })
        net_section["items"].append({
            "label": "TOTAL PORTFOLIO ADDITION",
            "value": f"${total_to_portfolio:,.0f}",
            "amount": total_to_portfolio,
            "is_total": True,
            "color": "positive"
        })

        report["sections"].append(net_section)

        # 7. PORTFOLIO SUMMARY
        portfolio_section = {
            "title": "Current Portfolio",
            "items": []
        }

        # Retirement accounts
        retirement_total = 0
        for account in assets_data.get("retirement_accounts", []):
            if isinstance(account, dict):
                retirement_total += float(account.get("value", 0) or account.get("current_value", 0) or 0)
        if retirement_total > 0:
            portfolio_section["items"].append({
                "label": "Retirement Accounts (401k, IRA)",
                "value": f"${retirement_total:,.0f}",
                "amount": retirement_total
            })

        # Taxable accounts
        taxable_total = 0
        for account in assets_data.get("taxable_accounts", []):
            if isinstance(account, dict):
                taxable_total += float(account.get("value", 0) or account.get("current_value", 0) or 0)
        if taxable_total > 0:
            portfolio_section["items"].append({
                "label": "Taxable Brokerage Accounts",
                "value": f"${taxable_total:,.0f}",
                "amount": taxable_total
            })

        # Real estate (equity)
        real_estate_total = 0
        for prop in assets_data.get("real_estate", []):
            if isinstance(prop, dict):
                val = float(prop.get("value", 0) or prop.get("current_value", 0) or 0)
                mortgage = float(prop.get("mortgage_balance") or prop.get("mortgage", 0) or 0)
                real_estate_total += val - mortgage
        if real_estate_total > 0:
            portfolio_section["items"].append({
                "label": "Real Estate Equity",
                "value": f"${real_estate_total:,.0f}",
                "amount": real_estate_total
            })

        # Other assets
        other_total = 0
        for asset in assets_data.get("other_assets", []):
            if isinstance(asset, dict):
                other_total += float(asset.get("value", 0) or asset.get("current_value", 0) or 0)
        if other_total > 0:
            portfolio_section["items"].append({
                "label": "Other Assets",
                "value": f"${other_total:,.0f}",
                "amount": other_total
            })

        total_portfolio = retirement_total + taxable_total + real_estate_total + other_total
        portfolio_section["items"].append({
            "label": "TOTAL PORTFOLIO VALUE",
            "value": f"${total_portfolio:,.0f}",
            "amount": total_portfolio,
            "is_total": True
        })

        if len(portfolio_section["items"]) > 0:
            report["sections"].append(portfolio_section)

        # 8. PORTFOLIO PROJECTION ATTRIBUTION (Deterministic)
        try:
            investment_types = transform_assets_to_investment_types(assets_data)
            management_fee_drag = compute_management_fee_drag(investment_types)

            liquid_assets = sum(
                float(a.get("value", 0) or 0)
                for a in assets_data.get("taxable_accounts", [])
                if isinstance(a, dict)
            )
            traditional_ira = sum(
                float(a.get("value", 0) or 0)
                for a in assets_data.get("retirement_accounts", [])
                if isinstance(a, dict)
                and (
                    "traditional" in a.get("type", "").lower()
                    or "401" in a.get("type", "").lower()
                    or "403" in a.get("type", "").lower()
                    or "457" in a.get("type", "").lower()
                )
            )
            roth_ira = sum(
                float(a.get("value", 0) or 0)
                for a in assets_data.get("retirement_accounts", [])
                if isinstance(a, dict) and "roth" in a.get("type", "").lower()
            )

            birth_date_str = person_data.get("birth_date") or (
                profile.birth_date if hasattr(profile, "birth_date") and profile.birth_date else "1980-01-01"
            )
            retirement_date_str = person_data.get("retirement_date") or (
                profile.retirement_date if hasattr(profile, "retirement_date") and profile.retirement_date else "2045-01-01"
            )

            p1 = Person(
                name=person_data.get("name") or profile.name or "Primary",
                birth_date=datetime.fromisoformat(str(birth_date_str)) if birth_date_str else datetime(1980, 1, 1),
                retirement_date=datetime.fromisoformat(str(retirement_date_str)) if retirement_date_str else datetime(2045, 1, 1),
                social_security=financial_data.get("social_security_benefit") or person_data.get("social_security_benefit", 0) or 0,
                ss_claiming_age=financial_data.get("ss_claiming_age") or person_data.get("ss_claiming_age", 67) or 67,
                annual_401k_contribution_rate=financial_data.get("annual_401k_contribution_rate") or person_data.get("annual_401k_contribution_rate") or 0,
                employer_match_rate=financial_data.get("employer_match_rate") or person_data.get("employer_match_rate") or 0,
            )

            spouse_birth = spouse_data.get("birth_date") or "1980-01-01"
            spouse_retire = spouse_data.get("retirement_date") or (
                profile.retirement_date if hasattr(profile, "retirement_date") and profile.retirement_date else "2045-01-01"
            )
            p2 = Person(
                name=spouse_data.get("name", "Spouse"),
                birth_date=datetime.fromisoformat(str(spouse_birth)) if spouse_birth else datetime(1980, 1, 1),
                retirement_date=datetime.fromisoformat(str(spouse_retire)) if spouse_retire else datetime(2045, 1, 1),
                social_security=spouse_data.get("social_security_benefit") or 0,
                ss_claiming_age=spouse_data.get("ss_claiming_age") or 67,
                annual_401k_contribution_rate=spouse_data.get("annual_401k_contribution_rate") or 0,
                employer_match_rate=spouse_data.get("employer_match_rate") or 0,
            )

            projection_budget_data, mc_income_streams = _prepare_budget_and_income_streams(
                {"budget": budget_data, "income_streams": income_streams},
                spouse_data,
            )

            has_spouse_for_projection = bool(
                spouse_data.get("birth_date")
                or spouse_data.get("name")
                or spouse_data.get("social_security_benefit")
            )
            filing_status_projection = tax_settings.get("filing_status") or ("mfj" if has_spouse_for_projection else "single")
            state_projection = tax_settings.get("state") or address_data.get("state") or "NY"

            annual_expenses_for_projection = float(financial_data.get("annual_expenses") or expenses_section.get("total", 0) or 0)
            annual_income_for_projection = float(financial_data.get("annual_income") or total_income_annual or 0)
            pension_benefit_monthly = float(financial_data.get("pension_benefit") or person_data.get("pension_benefit", 0) or 0)

            financial_profile = FinancialProfile(
                person1=p1,
                person2=p2,
                children=children_data,
                liquid_assets=float(liquid_assets or financial_data.get("liquid_assets") or 0),
                traditional_ira=float(traditional_ira or financial_data.get("retirement_assets") or 0),
                roth_ira=float(roth_ira or 0),
                pension_lump_sum=0,
                pension_annual=pension_benefit_monthly * 12,
                annual_expenses=annual_expenses_for_projection,
                target_annual_income=annual_income_for_projection,
                risk_tolerance="moderate",
                asset_allocation={"stocks": 0.6, "bonds": 0.4},
                future_expenses=[],
                investment_types=investment_types,
                accounts=[],
                income_streams=mc_income_streams,
                home_properties=profile_data.get("home_properties", []),
                budget=projection_budget_data if projection_budget_data else None,
                annual_ira_contribution=float(financial_data.get("annual_ira_contribution", 0) or 0),
                ira_roth_split=float(financial_data.get("ira_roth_split", 0.5) or 0.5),
                savings_allocation=profile_data.get("savings_allocation"),
                filing_status=filing_status_projection,
                state=state_projection,
                tax_year=tax_year,
            )

            projection_model = RetirementModel(financial_profile)
            p1_life_exp = int(person_data.get("life_expectancy", 90) or 90)
            years = projection_model.calculate_life_expectancy_years(p1, target_age=p1_life_exp)
            if has_spouse_for_projection:
                p2_life_exp = int(spouse_data.get("life_expectancy", 90) or 90)
                years = max(years, projection_model.calculate_life_expectancy_years(p2, target_age=p2_life_exp))
            years = max(1, int(years))

            detailed_ledger = projection_model.run_detailed_projection(
                years=years,
                assumptions=MarketAssumptions(stock_allocation=0.60),
                spending_model="constant_real",
                management_fee_drag=management_fee_drag,
            )

            yearly_rollup = {}
            for row in detailed_ledger:
                year = int(row.get("year", datetime.now().year))
                if year not in yearly_rollup:
                    yearly_rollup[year] = {
                        "year": year,
                        "income": 0.0,
                        "expenses": 0.0,
                        "taxes": 0.0,
                        "withdrawals": 0.0,
                        "end_balance": 0.0,
                    }
                yearly_rollup[year]["income"] += float(row.get("gross_income", 0) or 0)
                yearly_rollup[year]["expenses"] += float(row.get("expenses_excluding_tax", 0) or 0)
                yearly_rollup[year]["taxes"] += (
                    float(row.get("federal_tax", 0) or 0)
                    + float(row.get("state_tax", 0) or 0)
                    + float(row.get("fica_tax", 0) or 0)
                    + float(row.get("ltcg_tax", 0) or 0)
                )
                yearly_rollup[year]["withdrawals"] += float(row.get("withdrawals", 0) or 0)
                yearly_rollup[year]["end_balance"] = float(row.get("portfolio_balance", 0) or 0)

            yearly_rows = [yearly_rollup[y] for y in sorted(yearly_rollup.keys())]
            starting_investable_portfolio = sum(float(i.get("value", 0) or 0) for i in investment_types)
            previous_end = starting_investable_portfolio
            for row in yearly_rows:
                row["start_balance"] = previous_end
                row["net_external_flow"] = row["income"] - row["withdrawals"] - row["expenses"] - row["taxes"]
                row["portfolio_delta"] = row["end_balance"] - row["start_balance"]
                row["implied_growth"] = row["portfolio_delta"] - row["net_external_flow"]
                previous_end = row["end_balance"]

            projection_section = {
                "title": "Portfolio Projection Attribution",
                "note": (
                    "Deterministic projection using current profile assumptions. "
                    "Formula by year: End = Start + Net External Flow + Implied Growth."
                ),
                "items": [],
            }
            if yearly_rows:
                ending_balance = yearly_rows[-1]["end_balance"]
                total_years = max(1, len(yearly_rows))
                cagr = ((ending_balance / starting_investable_portfolio) ** (1 / total_years) - 1) if starting_investable_portfolio > 0 else 0.0

                projection_section["items"].extend([
                    {"label": "Starting Investable Portfolio", "value": f"${starting_investable_portfolio:,.0f}", "amount": starting_investable_portfolio},
                    {"label": f"Ending Portfolio ({yearly_rows[-1]['year']})", "value": f"${ending_balance:,.0f}", "amount": ending_balance, "is_total": True},
                    {"label": "Implied CAGR", "value": f"{cagr * 100:.2f}%", "amount": cagr * 100},
                ])

                year_2094 = next((row for row in yearly_rows if row["year"] == 2094), None)
                if year_2094:
                    projection_section["items"].append({
                        "label": "Projected Portfolio in 2094",
                        "value": f"${year_2094['end_balance']:,.0f}",
                        "amount": year_2094["end_balance"],
                        "is_total": True,
                    })

                checkpoint_years = set()
                for idx, row in enumerate(yearly_rows):
                    if idx < 5 or idx == len(yearly_rows) - 1 or row["year"] == 2094 or row["year"] % 10 == 0:
                        checkpoint_years.add(row["year"])

                for row in yearly_rows:
                    if row["year"] in checkpoint_years:
                        projection_section["items"].append({
                            "label": (
                                f"{row['year']}: ${row['start_balance']:,.0f} + "
                                f"${row['net_external_flow']:,.0f} + ${row['implied_growth']:,.0f}"
                            ),
                            "value": f"${row['end_balance']:,.0f}",
                            "amount": row["end_balance"],
                        })

                report["projection_yearly"] = yearly_rows
                report["sections"].append(projection_section)
        except Exception as projection_error:
            logger.error(f"Error building Portfolio Projection Attribution section: {projection_error}", exc_info=True)
            report["sections"].append({
                "title": "⚠️ Portfolio Projection Attribution (Error)",
                "items": [{"label": "Error", "value": str(projection_error)}],
            })

        enhanced_audit_logger.log(
            action="GENERATE_CALCULATION_REPORT",
            table_name="profile",
            record_id=profile.id,
            details={"profile_name": profile_name},
            status_code=200,
        )

        return jsonify(report), 200

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Calculation report error: {error_trace}")
        enhanced_audit_logger.log(
            action="GENERATE_CALCULATION_REPORT_ERROR",
            details={
                "profile_name": profile_name if "profile_name" in dir() else None,
                "error": str(e),
                "trace": error_trace
            },
            status_code=500,
        )
        return jsonify({"error": "An internal error occurred"}), 500
