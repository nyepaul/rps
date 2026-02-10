# Comprehensive System Audit Report - RPS
**Date:** February 10, 2026
**Auditor:** Gemini AI

## 1. Executive Summary
The Retirement & Wealth Planning System (RPS) demonstrates a solid foundation in cryptographic architecture and user authentication but suffers from **critical architectural fragility** in its core financial logic and database schema management.

While the "Security First" implementation of per-user encryption keys (DEK/KEK) is commendable, the application is currently relying on hardcoded financial constants (tax brackets, contribution limits) that are outdated or will become outdated rapidly, risking the accuracy of all projections.

## 2. Critical Findings (Priority P0)

### 2.1. Monolithic Financial Logic
*   **Issue:** `src/services/retirement_model.py` (>2400 lines) contains embedded, hardcoded tax logic (`_vectorized_federal_tax`, etc.) and contribution limits for 2024.
*   **Risk:** Extremely high. Any change to tax law requires modifying the core simulation engine, risking regression bugs in the Monte Carlo simulation itself.
*   **Evidence:** `src/services/retirement_model.py` lines 100-250.

### 2.2. Migration Chain Conflict
*   **Issue:** Two separate migration files attempt to create the `users` table:
    *   `ab8f12a95a89` (2026-01-13)
    *   `4ad7500c3cce` (2026-01-14)
*   **Risk:** High. Database state is ambiguous. Deployments might fail or result in inconsistent schemas depending on which migration history was followed.
*   **Evidence:** `migrations/versions/`.

### 2.3. "Demo" User Security Bypass
*   **Issue:** The `Profile.save()` method explicitly disables encryption for any user named "demo".
*   **Risk:** Medium/High. If a malicious actor registers the username "demo", their data is stored in plain text. More importantly, if this logic is pervasive, it creates a "magic string" vulnerability path throughout the system.
*   **Evidence:** `src/models/profile.py`: `if self._is_demo_user(): ... json.dumps(...)`.

### 2.4. Insecure Defaults in Configuration
*   **Issue:** `src/config.py` falls back to `dev-secret-key-change-in-production` if environment variables are missing.
*   **Risk:** High (if deployed without strict env checks). While `ProductionConfig` checks for `ENCRYPTION_KEY`, it doesn't strictly enforce `SECRET_KEY` rotation as robustly as it should.

## 3. Recommended Action Items

### Phase 1: Immediate Stabilization (Day 1-2)
1.  **Refactor Tax Engine:**
    *   Move all tax logic from `RetirementModel` to the newly drafted `src/services/tax_engine_refactor.py`.
    *   Update `RetirementModel` to inject `TaxEngine` as a dependency.
2.  **Fix Migrations:**
    *   Merge `ab8f12a95a89` and `4ad7500c3cce` into a single, linear history.
    *   Ensure `alembic.ini` points to the correct version table.
3.  **Secure Config:**
    *   Update `config.py` to `raise ValueError` in Production mode if `SECRET_KEY` is default.

### Phase 2: Logic & Quality (Day 3-5)
1.  **Parameterize Constants:**
    *   Move `CONTRIBUTION_LIMITS` and `FEDERAL_BRACKETS` to a configuration file or database table (e.g., `system_config` table created in `create_system_config.sql`).
2.  **Remove "Demo" Bypass:**
    *   Remove the hardcoded "demo" check. If a demo user is needed, implement it as a flag on the `User` model (`is_demo_account`) rather than checking the username string.

### Phase 3: Testing
1.  **Refactor Tests:**
    *   Update `tests/test_tax_engine.py` to test the new `TaxEngine` class directly, rather than the private methods of `RetirementModel`.

## 4. Conclusion
The app is **not yet ready for critical reliance** due to the monolithic nature of the financial model. However, the security architecture for data protection is better than industry average for this class of application. Implementing the "Tax Engine" refactor is the single most important step to ensuring accuracy.
