# RPS Project Structure

This document describes the organization of the Retirement Planning System (RPS) codebase.

**Last Updated:** 2026-01-30 (v3.9.151)

## Directory Structure

```
rps/
├── README.md                  # Main project documentation
├── CLAUDE.md                  # Claude Code integration guide
├── alembic.ini               # Database migration configuration
├── requirements.txt          # Python dependencies
├── .env.production.example   # Environment variable template
│
├── bin/                      # Executable scripts and utilities
│   ├── start                 # Start development server
│   ├── deploy                # Production deployment
│   ├── backup                # Full backup script
│   ├── backup-data           # Data-only backup
│   ├── backup-system         # System-only backup
│   ├── restore               # Restore from backup
│   ├── setup-backup-timer    # Install automated backups
│   ├── bump-version          # Version management
│   ├── setup-api-keys        # API key configuration
│   ├── manage                # Management wrapper
│   ├── create-admin-account  # Create admin user
│   ├── reset-admin-password  # Reset admin password
│   ├── promote-admin         # Promote user to admin
│   ├── fix-deployment.sh     # Deployment fixes
│   ├── fix-install.sh        # Installation fixes
│   └── run_server.py         # Development server
│
├── scripts/                  # Database and administrative scripts
│   ├── create_admin.py
│   ├── create_demo_account.py
│   ├── reset_admin_password.py
│   ├── add_super_admin_flag.py
│   ├── copy_demo_account.py
│   └── update_admin_pw_production.py
│
├── src/                      # Application source code
│   ├── app.py               # Flask application factory
│   │
│   ├── auth/                # Authentication and authorization
│   │   ├── models.py        # User model
│   │   ├── admin_required.py
│   │   └── super_admin_required.py
│   │
│   ├── routes/              # API endpoints
│   │   ├── admin.py         # Admin dashboard APIs
│   │   ├── auth.py          # Authentication
│   │   ├── profiles.py      # Profile management
│   │   ├── scenarios.py     # Scenario management
│   │   ├── analysis.py      # Financial analysis
│   │   ├── ai_services.py   # AI advisor integration
│   │   ├── action_items.py  # Action item tracking
│   │   └── feedback.py      # User feedback
│   │
│   ├── models/              # Domain models
│   │   ├── profile.py
│   │   ├── scenario.py
│   │   ├── action_item.py
│   │   └── feedback.py
│   │
│   ├── services/            # Business logic
│   │   ├── retirement_model.py      # Monte Carlo simulation (~25K lines)
│   │   ├── ai_advisor_service.py    # AI integration
│   │   ├── encryption_service.py    # Data encryption
│   │   ├── enhanced_audit_logger.py # Audit logging
│   │   ├── audit_narrative_generator.py
│   │   ├── user_backup_service.py   # Per-user backup/restore
│   │   ├── selective_backup_service.py # Profile/group selective backup
│   │   └── report_generator.py
│   │
│   ├── schemas/             # Pydantic validation schemas
│   │
│   ├── database/            # Database connection management
│   │   └── connection.py
│   │
│   ├── middleware/          # Flask middleware
│   │
│   ├── utils/               # Utility functions
│   │
│   ├── static/              # Frontend assets
│   │   ├── index.html       # SPA shell
│   │   ├── css/             # Stylesheets
│   │   ├── js/              # JavaScript (ES6 modules)
│   │   │   ├── main.js      # Application entry point
│   │   │   ├── api/         # API client modules
│   │   │   ├── components/  # UI components
│   │   │   │   ├── admin/   # Admin dashboard components
│   │   │   │   ├── dashboard.js
│   │   │   │   ├── profile-tab.js
│   │   │   │   ├── analysis-tab.js
│   │   │   │   └── ...
│   │   │   ├── state/       # State management
│   │   │   └── utils/       # Frontend utilities
│   │   └── images/          # Images and icons
│   │
│   └── __version__.py       # Version information
│
├── docs/                    # Documentation
│   ├── README.md            # Documentation index
│   ├── START-HERE.md        # Getting started guide
│   ├── PROJECT_STRUCTURE.md # This document
│   ├── BACKUP_GUIDE.md      # Backup and restore guide
│   ├── DEVELOPER_GUIDE.md   # Developer documentation
│   ├── API_KEY_SECURITY.md  # API key security
│   ├── AUDIT_LOGGING.md     # Audit logging documentation
│   ├── NEW_FEATURES_GUIDE.md
│   ├── QUICK_START_GUIDE.md
│   ├── RESTART-INSTRUCTIONS.md
│   ├── RELEASE_NOTES_v2.md
│   │
│   ├── guides/              # User guides
│   │   ├── QUICKSTART.md
│   │   ├── DEMO_ACCOUNT.md
│   │   ├── TROUBLESHOOTING.md
│   │   ├── YOUR-ACTION-PLAN.md
│   │   └── PENSION-CLARIFICATION.md
│   │
│   ├── reference/           # Technical reference
│   │   ├── ADMIN_SYSTEM_GUIDE.md
│   │   ├── ASSET_DESCRIPTIONS_GUIDE.md
│   │   ├── ASSET_FIELDS_REFERENCE.md
│   │   ├── LLM_FUNCTIONALITY_GUIDE.md
│   │   ├── MARKET_SCENARIOS.md
│   │   ├── MORTGAGE_CALCULATION_EXAMPLE.md
│   │   ├── PROFESSIONAL_REPORTS_GUIDE.md
│   │   ├── USER_PROFILE_SCENARIO_RELATIONSHIP.md
│   │   └── USER_REPORT_FEATURE.md
│   │
│   ├── deployment/          # Deployment documentation
│   │   ├── DEPLOYMENT.md
│   │   ├── DEPLOYMENT_STATUS.md
│   │   ├── CLOUDFLARE_CONFIG.md
│   │   ├── EMAIL_SETUP.md
│   │   ├── ENHANCED_LOGGING_DEPLOYMENT.md
│   │   └── INSTALL_FIX.md
│   │
│   ├── security/            # Security documentation
│   │   ├── SYSTEM_SECURITY_DOCUMENTATION.md
│   │   ├── SECURITY_FIXES.md
│   │   ├── SECURITY_VALIDATION_REPORT.md
│   │   └── PASSWORD_REENCRYPTION_IMPLEMENTATION.md
│   │
│   ├── ai-integration/      # AI service integration
│   │   ├── CLAUDE.md
│   │   ├── GEMINI.md
│   │   └── SAMPLE-PROFILE.md
│   │
│   ├── architecture/        # System architecture
│   │   └── SYSTEM-OVERVIEW.md
│   │
│   └── reviews/             # Code reviews and analyses
│       ├── CODE-REVIEW-ASSESSMENT.md
│       ├── CORRECTED-ANALYSIS.md
│       ├── APP-FIX-SUMMARY.md
│       ├── REALITY-CHECK-ANALYSIS.md
│       └── TEST-RESULTS.md
│
├── tests/                   # Test suite
│   ├── conftest.py         # Test fixtures
│   ├── test_api_keys.py    # API key tests
│   ├── test_auth.sh        # Authentication tests
│   ├── test-pdf-with-charts.sh
│   ├── test_models/        # Model tests
│   ├── test_routes/        # Route/API tests
│   ├── test_services/      # Service tests
│   └── test_integration/   # Integration tests
│
├── migrations/              # Database migrations
│   ├── env.py
│   ├── script.py.mako
│   ├── scripts/
│   └── versions/           # Migration versions
│
├── skills/                  # Educational content (served via API)
│   ├── retirement-planning-SKILL.md
│   ├── tax-strategy-SKILL.md
│   ├── investment-policy-SKILL.md
│   ├── estate-legal-SKILL.md
│   ├── healthcare-gap-SKILL.md
│   ├── education-planning-SKILL.md
│   ├── real-estate-SKILL.md
│   ├── charitable-giving-SKILL.md
│   ├── lifestyle-design-SKILL.md
│   ├── wealth-transfer-SKILL.md
│   └── custom-spending-model-SKILL.md
│
├── examples/                # Example files and sample data
│   ├── reports/            # Example report outputs
│   │   └── test-report-with-charts.pdf
│   └── stmt.pdf
│
├── systemd/                 # Systemd service files
│   ├── rps-backup.service  # Backup service
│   └── rps-backup.timer    # Backup timer
│
├── apache2/                 # Apache configuration
│   └── rps.pan2.app.conf
│
├── docker/                  # Docker configuration (if used)
│
├── backups/                 # Backup storage (gitignored)
│   ├── README.md
│   ├── data/               # Data-only backups
│   ├── system/             # System-only backups
│   └── selective/          # Selective profile/group backups (JSON)
│
├── data/                    # Runtime data (gitignored)
│   └── planning.db         # SQLite database
│
└── logs/                    # Log files (gitignored)
    ├── app.log
    └── backup.log
```

