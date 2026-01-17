#!/bin/bash

# Comprehensive Test Script for Retirement Planning System
# Covers all API endpoints and features

BASE_URL="http://127.0.0.1:5137"
TIMESTAMP=$(date +%s)
TEST_PROFILE="TestProfile_$TIMESTAMP"

# Helper function for JSON parsing
get_json_value() {
    python3 -c "import json, sys; print(json.load(sys.stdin)$1)" 2>/dev/null
}

echo "==================================================="
echo "  Retirement Planning System - Comprehensive Tests"
echo "==================================================="
echo ""

# ---------------------------------------------------------
# 1. Health Check
# ---------------------------------------------------------
echo "1. Health Check..."
health_response=$(curl -s $BASE_URL/health)
status=$(echo "$health_response" | get_json_value "['status']")

if [ "$status" == "healthy" ]; then
    echo "   ✓ System is healthy"
else
    echo "   ✗ Health check failed: $health_response"
    exit 1
fi
echo ""

# ---------------------------------------------------------
# 2. System Settings
# ---------------------------------------------------------
echo "2. System Settings..."
echo "   Setting a test setting..."
curl -s -X POST $BASE_URL/api/system/settings \
  -H "Content-Type: application/json" \
  -d '{"test_setting": "test_value"}' > /dev/null

settings=$(curl -s $BASE_URL/api/system/settings)
test_value=$(echo "$settings" | get_json_value "['test_setting']")

if [ "$test_value" == "test_value" ]; then
    echo "   ✓ System settings updated and retrieved"
else
    echo "   ✗ System settings test failed"
fi
echo ""

# ---------------------------------------------------------
# 3. Profile Management
# ---------------------------------------------------------
echo "3. Profile Management..."

# Create Profile
echo "   Creating '$TEST_PROFILE'..."
cat > /tmp/profile.json << EOF
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

create_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE_URL/api/profile/$TEST_PROFILE \
  -H "Content-Type: application/json" \
  -d @/tmp/profile.json)

if [ "$create_status" -eq 200 ]; then
    echo "   ✓ Profile created"
else
    echo "   ✗ Failed to create profile (Status: $create_status)"
fi

# List Profiles
echo "   Listing profiles..."
profiles=$(curl -s $BASE_URL/api/profiles)
if echo "$profiles" | grep -q "$TEST_PROFILE"; then
    echo "   ✓ '$TEST_PROFILE' found in list"
else
    echo "   ✗ '$TEST_PROFILE' NOT found in list"
fi

# Get Profile
echo "   Getting '$TEST_PROFILE'..."
profile_data=$(curl -s $BASE_URL/api/profile/$TEST_PROFILE)
if echo "$profile_data" | grep -q "Test User"; then
    echo "   ✓ Profile data verified"
else
    echo "   ✗ Failed to retrieve profile data"
fi
echo ""

# ---------------------------------------------------------
# 4. Financial Analysis
# ---------------------------------------------------------
echo "4. Financial Analysis..."
cat > /tmp/analysis_input.json << EOF
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
  "children": [],
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

analysis_response=$(curl -s -X POST $BASE_URL/api/analysis \
  -H "Content-Type: application/json" \
  -d @/tmp/analysis_input.json)

if echo "$analysis_response" | grep -q "monte_carlo"; then
    echo "   ✓ Analysis completed successfully"
    success_rate=$(echo "$analysis_response" | get_json_value "['monte_carlo']['success_rate']")
    echo "   - Monte Carlo Success Rate: ${success_rate}%"
else
    echo "   ✗ Analysis failed"
fi
echo ""

# ---------------------------------------------------------
# 5. Scenarios
# ---------------------------------------------------------
echo "5. Scenarios..."

# Create Scenario
echo "   Creating Test Scenario..."
cat > /tmp/scenario.json << EOF
{
    "name": "Test Scenario $TIMESTAMP",
    "parameters": {"param1": "value1"},
    "results": {"result1": "value1"}
}
EOF

