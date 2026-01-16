# panRPS Quick Start Guide

**Get started with your retirement planning in 5 minutes!**

---

## 🚀 First Time Using panRPS?

### Step 1: Start the Application

```bash
cd /Users/paul/src/panrps
source .venv/bin/activate
python3 src/app.py
```

Open your browser to: **http://localhost:8080**

### Step 2: Create Your Profile

1. You'll see the **Welcome Screen** with three options
2. Click the **"Create New Profile"** card
3. The 15-step wizard will guide you through:
   - Your personal information
   - Your partner's information (if applicable)
   - Investment accounts
   - Income sources
   - Real estate holdings
   - Financial goals

**💡 Tip:** Click "Save & Continue Later" at any time to pause. Your progress is saved!

### Step 3: Complete Your Profile

Follow the wizard steps:
- Enter your name and birth date
- Set your retirement date
- Add investment accounts (401k, IRA, taxable accounts)
- Include income sources (pensions, Social Security)
- Add your home or other properties
- Review and save

**🎉 Congratulations!** Your profile is created and you're redirected to the Dashboard.

### Step 4: View Your Analysis

The system automatically runs a Monte Carlo simulation (10,000 scenarios) showing:
- Probability of retirement success
- Portfolio projections over time
- Income vs. expense charts
- Best/worst case scenarios

### Step 5: Learn More

Click the **"📚 Learn"** tab to explore educational content:
- **Level 1-2:** Basic retirement and investment concepts
- **Level 3:** Estate planning and tax strategies
- **Level 4:** Advanced wealth transfer techniques
- **Level 5:** Expert lifestyle design

---

## 🔄 Returning Users

### Loading an Existing Profile

1. Go to the **Welcome Screen**
2. Click **"Open Existing Profile"** card
3. Select your profile from the dropdown
4. Your profile loads with the latest analysis

### Or Skip Welcome

- Click **Dashboard** tab to see your current analysis
- Click **Profile & Data** tab to edit your information
- Click **Analysis** tab to run new simulations

---

## 📊 Understanding Your Progress

### Profile Completeness

Look at the **Profile & Data** tab for your progress indicator:

```
Profile Completeness: 65%
████████████░░░░░░░░
Level 3 of 5
```

**What the Levels Mean:**
- **Level 1 (0-19%)**: Just getting started
- **Level 2 (20-39%)**: Basic profile created
- **Level 3 (40-59%)**: Comprehensive profile
- **Level 4 (60-79%)**: Advanced planning
- **Level 5 (80-100%)**: Expert - all features unlocked! 🏆

### Increasing Your Score

Add more details to increase completeness:
- ✓ Multiple investment accounts (+10%)
- ✓ Income sources beyond Social Security (+10%)
- ✓ Real estate holdings (+15%)
- ✓ Cost basis for taxable accounts (+10%)
- ✓ Detailed market assumptions (+5%)

---

## 🎯 Quick Tips

### Wizard Tips
- **Save Often**: Click "Save & Continue Later" to preserve progress
- **Skip Steps**: Not applicable? Just click Next to skip
- **Go Back**: Previous button lets you correct mistakes
- **Context Help**: Read the gray text boxes for explanations

### Analysis Tips
- **Run Multiple Scenarios**: Create profiles like "Conservative" and "Aggressive"
- **Update Annually**: Refresh your data each year
- **Try What-Ifs**: Clone a profile and adjust one variable to see impact
- **Check Assumptions**: Click Settings to adjust stock/bond returns

### Learning Tips
- **Start at Your Level**: Level 1-2 for beginners, 3+ for advanced
- **Follow the Path**: Progress through levels sequentially
- **Apply Immediately**: Read a topic, then update your profile
- **Track Progress**: Completed topics are saved automatically

---

## 📋 Sample Profile (Included)

**Demo Retirement Plan** is already loaded for you to explore:

**Profile Details:**
- **John Smith** (age 60) & **Jane Smith** (age 58)
- **Portfolio**: $775,000 total
  - $450,000 in 401k (Traditional)
  - $200,000 in taxable investments
  - $125,000 in Roth IRA
