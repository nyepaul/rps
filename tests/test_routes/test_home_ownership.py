"""
Integration tests for Home Ownership (Rent vs. Own) routes.
"""


def _scenario_parameters():
    return {
        "type": "rent_vs_own",
        "name": "Rent vs Own Test",
        "time_horizon_years": 10,
        "opportunity_cost_investment_return_pct": 0.07,
        "own_scenario": {
            "purchase_price": 500000,
            "down_payment_pct": 0.20,
            "mortgage_term_years": 30,
            "interest_rate_pct": 0.05,
            "property_tax_rate_pct": 0.012,
            "home_insurance_annual": 1800,
            "maintenance_annual_pct": 0.01,
            "appreciation_annual_pct": 0.03,
            "closing_costs_pct": 0.03,
        },
        "rent_scenario": {
            "initial_monthly_rent": 2200,
            "annual_rent_increase_pct": 0.03,
        },
    }


def test_create_home_ownership_scenario(client, test_user, test_profile):
    """Should create and analyze a rent-vs-own scenario for the logged-in user."""
    client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})

    response = client.post(
        "/api/home-ownership/scenario",
        json={
            "profile_name": test_profile.name,
            "name": "Rent vs Own - Primary",
            "parameters": _scenario_parameters(),
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert data["scenario"]["name"] == "Rent vs Own - Primary"
    assert data["scenario"]["parameters"]["type"] == "rent_vs_own"
    assert "summary" in data["scenario"]["results"]


def test_list_home_ownership_scenarios_filters_by_type(client, test_user, test_profile):
    """List endpoint should only return scenarios marked as rent_vs_own."""
    client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})

    # Create one rent-vs-own scenario
    create_response = client.post(
        "/api/home-ownership/scenario",
        json={
            "profile_name": test_profile.name,
            "name": "Rent vs Own - Listed",
            "parameters": _scenario_parameters(),
        },
    )
    assert create_response.status_code == 201

    list_response = client.get("/api/home-ownership/scenarios")
    assert list_response.status_code == 200
    scenarios = list_response.get_json()["scenarios"]
    assert len(scenarios) == 1
    assert scenarios[0]["parameters"]["type"] == "rent_vs_own"


def test_get_home_ownership_scenario_rejects_non_rent_vs_own(client, test_user, test_profile):
    """Get endpoint should reject non-rent-vs-own scenarios."""
    from src.models.scenario import Scenario

    client.post("/api/auth/login", json={"username": "testuser", "password": "TestPass123"})

    other = Scenario(
        user_id=test_user.id,
        profile_id=test_profile.id,
        name="Other Scenario",
        parameters={"type": "something_else"},
        results={"ok": True},
    )
    other.save()

    response = client.get(f"/api/home-ownership/scenario/{other.id}")
    assert response.status_code == 404

