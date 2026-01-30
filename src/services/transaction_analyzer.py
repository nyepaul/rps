"""
Transaction Analysis Service for CSV Import

Provides pattern detection and reconciliation for bank transaction imports.
Detects recurring income and expense patterns from CSV data.
"""

import re
import csv
from io import StringIO
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, date
from collections import defaultdict
from statistics import median, stdev
import logging

logger = logging.getLogger(__name__)


@dataclass
class Transaction:
    """Normalized transaction data structure"""

    date: date
    description: str
    amount: float
    original_description: str  # Keep for reference before sanitization
    type: Optional[str] = None


@dataclass
class DetectedIncomeStream:
    """Detected income pattern with metadata"""

    name: str
    amount: float
    frequency: str  # weekly, biweekly, monthly, quarterly, irregular
    confidence: float  # 0-1 score
    variance: float  # Standard deviation
    transaction_count: int
    first_seen: str  # ISO date
    last_seen: str  # ISO date
    sample_descriptions: List[str]


@dataclass
class DetectedExpense:
    """Detected expense pattern with metadata"""

    name: str
    amount: float
    frequency: str
    confidence: float
    variance: float
    transaction_count: int
    first_seen: str
    last_seen: str
    category: str  # auto-categorized
    sample_descriptions: List[str]


@dataclass
class ReconciliationMatch:
    """A match between specified and detected income/expense"""

    specified_index: int
    specified_name: str
    specified_amount: float
    specified_frequency: str
    detected_name: str
    detected_amount: float
    detected_frequency: str
    variance_percent: float
    match_type: str  # match, minor_conflict, major_conflict
    confidence: float
    suggested_action: str  # merge, review, use_detected


@dataclass
class ReconciliationResult:
    """Complete reconciliation analysis"""

    matches: List[ReconciliationMatch]
    new_detected: List[DetectedIncomeStream]  # In CSV but not in manual
    manual_only: List[Dict]  # In manual but not in CSV (with index)
    summary: Dict


# Column name fuzzy matching patterns
DATE_PATTERNS = [
    "date",
    "transaction date",
    "post date",
    "posting date",
    "trans date",
    "transaction_date",
    "post_date",
    "posting_date",
]
DESCRIPTION_PATTERNS = [
    "description",
    "memo",
    "transaction description",
    "merchant",
    "payee",
    "transaction_description",
    "trans_description",
    "name",
]
AMOUNT_PATTERNS = ["amount", "transaction amount", "trans amount", "transaction_amount"]
DEBIT_PATTERNS = ["debit", "withdrawal", "withdrawals"]
CREDIT_PATTERNS = ["credit", "deposit", "deposits"]
TYPE_PATTERNS = ["type", "transaction type", "trans type", "category"]


def fuzzy_match_column(header: str, patterns: List[str]) -> bool:
    """Check if header matches any pattern (case-insensitive, flexible)"""
    header_lower = header.lower().strip()
    return any(pattern in header_lower for pattern in patterns)


