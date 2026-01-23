# RPS Comprehensive Testing Framework

## Overview

This testing framework provides exhaustive analysis of the RPS application across multiple dimensions:

- **JavaScript Code Quality** - Syntax, module structure, duplicates
- **Python Code Quality** - Security, imports, error handling
- **Database Quality** - Schema integrity, referential consistency
- **Financial Calculations** - Accuracy, consistency across tabs

## Quick Start

### Run All Tests

```bash
cd /home/paul/src/rps
./tests/run_comprehensive_tests.sh
```

### Run Individual Test Suites

```bash
# JavaScript quality
pytest tests/comprehensive/test_javascript_quality.py -v

# Python quality
pytest tests/comprehensive/test_python_quality.py -v

# Database quality
pytest tests/comprehensive/test_database_quality.py -v

# Financial calculations
pytest tests/comprehensive/test_financial_calculations.py -v
```

## Test Suites

### 1. JavaScript Quality Tests (`test_javascript_quality.py`)

**Critical Checks:**
- ✓ No duplicate `const` declarations
- ✓ No `var` usage (enforces ES6)
- ✓ All ES6 imports are valid
- ✓ No duplicate HTML element IDs
- ✓ Consistent semicolon usage
- ✓ No duplicate settings modal sections
- ✓ Single canvas variable declaration

**Example:**
```python
def test_no_duplicate_const_declarations(self):
    """Test that no function declares the same const variable twice."""
    # Scans all JS files for duplicate const declarations
    # CRITICAL: Prevents runtime errors like "Identifier 'canvas' has already been declared"
```

### 2. Python Quality Tests (`test_python_quality.py`)

**Critical Checks:**
- ✓ No SQL injection vulnerabilities
- ✓ No debug print statements in production
- ✓ All imports are valid
- ✓ No bare except clauses
- ✓ Proper error handling in routes
- ✓ No SQL LIKE injection in auth
- ✓ No undefined variables in error handlers

**Example:**
```python
def test_no_sql_injection_vulnerabilities(self):
    """Test that no code has potential SQL injection vulnerabilities."""
    # Looks for dangerous patterns: string formatting in SQL queries
    # CRITICAL: Prevents SQL injection attacks
```

### 3. Database Quality Tests (`test_database_quality.py`)

**Critical Checks:**
- ✓ No orphaned scenarios/action items/conversations
- ✓ All profiles have valid users
- ✓ Foreign keys are enabled
- ✓ All expected tables exist
- ✓ Critical indexes exist
- ✓ Profile data is encrypted (has IV column)
- ✓ No duplicate profile names per user
- ✓ All timestamps are valid
- ✓ CASCADE deletes configured correctly

**Example:**
```python
def test_no_orphaned_scenarios(self):
    """Test that all scenarios reference existing profiles."""
    # CRITICAL: Prevents FK constraint violations and dangling data
```

### 4. Financial Calculations Tests (`test_financial_calculations.py`)

**Critical Checks:**
- ✓ Starting portfolio matches asset totals (< 1% tolerance)
- ✓ Timeline Year 0 includes contributions
- ✓ Success rates are reasonable (0-100%)
- ✓ Cash flow syncs with assets
- ✓ Monte Carlo produces consistent results

**Example:**
```python
def test_starting_portfolio_matches_assets(self):
    """Test that Monte Carlo starting portfolio matches asset totals."""
    # CRITICAL: Ensures consistency between profile assets and analysis
```

## Test Results

Test results are saved to `test_results/` directory with timestamps:

```
test_results/
  comprehensive_test_report_20260122_210000.txt
  comprehensive_test_report_20260122_215500.txt
```

## Adding New Tests

### 1. Add to Existing Test Suite

```python
# In tests/comprehensive/test_javascript_quality.py
def test_your_new_check(self):
    """Test that <your requirement>."""
    issues = []
    # Your test logic here
    assert len(issues) == 0, f"Found issues:\n" + "\n".join(issues)
```

### 2. Create New Test Suite

```bash
# Create new test file
touch tests/comprehensive/test_new_suite.py

# Add to run_comprehensive_tests.sh
if run_test_suite "tests/comprehensive/test_new_suite.py" "New Suite Tests"; then
    ((PASSED++))
else
    ((FAILED++))
fi
```

## Test Coverage

### JavaScript Files Tested
- All files in `src/static/js/**/*.js`
- Components: 43 files
- API clients: 8 files
- Utilities: 7 files
- **Total: 58 files**

### Python Files Tested
- All files in `src/**/*.py`
- Routes: 12 files
- Services: 8 files
- Models: 6 files
- **Total: ~50 files**

### Database Tables Tested
- users, profile, scenarios, action_items
- conversations, audit_log, enhanced_audit_log
- feedback, feedback_content, feedback_replies
- groups, user_groups, admin_groups
- user_backups, system_config, password_reset_requests
- **Total: 16 tables**

## Continuous Integration

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./tests/run_comprehensive_tests.sh
if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Comprehensive Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run comprehensive tests
        run: ./tests/run_comprehensive_tests.sh
```

## Known Issues Tracked

The tests automatically detect and track these known issues:

### Critical
1. **Duplicate Settings Modal** - main.js lines 551-624
2. **SQL LIKE Injection** - auth/routes.py line 40-42

### High
1. **Undefined Variable in Error Handler** - profiles.py line 186
2. **Missing Crypto Error Handling** - auth/routes.py line 150

### Medium
1. **Debug Print Statements** - Multiple files
2. **Missing Database Indexes** - Several tables
3. **Orphaned Scenarios** - 3 records with profile_id=2

## Performance Benchmarks

Expected test execution times:
- JavaScript Quality: ~5 seconds
- Python Quality: ~10 seconds
- Database Quality: ~3 seconds
- Financial Calculations: ~30 seconds (Monte Carlo simulations)
- **Total: ~50 seconds**

## Maintenance

### Update Test Baselines

When intentionally changing behavior:

```python
# In test file, update assertion
assert len(issues) <= 5, "Allow up to 5 instances"
```

### Disable Specific Tests

```python
@pytest.mark.skip(reason="Temporarily disabled")
def test_something(self):
    pass
```

## Reporting Issues

If tests fail:

1. **Review the error message** - Test output is verbose
2. **Check the report file** - `test_results/comprehensive_test_report_*.txt`
3. **Fix the issue** - Follow the suggested fixes in test output
4. **Re-run tests** - `./tests/run_comprehensive_tests.sh`
5. **Commit the fix** - With reference to test failure

## Future Enhancements

Planned additions:
- [ ] Performance regression tests
- [ ] API endpoint integration tests
- [ ] UI automation tests (Selenium/Playwright)
- [ ] Load testing (concurrent users)
- [ ] Security penetration tests
- [ ] Accessibility (WCAG) tests

## Contact

For questions or suggestions about the testing framework:
- File an issue on GitHub
- Review test documentation in this file
- Check test output for detailed error messages

---

**Last Updated:** 2026-01-22
**Version:** 3.8.105
**Maintainer:** Claude Sonnet 4.5 / Paul Nye
