"""Tests for RebalancingService."""

from src.services.rebalancing_service import RebalancingService


def test_calculate_current_allocation():
    assets = {
        "retirement_accounts": [
            {
                "name": "IRA",
                "value": 100000,
                "stock_pct": 0.8,
                "bond_pct": 0.2,
                "cash_pct": 0.0,
            }
        ],
        "taxable_accounts": [
            {
                "name": "Brokerage",
                "value": 100000,
                "stock_pct": 0.4,
                "bond_pct": 0.6,
                "cash_pct": 0.0,
            }
        ],
    }

    service = RebalancingService(assets)
    result = service.calculate_current_allocation()

    assert result["total_value"] == 200000
    assert result["allocation"]["stocks"] == 0.6  # (80k + 40k) / 200k
    assert result["allocation"]["bonds"] == 0.4  # (20k + 60k) / 200k


def test_suggest_rebalancing():
    assets = {
        "retirement_accounts": [
            {
                "name": "IRA",
                "value": 100000,
                "stock_pct": 1.0,
                "bond_pct": 0.0,
                "cash_pct": 0.0,
            }
        ]
    }

    service = RebalancingService(assets)
    target = {"stocks": 0.6, "bonds": 0.4, "cash": 0.0}

    result = service.suggest_rebalancing(target)

    assert result["total_value"] == 100000
    assert result["current_allocation"]["stocks"] == 1.0
    assert result["imbalance_dollars"]["stocks"] == -40000  # Need to sell 40k stocks
    assert result["imbalance_dollars"]["bonds"] == 40000  # Need to buy 40k bonds
    assert any("Sell $40,000 of Stocks" in r for r in result["recommendations"])
    assert any("Buy $40,000 of Bonds" in r for r in result["recommendations"])