def parse_transaction_csv(csv_content: str) -> List[Transaction]:
    """
    Parse CSV with auto-detection of columns.
    Supports multiple bank formats.
    """
    # Remove BOM if present
    if csv_content.startswith("\ufeff"):
        csv_content = csv_content[1:]

    # Try different delimiters
    delimiter = detect_delimiter(csv_content)

    reader = csv.DictReader(StringIO(csv_content), delimiter=delimiter)
    headers = reader.fieldnames

    if not headers:
        raise ValueError("CSV file has no headers")

    # Auto-detect columns
    date_col = None
    desc_col = None
    amount_col = None
    debit_col = None
    credit_col = None

    for header in headers:
        if not date_col and fuzzy_match_column(header, DATE_PATTERNS):
            date_col = header
        elif not desc_col and fuzzy_match_column(header, DESCRIPTION_PATTERNS):
            desc_col = header
        elif not amount_col and fuzzy_match_column(header, AMOUNT_PATTERNS):
            amount_col = header
        elif not debit_col and fuzzy_match_column(header, DEBIT_PATTERNS):
            debit_col = header
        elif not credit_col and fuzzy_match_column(header, CREDIT_PATTERNS):
            credit_col = header

    if not date_col or not desc_col:
        raise ValueError(
            f"Could not detect required columns. Found headers: {headers}. "
            f"Need date and description columns."
        )

    if not amount_col and not (debit_col and credit_col):
        raise ValueError(
            "Could not detect amount column(s). Need either 'amount' or 'debit'+'credit' columns."
        )

    # Parse transactions
    transactions = []
    for row in reader:
        try:
            # Parse date
            date_str = row[date_col].strip()
            if not date_str:
                continue
            parsed_date = parse_date_flexible(date_str)

            # Parse description
            description = row[desc_col].strip()
            if not description:
                continue

            # Parse amount
            if amount_col:
                amount = parse_amount(row[amount_col])
            else:
                # Combine debit/credit
                debit = (
                    parse_amount(row[debit_col])
                    if row.get(debit_col, "").strip()
                    else 0
                )
                credit = (
                    parse_amount(row[credit_col])
                    if row.get(credit_col, "").strip()
                    else 0
                )
                amount = credit - debit  # Credits positive, debits negative

            if amount == 0:
                continue

            transactions.append(
                Transaction(
                    date=parsed_date,
                    description=description,
                    amount=amount,
                    original_description=description,
                )
            )

        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping row due to parse error: {e}")
            continue

    if len(transactions) < 3:
        raise ValueError(
            f"Not enough valid transactions found (minimum 3, found {len(transactions)})"
        )

    # Sort by date
    transactions.sort(key=lambda t: t.date)

    return transactions


def detect_delimiter(csv_content: str) -> str:
    """Detect CSV delimiter (comma, semicolon, tab)"""
    first_line = csv_content.split("\n")[0]

    # Count occurrences of potential delimiters
    comma_count = first_line.count(",")
    semicolon_count = first_line.count(";")
    tab_count = first_line.count("\t")

    if tab_count > 0:
        return "\t"
    elif semicolon_count > comma_count:
        return ";"
    else:
        return ","


