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
./bin/start
```

The application will be accessible at `http://127.0.0.1:8080`.

### Management Commands
The `bin/manage` script provides a unified interface for common tasks:

```bash
./bin/manage start           # Start application locally
./bin/manage start-docker    # Start in Docker container
./bin/manage stop            # Stop the application
./bin/manage status          # Check if running
./bin/manage tunnel          # Expose via Cloudflare tunnel (for sharing)
./bin/manage backup          # Backup the SQLite database
```

### Manual Development Setup

1.  **Navigate to project root:**
    ```bash
    cd panrps
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run Flask App:**
    ```bash
    python src/app.py
    ```

## Directory Structure

*   `src/`: Source code for the application.
    *   `app.py`: Main Flask application factory.
    *   `models/`: Database models (Profile, Scenario, ActionItem) handling encryption and persistence.
    *   `routes/`: API endpoint definitions.
    *   `services/`: Business logic and calculation engines.
    *   `static/`: Frontend assets (HTML, JS, CSS).
*   `data/`: Stores the `planning.db` SQLite database (created at runtime).
*   `skills/`: Financial knowledge base (Markdown format).
*   `docs/`: Documentation and analysis reports.
*   `bin/`: Utility scripts for management and startup.
*   `tests/`: Test suite.

## Development Conventions

*   **Local-First:** All data is stored locally in SQLite to ensure privacy.
*   **Encryption:** Sensitive fields in `Profile`, `Scenario`, and `ActionItem` are encrypted at rest using `src/services/encryption_service.py`.
*   **Stateless Logic:** Financial calculations (Monte Carlo, etc.) are performed on-the-fly based on the profile data.
*   **API-Driven:** The frontend communicates strictly via JSON APIs defined in `src/routes/`.
