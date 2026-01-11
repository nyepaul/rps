# Asset Extraction - Field Preservation Test Guide

## What Changed

The asset extraction system now **preserves existing field values** when processing images/clipboard:

1. **LLM Prompt Updated**: Instructs AI to return `null` for fields not clearly visible in image
2. **Backend Merge Logic**: Combines extracted data with existing assets, preserving fields that are null
3. **Frontend Simplified**: Trusts backend's merged data instead of doing its own type inference

## Test Scenarios

### Scenario 1: Image Shows Balance Only (No Account Type)

**Setup:**
- Existing asset: `{"name": "Vanguard 401k", "type": "Traditional IRA", "value": 500000, "cost_basis": 50000}`
- Image shows: "Vanguard 401k: $525,000" (no account type visible)

**Expected LLM Response:**
```json
[{"name": "Vanguard 401k", "type": null, "value": 525000, "cost_basis": null}]
```

**Expected Backend Merge:**
```json
[{"name": "Vanguard 401k", "type": "Traditional IRA", "value": 525000, "cost_basis": 50000}]
```

**Result:** ✅ Balance updated, account type PRESERVED, cost basis PRESERVED

---

### Scenario 2: Image Shows Both Balance and Account Type

**Setup:**
- Existing asset: `{"name": "Schwab Account", "type": "Liquid", "value": 100000, "cost_basis": 0}`
- Image shows: "Schwab Roth IRA: $150,000"

**Expected LLM Response:**
```json
[{"name": "Schwab Account", "type": "Roth IRA", "value": 150000, "cost_basis": null}]
```

**Expected Backend Merge:**
```json
[{"name": "Schwab Account", "type": "Roth IRA", "value": 150000, "cost_basis": 0}]
```

**Result:** ✅ Balance updated, account type UPDATED, cost basis PRESERVED

---

### Scenario 3: New Asset Not in Existing Profile

**Setup:**
- Existing assets: (none matching)
- Image shows: "Fidelity Brokerage: $75,000"

**Expected LLM Response:**
```json
[{"name": "Fidelity Brokerage", "type": null, "value": 75000, "cost_basis": null}]
```

**Expected Backend Merge:**
```json
[{"name": "Fidelity Brokerage", "type": "Liquid", "value": 75000, "cost_basis": 0}]
```

**Result:** ✅ New asset added with default type (Liquid) when type not visible

---

### Scenario 4: Image Shows Cost Basis (Rare)

**Setup:**
- Existing asset: `{"name": "Taxable Brokerage", "type": "Liquid", "value": 200000, "cost_basis": 150000}`
- Image shows: "Taxable Brokerage: $225,000 (Cost Basis: $175,000)"

**Expected LLM Response:**
```json
[{"name": "Taxable Brokerage", "type": null, "value": 225000, "cost_basis": 175000}]
```

**Expected Backend Merge:**
```json
[{"name": "Taxable Brokerage", "type": "Liquid", "value": 225000, "cost_basis": 175000}]
```

**Result:** ✅ All fields updated as visible, account type PRESERVED

---

## Manual Testing Steps

1. **Start the server:**
   ```bash
   ./start.sh
   ```

2. **Set API key in Settings tab** (Gemini or Claude)

3. **Create a test profile with existing assets:**
   - Add asset: "Vanguard 401k", type "Traditional IRA", value $500,000

4. **Take a screenshot showing only balance:**
   - Screenshot should show: "Vanguard 401k: $525,000" (no mention of IRA/401k type)

5. **Paste screenshot into asset upload area**

6. **Verify:**
   - Value updates to $525,000 ✅
   - Type remains "Traditional IRA" ✅ (NOT changed to Liquid or guessed)
   - Cost basis unchanged ✅

7. **Check console logs:**
   ```bash
   tail -f app.log
   ```
   Look for the extracted_assets JSON to confirm `type: null` when not visible

---

## What to Watch For

**RED FLAGS (bugs):**
- Account type changes when not visible in image
- Cost basis resets to 0 when not in image
- Fields being overwritten with guessed/inferred values

**GREEN FLAGS (working correctly):**
- Only fields clearly visible in image are updated
- Existing field values preserved when not in image
- LLM returns null for unverifiable fields
- Backend merge logic combines data correctly

---

## Code Changes Made

### Backend (app.py:476-556)
- Added `existing_assets` parameter to endpoint
- Updated prompt with "CRITICAL RULES - ONLY UPDATE VERIFIABLE FIELDS"
- Added merge logic to preserve existing field values when extracted field is null
- Default new assets to "Liquid" type when type not visible

### Frontend (index.html:1804-1923)
- Send current `investmentTypes` as `existing_assets` parameter
- Removed redundant type inference logic
- Trust backend's merged data for both updates and new additions
- Preserve `cost_basis` from backend response
