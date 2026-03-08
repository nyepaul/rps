# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all production-readiness issues: duplicate code, replace print() with logger, sanitize error responses, clean up dead JS code, add JS null-safety guards.

**Architecture:** Mechanical fixes across route files (print→logger, str(e)→generic message), one JS dead-code cleanup, and defensive null checks in 4 JS files. No new features or architectural changes.

**Tech Stack:** Python/Flask (current_app.logger), vanilla JS (optional chaining)

---

## Task 1: Fix duplicate line in analysis.py

**Files:**
- Modify: `src/routes/analysis.py:642-644`

**Step 1: Remove duplicate lines**

Change lines 642-644 from:
```python
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
```
To:
```python
        tax_year = int(tax_settings.get("tax_year") or datetime.now().year)
```

**Step 2: Run tests**

Run: `pytest tests/test_routes/test_analysis.py -v`
Expected: All PASS

**Step 3: Commit**
```bash
git add src/routes/analysis.py
git commit -m "fix: remove duplicate tax_year assignment in analysis route"
```

---

## Task 2: Clean up dead code in main.js resolveInitialTab()

**Files:**
- Modify: `src/static/js/main.js:125-136`

**Step 1: Simplify resolveInitialTab()**

Replace:
```javascript
function resolveInitialTab() {
    // Keep restore inputs wired for navigation consistency checks,
    // but force landing on Welcome as the initial app entry.
    const hashTab = sanitizeTabName(window.location.hash.replace('#', ''));
    const historyTab = sanitizeTabName(window.history.state?.tab);
    const lastTab = sanitizeTabName(localStorage.getItem(STORAGE_KEYS.LAST_TAB));
    void hashTab;
    void historyTab;
    void lastTab;

    return 'welcome';
}
```
With:
```javascript
function resolveInitialTab() {
    // Always land on Welcome as the initial app entry.
    return 'welcome';
}
```

**Step 2: Run navigation test**

Run: `pytest tests/test_navigation_map.py -v`
Expected: All PASS

**Step 3: Commit**
```bash
git add src/static/js/main.js
git commit -m "fix: remove dead code in resolveInitialTab"
```

---

## Task 3: Add null-safety guards in login.js

**Files:**
- Modify: `src/static/js/login.js:64-102`

**Step 1: Cache h1 element and guard all assignments**

At the top of the switchMode function (before the if/else chain), add:
```javascript
const heading = document.querySelector('h1');
```

Then replace all 5 instances of:
```javascript
document.querySelector('h1').textContent = "...";
```
With:
```javascript
if (heading) heading.textContent = "...";
```

**Step 2: Manual browser test**

Load /login.html, switch between Login/Register/Reset modes. Verify headings update.

**Step 3: Commit**
```bash
git add src/static/js/login.js
git commit -m "fix: add null-safety guard for h1 element in login page"
```

---

## Task 4: Add null-safety guards in main.js settings modal

**Files:**
- Modify: `src/static/js/main.js:1050-1054` (market profile)
- Modify: `src/static/js/main.js:1110-1113` (password inputs)

**Step 1: Guard market profile description**

Replace lines 1050-1054:
```javascript
    // Update market profile description on change
    modal.querySelector('#market-profile-setting').addEventListener('change', (e) => {
        const profile = APP_CONFIG.MARKET_PROFILES[e.target.value];
        modal.querySelector('#market-profile-description').textContent = profile.description;
    });
```
With:
```javascript
    // Update market profile description on change
    const marketProfileSetting = modal.querySelector('#market-profile-setting');
    if (marketProfileSetting) {
        marketProfileSetting.addEventListener('change', (e) => {
            const profile = APP_CONFIG.MARKET_PROFILES[e.target.value];
            const descEl = modal.querySelector('#market-profile-description');
            if (descEl && profile) descEl.textContent = profile.description;
        });
    }
```

**Step 2: Guard password input reads**

Replace lines 1110-1113:
```javascript
            const currentPassword = modal.querySelector('#current-password-input').value;
            const newPassword = modal.querySelector('#new-password-input').value;
            const confirmPassword = modal.querySelector('#confirm-password-input').value;
            const messageDiv = modal.querySelector('#change-password-message');
```
With:
```javascript
            const currentPassword = modal.querySelector('#current-password-input')?.value;
            const newPassword = modal.querySelector('#new-password-input')?.value;
            const confirmPassword = modal.querySelector('#confirm-password-input')?.value;
            const messageDiv = modal.querySelector('#change-password-message');
```

**Step 3: Run navigation test**

Run: `pytest tests/test_navigation_map.py -v`
Expected: All PASS

