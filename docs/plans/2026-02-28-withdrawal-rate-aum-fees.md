# Configurable Withdrawal Rate + Per-Account Management Fees — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users adjust the safe-withdrawal rate away from 4% and assign advisory fee rates to individual accounts that reduce portfolio returns in simulations.

**Architecture:** Two independent changes to profile JSON data. (1) `withdrawal_strategy.withdrawal_rate` already exists in the profile blob but has no edit UI — add inline editing to the Withdrawal tab and fix the Dashboard FI calculator to read it. (2) Add `management_fee_rate` to each investment account in the Assets tab; compute a portfolio-weighted fee drag and subtract it from `ret_mean` in both the Monte Carlo simulation and the cashflow projection.

**Tech Stack:** Python/Flask backend, vanilla JS ES6 modules, NumPy vectorized simulation, SQLite profile JSON blob, pytest.

---

### Task 1: Editable withdrawal rate in the Withdrawal tab

**Files:**
- Modify: `src/static/js/components/withdrawal/withdrawal-tab.js`

**Step 1: Understand the current read-only display**

The function `renderCurrentWithdrawalState(data)` at line 169 renders the rate as plain text. The outer `renderWithdrawalTab` renders it inside a grid cell. There is currently no save import or handler.

**Step 2: Add the `profilesAPI` import**

At the top of the file, the existing imports are:
```js
import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';
```

Add the profiles API import after those lines:
```js
import { profilesAPI } from '../../api/profiles.js';
```

**Step 3: Replace the read-only rate display with an editable input**

Replace the entire `renderCurrentWithdrawalState` function body. The old function returns three `<div>` columns in a grid. Keep the Annual Amount and Strategy columns, but replace the first column (the rate display) with an editable input:

Old first column HTML (inside the grid):
```html
<div style="text-align: center;">
    <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">${glossaryTerm('Withdrawal Rate', 'withdrawal_rate')}</div>
    <div style="font-size: var(--font-2xl); font-weight: bold; color: var(--accent-color);">${withdrawalRatePercent}%</div>
    <div style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">Annual rate</div>
</div>
```

Replace it with:
```html
<div style="text-align: center;">
    <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">${glossaryTerm('Withdrawal Rate', 'withdrawal_rate')}</div>
    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
        <input id="withdrawal-rate-input"
            type="number" min="1" max="15" step="0.1"
            value="${withdrawalRatePercent}"
            style="width: 70px; padding: 4px 6px; font-size: var(--font-xl); font-weight: bold; color: var(--accent-color); background: var(--bg-secondary); border: 1px solid var(--accent-color); border-radius: 4px; text-align: center;">
        <span style="font-size: var(--font-xl); font-weight: bold; color: var(--accent-color);">%</span>
    </div>
    <div id="withdrawal-rate-status" style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">Annual rate</div>
</div>
```

**Step 4: Wire up the save handler**

After the `setupLearnLinks(container)` call in `renderWithdrawalTab`, add:

```js
setupWithdrawalRateInput(container, profile);
```

Then add this new function after `setupLearnLinks`:

```js
function setupWithdrawalRateInput(container, profile) {
    const input = container.querySelector('#withdrawal-rate-input');
    const status = container.querySelector('#withdrawal-rate-status');
    if (!input) return;

    input.addEventListener('change', async () => {
        const raw = parseFloat(input.value);
        if (!isFinite(raw) || raw < 1 || raw > 15) {
            status.textContent = 'Enter 1–15%';
            status.style.color = 'var(--error-color)';
            return;
        }
        const rate = raw / 100;
        const currentData = profile.data || {};
        const updatedData = {
            ...currentData,
            withdrawal_strategy: {
                ...(currentData.withdrawal_strategy || {}),
                withdrawal_rate: rate,
            },
        };
        status.textContent = 'Saving…';
        status.style.color = 'var(--text-secondary)';
        try {
            const result = await profilesAPI.update(profile.name, { data: updatedData });
            if (result.success) {
                store.set('currentProfile', result.profile || { ...profile, data: updatedData });
                status.textContent = 'Saved';
                status.style.color = 'var(--success-color)';
                setTimeout(() => { status.textContent = 'Annual rate'; status.style.color = 'var(--text-light)'; }, 2000);
            } else {
                status.textContent = 'Save failed';
                status.style.color = 'var(--error-color)';
            }
        } catch {
            status.textContent = 'Save failed';
            status.style.color = 'var(--error-color)';
        }
    });
}
```