## Key Directories

### `src/` - Application Source
All application code organized by layer:
- **routes/** - API endpoints (Flask blueprints)
- **models/** - Domain models (SQLite persistence)
- **services/** - Business logic and external integrations
- **static/** - Frontend code (vanilla JS, ES6 modules)
- **auth/** - Authentication and authorization
- **schemas/** - Request/response validation

### `docs/` - Documentation
All project documentation organized by category:
- **guides/** - User-facing guides and tutorials
- **reference/** - Technical reference documentation
- **deployment/** - Infrastructure and deployment
- **security/** - Security documentation
- **ai-integration/** - AI service setup and usage
- **architecture/** - System design and architecture
- **reviews/** - Code reviews and technical analyses

### `bin/` - Executable Scripts
Command-line tools for development and operations:
- Server management (`start`, `deploy`)
- Backup operations (`backup`, `backup-data`, `backup-system`, `restore`)
- Admin tasks (`create-admin-account`, `promote-admin`)
- Utilities (`bump-version`, `setup-api-keys`)

### `scripts/` - Administrative Scripts
Python scripts for database operations and one-off tasks:
- User management scripts
- Database migration helpers
- Development utilities

### `tests/` - Test Suite
Comprehensive test coverage:
- Unit tests for models, services, routes
- Integration tests
- API tests
- Test utilities and fixtures

## Configuration Files

**Root Directory:**
- `alembic.ini` - Database migration configuration
- `requirements.txt` - Python dependencies
- `.env.production.example` - Environment variable template
- `.gitignore` - Git ignore rules
- `.backup_config` - Backup system defaults

## Important Notes

### Documentation Organization
- All markdown documentation has been moved from root to `docs/`
- Only `README.md` and `CLAUDE.md` remain in root
- Documentation paths updated in code (see `src/routes/admin.py`)

### Test Files
- All test scripts moved to `tests/` directory
- Includes both Python and shell test files

### Utility Scripts
- Deployment and utility scripts consolidated in `bin/`
- Administrative Python scripts in `scripts/`

### Example Files
- Example PDFs and sample data in `examples/`
- Test reports in `examples/reports/`

### Ignored Directories
The following directories are gitignored:
- `data/` - Runtime database and data files
- `logs/` - Log files
- `backups/` - Backup archives (except README.md)
- `venv/` - Python virtual environment
- `__pycache__/` - Python bytecode
- `.pytest_cache/` - Pytest cache
- `.claude/` - Claude Code cache

## Navigation Tips

**Finding Documentation:**
- Start with `README.md` for project overview
- Check `docs/START-HERE.md` for getting started
- See `docs/guides/QUICKSTART.md` for quick setup
- Reference `docs/BACKUP_GUIDE.md` for backup operations
- Consult `docs/deployment/DEPLOYMENT.md` for production setup

**Finding Code:**
- API endpoints: `src/routes/`
- Business logic: `src/services/`
- Data models: `src/models/`
- Frontend UI: `src/static/js/components/`
- Tests: `tests/`

**Common Tasks:**
- Run dev server: `./bin/start`
- Deploy to production: `sudo ./bin/deploy`
- Create backup: `./bin/backup`
- Restore from backup: `./bin/restore`
- Bump version: `./bin/bump-version X.X.X "message"`
- Create admin user: `./bin/create-admin-account`

## Version History

- **v3.9.151** (2026-01-30) - Documentation updates, Cash Flow fixes, and security hardening
- **v3.9.x** (2026-01-23+) - Monte Carlo tax engine improvements
- **v3.8.168** (2026-01-22) - Selective backup: backup/restore specific profiles or groups
- **v3.8.167** (2026-01-22) - Per-user backup and restore
- **v3.8.70** (2026-01-20) - Project structure reorganization
- **v3.8.69** (2026-01-20) - Backup restore functionality
- **v3.8.67** (2026-01-20) - Separate data/system backups
- **v3.8.66** (2026-01-20) - Comprehensive backup system

See `docs/RELEASE_NOTES_v2.md` for v2.0 release notes.
