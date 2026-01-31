# RPS Developer Guide

**Technical implementation details for the Welcome Screen, Wizard, Learn Hub, and Progression System**

---

## Architecture Overview

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Python 3.12+, Flask 3.x
- **Database**: SQLite3
- **Charts**: Chart.js 4.x (CDN)
- **Package Manager**: pip (Python)

### Design Principles

1. **Single-Page Application**: Modular ES6 architecture with 60+ JS files
2. **Component-Based**: UI organized into reusable components (`src/static/js/components/`)
3. **localStorage for Ephemeral State**: Wizard progress and learning tracking
4. **Backend for Persistence**: Profiles stored in SQLite with AES-256-GCM encryption
5. **Security by Default**: Pydantic validation on backend, input sanitization on frontend

---

## Project Structure

```
rps/
├── bin/                          # Executable scripts
├── config/                       # Centralized tool configurations
│   ├── alembic.ini
│   ├── pytest.ini
│   └── requirements.txt
├── data/                         # SQLite database (encrypted)
├── docs/                         # Categorized documentation
├── scripts/                      # Administrative Python scripts
├── src/                          # Application source code
│   ├── app.py                    # Flask application factory
│   ├── routes/                   # API endpoints
│   ├── services/                 # Business logic
│   └── static/                   # Frontend SPA
├── skills/                       # Educational markdown files
├── test_results/                 # Test and scan results
├── tests/                        # Test suite
└── logs/                         # Consolidated logs
```

---

## Frontend Architecture

The frontend uses a modular ES6 architecture with 60+ JavaScript files organized by domain.

### Module Structure

```
src/static/js/
├── main.js                 # Application entry point
├── config.js               # Configuration and version
├── api/                    # API client modules
│   ├── client.js           # Base HTTP client
│   ├── profiles.js         # Profile CRUD
│   ├── analysis.js         # Monte Carlo analysis
│   ├── advisor.js          # AI advisor
│   └── ...
├── components/             # UI components (one per tab/feature)
│   ├── dashboard/          # Dashboard tab
│   ├── analysis/           # Analysis tab
│   ├── profile/            # Profile tab
│   ├── admin/              # Admin dashboard
│   ├── assets/             # Asset management
│   └── ...
├── state/
│   └── store.js            # Global state management
└── utils/                  # Shared utilities
    ├── formatters.js       # Number/date formatting
    ├── charts.js           # Chart.js helpers
    └── dom.js              # DOM utilities
```

### Entry Point (main.js)

```javascript
import { initDashboard } from './components/dashboard/dashboard-tab.js';
import { initAnalysis } from './components/analysis/analysis-tab.js';
import { initProfile } from './components/profile/profile-tab.js';
// ... more imports

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});
```

### Component Pattern

Each component exports an `init` function and manages its own state:

```javascript
// components/dashboard/dashboard-tab.js
import { apiClient } from '../../api/client.js';
import { store } from '../../state/store.js';

export function initDashboard() {
    // Setup event listeners
    // Render initial state
}

export async function runAnalysis() {
    const result = await apiClient.post('/api/analysis', store.getProfile());
    renderResults(result);
}
```

### Key JavaScript Functions

#### Tab System

```javascript
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all tab buttons
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Activate selected button
    const selectedBtn = document.querySelector(`button[onclick="showTab('${tabName}')"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}
