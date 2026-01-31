"""Analysis routes for running retirement simulations."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator, ValidationError
from typing import Optional, List
from src.models.profile import Profile
from src.services.retirement_model import (
    Person,
    FinancialProfile,
    MarketAssumptions,
    RetirementModel,
)
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

    @validator("simulations")
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
        financial_data = profile_data.get("financial", {})
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
            name=profile.name or "Primary",
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
            or 0,  # Already monthly
            ss_claiming_age=financial_data.get("ss_claiming_age") or 67,
            annual_401k_contribution_rate=financial_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=financial_data.get("employer_match_rate") or 0,
        )

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
        )

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

        # Fix: Ensure budget has income section populated from income_streams
        # Many profiles have income_streams but no budget.income section
        # This causes Monte Carlo to think employment income is $0, draining portfolio
        budget_data = profile_data.get("budget", {})
        if budget_data and not budget_data.get("income"):
            # Calculate employment income from income_streams
            income_streams = profile_data.get("income_streams", [])
            primary_salary = 0
            spouse_salary = 0

            employment_types = ["salary", "hourly", "wages", "bonus"]
            for stream in income_streams:
                if stream.get("type") in employment_types:
                    amount = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    # Convert to annual
                    if freq == "monthly":
                        annual_amount = amount * 12
                    elif freq == "annual":
                        annual_amount = amount
                    else:
                        annual_amount = amount * 12  # Default to monthly

                    # Assign to primary or spouse based on name/order
                    # First salary goes to primary, second to spouse
                    if primary_salary == 0:
                        primary_salary = annual_amount
                    else:
                        spouse_salary = annual_amount

            # Populate budget.income.current.employment
            if primary_salary > 0 or spouse_salary > 0:
                budget_data["income"] = {
                    "current": {
                        "employment": {
                            "primary_person": primary_salary,
                            "spouse": spouse_salary,
                        }
                    },
                    "future": {},
                }

        # Get tax settings with proper address fallback
        address_data = profile_data.get("address", {})
        tax_settings = profile_data.get("tax_settings", {})

        # Priority: explicit tax settings > address state > default NY
        filing_status = tax_settings.get("filing_status") or "mfj"
        state = tax_settings.get("state") or address_data.get("state") or "NY"

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
            income_streams=profile_data.get("income_streams", []),
            home_properties=profile_data.get("home_properties", []),
            budget=budget_data if budget_data else None,
            annual_ira_contribution=financial_data.get("annual_ira_contribution", 0),
            savings_allocation=profile_data.get("savings_allocation"),
            filing_status=filing_status,
            state=state,
        )

        # Create retirement model
        model = RetirementModel(financial_profile)

        # Calculate years for simulation
        years = max(
            model.calculate_life_expectancy_years(person1),
            model.calculate_life_expectancy_years(person2),
        )

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

        # Extract person data
        financial_data = profile_data.get("financial", {})
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
            name=profile.name or "Primary",
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
            social_security=financial_data.get("social_security_benefit") or 0,
            ss_claiming_age=financial_data.get("ss_claiming_age") or 67,
            annual_401k_contribution_rate=financial_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=financial_data.get("employer_match_rate") or 0,
        )

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
        )

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

        # Ensure budget has income section
        budget_data = profile_data.get("budget", {})
        if budget_data and not budget_data.get("income"):
            income_streams = profile_data.get("income_streams", [])
            primary_salary = 0
            spouse_salary = 0
            employment_types = ["salary", "hourly", "wages", "bonus"]
            for stream in income_streams:
                if stream.get("type") in employment_types:
                    amount = stream.get("amount", 0)
                    freq = stream.get("frequency", "monthly")
                    if freq == "monthly":
                        annual_amount = amount * 12
                    elif freq == "annual":
                        annual_amount = amount
                    else:
                        annual_amount = amount * 12
                    if primary_salary == 0:
                        primary_salary = annual_amount
                    else:
                        spouse_salary = annual_amount
            if primary_salary > 0 or spouse_salary > 0:
                budget_data["income"] = {
                    "current": {
                        "employment": {
                            "primary_person": primary_salary,
                            "spouse": spouse_salary,
                        }
                    },
                    "future": {},
                }

        # Get tax settings with proper address fallback
        address_data = profile_data.get("address", {})
        tax_settings = profile_data.get("tax_settings", {})

        # Priority: explicit tax settings > address state > default NY
        filing_status = tax_settings.get("filing_status") or "mfj"
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
            income_streams=profile_data.get("income_streams", []),
            home_properties=profile_data.get("home_properties", []),
            budget=budget_data if budget_data else None,
            annual_ira_contribution=financial_data.get("annual_ira_contribution", 0),
            savings_allocation=profile_data.get("savings_allocation"),
            filing_status=filing_status,
            state=state,
        )

        model = RetirementModel(financial_profile)
        years = max(
            model.calculate_life_expectancy_years(person1),
            model.calculate_life_expectancy_years(person2),
        )

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
        market_data = profile_data.get("market_assumptions", {})

        person = Person(
            birth_year=person_data.get("birth_year", 1970),
            retirement_age=person_data.get("retirement_age", 65),
            life_expectancy=person_data.get("life_expectancy", 95),
            current_age=person_data.get("current_age", 40),
        )

        financial_profile = FinancialProfile(
            annual_income=financial_data.get("annual_income", 100000),
            annual_expenses=financial_data.get("annual_expenses", 70000),
            savings_rate=financial_data.get("savings_rate", 0.15),
            liquid_assets=financial_data.get("liquid_assets", 100000),
            retirement_assets=financial_data.get("retirement_assets", 500000),
            social_security_benefit=financial_data.get(
                "social_security_benefit", 30000
            ),
            pension=financial_data.get("pension", 0),
            other_income=financial_data.get("other_income", 0),
        )

        market_assumptions = MarketAssumptions(
            equity_return_mean=market_data.get("equity_return_mean", 0.10),
            equity_return_std=market_data.get("equity_return_std", 0.18),
            bond_return_mean=market_data.get("bond_return_mean", 0.04),
            bond_return_std=market_data.get("bond_return_std", 0.06),
            inflation_mean=market_data.get("inflation_mean", 0.03),
            inflation_std=market_data.get("inflation_std", 0.02),
            equity_allocation=market_data.get("equity_allocation", 0.70),
        )

        model = RetirementModel(person, financial_profile, market_assumptions)

        # Analyze Social Security claiming strategies
        results = model.analyze_social_security_strategies()
        results["profile_name"] = profile_name

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
        market_data = profile_data.get("market_assumptions", {})

        person = Person(
            birth_year=person_data.get("birth_year", 1970),
            retirement_age=person_data.get("retirement_age", 65),
            life_expectancy=person_data.get("life_expectancy", 95),
            current_age=person_data.get("current_age", 40),
        )

        financial_profile = FinancialProfile(
            annual_income=financial_data.get("annual_income", 100000),
            annual_expenses=financial_data.get("annual_expenses", 70000),
            savings_rate=financial_data.get("savings_rate", 0.15),
            liquid_assets=financial_data.get("liquid_assets", 100000),
            retirement_assets=financial_data.get("retirement_assets", 500000),
            social_security_benefit=financial_data.get(
                "social_security_benefit", 30000
            ),
            pension=financial_data.get("pension", 0),
            other_income=financial_data.get("other_income", 0),
        )

        market_assumptions = MarketAssumptions(
            equity_return_mean=market_data.get("equity_return_mean", 0.10),
            equity_return_std=market_data.get("equity_return_std", 0.18),
            bond_return_mean=market_data.get("bond_return_mean", 0.04),
            bond_return_std=market_data.get("bond_return_std", 0.06),
            inflation_mean=market_data.get("inflation_mean", 0.03),
            inflation_std=market_data.get("inflation_std", 0.02),
            equity_allocation=market_data.get("equity_allocation", 0.70),
        )

        model = RetirementModel(person, financial_profile, market_assumptions)

        # Analyze Roth conversion
        results = model.analyze_roth_conversion(conversion_amount)
        results["profile_name"] = profile_name

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
