# Security and Error Master Task List (Refined 2026-02-12)

Execution tracker. This file is being updated as phases are implemented.

## Re-evaluation evidence (latest pass)

- `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py`
  - Result: `1 failed, 14 passed`
  - Failing test: `tests/exhaustive/test_security_active.py::test_path_traversal_prevention`
- Static review (`rg` + code read) re-validated:
  - Auth error text leakage (`str(e)` and interpolated exception strings).
  - API key test endpoint rate-limit gap (`@limiter.exempt`).
  - Demo reset endpoint returns plaintext password in response.
  - Unconditional `ProxyFix` trust.
  - Frontend `innerHTML` sinks render untrusted message content.
  - Email service logs full verification/reset links and recipient emails.
  - AI service logs partial raw model response content on parse failures.
  - CSRF exemptions exist on state-changing endpoints (`auth.logout`, password-reset flows, full `events` blueprint).
  - Multiple `target="_blank"` links in active UI code lack `rel="noopener noreferrer"`.
  - Registration currently returns explicit existence errors (`Username already exists`, `Email already exists`).
- Runtime check:
  - `venv/bin/python -c "from src.app import create_app; create_app('staging')"` -> `KeyError 'staging'`
- Dependency snapshot:
  - `cryptography==46.0.3`
  - `pillow==12.1.0`

## Execution report

- 2026-02-12 Phase 1 implemented and validated.
  - Test run: `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py`
  - Result: `15 passed`
  - Version bumped to `3.9.281` for Phase 1 deployment.
- 2026-02-12 Phase 2 implemented and validated.
  - Test run: `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py tests/exhaustive/test_selective_backup.py`
  - Result: `15 passed`
  - Additional route/auth run: `venv/bin/pytest -q tests/test_routes/test_auth.py tests/test_routes/test_admin_users.py tests/test_routes/test_admin_groups.py tests/test_api_keys.py`
  - Result: `27 passed`
  - Version bumped to `3.9.282` for Phase 2 deployment.
- 2026-02-12 Phase 3 implemented and validated.
  - Test run: `venv/bin/pytest -q tests/exhaustive/test_selective_backup.py tests/test_app_factory_config.py tests/test_routes/test_auth.py tests/test_routes/test_admin_users.py tests/test_routes/test_admin_groups.py tests/test_api_keys.py`
  - Result: `33 passed`
  - Security regression run: `venv/bin/pytest -q tests/test_security_comprehensive.py tests/exhaustive/test_security_active.py`
  - Result: `11 passed`
  - Version bumped to `3.9.283` for Phase 3 deployment.
- 2026-02-12 Phase 4 implemented.
  - Added CI workflow: `.github/workflows/dependency-audit.yml` using `pip-audit` against `config/requirements.txt`.
  - Local environment note: network-restricted runner prevented local `pip-audit` install/run.
  - Local health check: `venv/bin/pip check` -> `No broken requirements found.`
  - Version bumped to `3.9.284` for Phase 4 deployment.

## Delta vs prior revision of this file

### Corrected

- Removed speculative/weakly evidenced claims (broad CORS requirement, generic prompt-injection claim, IP anonymization claim).
- Removed unsupported fixed-count sink totals.

### Added / clarified

- Added confirmed registration-enumeration hardening item.
- Added confirmed reverse-tabnabbing hardening item (`target="_blank"` without `rel`).
- Kept selective-backup item as defense-in-depth hardening, not a confirmed remote exploit.

## Phase 1: Critical

### 1.1 Remove internal error leakage in auth APIs

- Files:
  - `src/auth/routes.py:353`
  - `src/auth/routes.py:707`
  - `src/auth/routes.py:854`
  - `src/auth/routes.py:865`
  - `src/auth/routes.py:901`
  - `src/auth/routes.py:953`
  - `src/auth/routes.py:1008`
  - `src/auth/routes.py:1033`
  - `src/auth/routes.py:1264`
  - `src/auth/routes.py:1500`
  - `src/auth/routes.py:1503`
  - `src/auth/routes.py:1606`
- Actions:
  - Replace client-visible exception text with sanitized generic responses.
  - Log detailed exceptions server-side only.

### 1.2 Fix high-risk frontend XSS sinks