```

#### Profile Loading

```javascript
async function loadProfile(profileName = 'main') {
    try {
        const response = await fetch(`${API_URL}/profile/${encodeURIComponent(profileName)}`);

        if (!response.ok) {
            throw new Error(`Failed to load profile (Status: ${response.status})`);
        }

        const data = await response.json();

        // Populate form fields
        document.getElementById('p1-name').value = data.person1.name;
        document.getElementById('p1-birth').value = data.person1.birth_date;
        // ... more fields

        // Load complex data structures
        investmentTypes = data.investment_types || [];
        incomeStreams = data.income_streams || [];
        homeProperties = data.home_properties || [];

        // Render tables
        renderInvestmentTypes();
        renderIncomeStreams();
        renderHomeProperties();

        // Update progress tracking
        previousLevel = getUserLevel();
        updateProgressIndicator();

        // Run analysis
        runAnalysis();

        // Show success notification
        showNotification(`✓ Profile "${profileName}" loaded successfully`, 'success');
    } catch (error) {
        showNotification(`Error loading profile: ${error.message}`, 'error');
    }
}
```

#### Wizard State Management

```javascript
// Wizard configuration
const wizardSteps = [
    { id: 'welcome', title: 'Getting Started', fields: [] },
    { id: 'profile_name', title: 'Profile Name', fields: ['profile_name'] },
    { id: 'person1_basic', title: 'Your Information', fields: ['p1_name', 'p1_birth'] },
    { id: 'person1_retirement', title: 'Your Retirement Plan', fields: ['p1_retire_year', 'p1_ss'] },
    { id: 'person2_check', title: 'Spouse/Partner', fields: ['has_person2'] },
    { id: 'person2_basic', title: 'Partner Information', fields: ['p2_name', 'p2_birth'], conditional: true },
    { id: 'person2_retirement', title: 'Partner Retirement', fields: ['p2_retire_year', 'p2_ss'], conditional: true },
    { id: 'risk_tolerance', title: 'Risk Assessment', fields: ['risk'] },
    { id: 'investments_intro', title: 'Investment Accounts', fields: [] },
    { id: 'investments_liquid', title: 'Liquid Assets', fields: ['investments'] },
    { id: 'investments_tax_deferred', title: 'Tax-Deferred Accounts', fields: ['investments'] },
    { id: 'investments_roth', title: 'Roth Accounts', fields: ['investments'] },
    { id: 'income_streams', title: 'Income Sources', fields: ['income'] },
    { id: 'properties', title: 'Real Estate', fields: ['properties'] },
    { id: 'review', title: 'Review & Complete', fields: [] }
];

async function startProfileWizard() {
    // Check for saved progress
    const savedProgress = localStorage.getItem('wizard_in_progress');
    if (savedProgress) {
        const { data, step, timestamp } = JSON.parse(savedProgress);
        const hoursSince = (Date.now() - timestamp) / 1000 / 60 / 60;

        if (hoursSince < 72) { // 3 days
            const resume = confirm('You have a wizard in progress. Would you like to continue where you left off?');
            if (resume) {
                wizardData = data;
                currentWizardStep = step;
            } else {
                localStorage.removeItem('wizard_in_progress');
                wizardData = { investments: [], income: [], properties: [] };
                currentWizardStep = 0;
            }
        }
    } else {
        wizardData = { investments: [], income: [], properties: [] };
        currentWizardStep = 0;
    }

    document.getElementById('profile-wizard-modal').classList.add('active');
    renderWizardStep();
}

function renderWizardStep() {
    const step = wizardSteps[currentWizardStep];
    const body = document.getElementById('profile-wizard-body');

    // Skip conditional steps if needed
    if (step.conditional && !wizardData.has_person2) {
        currentWizardStep++;
        renderWizardStep();
        return;
    }

    // Update progress bar
    const progressPercent = ((currentWizardStep + 1) / wizardSteps.length) * 100;
    document.getElementById('wizard-progress-bar').style.width = `${progressPercent}%`;
    document.getElementById('wizard-progress-text').textContent = `Step ${currentWizardStep + 1} of ${wizardSteps.length}`;
    document.getElementById('wizard-step-title').textContent = step.title;

    // Render step-specific content
    body.innerHTML = getStepContent(step);

    // Update navigation buttons
    document.getElementById('wizard-prev-btn').disabled = currentWizardStep === 0;
    document.getElementById('wizard-next-btn').textContent =
        currentWizardStep === wizardSteps.length - 1 ? 'Complete' : 'Next →';
}

function getStepContent(step) {
    switch(step.id) {
        case 'welcome':
            return `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
                    <h2>Let's Build Your Retirement Plan</h2>
                    <p>This wizard will guide you through creating a comprehensive retirement plan...</p>
                </div>
            `;

        case 'profile_name':
            return `
                <div style="padding: 20px;">
                    <h3>What would you like to name this profile?</h3>
                    <input type="text"
                           id="wizard-profile-name"
                           value="${wizardData.profile_name || ''}"
                           placeholder="Enter profile name..."
                           onkeyup="wizardData.profile_name = this.value">
                </div>
            `;

        // ... 13 more step cases
    }
}
```

#### Learning System

```javascript
const learningTopics = {
    1: [ // Beginner
        { file: 'retirement-planning-SKILL.md', title: 'Retirement Planning Basics', emoji: '📚', description: 'Core concepts and getting started' },
        { file: 'investment-policy-SKILL.md', title: 'Investment Fundamentals', emoji: '📊', description: 'Understanding investment principles' }
    ],
    2: [ // Basic
        { file: 'retirement-planning-SKILL.md', title: 'Retirement Strategies', emoji: '🎯', description: 'Planning your retirement timeline' },
        { file: 'healthcare-gap-SKILL.md', title: 'Healthcare Planning', emoji: '🏥', description: 'Healthcare costs and Medicare' }
    ],
    // ... levels 3-5
};