def parse_date_flexible(date_str: str) -> date:
    """Parse date with flexible format detection"""
    # Remove extra whitespace
    date_str = date_str.strip()

    # Try common formats
    formats = [
        "%m/%d/%Y",  # 01/15/2024
        "%m/%d/%y",  # 01/15/24
        "%Y-%m-%d",  # 2024-01-15 (ISO)
        "%d/%m/%Y",  # 15/01/2024
        "%d-%m-%Y",  # 15-01-2024
        "%m-%d-%Y",  # 01-15-2024
        "%Y/%m/%d",  # 2024/01/15
        "%b %d, %Y",  # Jan 15, 2024
        "%d %b %Y",  # 15 Jan 2024
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Could not parse date: {date_str}")


def parse_amount(amount_str: str) -> float:
    """Parse amount, handling currency symbols and formatting"""
    if not amount_str or amount_str.strip() == "":
        return 0.0

    # Remove currency symbols, spaces, parentheses
    cleaned = re.sub(r"[$£€¥,\s()]", "", amount_str.strip())

    # Handle negative amounts in parentheses (accounting format)
    if amount_str.strip().startswith("(") and amount_str.strip().endswith(")"):
        cleaned = "-" + cleaned

    try:
        return float(cleaned)
    except ValueError:
        raise ValueError(f"Could not parse amount: {amount_str}")


def sanitize_transaction(transaction: Transaction) -> Transaction:
    """
    Strip PII from transaction description.
    Removes account numbers, transaction IDs, tracking codes.
    """
    desc = transaction.description

    # Common prefixes to remove (do this first before other sanitization)
    prefixes = [
        "DEBIT CARD PURCHASE ",
        "DEBIT CARD ",
        "CREDIT CARD ",
        "ACH WITHDRAWAL ",
        "ACH DEPOSIT ",
        "ONLINE PAYMENT ",
        "CHECK #",
        "CHECK ",
        "POS PURCHASE ",
        "ATM WITHDRAWAL ",
    ]
    desc_upper = desc.upper()
    for prefix in prefixes:
        if desc_upper.startswith(prefix):
            desc = desc[len(prefix) :].strip()
            desc_upper = desc.upper()
            break

    # Normalize merchant names (remove trailing codes)
    # "AMAZON.COM*AB12CD" -> "AMAZON.COM"
    desc = re.sub(r"\*[A-Z0-9]+$", "", desc)

    # "NETFLIX 123456789" -> "NETFLIX"
    desc = re.sub(r"\s+\d{8,}$", "", desc)  # 8+ digits to avoid removing store numbers

    # Remove common PII patterns
    # Account numbers: 10+ digits (to avoid removing merchant store numbers)
    desc = re.sub(r"\b\d{10,}\b", "", desc)

    # Transaction IDs: alphanumeric codes like AB12CD34 (8+ chars)
    desc = re.sub(r"\b[A-Z0-9]{8,}\b", "", desc)

    # Card numbers: XXXX-XXXX or ****1234
    desc = re.sub(r"[X*]{4}[-\s]?[X*]{4}", "", desc)
    desc = re.sub(r"\*+\d{4}", "", desc)

    # Remove extra whitespace
    desc = " ".join(desc.split())

    # Capitalize properly
    desc = desc.title()

    transaction.description = desc or transaction.original_description[:50]
    return transaction


def detect_income_patterns(
    transactions: List[Transaction],
) -> List[DetectedIncomeStream]:
    """
    Detect recurring income patterns from positive transactions.
    Groups similar amounts and detects frequency.
    """
    if not transactions:
        return []

    # Group by similar amounts (within 5% tolerance)
    amount_groups = group_by_similar_amounts(transactions, tolerance=0.05)

    patterns = []
    for group in amount_groups:
        if len(group) < 2:  # Need at least 2 occurrences to be a pattern
            continue

        amounts = [t.amount for t in group]
        dates = [t.date for t in group]

        # Calculate frequency
        frequency = detect_frequency(dates)

        # Extract common name
        descriptions = [t.description for t in group]
        common_name = extract_common_name(descriptions)

        # Calculate confidence based on consistency
        confidence = calculate_confidence(amounts, dates, frequency)

        # Only include patterns with reasonable confidence
        if confidence >= 0.5:  # Lowered threshold to catch more patterns
            patterns.append(
                DetectedIncomeStream(
                    name=common_name,
                    amount=round(median(amounts), 2),
                    frequency=frequency,
                    confidence=round(confidence, 2),
                    variance=round(stdev(amounts) if len(amounts) > 1 else 0.0, 2),
                    transaction_count=len(group),
                    first_seen=min(dates).isoformat(),
                    last_seen=max(dates).isoformat(),
                    sample_descriptions=descriptions[:3],  # First 3 examples
                )
            )

    # Sort by confidence (highest first)
    patterns.sort(key=lambda p: p.confidence, reverse=True)

    return patterns


def detect_expense_patterns(
    transactions: List[Transaction],
) -> Dict[str, List[DetectedExpense]]:
    """
    Detect recurring expense patterns from negative transactions.
    Auto-categorize by keywords and return grouped by category.
    """
    if not transactions:
        return {}

    # Group by similar amounts
    amount_groups = group_by_similar_amounts(transactions, tolerance=0.05)

    patterns_by_category = defaultdict(list)

    for group in amount_groups:
        if len(group) < 2:  # Need at least 2 occurrences
            continue

        amounts = [abs(t.amount) for t in group]  # Absolute values for expenses
        dates = [t.date for t in group]
        descriptions = [t.description for t in group]

        # Detect frequency
        frequency = detect_frequency(dates)

        # Extract common name
        common_name = extract_common_name(descriptions)

        # Calculate confidence
        confidence = calculate_confidence(amounts, dates, frequency)

        if confidence >= 0.5:
            # Auto-categorize
            category = auto_categorize_expense(common_name, descriptions)

            patterns_by_category[category].append(
                DetectedExpense(
                    name=common_name,
                    amount=round(median(amounts), 2),
                    frequency=frequency,
                    confidence=round(confidence, 2),
                    variance=round(stdev(amounts) if len(amounts) > 1 else 0.0, 2),
                    transaction_count=len(group),
                    first_seen=min(dates).isoformat(),
                    last_seen=max(dates).isoformat(),
                    category=category,
                    sample_descriptions=descriptions[:3],
                )
            )

    # Sort each category by confidence
    for category in patterns_by_category:
        patterns_by_category[category].sort(key=lambda p: p.confidence, reverse=True)

    return dict(patterns_by_category)


def group_by_similar_amounts(
    transactions: List[Transaction], tolerance: float = 0.05
) -> List[List[Transaction]]:
    """
    Group transactions with similar amounts (within tolerance percentage).
    Uses a greedy clustering approach.
    """
    # Sort by absolute amount
    sorted_txns = sorted(transactions, key=lambda t: abs(t.amount))

    groups = []
    used = set()

    for i, txn in enumerate(sorted_txns):
        if i in used:
            continue

        # Start new group
        group = [txn]
        used.add(i)
        base_amount = abs(txn.amount)

        # Find similar amounts
        for j in range(i + 1, len(sorted_txns)):
            if j in used:
                continue

            other_amount = abs(sorted_txns[j].amount)

            # Check if within tolerance
            if base_amount > 0:
                variance = abs(other_amount - base_amount) / base_amount
                if variance <= tolerance:
                    group.append(sorted_txns[j])
                    used.add(j)
                elif other_amount > base_amount * (1 + tolerance):
                    # No more similar amounts
                    break

        if len(group) >= 1:  # Include even single transactions
            groups.append(group)

    return groups


def detect_frequency(dates: List[date]) -> str:
    """
    Detect payment frequency from transaction dates.
    Returns: weekly, biweekly, monthly, quarterly, irregular
    """
    if len(dates) < 2:
        return "irregular"

    # Calculate intervals between consecutive dates
    intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

    if not intervals:
        return "irregular"

    avg_interval = sum(intervals) / len(intervals)

    # Frequency detection with tolerance
    if 6 <= avg_interval <= 8:
        return "weekly"
    elif 13 <= avg_interval <= 15:
        return "biweekly"
    elif 28 <= avg_interval <= 35:
        return "monthly"
    elif 88 <= avg_interval <= 95:
        return "quarterly"
    else:
        return "irregular"


def extract_common_name(descriptions: List[str]) -> str:
    """
    Extract common merchant/employer name from descriptions.
    Uses longest common substring approach.
    """
    if not descriptions:
        return "Unknown"

    if len(descriptions) == 1:
        return descriptions[0][:50]  # Truncate long names

    # Find common words across all descriptions
    words_sets = [set(desc.upper().split()) for desc in descriptions]
    common_words = set.intersection(*words_sets)

    if common_words:
        # Prioritize longer words (more meaningful)
        sorted_words = sorted(common_words, key=len, reverse=True)
        return " ".join(sorted_words[:3]).title()  # Up to 3 words

    # Fallback: use first description
    return descriptions[0][:50]


def calculate_confidence(
    amounts: List[float], dates: List[date], frequency: str
) -> float:
    """
    Calculate confidence score (0-1) based on:
    - Amount consistency (low variance)
    - Frequency regularity
    - Number of occurrences
    """
    if len(amounts) < 2:
        return 0.3

    # Amount consistency (lower variance = higher confidence)
    mean_amount = sum(amounts) / len(amounts)
    variance = stdev(amounts) if len(amounts) > 1 else 0
    amount_consistency = 1.0 - min(
        variance / mean_amount if mean_amount > 0 else 1.0, 1.0
    )

    # Frequency regularity
    frequency_score = {
        "weekly": 0.95,
        "biweekly": 0.95,
        "monthly": 0.95,
        "quarterly": 0.85,
        "irregular": 0.5,
    }.get(frequency, 0.5)

    # Occurrence count bonus (more transactions = higher confidence)
    count_bonus = min(len(amounts) / 10, 0.3)  # Max 30% bonus at 10+ transactions

    # Combined confidence
    confidence = amount_consistency * 0.4 + frequency_score * 0.4 + count_bonus * 0.2

    return max(0.0, min(1.0, confidence))  # Clamp to [0, 1]


def auto_categorize_expense(name: str, descriptions: List[str]) -> str:
    """
    Auto-categorize expense using keyword matching.
    Returns category name matching budget.expenses structure.
    """
    # Combine name and sample descriptions for keyword matching
    text = (name + " " + " ".join(descriptions)).upper()

    # Category keyword patterns (order matters - most specific first)
    categories = {
        "housing": ["RENT", "MORTGAGE", "PROPERTY TAX", "HOA", "HOMEOWNERS"],
        "utilities": [
            "ELECTRIC",
            "GAS",
            "WATER",
            "INTERNET",
            "PHONE",
            "CABLE",
            "UTILITY",
        ],
        "food": [
            "GROCERY",
            "SUPERMARKET",
            "WHOLE FOODS",
            "TRADER",
            "RESTAURANT",
            "CAFE",
            "FOOD",
            "DELIVERY",
            "DOORDASH",
            "UBER EATS",
            "GRUBHUB",
        ],
        "transportation": [
            "GAS",
            "FUEL",
            "PARKING",
            "UBER",
            "LYFT",
            "TRANSIT",
            "METRO",
            "BUS",
            "TRAIN",
            "CAR PAYMENT",
            "AUTO INSURANCE",
        ],
        "entertainment": [
            "NETFLIX",
            "SPOTIFY",
            "HULU",
            "DISNEY",
            "HBO",
            "AMAZON PRIME",
            "MOVIE",
            "THEATER",
            "CONCERT",
            "GAME",
            "ENTERTAINMENT",
        ],
        "healthcare": [
            "PHARMACY",
            "CVS",
            "WALGREENS",
            "DOCTOR",
            "DENTAL",
            "HOSPITAL",
            "MEDICAL",
            "HEALTH",
            "INSURANCE",
        ],
        "insurance": ["INSURANCE", "GEICO", "STATE FARM", "PROGRESSIVE", "ALLSTATE"],
        "shopping": ["AMAZON", "TARGET", "WALMART", "COSTCO", "MALL", "STORE"],
        "other": [],  # Default catch-all
    }

    # Match keywords
    for category, keywords in categories.items():
        if any(keyword in text for keyword in keywords):
            return category

    return "other"  # Default if no match


def reconcile_income(
    specified: List[Dict], detected: List[DetectedIncomeStream]
) -> ReconciliationResult:
    """
    Reconcile specified income streams with detected patterns.
    Identifies matches, conflicts, and new items.
    """
    matches = []
    new_detected = []
    manual_only_indices = set(range(len(specified)))

    # Try to match each detected pattern with specified income
    for detected_item in detected:
        best_match = None
        best_match_score = 0

        for idx, specified_item in enumerate(specified):
            # Name similarity (fuzzy matching)
            name_similarity = calculate_name_similarity(
                specified_item.get("name", ""), detected_item.name
            )

            # Amount similarity
            spec_amount = float(specified_item.get("amount", 0))
            spec_freq = specified_item.get("frequency", "monthly")

            # Normalize to monthly for comparison
            spec_monthly = normalize_to_monthly(spec_amount, spec_freq)
            detected_monthly = normalize_to_monthly(
                detected_item.amount, detected_item.frequency
            )

            amount_similarity = 1.0 - min(
                (
                    abs(spec_monthly - detected_monthly)
                    / max(spec_monthly, detected_monthly)
                    if max(spec_monthly, detected_monthly) > 0
                    else 0
                ),
                1.0,
            )

            # Combined match score - require BOTH name and amount similarity
            # If amounts are too different (>40%), require higher name similarity
            if amount_similarity < 0.6:  # More than 40% difference
                match_score = (
                    name_similarity * 0.8 + amount_similarity * 0.2
                )  # Heavily weight name
            else:
                match_score = name_similarity * 0.6 + amount_similarity * 0.4

            # Higher threshold if amount variance is high
            threshold = 0.6 if amount_similarity < 0.6 else 0.5

            if match_score > best_match_score and match_score >= threshold:
                best_match = idx
                best_match_score = match_score

        if best_match is not None:
            # Found a match
            spec_item = specified[best_match]
            spec_amount = float(spec_item.get("amount", 0))
            spec_freq = spec_item.get("frequency", "monthly")

            # Calculate variance
            spec_monthly = normalize_to_monthly(spec_amount, spec_freq)
            detected_monthly = normalize_to_monthly(
                detected_item.amount, detected_item.frequency
            )
            variance_pct = (
                abs(spec_monthly - detected_monthly) / spec_monthly * 100
                if spec_monthly > 0
                else 0
            )

            # Classify match type
            if variance_pct < 5:
                match_type = "match"
                suggested_action = "keep_manual"
            elif variance_pct < 20:
                match_type = "minor_conflict"
                suggested_action = "review"
            else:
                match_type = "major_conflict"
                suggested_action = "use_detected"

            matches.append(
                ReconciliationMatch(
                    specified_index=best_match,
                    specified_name=spec_item.get("name", ""),
                    specified_amount=spec_amount,
                    specified_frequency=spec_freq,
                    detected_name=detected_item.name,
                    detected_amount=detected_item.amount,
                    detected_frequency=detected_item.frequency,
                    variance_percent=round(variance_pct, 1),
                    match_type=match_type,
                    confidence=detected_item.confidence,
                    suggested_action=suggested_action,
                )
            )

            # Mark as matched
            manual_only_indices.discard(best_match)
        else:
            # No match found - new detected item
            new_detected.append(detected_item)

    # Build manual-only list
    manual_only = [
        {
            "index": idx,
            "name": specified[idx].get("name", ""),
            "amount": specified[idx].get("amount", 0),
            "frequency": specified[idx].get("frequency", "monthly"),
        }
        for idx in sorted(manual_only_indices)
    ]

    # Summary stats
    summary = {
        "total_matches": len(matches),
        "exact_matches": len([m for m in matches if m.match_type == "match"]),
        "conflicts": len([m for m in matches if "conflict" in m.match_type]),
        "new_detected": len(new_detected),
        "manual_only": len(manual_only),
    }

    return ReconciliationResult(
        matches=matches,
        new_detected=new_detected,
        manual_only=manual_only,
        summary=summary,
    )


def calculate_name_similarity(name1: str, name2: str) -> float:
    """
    Calculate simple name similarity (0-1).
    Uses word overlap approach with partial word matching and semantic similarity.
    """
    words1 = set(name1.upper().split())
    words2 = set(name2.upper().split())

    if not words1 or not words2:
        return 0.0

    # Direct word overlap (Jaccard similarity)
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    jaccard = len(intersection) / len(union) if union else 0.0

    # Also check for partial matches (substring matching)
    partial_matches = 0
    for w1 in words1:
        for w2 in words2:
            # Check if one is substring of the other
            if len(w1) >= 4 and len(w2) >= 4:  # Only for words 4+ chars
                if w1 in w2 or w2 in w1:
                    partial_matches += 1
                    break

    # Semantic similarity (known income-related synonyms)
    # Only apply if no other descriptive words differ
    income_synonyms = {
        frozenset(
            ["SALARY", "PAYROLL", "WAGES", "PAY"]
        ),  # Removed 'INCOME' - too generic
        frozenset(["RENT", "RENTAL"]),
        frozenset(["DIVIDEND", "DIVIDENDS", "DIV"]),
        frozenset(["INTEREST", "INT"]),
        frozenset(["BONUS", "BONUSES"]),
        frozenset(["COMMISSION", "COMM"]),
    }

    semantic_match = False
    for synonym_set in income_synonyms:
        words1_syn = words1.intersection(synonym_set)
        words2_syn = words2.intersection(synonym_set)

        if words1_syn and words2_syn:
            # Check if these are the ONLY words (no other descriptive words)
            words1_other = words1 - synonym_set
            words2_other = words2 - synonym_set

            # Filter out common non-descriptive words
            non_descriptive = {"THE", "A", "AN", "AND", "OR", "FROM", "TO"}
            words1_other = words1_other - non_descriptive
            words2_other = words2_other - non_descriptive

            # Only consider semantic match if no other descriptive words differ
            if not words1_other and not words2_other:
                semantic_match = True
                break

    # Combine scores
    partial_bonus = min(partial_matches * 0.2, 0.4)  # Up to 40% bonus
    semantic_bonus = 0.6 if semantic_match else 0.0  # 60% bonus for semantic match

    return min(jaccard + partial_bonus + semantic_bonus, 1.0)


def normalize_to_monthly(amount: float, frequency: str) -> float:
    """
    Normalize any frequency to monthly equivalent for comparison.
    """
    multipliers = {
        "weekly": 52 / 12,  # ~4.33
        "biweekly": 26 / 12,  # ~2.17
        "monthly": 1.0,
        "quarterly": 1 / 3,  # ~0.33
        "annual": 1 / 12,  # ~0.083
        "irregular": 1.0,  # Treat as monthly for comparison
    }

    return amount * multipliers.get(frequency.lower(), 1.0)
