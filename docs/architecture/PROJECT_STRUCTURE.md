# RPS Project Structure

This document describes the organization of the Retirement Planning System (RPS) codebase.

**Last Updated:** 2026-01-31 (v3.9.151 reorganized)

## Directory Structure

```
rps/
├── README.md                  # Main project documentation
├── CLAUDE.md                  # Claude Code integration guide
├── GEMINI.md                  # Gemini integration guide
├── .gitignore                 # Git ignore rules
│
├── bin/                      # Executable scripts and utilities
│   ├── start                 # Start development server
│   ├── deploy                # Production deployment
│   ├── backup                # Full backup script
│   ├── backup-data           # Data-only backup
│   ├── backup-incremental    # Incremental data backup
│   ├── backup-system         # System-only backup
│   ├── restore               # Restore from backup
│   ├── setup-backup-timer    # Install automated backups
│   ├── bump-version          # Version management
│   ├── setup-api-keys        # API key configuration
│   ├── manage                # Management wrapper
│   ├── create-admin-account  # Create admin user
│   ├── reset-admin-password  # Reset admin password
│   ├── promote-admin         # Promote user to admin
│   ├── ai_functions_extra.sh # AI helper functions
│   ├── ai_tools_menu.sh      # AI tools menu
│   ├── fix_and_commit.sh     # Git helper script
│   ├── fix-deployment.sh     # Deployment fixes
│   ├── fix-install.sh        # Installation fixes
│   └── run_server.py         # Development server
│
├── config/                   # Configuration files
│   ├── alembic.ini           # Database migration configuration
│   ├── pytest.ini            # Test configuration
│   ├── requirements.txt      # Production dependencies
│   ├── requirements-dev.txt  # Development dependencies
│   ├── eslint.config.js      # ESLint configuration
│   └── .backup_config        # Backup system defaults
│
├── scripts/                  # Database and administrative scripts
│   ├── create_admin.py
│   ├── create_demo_account.py
│   ├── reset_admin_password.py
│   ├── add_super_admin_flag.py
│   ├── copy_demo_account.py
│   ├── check_api_key.py      # API key verification
│   └── update_admin_pw_production.py
│
├── src/                      # Application source code
│   ├── app.py               # Flask application factory
│   │
│   ├── auth/                # Authentication and authorization
│   ├── routes/              # API endpoints
│   ├── models/              # Domain models
│   ├── services/            # Business logic
│   ├── schemas/             # Pydantic validation schemas
│   ├── database/            # Database connection management
│   ├── middleware/          # Flask middleware
│   ├── utils/               # Utility functions
│   ├── static/              # Frontend assets
│   ├── requirements.txt     # Component dependencies
│   └── __version__.py       # Version information
│
├── docs/                    # Documentation
│   ├── README.md            # Documentation index
│   │
│   ├── guides/              # User guides and logs
│   │   ├── START-HERE.md
│   │   ├── QUICKSTART.md
│   │   ├── BACKUP_GUIDE.md
│   │   ├── IMPLEMENTATION_STATUS.md
│   │   ├── IMPROVEMENT_LOG.md
│   │   └── TROUBLESHOOTING.md
│   │
│   ├── reference/           # Technical reference
│   │   ├── RELEASE_NOTES_*.md
│   │   ├── FINANCIAL_ANALYSIS_REPORT.md
│   │   └── ...
│   │
│   ├── deployment/          # Deployment documentation
│   │   ├── DEPLOYMENT.md
│   │   └── ...
│   │
│   ├── security/            # Security documentation
│   │   ├── SYSTEM_SECURITY_DOCUMENTATION.md
│   │   └── ...
│   │
│   ├── ai-integration/      # AI service integration
│   ├── architecture/        # System architecture
│   ├── reviews/             # Code reviews and analyses
│   ├── testing/             # Test documentation
│   └── archive/             # Archived documents
│
├── tests/                   # Test suite
│   ├── conftest.py         # Test fixtures
│   └── ...
│
├── examples/                # Example files and sample data
│   ├── .env.production.example
│   ├── .env.test
│   └── ...
│
├── test_results/            # Test and scan result artifacts
│   ├── bandit_*.json
│   ├── comprehensive_test_report_*.txt
│   └── ...
│
├── logs/                    # Application logs
│   ├── app.log
│   ├── dev-server.log
│   └── ...
│
└── backups/                 # Backup storage (gitignored)
    ├── data/               # Data-only backups
    ├── system/             # System-only backups
    └── incremental/        # Incremental data backups
```

## Key Directories

### `config/` - System Configuration
- `alembic.ini` - Database migrations
- `pytest.ini` - Test runner settings
- `requirements.txt` - Main application dependencies
- `eslint.config.js` - JS linting rules
- `.backup_config` - Backup system defaults

### `docs/` - Documentation
All project documentation organized by category (guides, reference, deployment, security, testing, archive).

### `test_results/` - Results and Artifacts
Static analysis results, test logs, and security assessments.

### `logs/` - Runtime Logs
Consolidated directory for all application and script logs.

## Configuration Files

**Root Directory:**
- `.gitignore` - Git ignore rules
- `README.md`, `CLAUDE.md`, `GEMINI.md` - Essential project entry points

**`config/` Directory:**
- All tool-specific `.ini`, `.js`, and `.txt` dependency files.

## Important Notes

### Documentation Organization
- All markdown documentation has been moved from root to `docs/` or its subdirectories.
- Only essential entry points remain in root.

### Scripts
- Executable scripts and helper shell scripts are in `bin/`.
- Administrative Python scripts are in `scripts/`.

### Compatibility
- Deployment scripts (`bin/deploy`) and test runners (`tests/run_comprehensive_tests.sh`) have been updated to reference configurations in the new `config/` directory.
- Alembic and Pytest commands now require explicit config paths (e.g., `alembic -c config/alembic.ini`).
