"""Phase 2 planning helpers."""

from __future__ import annotations

from datetime import date
from typing import Dict, List


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def build_529_college_savings_plan(profile_data: Dict) -> Dict:
    """Generate a simple 529 savings plan by child."""
    children = profile_data.get("children", []) or []
    if not children:
        return {
            "available": False,
            "summary": "No children found in profile data.",
            "children": [],
            "household_totals": {
                "existing_529_balance": 0.0,
                "target_funding_total": 0.0,
                "monthly_savings_needed_total": 0.0,
            },
        }

    assets = profile_data.get("assets", {}) or {}
    education_accounts = assets.get("education_accounts", []) or []
    existing_529_total = sum(_safe_float(a.get("value"), 0.0) for a in education_accounts)

    assumptions = {
        "annual_college_cost_today": 35000.0,
        "years_in_college": 4,
        "tuition_inflation": 0.05,
        "expected_529_return": 0.06,
        "target_funding_ratio": 1.0,
    }

    current_year = date.today().year
    child_rows: List[Dict] = []
    target_funding_total = 0.0
    monthly_needed_total = 0.0

    per_child_existing = existing_529_total / max(len(children), 1)

    for idx, child in enumerate(children, start=1):
        name = str(child.get("name") or f"Child {idx}")
        birth_year = _safe_int(child.get("birth_year"), 0)
        current_age = max(0, current_year - birth_year) if birth_year > 0 else None
        years_to_college = 0 if current_age is None else max(0, 18 - current_age)

        # Inflate each of the 4 college years separately.
        projected_total_cost = 0.0
        for year_offset in range(assumptions["years_in_college"]):
            inflate_years = years_to_college + year_offset
            projected_total_cost += assumptions["annual_college_cost_today"] * (
                (1 + assumptions["tuition_inflation"]) ** inflate_years
            )

        target_funding = projected_total_cost * assumptions["target_funding_ratio"]
        target_funding_total += target_funding

        allocated_existing = per_child_existing
        gap = max(0.0, target_funding - allocated_existing)

        if years_to_college <= 0:
            monthly_needed = gap / 12.0
        else:
            r = assumptions["expected_529_return"] / 12.0
            n = years_to_college * 12
            if r <= 0:
                monthly_needed = gap / max(1, n)
            else:
                # Future value of ordinary annuity
                factor = ((1 + r) ** n - 1) / r
                monthly_needed = gap / max(factor, 1e-9)

        monthly_needed_total += monthly_needed
        child_rows.append(
            {
                "name": name,
                "current_age": current_age,
                "years_to_college": years_to_college,
                "projected_total_college_cost": round(projected_total_cost, 2),
                "target_funding": round(target_funding, 2),
                "existing_529_allocation": round(allocated_existing, 2),
                "funding_gap": round(gap, 2),
                "monthly_savings_needed": round(monthly_needed, 2),
            }
        )

    return {
        "available": True,
        "assumptions": assumptions,
        "children": child_rows,
        "household_totals": {
            "existing_529_balance": round(existing_529_total, 2),
            "target_funding_total": round(target_funding_total, 2),
            "monthly_savings_needed_total": round(monthly_needed_total, 2),
        },
        "summary": (
            f"Estimated 529 target: ${target_funding_total:,.0f}; "
            f"monthly savings need: ${monthly_needed_total:,.0f}."
        ),
    }


def build_pension_lump_sum_analysis(profile_data: Dict) -> Dict:
    """Compare estimated pension stream value vs lump-sum alternative."""
    financial = profile_data.get("financial", {}) or {}
    person = profile_data.get("person", {}) or {}
    assets = profile_data.get("assets", {}) or {}
    pensions = assets.get("pensions_annuities", []) or []

    monthly_pension = _safe_float(financial.get("pension_benefit"), 0.0)
    monthly_pension += sum(
        _safe_float(p.get("monthly_benefit"), 0.0)
        for p in pensions
        if str(p.get("type", "")).lower() == "pension"
    )
    annual_pension = monthly_pension * 12.0

    lump_sum_offer = _safe_float(financial.get("pension_lump_sum"), 0.0)
    if lump_sum_offer <= 0:
        lump_sum_offer = sum(
            _safe_float(p.get("current_value"), 0.0)
            for p in pensions
            if str(p.get("type", "")).lower() == "annuity"
        )

    current_age = _safe_int(person.get("current_age"), 0)
    life_expectancy = _safe_int(person.get("life_expectancy"), 90)
    years = max(1, life_expectancy - current_age) if current_age > 0 else 25

    if annual_pension <= 0 and lump_sum_offer <= 0:
        return {
            "available": False,
            "summary": "No pension income or lump-sum value found to compare.",
            "annual_pension_income": 0.0,
            "lump_sum_offer": 0.0,
        }

    assumptions = {
        "discount_rate": 0.04,
        "cola_rate": 0.02,
        "projection_years": years,
    }

    def pv_growing_annuity(payment: float, r: float, g: float, n: int) -> float:
        if payment <= 0 or n <= 0:
            return 0.0
        if abs(r - g) < 1e-9:
            return payment * n / (1 + r)
        return payment * (1 - ((1 + g) / (1 + r)) ** n) / (r - g)

    pension_pv = pv_growing_annuity(
        annual_pension,
        assumptions["discount_rate"],
        assumptions["cola_rate"],
        assumptions["projection_years"],
    )
    breakeven_years = (lump_sum_offer / annual_pension) if annual_pension > 0 else None

    sensitivity = []
    for rate in (0.03, 0.04, 0.05):
        sensitivity.append(
            {
                "discount_rate": rate,
                "pension_present_value": round(
                    pv_growing_annuity(
                        annual_pension, rate, assumptions["cola_rate"], assumptions["projection_years"]
                    ),
                    2,
                ),
            }
        )

    recommendation = "pension_stream"
    if lump_sum_offer > pension_pv:
        recommendation = "lump_sum"

    return {
        "available": True,
        "annual_pension_income": round(annual_pension, 2),
        "lump_sum_offer": round(lump_sum_offer, 2),
        "present_value_of_pension": round(pension_pv, 2),
        "breakeven_years": round(breakeven_years, 1) if breakeven_years is not None else None,
        "recommendation": recommendation,
        "assumptions": assumptions,
        "sensitivity": sensitivity,
        "summary": (
            "Estimated pension stream value exceeds lump sum."
            if recommendation == "pension_stream"
            else "Lump sum appears larger than estimated pension stream value."
        ),
    }


