"""Tests for analysis routes with market periods support."""

import pytest
import json
from datetime import datetime
from src.routes.analysis import AnalysisRequestSchema, HealthcarePlanningRequestSchema
from src.models.profile import Profile
from src.services.retirement_model import RetirementModel


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
    assert "medicare_part_a" in payload["projection"][0]
    assert "hsa_applied" in payload["projection"][0]
    assert "net_healthcare_cost" in payload["projection"][0]


def test_analysis_includes_phase1_planning_fields(client, test_user, test_profile):
    """Analysis endpoint should include life insurance and sequence risk sections."""
    login_res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis",
        json={
            "profile_name": "Test Profile",
            "simulations": 100,
            "spending_model": "constant_real",
        },
    )
    assert response.status_code == 200

    payload = response.get_json()
    assert "life_insurance_estimate" in payload
    assert payload["life_insurance_estimate"]["available"] is True
    assert "debt_management_plan" in payload
    assert "available" in payload["debt_management_plan"]
    assert "college_529_plan" in payload
    assert "available" in payload["college_529_plan"]
    assert "pension_lump_sum_analysis" in payload
    assert "available" in payload["pension_lump_sum_analysis"]
    assert "estate_tax_gifting_strategy" in payload
    assert "available" in payload["estate_tax_gifting_strategy"]
    assert "investment_fee_impact" in payload
    assert "available" in payload["investment_fee_impact"]
    assert "part_time_retirement_model" in payload
    assert "available" in payload["part_time_retirement_model"]
    assert "real_estate_enhancements" in payload
    assert "available" in payload["real_estate_enhancements"]
    assert "advanced_scenario_analysis" in payload
    assert "available" in payload["advanced_scenario_analysis"]
    assert "dynamic_withdrawal_strategies" in payload
    assert "available" in payload["dynamic_withdrawal_strategies"]
    assert "life_event_scenario_modeling" in payload
    assert "available" in payload["life_event_scenario_modeling"]
    assert "disability_income_protection" in payload
    assert "available" in payload["disability_income_protection"]
    assert "long_term_care_analysis" in payload
    assert "available" in payload["long_term_care_analysis"]
    assert "business_owner_retirement_planning" in payload
    assert "available" in payload["business_owner_retirement_planning"]
    assert "secure_act_beneficiary_ira" in payload
    assert "available" in payload["secure_act_beneficiary_ira"]
    assert "annuity_comparison_tool" in payload
    assert "available" in payload["annuity_comparison_tool"]
    assert "cashflow_budget_enhancements" in payload
    assert "available" in payload["cashflow_budget_enhancements"]
    assert "retirement_lifestyle_planning" in payload
    assert "available" in payload["retirement_lifestyle_planning"]
    assert "document_vault_beneficiary_tracking" in payload
    assert "available" in payload["document_vault_beneficiary_tracking"]
    assert "advanced_investment_factor_analysis" in payload
    assert "available" in payload["advanced_investment_factor_analysis"]
    assert "family_legacy_gifting_goals" in payload
    assert "available" in payload["family_legacy_gifting_goals"]
    assert "risk_analysis_dashboard" in payload
    assert "available" in payload["risk_analysis_dashboard"]
    assert "sequence_risk_visualization" in payload
    assert "baseline" in payload["sequence_risk_visualization"]
    assert "cases" in payload["sequence_risk_visualization"]
    assert isinstance(payload["sequence_risk_visualization"]["cases"], list)


def _create_overlap_profile(test_user, name, include_budget_income=False):
    budget = {
        "expenses": {
            "current": {
                "housing": [{"name": "Rent", "amount": 2000, "frequency": "monthly"}],
                "food": [{"name": "Food", "amount": 600, "frequency": "monthly"}],
            }
        }
    }
    if include_budget_income:
        budget["income"] = {
            "current": {
                "employment": {
                    "primary_person": 130000,
                    "spouse": 70000,
                }
            },
            "future": {},
        }

    profile = Profile(
        user_id=test_user.id,
        name=name,
        birth_date="1985-01-01",
        retirement_date="2050-01-01",
        data={
            "person": {
                "name": "Primary Person",
                "birth_date": "1985-01-01",
                "retirement_date": "2050-01-01",
                "life_expectancy": 90,
                "annual_401k_contribution_rate": 0.10,
                "employer_match_rate": 0.04,
            },
            "spouse": {
                "name": "Sam Spouse",
                "birth_date": "1987-01-01",
                "retirement_date": "2052-01-01",
                "annual_401k_contribution_rate": 0.08,
                "employer_match_rate": 0.03,
            },
            "income_streams": [
                {
                    "name": "Primary Salary",
                    "amount": 10000,
                    "frequency": "monthly",
                    "source": "employment",
                    "start_date": "2020-01-01",
                },
                {
                    "name": "Sam Salary",
                    "amount": 5000,
                    "frequency": "monthly",
                    "source": "employment",
                    "owner": "spouse",
                    "start_date": "2020-01-01",
                },
                {
                    "name": "Dividends",
                    "amount": 1000,
                    "frequency": "monthly",
                    "source": "investment",
                    "start_date": "2020-01-01",
                },
            ],
            "budget": budget,
            "assets": {
                "taxable_accounts": [{"name": "Brokerage", "type": "brokerage", "value": 200000, "cost_basis": 150000}],
                "retirement_accounts": [{"name": "401k", "type": "401k", "value": 300000, "cost_basis": 250000}],
            },
            "tax_settings": {"filing_status": "mfj", "state": "NY", "tax_year": 2024},
        },
    )
    profile.save()
    return profile


