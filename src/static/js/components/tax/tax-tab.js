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
                <button onclick="window.app.showTab('dashboard')" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Go to Dashboard
                </button>
            </div>
        `;
        return;
    }

    // Show loading state (uses coordinated spinner system)
    showLoading(container, 'Analyzing tax optimization strategies...');

    try {
        // Fetch comprehensive tax analysis
        const analysis = await taxOptimizationAPI.analyzeComprehensive(currentProfile.name);

        renderTaxAnalysis(container, analysis, currentProfile);
    } catch (error) {
        console.error('Error loading tax analysis:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px; color: var(--danger-color);">⚠️</div>
                <h2 style="margin-bottom: 10px;">Error Loading Tax Analysis</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    ${error.message || 'Could not load tax optimization data'}
                </p>
                <button onclick="window.app.showTab('tax'); window.app.showTab('tax');" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

function renderTaxAnalysis(container, analysis, profile) {
    const { snapshot, roth_conversion, rmd_analysis, state_comparison, recommendations } = analysis;

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
                    <span id="tax-snapshot-info" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Click for explanation">ℹ️</span>
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

            <!-- Recommendations -->
            ${recommendations && recommendations.length > 0 ? `
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color);">💡 Top Recommendations</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px;">
                    ${recommendations.slice(0, 3).map((rec, idx) => `
                        <div class="tax-recommendation" data-rec-index="${idx}" style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'">
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
                    <!-- Roth Conversion Analysis -->
                    ${roth_conversion ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            🔄 Roth Conversions
                            <span id="roth-conversion-info" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Click for explanation">ℹ️</span>
                        </h2>

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
                            </div>
                        </details>
                    </div>
                    ` : ''}

                    <!-- RMD Analysis -->
                    ${rmd_analysis ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            📅 RMD Analysis
                            <span id="rmd-analysis-info" style="cursor: pointer; font-size: 14px; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Click for explanation">ℹ️</span>
                        </h2>
                        <div style="font-size: 12px; margin-bottom: 8px;">
                            ${rmd_analysis.current.required
                                ? `Current RMD: <strong>${formatCurrency(rmd_analysis.current.rmd_amount, 0)}</strong>`
                                : `RMDs begin in <strong>${rmd_analysis.summary.years_until_rmd} years</strong> (age 73)`}
                        </div>
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
                                        </tr>
                                    </thead>
                                    <tbody>
                                    ${(() => {
                                        // Show years around when RMDs start for better context
                                        const yearsUntilRMD = rmd_analysis.summary.years_until_rmd;
                                        const startYear = Math.max(0, yearsUntilRMD - 2);
                                        const endYear = Math.min(rmd_analysis.projections.length, startYear + 5);
                                        return rmd_analysis.projections.slice(startYear, endYear).map(proj => `
                                            <tr style="${proj.rmd_amount > 0 ? 'background: rgba(251,191,36,0.1);' : ''}">
                                                <td style="padding: 3px 2px;">${proj.year}</td>
                                                <td style="padding: 3px 2px; text-align: right;">${formatCompact(proj.start_balance)}</td>
                                                <td style="padding: 3px 2px; text-align: right; font-weight: 700; ${proj.rmd_amount > 0 ? 'color: #fbbf24;' : ''}">${proj.rmd_amount > 0 ? formatCompact(proj.rmd_amount) : '--'}</td>
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
                    <button id="close-tax-explanation" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
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
                    <button id="close-recommendation-detail" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
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
                    <button id="close-roth-explanation" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
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
                    <button id="close-rmd-explanation" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
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