**Step 5: Manual test**

1. Start the app: `./bin/start`
2. Open the app, select a profile, go to Withdrawal tab
3. Change the rate input from 4.0 to 3.5, tab away
4. Verify "Saved" flash appears
5. Reload page — verify the rate persists at 3.5%

**Step 6: Commit**

```bash
git add src/static/js/components/withdrawal/withdrawal-tab.js
git commit -m "feat: add editable withdrawal rate input to Withdrawal tab"
```

---

### Task 2: Fix Dashboard FI calculator to use profile withdrawal rate

**Files:**
- Modify: `src/static/js/components/dashboard/dashboard-tab.js`

**Step 1: Locate the FI calculation**

Around line 1963 you'll find:
```js
// Years to Financial Independence (simplified 4% rule)
const assets = data.assets || {};
const { netWorth } = calculateNetWorth(assets);
const targetAmount = totalAnnualExpenses * 25; // 4% rule
```

**Step 2: Read the withdrawal rate from the profile and use it**

Replace those lines with:
```js
// Years to Financial Independence
const assets = data.assets || {};
const { netWorth } = calculateNetWorth(assets);
const fiWithdrawalRate = data.withdrawal_strategy?.withdrawal_rate || 0.04;
const targetAmount = fiWithdrawalRate > 0 ? totalAnnualExpenses / fiWithdrawalRate : totalAnnualExpenses * 25;
```

**Step 3: Update the label that says "4% rule"**

Around line 2028 you'll find:
```js
Based on 4% rule (${formatCurrency(targetAmount, 0)} target)
```

Replace with:
```js
Based on ${(fiWithdrawalRate * 100).toFixed(1)}% withdrawal rate (${formatCurrency(targetAmount, 0)} target)
```

Note: `fiWithdrawalRate` is defined in the outer function scope by the change above, so it's accessible here.

**Step 4: Manual test**

1. Set withdrawal rate to 3% in the Withdrawal tab (Task 1)
2. Open the Dashboard savings rate modal
3. Verify the FI target is `annual_expenses / 0.03` (about 33× instead of 25×) and the label shows "3.0% withdrawal rate"

**Step 5: Commit**

```bash
git add src/static/js/components/dashboard/dashboard-tab.js
git commit -m "feat: dashboard FI calculator respects profile withdrawal rate"
```

---

### Task 3: Add management_fee_rate field to investment account forms

**Files:**
- Modify: `src/static/js/components/assets/asset-form-fields.js`

**Step 1: Understand the field definition format**

Each field in `FIELD_DEFINITIONS` is an object. Fields with `showFor` only appear for listed account types. The `management_fee_rate` field should appear for investment-type accounts (not cash/checking/savings).

**Step 2: Add the field to `retirement_accounts`**

At the end of the `retirement_accounts` array (after `cash_pct`), append:
```js
{ name: 'management_fee_rate', label: 'Advisory Fee Rate (%)', type: 'number',
  min: 0, max: 5, step: 0.01, placeholder: '0.00',
  help: 'Annual AUM fee charged by your advisor (e.g., 1.00 for 1%). Applied as a return drag in simulations.' },
```

**Step 3: Add the field to `taxable_accounts`**

At the end of the `taxable_accounts` array (after `cash_pct`), append:
```js
{ name: 'management_fee_rate', label: 'Advisory Fee Rate (%)', type: 'number',
  min: 0, max: 5, step: 0.01, placeholder: '0.00',
  showFor: ['brokerage'],
  help: 'Annual AUM fee charged by your advisor (e.g., 1.00 for 1%). Applied as a return drag in simulations.' },
```

