# RPS Quick Start Guide

**Get started with your retirement planning in 5 minutes!**

---

## First Time Using RPS?

### Step 1: Start the Application

```bash
cd /home/paul/src/rps
./bin/start
```

Open your browser to: **http://127.0.0.1:5137**

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

**Tip:** Click "Save & Continue Later" at any time to pause. Your progress is saved!

### Step 3: Complete Your Profile

Follow the wizard steps:
- Enter your name and birth date
- Set your retirement date
- Add investment accounts (401k, IRA, taxable accounts)
- Include income sources (pensions, Social Security)
- Add your home or other properties
- Review and save

**Congratulations!** Your profile is created and you're redirected to the Dashboard.

### Step 4: View Your Analysis

The system automatically runs a Monte Carlo simulation (10,000 scenarios) showing:
- Probability of retirement success
- Portfolio projections over time
- Income vs. expense charts
- Best/worst case scenarios

### Step 5: Learn More

Click the **"Learn"** tab to explore educational content:
- **Level 1-2:** Basic retirement and investment concepts
- **Level 3:** Estate planning and tax strategies
- **Level 4:** Advanced wealth transfer techniques
- **Level 5:** Expert lifestyle design

---

## Returning Users

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

## Understanding Your Progress

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
- **Level 5 (80-100%)**: Expert - all features unlocked!

---

## Quick Tips

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

---

## Common Tasks

### Add an Investment Account

1. Go to **Profile & Data** tab
2. Scroll to **Investment Accounts** section
3. Click **"+ Add Investment"**
4. Fill in account details
5. Click **Save**

### Run New Analysis

1. Go to **Dashboard** tab
2. Click **"Run Analysis"** button
3. View results in charts below

---

## Troubleshooting

### "Cannot connect to server"
**Solution:** Make sure Flask is running:
```bash
./bin/start
```

### Wizard won't resume
**Solution:** Check browser settings - localStorage must be enabled

### Analysis shows 0% success
**Solution:** Your expenses exceed income. Add more assets or reduce expenses.

---

## Data & Privacy

### Where is my data stored?

- **Profiles**: SQLite database in `data/planning.db`
- **Wizard Progress**: Browser localStorage (your computer only)
- **Learning Progress**: Browser localStorage (your computer only)

### Is my data private?

**Yes!** Everything runs locally on your computer:
- No data sent to external servers (except AI features if enabled)
- Profiles stored in local database
- Data encrypted at rest

### Backup your data

```bash
./bin/backup
```

---

## You're Ready!

You now know how to:
- Create profiles using the wizard
- Run retirement analyses
- Track your progress
- Learn about retirement planning
- Update your profile as life changes

**Next Steps:**
1. Create your own profile
2. Run your first analysis
3. Read Level 1 educational content
4. Set a reminder to update annually

---

*Happy Planning!*
