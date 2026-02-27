"""
Tax Engine Service
------------------
Decoupled tax calculation logic for the Retirement Planning System.
All constants are loaded from tax_policy.json by year.
"""

from __future__ import annotations

import numpy as np
from typing import Tuple

from src.services.tax_policy import get_tax_policy


class TaxEngine:
    """Stateless tax calculation engine."""

    @staticmethod
    def calculate_standard_deduction(
        tax_year: int, filing_status: str, p1_age: float = 0, p2_age: float = 0
    ) -> float:
        policy = get_tax_policy(tax_year)
        base = policy.standard_deduction.get(filing_status, policy.standard_deduction["mfj"])

        if filing_status in ("single", "hoh"):
            if p1_age >= 65:
                base += policy.standard_deduction["blind_aged_single"]
        else:
            if p1_age >= 65:
                base += policy.standard_deduction["blind_aged_mfj"]
            if p2_age >= 65:
                base += policy.standard_deduction["blind_aged_mfj"]

        return base

    @staticmethod
    def calculate_federal_tax(
        taxable_income: float, tax_year: int, filing_status: str = "mfj"
    ) -> float:
        policy = get_tax_policy(tax_year)
        brackets = policy.federal_brackets.get(filing_status, policy.federal_brackets["mfj"])
        tax = 0.0
        for lower, upper, rate in brackets:
            if taxable_income > lower:
                taxable_amount = min(taxable_income, upper) - lower
                tax += taxable_amount * rate
            else:
                break
        return tax

    @staticmethod
    def calculate_federal_tax_vectorized(
        taxable_income: np.ndarray, tax_year: int, filing_status: str = "mfj"
    ) -> Tuple[np.ndarray, np.ndarray]:
        policy = get_tax_policy(tax_year)
        brackets = policy.federal_brackets.get(filing_status, policy.federal_brackets["mfj"])

        total_tax = np.zeros_like(taxable_income, dtype=float)
        marginal_rate = np.zeros_like(taxable_income, dtype=float)

        for lower, upper, rate in brackets:
            in_bracket = np.clip(taxable_income - lower, 0, upper - lower)
            total_tax += in_bracket * rate
            marginal_rate = np.where(taxable_income > lower, rate, marginal_rate)

        return total_tax, marginal_rate

    @staticmethod
    def calculate_taxable_ss_vectorized(
        other_income: np.ndarray,
        ss_benefit: np.ndarray,
        tax_year: int,
        filing_status: str = "mfj",
    ) -> np.ndarray:
        policy = get_tax_policy(tax_year)
        thresholds = policy.ss_taxability.get(filing_status, policy.ss_taxability["mfj"])
        threshold_1, threshold_2 = thresholds

        provisional = other_income + (ss_benefit * 0.5)
        taxable_ss = np.zeros_like(ss_benefit)

        in_middle = (provisional > threshold_1) & (provisional <= threshold_2)
        excess_1 = np.maximum(0, provisional - threshold_1)
        taxable_ss = np.where(
            in_middle, np.minimum(ss_benefit * 0.5, excess_1 * 0.5), taxable_ss
        )

        above_threshold_2 = provisional > threshold_2
        excess_2 = np.maximum(0, provisional - threshold_2)
        # base_taxable is what would be taxable if provisional stopped at threshold_2:
        # = min(ss * 0.5, (threshold_2 - threshold_1) * 0.5)
        base_taxable = np.minimum(ss_benefit * 0.5, (threshold_2 - threshold_1) * 0.5)
        additional = excess_2 * 0.85
        max_85 = ss_benefit * 0.85
        taxable_ss = np.where(
            above_threshold_2, np.minimum(max_85, base_taxable + additional), taxable_ss
        )

        return taxable_ss

    @staticmethod
    def calculate_ltcg_tax_vectorized(
        gains: np.ndarray,
        ordinary_income: np.ndarray,
        tax_year: int,
        filing_status: str = "mfj",
    ) -> np.ndarray:
        policy = get_tax_policy(tax_year)
        brackets = policy.ltcg_brackets.get(filing_status, policy.ltcg_brackets["mfj"])

        # Expected brackets: 0%, 15%, 20% in ascending order
        threshold_0 = brackets[0][1]
        threshold_15 = brackets[1][1]

        ltcg_tax = np.zeros_like(gains)

        room_0 = np.maximum(0, threshold_0 - ordinary_income)
        gains_at_0 = np.minimum(gains, room_0)
        remaining_gains = gains - gains_at_0

        income_after_0 = np.maximum(ordinary_income, threshold_0)
        room_15 = np.maximum(0, threshold_15 - income_after_0)
        gains_at_15 = np.minimum(remaining_gains, room_15)
        remaining_gains = remaining_gains - gains_at_15

        gains_at_20 = remaining_gains

        ltcg_tax = (gains_at_0 * 0.0) + (gains_at_15 * 0.15) + (gains_at_20 * 0.20)
        return ltcg_tax

    @staticmethod
    def calculate_irmaa_vectorized(
        magi: np.ndarray,
        tax_year: int,
        filing_status: str = "mfj",
        both_on_medicare: bool = True,
    ) -> np.ndarray:
        policy = get_tax_policy(tax_year)
        # MFS uses single-filer IRMAA thresholds per IRS rules, not MFJ thresholds
        irmaa_status = "single" if filing_status == "mfs" else filing_status
        thresholds = policy.irmaa.get(irmaa_status, policy.irmaa.get("single", policy.irmaa["mfj"]))

        irmaa = np.zeros_like(magi)
        for lower, upper, surcharge in thresholds:
            in_tier = (magi > lower) & (magi <= upper)
            irmaa = np.where(in_tier, surcharge, irmaa)

        top_threshold = thresholds[-1][0]
        top_surcharge = thresholds[-1][2]
        irmaa = np.where(magi > top_threshold, top_surcharge, irmaa)

        if both_on_medicare and filing_status == "mfj":
            irmaa = irmaa * 2

        return irmaa

    @staticmethod
    def calculate_fica_tax(gross_income: float, tax_year: int) -> float:
        policy = get_tax_policy(tax_year)
        ss_wage_base = policy.fica["ss_wage_base"]
        ss_rate = policy.fica["ss_rate"]
        medicare_rate = policy.fica["medicare_rate"]

        ss_tax = min(gross_income, ss_wage_base) * ss_rate
        med_tax = gross_income * medicare_rate
        return ss_tax + med_tax

    @staticmethod
    def calculate_fica_tax_vectorized(
        gross_income: np.ndarray, tax_year: int
    ) -> np.ndarray:
        policy = get_tax_policy(tax_year)
        ss_wage_base = policy.fica["ss_wage_base"]
        ss_rate = policy.fica["ss_rate"]
        medicare_rate = policy.fica["medicare_rate"]

        ss_tax = np.minimum(gross_income, ss_wage_base) * ss_rate
        med_tax = gross_income * medicare_rate
        return ss_tax + med_tax

    # Flat-rate state income tax approximations (top marginal / blended effective rate)
    STATE_TAX_RATES: dict = {
        "AL": 0.050, "AK": 0.000, "AZ": 0.025, "AR": 0.047, "CA": 0.093,
        "CO": 0.044, "CT": 0.055, "DE": 0.066, "FL": 0.000, "GA": 0.055,
        "HI": 0.080, "ID": 0.058, "IL": 0.0495, "IN": 0.0315, "IA": 0.057,
        "KS": 0.057, "KY": 0.040, "LA": 0.0425, "ME": 0.0715, "MD": 0.0575,
        "MA": 0.050, "MI": 0.0425, "MN": 0.0985, "MS": 0.050, "MO": 0.048,
        "MT": 0.0575, "NE": 0.0584, "NV": 0.000, "NH": 0.000, "NJ": 0.0637,
        "NM": 0.059, "NY": 0.0585, "NC": 0.0475, "ND": 0.025, "OH": 0.035,
        "OK": 0.0475, "OR": 0.099, "PA": 0.0307, "RI": 0.0599, "SC": 0.064,
        "SD": 0.000, "TN": 0.000, "TX": 0.000, "UT": 0.0465, "VT": 0.0875,
        "VA": 0.0575, "WA": 0.000, "WV": 0.055, "WI": 0.0765, "WY": 0.000,
        "DC": 0.0895,
    }

    @staticmethod
    def get_state_tax_rate(state: str) -> float:
        """Return the flat-rate state income tax approximation for the given state."""
        return TaxEngine.STATE_TAX_RATES.get(state.upper(), 0.05)

    @staticmethod
    def calculate_state_tax(taxable_income: float, state: str = "NY") -> float:
        rate = TaxEngine.get_state_tax_rate(state)
        return taxable_income * rate

    @staticmethod
    def get_contribution_limits(tax_year: int) -> dict:
        policy = get_tax_policy(tax_year)
        return policy.contribution_limits
