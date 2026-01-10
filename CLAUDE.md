# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A comprehensive retirement and wealth planning system built with Flask (Python backend) and vanilla HTML/CSS/JS frontend. The system performs Monte Carlo simulations, Social Security optimization, Roth conversion analysis, and wealth transfer planning. All data is stored locally in SQLite with no external dependencies.

## Architecture

### Core Components

**Backend (webapp/app.py)**
- Flask API server with CORS enabled
- Financial models: `RetirementModel`, `FinancialProfile`, `Person` dataclasses
- Monte Carlo simulation engine (10,000 scenarios)
- Social Security optimization (9 claiming strategies)
- Roth conversion opportunity calculator
- Wealth transfer strategy planner
- SQLite database with three tables: `profile`, `scenarios`, `action_items`

**Frontend (webapp/index.html)**
- Single-page application with tab-based navigation
- Pure vanilla JavaScript (no frameworks)
- Tabs: Dashboard, Profile & Data, Analysis, Action Items
- Local storage for temporary data, SQLite for persistence

**Planning Skills (skills/)**
Four comprehensive markdown files containing frameworks and checklists:
- `retirement-planning-SKILL.md`: Withdrawal strategies, longevity planning
- `estate-legal-SKILL.md`: Trusts, wills, POAs, probate avoidance
- `tax-strategy-SKILL.md`: RMD planning, Roth conversions, tax optimization
- `wealth-transfer-SKILL.md`: Annual gifting, 529 plans, estate tax strategies

### Data Flow

1. User inputs financial data in frontend → POST to `/api/profile`
2. Frontend requests analysis → POST to `/api/analysis` with profile data
3. Backend runs Monte Carlo, SS optimization, Roth analysis, wealth transfer
4. Results returned to frontend and displayed in charts/tables
5. Action items generated from analysis → stored in SQLite

### Key Architecture Patterns

**Dataclass-Based Models**: The `Person`, `FinancialProfile` classes use Python dataclasses for type hints and automatic init. The `RetirementModel` class contains all financial calculation methods.

**Stateless Analysis**: Each call to `/api/analysis` is stateless - it receives all profile data, runs calculations, and returns results. No session state maintained between calls.

**Database Usage Pattern**: SQLite used directly via `sqlite3` module (not SQLAlchemy ORM). Profile stored as JSON blob for flexibility. Only action_items table uses structured columns.

**Frontend-Backend Separation**: Frontend is pure static HTML/JS. Backend serves both API (JSON) and static files. CORS enabled to support file:// protocol during development.

### Database Schema

**profile table**: Stores single user profile as JSON blob
- `id`, `name`, `birth_date`, `retirement_date`, `data` (JSON), `updated_at`

**scenarios table**: Stores analysis runs (currently unused)
- `id`, `name`, `parameters` (JSON), `results` (JSON), `created_at`

**action_items table**: Tracks tasks with priorities
- `id`, `category`, `description`, `priority`, `status`, `due_date`, `created_at`

## Commands

### Start the Application

```bash
# Recommended: Simple start with virtual environment
./manage.sh start
# or directly:
./start.sh

# Alternative: Docker mode
./manage.sh start-docker
```

Access at: `http://127.0.0.1:8080` (serves both API and static files)

**IMPORTANT**: Always use `http://127.0.0.1:8080` in your browser, NOT `file://` protocol. The Flask app serves both the API and the static HTML/JS/CSS files.

Note: The app runs in the foreground. Use Ctrl+C to stop, or run in a separate terminal.

### Stop the Application

```bash
./manage.sh stop
```

### Development

```bash
# Check application status
./manage.sh status

# View logs
./manage.sh logs

# Restart after changes
./manage.sh restart
```

### Testing

Run the comprehensive test suite (app must be running first):

```bash
./test-api.sh
```

This script tests:
- Health check endpoint
- Profile retrieval
- Financial analysis (Monte Carlo simulation)
- Action items management
- Auto-generation of action items

For debugging, run the Flask app directly:

```bash
cd webapp
source venv/bin/activate
python app.py
```

Test individual API endpoints with curl (examples in test-api.sh):

```bash
# Health check
curl http://127.0.0.1:8080/health

# Get profile
curl http://127.0.0.1:8080/api/profile

# Run analysis (requires profile data JSON)
curl -X POST http://127.0.0.1:8080/api/analysis \
  -H "Content-Type: application/json" \
  -d @/tmp/test-profile.json
```

### Data Management

```bash
# Backup database
./manage.sh backup

# Restore from backup
./manage.sh restore

# View available skills
./manage.sh skills
```

### Public Access

```bash
# Create temporary Cloudflare tunnel (HTTPS)
./manage.sh tunnel
```

