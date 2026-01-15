# Custom Spending Model Documentation Skill

## Purpose
This skill provides a structured workflow for documenting, implementing, and validating custom spending models within the Retirement Planning System. A clear documentation process ensures that financial logic is transparent, reproducible, and easily understandable by both developers and financial advisors.

## Workflow Overview

1.  **Define the Model Logic**
2.  **Document Mathematical Formula**
3.  **Specify Parameters & Assumptions**
4.  **Implementation Steps**
5.  **Validation & Testing Criteria**

---

## 1. Define the Model Logic

**Goal:** Clearly articulate *why* this spending model exists and *what* behavior it attempts to simulate.

*   **Name:** Give the model a concise, descriptive name (e.g., "Retirement Smile", "Go-Go/Slow-Go/No-Go", "Percentage of Portfolio").
*   **Concept:** Describe the retiree behavior this model captures.
    *   *Example:* "This model assumes spending is highest in early retirement due to travel, decreases in mid-retirement as activity slows, and increases in late retirement due to healthcare costs."
*   **Target Audience:** Who is this model best suited for? (e.g., "Active retirees with longevity risk", "Conservative planners").

## 2. Document Mathematical Formula

**Goal:** Provide the exact math used to calculate annual spending.

*   **Base Variable:** What is the starting point? (e.g., `Initial Annual Spending`, `Current Portfolio Value`, `Inflation-Adjusted Prior Year Spending`).
*   **Adjustment Factors:**
    *   **Age-Based Multipliers:** Does spending change based on age?
    *   **Market-Based Adjustments:** Does spending react to portfolio performance (e.g., Guyton-Klinger guardrails)?
    *   **Inflation Adjustment:** Is it fully inflation-adjusted (CPI), partial (CPI - 1%), or nominal?

**Example Formula (Retirement Smile):**
```
Annual Spending(Age) = Base Spending * Inflation_Factor * Age_Multiplier(Age)

Where Age_Multiplier(Age) = 
  - 1.0                for Age < 70
  - 1.0 - (Age-70)*0.02 for 70 <= Age < 80
  - 0.8 + (Age-80)*0.02 for Age >= 80
```

## 3. Specify Parameters & Assumptions

**Goal:** List all configurable inputs and hardcoded assumptions.

*   **User Inputs:** What can the user change? (e.g., "Initial Spending Amount", "Decline Rate").
*   **Hardcoded Constants:** What numbers are fixed in the code? (e.g., "Age 70 threshold", "2% annual decline").
*   **Constraints:** Are there limits? (e.g., "Spending cannot drop below 50% of initial target").

## 4. Implementation Steps

**Goal:** Guide the developer on where to add this logic in the codebase.

**Backend (`src/services/retirement_model.py`):**
1.  Open `src/services/retirement_model.py`.
2.  Locate the `monte_carlo_simulation` method.
3.  Add the new model key to the `spending_model` parameter logic.
4.  Implement the `spending_multipliers` vector calculation.
    ```python
    if spending_model == 'my_custom_model':
        for i in range(years):
            age = (self.current_year + i) - p1_birth_year
            # ... calculation logic ...
            spending_multipliers[i] = calculated_factor
    ```

**Frontend (`src/static/js/components/analysis/analysis-tab.js`):**
1.  Open `src/static/js/components/analysis/analysis-tab.js`.
2.  Add the new model to the `spending-model-select` dropdown HTML options.
3.  Add the model description to the `spendingDescriptions` object.
    ```javascript
    'my_custom_model': {
        title: 'My Custom Model Name',
        desc: 'Short description of the behavior for the user.'
    }
    ```

## 5. Validation & Testing Criteria

**Goal:** Ensure the model works as intended.

*   **Test Case 1: Baseline Comparison**
    *   Run simulation with "Constant Real" (baseline).
    *   Run simulation with "New Model".
    *   *Expectation:* If the new model reduces spending (e.g., decline curve), the "Success Rate" and "Median Ending Balance" should INCREASE compared to baseline.

*   **Test Case 2: Extreme Ages**
    *   Check spending at age 65, 75, 85, 95.
    *   *Expectation:* Verify the multipliers match the formula (e.g., at 75, multiplier is 0.9).

*   **Test Case 3: Inflation**
    *   Verify that inflation is still applied correctly *on top* of the multipliers (unless the model explicitly ignores inflation).

---

## Example: Documenting "Conservative Decline"

**1. Logic:** Models a gradual reduction in real spending as retirees age and become less active.
**2. Formula:** `Spending = Base * CPI * (1.0 - (Age - 70) * 0.01)` for Age > 70. Floor at 0.6.
**3. Parameters:** Decline starts at 70, rate is 1%/year, floor is 60%.
**4. Implementation:** Added to `retirement_model.py` and `analysis-tab.js`.
**5. Validation:** Confirmed success rate increased from 85% (Constant) to 92% (Decline) for a sample profile.
