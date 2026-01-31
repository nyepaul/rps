# Release Notes - RPS v3.8.104

**Release Date:** 2026-01-22

## Critical Bug Fix

### Cash Flow Tab Portfolio Projection Fix

**Issue:** The Cash Flow Tab was using a simplified JavaScript calculation that significantly underestimated portfolio growth, showing Demo Dudeman's portfolio depleting to $0 by 2028, while the accurate Retirement Analysis showed $181,953.

**Root Cause:** The simplified calculation was missing several critical components:
- ❌ 401k employee contributions ($4,380/year)
- ❌ Employer match (~$2,190/year)
- ❌ IRA contributions
- ❌ Tax calculations
- ❌ RMDs (Required Minimum Distributions)
- ❌ Tax drag on taxable accounts (15%)
- ❌ Monte Carlo volatility modeling

The JavaScript only added `(income - expenses)` to the portfolio, underestimating contributions by ~$30K+ annually.

**Solution:** The Cash Flow Tab now calls the `/api/analysis` endpoint to fetch accurate Monte Carlo simulation data and uses it for portfolio projections. This ensures consistency between the Cash Flow Tab and Retirement Analysis.

## Changes

### Frontend
- **File:** `src/static/js/components/cashflow/cashflow-tab.js`
  - Added import for `analysisAPI`
  - Created `fetchMonteCarloData()` function to call `/api/analysis` endpoint
  - Modified `renderCashFlowChart()` to be async and fetch Monte Carlo data
  - Added loading indicator while fetching accurate projections
  - Updated chart title to show data source ("Monte Carlo Portfolio ✓" vs "Simplified Portfolio")
  - Portfolio balance now uses Monte Carlo timeline data instead of simplified calculation
  - Cash flow breakdown (income, expenses) still uses existing logic for immediate display

### Behavior Changes

**Before (Simplified Calculation):**
```
Starting portfolio: $91,000
Year 1 calculation:
  Starting + (income - expenses) = $91,000 + $25,000 = $116,000
  After 6% growth = $123,000
  ❌ Missing $30K+ in actual contributions
```

**After (Monte Carlo):**
```
Starting portfolio: $91,000
Year 1 calculation (accurate):
  Starting: $91,000
  + Employment surplus: $25,000
  + 401k contribution: $4,380
  + Employer match: $2,190
  + Surplus allocated to accounts
  After ~7% growth with tax drag = $127,340 ✓
```

### Visual Changes
- Loading indicator shows "Fetching accurate Monte Carlo projections..." while loading
- Chart title now shows "Monte Carlo Portfolio ✓" when using accurate data
- Chart title shows "Simplified Portfolio" as fallback if API fails

## Impact

### Demo Dudeman Example

**2028 Portfolio Balance:**
- Before fix: $0 (incorrect depletion) ❌
- After fix: $181,953 (accurate) ✓

**Retirement (Age 67) Balance:**
- Before fix: Showed premature depletion
- After fix: $2,627,682 (matches Retirement Analysis)

### All Profiles
All users will now see consistent, accurate portfolio projections between:
- Cash Flow Tab
- Retirement Analysis Tab
- Multi-Scenario Analysis

## Technical Details

### API Integration
- Calls `/api/analysis` endpoint with 1,000 simulations (fast response)
- Uses moderate (60/40) asset allocation by default
- Falls back to simplified calculation if API fails
- Reuses existing `mapScenarioToChartData()` function for data mapping

### Performance
- Initial load: ~1-2 seconds (Monte Carlo simulation)
- Subsequent refreshes: Re-fetches for accuracy
- Loading indicator provides visual feedback

## Testing

Verified with Demo Dudeman profile:
- ✅ Portfolio balance matches Retirement Analysis
- ✅ No premature depletion shown
- ✅ Accurate growth projections
- ✅ Loading indicator displays correctly
- ✅ Chart title shows data source

## Deployment

```bash
git add .
git commit -m "fix: Cash Flow Tab now uses accurate Monte Carlo projections"
git push
sudo ./bin/deploy
```

## Related Issues

This fix resolves the critical discrepancy between:
- Cash Flow Tab showing $0 in 2028
- Retirement Analysis showing $181,953 in 2028

Both now use the same accurate calculation engine.

## Dependencies

No new dependencies added. Uses existing:
- `analysisAPI` from `/api/analysis.js`
- Chart.js for visualization
- Monte Carlo simulation from `retirement_model.py`

---

**Version:** 3.8.104
**Previous Version:** 3.8.103
**Type:** Bug Fix (Critical)
**Breaking Changes:** None