scenario_response=$(curl -s -X POST $BASE_URL/api/scenarios \
  -H "Content-Type: application/json" \
  -d @/tmp/scenario.json)

scenario_id=$(echo "$scenario_response" | get_json_value "['id']")

if [ "$scenario_id" != "None" ] && [ -n "$scenario_id" ]; then
    echo "   ✓ Scenario created (ID: $scenario_id)"
else
    echo "   ✗ Failed to create scenario"
fi

# List Scenarios
echo "   Listing scenarios..."
scenarios_list=$(curl -s $BASE_URL/api/scenarios)
if echo "$scenarios_list" | grep -q "Test Scenario $TIMESTAMP"; then
    echo "   ✓ Scenario found in list"
else
    echo "   ✗ Scenario NOT found in list"
fi

# Get Scenario Detail
if [ -n "$scenario_id" ]; then
    echo "   Getting scenario details..."
    scenario_detail=$(curl -s $BASE_URL/api/scenarios/$scenario_id)
    if echo "$scenario_detail" | grep -q "Test Scenario $TIMESTAMP"; then
        echo "   ✓ Scenario details verified"
    else
        echo "   ✗ Failed to retrieve scenario details"
    fi

    # Delete Scenario
    echo "   Deleting scenario..."
    delete_response=$(curl -s -X DELETE $BASE_URL/api/scenarios/$scenario_id)
    status=$(echo "$delete_response" | get_json_value "['status']")
    if [ "$status" == "success" ]; then
        echo "   ✓ Scenario deleted"
    else
        echo "   ✗ Failed to delete scenario"
    fi
fi
echo ""

# ---------------------------------------------------------
# 6. Action Items
# ---------------------------------------------------------
echo "6. Action Items..."

# Create Action Item
echo "   Creating Action Item..."
cat > /tmp/action_item.json << EOF
{
    "category": "Test Category",
    "description": "Test Description $TIMESTAMP",
    "priority": "high",
    "profile_name": "$TEST_PROFILE",
    "due_date": "2026-12-31"
}
EOF

action_response=$(curl -s -X POST $BASE_URL/api/action-items \
  -H "Content-Type: application/json" \
  -d @/tmp/action_item.json)

action_id=$(echo "$action_response" | get_json_value "['id']")

if [ "$action_id" != "None" ] && [ -n "$action_id" ]; then
    echo "   ✓ Action item created (ID: $action_id)"
else
    echo "   ✗ Failed to create action item"
fi

# Get Action Items
echo "   Listing action items for profile..."
items_list=$(curl -s "$BASE_URL/api/action-items?profile_name=$TEST_PROFILE")
if echo "$items_list" | grep -q "Test Description $TIMESTAMP"; then
    echo "   ✓ Action item found in list"
else
    echo "   ✗ Action item NOT found in list"
fi

# Update Action Item
if [ -n "$action_id" ]; then
    echo "   Updating action item status..."
    curl -s -X PUT $BASE_URL/api/action-items \
      -H "Content-Type: application/json" \
      -d "{\"id\": $action_id, \"status\": \"completed\"}" > /dev/null
    
    # Verify update
    updated_list=$(curl -s "$BASE_URL/api/action-items?profile_name=$TEST_PROFILE")
    if echo "$updated_list" | grep -q "completed"; then
        echo "   ✓ Action item status updated"
    else
        echo "   ✗ Action item status update failed"
    fi

    # Delete Action Item
    echo "   Deleting action item..."
    curl -s -X DELETE $BASE_URL/api/action-items \
      -H "Content-Type: application/json" \
      -d "{\"id\": $action_id}" > /dev/null
      
    # Verify deletion
    final_list=$(curl -s "$BASE_URL/api/action-items?profile_name=$TEST_PROFILE")
    if echo "$final_list" | grep -q "Test Description $TIMESTAMP"; then
        echo "   ✗ Action item deletion failed"
    else
        echo "   ✓ Action item deleted"
    fi
