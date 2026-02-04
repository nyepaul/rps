"""
Reconciliation Service

Centralized logic for matching imported CSV items with existing profile data.
Handles income, expenses, and assets with fuzzy matching and conflict detection.
"""

import logging
from typing import List, Dict, Any, Optional
import re

logger = logging.getLogger(__name__)

class ReconciliationService:
    """Service for reconciling imported data with existing profile data."""

    # Standard categories for different item types
    valid_categories = {
        "income": ["salary", "bonus", "rental", "dividend", "interest", "pension", "social_security", "other"],
        "expense": ["housing", "utilities", "food", "transportation", "healthcare", "insurance", "debt", "entertainment", "other"],
        "asset": ["401k", "ira", "roth_ira", "brokerage", "savings", "checking", "real_estate", "vehicle", "other"]
    }

    @staticmethod
    def reconcile_income(existing: List[Dict], imported: List[Dict]) -> List[Dict]:
        """Reconcile imported income items with existing income streams."""
        return ReconciliationService._reconcile_generic(existing, imported, "income")

    @staticmethod
    def reconcile_expenses(existing: Dict[str, List[Dict]], imported: List[Dict]) -> List[Dict]:
        """
        Reconcile imported expenses with existing budget.
        existing: budgetData.expenses['current'] (or 'future')
        """
        # Flatten existing expenses for easier matching
        flattened_existing = []
        for category, items in existing.items():
            for item in items:
                flattened_existing.append({**item, "category": category})
        
        return ReconciliationService._reconcile_generic(flattened_existing, imported, "expense")

    @staticmethod
    def reconcile_assets(existing: Dict[str, List[Dict]], imported: List[Dict]) -> List[Dict]:
        """
        Reconcile imported assets with existing assets.
        existing: profile.data['assets']
        """
        # Flatten existing assets
        flattened_existing = []
        for category, items in existing.items():
            if isinstance(items, list):
                for item in items:
                    flattened_existing.append({**item, "category": category})
        
        return ReconciliationService._reconcile_generic(flattened_existing, imported, "asset")

    @staticmethod
    def _reconcile_generic(existing: List[Dict], imported: List[Dict], item_type: str) -> List[Dict]:
        """Generic reconciliation logic for any item type."""
        results = []

        for imp_item in imported:
            best_match = None
            best_score = 0
            
            imp_name = imp_item.get("name", "").lower().strip()
            imp_amount = float(imp_item.get("amount") or imp_item.get("value") or 0)

            for ext_item in existing:
                ext_name = ext_item.get("name", "").lower().strip()
                ext_amount = float(ext_item.get("amount") or ext_item.get("value") or 0)

                # 1. Name Similarity (Basic fuzzy)
                name_score = ReconciliationService._calculate_name_similarity(imp_name, ext_name)
                
                # 2. Amount Similarity
                amount_diff = abs(imp_amount - ext_amount)
                amount_score = 1.0 - (amount_diff / max(imp_amount, ext_amount, 1.0))
                amount_score = max(0, amount_score)

                # Combined score (weighted)
                combined_score = (name_score * 0.7) + (amount_score * 0.3)

                if combined_score > best_score:
                    best_score = combined_score
                    best_match = ext_item

            # Determine status and suggested action
            status = "new"
            suggested_action = "add"
            match_confidence = best_score
            matched_with = None

            if best_score > 0.85:
                status = "exact_match"
                suggested_action = "ignore"
                matched_with = best_match.get("name")
            elif best_score > 0.5:
                status = "potential_duplicate"
                suggested_action = "review"
                matched_with = best_match.get("name")

            results.append({
                **imp_item,
                "reconciliation": {
                    "status": status,
                    "suggested_action": suggested_action,
                    "match_confidence": round(match_confidence, 2),
                    "matched_with": matched_with,
                    "best_match_score": round(best_score, 2)
                }
            })

        return results

    @staticmethod
    def _calculate_name_similarity(name1: str, name2: str) -> float:
        """Simple Jaccard similarity for names."""
        if not name1 or not name2:
            return 0.0
            
        s1 = set(name1.split())
        s2 = set(name2.split())
        
        if not s1 or not s2:
            return 0.0
            
        intersection = s1.intersection(s2)
        union = s1.union(s2)
        
        return len(intersection) / len(union)

    @staticmethod
    def normalize_amount(amount: Any) -> float:
        """Helper to safely convert various amount formats to float."""
        if amount is None:
            return 0.0
        if isinstance(amount, (int, float)):
            return float(amount)
        if isinstance(amount, str):
            # Remove currency symbols and commas
            cleaned = re.sub(r"[^\d.-]", "", amount)
            try:
                return float(cleaned)
            except ValueError:
                return 0.0
        return 0.0