def build_estate_tax_gifting_strategy(profile_data: Dict) -> Dict:
    """Estimate estate exposure and annual gifting capacity."""
    assets = profile_data.get("assets", {}) or {}
    spouse = profile_data.get("spouse") or {}
    children = profile_data.get("children", []) or []

    retirement_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("retirement_accounts", []))
    taxable_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []))
    education_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("education_accounts", []))
    other_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("other_assets", []))

    real_estate_equity = 0.0
    for prop in assets.get("real_estate", []) or []:
        value = _safe_float(prop.get("current_value", prop.get("value", 0.0)), 0.0)
        mortgage = _safe_float(prop.get("mortgage_balance", 0.0), 0.0)
        real_estate_equity += max(0.0, value - mortgage)

    liabilities = sum(_safe_float(l.get("value", l.get("balance", 0.0)), 0.0) for l in assets.get("liabilities", []) or [])
    gross_estate = retirement_assets + taxable_assets + education_assets + other_assets + real_estate_equity
    net_estate = max(0.0, gross_estate - liabilities)

    has_spouse = bool(spouse.get("name") or spouse.get("birth_date"))
    exemption_per_person = 13_610_000.0
    exemption_total = exemption_per_person * (2 if has_spouse else 1)
    taxable_estate_today = max(0.0, net_estate - exemption_total)

    annual_growth = 0.04
    annual_gift_exclusion = 18_000.0
    beneficiaries = max(1, len(children))
    donors = 2 if has_spouse else 1
    annual_gifting_capacity = annual_gift_exclusion * beneficiaries * donors

    person = profile_data.get("person", {}) or {}
    current_age = _safe_int(person.get("current_age"), 0)
    life_expectancy = _safe_int(person.get("life_expectancy"), 90)
    years = max(1, life_expectancy - current_age) if current_age > 0 else 25
    projected_estate = net_estate * ((1 + annual_growth) ** years)
    projected_taxable_estate = max(0.0, projected_estate - exemption_total)

    recommendations = []
    if projected_taxable_estate > 0:
        recommendations.append("Consider annual exclusion gifts to heirs to reduce taxable estate growth.")
        recommendations.append("Evaluate irrevocable trust strategies with an estate attorney.")
        if taxable_assets > 0:
            recommendations.append("Review concentrated taxable positions for tax-aware gifting opportunities.")
    else:
        recommendations.append("Current estate appears below modeled federal exemption thresholds.")
        recommendations.append("Focus on beneficiary designations and document quality (will, POA, health directives).")

    return {
        "available": True,
        "assumptions": {
            "federal_exemption_per_person": exemption_per_person,
            "annual_gift_exclusion_per_donor_per_recipient": annual_gift_exclusion,
            "annual_growth_rate": annual_growth,
            "projection_years": years,
        },
        "estate": {
            "gross_estate": round(gross_estate, 2),
            "net_estate": round(net_estate, 2),
            "liabilities": round(liabilities, 2),
            "federal_exemption_total": round(exemption_total, 2),
            "taxable_estate_today": round(taxable_estate_today, 2),
            "projected_estate": round(projected_estate, 2),
            "projected_taxable_estate": round(projected_taxable_estate, 2),
        },
        "gifting": {
            "beneficiaries_count": beneficiaries,
            "donors_count": donors,
            "annual_gifting_capacity": round(annual_gifting_capacity, 2),
        },
        "recommendations": recommendations,
        "summary": (
            "Projected taxable estate above exemption; gifting and trust planning likely warranted."
            if projected_taxable_estate > 0
            else "Projected estate remains under modeled federal exemption."
        ),
    }


def build_investment_fee_impact_analyzer(profile_data: Dict) -> Dict:
    """Estimate long-term impact of portfolio fees."""
    assets = profile_data.get("assets", {}) or {}
    person = profile_data.get("person", {}) or {}

    investable_accounts = []
    for category in ("retirement_accounts", "taxable_accounts", "education_accounts"):
        for idx, account in enumerate(assets.get(category, []) or []):
            value = _safe_float(account.get("value"), 0.0)
            if value <= 0:
                continue
            # Priority: management_fee_rate (stored as %, e.g. 0.6 → 0.006), then expense_ratio, then heuristic
            mgmt_fee = _safe_float(account.get("management_fee_rate"), -1.0)
            if mgmt_fee >= 0:
                fee = mgmt_fee / 100.0
            else:
                fee = _safe_float(account.get("expense_ratio"), -1.0)
                if fee > 1.0:
                    fee = fee / 100.0
                if fee < 0:
                    # Default heuristics when fee data is missing
                    fee = 0.006 if category == "retirement_accounts" else 0.008
            investable_accounts.append(
                {
                    "name": str(account.get("name") or account.get("type") or "Account"),
                    "category": category,
                    "account_index": idx,
                    "value": value,
                    "fee_rate": max(0.0, min(fee, 0.15)),
                }
            )

    total_assets = sum(a["value"] for a in investable_accounts)
    if total_assets <= 0:
        return {
            "available": False,
            "summary": "No investable accounts found for fee analysis.",
            "total_investable_assets": 0.0,
        }

    weighted_fee = sum(a["value"] * a["fee_rate"] for a in investable_accounts) / total_assets
    low_cost_fee = 0.0015  # 0.15%
    annual_fee_dollars = total_assets * weighted_fee
    annual_savings_if_optimized = max(0.0, total_assets * (weighted_fee - low_cost_fee))

    current_age = _safe_int(person.get("current_age"), 0)
    life_expectancy = _safe_int(person.get("life_expectancy"), 90)
    years = max(10, life_expectancy - current_age) if current_age > 0 else 25

    gross_return = 0.06
    fv_current = total_assets * ((1 + max(0.0, gross_return - weighted_fee)) ** years)
    fv_low_cost = total_assets * ((1 + max(0.0, gross_return - low_cost_fee)) ** years)
    lifetime_fee_impact = max(0.0, fv_low_cost - fv_current)

    highest_fee = sorted(investable_accounts, key=lambda a: a["fee_rate"], reverse=True)
    recommendation = (
        "Fee drag appears material; review high-fee holdings and consider low-cost index alternatives."
        if weighted_fee - low_cost_fee >= 0.0025
        else "Portfolio fee level appears relatively efficient."
    )

    return {
        "available": True,
        "assumptions": {
            "gross_return": gross_return,
            "low_cost_benchmark_fee": low_cost_fee,
            "projection_years": years,
        },
        "total_investable_assets": round(total_assets, 2),
        "weighted_fee_rate": round(weighted_fee, 4),
        "annual_fee_dollars": round(annual_fee_dollars, 2),
        "annual_savings_if_optimized": round(annual_savings_if_optimized, 2),
        "lifetime_fee_impact": round(lifetime_fee_impact, 2),
        "high_fee_accounts": [
            {
                "name": a["name"],
                "category": a["category"],
                "account_index": a["account_index"],
                "value": round(a["value"], 2),
                "fee_rate": round(a["fee_rate"], 4),
            }
            for a in highest_fee
        ],
        "summary": recommendation,
    }


