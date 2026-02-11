"""Phase 1 planning helpers: life insurance and sequence risk utilities."""

from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _annualize_income_stream(stream: Dict) -> float:
    amount = _safe_float(stream.get("amount"), 0.0)
    frequency = (stream.get("frequency") or "annual").lower()
    if frequency == "monthly":
        return amount * 12
    if frequency == "weekly":
        return amount * 52
    if frequency == "biweekly":
        return amount * 26
    if frequency == "quarterly":
        return amount * 4
    return amount


def _infer_current_age(profile_data: Dict) -> Optional[int]:
    person = profile_data.get("person", {}) or {}
    current_age = person.get("current_age")
    if current_age is not None:
        try:
            return int(current_age)
        except (TypeError, ValueError):
            return None

    birth_date = person.get("birth_date") or profile_data.get("birth_date")
    if not birth_date:
        return None
    try:
        birth = datetime.fromisoformat(str(birth_date)).date()
        today = date.today()
        return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    except Exception:
        return None


def _infer_existing_coverage(profile_data: Dict) -> float:
    financial = profile_data.get("financial", {}) or {}
    direct_coverage = _safe_float(financial.get("life_insurance_coverage"), 0.0)

    assets = profile_data.get("assets", {}) or {}
    other_assets = assets.get("other_assets", []) or []
    asset_coverage = 0.0
    for asset in other_assets:
        atype = str(asset.get("type", "")).lower()
        name = str(asset.get("name", "")).lower()
        if "insurance" in atype or "insurance" in name or "policy" in name:
            asset_coverage += _safe_float(
                asset.get("death_benefit", asset.get("coverage", asset.get("value", 0))),
                0.0,
            )

    return direct_coverage + asset_coverage


def _infer_debt_total(profile_data: Dict) -> float:
    assets = profile_data.get("assets", {}) or {}
    liabilities = assets.get("liabilities", []) or []
    debt_from_assets = sum(
        _safe_float(liab.get("value", liab.get("balance", 0)), 0.0) for liab in liabilities
    )

    financial = profile_data.get("financial", {}) or {}
    debt_from_financial = _safe_float(financial.get("total_debt"), 0.0)
    return max(debt_from_assets, debt_from_financial)


