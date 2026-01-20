# Asset Descriptions Guide

The Asset Management tab now displays relevant, context-aware descriptions for each asset instead of allocation percentages.

## Description Examples by Asset Type

### Retirement Accounts
| Name | Type | Description | Value |
|------|------|-------------|-------|
| Vanguard 401k | 🏦 401(k) | **401(k)** • 60% Stocks, 40% Bonds | $500,000 |
| Roth IRA | 🏦 Roth IRA | **Roth IRA** • 100% Stocks | $150,000 |
| SEP IRA | 🏦 SEP IRA | **SEP IRA** • 70% Stocks, 30% Bonds | $200,000 |

### Bank/Brokerage Accounts
| Name | Type | Description | Value |
|------|------|-------------|-------|
| Emergency Fund | 💰 Savings Account | **Savings Account** | $50,000 |
| Joint Checking | 💰 Checking Account | **Checking Account** | $15,000 |
| Brokerage | 💰 Brokerage Account | **Brokerage Account** • 80% Stocks, 20% Bonds | $300,000 |
| 12-Month CD | 💰 Certificate of Deposit | **Certificate of Deposit** • 4.5% APY • Matures: Dec 2026 | $100,000 |
| Money Market | 💰 Money Market | **Money Market** | $25,000 |

### Real Estate
| Name | Type | Description | Value |
|------|------|-------------|-------|
| Family Home | 🏠 Primary Residence | **Primary Residence** • 123 Main St, Anytown | $200,000 (Equity) |
| Beach Condo | 🏠 Vacation Home | **Vacation Home** • Malibu, CA • Rental: $48,000/yr | $150,000 (Equity) |
| Rental Property | 🏠 Rental Property | **Rental Property** • Downtown • Rental: $36,000/yr | $180,000 (Equity) |
| Investment Land | 🏠 Land | **Land** • Rural acreage | $75,000 |
| Office Building | 🏠 Commercial Property | **Commercial Property** • Rental: $120,000/yr | $450,000 (Equity) |

### Pensions/Annuities
| Name | Type | Description | Value |
|------|------|-------------|-------|
| State Pension | 💵 Pension | **Pension** • CalPERS • Starts at age 65 • COLA adjusted | $4,500/mo |
| Fixed Annuity | 💵 Annuity | **Annuity** • MetLife • Starts: Jan 2028 | $2,000/mo |
| Teacher Pension | 💵 Pension | **Pension** • School District • Starts at age 62 | $3,200/mo |

### Other Assets
| Name | Type | Description | Value |
|------|------|-------------|-------|
| Startup Equity | 📦 Business Interest | **Business Interest** • 15% ownership • Income: $25,000/yr | $500,000 |
| HSA | 📦 Health Savings Account | **Health Savings Account** • 50% Stocks, 50% Bonds | $45,000 |
| Family Trust | 📦 Trust | **Trust** • Income: $50,000/yr | $1,000,000 |
| Art Collection | 📦 Collectible | **Collectible** | $150,000 |
| Bitcoin | 📦 Cryptocurrency | **Cryptocurrency** | $75,000 |

## Description Logic

The system intelligently shows the most relevant information for each asset type:

### 1. **Primary Type Label**
Always shows the specific asset type (401(k), Savings Account, Primary Residence, etc.)

### 2. **Additional Context** (when available)
- **Real Estate**: Address, annual rental income
- **Bank Accounts (CDs)**: Interest rate, maturity date
- **Pensions**: Provider, start age/date, COLA status
- **Business**: Ownership percentage, annual income
- **Other**: Relevant income streams

### 3. **Allocation Fallback**
For investment accounts without other descriptions, shows allocation (Stocks/Bonds/Cash percentages)

## Benefits

✅ **At-a-glance understanding** - See property type, account type immediately
✅ **Relevant context** - Shows what matters for each asset
✅ **Rental income visibility** - See rental properties' income potential
✅ **Maturity tracking** - Know when CDs mature
✅ **COLA indicators** - See which pensions adjust for inflation
✅ **Ownership clarity** - See business ownership percentages
✅ **Address reference** - Quick property location lookup

## Format

Descriptions use bullet points (•) to separate multiple pieces of information, making them easy to scan:

```
Primary Residence • 123 Main St, Anytown
Rental Property • Downtown • Rental: $36,000/yr
Certificate of Deposit • 4.5% APY • Matures: Dec 2026
Pension • CalPERS • Starts at age 65 • COLA adjusted
```

Special formatting:
- **COLA adjusted** appears in green to highlight inflation protection
- **100% Cash** appears in green
- **100% Stocks** appears in accent color
- All monetary values use standard currency formatting