The `showFor: ['brokerage']` means it only renders for brokerage accounts, not savings/checking/cash/CD.

**Step 4: Verify the form renders the field**

Start the app, go to Assets tab, add or edit a retirement account. The "Advisory Fee Rate (%)" field should appear at the bottom of the form. Enter 1.00 (meaning 1%), save. Verify the value is stored in the profile's account object as `management_fee_rate: 1.0` (percent — the form stores user's raw input).

**Step 5: Commit**

```bash
git add src/static/js/components/assets/asset-form-fields.js
git commit -m "feat: add advisory fee rate field to investment account forms"
```

---

### Task 4: Write and run test for fee drag computation

**Files:**
- Modify: `tests/test_routes/test_analysis.py`
- Modify: `src/routes/analysis.py`

**Step 1: Write a failing test for `transform_assets_to_investment_types` preserving fee rate**

Add this test to `tests/test_routes/test_analysis.py`:

```python
def test_transform_assets_preserves_management_fee_rate():
    """transform_assets_to_investment_types should carry management_fee_rate through."""
    from src.routes.analysis import transform_assets_to_investment_types
    assets = {
        "retirement_accounts": [
            {"type": "traditional_ira", "value": 200000, "management_fee_rate": 1.0},
            {"type": "roth_ira", "value": 100000},
        ],
        "taxable_accounts": [
            {"type": "brokerage", "value": 50000, "management_fee_rate": 0.5},
        ],
    }
    result = transform_assets_to_investment_types(assets)
    # management_fee_rate stored as percent in form (1.0 = 1%), must be preserved
    ira = next(r for r in result if r["account"] == "Traditional IRA")
    assert ira["management_fee_rate"] == 1.0
    brokerage = next(r for r in result if r["account"] == "Taxable Brokerage")
    assert brokerage["management_fee_rate"] == 0.5
    # Accounts with no fee should default to 0
    roth = next(r for r in result if r["account"] == "Roth IRA" and r.get("management_fee_rate", 0) == 0)
    assert roth is not None
```

**Step 2: Run test to confirm it fails**

```bash
source venv/bin/activate && pytest tests/test_routes/test_analysis.py::test_transform_assets_preserves_management_fee_rate -v
```

Expected: FAIL — `KeyError: 'management_fee_rate'` or `StopIteration`

**Step 3: Update `transform_assets_to_investment_types` to pass the fee rate through**

In `src/routes/analysis.py`, in the `transform_assets_to_investment_types` function, update all three `investment_types.append(...)` calls to include `management_fee_rate`.

For the retirement accounts block (lines ~105–111), change:
```python
investment_types.append(
    {
        "account": account_name,
        "value": asset.get("value", 0),
        "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
        "name": asset.get("name", ""),
    }
)
```
to:
```python
investment_types.append(
    {
        "account": account_name,
        "value": asset.get("value", 0),
        "cost_basis": asset.get("cost_basis", asset.get("value", 0)),
        "name": asset.get("name", ""),
        "management_fee_rate": asset.get("management_fee_rate", 0),
    }
)
```

Apply the same change for the taxable accounts block (lines ~118–124) and the other assets block (lines ~138–144).

**Step 4: Run test to confirm it passes**

```bash
source venv/bin/activate && pytest tests/test_routes/test_analysis.py::test_transform_assets_preserves_management_fee_rate -v
```

Expected: PASS

**Step 5: Write a failing test for the weighted fee drag helper**

Add to `tests/test_routes/test_analysis.py`:

