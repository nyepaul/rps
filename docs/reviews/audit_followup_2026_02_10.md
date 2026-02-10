# Audit Follow-up Report - RPS
Date: 2026-02-10

## Summary
- Full test suite executed: 351 passed, 1 skipped, 388 warnings.
- Critical tax policy hardcoding removed and centralized in `config/tax_policy.json`.
- Demo account encryption bypass removed; demo handling now uses `is_demo_account` flag.
- Backup import/restore hardened to prevent unsafe schema writes.
- CSRF enforcement tightened; auth endpoints remain intentionally exempt.
- Migration chain conflict resolved and verified on a clean database.

## Test Results
- Command: `./venv/bin/python -m pytest -q`
- Result: 351 passed, 1 skipped, 388 warnings

## Key Fixes Completed
- Refactored tax/retirement logic to use centralized `TaxPolicy` + `TaxEngine`.
- Added and migrated `is_demo_account` flag; removed plaintext demo bypass.
- Enforced production encryption key requirements.
- Hardened user backup import/restore with table/column allowlist.
- Fixed tax optimization RMD projection route and passed-through projection years.
- Resolved migration chain conflicts and validated `alembic upgrade head` on a clean DB.

## Outstanding Risks / Action Items
P1 (High):
- Add current-year tax policy data (2025/2026) to `config/tax_policy.json` or explicit versioning plan for annual updates.
- Remove remaining deprecation warnings by replacing `datetime.utcnow()` with timezone-aware UTC now.

P2 (Medium):
- Migrate Pydantic v1 `@validator` to v2 `@field_validator` to avoid future breakage.
- Fix tests returning values instead of asserting (PytestReturnNotNone warnings in `tests/test_api_keys.py`).
- Investigate `RuntimeWarning: invalid value encountered in divide` in `src/services/retirement_model.py` to avoid NaN propagation.
- Address PDF chart warning in `src/services/pdf/charts.py` (missing labeled artists).

## Comparison to `docs/reviews/audit_report_2026_02.md`
- Monolithic Financial Logic:
  - Status: Addressed. Tax policy externalized and injected into tax engine + retirement model.
- Migration Chain Conflict:
  - Status: Addressed. Single head, linear history, clean upgrade verified.
- Demo User Security Bypass:
  - Status: Addressed. `is_demo_account` flag + encryption enforced.
- Insecure Defaults in Configuration:
  - Status: Partially addressed. Production requires ENCRYPTION_KEY; SECRET_KEY enforcement exists but should be re-verified in deployment pipeline.

## Notes
- Warnings remain but do not currently fail tests. They should be resolved to ensure long-term stability.
