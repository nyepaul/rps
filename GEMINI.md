# GEMINI.md

Project context for Google Gemini AI.

## Project: Retirement & Wealth Planning System (RPS)

**Type**: Web Application (Flask/Vanilla JS)
**Version**: 3.9.150
**Location**: `/home/paul/src/rps`
**Manager**: `bin/manage` (Main CLI entry point)

## Overview

RPS is a comprehensive, **local-first** financial planning application designed for high-fidelity retirement modeling. It combines a rigorous Monte Carlo simulation engine with optional AI capabilities to provide professional-grade financial analysis while maintaining complete data privacy.

## Key Capabilities

### 1. Financial Modeling Engine (`src/services/retirement_model.py`)
- **Monte Carlo Simulation**: High-performance, vectorized simulation (10,000 runs) projecting success rates over 30+ years.
- **Tax Engine**: Detailed US tax modeling including:
  - Progressive Federal Income Tax (MFJ/Single).
  - Social Security taxability logic.
  - Long-Term Capital Gains (LTCG) stacking.
  - Medicare IRMAA surcharges.
  - 10% Early Withdrawal Penalties.
- **Withdrawal Strategies**:
  - **Standard**: Conventional drawdown.
  - **Retirement Smile**: Higher spending in early retirement, decreasing later.
  - **Conservative Decline**: Gradual spending reduction.
- **Dynamic Income**: Models complex streams like Social Security (with claiming age optimization), Pensions (Lump vs. Stream), and Budget-based income.

### 2. AI Integration (Optional) (`src/routes/ai_services.py`)
The system works fully offline but gains capabilities with API keys. Now supports a wide range of providers including:
- **Cloud**: Gemini (Google), Claude (Anthropic), OpenAI, DeepSeek, Grok (xAI), Mistral, Together AI, HuggingFace, Zhipu AI, OpenRouter.
- **Local**: Ollama, LM Studio, LocalAI.

Features:
- **AI Advisor**: Context-aware chat for personalized financial strategy with multi-model fallback.
- **Asset Extraction**: **Computer Vision** feature to extract account details (holdings, values) from uploaded statement images/screenshots.
- **Action Items**: AI-generated, prioritized task lists based on profile analysis.

### 3. Reporting & Analysis
- **Elite PDF Reports**: Professional-grade PDF generation with charts and detailed analysis (`src/services/pdf_service_elite.py`).
- **User Activity Reports**: Admin-facing analytics on user engagement and feature usage.
- **Visualizations**: Interactive Chart.js dashboards for wealth projection and tax bracket management.

### 4. Security & Data
- **Local-First**: All data stored in SQLite (`data/planning.db`).
- **Encryption**: Profile data encrypted at rest using AES-256-GCM (`src/services/encryption_service.py`).
- **Audit Logging**: Enhanced logging with **IP Geolocation** tracking (`docs/GEOLOCATION_LOGGING.md`) using `geoip2` and `ip-api.com`.
- **Data Portability**: Full CSV Import/Export capabilities for assets.
- **Fingerprinting**: Browser/Device fingerprinting for security (`src/routes/fingerprint.py`).

### 5. Educational Content
- **Skills System**: Built-in knowledge base (`skills/`) serving markdown guides on topics like "Tax Strategy" and "Estate Planning" (`src/routes/skills.py`).

### 6. Additional Modules
- **Roadmap**: Strategic planning module (`src/routes/roadmap.py`).
- **Life Events**: Modeling significant life changes (`src/routes/events.py`).
- **Feedback**: User feedback collection system (`src/routes/feedback.py`).
- **Budgeting**: Detailed budget management (`src/routes/budget.py`).

## System Architecture

- **Backend**: Python 3.x, Flask.
  - **No ORM**: Uses raw SQL with parameterized queries for performance and explicit control.
  - **Stateless Logic**: Calculations are performed on-the-fly based on current profile state.
- **Frontend**: Vanilla JavaScript (ES6 Modules).
  - **Component-based**: Organized in `src/static/js/components/`.
  - **No Bundler**: Files served directly to the browser.
- **Database**: SQLite with Alembic for migrations (`migrations/`).

## Workspace Structure

```text
/home/paul/src/rps/
├── bin/                 # Management scripts (start, backup, deploy)
├── src/                 # Source code
│   ├── app.py           # Flask app factory
│   ├── services/        # Core business logic (Model, Tax, Audit, PDF)
│   ├── routes/          # API endpoints (Blueprints)
│   ├── models/          # Data access layer (Raw SQL)
│   └── static/          # Frontend assets (JS/CSS/HTML)
├── data/                # SQLite database (planning.db)
├── docs/                # Documentation (Technical & User)
├── skills/              # Markdown educational content
└── migrations/          # Database schema changes
```

## Common Commands

### Application Management
```bash
./bin/manage start           # Start application (port 5137)
./bin/manage stop            # Stop application
./bin/manage status          # Check health
./bin/manage backup          # Backup database
./bin/setup-api-keys         # Configure AI keys
```

### Development
```bash
pytest                       # Run test suite
pytest tests/test_models/    # Run specific tests
alembic revision --autogenerate -m "msg"  # Create migration
./bin/bump-version 3.9.X "msg"  # CRITICAL: Version bump before push
```

## Documentation Map

- **User Guide**: `docs/guides/QUICKSTART.md`
- **AI Features**: `docs/reference/LLM_FUNCTIONALITY_GUIDE.md`
- **Security**: `docs/security/SYSTEM_SECURITY_DOCUMENTATION.md`
- **Geolocation**: `docs/GEOLOCATION_LOGGING.md`
- **Reporting**: `docs/reference/USER_REPORT_FEATURE.md`
