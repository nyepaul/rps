# Asset Descriptions Guide

The Asset Management tab displays relevant, context-aware descriptions for each asset, summarizing key details horizontally.

## Description Examples by Asset Type

### Retirement Accounts
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| Vanguard 401k | 🏦 401(k) | **Stocks:** 60% • **Bonds:** 40% • **Acct:** ****1234 | $500,000 |
| Roth IRA | 🏦 Roth IRA | **Stocks:** 100% | $150,000 |

### Bank/Brokerage Accounts
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| Brokerage | 💰 Brokerage Account | **Institution:** Fidelity • **Stocks:** 80% • **Bonds:** 20% | $300,000 |
| Emergency Fund | 💰 Savings Account | **Institution:** Ally | $50,000 |

### Real Estate
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| Family Home | 🏠 Primary Residence | **Address:** 123 Main St | $200,000 equity* |
| Rental Property | 🏠 Rental Property | **Address:** Downtown • **Rent:** $3,000/mo | $180,000 equity* |

*\*Real Estate value displays equity (Market Value - Mortgage) when a mortgage is present.*

### Pensions/Annuities
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| State Pension | 💵 Pension | **Provider:** CalPERS • **Start Age:** 65 | $4,500/mo |
| Fixed Annuity | 💵 Annuity | **Provider:** MetLife • **Start Age:** 60 | $2,000/mo |

### Other Assets
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| Startup Equity | 📦 Business Interest | **Ownership:** 15% • **Income:** $25,000/yr | $500,000 |
| HSA | 📦 HSA | **Institution:** Optum • **Stocks:** 100% | $45,000 |

### Liabilities
| Name | Type | Attributes (Horizontal) | Value |
|------|------|-------------------------|-------|
| Student Loan | 💳 Student Loan | **Lender:** Navient • **Rate:** 5.5% | $35,000 |
| Car Loan | 💳 Auto Loan | **Lender:** Toyota FS • **Rate:** 2.9% | $12,000 |

## Description Logic

The system intelligently shows the most relevant information for each asset type:

### 1. **Primary Type Label**
Always shows the specific asset type (401(k), Savings Account, Primary Residence, etc.)

### 2. **Contextual Attributes**
- **Institutions**: Shown for all accounts when provided.
- **Allocations**: Shown for Retirement, Brokerage, and HSA accounts.
- **Real Estate**: Shows Address and Monthly Rental Income.
- **Pensions**: Shows Provider and Start Age.
- **Liabilities**: Shows Lender and Interest Rate.

### 3. **Value Specialization**
- **Pensions**: Displays as `$/mo`.
- **Real Estate**: Displays as `Equity (Mkt: $ - Mort: $)`.
- **All Others**: Displays total current value.

## Benefits

✅ **At-a-glance understanding** - See property type, account type immediately.
✅ **Equity Visibility** - See real estate equity instead of just market value.
✅ **Allocation Tracking** - Monitor your portfolio mix without opening every account.
✅ **Lender/Institution Info** - Quick reference for where your money is held.

## Format

Attributes use bullet points (•) to separate multiple pieces of information, with labels in bold for clarity:

```
Institution: Vanguard • Stocks: 60% • Bonds: 40%
Address: 123 Main St • Rent: $3,000/mo
Lender: Navient • Rate: 5.5%
```

**Last Updated:** 2026-02-27
**Version:** 3.10.14
