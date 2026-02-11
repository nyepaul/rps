"""Tests for phase2 planning helper service."""

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
    build_part_time_retirement_model,
    build_pension_lump_sum_analysis,
    build_real_estate_enhancements,
    build_retirement_lifestyle_planning,
    build_risk_analysis_dashboard,
    build_secure_act_beneficiary_ira,
)


def test_build_529_college_savings_plan_returns_unavailable_without_children():
    result = build_529_college_savings_plan({"children": []})
    assert result["available"] is False
    assert result["children"] == []


def test_build_529_college_savings_plan_calculates_totals_for_children():
    profile_data = {
        "children": [
            {"name": "Kid One", "birth_year": 2016},
            {"name": "Kid Two", "birth_year": 2020},
        ],
        "assets": {
            "education_accounts": [
                {"name": "529 A", "value": 15000},
                {"name": "529 B", "value": 5000},
            ]
        },
    }
    result = build_529_college_savings_plan(profile_data)

    assert result["available"] is True
    assert len(result["children"]) == 2
    assert result["household_totals"]["existing_529_balance"] == 20000.0
    assert result["household_totals"]["target_funding_total"] > 0
    assert result["household_totals"]["monthly_savings_needed_total"] >= 0


def test_build_pension_lump_sum_analysis_compares_stream_and_lump_sum():
    profile_data = {
        "person": {"current_age": 60, "life_expectancy": 90},
        "financial": {"pension_benefit": 2500, "pension_lump_sum": 450000},
    }
    result = build_pension_lump_sum_analysis(profile_data)
    assert result["available"] is True
    assert result["annual_pension_income"] == 30000.0
    assert result["lump_sum_offer"] == 450000.0
    assert result["present_value_of_pension"] > 0
    assert result["recommendation"] in ("pension_stream", "lump_sum")


def test_build_estate_tax_gifting_strategy_returns_estate_and_gifting_fields():
    profile_data = {
        "person": {"current_age": 55, "life_expectancy": 90},
        "spouse": {"name": "Spouse"},
        "children": [{"name": "A"}, {"name": "B"}],
        "assets": {
            "taxable_accounts": [{"value": 4000000}],
            "retirement_accounts": [{"value": 3000000}],
            "real_estate": [{"current_value": 2500000, "mortgage_balance": 500000}],
            "liabilities": [{"value": 100000}],
        },
    }
    result = build_estate_tax_gifting_strategy(profile_data)
    assert result["available"] is True
    assert result["estate"]["net_estate"] > 0
    assert result["gifting"]["annual_gifting_capacity"] > 0
    assert isinstance(result["recommendations"], list)


def test_build_investment_fee_impact_analyzer_returns_fee_metrics():
    profile_data = {
        "person": {"current_age": 50, "life_expectancy": 90},
        "assets": {
            "retirement_accounts": [{"name": "401k", "value": 500000, "expense_ratio": 0.009}],
            "taxable_accounts": [{"name": "Brokerage", "value": 250000, "expense_ratio": 0.004}],
        },
    }
    result = build_investment_fee_impact_analyzer(profile_data)
    assert result["available"] is True
    assert result["total_investable_assets"] == 750000.0
    assert result["annual_fee_dollars"] > 0
    assert result["lifetime_fee_impact"] >= 0


def test_build_part_time_retirement_model_generates_scenarios():
    profile_data = {
        "person": {"current_age": 58, "retirement_age": 65},
        "financial": {
            "annual_expenses": 90000,
            "social_security_benefit": 2500,
            "pension_benefit": 1000,
        },
    }
    result = build_part_time_retirement_model(profile_data)
    assert result["available"] is True
    assert len(result["scenarios"]) >= 3
    assert result["inputs"]["base_withdrawal_need"] >= 0
    assert "part_time_gross_income" in result["recommended_part_time_income"]