**Step 4: Commit**
```bash
git add src/static/js/main.js
git commit -m "fix: add null-safety guards in settings modal"
```

---

## Task 5: Add null-safety helper in home-tab.js

**Files:**
- Modify: `src/static/js/components/home/home-tab.js:162-189`

**Step 1: Add a safe-set helper and use it**

Add a local helper before populateHomeForm:
```javascript
function _setVal(container, selector, value) {
    const el = container.querySelector(selector);
    if (el) el.value = value;
}
function _setChecked(container, selector, value) {
    const el = container.querySelector(selector);
    if (el) el.checked = value;
}
```

Then rewrite populateHomeForm to use it for all assignments.

**Step 2: Run tests**

Run: `pytest tests/ -k "home" -v`
Expected: All PASS (or no home-specific tests, which is fine)

**Step 3: Commit**
```bash
git add src/static/js/components/home/home-tab.js
git commit -m "fix: add null-safety guards in home form population"
```

---

## Task 6: Add null-safety helper in profile-tab.js

**Files:**
- Modify: `src/static/js/components/profile/profile-tab.js:40-97`

**Step 1: Add same safe-set helper and use it**

Same pattern as Task 5. Add local helper, then guard all querySelector().value and querySelector().textContent assignments.

**Step 2: Commit**
```bash
git add src/static/js/components/profile/profile-tab.js
git commit -m "fix: add null-safety guards in profile form population"
```

---

## Task 7: Replace print() with logger and sanitize errors — events.py

**Files:**
- Modify: `src/routes/events.py`

**Step 1: Add current_app import**

Add `current_app` to the flask import line.

**Step 2: Replace all print() with current_app.logger.error()**

Replace pattern:
```python
print(f"Click logging error: {e}")
```
With:
```python
current_app.logger.error(f"Click logging error: {e}")
```

Do this for all 6 print() calls in the file.

**Step 3: Run tests**

Run: `pytest tests/ -v -k "event" --tb=short`
Expected: All PASS

**Step 4: Commit**
```bash
git add src/routes/events.py
git commit -m "fix: replace print() with logger in events route"
```

---

## Task 8: Replace print() with logger and sanitize errors — budget.py

**Files:**
- Modify: `src/routes/budget.py`

**Step 1: Add current_app import, replace print(), sanitize str(e)**

**Step 2: Run tests, commit**

---

## Task 9: Replace print() with logger and sanitize errors — feedback.py

**Files:**
- Modify: `src/routes/feedback.py`

16 print() calls + str(e) exposures. Same pattern as Task 7.

---

## Task 10: Replace print() with logger and sanitize errors — ai_services.py

**Files:**
- Modify: `src/routes/ai_services.py`

18 print() calls. Some are info-level (PDF processing), some are error-level. Use appropriate log levels:
- `current_app.logger.info()` for success messages (extracted text chunks, model attempts)
- `current_app.logger.warning()` for parse failures
- `current_app.logger.error()` for actual errors

---

## Task 11: Replace print() with logger and sanitize errors — admin.py

**Files:**
- Modify: `src/routes/admin.py`

30 print() calls + 47 str(e) exposures. Largest file. current_app already imported.

For all `return jsonify({"error": str(e)}), 500` change to:
```python
current_app.logger.error(f"<context>: {e}")
return jsonify({"error": "An internal error occurred"}), 500
```

Keep descriptive context in logger but return generic message to client.

---

## Task 12: Replace print() with logger and sanitize errors — remaining route files

**Files:** (one print + some str(e) each)
- `src/routes/user_backups.py`
- `src/routes/fingerprint.py`
- `src/routes/action_items.py`
- `src/routes/profiles.py`
- `src/routes/scenarios.py`
- `src/routes/roadmap.py`
- `src/routes/reports.py`
- `src/routes/tax_optimization.py`
- `src/routes/home_ownership.py`
- `src/routes/analysis.py`
- `src/routes/sitemap.py`
- `src/routes/skills.py`

Same pattern: add `current_app` import if missing, replace print→logger, sanitize str(e)→generic message.

---

## Task 13: Run full test suite

**Step 1: Run all tests**

Run: `pytest tests/ -v --tb=short`
Expected: 403+ passed, 0 failed

**Step 2: Verify no print() remains in routes**

Run: `grep -rn "^\s*print(" src/routes/`
Expected: No output

**Step 3: Verify no str(e) exposure remains**

Run: `grep -rn '"error".*str(e)' src/routes/`
Expected: No output (only audit log details fields should remain)

---

## Task 14: Bump version and commit

**Step 1: Bump version**
```bash
./bin/bump-version 3.10.13 "Production hardening: logging, error sanitization, null-safety"
```

**Step 2: Final commit with all remaining changes**