def test_cashflow_details_avoids_employment_double_count_when_budget_income_missing(client, test_user):
    profile = _create_overlap_profile(test_user, "Overlap Missing Budget Income", include_budget_income=False)
    login_res = client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis/cashflow-details",
        json={"profile_name": profile.name, "simulations": 100, "spending_model": "constant_real"},
    )
    assert response.status_code == 200

    ledger = response.get_json()["ledger"]
    first = ledger[0]
    annual_external_income = (
        first["gross_income"] - first["withdrawals"] - first["liquidation_proceeds"]
    ) * 12
    # 120k + 60k employment + 12k dividends
    assert annual_external_income == pytest.approx(192000, abs=1.0)


def test_cashflow_details_uses_budget_employment_once_when_present(client, test_user):
    profile = _create_overlap_profile(test_user, "Overlap Explicit Budget Income", include_budget_income=True)
    login_res = client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis/cashflow-details",
        json={"profile_name": profile.name, "simulations": 100, "spending_model": "constant_real"},
    )
    assert response.status_code == 200

    ledger = response.get_json()["ledger"]
    first = ledger[0]
    annual_external_income = (
        first["gross_income"] - first["withdrawals"] - first["liquidation_proceeds"]
    ) * 12
    # budget employment (130k + 70k) + 12k dividends (from stream)
    assert annual_external_income == pytest.approx(212000, abs=1.0)


def test_cashflow_details_counts_income_stream_with_missing_start_date(client, test_user):
    """Regression: missing start_date should not silently drop income in cashflow-details."""
    profile = Profile(
        user_id=test_user.id,
        name="Missing Start Date Income",
        birth_date="1985-01-01",
        retirement_date="2050-01-01",
        data={
            "person": {"name": "Primary", "life_expectancy": 90},
            "spouse": {},
            "assets": {
                "taxable_accounts": [{"name": "Checking", "type": "checking", "value": 0, "cost_basis": 0}],
                "retirement_accounts": [],
            },
            # Use non-employment stream so budget employment synthesis doesn't matter.
            "income_streams": [
                {
                    "name": "Other Income",
                    "amount": 1000,
                    "frequency": "monthly",
                    "type": "other",
                    "start_date": None,
                    "end_date": None,
                    "inflation_adjusted": False,
                }
            ],
            "budget": {
                "expenses": {"current": {"other": [{"name": "Zero", "amount": 0, "frequency": "monthly"}]}},
            },
            "tax_settings": {"filing_status": "single", "state": "NY", "tax_year": 2024},
        },
    )
    profile.save()

    login_res = client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )
    assert login_res.status_code == 200

    response = client.post(
        "/api/analysis/cashflow-details",
        json={"profile_name": profile.name, "simulations": 100, "spending_model": "constant_real"},
    )
    assert response.status_code == 200
    ledger = response.get_json()["ledger"]
    assert ledger

    # With no expenses and no taxes on small income, month 1 gross should ~= 1000
    assert ledger[0]["gross_income"] == pytest.approx(1000.0, abs=0.5)


