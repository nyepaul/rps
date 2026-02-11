"""Unit tests for healthcare planning service."""

import pytest

from src.services.healthcare_planning_service import HealthcarePlanningService


def test_hsa_balance_is_inferred_from_profile_assets():
    profile_data = {
        "financial": {"hsa_balance": 1000},
        "assets": {
            "other_assets": [
                {"type": "hsa", "value": 2500},
                {"type": "brokerage", "value": 9999},
                {"type": "HSA", "value": 1500},
            ]
        },
    }
    service = HealthcarePlanningService()
    assert service.infer_hsa_balance(profile_data) == 5000


def test_hsa_offsets_healthcare_costs_and_tracks_remaining_balance():
    service = HealthcarePlanningService(filing_status="single", tax_year=2026)
    result = service.project(
        current_age=66,
        spouse_age=None,
        years=1,
        inflation_medical=0.0,
        income_growth=0.0,
        base_magi=100000,
        base_out_of_pocket=6000,
        initial_hsa_balance=12000,
        annual_hsa_contribution=0,
        hsa_growth=0.0,
    )

    row = result["projection"][0]
    assert row["medicare_part_a"] == 0.0
    assert row["hsa_applied"] > 0
    assert row["net_healthcare_cost"] < row["total_healthcare_cost"]
    assert row["remaining_hsa_balance"] == pytest.approx(12000 - row["hsa_applied"], rel=1e-6)