def build_part_time_retirement_model(profile_data: Dict) -> Dict:
    """Model the impact of part-time income during retirement."""
    financial = profile_data.get("financial", {}) or {}
    person = profile_data.get("person", {}) or {}
    spouse = profile_data.get("spouse") or {}

    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    if annual_expenses <= 0 and annual_income > 0:
        annual_expenses = annual_income * 0.8

    primary_ss = _safe_float(financial.get("social_security_benefit"), 0.0) * 12.0
    spouse_ss = _safe_float(spouse.get("social_security_benefit"), 0.0) * 12.0
    pension = _safe_float(financial.get("pension_benefit"), 0.0) * 12.0
    guaranteed_income = primary_ss + spouse_ss + pension

    if annual_expenses <= 0:
        return {
            "available": False,
            "summary": "Annual expense input is required to model part-time retirement work impact.",
            "scenarios": [],
        }

    base_gap = max(0.0, annual_expenses - guaranteed_income)
    part_time_levels = [0, 10000, 20000, 30000, 40000]
    marginal_tax = 0.20
    scenarios = []
    for gross in part_time_levels:
        net_income = gross * (1 - marginal_tax)
        remaining_gap = max(0.0, base_gap - net_income)
        reduction = max(0.0, base_gap - remaining_gap)
        scenarios.append(
            {
                "part_time_gross_income": float(gross),
                "part_time_net_income": round(net_income, 2),
                "remaining_withdrawal_need": round(remaining_gap, 2),
                "withdrawal_reduction": round(reduction, 2),
            }
        )

    target_gap_coverage = 0.5 * base_gap
    recommended = next(
        (s for s in scenarios if s["withdrawal_reduction"] >= target_gap_coverage),
        scenarios[-1],
    )

    current_age = _safe_int(person.get("current_age"), 0)
    retirement_age = _safe_int(person.get("retirement_age"), 67)
    years_until_retirement = max(0, retirement_age - current_age) if current_age > 0 else None

    return {
        "available": True,
        "inputs": {
            "annual_expenses": round(annual_expenses, 2),
            "guaranteed_income": round(guaranteed_income, 2),
            "base_withdrawal_need": round(base_gap, 2),
            "years_until_retirement": years_until_retirement,
        },
        "assumptions": {"effective_tax_rate_on_part_time_income": marginal_tax},
        "scenarios": scenarios,
        "recommended_part_time_income": recommended,
        "summary": (
            f"Base withdrawal need is ${base_gap:,.0f}/yr; "
            f"${recommended['part_time_gross_income']:,.0f} part-time income could reduce roughly "
            f"${recommended['withdrawal_reduction']:,.0f}/yr."
        ),
    }


def build_real_estate_enhancements(profile_data: Dict) -> Dict:
    """Provide property-level planning metrics and a simple projection."""
    assets = profile_data.get("assets", {}) or {}
    asset_properties = assets.get("real_estate", []) or []
    home_properties = profile_data.get("home_properties", []) or []
    properties = asset_properties + home_properties

    if not properties:
        return {
            "available": False,
            "summary": "No real estate properties found to analyze.",
            "properties": [],
        }

    projection_years = 10
    appreciation = 0.03
    row_data = []
    total_equity = 0.0
    total_projected_equity = 0.0

    for idx, prop in enumerate(properties, start=1):
        name = str(prop.get("name") or prop.get("address") or f"Property {idx}")
        value = _safe_float(prop.get("current_value", prop.get("value", 0.0)), 0.0)
        mortgage = _safe_float(prop.get("mortgage_balance", 0.0), 0.0)
        equity = max(0.0, value - mortgage)

        annual_costs = (
            _safe_float(prop.get("annual_costs"), 0.0)
            + _safe_float(prop.get("annual_property_tax"), 0.0)
            + _safe_float(prop.get("annual_insurance"), 0.0)
            + _safe_float(prop.get("annual_maintenance"), 0.0)
            + _safe_float(prop.get("annual_hoa"), 0.0)
        )
        annual_rent = _safe_float(prop.get("annual_rental_income"), 0.0)
        if annual_rent <= 0:
            annual_rent = _safe_float(prop.get("monthly_rental_income"), 0.0) * 12.0

        net_cashflow = annual_rent - annual_costs
        cap_rate = (net_cashflow / value) if value > 0 else 0.0
        projected_value = value * ((1 + appreciation) ** projection_years)
        projected_equity = max(0.0, projected_value - mortgage)

        total_equity += equity
        total_projected_equity += projected_equity

        row_data.append(
            {
                "name": name,
                "property_type": str(prop.get("property_type") or prop.get("type") or "real_estate"),
                "current_value": round(value, 2),
                "mortgage_balance": round(mortgage, 2),
                "equity": round(equity, 2),
                "annual_costs": round(annual_costs, 2),
                "annual_rental_income": round(annual_rent, 2),
                "net_annual_cashflow": round(net_cashflow, 2),
                "cap_rate": round(cap_rate, 4),
                "projected_value_10y": round(projected_value, 2),
                "projected_equity_10y": round(projected_equity, 2),
                "planned_sale_date": prop.get("planned_sale_date"),
            }
        )

    sale_candidates = [p for p in row_data if p.get("planned_sale_date")]
    return {
        "available": True,
        "assumptions": {"projection_years": projection_years, "annual_appreciation_rate": appreciation},
        "properties": row_data,
        "totals": {
            "property_count": len(row_data),
            "total_equity": round(total_equity, 2),
            "projected_total_equity_10y": round(total_projected_equity, 2),
        },
        "summary": (
            f"{len(row_data)} properties tracked; current equity ${total_equity:,.0f}, "
            f"projected ${total_projected_equity:,.0f} in {projection_years} years."
        ),
        "sale_planning_note": (
            f"{len(sale_candidates)} property sale date(s) detected; validate tax treatment and replacement plans."
            if sale_candidates
            else "No planned sale dates detected."
        ),
    }