async function loadEducationalContent(filename, level) {
    try {
        const response = await fetch(`${API_URL}/skills/${filename}`);
        const data = await response.json();

        if (data.content) {
            // Convert markdown to HTML (basic regex-based)
            let html = data.content
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/^- (.+)$/gm, '<li>$1</li>')
                .replace(/\n\n/g, '</p><p>');

            document.getElementById('learn-content-body').innerHTML = html;
            document.getElementById('learn-topics-grid').style.display = 'none';
            document.getElementById('learn-content-display').style.display = 'block';

            // Track progress
            trackLearningProgress(filename, level);
        }
    } catch (error) {
        showNotification(`Error loading content: ${error.message}`, 'error');
    }
}

function trackLearningProgress(filename, level) {
    let progress = JSON.parse(localStorage.getItem('learning_progress') || '{}');
    if (!progress[level]) progress[level] = [];
    if (!progress[level].includes(filename)) {
        progress[level].push(filename);
        localStorage.setItem('learning_progress', JSON.stringify(progress));
    }
}
```

#### Progression System

```javascript
function calculateProfileCompleteness() {
    let score = 0;
    const maxScore = 100;

    // Get current form values
    const p1Name = document.getElementById('p1-name')?.value;
    const p1Birth = document.getElementById('p1-birth')?.value;
    const p1Retire = document.getElementById('p1-retire')?.value;
    const p1SS = parseFloat(document.getElementById('p1-ss')?.value || 0);

    // Basic info (20 points)
    if (p1Name && p1Name !== 'Person 1') score += 5;
    if (p1Birth) score += 5;
    if (p1Retire) score += 5;
    if (p1SS > 0) score += 5;

    // Investments (30 points)
    if (investmentTypes && investmentTypes.length >= 1) score += 10;
    if (investmentTypes && investmentTypes.length >= 3) score += 10;
    if (investmentTypes && investmentTypes.some(i => i.cost_basis > 0)) score += 10;

    // Income streams (20 points)
    if (incomeStreams && incomeStreams.length >= 1) score += 10;
    if (incomeStreams && incomeStreams.length >= 2) score += 10;

    // Properties (15 points)
    if (homeProperties && homeProperties.length >= 1) score += 15;

    // Goals & assumptions (15 points)
    const expenses = parseFloat(document.getElementById('expenses')?.value || 0);
    const targetIncome = parseFloat(document.getElementById('target-income')?.value || 0);
    if (expenses > 0) score += 5;
    if (targetIncome > 0) score += 5;

    // Check if market assumptions are set (not default)
    const stockAlloc = parseFloat(document.getElementById('stocks-slider')?.value || 60);
    if (stockAlloc !== 60) score += 5; // User customized

    return Math.min(score, maxScore);
}

function getUserLevel() {
    const score = calculateProfileCompleteness();
    if (score < 20) return 1;
    if (score < 40) return 2;
    if (score < 60) return 3;
    if (score < 80) return 4;
    return 5;
}

function updateProgressIndicator() {
    const score = calculateProfileCompleteness();
    const level = getUserLevel();

    const html = `
        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600; color: var(--text-primary);">Profile Completeness</span>
                <span style="font-size: 24px; font-weight: 700; color: var(--accent-color);">${score}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                <div style="width: ${score}%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.5s;"></div>
            </div>
            <div style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
                Level ${level} of 5
            </div>
        </div>
    `;

    const container = document.getElementById('profile-progress-container');
    if (container) {
        container.innerHTML = html;
    }
}

function checkLevelUp() {
    const currentLevel = getUserLevel();

    if (currentLevel > previousLevel) {
        showLevelUpNotification(currentLevel);
        previousLevel = currentLevel;
    }

    updateProgressIndicator();
}