## Key Financial Models

### Monte Carlo Simulation

Location: `app.py:94-152`

- Runs 10,000 scenarios over 30 years
- Models sequence of returns risk with random normal distribution
- Returns mean adjusted by asset allocation (stocks vs bonds)
- Calculates success rate, median balance, 5th/95th percentiles
- Important: Returns `annual_withdrawal_need` which is shortfall after guaranteed income

Key parameters:
- `returns_mean_adj`: Based on stock/bond allocation
- `returns_std_adj`: Volatility based on allocation
- `annual_shortfall`: Target income minus Social Security/pension
- Inflation: 3% ± 1% per year

### Social Security Optimization

Location: `app.py:168-207`

Compares 9 strategies (3×3 grid of claiming ages: 62, 67, 70)
- Early (62): 0.70 multiplier
- Full Retirement Age (67): 1.0 multiplier
- Delayed (70): 1.24 multiplier
- Returns lifetime NPV using 3% discount rate over 30 years

### Roth Conversion Analysis

Location: `app.py:209-253`

Identifies conversion window between retirement and RMD age (73)
- Calculates available space in 12% and 22% tax brackets
- Assumes standard deduction + Social Security income as baseline
- Returns annual conversion amounts and total tax cost
- Only runs if person has years until RMD

### Wealth Transfer Strategy

Location: `app.py:255-278`

Annual exclusion gifts calculation:
- $18,000 per person per child (2024 limit)
- Both spouses can gift to each child
- Calculates lifetime capacity until age 90
- Returns percentage of net worth transferred

## Important Constants & Assumptions

### Tax Brackets (2024)
- Standard Deduction (MFJ): $29,200 + additional $3,100 (over 65)
- 12% bracket: Up to $94,300
- 22% bracket: $94,300 to $201,050

### Social Security
- FRA benefits: Person1 $3,700/mo, Person2 $3,300/mo
- Delayed (70) combined: $8,680/mo = $104,120/year
- Built into code at `app.py:112`

### RMD Age
- Required Minimum Distributions begin at age 73 (SECURE Act 2.0)
- RMD factors table at `app.py:155-160`

### Monte Carlo Defaults
- Simulations: 10,000
- Years: 30
- Stock returns: 10% mean, 18% std dev
- Bond returns: 4% mean, 6% std dev
- Inflation: 3% mean, 1% std dev

## File Organization

```
retirement-planning-system/
├── manage.sh                    # Main management script
├── start.sh                     # Simple startup script
├── test-api.sh                  # API test suite
├── webapp/
│   ├── app.py                   # Flask backend (530 lines)
│   ├── index.html               # Frontend SPA
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container build
│   ├── venv/                    # Virtual environment (gitignored)
│   └── data/
│       └── planning.db          # SQLite database
├── skills/                      # Planning frameworks (4 files)
└── docs/                        # Additional documentation
```

## Development Notes

### Virtual Environment Setup

The `start.sh` script automatically:
1. Creates `webapp/venv/` if it doesn't exist
2. Installs dependencies from `requirements.txt`
3. Creates `webapp/data/` directory
4. Initializes SQLite database on first run