def build_advanced_scenario_analysis(scenarios: Dict, years_projected: int) -> Dict:
    """Summarize scenario resilience and dispersion across outcomes."""
    if not scenarios:
        return {
            "available": False,
            "summary": "No scenario results available for advanced analysis.",
        }

    rows = []
    for key, s in scenarios.items():
        rows.append(
            {
                "key": key,
                "name": s.get("scenario_name", key.title()),
                "success_rate": _safe_float(s.get("success_rate"), 0.0),
                "median_final_balance": _safe_float(s.get("median_final_balance"), 0.0),
                "p10": _safe_float(s.get("percentile_10"), 0.0),
                "p90": _safe_float(s.get("percentile_90"), 0.0),
                "std_deviation": _safe_float(s.get("std_deviation"), 0.0),
            }
        )

    if not rows:
        return {"available": False, "summary": "Scenario rows were empty."}

    by_success = sorted(rows, key=lambda r: r["success_rate"], reverse=True)
    by_median = sorted(rows, key=lambda r: r["median_final_balance"], reverse=True)
    by_downside = sorted(rows, key=lambda r: r["p10"], reverse=True)

    best_success = by_success[0]
    best_median = by_median[0]
    best_downside = by_downside[0]

    success_values = [r["success_rate"] for r in rows]
    median_values = [r["median_final_balance"] for r in rows]
    downside_values = [r["p10"] for r in rows]

    success_spread = max(success_values) - min(success_values)
    median_spread = max(median_values) - min(median_values)
    downside_spread = max(downside_values) - min(downside_values)

    # Composite resilience score weighted toward success and downside protection.
    for r in rows:
        r["resilience_score"] = round(
            (r["success_rate"] * 60.0)
            + (max(0.0, r["p10"]) / max(1.0, max(downside_values)) * 25.0)
            + (max(0.0, r["median_final_balance"]) / max(1.0, max(median_values)) * 15.0),
            2,
        )

    rows_sorted_resilience = sorted(rows, key=lambda r: r["resilience_score"], reverse=True)
    resilience_winner = rows_sorted_resilience[0]

    return {
        "available": True,
        "years_projected": years_projected,
        "leaders": {
            "best_success_rate": {
                "scenario": best_success["name"],
                "value": round(best_success["success_rate"], 4),
            },
            "best_median_outcome": {
                "scenario": best_median["name"],
                "value": round(best_median["median_final_balance"], 2),
            },
            "best_downside_protection": {
                "scenario": best_downside["name"],
                "value": round(best_downside["p10"], 2),
            },
            "top_resilience": {
                "scenario": resilience_winner["name"],
                "score": resilience_winner["resilience_score"],
            },
        },
        "dispersion": {
            "success_rate_spread": round(success_spread, 4),
            "median_balance_spread": round(median_spread, 2),
            "downside_spread": round(downside_spread, 2),
        },
        "scenario_table": rows_sorted_resilience,
        "summary": (
            f"Resilience leader: {resilience_winner['name']}; "
            f"success-rate spread across scenarios: {success_spread * 100:.1f} percentage points."
        ),
    }


def build_dynamic_withdrawal_strategies(profile_data: Dict, scenario_results: Dict) -> Dict:
    """Generate guardrail-style dynamic withdrawal guidance."""
    financial = profile_data.get("financial", {}) or {}
    assets = profile_data.get("assets", {}) or {}

    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    if annual_expenses <= 0:
        annual_expenses = _safe_float(financial.get("annual_income"), 0.0) * 0.8

    investable = 0.0
    for category in ("retirement_accounts", "taxable_accounts", "education_accounts", "other_assets"):
        investable += sum(_safe_float(a.get("value"), 0.0) for a in assets.get(category, []) or [])
    if investable <= 0:
        investable = _safe_float(financial.get("liquid_assets"), 0.0) + _safe_float(financial.get("retirement_assets"), 0.0)

    if investable <= 0 or annual_expenses <= 0:
        return {
            "available": False,
            "summary": "Insufficient asset or expense inputs to build dynamic withdrawal strategies.",
            "strategies": [],
        }

    base_withdrawal_rate = annual_expenses / investable
    moderate = scenario_results.get("moderate", {}) if scenario_results else {}
    success_rate = _safe_float(moderate.get("success_rate"), 0.0)
    p10 = _safe_float(moderate.get("percentile_10"), 0.0)

    high_guardrail = min(0.08, base_withdrawal_rate * 1.20)
    low_guardrail = max(0.02, base_withdrawal_rate * 0.80)

    # Spending adjustment heuristics.
    cut_pct = 0.10 if success_rate < 0.80 else 0.07
    raise_pct = 0.05 if success_rate > 0.90 else 0.03
    if p10 <= 0:
        cut_pct = max(cut_pct, 0.12)

    strategies = [
        {
            "name": "Current Spending Baseline",
            "initial_withdrawal_rate": round(base_withdrawal_rate, 4),
            "initial_withdrawal_amount": round(annual_expenses, 2),
            "rule": "Inflation-adjusted spending with no guardrails.",
            "upside_adjustment_pct": 0.0,
            "downside_adjustment_pct": 0.0,
        },
        {
            "name": "Guardrails (Guyton-Klinger style)",
            "initial_withdrawal_rate": round(base_withdrawal_rate, 4),
            "initial_withdrawal_amount": round(annual_expenses, 2),
            "rule": (
                f"If withdrawal rate rises above {high_guardrail * 100:.1f}%, cut spending by {cut_pct * 100:.0f}%. "
                f"If it falls below {low_guardrail * 100:.1f}%, raise spending by {raise_pct * 100:.0f}%."
            ),
            "upside_adjustment_pct": round(raise_pct, 4),
            "downside_adjustment_pct": round(cut_pct, 4),
            "guardrail_high_rate": round(high_guardrail, 4),
            "guardrail_low_rate": round(low_guardrail, 4),
        },
        {
            "name": "Floor-and-Ceiling",
            "initial_withdrawal_rate": round(base_withdrawal_rate, 4),
            "initial_withdrawal_amount": round(annual_expenses, 2),
            "rule": "Annual spending changes capped to +/-5% in real terms.",
            "upside_adjustment_pct": 0.05,
            "downside_adjustment_pct": 0.05,
            "spending_floor": round(annual_expenses * 0.90, 2),
            "spending_ceiling": round(annual_expenses * 1.10, 2),
        },
    ]

    recommended = strategies[1] if success_rate < 0.90 else strategies[2]
    return {
        "available": True,
        "inputs": {
            "investable_assets": round(investable, 2),
            "annual_expenses": round(annual_expenses, 2),
            "base_withdrawal_rate": round(base_withdrawal_rate, 4),
            "moderate_success_rate": round(success_rate, 4),
            "moderate_p10_outcome": round(p10, 2),
        },
        "strategies": strategies,
        "recommended_strategy": recommended["name"],
        "summary": (
            f"Baseline withdrawal rate is {base_withdrawal_rate * 100:.2f}%. "
            f"Recommended dynamic approach: {recommended['name']}."
        ),
    }


