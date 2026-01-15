/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { APP_CONFIG } from '../../config.js';

// Store last analysis result for saving as scenario
let lastAnalysisResult = null;
let lastSimulations = null;
let timelineChartInstances = {}; // Changed to object to store multiple chart instances

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

    // Get settings from localStorage
    const savedSimulations = localStorage.getItem('rps_simulations') || APP_CONFIG.DEFAULT_SIMULATIONS;
    const savedMarketProfile = localStorage.getItem('rps_market_profile') || 'historical';
    const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfile];

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Retirement Analysis</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Analysis Configuration -->
            <div class="analysis-panel">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 24px; margin: 0 0 5px 0;">Monte Carlo Simulation</h2>
                        <p style="color: var(--text-secondary); margin: 0;">
                            Market Assumptions: <strong>${marketProfile.name}</strong> - ${marketProfile.description}
                        </p>
                    </div>
                    <button onclick="document.getElementById('settings-btn').click()" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px;">
                        ⚙️ Change Settings
                    </button>
                </div>

                <div style="display: flex; gap: 20px; align-items: flex-end; margin-bottom: 20px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                            Simulations: <span id="simulations-display">${parseInt(savedSimulations).toLocaleString()}</span>
                        </label>
                        <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                            <small style="color: var(--text-secondary); font-size: 12px;">
                                💡 Tip: Adjust simulations and market assumptions in Settings (⚙️)
                            </small>
                        </div>
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
    const resultsContainer = container.querySelector('#results-container');

    if (!runBtn || !resultsContainer) {
        console.error('Analysis form elements not found');
        return;
    }

    runBtn.addEventListener('click', async () => {
        // Get settings from localStorage
        const savedSimulations = localStorage.getItem('rps_simulations') || APP_CONFIG.DEFAULT_SIMULATIONS;
        const savedMarketProfile = localStorage.getItem('rps_market_profile') || 'historical';
        const simulations = parseInt(savedSimulations, 10);

        if (simulations < APP_CONFIG.MIN_SIMULATIONS || simulations > APP_CONFIG.MAX_SIMULATIONS) {
            alert(`Simulations must be between ${APP_CONFIG.MIN_SIMULATIONS} and ${APP_CONFIG.MAX_SIMULATIONS}`);
            return;
        }

        // Disable button and show loading
        runBtn.disabled = true;
        runBtn.textContent = 'Running Analysis...';
        showLoading(resultsContainer, `Running ${simulations.toLocaleString()} simulations...`);

        try {
            const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfile];
            const result = await analysisAPI.runAnalysis(profile.name, simulations, marketProfile);

            // DEBUG: Log the response
            console.log('Analysis API Response:', JSON.stringify(result, null, 2));

            // Store for saving as scenario
            lastAnalysisResult = result;
            lastSimulations = simulations;

            // Display results
            displayResults(resultsContainer, result, profile, simulations);

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

function displaySingleScenarioResults(container, data, profile, simulations) {
    // Calculate success color
    const successRate = data.success_rate || 0;
    let successClass = 'stat-danger';
    if (successRate >= 0.9) successClass = 'stat-success';
    else if (successRate >= 0.75) successClass = 'stat-warning';

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Simulation Results</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations || 10000).toLocaleString()} Monte Carlo simulations
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

        <!-- Timeline Chart -->
        <div class="result-card">
            <h3 style="font-size: 20px; margin-bottom: 15px;">Portfolio Projection Timeline</h3>
            <p style="color: var(--text-secondary); margin-bottom: 15px;">
                Year-by-year portfolio value through retirement
            </p>
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
            <button id="save-scenario-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 600;">
                Save as Scenario
            </button>
            <button onclick="window.app.showTab('comparison')" class="secondary-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                Compare Scenarios
            </button>
            <button onclick="window.app.showTab('actions')" class="primary-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                View Action Items
            </button>
        </div>
    `;

    // Render timeline chart if data available
    if (data.timeline) {
        renderTimelineChart(data.timeline);
    }

    // Set up save scenario handler
    setupSaveScenarioHandler(container, profile);
}

function displayMultiScenarioResults(container, data, profile, simulations) {
    const scenarios = data.scenarios;
    const scenarioOrder = ['conservative', 'moderate', 'aggressive'];

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Multi-Scenario Analysis</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations).toLocaleString()} Monte Carlo simulations per scenario<br>
                Total Assets: <strong>${formatCurrency(data.total_assets || 0, 0)}</strong> projected over <strong>${data.years_projected}</strong> years
            </p>

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
                                    ${formatCurrency(scenario.median_final_balance || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item">
                                <div class="stat-label">10th Percentile</div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.percentile_10 || 0, 0)}
                                </div>
                                <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                                    Worst 10% of outcomes
                                </small>
                            </div>

                            <div class="stat-item">
                                <div class="stat-label">90th Percentile</div>
                                <div class="stat-value stat-success">
                                    ${formatCurrency(scenario.percentile_90 || 0, 0)}
                                </div>
                                <small style="display: block; margin-top: 8px; color: var(--text-secondary);">
                                    Best 10% of outcomes
                                </small>
                            </div>

                            <div class="stat-item">
                                <div class="stat-label">Expected Value</div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.expected_value || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item">
                                <div class="stat-label">Std Deviation</div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.std_deviation || 0, 0)}
                                </div>
                            </div>
                        </div>

                        <!-- Timeline Chart for this scenario -->
                        <div style="margin-top: 30px;">
                            <h3 style="font-size: 20px; margin-bottom: 15px;">Portfolio Projection Timeline</h3>
                            <p style="color: var(--text-secondary); margin-bottom: 15px;">
                                Year-by-year portfolio value through retirement
                            </p>
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
                <button onclick="window.app.showTab('comparison')" class="secondary-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                    Compare Scenarios
                </button>
                <button onclick="window.app.showTab('actions')" class="primary-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    View Action Items
                </button>
            </div>
        </div>
    `;

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
            console.log(`Calling renderTimelineChart for ${key}`);
            try {
                renderTimelineChart(scenario.timeline, `timeline-chart-${key}`);
                console.log(`Successfully rendered chart for ${key}`);
            } catch (error) {
                console.error(`Error rendering chart for ${key}:`, error);
            }
        } else {
            console.warn(`No timeline data for scenario ${key}`);
        }
    });
}

