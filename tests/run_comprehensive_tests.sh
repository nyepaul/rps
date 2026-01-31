#!/bin/bash
###############################################################################
# RPS Comprehensive Test Runner
# Runs all test suites and generates a comprehensive report
###############################################################################

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================================"
echo " RPS COMPREHENSIVE TEST SUITE"
echo "================================================================================"
echo ""
echo "Project: Retirement Planning System (RPS)"
echo "Version: $(grep '"version":' src/static/version.json | cut -d'"' -f4)"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "================================================================================"
echo ""

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "✓ Virtual environment activated (venv)"
elif [ -f "src/venv/bin/activate" ]; then
    source src/venv/bin/activate
    echo "✓ Virtual environment activated (src/venv)"
else
    echo "⚠ Virtual environment not found, using system Python"
fi

# Install test dependencies if needed
pip install -q pytest pytest-cov 2>/dev/null || true

# Create results directory
mkdir -p test_results
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
REPORT_FILE="test_results/comprehensive_test_report_${TIMESTAMP}.txt"

echo "Report will be saved to: $REPORT_FILE"
echo ""

# Function to run a test suite
run_test_suite() {
    local test_file=$1
    local suite_name=$2

    echo "================================================================================"
    echo " Running: $suite_name"
    echo "================================================================================"
    echo ""

    if pytest -c config/pytest.ini "$test_file" -v --tb=short 2>&1 | tee -a "$REPORT_FILE"; then
        echo -e "${GREEN}✓ $suite_name PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name FAILED${NC}"
        return 1
    fi
}

# Track results
PASSED=0
FAILED=0
TOTAL=0

# JavaScript Quality Tests
echo "Starting test suites..." | tee "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if run_test_suite "tests/comprehensive/test_javascript_quality.py" "JavaScript Quality Tests"; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo "" | tee -a "$REPORT_FILE"

# Python Quality Tests
if run_test_suite "tests/comprehensive/test_python_quality.py" "Python Quality Tests"; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo "" | tee -a "$REPORT_FILE"

# Database Quality Tests
if run_test_suite "tests/comprehensive/test_database_quality.py" "Database Quality Tests"; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo "" | tee -a "$REPORT_FILE"

# Financial Calculations Tests
if run_test_suite "tests/comprehensive/test_financial_calculations.py" "Financial Calculations Tests"; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))
echo "" | tee -a "$REPORT_FILE"

# Summary
echo "================================================================================" | tee -a "$REPORT_FILE"
echo " TEST SUITE SUMMARY" | tee -a "$REPORT_FILE"
echo "================================================================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
echo "Total Test Suites: $TOTAL" | tee -a "$REPORT_FILE"
echo "Passed: $PASSED" | tee -a "$REPORT_FILE"
echo "Failed: $FAILED" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TEST SUITES PASSED${NC}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "The RPS application has passed all comprehensive quality checks." | tee -a "$REPORT_FILE"
    exit 0
else
    echo -e "${RED}✗ $FAILED TEST SUITE(S) FAILED${NC}" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "Please review the failures above and fix the issues." | tee -a "$REPORT_FILE"
    exit 1
fi
