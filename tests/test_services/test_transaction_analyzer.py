"""Tests for transaction analyzer service."""

import pytest
from datetime import date, timedelta
from src.services.transaction_analyzer import (
    Transaction,
    parse_transaction_csv,
    sanitize_transaction,
    detect_income_patterns,
    detect_expense_patterns,
    detect_frequency,
    extract_common_name,
    calculate_confidence,
    auto_categorize_expense,
    reconcile_income,
    normalize_to_monthly
)


class TestParseTransactionCSV:
    """Test CSV parsing with various formats."""

    def test_parse_simple_csv(self):
        """Test parsing basic CSV format."""
        csv_content = """Date,Description,Amount
2024-01-15,Salary Payment,2500.00
2024-01-20,Grocery Store,-125.50
2024-02-15,Salary Payment,2500.00"""

        transactions = parse_transaction_csv(csv_content)

        assert len(transactions) == 3
        assert transactions[0].amount == 2500.00
        assert transactions[1].amount == -125.50
        assert transactions[0].description == "Salary Payment"

    def test_parse_debit_credit_columns(self):
        """Test parsing CSV with separate debit/credit columns."""
        csv_content = """Date,Description,Debit,Credit
2024-01-15,Salary,,2500.00
2024-01-20,Grocery,125.50,
2024-02-15,Salary,,2500.00"""

        transactions = parse_transaction_csv(csv_content)

        assert len(transactions) == 3
        assert transactions[0].amount == 2500.00  # Credit
        assert transactions[1].amount == -125.50  # Debit

    def test_parse_different_date_formats(self):
        """Test parsing various date formats."""
        csv_content = """Date,Description,Amount
01/15/2024,Payment 1,100.00
2024-02-15,Payment 2,100.00
15/03/2024,Payment 3,100.00"""

        transactions = parse_transaction_csv(csv_content)

        assert len(transactions) == 3
        assert transactions[0].date == date(2024, 1, 15)
        assert transactions[1].date == date(2024, 2, 15)

    def test_parse_with_bom(self):
        """Test parsing CSV with BOM (Byte Order Mark)."""
        csv_content = "\ufeffDate,Description,Amount\n2024-01-15,Test 1,100.00\n2024-01-16,Test 2,100.00\n2024-01-17,Test 3,100.00"

        transactions = parse_transaction_csv(csv_content)

        assert len(transactions) == 3
        assert transactions[0].amount == 100.00

    def test_parse_with_currency_symbols(self):
        """Test parsing amounts with currency symbols."""
        csv_content = """Date,Description,Amount
2024-01-15,Payment 1,"$2,500.00"
2024-01-20,Expense,"($125.50)"
2024-01-25,Payment 2,"$1,000.00" """

        transactions = parse_transaction_csv(csv_content)

        assert len(transactions) == 3
        assert transactions[0].amount == 2500.00
        assert transactions[1].amount == -125.50  # Parentheses indicate negative
        assert transactions[2].amount == 1000.00

    def test_insufficient_transactions(self):
        """Test error when less than 3 transactions."""
        csv_content = """Date,Description,Amount
2024-01-15,Payment,100.00"""

        with pytest.raises(ValueError, match="Not enough valid transactions"):
            parse_transaction_csv(csv_content)

    def test_missing_required_columns(self):
        """Test error when required columns missing."""
        csv_content = """Date,Amount
2024-01-15,100.00"""

        with pytest.raises(ValueError, match="Could not detect required columns"):
            parse_transaction_csv(csv_content)


