# Documentation Index

Welcome to the pan-rps documentation. This directory contains comprehensive guides for using, understanding, and maintaining the Retirement Planning System.

## Quick Navigation

### Getting Started
- **[START-HERE.md](START-HERE.md)** - Welcome guide for new users
- **[../QUICKSTART.md](../QUICKSTART.md)** - 5-minute quick start guide
- **[../README.md](../README.md)** - Project overview and main documentation

### Architecture & Technical
- **[architecture/SYSTEM-OVERVIEW.md](architecture/SYSTEM-OVERVIEW.md)** - Complete system architecture, features, and technical details
- **[ai-integration/CLAUDE.md](ai-integration/CLAUDE.md)** - API reference and development guide for Claude Code assistants
- **[ai-integration/GEMINI.md](ai-integration/GEMINI.md)** - Gemini integration notes
- **[ai-integration/SAMPLE-PROFILE.md](ai-integration/SAMPLE-PROFILE.md)** - Sample profile documentation

### User Guides
- **[guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md)** - Common issues and solutions
- **[guides/YOUR-ACTION-PLAN.md](guides/YOUR-ACTION-PLAN.md)** - Personalized 30-year implementation timeline
- **[guides/PENSION-CLARIFICATION.md](guides/PENSION-CLARIFICATION.md)** - Pension modeling notes
- **[RESTART-INSTRUCTIONS.md](RESTART-INSTRUCTIONS.md)** - How to restart the application

### Reviews & Analysis
- **[reviews/](reviews/)** - Code reviews, assessments, and analysis reports

## Directory Structure

This project follows a modern, state-of-the-art layout:

\`\`\`
pan-rps/
├── bin/                      # Executable scripts
│   ├── start                 # Start the application
│   ├── manage                # Management commands
│   └── setup-api-keys        # Configure AI API keys
├── src/                      # Application source code
│   ├── app.py               # Main Flask application
│   └── static/              # Frontend assets
├── tests/                    # Test scripts
├── docker/                   # Docker configuration
├── docs/                     # Documentation (you are here)
├── examples/                 # Example configurations
├── skills/                   # AI domain knowledge
├── data/                     # SQLite database
└── logs/                     # Application logs
\`\`\`

## Common Commands

\`\`\`bash
# Start the application
./bin/start

# Management commands
./bin/manage status    # Check application status
./bin/manage backup    # Backup database
./bin/manage stop      # Stop application

# Testing
./tests/test-api.sh            # Run basic API tests
./tests/test-all-features.sh   # Run comprehensive test suite
\`\`\`

## Need Help?

1. Check [guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md) for common issues
2. Review [architecture/SYSTEM-OVERVIEW.md](architecture/SYSTEM-OVERVIEW.md) for technical details
3. See [START-HERE.md](START-HERE.md) for a guided tour

---

**Last Updated**: January 2026  
**Structure Version**: 2.0 (Modernized January 2026)
