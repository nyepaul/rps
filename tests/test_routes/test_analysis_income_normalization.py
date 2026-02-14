import pytest


from src.routes.analysis import _prepare_budget_and_income_streams


def test_budget_income_present_but_no_employment_keeps_stream_employment_via_synthesis():
    profile_data = {
        "budget": {"income": {"current": {}, "future": {}}},
        "income_streams": [
            {
                "name": "Primary Salary",
                "amount": 5000,
                "frequency": "monthly",
                "type": "salary",
                "start_date": "2024-01-01",
                "end_date": "",
            }
        ],
    }
    spouse_data = {}

    budget, streams = _prepare_budget_and_income_streams(profile_data, spouse_data)

    # Salary should be synthesized into budget employment as annual dollars.
    assert budget["income"]["current"]["employment"]["primary_person"] == pytest.approx(
        5000 * 12
    )
    assert budget["income"]["current"]["employment"]["spouse"] == pytest.approx(0)

    # Employment stream should be stripped after synthesis so it is not double-counted.
    assert streams == []


def test_budget_income_present_with_employment_does_not_override_and_strips_streams():
    profile_data = {
        "budget": {
            "income": {"current": {"employment": {"primary_person": 120000, "spouse": 0}}}
        },
        "income_streams": [
            {
                "name": "Primary Salary",
                "amount": 5000,
                "frequency": "monthly",
                "type": "salary",
                "start_date": "2024-01-01",
                "end_date": "",
            }
        ],
    }
    spouse_data = {}

    budget, streams = _prepare_budget_and_income_streams(profile_data, spouse_data)

    assert budget["income"]["current"]["employment"]["primary_person"] == pytest.approx(
        120000
    )
    assert streams == []

