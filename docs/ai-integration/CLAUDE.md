# Claude AI Integration Guide

This file provides guidance for Claude Code when working with this repository.

## Setup

### API Key Configuration (Required for AI Features)
```bash
./bin/setup-api-keys    # Interactive script to configure API keys
                        # Prompts for keys and updates your shell config
                        # Keys are stored as environment variables (not in database)
```

**Manual setup:**
```bash
export ANTHROPIC_API_KEY="your-key-here"      # For Anthropic Claude
export GEMINI_API_KEY="your-key-here"         # For Google Gemini
```

Add these exports to your `~/.zshrc` or `~/.bashrc` to make them persistent.

## Commands

### Development
```bash
./bin/start             # Start Flask server (port 5137) + creates venv if needed
./bin/manage start      # Alternative way to start server
./bin/manage stop       # Stop the application
./bin/manage status     # Check if server is running + health check
```

### Testing & Validation
```bash
pytest                  # Run all tests
pytest tests/test_routes/  # Test API routes
```

### Database Management
```bash
./bin/backup            # Backup data/planning.db to backups/
./bin/restore           # Restore from a previous backup
```

### Deployment
```bash
./bin/manage tunnel     # Start Cloudflare tunnel for public HTTPS access
sudo ./bin/deploy       # Production deployment
```

## System Architecture

### Monte Carlo Simulation Engine
The core calculation engine (`src/services/retirement_model.py`) performs 10,000 simulations with granular tax modeling:

**Five Account Buckets**:
1. **Cash** (Checking/Savings): No market growth, used first for withdrawals
2. **Taxable** (Brokerage): Capital gains tax only (15%)
3. **Pre-Tax Standard** (Traditional IRA/401k/403b/401a): Ordinary income tax + 10% penalty if under 59.5
4. **Pre-Tax 457(b)**: No early withdrawal penalty (withdraw first if under 59.5)
5. **Roth IRA**: Tax-free, withdraw last

**Withdrawal Strategy** (applies after RMDs):
1. Cash first (no tax or penalty)
2. 457(b) if under 59.5 (no penalty)
3. Taxable accounts (capital gains tax only)
4. Traditional IRA/401k (ordinary income tax + penalty if under 59.5)
5. Roth IRA last (tax-free)

**RMD Handling**: At age 73+, Required Minimum Distributions are calculated and withdrawn from pre-tax accounts.

### AI Integration Architecture
Two LLM providers supported (Gemini and Claude) with automatic model fallback:

**Gemini**: `gemini-2.0-flash` → `gemini-1.5-flash`
**Claude**: `claude-sonnet-4-20250514` → `claude-3-5-haiku-latest`

**Two AI Modes**:
1. **Self-Assessment** (`/api/perform-self-assessment`): Analyzes user profile against `skills/*.md` to find gaps
2. **Advisor Chat** (`/api/advisor/chat`): Context-aware conversational planning with full conversation history

### Database Schema (SQLite: data/planning.db)
```sql
profile         -- Financial profiles (person1, person2, assets, retirement dates)
scenarios       -- Saved scenario comparisons
action_items    -- Tasks with priority, due dates, status, profile association
conversations   -- AI chat history per profile
users           -- User accounts with authentication
audit_log       -- Security and compliance logging
```

### Frontend Architecture (Single-Page App)
- **No Build Step**: Pure vanilla JS + Chart.js for simplicity
- **ES6 Modules**: Modern JavaScript module system
- **Local-First**: All data stays in SQLite, no external services
- **Smart Apply**: When AI returns `action_data` JSON with field mappings, frontend shows "Quick Apply" button

## API Endpoints Reference

### Core Analysis
- `POST /api/analysis` - Run Monte Carlo simulation
- `POST /api/report/pdf` - Generate PDF report

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
- `PUT /api/action-items` - Update task
- `DELETE /api/action-items` - Delete task

## Development Constraints

**IMPORTANT**: This is a local-first personal planning system. When making changes:
- **No Cloud Dependencies**: Do not introduce services requiring external hosting
- **No Build Step**: Keep frontend as vanilla JS with ES6 modules
- **Stateless Calculations**: All financial math must recalculate on demand
- **Privacy First**: Never log or transmit sensitive financial data
- **Data Encryption**: Profile data is encrypted at rest (AES-256-GCM)
