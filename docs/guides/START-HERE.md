# Welcome to Your Planning System

The application is now running with **Advanced AI Integration** and **Dynamic Pension Modeling**.

## Quick Start - 3 Steps

### 1. Start the Server
```bash
./bin/start
```

### 2. Open the Dashboard
Navigate to: **[http://127.0.0.1:5137](http://127.0.0.1:5137)**

### 3. Load & Optimize
- **First Time?** Click **"Create New Profile"** to start the financial wizard.
- **Returning?** Go to the **Profile & Data** tab, select your profile and click **Load**.
- **Adjust Pension**: Under "Income Streams," you can modify pension amounts, start dates, and inflation rules.
- **Get AI Advice**: Go to the **Analysis** tab and click **AI Recommendations**.

---

## What's New in Version 3.10.6

### 2025 Tax Year Updates
The system now includes full support for the 2025 tax year, including:
- Updated Federal Income Tax brackets (Single and MFJ).
- Updated Standard Deduction amounts.
- New IRMAA (Medicare) surcharge thresholds.
- Updated Social Security (FICA) wage base and taxability logic.
- Long-Term Capital Gains (LTCG) bracket updates.

### AI Strategic Advisor
The system connects directly to Gemini, Claude, OpenAI, and Local LLMs. Click the **"AI Advisor"** tab to get a prioritized list of strategic moves tailored to your specific balances and income.

### Quick Apply
Found a better strategy in the AI advice? Use the **"Quick Apply"** button to instantly update your retirement dates or spending targets without manual entry.

### Scenario Sandbox
On the **Dashboard**, use the sliders to test "What If" scenarios in real-time. See how reducing spending by $10k/year or working 2 years longer impacts your 30-year projection.

### Flexible Income Streams
Pensions and Social Security are fully modeled with:
- **Annual Income**: Standard payments with COLA (inflation) options.
- **Lump Sum**: Large one-time payouts that roll into your Traditional IRA.
- **SS Optimization**: Model different claiming ages (62-70) and see the impact on your success rate.

---

## Critical Files
- **docs/reviews/CORRECTED-ANALYSIS.md**: Interpreting your current baseline results.
- **docs/guides/YOUR-ACTION-PLAN.md**: Your 30-year implementation timeline.
- **docs/guides/TROUBLESHOOTING.md**: Solutions for "Failed to Fetch" or Port errors.

---
Stop the local Docker runtime with: `./bin/manage stop`