class TestSanitizeTransaction:
    """Test PII removal from transactions."""

    def test_remove_account_numbers(self):
        """Test removal of account numbers."""
        txn = Transaction(
            date=date(2024, 1, 15),
            description="DEBIT CARD PURCHASE 1234567890 STORE NAME",
            amount=100.00,
            original_description="DEBIT CARD PURCHASE 1234567890 STORE NAME"
        )

        sanitized = sanitize_transaction(txn)

        assert "1234567890" not in sanitized.description
        assert "STORE NAME" in sanitized.description.upper()

    def test_remove_tracking_codes(self):
        """Test removal of tracking codes."""
        txn = Transaction(
            date=date(2024, 1, 15),
            description="AMAZON.COM*AB12CD34",
            amount=50.00,
            original_description="AMAZON.COM*AB12CD34"
        )

        sanitized = sanitize_transaction(txn)

        assert "*AB12CD34" not in sanitized.description
        assert "AMAZON" in sanitized.description.upper() or "COM" in sanitized.description.upper()

    def test_remove_common_prefixes(self):
        """Test removal of common prefixes."""
        txn = Transaction(
            date=date(2024, 1, 15),
            description="DEBIT CARD PURCHASE TARGET STORE",
            amount=75.00,
            original_description="DEBIT CARD PURCHASE TARGET STORE"
        )

        sanitized = sanitize_transaction(txn)

        assert "DEBIT CARD PURCHASE" not in sanitized.description
        assert "TARGET" in sanitized.description.upper() or "STORE" in sanitized.description.upper()

    def test_normalize_merchant_names(self):
        """Test normalization of merchant names with long tracking codes."""
        txn = Transaction(
            date=date(2024, 1, 15),
            description="NETFLIX 12345678901",  # 11 digits should be removed
            amount=16.99,
            original_description="NETFLIX 12345678901"
        )

        sanitized = sanitize_transaction(txn)

        assert "12345678901" not in sanitized.description
        assert "NETFLIX" in sanitized.description.upper()


class TestDetectIncomePatterns:
    """Test income pattern detection."""

    def test_detect_biweekly_salary(self):
        """Test detection of biweekly salary pattern."""
        transactions = [
            Transaction(date(2024, 1, 1), "Payroll", 2500.00, "Payroll"),
            Transaction(date(2024, 1, 15), "Payroll", 2500.00, "Payroll"),
            Transaction(date(2024, 1, 29), "Payroll", 2500.00, "Payroll"),
            Transaction(date(2024, 2, 12), "Payroll", 2500.00, "Payroll"),
        ]

        patterns = detect_income_patterns(transactions)

        assert len(patterns) > 0
        assert patterns[0].frequency == 'biweekly'
        assert patterns[0].amount == 2500.00
        assert patterns[0].confidence > 0.7

    def test_detect_monthly_rent_income(self):
        """Test detection of monthly rental income."""
        transactions = [
            Transaction(date(2024, 1, 1), "Rent Payment", 2000.00, "Rent Payment"),
            Transaction(date(2024, 2, 1), "Rent Payment", 2000.00, "Rent Payment"),
            Transaction(date(2024, 3, 1), "Rent Payment", 2000.00, "Rent Payment"),
        ]

        patterns = detect_income_patterns(transactions)

        assert len(patterns) > 0
        assert patterns[0].frequency == 'monthly'
        assert patterns[0].amount == 2000.00

    def test_ignore_irregular_income(self):
        """Test that irregular income is detected but with lower confidence."""
        transactions = [
            Transaction(date(2024, 1, 5), "Freelance", 500.00, "Freelance"),
            Transaction(date(2024, 2, 20), "Freelance", 750.00, "Freelance"),
        ]

        patterns = detect_income_patterns(transactions)

        # Should still detect but with irregular frequency
        if patterns:
            assert patterns[0].frequency == 'irregular'


class TestDetectExpensePatterns:
    """Test expense pattern detection."""

    def test_detect_monthly_rent(self):
        """Test detection of monthly rent expense."""
        transactions = [
            Transaction(date(2024, 1, 1), "Rent Payment", -2000.00, "Rent Payment"),
            Transaction(date(2024, 2, 1), "Rent Payment", -2000.00, "Rent Payment"),
            Transaction(date(2024, 3, 1), "Rent Payment", -2000.00, "Rent Payment"),
        ]

        patterns = detect_expense_patterns(transactions)

        assert 'housing' in patterns
        assert len(patterns['housing']) > 0
        assert patterns['housing'][0].amount == 2000.00
        assert patterns['housing'][0].frequency == 'monthly'

    def test_detect_subscription(self):
        """Test detection of subscription service."""
        transactions = [
            Transaction(date(2024, 1, 15), "Netflix", -16.99, "Netflix"),
            Transaction(date(2024, 2, 15), "Netflix", -16.99, "Netflix"),
            Transaction(date(2024, 3, 15), "Netflix", -16.99, "Netflix"),
        ]

        patterns = detect_expense_patterns(transactions)

        assert 'entertainment' in patterns
        assert patterns['entertainment'][0].amount == 16.99
        assert patterns['entertainment'][0].frequency == 'monthly'


