/**
 * Tax Optimization tab component
 * Provides comprehensive tax analysis, Roth conversion optimization,
 * Social Security timing, RMD projections, and state tax comparisons
 */

import { store } from '../../state/store.js';
import { taxOptimizationAPI } from '../../api/tax-optimization.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError } from '../../utils/dom.js';

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

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>Analyzing tax optimization strategies...</div>
        </div>
    `;

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
        <div style="max-width: 1400px; margin: 0 auto; padding: 12px 16px;">
            <!-- Header -->
            <div style="margin-bottom: 16px;">
                <h1 style="font-size: 20px; margin: 0 0 4px 0; font-weight: 700;">💰 Tax Optimization</h1>
                <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                    Strategic tax planning for ${profile.name}
                </p>
            </div>

            <!-- Tax Snapshot -->
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">📊 Current Tax Snapshot</h2>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Total Tax</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--danger-color);">
                            ${formatCurrency(snapshot.taxes.total_tax, 0)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Effective Rate</div>
                        <div style="font-size: 18px; font-weight: 700;">
                            ${formatPercent(snapshot.rates.effective_rate / 100, 1)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Marginal Rate</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--warning-color);">
                            ${formatPercent(snapshot.rates.marginal_rate / 100, 0)}
                        </div>
                    </div>
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Taxable Income</div>
                        <div style="font-size: 18px; font-weight: 700;">
                            ${formatCurrency(snapshot.summary.taxable_income, 0)}
                        </div>
                    </div>
                </div>

                <details style="cursor: pointer;">
                    <summary style="font-size: 13px; font-weight: 600; padding: 8px 0; user-select: none;">
                        Tax Breakdown
                    </summary>
                    <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; margin-top: 8px;">
                        <div style="display: grid; gap: 8px; font-size: 13px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Federal Tax:</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.federal_tax, 0)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>State Tax (${snapshot.settings.state}):</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.state_tax, 0)}</span>
                            </div>
                            ${snapshot.taxes.capital_gains_tax > 0 ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span>Capital Gains Tax:</span>
                                <span style="font-weight: 600;">${formatCurrency(snapshot.taxes.capital_gains_tax, 0)}</span>
                            </div>
                            ` : ''}
                            ${snapshot.taxes.irmaa_surcharge > 0 ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span>IRMAA Surcharge:</span>
                                <span style="font-weight: 600; color: var(--warning-color);">${formatCurrency(snapshot.taxes.irmaa_surcharge, 0)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </details>
            </div>

            <!-- Recommendations -->
            ${recommendations && recommendations.length > 0 ? `
            <div style="background: linear-gradient(135deg, var(--accent-color), var(--info-color)); padding: 16px; border-radius: 8px; margin-bottom: 16px; color: white;">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">💡 Top Recommendations</h2>
                <div style="display: grid; gap: 10px;">
                    ${recommendations.slice(0, 3).map(rec => `
                        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 6px; backdrop-filter: blur(10px);">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
                                ${rec.category}: ${rec.title}
                            </div>
                            <div style="font-size: 12px; opacity: 0.95; margin-bottom: 6px;">
                                ${rec.description}
                            </div>
                            <div style="font-size: 11px; opacity: 0.85;">
                                💰 ${rec.impact}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Roth Conversion Analysis -->
            ${roth_conversion ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">🔄 Roth Conversion Opportunities</h2>

                ${roth_conversion.optimal_24pct && roth_conversion.optimal_24pct.conversion_amount > 0 ? `
                <div style="background: var(--success-light, #e8f5e9); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid var(--success-color);">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--success-color);">
                        Optimal Conversion (24% bracket)
                    </div>
                    <div style="font-size: 14px; margin-bottom: 4px;">
                        Convert: <strong>${formatCurrency(roth_conversion.optimal_24pct.conversion_amount, 0)}</strong>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Tax Cost: ${formatCurrency(roth_conversion.optimal_24pct.conversion_tax, 0)}
                        (${formatPercent(roth_conversion.optimal_24pct.effective_rate_on_conversion / 100, 1)} effective)
                    </div>
                </div>
                ` : ''}

                ${roth_conversion.bracket_space && roth_conversion.bracket_space.length > 0 ? `
                <details style="cursor: pointer;">
                    <summary style="font-size: 13px; font-weight: 600; padding: 8px 0; user-select: none;">
                        Available Bracket Space
                    </summary>
                    <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; margin-top: 8px;">
                        ${roth_conversion.bracket_space.map(space => `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                                <span style="font-size: 12px;">${space.bracket} bracket (${space.bracket_range})</span>
                                <span style="font-size: 12px; font-weight: 600;">${formatCurrency(space.space_available, 0)}</span>
                            </div>
                        `).join('')}
                    </div>
                </details>
                ` : ''}

                ${roth_conversion.scenarios && roth_conversion.scenarios.length > 0 ? `
                <details style="cursor: pointer;">
                    <summary style="font-size: 13px; font-weight: 600; padding: 8px 0; user-select: none;">
                        Conversion Scenarios
                    </summary>
                    <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; margin-top: 8px; overflow-x: auto;">
                        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color);">
                                    <th style="text-align: left; padding: 8px;">Amount</th>
                                    <th style="text-align: right; padding: 8px;">Tax Cost</th>
                                    <th style="text-align: right; padding: 8px;">Effective Rate</th>
                                    <th style="text-align: right; padding: 8px;">New Marginal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roth_conversion.scenarios.map(scenario => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 8px;">${formatCurrency(scenario.conversion_amount, 0)}</td>
                                        <td style="text-align: right; padding: 8px;">${formatCurrency(scenario.conversion_tax, 0)}</td>
                                        <td style="text-align: right; padding: 8px;">${formatPercent(scenario.effective_rate_on_conversion / 100, 1)}</td>
                                        <td style="text-align: right; padding: 8px;">${formatPercent(scenario.new_marginal_rate, 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
                ` : ''}
            </div>
            ` : ''}

            <!-- RMD Analysis -->
            ${rmd_analysis ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">📅 Required Minimum Distributions</h2>

                ${rmd_analysis.current.required ? `
                <div style="background: var(--warning-light, #fff3e0); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid var(--warning-color);">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--warning-color);">
                        Current RMD Required
                    </div>
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">
                        ${formatCurrency(rmd_analysis.current.rmd_amount, 0)}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${formatPercent(rmd_analysis.current.rmd_as_percentage / 100, 2)} of balance at age ${rmd_analysis.current.age}
                    </div>
                </div>
                ` : `
                <div style="background: var(--info-light, #e3f2fd); padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid var(--info-color);">
                    <div style="font-size: 13px; color: var(--info-color);">
                        RMDs begin in ${rmd_analysis.summary.years_until_rmd} years (age 73)
                    </div>
                </div>
                `}

                ${rmd_analysis.qcd_eligible ? `
                <div style="padding: 10px; background: var(--bg-primary); border-radius: 6px; margin-bottom: 12px;">
                    <div style="font-size: 12px; color: var(--success-color); font-weight: 600;">
                        ✓ Qualified Charitable Distribution (QCD) Eligible
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        You can direct up to ${formatCurrency(rmd_analysis.qcd_annual_limit, 0)} annually to charities
                    </div>
                </div>
                ` : ''}

                ${rmd_analysis.projections && rmd_analysis.projections.length > 0 ? `
                <details style="cursor: pointer;">
                    <summary style="font-size: 13px; font-weight: 600; padding: 8px 0; user-select: none;">
                        20-Year RMD Projection
                    </summary>
                    <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; margin-top: 8px; overflow-x: auto;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color);">
                                    <th style="text-align: left; padding: 6px;">Year</th>
                                    <th style="text-align: right; padding: 6px;">Age</th>
                                    <th style="text-align: right; padding: 6px;">Balance</th>
                                    <th style="text-align: right; padding: 6px;">RMD</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rmd_analysis.projections.slice(0, 10).map(proj => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 6px;">${proj.year}</td>
                                        <td style="text-align: right; padding: 6px;">${proj.age}</td>
                                        <td style="text-align: right; padding: 6px;">${formatCompact(proj.start_balance)}</td>
                                        <td style="text-align: right; padding: 6px; font-weight: ${proj.rmd_required ? '600' : '400'};">
                                            ${proj.rmd_amount > 0 ? formatCompact(proj.rmd_amount) : '--'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
                ` : ''}
            </div>
            ` : ''}

            <!-- State Tax Comparison -->
            ${state_comparison && state_comparison.length > 0 ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">🗺️ State Tax Comparison</h2>

                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                    Current state: <strong>${snapshot.settings.state}</strong>
                </div>

                <details style="cursor: pointer;">
                    <summary style="font-size: 13px; font-weight: 600; padding: 8px 0; user-select: none;">
                        Compare with Other States
                    </summary>
                    <div style="padding: 12px; background: var(--bg-primary); border-radius: 6px; margin-top: 8px; max-height: 400px; overflow-y: auto;">
                        ${state_comparison.map(state => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                                <div style="flex: 1;">
                                    <span style="font-size: 12px; font-weight: 600;">${state.state}</span>
                                    ${state.no_income_tax ? '<span style="margin-left: 8px; font-size: 10px; background: var(--success-color); color: white; padding: 2px 6px; border-radius: 3px;">No Income Tax</span>' : ''}
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 12px; font-weight: 600;">${formatCurrency(state.estimated_tax, 0)}</div>
                                    ${state.savings_vs_current !== 0 ? `
                                        <div style="font-size: 10px; color: ${state.savings_vs_current > 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                            ${state.savings_vs_current > 0 ? 'Save' : 'Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
            ` : ''}

            <!-- All Recommendations -->
            ${recommendations && recommendations.length > 3 ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">📋 All Recommendations</h2>

                <div style="display: grid; gap: 12px;">
                    ${recommendations.map((rec, index) => `
                        <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border-left: 3px solid var(--accent-color);">
                            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 6px;">
                                <span style="background: var(--accent-color); color: white; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; margin-right: 8px;">
                                    ${index + 1}
                                </span>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
                                        ${rec.category}: ${rec.title}
                                    </div>
                                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                                        ${rec.description}
                                    </div>
                                    <div style="font-size: 11px; color: var(--success-color); font-weight: 600;">
                                        💰 ${rec.impact}
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                        ➡️ ${rec.action}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
}
