# Cash Flow vs Analysis Portfolio Projections

## Question: Do they show the same forecast?

**Short answer: No, they use completely different calculation methods.**

## Detailed Comparison

### Cash Flow Tab (Current Implementation)

**Projection Method:** Simplified Deterministic Calculation

**Assumptions:**
- **Return rate**: 6% annual (0.5% monthly) - FIXED
- **Inflation**: 3% annual (0.25% monthly) - FIXED
- **Calculation**: Deterministic (same result every time)
- **Engine**: JavaScript frontend calculation

**Code Location:** `src/static/js/components/cashflow/cashflow-tab.js`
```javascript
// Line 445-446
const monthlyGrowthRate = 0.06 / 12; // 6% annual return assumption
const monthlyInflationRate = 0.03 / 12; // 3% annual inflation
```

**Purpose:**
- Quick visualization of cash flow patterns
- Shows rough portfolio trajectory
- Fast client-side rendering

---

### Analysis Tab (Monte Carlo Simulation)

**Projection Method:** Full Monte Carlo with Market Volatility

**Assumptions:**
- **Stock returns**: 10% mean, 18% standard deviation
- **Bond returns**: 4% mean, 6% standard deviation
- **Inflation**: 3% mean, 1% standard deviation
- **Actual return**: Weighted by allocation (e.g., 60% stocks + 40% bonds = 7.6% expected)
- **Calculation**: Stochastic with 10,000 simulations
- **Engine**: Python backend with NumPy vectorization

**Code Location:** `src/services/retirement_model.py`
```python
# Lines 63-69
class MarketAssumptions:
    stock_allocation: float = 0.5
    stock_return_mean: float = 0.10
    bond_return_mean: float = 0.04
    inflation_mean: float = 0.03
    stock_return_std: float = 0.18
    bond_return_std: float = 0.06
    inflation_std: float = 0.01
```

**Purpose:**
- Accurate retirement planning with confidence intervals
- Shows range of possible outcomes (10th to 90th percentile)
- Accounts for market volatility and sequence-of-returns risk

---

## Key Differences

| Aspect | Cash Flow Tab | Analysis Tab |
|--------|--------------|--------------|
| **Expected Return** | 6% fixed | 7.6% expected (60/40), 8.8% (80/20), etc. |
| **Variability** | None (deterministic) | High (includes volatility) |
| **Simulations** | 1 path | 10,000 paths |
| **Output** | Single projection | Percentile ranges (10th-90th) |
| **Calculation Time** | Instant (<100ms) | 2-5 seconds |
| **Accuracy** | Rough estimate | Financial planning grade |
| **Use Case** | Quick visualization | Retirement planning decisions |

---

## Example Comparison

For a $1M portfolio over 30 years:

### Cash Flow Tab
- Shows single line: $1M → grows to ~$5.7M (6% compounded)
- Assumes smooth, consistent growth
- No uncertainty shown

### Analysis Tab (60/40 Moderate)
- **Median (50th percentile)**: $1M → $7.9M (7.6% expected return)
- **75th percentile**: $1M → $10.8M (good market outcomes)
- **25th percentile**: $1M → $5.8M (poor market outcomes)
- **10th percentile**: $1M → $4.1M (very poor outcomes)
- Shows full range of possibilities

---

## Why the Difference?

### 1. Return Rate Mismatch
- **Cash Flow**: Uses conservative 6% flat rate
- **Analysis**: Uses allocation-weighted returns (typically 7-9% for balanced portfolios)

### 2. Volatility
- **Cash Flow**: Ignores year-to-year volatility (smooths everything)
- **Analysis**: Incorporates real market volatility (18% stock std dev, 6% bond std dev)

### 3. Sequence of Returns Risk
- **Cash Flow**: Assumes steady 6% every year
- **Analysis**: Accounts for bad years early in retirement (the biggest risk)

---

## Which Should You Trust?

### For Quick Cash Flow Visualization
✅ **Cash Flow Tab** is fine for:
- Understanding income/expense timing
- Seeing when retirement benefits start
- Checking if withdrawals are sustainable at a basic level

### For Retirement Planning Decisions
✅ **Analysis Tab** is essential for:
- Determining if your portfolio will last
- Understanding success probability
- Making allocation decisions
- Stress-testing retirement scenarios
- Planning withdrawal strategies

---

## Future Plans

### Short Term (Already Disabled)
Monte Carlo portfolio projection in Cash Flow tab is currently disabled to improve rendering performance. Cash Flow uses simplified JavaScript calculation.

### Long Term (Recommended)
**Option 1: Fetch Monte Carlo Data**
- Re-enable the disabled Monte Carlo fetch in Cash Flow
- Show median portfolio line from Analysis results
- Add shaded confidence band (25th-75th percentile)
- Code location: `cashflow-tab.js` lines 755-788 (currently commented out)

**Option 2: Keep Simplified with Disclaimer**
- Keep current 6% deterministic calculation
- Add prominent notice: "Simplified projection - see Analysis tab for accurate Monte Carlo"
- Update return rate to match user's asset allocation

**Option 3: Hybrid Approach**
- Use 6% for quick rendering
- Offer "Fetch Accurate Projection" button
- Overlay Monte Carlo data when available

---

## Recommendation

**For accurate retirement planning, always use the Analysis tab.** The Cash Flow tab is best used for understanding the timing and patterns of income and expenses, not for judging portfolio sustainability.

The Analysis tab's Monte Carlo simulation accounts for:
- Market volatility and crashes
- Sequence-of-returns risk
- Range of possible outcomes
- Proper asset allocation weighting

This is the industry-standard approach used by financial planners.

---

## Technical Notes

### Why Was Monte Carlo Disabled in Cash Flow?

See commit `06f47bf`:
```
fix: temporarily disable Monte Carlo fetch to debug Cash Flow rendering
```

The Monte Carlo fetch was causing rendering issues. It has been temporarily disabled while we work on the chart rendering logic. The fix allows Cash Flow to render immediately with a simplified projection.

### Re-enabling Monte Carlo in Cash Flow

To re-enable (once rendering is fixed):

1. Uncomment lines 768-787 in `src/static/js/components/cashflow/cashflow-tab.js`
2. Remove lines 743-758 (the skip logic)
3. Test with various profiles to ensure no hanging
4. Consider adding a loading timeout (15 seconds) to prevent indefinite hangs

---

*Last updated: 2026-01-22*
