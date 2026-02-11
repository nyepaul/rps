"""
Integration tests for tax optimization routes
"""

import pytest


def test_get_tax_snapshot(client, test_user, test_profile):
    """Test getting tax snapshot."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/snapshot", json={"profile_name": "Test Profile"}
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "summary" in data
    assert "taxes" in data
    assert "rates" in data
    assert "profile_name" in data


def test_analyze_comprehensive(client, test_user, test_profile):
    """Test comprehensive tax analysis."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/analyze",
        json={"profile_name": "Test Profile", "filing_status": "mfj", "state": "CA"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "snapshot" in data
    assert "social_security_analysis" in data
    assert "household" in data["social_security_analysis"]
    assert "top_strategies" in data["social_security_analysis"]["household"]
    if data["social_security_analysis"]["household"]["top_strategies"]:
        top = data["social_security_analysis"]["household"]["top_strategies"][0]
        assert "combined_lifetime_benefit_with_spousal_floor" in top
    assert "roth_conversion" in data
    assert "rmd_analysis" in data
    assert "state_comparison" in data
    assert "recommendations" in data


def test_analyze_roth_conversion(client, test_user, test_profile):
    """Test Roth conversion analysis."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/roth-conversion",
        json={"profile_name": "Test Profile", "filing_status": "mfj"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "bracket_space" in data
    assert "bracket_targets" in data
    assert "precision_recommendations" in data
    assert "bracket_headroom_projection" in data
    assert "annual_safe_conversion_budget" in data
    assert "scenarios" in data
    assert "conversion_ladder_5y" in data
    assert "rows" in data["conversion_ladder_5y"]
    assert "ladder_variants" in data
    assert data["ladder_variants"]["recommended"] in {"conservative", "balanced", "aggressive"}
    assert "profile_name" in data


def test_analyze_roth_conversion_with_ladder_options(client, test_user, test_profile):
    """Roth conversion endpoint should accept ladder assumptions overrides."""
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/roth-conversion",
        json={
            "profile_name": "Test Profile",
            "ladder_years": 3,
            "ladder_growth_rate": 0.02,
            "ladder_max_rate": 0.22,
            "ladder_income_growth_rate": 0.03,
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["conversion_ladder_5y"]["years_modeled"] == 3
    assert data["conversion_ladder_5y"]["annual_growth_assumption"] == 0.02
    assert data["conversion_ladder_5y"]["max_marginal_rate_target"] == 0.22
    assert data["conversion_ladder_5y"]["income_growth_assumption"] == 0.03


def test_analyze_social_security(client, test_user, test_profile):
    """Test Social Security timing analysis."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/social-security-timing",
        json={"profile_name": "Test Profile", "life_expectancy": 90},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "analyses" in data
    assert "optimal" in data
    assert "comparison" in data
    assert "primary_analysis" in data
    assert "household_analysis" in data
    assert "adjustments" in data
    assert "tax_torpedo" in data
    assert "profile_name" in data


def test_analyze_social_security_zero_pia(client, test_user, test_profile):
    """Zero SS benefit should not fail analysis with division by zero."""
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    profile_data = test_profile.data_dict or {}
    financial = profile_data.get("financial", {})
    financial["social_security_benefit"] = 0
    profile_data["financial"] = financial
    test_profile.data_dict = profile_data
    test_profile.save()

    response = client.post(
        "/api/tax-optimization/social-security-timing",
        json={"profile_name": "Test Profile", "life_expectancy": 90},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "analyses" in data
    assert data["profile_name"] == "Test Profile"


def test_analyze_social_security_includes_spouse_strategy(client, test_user, test_profile):
    """Social Security timing should include spouse and household strategy data when spouse exists."""
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    profile_data = test_profile.data_dict or {}
    profile_data["spouse"] = {
        "name": "Test Spouse",
        "current_age": 62,
        "social_security_benefit": 2200,
        "life_expectancy": 90,
    }
    test_profile.data_dict = profile_data
    test_profile.save()

    response = client.post(
        "/api/tax-optimization/social-security-timing",
        json={"profile_name": "Test Profile", "life_expectancy": 90},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["spouse_analysis"] is not None
    assert "strategy_matrix" in data["household_analysis"]
    assert len(data["household_analysis"]["strategy_matrix"]) > 0


def test_analyze_social_security_with_wep_gpo_and_earnings_options(client, test_user, test_profile):
    """Timing endpoint should accept WEP/GPO/earnings options and return adjustment metadata."""
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/social-security-timing",
        json={
            "profile_name": "Test Profile",
            "life_expectancy": 90,
            "annual_earned_income": 50000,
            "apply_wep": True,
            "apply_gpo": True,
            "noncovered_pension_annual": 24000,
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "adjustments" in data
    assert data["adjustments"]["wep"]["pia_after_wep"] <= data["adjustments"]["wep"]["pia_before_wep"]
    assert data["adjustments"]["gpo_offset_monthly"] > 0
    assert "tax_torpedo" in data


def test_state_comparison(client, test_user, test_profile):
    """Test state tax comparison."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/state-comparison", json={"profile_name": "Test Profile"}
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "comparison" in data
    assert "current_state" in data
    assert "taxable_income" in data
    assert len(data["comparison"]) > 0


def test_rmd_projection(client, test_user, test_profile):
    """Test RMD projection."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/rmd-projection",
        json={"profile_name": "Test Profile", "growth_rate": 0.05, "years": 20},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert "current" in data
    assert "projections" in data
    assert "summary" in data
    assert "qcd_planning" in data
    assert "qcd_projection" in data
    assert "profile_name" in data


def test_tax_optimization_requires_auth(client):
    """Test that tax optimization endpoints require authentication."""
    response = client.post(
        "/api/tax-optimization/snapshot", json={"profile_name": "Test Profile"}
    )

    # Flask-Login returns 302 redirect to login page when not authenticated
    assert response.status_code == 302


def test_tax_optimization_missing_profile(client, test_user):
    """Test tax optimization with non-existent profile."""
    # Login
    client.post(
        "/api/auth/login", json={"username": "testuser", "password": "TestPass123"}
    )

    response = client.post(
        "/api/tax-optimization/snapshot", json={"profile_name": "Nonexistent Profile"}
    )

    assert response.status_code == 404
