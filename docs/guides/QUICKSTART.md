# Getting Started with RPS (v3.9)

Welcome to the Retirement Planning System (RPS). This guide will help you set up your first profile and run your first Monte Carlo simulation in minutes.

## 🚀 5-Minute Quick Start

### Step 1: Start the Application
Open your terminal and run:
```bash
./bin/start
```
*Wait for the message: "Access the application at: http://127.0.0.1:5137"*

### Step 2: Open the Dashboard
Navigate to **[http://127.0.0.1:5137](http://127.0.0.1:5137)** in your web browser.

### Step 3: Create Your Profile
1. On the welcome screen, click **"Create New Profile"**.
2. Follow the 15-step **Financial Planning Wizard**. It will guide you through entering:
   - Personal details and retirement dates.
   - Investment accounts (401k, IRA, Taxable).
   - Income streams (Social Security, Pensions, Rental).
   - Real estate and large expenses.
3. Click **"Save & Finish"** to generate your baseline.

### Step 4: Run Analysis
1. Switch to the **Analysis** tab.
2. Click **"Run Complete Analysis"**.
3. Review your **Success Rate** (percentage of 10,000 scenarios where you didn't run out of money) and the **Wealth Projection** charts.

---

## 🤖 Advanced AI Strategic Advisor

To unlock personalized strategies, you need to configure an AI provider.

### 1. Configure API Keys
- Go to the **Profile & Data** tab.
- Click the **Settings** (gear icon) button.
- Enter your **Gemini** or **Anthropic** API key.
- Click **"Save Settings"**.

### 2. Get Recommendations
- Return to the **Analysis** tab.
- Click **"AI Recommendations"**.
- The AI will analyze your specific tax brackets, withdrawal sequence, and Social Security timing.
- Use **"Quick Apply"** to instantly test an AI-suggested scenario.

---

## 🛠 Common Management Tasks

| Task | Command / Action |
|------|------------------|
| **Stop Server** | Press `Ctrl+C` in the terminal. |
| **Backup Data** | Run `./bin/backup` to save your database and profiles. |
| **Reset Admin** | Run `./bin/reset-admin-password` if you lose access. |
| **Update System** | Run `git pull` followed by `sudo ./bin/deploy`. |

---

## 💡 Pro Tips for Better Accuracy

- **Be Granular**: Enter individual accounts rather than one big total for better tax modeling.
- **Scenario Sandbox**: On the **Dashboard**, use the sliders to test "What If" changes (like retiring 2 years later) without changing your main data.
- **Save Often**: The wizard allows you to "Save & Continue Later" if you need to look up a balance.

---

## 🔐 Privacy & Data
- **Local-First**: All your data is stored in a local SQLite database (`data/planning.db`).
- **Encrypted**: Profile data is encrypted at rest using AES-256-GCM.
- **Private**: No financial data is sent to external servers unless you explicitly use the AI Advisor features.

---

## 📚 Further Reading
- **[Detailed Developer Guide](DEVELOPER_GUIDE.md)**: For system internals and API reference.
- **[Backup & Restore Guide](BACKUP_GUIDE.md)**: Protecting your data.
- **[Security Documentation](../security/SYSTEM_SECURITY_DOCUMENTATION.md)**: How we keep your data safe.