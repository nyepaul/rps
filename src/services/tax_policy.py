"""Tax policy loader for year-specific constants."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

# The most recent completed tax year with published IRS data.
# Update this when new-year data is added to config/tax_policy.json.
CURRENT_TAX_YEAR = 2025


@dataclass(frozen=True)
class TaxPolicy:
    year: int
    federal_brackets: Dict[str, List[List[float]]]
    ltcg_brackets: Dict[str, List[List[float]]]
    standard_deduction: Dict[str, float]
    ss_taxability: Dict[str, List[float]]
    irmaa: Dict[str, List[List[float]]]
    fica: Dict[str, float]
    contribution_limits: Dict[str, float]
    rmd_age: int
    rmd_factors: Dict[int, float]
    qcd_age: float
    qcd_annual_limit: float


_POLICY_CACHE: Dict[int, TaxPolicy] = {}


def _policy_path() -> Path:
    project_root = Path(__file__).parent.parent.parent
    return project_root / "config" / "tax_policy.json"


def _normalize_brackets(brackets: List[List[Any]]) -> List[List[float]]:
    normalized = []
    for lower, upper, rate in brackets:
        upper_val = float("inf") if upper == "inf" else float(upper)
        normalized.append([float(lower), upper_val, float(rate)])
    return normalized


def get_tax_policy(year: int) -> TaxPolicy:
    if year in _POLICY_CACHE:
        return _POLICY_CACHE[year]

    path = _policy_path()
    if not path.exists():
        raise ValueError("Tax policy file not found. Cannot compute taxes accurately.")

    raw = json.loads(path.read_text())
    years = raw.get("years", {})
    requested_year = year
    if str(year) not in years:
        fallback_year = os.environ.get("RPS_TAX_POLICY_FALLBACK_YEAR")
        if fallback_year and str(fallback_year) in years:
            year = int(fallback_year)
        else:
            available_years = sorted(
                int(y) for y in years.keys() if str(y).isdigit()
            )
            if not available_years:
                raise ValueError("No tax policy years are available.")

            # For future years, use the newest available policy.
            # For older years not in data, use the closest earlier year when possible.
            eligible = [y for y in available_years if y <= requested_year]
            year = max(eligible) if eligible else min(available_years)

    data = years[str(year)]
    policy = TaxPolicy(
        year=year,
        federal_brackets={
            k: _normalize_brackets(v) for k, v in data["federal_brackets"].items()
        },
        ltcg_brackets={
            k: _normalize_brackets(v) for k, v in data["ltcg_brackets"].items()
        },
        standard_deduction={k: float(v) for k, v in data["standard_deduction"].items()},
        ss_taxability={k: [float(x) for x in v] for k, v in data["ss_taxability"].items()},
        irmaa={k: _normalize_brackets(v) for k, v in data["irmaa"].items()},
        fica={k: float(v) for k, v in data["fica"].items()},
        contribution_limits={k: float(v) for k, v in data["contribution_limits"].items()},
        rmd_age=int(data["rmd"]["age"]),
        rmd_factors={int(k): float(v) for k, v in data["rmd"]["factors"].items()},
        qcd_age=float(data["qcd"]["age"]),
        qcd_annual_limit=float(data["qcd"]["annual_limit"]),
    )
    _POLICY_CACHE[requested_year] = policy
    _POLICY_CACHE[year] = policy
    return policy
