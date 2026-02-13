import re
from pathlib import Path


JS_ROOT = Path("src/static/js")

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