def estimate_life_insurance_needs(profile_data: Dict) -> Dict:
    """Return a practical life insurance coverage estimate and gap analysis."""
    financial = profile_data.get("financial", {}) or {}
    income_streams = profile_data.get("income_streams", []) or []
    children = profile_data.get("children", []) or []

    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    if annual_income <= 0 and income_streams:
        annual_income = sum(_annualize_income_stream(s) for s in income_streams)

    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    if annual_expenses <= 0:
        budget = profile_data.get("budget", {}) or {}
        annual_expenses = _safe_float(budget.get("total_annual_expenses"), 0.0)

    current_age = _infer_current_age(profile_data)
    years_to_support = 20
    if current_age is not None:
        years_to_support = max(10, min(25, 65 - current_age))

    income_replacement_need = max(0.0, annual_income * 0.70 * years_to_support)
    survivor_expense_need = max(0.0, annual_expenses * 0.60 * 10)
    debt_payoff_need = _infer_debt_total(profile_data)
    education_need = len(children) * 100000.0
    final_expense_need = 25000.0

    total_need = (
        income_replacement_need
        + survivor_expense_need
        + debt_payoff_need
        + education_need
        + final_expense_need
    )
    existing_coverage = _infer_existing_coverage(profile_data)
    coverage_gap = max(0.0, total_need - existing_coverage)

    def round_to_50k(value: float) -> float:
        if value <= 0:
            return 0.0
        return float(int((value + 49999) // 50000) * 50000)

    recommended_term_coverage = round_to_50k(coverage_gap)
    recommended_whole_coverage = round_to_50k(coverage_gap * 0.40)

    # Simple premium heuristics for directional planning (not underwriting quotes).
    age_factor = 1.0
    if current_age is not None:
        age_factor = max(0.7, min(2.0, 0.55 + (current_age / 50.0)))

    term_monthly_per_1000 = 0.08 * age_factor
    whole_monthly_per_1000 = 0.95 * age_factor

    term_monthly_premium_estimate = (recommended_term_coverage / 1000.0) * term_monthly_per_1000
    whole_monthly_premium_estimate = (recommended_whole_coverage / 1000.0) * whole_monthly_per_1000

    coverage_ratio = (existing_coverage / total_need) if total_need > 0 else 1.0
    if coverage_ratio >= 1.0:
        adequacy = "adequate"
    elif coverage_ratio >= 0.75:
        adequacy = "moderate_gap"
    else:
        adequacy = "high_gap"

    return {
        "available": True,
        "inputs": {
            "annual_income": round(annual_income, 2),
            "annual_expenses": round(annual_expenses, 2),
            "years_to_support": years_to_support,
            "current_age": current_age,
            "dependents_count": len(children),
        },
        "needs": {
            "income_replacement_need": round(income_replacement_need, 2),
            "survivor_expense_need": round(survivor_expense_need, 2),
            "debt_payoff_need": round(debt_payoff_need, 2),
            "education_need": round(education_need, 2),
            "final_expense_need": round(final_expense_need, 2),
            "total_coverage_need": round(total_need, 2),
        },
        "coverage": {
            "existing_coverage": round(existing_coverage, 2),
            "coverage_gap": round(coverage_gap, 2),
            "coverage_ratio": round(coverage_ratio, 4),
            "adequacy": adequacy,
        },
        "recommendations": {
            "term_20y_coverage": round(recommended_term_coverage, 2),
            "whole_life_coverage": round(recommended_whole_coverage, 2),
            "term_20y_monthly_premium_estimate": round(term_monthly_premium_estimate, 2),
            "whole_life_monthly_premium_estimate": round(whole_monthly_premium_estimate, 2),
            "summary": (
                "Coverage appears adequate."
                if coverage_gap <= 0
                else f"Estimated coverage gap is ${coverage_gap:,.0f}; term coverage is usually the lowest-cost way to close it."
            ),
        },
    }


def generate_sequence_offsets(years: int, retirement_offset: int) -> List[Dict]:
    """Return early/mid/late crash offsets that fit inside the projection window."""
    if years < 3:
        return [{"label": "Early retirement crash", "offset": 0}]

    base = max(0, retirement_offset)
    candidates = [base, base + 10, base + 20]
    labels = ["Early retirement crash", "Mid-retirement crash", "Late-retirement crash"]

    used = set()
    output: List[Dict] = []
    max_offset = max(0, years - 2)  # leave room for 2-year crash window
    for idx, raw in enumerate(candidates):
        offset = max(0, min(raw, max_offset))
        while offset in used and offset < max_offset:
            offset += 1
        if offset in used:
            continue
        used.add(offset)
        output.append({"label": labels[idx], "offset": offset})
    return output


def summarize_sequence_impact(
    baseline_success_rate: float, baseline_median_balance: float, case_results: List[Dict]
) -> Dict:
    if not case_results:
        return {
            "most_vulnerable_period": None,
            "max_success_drop": 0.0,
            "max_median_drop": 0.0,
            "summary": "No sequence stress test results available.",
        }

    sorted_by_drop = sorted(case_results, key=lambda r: r.get("success_rate_delta", 0.0))
    worst = sorted_by_drop[0]
    max_success_drop = abs(min(0.0, worst.get("success_rate_delta", 0.0)))

    sorted_by_median = sorted(case_results, key=lambda r: r.get("median_final_balance_delta", 0.0))
    worst_median = sorted_by_median[0]
    max_median_drop = abs(min(0.0, worst_median.get("median_final_balance_delta", 0.0)))

    return {
        "most_vulnerable_period": worst.get("label"),
        "max_success_drop": round(max_success_drop, 4),
        "max_median_drop": round(max_median_drop, 2),
        "summary": (
            f"Worst timing impact: {worst.get('label')} "
            f"({max_success_drop * 100:.1f} percentage-point success-rate drop vs baseline)."
        ),
    }


def build_debt_payoff_strategy(profile_data: Dict) -> Dict:
    """Generate practical debt-payoff recommendations from liabilities."""
    assets = profile_data.get("assets", {}) or {}
    liabilities = assets.get("liabilities", []) or []
    if not liabilities:
        return {
            "available": False,
            "summary": "No liabilities found in assets to analyze.",
            "total_debt": 0.0,
            "weighted_avg_interest_rate": 0.0,
            "monthly_debt_payment": 0.0,
            "avalanche_order": [],
            "snowball_order": [],
        }

    normalized = []
    for idx, item in enumerate(liabilities, start=1):
        balance = _safe_float(item.get("value", item.get("balance", 0.0)), 0.0)
        if balance <= 0:
            continue
        rate_pct = _safe_float(item.get("interest_rate"), 0.0)
        if rate_pct > 1.0:
            rate_pct = rate_pct / 100.0
        rate_pct = max(0.0, min(rate_pct, 1.0))

        monthly_payment = _safe_float(item.get("monthly_payment"), 0.0)
        name = str(item.get("name") or item.get("type") or f"Debt {idx}")
        normalized.append(
            {
                "name": name,
                "type": str(item.get("type") or "other"),
                "balance": round(balance, 2),
                "interest_rate": round(rate_pct, 4),
                "monthly_payment": round(monthly_payment, 2),
            }
        )

    if not normalized:
        return {
            "available": False,
            "summary": "No liabilities with positive balances found.",
            "total_debt": 0.0,
            "weighted_avg_interest_rate": 0.0,
            "monthly_debt_payment": 0.0,
            "avalanche_order": [],
            "snowball_order": [],
        }

    total_debt = sum(d["balance"] for d in normalized)
    monthly_total = sum(d["monthly_payment"] for d in normalized)
    weighted_rate = (
        sum(d["balance"] * d["interest_rate"] for d in normalized) / total_debt
        if total_debt > 0
        else 0.0
    )

    avalanche = sorted(normalized, key=lambda d: (-d["interest_rate"], -d["balance"]))
    snowball = sorted(normalized, key=lambda d: (d["balance"], -d["interest_rate"]))

    # Rough payoff-time estimate using current monthly payment and weighted interest.
    monthly_rate = weighted_rate / 12.0
    if monthly_total <= 0:
        payoff_months = None
    elif monthly_total <= total_debt * monthly_rate:
        payoff_months = None
    elif monthly_rate <= 0:
        payoff_months = int(round(total_debt / monthly_total))
    else:
        # Loan amortization approximation for blended debt.
        import math

        payoff_months = int(
            math.ceil(
                math.log(monthly_total / (monthly_total - total_debt * monthly_rate))
                / math.log(1 + monthly_rate)
            )
        )

    high_interest_balance = sum(d["balance"] for d in normalized if d["interest_rate"] >= 0.08)
    strategy = "avalanche" if high_interest_balance > 0 else "snowball"
    strategy_reason = (
        "High-interest balances found, so targeting highest APR first reduces lifetime interest."
        if strategy == "avalanche"
        else "Interest rates are relatively close; smallest-balance-first may improve consistency."
    )

    return {
        "available": True,
        "total_debt": round(total_debt, 2),
        "weighted_avg_interest_rate": round(weighted_rate, 4),
        "monthly_debt_payment": round(monthly_total, 2),
        "estimated_payoff_months_at_current_payment": payoff_months,
        "recommended_strategy": strategy,
        "strategy_reason": strategy_reason,
        "avalanche_order": avalanche,
        "snowball_order": snowball,
        "summary": (
            f"Total debt {total_debt:,.0f} with blended rate {weighted_rate * 100:.2f}%."
            if total_debt > 0
            else "No debt to pay off."
        ),
    }
