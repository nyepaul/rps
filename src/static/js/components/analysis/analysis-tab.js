/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showErrorInContainer, showLoading, escapeHtml } from '../../utils/dom.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { renderStandardTimelineChart } from '../../utils/charts.js';
import { APP_CONFIG } from '../../config.js';

/**
 * Render the account breakdown rows for the investment portfolio detail panel.
 */
function renderAccountBreakdown(accounts) {
    if (!accounts || accounts.length === 0) return '<div style="color: var(--text-secondary); font-size: 12px;">No account data available</div>';
    return accounts.map(a => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-primary);">${a.name || a.account}</span>
            <span style="color: var(--accent-color); font-weight: 600;">${formatCurrency(a.value, 0)}</span>
        </div>
    `).join('');
}

// Store last analysis result for saving as scenario
let lastAnalysisResult = null;
let lastSimulations = null;
let timelineChartInstances = {}; // Changed to object to store multiple chart instances

function parseSimulationCount(rawValue) {
    const fallback = APP_CONFIG.DEFAULT_SIMULATIONS;
    const normalized = String(rawValue ?? '').replace(/,/g, '').trim();
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function statHelpButton(helpType, title) {
    return `<button type="button" class="analysis-term-help" data-help="${helpType}" title="${title}" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px; background: none; border: none; cursor: pointer; padding: 0;">?</button>`;
}

function planningHelpButton(helpKey, label) {
    return `<button type="button" class="analysis-planning-help" data-help-key="${helpKey}" title="Open explanation for ${label}" style="display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0; margin: 0; color: inherit; font: inherit; font-weight: inherit; cursor: pointer;">
        <span>${label}</span>
        <span style="font-size: 12px; color: var(--accent-color);">ℹ️</span>
    </button>`;
}

const ANALYSIS_CARD_HELP = {
    life_insurance: {
        title: 'Life Insurance Estimate',
        context: 'A directional estimate of survivor protection needs based on income replacement, debts, and dependent support.',
        metrics: [
            'Coverage Need: modeled total protection target.',
            'Existing Coverage: current policies already in place.',
            'Coverage Gap: additional protection needed after existing coverage.',
            'Suggested 20Y Term: practical term-policy amount to close most of the gap.'
        ],
        how_to_use: 'If gap is positive, price term insurance and compare cost with your budget and timeline until financial independence.'
    },
    estate_tax_gifting: {
        title: 'Estate Tax & Gifting Strategy',
        context: 'Screens your estate versus modeled federal exemption and provides gifting guidance.',
        metrics: [
            'Net Estate: current modeled estate value.',
            'Taxable Today: amount above modeled exemption now.',
            'Projected Taxable: potential taxable portion in future projection.',
            'Annual Gift Capacity: annual transfer pace under current assumptions.'
        ],
        how_to_use: 'Even when taxable estate is zero, focus on beneficiary updates, will/trust quality, POA, and healthcare directives.'
    },
    investment_fee_impact: {
        title: 'Investment Fee Impact Analyzer',
        context: 'Quantifies fee drag and its compounding impact on long-term outcomes.',
        metrics: [
            'Investable Assets: accounts included in fee analysis.',
            'Weighted Fee: blended expense rate across holdings.',
            'Annual Fee Cost: approximate yearly fee dollars.',
            'Long-Term Impact: cumulative projected fee drag over time.'
        ],
        how_to_use: 'Prioritize replacing high-fee holdings with lower-cost alternatives where strategy fit remains appropriate.'
    },
    real_estate_enhancements: {
        title: 'Real Estate Enhancements',
        context: 'Summarizes property equity now and projected equity under your assumptions.',
        metrics: [
            'Properties: number of tracked properties.',
            'Current Equity: estimated value minus outstanding debt.',
            'Projected Equity (10Y): modeled equity in ten years.',
            'Cap Rate: optional income-yield indicator for investment properties.'
        ],
        how_to_use: 'Add sale timing assumptions to test downside protection, liquidity improvements, and retirement funding flexibility.'
    },
    advanced_scenario_analysis: {
        title: 'Advanced Scenario Analysis',
        context: 'Compares conservative/moderate/aggressive outcomes using resilience-oriented metrics.',
        metrics: [
            'Top Resilience: strongest durability profile in this run.',
            'Success Spread: difference between best and worst success rates.',
            'Median Spread: difference in median ending balances across scenarios.',
            'Downside (P10): stress-case balance for each scenario.'
        ],
        how_to_use: 'Use the spread values to judge whether extra risk is being compensated by materially better outcomes.'
    },
    life_event_scenario_modeling: {
        title: 'Life Event Scenario Modeling',
        context: 'Applies common real-world shocks and opportunities to your baseline plan.',
        metrics: [
            'Baseline Success/Median: reference case before event overlays.',
            'Event Delta: improvement or degradation versus baseline.',
            'Details: short explanation of each event impact.'
        ],
        how_to_use: 'Prioritize actions that protect against negative deltas first (healthcare shocks, spending shocks), then optimize upside.'
    },
    additional_planning_modules: {
        title: 'Additional Planning Modules',
        context: 'A grouped set of specialized planning modules beyond the core simulation outputs.',
        metrics: [
            'Each module card includes a summary plus one anchor metric.',
            'Modules are designed to surface gaps quickly and guide follow-up action.'
        ],
        how_to_use: 'Click each module title for context, then convert the highest-impact findings into Action Items.'
    },
    long_term_care_analysis: {
        title: 'Long-Term Care Analysis',
        context: 'Estimates late-life care burden and highlights funding gaps.',
        metrics: ['Projected LTC total: modeled total long-term care cost.'],
        how_to_use: 'Compare self-funding reserves versus insurance alternatives and update assumptions for location and care intensity.'
    },
    disability_income_protection: {
        title: 'Disability Income Protection',
        context: 'Estimates income-replacement needs if work capacity is reduced before retirement.',
        metrics: ['Recommended monthly benefit: target replacement amount from disability coverage or reserves.'],
        how_to_use: 'Use this to size employer/private disability coverage and emergency reserves.'
    },
    business_owner_retirement: {
        title: 'Business Owner Retirement Planning',
        context: 'Evaluates retirement dependence on business value and concentration risk.',
        metrics: ['Business concentration signal: indicates how dependent retirement is on business proceeds.'],
        how_to_use: 'Stress-test delayed sale/discounted valuation scenarios and build diversification plans ahead of exit.'
    },
    secure_act_beneficiary_ira: {
        title: 'SECURE Act Beneficiary IRA Rules',
        context: 'Flags inheritance distribution rules for non-spouse beneficiaries under current modeling.',
        metrics: ['Non-spouse default rule: typically a 10-year distribution window.'],
        how_to_use: 'Coordinate beneficiary designations and estate documents with current tax planning assumptions.'
    },
    annuity_comparison: {
        title: 'Annuity Comparison Tool',
        context: 'Compares guaranteed-income annuity framing versus flexible portfolio drawdown.',
        metrics: ['Fixed annuity estimate: modeled annual guaranteed-income equivalent.'],
        how_to_use: 'Use as a tradeoff study: certainty of income vs liquidity, control, and upside participation.'
    },
    cashflow_budget_enhancements: {
        title: 'Cashflow Budget Enhancements',
        context: 'Surfaces budgeting granularity and surplus tracking quality.',
        metrics: ['Annual surplus: modeled yearly cushion after income and spending.'],
        how_to_use: 'If surplus is thin or zero, prioritize expense detail cleanup and recurring-cashflow stabilization.'
    },
    retirement_lifestyle_planning: {
        title: 'Retirement Lifestyle Planning',
        context: 'Translates lifestyle choices into spending levels and sustainability tradeoffs.',
        metrics: ['Lifestyle budget indicators: planning anchors for lean/moderate/spending targets.'],
        how_to_use: 'Use these targets to align desired lifestyle with your success-rate tolerance.'
    },
    document_vault_beneficiary_tracking: {
        title: 'Document Vault & Beneficiary Tracking',
        context: 'Tracks legal-document readiness and beneficiary completeness.',
        metrics: ['Doc completion: completion ratio for key legal and account documentation.'],
        how_to_use: 'Target 100% on critical docs and beneficiary fields before optimization work.'
    },
    advanced_investment_factor_analysis: {
        title: 'Advanced Investment Factor Analysis',
        context: 'Examines liquidity, tax-bucket mix, and implementation flexibility.',
        metrics: ['Liquidity ratio: near-term accessible assets relative to modeled needs.'],
        how_to_use: 'Improve short-term liquidity before adding concentration or sequence-sensitive risk.'
    },
    family_legacy_gifting_goals: {
        title: 'Family Legacy & Gifting Goals',
        context: 'This is the primary legacy-wealth/family-planning module for pacing transfers tax-efficiently.',
        metrics: ['Annual gift capacity: modeled yearly transfer pace under current assumptions.'],
        how_to_use: 'Use this to stage gifts to heirs/charity while preserving retirement durability.'
    },
    risk_analysis_dashboard: {
        title: 'Risk Analysis Dashboard',
        context: 'Composite risk score across market durability, liquidity, debt pressure, and downside resilience.',
        metrics: ['Overall risk score: rolled-up risk indicator from multiple dimensions.'],
        how_to_use: 'Use score directionally; investigate underlying drivers before making allocation or spending changes.'
    },
    sequence_risk_stress_test: {
        title: 'Sequence Risk Stress Test',
        context: 'Injects market crashes at different retirement stages to test fragility to return ordering.',
        metrics: [
            'Success Rate Delta: change in probability vs baseline.',
            'Median Balance Delta: change in expected ending balance vs baseline.',
            'Crash Window: years where stress event is applied.'
        ],
        how_to_use: 'If early-crash deltas are severe, reduce withdrawal pressure, raise liquidity, or adjust retirement timing.'
    },
    plan_health_monitoring_drift_alerts: {
        title: 'Plan Health Monitoring & Drift Alerts',
        context: 'Tracks real-world drift in spending, returns, and inflation versus your plan assumptions.',
        metrics: [
            'Drift Score: combined measure of plan-vs-actual deviation.',
            'Alert Count: number of flagged drift dimensions.',
            'Next Review Cadence: recommended check-in frequency.',
            'Drift Components: spending, return, and inflation deltas.'
        ],
        how_to_use: 'If alert count is non-zero, run a focused re-plan and update assumptions before making tactical portfolio changes.'
    },
    tax_law_update_engine: {
        title: 'Tax Law Update Engine',
        context: 'Checks whether modeled tax assumptions are aligned with the current tax year.',
        metrics: [
            'Configured Tax Year: tax-year assumptions currently in your plan.',
            'Current Tax Year: calendar tax year reference.',
            'Policy Freshness Score: directional confidence in tax assumption currency.',
            'Update Required: whether tax settings should be refreshed now.'
        ],
        how_to_use: 'Refresh brackets and thresholds when stale to avoid distorted Roth, withdrawal, and cashflow decisions.'
    },
    pre65_healthcare_bridge_planner: {
        title: 'Pre-65 Healthcare Bridge Planner',
        context: 'Estimates healthcare funding needs from retirement until Medicare eligibility.',
        metrics: [
            'Bridge Years: years between retirement and age 65.',
            'Annual Bridge Cost: estimated annual pre-65 coverage cost.',
            'Total Bridge Cost: aggregate cost across bridge years.',
            'Estimated Subsidy Opportunity: modeled subsidy offset potential.'
        ],
        how_to_use: 'Use bridge cost to set dedicated reserves and evaluate retirement timing tradeoffs before Medicare starts.'
    },
    guaranteed_income_floor_optimizer: {
        title: 'Guaranteed Income Floor Optimizer',
        context: 'Compares essential spending against guaranteed income sources like Social Security and pensions.',
        metrics: [
            'Essential Spending: modeled non-negotiable annual spending floor.',
            'Guaranteed Income: annual Social Security plus pension income.',
            'Floor Coverage Ratio: guaranteed income coverage of essential spending.',
            'Annual Floor Shortfall: remaining annual gap to close.'
        ],
        how_to_use: 'If shortfall exists, test claiming-age changes, annuity layering, or spending reductions on essentials.'
    },
    social_security_statement_reconciliation: {
        title: 'Social Security Statement Reconciliation',
        context: 'Reconciles your modeled Social Security benefit with statement-based estimates.',
        metrics: [
            'Modeled Monthly Benefit: value currently used in plan modeling.',
            'Statement Monthly Benefit: latest statement estimate.',
            'Monthly Delta: dollar difference between modeled and statement values.',
            'Delta %: percentage variance requiring review if material.'
        ],
        how_to_use: 'When delta is large, update earnings record assumptions and claiming strategy before finalizing drawdown.'
    },
    data_aggregation_reconciliation_hub: {
        title: 'Data Aggregation & Reconciliation Hub',
        context: 'Summarizes connected, imported, and manual data sources with reconciliation confidence.',
        metrics: [
            'Linked Accounts: connected account feeds.',
            'CSV Sources: imported file-based sources.',
            'Manual Entries: hand-entered records requiring validation.',
            'Data Confidence Score: directional quality signal for decision-grade planning.'
        ],
        how_to_use: 'Increase linked coverage and reduce manual mismatches before relying on scenario comparisons.'
    },
    longevity_care_path_modeling: {
        title: 'Longevity & Care Path Modeling',
        context: 'Models staged care needs across home care, assisted living, and skilled nursing paths.',
        metrics: [
            'Years Modeled: planning horizon used for care-path assumptions.',
            'Weighted Annual Care Cost: blended annual care estimate.',
            'Projected Lifetime Care Cost: total modeled care burden.',
            'Care Path Mix: home/assisted/skilled weighting assumptions.'
        ],
        how_to_use: 'Use this to decide between self-funding, insurance, and earmarked reserves for later-life care.'
    },
    charitable_strategy_optimizer: {
        title: 'Charitable Strategy Optimizer (DAF + QCD)',
        context: 'Optimizes charitable flows using donor-advised fund bunching, QCD, and tax-aware giving.',
        metrics: [
            'Annual Giving Target: current charitable cadence.',
            'Recommended DAF Bunch Amount: multi-year contribution strategy.',
            'QCD Candidate Amount: potential qualified charitable distribution amount.',
            'Estimated Tax Benefit: modeled tax efficiency from strategy.'
        ],
        how_to_use: 'Coordinate giving method and timing with bracket management and RMD strategy.'
    },
    household_collaboration_workflow: {
        title: 'Household Collaboration & Approval Workflow',
        context: 'Tracks spouse/advisor reviewers, open reviews, and approval progress for governance.',
        metrics: [
            'Collaborator Count: number of active reviewers.',
            'Review Item Count: total decisions under review.',
            'Open Review Count: unresolved plan items.',
            'Approval Ratio: percentage of items approved.'
        ],
        how_to_use: 'Use this as a governance checkpoint before implementing major allocation, tax, or spending changes.'
    },
    retirement_paycheck_builder: {
        title: 'Retirement Paycheck Builder',
        context: 'Builds a monthly paycheck sequence across guaranteed and portfolio income sources.',
        metrics: [
            'Target Monthly Paycheck: monthly spending target.',
            'Guaranteed Monthly Income: SS/pension monthly baseline.',
            'Portfolio Draw Monthly: monthly withdrawal needed from assets.',
            'Emergency Buffer Months: reserve buffer expectation.'
        ],
        how_to_use: 'Use paycheck sequencing to stabilize cashflow and reduce ad hoc withdrawals during market stress.'
    }
};