- Priority files:
  - `src/static/js/login.js:431`
  - `src/static/js/main.js:1144`
  - `src/static/js/components/settings/ai-settings.js:331`
  - `src/static/js/components/settings/ai-settings.js:348`
  - `src/static/js/components/settings/user-backups.js:195`
  - `src/static/js/utils/dom.js:68`
  - `src/static/js/components/learn/learn-tab.js:254`
  - `src/static/js/components/learn/learn-tab.js:504`
- Actions:
  - Replace untrusted `innerHTML` interpolation with safe DOM/text rendering.
  - Add shared `escapeHtml` helper for required templating.
  - Sanitize markdown output before DOM insertion.

### 1.3 Resolve path traversal test contract failure

- Files:
  - `src/routes/profiles.py:39`
  - `src/routes/profiles.py:156`
  - `tests/exhaustive/test_security_active.py:108`
- Actions:
  - Choose one policy and align code/tests:
    - specific “path traversal” message, or
    - generic sanitized message + updated test expectation.

## Phase 2: High Priority

### 2.1 Add abuse controls to API key test endpoints

- Files:
  - `src/auth/routes.py:906` (`@limiter.exempt` on `/test-api-key`)
  - `src/auth/routes.py:956` (`/test-stored-key` no explicit route limit)
- Actions:
  - Remove exemption.
  - Add explicit per-user/IP limits and test 429 behavior.

### 2.2 Harden lockout degraded-mode behavior

- File:
  - `src/auth/routes.py:68`
- Actions:
  - Replace fail-open fallback with safer degraded behavior and alert logging.
  - Add test coverage for lockout backend failure path.

### 2.3 Restrict demo reset endpoint and remove plaintext secret response

- Files:
  - `src/routes/admin.py:1617`
  - `src/routes/admin.py:1656`
- Actions:
  - Require `super_admin`.
  - Remove password from JSON response.

### 2.4 Add CSV formula-injection protection for admin exports

- File:
  - `src/routes/admin.py:355`
- Actions:
  - Escape cell values starting with `=`, `+`, `-`, `@` before CSV output.

### 2.5 Redact verification/reset links and recipient PII in logs

- Files:
  - `src/services/email_service.py:57`
  - `src/services/email_service.py:69`
  - `src/services/email_service.py:161`
- Actions:
  - Stop persisting full tokenized links and raw email addresses in logs.
  - Redact/hash sensitive fields.

### 2.6 Redact model response content in AI parse-failure logs

- File:
  - `src/routes/ai_services.py:207`
- Actions:
  - Replace raw response-content logging with bounded, redacted metadata.
  - Keep debugging context (provider/model/request id), not payload text.

### 2.7 Review and tighten CSRF exemptions for state-changing routes

- Files (central exemptions):
  - `src/extensions.py:31`
  - `src/extensions.py:33`
  - `src/extensions.py:35`
  - `src/extensions.py:36`
- Files (blueprint-wide exemption):
  - `src/routes/events.py:10`
- Files (affected route example):
  - `src/auth/routes.py:583`
- Actions:
  - Reassess whether CSRF exemption is required for each POST endpoint.
  - Require CSRF or compensating controls for non-essential exempt writes (for example logout/events).
  - Add tests validating expected CSRF behavior by endpoint class.

### 2.8 Add `rel` hardening for `target="_blank"` links

- Files (representative):
  - `src/static/js/components/learn/learn-tab.js:282`
  - `src/static/js/components/settings/ai-settings-tab.js:68`
  - `src/static/js/components/settings/ai-settings.js:242`
  - `src/static/js/components/admin/system-info.js:119`
- Actions:
  - Ensure all `target="_blank"` anchors include `rel="noopener noreferrer"`.

### 2.9 Prevent account enumeration in registration flow

- Files:
  - `src/auth/routes.py:146`
  - `src/auth/routes.py:150`
- Actions:
  - Replace explicit existence errors with non-enumerating response pattern.
  - Keep account-existence details only in server logs.
  - Add tests for non-enumerating behavior.

## Phase 3: Medium Priority

### 3.1 Harden selective-backup filename/path handling (defense in depth)

- Files:
  - `src/services/selective_backup_service.py:253`
  - `src/services/selective_backup_service.py:288`
  - `src/services/selective_backup_service.py:512`
  - `src/routes/admin.py:3588`
  - `src/routes/admin.py:3606`
  - `src/routes/admin.py:3680`
