"""Healthcare and Medicare planning projections."""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

from src.services.tax_optimization_service import IRMAACalculator
from src.services.tax_policy import CURRENT_TAX_YEAR


@dataclass(frozen=True)
class MedicarePremiumAssumptions:
    """Baseline monthly Medicare premiums used for household projections."""

    part_a_monthly: float = 0.0
    part_b_monthly: float = 174.70
    part_d_monthly: float = 34.70


class HealthcarePlanningService:
    """Builds a deterministic household healthcare projection."""

    def __init__(
        self,
        filing_status: str = "mfj",
        tax_year: Optional[int] = None,
        premiums: Optional[MedicarePremiumAssumptions] = None,
    ):
        self.filing_status = (filing_status or "mfj").lower()
        self.tax_year = tax_year or CURRENT_TAX_YEAR
        self.irmaa_calculator = IRMAACalculator(
            filing_status=self.filing_status, tax_year=self.tax_year
        )
        self.premiums = premiums or MedicarePremiumAssumptions()

    @staticmethod
    def infer_base_magi(profile_data: Dict) -> float:
        """Infer annual household MAGI from known profile fields."""
        financial = profile_data.get("financial") or {}
        income_streams = profile_data.get("income_streams") or []

        annual_income = float(financial.get("annual_income") or 0.0)
        stream_income = 0.0
        for stream in income_streams:
            amount = float(stream.get("amount") or 0.0)
            frequency = (stream.get("frequency") or "monthly").lower()
            if frequency == "annual":
                stream_income += amount
            else:
                stream_income += amount * 12.0

        return annual_income + stream_income

    @staticmethod
    def infer_base_out_of_pocket(profile_data: Dict) -> float:
        """Infer baseline annual out-of-pocket healthcare spend."""
        financial = profile_data.get("financial") or {}
        budget = profile_data.get("budget") or {}
        expenses = budget.get("expenses") or {}

        for candidate in (
            financial.get("annual_healthcare_expenses"),
            financial.get("healthcare_expenses"),
            expenses.get("healthcare"),
        ):
            if candidate is not None:
                return float(candidate)

        # Conservative household baseline when no user input exists.
        return 6000.0

    @staticmethod
    def infer_hsa_balance(profile_data: Dict) -> float:
        """Infer current household HSA balance from profile data."""
        financial = profile_data.get("financial") or {}
        assets = profile_data.get("assets") or {}
        other_assets = assets.get("other_assets") or []

        inferred = float(financial.get("hsa_balance") or 0.0)
        for asset in other_assets:
            if (asset.get("type") or "").lower() == "hsa":
                inferred += float(asset.get("value") or 0.0)
        return inferred

    @staticmethod
    def infer_hsa_contribution(profile_data: Dict) -> float:
        """Infer annual household HSA contribution from profile data."""
        financial = profile_data.get("financial") or {}
        return float(financial.get("annual_hsa_contribution") or 0.0)

    def project(
        self,
        *,
        current_age: int,
        spouse_age: Optional[int],
        years: int = 20,
        inflation_medical: float = 0.055,
        income_growth: float = 0.02,
        base_magi: float = 0.0,
        base_out_of_pocket: float = 6000.0,
        initial_hsa_balance: float = 0.0,
        annual_hsa_contribution: float = 0.0,
        hsa_growth: float = 0.04,
    ) -> Dict:
        """Return a deterministic annual healthcare projection."""
        rows: List[Dict] = []
        inferred_spouse_age = spouse_age if spouse_age is not None else 0
        household_size = 2 if spouse_age is not None else 1
        hsa_balance = max(0.0, float(initial_hsa_balance))

        for index in range(years):
            year = self.tax_year + index
            inflation_factor = (1 + inflation_medical) ** index
            income_factor = (1 + income_growth) ** index

            p1_age = current_age + index
            p2_age = inferred_spouse_age + index if spouse_age is not None else None

            eligible_people = 0
            if p1_age >= 65:
                eligible_people += 1
            if p2_age is not None and p2_age >= 65:
                eligible_people += 1

            projected_magi = base_magi * income_factor
            irmaa_per_person, tier, threshold_info = self.irmaa_calculator.calculate_surcharge(projected_magi)
            irmaa_total = irmaa_per_person * eligible_people

            annual_part_a = self.premiums.part_a_monthly * 12.0 * eligible_people * inflation_factor
            annual_part_b = self.premiums.part_b_monthly * 12.0 * eligible_people * inflation_factor
            annual_part_d = self.premiums.part_d_monthly * 12.0 * eligible_people * inflation_factor
            annual_oop = base_out_of_pocket * inflation_factor
            gross_healthcare_cost = annual_part_a + annual_part_b + annual_part_d + irmaa_total + annual_oop

            # Grow HSA first, then apply new contribution if still pre-Medicare for at least one spouse.
            hsa_balance *= (1 + hsa_growth)
            allow_hsa_contribution = p1_age < 65 or (p2_age is not None and p2_age < 65)
            hsa_contribution_used = annual_hsa_contribution if allow_hsa_contribution else 0.0
            hsa_balance += hsa_contribution_used

            hsa_applied = min(hsa_balance, gross_healthcare_cost)
            hsa_balance -= hsa_applied
            net_healthcare_cost = gross_healthcare_cost - hsa_applied

            rows.append(
                {
                    "year": year,
                    "ages": {
                        "primary": p1_age,
                        "spouse": p2_age,
                    },
                    "medicare_eligible_people": eligible_people,
                    "projected_magi": round(projected_magi, 2),
                    "medicare_part_a": round(annual_part_a, 2),
                    "medicare_part_b": round(annual_part_b, 2),
                    "medicare_part_d": round(annual_part_d, 2),
                    "irmaa_surcharge": round(irmaa_total, 2),
                    "out_of_pocket": round(annual_oop, 2),
                    "total_healthcare_cost": round(gross_healthcare_cost, 2),
                    "hsa_contribution": round(hsa_contribution_used, 2),
                    "hsa_applied": round(hsa_applied, 2),
                    "remaining_hsa_balance": round(hsa_balance, 2),
                    "net_healthcare_cost": round(net_healthcare_cost, 2),
                    "irmaa_tier": tier,
                    "irmaa_threshold": threshold_info,
                }
            )

        return {
            "assumptions": {
                "filing_status": self.filing_status,
                "household_size": household_size,
                "projection_years": years,
                "medical_inflation": inflation_medical,
                "income_growth": income_growth,
                "base_magi": round(base_magi, 2),
                "base_out_of_pocket": round(base_out_of_pocket, 2),
                "initial_hsa_balance": round(initial_hsa_balance, 2),
                "annual_hsa_contribution": round(annual_hsa_contribution, 2),
                "hsa_growth": hsa_growth,
                "part_a_monthly": self.premiums.part_a_monthly,
                "part_b_monthly": self.premiums.part_b_monthly,
                "part_d_monthly": self.premiums.part_d_monthly,
            },
            "projection": rows,
        }