function showPlanningCardHelpModal(helpKey) {
    const help = ANALYSIS_CARD_HELP[helpKey];
    if (!help) return;

    const metricsHtml = (help.metrics || [])
        .map((m) => `<li style="margin-bottom: 6px; color: var(--text-secondary); font-size: 14px;">${m}</li>`)
        .join('');

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 12px; max-width: 860px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; border: 1px solid var(--border-color);">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="padding: 24px;">
                <h2 style="font-size: 24px; margin: 0 0 12px 0; color: var(--accent-color);">📘 ${help.title}</h2>
                <p style="margin: 0 0 14px 0; color: var(--text-secondary); line-height: 1.6;">${help.context}</p>
                <h3 style="font-size: 17px; margin: 0 0 8px 0;">How to Read This Card</h3>
                <ul style="margin: 0 0 14px 0; padding-left: 18px;">${metricsHtml}</ul>
                <h3 style="font-size: 17px; margin: 0 0 6px 0;">How to Use It</h3>
                <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">${help.how_to_use}</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function setupPlanningCardHelpHandlers(container) {
    container.querySelectorAll('.analysis-planning-help').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const helpKey = btn.dataset.helpKey;
            if (helpKey) showPlanningCardHelpModal(helpKey);
        });
    });
}

function showPlanningDetailModal(title, html) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 12px; max-width: 920px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; border: 1px solid var(--border-color);">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="padding: 24px;">
                <h2 style="font-size: 22px; margin: 0 0 12px 0; color: var(--accent-color);">${escapeHtml(title)}</h2>
                ${html}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function renderKeyValueTable(rows) {
    const body = (rows || [])
        .map(({ k, v }) => `
            <div style="display: grid; grid-template-columns: 1.3fr 1.7fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase;">${escapeHtml(k)}</div>
                <div style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${v}</div>
            </div>
        `)
        .join('');
    return `<div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px;">${body}</div>`;
}

function showCollege529Details(college) {
    if (!college?.available) return;

    const a = college.assumptions || {};
    const rows = [
        { k: 'Annual College Cost (Today)', v: formatCurrency(a.annual_college_cost_today || 0, 0) },
        { k: 'Years in College', v: escapeHtml(String(a.years_in_college ?? 4)) },
        { k: 'Tuition Inflation', v: formatPercent(a.tuition_inflation || 0, 2) },
        { k: 'Expected 529 Return', v: formatPercent(a.expected_529_return || 0, 2) },
        { k: 'Target Funding Ratio', v: formatPercent(a.target_funding_ratio ?? 1.0, 2) }
    ];

    const totals = college.household_totals || {};
    const totalsRows = [
        { k: 'Existing 529 Balance', v: formatCurrency(totals.existing_529_balance || 0, 0) },
        { k: 'Target Funding (Total)', v: formatCurrency(totals.target_funding_total || 0, 0) },
        { k: 'Monthly Savings Needed (Total)', v: formatCurrency(totals.monthly_savings_needed_total || 0, 0) }
    ];

    const html = `
        <p style="margin: 0 0 14px 0; color: var(--text-secondary); line-height: 1.6;">
            This module estimates a target education fund per child by inflating annual college costs for each college year, then computes a monthly savings amount to close the gap using an ordinary-annuity future value formula.
        </p>
        <h3 style="font-size: 15px; margin: 0 0 8px 0;">Assumptions</h3>
        ${renderKeyValueTable(rows)}
        <h3 style="font-size: 15px; margin: 16px 0 8px 0;">Household Totals</h3>
        ${renderKeyValueTable(totalsRows)}
        <h3 style="font-size: 15px; margin: 16px 0 8px 0;">Per-Child Rows</h3>
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px;">
            ${(college.children || []).map((c) => `
                <div style="display:flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="font-weight: 700;">${escapeHtml(c.name || 'Child')}</div>
                    <div style="color: var(--text-secondary);">${formatCurrency(c.monthly_savings_needed || 0, 0)}/mo</div>
                </div>
            `).join('') || '<div style="color: var(--text-secondary);">No child rows available.</div>'}
        </div>
    `;
    showPlanningDetailModal('529 College Savings Planner Details', html);
}

function showCollege529ChildDetails(college, childIndex) {
    if (!college?.available) return;
    const child = (college.children || [])[childIndex];
    if (!child) return;

    const a = college.assumptions || {};
    const yearsToCollege = Number(child.years_to_college || 0);
    const gap = Number(child.funding_gap || 0);
    const r = Number(a.expected_529_return || 0) / 12.0;
    const n = Math.max(0, yearsToCollege) * 12;
    const factor = (yearsToCollege > 0 && r > 0) ? ((((1 + r) ** n) - 1) / r) : null;

    const childRows = [
        { k: 'Child', v: escapeHtml(String(child.name || `Child ${childIndex + 1}`)) },
        { k: 'Years to College', v: escapeHtml(String(child.years_to_college ?? '-')) },
        { k: 'Projected Total College Cost', v: formatCurrency(child.projected_total_college_cost || 0, 0) },
        { k: 'Target Funding', v: formatCurrency(child.target_funding || 0, 0) },
        { k: 'Current 529 (Allocated)', v: formatCurrency(child.existing_529_allocation || 0, 0) },
        { k: 'Funding Gap', v: formatCurrency(child.funding_gap || 0, 0) },
        { k: 'Monthly Savings Needed', v: formatCurrency(child.monthly_savings_needed || 0, 0) }
    ];

    const formulaHtml = yearsToCollege <= 0
        ? `<div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            <strong>When years to college is 0:</strong> monthly_needed = gap / 12.
        </div>`
        : `<div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            <strong>Ordinary annuity:</strong><br>
            r = expected_return / 12 = ${formatPercent(a.expected_529_return || 0, 2)} / 12<br>
            n = years_to_college * 12 = ${n}<br>
            factor = ((1 + r)^n - 1) / r = ${factor ? factor.toFixed(2) : 'N/A'}<br>
            monthly_needed = gap / factor = ${formatCurrency(gap, 0)} / ${factor ? factor.toFixed(2) : 'N/A'}
        </div>`;

    const html = `
        <h3 style="font-size: 15px; margin: 0 0 8px 0;">Row Breakdown</h3>
        ${renderKeyValueTable(childRows)}
        <h3 style="font-size: 15px; margin: 16px 0 8px 0;">How Monthly Need Is Calculated</h3>
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px;">
            ${formulaHtml}
        </div>
    `;
    showPlanningDetailModal(`529 Details: ${child.name || `Child ${childIndex + 1}`}`, html);
}

function showEstateGiftingDetails(estate) {
    if (!estate?.available) return;

    const a = estate.assumptions || {};
    const e = estate.estate || {};
    const g = estate.gifting || {};

    const assumptionsRows = [
        { k: 'Federal Exemption (Per Person)', v: formatCurrency(a.federal_exemption_per_person || 0, 0) },
        { k: 'Annual Gift Exclusion (Per Donor/Recipient)', v: formatCurrency(a.annual_gift_exclusion_per_donor_per_recipient || 0, 0) },
        { k: 'Annual Growth Rate (Estate Projection)', v: formatPercent(a.annual_growth_rate || 0, 2) },
        { k: 'Projection Years', v: escapeHtml(String(a.projection_years ?? '-')) }
    ];

    const estateRows = [
        { k: 'Gross Estate', v: formatCurrency(e.gross_estate || 0, 0) },
        { k: 'Liabilities', v: formatCurrency(e.liabilities || 0, 0) },
        { k: 'Net Estate', v: formatCurrency(e.net_estate || 0, 0) },
        { k: 'Federal Exemption (Total)', v: formatCurrency(e.federal_exemption_total || 0, 0) },
        { k: 'Taxable Estate Today', v: formatCurrency(e.taxable_estate_today || 0, 0) },
        { k: 'Projected Estate', v: formatCurrency(e.projected_estate || 0, 0) },
        { k: 'Projected Taxable Estate', v: formatCurrency(e.projected_taxable_estate || 0, 0) }
    ];

    const giftingRows = [
        { k: 'Beneficiaries Count', v: escapeHtml(String(g.beneficiaries_count ?? '-')) },
        { k: 'Donors Count', v: escapeHtml(String(g.donors_count ?? '-')) },
        { k: 'Annual Gifting Capacity', v: formatCurrency(g.annual_gifting_capacity || 0, 0) }
    ];

    const html = `
        <p style="margin: 0 0 14px 0; color: var(--text-secondary); line-height: 1.6;">
            This card is a screening tool: it compares modeled net estate to a simplified federal exemption and shows an annual exclusion gifting capacity estimate.
        </p>
        <h3 style="font-size: 15px; margin: 0 0 8px 0;">Assumptions</h3>
        ${renderKeyValueTable(assumptionsRows)}
        <h3 style="font-size: 15px; margin: 16px 0 8px 0;">Estate Breakdown</h3>
        ${renderKeyValueTable(estateRows)}
        <h3 style="font-size: 15px; margin: 16px 0 8px 0;">Gifting Capacity</h3>
        ${renderKeyValueTable(giftingRows)}
        ${estate.recommendations?.length ? `
            <h3 style="font-size: 15px; margin: 16px 0 8px 0;">Recommendations</h3>
            <ul style="margin: 0; padding-left: 18px; color: var(--text-secondary);">
                ${estate.recommendations.map(r => `<li style="margin-bottom: 6px;">${escapeHtml(String(r))}</li>`).join('')}
            </ul>
        ` : ''}
    `;
    showPlanningDetailModal('Estate Tax & Gifting Strategy Details', html);
}

function setupPlanningCardDetailHandlers(container, planningData) {
    // Remove previous handler if present (tab re-renders)
    if (container._planningDetailClickHandler) {
        container.removeEventListener('click', container._planningDetailClickHandler);
        container._planningDetailClickHandler = null;
    }

    const handler = (event) => {
        const trigger = event.target.closest('[data-detail]');
        if (!trigger || !container.contains(trigger)) return;
        const type = trigger.dataset.detail;
        if (!type) return;

        if (type === 'college') {
            event.preventDefault();
            showCollege529Details(planningData?.college_529_plan);
            return;
        }
        if (type === 'college-child') {
            event.preventDefault();
            const idx = Number.parseInt(trigger.dataset.childIndex || '-1', 10);
            if (!Number.isFinite(idx) || idx < 0) return;
            showCollege529ChildDetails(planningData?.college_529_plan, idx);
            return;
        }
        if (type === 'estate') {
            event.preventDefault();
            showEstateGiftingDetails(planningData?.estate_tax_gifting_strategy);
        }
    };

    container._planningDetailClickHandler = handler;
    container.addEventListener('click', handler);
}

