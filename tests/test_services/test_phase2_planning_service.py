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
    build_longevity_care_path_modeling,
    build_part_time_retirement_model,
    build_pension_lump_sum_analysis,
    build_plan_health_monitoring_drift_alerts,
    build_pre65_healthcare_bridge_planner,
    build_real_estate_enhancements,
    build_retirement_lifestyle_planning,
    build_retirement_paycheck_builder,
    build_risk_analysis_dashboard,
    build_social_security_statement_reconciliation,
    build_secure_act_beneficiary_ira,
    build_tax_law_update_engine,
    build_guaranteed_income_floor_optimizer,
    build_data_aggregation_reconciliation_hub,
    build_charitable_strategy_optimizer,
    build_household_collaboration_workflow,
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


def test_phase2_new_backlog_modules_return_expected_fields():
    profile_data = {
        "person": {"current_age": 58, "retirement_age": 62, "life_expectancy": 91},
        "financial": {
            "annual_income": 175000,
            "annual_expenses": 96000,
            "social_security_benefit": 2800,
            "pension_benefit": 900,
            "inflation_rate": 0.03,
            "expected_return": 0.06,
            "annual_healthcare_expenses": 14500,
            "annual_charitable_giving": 9000,
        },
        "budget": {"actuals": {"annual_spending": 104000}},
        "performance": {"actual_return_last_12m": 0.035, "inflation_observed": 0.038},
        "tax_settings": {"tax_year": 2024},
        "social_security_statement": {"monthly_benefit_estimate": 2950},
        "imports": {"linked_accounts": 4, "csv_sources": 2, "manual_entries": 18, "deduplicated_items": 9},
        "collaborators": [{"name": "Spouse"}, {"name": "Advisor"}],
        "plan_reviews": [{"status": "approved"}, {"status": "open"}, {"status": "approved"}],
    }
    scenarios = {"moderate": {"success_rate": 0.86, "median_final_balance": 980000, "percentile_10": 180000}}

    plan_drift = build_plan_health_monitoring_drift_alerts(profile_data, scenarios)
    assert plan_drift["available"] is True
    assert "drift_score" in plan_drift
    assert "alert_count" in plan_drift

    tax_engine = build_tax_law_update_engine(profile_data)
    assert tax_engine["available"] is True
    assert "policy_freshness_score" in tax_engine

    bridge = build_pre65_healthcare_bridge_planner(profile_data)
    assert bridge["available"] is True
    assert bridge["bridge_years"] >= 0

    floor = build_guaranteed_income_floor_optimizer(profile_data, scenarios)
    assert floor["available"] is True
    assert "annual_floor_shortfall" in floor

    ss_reconcile = build_social_security_statement_reconciliation(profile_data)
    assert ss_reconcile["available"] is True
    assert "monthly_delta" in ss_reconcile

    data_hub = build_data_aggregation_reconciliation_hub(profile_data)
    assert data_hub["available"] is True
    assert "data_confidence_score" in data_hub

    longevity = build_longevity_care_path_modeling(profile_data)
    assert longevity["available"] is True
    assert "projected_lifetime_care_cost" in longevity

    charity = build_charitable_strategy_optimizer(profile_data)
    assert charity["available"] is True
    assert "recommended_daf_bunch_amount" in charity

    household = build_household_collaboration_workflow(profile_data)
    assert household["available"] is True
    assert household["collaborator_count"] == 2

    paycheck = build_retirement_paycheck_builder(profile_data)
    assert paycheck["available"] is True
    assert "target_monthly_paycheck" in paycheck
