"""Tests for analysis routes with market periods support."""

import pytest
import json
from datetime import datetime
from src.routes.analysis import AnalysisRequestSchema, HealthcarePlanningRequestSchema


class TestAnalysisRequestSchema:
    """Tests for AnalysisRequestSchema validation."""

    def test_basic_request_validation(self):
        """Basic request should validate successfully."""
        data = {
            "profile_name": "test_profile",
            "simulations": 10000,
            "spending_model": "constant_real",
        }
        request = AnalysisRequestSchema(**data)
        assert request.profile_name == "test_profile"
        assert request.simulations == 10000
        assert request.spending_model == "constant_real"

    def test_simulations_must_be_in_range(self):
        """Simulations outside range should fail validation."""
        # Too low
        with pytest.raises(ValueError):
            AnalysisRequestSchema(
                profile_name="test", simulations=50  # Below minimum of 100
            )

        # Too high
        with pytest.raises(ValueError):
            AnalysisRequestSchema(
                profile_name="test", simulations=100000  # Above maximum of 50,000
            )

    def test_simulations_defaults_when_missing_or_invalid(self):
        """Invalid simulation inputs should normalize to default."""
        request_none = AnalysisRequestSchema(profile_name="test", simulations=None)
        assert request_none.simulations == 10000

        request_empty = AnalysisRequestSchema(profile_name="test", simulations="")
        assert request_empty.simulations == 10000

        request_bad = AnalysisRequestSchema(profile_name="test", simulations="not-a-number")
        assert request_bad.simulations == 10000

    def test_simulations_parses_comma_string(self):
        """Simulation string with separators should parse correctly."""
        request = AnalysisRequestSchema(profile_name="test", simulations="10,000")
        assert request.simulations == 10000

    def test_market_profile_accepted(self):
        """Market profile should be accepted and stored."""
        data = {
            "profile_name": "test_profile",
            "market_profile": {
                "stock_return_mean": 0.10,
                "stock_return_std": 0.18,
                "bond_return_mean": 0.04,
                "bond_return_std": 0.06,
                "inflation_mean": 0.03,
                "inflation_std": 0.01,
            },
        }
        request = AnalysisRequestSchema(**data)
        assert request.market_profile is not None
        assert request.market_profile.stock_return_mean == 0.10

    def test_market_periods_timeline_accepted(self):
        """Timeline market periods should be accepted."""
        data = {
            "profile_name": "test_profile",
            "market_periods": {
                "type": "timeline",
                "periods": [
                    {
                        "start_year": 2024,
                        "end_year": 2026,
                        "assumptions": {
                            "stock_return_mean": -0.30,
                            "stock_return_std": 0.38,
                            "bond_return_mean": 0.055,
                            "bond_return_std": 0.08,
                            "inflation_mean": -0.004,
                            "inflation_std": 0.01,
                        },
                    },
                    {
                        "start_year": 2027,
                        "end_year": 2035,
                        "assumptions": {
                            "stock_return_mean": 0.10,
                            "stock_return_std": 0.18,
                            "bond_return_mean": 0.04,
                            "bond_return_std": 0.06,
                            "inflation_mean": 0.03,
                            "inflation_std": 0.01,
                        },
                    },
                ],
            },
        }
        request = AnalysisRequestSchema(**data)
        assert request.market_periods is not None
        assert request.market_periods.type == "timeline"
        assert len(request.market_periods.periods) == 2

    def test_market_periods_cycle_accepted(self):
        """Cycle market periods should be accepted."""
        data = {
            "profile_name": "test_profile",
            "market_periods": {
                "type": "cycle",
                "repeat": True,
                "pattern": [
                    {
                        "duration": 7,
                        "assumptions": {
                            "stock_return_mean": 0.18,
                            "stock_return_std": 0.14,
                            "bond_return_mean": 0.035,
                            "bond_return_std": 0.05,
                            "inflation_mean": 0.025,
                            "inflation_std": 0.01,
                        },
                    },
                    {
                        "duration": 2,
                        "assumptions": {
                            "stock_return_mean": 0.02,
                            "stock_return_std": 0.22,
                            "bond_return_mean": 0.04,
                            "bond_return_std": 0.06,
                            "inflation_mean": 0.015,
                            "inflation_std": 0.01,
                        },
                    },
                ],
            },
        }
        request = AnalysisRequestSchema(**data)
        assert request.market_periods is not None
        assert request.market_periods.type == "cycle"
        assert request.market_periods.repeat is True
        assert len(request.market_periods.pattern) == 2


class TestHealthcarePlanningRequestSchema:
    """Validation tests for healthcare planning endpoint contract."""

    def test_default_values(self):
        request = HealthcarePlanningRequestSchema(profile_name="test_profile")
        assert request.years == 20
        assert request.medical_inflation == 0.055
        assert request.income_growth == 0.02

    def test_years_range(self):
        with pytest.raises(ValueError):
            HealthcarePlanningRequestSchema(profile_name="test_profile", years=0)
        with pytest.raises(ValueError):
            HealthcarePlanningRequestSchema(profile_name="test_profile", years=41)

    def test_rate_range(self):
        with pytest.raises(ValueError):
            HealthcarePlanningRequestSchema(
                profile_name="test_profile", medical_inflation=0.30
            )


# Integration tests would go here if we had Flask test client setup
# These would test the full /api/analysis endpoint with market periods
# For now, schema validation tests above ensure the API contract is correct


def test_calculation_report_includes_projection_attribution(client, test_user, test_profile):
    """Calculation report should include deterministic portfolio attribution details."""
    login_res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis/calculation-report",
        json={"profile_name": "Test Profile"},
    )
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["profile_name"] == "Test Profile"
    assert isinstance(payload.get("sections"), list)
    assert isinstance(payload.get("projection_yearly"), list)

    titles = [s.get("title") for s in payload["sections"]]
    assert "Portfolio Projection Attribution" in titles


def test_healthcare_planning_projection_endpoint(client, test_user, test_profile):
    """Healthcare planning endpoint returns deterministic projection payload."""
    login_res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis/healthcare-planning",
        json={"profile_name": "Test Profile", "years": 5},
    )
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["profile_name"] == "Test Profile"
    assert "assumptions" in payload
    assert payload["assumptions"]["projection_years"] == 5
    assert isinstance(payload.get("projection"), list)
    assert len(payload["projection"]) == 5
    assert "total_healthcare_cost" in payload["projection"][0]