export function renderAnalysisTab(container) {
    // Clean up previous keyboard handler if exists
    if (container._analysisKeyboardHandler) {
        document.removeEventListener('keydown', container._analysisKeyboardHandler);
        container._analysisKeyboardHandler = null;
    }

    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                <h2 style="margin-bottom: 10px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Please create or select a profile to run analysis.
                </p>
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
        return;
    }

    // Get settings from localStorage
    const savedSimulations = localStorage.getItem('rps_simulations') || APP_CONFIG.DEFAULT_SIMULATIONS;
    const savedMarketProfile = localStorage.getItem('rps_market_profile') || 'historical';
    const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfile];

    // Group market profiles by category
    const profileCategories = {
        'Base Scenarios': ['historical', 'conservative', 'balanced', 'aggressive'],
        'Bear & Crisis': ['bear-market', 'recession', 'stagflation', 'crisis-2008'],
        'Bull & Optimistic': ['bull-market', 'post-covid', 'roaring-20s'],
        'Historical Periods': ['dotcom-boom', 'dotcom-bust', 'great-recession', 'decade-2010s'],
        'Global & Alternative': ['emerging', 'international', 'gold-hedge', 'real-estate'],
        'Income & Stability': ['dividend', 'bonds-heavy'],
        'Sector-Specific': ['tech-heavy', 'healthcare', 'financials', 'energy']
    };

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-3);">
                <div>
                    <h1 style="font-size: var(--font-2xl); margin: 0;">Retirement Analysis</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Monte Carlo simulations for <strong>${profile.name}</strong>
                    </p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="show-calculation-info" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        <span>📐</span> How Calculations Work
                    </button>
                    <div id="scenario-loader-container" style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 700;">LOAD SAVED:</span>
                        <select id="saved-scenario-select" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px; min-width: 180px;">
                            <option value="">-- Select Scenario --</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Analysis Configuration -->
            <div class="analysis-panel" style="padding: 12px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <!-- Market Conditions Section -->
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label style="font-weight: 700; font-size: 14px; color: var(--accent-color);">
                            📊 MARKET CONDITIONS
                        </label>
                        <button id="market-conditions-help-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 12px; padding: 4px 8px;">
                            ℹ️ Why This Matters
                        </button>
                    </div>

                    <!-- Mode Selector -->
                    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                        <button class="market-mode-btn" data-mode="simple" style="flex: 1; padding: 8px 12px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Simple
                        </button>
                        <button class="market-mode-btn" data-mode="preset" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Presets
                        </button>
                        <button class="market-mode-btn" data-mode="timeline" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Timeline
                        </button>
                        <button class="market-mode-btn" data-mode="cycle" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Cycle
                        </button>
                    </div>

                    <!-- Simple Mode (Default) -->
                    <div id="market-mode-simple" class="market-mode-content">
                        <select id="market-profile-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; margin-bottom: 8px;">
                            ${Object.entries(profileCategories).map(([category, keys]) => `
                                <optgroup label="${category}">
                                    ${keys.filter(key => APP_CONFIG.MARKET_PROFILES[key]).map(key => {
                                        const mp = APP_CONFIG.MARKET_PROFILES[key];
                                        const label = `${mp.name} (${(mp.stock_return_mean * 100).toFixed(1)}% / ${(mp.bond_return_mean * 100).toFixed(1)}% / ${(mp.inflation_mean * 100).toFixed(1)}%)`;
                                        return `<option value="${key}" ${key === savedMarketProfile ? 'selected' : ''}>${label}</option>`;
                                    }).join('')}
                                </optgroup>
                            `).join('')}
                        </select>
                        <div style="background: var(--warning-bg); color: var(--warning-text); padding: 8px; border-radius: 4px; font-size: 11px; border: 1px solid var(--warning-color);">
                            ⚠️ <strong>Note:</strong> Simple mode uses ONE market condition for your ENTIRE retirement (30-40 years). This is unrealistic. Consider using Presets or Timeline for more accurate projections.
                        </div>
                    </div>

                    <!-- Preset Mode -->
                    <div id="market-mode-preset" class="market-mode-content" style="display: none;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;" id="preset-scenarios-container">
                            ${Object.entries(APP_CONFIG.PRESET_SCENARIOS).map(([key, preset]) => `
                                <button class="preset-scenario-btn" data-preset="${key}" style="padding: 12px; background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.2s;">
                                    <div style="font-size: 24px; margin-bottom: 4px;">${preset.icon}</div>
                                    <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text-primary);">${preset.name}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${preset.description}</div>
                                </button>
                            `).join('')}
                        </div>
                        <div id="preset-selected-display" style="margin-top: 10px; padding: 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--accent-color); display: none;">
                            <strong style="color: var(--accent-color);">Selected:</strong> <span id="preset-selected-name"></span>
                        </div>
                    </div>

                    <!-- Timeline Mode -->
                    <div id="market-mode-timeline" class="market-mode-content" style="display: none;">
                        <div id="timeline-periods-container" style="margin-bottom: 10px;">
                            <!-- Timeline periods will be added here dynamically -->
                        </div>
                        <button id="add-timeline-period-btn" style="width: 100%; padding: 8px; background: var(--success-color); color: var(--text-on-success); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            + Add Period
                        </button>
                    </div>

                    <!-- Cycle Mode -->
                    <div id="market-mode-cycle" class="market-mode-content" style="display: none;">
                        <div style="margin-bottom: 10px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="cycle-repeat-checkbox" checked style="cursor: pointer;">
                                <span style="font-size: 13px; color: var(--text-primary);">Repeat cycle throughout retirement</span>
                            </label>
                        </div>
                        <div id="cycle-pattern-container" style="margin-bottom: 10px;">
                            <!-- Cycle pattern elements will be added here dynamically -->
                        </div>
                        <button id="add-cycle-element-btn" style="width: 100%; padding: 8px; background: var(--success-color); color: var(--text-on-success); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            + Add Phase
                        </button>
                    </div>
                </div>

                <!-- Spending Strategy & Run -->
                <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: flex-end;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-weight: 700; font-size: 12px; color: var(--accent-color);">SPENDING STRATEGY</label>
                            <button id="spending-strategy-help-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 11px; padding: 0;">ℹ️ Help</button>
                        </div>
                        <select id="spending-model-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            <option value="constant_real">Constant (Default)</option>
                            <option value="retirement_smile">Retirement Smile</option>
                            <option value="conservative_decline">Conservative Decline</option>
                        </select>
                    </div>

                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 700; font-size: 12px; color: var(--accent-color);">SIMULATIONS</label>
                        <select id="simulations-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            <option value="1000" ${parseInt(savedSimulations) === 1000 ? 'selected' : ''}>1,000</option>
                            <option value="5000" ${parseInt(savedSimulations) === 5000 ? 'selected' : ''}>5,000</option>
                            <option value="10000" ${parseInt(savedSimulations) === 10000 ? 'selected' : ''}>10,000</option>
                        </select>
                    </div>

                    <button id="run-analysis-btn" class="primary-btn" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 700; height: fit-content;">
                        RUN ANALYSIS
                    </button>
                </div>

            </div>

            <!-- Results Container -->
            <div id="results-container"></div>
        </div>

        <style>
            .analysis-panel {
                background: var(--bg-secondary);
                padding: var(--space-5);
                border-radius: 12px;
                margin-bottom: var(--space-5);
            }
            .primary-btn:hover {
                background: var(--accent-hover);
            }
            .market-mode-btn.active {
                background: var(--accent-color) !important;
                color: var(--text-on-accent) !important;
                border-color: var(--accent-color) !important;
            }
            .market-mode-btn:hover {
                opacity: 0.9;
            }
            .preset-scenario-btn:hover {
                border-color: var(--accent-color);
                background: var(--bg-secondary);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .preset-scenario-btn.selected {
                border-color: var(--accent-color);
                border-width: 3px;
                background: var(--bg-secondary);
            }
            .timeline-period {
                background: var(--bg-primary);
                padding: 12px;
                border-radius: 6px;
                border: 1px solid var(--border-color);
                margin-bottom: 8px;
            }
            .cycle-phase {
                background: var(--bg-primary);
                padding: 12px;
                border-radius: 6px;
                border: 1px solid var(--border-color);
                margin-bottom: 8px;
            }
            .remove-btn {
                background: var(--danger-color);
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
            }
            .remove-btn:hover {
                opacity: 0.9;
            }
            .result-card {
                background: var(--bg-secondary);
                padding: var(--space-4);
                border-radius: 12px;
                margin-bottom: var(--space-5);
            }
            .stat-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: var(--space-4);
                margin-top: var(--space-4);
            }
            .stat-item {
                background: var(--bg-primary);
                padding: var(--space-4);
                border-radius: 8px;
                text-align: center;
                border: 2px solid var(--border-color);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .stat-item:hover {
                border-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .stat-label {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .stat-value {
                font-size: 28px;
                font-weight: bold;
                color: var(--text-primary);
            }
            .stat-success { color: var(--success-color); }
            .stat-warning { color: var(--warning-color); }
            .stat-danger { color: var(--danger-color); }
            .stat-info { color: var(--info-color); }
            .reset-zoom-btn:hover, #reset-zoom-btn:hover {
                background: var(--border-color) !important;
            }
        </style>
    `;

    // Set up event handlers
    setupAnalysisHandlers(container, profile);
    setupScenarioLoader(container, profile);
    setupMarketConditionsHandlers(container, profile);
}

import { scenariosAPI } from '../../api/scenarios.js';

async function setupScenarioLoader(container, profile) {
    const selector = container.querySelector('#saved-scenario-select');
    if (!selector) return;

    try {
        const response = await scenariosAPI.list();
        const scenarios = response.scenarios || [];
        
        // Filter scenarios for this profile (optional, but cleaner)
        const profileScenarios = scenarios.filter(s => s.profile_name === profile.name || !s.profile_name);

        if (profileScenarios.length === 0) {
            selector.innerHTML = '<option value="">No saved scenarios</option>';
            selector.disabled = true;
            return;
        }

        profileScenarios.forEach(scenario => {
            const option = document.createElement('option');
            option.value = scenario.id;
            option.textContent = scenario.name;
            selector.appendChild(option);
        });

        selector.addEventListener('change', async () => {
            const scenarioId = selector.value;
            if (!scenarioId) return;

            try {
                showLoading(container.querySelector('#results-container'), 'Restoring scenario data...');
                
                const res = await scenariosAPI.get(scenarioId);
                const scenario = res.scenario;

                if (!scenario) throw new Error('Scenario not found');

                // 1. Update UI Inputs from parameters
                if (scenario.parameters) {
                    const params = scenario.parameters;
                    
                    // Update Simulations
                    if (params.simulations) {
                        const simSelect = container.querySelector('#simulations-select');
                        if (simSelect) simSelect.value = params.simulations;
                        localStorage.setItem('rps_simulations', params.simulations);
                    }

                    // Update Market Profile if saved in name or params
                    // (Realistically we'd need to save the key in params, for now we just show the results)
                }

                // 2. Display the saved results immediately
                if (scenario.results) {
                    lastAnalysisResult = scenario.results;
                    lastSimulations = scenario.parameters?.simulations || 10000;
                    
                    const resultsContainer = container.querySelector('#results-container');
                    
                    // Check if it's a multi-scenario (v2) or single (v1)
                    if (scenario.results.scenarios) {
                        displayMultiScenarioResults(resultsContainer, scenario.results, profile, lastSimulations);
                    } else {
                        displaySingleScenarioResults(resultsContainer, scenario.results, profile, lastSimulations);
                    }
                    
                    showSuccess(`Loaded scenario: ${scenario.name}`);
                }

            } catch (err) {
                console.error(err);
                showErrorInContainer(container.querySelector('#results-container'), `Failed to load scenario: ${err.message}`);
            }
        });

    } catch (error) {
        console.error('Error fetching scenarios:', error);
    }
}

// Global state for market periods
let currentMarketMode = 'simple';
let selectedPreset = null;
let timelinePeriods = [];
let cyclePattern = [];
let timelinePeriodCounter = 0;
let cyclePhaseCounter = 0;

function setupMarketConditionsHandlers(container, profile) {
    // Mode switching
    const modeBtns = container.querySelectorAll('.market-mode-btn');
    const modeContents = container.querySelectorAll('.market-mode-content');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            currentMarketMode = mode;

            // Update button styles
            modeBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--bg-tertiary)';
                b.style.color = 'var(--text-primary)';
                b.style.borderColor = 'var(--border-color)';
            });
            btn.classList.add('active');

            // Show/hide content
            modeContents.forEach(content => {
                content.style.display = 'none';
            });
            const targetContent = container.querySelector(`#market-mode-${mode}`);
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // Reset selections when switching modes
            if (mode !== 'preset') {
                selectedPreset = null;
            }
        });
    });

    // Preset scenario selection
    const presetBtns = container.querySelectorAll('.preset-scenario-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetKey = btn.getAttribute('data-preset');
            selectedPreset = presetKey;

            // Update button styles
            presetBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            // Show selected display
            const display = container.querySelector('#preset-selected-display');
            const nameSpan = container.querySelector('#preset-selected-name');
            if (display && nameSpan) {
                nameSpan.textContent = APP_CONFIG.PRESET_SCENARIOS[presetKey].name;
                display.style.display = 'block';
            }
        });
    });

    // Timeline: Add period button
    const addTimelinePeriodBtn = container.querySelector('#add-timeline-period-btn');
    if (addTimelinePeriodBtn) {
        addTimelinePeriodBtn.addEventListener('click', () => {
            addTimelinePeriod(container, profile);
        });
    }

    // Cycle: Add phase button
    const addCycleElementBtn = container.querySelector('#add-cycle-element-btn');
    if (addCycleElementBtn) {
        addCycleElementBtn.addEventListener('click', () => {
            addCyclePhase(container);
        });
    }

    // Market conditions help button
    const marketConditionsHelpBtn = container.querySelector('#market-conditions-help-btn');
    if (marketConditionsHelpBtn) {
        marketConditionsHelpBtn.addEventListener('click', () => {
            showMarketConditionsExplanationModal();
        });
    }

    // Initialize with one timeline period and one cycle phase
    addTimelinePeriod(container, profile);
    addCyclePhase(container);
}

function addTimelinePeriod(container, profile) {
    const periodsContainer = container.querySelector('#timeline-periods-container');
    const periodId = timelinePeriodCounter++;
    const retirementYear = new Date(profile.retirement_date).getFullYear();
    const currentYear = new Date().getFullYear();

    const periodDiv = document.createElement('div');
    periodDiv.className = 'timeline-period';
    periodDiv.setAttribute('data-period-id', periodId);
    periodDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: end;">
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Start Year</label>
                <input type="number" class="period-start-year" value="${retirementYear + (timelinePeriods.length * 5)}" min="${currentYear}" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">End Year</label>
                <input type="number" class="period-end-year" value="${retirementYear + (timelinePeriods.length * 5) + 4}" min="${currentYear}" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Market Condition</label>
                <select class="period-market-profile" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
                    ${Object.keys(APP_CONFIG.MARKET_PROFILES).map(key => `
                        <option value="${key}">${APP_CONFIG.MARKET_PROFILES[key].name}</option>
                    `).join('')}
                </select>
            </div>
            <button class="remove-btn remove-period-btn" data-period-id="${periodId}" style="padding: 6px 12px;">Remove</button>
        </div>
    `;

    periodsContainer.appendChild(periodDiv);

    // Add remove handler
    const removeBtn = periodDiv.querySelector('.remove-period-btn');
    removeBtn.addEventListener('click', () => {
        periodDiv.remove();
        timelinePeriods = timelinePeriods.filter(p => p.id !== periodId);
    });

    // Track period
    timelinePeriods.push({
        id: periodId,
        element: periodDiv
    });
}

function addCyclePhase(container) {
    const patternsContainer = container.querySelector('#cycle-pattern-container');
    const phaseId = cyclePhaseCounter++;

    const phaseDiv = document.createElement('div');
    phaseDiv.className = 'cycle-phase';
    phaseDiv.setAttribute('data-phase-id', phaseId);
    phaseDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; align-items: end;">
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Duration (years)</label>
                <input type="number" class="phase-duration" value="${cyclePattern.length === 0 ? 7 : cyclePattern.length === 1 ? 2 : 3}" min="1" max="20" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
                        <div>
                            <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Market Condition</label>
                            <select class="phase-market-profile" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
                                ${Object.keys(APP_CONFIG.MARKET_PROFILES).map(key => `
                                    <option value="${key}">${APP_CONFIG.MARKET_PROFILES[key].name}</option>
                                `).join('')}
                            </select>
                        </div>            <button class="remove-btn remove-phase-btn" data-phase-id="${phaseId}" style="padding: 6px 12px;">Remove</button>
        </div>
    `;

    patternsContainer.appendChild(phaseDiv);

    // Add remove handler
    const removeBtn = phaseDiv.querySelector('.remove-phase-btn');
    removeBtn.addEventListener('click', () => {
        phaseDiv.remove();
        cyclePattern = cyclePattern.filter(p => p.id !== phaseId);
    });

    // Track phase
    cyclePattern.push({
        id: phaseId,
        element: phaseDiv
    });
}

function showMarketConditionsExplanationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">📊 Why Market Conditions Matter</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--danger-color), #e74c3c); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: var(--text-on-danger);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🚨 Critical Issue with "Simple" Mode</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        <strong>Simple mode uses ONE market condition for your ENTIRE 30-40 year retirement.</strong><br><br>
                        This is fundamentally unrealistic. No retirement experiences 30 years of continuous recession OR continuous bull market. Real retirements span multiple market cycles.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Sequence of Returns Risk</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        <strong>The most important risk in retirement:</strong> WHEN market crashes happen matters more than IF they happen.<br><br>

                        • <strong>Early Crash:</strong> A market crash in years 1-5 of retirement can devastate your portfolio because you're withdrawing during the downturn<br>
                        • <strong>Mid Crash:</strong> Less damaging but still significant<br>
                        • <strong>Late Crash:</strong> Least impactful since you've already withdrawn most of what you need
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Four Modes Explained</h3>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--text-primary);">1️⃣ Simple Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Uses one market condition for entire retirement. Unrealistic but useful for understanding individual market profiles. Always supplement with Preset or Timeline analysis.
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--success-color);">2️⃣ Preset Scenarios (Recommended)</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Pre-configured realistic scenarios modeling sequence of returns risk:<br>
                        • Early Retirement Crash - Worst case<br>
                        • Lucky Start - Best case<br>
                        • Mid-Retirement Crisis<br>
                        • Realistic Market Cycles - Repeating economic cycles<br>
                        <strong>Start here if you're unsure!</strong>
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--info-color);">3️⃣ Timeline Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Define specific year ranges with different market conditions. Perfect for testing "what if" scenarios:<br>
                        • What if recession happens in years 2028-2030?<br>
                        • What if strong bull market in first 10 years?<br>
                        Gives you precise control over when market conditions occur.
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--warning-color);">4️⃣ Cycle Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Define a repeating pattern of market phases:<br>
                        • 7 years expansion → 2 years recession → 3 years recovery (repeat)<br>
                        Models realistic economic cycles throughout retirement.
                    </p>
                </div>

                <div style="background: var(--accent-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: var(--text-on-accent);">
                    <strong>💡 Best Practice:</strong> Run analysis with multiple approaches:<br>
                    1. Start with "Early Retirement Crash" preset (worst case)<br>
                    2. Try "Realistic Market Cycles" preset (typical case)<br>
                    3. Try "Lucky Start" preset (best case)<br><br>
                    This gives you a realistic range of outcomes instead of a single unrealistic projection.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function setupAnalysisHandlers(container, profile) {
    const runBtn = container.querySelector('#run-analysis-btn');
    const resultsContainer = container.querySelector('#results-container');
    const marketProfileSelect = container.querySelector('#market-profile-select');
    const spendingModelSelect = container.querySelector('#spending-model-select');
    const simulationsSelect = container.querySelector('#simulations-select');
    const marketProfileDescription = container.querySelector('#market-profile-description');
    const spendingModelDescription = container.querySelector('#spending-model-description');
    const showCalcInfoBtn = container.querySelector('#show-calculation-info');

    if (!runBtn || !resultsContainer) {
        console.error('Analysis form elements not found');
        return;
    }

    // Show calculation explanation modal
    if (showCalcInfoBtn) {
        showCalcInfoBtn.addEventListener('click', () => {
            showCalculationExplanationModal();
        });
    }

    // Show spending strategy explanation modal
    const spendingStrategyHelpBtn = container.querySelector('#spending-strategy-help-btn');
    if (spendingStrategyHelpBtn) {
        spendingStrategyHelpBtn.addEventListener('click', () => {
            showSpendingStrategyExplanationModal();
        });
    }

    // Spending Model Descriptions
    const spendingDescriptions = {
        'constant_real': {
            title: 'Constant Inflation-Adjusted',
            desc: 'Maintains purchasing power throughout retirement. Spending increases exactly with inflation every year. Standard conservative assumption.',
            multiplier: 'Multiplier: 1.0x (no change to your expenses)',
            example: 'Your $80k/year expenses stay at $80k/year (adjusted for inflation)'
        },
        'retirement_smile': {
            title: 'Retirement Smile (Reality Planning)',
            desc: 'Models typical behavior: High spending in early retirement ("Go-Go" years), declining in mid-retirement ("Slow-Go"), and rising again in late retirement for healthcare ("No-Go").',
            multiplier: 'Multiplier: 1.0x → 0.8x → 1.2x (varies by age)',
            example: 'Your $80k/year expenses become $72k at age 75 (0.9x), $64k at age 80 (0.8x), then rise for healthcare'
        },
        'conservative_decline': {
            title: 'Conservative Decline',
            desc: 'Assumes real spending decreases gradually as you age (1% per year after age 70), reflecting reduced activity levels.',
            multiplier: 'Multiplier: 1.0x → 0.9x → 0.8x (declines 1%/year after 70)',
            example: 'Your $80k/year expenses become $72k at age 80 (0.9x), $64k at age 90 (0.8x)'
        }
    };

    // Handle spending model change
    if (spendingModelSelect) {
        spendingModelSelect.addEventListener('change', () => {
            const val = spendingModelSelect.value;
            const info = spendingDescriptions[val];
            if (spendingModelDescription && info) {
                spendingModelDescription.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--text-primary);">${info.title}</span>
                    </div>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">${info.desc}</p>
                `;
            }
        });
    }

    // Handle market profile change
    if (marketProfileSelect) {
        marketProfileSelect.addEventListener('change', () => {
            const selectedKey = marketProfileSelect.value;
            const selectedProfile = APP_CONFIG.MARKET_PROFILES[selectedKey];

            // Save to localStorage
            localStorage.setItem('rps_market_profile', selectedKey);

            // Update description panel
            if (marketProfileDescription && selectedProfile) {
                marketProfileDescription.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--text-primary);">${selectedProfile.name}</span>
                        <small style="color: var(--accent-color); font-weight: 600;">CUSTOMIZABLE</small>
                    </div>
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 14px;">${selectedProfile.description}</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 13px;">
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Stock Return (%)</label>
                            <input type="number" id="custom-stock-return" value="${(selectedProfile.stock_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Bond Return (%)</label>
                            <input type="number" id="custom-bond-return" value="${(selectedProfile.bond_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Inflation (%)</label>
                            <input type="number" id="custom-inflation" value="${(selectedProfile.inflation_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Real Estate (%)</label>
                            <input type="number" id="custom-reit-return" value="${((selectedProfile.reit_return_mean || 0.08) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Gold (%)</label>
                            <input type="number" id="custom-gold-return" value="${((selectedProfile.gold_return_mean || 0.04) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Crypto (%)</label>
                            <input type="number" id="custom-crypto-return" value="${((selectedProfile.crypto_return_mean || 0.20) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                    </div>
                `;
            }
        });
    }

    // Handle simulations change
    if (simulationsSelect) {
        simulationsSelect.addEventListener('change', () => {
            localStorage.setItem('rps_simulations', simulationsSelect.value);
        });
    }

    runBtn.addEventListener('click', async () => {
        // Get values from selectors
        const simulations = parseSimulationCount(
            simulationsSelect?.value || localStorage.getItem('rps_simulations') || APP_CONFIG.DEFAULT_SIMULATIONS
        );
        const savedMarketProfile = marketProfileSelect?.value || localStorage.getItem('rps_market_profile') || 'historical';

        if (simulations < APP_CONFIG.MIN_SIMULATIONS || simulations > APP_CONFIG.MAX_SIMULATIONS) {
            alert(`Simulations must be between ${APP_CONFIG.MIN_SIMULATIONS} and ${APP_CONFIG.MAX_SIMULATIONS}`);
            return;
        }

        // Disable button and show loading
        runBtn.disabled = true;
        runBtn.textContent = 'Running Analysis...';
        showLoading(resultsContainer, `Running ${simulations.toLocaleString()} simulations...`);

        try {
            const selectedKey = marketProfileSelect?.value || localStorage.getItem('rps_market_profile') || 'historical';
            const templateProfile = APP_CONFIG.MARKET_PROFILES[selectedKey];

            // Create custom market profile from inputs (used for simple mode and base assumptions)
            const customStockReturn = container.querySelector('#custom-stock-return');
            const customBondReturn = container.querySelector('#custom-bond-return');
            const customInflation = container.querySelector('#custom-inflation');
            const customReitReturn = container.querySelector('#custom-reit-return');
            const customGoldReturn = container.querySelector('#custom-gold-return');
            const customCryptoReturn = container.querySelector('#custom-crypto-return');

            const marketProfile = {
                ...templateProfile,
                stock_return_mean: customStockReturn ? parseFloat(customStockReturn.value) / 100 : templateProfile.stock_return_mean,
                bond_return_mean: customBondReturn ? parseFloat(customBondReturn.value) / 100 : templateProfile.bond_return_mean,
                inflation_mean: customInflation ? parseFloat(customInflation.value) / 100 : templateProfile.inflation_mean,
                reit_return_mean: customReitReturn ? parseFloat(customReitReturn.value) / 100 : (templateProfile.reit_return_mean || 0.08),
                gold_return_mean: customGoldReturn ? parseFloat(customGoldReturn.value) / 100 : (templateProfile.gold_return_mean || 0.04),
                crypto_return_mean: customCryptoReturn ? parseFloat(customCryptoReturn.value) / 100 : (templateProfile.crypto_return_mean || 0.20)
            };

            const spendingModel = spendingModelSelect?.value || 'constant_real';

            // Collect market periods based on current mode
            let marketPeriods = null;
            const retirementYear = new Date(profile.retirement_date).getFullYear();
            const currentYear = new Date().getFullYear();

            if (currentMarketMode === 'preset' && selectedPreset) {
                // Use preset scenario
                const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
                const yearsProjected = 40; // Approximate, actual will be calculated by backend
                marketPeriods = preset.buildPeriods(currentYear, retirementYear, yearsProjected);
            } else if (currentMarketMode === 'timeline') {
                // Build timeline from user input
                const periods = [];
                const periodElements = container.querySelectorAll('.timeline-period');

                periodElements.forEach(elem => {
                    const startYear = parseInt(elem.querySelector('.period-start-year').value);
                    const endYear = parseInt(elem.querySelector('.period-end-year').value);
                    const profileKey = elem.querySelector('.period-market-profile').value;
                    const profileData = APP_CONFIG.MARKET_PROFILES[profileKey];

                    if (profileData && startYear && endYear && startYear <= endYear) {
                        periods.push({
                            start_year: startYear,
                            end_year: endYear,
                            assumptions: {
                                ...profileData
                            }
                        });
                    }
                });

                if (periods.length > 0) {
                    marketPeriods = {
                        type: 'timeline',
                        periods: periods
                    };
                }
            } else if (currentMarketMode === 'cycle') {
                // Build cycle pattern from user input
                const pattern = [];
                const phaseElements = container.querySelectorAll('.cycle-phase');

                phaseElements.forEach(elem => {
                    const duration = parseInt(elem.querySelector('.phase-duration').value);
                    const profileKey = elem.querySelector('.phase-market-profile').value;
                    const profileData = APP_CONFIG.MARKET_PROFILES[profileKey];

                    if (profileData && duration && duration > 0) {
                        pattern.push({
                            duration: duration,
                            assumptions: {
                                ...profileData
                            }
                        });
                    }
                });

                if (pattern.length > 0) {
                    const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
                    marketPeriods = {
                        type: 'cycle',
                        pattern: pattern,
                        repeat: repeatCheckbox ? repeatCheckbox.checked : true
                    };
                }
            }
            // If currentMarketMode === 'simple', marketPeriods remains null (uses base marketProfile)

            // Pass spending model and market periods to API
            const result = await analysisAPI.runAnalysis(profile.name, simulations, marketProfile, spendingModel, marketPeriods);

            // DEBUG: Log the response
            console.log('Analysis API Response:', JSON.stringify(result, null, 2));

            // Store for saving as scenario
            lastAnalysisResult = result;
            lastSimulations = simulations;

            // Display results
            displayResults(resultsContainer, result, profile, simulations);

            // Update profile to record that analysis was run
            try {
                const updatedData = { ...profile.data, last_analysis_date: new Date().toISOString() };
                await profilesAPI.update(profile.name, { data: updatedData });
                // Update store with new profile data
                const updatedProfile = { ...profile, data: updatedData };
                store.setState({ currentProfile: updatedProfile });
            } catch (updateError) {
                console.warn('Could not update profile with analysis date:', updateError);
            }

            showSuccess('Analysis complete!');

        } catch (error) {
            console.error('Analysis error:', error);
            showErrorInContainer(resultsContainer, `Failed to run analysis: ${error.message}`);
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = 'Run Analysis';
        }
    });
}

function displayResults(container, result, profile, simulations) {
    const data = result;

    // Check if we have multiple scenarios or single result
    const hasMultipleScenarios = data.scenarios && Object.keys(data.scenarios).length > 0;

    if (hasMultipleScenarios) {
        // Display multi-scenario comparison
        displayMultiScenarioResults(container, data, profile, simulations);
    } else {
        // Display single scenario (backward compatibility)
        displaySingleScenarioResults(container, data.results || data, profile, simulations);
    }
}