function showLevelUpNotification(newLevel) {
    const messages = {
        2: '🎉 Level 2 Unlocked! You can now use the AI Advisor.',
        3: '🚀 Level 3 Unlocked! Analysis features are now available.',
        4: '⭐ Level 4 Unlocked! Scenario comparison is now available.',
        5: '🏆 Level 5 Achieved! All features unlocked. You\'re a retirement planning expert!'
    };

    if (messages[newLevel]) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 600;
            font-size: 16px;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = messages[newLevel];
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}
```

---

## Backend Architecture

### Flask Application Structure

```python
# app.py

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sqlite3
import json
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Database initialization
def init_db():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'profiles.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            name TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

# Serve frontend
@app.route('/')
def index():
    return send_file('static/index.html')

# Profile management
@app.route('/api/profiles', methods=['GET'])
def list_profiles():
    conn = sqlite3.connect('data/profiles.db')
    cursor = conn.cursor()
    cursor.execute('SELECT name, updated_at FROM profiles ORDER BY updated_at DESC')
    profiles = [{'name': row[0], 'updated_at': row[1]} for row in cursor.fetchall()]
    conn.close()
    return jsonify(profiles)

@app.route('/api/profile/<name>', methods=['GET'])
def get_profile(name):
    conn = sqlite3.connect('data/profiles.db')
    cursor = conn.cursor()
    cursor.execute('SELECT data FROM profiles WHERE name = ?', (name,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return jsonify(json.loads(row[0]))
    else:
        return jsonify({'error': 'Profile not found'}), 404

@app.route('/api/profile/<name>', methods=['POST'])
def save_profile(name):
    data = request.json

    conn = sqlite3.connect('data/profiles.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO profiles (name, data, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    ''', (name, json.dumps(data)))
    conn.commit()
    conn.close()

    return jsonify({'status': 'success'})

# Skills endpoint (NEW)
@app.route('/api/skills/<filename>', methods=['GET'])
def serve_skill_file(filename):
    """Serve markdown skill files for educational content"""
    try:
        # Security: only allow .md files and prevent directory traversal
        if not filename.endswith('.md') or '..' in filename or '/' in filename:
            return jsonify({'error': 'Invalid filename'}), 400

        skills_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'skills')
        file_path = os.path.join(skills_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'Skill file not found'}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return jsonify({'content': content}), 200
    except Exception as e:
        return jsonify({'error': f'Error reading skill file: {str(e)}'}), 500

# Analysis endpoint
@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.json
    # ... Monte Carlo simulation logic ...
    return jsonify(results)

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5137, debug=False)
```

### Database Schema

```sql
-- planning.db

