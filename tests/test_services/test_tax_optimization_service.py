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

