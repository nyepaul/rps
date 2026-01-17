# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RPS is a retirement and wealth planning system - a local-first financial planning application for Monte Carlo retirement simulations, tax optimization, and AI-powered financial advice. Version 2.0 with modular architecture.

**Authored by**: pan
**Co-Authored by**: Claude (Anthropic AI)

## Common Commands

### Starting the Application
```bash
./bin/start              # Creates venv, installs deps, runs Flask on port 5137
./bin/manage start       # Alternative management wrapper
```

### Testing
```bash
pytest                              # Run all tests
pytest tests/test_sanity.py         # Sanity checks only
pytest tests/test_models/           # Model tests
pytest tests/test_routes/           # Route tests
pytest -v -k "test_name"            # Run specific test by name
```

### Database Migrations
```bash
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                              # Apply migrations
alembic downgrade -1                              # Rollback one
```

### Code Quality
```bash
black src/              # Format Python
flake8 src/             # Lint Python
mypy src/               # Type checking
```

### API Key Setup
```bash
./bin/setup-api-keys    # Configure Gemini/Claude API keys
```

## Architecture

### Backend (Python/Flask)
- **Entry point**: `src/app.py` - Flask app factory
- **Routes**: `src/routes/` - API endpoints organized by domain (profiles, analysis, scenarios, ai_services, action_items)
- **Services**: `src/services/` - Business logic, notably `retirement_model.py` (~25K lines for Monte Carlo simulation)
- **Models**: `src/models/` - Domain models with SQLite persistence
- **Database**: `src/database/connection.py` - SQLite connection manager with context manager pattern

### Frontend (Vanilla JS/ES6 Modules)
- **Entry**: `src/static/index.html` (SPA shell) and `src/static/js/main.js`
- **Components**: `src/static/js/components/` - Tab-based UI components (dashboard, analysis, advisor, etc.)
- **API clients**: `src/static/js/api/` - Domain-specific API modules
- **State**: `src/static/js/state/store.js` - Global state management

### Database
- **Type**: SQLite at `data/planning.db`
- **Migrations**: `migrations/versions/` - Alembic migrations
- **Core tables**: users, profile, scenario, action_item, conversation, audit_log
- **Encryption**: Profile data encrypted at rest (AES-256-GCM) with per-record IVs

### Security Features
- Flask-Login session management with bcrypt passwords
- Data encryption via `src/services/encryption_service.py`
- Rate limiting (Flask-Limiter)
- Audit logging for compliance
- Pydantic schemas for input validation

## Key Patterns

- **Blueprint pattern**: Routes organized by domain in separate files
- **Service layer**: Business logic separated from routes
- **Direct SQLite**: No ORM - models use raw SQL with parameterized queries
- **ES6 modules**: Frontend uses native browser modules, no bundler
- **localStorage**: Wizard progress and learning tracking stored client-side

## Environment Variables
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` - For AI features
- `SECRET_KEY` - Flask session encryption
- `ENCRYPTION_KEY` - Production data encryption (required in production)
- `FLASK_ENV` - development/production

## Testing Notes
- Test fixtures in `tests/conftest.py` set up test database
- Integration tests in `tests/test_integration/`
- API tests via `tests/test-api.sh`