- **Income**: $24,000/year pension + Social Security
- **Home**: $650,000 primary residence (paid off)
- **Goal**: $110,000/year income, $95,000 expenses
- **Risk**: Moderate (60/40 stocks/bonds)

**Completeness**: 100% (Level 5 - Expert)

Try running analysis on this profile to see how the system works!

---

## 🎓 Educational Content Overview

### What You'll Learn

**Retirement Basics (Level 1-2)**
- Understanding Social Security benefits
- 401k vs. IRA differences
- Basic withdrawal strategies
- Healthcare planning before Medicare

**Intermediate Topics (Level 3)**
- Estate planning and wills
- Tax-efficient withdrawal strategies
- Real estate in retirement
- Roth conversion opportunities

**Advanced Topics (Level 4-5)**
- Wealth transfer strategies
- Charitable giving techniques
- Education funding (529 plans)
- Lifestyle design for retirement

### How to Use Educational Content

1. Click **"📚 Learn"** tab
2. Select your level (1-5) using the buttons
3. Click a topic card to read
4. Click "← Back to Topics" to return
5. Topics you've read are tracked automatically

---

## 🔧 Common Tasks

### Add an Investment Account

1. Go to **Profile & Data** tab
2. Scroll to **Investment Accounts** section
3. Click **"+ Add Investment"**
4. Fill in:
   - Account name (e.g., "Fidelity 401k")
   - Account type (Liquid/Traditional/Roth)
   - Current value
   - Annual change (contributions minus withdrawals)
5. Click **Save**

### Add Income Source

1. Go to **Profile & Data** tab
2. Scroll to **Income Streams** section
3. Click **"+ Add Income"**
4. Fill in:
   - Name (e.g., "Pension")
   - Owner (You or Partner)
   - Annual amount
   - Start date
   - Inflation adjusted? (Yes/No)
5. Click **Save**

### Run New Analysis

1. Go to **Dashboard** tab
2. Click **"Run Analysis"** button
3. Wait ~5 seconds for 10,000 simulations
4. View results in charts below

### Adjust Market Assumptions

1. Click **Settings** (gear icon, top-right)
2. Adjust sliders:
   - Stock allocation (% in stocks)
   - Expected returns (stocks/bonds)
   - Inflation rate
   - Volatility (risk)
3. Click **Save Settings**
4. Re-run analysis to see impact

---

## 🆘 Troubleshooting

### "Cannot connect to server"
**Solution:** Make sure Flask is running:
```bash
cd /Users/paul/src/panrps
source .venv/bin/activate
python3 src/app.py
```

### Wizard won't resume
**Solution:** Check browser settings - localStorage must be enabled

### Analysis shows 0% success
**Solution:** Your expenses exceed income. Add more assets or reduce expenses.

### Skills not loading in Learn tab
**Solution:** Verify server is running on port 8080 and skill files exist in `/skills/` directory

---

## 📱 Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit forms or advance wizard
- **Escape**: Close modals (wizard, settings)
- **Arrow Keys**: Navigate between tabs (when focused)

---

## 💾 Data & Privacy

### Where is my data stored?

- **Profiles**: SQLite database in `/data/profiles.db`
- **Wizard Progress**: Browser localStorage (your computer only)
- **Learning Progress**: Browser localStorage (your computer only)

### Is my data private?

**Yes!** Everything runs locally on your computer:
- No data sent to external servers
- No account or login required
- No tracking or analytics
- Profiles stored in local database

### Backup your data

```bash
# Backup profiles database
cp /Users/paul/src/panrps/data/profiles.db ~/backup/profiles-$(date +%Y%m%d).db
```

---

## 🎉 You're Ready!

You now know how to:
- ✓ Create profiles using the wizard
- ✓ Run retirement analyses
- ✓ Track your progress
- ✓ Learn about retirement planning
- ✓ Update your profile as life changes

**Next Steps:**
1. Create your own profile (replace the demo)
2. Run your first analysis
3. Read Level 1 educational content
4. Set a reminder to update annually

**Questions?** Check the full documentation in `NEW_FEATURES_GUIDE.md`

---

*Happy Planning! 🎯*