CREATE TABLE profiles (
    name TEXT PRIMARY KEY,           -- Profile name (unique identifier)
    data TEXT NOT NULL,              -- JSON-serialized profile data
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example profile data structure
{
  "person1": {
    "name": "John Smith",
    "birth_date": "1965-06-15",
    "retirement_date": "2030-06-01",
    "social_security": 3200
  },
  "person2": { ... },
  "investment_types": [ ... ],
  "income_streams": [ ... ],
  "home_properties": [ ... ],
  "annual_expenses": 95000,
  "target_annual_income": 110000,
  "risk_tolerance": "Moderate",
  "market_assumptions": { ... }
}
```

---

## localStorage Schema

### Wizard Progress

```javascript
// Key: 'wizard_in_progress'
{
  "data": {
    "profile_name": "My Retirement Plan",
    "p1_name": "John Smith",
    "p1_birth": "1965-06-15",
    "has_person2": true,
    "investments": [...],
    "income": [...],
    "properties": [...]
  },
  "step": 8,
  "timestamp": 1705177200000
}
```

### Learning Progress

```javascript
// Key: 'learning_progress'
{
  "1": ["retirement-planning-SKILL.md", "investment-policy-SKILL.md"],
  "2": ["healthcare-gap-SKILL.md"],
  "3": ["estate-legal-SKILL.md", "tax-strategy-SKILL.md"]
}
```

---

## API Reference

### GET /api/profiles

List all saved profiles.

**Response:**
```json
[
  {
    "name": "Demo Retirement Plan",
    "updated_at": "2026-01-13T19:17:27.982090"
  }
]
```

### GET /api/profile/<name>

Load a specific profile.

**Response:**
```json
{
  "person1": { ... },
  "person2": { ... },
  "investment_types": [ ... ],
  "income_streams": [ ... ],
  "home_properties": [ ... ],
  "annual_expenses": 95000,
  "target_annual_income": 110000,
  "risk_tolerance": "Moderate",
  "market_assumptions": { ... }
}
```

### POST /api/profile/<name>

Save or update a profile.

**Request Body:** Same as GET response

**Response:**
```json
{
  "status": "success"
}
```

### GET /api/skills/<filename>

Retrieve educational markdown content.

**Response:**
```json
{
  "content": "# Retirement Planning Skill\n\n## Purpose\n..."
}
```

**Error Responses:**
- 400: Invalid filename (not .md, contains .., or contains /)
- 404: File not found
- 500: Server error reading file

### POST /api/analyze

Run Monte Carlo simulation.

**Request Body:**
```json
{
  "person1": { ... },
  "person2": { ... },
  "investment_types": [ ... ],
  "simulations": 10000
}
```

**Response:**
```json
{
  "success_rate": 87.5,
  "median_ending_balance": 1250000,
  "percentile_5": 350000,
  "percentile_95": 2800000,
  "years_data": [ ... ],
  "scenario_results": [ ... ]
}
```

---

## CSS Architecture

### Custom Properties (Theme Variables)

```css
:root {
    /* Light theme (default) */
    --bg-primary: #f5f5f5;
    --bg-secondary: #ffffff;
    --bg-tertiary: #ecf0f1;
    --text-primary: #333;
    --text-secondary: #666;
    --text-light: #999;
    --accent-color: #3498db;
    --accent-hover: #2980b9;
    --border-color: #ddd;
    --shadow: rgba(0,0,0,0.1);
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
}

[data-theme="dark"] {
    /* Dark theme overrides */
    --bg-primary: #1a1a1a;
    --bg-secondary: #2c2c2c;
    --bg-tertiary: #3a3a3a;
    --text-primary: #e0e0e0;
    --text-secondary: #b0b0b0;
    --text-light: #808080;
    /* ... more overrides */
}
```

### Key Classes

```css
/* Tab system */
.tabs { display: flex; gap: 10px; }
.tab { padding: 12px 20px; background: var(--bg-secondary); cursor: pointer; }
.tab.active { background: var(--accent-color); color: white; }
.tab-content { display: none; padding: 20px; }
.tab-content.active { display: block; }

/* Modal system */
.settings-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); }
.settings-modal.active { display: flex; }
.settings-content { background: var(--bg-secondary); padding: 20px; max-width: 800px; margin: auto; }

/* Cards */
.welcome-card, .learn-card {
    padding: 30px;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s;
}
.welcome-card:hover, .learn-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 16px var(--shadow);
    border-color: var(--accent-color);
}
```

---

## Testing

### Manual Testing Checklist

**Phase 1: Welcome Screen**
- [ ] Welcome tab is active on page load
- [ ] "Create New Profile" card launches wizard
- [ ] "Open Existing Profile" shows dropdown
- [ ] Learn cards navigate to Learn tab with content
- [ ] Hover effects work on all cards

**Phase 2: Profile Wizard**
- [ ] Wizard launches from Welcome screen
- [ ] Progress bar updates on each step
- [ ] Previous/Next buttons enable/disable correctly
- [ ] Conditional steps (partner info) show/hide
- [ ] "Save & Continue Later" persists to localStorage
- [ ] Resume prompt appears when returning
- [ ] Completion saves profile to database
- [ ] Success screen redirects to Dashboard

**Phase 3: Learn Tab**
- [ ] Learn tab button appears in navigation
- [ ] Level selector (1-5) switches topics
- [ ] Topic cards display for each level
- [ ] Clicking card loads skill file content
- [ ] Markdown renders as HTML
- [ ] Back button returns to topics grid
- [ ] Progress tracked in localStorage

**Phase 4: Skills Endpoint**
- [ ] GET /api/skills/retirement-planning-SKILL.md returns JSON
- [ ] Response contains "content" field
- [ ] Invalid filenames return 400
- [ ] Missing files return 404
- [ ] Directory traversal blocked (..)

**Phase 5: Progression System**
- [ ] Progress indicator displays on Profile tab
- [ ] Score calculates correctly (0-100%)
- [ ] Level displays (1-5) based on score
- [ ] Loading profile initializes previousLevel
- [ ] Saving profile checks for level-up
- [ ] Level-up notification appears
- [ ] Notification auto-dismisses after 5 seconds

**Regression Tests**
- [ ] All existing tabs still functional
- [ ] Profile loading/saving works
- [ ] Analysis runs successfully
- [ ] Charts render correctly
- [ ] Settings modal opens/closes
- [ ] No console errors

### Automated Testing (Future)

```javascript
// Example Jest test structure