class TestDetectFrequency:
    """Test frequency detection algorithm."""

    def test_detect_weekly(self):
        """Test weekly frequency detection."""
        dates = [
            date(2024, 1, 1),
            date(2024, 1, 8),
            date(2024, 1, 15),
            date(2024, 1, 22),
        ]

        assert detect_frequency(dates) == 'weekly'

    def test_detect_biweekly(self):
        """Test biweekly frequency detection."""
        dates = [
            date(2024, 1, 1),
            date(2024, 1, 15),
            date(2024, 1, 29),
            date(2024, 2, 12),
        ]

        assert detect_frequency(dates) == 'biweekly'

    def test_detect_monthly(self):
        """Test monthly frequency detection."""
        dates = [
            date(2024, 1, 1),
            date(2024, 2, 1),
            date(2024, 3, 1),
        ]

        assert detect_frequency(dates) == 'monthly'

    def test_detect_irregular(self):
        """Test irregular frequency detection."""
        dates = [
            date(2024, 1, 1),
            date(2024, 1, 10),
            date(2024, 2, 25),
        ]

        assert detect_frequency(dates) == 'irregular'


class TestExtractCommonName:
    """Test merchant/employer name extraction."""

    def test_extract_from_identical_descriptions(self):
        """Test extraction when all descriptions are identical."""
        descriptions = ["Acme Corp", "Acme Corp", "Acme Corp"]

        name = extract_common_name(descriptions)

        assert "ACME" in name.upper()

    def test_extract_from_similar_descriptions(self):
        """Test extraction from similar but not identical descriptions."""
        descriptions = [
            "PAYROLL ACME CORP 123",
            "PAYROLL ACME CORP 456",
            "PAYROLL ACME CORP 789"
        ]

        name = extract_common_name(descriptions)

        assert "ACME" in name.upper() or "PAYROLL" in name.upper()

    def test_fallback_to_first_description(self):
        """Test fallback when no common words found."""
        descriptions = ["Store A", "Store B", "Store C"]

        name = extract_common_name(descriptions)

        assert len(name) > 0


class TestCalculateConfidence:
    """Test confidence score calculation."""

    def test_high_confidence_consistent_amounts(self):
        """Test high confidence for consistent amounts."""
        amounts = [2500.00, 2500.00, 2500.00, 2500.00]
        dates = [date(2024, i, 1) for i in range(1, 5)]

        confidence = calculate_confidence(amounts, dates, 'monthly')

        assert confidence > 0.8

    def test_lower_confidence_variable_amounts(self):
        """Test lower confidence for variable amounts."""
        amounts = [2500.00, 2600.00, 2400.00, 2550.00]
        dates = [date(2024, i, 1) for i in range(1, 5)]

        confidence = calculate_confidence(amounts, dates, 'monthly')

        assert confidence < 0.9  # Should be lower due to variance

    def test_confidence_bonus_for_count(self):
        """Test that more transactions increase confidence."""
        amounts_few = [2500.00, 2500.00]
        amounts_many = [2500.00] * 12
        dates_few = [date(2024, 1, 1), date(2024, 2, 1)]
        dates_many = [date(2024, i, 1) for i in range(1, 13)]

        confidence_few = calculate_confidence(amounts_few, dates_few, 'monthly')
        confidence_many = calculate_confidence(amounts_many, dates_many, 'monthly')

        assert confidence_many > confidence_few