def build_life_event_scenario_modeling(profile_data: Dict, scenario_results: Dict) -> Dict:
    """Model directional impact of common life events on plan resilience."""
    moderate = (scenario_results or {}).get("moderate", {}) or {}
    baseline_success = _safe_float(moderate.get("success_rate"), 0.0)
    baseline_median = _safe_float(moderate.get("median_final_balance"), 0.0)

    financial = profile_data.get("financial", {}) or {}
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    person = profile_data.get("person", {}) or {}
    current_age = _safe_int(person.get("current_age"), 0)
    retirement_age = _safe_int(person.get("retirement_age"), 67)

    # Heuristic deltas (directional only) anchored to baseline.
    events = []

    # 1) Delay retirement by 2 years.
    delay_boost = 0.05 if retirement_age - current_age <= 10 else 0.03
    events.append(
        {
            "event": "Delay retirement by 2 years",
            "success_rate_delta": round(delay_boost, 4),
            "median_balance_delta": round(max(50000.0, baseline_median * 0.08), 2),
            "details": "More contribution years and fewer withdrawal years improve durability.",
        }
    )

    # 2) Temporary spending shock (+20% for 3 years).
    shock_drag = -0.06 if annual_expenses > 0 else -0.04
    events.append(
        {
            "event": "3-year spending shock (+20%)",
            "success_rate_delta": round(shock_drag, 4),
            "median_balance_delta": round(-max(40000.0, baseline_median * 0.06), 2),
            "details": "Higher early withdrawals raise sequence risk and reduce long-term compounding.",
        }
    )

    # 3) Healthcare long-term care shock in late retirement.
    events.append(
        {
            "event": "Late-retirement healthcare shock",
            "success_rate_delta": round(-0.03, 4),
            "median_balance_delta": round(-max(25000.0, baseline_median * 0.03), 2),
            "details": "Higher medical costs in later years can compress remaining safety margin.",
        }
    )

    # 4) Home downsize at retirement (net proceeds).
    home_props = profile_data.get("home_properties", []) or profile_data.get("assets", {}).get("real_estate", []) or []
    net_proceeds = 0.0
    if home_props:
        first = home_props[0]
        value = _safe_float(first.get("current_value", first.get("value", 0.0)), 0.0)
        mortgage = _safe_float(first.get("mortgage_balance", 0.0), 0.0)
        net_proceeds = max(0.0, value - mortgage) * 0.5  # assume partial equity realized
    if net_proceeds > 0:
        events.append(
            {
                "event": "Downsize primary home at retirement",
                "success_rate_delta": round(0.02, 4),
                "median_balance_delta": round(net_proceeds, 2),
                "details": "Releasing home equity can bolster portfolio longevity.",
            }
        )

    modeled = []
    for e in events:
        modeled.append(
            {
                **e,
                "projected_success_rate": round(max(0.0, min(1.0, baseline_success + e["success_rate_delta"])), 4),
                "projected_median_balance": round(baseline_median + e["median_balance_delta"], 2),
            }
        )

    ranked = sorted(modeled, key=lambda x: x["projected_success_rate"], reverse=True)
    return {
        "available": True,
        "baseline": {
            "success_rate": round(baseline_success, 4),
            "median_final_balance": round(baseline_median, 2),
        },
        "events": ranked,
        "summary": (
            f"Highest positive modeled event: {ranked[0]['event']}."
            if ranked
            else "No life-event scenarios modeled."
        ),
    }


def build_disability_income_protection(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    assets = profile_data.get("assets", {}) or {}
    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    liquid_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []) or [])
    if liquid_assets <= 0:
        liquid_assets = _safe_float(financial.get("liquid_assets"), 0.0)
    monthly_expenses = annual_expenses / 12.0 if annual_expenses > 0 else 0.0
    emergency_months = (liquid_assets / monthly_expenses) if monthly_expenses > 0 else 0.0
    target_coverage = annual_income * 0.60
    recommended_benefit = max(0.0, target_coverage / 12.0)
    return {
        "available": annual_income > 0,
        "annual_income": round(annual_income, 2),
        "target_annual_coverage": round(target_coverage, 2),
        "recommended_monthly_benefit": round(recommended_benefit, 2),
        "emergency_fund_months": round(emergency_months, 1),
        "summary": (
            "Income protection is priority due to active earned income."
            if annual_income > 0
            else "No earned income detected; disability insurance may be lower priority."
        ),
    }


def build_long_term_care_analysis(profile_data: Dict) -> Dict:
    person = profile_data.get("person", {}) or {}
    assets = profile_data.get("assets", {}) or {}
    current_age = _safe_int(person.get("current_age"), 0)
    years_to_need = max(1, 80 - current_age) if current_age > 0 else 20
    current_ltc_cost = 120000.0
    inflation = 0.04
    projected_annual_cost = current_ltc_cost * ((1 + inflation) ** years_to_need)
    care_years = 3
    projected_total = projected_annual_cost * care_years
    liquid_assets = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []) or [])
    liquid_assets += _safe_float(profile_data.get("financial", {}).get("liquid_assets"), 0.0)
    self_funding_ratio = (liquid_assets / projected_total) if projected_total > 0 else 0.0
    return {
        "available": True,
        "assumptions": {
            "current_annual_ltc_cost": current_ltc_cost,
            "ltc_inflation": inflation,
            "years_of_care_modeled": care_years,
        },
        "projected_annual_cost": round(projected_annual_cost, 2),
        "projected_total_cost": round(projected_total, 2),
        "self_funding_ratio": round(self_funding_ratio, 4),
        "summary": (
            "Self-funding appears feasible." if self_funding_ratio >= 1 else "Consider LTC insurance or earmarked reserves."
        ),
    }


def build_business_owner_retirement_planning(profile_data: Dict) -> Dict:
    assets = profile_data.get("assets", {}) or {}
    business_assets = [
        a for a in assets.get("other_assets", []) or []
        if str(a.get("type", "")).lower() == "business_interest"
    ]
    total_business_value = sum(_safe_float(a.get("value"), 0.0) for a in business_assets)
    investable = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []) or [])
    investable += sum(_safe_float(a.get("value"), 0.0) for a in assets.get("retirement_accounts", []) or [])
    concentration = (total_business_value / max(1.0, total_business_value + investable))
    solo_401k_capacity = 69000.0
    return {
        "available": True,
        "has_business_interest": len(business_assets) > 0,
        "business_value": round(total_business_value, 2),
        "business_concentration_ratio": round(concentration, 4),
        "estimated_solo_401k_max": solo_401k_capacity,
        "summary": (
            "Business concentration is elevated; diversify and plan exit liquidity."
            if concentration > 0.30
            else "Business concentration appears moderate."
        ),
    }


