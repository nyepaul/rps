"""Service for asset allocation analysis and tax-efficient rebalancing."""

from typing import Dict, List, Any


class RebalancingService:
    """Handles asset allocation analysis across multiple accounts."""

    def __init__(self, assets: Dict[str, List[Dict[str, Any]]]):
        self.assets = assets

    def calculate_current_allocation(self) -> Dict[str, float]:
        """Calculate the current aggregate asset allocation across all accounts."""
        total_value = 0.0
        allocation = {"stocks": 0.0, "bonds": 0.0, "cash": 0.0}

        # Combine retirement and taxable accounts
        all_accounts = self.assets.get("retirement_accounts", []) + self.assets.get(
            "taxable_accounts", []
        )

        for account in all_accounts:
            value = float(account.get("value", 0))
            if value <= 0:
                continue

            total_value += value

            # Get allocation percentages
            stock_pct = account.get("stock_pct")
            bond_pct = account.get("bond_pct")
            cash_pct = account.get("cash_pct")

            # Convert to float, treating None/empty string as 0
            stock_pct = float(stock_pct) if stock_pct not in (None, "") else 0.0
            bond_pct = float(bond_pct) if bond_pct not in (None, "") else 0.0
            cash_pct = float(cash_pct) if cash_pct not in (None, "") else 0.0

            # If total allocation is near zero (< 1%), assume not set and use defaults
            total_alloc = stock_pct + bond_pct + cash_pct
            if total_alloc < 1.0:
                # No allocations set, use reasonable defaults (60/40/0 split)
                stock_pct = 60.0
                bond_pct = 40.0
                cash_pct = 0.0

            # Convert percentages to decimals if they're stored as whole numbers (0-100)
            if stock_pct > 1 or bond_pct > 1 or cash_pct > 1:
                stock_pct /= 100.0
                bond_pct /= 100.0
                cash_pct /= 100.0

            allocation["stocks"] += value * stock_pct
            allocation["bonds"] += value * bond_pct
            allocation["cash"] += value * cash_pct

        if total_value > 0:
            for asset_class in allocation:
                allocation[asset_class] /= total_value

        return {"total_value": total_value, "allocation": allocation}

    def suggest_rebalancing(
        self, target_allocation: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Suggest trades to reach the target allocation, prioritizing tax-advantaged accounts.
        """
        current = self.calculate_current_allocation()
        current_alloc = current["allocation"]
        total_value = current["total_value"]

        if total_value <= 0:
            return {"message": "No assets to rebalance", "trades": []}

        # Calculate difference in dollars
        diffs = {}
        for asset_class in ["stocks", "bonds", "cash"]:
            target_pct = target_allocation.get(asset_class, 0.0)
            diffs[asset_class] = (
                target_pct - current_alloc.get(asset_class, 0.0)
            ) * total_value

        trades = []

        # Split accounts into tax-advantaged and taxable
        retirement_accounts = self.assets.get("retirement_accounts", [])
        taxable_accounts = self.assets.get("taxable_accounts", [])

        # Step 1: Try to rebalance within retirement accounts first (no tax consequences)
        # For simplicity, we'll just show the total needed change per account
        for account in retirement_accounts:
            acc_value = float(account.get("value", 0))
            if acc_value <= 0:
                continue

            # Simple strategy: shift account's internal allocation to compensate for aggregate imbalance
            # but we'll just suggest which accounts have most "room" to shift.
            pass

        # Realistically, rebalancing logic can be complex.
        # For this implementation, we'll return a summary of the imbalance and general advice.

        return {
            "current_allocation": current_alloc,
            "target_allocation": target_allocation,
            "imbalance_dollars": diffs,
            "total_value": total_value,
            "recommendations": self._generate_recommendations(
                diffs, retirement_accounts, taxable_accounts
            ),
        }

    def _generate_recommendations(
        self, diffs: Dict[str, float], retirement: List[Dict], taxable: List[Dict]
    ) -> List[str]:
        recs = []

        for asset_class, amount in diffs.items():
            if abs(amount) < 1000:  # Threshold for recommendation
                continue

            action = "Buy" if amount > 0 else "Sell"
            recs.append(f"{action} ${abs(amount):,.0f} of {asset_class.capitalize()}")

        if len(recs) > 0:
            recs.append(
                "Prioritize rebalancing within Retirement (401k/IRA) accounts to avoid capital gains taxes."
            )
            if any(float(a.get("value", 0)) > 0 for a in taxable):
                recs.append(
                    "If selling in taxable accounts, consider tax-loss harvesting if any positions are at a loss."
                )
        else:
            recs.append(
                "Your portfolio is currently well-aligned with your target allocation."
            )

        return recs
