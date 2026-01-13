#!/bin/bash

# API Testing Script for Retirement Planning System

BASE_URL="http://127.0.0.1:8080"

echo "==================================================="
echo "  Retirement Planning System - API Tests"
echo "==================================================="
echo ""

# Test 1: Health Check
echo "1. Health Check..."
health=$(curl -s $BASE_URL/health)
echo "   Result: $health"
echo ""

# Test 2: Profile Lifecycle (Create, List, Get)
echo "2. Testing Profile Lifecycle..."

# 2a. Create Profile
echo "   Creating 'TestProfile'..."
cat > /tmp/profile.json << 'EOF'
{
  "person1": {"name": "Test User", "birth_date": "1980-01-01", "retirement_date": "2045-01-01", "social_security": 2000},
  "person2": {"name": "Test Spouse", "birth_date": "1982-01-01", "retirement_date": "2047-01-01", "social_security": 1500},
  "children": [],
  "liquid_assets": 50000,
  "traditional_ira": 100000,
  "roth_ira": 50000,
  "pension_lump_sum": 0,
  "pension_annual": 0,
  "annual_expenses": 60000,
  "target_annual_income": 80000,
  "risk_tolerance": "moderate",
  "asset_allocation": {"stocks": 0.6, "bonds": 0.4},
  "future_expenses": [],
  "investment_types": [],
  "accounts": []
}
EOF

create_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE_URL/api/profile/TestProfile \
  -H "Content-Type: application/json" \
  -d @/tmp/profile.json)

if [ "$create_status" -eq 200 ]; then
    echo "   ✓ Profile created"
else
    echo "   ✗ Failed to create profile (Status: $create_status)"
fi

# 2b. List Profiles
echo "   Listing profiles..."
profiles=$(curl -s $BASE_URL/api/profiles)
if echo "$profiles" | grep -q "TestProfile"; then
    echo "   ✓ 'TestProfile' found in list"
else
    echo "   ✗ 'TestProfile' NOT found in list"
fi

# 2c. Get Profile
echo "   Getting 'TestProfile'..."
profile_data=$(curl -s $BASE_URL/api/profile/TestProfile)
if echo "$profile_data" | grep -q "Test User"; then
    echo "   ✓ Profile data verified"
else
    echo "   ✗ Failed to retrieve profile data"
fi
echo ""

# Test 3: Run Analysis
echo "3. Running Financial Analysis (this may take a few seconds)..."
cat > /tmp/test-profile.json << 'EOF'
{
  "person1": {
    "name": "You",
    "birth_date": "1965-03-24",
    "retirement_date": "2027-07-01",
    "social_security": 3700
  },
  "person2": {
    "name": "Mindy",
    "birth_date": "1973-01-26",
    "retirement_date": "2028-01-26",
    "social_security": 3300
  },
  "children": [
    {"name": "Grif", "birth_date": "2006-05-18"},
    {"name": "Jonah", "birth_date": "2008-06-06"}
  ],
  "liquid_assets": 100000,
  "traditional_ira": 2000000,
  "roth_ira": 850000,
  "pension_lump_sum": 120000,
  "annual_expenses": 180000,
  "target_annual_income": 200000,
  "risk_tolerance": "moderate",
  "asset_allocation": {"stocks": 0.5, "bonds": 0.5},
  "future_expenses": []
}
EOF

analysis=$(curl -s -X POST $BASE_URL/api/analysis \
  -H "Content-Type: application/json" \
  -d @/tmp/test-profile.json)

if echo "$analysis" | grep -q "monte_carlo"; then
    echo "   ✓ Analysis completed successfully"
    echo ""
    echo "   Key Results:"
    success_rate=$(echo "$analysis" | python3 -c "import json, sys; print(json.load(sys.stdin)['monte_carlo']['success_rate'])" 2>/dev/null)
    net_worth=$(echo "$analysis" | python3 -c "import json, sys; print(f\"{json.load(sys.stdin)['total_net_worth']:,.0f}\")" 2>/dev/null)
    echo "   - Success Rate: ${success_rate}%"
    echo "   - Total Net Worth: \$${net_worth}"
else
    echo "   ✗ Analysis failed"
    echo "   Error: $analysis"
fi
echo ""

# Test 4: Action Items
echo "4. Checking Action Items..."
items=$(curl -s $BASE_URL/api/action-items)
count=$(echo "$items" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "   Found $count action items"
echo ""

# Test 5: Generate New Action Items
echo "5. Generating Action Items from Analysis..."
generate_result=$(curl -s -X POST $BASE_URL/api/generate-action-items \
  -H "Content-Type: application/json" \
  -d "{\"analysis\": $analysis}")
items_created=$(echo "$generate_result" | python3 -c "import json, sys; print(json.load(sys.stdin).get('items_created', 0))" 2>/dev/null)
echo "   ✓ Created $items_created new action items"
echo ""

echo "==================================================="
echo "  All Tests Complete!"
echo "==================================================="
echo ""
echo "Access the web interface at:"
echo "  http://127.0.0.1:8080"
echo ""
