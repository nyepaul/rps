/**
 * Tax Optimization tab component
 * Provides comprehensive tax analysis, Roth conversion optimization,
 * Social Security timing, RMD projections, and state tax comparisons
 */

import { store } from '../../state/store.js';
import { taxOptimizationAPI } from '../../api/tax-optimization.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';

const TAX_GLOSSARY = {
    life_expectancy: {
        title: 'Life Expectancy',
        definition: 'How long benefits are projected. A longer horizon often increases the value of delayed claiming.'
    },
    annual_earned_income: {
        title: 'Annual Earned Income',
        definition: 'Wages/self-employment income while receiving benefits. Before full retirement age, earnings can temporarily reduce Social Security payments.'
    },
    noncovered_pension: {
        title: 'Noncovered Pension',
        definition: 'Pension income from work that did not pay into Social Security payroll taxes.'
    },
    wep: {
        title: 'WEP (Windfall Elimination Provision)',
        definition: 'A rule that can reduce your own Social Security retirement/disability benefit when you also receive a noncovered pension.'
    },
    gpo: {
        title: 'GPO (Government Pension Offset)',
        definition: 'A rule that can reduce spousal/survivor benefits, often by two-thirds of a noncovered pension amount.'
    },
    roth_conversion: {
        title: 'Roth Conversion',
        definition: 'Moving money from traditional retirement accounts into Roth accounts. Taxes are paid now, future qualified withdrawals are tax-free.'
    },
    ladder_years: {
        title: 'Ladder Years',
        definition: 'How many years the model spreads planned Roth conversions across.'
    },
    growth_rate: {
        title: 'Growth Rate',
        definition: 'Annual investment growth assumption used in projections.'
    },
    max_marginal_rate: {
        title: 'Max Marginal Rate',
        definition: 'The highest marginal tax rate you are willing to hit in the conversion plan.'
    },
    income_growth: {
        title: 'Income Growth',
        definition: 'Annual growth assumption for taxable income used when estimating future bracket headroom.'
    },
    safety_buffer: {
        title: 'Safety Buffer',
        definition: 'Dollar cushion left below a bracket ceiling to reduce risk of crossing into a higher bracket from estimate error.'
    },
    optimal_conversion: {
        title: 'Optimal Conversion',
        definition: 'The model-recommended amount to convert this year under the selected bracket and assumptions.'
    },
    tax_cost: {
        title: 'Tax Cost',
        definition: 'Estimated tax bill caused by the conversion amount.'
    },
    effective_rate: {
        title: 'Effective Rate',
        definition: 'Average tax rate on the conversion amount (tax cost divided by conversion amount), different from marginal rate.'
    },
    lifetime_savings: {
        title: 'Lifetime Savings',
        definition: 'Estimated long-term tax savings from converting now versus deferring and paying tax later.'
    },
    primary_optimal_age: {
        title: 'Primary Optimal Age',
        definition: 'Claiming age that produces the strongest modeled lifetime outcome for the primary person under current assumptions.'
    },
    survivor_income_70: {
        title: 'Survivor Income (70 Strategy)',
        definition: 'Estimated survivor monthly Social Security income when the primary claiming strategy is delayed to age 70.'
    },
    rmd: {
        title: 'RMD (Required Minimum Distribution)',
        definition: 'Mandatory annual withdrawals from certain retirement accounts, typically starting at age 73.'
    },
    qcd: {
        title: 'QCD (Qualified Charitable Distribution)',
        definition: 'A direct IRA-to-charity distribution that can satisfy RMD requirements while reducing taxable income.'
    },
    annual_giving_assumption: {
        title: 'Annual Giving Assumption',
        definition: 'Estimated yearly charitable giving used to model potential QCD strategies.'
    },
    taxable_rmd_after_qcd: {
        title: 'Taxable RMD After QCD',
        definition: 'The portion of required distribution still taxable after applying suggested QCD amounts.'
    },
    state_tax_comparison: {
        title: 'State Tax Comparison',
        definition: 'Side-by-side estimate of annual state income-tax burden by state, based on current profile income assumptions.'
    },
    no_income_tax: {
        title: 'No Income Tax States',
        definition: 'States with no broad wage/salary state income tax. Total tax burden can still include sales/property taxes.'
    },
    low_tax_states: {
        title: 'Low Tax States',
        definition: 'States with comparatively lower estimated income-tax burden under your modeled income.'
    },
    savings_vs_current: {
        title: 'Savings vs Current State',
        definition: 'Difference between estimated state tax in that state and your current state tax estimate.'
    },
    irmaa: {
        title: 'IRMAA',
        definition: 'Income-Related Monthly Adjustment Amount; an added Medicare Part B/D surcharge at higher MAGI levels.'
    },
    healthcare_projection: {
        title: 'Healthcare & Medicare Projection',
        definition: 'A year-by-year estimate of healthcare costs, Medicare premiums, IRMAA surcharges, and HSA offsets under your assumptions.'
    },
    projection_years: {
        title: 'Projection Years',
        definition: 'How many future years are included in the healthcare projection.'
    },
    medical_inflation: {
        title: 'Medical Inflation',
        definition: 'Annual growth assumption for healthcare costs such as premiums, prescriptions, and other medical expenses.'
    },
    estimated_magi: {
        title: 'Estimated MAGI',
        definition: 'Modified Adjusted Gross Income used to estimate IRMAA brackets and Medicare premium surcharges.'
    },
    out_of_pocket: {
        title: 'Out-of-Pocket Costs',
        definition: 'Expected annual medical spending not covered by insurance, including deductibles, copays, and coinsurance.'
    },
    hsa: {
        title: 'HSA (Health Savings Account)',
        definition: 'A tax-advantaged account that can be used for qualified medical expenses.'
    },
    hsa_growth: {
        title: 'HSA Growth',
        definition: 'Annual investment growth assumption applied to remaining HSA balance.'
    },
    medicare: {
        title: 'Medicare',
        definition: 'U.S. federal health insurance program, primarily for people age 65 and older and certain younger people with disabilities.'
    },
    medicare_part_a: {
        title: 'Medicare Part A',
        definition: 'Hospital insurance component of Medicare.'
    },
    medicare_part_b: {
        title: 'Medicare Part B',
        definition: 'Medical insurance for doctor services, outpatient care, and preventive services.'
    },
    medicare_part_d: {
        title: 'Medicare Part D',
        definition: 'Prescription drug coverage component of Medicare.'
    },
    medicare_eligible_people: {
        title: 'Medicare Eligible',
        definition: 'Number of household members currently projected as eligible for Medicare in that year.'
    },
    net_healthcare_cost: {
        title: 'Net Healthcare Cost',
        definition: 'Projected total healthcare cost after subtracting HSA amounts applied in that year.'
    }
};

function glossaryTerm(label, key) {
    return `<button type="button" class="glossary-term" data-glossary-term="${key}" style="background: none; border: none; color: inherit; font: inherit; font-weight: inherit; cursor: pointer; text-decoration: underline dotted; text-underline-offset: 2px; padding: 0;" title="Click for definition">${label}</button>`;
}

function wireGlossaryTermClicks(root) {
    if (!root) return;
    root.querySelectorAll('.glossary-term').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGlossaryDefinition(el.dataset.glossaryTerm);
        });
    });
}

function showGlossaryDefinition(key) {
    const item = TAX_GLOSSARY[key];
    if (!item) return;

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; max-width: 540px; width: 100%; border: 2px solid var(--accent-color);">
                <h3 style="margin: 0 0 10px 0; color: var(--accent-color);">${item.title}</h3>
                <p style="margin: 0; line-height: 1.6; color: var(--text-primary);">${item.definition}</p>
                <div style="margin-top: 16px; text-align: right;">
                    <button id="close-glossary-definition" style="padding: 8px 16px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#close-glossary-definition').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function normalizeRate(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n > 1 ? (n / 100) : n;
}

function formatRatePercent(value, digits = 1) {
    return `${(normalizeRate(value) * 100).toFixed(digits)}%`;
}

