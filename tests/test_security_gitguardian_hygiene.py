import re
from pathlib import Path


GUARDED_TEST_FILES = (
    Path("tests/test_routes/test_auth.py"),
    Path("tests/test_security_csrf_policy.py"),
)

# Common high-signal literals that trigger "Generic Password" detectors when hardcoded.
FORBIDDEN_GENERIC_PASSWORD_LITERALS = (
    "Pass1234",
    "WrongPassword",
    "SomePass123",
    "CsrfPass123",
    "Newpass123",
    "bad-pass",
)


def test_no_forbidden_generic_password_literals_in_guarded_tests():
    violations = []
    for path in GUARDED_TEST_FILES:
        text = path.read_text(encoding="utf-8")
        for literal in FORBIDDEN_GENERIC_PASSWORD_LITERALS:
            if literal in text:
                violations.append(f"{path}: contains forbidden literal '{literal}'")

        # Guard against adding new hardcoded password JSON values.
        for match in re.finditer(r'"password"\s*:\s*"[^"]{8,}"', text):
            snippet = match.group(0)
            violations.append(f"{path}: hardcoded password payload {snippet}")

    assert not violations, "GitGuardian hygiene violations found:\n" + "\n".join(violations)
