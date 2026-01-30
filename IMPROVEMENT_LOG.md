# Application Improvement Log
**Last Updated:** 2026-01-30
**Tracking:** Security, Code Quality, and Technical Debt

---

## 1. Security (Bandit Scan)
**Severity: HIGH**
*   **[B201] Flask Debug Mode:** `src/app.py:370` - App runs with `debug=True`.
    *   *Action:* Ensure this is conditional on environment variables (e.g., `FLASK_ENV=development`).
*   **[B104] Hardcoded Bind:** `src/app.py:370` - App binds to `0.0.0.0`.
    *   *Action:* Make host configurable via env var.

**Severity: MEDIUM**
*   **[B105] Hardcoded Passwords:** Found potential hardcoded secrets in `src/routes/admin.py` ('Demo1234') and `src/auth/models.py`.
    *   *Action:* Review `src/routes/admin.py` lines 1398, 1554, 1615. Verify they are test/demo credentials and not production secrets. Move to env vars if sensitive.
*   **[B608] SQL Injection Risks:** Hardcoded SQL strings detected in `src/routes/admin.py` (lines 2426, 2457, 2475) and `src/routes/feedback.py` (lines 424, 889).
    *   *Action:* Review query construction. Ensure parameters are passed separately to `execute()`.

**Severity: LOW**
*   **[B603/B607] Subprocess Calls:** Multiple instances in `src/routes/admin.py`.
    *   *Action:* Verify all inputs to `subprocess.run` are sanitized.

---

## 2. Code Quality - Python (Flake8)
**Summary:** ~10,000 issues found. Most are style/formatting.

**Top Issues:**
*   **E501 (Line too long):** Widespread. Code readability issue.
    *   *Action:* Run `black` formatter to auto-fix.
*   **W291/W293 (Trailing whitespace):** Widespread.
    *   *Action:* Run `black` or `autopep8` to strip.
*   **F401 (Unused Imports):**
    *   `src/auth/models.py`: `secrets`
    *   `src/auth/routes.py`: `typing.Optional`, `request`, `jsonify`, `session`, `login_user`... (many redefinitions).
    *   *Action:* Clean up imports. Remove unused variables.
*   **E722 (Bare except):** `src/auth/routes.py` (lines 957, 969) and others.
    *   *Action:* Replace `except:` with `except Exception:` or specific exceptions.
*   **E712 (Comparison to False):** `if data.is_admin == False:` should be `if not data.is_admin:`.

---

## 3. Code Quality - JavaScript (ESLint)
**Summary:** 137 Warnings (0 Errors after config fix).

**Key Issues:**
*   **Unused Variables (`no-unused-vars`):**
    *   `apiClient` in `assets.js`, `income-tab.js`, `advisor-tab.js`.
    *   `error` in multiple try/catch blocks (e.g., `settings/ai-settings.js`).
    *   `Chart` / `L` (Leaflet) usage flagged as undefined (fixed in config, but indicates reliance on globals).
*   **Undefined Globals:** `TextDecoder`, `TextEncoder` in API clients.
    *   *Action:* Ensure polyfills exist or target environment supports them.

---

## 4. Dependencies (OSV Scan)
*   **Status:** ✅ Clean.
*   **Notes:** `black` was updated to >=24.3.0 to resolve a ReDoS vulnerability.

---

## 5. Next Steps Plan
1.  **Auto-Format:** Run `black .` on the `src/` directory to fix thousands of E501/W291/W293 issues instantly.
2.  **Fix Security Highs:** Modify `src/app.py` to toggle debug mode based on `os.environ`.
3.  **Refactor Admin SQL:** Review dynamic SQL in `src/routes/admin.py` for injection risks.
4.  **Cleanup Imports:** Remove unused imports identified by Flake8 (F401).
5.  **JS Cleanup:** Remove unused variables in JS files to reduce noise.
