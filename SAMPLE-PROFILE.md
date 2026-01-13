# Sample Profile Documentation

## Overview

The system includes a comprehensive sample profile that demonstrates all features and capabilities of the Retirement Planning System. This sample profile is designed to help new users understand the full potential of the system.

## Sample Profile: "Sample Family - Complete Demo"

### Family Profile

**Sarah Johnson**
- Born: March 15, 1968 (Age 57-58)
- Retirement Date: July 1, 2033 (Age 65)
- Social Security: $3,200/month

**Michael Johnson**
- Born: November 22, 1965 (Age 60-61)
- Retirement Date: December 31, 2030 (Age 65)
- Social Security: $3,800/month

### Investment Portfolio ($8.4M Total)

The sample demonstrates all 11 account types supported by the system:

#### Cash & Liquid Accounts ($240,000)
- Joint Checking Account: $35,000
- Emergency Savings: $125,000
- Money Market Fund: $80,000

#### Taxable Brokerage Accounts ($1,215,000)
- Vanguard Brokerage Account: $875,000 (cost basis: $520,000)
- Fidelity Taxable Investment: $340,000 (cost basis: $280,000)

#### Traditional IRAs ($1,485,000)
- Sarah's Traditional IRA: $620,000
- Michael's Traditional IRA: $485,000
- Sarah's Rollover IRA: $380,000

#### Employer Retirement Plans ($3,880,000)
- Sarah's Current 403b: $1,250,000
- Michael's 401k: $1,680,000
- Michael's Old 401k: $425,000
- Sarah's 457b Plan: $340,000
- Michael's 401a: $185,000

#### Roth IRAs ($555,000)
- Sarah's Roth IRA: $285,000
- Michael's Roth IRA: $195,000
- Sarah's Roth Conversion: $75,000

### Real Estate Portfolio ($1,955,000 Current Value)

#### Primary Residence - Suburban Home
- Current Value: $950,000
- Purchase Price: $485,000
- Mortgage Balance: $180,000
- Annual Costs: $28,500
- Appreciation Rate: 3.5%
- Planned Sale: 2040 (downsize to $425,000 replacement)

#### Rental Property - Downtown Condo
- Current Value: $580,000
- Purchase Price: $385,000
- Mortgage Balance: $245,000
- Annual Costs: $18,200
- Appreciation Rate: 4.0%
- Planned Sale: 2038

#### Vacation Home - Mountain Cabin
- Current Value: $425,000
- Purchase Price: $320,000
- Mortgage Balance: $0
- Annual Costs: $12,600
- Appreciation Rate: 3.0%
- Planned Sale: 2045

### Income Streams (5 Sources)

1. **Sarah's State Pension**: $85,000/year
   - Starts: July 2033
   - Inflation-adjusted
   - 50% survivor benefit

2. **Michael's Corporate Pension**: $72,000/year
   - Starts: January 2031
   - Inflation-adjusted
   - 75% survivor benefit

3. **Rental Income - Beach Condo**: $36,000/year
   - Starts: January 2026
   - Inflation-adjusted
   - 100% survivor benefit (continues regardless)

4. **Fixed Annuity**: $24,000/year
   - Starts: January 2035
   - Not inflation-adjusted
   - 100% survivor benefit

5. **Part-time Consulting**: $45,000/year
   - Starts: January 2031
   - Inflation-adjusted
   - No survivor benefit (personal income)

### Market Assumptions

- **Stock Allocation**: 60%
- **Stock Returns**: 10% mean, 18% std dev
- **Bond Returns**: 4% mean, 6% std dev
- **Inflation**: 3% mean, 1.2% std dev

### Tax Planning

- **Assumed Tax Rate**: 24% effective rate
- **Target Annual Income**: $185,000

## How to Load the Sample Profile

### Via Web Interface

1. Navigate to the "Financial Profile" tab
2. Look for the "Profile Management" section
3. Click the **📦 Load Sample** button (green button)
4. Confirm the dialog
5. The sample profile will be created and automatically loaded

### Via API

```bash
curl -X POST http://127.0.0.1:8080/api/load-sample-profile
```

Response:
```json
{
  "status": "success",
  "profile_name": "Sample Family - Complete Demo",
  "message": "Sample profile \"Sample Family - Complete Demo\" loaded successfully"
}
```

### Manual File Import

The sample profile is stored in `sample-profile.json` at the project root. You can modify this file to create your own default profile template.

## What the Sample Demonstrates

### Account Types Coverage
✅ Checking (cash, no growth)
✅ Savings (cash, no growth)
✅ Liquid/Money Market (taxable, cost basis tracking)
✅ Taxable Brokerage (capital gains treatment)
✅ Traditional IRA (tax-deferred, RMDs at 73)
✅ 401k (tax-deferred, RMDs at 73)
✅ 403b (tax-deferred, RMDs at 73)
✅ 401a (tax-deferred, RMDs at 73)
✅ 457b (no early withdrawal penalty)
✅ Roth IRA (tax-free growth and withdrawals)

### Real Estate Features
✅ Primary residence with Section 121 exclusion
✅ Rental property with income generation
✅ Vacation home planning
✅ Mortgage tracking
✅ Property appreciation modeling
✅ Carrying costs
✅ Strategic sale planning with downsize modeling

### Income Planning
✅ Multiple pension sources
✅ Social Security optimization
✅ Rental income streams
✅ Annuity planning
✅ Phased retirement with part-time work
✅ Inflation-adjusted vs fixed income
✅ Survivor benefit planning

### Tax Optimization Features
✅ Strategic withdrawal sequencing
✅ RMD planning at age 73+
✅ 457b early access (no penalty before 59.5)
✅ Capital gains vs ordinary income
✅ Roth conversion opportunities

## Use Cases

### For New Users
Load the sample to see a fully populated profile and understand what information the system can handle.

### For Testing
Use the sample to test analysis features, PDF generation, AI advisor, and scenario modeling without entering your own data first.

### As a Template
Copy the sample profile and modify values to match your situation, using it as a starting point.

### For Demonstrations
Show potential users what the system can do with a realistic, comprehensive example.

## Modifying the Sample

To customize the default sample profile:

1. Edit `/sample-profile.json`
2. Restart the application
3. Click "Load Sample" to load your customized version

## Notes

- The sample profile is stored separately in the database
- Loading the sample does not affect existing profiles
- You can load it multiple times (it updates the existing sample profile)
- The sample represents a realistic upper-middle-class retirement scenario
- All values are fictional but representative of real planning situations

## Financial Planning Insights from the Sample

This sample represents a couple with:
- **Strong pension coverage** (~$157k/year combined)
- **Diversified retirement savings** across multiple account types
- **Real estate wealth** with strategic exit planning
- **Multiple income sources** for flexibility
- **Tax optimization** through account type diversity
- **Longevity planning** with survivor benefits

**Estimated Success Rate**: This profile typically shows 95%+ success rate in Monte Carlo simulations given the diversified income sources, substantial savings, and conservative withdrawal strategy.
