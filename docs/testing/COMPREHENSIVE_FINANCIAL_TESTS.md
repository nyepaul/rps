# Comprehensive Financial Calculations Test Suite

**Location**: `tests/test_comprehensive_financial.py`

**Purpose**: Validates financial calculation accuracy and consistency between Cash Flow and Retirement Analysis Monte Carlo projections.

## Test Coverage

### ✅ Core Financial Calculations

1. **test_demo_starman_portfolio_starting_value**
   - Validates starting portfolio matches asset totals
   - Checks: $120K taxable + $530K retirement = $650K total
   - Ensures database assets correctly feed into Monte Carlo

2. **test_demo_starman_income_calculation**
   - Validates income calculation from income_streams
   - Checks: $94,800 + $69,600 = $164,400/year total income
   - Ensures monthly income properly converted to annual

3. **test_demo_starman_budget_income_populated**
   - **CRITICAL**: Validates budget income fix (v3.8.117)
   - Ensures income_streams populate budget.income.current.employment
   - Prevents $0 income bug that caused portfolio depletion

### ✅ Monte Carlo Projections

4. **test_demo_starman_monte_carlo_growth**
   - **CRITICAL**: Validates portfolio GROWS during working years
   - Checks portfolio increases over 10-year period
   - Ensures >20% growth with $70K/year savings + returns
   - **This test would FAIL before the fix** (portfolio depleted instead)

5. **test_demo_starman_no_early_depletion**
   - **CRITICAL**: Validates no premature portfolio depletion
   - Ensures portfolio never hits $0 during working years
   - Checks 22 years until retirement (age 45 → 67)
   - **This test would FAIL before the fix** (depleted by year 6-7)

6. **test_inflation_applied_correctly**
   - Validates 3% inflation applied to expenses over time
   - Ensures real purchasing power maintained
   - Tests MarketAssumptions inflation parameters

### ℹ️ Data Consistency Checks

7. **test_income_expense_consistency**
   - Informational check for data quality
   - Compares income_streams vs financial.annual_income
   - Compares budget.expenses vs financial.annual_expenses
   - Warns on >5% income variance or >15% expense variance
   - **Note**: Some demo profiles have intentional test variations

## What the Tests Validate

### Before Fix (v3.8.116 and earlier)
```
Demo Starman Cash Flow 2026-2032:
❌ Income: $0 (bug - budget.income missing)
❌ Expenses: $95K/year
❌ Shortfall: $95K/year
❌ Portfolio: $650K → $0 in 6 years (WRONG!)
```

### After Fix (v3.8.117)
```
Demo Starman Cash Flow 2026-2048:
✅ Income: $165K/year (correctly populated from income_streams)
✅ Expenses: $95K/year
✅ Surplus: $70K/year
✅ Portfolio: $650K → $2-3M+ at retirement (CORRECT!)
```

## The Fix Tested

**File**: `src/routes/analysis.py` lines 190-229

**What it does**:
1. Checks if `budget.income` exists
2. If missing, populates from `income_streams`
3. Converts monthly salaries to annual
4. Assigns to `budget.income.current.employment.primary_person` and `.spouse`
5. Passes corrected budget to FinancialProfile

**Why it matters**:
- Many profiles (including all demos) only have `income_streams`
- Monte Carlo simulation expects `budget.income.current.employment`
- Without this fix: simulation thinks income = $0 → portfolio depletes
- With this fix: simulation sees actual income → portfolio grows

## Running the Tests

### Run all comprehensive financial tests:
```bash
pytest tests/test_comprehensive_financial.py -v
```

### Run specific test:
```bash
pytest tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_monte_carlo_growth -v -s
```

### Run with detailed output:
```bash
pytest tests/test_comprehensive_financial.py -v -s --tb=short
```

## Expected Results

```
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_portfolio_starting_value PASSED [ 14%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_income_calculation PASSED [ 28%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_budget_income_populated PASSED [ 42%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_monte_carlo_growth PASSED [ 57%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_demo_starman_no_early_depletion PASSED [ 71%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_income_expense_consistency PASSED [ 85%]
tests/test_comprehensive_financial.py::TestComprehensiveFinancial::test_inflation_applied_correctly PASSED [100%]

======================== 7 passed, 3 warnings in 2.12s =========================
```

## Test Data

### Demo Starman Profile
- **Age**: 45 (born 1981-05-22)
- **Retirement**: 67 (2048-05-22)
- **Years until retirement**: 22
- **Starting portfolio**: $650,000
  - Taxable: $120,000 (Ally Savings $35K + Fidelity Brokerage $85K)
  - Tax-deferred: $530,000 (401k $320K + 403b $210K)
- **Annual income**: $165,000
  - Primary salary: $7,900/month = $94,800/year
  - Spouse salary: $5,800/month = $69,600/year
- **Annual expenses**: $95,000
- **Annual surplus**: $70,000 (saves to portfolio)

### Expected Trajectory (Moderate 60/40)
- **Year 0 (2026)**: ~$650K starting
- **Year 5 (2031)**: ~$1.0M (growth + contributions)
- **Year 10 (2036)**: ~$1.4M (continued growth)
- **Year 22 (2048)**: ~$2.5-3M (retirement ready)
- **Year 30 (2056)**: Drawing down for expenses
- **Year 45 (2071)**: End of life expectancy

## Integration with CI/CD

These tests should be run:
- ✅ Before every commit
- ✅ In CI/CD pipeline
- ✅ Before deployment
- ✅ After any Monte Carlo changes
- ✅ After any profile data structure changes

## Troubleshooting

### Test fails: "Portfolio should GROW"
- **Cause**: Budget income fix not applied
- **Solution**: Ensure `analysis.py` lines 190-229 populate budget.income
- **Check**: Verify income_streams exist and are salary type

### Test fails: "Starting portfolio mismatch"
- **Cause**: Asset calculation error
- **Solution**: Check transform_assets_to_investment_types()
- **Check**: Verify retirement_accounts and taxable_accounts sums

### Test fails: "Portfolio depletes during working years"
- **Cause**: Income not being recognized by simulation
- **Solution**: Check budget.income.current.employment populated
- **Check**: Run with -s flag to see simulation details

## Related Documentation

- [Cash Flow vs Analysis Comparison](../CASHFLOW_VS_ANALYSIS.md)
- [Monte Carlo Simulation Guide](../reference/MONTE_CARLO_GUIDE.md)
- [Profile Data Structure](../reference/PROFILE_SCHEMA.md)

## Version History

- **v3.8.117** (2026-01-23): Added comprehensive tests for portfolio depletion fix
- **v3.8.112** (2026-01-22): Re-enabled Monte Carlo in Cash Flow
- **v3.8.111** (2026-01-22): Temporarily disabled Monte Carlo (hanging bug)

---

**Last Updated**: 2026-01-23
**Test Coverage**: 7 tests, 100% pass rate
**Execution Time**: ~2-3 seconds
