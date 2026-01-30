"""Tests for analysis routes with market periods support."""

import pytest
import json
from datetime import datetime
from src.routes.analysis import AnalysisRequestSchema


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
        assert request.market_periods["type"] == "timeline"
        assert len(request.market_periods["periods"]) == 2

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
        assert request.market_periods["type"] == "cycle"
        assert request.market_periods["repeat"] is True
        assert len(request.market_periods["pattern"]) == 2


# Integration tests would go here if we had Flask test client setup
# These would test the full /api/analysis endpoint with market periods
# For now, schema validation tests above ensure the API contract is correct
