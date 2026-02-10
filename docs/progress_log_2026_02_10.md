# RPS Fix Progress Log
Date: 2026-02-10

## Scope
- P0/P1 fixes for security, accuracy, and logic correctness
- Align with docs/reviews/audit_report_2026_02.md
- Add tests and run validation

## Status
- [x] Baseline notes captured
- [x] Demo bypass removed and demo flag implemented
- [x] Backup restore SQL injection risk eliminated
- [x] Tax engine centralized and constants externalized
- [x] Test-only endpoints removed in production paths
- [x] CSRF/auth posture tightened
- [x] Tests executed and results recorded

## Notes
- Start: 2026-02-10

## Progress Updates
- Completed: Added progress log and initial baseline.
- Completed: Added is_demo_account migration + removed demo encryption bypass; demo accounts now encrypted.
- Completed: Hardened backup import/restore with schema allowlist and sanitization.
- Completed: Centralized tax policy in `config/tax_policy.json` and refactored tax engine + retirement model + tax optimization service to use policy.
- Completed: Removed test-only minimal response in production path (now testing-only).
- Completed: Enforced CSRF for API routes (auth endpoints remain exempt).
- Completed: Enforced explicit encryption keys (no silent defaults) for production.
- Completed: Fixed RMD projection route tax_year handling + years pass-through.
- Completed: Cleaned duplicate tax_settings/tax_year logic in tax optimization routes.
- Tests: `./venv/bin/python -m pytest -q` -> 351 passed, 1 skipped, 388 warnings (2026-02-10).
- In Progress: Resolving migration chain conflicts (users table duplication, branch heads, incorrect down_revision).
  - Updated `migrations/versions/4ad7500c3cce_add_users_table.py` to no-op users table creation (indexes only).
  - Aligned `migrations/versions/9c4b1a2d7e11_add_is_demo_account.py` down_revision to `ff7c33cb22bb`.
  - Cleaned `migrations/versions/5a368c84f95e_add_password_reset_requests.py` down_revision/commentary.
  - Fixed migration ordering issues around profile/profiles tables.
  - Verified `alembic upgrade head` succeeds on a clean DB (2026-02-10).
- In Progress: Fixing CSRF for SPA analysis requests (add `/api/csrf`, client token fetch).
