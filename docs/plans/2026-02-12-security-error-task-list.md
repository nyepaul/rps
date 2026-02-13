# Security and Error Task List (Re-evaluated 2026-02-13)

This document now reflects the current code state after implemented phases, and lists only remaining gaps to execute.

## Re-evaluation evidence (2026-02-13)

- Security regression suite:
  - `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py`
  - Result: `15 passed`
- Runtime dependency versions in local venv:
  - `cryptography 46.0.3`
  - `pillow 12.1.0`
- Pinned dependency versions in source:
  - `config/requirements.txt`: `cryptography==46.0.5`, `pillow==12.1.1`
- Code scan highlights:
  - CSRF exemptions still present by design for auth recovery/login/register flows and events blueprint.
  - Legacy `target="_blank"` links in `src/static/index-legacy.html` were hardened with `rel="noopener noreferrer"`.
  - Verification email subject no longer includes recipient email.

## Comparison to prior plan claims

Corrected from previous over-claims:
- Dependency versions were reported as `cryptography 46.0.5` / `pillow 12.1.1`; current environment is `46.0.3` / `12.1.0`.
- "All sensitive state-changing endpoints require CSRF" is not accurate; exemptions remain for selected endpoints.
- Registration conflict handling is intentionally non-enumerating and returns generic success-style messaging (`200`).

## Implemented items (confirmed)

- 1.1 Auth error leakage hardening: done.
- 1.2 Frontend XSS sink hardening (priority files): done.
- 1.3 Path traversal contract issue: done.
- 2.1 API key test endpoint rate limits: done.
- 2.2 Lockout degraded-mode hardening: done.
- 2.3 Demo reset endpoint restricted and password removed from response: done.
- 2.4 CSV formula injection mitigation: done.
- 2.6 AI parse-failure log redaction: done.
- 2.8 `target="_blank"` `rel` hardening in active module set: done.
- 2.9 Registration anti-enumeration: done.
- 3.1 Selective backup filename/path containment: done.
- 3.2 `create_app` config fallback for unknown config key: done.
- 3.3 Structured logging replacement in scoped modules: done.
- 3.4 Backup import validation hardening: done.
- 4.1 CI dependency-audit workflow added: done (`.github/workflows/dependency-audit.yml`).

## Remaining tasks (not fully implemented/fixed)

### R1. Dependency scan results + package upgrade execution

- Status: `In progress (pins updated), blocked on audit execution`
- Gap:
  - CI workflow exists, but vulnerability findings were not yet captured from a successful networked run in this environment.
  - Local `pip-audit` execution was blocked by network constraints in this environment.
- Actions:
  - Run GitHub Actions workflow `Dependency Audit` and collect findings.
  - (Completed) Upgrade/pin baseline dependencies in `config/requirements.txt`.
  - Apply any additional upgrades identified by audit output.
  - Re-run security and regression tests after upgrades.
- Validation gate:
  - `Dependency Audit` workflow passes with zero known vulnerabilities.
  - `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py`
  - Blocker evidence:
    - `gh run list --workflow dependency-audit.yml --limit 5` -> `error connecting to api.github.com`
    - `venv/bin/pip install pip-audit` -> package index unreachable in this environment.

### R2. Remove remaining recipient PII leakage in email logging metadata

- Status: `Done (2026-02-13)`
- Gap:
  - Verification email subject includes raw email (`"Verification Code for {email}"`) and subject is logged to `sent_emails.log`.
- Files:
  - `src/services/email_service.py`
- Actions:
  - Change subject to non-PII form (for example: `"RPS Account Verification"`).
  - Keep existing redaction strategy for address/token fields.
- Validation gate:
  - Log output no longer includes raw email in subject/content metadata.
  - Implemented: verification subject now uses non-PII value (`RPS Account Verification`).

### R3. CSRF exemption minimization follow-up (tightening pass)

- Status: `Done (2026-02-13)`
- Gap:
  - Exemptions remain in both route decorators and extension-level config.
  - Events blueprint relies on origin/referer compensating checks; policy should be explicitly finalized and tested.
- Files:
  - `src/extensions.py`
  - `src/auth/routes.py`
  - `src/routes/events.py`
- Actions:
  - Decide and document final CSRF policy per endpoint class.
  - Remove redundant dual-exemption declarations.
  - Add explicit tests for expected CSRF behavior (allowed vs rejected requests).
- Validation gate:
  - CSRF policy tests pass for login/register/reset/logout/events routes.
  - Implemented:
    - Removed duplicate CSRF exemptions from `src/extensions.py`; route decorators are now the single policy source.
    - Added explicit tests in `tests/test_security_csrf_policy.py`.
    - Test results:
      - `venv/bin/pytest -q tests/test_security_csrf_policy.py` -> `4 passed`
      - `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py` -> `15 passed`

### R4. Legacy UI reverse-tabnabbing cleanup

- Status: `Done (2026-02-13)`
- Gap:
  - `target="_blank"` without `rel="noopener noreferrer"` remains in legacy file.
- File:
  - `src/static/index-legacy.html`
- Actions:
  - Add `rel="noopener noreferrer"` for all legacy anchors using `target="_blank"`.
- Validation gate:
  - `rg -n "target=\"_blank\"(?![^\n]*rel=)" -P src/static/js src/static/*.html` returns no hits.
  - Current scan result: only one hit remains in active code (`src/static/js/components/learn/learn-tab.js`) where `rel` is already present on the following line; no true missing-`rel` findings in scanned files.

## Execution order (remaining)

1. R1 (requires network-enabled CI run and/or environment with package-index access)

## Exit criteria for closure

- Remaining task R1 is completed.
- Dependency audit workflow is green and findings are remediated.
- No residual PII/token leakage in email logs.
- CSRF policy is explicit, minimal, and test-covered.
- No `target="_blank"` links without `rel` in active or legacy frontend files.
