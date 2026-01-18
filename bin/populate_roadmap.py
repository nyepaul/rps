#!/usr/bin/env python3
"""
Populate the feature roadmap with gap analysis items
Run this script to import the comprehensive feature gaps into the database
"""

import sqlite3
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = 'data/planning.db'

# Roadmap items from comprehensive gap analysis
ROADMAP_ITEMS = [
    # CRITICAL PRIORITY - Phase 1
    {
        'title': 'Healthcare & Medicare Planning Module',
        'description': 'Add comprehensive healthcare cost modeling including Medicare Parts A/B/D, IRMAA surcharges, HSA integration, and medical expense inflation tracking. Healthcare is often the #1 retirement expense.',
        'category': 'Healthcare & Medical',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Social Security Optimization Tool',
        'description': 'Enhanced SS claiming strategy analyzer with spousal/survivor benefits, work penalty calculations, WEP/GPO, tax torpedo analysis, and break-even calculations for optimal claiming age.',
        'category': 'Social Security',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Roth Conversion Optimizer',
        'description': 'Year-by-year tax bracket analysis with optimal Roth conversion amounts, considering Medicare IRMAA thresholds and future RMD impact. Can save tens of thousands in lifetime taxes.',
        'category': 'Tax Planning',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'RMD Calculator & QCD Planning',
        'description': 'Detailed Required Minimum Distribution calculations using IRS Uniform Lifetime Table, with Qualified Charitable Distribution (QCD) optimization to reduce taxable RMDs.',
        'category': 'RMD Planning',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Life Insurance Needs Analysis',
        'description': 'Calculate life insurance coverage needs based on income replacement, debt payoff, and survivor expenses. Compare term vs whole life options with cost-benefit analysis.',
        'category': 'Insurance Analysis',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'small',
        'status': 'planned'
    },
    {
        'title': 'Sequence of Returns Risk Visualization',
        'description': 'Show how market crashes in early retirement years impact portfolio longevity differently than crashes in later years. Critical for understanding retirement risk.',
        'category': 'Risk Analysis',
        'priority': 'critical',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },

    # HIGH PRIORITY - Phase 1/2
    {
        'title': 'Debt Management & Payoff Strategies',
        'description': 'Track all debt types (credit cards, student loans, auto, HELOC) with avalanche vs snowball strategy comparison and interest cost impact on retirement timeline.',
        'category': 'Debt Management',
        'priority': 'high',
        'phase': 'phase1',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': '529 College Savings Planner',
        'description': 'Education funding with 529 plan modeling, college cost projections (7% inflation), financial aid impact analysis, and multi-child timeline planning.',
        'category': 'Education Funding',
        'priority': 'high',
        'phase': 'phase2',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Pension vs Lump Sum Analyzer',
        'description': 'Detailed comparison of pension annuity vs lump sum with discount rate analysis, joint vs single life options, COLA adjustments, and present value calculations.',
        'category': 'Pension & Annuity',
        'priority': 'high',
        'phase': 'phase2',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Estate Tax & Gifting Strategy',
        'description': 'Estate tax calculations with current exemption levels, annual exclusion gifting ($18K/2024), step-up basis planning, and trust structure recommendations.',
        'category': 'Estate Planning',
        'priority': 'high',
        'phase': 'phase2',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Investment Fee Impact Analyzer',
        'description': 'Calculate how expense ratios, advisor fees, and fund costs compound over time. Show how 1% fee difference impacts 30-year retirement (10+ years of spending).',
        'category': 'Investment Analysis',
        'priority': 'high',
        'phase': 'phase2',
        'impact': 'high',
        'effort': 'small',
        'status': 'planned'
    },
    {
        'title': 'Part-Time Work in Retirement Modeling',
        'description': 'Model phased retirement with part-time income, showing impact on portfolio longevity, Social Security delay benefits, and healthcare bridge coverage.',
        'category': 'Life Events',
        'priority': 'high',
        'phase': 'phase2',
        'impact': 'medium',
        'effort': 'small',
        'status': 'planned'
    },

    # MEDIUM PRIORITY - Phase 2/3
    {
        'title': 'Detailed Tax Bracket Optimization',
        'description': 'Year-by-year federal and state tax bracket analysis with strategies to stay in target brackets. Include FICA, NIIT (3.8%), and AMT considerations.',
        'category': 'Tax Planning',
        'priority': 'medium',
        'phase': 'phase2',
        'impact': 'high',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Disability Insurance & Income Protection',
        'description': 'Analyze disability insurance needs based on income replacement percentage, benefit period, and integration with Social Security disability benefits.',
        'category': 'Insurance Analysis',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'small',
        'status': 'planned'
    },
    {
        'title': 'Long-Term Care Insurance Analysis',
        'description': 'Compare long-term care insurance options, costs, benefits, and self-insurance alternatives. Show impact on estate and Medicaid planning.',
        'category': 'Insurance Analysis',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Business Owner Retirement Planning',
        'description': 'Add business valuation tracking, exit strategy modeling, SEP IRA/Solo 401(k) calculations, and business succession planning tools.',
        'category': 'Business Owner',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Real Estate Enhancements',
        'description': 'Add downsizing cost-benefit analysis, reverse mortgage (HECM) evaluation, rental property cash flow detailed modeling, and 1031 exchange planning.',
        'category': 'Real Estate',
        'priority': 'medium',
        'phase': 'phase2',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Dynamic Withdrawal Strategies',
        'description': 'Implement Guyton-Klinger guardrails, Variable Percentage Withdrawal (VPW), and ratcheting rules for adaptive spending based on market performance.',
        'category': 'Withdrawal Strategy',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Life Event Scenario Modeling',
        'description': 'Model major life events: divorce, remarriage, death of spouse, disability, job loss, geographic relocation with cost of living adjustments.',
        'category': 'Life Events',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Advanced Scenario Analysis',
        'description': 'Add what-if scenarios for earlier/later retirement, higher/lower spending, market crash timing, inflation shocks, and longevity (living to 100+).',
        'category': 'Scenario Modeling',
        'priority': 'medium',
        'phase': 'phase2',
        'impact': 'high',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Beneficiary IRA Rules (SECURE Act)',
        'description': 'Implement inherited IRA 10-year rule calculations, spousal rollover options, and beneficiary distribution planning under SECURE Act 2.0.',
        'category': 'Estate Planning',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Annuity Comparison Tool',
        'description': 'Compare immediate annuities (SPIA), deferred income annuities (DIA), QLACs, and variable annuities with living benefits vs DIY portfolio approach.',
        'category': 'Pension & Annuity',
        'priority': 'medium',
        'phase': 'phase3',
        'impact': 'low',
        'effort': 'medium',
        'status': 'planned'
    },

    # LOW PRIORITY - Backlog
    {
        'title': 'Cash Flow Budget Enhancements',
        'description': 'Add actual spending tracking vs budget, variance analysis, envelope budgeting, subscription tracking, and spending categories breakdown.',
        'category': 'Cash Flow',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Retirement Lifestyle Planning',
        'description': 'Add leisure activity budgets, travel planning, hobby costs, geographic arbitrage analysis, and age-in-place vs retirement community comparisons.',
        'category': 'Retirement Lifestyle',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'low',
        'effort': 'small',
        'status': 'planned'
    },
    {
        'title': 'Document Vault & Beneficiary Tracking',
        'description': 'Secure document storage for wills, trusts, POA, insurance policies, statements, with beneficiary tracking across all accounts.',
        'category': 'Compliance & Documentation',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'low',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Advanced Investment Factor Analysis',
        'description': 'Add investment factor tracking (value, momentum, quality), tax-efficient fund placement, dividend yield analysis, and alternative asset classes.',
        'category': 'Investment Analysis',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'low',
        'effort': 'large',
        'status': 'planned'
    },
    {
        'title': 'Family Legacy & Gifting Goals',
        'description': 'Track gifting to children/grandchildren, college funding for grandkids, family loans, inheritance planning with specific amounts and timelines.',
        'category': 'Family & Legacy',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'low',
        'effort': 'medium',
        'status': 'planned'
    },
    {
        'title': 'Risk Analysis Dashboard',
        'description': 'Comprehensive risk dashboard showing longevity risk, inflation risk, market crash timing, healthcare cost inflation, and cognitive decline planning.',
        'category': 'Risk Analysis',
        'priority': 'low',
        'phase': 'backlog',
        'impact': 'medium',
        'effort': 'medium',
        'status': 'planned'
    },
]


def populate_roadmap():
    """Populate the roadmap table with gap analysis items."""
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feature_roadmap'")
    if not cursor.fetchone():
        print("Error: feature_roadmap table does not exist. Run migrations first.")
        conn.close()
        sys.exit(1)

    # Clear existing data (optional - comment out if you want to keep existing items)
    # cursor.execute("DELETE FROM feature_roadmap")

    # Insert items
    inserted = 0
    for item in ROADMAP_ITEMS:
        try:
            cursor.execute('''
                INSERT INTO feature_roadmap
                (title, description, category, priority, phase, status, impact, effort)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item['title'],
                item['description'],
                item['category'],
                item['priority'],
                item['phase'],
                item['status'],
                item.get('impact'),
                item.get('effort')
            ))
            inserted += 1
        except sqlite3.IntegrityError as e:
            print(f"Skipping duplicate: {item['title']}")
        except Exception as e:
            print(f"Error inserting {item['title']}: {e}")

    conn.commit()
    conn.close()

    print(f"✅ Successfully inserted {inserted} roadmap items")
    print(f"Total items in roadmap: {inserted}")


if __name__ == '__main__':
    populate_roadmap()
