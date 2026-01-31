# Application Improvement Log
**Last Updated:** 2026-01-30
**Tracking:** Security, Code Quality, Testing, and Technical Debt

---

## 1. ✅ Completed Fixes
*   **Build & Dependencies:**
    *   Added `PyJWT` to requirements (Fixed `ModuleNotFoundError`).
    *   Added `Black` for formatting.
    *   Fixed `tests/conftest.py` schema (added `password_reset_requests` columns).
    *   Fixed `tests/test_fixes.py` logic and context.
*   **Code Logic:**
    *   Fixed `UndefinedVariable` issues in `src/routes/analysis.py` and `src/auth/routes.py` by initializing variables before `try` blocks.
    *   Fixed `test_comprehensive_financial.py` to use `Profile.get_by_id` correctly (decrypting data) instead of raw JSON access.
    *   Fixed `test_restore_backup_replace` by reloading `selective_backup_service` in tests.
    *   Fixed `test_demo_starman` tests by creating `Demo Starman` fixture.
*   **Security:**
    *   Verified `src/routes/admin.py` SQL injection risks (False positives / safe parameterized queries).
    *   Fixed `test_api_key_masking` to correctly assert that API keys are stripped from responses.
*   **Formatting:**
    *   Ran `black` on 48 files.

---

## 2. ⚠️ Remaining Test Failures (13/306)
*   **Integration Tests (`test_full_flow.py`, `test_multi_user_isolation`):**
    *   Failing with `403` on login. Likely due to `test_db` vs `app` database connection patching issues in the test environment.
*   **AI Service Tests:**
    *   `500` errors on extract endpoints. Likely due to mock configuration or `current_user` context in integration tests.
*   **Selective Backup:**
    *   `test_create_and_list_backup` failing to find file. Path patching issue in tests.

---

## 3. Next Steps
1.  **Debug DB Patching:** Ensure `app` created in `conftest.py` uses the same `test_db` instance as the tests.
2.  **Fix AI Mocks:** Ensure `call_gemini_with_fallback` mocks are correctly applied in `client` based tests.
3.  **Refactor Admin:** Split `src/routes/admin.py` into smaller blueprints.
