"""Unit tests for tax optimization service enhancements."""

from src.services.tax_optimization_service import TaxOptimizationService


def test_analyze_rmd_includes_qcd_projection():
    service = TaxOptimizationService(filing_status="single", state="CA", age=74, tax_year=2026)
    result = service.analyze_rmd(
        age=74,
        traditional_balance=1_000_000,
        growth_rate=0.0,
        years=3,
        annual_charitable_giving=20_000,
    )

    assert "qcd_planning" in result
    assert "qcd_projection" in result
    assert len(result["qcd_projection"]) == 3
    assert result["qcd_planning"]["current_year_suggested_qcd"] > 0
    assert result["qcd_planning"]["current_year_taxable_rmd_after_qcd"] < result["current"]["rmd_amount"]


def test_infer_annual_charitable_giving_from_budget_dict():
    profile_data = {
        "budget": {
            "expenses": {
                "charitable_giving": {"amount": 500, "frequency": "monthly"}
            }
        }
    }
    inferred = TaxOptimizationService.infer_annual_charitable_giving(profile_data)
    assert inferred == 6000


def test_comprehensive_analysis_includes_social_security_block():
    service = TaxOptimizationService(filing_status="mfj", state="CA", age=64, spouse_age=62, tax_year=2026)
    profile_data = {
        "person": {"life_expectancy": 90, "social_security_benefit": 3200},
        "spouse": {"life_expectancy": 90, "social_security_benefit": 2200},
        "financial": {
            "annual_income": 120000,
            "social_security_benefit": 3200,
        },
        "assets": {
            "retirement_accounts": [{"type": "traditional_ira", "value": 750000}],
        },
    }
    result = service.get_comprehensive_analysis(profile_data)
    assert "social_security_analysis" in result
    assert result["social_security_analysis"]["available"] is True
    assert result["social_security_analysis"]["household"]["survivor_monthly_estimate_at_70_strategy"] > 0
    assert "tax_torpedo" in result["social_security_analysis"]
    assert len(result["social_security_analysis"]["household"]["strategy_matrix"]) > 0
    assert len(result["social_security_analysis"]["household"]["top_strategies"]) > 0
    assert len(result["social_security_analysis"]["household"]["breakeven_crossovers"]) > 0
    top = result["social_security_analysis"]["household"]["top_strategies"][0]
    assert "combined_monthly_benefit_independent" in top
    assert "combined_monthly_benefit_with_spousal_floor" in top
    assert "spousal_floor_uplift_monthly" in top


def test_wep_adjustment_reduces_pia():
    result = TaxOptimizationService.apply_wep_adjustment(
        pia_at_fra=3000, noncovered_pension_annual=24000
    )
    assert result["applied"] is True
    assert result["pia_after_wep"] < result["pia_before_wep"]


def test_tax_torpedo_analysis_has_threshold_context():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    torpedo = service.analyze_tax_torpedo(non_ss_income=50000, ss_benefit=60000)
    assert "thresholds" in torpedo
    assert "band" in torpedo
    assert "taxable_ss_pct" in torpedo


def test_roth_conversion_includes_ladder_projection():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=120000,
        traditional_balance=400000,
    )
    assert "conversion_ladder_5y" in result
    assert "bracket_targets" in result
    assert "precision_recommendations" in result
    assert "bracket_headroom_projection" in result
    assert "annual_safe_conversion_budget" in result
    assert "front_load_recommendation" in result
    assert "conversion_window_summary" in result
    assert "conversion_execution_plan" in result
    assert "conversion_tax_timeline" in result
    assert "conversion_risk_flags" in result
    ladder = result["conversion_ladder_5y"]
    assert "rows" in ladder
    assert len(ladder["rows"]) >= 1
    assert ladder["total_converted"] > 0


def test_roth_conversion_ladder_respects_custom_inputs():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=120000,
        traditional_balance=400000,
        ladder_years=3,
        ladder_growth_rate=0.02,
        ladder_max_rate=0.22,
        ladder_income_growth_rate=0.03,
        safety_buffer=1200,
    )
    ladder = result["conversion_ladder_5y"]
    assert ladder["years_modeled"] == 3
    assert ladder["annual_growth_assumption"] == 0.02
    assert ladder["max_marginal_rate_target"] == 0.22
    assert ladder["income_growth_assumption"] == 0.03
    assert ladder["rows"][0]["taxable_income_assumption"] <= ladder["rows"][-1]["taxable_income_assumption"]
    assert result["precision_recommendations"][0]["safe_buffer"] == 1200


