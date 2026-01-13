#!/bin/bash

# Test PDF generation with charts

API_URL="http://127.0.0.1:8080"

echo "=== Testing PDF Generation with Charts ==="

# Step 1: Load the default profile
echo ""
echo "1. Fetching Default Profile..."
PROFILE_DATA=$(curl -s "${API_URL}/api/profile/Default%20Profile")

if [ -z "$PROFILE_DATA" ]; then
    echo "❌ Failed to load profile"
    exit 1
fi

echo "✓ Profile loaded"

# Step 2: Run analysis
echo ""
echo "2. Running Monte Carlo analysis..."

# Construct analysis request
ANALYSIS_REQUEST=$(cat <<EOF
{
  "person1": {
    "name": "Jane Smith",
    "birth_date": "1970-06-15",
    "retirement_date": "2035-06-30",
    "social_security": 2500
  },
  "person2": {
    "name": "John Smith",
    "birth_date": "1968-09-20",
    "retirement_date": "2033-12-31",
    "social_security": 2800
  },
  "income_streams": [
    {
      "name": "Jane's Pension",
      "amount": 48000,
      "start_date": "2035-07-01",
      "inflation_adjusted": true,
      "survivor_benefit": 60
    },
    {
      "name": "John's Pension",
      "amount": 36000,
      "start_date": "2034-01-01",
      "inflation_adjusted": true,
      "survivor_benefit": 50
    }
  ],
  "investment_types": [
    {"name": "Joint Checking", "account": "Checking", "value": 15000, "cost_basis": 0},
    {"name": "Emergency Fund", "account": "Savings", "value": 50000, "cost_basis": 0},
    {"name": "Brokerage Account", "account": "Taxable Brokerage", "value": 425000, "cost_basis": 285000},
    {"name": "Jane's Traditional IRA", "account": "Traditional IRA", "value": 380000, "cost_basis": 0},
    {"name": "John's Traditional IRA", "account": "Traditional IRA", "value": 320000, "cost_basis": 0},
    {"name": "Jane's 401k", "account": "401k", "value": 825000, "cost_basis": 0},
    {"name": "John's 401k", "account": "401k", "value": 680000, "cost_basis": 0},
    {"name": "Jane's Roth IRA", "account": "Roth IRA", "value": 145000, "cost_basis": 0},
    {"name": "John's Roth IRA", "account": "Roth IRA", "value": 125000, "cost_basis": 0}
  ],
  "home_properties": [
    {
      "name": "Primary Residence",
      "property_type": "Primary Residence",
      "current_value": 650000,
      "purchase_price": 385000,
      "mortgage_balance": 125000,
      "annual_costs": 18500,
      "appreciation_rate": 0.03,
      "sale_year": 2045,
      "replacement_cost": 350000
    }
  ],
  "market_assumptions": {
    "stock_allocation": 0.65,
    "stock_return_mean": 0.10,
    "stock_return_std": 0.18,
    "bond_return_mean": 0.04,
    "bond_return_std": 0.06,
    "inflation_mean": 0.03,
    "inflation_std": 0.012
  },
  "assumed_tax_rate": 0.22,
  "target_annual_income": 120000,
  "simulations": 1000
}
EOF
)

ANALYSIS_RESULT=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "$ANALYSIS_REQUEST" \
  "${API_URL}/api/analysis")

if [ -z "$ANALYSIS_RESULT" ]; then
    echo "❌ Failed to run analysis"
    exit 1
fi

SUCCESS_RATE=$(echo "$ANALYSIS_RESULT" | grep -o '"success_rate":[0-9.]*' | cut -d':' -f2)
echo "✓ Analysis complete - Success rate: ${SUCCESS_RATE}%"

# Step 3: Generate PDF
echo ""
echo "3. Generating PDF with charts..."

PDF_REQUEST=$(cat <<EOF
{
  "profile": $(echo "$PROFILE_DATA"),
  "analysis": $(echo "$ANALYSIS_RESULT")
}
EOF
)

curl -s -X POST -H "Content-Type: application/json" \
  -d "$PDF_REQUEST" \
  "${API_URL}/api/report/pdf" \
  -o "test-report-with-charts.pdf"

if [ -f "test-report-with-charts.pdf" ]; then
    FILE_SIZE=$(stat -f%z "test-report-with-charts.pdf" 2>/dev/null || stat -c%s "test-report-with-charts.pdf")
    if [ "$FILE_SIZE" -gt 1000 ]; then
        echo "✓ PDF generated successfully: test-report-with-charts.pdf (${FILE_SIZE} bytes)"
        echo ""
        echo "=== Test Complete ==="
        echo "Open test-report-with-charts.pdf to view the report with charts!"
        exit 0
    else
        echo "❌ PDF file is too small, likely an error"
        cat test-report-with-charts.pdf
        exit 1
    fi
else
    echo "❌ PDF file not created"
    exit 1
fi
