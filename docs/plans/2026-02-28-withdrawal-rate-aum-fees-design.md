# Design: Configurable Withdrawal Rate + Per-Account Management Fees

**Date:** 2026-02-28
**Status:** Approved

## Problem

1. The withdrawal rate (used in cashflow projections and the FI calculator) is hardcoded to 4%. Users cannot adjust it to reflect their actual planning assumptions (e.g., 3% for conservative, 5% for aggressive).
2. Accounts professionally managed by an advisor incur AUM fees (typically 0.5–1.5%) that drag portfolio returns. There is no way to specify these fees per account, and they are not reflected in the Monte Carlo simulation.

## Solution

### Feature 1 — Editable Withdrawal Rate

Add an inline editable number input to the Withdrawal tab's "Strategy Overview" card, where the rate is currently displayed read-only.

- Input range: 1–15%, step 0.1%, default 4.0%
- Saves to `profile.data.withdrawal_strategy.withdrawal_rate`
- Fix the Dashboard FI calculator to use the profile rate instead of hardcoded `* 25`

**Affected files:**
- `src/static/js/components/withdrawal/withdrawal-tab.js` — add editable input + save
- `src/static/js/components/dashboard/dashboard-tab.js` — use profile rate in FI calculator
- `src/static/js/components/cashflow/cashflow-tab.js` — already reads the profile field (no change needed)

### Feature 2 — Per-Account Management Fee Rate

Add an optional "Advisory Fee Rate %" field to each investment account (retirement accounts and taxable accounts) in the Assets tab.

**Storage:** `management_fee_rate` on each account object (decimal, e.g., `0.01` for 1%).

**Simulation impact — return drag:**
The MC simulation computes a single blended portfolio return (`ret_mean`). Compute a weighted average fee drag across all accounts with a `management_fee_rate` and subtract from `ret_mean`:

```
fee_drag = Σ(account.value × account.management_fee_rate) / total_portfolio_value
effective_ret_mean = ret_mean - fee_drag
```

Apply the same logic to the detailed projection path.

**Affected files:**
- `src/static/js/components/assets/asset-form-fields.js` — add `management_fee_rate` field for investment accounts
- `src/routes/analysis.py` — extract and pass weighted fee drag to retirement model
- `src/services/retirement_model.py` — accept `management_fee_drag` param; subtract from `ret_mean` in both MC and detailed projection
- `src/static/js/components/cashflow/cashflow-tab.js` — compute and apply fee drag to cashflow projections

## Data Model

No schema changes needed. Both values live in the profile JSON blob (`data` column).

```json
{
  "withdrawal_strategy": {
    "withdrawal_rate": 0.04
  },
  "assets": {
    "retirement_accounts": [
      { "name": "Fidelity 401k", "value": 500000, "management_fee_rate": 0.01 }
    ],
    "taxable_accounts": [
      { "name": "Schwab Brokerage", "value": 200000, "management_fee_rate": 0.005 }
    ]
  }
}
```

## Out of Scope

- Per-account return tracking in MC simulation (the model uses a single blended portfolio; fee drag is weighted-average)
- Integration with the Budget tab AUM panel (remains separate)
- Version bump (handled as part of implementation)