def build_secure_act_beneficiary_ira(profile_data: Dict) -> Dict:
    spouse = profile_data.get("spouse") or {}
    children = profile_data.get("children", []) or []
    has_spouse = bool(spouse.get("name") or spouse.get("birth_date"))
    non_spouse_count = len(children)
    return {
        "available": True,
        "eligible_designated_beneficiary_present": has_spouse,
        "non_spouse_beneficiary_count": non_spouse_count,
        "default_rule_non_spouse_years": 10,
        "summary": (
            "Spouse beneficiary can often retain life-expectancy flexibility; non-spouse heirs usually face 10-year depletion."
            if has_spouse
            else "Non-spouse designated beneficiaries generally fall under the 10-year distribution rule."
        ),
    }


def build_annuity_comparison_tool(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    assets = profile_data.get("assets", {}) or {}
    premium = _safe_float(financial.get("annuity_premium"), 0.0)
    if premium <= 0:
        premium = sum(
            _safe_float(a.get("current_value"), 0.0)
            for a in assets.get("pensions_annuities", []) or []
            if str(a.get("type", "")).lower() == "annuity"
        )
    if premium <= 0:
        premium = 250000.0
    fixed_payout_rate = 0.055
    fixed_annual_income = premium * fixed_payout_rate
    investment_draw_rate = 0.04
    investment_income = premium * investment_draw_rate
    return {
        "available": True,
        "premium_assumed": round(premium, 2),
        "fixed_annuity_income": round(fixed_annual_income, 2),
        "portfolio_draw_income": round(investment_income, 2),
        "income_difference": round(fixed_annual_income - investment_income, 2),
        "summary": "Compare guaranteed annuity cashflow vs flexible portfolio draw with market risk.",
    }


def build_cashflow_budget_enhancements(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    budget = profile_data.get("budget", {}) or {}
    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    if annual_expenses <= 0:
        annual_expenses = _safe_float(budget.get("total_annual_expenses"), 0.0)
    annual_surplus = annual_income - annual_expenses
    savings_rate = (annual_surplus / annual_income) if annual_income > 0 else 0.0
    expense_categories = len((budget.get("expenses", {}) or {}).get("current", {}) or {})
    return {
        "available": True,
        "annual_income": round(annual_income, 2),
        "annual_expenses": round(annual_expenses, 2),
        "annual_surplus": round(annual_surplus, 2),
        "savings_rate": round(savings_rate, 4),
        "tracked_expense_categories": expense_categories,
        "summary": "Enhance budget granularity and monitor surplus trends monthly.",
    }


def build_retirement_lifestyle_planning(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    essentials = annual_expenses * 0.65
    discretionary = annual_expenses * 0.35
    lean = annual_expenses * 0.85
    aspirational = annual_expenses * 1.15
    return {
        "available": annual_expenses > 0,
        "essential_spending": round(essentials, 2),
        "discretionary_spending": round(discretionary, 2),
        "lean_lifestyle_budget": round(lean, 2),
        "aspirational_lifestyle_budget": round(aspirational, 2),
        "summary": "Use lean/base/aspirational spending bands for lifestyle tradeoff planning.",
    }


def build_document_vault_beneficiary_tracking(profile_data: Dict) -> Dict:
    beneficiary_fields = 0
    assets = profile_data.get("assets", {}) or {}
    for category in ("retirement_accounts", "taxable_accounts", "pensions_annuities"):
        for a in assets.get(category, []) or []:
            if a.get("beneficiary") or a.get("primary_beneficiary"):
                beneficiary_fields += 1
    docs = profile_data.get("documents", {}) or {}
    checklist = {
        "will": bool(docs.get("will")),
        "revocable_trust": bool(docs.get("revocable_trust")),
        "durable_poa": bool(docs.get("durable_poa")),
        "healthcare_proxy": bool(docs.get("healthcare_proxy")),
    }
    completion = sum(1 for v in checklist.values() if v) / len(checklist)
    return {
        "available": True,
        "beneficiary_records_found": beneficiary_fields,
        "document_checklist": checklist,
        "document_completion_ratio": round(completion, 4),
        "summary": "Track legal docs and account beneficiaries in one place for estate readiness.",
    }


def build_advanced_investment_factor_analysis(profile_data: Dict) -> Dict:
    assets = profile_data.get("assets", {}) or {}
    retirement = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("retirement_accounts", []) or [])
    taxable = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []) or [])
    cash_like = sum(
        _safe_float(a.get("value"), 0.0)
        for a in assets.get("taxable_accounts", []) or []
        if str(a.get("type", "")).lower() in {"cash", "checking", "savings", "money_market", "cd"}
    )
    total = retirement + taxable
    liquidity_ratio = (cash_like / total) if total > 0 else 0.0
    tax_deferred_ratio = (retirement / total) if total > 0 else 0.0
    return {
        "available": total > 0,
        "total_investable_assets": round(total, 2),
        "liquidity_ratio": round(liquidity_ratio, 4),
        "tax_deferred_ratio": round(tax_deferred_ratio, 4),
        "summary": "Assess liquidity and tax-bucket balance to improve portfolio flexibility.",
    }


def build_family_legacy_gifting_goals(profile_data: Dict) -> Dict:
    children = profile_data.get("children", []) or []
    spouse = profile_data.get("spouse") or {}
    beneficiaries = len(children) if children else 1
    donors = 2 if (spouse.get("name") or spouse.get("birth_date")) else 1
    annual_capacity = 18000.0 * beneficiaries * donors
    legacy_goal = _safe_float((profile_data.get("goals", {}) or {}).get("legacy_goal"), 0.0)
    years = 20
    projected_gifts = annual_capacity * years
    return {
        "available": True,
        "beneficiaries_count": beneficiaries,
        "annual_gift_capacity": round(annual_capacity, 2),
        "projected_20y_gifts": round(projected_gifts, 2),
        "legacy_goal": round(legacy_goal, 2),
        "goal_coverage_ratio": round((projected_gifts / legacy_goal), 4) if legacy_goal > 0 else None,
        "summary": "Use annual gifting capacity to pace legacy transfers tax-efficiently.",
    }