```python
def test_compute_weighted_fee_drag():
    """Weighted average of management fees across portfolio."""
    from src.routes.analysis import compute_management_fee_drag
    investment_types = [
        {"value": 200000, "management_fee_rate": 1.0},  # 1% on 200k
        {"value": 100000, "management_fee_rate": 0.0},  # no fee on 100k
        {"value": 100000, "management_fee_rate": 0.5},  # 0.5% on 100k
    ]
    # Total = 400k. Fee = 200k*0.01 + 100k*0.005 = 2000 + 500 = 2500
    # Drag = 2500 / 400000 = 0.00625 (in decimal)
    drag = compute_management_fee_drag(investment_types)
    assert abs(drag - 0.00625) < 1e-9

def test_compute_weighted_fee_drag_no_assets():
    from src.routes.analysis import compute_management_fee_drag
    assert compute_management_fee_drag([]) == 0.0

def test_compute_weighted_fee_drag_no_fees():
    from src.routes.analysis import compute_management_fee_drag
    investment_types = [{"value": 500000, "management_fee_rate": 0}]
    assert compute_management_fee_drag(investment_types) == 0.0
```

**Step 6: Run tests to confirm they fail**

```bash
source venv/bin/activate && pytest tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag_no_assets tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag_no_fees -v
```

Expected: FAIL — `ImportError: cannot import name 'compute_management_fee_drag'`

**Step 7: Implement `compute_management_fee_drag` in `analysis.py`**

Add this function after `transform_assets_to_investment_types` in `src/routes/analysis.py`:

```python
def compute_management_fee_drag(investment_types):
    """Compute portfolio-weighted advisory fee drag (decimal, e.g. 0.01 for 1%).

    The form stores management_fee_rate as a percent (e.g. 1.0 for 1%).
    This converts to decimal and weights by account value.
    """
    total_value = sum(inv.get("value", 0) for inv in investment_types)
    if total_value <= 0:
        return 0.0
    weighted_fee = sum(
        inv.get("value", 0) * (inv.get("management_fee_rate", 0) / 100.0)
        for inv in investment_types
    )
    return weighted_fee / total_value
```

**Step 8: Run tests to confirm they pass**

```bash
source venv/bin/activate && pytest tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag_no_assets tests/test_routes/test_analysis.py::test_compute_weighted_fee_drag_no_fees tests/test_routes/test_analysis.py::test_transform_assets_preserves_management_fee_rate -v
```

Expected: all PASS

**Step 9: Commit**

```bash
git add src/routes/analysis.py tests/test_routes/test_analysis.py
git commit -m "feat: compute weighted management fee drag from investment account data"
```

---

### Task 5: Apply fee drag in Monte Carlo simulation

**Files:**
- Modify: `src/services/retirement_model.py`
- Modify: `tests/test_services/test_retirement_model.py`

**Step 1: Write a failing test**

Add to `tests/test_services/test_retirement_model.py`:

```python
def test_management_fee_drag_reduces_ret_mean():
    """A 1% management fee drag should produce lower median outcome than no drag."""
    model = _create_basic_model()
    assumptions = MarketAssumptions(stock_allocation=0.6)

    result_no_fee = model.monte_carlo_simulation(
        years=20, simulations=500, assumptions=assumptions, management_fee_drag=0.0
    )
    result_with_fee = model.monte_carlo_simulation(
        years=20, simulations=500, assumptions=assumptions, management_fee_drag=0.01
    )
    # With a 1% drag, median final balance should be meaningfully lower
    assert result_no_fee["median_final_balance"] > result_with_fee["median_final_balance"]
```

**Step 2: Run to confirm it fails**

```bash
source venv/bin/activate && pytest tests/test_services/test_retirement_model.py::test_management_fee_drag_reduces_ret_mean -v
```

Expected: FAIL — `TypeError: monte_carlo_simulation() got an unexpected keyword argument 'management_fee_drag'`

**Step 3: Add the parameter and apply the drag in `monte_carlo_simulation`**

In `src/services/retirement_model.py`, the function signature at line 535 is:
```python
def monte_carlo_simulation(
    self,
    years: int,
    simulations: int = 10000,
    assumptions: MarketAssumptions = None,
    effective_tax_rate: float = 0.22,
    spending_model: str = "constant_real",
    market_periods: Dict = None,
):
```