function renderLifeInsuranceAndSequencePanels(planningData) {
    const life = planningData?.life_insurance_estimate;
    const debt = planningData?.debt_management_plan;
    const college = planningData?.college_529_plan;
    const pension = planningData?.pension_lump_sum_analysis;
    const estate = planningData?.estate_tax_gifting_strategy;
    const feeImpact = planningData?.investment_fee_impact;
    const partTime = planningData?.part_time_retirement_model;
    const realEstate = planningData?.real_estate_enhancements;
    const advancedScenarios = planningData?.advanced_scenario_analysis;
    const dynamicWithdrawal = planningData?.dynamic_withdrawal_strategies;
    const lifeEvents = planningData?.life_event_scenario_modeling;
    const disability = planningData?.disability_income_protection;
    const ltc = planningData?.long_term_care_analysis;
    const businessOwner = planningData?.business_owner_retirement_planning;
    const secureAct = planningData?.secure_act_beneficiary_ira;
    const annuity = planningData?.annuity_comparison_tool;
    const cashflowEnhancements = planningData?.cashflow_budget_enhancements;
    const lifestyle = planningData?.retirement_lifestyle_planning;
    const documentVault = planningData?.document_vault_beneficiary_tracking;
    const investmentFactors = planningData?.advanced_investment_factor_analysis;
    const legacyGoals = planningData?.family_legacy_gifting_goals;
    const riskDashboard = planningData?.risk_analysis_dashboard;
    const planDrift = planningData?.plan_health_monitoring_drift_alerts;
    const taxLaw = planningData?.tax_law_update_engine;
    const pre65Bridge = planningData?.pre65_healthcare_bridge_planner;
    const guaranteedFloor = planningData?.guaranteed_income_floor_optimizer;
    const ssReconcile = planningData?.social_security_statement_reconciliation;
    const dataHub = planningData?.data_aggregation_reconciliation_hub;
    const longevityCare = planningData?.longevity_care_path_modeling;
    const charitableOptimizer = planningData?.charitable_strategy_optimizer;
    const householdWorkflow = planningData?.household_collaboration_workflow;
    const paycheckBuilder = planningData?.retirement_paycheck_builder;
    const sequence = planningData?.sequence_risk_visualization;

    const lifePanel = life ? `
        <div class="result-card" style="border-left: 4px solid var(--info-color);">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('life_insurance', 'Life Insurance Estimate')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">
                Directional planning estimate using income, expenses, debt, and dependents.
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Coverage Need</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(life.needs?.total_coverage_need || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Existing Coverage</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(life.coverage?.existing_coverage || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Coverage Gap</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${(life.coverage?.coverage_gap || 0) > 0 ? 'var(--warning-color)' : 'var(--success-color)'};">
                        ${formatCurrency(life.coverage?.coverage_gap || 0, 0)}
                    </div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Suggested 20Y Term</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(life.recommendations?.term_20y_coverage || 0, 0)}</div>
                </div>
            </div>
            <p style="margin: 12px 0 0 0; color: var(--text-secondary); font-size: 13px;">
                ${life.recommendations?.summary || 'No life insurance summary available.'}
            </p>
        </div>
    ` : '';

    const debtRows = (debt?.avalanche_order || []).slice(0, 5).map((item, idx) => `
        <div style="display: grid; grid-template-columns: 30px 1.4fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
            <div style="font-size: 12px; color: var(--text-secondary);">${idx + 1}</div>
            <div style="font-size: 13px; font-weight: 600;">${item.name}</div>
            <div style="font-size: 13px;">${formatCurrency(item.balance || 0, 0)}</div>
            <div style="font-size: 13px; color: var(--warning-color);">${formatPercent(item.interest_rate || 0, 2)}</div>
        </div>
    `).join('');

    const debtPanel = debt?.available ? `
        <div class="result-card" style="border-left: 4px solid var(--danger-color);">
            <h3 style="margin: 0 0 10px 0;">Debt Payoff Strategy</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">
                ${debt.summary || 'Debt summary unavailable.'}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Total Debt</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(debt.total_debt || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Blended Interest</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatPercent(debt.weighted_avg_interest_rate || 0, 2)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Monthly Payments</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(debt.monthly_debt_payment || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Estimated Payoff</div>
                    <div style="font-size: 20px; font-weight: 700;">
                        ${Number.isFinite(debt.estimated_payoff_months_at_current_payment)
                            ? `${debt.estimated_payoff_months_at_current_payment} mo`
                            : 'N/A'}
                    </div>
                </div>
            </div>
            <div style="font-size: 13px; margin-bottom: 8px;">
                <strong>Recommended:</strong> ${String(debt.recommended_strategy || '').toUpperCase()}.
                <span style="color: var(--text-secondary);">${debt.strategy_reason || ''}</span>
            </div>
            <div style="display: grid; grid-template-columns: 30px 1.4fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>#</div>
                <div>Avalanche Order</div>
                <div>Balance</div>
                <div>Rate</div>
            </div>
            ${debtRows || '<div style="padding: 10px 0; color: var(--text-secondary);">No debts available.</div>'}
        </div>
    ` : '';

    const collegeRows = (college?.children || []).map((child, idx) => `
        <div data-detail="college-child" data-child-index="${idx}" title="Click for details" style="display: grid; grid-template-columns: 1.4fr 0.8fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); cursor: pointer;">
            <div style="font-size: 13px; font-weight: 600;">${escapeHtml(child.name || `Child ${idx + 1}`)}</div>
            <div style="font-size: 13px;">${Number.isFinite(child.years_to_college) ? child.years_to_college : '-'}</div>
            <div style="font-size: 13px;">${formatCurrency(child.target_funding || 0, 0)}</div>
            <div style="font-size: 13px;">${formatCurrency(child.existing_529_allocation || 0, 0)}</div>
            <div style="font-size: 13px; font-weight: 700; color: var(--info-color);">${formatCurrency(child.monthly_savings_needed || 0, 0)}</div>
        </div>
    `).join('');

    const collegePanel = college?.available ? `
        <div class="result-card" style="border-left: 4px solid var(--success-color);">
            <h3 style="margin: 0 0 10px 0;"><button type="button" data-detail="college" title="Click for details" style="display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0; margin: 0; color: inherit; font: inherit; font-weight: 700; cursor: pointer;">529 College Savings Planner <span style="font-size: 12px; color: var(--accent-color);">ℹ️</span></button></h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">
                ${college.summary || '529 summary unavailable.'}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div data-detail="college" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Current 529 Balance</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(college.household_totals?.existing_529_balance || 0, 0)}</div>
                </div>
                <div data-detail="college" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Target Funding</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(college.household_totals?.target_funding_total || 0, 0)}</div>
                </div>
                <div data-detail="college" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Monthly Savings Needed</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success-color);">${formatCurrency(college.household_totals?.monthly_savings_needed_total || 0, 0)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1.4fr 0.8fr 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Child</div>
                <div>Years</div>
                <div>Target</div>
                <div>Current 529</div>
                <div>Monthly Need</div>
            </div>
            ${collegeRows || '<div style="padding: 10px 0; color: var(--text-secondary);">No child rows available.</div>'}
        </div>
    ` : '';

    const pensionSensitivityRows = (pension?.sensitivity || []).map(row => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <span>${formatPercent(row.discount_rate || 0, 1)} discount rate</span>
            <span>${formatCurrency(row.pension_present_value || 0, 0)}</span>
        </div>
    `).join('');

    const pensionPanel = pension?.available ? `
        <div class="result-card" style="border-left: 4px solid var(--accent-color);">
            <h3 style="margin: 0 0 10px 0;">Pension vs Lump Sum Analyzer</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${pension.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Annual Pension</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(pension.annual_pension_income || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Lump Sum</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(pension.lump_sum_offer || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Pension PV</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(pension.present_value_of_pension || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Breakeven</div>
                    <div style="font-size: 20px; font-weight: 700;">${Number.isFinite(pension.breakeven_years) ? `${pension.breakeven_years} yrs` : 'N/A'}</div>
                </div>
            </div>
            <div style="margin-bottom: 10px; font-size: 13px;">
                <strong>Recommendation:</strong> ${pension.recommendation === 'lump_sum' ? 'LUMP SUM' : 'PENSION STREAM'}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Sensitivity</div>
            ${pensionSensitivityRows || '<div style="color: var(--text-secondary);">No sensitivity data.</div>'}
        </div>
    ` : '';

    const estateRecs = (estate?.recommendations || []).map(rec => `
        <li style="margin-bottom: 6px; color: var(--text-secondary); font-size: 13px;">${rec}</li>
    `).join('');

    const estatePanel = estate?.available ? `
        <div class="result-card" style="border-left: 4px solid #7c3aed;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('estate_tax_gifting', 'Estate Tax & Gifting Strategy')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${estate.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div data-detail="estate" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Net Estate</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(estate.estate?.net_estate || 0, 0)}</div>
                </div>
                <div data-detail="estate" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Taxable Today</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${(estate.estate?.taxable_estate_today || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                        ${formatCurrency(estate.estate?.taxable_estate_today || 0, 0)}
                    </div>
                </div>
                <div data-detail="estate" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Projected Taxable</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${(estate.estate?.projected_taxable_estate || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                        ${formatCurrency(estate.estate?.projected_taxable_estate || 0, 0)}
                    </div>
                </div>
                <div data-detail="estate" title="Click for details" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; cursor: pointer;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Annual Gift Capacity</div>
                    <div style="font-size: 20px; font-weight: 700; color: #7c3aed;">${formatCurrency(estate.gifting?.annual_gifting_capacity || 0, 0)}</div>
                </div>
            </div>
            <ul style="margin: 0; padding-left: 18px;">${estateRecs}</ul>
        </div>
    ` : '';

    const feeRows = (feeImpact?.high_fee_accounts || []).map(account => `
        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <div style="font-weight: 600;">${account.name}</div>
            <div>${formatCurrency(account.value || 0, 0)}</div>
            <div style="color: var(--warning-color);">${formatPercent(account.fee_rate || 0, 2)}</div>
        </div>
    `).join('');

    const feePanel = feeImpact?.available ? `
        <div class="result-card" style="border-left: 4px solid #0ea5e9;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('investment_fee_impact', 'Investment Fee Impact Analyzer')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${feeImpact.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Investable Assets</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(feeImpact.total_investable_assets || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Weighted Fee</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatPercent(feeImpact.weighted_fee_rate || 0, 2)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Annual Fee Cost</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(feeImpact.annual_fee_dollars || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Long-Term Impact</div>
                    <div style="font-size: 20px; font-weight: 700; color: #0ea5e9;">${formatCurrency(feeImpact.lifetime_fee_impact || 0, 0)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Account</div><div>Value</div><div>Fee</div>
            </div>
            ${feeRows || '<div style="padding: 8px 0; color: var(--text-secondary);">No account-level fee rows available.</div>'}
        </div>
    ` : '';

    const partTimeRows = (partTime?.scenarios || []).map(s => `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <div>${formatCurrency(s.part_time_gross_income || 0, 0)}</div>
            <div>${formatCurrency(s.part_time_net_income || 0, 0)}</div>
            <div>${formatCurrency(s.remaining_withdrawal_need || 0, 0)}</div>
        </div>
    `).join('');

    const partTimePanel = partTime?.available ? `
        <div class="result-card" style="border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 10px 0;">Part-Time Work in Retirement Modeling</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${partTime.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Annual Expenses</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(partTime.inputs?.annual_expenses || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Guaranteed Income</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(partTime.inputs?.guaranteed_income || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Base Withdrawal Need</div>
                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${formatCurrency(partTime.inputs?.base_withdrawal_need || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Recommended PT Income</div>
                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${formatCurrency(partTime.recommended_part_time_income?.part_time_gross_income || 0, 0)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Gross PT Income</div><div>Net PT Income</div><div>Remaining Withdrawal Need</div>
            </div>
            ${partTimeRows}
        </div>
    ` : '';

    const realEstateRows = (realEstate?.properties || []).slice(0, 6).map(prop => `
        <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <div style="font-weight: 600;">${prop.name}</div>
            <div>${formatCurrency(prop.equity || 0, 0)}</div>
            <div>${formatPercent(prop.cap_rate || 0, 2)}</div>
            <div>${formatCurrency(prop.projected_equity_10y || 0, 0)}</div>
        </div>
    `).join('');

    const realEstatePanel = realEstate?.available ? `
        <div class="result-card" style="border-left: 4px solid #22c55e;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('real_estate_enhancements', 'Real Estate Enhancements')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${realEstate.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Properties</div>
                    <div style="font-size: 20px; font-weight: 700;">${realEstate.totals?.property_count || 0}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Current Equity</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(realEstate.totals?.total_equity || 0, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Projected Equity (10Y)</div>
                    <div style="font-size: 20px; font-weight: 700; color: #22c55e;">${formatCurrency(realEstate.totals?.projected_total_equity_10y || 0, 0)}</div>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">${realEstate.sale_planning_note || ''}</div>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Property</div><div>Equity</div><div>Cap Rate</div><div>10Y Equity</div>
            </div>
            ${realEstateRows || '<div style="padding: 8px 0; color: var(--text-secondary);">No property rows available.</div>'}
        </div>
    ` : '';

    const advancedRows = (advancedScenarios?.scenario_table || []).map(row => `
        <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <div style="font-weight: 600;">${row.name}</div>
            <div>${formatPercent(row.success_rate || 0, 1)}</div>
            <div>${formatCurrency(row.p10 || 0, 0)}</div>
            <div style="color: #06b6d4; font-weight: 700;">${row.resilience_score?.toFixed ? row.resilience_score.toFixed(1) : row.resilience_score}</div>
        </div>
    `).join('');

    const advancedScenarioPanel = advancedScenarios?.available ? `
        <div class="result-card" style="border-left: 4px solid #06b6d4;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('advanced_scenario_analysis', 'Advanced Scenario Analysis')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${advancedScenarios.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Top Resilience</div>
                    <div style="font-size: 18px; font-weight: 700;">${advancedScenarios.leaders?.top_resilience?.scenario || '-'}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Success Spread</div>
                    <div style="font-size: 18px; font-weight: 700;">${formatPercent(advancedScenarios.dispersion?.success_rate_spread || 0, 1)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Median Spread</div>
                    <div style="font-size: 18px; font-weight: 700;">${formatCurrency(advancedScenarios.dispersion?.median_balance_spread || 0, 0)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Scenario</div><div>Success</div><div>Downside (P10)</div><div>Resilience</div>
            </div>
            ${advancedRows || '<div style="padding: 8px 0; color: var(--text-secondary);">No advanced scenario rows available.</div>'}
        </div>
    ` : '';

    const withdrawalRows = (dynamicWithdrawal?.strategies || []).map(strategy => `
        <div style="padding: 10px 0; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; gap: 10px; align-items: baseline;">
                <div style="font-weight: 700; font-size: 13px;">${strategy.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${formatPercent(strategy.initial_withdrawal_rate || 0, 2)} (${formatCurrency(strategy.initial_withdrawal_amount || 0, 0)})
                </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${strategy.rule || ''}</div>
        </div>
    `).join('');

    const dynamicWithdrawalPanel = dynamicWithdrawal?.available ? `
        <div class="result-card" style="border-left: 4px solid #ef4444;">
            <h3 style="margin: 0 0 10px 0;">Dynamic Withdrawal Strategies</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${dynamicWithdrawal.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Base Withdrawal Rate</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatPercent(dynamicWithdrawal.inputs?.base_withdrawal_rate || 0, 2)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Moderate Success</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatPercent(dynamicWithdrawal.inputs?.moderate_success_rate || 0, 1)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Recommended</div>
                    <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${dynamicWithdrawal.recommended_strategy || '-'}</div>
                </div>
            </div>
            ${withdrawalRows || '<div style="color: var(--text-secondary);">No withdrawal strategies available.</div>'}
        </div>
    ` : '';

    const lifeEventRows = (lifeEvents?.events || []).map(item => `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; gap: 10px;">
                <div style="font-weight: 700; font-size: 13px;">${item.event}</div>
                <div style="font-size: 12px;">
                    ${formatPercent(item.projected_success_rate || 0, 1)}
                    <span style="color: ${(item.success_rate_delta || 0) < 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                        (${(item.success_rate_delta || 0) >= 0 ? '+' : ''}${formatPercent(item.success_rate_delta || 0, 1)})
                    </span>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">${item.details || ''}</div>
        </div>
    `).join('');

    const lifeEventsPanel = lifeEvents?.available ? `
        <div class="result-card" style="border-left: 4px solid #8b5cf6;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('life_event_scenario_modeling', 'Life Event Scenario Modeling')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">${lifeEvents.summary || ''}</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-bottom: 12px;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Baseline Success</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatPercent(lifeEvents.baseline?.success_rate || 0, 1)}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px;">
                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Baseline Median</div>
                    <div style="font-size: 20px; font-weight: 700;">${formatCurrency(lifeEvents.baseline?.median_final_balance || 0, 0)}</div>
                </div>
            </div>
            ${lifeEventRows || '<div style="color: var(--text-secondary);">No life-event scenarios available.</div>'}
        </div>
    ` : '';

    const extendedCards = [
        {
            title: 'Disability Income Protection',
            helpKey: 'disability_income_protection',
            data: disability,
            accent: '#16a34a',
            metric: disability?.recommended_monthly_benefit ? `Recommended benefit: ${formatCurrency(disability.recommended_monthly_benefit, 0)}/mo` : ''
        },
        {
            title: 'Long-Term Care Analysis',
            helpKey: 'long_term_care_analysis',
            data: ltc,
            accent: '#0ea5e9',
            metric: ltc?.projected_total_cost ? `Projected LTC total: ${formatCurrency(ltc.projected_total_cost, 0)}` : ''
        },
        {
            title: 'Business Owner Retirement Planning',
            helpKey: 'business_owner_retirement',
            data: businessOwner,
            accent: '#f59e0b',
            metric: businessOwner?.business_value ? `Business value: ${formatCurrency(businessOwner.business_value, 0)}` : ''
        },
        {
            title: 'SECURE Act Beneficiary IRA Rules',
            helpKey: 'secure_act_beneficiary_ira',
            data: secureAct,
            accent: '#7c3aed',
            metric: secureAct?.default_rule_non_spouse_years ? `Non-spouse default: ${secureAct.default_rule_non_spouse_years}-year rule` : ''
        },
        {
            title: 'Annuity Comparison Tool',
            helpKey: 'annuity_comparison',
            data: annuity,
            accent: '#2563eb',
            metric: annuity?.fixed_annuity_income ? `Fixed annuity est.: ${formatCurrency(annuity.fixed_annuity_income, 0)}/yr` : ''
        },
        {
            title: 'Cashflow Budget Enhancements',
            helpKey: 'cashflow_budget_enhancements',
            data: cashflowEnhancements,
            accent: '#0891b2',
            metric: cashflowEnhancements?.annual_surplus !== undefined ? `Annual surplus: ${formatCurrency(cashflowEnhancements.annual_surplus, 0)}` : ''
        },
        {
            title: 'Retirement Lifestyle Planning',
            helpKey: 'retirement_lifestyle_planning',
            data: lifestyle,
            accent: '#d97706',
            metric: lifestyle?.lean_lifestyle_budget ? `Lean budget: ${formatCurrency(lifestyle.lean_lifestyle_budget, 0)}` : ''
        },
        {
            title: 'Document Vault & Beneficiary Tracking',
            helpKey: 'document_vault_beneficiary_tracking',
            data: documentVault,
            accent: '#4f46e5',
            metric: documentVault?.document_completion_ratio !== undefined ? `Doc completion: ${formatPercent(documentVault.document_completion_ratio, 1)}` : ''
        },
        {
            title: 'Advanced Investment Factor Analysis',
            helpKey: 'advanced_investment_factor_analysis',
            data: investmentFactors,
            accent: '#0284c7',
            metric: investmentFactors?.liquidity_ratio !== undefined ? `Liquidity ratio: ${formatPercent(investmentFactors.liquidity_ratio, 1)}` : ''
        },
        {
            title: 'Family Legacy & Gifting Goals',
            helpKey: 'family_legacy_gifting_goals',
            data: legacyGoals,
            accent: '#9333ea',
            metric: legacyGoals?.annual_gift_capacity ? `Annual gift capacity: ${formatCurrency(legacyGoals.annual_gift_capacity, 0)}` : ''
        },
        {
            title: 'Risk Analysis Dashboard',
            helpKey: 'risk_analysis_dashboard',
            data: riskDashboard,
            accent: '#dc2626',
            metric: riskDashboard?.scores?.overall_risk_score !== undefined ? `Overall risk score: ${riskDashboard.scores.overall_risk_score}` : ''
        },
        {
            title: 'Plan Health Monitoring & Drift Alerts',
            helpKey: 'plan_health_monitoring_drift_alerts',
            data: planDrift,
            accent: '#0f766e',
            metric: planDrift?.drift_score !== undefined ? `Drift score: ${planDrift.drift_score}` : ''
        },
        {
            title: 'Tax Law Update Engine',
            helpKey: 'tax_law_update_engine',
            data: taxLaw,
            accent: '#166534',
            metric: taxLaw?.configured_tax_year ? `Configured tax year: ${taxLaw.configured_tax_year}` : ''
        },
        {
            title: 'Pre-65 Healthcare Bridge Planner',
            helpKey: 'pre65_healthcare_bridge_planner',
            data: pre65Bridge,
            accent: '#0e7490',
            metric: pre65Bridge?.bridge_years !== undefined ? `Bridge years: ${pre65Bridge.bridge_years}` : ''
        },
        {
            title: 'Guaranteed Income Floor Optimizer',
            helpKey: 'guaranteed_income_floor_optimizer',
            data: guaranteedFloor,
            accent: '#1d4ed8',
            metric: guaranteedFloor?.annual_floor_shortfall !== undefined ? `Annual floor shortfall: ${formatCurrency(guaranteedFloor.annual_floor_shortfall, 0)}` : ''
        },
        {
            title: 'Social Security Statement Reconciliation',
            helpKey: 'social_security_statement_reconciliation',
            data: ssReconcile,
            accent: '#7c2d12',
            metric: ssReconcile?.monthly_delta !== undefined ? `Monthly delta: ${formatCurrency(ssReconcile.monthly_delta, 0)}` : ''
        },
        {
            title: 'Data Aggregation & Reconciliation Hub',
            helpKey: 'data_aggregation_reconciliation_hub',
            data: dataHub,
            accent: '#0369a1',
            metric: dataHub?.data_confidence_score !== undefined ? `Data confidence: ${dataHub.data_confidence_score}` : ''
        },
        {
            title: 'Longevity & Care Path Modeling',
            helpKey: 'longevity_care_path_modeling',
            data: longevityCare,
            accent: '#9a3412',
            metric: longevityCare?.projected_lifetime_care_cost !== undefined ? `Projected lifetime care: ${formatCurrency(longevityCare.projected_lifetime_care_cost, 0)}` : ''
        },
        {
            title: 'Charitable Strategy Optimizer (DAF + QCD)',
            helpKey: 'charitable_strategy_optimizer',
            data: charitableOptimizer,
            accent: '#7e22ce',
            metric: charitableOptimizer?.estimated_tax_benefit !== undefined ? `Est. tax benefit: ${formatCurrency(charitableOptimizer.estimated_tax_benefit, 0)}` : ''
        },
        {
            title: 'Household Collaboration & Approval Workflow',
            helpKey: 'household_collaboration_workflow',
            data: householdWorkflow,
            accent: '#475569',
            metric: householdWorkflow?.open_review_count !== undefined ? `Open reviews: ${householdWorkflow.open_review_count}` : ''
        },
        {
            title: 'Retirement Paycheck Builder',
            helpKey: 'retirement_paycheck_builder',
            data: paycheckBuilder,
            accent: '#1f2937',
            metric: paycheckBuilder?.target_monthly_paycheck !== undefined ? `Target paycheck: ${formatCurrency(paycheckBuilder.target_monthly_paycheck, 0)}/mo` : ''
        }
    ].filter(card => card.data?.available);

    const extendedPlanningPanel = extendedCards.length > 0 ? `
        <div class="result-card" style="border-left: 4px solid #334155;">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('additional_planning_modules', 'Additional Planning Modules')}</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
                ${extendedCards.map(card => `
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 3px solid ${card.accent}; border-radius: 8px; padding: 10px;">
                        <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">${planningHelpButton(card.helpKey, card.title)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${card.data.summary || ''}</div>
                        <div style="font-size: 12px; font-weight: 600; color: ${card.accent};">${card.metric || ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const sequenceRows = (sequence?.cases || []).map(caseResult => `
        <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
            <div>
                <div style="font-weight: 600;">${caseResult.label}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    Crash window: ${caseResult.crash_window_years?.[0] || '-'}-${caseResult.crash_window_years?.[1] || '-'}
                </div>
            </div>
            <div style="font-size: 13px;">
                ${formatPercent(caseResult.success_rate, 1)}
                <span style="color: ${(caseResult.success_rate_delta || 0) < 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                    (${(caseResult.success_rate_delta || 0) >= 0 ? '+' : ''}${formatPercent(caseResult.success_rate_delta || 0, 1)})
                </span>
            </div>
            <div style="font-size: 13px;">
                ${formatCurrency(caseResult.median_final_balance || 0, 0)}
                <span style="color: ${(caseResult.median_final_balance_delta || 0) < 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                    (${(caseResult.median_final_balance_delta || 0) >= 0 ? '+' : ''}${formatCurrency(caseResult.median_final_balance_delta || 0, 0)})
                </span>
            </div>
        </div>
    `).join('');

    const sequencePanel = sequence ? `
        <div class="result-card" style="border-left: 4px solid var(--warning-color);">
            <h3 style="margin: 0 0 10px 0;">${planningHelpButton('sequence_risk_stress_test', 'Sequence Risk Stress Test')}</h3>
            <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px;">
                Moderate baseline: <strong>${formatPercent(sequence.baseline?.success_rate || 0, 1)}</strong> success,
                median <strong>${formatCurrency(sequence.baseline?.median_final_balance || 0, 0)}</strong>.
                Stress runs use ${(sequence.simulations || 0).toLocaleString()} simulations.
            </p>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; padding: 6px 0; border-bottom: 2px solid var(--border-color); font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">
                <div>Case</div>
                <div>Success Rate (Delta)</div>
                <div>Median Balance (Delta)</div>
            </div>
            ${sequenceRows || '<div style="padding: 10px 0; color: var(--text-secondary);">No stress cases available.</div>'}
            <p style="margin: 10px 0 0 0; color: var(--text-secondary); font-size: 13px;">
                ${sequence.summary?.summary || 'No sequence-risk summary available.'}
            </p>
        </div>
    ` : '';

    return `${lifePanel}${debtPanel}${collegePanel}${pensionPanel}${estatePanel}${feePanel}${partTimePanel}${realEstatePanel}${advancedScenarioPanel}${dynamicWithdrawalPanel}${lifeEventsPanel}${extendedPlanningPanel}${sequencePanel}`;
}

function displaySingleScenarioResults(container, data, profile, simulations) {
    // Calculate success color
    const successRate = data.success_rate || 0;
    let successClass = 'stat-danger';
    if (successRate >= 0.9) successClass = 'stat-success';
    else if (successRate >= 0.75) successClass = 'stat-warning';

    // Get the analysis result data (might be wrapped in lastAnalysisResult)
    const totalAssets = lastAnalysisResult?.total_assets || data.total_assets || 0;
    const yearsProjected = lastAnalysisResult?.years_projected || data.years_projected || 0;

    const planningData = lastAnalysisResult || data || {};
    const planningPanelsHtml = renderLifeInsuranceAndSequencePanels(planningData);

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Simulation Results</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations || 10000).toLocaleString()} Monte Carlo simulations
            </p>

            ${data.warnings && data.warnings.length > 0 ? `
                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 20px; color: var(--text-on-warning);">
                    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Market Period Warnings</div>
                    ${data.warnings.map(warning => `<div style="margin-bottom: 8px; font-size: 13px;">• ${warning}</div>`).join('')}
                </div>
            ` : ''}

            ${totalAssets > 0 ? `
                <div class="portfolio-card" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--accent-color); cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                Investment Portfolio
                                <span style="font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 6px; opacity: 0.7;">click for details</span>
                            </div>
                            <div style="font-size: 28px; font-weight: bold; color: var(--accent-color);">${formatCurrency(totalAssets, 0)}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
                                Retirement + Taxable accounts (Real estate tracked separately)
                            </div>
                        </div>
                        ${yearsProjected > 0 ? `
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Years Projected</div>
                                <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${yearsProjected}</div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="portfolio-detail" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                        ${renderAccountBreakdown(lastAnalysisResult?.account_breakdown || data.account_breakdown)}
                    </div>
                </div>
            ` : ''}

            <div class="stat-grid">
                <div class="stat-item" title="% of trials that didn't run out of cash">
                    <div class="stat-label">
                        Success Rate 
                        ${statHelpButton('success_rate', 'Learn more about Success Rate')}
                    </div>
                    <div class="stat-value ${successClass}">
                        ${formatPercent(successRate, 1)}
                    </div>
                    <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                        ${successRate >= 0.9 ? 'Excellent' : successRate >= 0.75 ? 'Good' : 'Needs Attention'}
                    </small>
                </div>

                <div class="stat-item" title="Half of trials ended with more than this, half with less">
                    <div class="stat-label">
                        Median Final Balance
                        ${statHelpButton('median', 'Learn more about Median Final Balance')}
                    </div>
                    <div class="stat-value stat-info">
                        ${formatCurrency(data.median_final_balance || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Worst 10% of outcomes. Only 10% of trials performed worse than this (conservative)">
                    <div class="stat-label">
                        10th Percentile
                        ${statHelpButton('percentile_10', 'Learn more about 10th Percentile')}
                    </div>
                    <div class="stat-value">
                        ${formatCurrency(data.percentile_10 || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Best 10% of outcomes. Only 10% of trials performed better than this (optimistic)">
                    <div class="stat-label">
                        90th Percentile
                        ${statHelpButton('percentile_90', 'Learn more about 90th Percentile')}
                    </div>
                    <div class="stat-value stat-success">
                        ${formatCurrency(data.percentile_90 || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="The average of all trial outcomes">
                    <div class="stat-label">
                        Expected Value
                        ${statHelpButton('expected_value', 'Learn more about Expected Value')}
                    </div>
                    <div class="stat-value">
                        ${formatCurrency(data.expected_value || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Measure of uncertainty; higher means more spread between outcomes">
                    <div class="stat-label">
                        Std Deviation
                        ${statHelpButton('std_deviation', 'Learn more about Standard Deviation')}
                    </div>
                    <div class="stat-value">
                        ${formatCurrency(data.std_deviation || 0, 0)}
                    </div>
                </div>
            </div>
        </div>

        ${planningPanelsHtml}

        <!-- Timeline Chart -->
        <div class="result-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="font-size: 20px; margin: 0;">Portfolio Projection Timeline</h3>
                    <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 14px;">
                        Scroll or +/- to zoom • Click and drag to pan
                    </p>
                </div>
                <button id="reset-zoom-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Reset Zoom
                </button>
            </div>
            <div style="position: relative; height: 350px;">
                <canvas id="timeline-chart"></canvas>
            </div>
        </div>

        ${data.warnings && data.warnings.length > 0 ? `
            <div class="result-card" style="border-left: 4px solid var(--warning-color);">
                <h3 style="font-size: 20px; margin-bottom: 15px; color: var(--warning-color);">Warnings</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    ${data.warnings.map(warning => `
                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${warning}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${data.recommendations && data.recommendations.length > 0 ? `
            <div class="result-card" style="border-left: 4px solid var(--info-color);">
                <h3 style="font-size: 20px; margin-bottom: 15px; color: var(--info-color);">Recommendations</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    ${data.recommendations.map(rec => `
                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${rec}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px;">
            <button id="save-scenario-btn" style="padding: 12px 24px; background: var(--success-color); color: var(--text-on-success); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 600;">
                Save as Scenario
            </button>
            <button class="secondary-btn csp-nav" data-target="comparison" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                Compare Scenarios
            </button>
            <button class="primary-btn csp-nav" data-target="actions" style="padding: 12px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer;">
                View Action Items
            </button>
        </div>
    `;

    // Wire up CSP-safe navigation handlers
    container.querySelectorAll('.csp-nav').forEach(btn => {
        btn.addEventListener('click', () => window.app.showTab(btn.dataset.target));
    });

    // Portfolio card click to expand account breakdown
    container.querySelectorAll('.portfolio-card').forEach(card => {
        card.addEventListener('click', () => {
            const detail = card.querySelector('.portfolio-detail');
            if (detail) {
                detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Add click handlers to stat items for explanations
    setupStatItemClickHandlers(container);
    setupPlanningCardHelpHandlers(container);
    setupPlanningCardDetailHandlers(container, planningData);

    // Render timeline chart if data available
    if (data.timeline) {
        const chart = renderStandardTimelineChart(data.timeline, 'timeline-chart', timelineChartInstances, { container });

        // Set up reset zoom handler
        const resetBtn = container.querySelector('#reset-zoom-btn');
        if (resetBtn && chart) {
            resetBtn.addEventListener('click', () => {
                chart.resetZoom();
            });
        }

        // Handle keyboard zoom controls (+ and -)
        const keyboardZoomHandler = (e) => {
            if (!chart) return;

            // Check if + or = key (zoom in)
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                chart.zoom(1.1);
            }
            // Check if - or _ key (zoom out)
            else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                chart.zoom(0.9);
            }
        };

        // Add keyboard listener
        document.addEventListener('keydown', keyboardZoomHandler);
        container._analysisKeyboardHandler = keyboardZoomHandler;
    }

    // Set up save scenario handler
    setupSaveScenarioHandler(container, profile);
}

function displayMultiScenarioResults(container, data, profile, simulations) {
    const scenarios = data.scenarios;
    const scenarioOrder = ['conservative', 'moderate', 'aggressive'];

    // Check if any scenario has warnings
    const anyWarnings = Object.values(scenarios).some(s => s.warnings && s.warnings.length > 0);
    const allWarnings = anyWarnings ? Object.values(scenarios).flatMap(s => s.warnings || []).filter((v, i, a) => a.indexOf(v) === i) : [];

    const planningPanelsHtml = renderLifeInsuranceAndSequencePanels(data);

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Multi-Scenario Analysis</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations).toLocaleString()} Monte Carlo simulations per scenario
            </p>

            ${allWarnings.length > 0 ? `
                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 20px; color: var(--text-on-warning);">
                    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Market Period Warnings</div>
                    ${allWarnings.map(warning => `<div style="margin-bottom: 8px; font-size: 13px;">• ${warning}</div>`).join('')}
                </div>
            ` : ''}

            <!-- Starting Balance Highlight -->
            <div class="portfolio-card" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--accent-color); cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                            Investment Portfolio
                            <span style="font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 6px; opacity: 0.7;">click for details</span>
                        </div>
                        <div style="font-size: 28px; font-weight: bold; color: var(--accent-color);">${formatCurrency(data.total_assets || 0, 0)}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
                            Retirement + Taxable accounts (Real estate tracked separately)
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Years Projected</div>
                        <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${data.years_projected}</div>
                    </div>
                </div>
                <div class="portfolio-detail" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    ${renderAccountBreakdown(data.account_breakdown)}
                </div>
            </div>

            <!-- Scenario Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 10px;">
                ${scenarioOrder.map((key, idx) => {
                    const scenario = scenarios[key];
                    if (!scenario) return '';
                    return `
                        <button class="scenario-tab ${idx === 0 ? 'active' : ''}" data-scenario="${key}"
                                style="padding: 10px 20px; background: ${idx === 0 ? 'var(--accent-color)' : 'var(--bg-tertiary)'};
                                       color: ${idx === 0 ? 'white' : 'var(--text-primary)'}; border: none;
                                       border-radius: 6px 6px 0 0; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                            ${scenario.scenario_name} (${Math.round(scenario.stock_allocation * 100)}% stocks)
                        </button>
                    `;
                }).join('')}
            </div>

            <!-- Scenario Content -->
            ${scenarioOrder.map((key, idx) => {
                const scenario = scenarios[key];
                if (!scenario) return '';

                const successRate = scenario.success_rate || 0;
                let successClass = 'stat-danger';
                if (successRate >= 0.9) successClass = 'stat-success';
                else if (successRate >= 0.75) successClass = 'stat-warning';

                return `
                    <div class="scenario-content" data-scenario="${key}" style="display: ${idx === 0 ? 'block' : 'none'};">
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="margin: 0 0 5px 0; font-size: 18px;">${scenario.scenario_name} Portfolio</h3>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">${scenario.description}</p>
                        </div>

                        <div class="stat-grid">
                            <div class="stat-item" title="% of trials that didn't run out of cash">
                                <div class="stat-label">
                                    Success Rate
                                    ${statHelpButton('success_rate', 'Learn more about Success Rate')}
                                </div>
                                <div class="stat-value ${successClass}">
                                    ${formatPercent(successRate, 1)}
                                </div>
                                <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                                    ${successRate >= 0.9 ? 'Excellent' : successRate >= 0.75 ? 'Good' : 'Needs Attention'}
                                </small>
                            </div>

                            <div class="stat-item" title="Half of trials ended with more than this, half with less">
                                <div class="stat-label">
                                    Median Final Balance
                                    ${statHelpButton('median', 'Learn more about Median Final Balance')}
                                </div>
                                <div class="stat-value stat-info">
                                    ${formatCurrency(scenario.median_final_balance || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Worst 10% of outcomes. Only 10% of trials performed worse than this (conservative)">
                                <div class="stat-label">
                                    10th Percentile
                                    ${statHelpButton('percentile_10', 'Learn more about 10th Percentile')}
                                </div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.percentile_10 || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Best 10% of outcomes. Only 10% of trials performed better than this (optimistic)">
                                <div class="stat-label">
                                    90th Percentile
                                    ${statHelpButton('percentile_90', 'Learn more about 90th Percentile')}
                                </div>
                                <div class="stat-value stat-success">
                                    ${formatCurrency(scenario.percentile_90 || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="The average of all trial outcomes">
                                <div class="stat-label">
                                    Expected Value
                                    ${statHelpButton('expected_value', 'Learn more about Expected Value')}
                                </div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.expected_value || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Measure of uncertainty; higher means more spread between outcomes">
                                <div class="stat-label">
                                    Std Deviation
                                    ${statHelpButton('std_deviation', 'Learn more about Standard Deviation')}
                                </div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.std_deviation || 0, 0)}
                                </div>
                            </div>
                        </div>

                        <!-- Timeline Chart for this scenario -->
                        <div style="margin-top: 30px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <h3 style="font-size: 20px; margin: 0;">Portfolio Projection Timeline</h3>
                                    <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 14px;">
                                        Scroll or +/- to zoom • Click and drag to pan
                                    </p>
                                </div>
                                <button class="reset-zoom-btn" data-chart="timeline-chart-${key}" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                                    Reset Zoom
                                </button>
                            </div>
                            <div style="position: relative; height: 350px;">
                                <canvas id="timeline-chart-${key}"></canvas>
                            </div>
                        </div>

                        ${scenario.warnings && scenario.warnings.length > 0 ? `
                            <div style="border-left: 4px solid var(--warning-color); background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-top: 20px;">
                                <h3 style="font-size: 18px; margin-bottom: 15px; color: var(--warning-color);">Warnings</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${scenario.warnings.map(warning => `
                                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${warning}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        ${scenario.recommendations && scenario.recommendations.length > 0 ? `
                            <div style="border-left: 4px solid var(--info-color); background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-top: 20px;">
                                <h3 style="font-size: 18px; margin-bottom: 15px; color: var(--info-color);">Recommendations</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${scenario.recommendations.map(rec => `
                                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${rec}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}

            <div style="text-align: center; margin-top: 30px;">
                 <button id="save-multi-scenario-btn" style="padding: 12px 24px; background: var(--success-color); color: var(--text-on-success); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 600;">
                    Save as Scenario
                </button>
                <button class="secondary-btn csp-nav" data-target="comparison" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                    Compare Scenarios
                </button>
                <button class="primary-btn csp-nav" data-target="actions" style="padding: 12px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer;">
                    View Action Items
                </button>
            </div>
        </div>

        ${planningPanelsHtml}
    `;

    // Wire up CSP-safe navigation handlers
    container.querySelectorAll('.csp-nav').forEach(btn => {
        btn.addEventListener('click', () => window.app.showTab(btn.dataset.target));
    });

    // Set up tab switching
    const tabs = container.querySelectorAll('.scenario-tab');
    const contents = container.querySelectorAll('.scenario-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const scenarioKey = tab.getAttribute('data-scenario');

            // Update tab styles
            tabs.forEach(t => {
                if (t === tab) {
                    t.style.background = 'var(--accent-color)';
                    t.style.color = 'white';
                } else {
                    t.style.background = 'var(--bg-tertiary)';
                    t.style.color = 'var(--text-primary)';
                }
            });

            // Update content visibility
            contents.forEach(content => {
                if (content.getAttribute('data-scenario') === scenarioKey) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // Add click handlers to stat items for explanations in all scenarios
    setupStatItemClickHandlers(container);
    setupPlanningCardHelpHandlers(container);
    setupPlanningCardDetailHandlers(container, planningData);

    // Render timeline charts for each scenario
    console.log('About to render timeline charts...');
    console.log('Chart object available:', typeof Chart !== 'undefined');
    scenarioOrder.forEach(key => {
        const scenario = scenarios[key];
        console.log(`Scenario ${key} has timeline:`, !!scenario?.timeline);
        if (scenario?.timeline) {
            console.log(`Timeline data for ${key}:`, {
                years: scenario.timeline.years?.length || 0,
                p5: scenario.timeline.p5?.length || 0,
                median: scenario.timeline.median?.length || 0,
                p95: scenario.timeline.p95?.length || 0
            });
        }
        if (scenario && scenario.timeline) {
            console.log(`Calling renderStandardTimelineChart for ${key}`);
            try {
                const chart = renderStandardTimelineChart(scenario.timeline, `timeline-chart-${key}`, timelineChartInstances, { container });
                console.log(`Successfully rendered chart for ${key}`);

                // Set up reset zoom handler for this chart
                const resetBtn = container.querySelector(`.reset-zoom-btn[data-chart="timeline-chart-${key}"]`);
                if (resetBtn && chart) {
                    resetBtn.addEventListener('click', () => {
                        chart.resetZoom();
                    });
                }

                // Handle keyboard zoom controls for multi-scenario charts (+ and -)
                // Note: For multi-scenario, we add handlers for each chart, but only one will be active at a time
                // The container._analysisKeyboardHandler will be overwritten by the last chart
                const keyboardZoomHandler = (e) => {
                    if (!chart) return;

                    // Check if + or = key (zoom in)
                    if (e.key === '+' || e.key === '=') {
                        e.preventDefault();
                        // Zoom all visible charts
                        Object.values(timelineChartInstances).forEach(c => {
                            if (c) c.zoom(1.1);
                        });
                    }
                    // Check if - or _ key (zoom out)
                    else if (e.key === '-' || e.key === '_') {
                        e.preventDefault();
                        // Zoom all visible charts
                        Object.values(timelineChartInstances).forEach(c => {
                            if (c) c.zoom(0.9);
                        });
                    }
                };

                // Only set up keyboard handler once for all multi-scenario charts
                if (!container._analysisKeyboardHandler) {
                    document.addEventListener('keydown', keyboardZoomHandler);
                    container._analysisKeyboardHandler = keyboardZoomHandler;
                }
            } catch (error) {
                console.error(`Error rendering chart for ${key}:`, error);
            }
        } else {
            console.warn(`No timeline data for scenario ${key}`);
        }
    });

    // Portfolio card click to expand account breakdown
    container.querySelectorAll('.portfolio-card').forEach(card => {
        card.addEventListener('click', () => {
            const detail = card.querySelector('.portfolio-detail');
            if (detail) {
                detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Setup save handler for multi-scenario
    setupMultiSaveScenarioHandler(container, profile);
}

async function setupSaveScenarioHandler(container, profile) {
    const saveBtn = container.querySelector('#save-scenario-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        if (!lastAnalysisResult) {
            alert('No analysis results to save');
            return;
        }

        // Build market condition description based on the mode used
        let marketDescription = '';

        if (currentMarketMode === 'preset' && selectedPreset) {
            // Preset mode: use the preset name
            const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
            marketDescription = preset?.name || 'Preset';
        } else if (currentMarketMode === 'timeline') {
            // Timeline mode: count the periods
            const periodCount = container.querySelectorAll('.timeline-period').length;
            marketDescription = `Timeline (${periodCount} period${periodCount !== 1 ? 's' : ''})`;
        } else if (currentMarketMode === 'cycle') {
            // Cycle mode: count phases and note repeat setting
            const phaseCount = container.querySelectorAll('.cycle-phase').length;
            const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
            const repeats = repeatCheckbox?.checked ? 'repeating' : 'once';
            marketDescription = `Cycle (${phaseCount} phase${phaseCount !== 1 ? 's' : ''}, ${repeats})`;
        } else {
            // Simple mode: use market profile name and stock allocation
            const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
            const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
            const marketProfileName = marketProfile?.name || 'Historical';
            const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);
            marketDescription = `${marketProfileName} (${stockAllocation}% stocks)`;
        }

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | ${marketDescription} | ${spendingName} | ${simCount} sims | ${timestamp}`;

        const scenarioName = prompt('Enter a name for this scenario:', defaultName);

        if (!scenarioName) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Import scenarios API dynamically
            const { scenariosAPI } = await import('../../api/scenarios.js');

            await scenariosAPI.create(
                scenarioName,
                profile.name,
                { simulations: lastSimulations, profile_snapshot: profile.data },
                lastAnalysisResult.results || lastAnalysisResult
            );

            showSuccess('Scenario saved successfully!');
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = 'var(--text-secondary)';

        } catch (error) {
            console.error('Save scenario error:', error);
            alert(`Failed to save scenario: ${error.message}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save as Scenario';
        }
    });
}

async function setupMultiSaveScenarioHandler(container, profile) {
    const saveBtn = container.querySelector('#save-multi-scenario-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        if (!lastAnalysisResult) {
            alert('No analysis results to save');
            return;
        }

        // Build market condition description based on the mode used
        let marketDescription = '';

        if (currentMarketMode === 'preset' && selectedPreset) {
            // Preset mode: use the preset name
            const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
            marketDescription = preset?.name || 'Preset';
        } else if (currentMarketMode === 'timeline') {
            // Timeline mode: count the periods
            const periodCount = container.querySelectorAll('.timeline-period').length;
            marketDescription = `Timeline (${periodCount} period${periodCount !== 1 ? 's' : ''})`;
        } else if (currentMarketMode === 'cycle') {
            // Cycle mode: count phases and note repeat setting
            const phaseCount = container.querySelectorAll('.cycle-phase').length;
            const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
            const repeats = repeatCheckbox?.checked ? 'repeating' : 'once';
            marketDescription = `Cycle (${phaseCount} phase${phaseCount !== 1 ? 's' : ''}, ${repeats})`;
        } else {
            // Simple mode: use market profile name and stock allocation
            const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
            const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
            const marketProfileName = marketProfile?.name || 'Historical';
            const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);
            marketDescription = `${marketProfileName} (${stockAllocation}% stocks)`;
        }

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | Multi | ${marketDescription} | ${spendingName} | ${simCount} sims | ${timestamp}`;

        const scenarioName = prompt('Enter a name for this multi-scenario analysis:', defaultName);

        if (!scenarioName) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Import scenarios API dynamically
            const { scenariosAPI } = await import('../../api/scenarios.js');

            await scenariosAPI.create(
                scenarioName,
                profile.name,
                { simulations: lastSimulations, profile_snapshot: profile.data, multi_scenario: true },
                lastAnalysisResult
            );

            showSuccess('Multi-scenario analysis saved successfully!');
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = 'var(--text-secondary)';

        } catch (error) {
            console.error('Save multi-scenario error:', error);
            alert(`Failed to save multi-scenario: ${error.message}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save as Scenario';
        }
    });
}



/**
 * Setup click handlers on stat items to show explanation modals
 */
function setupStatItemClickHandlers(container) {
    // Find all stat items and attach appropriate click handlers
    const statItems = container.querySelectorAll('.stat-item');

    statItems.forEach(item => {
        const label = item.querySelector('.stat-label');
        if (!label) return;

        const labelText = label.textContent.trim();

        // Determine which modal to show based on label text
        if (labelText.includes('Success Rate')) {
            item.addEventListener('click', showSuccessRateModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Median Final Balance')) {
            item.addEventListener('click', showMedianBalanceModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('10th Percentile')) {
            item.addEventListener('click', () => showPercentileModal(10));
            item.style.cursor = 'pointer';
        } else if (labelText.includes('90th Percentile')) {
            item.addEventListener('click', () => showPercentileModal(90));
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Expected Value')) {
            item.addEventListener('click', showExpectedValueModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Std Deviation')) {
            item.addEventListener('click', showStdDeviationModal);
            item.style.cursor = 'pointer';
        }
    });

    // Direct help buttons for term definitions inside labels.
    container.querySelectorAll('.analysis-term-help').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const helpType = btn.getAttribute('data-help');
            if (helpType === 'success_rate') showSuccessRateModal();
            else if (helpType === 'median') showMedianBalanceModal();
            else if (helpType === 'percentile_10') showPercentileModal(10);
            else if (helpType === 'percentile_90') showPercentileModal(90);
            else if (helpType === 'expected_value') showExpectedValueModal();
            else if (helpType === 'std_deviation') showStdDeviationModal();
        });
    });
}

/**
 * Show modal explaining Success Rate metric
 */
function showSuccessRateModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--success-color);">📊 Success Rate</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--success-color), #26d07c); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: var(--text-on-success);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The percentage of Monte Carlo simulations where your portfolio lasted through your entire projected retirement without running out of money.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Run thousands of simulations with randomized market returns<br>
                        2. Count how many simulations ended with money remaining<br>
                        3. Divide successful simulations by total simulations<br><br>
                        <strong>Example:</strong> If 8,500 out of 10,000 simulations didn't run out of money, your success rate is 85%.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--success-color);">90%+ (Excellent):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Very robust plan. You can retire with confidence. Your plan handles most market scenarios including prolonged downturns.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">75-89% (Good):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Solid plan with acceptable risk. Consider small adjustments like working 1-2 more years or reducing spending by 5-10%.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--danger-color);">Below 75% (Needs Attention):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Plan needs adjustments. Consider: delaying retirement, increasing savings, reducing expenses, or adjusting portfolio allocation.
                        </p>
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <strong>💡 Important Note:</strong> 100% success rate often means you're being too conservative and leaving money on the table. A 85-95% success rate typically represents an optimal balance between security and enjoying your wealth.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Median Final Balance metric
 */
function showMedianBalanceModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--info-color);">💰 Median Final Balance</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The middle outcome from all simulations - half of the scenarios ended with more money than this, and half ended with less. This represents your "typical" outcome.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Collect final portfolio balances from all simulations<br>
                        2. Sort all outcomes from lowest to highest<br>
                        3. Take the middle value (50th percentile)<br><br>
                        <strong>Example:</strong> If you run 10,000 simulations and sort them, the median is the balance at position 5,000.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why Median vs Average?</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        The median is more useful than the average (expected value) because it's not skewed by extreme outcomes. A few very successful simulations can pull the average up significantly, making it less representative of a typical outcome.<br><br>
                        <strong>Think of it this way:</strong> If you retire 100 times, the median tells you what would happen in the 50th "most typical" retirement.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--success-color);">Positive Balance:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Your plan is likely successful. You'll probably have money left over in a typical scenario.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Close to Zero:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Your plan is cutting it close. Consider adjustments to add a margin of safety.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--danger-color);">Zero or Negative:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            In a typical scenario, you run out of money. Plan needs significant adjustments.
                        </p>
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <strong>💡 Pro Tip:</strong> A high median final balance suggests you might be able to spend more in retirement or retire earlier. Consider running scenarios with increased spending to optimize your plan.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Percentile metrics
 */
function showPercentileModal(percentile) {
    const is10th = percentile === 10;
    const color = is10th ? 'var(--warning-color)' : 'var(--success-color)';
    const title = is10th ? '10th Percentile' : '90th Percentile';
    const emoji = is10th ? '📉' : '📈';

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: ${color};">${emoji} ${title}</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, ${color}, ${is10th ? '#f39c12' : '#26d07c'}); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: ${is10th ? 'var(--text-on-warning)' : 'var(--text-on-success)'};">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        ${is10th
                            ? 'The "bad luck" scenario. Only 10% of simulations performed worse than this. This represents what happens if markets are poor during your retirement.'
                            : 'The "good luck" scenario. Only 10% of simulations performed better than this. This represents what happens if markets are favorable during your retirement.'}
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Sort all simulation outcomes from lowest to highest<br>
                        2. ${is10th ? 'Find the value at the 10% position' : 'Find the value at the 90% position'}<br>
                        3. ${is10th ? '90% of outcomes are better than this' : '90% of outcomes are worse than this'}<br><br>
                        <strong>Example:</strong> In 10,000 simulations, the ${title.toLowerCase()} is the balance at position ${is10th ? '1,000' : '9,000'}.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Real-World Analogy</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        ${is10th
                            ? '<strong>Imagine retiring into the Great Recession or a prolonged bear market.</strong><br><br>This scenario captures what happens when you face poor market conditions early in retirement - often called "sequence of returns risk." A recession in your first 5-10 retirement years can have a lasting impact on your portfolio.'
                            : '<strong>Imagine retiring at the start of a bull market with strong growth.</strong><br><br>This scenario captures what happens when markets perform well during your retirement. While this is the optimistic case, don\'t count on it - plan for the median or 10th percentile instead.'}
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Use This Information</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    ${is10th
                        ? `<div style="margin-bottom: 15px;">
                            <strong style="color: var(--success-color);">Positive Balance:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                Even in the worst 10% of outcomes, you still have money. Very strong plan!
                            </p>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--warning-color);">Close to Zero:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                If unlucky with market timing, you might just barely make it. Consider adding a buffer.
                            </p>
                        </div>
                        <div>
                            <strong style="color: var(--danger-color);">Zero:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                Poor market timing would exhaust your portfolio. This is your downside risk - plan accordingly.
                            </p>
                        </div>`
                        : `<div>
                            <p style="margin: 0; color: var(--text-secondary);">
                                The 90th percentile shows your upside potential. If markets perform well, you could have significantly more wealth than expected. However, <strong>don't plan around this optimistic scenario</strong> - use it to understand your potential for legacy wealth or charitable giving if markets are favorable.
                            </p>
                        </div>`}
                </div>

                <div style="background: ${color}; padding: 15px; border-radius: 8px; margin-top: 20px; color: ${is10th ? 'var(--text-on-warning)' : 'var(--text-on-success)'};">
                    <strong>💡 ${is10th ? 'Risk Management' : 'Opportunity Planning'}:</strong>
                    ${is10th
                        ? 'Focus on this metric for risk assessment. If you can survive the 10th percentile scenario comfortably, your plan is robust against market downturns.'
                        : 'Use this metric to understand your upside. If the 90th percentile is very high, you might consider more aggressive spending or leaving a larger legacy.'}
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Expected Value metric
 */
function showExpectedValueModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">🎲 Expected Value</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--accent-color), #5faee3); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: var(--text-on-accent);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The mathematical average (mean) of all simulation outcomes. This is the simple average of all final portfolio balances across all simulations.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Add up all final portfolio balances from every simulation<br>
                        2. Divide by the total number of simulations<br><br>
                        <strong>Formula:</strong> Expected Value = Sum of all outcomes ÷ Number of simulations<br><br>
                        <strong>Example:</strong> If 10,000 simulations average to a total of $50 billion, the expected value is $5 million.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why It's Often Higher Than Median</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        Retirement portfolios have <strong>asymmetric risk</strong>:<br><br>
                        • <strong>Downside is limited:</strong> You can only lose 100% (portfolio goes to $0)<br>
                        • <strong>Upside is unlimited:</strong> Strong markets can multiply your wealth many times<br><br>
                        This means a few very successful simulations (10x or 20x growth in bull markets) can pull the average way up, even though most outcomes cluster around the median.<br><br>
                        <strong>Result:</strong> The expected value is typically much higher than the median because of these extreme positive outliers.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Don't Plan Around This Number</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            The expected value is NOT what you should expect in retirement. It's heavily influenced by unlikely best-case scenarios. Focus on the median instead.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--info-color);">Use It For Portfolio Growth Understanding</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            It shows how much compound growth potential your portfolio has over time. A high expected value relative to starting balance indicates strong growth assumptions.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--success-color);">Legacy and Estate Planning</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            If you're interested in leaving wealth to heirs, this metric shows the average amount you might leave behind.
                        </p>
                    </div>
                </div>

                <div style="background: var(--warning-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: var(--text-on-warning);">
                    <strong>⚠️ Important Warning:</strong> Because the expected value includes unlikely best-case scenarios, it's often 2-3x higher than the median. Don't mistake this for a typical outcome - use the median for realistic planning.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Standard Deviation metric
 */
function showStdDeviationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: #9b59b6;">📊 Standard Deviation</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: var(--text-on-accent);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        A measure of uncertainty and volatility. It shows how spread out the simulation outcomes are. Higher standard deviation = more uncertainty and wider range of possible outcomes.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Find the expected value (average)<br>
                        2. Calculate how far each outcome deviates from the average<br>
                        3. Square those deviations, average them, then take the square root<br><br>
                        <strong>Formula:</strong> σ = √[Σ(x - μ)² / n]<br>
                        Where x = each outcome, μ = mean, n = number of simulations
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">What Does This Tell You?</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--info-color);">Outcome Uncertainty</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Higher standard deviation means there's a bigger spread between best-case and worst-case scenarios. You have less predictability about your final outcome.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Portfolio Volatility Impact</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Aggressive portfolios (80-100% stocks) typically have higher standard deviations. Conservative portfolios (30-40% stocks) have lower standard deviations.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--success-color);">Risk Tolerance Gauge</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            A high standard deviation relative to your starting portfolio indicates you're taking on significant risk. Make sure you're comfortable with that level of uncertainty.
                        </p>
                    </div>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Real-World Example</h3>
                <div style="background: var(--accent-color); padding: 20px; border-radius: 8px; margin-bottom: 15px; color: var(--text-on-accent);">
                    <p style="margin: 0; line-height: 1.6;">
                        <strong>Scenario A:</strong> Expected value = $5M, Std Dev = $2M<br>
                        → Most outcomes fall between $3M and $7M (within 1 standard deviation)<br><br>

                        <strong>Scenario B:</strong> Expected value = $5M, Std Dev = $10M<br>
                        → Outcomes could range wildly from -$5M (ran out) to $15M+<br><br>

                        Both have the same expected value, but Scenario B has much more uncertainty!
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Use This Information</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0 0 10px 0; color: var(--text-secondary);">
                        <strong>Compare Allocation Strategies:</strong> Look at how standard deviation changes between conservative, moderate, and aggressive portfolios. Higher stock allocation = higher standard deviation = more uncertainty.
                    </p>
                    <p style="margin: 0; color: var(--text-secondary);">
                        <strong>Risk-Adjusted Planning:</strong> If you see high standard deviation alongside a low median, that's a red flag - you have high uncertainty AND low typical outcomes. Consider adjusting your plan.
                    </p>
                </div>

                <div style="background: #9b59b6; padding: 15px; border-radius: 8px; margin-top: 20px; color: var(--text-on-accent);">
                    <strong>💡 Pro Tip:</strong> Don't obsess over this number - it's more of an academic metric. Focus on success rate and median balance for practical planning. Standard deviation is useful mainly for comparing allocation strategies.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Monte Carlo simulation calculations
 */
function showCalculationExplanationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button id="close-calc-modal" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">📊 How Monte Carlo Simulation Works</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">What is Monte Carlo Simulation?</h3>
                <p style="margin-bottom: 15px; color: var(--text-secondary);">
                    Monte Carlo simulation runs thousands of different scenarios to understand the range of possible retirement outcomes.
                    Instead of using a single assumed rate of return, it simulates realistic market volatility and randomness.
                </p>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Calculation Process</h3>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">1. Initial Portfolio Setup</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        • Combines all your assets: taxable accounts, IRAs, 401(k)s, Roth accounts<br>
                        • Includes home equity and pension values<br>
                        • Tracks cost basis for tax calculations
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">2. Pre-Retirement Years</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        • <strong>Income:</strong> Salary covers living expenses<br>
                        • <strong>Savings:</strong> Surplus income → retirement accounts (401k, IRA)<br>
                        • <strong>Employer Match:</strong> Added to pre-tax accounts<br>
                        • <strong>Growth:</strong> All accounts grow with market returns
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">3. Retirement Years</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        • <strong>Income:</strong> Social Security + Pensions<br>
                        • <strong>Expenses:</strong> Living costs (adjusted for inflation)<br>
                        • <strong>Shortfall:</strong> When expenses > income, withdraw from portfolio<br>
                        • <strong>Growth:</strong> Remaining portfolio continues to grow
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <h4 style="font-size: 16px; margin-bottom: 10px; font-weight: bold;">💡 How Spending Strategy Works with Your Expenses</h4>
                    <p style="margin: 0; line-height: 1.6;">
                        <strong>Your actual expenses from the Expenses tab are used as the BASE.</strong><br><br>
                        The spending strategy is then applied as a <strong>MULTIPLIER</strong> on top of those expenses:<br><br>
                        • <strong>Constant Inflation-Adjusted:</strong> Multiplier = 1.0 (no change)<br>
                        • <strong>Retirement Smile:</strong> Multiplier starts at 1.0, drops to 0.8 at age 80, then rises back for healthcare<br>
                        • <strong>Conservative Decline:</strong> Multiplier gradually decreases 1% per year after age 70<br><br>
                        <strong>Example:</strong> If your expenses are $80,000/year and you use Retirement Smile, at age 75 the multiplier might be 0.9, so modeled spending = $80,000 × 0.9 = $72,000.<br><br>
                        <strong>Note:</strong> Housing costs remain constant regardless of spending strategy.
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">4. Tax-Optimized Withdrawals</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        <strong>Withdrawal Order (most efficient):</strong><br>
                        1. Taxable accounts (only capital gains tax on growth)<br>
                        2. Pre-tax accounts (Traditional IRA/401k - ordinary income tax)<br>
                        3. Roth accounts (tax-free, preserve as long as possible)
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">5. Market Returns (Randomized Each Year)</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        • Stock returns vary based on selected market profile<br>
                        • Bond returns provide stability<br>
                        • Inflation adjusts expenses each year<br>
                        • Each simulation has different random sequence of returns
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--accent-color);">6. Additional Factors</h4>
                    <p style="margin: 0; color: var(--text-secondary);">
                        • <strong>RMDs:</strong> Required Minimum Distributions at age 73<br>
                        • <strong>Home Sales:</strong> Proceeds added to portfolio<br>
                        • <strong>Healthcare Costs:</strong> Modeled in spending patterns<br>
                        • <strong>Longevity:</strong> Projects through your life expectancy
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Understanding Results</h3>

                <div style="background: linear-gradient(135deg, var(--success-color), #26d07c); padding: 15px; border-radius: 8px; margin-bottom: 10px; color: var(--text-on-success);">
                    <strong>Success Rate:</strong> Percentage of simulations where portfolio lasts through life expectancy
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <strong>Median Balance:</strong> The middle outcome - half do better, half worse
                </div>

                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 10px; color: var(--text-on-warning);">
                    <strong>10th Percentile:</strong> The "bad luck" scenario - only 10% do worse
                </div>

                <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 15px; border-radius: 8px; margin-bottom: 15px; color: var(--text-on-accent);">
                    <strong>90th Percentile:</strong> The "good luck" scenario - only 10% do better
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why Run Multiple Simulations?</h3>
                <p style="margin-bottom: 15px; color: var(--text-secondary);">
                    Markets don't give you average returns every year. One simulation might hit a bear market early (worst case),
                    another might see strong growth (best case). Running 10,000 simulations shows you the full spectrum of
                    what could happen based on historical market patterns.
                </p>

                <div style="background: var(--accent-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: var(--text-on-accent);">
                    <strong>💡 Pro Tip:</strong> A 85-90%+ success rate is generally considered a robust retirement plan.
                    100% is often too conservative (leaves money on the table), while below 70% suggests adjustments are needed.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button id="close-calc-modal-btn" style="padding: 12px 30px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('#close-calc-modal').addEventListener('click', closeModal);
    modal.querySelector('#close-calc-modal-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}