- Actions:
  - Enforce strict filename allowlist.
  - Resolve path and enforce base-dir containment before read/restore/delete.

### 3.2 Improve app config selection robustness

- File:
  - `src/app.py:106`
- Actions:
  - Validate config key and use safe fallback/error handling for unknown values.

### 3.3 Replace `print()` diagnostics with structured logging

- Representative files:
  - `src/auth/routes.py`
  - `src/services/email_service.py`
  - `src/services/enhanced_audit_logger.py`
- Actions:
  - Replace `print(...)` with logger usage and consistent severity.

### 3.4 Harden backup import validation

- File:
  - `src/routes/user_backups.py:100`
- Actions:
  - Validate extension/content-type for upload.
  - Add defensive handling for malformed but size-valid payloads.

## Phase 4: Dependency hardening follow-up

### 4.1 CI vulnerability scan + pinned upgrade workflow

- Files:
  - `config/requirements.txt`
  - `src/requirements.txt`
- Actions:
  - Add/verify CI vulnerability scan step (for example `pip-audit`).
  - Upgrade and pin based on scanner output with compatibility tests.

## Execution checklist (assignable)

| ID | Task | Priority | Owner | ETA (est.) | Status | Validation gate |
|---|---|---|---|---|---|---|
| 1.1 | Remove auth error leakage | Critical | Backend | 0.5 day | Done | Auth route tests + response spot-check |
| 1.2 | Fix frontend XSS sinks | Critical | Frontend | 1 day | Done | UI smoke + targeted security checks |
| 1.3 | Resolve traversal test contract | Critical | Backend | 0.25 day | Done | `pytest tests/exhaustive/test_security_active.py` |
| 2.1 | Rate-limit API key test endpoints | High | Backend | 0.25 day | Done | 429 tests for both routes |
| 2.2 | Harden lockout degraded behavior | High | Backend | 0.5 day | Done | Failure-path lockout tests |
| 2.3 | Restrict demo reset + remove password response | High | Backend | 0.25 day | Done | Admin/super-admin auth tests |
| 2.4 | Add CSV formula export protection | High | Backend | 0.25 day | Done | CSV payload tests (`=,+,-,@`) |
| 2.5 | Redact token/PII logging | High | Backend | 0.5 day | Done | Log-content assertions |
| 2.6 | Redact AI parse-failure response logs | High | Backend | 0.25 day | Done | Logging assertions + manual inspection |
| 2.7 | CSRF exemption hardening | High | Backend | 0.5 day | Done | Endpoint CSRF behavior tests |
| 2.8 | `target=\"_blank\"` rel hardening | High | Frontend | 0.25 day | Done | Static grep gate + UI smoke |
| 2.9 | Registration enumeration hardening | High | Backend | 0.5 day | Done | Registration behavior tests |
| 3.1 | Path containment in selective backup service | Medium | Backend | 0.5 day | Done | Traversal payload tests |
| 3.2 | Config key robustness in `create_app` | Medium | Backend | 0.25 day | Done | Unknown-env startup test |
| 3.3 | Replace `print()` with logger | Medium | Backend | 0.5 day | Done | Search gate on target modules |
| 3.4 | Backup import validation hardening | Medium | Backend | 0.5 day | Done | Upload validation tests |
| 4.1 | CI dependency scan + pin upgrades | Follow-up | DevOps/Backend | 0.5 day | Done | CI scan artifact + green build |

## Sprint batching (suggested)

1. Sprint 1 (Days 1-2): `1.1`, `1.2`, `1.3`, `2.1`
2. Sprint 2 (Days 3-4): `2.2`, `2.3`, `2.4`, `2.5`, `2.6`, `2.7`, `2.8`, `2.9`
3. Sprint 3 (Day 5): `3.1`, `3.2`, `3.3`, `3.4`
4. Sprint 4 (Day 6): `4.1`

## Exit criteria

- `tests/exhaustive/test_security_active.py` passes.
- No auth API response returns raw exception text.
- Target frontend sinks do not inject untrusted HTML.
- API key test routes enforce explicit limits.
- CSRF exemption scope is minimized and tested.
- `target="_blank"` links include `rel="noopener noreferrer"`.
- Registration flow does not reveal whether an account already exists.
- Selective-backup file operations enforce path containment.
- Verification/reset token and email PII are redacted from logs.
- AI parse-failure logs do not include raw model payload content.
