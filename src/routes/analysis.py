"""Analysis routes for running retirement simulations."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, field_validator, ValidationError
from typing import Optional, List
from datetime import datetime, date
from src.models.profile import Profile
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)
from src.services.tax_engine_refactor import TaxEngine
from src.services.rebalancing_service import RebalancingService
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.utils.error_sanitizer import sanitize_pydantic_error

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api")


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
            }
        )

    return investment_types


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

    @field_validator("simulations")
    def validate_simulations(cls, v):
        if v < 100 or v > 50000:
            raise ValueError("Simulations must be between 100 and 50,000")
        return v


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
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

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
                # Simplified PIA estimation using 2024 bend points
                aime = annual_employment / 12
                if aime <= 1174:
                    pia = aime * 0.90
                elif aime <= 7078:
                    pia = 1174 * 0.90 + (aime - 1174) * 0.32
                else:
                    pia = 1174 * 0.90 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15

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
                if aime <= 1174:
                    pia = aime * 0.90
                elif aime <= 7078:
                    pia = 1174 * 0.90 + (aime - 1174) * 0.32
                else:
                    pia = 1174 * 0.90 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15

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

        # Build budget data and resolve income_streams vs budget.income overlap
        # Income must flow through ONE path only to avoid double-counting:
        #   - income_streams -> model's stream processing (with per-person retirement gating)
        #   - budget.income -> model's budget income processing
        # We prefer income_streams (more granular) and skip budget employment when both exist.
        budget_data = profile_data.get("budget", {})
        mc_income_streams = profile_data.get("income_streams", [])

        if budget_data and not budget_data.get("income"):
            # No budget.income section -- income will flow via income_streams only.
            # BUT the model's 401k calculation needs salary from budget.income.current.employment
            # when a budget exists (lines 1125-1126, 1168-1169 in retirement_model.py).
            # Populate employment salary from income_streams so 401k contributions work.
            primary_salary = 0
            spouse_salary_for_budget = 0
            spouse_first = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            for stream in mc_income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    amt = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    annual = amt * 12 if freq in ("monthly", "") else (amt if freq == "annual" else amt * 12)

                    stream_name = (stream.get("name") or "").lower()
                    is_spouse = stream.get("owner") == "spouse" or (spouse_first and spouse_first in stream_name)
                    if is_spouse:
                        spouse_salary_for_budget += annual
                    else:
                        primary_salary += annual

            budget_data["income"] = {
                "current": {
                    "employment": {
                        "primary_person": primary_salary,
                        "spouse": spouse_salary_for_budget,
                    }
                },
                "future": {}
            }
        elif budget_data and budget_data.get("income"):
            # Budget has explicit income section -- use budget for employment, strip employment
            # from income_streams to avoid double-counting.
            employment_types = {"salary", "hourly", "wages", "bonus"}
            employment_sources = {"employment"}
            mc_income_streams = [
                s for s in mc_income_streams
                if s.get("type") not in employment_types
                and s.get("source") not in employment_sources
            ]

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
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

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
            # FOR COMPARISON: Always use the scenario's stock allocation
            target_stock = scenario_config["stock_allocation"]

            # Proportional adjustment for bonds/cash based on new stock target
            # (If stocks move from 60% to 30%, we need to scale up other assets)
            remaining = 1.0 - target_stock

            # Start with base assumptions
            final_assumptions = {**base_market_kwargs}
            final_assumptions["stock_allocation"] = target_stock

            # Simple balancing of bonds/cash if they exist in base
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
                    # Scale others too if they were part of the profile
                    if "reit_allocation" in final_assumptions:
                        final_assumptions["reit_allocation"] *= scale
                    if "gold_allocation" in final_assumptions:
                        final_assumptions["gold_allocation"] *= scale
                    if "crypto_allocation" in final_assumptions:
                        final_assumptions["crypto_allocation"] *= scale
            else:
                final_assumptions["bond_allocation"] = 0
                final_assumptions["cash_allocation"] = 0

            market_assumptions = MarketAssumptions(**final_assumptions)
            scenario_result = model.monte_carlo_simulation(
                years=years,
                simulations=data.simulations,
                assumptions=market_assumptions,
                spending_model=data.spending_model,
                market_periods=data.market_periods.dict() if data.market_periods else None,
            )
            scenario_result["scenario_name"] = scenario_config["name"]
            scenario_result["description"] = scenario_config["description"]
            scenario_result["stock_allocation"] = target_stock
            scenario_results[scenario_key] = scenario_result

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
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        profile_name = json_data.get("profile_name")
        enhanced_audit_logger.log(
            action="RUN_ANALYSIS_ERROR",
            details={"profile_name": profile_name, "error": str(e)},
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

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
                if aime <= 1174:
                    pia = aime * 0.90
                elif aime <= 7078:
                    pia = 1174 * 0.90 + (aime - 1174) * 0.32
                else:
                    pia = 1174 * 0.90 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15

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
                if aime <= 1174:
                    pia = aime * 0.90
                elif aime <= 7078:
                    pia = 1174 * 0.90 + (aime - 1174) * 0.32
                else:
                    pia = 1174 * 0.90 + (7078 - 1174) * 0.32 + (aime - 7078) * 0.15

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

        # Build budget data and resolve income_streams vs budget.income overlap
        budget_data = profile_data.get("budget", {})
        mc_income_streams = profile_data.get("income_streams", [])

        if budget_data and not budget_data.get("income"):
            # Populate employment salary from income_streams for 401k calculations
            primary_salary = 0
            spouse_salary_for_budget = 0
            spouse_first = (spouse_data.get("name") or "").lower().split()[0] if spouse_data.get("name") else ""
            for stream in mc_income_streams:
                if stream.get("source") in ("employment",) or stream.get("type") in (
                    "salary", "hourly", "wages", "bonus",
                ):
                    amt = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    annual = amt * 12 if freq in ("monthly", "") else (amt if freq == "annual" else amt * 12)

                    stream_name = (stream.get("name") or "").lower()
                    is_spouse = stream.get("owner") == "spouse" or (spouse_first and spouse_first in stream_name)
                    if is_spouse:
                        spouse_salary_for_budget += annual
                    else:
                        primary_salary += annual

            budget_data["income"] = {
                "current": {
                    "employment": {
                        "primary_person": primary_salary,
                        "spouse": spouse_salary_for_budget,
                    }
                },
                "future": {}
            }
        elif budget_data and budget_data.get("income"):
            employment_types = {"salary", "hourly", "wages", "bonus"}
            employment_sources = {"employment"}
            mc_income_streams = [
                s for s in mc_income_streams
                if s.get("type") not in employment_types
                and s.get("source") not in employment_sources
            ]

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
            years=years, assumptions=assumptions, spending_model=data.spending_model
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
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500


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
            tax_year=int(profile_data.get("tax_settings", {}).get("tax_year") or datetime.now().year),
        )

        # Calculate Roth conversion tax impact
        # Get current income for tax bracket estimation
        income_streams = profile_data.get("income_streams", [])
        current_income = sum(s.get("amount", 0) * 12 for s in income_streams)
        tax_settings = profile_data.get("tax_settings", {})
        filing_status = tax_settings.get("filing_status", "mfj")
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)

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
        return jsonify({"error": str(e)}), 500


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
        return jsonify({"error": str(e)}), 500


@analysis_bp.route("/analysis/calculation-report", methods=["POST"])
@login_required
def get_calculation_report():
    """Generate detailed calculation report showing all income, expenses, taxes, and portfolio calculations."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None

    # Quick version check - return immediately if version check requested
    if json_data.get("version_check"):
        return jsonify({"version": "3.9.216", "status": "ok"}), 200

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
            import logging
            logger = logging.getLogger(__name__)
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
            tax_settings = profile_data.get("tax_settings", {})
            has_spouse_for_filing = bool(spouse_data.get("birth_date") or spouse_data.get("name") or spouse_data.get("social_security_benefit"))
            default_filing = "mfj" if has_spouse_for_filing else "single"
            tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
            contrib_limits = TaxEngine.get_contribution_limits(tax_year)

            logger.info(f"Income streams type: {type(income_streams)}, count: {len(income_streams) if isinstance(income_streams, list) else 'NOT A LIST'}")
            logger.info(f"Assets data type: {type(assets_data)}")

        except Exception as e:
            logger.error(f"Error accessing profile data: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({"error": f"Error accessing profile data: {str(e)}"}), 500

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

            # Primary 401k - apply IRS limits
            p1_401k_limit = contrib_limits["401k_base"]
            if current_age >= contrib_limits["catchup_age"]:
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
        if filing_status in ("mfj", "mqw"):
            threshold1, threshold2 = 32000, 44000
        else:
            threshold1, threshold2 = 25000, 34000

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

        # Standard deduction (with 65+ additional)
        # filing_status already set above from tax_settings/auto-detect
        if filing_status == "mfj":
            std_deduction = 29200
            # Add 65+ additional ($1,550 per person for MFJ)
            if current_age >= 65:
                std_deduction += 1550
            if spouse_age >= 65:
                std_deduction += 1550
        elif filing_status == "hoh":
            std_deduction = 21900
            if current_age >= 65:
                std_deduction += 1950
        else:  # single / mfs
            std_deduction = 14600
            if current_age >= 65:
                std_deduction += 1950
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

        # State Tax
        state_rate = float(tax_settings.get("tax_bracket_state") or financial_data.get("tax_bracket_state", 0.05) or 0.05)
        state_tax = taxable_income * state_rate
        tax_section["items"].append({
            "label": f"State Income Tax ({state_rate*100:.0f}% rate)",
            "value": f"${state_tax:,.0f}",
            "amount": state_tax
        })

        # FICA (on employment income only, if under retirement)
        fica_tax = 0
        if current_age < retirement_age and employment_income_annual > 0:
            # Social Security tax: 6.2% capped at wage base ($168,600 for 2024)
            ss_wage_base = 168600
            ss_tax = min(employment_income_annual, ss_wage_base) * 0.062
            # Medicare tax: 1.45% on all employment income
            medicare_tax = employment_income_annual * 0.0145
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
        return jsonify({"error": f"{str(e)} - Check server logs for details"}), 500
