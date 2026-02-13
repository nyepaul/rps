import re
from pathlib import Path


JS_ROOT = Path("src/static/js")
PHASE6_SCOPE_FILES = (
    Path("src/static/js/components/income/income-tab.js"),
    Path("src/static/js/components/budget/budget-tab.js"),
    Path("src/static/js/components/financial-data/financial-data-tab.js"),
    Path("src/static/js/components/profile/profile-tab.js"),
)

# Guard against reintroducing unsafe direct interpolation of runtime/server
# error text into innerHTML template literals.
UNSAFE_PATTERNS = (
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*error\.message\b", re.MULTILINE),
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*err\.message\b", re.MULTILINE),
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*data\.error\b", re.MULTILINE),
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*data\.message\b", re.MULTILINE),
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*result\.error\b", re.MULTILINE),
    re.compile(r"innerHTML\s*=\s*`[^`]*\$\{\s*errorMsg\b", re.MULTILINE),
)

# Detect direct unescaped user-data interpolation inside HTML template sinks.
# Phase 6 scope intentionally focuses on profile/stream/item/expense-style data objects.
UNSAFE_USER_DATA_HTML_PATTERNS = (
    re.compile(
        r"(?:innerHTML\s*=|modal\.innerHTML\s*=|rowElement\.innerHTML\s*=|listContainer\.innerHTML\s*=|container\.innerHTML\s*=|summaryContainer\.innerHTML\s*=|let\s+html\s*=|html\s*\+=|const\s+childHtml\s*=)\s*`[^`]*\$\{\s*(?!escapeHtml\()(?:stream|item|expense|profile|asset|group|child|row)\.(?:name|description|notes|title|institution|detected_from|child_name)\b[^}]*\}",
        re.MULTILINE,
    ),
)

# Allowlist for reviewed safe/static cases to keep the guard actionable.
SAFE_HTML_ALLOWLIST = (
    # No current exceptions.
)


def test_no_unsafe_runtime_error_interpolation_into_innerhtml():
    violations = []
    for path in JS_ROOT.rglob("*.js"):
        text = path.read_text(encoding="utf-8")
        for pattern in UNSAFE_PATTERNS:
            match = pattern.search(text)
            if match:
                excerpt = text[max(0, match.start() - 80): match.end() + 80].replace("\n", " ")
                violations.append(f"{path}: {excerpt[:260]}")

    assert not violations, "Unsafe dynamic innerHTML interpolation detected:\n" + "\n".join(violations)


def test_no_unescaped_user_data_interpolation_into_html_templates_phase6_scope():
    violations = []
    for path in PHASE6_SCOPE_FILES:
        text = path.read_text(encoding="utf-8")
        for pattern in UNSAFE_USER_DATA_HTML_PATTERNS:
            for match in pattern.finditer(text):
                excerpt = text[max(0, match.start() - 80): match.end() + 80].replace("\n", " ")
                entry = f"{path}: {excerpt[:260]}"
                if any(allowed in entry for allowed in SAFE_HTML_ALLOWLIST):
                    continue
                violations.append(entry)

    assert not violations, "Unescaped user-data HTML interpolation detected in phase-6 scope:\n" + "\n".join(violations)
