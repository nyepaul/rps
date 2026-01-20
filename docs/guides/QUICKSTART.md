# Quick Start Guide (Version 2.0)

## Get Optimized in 5 Minutes

### Step 0: Configure API Keys (One-Time Setup)
```bash
./bin/setup-api-keys
```
*This interactive script will prompt for your Gemini or Claude API key and configure it as an environment variable.*

### Step 1: Start the Application
```bash
./bin/start
```
*Wait for the message: "Access the application at: http://127.0.0.1:5137"*

### Step 2: Load Your Profile
1. Open **[http://127.0.0.1:5137](http://127.0.0.1:5137)** in your browser.
2. Go to the **Profile & Data** tab.
3. Select **"Initial"** from the profile list and click **Load**.

### Step 3: Run the Base Analysis
1. Click the **Analysis** tab.
2. Click **Run Complete Analysis**.
3. Review your Success Rate and Wealth Projection chart.

### Step 4: Use the AI Strategic Advisor 🤖
1. Click **"🤖 AI Recommendations"** (requires API key from Step 0).
2. Read the personalized analysis of your SS strategy and Roth opportunities.
3. Click **"⚡ Quick Apply"** to instantly test one of the AI's suggestions.
4. Click **"✅ Convert to Action Items"** to populate your task list.

### Step 5: Sandbox Your Future
1. Switch to the **Dashboard** tab.
2. Move the **Annual Spending** slider to see how much "cushion" you have.
3. Adjust the **Stock Allocation** slider to see the trade-off between growth and volatility.

---

## Important Disclaimers
⚠️ **This is NOT financial advice.**
⚠️ **Consult licensed professionals** (CPA, Attorney, CFP) before taking action.
⚠️ **Local Privacy**: Your data is stored only on your computer in `data/planning.db`.

---

## Common Commands
- **Stop Server**: `Ctrl+C` in the terminal.
- **Backup Data**: `./bin/manage backup`
- **Configure AI Keys**: Run `./bin/setup-api-keys` to update your API keys.

## What's Next?
Read **[docs/guides/YOUR-ACTION-PLAN.md](docs/guides/YOUR-ACTION-PLAN.md)** for your 30-year implementation timeline.