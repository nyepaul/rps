"""Tests for phase1 planning helper service."""

from src.services.phase1_planning_service import (
    build_debt_payoff_strategy,
    estimate_life_insurance_needs,
    generate_sequence_offsets,
    summarize_sequence_impact,
)


def test_estimate_life_insurance_needs_returns_expected_sections():
    profile_data = {
        "person": {"current_age": 45},
        "financial": {"annual_income": 120000, "annual_expenses": 80000},
        "children": [{"name": "Child A"}],
        "assets": {
            "liabilities": [{"value": 250000}],
            "other_assets": [{"type": "insurance", "coverage": 200000}],
        },
    }
    result = estimate_life_insurance_needs(profile_data)

    assert result["available"] is True
    assert "inputs" in result
    assert "needs" in result
    assert "coverage" in result
    assert "recommendations" in result
    assert result["needs"]["total_coverage_need"] > 0
    assert result["coverage"]["existing_coverage"] >= 200000


def test_generate_sequence_offsets_returns_unique_offsets_within_range():
    offsets = generate_sequence_offsets(years=30, retirement_offset=5)
    assert len(offsets) >= 2

    values = [entry["offset"] for entry in offsets]
    assert len(values) == len(set(values))
    assert min(values) >= 0
    assert max(values) <= 28  # years - 2


def test_summarize_sequence_impact_identifies_worst_case():
    cases = [
        {
            "label": "Early retirement crash",
            "success_rate_delta": -0.11,
            "median_final_balance_delta": -220000.0,
        },
        {
            "label": "Mid-retirement crash",
            "success_rate_delta": -0.06,
            "median_final_balance_delta": -140000.0,
        },
    ]
    summary = summarize_sequence_impact(0.9, 1000000.0, cases)

    assert summary["most_vulnerable_period"] == "Early retirement crash"
    assert summary["max_success_drop"] == 0.11
    assert summary["max_median_drop"] == 220000.0
    assert "Worst timing impact" in summary["summary"]


def test_build_debt_payoff_strategy_prefers_avalanche_with_high_interest_debt():
    profile_data = {
        "assets": {
            "liabilities": [
                {
                    "name": "Credit Card",
                    "type": "credit_card",
                    "value": 15000,
                    "interest_rate": 22,
                    "monthly_payment": 450,
                },
                {
                    "name": "Auto Loan",
                    "type": "auto_loan",
                    "value": 28000,
                    "interest_rate": 5.9,
                    "monthly_payment": 520,
                },
            ]
        }
    }
    result = build_debt_payoff_strategy(profile_data)
    assert result["available"] is True
    assert result["recommended_strategy"] == "avalanche"
    assert result["total_debt"] == 43000.0
    assert result["avalanche_order"][0]["name"] == "Credit Card"