def test_roth_conversion_includes_variant_recommendation():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=120000,
        traditional_balance=400000,
        ladder_years=5,
        ladder_growth_rate=0.05,
        ladder_max_rate=0.24,
    )
    assert "ladder_variants" in result
    variants = result["ladder_variants"]
    assert variants["recommended"] in {"conservative", "balanced", "aggressive"}
    assert "metrics" in variants
    assert "plans" in variants


def test_roth_conversion_ladder_keeps_modeled_years_when_no_space():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=1_000_000,
        traditional_balance=100_000,
        ladder_years=4,
        ladder_growth_rate=0.03,
        ladder_max_rate=0.20,
    )
    rows = result["conversion_ladder_5y"]["rows"]
    assert len(rows) == 4
    assert any(row.get("no_conversion_reason") for row in rows)


def test_roth_bracket_headroom_projection_matches_years():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=120000,
        traditional_balance=200000,
        ladder_years=4,
        ladder_income_growth_rate=0.03,
    )
    headroom = result["bracket_headroom_projection"]["rows"]
    assert len(headroom) == 4
    assert headroom[0]["taxable_income_assumption"] <= headroom[-1]["taxable_income_assumption"]
    safe_budget = result["annual_safe_conversion_budget"]["rows"]
    assert len(safe_budget) == 4


def test_roth_front_load_recommendation_payload():
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=250000,
        traditional_balance=200000,
        ladder_years=4,
        ladder_income_growth_rate=0.05,
        ladder_max_rate=0.24,
    )
    rec = result["front_load_recommendation"]
    assert "should_front_load" in rec
    assert "message" in rec
    summary = result["conversion_window_summary"]
    assert "urgency" in summary
    assert "open_year_count" in summary
    plan = result["conversion_execution_plan"]
    assert "rows" in plan
    assert "total_recommended_conversion" in plan
    timeline = result["conversion_tax_timeline"]
    assert "rows" in timeline
    assert "total_conversion_tax" in timeline
    risk_flags = result["conversion_risk_flags"]
    assert "has_risks" in risk_flags
    assert "flags" in risk_flags


def test_roth_conversion_timeline_totals_match_ladder_rows():
    """Timeline aggregates should reconcile exactly to the modeled ladder rows."""
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=109_170,
        traditional_balance=170_000,
        ladder_years=5,
        ladder_growth_rate=0.05,
        ladder_max_rate=0.24,
        ladder_income_growth_rate=0.02,
        safety_buffer=500,
    )

    ladder_rows = result["conversion_ladder_5y"]["rows"]
    timeline = result["conversion_tax_timeline"]

    sum_federal_tax = round(sum(float(row.get("conversion_tax", 0.0)) for row in ladder_rows), 2)
    sum_irmaa = round(sum(float(row.get("irmaa_increase", 0.0)) for row in ladder_rows), 2)
    sum_total_cost = round(sum(float(row.get("total_cost", 0.0)) for row in ladder_rows), 2)

    assert timeline["total_conversion_tax"] == sum_federal_tax
    assert timeline["total_irmaa_increase"] == sum_irmaa
    assert timeline["total_plan_cost"] == sum_total_cost


def test_roth_headroom_budget_and_execution_plan_are_consistent():
    """Headroom, safe budget, and execution plan should stay internally consistent."""
    service = TaxOptimizationService(filing_status="mfj", state="CA", tax_year=2026)
    result = service.analyze_roth_conversion(
        current_taxable_income=109_170,
        traditional_balance=170_000,
        ladder_years=5,
        ladder_growth_rate=0.05,
        ladder_max_rate=0.24,
        ladder_income_growth_rate=0.02,
        safety_buffer=500,
    )

    headroom_rows = result["bracket_headroom_projection"]["rows"]
    budget = result["annual_safe_conversion_budget"]
    budget_rows = budget["rows"]
    plan = result["conversion_execution_plan"]
    window = result["conversion_window_summary"]

    assert len(headroom_rows) == len(budget_rows) == len(plan["rows"])

    for headroom, safe in zip(headroom_rows, budget_rows):
        expected_safe = max(0.0, float(headroom["headroom_to_target_ceiling"]) - float(safe["safety_buffer"]))
        assert round(float(safe["safe_conversion_budget"]), 2) == round(expected_safe, 2)

    sum_safe_budget = round(sum(float(row["safe_conversion_budget"]) for row in budget_rows), 2)
    assert budget["total_safe_conversion_budget"] == sum_safe_budget

    near_term_expected = round(sum(float(row["safe_conversion_budget"]) for row in budget_rows[:2]), 2)
    assert window["near_term_safe_budget"] == near_term_expected

    sum_recommended = round(sum(float(row["recommended_conversion"]) for row in plan["rows"]), 2)
    assert plan["total_recommended_conversion"] == sum_recommended
    assert plan["remaining_traditional_balance"] == round(170_000 - sum_recommended, 2)
