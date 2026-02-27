# Asset Type Field Reference

This document describes which fields are prompted for each asset type in the RPS system.

## Retirement Accounts
All retirement account types collect the same information:

**Types:** 401(k), Roth 401(k), Traditional IRA, Roth IRA, SEP IRA, SIMPLE IRA, 403(b), 457

**Fields:**
- **Account Name** (`name`) (required)
- **Account Type** (`type`) (required)
- **Financial Institution** (`institution`)
- **Account Number** (`account_number`) (last 4 digits)
- **Current Balance** (`value`) (required)
- **Stock Allocation (%)** (`stock_pct`)
- **Bond Allocation (%)** (`bond_pct`)
- **Cash Allocation (%)** (`cash_pct`)

---

## Taxable Accounts

### Brokerage Account
**Fields:**
- **Account Name** (`name`) (required)
- **Account Type** (`type`) (required)
- **Financial Institution** (`institution`)
- **Account Number** (`account_number`)
- **Current Balance** (`value`) (required)
- **Cost Basis** (`cost_basis`) (for capital gains calculation)
- **Stock Allocation (%)** (`stock_pct`)
- **Bond Allocation (%)** (`bond_pct`)
- **Cash Allocation (%)** (`cash_pct`)

### Savings, Checking, Cash, Money Market
**Fields:**
- **Account Name** (`name`) (required)
- **Account Type** (`type`) (required)
- **Financial Institution** (`institution`)
- **Account Number** (`account_number`)
- **Current Balance** (`value`) (required)

### Certificate of Deposit (CD)
**Fields:**
- **Account Name** (`name`) (required)
- **Account Type** (`type`) (required)
- **Financial Institution** (`institution`)
- **Account Number** (`account_number`)
- **Principal Amount** (`principal`) (required) - Amount originally deposited
- **Interest Rate (APY %)** (`interest_rate`) - Fixed interest rate
- **Maturity Date** (`maturity_date`) - When the CD matures
- **Term (Months)** (`term_months`) - CD term length
- **Current Balance** (`value`) (required) - Current value including accrued interest

---

## Real Estate

### Property Types:
Primary Residence, Rental Property, Vacation Home, Land, Commercial Property

**Fields:**
- **Property Name** (`name`) (required)
- **Property Type** (`type`) (required)
- **Address** (`address`)
- **Current Market Value** (`value`) (required)
- **Purchase Price** (`purchase_price`) (for cost basis)
- **Purchase Date** (`purchase_date`) (hidden for Land)
- **Mortgage Balance** (`mortgage_balance`) (hidden for Land)
- **Annual Rental Income** (`annual_rental_income`) (for Rental, Vacation, Commercial)
- **Annual Operating Expenses** (`annual_expenses`) (for Rental, Vacation, Commercial)
- **Occupancy Rate (%)** (`occupancy_rate`) (for Rental, Commercial)
- **Annual Property Costs** (`annual_costs`) (taxes, HOA, insurance)

---

## Pensions & Annuities

### Pension
**Fields:**
- **Pension Name** (`name`) (required)
- **Type** (`type`) (required)
- **Provider/Employer** (`provider`)
- **Monthly Benefit** (`monthly_benefit`) (required)
- **Start Date** (`start_date`)
- **Start Age** (`start_age`) (when benefits begin)
- **Inflation Adjusted** (`inflation_adjusted`) (checkbox)
- **Survivor Benefit (%)** (`survivor_benefit_pct`) - Percentage paid to survivor

### Annuity
**Fields:**
- **Annuity Name** (`name`) (required)
- **Type** (`type`) (required)
- **Provider** (`provider`)
- **Monthly Benefit** (`monthly_benefit`) (required)
- **Start Date** (`start_date`)
- **Start Age** (`start_age`)
- **Inflation Adjusted** (`inflation_adjusted`)
- **Annuity Type** (`annuity_type`) - Fixed, Variable, or Indexed
- **Current Value** (`current_value`) - Current account value if deferred

---

## Other Assets

**Types:** Business Interest, Collectible, Trust, HSA, Cryptocurrency, Other

**Fields:**
- **Asset Name** (`name`) (required)
- **Asset Type** (`type`) (required)
- **Estimated Value** (`value`) (required)
- **Financial Institution** (`institution`) (for HSA)
- **Stock/Bond/Cash Allocation** (for HSA)
- **Ownership Percentage (%)** (`ownership_pct`) (for Business)
- **Annual Income/Distributions** (`annual_income`) (for Business, Trust)
- **Valuation Method** (`valuation_method`) (for Business)
- **Cost Basis** (`cost_basis`) (for Crypto, Collectible)
- **Purchase Date** (`purchase_date`) (for Crypto, Collectible)
- **Trust Type** (`trust_type`) (for Trust)
- **Description** (`description`)

---

## Debts & Liabilities

**Types:** Mortgage, Student Loan, Credit Card, Auto Loan, Personal Loan, Other Debt

**Fields:**
- **Debt Name** (`name`) (required)
- **Debt Type** (`type`) (required)
- **Lender** (`institution`)
- **Current Balance** (`value`) (required)
- **Interest Rate (%)** (`interest_rate`)
- **Monthly Payment** (`monthly_payment`)
- **Estimated Payoff Date** (`maturity_date`)
- **Description** (`description`)

---

## Implementation Notes

- **Bold** labels match the UI; `code_names` match the profile JSON structure.
- **Required fields** must be completed before saving.
- **Allocation percentages** are entered as 0-100 but stored as 0.0-1.0.
- **Currency fields** are sanitized during extraction.
- **Conditional display**: Fields like `occupancy_rate` only appear when relevant to the selected type.