export async function renderTaxTab(container) {
    const currentProfile = store.get('currentProfile');

    if (!currentProfile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 10px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Please select a profile to view tax optimization analysis
                </p>
                <button class="csp-nav" data-target="dashboard" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer;">
                    Go to Dashboard
                </button>
            </div>
        `;
        // Wire up CSP-safe navigation
        container.querySelectorAll('.csp-nav').forEach(btn => {
            btn.addEventListener('click', () => window.app.showTab(btn.dataset.target));
        });
        return;
    }

    // Show loading state (uses coordinated spinner system)
    showLoading(container, 'Analyzing tax optimization strategies...');

    try {
        // Fetch comprehensive tax analysis
        const analysisPromise = taxOptimizationAPI.analyzeComprehensive(currentProfile.name);
        const healthcarePromise = taxOptimizationAPI
            .analyzeHealthcarePlanning(currentProfile.name, 20)
            .catch(() => null);

        const [analysis, healthcarePlanning] = await Promise.all([analysisPromise, healthcarePromise]);
        renderTaxAnalysis(container, analysis, currentProfile, healthcarePlanning);
    } catch (error) {
        console.error('Error loading tax analysis:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px; color: var(--danger-color);">⚠️</div>
                <h2 style="margin-bottom: 10px;">Error Loading Tax Analysis</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    ${error.message || 'Could not load tax optimization data'}
                </p>
                <button class="csp-nav" data-target="tax" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
        // Wire up CSP-safe navigation for retry button
        container.querySelectorAll('.csp-nav').forEach(btn => {
            btn.addEventListener('click', () => window.app.showTab(btn.dataset.target));
        });
    }
}

function getSocialSecurityInputs(container) {
    return {
        lifeExpectancy: Number(container.querySelector('#ss-life-expectancy')?.value || 90),
        annualEarnedIncome: Number(container.querySelector('#ss-annual-earned-income')?.value || 0),
        noncoveredPensionAnnual: Number(container.querySelector('#ss-noncovered-pension-annual')?.value || 0),
        applyWep: Boolean(container.querySelector('#ss-apply-wep')?.checked),
        applyGpo: Boolean(container.querySelector('#ss-apply-gpo')?.checked),
    };
}

function getRothConversionInputs(container) {
    return {
        ladderYears: Number(container.querySelector('#roth-ladder-years')?.value || 5),
        ladderGrowthRate: Number(container.querySelector('#roth-ladder-growth')?.value || 5.0) / 100,
        ladderMaxRate: Number(container.querySelector('#roth-ladder-max-rate')?.value || 24.0) / 100,
        ladderIncomeGrowthRate: Number(container.querySelector('#roth-ladder-income-growth')?.value || 2.0) / 100,
        safetyBuffer: Number(container.querySelector('#roth-safety-buffer')?.value || 500),
    };
}

function normalizeSocialSecurityTimingResponse(response) {
    const household = response.household_analysis || { combined_by_claiming_age: [] };
    return {
        available: Boolean(response.primary_analysis || response.spouse_analysis || response.household_analysis),
        primary: response.primary_analysis || null,
        spouse: response.spouse_analysis || null,
        household,
        tax_torpedo: response.tax_torpedo || null,
        adjustments: response.adjustments || null,
    };
}

function renderTaxAnalysis(
    container,
    analysis,
    profile,
    healthcarePlanning = null,
    healthcareInputs = null,
    socialSecurityInputs = null,
    rothInputs = null
) {
    const { snapshot, social_security_analysis, roth_conversion, rmd_analysis, state_comparison, recommendations } = analysis;
    const g = glossaryTerm;
    const effectiveSocialInputs = socialSecurityInputs || {
        lifeExpectancy: 90,
        annualEarnedIncome: social_security_analysis?.adjustments?.annual_earned_income || 0,
        noncoveredPensionAnnual: 0,
        applyWep: false,
        applyGpo: false,
    };
    const effectiveRothInputs = rothInputs || {
        ladderYears: roth_conversion?.conversion_ladder_5y?.years_modeled || 5,
        ladderGrowthRate: normalizeRate(roth_conversion?.conversion_ladder_5y?.annual_growth_assumption, 0.05),
        ladderMaxRate: normalizeRate(roth_conversion?.conversion_ladder_5y?.max_marginal_rate_target, 0.24),
        ladderIncomeGrowthRate: normalizeRate(roth_conversion?.conversion_ladder_5y?.income_growth_assumption, 0.02),
        safetyBuffer: roth_conversion?.precision_recommendations?.[0]?.safe_buffer || 500,
    };

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="margin-bottom: 12px;">
                <h1 style="font-size: var(--font-2xl); margin: 0;">💰 Tax Optimization</h1>
                <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                    Strategic tax planning for <strong>${profile.name}</strong>
                </p>
            </div>

            <!-- Tax Snapshot -->
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                    📊 Current Tax Snapshot
                    <span id="tax-snapshot-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                </h2>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px;">
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Total Tax</div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--danger-color);">
                            ${formatCurrency(snapshot.taxes.total_tax, 0)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Effective Rate</div>
                        <div style="font-size: 16px; font-weight: 700;">
                            ${formatPercent(normalizeRate(snapshot.rates.effective_rate), 1)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Marginal Rate</div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--warning-color);">
                            ${formatPercent(normalizeRate(snapshot.rates.marginal_rate), 0)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Taxable Income</div>
                        <div style="font-size: 16px; font-weight: 700;">
                            ${formatCurrency(snapshot.summary.taxable_income, 0)}
                        </div>
                    </div>
                </div>

                <details style="cursor: pointer;">
                    <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">
                        Tax Breakdown
                    </summary>
                    <div style="padding: 10px; background: var(--bg-primary); border-radius: 6px; margin-top: 6px;">
                        <div style="display: grid; gap: 6px; font-size: 12px;">
                            <div style="display: flex; gap: 8px; align-items: baseline;">
                                <span>Federal Tax:</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.federal_tax, 0)}</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: baseline;">
                                <span>State Tax (${snapshot.settings.state}):</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.state_tax, 0)}</span>
                            </div>
                            ${snapshot.taxes.capital_gains_tax > 0 ? `
                            <div style="display: flex; gap: 8px; align-items: baseline;">
                                <span>Capital Gains Tax:</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.capital_gains_tax, 0)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </details>
            </div>

            ${renderHealthcarePlanningCard(healthcarePlanning, healthcareInputs)}

            <!-- Recommendations -->
            ${recommendations && recommendations.length > 0 ? `
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color);">💡 Top Recommendations</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px;">
                    ${recommendations.slice(0, 3).map((rec, idx) => `
                        <div class="tax-recommendation csp-hover-card" data-rec-index="${idx}" style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;">
                            <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                ${rec.title}
                                <span style="font-size: 11px; opacity: 0.6;">ℹ️</span>
                            </div>
                            <div style="font-size: 11px; color: var(--text-secondary);">
                                ${rec.impact}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 12px;">
                <!-- Left Column: Roth and RMD -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Social Security Analysis -->
                    ${social_security_analysis?.available ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            👥 Social Security Strategy
                            <span id="social-security-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;" title="How long benefits are projected. Longer life expectancy often favors delaying benefits.">
                                ${g('Life Expectancy', 'life_expectancy')}
                                <input id="ss-life-expectancy" type="number" min="70" max="110" value="${effectiveSocialInputs.lifeExpectancy}" title="Projection horizon for claiming strategy comparisons." style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;" title="Expected wages while receiving Social Security. Can reduce benefits before full retirement age.">
                                ${g('Annual Earned Income ($)', 'annual_earned_income')}
                                <input id="ss-annual-earned-income" type="number" min="0" step="1000" value="${effectiveSocialInputs.annualEarnedIncome}" title="Used for earnings-test adjustments in projected benefits." style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;" title="Annual pension from non-Social Security-covered employment.">
                                ${g('Noncovered Pension ($/yr)', 'noncovered_pension')}
                                <input id="ss-noncovered-pension-annual" type="number" min="0" step="1000" value="${effectiveSocialInputs.noncoveredPensionAnnual}" title="Can trigger WEP/GPO reductions depending on eligibility." style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <div style="display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; font-size: 10px;">
                                <label style="display: flex; align-items: center; gap: 6px;" title="WEP may reduce your own Social Security benefit when you also receive a noncovered pension."><input id="ss-apply-wep" type="checkbox" ${effectiveSocialInputs.applyWep ? 'checked' : ''} /> ${g('Apply WEP', 'wep')}</label>
                                <label style="display: flex; align-items: center; gap: 6px;" title="GPO may reduce spousal/survivor benefits by up to two-thirds of a noncovered pension."><input id="ss-apply-gpo" type="checkbox" ${effectiveSocialInputs.applyGpo ? 'checked' : ''} /> ${g('Apply GPO', 'gpo')}</label>
                            </div>
                        </div>
                        <div style="font-size: 10px; opacity: 0.75; margin-bottom: 8px; line-height: 1.4;">
                            Adjust assumptions, then recalculate to compare claiming ages, benefit levels, and survivor income under WEP/GPO scenarios.
                        </div>
                        <div style="margin-bottom: 8px;">
                            <button id="recalc-social-security-projection" title="Re-runs Social Security optimization using the current inputs above." style="padding: 8px 14px; border-radius: 6px; border: 1px solid #444; background: #1f2937; color: #fff; cursor: pointer; font-weight: 600;">Recalculate Social Security</button>
                        </div>
                        ${social_security_analysis.adjustments ? `
                            <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 10px;">
                                <div>WEP PIA: ${formatCurrency(social_security_analysis.adjustments.wep?.pia_before_wep || 0, 0)} → ${formatCurrency(social_security_analysis.adjustments.wep?.pia_after_wep || 0, 0)}</div>
                                <div>GPO Offset (Monthly): ${formatCurrency(social_security_analysis.adjustments.gpo_offset_monthly || 0, 0)}</div>
                                <div>${g('Annual Earned Income', 'annual_earned_income')}: ${formatCurrency(social_security_analysis.adjustments.annual_earned_income || 0, 0)}</div>
                            </div>
                        ` : ''}
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            ${social_security_analysis.primary?.optimal ? `
                                <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; opacity: 0.7;" title="Claiming age that maximizes modeled lifetime benefit for the primary person.">${g('Primary Optimal Age', 'primary_optimal_age')}</div>
                                    <div style="font-size: 16px; font-weight: 700;">${social_security_analysis.primary.optimal.claiming_age}</div>
                                    <div style="font-size: 11px; opacity: 0.85;" title="Estimated monthly benefit at this claiming age.">${formatCurrency(social_security_analysis.primary.optimal.monthly_benefit, 0)}/mo</div>
                                </div>
                            ` : ''}
                            ${social_security_analysis.spouse?.optimal ? `
                                <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; opacity: 0.7;" title="Claiming age that maximizes modeled lifetime benefit for spouse.">Spouse Optimal Age</div>
                                    <div style="font-size: 16px; font-weight: 700;">${social_security_analysis.spouse.optimal.claiming_age}</div>
                                    <div style="font-size: 11px; opacity: 0.85;" title="Estimated spouse monthly benefit at this claiming age.">${formatCurrency(social_security_analysis.spouse.optimal.monthly_benefit, 0)}/mo</div>
                                </div>
                            ` : ''}
                            <div style="background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.35); border-radius: 6px; padding: 8px;">
                                <div style="font-size: 10px; opacity: 0.7;" title="Estimated survivor monthly Social Security income assuming a delay-to-70 strategy.">${g('Survivor Income (70 Strategy)', 'survivor_income_70')}</div>
                                <div style="font-size: 16px; font-weight: 700;">${formatCurrency(social_security_analysis.household.survivor_monthly_estimate_at_70_strategy, 0)}/mo</div>
                            </div>
                        </div>
                        <details style="cursor: pointer;">
                            <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">📊 Combined Benefit by Claiming Age</summary>
                            <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px;">
                                <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.25);">
                                            <th style="padding: 4px 2px; text-align: left;">Claim Age</th>
                                            <th style="padding: 4px 2px; text-align: right;">Combined Monthly</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${social_security_analysis.household.combined_by_claiming_age.map((row) => `
                                            <tr>
                                                <td style="padding: 3px 2px;">${row.claiming_age}</td>
                                                <td style="padding: 3px 2px; text-align: right; font-weight: 700;">${formatCurrency(row.combined_monthly_benefit, 0)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <div style="margin-top: 6px; font-size: 10px; opacity: 0.85;">${social_security_analysis.household.recommendation}</div>
                            </div>
                        </details>
                        ${social_security_analysis.household.top_strategies?.length ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">🏁 Top Claiming Strategies (Primary/Spouse)</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px;">
                                    ${social_security_analysis.household.top_strategies.map((row, idx) => `
                                        <div style="display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; padding: 4px 0; font-size: 10px; align-items: center;">
                                            <span style="opacity: 0.8;">#${idx + 1}</span>
                                            <span>${row.label}</span>
                                            <span style="font-weight: 700;">${formatCurrency(row.combined_lifetime_benefit_with_spousal_floor, 0)} lifetime</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        ` : ''}
                        ${social_security_analysis.household.strategy_matrix?.length ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">⚖️ Spousal Floor vs Independent Comparison</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 10px;">
                                    <div style="margin-bottom: 6px; opacity: 0.85;">${social_security_analysis.household.spousal_floor_model?.description || ''}</div>
                                    ${social_security_analysis.household.strategy_matrix.slice(0, 5).map((row) => `
                                        <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            <strong>${row.label}</strong>:
                                            independent ${formatCurrency(row.combined_monthly_benefit_independent, 0)}/mo,
                                            with floor ${formatCurrency(row.combined_monthly_benefit_with_spousal_floor, 0)}/mo
                                            ${row.spousal_floor_uplift_monthly > 0 ? `(uplift ${formatCurrency(row.spousal_floor_uplift_monthly, 0)}/mo)` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        ` : ''}
                        ${social_security_analysis.household.breakeven_crossovers?.length ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">📍 Breakeven Crossover Ages</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 10px;">
                                    ${social_security_analysis.household.breakeven_crossovers.map((row) => `
                                        <div style="padding: 3px 0;">
                                            ${row.person === 'primary' ? 'Primary' : 'Spouse'}: waiting from age ${row.from_claim_age} to ${row.to_claim_age}
                                            breaks even around age <strong>${row.breakeven_age}</strong>.
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        ` : ''}
                        ${social_security_analysis.tax_torpedo ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">🌊 Tax Torpedo Thresholds</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 10px;">
                                    <div>Provisional Income: <strong>${formatCurrency(social_security_analysis.tax_torpedo.provisional_income, 0)}</strong></div>
                                    <div>Thresholds: ${formatCurrency(social_security_analysis.tax_torpedo.thresholds.first, 0)} / ${formatCurrency(social_security_analysis.tax_torpedo.thresholds.second, 0)}</div>
                                    <div>Band: <strong>${social_security_analysis.tax_torpedo.band.replaceAll('_', ' ')}</strong></div>
                                    <div>Taxable SS: <strong>${social_security_analysis.tax_torpedo.taxable_ss_pct.toFixed(1)}%</strong></div>
                                </div>
                            </details>
                        ` : ''}
                    </div>
                    ` : ''}

                    <!-- Roth Conversion Analysis -->
                    ${roth_conversion ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            🔄 ${g('Roth Conversions', 'roth_conversion')}
                            <span id="roth-conversion-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                ${g('Ladder Years', 'ladder_years')}
                                <input id="roth-ladder-years" type="number" min="1" max="20" value="${effectiveRothInputs.ladderYears}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                ${g('Growth Rate (%)', 'growth_rate')}
                                <input id="roth-ladder-growth" type="number" step="0.1" min="-20" max="30" value="${(effectiveRothInputs.ladderGrowthRate * 100).toFixed(1)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                ${g('Max Marginal Rate (%)', 'max_marginal_rate')}
                                <input id="roth-ladder-max-rate" type="number" step="1" min="10" max="50" value="${(effectiveRothInputs.ladderMaxRate * 100).toFixed(0)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                ${g('Income Growth (%)', 'income_growth')}
                                <input id="roth-ladder-income-growth" type="number" step="0.1" min="-10" max="10" value="${(effectiveRothInputs.ladderIncomeGrowthRate * 100).toFixed(1)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                ${g('Safety Buffer ($)', 'safety_buffer')}
                                <input id="roth-safety-buffer" type="number" step="100" min="0" max="50000" value="${effectiveRothInputs.safetyBuffer}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <button id="recalc-roth-conversion" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #444; background: #1f2937; color: #fff; cursor: pointer; font-weight: 600;">Recalculate Roth Plan</button>
                        </div>

                        ${roth_conversion.optimal_24pct ? `
                            ${roth_conversion.optimal_24pct.conversion_amount > 0 ? `
                                <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${g('Optimal Conversion (24% Bracket)', 'optimal_conversion')}</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #4ade80;">${formatCurrency(roth_conversion.optimal_24pct.conversion_amount, 0)}</div>
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
                                        ${g('Tax Cost', 'tax_cost')}: ${formatCurrency(roth_conversion.optimal_24pct.conversion_tax, 0)}
                                        (${formatRatePercent(roth_conversion.optimal_24pct.effective_rate_on_conversion, 1)} ${g('effective', 'effective_rate')})
                                    </div>
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                                        ${g('Lifetime Savings', 'lifetime_savings')}: ${formatCurrency(roth_conversion.optimal_24pct.lifetime_savings || 0, 0)}
                                    </div>
                                </div>
                            ` : `
                                <div style="background: rgba(251,191,36,0.15); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(251,191,36,0.3);">
                                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 4px;">⚠️ Already in Higher Bracket</div>
                                    <div style="font-size: 11px; opacity: 0.9; line-height: 1.4;">
                                        Your current taxable income is already at or above the 24% tax bracket ceiling.
                                        Converting now would occur at higher marginal rates (32%+).
                                    </div>
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 6px;">
                                        Current Income: ${formatCurrency(roth_conversion.current_taxable_income, 0)}<br>
                                        24% Bracket Ceiling: ${formatCurrency(roth_conversion.optimal_24pct.bracket_ceiling || 0, 0)}
                                    </div>
                                </div>
                            `}
                        ` : ''}

                        <details style="cursor: pointer;" ${roth_conversion.optimal_24pct?.conversion_amount === 0 ? 'open' : ''}>
                            <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">📊 Tax Bracket Space & Scenarios</summary>
                            <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 11px;">
                                <div style="margin-bottom: 8px; font-size: 10px; opacity: 0.8; line-height: 1.5;">
                                    <strong>What is "Tax Bracket Space"?</strong><br>
                                    This shows how much more income you can earn before jumping to the next tax bracket.
                                    The space represents your "room" for conversions or additional income at your current marginal rate.
                                </div>

                                ${roth_conversion.bracket_space.slice(0, 3).map(space => `
                                    <div style="display: flex; justify-content: space-between; padding: 4px 0; background: rgba(255,255,255,0.05); margin: 2px 0; padding: 4px 6px; border-radius: 3px;">
                                        <span style="font-weight: 600;">${space.bracket} Bracket Space:</span>
                                        <span style="font-weight: 700; color: #4ade80;">${formatCurrency(space.space_available, 0)}</span>
                                    </div>
                                `).join('')}

                                <div style="margin-top: 8px; font-size: 10px; opacity: 0.8; line-height: 1.5;">
                                    <strong>How to read this:</strong><br>
                                    • If you have $38k in "32% Space", you can convert up to $38k more at 32% rate before hitting 35%<br>
                                    • The space tells you your "runway" for Roth conversions at each rate
                                </div>

                                ${roth_conversion.scenarios && roth_conversion.scenarios.length > 0 ? `
                                    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                                        <div style="font-weight: 600; margin-bottom: 6px;">💡 Sample Conversion Scenarios:</div>
                                        <div style="margin-bottom: 6px; font-size: 10px; opacity: 0.8; line-height: 1.4;">
                                            These show what you'd pay if you converted different amounts. The marginal rate is your "top bracket" after the conversion.
                                        </div>
                                        ${roth_conversion.scenarios.slice(0, 3).map(scenario => `
                                            <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; background: rgba(255,255,255,0.03); margin: 2px 0; padding: 4px 6px; border-radius: 3px;">
                                                <span>Convert ${formatCurrency(scenario.conversion_amount, 0)}:</span>
                                                <span style="font-weight: 600;">
                                                    Tax ${formatCurrency(scenario.conversion_tax, 0)}
                                                    @ ${scenario.new_marginal_rate ? formatRatePercent(scenario.new_marginal_rate, 0) : 'N/A'} marginal
                                                </span>
                                            </div>
                                        `).join('')}
                                        <div style="margin-top: 6px; font-size: 10px; opacity: 0.8; line-height: 1.4;">
                                            <strong>Effective vs Marginal Rate:</strong><br>
                                            • <strong>Marginal rate</strong> is your highest bracket (what the last dollar pays)<br>
                                            • Your <strong>effective rate</strong> is the average across all brackets<br>
                                            • Example: If you convert $50k and pay $16,359 in tax, that's ${roth_conversion.scenarios[2] ? ((roth_conversion.scenarios[2].conversion_tax / roth_conversion.scenarios[2].conversion_amount) * 100).toFixed(1) : '~32.7'}% effective
                                        </div>
                                    </div>
                                ` : ''}
                                ${roth_conversion.bracket_targets?.length ? `
                                    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                                        <div style="font-weight: 600; margin-bottom: 6px;">🎯 Bracket-Edge Targets</div>
                                        ${roth_conversion.bracket_targets.slice(0, 4).map((target) => `
                                            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 6px; padding: 4px 6px; border-radius: 3px; background: rgba(255,255,255,0.04); margin: 2px 0;">
                                                <span>${target.target_bracket_label} ceiling</span>
                                                <span>Convert ${formatCurrency(target.suggested_conversion, 0)}</span>
                                                <span>Cost ${formatCurrency(target.projected_total_cost, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.precision_recommendations?.length ? `
                                    <div style="margin-top: 10px;">
                                        <div style="font-weight: 600; margin-bottom: 6px;">🧮 Precision Recommendations</div>
                                        ${roth_conversion.precision_recommendations.map((rec) => `
                                            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 6px; padding: 4px 6px; border-radius: 3px; background: rgba(255,255,255,0.03); margin: 2px 0;">
                                                <span>${rec.target_bracket_label} buffer</span>
                                                <span>Convert ${formatCurrency(rec.max_conversion_with_buffer, 0)}</span>
                                                <span>Buffer ${formatCurrency(rec.safe_buffer, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.bracket_headroom_projection?.rows?.length ? `
                                    <div style="margin-top: 10px;">
                                        <div style="font-weight: 600; margin-bottom: 6px;">📈 Bracket Headroom Forecast (${roth_conversion.bracket_headroom_projection.target_rate_label} ceiling)</div>
                                        ${roth_conversion.bracket_headroom_projection.rows.map((row) => `
                                            <div style="display: grid; grid-template-columns: 50px 1fr 1fr; gap: 6px; padding: 4px 6px; border-radius: 3px; background: rgba(255,255,255,0.03); margin: 2px 0;">
                                                <span>Y${row.year}</span>
                                                <span>Income ${formatCurrency(row.taxable_income_assumption, 0)}</span>
                                                <span>Headroom ${formatCurrency(row.headroom_to_target_ceiling, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.annual_safe_conversion_budget?.rows?.length ? `
                                    <div style="margin-top: 10px;">
                                        <div style="font-weight: 600; margin-bottom: 6px;">🗓️ Annual Safe Conversion Budget</div>
                                        <div style="margin-bottom: 4px; opacity: 0.85;">
                                            Total safe budget: ${formatCurrency(roth_conversion.annual_safe_conversion_budget.total_safe_conversion_budget, 0)}
                                        </div>
                                        ${roth_conversion.annual_safe_conversion_budget.rows.map((row) => `
                                            <div style="display: grid; grid-template-columns: 50px 1fr 1fr; gap: 6px; padding: 4px 6px; border-radius: 3px; background: rgba(255,255,255,0.03); margin: 2px 0;">
                                                <span>Y${row.year}</span>
                                                <span>Headroom ${formatCurrency(row.headroom_to_target_ceiling, 0)}</span>
                                                <span>Safe ${formatCurrency(row.safe_conversion_budget, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.front_load_recommendation ? `
                                    <div style="margin-top: 10px; padding: 6px; border-radius: 4px; background: ${roth_conversion.front_load_recommendation.should_front_load ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.12)'}; border: 1px solid ${roth_conversion.front_load_recommendation.should_front_load ? 'rgba(251,191,36,0.35)' : 'rgba(34,197,94,0.35)'};">
                                        <div style="font-weight: 600; margin-bottom: 4px;">⏱️ Front-Load Signal</div>
                                        <div style="font-size: 10px;">${roth_conversion.front_load_recommendation.message}</div>
                                        ${roth_conversion.front_load_recommendation.should_front_load ? `<div style="font-size: 10px; margin-top: 4px;">Budget before crossover: ${formatCurrency(roth_conversion.front_load_recommendation.safe_budget_before_crossover, 0)}</div>` : ''}
                                    </div>
                                ` : ''}
                                ${roth_conversion.conversion_window_summary ? `
                                    <div style="margin-top: 10px; padding: 6px; border-radius: 4px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.35);">
                                        <div style="font-weight: 600; margin-bottom: 4px;">🪟 Conversion Window Summary</div>
                                        <div style="font-size: 10px;">${roth_conversion.conversion_window_summary.summary}</div>
                                        <div style="font-size: 10px; margin-top: 4px;">
                                            Urgency: <strong>${roth_conversion.conversion_window_summary.urgency}</strong>,
                                            Near-term budget: ${formatCurrency(roth_conversion.conversion_window_summary.near_term_safe_budget, 0)}
                                        </div>
                                    </div>
                                ` : ''}
                                ${roth_conversion.conversion_execution_plan?.rows?.length ? `
                                    <div style="margin-top: 10px;">
                                        <div style="font-weight: 600; margin-bottom: 6px;">✅ Execution Plan</div>
                                        <div style="margin-bottom: 4px; opacity: 0.85;">
                                            Planned conversion: ${formatCurrency(roth_conversion.conversion_execution_plan.total_recommended_conversion, 0)}
                                        </div>
                                        ${roth_conversion.conversion_execution_plan.rows.map((row) => `
                                            <div style="display: grid; grid-template-columns: 50px 1fr 1fr; gap: 6px; padding: 4px 6px; border-radius: 3px; background: rgba(255,255,255,0.03); margin: 2px 0;">
                                                <span>Y${row.year}</span>
                                                <span>Convert ${formatCurrency(row.recommended_conversion, 0)}</span>
                                                <span>Remain ${formatCurrency(row.remaining_traditional_balance, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.conversion_tax_timeline?.rows?.length ? `
                                    <div style="margin-top: 10px; padding: 6px; border-radius: 4px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);">
                                        <div style="font-weight: 600; margin-bottom: 4px;">🧾 Conversion Tax Timeline</div>
                                        <div style="font-size: 10px; margin-bottom: 4px;">
                                            Total tax ${formatCurrency(roth_conversion.conversion_tax_timeline.total_conversion_tax, 0)},
                                            Avg/year ${formatCurrency(roth_conversion.conversion_tax_timeline.average_annual_conversion_tax, 0)},
                                            Peak Y${roth_conversion.conversion_tax_timeline.peak_tax_year}
                                        </div>
                                        ${roth_conversion.conversion_tax_timeline.rows.map((row) => `
                                            <div style="display: grid; grid-template-columns: 50px 1fr; gap: 6px; padding: 2px 0; font-size: 10px;">
                                                <span>Y${row.year}</span>
                                                <span>${formatCurrency(row.conversion_tax, 0)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${roth_conversion.conversion_risk_flags?.has_risks ? `
                                    <div style="margin-top: 10px; padding: 6px; border-radius: 4px; background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.35);">
                                        <div style="font-weight: 600; margin-bottom: 4px;">⚠️ Plan Risk Flags</div>
                                        ${roth_conversion.conversion_risk_flags.flags.map((flag) => `
                                            <div style="font-size: 10px; margin: 2px 0;">
                                                [${flag.severity}] ${flag.message}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </details>
                        ${roth_conversion.conversion_ladder_5y?.rows?.length ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">🪜 5-Year Conversion Ladder</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 10px;">
                                    <div style="margin-bottom: 6px; opacity: 0.85;">
                                        Total Converted ${formatCurrency(roth_conversion.conversion_ladder_5y.total_converted, 0)},
                                        Total Cost ${formatCurrency(roth_conversion.conversion_ladder_5y.total_cost, 0)},
                                        Ending Balance ${formatCurrency(roth_conversion.conversion_ladder_5y.ending_balance, 0)}
                                    </div>
                                    ${roth_conversion.conversion_ladder_5y.rows.map((row) => `
                                        <div style="display: grid; grid-template-columns: 36px 1fr 1fr 1fr 1fr; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                                            <span>Y${row.year}</span>
                                            <span>Inc ${formatCurrency(row.taxable_income_assumption, 0)}</span>
                                            <span>Convert ${formatCurrency(row.conversion_amount, 0)}</span>
                                            <span>Tax ${formatCurrency(row.conversion_tax, 0)}</span>
                                            <span>End ${formatCurrency(row.end_balance, 0)}</span>
                                            ${row.no_conversion_reason ? `<span style="grid-column: 2 / span 4; opacity: 0.75;">Note: ${row.no_conversion_reason.replaceAll('_', ' ')}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        ` : ''}
                        ${roth_conversion.ladder_variants?.plans ? `
                            <details style="cursor: pointer; margin-top: 6px;">
                                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">🧭 Strategy Variants (Conservative/Balanced/Aggressive)</summary>
                                <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 10px;">
                                    <div style="margin-bottom: 6px;">
                                        Recommended: <strong>${roth_conversion.ladder_variants.recommended}</strong>
                                    </div>
                                    ${['conservative', 'balanced', 'aggressive'].map((name) => {
                                        const metric = roth_conversion.ladder_variants.metrics?.[name];
                                        if (!metric) return '';
                                        return `
                                            <div style="display: grid; grid-template-columns: 110px 1fr 1fr 1fr; gap: 6px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08); ${roth_conversion.ladder_variants.recommended === name ? 'color:#4ade80;font-weight:700;' : ''}">
                                                <span>${name}</span>
                                                <span>Converted ${formatCurrency(metric.total_converted, 0)}</span>
                                                <span>Cost ${formatCurrency(metric.total_cost, 0)}</span>
                                                <span>End ${formatCurrency(metric.ending_balance, 0)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </details>
                        ` : ''}
                    </div>
                    ` : ''}

                    <!-- RMD Analysis -->
                    ${rmd_analysis ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            📅 ${g('RMD Analysis', 'rmd')}
                            <span id="rmd-analysis-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="font-size: 12px; margin-bottom: 8px;">
                            ${rmd_analysis.current.required
                                ? `Current RMD: <strong>${formatCurrency(rmd_analysis.current.rmd_amount, 0)}</strong>`
                                : `${g('RMDs', 'rmd')} begin in <strong>${rmd_analysis.summary.years_until_rmd} years</strong> (age 73)`}
                        </div>
                        ${rmd_analysis.qcd_planning ? `
                            <div style="background: rgba(34,197,94,0.16); border: 1px solid rgba(34,197,94,0.35); border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
                                <div style="font-weight: 700; margin-bottom: 4px;">${g('QCD Planning', 'qcd')}</div>
                                <div>${g('Annual Giving Assumption', 'annual_giving_assumption')}: <strong>${formatCurrency(rmd_analysis.qcd_planning.annual_charitable_giving_assumption || 0, 0)}</strong></div>
                                <div>Suggested ${g('QCD', 'qcd')} This Year: <strong>${formatCurrency(rmd_analysis.qcd_planning.current_year_suggested_qcd || 0, 0)}</strong></div>
                                <div>${g('Taxable RMD After QCD', 'taxable_rmd_after_qcd')}: <strong>${formatCurrency(rmd_analysis.qcd_planning.current_year_taxable_rmd_after_qcd || 0, 0)}</strong></div>
                            </div>
                        ` : ''}
                        <details style="cursor: pointer;">
                            <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">📊 10-Year Projection</summary>
                            <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px;">
                                ${!rmd_analysis.current.required ? `
                                    <div style="font-size: 10px; opacity: 0.8; margin-bottom: 6px; line-height: 1.4;">
                                        <strong>What is "--"?</strong> No RMD required yet. RMDs start at age 73.
                                        Years 1-${rmd_analysis.summary.years_until_rmd - 1} show "--" (not required).
                                    </div>
                                ` : ''}
                                <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                                    <thead>
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.3); opacity: 0.7;">
                                            <th style="padding: 4px 2px; text-align: left; font-weight: 600;">Year</th>
                                            <th style="padding: 4px 2px; text-align: right; font-weight: 600;">Balance</th>
                                            <th style="padding: 4px 2px; text-align: right; font-weight: 600;">RMD</th>
                                            <th style="padding: 4px 2px; text-align: right; font-weight: 600;">QCD</th>
                                            <th style="padding: 4px 2px; text-align: right; font-weight: 600;">Taxable RMD</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    ${(() => {
                                        // Show years around when RMDs start for better context
                                        const yearsUntilRMD = rmd_analysis.summary.years_until_rmd;
                                        const startYear = Math.max(0, yearsUntilRMD - 2);
                                        const endYear = Math.min(rmd_analysis.projections.length, startYear + 5);
                                        const qcdByYear = {};
                                        (rmd_analysis.qcd_projection || []).forEach((q) => { qcdByYear[q.year] = q; });
                                        return rmd_analysis.projections.slice(startYear, endYear).map(proj => `
                                            <tr style="${proj.rmd_amount > 0 ? 'background: rgba(251,191,36,0.1);' : ''}">
                                                <td style="padding: 3px 2px;">${proj.year}</td>
                                                <td style="padding: 3px 2px; text-align: right;">${formatCompact(proj.start_balance)}</td>
                                                <td style="padding: 3px 2px; text-align: right; font-weight: 700; ${proj.rmd_amount > 0 ? 'color: #fbbf24;' : ''}">${proj.rmd_amount > 0 ? formatCompact(proj.rmd_amount) : '--'}</td>
                                                <td style="padding: 3px 2px; text-align: right;">${qcdByYear[proj.year]?.suggested_qcd > 0 ? formatCompact(qcdByYear[proj.year].suggested_qcd) : '--'}</td>
                                                <td style="padding: 3px 2px; text-align: right;">${qcdByYear[proj.year]?.taxable_rmd_after_qcd > 0 ? formatCompact(qcdByYear[proj.year].taxable_rmd_after_qcd) : (proj.rmd_amount > 0 ? formatCompact(proj.rmd_amount) : '--')}</td>
                                            </tr>
                                        `).join('');
                                    })()}
                                    </tbody>
                                </table>
                                ${rmd_analysis.summary.first_year_rmd && rmd_analysis.summary.first_year_rmd > 0 ? `
                                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 10px; opacity: 0.9;">
                                        <strong>First RMD:</strong> ${formatCurrency(rmd_analysis.summary.first_year_rmd, 0)} in year ${rmd_analysis.summary.years_until_rmd}
                                    </div>
                                ` : ''}
                                ${rmd_analysis.summary.total_projected_qcd ? `
                                    <div style="margin-top: 6px; font-size: 10px; opacity: 0.9;">
                                        <strong>Projected 10+ Year QCD:</strong> ${formatCurrency(rmd_analysis.summary.total_projected_qcd, 0)} (${(rmd_analysis.summary.projected_qcd_reduction_pct || 0).toFixed(1)}% of projected RMDs)
                                    </div>
                                ` : ''}
                            </div>
                        </details>
                    </div>
                    ` : ''}
                </div>

                <!-- Right Column: State Tax -->
                <div>
                    <!-- State Tax Comparison -->
                    ${state_comparison && state_comparison.length > 0 ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333; height: 100%;">
                        <h2 style="font-size: 15px; margin: 0 0 8px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            🗺️ ${g('State Tax Comparison', 'state_tax_comparison')}
                            <span id="state-tax-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <p style="font-size: 10px; opacity: 0.7; margin: 0 0 12px 0; line-height: 1.4;">
                            Your annual tax burden if you lived in each state. Based on your current income.
                        </p>

                        <div style="max-height: 280px; overflow-y: auto; padding-right: 5px;">
                            ${(() => {
                                // Group states by tax level
                                const noTaxStates = state_comparison.filter(s => s.estimated_tax === 0);
                                const lowTaxStates = state_comparison.filter(s => s.estimated_tax > 0 && s.estimated_tax < 15000);
                                const otherStates = state_comparison.filter(s => s.estimated_tax >= 15000);

                                let html = '';

                                // No income tax states
                                if (noTaxStates.length > 0) {
                                    html += `
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ✅ ${g('No Income Tax', 'no_income_tax')}
                                            </div>
                                            ${noTaxStates.slice(0, 9).map(state => `
                                                <div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; margin: 2px 0; background: rgba(34,197,94,0.1); border-radius: 4px; border-left: 3px solid #22c55e;">
                                                    <span style="font-size: 13px; font-weight: 700;">${state.state}</span>
                                                    <span style="font-size: 11px; color: #22c55e; font-weight: 600;">$0 tax</span>
                                                    <span style="font-size: 10px; background: rgba(34,197,94,0.2); padding: 2px 6px; border-radius: 3px; font-weight: 600;">
                                                        💰 ${g('Save', 'savings_vs_current')} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
                                                    </span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `;
                                }

                                // Low tax states
                                if (lowTaxStates.length > 0) {
                                    html += `
                                        <div style="margin-bottom: 12px;">
                                            <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                💚 ${g('Low Tax States', 'low_tax_states')}
                                            </div>
                                            ${lowTaxStates.slice(0, 6).map(state => `
                                                <div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; margin: 2px 0; background: rgba(234,179,8,0.1); border-radius: 4px; border-left: 3px solid #eab308;">
                                                    <span style="font-size: 13px; font-weight: 700;">${state.state}</span>
                                                    <span style="font-size: 11px; color: #eab308; font-weight: 600;">${formatCurrency(state.estimated_tax, 0)} tax</span>
                                                    <span style="font-size: 10px; background: rgba(234,179,8,0.2); padding: 2px 6px; border-radius: 3px; font-weight: 600;">
                                                        ${state.savings_vs_current >= 0 ? `💰 ${g('Save', 'savings_vs_current')}` : '💸 Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
                                                    </span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `;
                                }

                                // Other states
                                if (otherStates.length > 0) {
                                    html += `
                                        <div>
                                            <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                📊 Other States
                                            </div>
                                            ${otherStates.slice(0, 8).map(state => `
                                                <div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; margin: 2px 0; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid rgba(255,255,255,0.3);">
                                                    <span style="font-size: 13px; font-weight: 700;">${state.state}</span>
                                                    <span style="font-size: 11px; opacity: 0.9; font-weight: 600;">${formatCurrency(state.estimated_tax, 0)} tax</span>
                                                    <span style="font-size: 10px; background: ${state.savings_vs_current >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${state.savings_vs_current >= 0 ? '#22c55e' : '#ef4444'}; padding: 2px 6px; border-radius: 3px; font-weight: 600;">
                                                        ${state.savings_vs_current >= 0 ? '💰' : '💸'} ${state.savings_vs_current >= 0 ? g('Save', 'savings_vs_current') : 'Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
                                                    </span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `;
                                }

                                return html;
                            })()}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Add event listener for tax snapshot info
    const infoIcon = container.querySelector('#tax-snapshot-info');
    if (infoIcon) {
        infoIcon.addEventListener('click', () => {
            showTaxSnapshotExplanation();
        });
    }

    // Add event listener for Social Security Strategy info
    const socialSecurityInfoIcon = container.querySelector('#social-security-info');
    if (socialSecurityInfoIcon) {
        socialSecurityInfoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showSocialSecurityStrategyExplanation();
        });
    }

    // Add event listeners for recommendation cards
    const recCards = container.querySelectorAll('.tax-recommendation');
    recCards.forEach((card, idx) => {
        card.addEventListener('click', () => {
            if (recommendations && recommendations[idx]) {
                showRecommendationDetail(recommendations[idx]);
            }
        });
    });

    // Add event listener for Roth Conversion info
    const rothInfoIcon = container.querySelector('#roth-conversion-info');
    if (rothInfoIcon) {
        rothInfoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showRothConversionExplanation();
        });
    }

    // Add event listener for RMD Analysis info
    const rmdInfoIcon = container.querySelector('#rmd-analysis-info');
    if (rmdInfoIcon) {
        rmdInfoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showRMDAnalysisExplanation();
        });
    }

    // Add event listener for State Tax Comparison info
    const stateTaxInfoIcon = container.querySelector('#state-tax-info');
    if (stateTaxInfoIcon) {
        stateTaxInfoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showStateTaxComparisonExplanation();
        });
    }

    // Add event listener for Healthcare & Medicare Projection info
    const healthcareInfoIcon = container.querySelector('#healthcare-projection-info');
    if (healthcareInfoIcon) {
        healthcareInfoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            showHealthcareProjectionExplanation();
        });
    }

    // CSP-safe hover: opacity toggle for info icons
    container.querySelectorAll('.csp-hover-opacity').forEach(el => {
        el.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
        el.addEventListener('mouseleave', () => { el.style.opacity = '0.7'; });
    });
    wireGlossaryTermClicks(container);

    // CSP-safe hover: card lift effect for recommendation cards
    container.querySelectorAll('.csp-hover-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.style.borderColor = 'var(--accent-color)';
            el.style.transform = 'translateY(-2px)';
        });
        el.addEventListener('mouseleave', () => {
            el.style.borderColor = 'var(--border-color)';
            el.style.transform = 'translateY(0)';
        });
    });

    // Social Security controls
    const recalcSocialSecurityBtn = container.querySelector('#recalc-social-security-projection');
    if (recalcSocialSecurityBtn) {
        recalcSocialSecurityBtn.addEventListener('click', async () => {
            const currentSocialInputs = getSocialSecurityInputs(container);
            const rothInputsSnapshot = getRothConversionInputs(container);
            recalcSocialSecurityBtn.disabled = true;
            recalcSocialSecurityBtn.textContent = 'Recalculating...';
            try {
                const timing = await taxOptimizationAPI.analyzeSocialSecurity(
                    profile.name,
                    currentSocialInputs.lifeExpectancy,
                    null,
                    currentSocialInputs
                );
                analysis.social_security_analysis = normalizeSocialSecurityTimingResponse(timing);
                renderTaxAnalysis(
                    container,
                    analysis,
                    profile,
                    healthcarePlanning,
                    healthcareInputs,
                    currentSocialInputs,
                    rothInputsSnapshot
                );
            } catch (error) {
                showError(`Social Security update failed: ${error.message}`);
                recalcSocialSecurityBtn.disabled = false;
                recalcSocialSecurityBtn.textContent = 'Recalculate Social Security';
            }
        });
    }

    // Roth conversion controls
    const recalcRothBtn = container.querySelector('#recalc-roth-conversion');
    if (recalcRothBtn) {
        recalcRothBtn.addEventListener('click', async () => {
            const currentRothInputs = getRothConversionInputs(container);
            const socialInputsSnapshot = getSocialSecurityInputs(container);
            recalcRothBtn.disabled = true;
            recalcRothBtn.textContent = 'Recalculating...';
            try {
                const rothResult = await taxOptimizationAPI.analyzeRothConversion(
                    profile.name,
                    null,
                    null,
                    null,
                    currentRothInputs
                );
                analysis.roth_conversion = rothResult;
                renderTaxAnalysis(
                    container,
                    analysis,
                    profile,
                    healthcarePlanning,
                    healthcareInputs,
                    socialInputsSnapshot,
                    currentRothInputs
                );
            } catch (error) {
                showError(`Roth conversion update failed: ${error.message}`);
                recalcRothBtn.disabled = false;
                recalcRothBtn.textContent = 'Recalculate Roth Plan';
            }
        });
    }

    // Healthcare projection controls
    const recalcHealthcareBtn = container.querySelector('#recalc-healthcare-projection');
    if (recalcHealthcareBtn) {
        recalcHealthcareBtn.addEventListener('click', async () => {
            const socialInputsSnapshot = getSocialSecurityInputs(container);
            const rothInputsSnapshot = getRothConversionInputs(container);
            const years = Number(container.querySelector('#healthcare-years')?.value || 20);
            const medicalInflationPct = Number(container.querySelector('#healthcare-medical-inflation')?.value || 5.5);
            const incomeGrowthPct = Number(container.querySelector('#healthcare-income-growth')?.value || 2.0);
            const estimatedMagiRaw = container.querySelector('#healthcare-estimated-magi')?.value ?? '';
            const annualOutOfPocketRaw = container.querySelector('#healthcare-annual-oop')?.value ?? '';
            const initialHsaBalanceRaw = container.querySelector('#healthcare-hsa-balance')?.value ?? '';
            const annualHsaContributionRaw = container.querySelector('#healthcare-hsa-contribution')?.value ?? '';
            const hsaGrowthPct = Number(container.querySelector('#healthcare-hsa-growth')?.value || 4.0);

            recalcHealthcareBtn.disabled = true;
            recalcHealthcareBtn.textContent = 'Recalculating...';
            try {
                const updatedHealthcare = await taxOptimizationAPI.analyzeHealthcarePlanning(
                    profile.name,
                    years,
                    {
                        medicalInflation: medicalInflationPct / 100,
                        incomeGrowth: incomeGrowthPct / 100,
                        estimatedMagi: estimatedMagiRaw.trim() === '' ? null : Number(estimatedMagiRaw),
                        annualOutOfPocket: annualOutOfPocketRaw.trim() === '' ? null : Number(annualOutOfPocketRaw),
                        initialHsaBalance: initialHsaBalanceRaw.trim() === '' ? null : Number(initialHsaBalanceRaw),
                        annualHsaContribution: annualHsaContributionRaw.trim() === '' ? null : Number(annualHsaContributionRaw),
                        hsaGrowth: hsaGrowthPct / 100,
                    }
                );
                renderTaxAnalysis(container, analysis, profile, updatedHealthcare, {
                    years,
                    medicalInflationPct,
                    incomeGrowthPct,
                    estimatedMagi: estimatedMagiRaw,
                    annualOutOfPocket: annualOutOfPocketRaw,
                    initialHsaBalance: initialHsaBalanceRaw,
                    annualHsaContribution: annualHsaContributionRaw,
                    hsaGrowthPct,
                }, socialInputsSnapshot, rothInputsSnapshot);
            } catch (error) {
                showError(`Healthcare projection update failed: ${error.message}`);
                recalcHealthcareBtn.disabled = false;
                recalcHealthcareBtn.textContent = 'Recalculate';
            }
        });
    }
}

function renderHealthcarePlanningCard(healthcarePlanning, healthcareInputs = null) {
    if (!healthcarePlanning || !Array.isArray(healthcarePlanning.projection) || healthcarePlanning.projection.length === 0) {
        return '';
    }

    const rows = healthcarePlanning.projection;
    const firstYear = rows[0];
    const fiveYear = rows[Math.min(4, rows.length - 1)];
    const tenYear = rows[Math.min(9, rows.length - 1)];
    const g = glossaryTerm;

    const defaults = healthcareInputs || {
        years: healthcarePlanning.assumptions?.projection_years || 20,
        medicalInflationPct: Number((healthcarePlanning.assumptions?.medical_inflation || 0.055) * 100).toFixed(1),
        incomeGrowthPct: Number((healthcarePlanning.assumptions?.income_growth || 0.02) * 100).toFixed(1),
        estimatedMagi: '',
        annualOutOfPocket: '',
        initialHsaBalance: healthcarePlanning.assumptions?.initial_hsa_balance ?? '',
        annualHsaContribution: healthcarePlanning.assumptions?.annual_hsa_contribution ?? '',
        hsaGrowthPct: Number((healthcarePlanning.assumptions?.hsa_growth || 0.04) * 100).toFixed(1),
    };

    return `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
            <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                🏥 ${g('Healthcare & Medicare Projection', 'healthcare_projection')}
                <span id="healthcare-projection-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
            </h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-bottom: 10px;">
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Years', 'projection_years')}
                    <input id="healthcare-years" type="number" min="1" max="40" value="${defaults.years}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Medical Inflation (%)', 'medical_inflation')}
                    <input id="healthcare-medical-inflation" type="number" step="0.1" min="-10" max="25" value="${defaults.medicalInflationPct}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Income Growth (%)', 'income_growth')}
                    <input id="healthcare-income-growth" type="number" step="0.1" min="-10" max="25" value="${defaults.incomeGrowthPct}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('MAGI Override ($)', 'estimated_magi')}
                    <input id="healthcare-estimated-magi" type="number" min="0" step="1000" value="${defaults.estimatedMagi}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Out-of-Pocket Override ($)', 'out_of_pocket')}
                    <input id="healthcare-annual-oop" type="number" min="0" step="500" value="${defaults.annualOutOfPocket}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Initial HSA Balance ($)', 'hsa')}
                    <input id="healthcare-hsa-balance" type="number" min="0" step="500" value="${defaults.initialHsaBalance}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('Annual HSA Contribution ($)', 'hsa')}
                    <input id="healthcare-hsa-contribution" type="number" min="0" step="250" value="${defaults.annualHsaContribution}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    ${g('HSA Growth (%)', 'hsa_growth')}
                    <input id="healthcare-hsa-growth" type="number" step="0.1" min="-10" max="25" value="${defaults.hsaGrowthPct}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
            </div>
            <div style="margin-bottom: 12px;">
                <button id="recalc-healthcare-projection" style="padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--accent-color); color: var(--text-on-accent); cursor: pointer; font-weight: 600;">
                    Recalculate
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px;">
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Year ${firstYear.year}</div>
                    <div style="font-size: 16px; font-weight: 700;">${formatCurrency(firstYear.total_healthcare_cost, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Year ${fiveYear.year}</div>
                    <div style="font-size: 16px; font-weight: 700;">${formatCurrency(fiveYear.total_healthcare_cost, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Year ${tenYear.year}</div>
                    <div style="font-size: 16px; font-weight: 700;">${formatCurrency(tenYear.total_healthcare_cost, 0)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Medical Inflation Assumption</div>
                    <div style="font-size: 16px; font-weight: 700;">${formatPercent(healthcarePlanning.assumptions.medical_inflation, 1)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Projected Ending HSA</div>
                    <div style="font-size: 16px; font-weight: 700;">${formatCurrency(rows[rows.length - 1].remaining_hsa_balance || 0, 0)}</div>
                </div>
            </div>
            <details style="cursor: pointer;">
                <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">
                    ${g('Medicare', 'medicare')}/${g('IRMAA', 'irmaa')} Cost Breakdown (First 5 Years)
                </summary>
                <div style="padding: 10px; background: var(--bg-primary); border-radius: 6px; margin-top: 6px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 4px;">Year</th>
                                <th style="padding: 4px;">${g('Eligible', 'medicare_eligible_people')}</th>
                                <th style="padding: 4px;">${g('Part A', 'medicare_part_a')}</th>
                                <th style="padding: 4px;">${g('Part B', 'medicare_part_b')}</th>
                                <th style="padding: 4px;">${g('Part D', 'medicare_part_d')}</th>
                                <th style="padding: 4px;">${g('IRMAA', 'irmaa')}</th>
                                <th style="padding: 4px;">${g('Out-of-Pocket', 'out_of_pocket')}</th>
                                <th style="padding: 4px;">${g('HSA Used', 'hsa')}</th>
                                <th style="padding: 4px;">${g('Net Cost', 'net_healthcare_cost')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.slice(0, 5).map((row) => `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 4px;">${row.year}</td>
                                    <td style="padding: 4px;">${row.medicare_eligible_people}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.medicare_part_a, 0)}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.medicare_part_b, 0)}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.medicare_part_d, 0)}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.irmaa_surcharge, 0)}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.out_of_pocket, 0)}</td>
                                    <td style="padding: 4px;">${formatCurrency(row.hsa_applied || 0, 0)}</td>
                                    <td style="padding: 4px; font-weight: 700;">${formatCurrency(row.net_healthcare_cost || row.total_healthcare_cost, 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    `;
}

function showHealthcareProjectionExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                    🏥 Understanding ${glossaryTerm('Healthcare & Medicare Projection', 'healthcare_projection')}
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        This section estimates annual healthcare costs across your projection horizon, including ${glossaryTerm('Medicare', 'medicare')} premiums, ${glossaryTerm('IRMAA', 'irmaa')} surcharges, out-of-pocket spending, and the effect of ${glossaryTerm('HSA', 'hsa')} balances.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--accent-color);">Inputs You Control</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>${glossaryTerm('Projection Years', 'projection_years')} and ${glossaryTerm('Medical Inflation', 'medical_inflation')} drive long-range growth in costs.</li>
                            <li>${glossaryTerm('Estimated MAGI', 'estimated_magi')} can change projected ${glossaryTerm('IRMAA', 'irmaa')} surcharges.</li>
                            <li>${glossaryTerm('Out-of-Pocket Costs', 'out_of_pocket')} override lets you model higher/lower recurring medical spend.</li>
                            <li>${glossaryTerm('HSA', 'hsa')} balance, contribution, and ${glossaryTerm('HSA Growth', 'hsa_growth')} control how much healthcare spend can be offset tax-efficiently.</li>
                        </ul>
                    </div>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--success-color);">How To Read The Table</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>${glossaryTerm('Part A', 'medicare_part_a')}, ${glossaryTerm('Part B', 'medicare_part_b')}, and ${glossaryTerm('Part D', 'medicare_part_d')} show projected Medicare premium components.</li>
                            <li>${glossaryTerm('Eligible', 'medicare_eligible_people')} shows how many household members are projected on Medicare each year.</li>
                            <li>${glossaryTerm('Net Cost', 'net_healthcare_cost')} reflects projected healthcare cost after HSA dollars applied in that year.</li>
                        </ul>
                    </div>

                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; border-left: 3px solid var(--info-color);">
                        <strong>Tip:</strong> Re-run this section with conservative assumptions (higher medical inflation and lower HSA growth) to stress-test retirement cash flow.
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-healthcare-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);
    modal.querySelector('#close-healthcare-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

/**
 * Show explanation modal for Current Tax Snapshot
 */
function showTaxSnapshotExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                    📊 Understanding Your Tax Snapshot
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        The <strong>Current Tax Snapshot</strong> shows your estimated federal tax situation based on your current profile data, including income, deductions, and filing status.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--accent-color);">Key Metrics Explained:</h3>

                        <div style="margin-bottom: 12px;">
                            <strong style="color: var(--danger-color);">Total Tax</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The total federal income tax you'll owe for the current tax year. This includes income tax on wages, investment income, and other taxable sources.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong style="color: var(--success-color);">Effective Rate</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Your actual tax rate - calculated as (Total Tax ÷ Total Income). This shows what percentage of your total income goes to federal taxes.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong style="color: var(--warning-color);">Marginal Rate</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The tax rate on your next dollar of income. This is your current tax bracket and tells you how much tax you'd pay on additional income.</span>
                        </div>

                        <div>
                            <strong style="color: var(--info-color);">Taxable Income</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Your income after subtracting the standard deduction or itemized deductions. This is the amount used to calculate your actual tax.</span>
                        </div>
                    </div>

                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 3px solid var(--info-color);">
                        <strong>💡 Why This Matters:</strong><br>
                        <span style="font-size: 13px;">Understanding these metrics helps you make smart financial decisions, optimize Roth conversions, plan withdrawals strategically, and minimize your lifetime tax burden.</span>
                    </div>

                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                        <strong>Note:</strong> These calculations are estimates based on 2024 federal tax brackets. For precise tax advice, consult a tax professional.
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-tax-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);

    // Close on button click
    modal.querySelector('#close-tax-explanation').addEventListener('click', () => {
        modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Show detailed explanation modal for a tax recommendation
 */
function showRecommendationDetail(recommendation) {
    // Generate detailed content based on recommendation type
    let detailedContent = '';
    const title = recommendation.title || '';

    if (title.includes('State Tax Relocation') || title.includes('State Tax')) {
        detailedContent = `
            <h3 style="color: var(--accent-color); margin: 0 0 12px 0; font-size: 16px;">🏡 State Tax Relocation Strategy</h3>

            <p style="margin: 0 0 16px 0; line-height: 1.6;">
                <strong>Why Consider Relocating?</strong><br>
                State income taxes can represent a significant portion of your lifetime tax burden, especially in high-tax states. Some states have no income tax at all, while others charge rates exceeding 10%.
            </p>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="color: var(--success-color);">No Income Tax States:</strong>
                <div style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">
                    Alaska, Florida, Nevada, South Dakota, Tennessee, Texas, Washington, Wyoming, New Hampshire (limited)
                </div>
            </div>

            <div style="background: var(--warning-bg); color: var(--warning-text); padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--warning-color);">
                <strong>⚠️ Important Considerations:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                    <li>Property taxes may be higher in no-income-tax states</li>
                    <li>Sales taxes and other fees can offset some savings</li>
                    <li>Consider cost of living, healthcare access, and quality of life</li>
                    <li>Establish residency properly to avoid dual-state taxation</li>
                </ul>
            </div>

            <p style="margin: 0; line-height: 1.6;">
                <strong>Typical Savings:</strong> Moving from a high-tax state to a no-tax state can save $10,000-$50,000+ annually depending on your income level, potentially adding hundreds of thousands to your retirement nest egg over time.
            </p>
        `;
    } else if (title.includes('Marginal Rate') || title.includes('High Marginal')) {
        detailedContent = `
            <h3 style="color: var(--accent-color); margin: 0 0 12px 0; font-size: 16px;">📊 High Marginal Tax Rate Alert</h3>

            <p style="margin: 0 0 16px 0; line-height: 1.6;">
                <strong>What This Means:</strong><br>
                Your marginal tax rate is the percentage of tax you pay on your next dollar of income. A high marginal rate means a significant portion of additional income goes to taxes.
            </p>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="color: var(--warning-color);">Strategies to Manage High Marginal Rates:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                    <li><strong>Income Timing:</strong> Defer income to future years when you may be in a lower bracket</li>
                    <li><strong>Tax-Deferred Contributions:</strong> Max out 401(k), traditional IRA, HSA contributions</li>
                    <li><strong>Tax-Loss Harvesting:</strong> Offset capital gains with capital losses</li>
                    <li><strong>Qualified Business Income Deduction:</strong> If self-employed, take advantage of the 20% QBI deduction</li>
                    <li><strong>Charitable Giving:</strong> Donate appreciated assets directly to charity</li>
                </ul>
            </div>

            <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 3px solid var(--info-color);">
                <strong>💡 Pro Tip:</strong><br>
                <span style="font-size: 13px;">Consider Roth conversions in years when your income is temporarily lower (between jobs, early retirement, etc.) to lock in lower tax rates on future growth.</span>
            </div>

            <p style="margin: 0; line-height: 1.6;">
                <strong>Impact:</strong> Strategic income timing and deductions can reduce your marginal rate by one or more tax brackets, saving thousands of dollars annually.
            </p>
        `;
    } else if (title.includes('Roth Conversion')) {
        detailedContent = `
            <h3 style="color: var(--accent-color); margin: 0 0 12px 0; font-size: 16px;">🔄 Roth Conversion Opportunity</h3>

            <p style="margin: 0 0 16px 0; line-height: 1.6;">
                <strong>What is a Roth Conversion?</strong><br>
                A Roth conversion is the process of moving money from a traditional IRA or 401(k) to a Roth IRA. You pay taxes on the converted amount now, but all future growth and withdrawals are tax-free.
            </p>

            <div style="background: var(--success-bg); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--success-color);">
                <strong style="color: var(--success-color);">Benefits of Roth Conversions:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                    <li>Tax-free growth for life</li>
                    <li>Tax-free withdrawals in retirement</li>
                    <li>No Required Minimum Distributions (RMDs)</li>
                    <li>Can pass tax-free to heirs</li>
                    <li>Hedge against future tax rate increases</li>
                </ul>
            </div>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong>Optimal Conversion Timing:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                    <li><strong>Low-income years:</strong> Between jobs, early retirement, business loss years</li>
                    <li><strong>Before RMDs start:</strong> Age 60-73, before forced withdrawals begin</li>
                    <li><strong>Market downturns:</strong> Convert when account values are temporarily depressed</li>
                    <li><strong>Stay in current bracket:</strong> Convert up to the top of your current tax bracket to avoid jumping to a higher rate</li>
                </ul>
            </div>

            <div style="background: var(--warning-bg); color: var(--warning-text); padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--warning-color);">
                <strong>⚠️ Watch Out For:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                    <li>IRMAA Medicare surcharges (if over 65)</li>
                    <li>ACA subsidy impacts (if under 65 and on marketplace)</li>
                    <li>Pushing into a higher tax bracket</li>
                    <li>State taxes on the conversion</li>
                </ul>
            </div>

            <p style="margin: 0; line-height: 1.6;">
                <strong>Strategy:</strong> Consider converting $20,000-$50,000 annually over multiple years to "fill up" your current tax bracket without jumping to a higher one. This can save tens of thousands in taxes over your lifetime.
            </p>
        `;
    } else {
        // Generic explanation for other recommendation types
        detailedContent = `
            <h3 style="color: var(--accent-color); margin: 0 0 12px 0; font-size: 16px;">${recommendation.title}</h3>

            <p style="margin: 0 0 16px 0; line-height: 1.6;">
                <strong>Impact:</strong><br>
                ${recommendation.impact}
            </p>

            ${recommendation.description ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <strong>Details:</strong><br>
                <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.6;">${recommendation.description}</p>
            </div>
            ` : ''}

            ${recommendation.action ? `
            <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; border-left: 3px solid var(--info-color);">
                <strong>💡 Recommended Action:</strong><br>
                <p style="margin: 8px 0 0 0; font-size: 13px;">${recommendation.action}</p>
            </div>
            ` : ''}
        `;
    }

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                ${detailedContent}

                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">
                    <strong>Note:</strong> This is general guidance. Consult with a tax professional or financial advisor to determine the best strategy for your specific situation.
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-recommendation-detail" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);

    // Close on button click
    modal.querySelector('#close-recommendation-detail').addEventListener('click', () => {
        modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Show explanation modal for Roth Conversions
 */
function showRothConversionExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color);">
                    🔄 Understanding Roth Conversions
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        A <strong>Roth conversion</strong> moves money from a traditional IRA or 401(k) into a Roth IRA. You pay taxes on the converted amount now, but all future growth and withdrawals are tax-free forever.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--success-color);">📊 What the Numbers Mean:</h3>

                        <div style="margin-bottom: 12px;">
                            <strong>Optimal Conversion Amount:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The recommended amount to convert this year to maximize tax efficiency. This amount "fills up" your current tax bracket without pushing you into a higher one. If you see "Already in Higher Bracket", you're above the 24% ceiling, and conversions would occur at 32%+ rates.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong>Conversion Tax Cost:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The federal tax you'll pay on the conversion. This is due when you file your tax return for the conversion year. You need cash on hand to pay this - don't use your IRA funds!</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong>Tax Bracket Space:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Shows how much more income you can earn before moving to the next tax bracket. For example, "32% Space: $38,030" means you can convert up to $38k more at the 32% marginal rate before hitting 35%. This is your "runway" for conversions.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong>Sample Conversion Scenarios:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Shows what you'd pay if you converted different amounts. The "marginal rate" is your top tax bracket after conversion. The actual tax you pay (effective rate) is usually lower because of our progressive tax system.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong>Marginal vs ${glossaryTerm('Effective Rate', 'effective_rate')}:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);"><strong>Marginal</strong> = highest bracket you're in (what the last dollar pays). <strong>Effective</strong> = average rate across all brackets. Example: In 32% bracket but paying 27% effective because lower dollars taxed at 10%, 12%, 22%, 24%.</span>
                        </div>

                        <div>
                            <strong>Lifetime Savings:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The estimated total tax savings over your lifetime from converting at today's tax rates versus paying taxes on traditional IRA withdrawals later at potentially higher rates (due to RMDs, tax law changes, or bracket creep).</span>
                        </div>
                    </div>

                    <div style="background: var(--success-bg); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--success-color);">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--success-color);">✅ Why Convert?</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>Lock in today's tax rates (hedge against future increases)</li>
                            <li>Tax-free growth for life - no taxes on gains ever again</li>
                            <li>No Required Minimum Distributions (RMDs) - more flexibility</li>
                            <li>Pass tax-free assets to heirs</li>
                            <li>Reduce future RMDs that could push you into higher brackets</li>
                        </ul>
                    </div>

                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 3px solid var(--info-color);">
                        <strong>💡 Strategy:</strong><br>
                        <span style="font-size: 13px;">Consider converting gradually over multiple years during low-income periods (early retirement, between jobs, market downturns) to stay in lower tax brackets.</span>
                    </div>

                    <div style="background: var(--warning-bg); color: var(--warning-text); padding: 12px; border-radius: 6px; border: 1px solid var(--warning-color);">
                        <strong>⚠️ Important Considerations:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                            <li>Must have cash on hand to pay the conversion tax</li>
                            <li>Can trigger Medicare IRMAA surcharges if over 65</li>
                            <li>State taxes may apply on top of federal</li>
                        </ul>
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-roth-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);
    modal.querySelector('#close-roth-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

/**
 * Show explanation modal for Social Security Strategy
 */
function showSocialSecurityStrategyExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color);">
                    👥 Understanding Social Security Strategy
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        This section compares claiming-age outcomes and survivor-income tradeoffs under your assumptions.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--accent-color);">Inputs:</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>${glossaryTerm('Life Expectancy', 'life_expectancy')}</li>
                            <li>${glossaryTerm('Annual Earned Income', 'annual_earned_income')}</li>
                            <li>${glossaryTerm('Noncovered Pension', 'noncovered_pension')}</li>
                            <li>${glossaryTerm('WEP', 'wep')} / ${glossaryTerm('GPO', 'gpo')}</li>
                        </ul>
                    </div>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--success-color);">Outputs:</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>${glossaryTerm('Primary Optimal Age', 'primary_optimal_age')}: Claiming age with strongest modeled lifetime outcome for primary.</li>
                            <li>${glossaryTerm('Survivor Income (70 Strategy)', 'survivor_income_70')}: Estimated survivor monthly benefit when delay-to-70 assumptions are applied.</li>
                        </ul>
                    </div>

                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; border-left: 3px solid var(--info-color);">
                        <strong>Tip:</strong> Run multiple scenarios (with and without ${glossaryTerm('WEP', 'wep')}/${glossaryTerm('GPO', 'gpo')}) before final claiming decisions.
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-ss-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);
    modal.querySelector('#close-ss-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

/**
 * Show explanation modal for RMD Analysis
 */
function showRMDAnalysisExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color);">
                    📅 Understanding Required Minimum Distributions (RMDs)
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        <strong>${glossaryTerm('Required Minimum Distributions (RMDs)', 'rmd')}</strong> are mandatory annual withdrawals from traditional IRAs and 401(k)s that the IRS requires starting at age 73.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--warning-color);">📊 What the Numbers Mean:</h3>

                        <div style="margin-bottom: 12px;">
                            <strong>Current RMD:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">The minimum amount you must withdraw this year. 25% penalty if you miss it.</span>
                        </div>

                        <div style="margin-bottom: 12px;">
                            <strong>Years Until RMD:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Your window for tax-efficient strategies like Roth conversions.</span>
                        </div>

                        <div>
                            <strong>First/Future RMDs:</strong><br>
                            <span style="font-size: 13px; color: var(--text-secondary);">Projected required withdrawals showing future tax obligations.</span>
                        </div>
                    </div>

                    <div style="background: var(--warning-bg); color: var(--warning-text); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--warning-color);">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px;">⚠️ Why RMDs Matter:</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>Forced taxable income can push you into higher brackets</li>
                            <li>Can trigger Medicare ${glossaryTerm('IRMAA', 'irmaa')} surcharges</li>
                            <li>May make more Social Security taxable</li>
                            <li>Forced to sell regardless of market conditions</li>
                        </ul>
                    </div>

                    <div style="background: var(--success-bg); padding: 12px; border-radius: 6px; border: 1px solid var(--success-color);">
                        <strong style="color: var(--success-color);">💡 Strategies:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                            <li>Roth conversions before age 73 to reduce future RMDs</li>
                            <li>${glossaryTerm('QCDs', 'qcd')}: Donate RMDs to charity tax-free (age 70½+)</li>
                            <li>Strategic withdrawals before 73 to smooth tax burden</li>
                        </ul>
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-rmd-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);
    modal.querySelector('#close-rmd-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showStateTaxComparisonExplanation() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid var(--accent-color);">
                <h2 style="margin: 0 0 16px 0; color: var(--accent-color);">
                    🗺️ Understanding ${glossaryTerm('State Tax Comparison', 'state_tax_comparison')}
                </h2>

                <div style="color: var(--text-primary); line-height: 1.6;">
                    <p style="margin: 0 0 16px 0;">
                        This compares estimated annual state income tax if you lived in different states, using your current modeled income.
                    </p>

                    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--success-color);">How To Read It</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>${glossaryTerm('No Income Tax States', 'no_income_tax')} show states where estimated wage/salary income tax is $0.</li>
                            <li>${glossaryTerm('Low Tax States', 'low_tax_states')} show comparatively lower estimated tax outcomes.</li>
                            <li>${glossaryTerm('Savings vs Current State', 'savings_vs_current')} is your modeled difference versus your current state.</li>
                        </ul>
                    </div>

                    <div style="background: var(--warning-bg); color: var(--warning-text); padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--warning-color);">
                        <strong>Important:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                            <li>This section focuses on state income tax only, not total cost of living.</li>
                            <li>Property tax, sales tax, insurance, healthcare network access, and housing costs can offset tax savings.</li>
                            <li>Residency rules matter; multi-state situations require tax professional review.</li>
                        </ul>
                    </div>

                    <div style="background: var(--info-bg); padding: 12px; border-radius: 6px; border-left: 3px solid var(--info-color);">
                        <strong>Tip:</strong> Use this as a first-pass filter, then compare a short list of states with full retirement budget assumptions.
                    </div>
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button id="close-state-tax-explanation" style="padding: 10px 24px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    wireGlossaryTermClicks(modal);
    modal.querySelector('#close-state-tax-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