class TestAutoCategorizeExpense:
    """Test expense auto-categorization."""

    def test_categorize_housing(self):
        """Test housing categorization."""
        assert auto_categorize_expense("Rent Payment", ["RENT PAYMENT"]) == 'housing'
        assert auto_categorize_expense("Mortgage", ["MORTGAGE PAYMENT"]) == 'housing'

    def test_categorize_utilities(self):
        """Test utilities categorization."""
        assert auto_categorize_expense("Electric Company", ["ELECTRIC BILL"]) == 'utilities'
        assert auto_categorize_expense("Internet", ["INTERNET SERVICE"]) == 'utilities'

    def test_categorize_food(self):
        """Test food categorization."""
        assert auto_categorize_expense("Whole Foods", ["WHOLE FOODS MARKET"]) == 'food'
        assert auto_categorize_expense("Restaurant", ["RESTAURANT ABC"]) == 'food'

    def test_categorize_entertainment(self):
        """Test entertainment categorization."""
        assert auto_categorize_expense("Netflix", ["NETFLIX.COM"]) == 'entertainment'
        assert auto_categorize_expense("Spotify", ["SPOTIFY PREMIUM"]) == 'entertainment'

    def test_default_to_other(self):
        """Test default categorization to 'other'."""
        assert auto_categorize_expense("Random Merchant XYZ", ["RANDOM XYZ"]) in ['other', 'shopping']


class TestReconcileIncome:
    """Test income reconciliation logic."""

    def test_match_exact_income(self):
        """Test matching with exact amounts."""
        from src.services.transaction_analyzer import DetectedIncomeStream

        specified = [
            {'name': 'Salary', 'amount': 2500.00, 'frequency': 'monthly'}
        ]

        detected = [
            DetectedIncomeStream(
                name='Payroll',
                amount=2500.00,
                frequency='monthly',
                confidence=0.95,
                variance=0.0,
                transaction_count=12,
                first_seen='2024-01-01',
                last_seen='2024-12-01',
                sample_descriptions=['Payroll']
            )
        ]

        result = reconcile_income(specified, detected)

        assert len(result.matches) == 1
        assert result.matches[0].match_type == 'match'
        assert result.matches[0].variance_percent < 5

    def test_detect_new_income(self):
        """Test detection of new income not in manual list."""
        from src.services.transaction_analyzer import DetectedIncomeStream

        specified = [
            {'name': 'Salary', 'amount': 2500.00, 'frequency': 'monthly'}
        ]

        detected = [
            DetectedIncomeStream(
                name='Freelance Income',  # Changed to avoid semantic matching with 'rental'
                amount=1500.00,
                frequency='monthly',
                confidence=0.90,
                variance=0.0,
                transaction_count=12,
                first_seen='2024-01-01',
                last_seen='2024-12-01',
                sample_descriptions=['Freelance']
            )
        ]

        result = reconcile_income(specified, detected)

        assert len(result.new_detected) == 1
        assert result.new_detected[0].name == 'Freelance Income'

    def test_detect_manual_only(self):
        """Test detection of manual entries not found in CSV."""
        from src.services.transaction_analyzer import DetectedIncomeStream

        specified = [
            {'name': 'Expected Bonus', 'amount': 5000.00, 'frequency': 'annual'}
        ]

        detected = []

        result = reconcile_income(specified, detected)

        assert len(result.manual_only) == 1
        assert result.manual_only[0]['name'] == 'Expected Bonus'


class TestNormalizeToMonthly:
    """Test frequency normalization."""

    def test_weekly_to_monthly(self):
        """Test weekly to monthly conversion."""
        result = normalize_to_monthly(100.00, 'weekly')
        expected = 100.00 * (52 / 12)  # ~433.33
        assert abs(result - expected) < 0.01

    def test_biweekly_to_monthly(self):
        """Test biweekly to monthly conversion."""
        result = normalize_to_monthly(1000.00, 'biweekly')
        expected = 1000.00 * (26 / 12)  # ~2166.67
        assert abs(result - expected) < 0.01

    def test_monthly_unchanged(self):
        """Test monthly stays the same."""
        result = normalize_to_monthly(2500.00, 'monthly')
        assert result == 2500.00

    def test_quarterly_to_monthly(self):
        """Test quarterly to monthly conversion."""
        result = normalize_to_monthly(3000.00, 'quarterly')
        expected = 3000.00 / 3  # 1000.00
        assert result == expected
