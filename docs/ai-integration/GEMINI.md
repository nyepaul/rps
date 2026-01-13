# Retirement & Wealth Planning System

A comprehensive, local-first financial planning application designed for retirement scenario modeling, tax optimization, and estate planning.

## Project Overview

*   **Purpose:** To provide a secure, private environment for modeling complex retirement scenarios (Monte Carlo), optimizing Social Security strategies, planning Roth conversions, and tracking estate planning action items.
*   **Architecture:**
    *   **Backend:** Python (Flask) API serving as the calculation engine and data manager.
    *   **Frontend:** Single-page application (served via `index.html`) interacting with the Flask API.
    *   **Database:** SQLite (`webapp/data/planning.db`) for local persistence of profiles and scenarios.
    *   **Knowledge Base:** A "Skills" directory containing markdown files that define the financial logic and best practices.
*   **Key Features:**
    *   Monte Carlo Simulation (10,000 runs).
    *   Social Security Optimization (Claiming age analysis).
    *   Roth Conversion Strategy (Tax bracket filling).
    *   Wealth Transfer & Estate Planning tracking.

## Building and Running

### Prerequisites
*   Python 3.x
*   Docker (optional, for containerized execution)

### Quick Start
The easiest way to run the application is using the provided shell scripts in the root directory.

```bash
# Make the script executable if needed
chmod +x start.sh

# Start the application (local Python environment)
./start.sh
```

The application will be accessible at `http://127.0.0.1:8080`.

### Management Commands
The `manage.sh` script provides a unified interface for common tasks:

```bash
./manage.sh start           # Start application locally
./manage.sh start-docker    # Start in Docker container
./manage.sh stop            # Stop the application
./manage.sh status          # Check if running
./manage.sh tunnel          # Expose via Cloudflare tunnel (for sharing)
./manage.sh backup          # Backup the SQLite database
```

### Manual Development Setup

1.  **Navigate to webapp:**
    ```bash
    cd webapp
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run Flask App:**
    ```bash
    python app.py
    ```

## Directory Structure

*   `webapp/`: Contains the source code for the application.
    *   `app.py`: Main Flask application, API endpoints, and financial models.
    *   `index.html`: The frontend user interface.
    *   `data/`: Stores the `planning.db` SQLite database.
    *   `requirements.txt`: Python dependencies.
*   `skills/`: specific knowledge domains (Markdown format) used for reference and context.
    *   `retirement-planning-SKILL.md`
    *   `tax-strategy-SKILL.md`
    *   `estate-legal-SKILL.md`
    *   `wealth-transfer-SKILL.md`
*   `docs/`: Documentation and analysis reports.
*   `scripts/`: (If present) specific utility scripts.

## Development Conventions

*   **Local-First:** All data is stored locally in SQLite to ensure privacy.
*   **Stateless logic:** Financial calculations (Monte Carlo, etc.) are performed on-the-fly based on the profile data.
*   **API-Driven:** The frontend communicates strictly via JSON APIs defined in `app.py`.
