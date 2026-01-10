# Retirement & Wealth Planning System

Comprehensive financial planning system for retirement, tax optimization, estate planning, and wealth transfer.

## Overview

This system helps you:
- Model retirement scenarios with Monte Carlo simulation
- Optimize Social Security claiming strategies
- Plan Roth conversions and tax-efficient withdrawals
- Structure wealth transfer to heirs
- Track estate planning documents and action items
- Generate financial reports

**IMPORTANT**: This system is for organizing information and exploring scenarios. Always consult licensed financial advisors, CPAs, and attorneys for actual recommendations.

## Your Current Situation

**Family:**
- You: Age 60 (born 3/24/65), retiring 7/1/27
- Mindy: Age 52 (born 1/26/73), retiring age 55
- Grif: Age 18 (born 5/18/06)
- Jonah: Age 16 (born 6/6/08)

**Assets (~$3.4M):**
- Liquid: $100k
- Traditional IRA/401k: $2.8M
- Roth IRA: $850k

**Income:**
- Current: $390k/year
- Pension (total): $120k/year
- Social Security at FRA (67): $3,700/mo + $3,300/mo = $84k/year
- Social Security delayed to 70: $4,588/mo + $4,092/mo = $104k/year
- Target retirement income: $300k/year

**Key Opportunities:**
1. Roth conversion window (2027-2038): Convert ~$30k/year at 12% tax
2. Annual gifting: $72k/year tax-free to sons ($36k each)
3. Estate planning: Need trusts, POAs, healthcare directives
4. Social Security: Delay to 70 for both (maximize benefits)

## Quick Start

    chmod +x manage.sh
    ./manage.sh start

Then open in browser:

    file:///home/claude/retirement-planning-system/webapp/index.html

## Management Commands

    ./manage.sh start           # Start application (recommended)
    ./manage.sh start-docker    # Start in Docker
    ./manage.sh stop            # Stop application
    ./manage.sh status          # Check status
    ./manage.sh tunnel          # Create public Cloudflare URL
    ./manage.sh backup          # Backup your data
    ./manage.sh skills          # List available planning skills

## Architecture

```
retirement-planning-system/
├── skills/                    # Planning frameworks
│   ├── retirement-planning-SKILL.md
│   ├── estate-legal-SKILL.md
│   ├── tax-strategy-SKILL.md
│   └── wealth-transfer-SKILL.md
├── webapp/                    # Web application
│   ├── app.py                # Flask API + models
│   ├── index.html            # Web interface
│   ├── data/                 # SQLite database
│   └── Dockerfile            # Container build
└── manage.sh                 # Management script
```

## Features

### 1. Monte Carlo Retirement Simulation

Runs 10,000 scenarios to determine:
- Probability of success (portfolio lasting 30+ years)
- Best/worst case outcomes
- Safe withdrawal rates
- Sequence of returns risk

### 2. Social Security Optimization

Compares claiming strategies:
- Early (62), Full (67), or Delayed (70)
- Lifetime benefit analysis
- Survivor benefit optimization
- **Recommendation: Both delay to 70**

### 3. Roth Conversion Analysis

Identifies tax-efficient conversion windows:
- Years between retirement and RMDs
- Fill 12% and 22% tax brackets
- Calculate conversion amounts and tax cost
- **Your opportunity: ~$300k convertible at 12% tax**

### 4. Wealth Transfer Planning

Tax-efficient strategies:
- Annual exclusion gifts ($18k/person/year)
- 529 plans for future grandchildren
- Estate tax exemption usage
- **Your plan: $72k/year to sons starting now**

### 5. Action Item Tracking

Prioritized checklist:
- Estate documents (POAs, trusts, wills)
- Beneficiary reviews
- Insurance evaluations
- Tax planning deadlines

## Planning Skills

Each skill contains frameworks, checklists, and best practices:

### Retirement Planning Skill
- Cash flow projections
- Withdrawal strategies (4% rule, guardrails, etc.)
- Longevity planning
- Healthcare cost modeling
- Inflation protection

### Estate & Legal Planning Skill
- Essential documents (will, trust, POAs)
- Probate avoidance strategies
- Trust structures (RLT, ILIT, QPRT, etc.)
- Beneficiary optimization
- Incapacity planning

### Tax Strategy Skill
- RMD calculations and minimization
- Roth conversion timing
- Social Security taxation
- Medicare IRMAA avoidance
- Tax-efficient withdrawal sequencing
- QCD strategies (age 70.5+)

### Wealth Transfer Skill
- Annual exclusion gifting
- 529 education funding
- Lifetime exemption usage
- Asset selection for gifts
- Generation-skipping strategies