Add `management_fee_drag: float = 0.0` to the signature:
```python
def monte_carlo_simulation(
    self,
    years: int,
    simulations: int = 10000,
    assumptions: MarketAssumptions = None,
    effective_tax_rate: float = 0.22,
    spending_model: str = "constant_real",
    market_periods: Dict = None,
    management_fee_drag: float = 0.0,
):
```

Then find the portfolio mean return calculation (around line 780):
```python
# Calculate Portfolio Mean Return
ret_mean = (
    allocs["stock"] * year_assumptions.stock_return_mean
    + allocs["bond"] * year_assumptions.bond_return_mean
    + allocs["cash"] * year_assumptions.cash_return_mean
    + allocs["reit"] * year_assumptions.reit_return_mean
    + allocs["gold"] * year_assumptions.gold_return_mean
    + allocs["crypto"] * year_assumptions.crypto_return_mean
)
```

Append the fee drag subtraction immediately after that block:
```python
# Subtract advisory fee drag (weighted average of AUM fees on managed accounts)
ret_mean = max(ret_mean - management_fee_drag, -1.0)
```

**Step 4: Run test to confirm it passes**

```bash
source venv/bin/activate && pytest tests/test_services/test_retirement_model.py::test_management_fee_drag_reduces_ret_mean -v
```

Expected: PASS

**Step 5: Apply the drag in `run_detailed_projection` too**

Find the signature of `run_detailed_projection` at line 1393:
```python
def run_detailed_projection(
    self,
    years: int,
    assumptions: MarketAssumptions = None,
    spending_model: str = "constant_real",
):
```

Add the parameter:
```python
def run_detailed_projection(
    self,
    years: int,
    assumptions: MarketAssumptions = None,
    spending_model: str = "constant_real",
    management_fee_drag: float = 0.0,
):
```

Then find where `run_detailed_projection` calculates `ret_mean`. It follows the same allocation-based formula as `monte_carlo_simulation`. Search for `ret_mean =` inside this method. After it, add:
```python
ret_mean = max(ret_mean - management_fee_drag, -1.0)
```

**Step 6: Run full retirement model test suite to make sure nothing regressed**

```bash
source venv/bin/activate && pytest tests/test_services/test_retirement_model.py -v
```

Expected: all PASS

**Step 7: Commit**

```bash
git add src/services/retirement_model.py tests/test_services/test_retirement_model.py
git commit -m "feat: apply management fee drag as return reduction in MC simulation"
```

---

### Task 6: Pass fee drag from analysis route to simulation calls

**Files:**
- Modify: `src/routes/analysis.py`

**Step 1: Compute the drag after building investment_types**

In the main analysis handler, after line 631 (`investment_types = transform_assets_to_investment_types(assets_data)`), add:

```python
management_fee_drag = compute_management_fee_drag(investment_types)
```

**Step 2: Pass the drag to each `monte_carlo_simulation` call**

The simulation loop (around line 780) calls:
```python
scenario_result = model.monte_carlo_simulation(
    years=years,
    simulations=data.simulations,
    assumptions=market_assumptions,
    spending_model=data.spending_model,
    market_periods=data.market_periods.dict() if data.market_periods else None,
)
```

Add the new parameter:
```python
scenario_result = model.monte_carlo_simulation(
    years=years,
    simulations=data.simulations,
    assumptions=market_assumptions,
    spending_model=data.spending_model,
    market_periods=data.market_periods.dict() if data.market_periods else None,
    management_fee_drag=management_fee_drag,
)
```

**Step 3: Find and update the `run_detailed_projection` call**

Search for `run_detailed_projection` calls in `analysis.py` (around line 1266). Apply `management_fee_drag` there too. Note: there may be a second occurrence in the cashflow endpoint handler. For each occurrence:

```python
result = model.run_detailed_projection(
    years=years,
    assumptions=market_assumptions,
    spending_model=...,
    management_fee_drag=management_fee_drag,
)
```

Make sure `management_fee_drag` is computed from `investment_types` in both code paths. The cashflow handler also calls `transform_assets_to_investment_types` around line 1180 — add `compute_management_fee_drag` there too.

**Step 4: Run the full analysis test suite**