def build_risk_analysis_dashboard(profile_data: Dict, scenario_results: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    assets = profile_data.get("assets", {}) or {}
    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    liabilities = sum(_safe_float(l.get("value", 0.0), 0.0) for l in assets.get("liabilities", []) or [])
    investable = sum(_safe_float(a.get("value"), 0.0) for a in assets.get("taxable_accounts", []) or [])
    investable += sum(_safe_float(a.get("value"), 0.0) for a in assets.get("retirement_accounts", []) or [])
    debt_ratio = (liabilities / max(1.0, investable + liabilities))
    expense_coverage = (investable / annual_expenses) if annual_expenses > 0 else 0.0

    moderate = (scenario_results or {}).get("moderate", {}) or {}
    success_rate = _safe_float(moderate.get("success_rate"), 0.0)
    p10 = _safe_float(moderate.get("percentile_10"), 0.0)

    market_risk = min(100.0, max(0.0, (1.0 - success_rate) * 120.0))
    debt_risk = min(100.0, debt_ratio * 150.0)
    liquidity_risk = 100.0 if expense_coverage <= 0 else min(100.0, max(0.0, 60.0 - (expense_coverage * 2.5)))
    downside_risk = 70.0 if p10 <= 0 else max(0.0, 50.0 - (p10 / max(annual_income, 1.0)) * 10.0)
    overall = (market_risk * 0.4) + (debt_risk * 0.2) + (liquidity_risk * 0.2) + (downside_risk * 0.2)

    return {
        "available": True,
        "scores": {
            "overall_risk_score": round(overall, 1),
            "market_risk": round(market_risk, 1),
            "debt_risk": round(debt_risk, 1),
            "liquidity_risk": round(liquidity_risk, 1),
            "downside_risk": round(downside_risk, 1),
        },
        "summary": "Composite risk score blends market durability, debt load, liquidity, and downside resilience.",
    }


def build_plan_health_monitoring_drift_alerts(profile_data: Dict, scenario_results: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    budget = profile_data.get("budget", {}) or {}
    annual_income = _safe_float(financial.get("annual_income"), 0.0)
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    planned_inflation = _safe_float(financial.get("inflation_rate"), 0.03)
    planned_return = _safe_float(financial.get("expected_return"), 0.06)

    actual_spend = _safe_float((budget.get("actuals", {}) or {}).get("annual_spending"), annual_expenses)
    actual_return = _safe_float((profile_data.get("performance", {}) or {}).get("actual_return_last_12m"), planned_return)
    inflation_observed = _safe_float((profile_data.get("performance", {}) or {}).get("inflation_observed"), planned_inflation)

    spend_drift_pct = ((actual_spend - annual_expenses) / annual_expenses) if annual_expenses > 0 else 0.0
    return_drift_pct = actual_return - planned_return
    inflation_drift_pct = inflation_observed - planned_inflation

    drift_score = min(
        100.0,
        (abs(spend_drift_pct) * 120.0) + (abs(return_drift_pct) * 300.0) + (abs(inflation_drift_pct) * 250.0),
    )
    alert_count = 0
    if abs(spend_drift_pct) >= 0.07:
        alert_count += 1
    if return_drift_pct <= -0.03:
        alert_count += 1
    if inflation_drift_pct >= 0.01:
        alert_count += 1

    next_review = "Quarterly" if alert_count > 0 else "Semi-Annual"
    return {
        "available": True,
        "drift_score": round(drift_score, 1),
        "alert_count": int(alert_count),
        "next_review_cadence": next_review,
        "drift_components": {
            "spending_drift_pct": round(spend_drift_pct, 4),
            "return_drift_pct": round(return_drift_pct, 4),
            "inflation_drift_pct": round(inflation_drift_pct, 4),
        },
        "summary": (
            "Material plan drift detected; schedule a targeted review."
            if alert_count > 0
            else "Plan drift appears contained; maintain routine review cadence."
        ),
    }


def build_tax_law_update_engine(profile_data: Dict) -> Dict:
    tax_settings = profile_data.get("tax_settings", {}) or {}
    configured_year = _safe_int(tax_settings.get("tax_year"), date.today().year)
    current_year = date.today().year
    years_stale = max(0, current_year - configured_year)
    freshness = max(0.0, 100.0 - (years_stale * 40.0))
    return {
        "available": True,
        "configured_tax_year": configured_year,
        "current_tax_year": current_year,
        "policy_freshness_score": round(freshness, 1),
        "update_required": years_stale > 0,
        "summary": (
            "Tax policy assumptions are stale; refresh current-year brackets and thresholds."
            if years_stale > 0
            else "Tax policy assumptions are current-year aligned."
        ),
    }


def build_pre65_healthcare_bridge_planner(profile_data: Dict) -> Dict:
    person = profile_data.get("person", {}) or {}
    current_age = _safe_int(person.get("current_age"), 0)
    retirement_age = _safe_int(person.get("retirement_age"), current_age or 65)
    bridge_years = max(0, 65 - max(current_age, retirement_age))
    annual_bridge_cost = _safe_float((profile_data.get("financial", {}) or {}).get("annual_healthcare_expenses"), 12000.0)
    annual_bridge_cost = max(annual_bridge_cost, 9000.0)
    total_bridge_cost = annual_bridge_cost * bridge_years
    subsidy_estimate = total_bridge_cost * 0.18 if bridge_years > 0 else 0.0
    return {
        "available": True,
        "bridge_years": int(bridge_years),
        "annual_bridge_cost": round(annual_bridge_cost, 2),
        "total_bridge_cost": round(total_bridge_cost, 2),
        "estimated_subsidy_opportunity": round(subsidy_estimate, 2),
        "summary": (
            f"Pre-65 healthcare bridge modeled for {bridge_years} years before Medicare."
            if bridge_years > 0
            else "No pre-65 bridge period detected based on current retirement timing."
        ),
    }


def build_guaranteed_income_floor_optimizer(profile_data: Dict, scenario_results: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    annual_expenses = _safe_float(financial.get("annual_expenses"), 0.0)
    essential_spending = annual_expenses * 0.65
    ss_annual = _safe_float(financial.get("social_security_benefit"), 0.0) * 12.0
    pension_annual = _safe_float(financial.get("pension_benefit"), 0.0) * 12.0
    guaranteed_income = ss_annual + pension_annual
    floor_coverage_ratio = (guaranteed_income / essential_spending) if essential_spending > 0 else 0.0
    shortfall = max(0.0, essential_spending - guaranteed_income)
    moderate = (scenario_results or {}).get("moderate", {}) or {}
    durability = _safe_float(moderate.get("success_rate"), 0.0)
    return {
        "available": True,
        "essential_spending": round(essential_spending, 2),
        "guaranteed_income": round(guaranteed_income, 2),
        "floor_coverage_ratio": round(floor_coverage_ratio, 4),
        "annual_floor_shortfall": round(shortfall, 2),
        "durability_signal": round(durability, 4),
        "summary": (
            "Guaranteed income covers essential spending floor."
            if shortfall <= 0
            else "Guaranteed income floor is underfunded; consider timing or annuity layering."
        ),
    }


def build_social_security_statement_reconciliation(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    modeled_monthly = _safe_float(financial.get("social_security_benefit"), 0.0)
    statement_monthly = _safe_float((profile_data.get("social_security_statement", {}) or {}).get("monthly_benefit_estimate"), modeled_monthly)
    delta = statement_monthly - modeled_monthly
    delta_pct = (delta / modeled_monthly) if modeled_monthly > 0 else 0.0
    return {
        "available": True,
        "modeled_monthly_benefit": round(modeled_monthly, 2),
        "statement_monthly_benefit": round(statement_monthly, 2),
        "monthly_delta": round(delta, 2),
        "delta_pct": round(delta_pct, 4),
        "summary": (
            "Social Security assumptions align closely with statement estimates."
            if abs(delta_pct) < 0.05
            else "Social Security estimate drift detected; reconcile statement inputs."
        ),
    }


def build_data_aggregation_reconciliation_hub(profile_data: Dict) -> Dict:
    imports = profile_data.get("imports", {}) or {}
    linked_accounts = _safe_int(imports.get("linked_accounts"), 0)
    csv_sources = _safe_int(imports.get("csv_sources"), 0)
    manual_entries = _safe_int(imports.get("manual_entries"), 0)
    deduped = _safe_int(imports.get("deduplicated_items"), 0)
    total_sources = linked_accounts + csv_sources + (1 if manual_entries > 0 else 0)
    confidence = min(100.0, 55.0 + (linked_accounts * 8.0) + (csv_sources * 5.0) - (manual_entries > 100) * 10.0)
    return {
        "available": True,
        "linked_accounts": linked_accounts,
        "csv_sources": csv_sources,
        "manual_entries": manual_entries,
        "deduplicated_items": deduped,
        "source_count": total_sources,
        "data_confidence_score": round(confidence, 1),
        "summary": "Consolidate linked, imported, and manual data with reconciliation confidence controls.",
    }


def build_longevity_care_path_modeling(profile_data: Dict) -> Dict:
    person = profile_data.get("person", {}) or {}
    current_age = _safe_int(person.get("current_age"), 60)
    life_expectancy = _safe_int(person.get("life_expectancy"), 90)
    years_modeled = max(1, life_expectancy - current_age)

    annual_home_care = 35_000.0
    annual_assisted = 68_000.0
    annual_skilled = 120_000.0
    weighted_annual = (annual_home_care * 0.45) + (annual_assisted * 0.35) + (annual_skilled * 0.20)
    projected_lifetime_care = weighted_annual * min(6, max(2, years_modeled // 5))

    return {
        "available": True,
        "years_modeled": years_modeled,
        "weighted_annual_care_cost": round(weighted_annual, 2),
        "projected_lifetime_care_cost": round(projected_lifetime_care, 2),
        "care_path_mix": {
            "home_care_weight": 0.45,
            "assisted_living_weight": 0.35,
            "skilled_nursing_weight": 0.20,
        },
        "summary": "Modeled staged care-path costs for independent, assisted, and skilled-care transitions.",
    }


def build_charitable_strategy_optimizer(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    annual_giving = _safe_float(financial.get("annual_charitable_giving"), 0.0)
    if annual_giving <= 0:
        annual_giving = 6000.0
    recommended_daf_bunch = annual_giving * 3
    qcd_candidate = min(annual_giving, 108000.0)
    tax_alpha = annual_giving * 0.24
    return {
        "available": True,
        "annual_giving_target": round(annual_giving, 2),
        "recommended_daf_bunch_amount": round(recommended_daf_bunch, 2),
        "qcd_candidate_amount": round(qcd_candidate, 2),
        "estimated_tax_benefit": round(tax_alpha, 2),
        "summary": "Coordinate DAF/QCD and appreciated-asset gifting to improve after-tax giving efficiency.",
    }


def build_household_collaboration_workflow(profile_data: Dict) -> Dict:
    collaborators = profile_data.get("collaborators", []) or []
    review_items = profile_data.get("plan_reviews", []) or []
    open_reviews = sum(1 for item in review_items if str(item.get("status", "")).lower() != "approved")
    approval_ratio = 0.0
    if review_items:
        approval_ratio = sum(1 for item in review_items if str(item.get("status", "")).lower() == "approved") / len(review_items)
    return {
        "available": True,
        "collaborator_count": len(collaborators),
        "review_item_count": len(review_items),
        "open_review_count": open_reviews,
        "approval_ratio": round(approval_ratio, 4),
        "summary": (
            "Household/advisor collaboration workflow is active with tracked approvals."
            if collaborators or review_items
            else "Add spouse/advisor reviewers and formal approval checkpoints for plan governance."
        ),
    }


def build_retirement_paycheck_builder(profile_data: Dict) -> Dict:
    financial = profile_data.get("financial", {}) or {}
    monthly_expenses = _safe_float(financial.get("annual_expenses"), 0.0) / 12.0
    ss_monthly = _safe_float(financial.get("social_security_benefit"), 0.0)
    pension_monthly = _safe_float(financial.get("pension_benefit"), 0.0)
    guaranteed_monthly = ss_monthly + pension_monthly
    portfolio_draw_monthly = max(0.0, monthly_expenses - guaranteed_monthly)
    emergency_buffer_months = 6
    monthly_sources = [
        {"source": "Social Security", "amount": round(ss_monthly, 2)},
        {"source": "Pension/Annuity", "amount": round(pension_monthly, 2)},
        {"source": "Portfolio Withdrawal", "amount": round(portfolio_draw_monthly, 2)},
    ]
    return {
        "available": True,
        "target_monthly_paycheck": round(monthly_expenses, 2),
        "guaranteed_monthly_income": round(guaranteed_monthly, 2),
        "portfolio_draw_monthly": round(portfolio_draw_monthly, 2),
        "emergency_buffer_months": emergency_buffer_months,
        "monthly_sources": monthly_sources,
        "summary": "Build a monthly retirement paycheck sequence across guaranteed and portfolio sources.",
    }
