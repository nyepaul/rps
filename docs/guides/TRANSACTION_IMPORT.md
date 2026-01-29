# CSV Transaction Import Guide

## Overview

The CSV Transaction Import feature allows you to import bank transaction history (18+ months recommended) to automatically detect recurring income and expense patterns. The system analyzes your transactions, identifies patterns, and reconciles them with your manually entered data.

## Key Features

### Privacy-First Design
- **No Transaction Storage**: Only detected patterns are saved, not individual transactions
- **PII Stripping**: Account numbers, transaction IDs, and tracking codes automatically removed
- **In-Memory Processing**: CSV files processed in-memory, never written to disk
- **Minimal Footprint**: Detected patterns ~5KB vs full transaction history ~2.6MB

### Pattern Detection
- **Income Patterns**: Detects salary (biweekly/monthly), rental income, side gigs
- **Expense Patterns**: Identifies subscriptions, rent, utilities, groceries, and more
- **Frequency Analysis**: Weekly, biweekly, monthly, quarterly, or irregular
- **Confidence Scoring**: 0-1 confidence score based on consistency and occurrence count
- **Variance Tracking**: Standard deviation to measure amount fluctuation

### Smart Reconciliation
- **Intelligent Matching**: Compares detected patterns with manual entries using:
  - Semantic similarity (salary = payroll, rent = rental)
  - Amount comparison (normalized to monthly equivalent)
  - Fuzzy name matching
- **Conflict Detection**: Identifies mismatches (>5% variance)
- **User Approval Required**: All patterns reviewed before merging

### Auto-Categorization
Expenses automatically categorized into:
- **Housing**: Rent, mortgage, property tax, HOA
- **Utilities**: Electric, gas, water, internet, phone
- **Food**: Groceries, restaurants, delivery
- **Transportation**: Gas, parking, ride-sharing, transit
- **Entertainment**: Streaming services, movies, concerts
- **Healthcare**: Pharmacy, doctor, dental, hospital
- **Insurance**: Auto, home, health insurance
- **Shopping**: Amazon, Target, Walmart, etc.
- **Other**: Uncategorized expenses

## How to Use

### 1. Prepare Your CSV

**Supported Formats:**
- Chase, Bank of America, Amex, Wells Fargo, generic bank CSVs
- Required columns: Date, Description, Amount (or Debit/Credit)
- Date formats: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
- Currency symbols and formatting handled automatically

**Example CSV:**
```csv
Date,Description,Amount
2024-01-15,PAYROLL ACME CORP,2850.00
2024-01-20,NETFLIX 123456789,-16.99
2024-02-01,RENT PAYMENT,-2000.00
```

### 2. Upload CSV

1. Navigate to **Income** tab
2. Click **Import CSV** button
3. Select your CSV file (max 5MB)
4. Check privacy consent checkbox
5. Click **Analyze Transactions**

### 3. Review Analysis

**Progress Indicators:**
- Parsing CSV file... (10%)
- Removing sensitive data... (30%)
- Analyzing patterns... (50%)
- Comparing with your data... (80%)
- Analysis complete! (100%)

**Summary Stats:**
- Total transactions processed
- Income patterns detected
- Expense patterns detected
- Date range covered

### 4. Reconciliation

**Review Each Pattern:**

**Matches (Green)** - Exact or near match (<5% variance)
- Action: Keep manual or merge with detected

**Minor Conflicts (Yellow)** - 5-20% variance
- Action: Review and choose which to keep

**Major Conflicts (Orange)** - >20% variance
- Action: Review carefully, likely different income sources

**New Detected (Blue)** - Not in manual entries
- Action: Add as new or ignore

**Manual Only (Gray)** - In manual entries but not in CSV
- Info: Not found in recent transactions (may be future income)

### 5. Apply Changes

**Per-Pattern Actions:**
- **Merge**: Update existing entry with detected values
- **Add as New**: Keep both manual and detected entries
- **Ignore**: Don't import this pattern
- **Edit**: Manually adjust before applying

**Bulk Actions:**
- Accept All Suggested
- Ignore All
- Review One by One

Click **Apply Changes** to save.

## Data Structure

### Detected Income Pattern
```json
{
  "name": "Employer Salary",
  "amount": 2850.00,
  "frequency": "biweekly",
  "source": "detected",
  "detected_from": "18 transactions",
  "confidence": 0.95,
  "variance": 25.50,
  "first_seen": "2024-07-15",
  "last_seen": "2026-01-15",
  "detected_date": "2026-01-29T12:00:00Z"
}
```

### Detected Expense Pattern
```json
{
  "name": "Netflix",
  "amount": 16.99,
  "frequency": "monthly",
  "category": "entertainment",
  "source": "detected",
  "confidence": 0.98,
  "variance": 0.00,
  "transaction_count": 18,
  "first_seen": "2024-07-15",
  "last_seen": "2026-01-15"
}
```

## API Endpoints

### POST `/api/profile/<name>/transactions/import`
Upload and analyze CSV transactions.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: CSV file (max 5MB)

