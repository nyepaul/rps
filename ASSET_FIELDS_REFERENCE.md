# Asset Type Field Reference

This document describes which fields are prompted for each asset type in the RPS system.

## Retirement Accounts
All retirement account types collect the same information:

**Types:** 401(k), Roth 401(k), Traditional IRA, Roth IRA, SEP IRA, SIMPLE IRA, 403(b), 457

**Fields:**
- Account Name (required)
- Financial Institution
- Account Number (last 4 digits)
- Current Balance (required)
- Stock Allocation (%)
- Bond Allocation (%)
- Cash Allocation (%)

---

## Taxable Accounts

### Brokerage Account
**Fields:**
- Account Name (required)
- Financial Institution
- Account Number (last 4 digits)
- Current Balance (required)
- Cost Basis (for capital gains calculation)
- Stock Allocation (%)
- Bond Allocation (%)
- Cash Allocation (%)

### Savings, Checking, Cash, Money Market
**Fields:**
- Account Name (required)
- Financial Institution
- Account Number (last 4 digits)
- Current Balance (required)

_Note: No allocation or cost basis fields since these are cash equivalents._

### Certificate of Deposit (CD)
**Fields:**
- Account Name (required)
- Financial Institution
- Account Number (last 4 digits)
- **Principal Amount (required)** - Amount originally deposited
- **Interest Rate (APY %)** - Fixed interest rate
- **Maturity Date** - When the CD matures
- **Term (Months)** - CD term length
- **Current Value** - Current value including accrued interest (optional)

_Note: CDs have structured terms and don't have investment allocations._

---

## Real Estate

### Primary Residence
**Fields:**
- Property Name (required)
- Address
- Current Market Value (required)
- Purchase Price (for cost basis)
- Purchase Date
- Mortgage Balance
- Annual Property Costs (taxes, HOA, insurance)

### Rental Property
**Fields:**
- Property Name (required)
- Address
- Current Market Value (required)
- Purchase Price
- Purchase Date
- Mortgage Balance
- **Annual Rental Income** - Gross rental income per year
- **Annual Operating Expenses** - Maintenance, repairs, management, utilities
- **Occupancy Rate (%)** - Average occupancy percentage
- Annual Property Costs (taxes, HOA, insurance)

### Vacation Home
**Fields:**
- Property Name (required)
- Address
- Current Market Value (required)
- Purchase Price
- Purchase Date
- Mortgage Balance
- **Annual Rental Income** - If rented out (Airbnb, VRBO, etc.)
- **Annual Operating Expenses** - If generating rental income
- Annual Property Costs (taxes, HOA, insurance)

### Land
**Fields:**
- Property Name (required)
- Address
- Current Market Value (required)
- Purchase Price
- Annual Property Costs (taxes, insurance)

_Note: Land typically doesn't have mortgage or purchase date fields._

### Commercial Property
**Fields:**
- Property Name (required)
- Address
- Current Market Value (required)
- Purchase Price
- Purchase Date
- Mortgage Balance
- **Annual Rental Income** - Gross rental income
- **Annual Operating Expenses** - Maintenance, repairs, management
- **Occupancy Rate (%)** - Average occupancy percentage
- Annual Property Costs (taxes, insurance)

---

## Pensions & Annuities

### Pension
**Fields:**
- Pension Name (required)
- Provider/Employer
- Monthly Benefit (required)
- Start Date
- Start Age (when benefits begin)
- Inflation Adjusted (checkbox)
- **Survivor Benefit (%)** - Percentage paid to survivor

### Annuity
**Fields:**
- Annuity Name (required)
- Provider
- Monthly Benefit (required)
- Start Date
- Start Age
- Inflation Adjusted (checkbox)
- **Annuity Type** - Fixed, Variable, or Indexed
- **Current Value** - Current account value if deferred

---

## Other Assets

### Health Savings Account (HSA)
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- **Financial Institution**
- **Stock Allocation (%)**
- **Bond Allocation (%)**
- **Cash Allocation (%)**

_Note: HSAs are treated like investment accounts since they can be invested._

### Business Interest
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- **Ownership Percentage (%)** - Your ownership stake
- **Annual Income/Distributions** - Annual distributions received
- **Valuation Method** - Professional appraisal, comparable sales, book value, revenue multiple, or earnings multiple

### Cryptocurrency
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- **Cost Basis** - Original purchase price (for capital gains)
- **Purchase Date**

### Collectible
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- **Cost Basis** - Original purchase price
- **Purchase Date**
- Description

### Trust
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- **Trust Type** - Revocable living trust, irrevocable trust, charitable trust, special needs trust, or other
- **Annual Income/Distributions** - Annual distributions received
- Description

### Other
**Fields:**
- Asset Name (required)
- Estimated Value (required)
- Description

---

## Implementation Notes

- Fields marked in **bold** are type-specific and only appear for that particular asset type
- All fields dynamically show/hide based on the asset type selected
- Required fields are marked with an asterisk (*) in the UI
- The form validates that all required fields are completed before allowing submission
- Allocation percentages are displayed as whole numbers (0-100) but stored as decimals (0-1)
- Currency fields accept various formats: $1,000, 1000, 1k, etc.