## Database Schema

    profile
        id, name, birth_date, retirement_date, data, updated_at
    
    scenarios
        id, name, parameters, results, created_at
    
    action_items
        id, category, description, priority, status, due_date, created_at

## API Endpoints

    GET  /api/profile           # Get saved profile
    POST /api/profile           # Save profile
    POST /api/analysis          # Run financial analysis
    GET  /api/action-items      # Get action items
    POST /api/action-items      # Create action item
    POST /api/generate-action-items  # Auto-generate from analysis

## Web Interface

Navigate using tabs:

1. **Dashboard**: Key metrics overview
2. **Profile & Data**: Input your financial info
3. **Analysis**: Run Monte Carlo, view recommendations
4. **Action Items**: Track tasks and deadlines

## Cloudflare Tunnel

Create a secure public URL:

    ./manage.sh tunnel

This generates an HTTPS URL like:
    https://random-name.trycloudflare.com

Share with your spouse or advisor for remote access.

## Data Security

- Database stored locally: `/webapp/data/planning.db`
- No data sent to external servers
- Backups: `./manage.sh backup`
- Data encrypted at rest (optional: add encryption key)

## Backup & Restore

    ./manage.sh backup          # Creates timestamped backup
    ./manage.sh restore         # Restore from backup

Backups saved to: `/backups/YYYYMMDD_HHMMSS/`

## Next Steps

### Immediate (Week 1)
1. Input your data in the Profile tab
2. Run complete analysis
3. Generate action items
4. Review estate planning skill

### High Priority (30 days)
1. Create Healthcare POA and Living Will
2. Create Financial POA
3. Begin annual gifts to sons ($72k)
4. Meet with estate attorney
5. Review beneficiaries on all accounts

### Within 6 Months
1. Draft Revocable Living Trust
2. Execute first Roth conversion
3. Evaluate long-term care insurance
4. Set up 529s for future grandchildren
5. Review with CPA for tax optimization

### Before Retirement (2027)
1. Optimize Social Security claiming
2. Complete Roth conversions
3. Transfer assets to trust
4. Review withdrawal strategy
5. Update estate documents

## Professional Advisors

This system works best when coordinated with:

**Estate Attorney:**
- Draft trusts, wills, POAs
- Review asset titling
- Advise on complex structures

**CPA/Tax Advisor:**
- Roth conversion timing
- Tax-efficient withdrawals
- RMD planning
- Gift tax returns

**Financial Advisor:**
- Investment allocation
- Withdrawal sequencing
- Insurance needs
- Market timing

**Current Team:**
- Wells Fargo Advisors (financial)
- CPA (25% tax bracket)
- Estate attorney: TBD

## Resources

**Skills Library:**
    ls skills/

**View specific skill:**
    cat skills/retirement-planning-SKILL.md

**Check system health:**
    ./manage.sh status

**View logs:**
    ./manage.sh logs

## Troubleshooting

**Application won't start:**
    ./manage.sh stop
    ./manage.sh clean
    ./manage.sh start

**Database corrupted:**
    ./manage.sh restore

**Can't access web interface:**
    Check that app is running: ./manage.sh status
    Verify URL: file:///home/claude/retirement-planning-system/webapp/index.html

**Port 8080 in use:**
    Edit app.py, change port to 8081
    Update API_URL in index.html

## Disclaimers

1. **Not Financial Advice**: This system is educational and for scenario modeling only. Consult licensed professionals for actual recommendations.

2. **No Guarantees**: Past performance and projections don't guarantee future results.

3. **Data Privacy**: All data is stored locally. Be cautious when using Cloudflare tunnel to share access.

4. **Tax Laws Change**: Skills based on 2024 tax law. Verify current rules with CPA.

5. **No Attorney-Client Relationship**: Estate planning skill provides general information only.

## Updates & Maintenance

**Update skills:**
    Edit files in /skills/ directory
    Restart application

**Update calculations:**
    Edit app.py models
    Restart application

**Backup schedule:**
    Run weekly: ./manage.sh backup

## Support

For questions about:
- Financial modeling: Review skills/retirement-planning-SKILL.md
- Estate planning: Review skills/estate-legal-SKILL.md
- Tax strategy: Review skills/tax-strategy-SKILL.md
- Wealth transfer: Review skills/wealth-transfer-SKILL.md

## License

Personal use only. Not for distribution or commercial use.

---

**Last Updated**: January 2026
**System Version**: 1.0
**Your Planning Horizon**: 2026-2056 (30 years)
