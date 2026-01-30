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
    assert "scenarios" in data
    assert "profile_name" in data


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
    assert "profile_name" in data


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
