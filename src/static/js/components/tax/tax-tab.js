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
            <div class="spinner" style="
                width: 48px;
                height: 48px;
                border: 4px solid var(--border-color);
                border-top-color: var(--accent-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 20px;
            "></div>
            <div>Analyzing tax optimization strategies...</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
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