```bash
source venv/bin/activate && pytest tests/test_routes/test_analysis.py -v
```

Expected: all PASS (the fee drag tests from Task 4 still pass, plus existing tests still pass)

**Step 5: Commit**

```bash
git add src/routes/analysis.py
git commit -m "feat: wire management fee drag from asset data to simulation calls"
```

---

### Task 7: Apply fee drag in the frontend cashflow projection

**Files:**
- Modify: `src/static/js/components/cashflow/cashflow-tab.js`

**Step 1: Find where `annualGrowthRate` is computed**

Around line 1624, after computing the blended `annualGrowthRate`:
```js
const annualGrowthRate =
    (stockAllocation * (marketProfile.stock_return_mean || 0.10)) +
    ...
    (cryptoAllocation * (marketProfile.crypto_return_mean || 0.20));
```

**Step 2: Compute the fee drag from asset data**

Immediately after the `annualGrowthRate` calculation, add:
```js
// Compute advisory fee drag from managed accounts
const allAccounts = [
    ...(assets.retirement_accounts || []),
    ...(assets.taxable_accounts || []),
];
const totalPortfolioValue = allAccounts.reduce((s, a) => s + (a.value || 0), 0);
const weightedFee = allAccounts.reduce(
    (s, a) => s + (a.value || 0) * ((a.management_fee_rate || 0) / 100),
    0
);
const feeDrag = totalPortfolioValue > 0 ? weightedFee / totalPortfolioValue : 0;
const effectiveAnnualGrowthRate = Math.max(annualGrowthRate - feeDrag, -1);
```

**Step 3: Replace uses of `annualGrowthRate` with `effectiveAnnualGrowthRate`**

One line below the block above, the code computes:
```js
const monthlyGrowthRate = annualGrowthRate / 12;
```

Change to:
```js
const monthlyGrowthRate = effectiveAnnualGrowthRate / 12;
```

That single variable drives all the portfolio growth math in the monthly loop, so this one change propagates through.

**Step 4: Manual test**

1. Add a 1% advisory fee to a retirement account in Assets
2. Go to Cashflow tab
3. Compare portfolio trajectory against a profile with no fee
4. The managed account profile should show a materially lower portfolio balance over 20–30 years

**Step 5: Commit**

```bash
git add src/static/js/components/cashflow/cashflow-tab.js
git commit -m "feat: apply advisory fee drag to cashflow projection growth rate"
```

---

### Task 8: Version bump and final smoke test

**Step 1: Bump to 3.10.2**

```bash
./bin/bump-version 3.10.15 "feat: configurable withdrawal rate and per-account advisory fee return drag"
```

**Step 2: Run full test suite**

```bash
source venv/bin/activate && pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: existing tests pass; the new tests from Tasks 4 and 5 pass.

**Step 3: Commit the version bump**

```bash
git add src/static/version.json src/static/index.html
git commit -m "chore: bump to v3.10.2 - configurable withdrawal rate and advisory fee drag"
```

---

## Summary of all changed files

| File | Change |
|------|--------|
| `src/static/js/components/withdrawal/withdrawal-tab.js` | Editable withdrawal rate input + save |
| `src/static/js/components/dashboard/dashboard-tab.js` | FI calculator uses profile withdrawal rate |
| `src/static/js/components/assets/asset-form-fields.js` | Advisory fee rate field on investment accounts |
| `src/routes/analysis.py` | Pass `management_fee_rate` through transform; add `compute_management_fee_drag`; wire drag to simulation calls |
| `src/services/retirement_model.py` | Accept `management_fee_drag` param; subtract from `ret_mean` in MC and detailed projection |
| `src/static/js/components/cashflow/cashflow-tab.js` | Compute and apply fee drag to frontend cashflow projection |
| `tests/test_routes/test_analysis.py` | Tests for fee rate passthrough and drag computation |
| `tests/test_services/test_retirement_model.py` | Test that fee drag reduces median outcome |
| `src/static/version.json`, `src/static/index.html` | Version 3.10.15 |
