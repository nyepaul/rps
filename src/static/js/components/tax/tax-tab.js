/**
 * Tax Optimization tab component
 * Provides comprehensive tax analysis, Roth conversion optimization,
 * Social Security timing, RMD projections, and state tax comparisons
 */

import { store } from '../../state/store.js';
import { taxOptimizationAPI } from '../../api/tax-optimization.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';

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
    const effectiveSocialInputs = socialSecurityInputs || {
        lifeExpectancy: 90,
        annualEarnedIncome: social_security_analysis?.adjustments?.annual_earned_income || 0,
        noncoveredPensionAnnual: 0,
        applyWep: false,
        applyGpo: false,
    };
    const effectiveRothInputs = rothInputs || {
        ladderYears: roth_conversion?.conversion_ladder_5y?.years_modeled || 5,
        ladderGrowthRate: roth_conversion?.conversion_ladder_5y?.annual_growth_assumption || 0.05,
        ladderMaxRate: roth_conversion?.conversion_ladder_5y?.max_marginal_rate_target || 0.24,
        ladderIncomeGrowthRate: roth_conversion?.conversion_ladder_5y?.income_growth_assumption || 0.02,
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
                            ${formatPercent(snapshot.rates.effective_rate / 100, 1)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px;">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Marginal Rate</div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--warning-color);">
                            ${formatPercent(snapshot.rates.marginal_rate / 100, 0)}
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
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700;">👥 Social Security Strategy</h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Life Expectancy
                                <input id="ss-life-expectancy" type="number" min="70" max="110" value="${effectiveSocialInputs.lifeExpectancy}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Annual Earned Income ($)
                                <input id="ss-annual-earned-income" type="number" min="0" step="1000" value="${effectiveSocialInputs.annualEarnedIncome}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Noncovered Pension ($/yr)
                                <input id="ss-noncovered-pension-annual" type="number" min="0" step="1000" value="${effectiveSocialInputs.noncoveredPensionAnnual}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <div style="display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; font-size: 10px;">
                                <label style="display: flex; align-items: center; gap: 6px;"><input id="ss-apply-wep" type="checkbox" ${effectiveSocialInputs.applyWep ? 'checked' : ''} /> Apply WEP</label>
                                <label style="display: flex; align-items: center; gap: 6px;"><input id="ss-apply-gpo" type="checkbox" ${effectiveSocialInputs.applyGpo ? 'checked' : ''} /> Apply GPO</label>
                            </div>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <button id="recalc-social-security-projection" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #444; background: #1f2937; color: #fff; cursor: pointer; font-weight: 600;">Recalculate Social Security</button>
                        </div>
                        ${social_security_analysis.adjustments ? `
                            <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 10px;">
                                <div>WEP PIA: ${formatCurrency(social_security_analysis.adjustments.wep?.pia_before_wep || 0, 0)} → ${formatCurrency(social_security_analysis.adjustments.wep?.pia_after_wep || 0, 0)}</div>
                                <div>GPO Offset (Monthly): ${formatCurrency(social_security_analysis.adjustments.gpo_offset_monthly || 0, 0)}</div>
                                <div>Annual Earned Income: ${formatCurrency(social_security_analysis.adjustments.annual_earned_income || 0, 0)}</div>
                            </div>
                        ` : ''}
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            ${social_security_analysis.primary?.optimal ? `
                                <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; opacity: 0.7;">Primary Optimal Age</div>
                                    <div style="font-size: 16px; font-weight: 700;">${social_security_analysis.primary.optimal.claiming_age}</div>
                                    <div style="font-size: 11px; opacity: 0.85;">${formatCurrency(social_security_analysis.primary.optimal.monthly_benefit, 0)}/mo</div>
                                </div>
                            ` : ''}
                            ${social_security_analysis.spouse?.optimal ? `
                                <div style="background: rgba(255,255,255,0.08); border-radius: 6px; padding: 8px;">
                                    <div style="font-size: 10px; opacity: 0.7;">Spouse Optimal Age</div>
                                    <div style="font-size: 16px; font-weight: 700;">${social_security_analysis.spouse.optimal.claiming_age}</div>
                                    <div style="font-size: 11px; opacity: 0.85;">${formatCurrency(social_security_analysis.spouse.optimal.monthly_benefit, 0)}/mo</div>
                                </div>
                            ` : ''}
                            <div style="background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.35); border-radius: 6px; padding: 8px;">
                                <div style="font-size: 10px; opacity: 0.7;">Survivor Income (70 Strategy)</div>
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
                            🔄 Roth Conversions
                            <span id="roth-conversion-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 8px;">
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Ladder Years
                                <input id="roth-ladder-years" type="number" min="1" max="20" value="${effectiveRothInputs.ladderYears}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Growth Rate (%)
                                <input id="roth-ladder-growth" type="number" step="0.1" min="-20" max="30" value="${(effectiveRothInputs.ladderGrowthRate * 100).toFixed(1)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Max Marginal Rate (%)
                                <input id="roth-ladder-max-rate" type="number" step="1" min="10" max="50" value="${(effectiveRothInputs.ladderMaxRate * 100).toFixed(0)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                                Income Growth (%)
                                <input id="roth-ladder-income-growth" type="number" step="0.1" min="-10" max="10" value="${(effectiveRothInputs.ladderIncomeGrowthRate * 100).toFixed(1)}" style="padding: 6px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.06); color: #fff;" />
                            </label>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <button id="recalc-roth-conversion" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #444; background: #1f2937; color: #fff; cursor: pointer; font-weight: 600;">Recalculate Roth Plan</button>
                        </div>

                        ${roth_conversion.optimal_24pct ? `
                            ${roth_conversion.optimal_24pct.conversion_amount > 0 ? `
                                <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Optimal Conversion (24% Bracket)</div>
                                    <div style="font-size: 18px; font-weight: 700; color: #4ade80;">${formatCurrency(roth_conversion.optimal_24pct.conversion_amount, 0)}</div>
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
                                        Tax Cost: ${formatCurrency(roth_conversion.optimal_24pct.conversion_tax, 0)}
                                        (${(roth_conversion.optimal_24pct.effective_rate_on_conversion * 100).toFixed(1)}% effective)
                                    </div>
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
                                        Lifetime Savings: ${formatCurrency(roth_conversion.optimal_24pct.lifetime_savings || 0, 0)}
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
                                                    @ ${scenario.new_marginal_rate ? (scenario.new_marginal_rate * 100).toFixed(0) : 'N/A'}% marginal
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
                            📅 RMD Analysis
                            <span id="rmd-analysis-info" class="csp-hover-opacity" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="font-size: 12px; margin-bottom: 8px;">
                            ${rmd_analysis.current.required
                                ? `Current RMD: <strong>${formatCurrency(rmd_analysis.current.rmd_amount, 0)}</strong>`
                                : `RMDs begin in <strong>${rmd_analysis.summary.years_until_rmd} years</strong> (age 73)`}
                        </div>
                        ${rmd_analysis.qcd_planning ? `
                            <div style="background: rgba(34,197,94,0.16); border: 1px solid rgba(34,197,94,0.35); border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 11px; line-height: 1.4;">
                                <div style="font-weight: 700; margin-bottom: 4px;">QCD Planning</div>
                                <div>Annual Giving Assumption: <strong>${formatCurrency(rmd_analysis.qcd_planning.annual_charitable_giving_assumption || 0, 0)}</strong></div>
                                <div>Suggested QCD This Year: <strong>${formatCurrency(rmd_analysis.qcd_planning.current_year_suggested_qcd || 0, 0)}</strong></div>
                                <div>Taxable RMD After QCD: <strong>${formatCurrency(rmd_analysis.qcd_planning.current_year_taxable_rmd_after_qcd || 0, 0)}</strong></div>
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
                        <h2 style="font-size: 15px; margin: 0 0 8px 0; font-weight: 700;">🗺️ State Tax Comparison</h2>
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
                                                ✅ No Income Tax
                                            </div>
                                            ${noTaxStates.slice(0, 9).map(state => `
                                                <div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; margin: 2px 0; background: rgba(34,197,94,0.1); border-radius: 4px; border-left: 3px solid #22c55e;">
                                                    <span style="font-size: 13px; font-weight: 700;">${state.state}</span>
                                                    <span style="font-size: 11px; color: #22c55e; font-weight: 600;">$0 tax</span>
                                                    <span style="font-size: 10px; background: rgba(34,197,94,0.2); padding: 2px 6px; border-radius: 3px; font-weight: 600;">
                                                        💰 Save ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
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
                                                💚 Low Tax States
                                            </div>
                                            ${lowTaxStates.slice(0, 6).map(state => `
                                                <div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; margin: 2px 0; background: rgba(234,179,8,0.1); border-radius: 4px; border-left: 3px solid #eab308;">
                                                    <span style="font-size: 13px; font-weight: 700;">${state.state}</span>
                                                    <span style="font-size: 11px; color: #eab308; font-weight: 600;">${formatCurrency(state.estimated_tax, 0)} tax</span>
                                                    <span style="font-size: 10px; background: rgba(234,179,8,0.2); padding: 2px 6px; border-radius: 3px; font-weight: 600;">
                                                        ${state.savings_vs_current >= 0 ? '💰 Save' : '💸 Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
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
                                                        ${state.savings_vs_current >= 0 ? '💰' : '💸'} ${state.savings_vs_current >= 0 ? 'Save' : 'Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
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

    // CSP-safe hover: opacity toggle for info icons
    container.querySelectorAll('.csp-hover-opacity').forEach(el => {
        el.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
        el.addEventListener('mouseleave', () => { el.style.opacity = '0.7'; });
    });

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
            <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color);">
                🏥 Healthcare & Medicare Projection
            </h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-bottom: 10px;">
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Years
                    <input id="healthcare-years" type="number" min="1" max="40" value="${defaults.years}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Medical Inflation (%)
                    <input id="healthcare-medical-inflation" type="number" step="0.1" min="-10" max="25" value="${defaults.medicalInflationPct}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Income Growth (%)
                    <input id="healthcare-income-growth" type="number" step="0.1" min="-10" max="25" value="${defaults.incomeGrowthPct}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    MAGI Override ($)
                    <input id="healthcare-estimated-magi" type="number" min="0" step="1000" value="${defaults.estimatedMagi}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Out-of-Pocket Override ($)
                    <input id="healthcare-annual-oop" type="number" min="0" step="500" value="${defaults.annualOutOfPocket}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Initial HSA Balance ($)
                    <input id="healthcare-hsa-balance" type="number" min="0" step="500" value="${defaults.initialHsaBalance}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    Annual HSA Contribution ($)
                    <input id="healthcare-hsa-contribution" type="number" min="0" step="250" value="${defaults.annualHsaContribution}" placeholder="Auto from profile" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
                </label>
                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    HSA Growth (%)
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
                    Medicare/IRMAA Cost Breakdown (First 5 Years)
                </summary>
                <div style="padding: 10px; background: var(--bg-primary); border-radius: 6px; margin-top: 6px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 4px;">Year</th>
                                <th style="padding: 4px;">Eligible</th>
                                <th style="padding: 4px;">Part A</th>
                                <th style="padding: 4px;">Part B</th>
                                <th style="padding: 4px;">Part D</th>
                                <th style="padding: 4px;">IRMAA</th>
                                <th style="padding: 4px;">Out-of-Pocket</th>
                                <th style="padding: 4px;">HSA Used</th>
                                <th style="padding: 4px;">Net Cost</th>
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
                            <strong>Marginal vs Effective Rate:</strong><br>
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
    modal.querySelector('#close-roth-explanation').addEventListener('click', () => modal.remove());
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
                        <strong>Required Minimum Distributions (RMDs)</strong> are mandatory annual withdrawals from traditional IRAs and 401(k)s that the IRS requires starting at age 73.
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
                            <li>Can trigger Medicare IRMAA surcharges</li>
                            <li>May make more Social Security taxable</li>
                            <li>Forced to sell regardless of market conditions</li>
                        </ul>
                    </div>

                    <div style="background: var(--success-bg); padding: 12px; border-radius: 6px; border: 1px solid var(--success-color);">
                        <strong style="color: var(--success-color);">💡 Strategies:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
                            <li>Roth conversions before age 73 to reduce future RMDs</li>
                            <li>QCDs: Donate RMDs to charity tax-free (age 70½+)</li>
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
    modal.querySelector('#close-rmd-explanation').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