**Response:** NDJSON stream with progress updates
```json
{"status": "parsing", "progress": 10, "message": "Reading CSV file..."}
{"status": "sanitizing", "progress": 30, "message": "Removing sensitive data..."}
{"status": "detecting", "progress": 50, "message": "Analyzing patterns..."}
{"status": "reconciling", "progress": 80, "message": "Comparing with your data..."}
{"status": "complete", "progress": 100, "data": {...}}
```

**Rate Limit:** 10 imports per hour per user

### POST `/api/profile/<name>/transactions/reconcile`
Apply reconciliation decisions.

**Request:**
```json
{
  "actions": [
    {
      "type": "merge",
      "stream_index": 0,
      "updates": {
        "amount": 2850.00,
        "frequency": "biweekly",
        "confidence": 0.95
      }
    },
    {
      "type": "add_new",
      "stream": {
        "name": "Side Gig",
        "amount": 500.00,
        "frequency": "monthly"
      }
    },
    {
      "type": "add_expense",
      "category": "entertainment",
      "expense": {
        "name": "Netflix",
        "amount": 16.99,
        "frequency": "monthly"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "actions_applied": 3,
  "income_added": 2,
  "expenses_added": 1,
  "message": "Successfully applied 3 changes"
}
```

## Security Features

- **Rate Limiting**: 10 imports per hour per user
- **File Size Limit**: 5MB maximum
- **File Validation**: CSV extension only, UTF-8 encoding
- **Ownership Checks**: User must own profile
- **PII Stripping**: Removes account numbers, IDs, tracking codes
- **Audit Logging**: All imports logged with sanitized metadata
- **Error Handling**: Never exposes internal paths or stack traces

## Pattern Detection Algorithm

### Income Detection
1. Filter positive amounts
2. Group by similar amounts (±5% tolerance)
3. Detect frequency from date intervals
4. Calculate confidence based on:
   - Amount consistency (low variance = high confidence)
   - Frequency regularity (monthly/biweekly = high confidence)
   - Occurrence count (more transactions = higher confidence)
5. Extract common name from descriptions
6. Return patterns with confidence ≥ 0.5

### Expense Detection
1. Filter negative amounts
2. Group by similar amounts and merchant names
3. Detect frequency
4. Auto-categorize using keyword matching
5. Calculate confidence
6. Return patterns by category

### Frequency Detection
- **Weekly**: 6-8 day intervals
- **Biweekly**: 13-15 day intervals
- **Monthly**: 28-35 day intervals
- **Quarterly**: 88-95 day intervals
- **Irregular**: Other patterns

## Troubleshooting

### "Not enough transactions (minimum 3 required)"
- Ensure CSV has at least 3 valid transactions
- Check date and amount columns are present
- Verify CSV format is correct

### "Could not detect required columns"
- CSV must have Date and Description columns
- Must have either Amount column or Debit + Credit columns
- Check column headers match expected patterns

### "File too large (max 5MB)"
- Split CSV into multiple files
- Remove non-transaction rows (summaries, headers)
- Use date range filtering in your bank's export tool

### Pattern Detection Issues
- **Low confidence scores**: Transactions may be irregular or highly variable
- **Missing patterns**: Need at least 2 occurrences to detect pattern
- **Wrong categorization**: Manually edit category in reconciliation UI

### Reconciliation Not Matching
- **Name mismatch**: Use Edit action to adjust names
- **Amount variance**: Check if frequency differs (monthly vs biweekly)
- **Semantic matching**: "Salary" and "Payroll" should match automatically

## Best Practices

1. **Use 18+ months of data**: More transactions = better pattern detection
2. **Review all conflicts**: Don't auto-accept without checking
3. **Keep manual entries**: They represent future expected income
4. **Update regularly**: Re-import every 3-6 months to catch changes
5. **Check categorization**: Auto-categorization is good but not perfect
6. **Ignore one-time transactions**: Focus on recurring patterns
7. **Use specific names**: "Employer A Salary" better than "Salary"

## Privacy & Data Retention

- **Transactions**: Processed in-memory only, immediately discarded
- **Patterns**: Stored in encrypted profile data
- **PII**: Stripped before any processing
- **Audit Logs**: Sanitized (no amounts, no merchant names)
- **File Uploads**: Deleted after processing
- **Storage Impact**: ~5KB per import (patterns only)

## Testing

**Unit Tests:**
```bash
pytest tests/test_services/test_transaction_analyzer.py -v
```

**Integration Tests:**
```bash
pytest tests/test_routes/test_transaction_import.py -v
```

**Sample CSV:**
```bash
cat tests/test_data/sample_bank_csvs/sample_bank_transactions.csv
```

## Version History

- **v3.9.84** (2026-01-29): Initial release
  - CSV import with pattern detection
  - Income/expense reconciliation
  - Auto-categorization
  - Privacy-first design (no transaction storage)
  - Smart semantic matching
  - Real-time progress updates
  - 38 unit tests, 91% code coverage

## Support

For issues or questions:
- GitHub: https://github.com/anthropics/rps/issues
- Documentation: /docs/guides/TRANSACTION_IMPORT.md
- API Reference: /docs/reference/API.md
