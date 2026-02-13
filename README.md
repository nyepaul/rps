# Retirement & Wealth Planning System (RPS)

A local-first financial planning application for Monte Carlo retirement simulations, tax optimization, and AI-powered strategic advice.

> **Disclaimer**: This system is for organizing information and exploring scenarios. Always consult licensed financial advisors, CPAs, and attorneys for actual decisions.

## Features

- **Monte Carlo Simulations** — 10,000-run projections with granular tax modeling
- **AI Strategic Advisor** — Personalized guidance via Gemini, Claude, OpenAI, and Local LLMs (Ollama, LM Studio).
- **Tax Optimization** — Roth conversion windows, withdrawal sequencing, RMD planning
- **Income Stream Modeling** — Pensions, Social Security, rental income with survivor benefits
- **Real-time Dashboard** — Adjust parameters and see immediate impact on success rates
- **Roadmap & Life Events** — Strategic planning for major life changes
- **Action Item Tracking** — Convert AI recommendations into executable tasks

## Quick Start

```bash
# Install local git hooks (recommended)
./bin/setup-git-hooks

# Configure AI features (optional)
./bin/setup-api-keys

# Start the server
./bin/start

# Open http://127.0.0.1:5137
```

## Prerequisites

- Python 3.12+
- `pip` (for dependency installation in `./bin/start`)
- Optional: `cloudflared` (only needed for `./bin/manage tunnel`)

## Commands

| Command | Description |
|---------|-------------|
| `./bin/start` | Start application (creates venv, installs deps) |
| `./bin/check-env-consistency` | Verify dev/prod dependency config is aligned |
| `./bin/check-no-secrets` | Scan tracked files for secret-like tokens |
| `./bin/check-repo-hygiene` | Block committing generated/local artifacts |
| `./bin/check-quality-gates` | Run CI-equivalent quality gates locally |
| `./bin/setup-git-hooks` | Enable local pre-push hook checks (`.githooks`) |
| `sudo ./bin/deploy` | Deploy latest `main` to production (server environment) |
| `./bin/manage stop` | Stop the application |
| `./bin/manage status` | Check system health |
| `./bin/manage backup` | Backup SQLite database |
| `./bin/restore` | Restore from backup archive |
| `./bin/backup-data` | Create data-only backup |
| `./bin/backup-system` | Create system/config backup |
| `./bin/setup-backup-timer` | Configure scheduled automated backups |
| `./bin/bump-version <x.y.z> "<notes>"` | Update release version + cache-busting metadata |
| `./bin/manage tunnel` | Create secure public URL |

## Release Workflow

Use `TBPD` for releases:
1. **Test**: `./bin/check-quality-gates`
2. **Bump**: `./bin/bump-version <x.y.z> "<notes>"`
3. **Push**: `git push origin main`
4. **Deploy**: `sudo ./bin/deploy`

## Architecture

| Layer | Technology |
|-------|------------|
| Backend | Python/Flask with SQLite |
| Frontend | Vanilla JS, ES6 modules, Chart.js |
| AI | Multi-provider (Gemini, Claude, OpenAI, Local LLMs) |
| Storage | Local SQLite (`data/planning.db`) |
| Security | AES-256-GCM encryption, bcrypt, rate limiting |

## Documentation

- [Quick Start Guide](docs/guides/QUICKSTART.md)
- [Developer Guide](docs/guides/DEVELOPER_GUIDE.md)
- [Admin System](docs/reference/ADMIN_SYSTEM_GUIDE.md)
- [Deployment](docs/deployment/DEPLOYMENT.md)
- [Security](docs/security/SYSTEM_SECURITY_DOCUMENTATION.md)
- [Backup & Restore](docs/guides/BACKUP_GUIDE.md)

## Environment Variables (System/Test)

The following variables are used for system-level configuration or testing. **User API keys should be configured via the Web UI for security.**

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API access (Fallback/Test) |
| `ANTHROPIC_API_KEY` | Claude API access (Fallback/Test) |
| `SECRET_KEY` | Flask session encryption |
| `ENCRYPTION_KEY` | Data encryption (required in production) |

---

**Version**: 3.9.288 | **Last Updated**: 2026-02-12
