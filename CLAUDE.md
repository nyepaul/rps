# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

### API Key Configuration (Required for AI Features)
```bash
./setup-api-keys.sh         # Interactive script to configure API keys
                            # Prompts for keys and updates your shell config
                            # Keys are stored as environment variables (not in database)
```

**Manual setup:**
```bash
export GEMINI_API_KEY="your-key-here"         # For Google Gemini
export ANTHROPIC_API_KEY="your-key-here"      # For Anthropic Claude
```

Add these exports to your `~/.zshrc` or `~/.bashrc` to make them persistent.

## Commands

### Development
```bash
./start.sh                  # Start Flask server (port 8080) + creates venv if needed
./manage.sh start           # Alternative way to start server
./manage.sh stop            # Stop the application
./manage.sh status          # Check if server is running + health check
```

### Testing & Validation
```bash
./test-all-features.sh      # Comprehensive API test suite (profiles, analysis, AI, PDFs)
# Requires GEMINI_API_KEY or ANTHROPIC_API_KEY env vars for AI tests
```

### Database Management
```bash
./manage.sh backup          # Backup webapp/data/planning.db to backups/[timestamp]/
./manage.sh restore         # Restore from a previous backup
```

### Deployment
```bash
./manage.sh tunnel          # Start Cloudflare tunnel for public HTTPS access
./manage.sh start-docker    # Docker deployment (optional)
```

## System Architecture

### Monte Carlo Simulation Engine (RetirementModel in app.py)
The core calculation engine performs 10,000 simulations with granular tax modeling:

**Account Sequencing Logic**:
1. **457(b) accounts**: No early withdrawal penalty (withdraw first if under 59.5)
2. **Taxable accounts**: Capital gains tax only (15%)
3. **Traditional IRA/401k**: Ordinary income tax + 10% penalty if under 59.5
4. **Roth IRA**: Tax-free (withdraw last)

**RMD Handling**: At age 73+, Required Minimum Distributions are calculated and withdrawn from pre-tax accounts. Excess RMDs not needed for spending are reinvested in taxable accounts.

**Income Streams**: Dynamic modeling of pensions, annuities, rental income, etc. with configurable start dates and inflation adjustments.

### AI Integration Architecture
Two LLM providers supported (Gemini and Claude) with automatic model fallback:

**Gemini**: `gemini-3-pro` → `gemini-3-flash` → `gemini-3-flash-preview`
**Claude**: `claude-3-5-sonnet-latest` → `claude-3-5-haiku-latest` → `claude-3-opus-latest`

**Two AI Modes**:
1. **Self-Assessment** (`/api/perform-self-assessment`): Analyzes user profile against `skills/*.md` to find gaps
2. **Advisor Chat** (`/api/advisor/chat`): Context-aware conversational planning with full conversation history

**Context Injection**: AI prompts automatically include user profile, current analysis results, all skills documents, and active action items.

### Database Schema (SQLite: webapp/data/planning.db)
```sql
profile         -- Financial profiles (person1, person2, assets, retirement dates)
scenarios       -- Saved scenario comparisons
action_items    -- Tasks with priority, due dates, status, profile association
conversations   -- AI chat history per profile
system_settings -- App-wide settings (API keys stored here)
```

### Frontend Architecture (Single-Page App)
- **No Build Step**: Pure vanilla JS + Chart.js for simplicity
- **Local-First**: All data stays in SQLite, no external services
- **Smart Apply**: When AI returns `action_data` JSON with field mappings, frontend shows "⚡ Quick Apply" button to update profile parameters directly

## Financial Profile Data Structure

The profile JSON structure drives all calculations:

```json
{
  "person1": {
    "name": "string",
    "birth_date": "YYYY-MM-DD",
    "retirement_date": "YYYY-MM-DD",
    "social_security": 0  // Monthly amount
  },
  "income_streams": [
    {
      "name": "Pension",
      "amount": 120000,  // Annual
      "start_date": "YYYY-MM-DD",
      "inflation_adjusted": true,
      "survivor_benefit": 100  // Percentage
    }
  ],
  "investment_types": [
    {
      "name": "Vanguard 401k",
      "account": "Traditional IRA",  // Or: Liquid, 457b, Roth IRA, Pension
      "value": 2800000,
      "cost_basis": 0  // For taxable accounts only
    }
  ],
  "market_assumptions": {
    "stock_allocation": 0.5,
    "stock_return_mean": 0.10,
    "stock_return_std": 0.18,
    "bond_return_mean": 0.04,
    "bond_return_std": 0.06,
    "inflation_mean": 0.03,
    "inflation_std": 0.01
  },
  "assumed_tax_rate": 0.22  // Effective tax rate for withdrawals
}
```

## API Endpoints Reference

### Core Analysis
- `POST /api/analysis` - Run Monte Carlo simulation (returns success_rate, percentile_balances, rmd_projections)
- `POST /api/report/pdf` - Generate PDF report (requires profile + analysis data)

### Profile Management
- `GET /api/profiles` - List all saved profiles
- `GET /api/profile/<name>` - Load specific profile
- `POST /api/profile/<name>` - Save/update profile
- `DELETE /api/profile/<name>` - Delete profile

### AI Features
- `POST /api/advisor/chat` - Send message to AI advisor
- `GET /api/advisor/history?profile_name=X` - Get conversation history
- `POST /api/advisor/clear?profile_name=X` - Clear conversation history
- `POST /api/perform-self-assessment` - Run skills gap analysis

### Action Items
- `GET /api/action-items?profile_name=X` - Get tasks for profile
- `POST /api/action-items` - Create new task
- `PUT /api/action-items` - Update task (usually status changes)
- `DELETE /api/action-items` - Delete task
- `POST /api/action-items/cleanup` - Deduplicate action items

## AI Implementation Guidelines

When modifying AI features:

1. **Skills Library**: The `skills/` directory contains domain expertise documents that are injected into AI prompts. Add new skills as `*-SKILL.md` files.

2. **Structured Recommendations**: When AI returns parameter recommendations, include `action_data` JSON with field mappings:
   ```json
   {
     "action_data": {
       "retirement_date_p1": "2028-07-01",
       "stock_allocation": 0.6,
       "target_annual_income": 250000
     }
   }
   ```

3. **Model Fallback**: Use `call_gemini_with_fallback()` or `call_claude_with_fallback()` which automatically try multiple models if primary fails.

## Development Constraints

**IMPORTANT**: This is a local-first personal planning system. When making changes:
- **No Cloud Dependencies**: Do not introduce services requiring external hosting
- **No Build Step**: Keep frontend as single `index.html` file with inline/CDN resources
- **Stateless Calculations**: All financial math must recalculate on demand (no cached results)
- **Privacy First**: Never log or transmit sensitive financial data

## Testing Patterns

The test suite (`test-all-features.sh`) validates:
- Profile CRUD operations
- Monte Carlo simulation accuracy
- AI chat functionality (if API keys present)
- PDF generation
- Action item workflow
- Database cleanup operations

When adding features, extend the test script to validate new endpoints.