def test_analysis_profile_strips_employment_streams_when_budget_income_synthesized(client, test_user, monkeypatch):
    profile = _create_overlap_profile(test_user, "Run Analysis Overlap Missing Income", include_budget_income=False)
    login_res = client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})
    assert login_res.status_code == 200

    captured = []

    def fake_monte_carlo(
        self,
        years,
        simulations,
        assumptions,
        spending_model="constant_real",
        market_periods=None,
        **kwargs,
    ):
        captured.append(
            {
                "streams": list(self.profile.income_streams or []),
                "has_budget_income": bool((self.profile.budget or {}).get("income")),
            }
        )
        return {
            "success_rate": 0.85,
            "median_final_balance": 1000000.0,
            "percentile_10": 500000.0,
            "percentile_90": 1500000.0,
            "expected_value": 1050000.0,
            "std_deviation": 100000.0,
            "starting_portfolio": 500000.0,
            "annual_withdrawal_need": 0.0,
            "simulations": simulations,
            "timeline": {"years": [2026], "p5": [500000.0], "median": [1000000.0], "p95": [1500000.0]},
            "warnings": [],
            "recommendations": [],
        }

    monkeypatch.setattr(RetirementModel, "monte_carlo_simulation", fake_monte_carlo)

    response = client.post(
        "/api/analysis",
        json={"profile_name": profile.name, "simulations": 100, "spending_model": "constant_real"},
    )
    assert response.status_code == 200
    assert captured

    for call in captured:
        assert call["has_budget_income"] is True
        assert all(
            (s.get("source") not in ("employment",))
            and (s.get("type") not in ("salary", "hourly", "wages", "bonus"))
            for s in call["streams"]
        )


def test_analysis_profile_strips_employment_streams_when_budget_income_exists(client, test_user, monkeypatch):
    profile = _create_overlap_profile(test_user, "Run Analysis Overlap Explicit Income", include_budget_income=True)
    login_res = client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})
    assert login_res.status_code == 200

    captured = []

    def fake_monte_carlo(
        self,
        years,
        simulations,
        assumptions,
        spending_model="constant_real",
        market_periods=None,
        **kwargs,
    ):
        captured.append(list(self.profile.income_streams or []))
        return {
            "success_rate": 0.85,
            "median_final_balance": 1000000.0,
            "percentile_10": 500000.0,
            "percentile_90": 1500000.0,
            "expected_value": 1050000.0,
            "std_deviation": 100000.0,
            "starting_portfolio": 500000.0,
            "annual_withdrawal_need": 0.0,
            "simulations": simulations,
            "timeline": {"years": [2026], "p5": [500000.0], "median": [1000000.0], "p95": [1500000.0]},
            "warnings": [],
            "recommendations": [],
        }

    monkeypatch.setattr(RetirementModel, "monte_carlo_simulation", fake_monte_carlo)

    response = client.post(
        "/api/analysis",
        json={"profile_name": profile.name, "simulations": 100, "spending_model": "constant_real"},
    )
    assert response.status_code == 200
    assert captured
    for streams in captured:
        assert all(
            (s.get("source") not in ("employment",))
            and (s.get("type") not in ("salary", "hourly", "wages", "bonus"))
            for s in streams
        )


def test_transform_assets_preserves_management_fee_rate():
    """transform_assets_to_investment_types should carry management_fee_rate through."""
    from src.routes.analysis import transform_assets_to_investment_types
    assets = {
        "retirement_accounts": [
            {"type": "traditional_ira", "value": 200000, "management_fee_rate": 1.0},
            {"type": "roth_ira", "value": 100000},
        ],
        "taxable_accounts": [
            {"type": "brokerage", "value": 50000, "management_fee_rate": 0.5},
        ],
    }
    result = transform_assets_to_investment_types(assets)
    ira = next(r for r in result if r["account"] == "Traditional IRA")
    assert ira["management_fee_rate"] == 1.0
    brokerage = next(r for r in result if r["account"] == "Taxable Brokerage")
    assert brokerage["management_fee_rate"] == 0.5
    roth = next(r for r in result if r["account"] == "Roth IRA" and r.get("management_fee_rate", 0) == 0)
    assert roth is not None


def test_compute_weighted_fee_drag():
    """Weighted average of management fees across portfolio."""
    from src.routes.analysis import compute_management_fee_drag
    investment_types = [
        {"value": 200000, "management_fee_rate": 1.0},  # 1% on 200k
        {"value": 100000, "management_fee_rate": 0.0},  # no fee on 100k
        {"value": 100000, "management_fee_rate": 0.5},  # 0.5% on 100k
    ]
    # Total = 400k. Fee = 200k*0.01 + 100k*0.005 = 2000 + 500 = 2500
    # Drag = 2500 / 400000 = 0.00625 (decimal)
    drag = compute_management_fee_drag(investment_types)
    assert abs(drag - 0.00625) < 1e-9

def test_compute_weighted_fee_drag_no_assets():
    from src.routes.analysis import compute_management_fee_drag
    assert compute_management_fee_drag([]) == 0.0

def test_compute_weighted_fee_drag_no_fees():
    from src.routes.analysis import compute_management_fee_drag
    investment_types = [{"value": 500000, "management_fee_rate": 0}]
    assert compute_management_fee_drag(investment_types) == 0.0