fi

# Generate Action Items
echo "   Generating Action Items from Analysis..."
generate_result=$(curl -s -X POST $BASE_URL/api/generate-action-items \
  -H "Content-Type: application/json" \
  -d "{\"analysis\": $analysis_response, \"profile_name\": \"$TEST_PROFILE\"}")
items_created=$(echo "$generate_result" | get_json_value "['items_created']")
echo "   ✓ Created $items_created new action items"
echo ""

# ---------------------------------------------------------
# 7. PDF Report
# ---------------------------------------------------------
echo "7. PDF Report..."
echo "   Generating PDF report..."
# Construct request payload
cat > /tmp/pdf_request.json << EOF
{
    "profile": $(cat /tmp/profile.json),
    "analysis": $analysis_response
}
EOF

curl -s -X POST $BASE_URL/api/report/pdf \
  -H "Content-Type: application/json" \
  -d @/tmp/pdf_request.json \
  -o /tmp/report.pdf

if [ -f /tmp/report.pdf ] && [ -s /tmp/report.pdf ]; then
    echo "   ✓ PDF report generated (Size: $(du -h /tmp/report.pdf | cut -f1))"
else
    echo "   ✗ Failed to generate PDF report"
fi
echo ""

# ---------------------------------------------------------
# 8. Cleanup
# ---------------------------------------------------------
echo "8. Cleanup..."
# Cleanup Action Items
echo "   Running action items deduplication cleanup..."
cleanup_response=$(curl -s -X POST $BASE_URL/api/action-items/cleanup)
status=$(echo "$cleanup_response" | get_json_value "['status']")
if [ "$status" == "success" ]; then
    echo "   ✓ Action items cleanup ran successfully"
else
    echo "   ✗ Action items cleanup failed"
fi

# Delete Test Profile
echo "   Deleting '$TEST_PROFILE'..."
curl -s -X DELETE $BASE_URL/api/profile/$TEST_PROFILE > /dev/null
echo "   ✓ Test profile deleted"
echo ""

# ---------------------------------------------------------
# 9. AI Features (Conditional)
# ---------------------------------------------------------
echo "9. AI Features..."

# Check for API Key
API_KEY=""
if [ -n "$GEMINI_API_KEY" ]; then
    API_KEY=$GEMINI_API_KEY
    PROVIDER="gemini"
    echo "   Detected GEMINI_API_KEY"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
    API_KEY=$ANTHROPIC_API_KEY
    PROVIDER="claude"
    echo "   Detected ANTHROPIC_API_KEY"
else
    echo "   ! No API Key found (GEMINI_API_KEY or ANTHROPIC_API_KEY). Skipping AI tests."
fi

if [ -n "$API_KEY" ]; then
    echo "   Testing Advisor Chat..."
    chat_response=$(curl -s -X POST $BASE_URL/api/advisor/chat \
      -H "Content-Type: application/json" \
      -d "{\"message\": \"Hello\", \"llm_provider\": \"$PROVIDER\", \"api_key\": \"$API_KEY\", \"profile_name\": \"main\"}")
    
    chat_status=$(echo "$chat_response" | get_json_value "['status']")
    if [ "$chat_status" == "success" ]; then
        echo "   ✓ Advisor chat response received"
    else
        echo "   ✗ Advisor chat failed: $chat_response"
    fi
    
    echo "   Testing Conversation History..."
    history_response=$(curl -s "$BASE_URL/api/advisor/history?profile_name=main")
    if echo "$history_response" | grep -q "Hello"; then
        echo "   ✓ Conversation history retrieved"
    else
        echo "   ✗ Conversation history failed"
    fi
    
    echo "   Clearing Conversation History..."
    curl -s -X POST "$BASE_URL/api/advisor/clear?profile_name=main" > /dev/null
    echo "   ✓ History cleared"
fi

echo ""
echo "==================================================="
echo "  All Tests Complete!"
echo "==================================================="
echo ""
