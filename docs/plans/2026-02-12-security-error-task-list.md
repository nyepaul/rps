# Security and Error Master Task List (Vetted 2026-02-13)

Re-verified against current code state and updated after Phase 6 implementation work.

## Verification Snapshot

- Latest known security regression result: `37 passed` (guard + auth/csrf/security suites).
- Auth error masking remains in place:
  - `src/auth/routes.py:1544`
  - `src/auth/routes.py:1545`
- CSRF exemption policy tests remain present:
  - `tests/test_security_csrf_policy.py:77`
  - `tests/test_security_csrf_policy.py:87`
- Runtime `print()` calls in core logger paths checked:
  - `src/database/audit_logger.py` -> none
  - `src/services/audit_narrative_generator.py` -> none
- Frontend error-message sink guard exists:
  - `tests/test_frontend_innerhtml_guard.py`

## Code-vs-Plan Result

### Closed items (verified)

1. Auth client error sanitization: closed.
2. Error/status `innerHTML` hardening phase: closed for direct runtime/server error interpolation class.
3. `_blank`/`rel` hardening from prior plan: closed in active modules.
4. Runtime `print()` removal in application logger paths: closed.

### Remaining gap (not yet closed)

1. None in the previously open Phase 6 scope.

Implementation notes:
- User-derived string interpolation in `innerHTML` template sinks was hardened in:
  - `src/static/js/components/income/income-tab.js`
  - `src/static/js/components/budget/budget-tab.js`
  - `src/static/js/components/profile/profile-tab.js`
- `src/static/js/components/financial-data/financial-data-tab.js` remained in scope and was re-reviewed as safe-static content (no user-provided interpolation).

## Phase 6 Plan (Status: Implemented)

### 6.1 Scope Freeze and Classification

1. Build file-level sink inventory for:
   - `src/static/js/components/income/income-tab.js`
   - `src/static/js/components/budget/budget-tab.js`
   - `src/static/js/components/financial-data/financial-data-tab.js`
   - `src/static/js/components/profile/profile-tab.js`
2. Classify each interpolation as:
   - `safe-static`
   - `safe-escaped`
   - `unsafe-unescaped`

### 6.2 Remediation Order

1. P0: inline edit forms and modals where `value="${...}"` is built with `innerHTML`.
2. P1: list/table row renderers showing names/descriptions/categories.
3. P2: secondary display-only sections and confirmation/summary modals.

### 6.3 Implementation Standard

1. Prefer DOM construction (`createElement`, `.textContent`, `.setAttribute`) for user data.
2. If template literals are retained, require explicit escaping helper for every dynamic user field.
3. Avoid mixed trusted/untrusted interpolation in one template block.

### 6.4 Guardrail Expansion

1. Extend `tests/test_frontend_innerhtml_guard.py` beyond runtime error strings to include user-data tokens in `innerHTML` templates (for example: `stream.`, `item.`, `expense.`, `profile.`, `asset.`, `group.`).
2. Add allowlist mechanism for reviewed safe-only cases to keep CI actionable.

### 6.5 Exit Criteria

1. No unescaped user-provided fields interpolated into `innerHTML` templates in phase-6 scope files. `Done`
2. Guard test passes with expanded patterns. `Done`
3. Security regression suite remains green. `Pending full regression rerun in TBPD step`

## Execution Readiness

- Phase 6 plan implementation is complete in code.
- Remaining operational steps: TBPD (`test`, `bump`, `push`, `deploy`) and post-deploy verification.