describe('Profile Wizard', () => {
    test('should save progress to localStorage', () => {
        wizardData = { profile_name: 'Test' };
        currentWizardStep = 5;
        wizardSaveForLater();

        const saved = JSON.parse(localStorage.getItem('wizard_in_progress'));
        expect(saved.data.profile_name).toBe('Test');
        expect(saved.step).toBe(5);
    });

    test('should skip conditional steps', () => {
        wizardData = { has_person2: false };
        currentWizardStep = 5; // person2_basic
        renderWizardStep();

        expect(currentWizardStep).toBe(7); // Skipped to after person2 steps
    });
});

describe('Progression System', () => {
    test('should calculate score correctly', () => {
        // Mock DOM elements
        document.getElementById = jest.fn((id) => ({
            value: id === 'p1-name' ? 'John' : ''
        }));

        investmentTypes = [{ value: 100000 }];

        const score = calculateProfileCompleteness();
        expect(score).toBeGreaterThan(0);
    });

    test('should return correct level', () => {
        // Mock calculateProfileCompleteness
        calculateProfileCompleteness = jest.fn(() => 75);

        const level = getUserLevel();
        expect(level).toBe(4); // 60-79% = Level 4
    });
});
```

---

## Deployment

### Local Development

```bash
# Setup
cd /home/paul/src/rps
python3 -m venv venv
source venv/bin/activate
pip install -r config/requirements.txt

# Run
./bin/start

# Access
open http://127.0.0.1:5137
```

### Production Deployment

```bash
# Use production WSGI server
uv pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5137 src.app:app

# Or use waitress (Windows-compatible)
uv pip install waitress
waitress-serve --host=0.0.0.0 --port=5137 src.app:app
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY skills/ ./skills/
COPY data/ ./data/

EXPOSE 5137

CMD ["python3", "src/app.py"]
```

```bash
# Build and run
docker build -t rps .
docker run -p 5137:5137 -v $(pwd)/data:/app/data rps
```

---

## Common Development Tasks

### Adding a New Wizard Step

1. Add step configuration to `wizardSteps` array
2. Implement `getStepContent()` case for new step ID
3. Add validation in `validateWizardStep()` if needed
4. Update `completeWizard()` to include new data in profile

### Adding a New Educational Topic

1. Create markdown file in `/skills/` directory
2. Add topic to appropriate level in `learningTopics` object
3. No backend changes needed (endpoint serves any .md file)

### Modifying Progression Scoring

1. Edit `calculateProfileCompleteness()` function
2. Adjust point allocations for each category
3. Modify level thresholds in `getUserLevel()` if needed
4. Update level-up messages in `showLevelUpNotification()`

### Adding a New Tab

1. Add tab button to navigation section
2. Create tab content div with unique ID
3. Implement tab-specific JavaScript functions
4. Add initial data loading if needed

---

## Performance Optimization

### Current Bottlenecks

1. **Large HTML file (~7,500 lines)**: Consider code splitting
2. **Monte Carlo simulation**: Runs in main thread, blocks UI
3. **Chart rendering**: Can be slow with 10,000+ data points
4. **localStorage limits**: 5-10MB total, could hit limits

### Optimization Strategies

```javascript
// 1. Lazy load skill files
const skillCache = new Map();
async function loadEducationalContent(filename) {
    if (skillCache.has(filename)) {
        return skillCache.get(filename);
    }
    const content = await fetch(`/api/skills/${filename}`);
    skillCache.set(filename, content);
    return content;
}

// 2. Debounce wizard saves
let saveTimeout;
function debouncedWizardSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem('wizard_in_progress', JSON.stringify({
            data: wizardData,
            step: currentWizardStep,
            timestamp: Date.now()
        }));
    }, 1000);
}

// 3. Virtual scrolling for large tables
// Use library like react-window or implement custom

