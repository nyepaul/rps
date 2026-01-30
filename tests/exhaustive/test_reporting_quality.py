import pytest
import io
from src.services.pdf.reports import (
    generate_analysis_report,
    generate_elite_analysis_report,
    generate_portfolio_report,
    generate_action_plan_report,
)


@pytest.fixture
def mock_analysis_results():
    return {
        "simulations": 100,
        "years_projected": 30,
        "total_assets": 1000000,
        "scenarios": {
            "conservative": {
                "success_rate": 85,
                "median_final_balance": 500000,
                "low_percentile": 100000,
                "high_percentile": 2000000,
            },
            "moderate": {
                "success_rate": 92,
                "median_final_balance": 1500000,
                "low_percentile": 300000,
                "high_percentile": 5000000,
            },
            "aggressive": {
                "success_rate": 88,
                "median_final_balance": 3000000,
                "low_percentile": 50000,
                "high_percentile": 15000000,
            },
        },
    }


@pytest.fixture
def mock_profile_data():
    return {
        "name": "Test User",
        "birth_date": "1980-01-01",
        "financial": {"annual_income": 150000, "annual_expenses": 100000},
        "assets": {
            "retirement_accounts": [
                {"name": "IRA", "type": "traditional_ira", "value": 500000}
            ],
            "taxable_accounts": [
                {"name": "Savings", "type": "savings", "value": 100000}
            ],
        },
    }


def test_generate_basic_analysis_report(mock_profile_data, mock_analysis_results):
    """Test generating the basic analysis report."""
    buffer = generate_analysis_report(mock_profile_data, mock_analysis_results)
    assert isinstance(buffer, io.BytesIO)
    assert len(buffer.getvalue()) > 0
    assert buffer.getvalue().startswith(b"%PDF")


def test_generate_elite_analysis_report(mock_profile_data, mock_analysis_results):
    """Test generating the elite analysis report."""
    buffer = generate_elite_analysis_report(mock_profile_data, mock_analysis_results)
    assert isinstance(buffer, io.BytesIO)
    assert len(buffer.getvalue()) > 0
    assert buffer.getvalue().startswith(b"%PDF")


def test_generate_portfolio_report(mock_profile_data):
    """Test generating the portfolio report."""
    buffer = generate_portfolio_report(mock_profile_data)
    assert isinstance(buffer, io.BytesIO)
    assert len(buffer.getvalue()) > 0
    assert buffer.getvalue().startswith(b"%PDF")


def test_generate_action_plan_report(mock_profile_data):
    """Test generating the action plan report."""
    from src.models.action_item import ActionItem

    action_items = [
        ActionItem(
            user_id=1,
            profile_id=1,
            category="Savings",
            description="Build emergency fund",
            priority="high",
        ),
        ActionItem(
            user_id=1,
            profile_id=1,
            category="Estate",
            description="Review will",
            priority="medium",
        ),
    ]
    buffer = generate_action_plan_report(mock_profile_data, action_items)
    assert isinstance(buffer, io.BytesIO)
    assert len(buffer.getvalue()) > 0
    assert buffer.getvalue().startswith(b"%PDF")
