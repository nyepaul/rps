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
            annual_401k_contribution_rate=spouse_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=spouse_data.get("employer_match_rate") or 0,
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
            annual_401k_contribution_rate=spouse_data.get("annual_401k_contribution_rate") or 0,
            employer_match_rate=spouse_data.get("employer_match_rate") or 0,
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


@analysis_bp.route("/analysis/calculation-report", methods=["POST"])
@login_required
def get_calculation_report():
    """Generate detailed calculation report showing all income, expenses, taxes, and portfolio calculations."""
    json_data = request.get_json(silent=True) or {}
    profile_name = None
    try:
        profile_name = json_data.get("profile_name")

        if not profile_name:
            return jsonify({"error": "profile_name is required"}), 400

        # Get profile with ownership check
        profile = Profile.get_by_name(profile_name, current_user.id)
        if not profile:
            return jsonify({"error": "Profile not found"}), 404

        profile_data = profile.data_dict
        data = profile_data.get("data", {})
        person_data = data.get("person", {})
        spouse_data = data.get("spouse", {})
        financial_data = data.get("financial", {})
        budget_data = data.get("budget", {})

        # Build report sections
        report = {
            "profile_name": profile.name,
            "generated_at": datetime.now().isoformat(),
            "sections": []
        }

        # 1. PROFILE SUMMARY
        birth_date_str = person_data.get("birth_date", "1980-01-01")
        current_age = (datetime.now() - datetime.fromisoformat(birth_date_str)).days // 365
        retirement_date_str = person_data.get("retirement_date", "2045-01-01")
        retirement_age = (datetime.fromisoformat(retirement_date_str) - datetime.fromisoformat(birth_date_str)).days // 365

        profile_summary = {
            "title": "Profile Summary",
            "items": [
                {"label": "Primary Person", "value": person_data.get("name", "Primary")},
                {"label": "Current Age", "value": f"{current_age} years"},
                {"label": "Retirement Age", "value": f"{retirement_age} years"},
                {"label": "Years to Retirement", "value": f"{max(0, retirement_age - current_age)} years"},
            ]
        }

        if spouse_data.get("name"):
            spouse_birth = spouse_data.get("birth_date", "1980-01-01")
            spouse_age = (datetime.now() - datetime.fromisoformat(spouse_birth)).days // 365
            profile_summary["items"].extend([
                {"label": "Spouse", "value": spouse_data.get("name")},
                {"label": "Spouse Age", "value": f"{spouse_age} years"},
            ])

        report["sections"].append(profile_summary)

        # 2. INCOME SOURCES (Annual)
        income_section = {
            "title": "Annual Income Sources",
            "items": [],
            "total": 0
        }

        # Work Income
        work_income_annual = 0
        if budget_data.get("income", {}).get("current", {}).get("employment"):
            emp = budget_data["income"]["current"]["employment"]
            primary_income = emp.get("primary_person", 0) * 12
            spouse_income = emp.get("spouse", 0) * 12
            work_income_annual = primary_income + spouse_income
            if primary_income > 0:
                income_section["items"].append({
                    "label": "Primary Employment",
                    "value": f"${primary_income:,.0f}",
                    "amount": primary_income
                })
            if spouse_income > 0:
                income_section["items"].append({
                    "label": "Spouse Employment",
                    "value": f"${spouse_income:,.0f}",
                    "amount": spouse_income
                })

        # Other Income (rental, consulting, business, other)
        other_income_annual = 0
        if budget_data.get("income", {}).get("current", {}).get("other"):
            other = budget_data["income"]["current"]["other"]
            for income_type in ["rental_income", "part_time_consulting", "business_income", "other_income"]:
                amount = other.get(income_type, 0) * 12
                if amount > 0:
                    label_map = {
                        "rental_income": "Rental Income",
                        "part_time_consulting": "Consulting Income",
                        "business_income": "Business Income",
                        "other_income": "Other Income"
                    }
                    income_section["items"].append({
                        "label": label_map[income_type],
                        "value": f"${amount:,.0f}",
                        "amount": amount
                    })
                    other_income_annual += amount

        # Social Security (if eligible)
        p1_ss_annual = 0
        p2_ss_annual = 0
        p1_claiming_age = financial_data.get("ss_claiming_age", 67)
        if current_age >= p1_claiming_age:
            p1_ss_annual = (financial_data.get("social_security_benefit", 0) or 0) * 12
            if p1_ss_annual > 0:
                income_section["items"].append({
                    "label": "Social Security (Primary)",
                    "value": f"${p1_ss_annual:,.0f}",
                    "amount": p1_ss_annual
                })

        if spouse_data.get("name"):
            spouse_birth = spouse_data.get("birth_date", "1980-01-01")
            spouse_age = (datetime.now() - datetime.fromisoformat(spouse_birth)).days // 365
            p2_claiming_age = spouse_data.get("ss_claiming_age", 67)
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
            pension_annual = (financial_data.get("pension_benefit", 0) or 0) * 12
            if pension_annual > 0:
                income_section["items"].append({
                    "label": "Pension Income",
                    "value": f"${pension_annual:,.0f}",
                    "amount": pension_annual
                })

        total_income_annual = work_income_annual + other_income_annual + p1_ss_annual + p2_ss_annual + pension_annual
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

        # 401k Contributions
        contrib_rate_p1 = financial_data.get("annual_401k_contribution_rate", 0)
        match_rate_p1 = financial_data.get("employer_match_rate", 0)

        if work_income_annual > 0 and current_age < retirement_age:
            # Estimate primary person contribution (assume 60% of work income)
            primary_salary = work_income_annual * 0.6 if spouse_data.get("name") else work_income_annual
            p1_401k = primary_salary * contrib_rate_p1
            p1_match = primary_salary * match_rate_p1

            if p1_401k > 0:
                contributions_section["items"].append({
                    "label": "401k Employee Contribution (Primary)",
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

            # Spouse 401k
            contrib_rate_p2 = spouse_data.get("annual_401k_contribution_rate", 0)
            match_rate_p2 = spouse_data.get("employer_match_rate", 0)
            if spouse_data.get("name") and (contrib_rate_p2 > 0 or match_rate_p2 > 0):
                spouse_salary = work_income_annual * 0.4
                p2_401k = spouse_salary * contrib_rate_p2
                p2_match = spouse_salary * match_rate_p2

                if p2_401k > 0:
                    contributions_section["items"].append({
                        "label": "401k Employee Contribution (Spouse)",
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

        # IRA Contributions
        ira_annual = financial_data.get("annual_ira_contribution", 0) or 0
        if ira_annual > 0 and current_age < retirement_age:
            contributions_section["items"].append({
                "label": "IRA Contribution",
                "value": f"${ira_annual:,.0f}",
                "amount": ira_annual,
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
            expense_categories = [
                ("housing", "Housing"),
                ("utilities", "Utilities"),
                ("transportation", "Transportation"),
                ("food", "Food/Groceries"),
                ("dining_out", "Dining Out"),
                ("healthcare", "Healthcare"),
                ("insurance", "Insurance"),
                ("travel", "Travel/Vacation"),
                ("entertainment", "Entertainment"),
                ("personal_care", "Personal Care"),
                ("clothing", "Clothing"),
                ("gifts", "Gifts/Donations"),
                ("childcare_education", "Childcare/Education"),
                ("charitable_giving", "Charitable Giving"),
                ("subscriptions", "Subscriptions"),
                ("pet_care", "Pet Care"),
                ("home_maintenance", "Home Maintenance"),
                ("debt_payments", "Debt Payments"),
                ("discretionary", "Discretionary"),
                ("other", "Other"),
            ]

            total_expenses_annual = 0
            for key, label in expense_categories:
                amount_monthly = current_expenses.get(key, 0)
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
        # Ordinary income = work + other + pension + (50% of SS)
        taxable_ss = (p1_ss_annual + p2_ss_annual) * 0.5
        ordinary_income = work_income_annual + other_income_annual + pension_annual + taxable_ss

        # Apply 401k deductions
        ordinary_income_after_401k = ordinary_income - sum(
            item["amount"] for item in contributions_section.get("items", [])
            if "Employee Contribution" in item["label"]
        )

        # Standard deduction
        filing_status = financial_data.get("filing_status", "mfj")
        std_deduction = 29200 if filing_status == "mfj" else 14600
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

        # Federal Tax (simplified)
        fed_rate = financial_data.get("tax_bracket_federal", 0.12)
        federal_tax = taxable_income * fed_rate
        tax_section["items"].append({
            "label": f"Federal Income Tax ({fed_rate*100:.0f}% rate)",
            "value": f"${federal_tax:,.0f}",
            "amount": federal_tax
        })

        # State Tax
        state_rate = financial_data.get("tax_bracket_state", 0.05)
        state_tax = taxable_income * state_rate
        tax_section["items"].append({
            "label": f"State Income Tax ({state_rate*100:.0f}% rate)",
            "value": f"${state_tax:,.0f}",
            "amount": state_tax
        })

        # FICA (on work income only, if under retirement)
        fica_tax = 0
        if current_age < retirement_age:
            fica_tax = work_income_annual * 0.0765
            tax_section["items"].append({
                "label": "FICA Tax (7.65%)",
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

        # Get assets
        assets_data = profile_data.get("data", {}).get("assets", {})

        # Retirement accounts
        retirement_total = 0
        for account in assets_data.get("retirement_accounts", []):
            retirement_total += account.get("current_value", 0)
        if retirement_total > 0:
            portfolio_section["items"].append({
                "label": "Retirement Accounts (401k, IRA)",
                "value": f"${retirement_total:,.0f}",
                "amount": retirement_total
            })

        # Taxable accounts
        taxable_total = 0
        for account in assets_data.get("taxable_accounts", []):
            taxable_total += account.get("current_value", 0)
        if taxable_total > 0:
            portfolio_section["items"].append({
                "label": "Taxable Brokerage Accounts",
                "value": f"${taxable_total:,.0f}",
                "amount": taxable_total
            })

        # Real estate (equity)
        real_estate_total = 0
        for property in assets_data.get("real_estate", []):
            value = property.get("current_value", 0)
            mortgage = property.get("mortgage_balance", 0)
            equity = value - mortgage
            real_estate_total += equity
        if real_estate_total > 0:
            portfolio_section["items"].append({
                "label": "Real Estate Equity",
                "value": f"${real_estate_total:,.0f}",
                "amount": real_estate_total
            })

        # Other assets
        other_total = 0
        for asset in assets_data.get("other_assets", []):
            other_total += asset.get("current_value", 0)
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
        enhanced_audit_logger.log(
            action="GENERATE_CALCULATION_REPORT_ERROR",
            details={
                "profile_name": profile_name if "profile_name" in dir() else None,
                "error": str(e),
            },
            status_code=500,
        )
        return jsonify({"error": str(e)}), 500