// 4. Web Workers for analysis
const worker = new Worker('analysis-worker.js');
worker.postMessage({ data: profileData, simulations: 10000 });
worker.onmessage = (e) => {
    const results = e.data;
    displayResults(results);
};
```

---

## Security Considerations

### Input Validation

```python
# Backend
def validate_profile_name(name):
    if not name or len(name) > 100:
        return False
    if any(c in name for c in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']):
        return False
    return True

# Frontend
function sanitizeInput(input) {
    return input.replace(/[<>'"]/g, '');
}
```

### SQL Injection Prevention

```python
# Use parameterized queries (already implemented)
cursor.execute('SELECT * FROM profiles WHERE name = ?', (name,))
# NOT: f"SELECT * FROM profiles WHERE name = '{name}'"
```

### XSS Prevention

```javascript
// Escape HTML when rendering user content
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Use when displaying user-provided names
document.getElementById('output').innerHTML = escapeHtml(userInput);
```

### File Access Security

```python
# Validate file paths (already implemented)
if '..' in filename or '/' in filename:
    return jsonify({'error': 'Invalid filename'}), 400

# Use absolute paths
file_path = os.path.abspath(os.path.join(skills_dir, filename))
if not file_path.startswith(skills_dir):
    return jsonify({'error': 'Access denied'}), 403
```

---

## Troubleshooting Common Issues

### Wizard Data Not Persisting

**Problem:** Wizard progress lost on browser close

**Solutions:**
1. Check if localStorage is enabled in browser
2. Verify `wizardSaveForLater()` is being called
3. Check browser console for errors
4. Test localStorage: `localStorage.setItem('test', 'value')`

### Skills Endpoint 404

**Problem:** Skills files not loading in Learn tab

**Solutions:**
1. Verify skills directory exists: `/Users/paul/src/rps/skills/`
2. Check file names match exactly (case-sensitive)
3. Verify Flask server is running on port 5137
4. Check backend logs for errors

### Progress Indicator Not Updating

**Problem:** Completeness score stuck at 0%

**Solutions:**
1. Ensure `updateProgressIndicator()` called after profile load
2. Check if `investmentTypes`, `incomeStreams`, `homeProperties` are populated
3. Verify DOM element `profile-progress-container` exists
4. Call `updateProgressIndicator()` manually from console

### Level-Up Notification Not Showing

**Problem:** No notification when reaching new level

**Solutions:**
1. Initialize `previousLevel = getUserLevel()` on profile load
2. Call `checkLevelUp()` after saving profile
3. Verify notification CSS z-index (should be 10000)
4. Check for console errors in `showLevelUpNotification()`

---

## Contributing Guidelines

### Code Style

**JavaScript:**
- Use `async/await` for asynchronous operations
- Camel case for variables: `wizardData`, `currentStep`
- Descriptive function names: `calculateProfileCompleteness()`
- Comments for complex logic

**Python:**
- PEP 8 style guidelines
- Snake case for functions: `serve_skill_file()`
- Docstrings for all functions
- Type hints where beneficial

**HTML/CSS:**
- Kebab case for IDs and classes: `profile-wizard-modal`
- Semantic HTML5 elements
- CSS custom properties for themeable values
- Mobile-first responsive design

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-wizard-step

# Make changes
git add src/static/index.html
git commit -m "Add health insurance wizard step"

# Push and create PR
git push origin feature/new-wizard-step
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Manual testing completed
- [ ] Regression tests passed
- [ ] New tests added (if applicable)

## Screenshots
(if UI changes)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added to complex code
- [ ] Documentation updated
```

---

## Future Roadmap

### Q1 2026
- [ ] Add tutorial overlay system
- [ ] Implement profile comparison feature
- [ ] Add CSV import/export
- [ ] Mobile responsive improvements

### Q2 2026
- [ ] Migration to React/Vue
- [ ] Add unit tests (Jest)
- [ ] Implement proper markdown parser
- [ ] Add video content to Learn tab

### Q3 2026
- [ ] Cloud sync for profiles
- [ ] Multi-user support
- [ ] Advanced analytics dashboard
- [ ] PDF report generation improvements

### Q4 2026
- [ ] Mobile app (React Native)
- [ ] AI-powered recommendations
- [ ] Real-time collaboration
- [ ] Internationalization (i18n)

---

## Resources

### Documentation
- Flask: https://flask.palletsprojects.com/
- Chart.js: https://www.chartjs.org/docs/
- MDN Web Docs: https://developer.mozilla.org/

### Tools
- VS Code: Recommended editor
- Chrome DevTools: Debugging
- Postman: API testing
- DB Browser for SQLite: Database inspection

### Community
- GitHub Issues: Bug reports and feature requests
- Developer Slack: (if applicable)
- Stack Overflow: `rps` tag

---

*Last Updated: January 13, 2026*
*Document Version: 1.0*
