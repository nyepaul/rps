# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RPS is a retirement and wealth planning system - a local-first financial planning application for Monte Carlo retirement simulations, tax optimization, and AI-powered financial advice. Version 3.9 with modular architecture.

**Authored by**: pan

## Version Management

**CRITICAL: Always bump version before pushing when making ANY code changes.**

### Version Scheme
- Current major.minor: **3.9.x** (Current: 3.9.122)
- Use patch versions: 3.9.1, 3.9.2, ..., 3.9.199
- Increment patch for ALL changes (features, fixes, improvements)
- Only move to 3.10.0 when explicitly requested

### Version Bump Process
```bash
./bin/bump-version 3.9.X "Description of changes"
```

This updates:
- `src/__version__.py` - Source of truth (API, admin panel)
- `src/static/index.html` - Fallback display and cache-busting

### When to Bump
**ALWAYS** bump version when:
- Adding new features
- Fixing bugs
- Modifying UI/UX
- Updating dependencies
- Changing configuration
- Improving performance

**Before final push**, check:
1. ✅ Version incremented in both files
2. ✅ Release notes describe the change
3. ✅ Commit includes version bump

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

### Backup and Restore

**Two backup types available:**

1. **Full System Backup** (complete application - 76M compressed)
   ```bash
   ./bin/backup                    # Run full system backup
   ./bin/backup --keep 14          # Keep last 14 full backups (default)
   ```
   - Includes: source code, scripts, migrations, tests, docs, database, configs
   - Use for: system restores, deployments, archival
   - Frequency: weekly or before major changes

2. **Incremental Backup** (data only - 2.6M compressed)
   ```bash
   ./bin/backup-incremental        # Run incremental backup
   ./bin/backup-incremental --keep 30  # Keep last 30 incremental backups (default)
   ```
   - Includes: database, configs, recent logs only
   - Use for: daily/hourly data protection (29× smaller!)
   - Frequency: automated daily backups

**Restore:**
```bash
./bin/restore --list            # List available backups
./bin/restore --latest          # Restore latest backup
./bin/setup-backup-timer        # Install automated daily backups
```

**Admin UI Backups** (Super Admin only):
- System backups: Admin → Backups → System Backups tab
- Selective profile/group backups: Admin → Backups → Selective Backup tab
- Stored in `backups/selective/` as JSON files

**All backups use optimal gzip -9 compression for maximum space efficiency.**

See [docs/BACKUP_GUIDE.md](docs/BACKUP_GUIDE.md) for comprehensive backup documentation.

## Documentation Structure

All documentation is organized in the `docs/` directory:
- **guides/** - User guides and tutorials
- **reference/** - Technical reference documentation
- **deployment/** - Deployment and infrastructure setup
- **security/** - Security documentation and fixes
- **ai-integration/** - AI service integration guides
- **architecture/** - System architecture documentation

Key documents:
- [Quick Start Guide](docs/guides/QUICKSTART.md)
- [Dev Server Setup](docs/DEV_SERVER.md) - Ports 5137/8087, starting/stopping
- [Deployment Guide](docs/deployment/DEPLOYMENT.md)
- [Security Documentation](docs/security/SYSTEM_SECURITY_DOCUMENTATION.md)
- [Admin System Guide](docs/reference/ADMIN_SYSTEM_GUIDE.md)
- [Backup Guide](docs/BACKUP_GUIDE.md)

## Architecture

### Backend (Python/Flask)
- **Entry point**: `src/app.py` - Flask app factory
- **Routes**: `src/routes/` - API endpoints organized by domain. Key modules:
  - `ai_services.py`: AI/LLM integration (Multi-provider)
  - `roadmap.py`: Strategic planning
  - `events.py`: Life event modeling
  - `feedback.py`: User feedback
  - `budget.py`: Budget management
  - `fingerprint.py`: Device fingerprinting
  - Standard: `profiles.py`, `analysis.py`, `scenarios.py`, `action_items.py`
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
- IP Geolocation and device fingerprinting
- Pydantic schemas for input validation

## Key Patterns

- **Blueprint pattern**: Routes organized by domain in separate files
- **Service layer**: Business logic separated from routes
- **Direct SQLite**: No ORM - models use raw SQL with parameterized queries
- **ES6 modules**: Frontend uses native browser modules, no bundler
- **localStorage**: Wizard progress and learning tracking stored client-side

## Environment Variables
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` - For AI features (optional)
- `SECRET_KEY` - Flask session encryption
- `ENCRYPTION_KEY` - Production data encryption (required in production)
- `FLASK_ENV` - development/production

## Testing Notes
- Test fixtures in `tests/conftest.py` set up test database
- Integration tests in `tests/test_integration/`
- API tests via `tests/test-api.sh`