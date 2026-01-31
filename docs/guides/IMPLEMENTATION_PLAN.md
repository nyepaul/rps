# Implementation Plan: UX & Visualization Upgrades

**Date**: 2026-01-23
**Based on**: `docs/UX_ASSESSMENT_AND_RECOMMENDATIONS.md`
**Status**: DRAFT

## 1. Critique & Assessment of Recommendations

The UX Assessment provided is **highly accurate** and correctly identifies the "Transparency Gap" as the critical flaw in an otherwise robust application.

### ✅ Validated Findings
*   **Tax Visibility**: The assessment correctly notes that while the backend calculates taxes precisely (including IRMAA, LTCG stacking, and FICA), the frontend lumps them into generic "Expenses". This hides the "tax drag" and makes the tool less useful for tax planning.
*   **Data Entry Friction**: The lack of inline validation and smart defaults increases the risk of user error (e.g., entering a retirement date before birth date).
*   **Navigation**: The 13-tab interface is overwhelming and lacks logical grouping.

### 🔄 Technical Refinements
*   **Session Storage**: The recommendation to use Redis for session storage is **rejected** for the current local-first architecture. It introduces unnecessary infrastructure dependencies. We will instead enforce strict `Secure`, `HttpOnly`, and `SameSite` cookie flags to maintain security without the complexity.
*   **Onboarding Scope**: The proposed "5-step Wizard" is too large for a single phase. We will decouple the "Smart Defaults" (which help immediately) from the full UI Wizard.

## 2. Implementation Roadmap

We will execute this plan in **three phases**, prioritizing immediate value (Transparency) and safety (Validation) before moving to polish.

### 🛒 Phase 1: Transparency & Visualization (High Value)
**Goal**: Reveal the sophisticated "financial brain" of the application by visualizing the tax layer.

1.  **Backend: Deterministic Projection Engine**
    *   *Task*: Implement `RetirementModel.run_detailed_projection()` in `src/services/retirement_model.py`.
    *   *Logic*: Unlike the stochastic Monte Carlo (which runs 10k times), this will run **one** deterministic path using "Expected Return" assumptions.
    *   *Output*: Return a precise year-by-year ledger of:
        *   `gross_income`
        *   `federal_tax_paid`
        *   `state_tax_paid`
        *   `fica_tax_paid`
        *   `net_living_expenses`
        *   `rmd_withdrawals`

2.  **API: New Endpoint**
    *   *Task*: Add `/api/analysis/cashflow-details` to `src/routes/analysis.py`.
    *   *Output*: JSON structure matching the new detailed ledger.

3.  **Frontend: Stacked Cashflow Chart**
    *   *Task*: Update `src/static/js/components/cashflow/cashflow-tab.js`.
    *   *Visual*: Replace the generic "Expenses" bar with a stacked bar:
        *   🟦 **Living Expenses** (Bottom)
        *   🟥 **Federal Tax**
        *   🟧 **State Tax**
        *   🟨 **FICA** (Top)
    *   *Tooltip*: "Year 2035: $45k Living + $12k Taxes = $57k Total Outflow".

### 🛡️ Phase 2: Safety & Data Integrity (Quick Wins)
**Goal**: Prevent invalid data from entering the system.

1.  **Inline Validation**
    *   *Task*: Update `src/static/js/components/profile/profile-tab.js`.
    *   *Logic*: Add listeners to `birth_date` and `retirement_date`.
    *   *UI*: Immediate red text if `Retirement Date < Birth Date + 18`.

2.  **Smart Defaults**
    *   *Task*: Pre-fill fields to reduce friction.
    *   *Logic*:
        *   `Retirement Age`: Default to **67** (Social Security FRA).
        *   `Life Expectancy`: Default to **90**.
        *   `Inflation`: Default to **2.5%**.

### 🎨 Phase 3: User Guidance & Organization (Polish)
**Goal**: Reduce cognitive load.

1.  **Tab Reorganization**
    *   *Task*: Group the 13 tabs in `index.html` into logical dropdowns:
        *   **Input**: Profile, Budget, Assets
        *   **Analysis**: Dashboard, Cashflow, Projections
        *   **Strategy**: Tax Opt, Scenarios
        *   **Reports**: PDF Export

2.  **Contextual Help**
    *   *Task*: Add "ℹ️" icons to complex fields (e.g., "Safe Withdrawal Rate", "Stock Allocation").

## 3. Immediate Next Step (Execution)

**Phase 1 (Tax Transparency)** is the recommended starting point. It requires no changes to the core Monte Carlo logic, only the addition of a "reporting mode" to expose the calculations that are already happening.
