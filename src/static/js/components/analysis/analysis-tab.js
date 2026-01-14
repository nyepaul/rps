/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';
import { formatCurrency, formatPercent } from '../../utils/formatters.js';
import { APP_CONFIG } from '../../config.js';

export function renderAnalysisTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to run analysis.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Retirement Analysis</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Analysis Configuration -->
            <div class="analysis-panel">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Monte Carlo Simulation</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Run thousands of simulations to understand your retirement readiness under different market conditions.
                </p>

                <div style="display: flex; gap: 20px; align-items: flex-end; margin-bottom: 30px;">
                    <div style="flex: 1;">
                        <label for="simulations" style="display: block; margin-bottom: 8px; font-weight: 600;">
                            Number of Simulations
                        </label>
                        <input
                            type="number"
                            id="simulations"
                            min="${APP_CONFIG.MIN_SIMULATIONS}"
                            max="${APP_CONFIG.MAX_SIMULATIONS}"
                            value="${APP_CONFIG.DEFAULT_SIMULATIONS}"
                            style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);"
                        >
                        <small style="display: block; margin-top: 5px; color: var(--text-secondary);">
                            More simulations = more accurate results (but slower)
                        </small>
                    </div>
                    <button id="run-analysis-btn" class="primary-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600;">
                        Run Analysis
                    </button>
                </div>
            </div>

            <!-- Results Container -->
            <div id="results-container"></div>
        </div>

        <style>
            .analysis-panel {
                background: var(--bg-secondary);
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            .primary-btn:hover {
                background: var(--accent-hover);
            }
            .result-card {
                background: var(--bg-secondary);
                padding: 25px;
                border-radius: 12px;
                margin-bottom: 20px;
            }
            .stat-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .stat-item {
                background: var(--bg-primary);
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                border: 2px solid var(--border-color);
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
        </style>
    `;

    // Set up event handlers
    setupAnalysisHandlers(container, profile);
}

function setupAnalysisHandlers(container, profile) {
    const runBtn = container.querySelector('#run-analysis-btn');
    const simulationsInput = container.querySelector('#simulations');
    const resultsContainer = container.querySelector('#results-container');

    if (!runBtn || !simulationsInput || !resultsContainer) {
        console.error('Analysis form elements not found');
        return;
    }

    runBtn.addEventListener('click', async () => {
        const simulations = parseInt(simulationsInput.value, 10);

        if (simulations < APP_CONFIG.MIN_SIMULATIONS || simulations > APP_CONFIG.MAX_SIMULATIONS) {
            alert(`Simulations must be between ${APP_CONFIG.MIN_SIMULATIONS} and ${APP_CONFIG.MAX_SIMULATIONS}`);
            return;
        }

        // Disable button and show loading
        runBtn.disabled = true;
        runBtn.textContent = 'Running Analysis...';
        showLoading(resultsContainer, `Running ${simulations.toLocaleString()} simulations...`);

        try {
            const result = await analysisAPI.runAnalysis(profile.name, simulations);

            // Display results
            displayResults(resultsContainer, result);

            showSuccess('Analysis complete!');

        } catch (error) {
            console.error('Analysis error:', error);
            showError(resultsContainer, `Failed to run analysis: ${error.message}`);
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = 'Run Analysis';
        }
    });
}

function displayResults(container, result) {
    const data = result.results || result;

    // Calculate success color
    const successRate = data.success_rate || 0;
    let successClass = 'stat-danger';
    if (successRate >= 0.9) successClass = 'stat-success';
    else if (successRate >= 0.75) successClass = 'stat-warning';

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Simulation Results</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || 10000).toLocaleString()} Monte Carlo simulations
            </p>

            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-label">Success Rate</div>
                    <div class="stat-value ${successClass}">
                        ${formatPercent(successRate, 1)}
                    </div>
                    <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                        ${successRate >= 0.9 ? 'Excellent' : successRate >= 0.75 ? 'Good' : 'Needs Attention'}
                    </small>
                </div>

                <div class="stat-item">
                    <div class="stat-label">Median Final Balance</div>
                    <div class="stat-value stat-info">
                        ${formatCurrency(data.median_final_balance || 0, 0)}
                    </div>
                </div>

                <div class="stat-item">
                    <div class="stat-label">10th Percentile</div>
                    <div class="stat-value">
                        ${formatCurrency(data.percentile_10 || 0, 0)}
                    </div>
                    <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                        Worst 10% of outcomes
                    </small>
                </div>

                <div class="stat-item">
                    <div class="stat-label">90th Percentile</div>
                    <div class="stat-value stat-success">
                        ${formatCurrency(data.percentile_90 || 0, 0)}
                    </div>
                    <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                        Best 10% of outcomes
                    </small>
                </div>

                <div class="stat-item">
                    <div class="stat-label">Expected Value</div>
                    <div class="stat-value">
                        ${formatCurrency(data.expected_value || 0, 0)}
                    </div>
                </div>

                <div class="stat-item">
                    <div class="stat-label">Std Deviation</div>
                    <div class="stat-value">
                        ${formatCurrency(data.std_deviation || 0, 0)}
                    </div>
                </div>
            </div>
        </div>

        ${data.warnings && data.warnings.length > 0 ? `
            <div class="result-card" style="border-left: 4px solid var(--warning-color);">
                <h3 style="font-size: 20px; margin-bottom: 15px; color: var(--warning-color);">⚠️ Warnings</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    ${data.warnings.map(warning => `
                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${warning}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${data.recommendations && data.recommendations.length > 0 ? `
            <div class="result-card" style="border-left: 4px solid var(--info-color);">
                <h3 style="font-size: 20px; margin-bottom: 15px; color: var(--info-color);">💡 Recommendations</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    ${data.recommendations.map(rec => `
                        <li style="margin-bottom: 10px; color: var(--text-secondary);">${rec}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px;">
            <button onclick="window.app.showTab('comparison')" class="secondary-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                Compare Scenarios
            </button>
            <button onclick="window.app.showTab('actions')" class="primary-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                View Action Items
            </button>
        </div>
    `;
}
