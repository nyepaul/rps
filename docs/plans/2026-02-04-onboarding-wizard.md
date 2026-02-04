# Implementation Plan: Onboarding Wizard (UX Phase 1)

**Goal**: Implement a guided 5-step onboarding wizard to reduce user abandonment and improve initial profile setup completion.

**Reference**: `docs/reviews/UX_ASSESSMENT_AND_RECOMMENDATIONS.md` (Phase 1, Item 2)

## 1. New Components

### `src/static/js/components/onboarding/onboarding-wizard.js`
Create a new module to handle the multi-step wizard logic.

**Steps:**
1.  **Welcome**: Value prop, "Let's get started".
2.  **Personal Info**: Name, Birth Year, Retirement Target Year.
3.  **Financial Snapshot**: Annual Income, Annual Expenses (slider/input), Current Portfolio.
4.  **Priorities**: Checkboxes for "Safety", "Growth", "Tax Efficiency", "Early Retirement".
5.  **Result Preview**: Quick "Success Rate" estimate based on simplified inputs.
6.  **Commit**: "Create Profile" button that saves data and redirects to Dashboard.

**Technical Details:**
- State management local to wizard.
- On "Commit", calls `profilesAPI.create` and saves data to `store`.
- Uses `calculateNetWorth` or simplified logic for "Result Preview".

### `src/static/css/onboarding.css`
Styles specific to the wizard overlay and steps.
- Full-screen overlay with backdrop blur.
- Centered card with progress bar.
- Large, friendly input fields.
- "Next" and "Back" navigation buttons.
- Animations for step transitions (slide/fade).

## 2. Integration

### `src/static/index.html`
- Add `<link rel="stylesheet" href="static/css/onboarding.css">`
- Add `<script type="module" src="static/js/components/onboarding/onboarding-wizard.js"></script>`

### `src/static/js/main.js`
- In `initApp()`:
    - Check if user has any profiles.
    - If `profiles.length === 0`, trigger `startOnboarding()`.
    - Provide a way to manually trigger it (e.g., "Restart Setup" in settings, though low priority).

## 3. Data Flow

1.  **Input**: User enters simple high-level data.
2.  **Processing**:
    - Calculate `birth_date` from Year (assume Jan 1).
    - Calculate `retirement_date` from Target Year (assume Jan 1).
    - Create a "default" profile structure with:
        - `financial.annual_income`
        - `financial.annual_expenses`
        - `assets.taxable_accounts` (Simple "Portfolio" entry)
3.  **Output**:
    - Create Profile via API.
    - Set as `currentProfile`.
    - Redirect to `dashboard` tab.
    - Show "Setup Complete" toast or confetti.

## 4. Verification

- **Manual Test**: Clear local storage/database (or use new user), verify Wizard launches.
- **Functional Test**: Verify profile is created with correct values.
- **Visual Test**: Verify responsive layout and animations.
