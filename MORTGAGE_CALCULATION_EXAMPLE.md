# Real Estate Mortgage Balance Calculations

This document shows how mortgage balances are calculated and displayed throughout the application.

## Calculation Formula

```
Equity = Market Value - Mortgage Balance
```

## Example Properties

### Example 1: Primary Residence
- **Market Value**: $500,000
- **Mortgage Balance**: $300,000
- **Equity**: $200,000

**Display in Asset List:**
```
Primary Home                          $200,000
                                      (Equity)
                                      Market: $500,000
                                      Mortgage: -$300,000
```

### Example 2: Rental Property
- **Market Value**: $400,000
- **Mortgage Balance**: $250,000
- **Equity**: $150,000

**Display in Asset List:**
```
Rental Property                       $150,000
                                      (Equity)
                                      Market: $400,000
                                      Mortgage: -$250,000
```

### Example 3: Paid-Off Property
- **Market Value**: $350,000
- **Mortgage Balance**: $0
- **Equity**: $350,000

**Display in Asset List:**
```
Beach House                           $350,000
```
(No mortgage breakdown shown when balance is $0)

## Net Worth Calculation

```
Total Assets:
  Retirement Accounts:    $1,000,000
  Taxable Accounts:         $500,000
  Real Estate (Market):   $1,250,000  ($500k + $400k + $350k)
  Other Assets:             $100,000
  ───────────────────────
  Subtotal:               $2,850,000

Total Debts:
  Mortgage Balances:        $550,000  ($300k + $250k)
  ───────────────────────
  Subtotal:                 $550,000

Net Worth = $2,850,000 - $550,000 = $2,300,000
```

## Where Mortgage Balance is Shown

1. **Asset List** (Assets Tab)
   - Shows equity in bold
   - Shows market value and mortgage as details below
   - Mortgage shown in red with negative sign

2. **Summary Cards** (Assets Tab)
   - "Real Estate Equity" card shows total equity across all properties
   - Automatically calculated as: Σ(Market Value - Mortgage Balance)

3. **Dashboard Profile Cards**
   - Shows "Net Worth" which includes equity calculation
   - Net Worth = All Assets - All Debts

4. **Profile Info Modal** (Dashboard)
   - Detailed breakdown section:
     - Real Estate (Market Value): $X
     - • Mortgage Balances: -$Y
     - = Real Estate Equity: $Z
     - Total Assets: $A
     - Total Debts: $B
     - Net Worth: $A - $B

## Utility Functions

Located in: `/src/static/js/utils/financial-calculations.js`

- `calculateNetWorth(assets)` - Returns net worth, total assets, total debts, and breakdown
- `calculateRealEstateEquity(assets)` - Returns total equity across all properties
- `calculateTotalDebts(assets)` - Returns sum of all mortgage balances

## Extensibility

The system is designed to easily add other debt types:
- Auto loans
- Student loans
- Credit card debt
- Personal loans

Simply add the debt fields to asset structures and update `calculateTotalDebts()`.
