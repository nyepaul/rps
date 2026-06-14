# Real Estate & Debt Calculations

This document shows how mortgage balances and other liabilities are calculated and displayed throughout the application.

## Calculation Formula

### Real Estate Equity
```
Equity = Market Value - Mortgage Balance
```

### Total Net Worth
```
Net Worth = Total Assets - Total Debts
```

---

## Example Properties & Debts

### Example 1: Primary Residence (Real Estate)
- **Market Value**: $500,000
- **Mortgage Balance**: $300,000
- **Equity**: $200,000

**Display in Asset List:**
- Shows: **$200,000 equity**
- Details: `Mkt: $500,000 - Mort: $300,000`

### Example 2: Student Loan (Liability)
- **Debt Type**: Student Loan
- **Lender**: Navient
- **Current Balance**: $35,000
- **Interest Rate**: 5.5%

**Display in Asset List:**
- Shows: **$35,000** (as a liability)
- Details: `Lender: Navient • Rate: 5.5%`

---

## Net Worth Calculation Example

```
TOTAL ASSETS:
  Retirement Accounts:    $1,000,000
  Taxable Accounts:         $500,000
  Real Estate (Market):   $1,250,000  ($500k Primary + $400k Rental + $350k Vacation)
  Other Assets:             $100,000
  ───────────────────────
  Gross Assets:           $2,850,000

TOTAL DEBTS:
  Mortgage Balances:        $550,000  ($300k + $250k)
  Other Liabilities:         $47,000  ($35k Student Loan + $12k Car Loan)
  ───────────────────────
  Total Debts:              $597,000

NET WORTH:
  $2,850,000 (Assets) - $597,000 (Debts) = $2,253,000
```

---

## Where Debt is Shown

1. **Asset List** (Assets Tab)
   - Real estate rows show **equity** prominently.
   - Liabilities rows show the **outstanding balance**.

2. **Summary Cards** (Assets Tab)
   - **Real Estate Equity**: Σ(Market Value - Mortgage Balance).
   - **Total Liabilities**: Σ(Mortgages + Other Debts).

3. **Dashboard Profile Cards**
   - **Net Worth**: Calculated as `Total Assets - Total Debts`.

4. **Profile Info Modal** (Dashboard)
   - Detailed breakdown section showing Gross Assets, Total Debts, and the resulting Net Worth.

---

## Utility Functions

Located in: `/src/static/js/utils/financial-calculations.js`

- `calculateNetWorth(assets)` - Returns net worth, total assets, total debts, and detailed breakdown.
- `calculateRealEstateEquity(assets)` - Returns total equity across all properties.
- `calculateTotalDebts(assets)` - Returns sum of all mortgages and liabilities.

**Last Updated:** 2026-02-27
**Version:** 3.10.15