Manual setup (if needed):
```bash
cd webapp
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Adding New Financial Models

1. Add method to `RetirementModel` class in `app.py`
2. Call from `/api/analysis` endpoint (line 310+)
3. Return results in analysis JSON response
4. Update frontend to display results

### Database Location

The app auto-detects environment and sets DB path accordingly:
- Docker: `/app/data/planning.db` (volume-mounted)
- Non-Docker: `./data/planning.db` (relative to webapp/)

See `app.py:22-26` for the detection logic.

### Database Migrations

No migration system. To modify schema:
1. Update `init_db()` function at `app.py:32`
2. Delete `data/planning.db` (or manually ALTER TABLE)
3. Restart app to recreate with new schema
4. Consider adding migration logic before production use

### API Endpoints

All routes defined in `app.py`:
- `GET /` - Serves index.html
- `GET /api/profile` - Retrieve saved profile
- `POST /api/profile` - Save profile data (overwrites existing)
- `POST /api/analysis` - Run financial analysis
- `GET /api/action-items` - Get all action items
- `POST /api/action-items` - Create action item
- `PUT /api/action-items` - Update action item status
- `DELETE /api/action-items` - Delete action item
- `POST /api/generate-action-items` - Auto-generate from analysis (deduplicates by category+description)
- `GET /health` - Health check endpoint

**Deduplication**: The `/api/generate-action-items` endpoint checks for existing action items with the same category and description before inserting. This prevents duplicates when called multiple times.

### Security Considerations

- **Local only**: No authentication required (runs on localhost)
- **Cloudflare tunnel**: Creates temporary public URL (use cautiously)
- **Database**: Plain SQLite, no encryption at rest
- **No external APIs**: All calculations run locally
- **CORS enabled**: Necessary for file:// protocol access

### Performance

- Monte Carlo with 10,000 simulations takes ~1-2 seconds
- Database queries are fast (single-user, local SQLite)
- No caching implemented (not needed for single-user workload)
- Frontend loads all data on tab switch (acceptable for small dataset)

## Dependencies

### Python (requirements.txt)

- `flask==3.0.0` - Web framework
- `flask-cors==4.0.0` - CORS support
- `sqlalchemy==2.0.23` - Not actively used (direct sqlite3 calls instead)
- `numpy==1.26.2` - Random sampling, statistics
- `pandas==2.1.4` - Not actively used in current code
- `matplotlib==3.8.2` - Not actively used (no charts generated server-side)
- `reportlab==4.0.7` - PDF generation (imported but not implemented)
- `cryptography==41.0.7` - Not actively used

**Note**: Some dependencies (SQLAlchemy, pandas, matplotlib, reportlab, cryptography) are installed but not used in current implementation. Can be removed or will be used for future features.

### Frontend

Pure vanilla JavaScript, no build step required. Uses:
- Fetch API for HTTP requests
- CSS Grid and Flexbox for layout
- No external CSS frameworks

## Common Tasks

### Updating Person-Specific Data

Hardcoded values in `app.py` that may need updating when personalizing:
- Line 112: `annual_income = 8680 * 12` - Social Security delayed income ($104,160/year)
- Line 215: `current_income = 390000` - Used in Roth conversion analysis
- Line 217: `pension_annual = 120000` - Annual pension income (not lump sum)
- Line 363: `guaranteed_income_delayed = 8680 * 12` - Returned in analysis results

Note: These values are specific to the current user profile and should be updated when adapting the system for different users, or refactored to come from the profile data instead.

### Adding New Action Item Categories

Categories are free-form strings. Common ones used in `generate_action_items()`:
- "Tax Planning"
- "Estate Planning"
- "Wealth Transfer"
- "Insurance"
- "Retirement Planning"

### Modifying Monte Carlo Parameters

Edit `monte_carlo_simulation()` method at `app.py:94`:
- `simulations` parameter (default: 10,000)
- `returns_mean` and `returns_std` (lines 95-96)
- `inflation` mean/std (line 127)

### Development Workflow

Making changes to backend:
1. Stop the app (Ctrl+C if running in foreground, or `./manage.sh stop`)
2. Edit `webapp/app.py`
3. Restart: `./manage.sh restart` (or `./start.sh`)
4. Test with `./test-api.sh` or manual curl commands
5. Flask auto-reloads in debug mode, but full restart recommended for reliability

Making changes to frontend:
1. Edit `webapp/index.html` (JS and CSS are inline)
2. Refresh browser at `http://127.0.0.1:8080`
3. No restart needed (static files served directly)
4. Use browser DevTools console for debugging JavaScript

### First-Time Setup on New Machine

1. Update hardcoded path in `manage.sh` line 3:
   ```bash
   PROJECT_DIR="/Users/paul/src/retirement-planning-system"  # Update to your actual path
   ```
2. Make scripts executable:
   ```bash
   chmod +x manage.sh start.sh test-api.sh
   ```
3. Run the startup script:
   ```bash
   ./start.sh
   ```

## Known Issues & Limitations

1. **Pension handling**: Pension income hardcoded as $120k/year at line 217 (not in dataclass)
2. **Unused dependencies**: Several packages installed but not used (SQLAlchemy, pandas, matplotlib, reportlab, cryptography)
3. **No input validation**: API endpoints trust client-sent data
4. **Single profile**: Only one profile stored (POST to /api/profile overwrites existing)
5. **No authentication**: Suitable for local use only
6. **Hardcoded paths**: `manage.sh` contains hardcoded path at line 3 - update `PROJECT_DIR` variable to match your actual installation path
7. **Limited test coverage**: Only basic API tests in `test-api.sh`, no unit tests
8. **Hardcoded assumptions**: SS benefits, pension amounts, and current income in app.py (lines 112, 215-217)
9. **No frontend build process**: All JS/CSS inline in index.html

## Working with Skills

Skills are markdown files containing planning frameworks. To update:

1. Edit files directly in `skills/` directory
2. No restart needed (static files)
3. Reference them in auto-generated action items
4. View list: `./manage.sh skills`

Each skill contains:
- Frameworks and methodologies
- Checklists and templates
- Common mistakes to avoid
- Professional coordination guidance
