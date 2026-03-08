# SOTA App Scan Report: UX & Security
**Date:** January 29, 2026
**Scanner:** Gemini CLI (Static Analysis & Expert Review)
**Target:** Retirement & Wealth Planning System (RPS)

## 1. Executive Summary

A comprehensive static analysis and expert code review was performed using state-of-the-art methods (OSV database, pattern matching, accessibility heuristics).

*   **🛡️ Security Status:** **STRONG**. The application code is free of common high-risk patterns (SQLi, Command Injection via shell, Unsafe Eval). Dependencies are largely clean.
*   **👤 UX/A11y Status:** **GOOD**. Core forms follow best practices, but dynamic interfaces (e.g., "Children" management) lack accessibility attributes.
*   **🚀 Development Status:** Phase 1 of the "Hybrid CSV+AI Import" system is complete and verified.

---

## 2. Security Analysis

### 📦 Dependency Scan (OSV Database)
*   **Runtime Dependencies (`requirements.txt`):** ✅ **CLEAN**. No known vulnerabilities.
*   **Dev Dependencies (`requirements-dev.txt`):** ⚠️ **1 Medium Issue**.
    *   **Package:** `black` (Version 3.10.13)
    *   **Issue:** Regular expression DoS (ReDoS).
    *   **Impact:** **Low/None** for production. This is a development formatting tool and is not deployed to the runtime environment.
    *   **Recommendation:** Update to `black>=24.3.0` in `requirements-dev.txt`.

### 🛡️ Static Code Analysis (Application Logic)
*   **Dangerous Functions:**
    *   `eval()` / `exec()`: **0 instances** found in application code (excluding venv).
    *   `subprocess.run(shell=True)`: **0 instances** found.
    *   `subprocess` usage: Found in `src/routes/admin.py` and `email_service.py`. All instances use **safe list arguments** (e.g., `['systemctl', 'list-timers']`), preventing shell injection.
*   **Secrets:** Previous audit (Jan 28) confirmed no hardcoded secrets. This scan validates that state remains.

---

## 3. UX & Accessibility (A11y) Review

### ✅ Strengths
*   **Core Forms:** Login (`login.html`) and Profile (`profile-tab.js`) static fields use proper `<label for="...">` associations.
*   **Images:** Main logo uses `alt="RPS"`.
*   **Feedback:** The new CSV parser (`csv-parser.js`) implements **non-blocking validation**, returning both `items` and `warnings`, which is a superior UX pattern compared to failing on the first error.

### ⚠️ Gaps & Recommendations
*   **Dynamic Form Fields (Accessibility Violation):**
    *   **Location:** `src/static/js/components/profile/profile-tab.js` (Children section)
    *   **Issue:** Dynamic inputs for "Child Name" and "Birth Year" lack `id` attributes and associated `<label for="...">` tags.
    *   **Impact:** Screen readers cannot identify these fields; clicking labels does not focus inputs.
    *   **Fix:**
        ```javascript
        // Current
        <label>Name</label>
        <input type="text" name="child_${index}_name" ...>

        // Recommended
        <label for="child_${index}_name">Name</label>
        <input id="child_${index}_name" type="text" name="child_${index}_name" ...>
        ```

---

## 4. Implementation Status Check

*   **Current Feature:** Hybrid CSV+AI Import
*   **Status:** **Phase 1 Complete (Foundation)**.
    *   ✅ Unified `csv-parser.js` created and integrated.
    *   ✅ Unit tests created (`tests/test_csv_parser.html`).
    *   ✅ Duplication reduced.
*   **Next Steps:** Phase 2 (Unified Modal Component).

---

## 5. Action Plan

1.  **Quick Fix (UX):** Update `profile-tab.js` to add IDs and labels to dynamic child fields.
2.  **Maintenance:** `pip install --upgrade black` to clear the dev vulnerability.
3.  **Feature Work:** Proceed to Phase 2 of CSV Import (Unified Modal).
