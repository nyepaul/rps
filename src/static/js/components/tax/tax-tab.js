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
                <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700; color: var(--accent-color);">📊 Current Tax Snapshot</h2>

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
                        </div>
                    </div>
                </details>
            </div>

            <!-- Recommendations -->
            ${recommendations && recommendations.length > 0 ? `
            <div style="background: linear-gradient(135deg, var(--accent-color), var(--info-color)); padding: 12px; border-radius: 8px; margin-bottom: 12px; color: white;">
                <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700;">💡 Top Recommendations</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px;">
                    ${recommendations.slice(0, 3).map(rec => `
                        <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; backdrop-filter: blur(10px);">
                            <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">
                                ${rec.title}
                            </div>
                            <div style="font-size: 11px; opacity: 0.95;">
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
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700;">🔄 Roth Conversions</h2>

                        ${roth_conversion.optimal_24pct && roth_conversion.optimal_24pct.conversion_amount > 0 ? `
                        <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Optimal Conversion</div>
                            <div style="font-size: 14px; font-weight: 700;">${formatCurrency(roth_conversion.optimal_24pct.conversion_amount, 0)}</div>
                            <div style="font-size: 10px; opacity: 0.8;">Cost: ${formatCurrency(roth_conversion.optimal_24pct.conversion_tax, 0)}</div>
                        </div>
                        ` : ''}

                        <details style="cursor: pointer;">
                            <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">Scenarios & Space</summary>
                            <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px; font-size: 11px;">
                                ${roth_conversion.bracket_space.slice(0, 3).map(space => `
                                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                                        <span>${space.bracket} Space:</span>
                                        <span style="font-weight: 700;">${formatCurrency(space.space_available, 0)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    </div>
                    ` : ''}

                    <!-- RMD Analysis -->
                    ${rmd_analysis ? `
                    <div style="background: #000; padding: 12px; border-radius: 8px; color: white; border: 1px solid #333;">
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700;">📅 RMD Analysis</h2>
                        <div style="font-size: 12px; margin-bottom: 8px;">
                            ${rmd_analysis.current.required 
                                ? `Current RMD: <strong>${formatCurrency(rmd_analysis.current.rmd_amount, 0)}</strong>`
                                : `RMDs begin in <strong>${rmd_analysis.summary.years_until_rmd} years</strong>`}
                        </div>
                        <details style="cursor: pointer;">
                            <summary style="font-size: 12px; font-weight: 600; padding: 4px 0; user-select: none;">10-Year Proj</summary>
                            <div style="padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; margin-top: 6px;">
                                <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                                    ${rmd_analysis.projections.slice(0, 5).map(proj => `
                                        <tr>
                                            <td style="padding: 2px;">${proj.year}</td>
                                            <td style="padding: 2px; text-align: right;">${formatCompact(proj.start_balance)}</td>
                                            <td style="padding: 2px; text-align: right; font-weight: 700;">${proj.rmd_amount > 0 ? formatCompact(proj.rmd_amount) : '--'}</td>
                                        </tr>
                                    `).join('')}
                                </table>
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
                        <h2 style="font-size: 15px; margin: 0 0 10px 0; font-weight: 700;">🗺️ State Comparison</h2>
                        <div style="max-height: 250px; overflow-y: auto; font-size: 11px; padding-right: 5px;">
                            ${state_comparison.slice(0, 15).map(state => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <span>${state.state}</span>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 700;">${formatCurrency(state.estimated_tax, 0)}</div>
                                        <div style="font-size: 9px; opacity: 0.8; color: ${state.savings_vs_current >= 0 ? '#4cd137' : '#ff4757'}">
                                            ${state.savings_vs_current >= 0 ? 'Save' : 'Pay'} ${formatCurrency(Math.abs(state.savings_vs_current), 0)}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}