function renderTimelineChart(timeline, canvasId = 'timeline-chart') {
    console.log(`renderTimelineChart called for ${canvasId}`);
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas element not found: ${canvasId}`);
        return;
    }
    console.log('Canvas element found:', ctx);

    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded!');
        return;
    }

    // Destroy existing chart instance for this canvas
    if (timelineChartInstances[canvasId]) {
        timelineChartInstances[canvasId].destroy();
        delete timelineChartInstances[canvasId];
    }

    // Get colors from CSS variables
    const style = getComputedStyle(document.body);
    const successColor = style.getPropertyValue('--success-color').trim() || '#28a745';
    const dangerColor = style.getPropertyValue('--danger-color').trim() || '#dc3545';
    const accentColor = style.getPropertyValue('--accent-color').trim() || '#3498db';
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#666';

    timelineChartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeline.years || [],
            datasets: [
                {
                    label: '95th Percentile (Optimistic)',
                    data: timeline.p95 || [],
                    borderColor: successColor,
                    backgroundColor: successColor + '20',
                    fill: '+1',
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Median',
                    data: timeline.median || [],
                    borderColor: accentColor,
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '5th Percentile (Conservative)',
                    data: timeline.p5 || [],
                    borderColor: dangerColor,
                    backgroundColor: dangerColor + '20',
                    fill: '-1',
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textSecondary,
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw, 0)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(128,128,128,0.1)'
                    },
                    ticks: {
                        color: textSecondary,
                        callback: (value) => formatCompact(value)
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textSecondary,
                        maxTicksLimit: 15
                    },
                    title: {
                        display: true,
                        text: 'Year',
                        color: textSecondary
                    }
                }
            }
        }
    });
}

async function setupSaveScenarioHandler(container, profile) {
    const saveBtn = container.querySelector('#save-scenario-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        if (!lastAnalysisResult) {
            alert('No analysis results to save');
            return;
        }

        const defaultName = `${profile.name} - ${new Date().toLocaleDateString()}`;
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