def test_build_real_estate_enhancements_returns_property_metrics():
    profile_data = {
        "assets": {
            "real_estate": [
                {
                    "name": "Rental A",
                    "current_value": 500000,
                    "mortgage_balance": 200000,
                    "annual_rental_income": 36000,
                    "annual_property_tax": 6000,
                    "annual_insurance": 1200,
                    "annual_maintenance": 3000,
                }
            ]
        }
    }
    result = build_real_estate_enhancements(profile_data)
    assert result["available"] is True
    assert result["totals"]["property_count"] == 1
    assert result["totals"]["total_equity"] == 300000.0
    assert len(result["properties"]) == 1


def test_build_advanced_scenario_analysis_ranks_scenarios():
    scenarios = {
        "conservative": {
            "scenario_name": "Conservative",
            "success_rate": 0.85,
            "median_final_balance": 800000,
            "percentile_10": 120000,
            "percentile_90": 1800000,
            "std_deviation": 400000,
        },
        "aggressive": {
            "scenario_name": "Aggressive",
            "success_rate": 0.79,
            "median_final_balance": 1200000,
            "percentile_10": 60000,
            "percentile_90": 2600000,
            "std_deviation": 700000,
        },
    }
    result = build_advanced_scenario_analysis(scenarios, years_projected=35)
    assert result["available"] is True
    assert result["leaders"]["best_success_rate"]["scenario"] == "Conservative"
    assert result["dispersion"]["success_rate_spread"] > 0
    assert len(result["scenario_table"]) == 2


def test_build_dynamic_withdrawal_strategies_returns_recommendation():
    profile_data = {
        "financial": {"annual_expenses": 80000},
        "assets": {
            "retirement_accounts": [{"value": 900000}],
            "taxable_accounts": [{"value": 300000}],
        },
    }
    scenarios = {
        "moderate": {"success_rate": 0.84, "percentile_10": 120000},
        "conservative": {"success_rate": 0.88, "percentile_10": 180000},
    }
    result = build_dynamic_withdrawal_strategies(profile_data, scenarios)
    assert result["available"] is True
    assert result["inputs"]["base_withdrawal_rate"] > 0
    assert len(result["strategies"]) >= 2
    assert isinstance(result["recommended_strategy"], str)


def test_build_life_event_scenario_modeling_returns_ranked_events():
    profile_data = {
        "financial": {"annual_expenses": 85000},
        "person": {"current_age": 60, "retirement_age": 66},
        "home_properties": [{"current_value": 700000, "mortgage_balance": 250000}],
    }
    scenarios = {"moderate": {"success_rate": 0.84, "median_final_balance": 900000}}
    result = build_life_event_scenario_modeling(profile_data, scenarios)
    assert result["available"] is True
    assert len(result["events"]) >= 3
    assert "baseline" in result


def test_additional_planning_modules_return_available_payloads():
    profile_data = {
        "person": {"current_age": 55, "retirement_age": 65},
        "spouse": {"name": "Spouse"},
        "children": [{"name": "Child", "birth_year": 2012}],
        "financial": {"annual_income": 180000, "annual_expenses": 90000, "liquid_assets": 150000},
        "assets": {
            "taxable_accounts": [{"value": 200000, "type": "brokerage"}],
            "retirement_accounts": [{"value": 700000}],
            "other_assets": [{"type": "business_interest", "value": 300000}],
            "pensions_annuities": [{"type": "annuity", "current_value": 120000}],
            "liabilities": [{"value": 50000}],
        },
    }
    scenarios = {"moderate": {"success_rate": 0.82, "percentile_10": 80000}}

    assert build_disability_income_protection(profile_data)["available"] is True
    assert build_long_term_care_analysis(profile_data)["available"] is True
    assert build_business_owner_retirement_planning(profile_data)["available"] is True
    assert build_secure_act_beneficiary_ira(profile_data)["available"] is True
    assert build_annuity_comparison_tool(profile_data)["available"] is True
    assert build_cashflow_budget_enhancements(profile_data)["available"] is True
    assert build_retirement_lifestyle_planning(profile_data)["available"] is True
    assert build_document_vault_beneficiary_tracking(profile_data)["available"] is True
    assert build_advanced_investment_factor_analysis(profile_data)["available"] is True
    assert build_family_legacy_gifting_goals(profile_data)["available"] is True
    assert build_risk_analysis_dashboard(profile_data, scenarios)["available"] is True
