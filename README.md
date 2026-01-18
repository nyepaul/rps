# Retirement & Wealth Planning System (RPS)

A comprehensive, local-first financial planning application designed for retirement scenario modeling, tax optimization, and estate planning.

## Overview

This system provides a private, interactive environment to:
- **Model Retirement Scenarios**: Dynamic Monte Carlo simulations (10,000 runs) with granular tax modeling.
- **AI Strategic Advisor**: Personalized guidance powered by Gemini/Claude to optimize your specific situation.
- **Optimize Income & Taxes**: Test different Social Security ages, Roth conversions, and withdrawal sequences.
- **Flexible Pension Modeling**: Model any combination of lump-sum or annual pension streams.
- **Wealth Transfer**: Structure tax-efficient gifting to heirs.
- **Smart Execution**: Convert AI recommendations directly into trackable tasks or apply parameter changes with one click.

**IMPORTANT**: This system is for organizing information and exploring scenarios. Always consult licensed financial advisors, CPAs, and attorneys for actual decisions.

## Key Features

### 1. Interactive Dashboard (Scenario Sandbox)
- **Real-time Adjustments**: Use sliders to immediately see how changes in spending, retirement dates, or asset allocation impact your success rate.
- **Wealth Projection**: Visualize median, best-case (95%), and worst-case (5%) trajectories over a 30-year horizon.

### 2. AI Strategic recommendations 🤖
- **Deep Analysis**: Click "🤖 AI Recommendations" in the Analysis tab for a comprehensive review of your plan.
- **Quick Apply**: AI-detected improvements (like delaying SS or adjusting spending) can be applied to your profile with a single click.
- **Structured Action Items**: AI parses unstructured advice into a prioritized checklist in your "Action Items" tab.

### 3. Dynamic Income Streams
- **Flexible Pensions**: Model pensions as annual income (via Income Streams) or lump sums (via Assets).
- **Multiple Sources**: Add rental income, annuities, or part-time work with specific start dates and inflation adjustments.
- **Survivor Benefits**: Configure percentage-based survivor coverage for each income stream.

### 4. Tax-Efficient Withdrawal Strategy
- **Account Sequencing**: Automatic logic for withdrawing from 457(b), Liquid, Traditional, and Roth accounts in the most tax-efficient order.
- **Roth Conversion Window**: Visualizes the "Golden Window" between retirement and RMD age (73) to lock in lower tax brackets.

## Quick Start

1. **Configure API Keys** (required for AI features):
   ```bash
   ./bin/setup-api-keys
   ```
   This interactive script will prompt for your Gemini or Claude API keys and add them to your shell configuration.

2. **Start the Server**:
   ```bash
   ./bin/start
   ```
3. **Open Browser**: Navigate to [http://127.0.0.1:5137](http://127.0.0.1:5137)
4. **Load Data**: Go to **Profile & Data**, select your profile, and click **Load**.
5. **Iterate**: Use the **Dashboard** sandbox to test "What If" scenarios.

## Management Commands

```bash
./bin/manage start           # Start application locally
./bin/manage stop            # Stop the application
./bin/manage status          # Check system health
./bin/manage backup          # Backup the SQLite database
./bin/manage tunnel          # Create secure public URL for sharing
```

## Architecture

- **Backend**: Python (Flask) serving a stateless calculation engine and SQLite data manager.
- **Frontend**: Single-page application using vanilla JS and Chart.js for performance and privacy.
- **AI Integration**: Direct secure connection to Gemini 3 Flash and Claude 3.5 Sonnet.
- **Local-First**: All data stays on your machine in `data/planning.db`.

## Next Steps

1. **Configure API Keys**: Run `./bin/setup-api-keys` to set up your Gemini or Claude API keys as environment variables.
2. **Verify Income Streams**: Ensure your pension and Social Security estimates are up to date.
3. **Run AI Assessment**: Use the "Run AI Self-Assessment" button in Action Items to find gaps against best practices.

---
**Last Updated**: January 2026
**System Version**: 2.0 (Advanced AI & Dynamic Modeling)
**Authored by**: pan