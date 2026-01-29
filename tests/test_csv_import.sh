#!/bin/bash
# CSV Import Phase 1 Testing Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "================================================"
echo "  CSV Import Phase 1 Testing"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "Checking if RPS server is running..."
if curl -s http://127.0.0.1:5137/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
    echo "Please start the server with: ./bin/start"
    exit 1
fi

echo ""
echo "Test files available in: tests/test_data/"
echo ""
echo "Sample files created:"
echo "  - sample_income.csv (basic income with 5 entries)"
echo "  - sample_income_variations.csv (different column names)"
echo "  - sample_income_quoted.csv (quoted values with commas)"
echo "  - sample_income_tabs.csv (tab-delimited)"
echo "  - sample_expenses.csv (13 expense entries)"
echo "  - sample_assets.csv (8 asset entries)"
echo ""

echo -e "${YELLOW}Manual Testing Required:${NC}"
echo ""
echo "1. Open browser to: http://127.0.0.1:5137/"
echo "2. Create or select a profile"
echo ""
echo "=== Income Tab Tests ==="
echo "  a) Navigate to Income tab"
echo "  b) Click 'Import CSV' button"
echo "  c) Upload: tests/test_data/sample_income.csv"
echo "  d) Verify: 5 income streams imported"
echo "  e) Upload: tests/test_data/sample_income_variations.csv"
echo "  f) Verify: 3 income streams imported with correct column mapping"
echo "  g) Upload: tests/test_data/sample_income_quoted.csv"
echo "  h) Verify: 3 income streams with quoted values imported correctly"
echo "  i) Upload: tests/test_data/sample_income_tabs.csv"
echo "  j) Verify: 2 income streams from tab-delimited file imported"
echo ""

echo "=== Budget Tab Tests ==="
echo "  a) Navigate to Budget tab"
echo "  b) Click 'Import CSV' button"
echo "  c) Select 'Pre-Retirement' period"
echo "  d) Upload: tests/test_data/sample_expenses.csv"
echo "  e) Verify: 13 expenses imported"
echo "  f) Verify: Expenses correctly categorized (housing, food, etc.)"
echo "  g) Try importing to 'Post-Retirement' period"
echo "  h) Try importing to 'Both Periods'"
echo ""

echo "=== Assets Tab Tests ==="
echo "  a) Navigate to Assets tab"
echo "  b) Click 'Import CSV' button"
echo "  c) Upload: tests/test_data/sample_assets.csv"
echo "  d) Verify: Preview shows 8 assets in table format"
echo "  e) Verify: Asset types mapped correctly (401k, traditional_ira, roth_ira, etc.)"
echo "  f) Click 'Import Assets' button"
echo "  g) Verify: 8 assets imported successfully"
echo ""

echo "=== Edge Case Tests ==="
echo "  - Empty CSV (should show error)"
echo "  - CSV with only headers (should show error)"
echo "  - CSV with missing required columns (should show error)"
echo "  - CSV with extra whitespace (should handle gracefully)"
echo "  - Large CSV with 100+ rows (should handle without timeout)"
echo ""

echo -e "${YELLOW}Unit Tests:${NC}"
echo "  Open in browser: file://${PROJECT_ROOT}/tests/test_csv_parser.html"
echo "  Expected: All 50+ tests should pass"
echo ""

echo "=== Browser Console Check ==="
echo "  - Open browser console (F12)"
echo "  - Look for any JavaScript errors"
echo "  - Import warnings should appear in console (yellow)"
echo "  - Import errors should appear in UI (red toast)"
echo ""

echo "================================================"
echo "  Testing Guide Complete"
echo "================================================"
echo ""
echo "After testing, update the checklist in:"
echo "  docs/CSV_IMPORT_IMPLEMENTATION.md"
echo ""
