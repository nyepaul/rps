"""
Reconciliation Service
Matches imported data against existing records to detect duplicates and updates.
Uses fuzzy matching for names and tolerance thresholds for amounts.
"""

import difflib
from typing import List, Dict, Any, Optional, Tuple


class ReconciliationService:
    """Service for reconciling imported data with existing records."""

    # Standard Categories for AI context
    valid_categories = {
        "income": [
            "employment",
            "rental_income",
            "part_time_consulting",
            "business_income",
            "investment_income",
            "pension",
            "social_security",
            "other_income",
        ],
        "expense": [
            "housing",
            "utilities",
            "transportation",
            "food",
            "dining_out",
            "healthcare",
            "insurance",
            "travel",
            "entertainment",
            "personal_care",
            "clothing",
            "gifts",
            "childcare_education",
            "charitable_giving",
            "subscriptions",
            "pet_care",
            "home_maintenance",
            "debt_payments",
            "taxes",
            "discretionary",
            "other",
        ],
        "asset": [
            "traditional_ira",
            "roth_ira",
            "401k",
            "403b",
            "457",
            "brokerage",
            "savings",
            "checking",
            "real_estate",
            "other",
        ],
    }

    # Thresholds
    NAME_MATCH_THRESHOLD = 0.80  # 80% similarity required for name match
    AMOUNT_TOLERANCE = 0.05  # 5% difference allowed for amount match

    @staticmethod
    def calculate_match_score(
        item1: Dict[str, Any], item2: Dict[str, Any]
    ) -> Tuple[float, List[str]]:
        """
        Calculate match confidence score between two items.
        Returns: (score 0.0-1.0, list of match reasons)
        """
        score = 0.0
        reasons = []

        # 1. Name Similarity (Weight: 0.6)
        name1 = str(item1.get("name", "")).lower().strip()
        name2 = str(item2.get("name", "")).lower().strip()

        if name1 and name2:
            name_score = difflib.SequenceMatcher(None, name1, name2).ratio()
            if name_score >= ReconciliationService.NAME_MATCH_THRESHOLD:
                score += 0.6 * name_score
                reasons.append(f"Name match ({int(name_score*100)}%)")
            elif name1 in name2 or name2 in name1:
                # Partial containment fallback
                score += 0.4
                reasons.append("Partial name match")

        # 2. Amount Similarity (Weight: 0.4)
        # Handle various amount field names (amount, value, balance)
        val1 = item1.get("amount") or item1.get("value") or item1.get("balance") or 0
        val2 = item2.get("amount") or item2.get("value") or item2.get("balance") or 0

        try:
            v1 = float(val1)
            v2 = float(val2)

            if v1 > 0 and v2 > 0:
                diff = abs(v1 - v2)
                avg = (v1 + v2) / 2
                pct_diff = diff / avg

                if pct_diff <= ReconciliationService.AMOUNT_TOLERANCE:
                    # Perfect match (0% diff) gets full 0.4, 5% diff gets 0.2
                    amount_score = 0.4 * (
                        1 - (pct_diff / ReconciliationService.AMOUNT_TOLERANCE)
                    )
                    score += max(0, amount_score)
                    reasons.append("Amount match")
        except (ValueError, TypeError):
            pass

        # 3. Exact Account Number Match (Bonus: +0.2)
        # If available (mainly for assets)
        acc1 = str(item1.get("account_number", "")).strip()
        acc2 = str(item2.get("account_number", "")).strip()
        if acc1 and acc2 and acc1 == acc2:
            score += 0.2
            reasons.append("Account number match")

        return min(1.0, score), reasons

    @staticmethod
    def reconcile_income(
        existing_streams: List[Dict[str, Any]], imported_items: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Reconcile imported income against existing streams.
        Returns imported items annotated with match status.
        """
        results = []

        for item in imported_items:
            best_match = None
            best_score = 0.0
            match_reasons = []

            for existing in existing_streams:
                score, reasons = ReconciliationService.calculate_match_score(
                    item, existing
                )
                if score > best_score:
                    best_score = score
                    best_match = existing
                    match_reasons = reasons

            result_item = item.copy()
            if best_score >= 0.7:  # Overall threshold
                result_item["match_status"] = "match_found"
                result_item["match_confidence"] = best_score
                result_item["match_reasons"] = match_reasons
                result_item["matched_existing_item"] = best_match
            else:
                result_item["match_status"] = "new"
                result_item["match_confidence"] = 0.0

            results.append(result_item)

        return results

    @staticmethod
    def reconcile_expenses(
        existing_budget: Dict[str, Any], imported_items: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Reconcile imported expenses against existing budget (nested categories).
        Input `existing_budget` should be the 'current' or 'future' dictionary
        containing category keys mapping to lists of expense items.
        """
        results = []

        # Flatten existing expenses for easier matching
        flat_existing = []
        for category, items in existing_budget.items():
            if isinstance(items, list):
                for idx, item in enumerate(items):
                    item_copy = item.copy()
                    item_copy["_category"] = category
                    item_copy["_index"] = idx
                    flat_existing.append(item_copy)

        for item in imported_items:
            best_match = None
            best_score = 0.0
            match_reasons = []

            for existing in flat_existing:
                # Category bonus: +0.1 if categories match
                category_bonus = 0.0
                if (
                    item.get("category")
                    and existing.get("_category")
                    and item["category"].lower() == existing["_category"].lower()
                ):
                    category_bonus = 0.1

                score, reasons = ReconciliationService.calculate_match_score(
                    item, existing
                )
                score += category_bonus

                if score > best_score:
                    best_score = score
                    best_match = existing
                    match_reasons = reasons

            result_item = item.copy()
            if best_score >= 0.7:
                result_item["match_status"] = "match_found"
                result_item["match_confidence"] = min(1.0, best_score)
                result_item["match_reasons"] = match_reasons
                result_item["matched_existing_item"] = best_match
            else:
                result_item["match_status"] = "new"
                result_item["match_confidence"] = 0.0

            results.append(result_item)

        return results

    @staticmethod
    def reconcile_assets(
        existing_assets: Dict[str, List[Dict[str, Any]]],
        imported_items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Reconcile imported assets against existing asset categories.
        """
        results = []

        # Flatten existing assets
        flat_existing = []
        for category, items in existing_assets.items():
            if isinstance(items, list):
                for idx, item in enumerate(items):
                    item_copy = item.copy()
                    item_copy["_category"] = category
                    item_copy["_index"] = idx
                    flat_existing.append(item_copy)

        for item in imported_items:
            best_match = None
            best_score = 0.0
            match_reasons = []

            for existing in flat_existing:
                score, reasons = ReconciliationService.calculate_match_score(
                    item, existing
                )

                # Type/Category bonus
                if (
                    item.get("type")
                    and existing.get("_category")
                    and item["type"].lower().replace(" ", "_")
                    == existing["_category"].lower()
                ):
                    score += 0.1
                    reasons.append("Category match")

                # Institution bonus
                inst1 = str(item.get("institution", "")).lower()
                inst2 = str(existing.get("institution", "")).lower()
                if inst1 and inst2 and (inst1 in inst2 or inst2 in inst1):
                    score += 0.1
                    reasons.append("Institution match")

                if score > best_score:
                    best_score = score
                    best_match = existing
                    match_reasons = reasons

            result_item = item.copy()
            if best_score >= 0.75:  # Slightly higher threshold for assets
                result_item["match_status"] = "match_found"
                result_item["match_confidence"] = min(1.0, best_score)
                result_item["match_reasons"] = match_reasons
                result_item["matched_existing_item"] = best_match
            else:
                result_item["match_status"] = "new"
                result_item["match_confidence"] = 0.0

            results.append(result_item)

        return results
