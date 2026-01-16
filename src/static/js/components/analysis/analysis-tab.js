/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showErrorInContainer, showLoading } from '../../utils/dom.js';
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
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Retirement Analysis</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Analysis Configuration -->
            <div class="analysis-panel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-size: 24px; margin: 0;">Monte Carlo Simulation</h2>
                    
                    <!-- Scenario Loader -->
                    <div id="scenario-loader-container" style="display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">Load Saved:</span>
                        <select id="saved-scenario-select" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 13px; min-width: 200px;">
                            <option value="">-- Select Scenario --</option>
                        </select>
                    </div>
                </div>

                <!-- Market Assumptions Selector -->
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        Market Assumptions
                    </label>
                    <select id="market-profile-select" style="width: 100%; padding: 12px 15px; font-size: 15px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
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
                    <div id="market-profile-description" style="margin-top: 10px; padding: 12px 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600; color: var(--text-primary);">${marketProfile.name}</span>
                            <small style="color: var(--accent-color); font-weight: 600;">CUSTOMIZABLE</small>
                        </div>
                        <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 14px;">${marketProfile.description}</p>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 13px;">
                            <div class="form-group">
                                <label style="font-size: 11px; margin-bottom: 4px; display: block;">Stock Return (%)</label>
                                <input type="number" id="custom-stock-return" value="${(marketProfile.stock_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 11px; margin-bottom: 4px; display: block;">Bond Return (%)</label>
                                <input type="number" id="custom-bond-return" value="${(marketProfile.bond_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 11px; margin-bottom: 4px; display: block;">Inflation (%)</label>
                                <input type="number" id="custom-inflation" value="${(marketProfile.inflation_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Spending Model Selector -->
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                        Spending Strategy (Retiree Behavior)
                    </label>
                    <select id="spending-model-select" style="width: 100%; padding: 12px 15px; font-size: 15px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                        <option value="constant_real">Constant Inflation-Adjusted (Default)</option>
                        <option value="retirement_smile">Retirement Smile (Reality Planning)</option>
                        <option value="conservative_decline">Conservative Decline (Slow-Go)</option>
                    </select>
                    <div id="spending-model-description" style="margin-top: 10px; padding: 12px 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 600; color: var(--text-primary);">Constant Inflation-Adjusted</span>
                        </div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                            Maintains purchasing power throughout retirement. Spending increases exactly with inflation every year. Standard conservative assumption.
                        </p>
                    </div>
                </div>

                <!-- Simulations Selector -->
                <div style="display: flex; gap: 20px; align-items: flex-end; margin-bottom: 20px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px;">
                            Number of Simulations
                        </label>
                        <select id="simulations-select" style="width: 100%; padding: 12px 15px; font-size: 15px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            <option value="1000" ${parseInt(savedSimulations) === 1000 ? 'selected' : ''}>1,000 (Fast)</option>
                            <option value="5000" ${parseInt(savedSimulations) === 5000 ? 'selected' : ''}>5,000 (Quick)</option>
                            <option value="10000" ${parseInt(savedSimulations) === 10000 ? 'selected' : ''}>10,000 (Standard)</option>
                            <option value="25000" ${parseInt(savedSimulations) === 25000 ? 'selected' : ''}>25,000 (Detailed)</option>
                            <option value="50000" ${parseInt(savedSimulations) === 50000 ? 'selected' : ''}>50,000 (Maximum)</option>
                        </select>
                    </div>
                    <button id="run-analysis-btn" class="primary-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; min-width: 150px;">
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
    setupScenarioLoader(container, profile);
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

function setupAnalysisHandlers(container, profile) {
    const runBtn = container.querySelector('#run-analysis-btn');
    const resultsContainer = container.querySelector('#results-container');
    const marketProfileSelect = container.querySelector('#market-profile-select');
    const spendingModelSelect = container.querySelector('#spending-model-select');
    const simulationsSelect = container.querySelector('#simulations-select');
    const marketProfileDescription = container.querySelector('#market-profile-description');
    const spendingModelDescription = container.querySelector('#spending-model-description');

    if (!runBtn || !resultsContainer) {
        console.error('Analysis form elements not found');
        return;
    }

    // Spending Model Descriptions
    const spendingDescriptions = {
        'constant_real': {
            title: 'Constant Inflation-Adjusted',
            desc: 'Maintains purchasing power throughout retirement. Spending increases exactly with inflation every year. Standard conservative assumption.'
        },
        'retirement_smile': {
            title: 'Retirement Smile (Reality Planning)',
            desc: 'Models typical behavior: High spending in early retirement ("Go-Go" years), declining in mid-retirement ("Slow-Go"), and rising again in late retirement for healthcare ("No-Go").'
        },
        'conservative_decline': {
            title: 'Conservative Decline',
            desc: 'Assumes real spending decreases gradually as you age (1% per year after age 70), reflecting reduced activity levels.'
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
        const simulations = parseInt(simulationsSelect?.value || localStorage.getItem('rps_simulations') || APP_CONFIG.DEFAULT_SIMULATIONS, 10);
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
            
            // Create custom market profile from inputs
            const marketProfile = {
                ...templateProfile,
                stock_return_mean: parseFloat(container.querySelector('#custom-stock-return').value) / 100,
                bond_return_mean: parseFloat(container.querySelector('#custom-bond-return').value) / 100,
                inflation_mean: parseFloat(container.querySelector('#custom-inflation').value) / 100
            };

            const spendingModel = spendingModelSelect?.value || 'constant_real';
            
            // Pass spending model to API
            const result = await analysisAPI.runAnalysis(profile.name, simulations, marketProfile, spendingModel);

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
                <div class="stat-item" title="% of trials that didn't run out of cash">
                    <div class="stat-label">
                        Success Rate 
                        <a href="https://www.investopedia.com/terms/m/montecarlosimulation.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Monte Carlo Success Rates">?</a>
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
                        <a href="https://www.investopedia.com/terms/m/median.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Median">?</a>
                    </div>
                    <div class="stat-value stat-info">
                        ${formatCurrency(data.median_final_balance || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Worst 10% of outcomes. Only 10% of trials performed worse than this (conservative)">
                    <div class="stat-label">
                        10th Percentile
                        <a href="https://www.investopedia.com/terms/p/percentile.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Percentiles">?</a>
                    </div>
                    <div class="stat-value">
                        ${formatCurrency(data.percentile_10 || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Best 10% of outcomes. Only 10% of trials performed better than this (optimistic)">
                    <div class="stat-label">
                        90th Percentile
                        <a href="https://www.investopedia.com/terms/p/percentile.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Percentiles">?</a>
                    </div>
                    <div class="stat-value stat-success">
                        ${formatCurrency(data.percentile_90 || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="The average of all trial outcomes">
                    <div class="stat-label">
                        Expected Value
                        <a href="https://www.investopedia.com/terms/e/expected-value.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Expected Value">?</a>
                    </div>
                    <div class="stat-value">
                        ${formatCurrency(data.expected_value || 0, 0)}
                    </div>
                </div>

                <div class="stat-item" title="Measure of uncertainty; higher means more spread between outcomes">
                    <div class="stat-label">
                        Std Deviation
                        <a href="https://www.investopedia.com/terms/s/standarddeviation.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Standard Deviation">?</a>
                    </div>
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
                            <div class="stat-item" title="% of trials that didn't run out of cash">
                                <div class="stat-label">
                                    Success Rate
                                    <a href="https://www.investopedia.com/terms/m/montecarlosimulation.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Monte Carlo Success Rates">?</a>
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
                                    <a href="https://www.investopedia.com/terms/m/median.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Median">?</a>
                                </div>
                                <div class="stat-value stat-info">
                                    ${formatCurrency(scenario.median_final_balance || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Worst 10% of outcomes. Only 10% of trials performed worse than this (conservative)">
                                <div class="stat-label">
                                    10th Percentile
                                    <a href="https://www.investopedia.com/terms/p/percentile.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Percentiles">?</a>
                                </div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.percentile_10 || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Best 10% of outcomes. Only 10% of trials performed better than this (optimistic)">
                                <div class="stat-label">
                                    90th Percentile
                                    <a href="https://www.investopedia.com/terms/p/percentile.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Percentiles">?</a>
                                </div>
                                <div class="stat-value stat-success">
                                    ${formatCurrency(scenario.percentile_90 || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="The average of all trial outcomes">
                                <div class="stat-label">
                                    Expected Value
                                    <a href="https://www.investopedia.com/terms/e/expected-value.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Expected Value">?</a>
                                </div>
                                <div class="stat-value">
                                    ${formatCurrency(scenario.expected_value || 0, 0)}
                                </div>
                            </div>

                            <div class="stat-item" title="Measure of uncertainty; higher means more spread between outcomes">
                                <div class="stat-label">
                                    Std Deviation
                                    <a href="https://www.investopedia.com/terms/s/standarddeviation.asp" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: bold; margin-left: 5px;" title="Learn more about Standard Deviation">?</a>
                                </div>
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
                 <button id="save-multi-scenario-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 600;">
                    Save as Scenario
                </button>
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

    // Setup save handler for multi-scenario
    setupMultiSaveScenarioHandler(container, profile);
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

    // Highlight specific milestones: 0, 5, 10, 15, 20, 30, 40 years
    const milestones = [0, 5, 10, 15, 20, 30, 40];
    const pointRadii = (timeline.years || []).map((year, index) => {
        return milestones.includes(index) ? 6 : 0;
    });
    const pointHoverRadii = (timeline.years || []).map((year, index) => {
        return milestones.includes(index) ? 8 : 4;
    });

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
                    pointRadius: pointRadii,
                    pointHoverRadius: pointHoverRadii,
                    pointBackgroundColor: accentColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
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
            // Custom plugin to draw labels for milestones
            plugins: [{
                id: 'milestoneLabels',
                afterDatasetsDraw(chart) {
                    const {ctx, data} = chart;
                    const dataset = data.datasets[1]; // Median dataset
                    const milestones = [0, 5, 10, 15, 20, 30, 40];
                    
                    ctx.save();
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    
                    milestones.forEach(index => {
                        const meta = chart.getDatasetMeta(1);
                        const point = meta.data[index];
                        
                        if (point && !point.skip) {
                            const val = formatCurrency(dataset.data[index], 0);
                            
                            // Draw small background for text readability
                            const textWidth = ctx.measureText(val).width;
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                            ctx.fillRect(point.x - (textWidth/2) - 4, point.y - 28, textWidth + 8, 16);
                            
                            // Draw text
                            ctx.fillStyle = accentColor;
                            ctx.fillText(val, point.x, point.y - 16);
                        }
                    });
                    ctx.restore();
                }
            }],
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

        const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
        const marketProfileName = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey]?.name || 'Historical';
        
        // Get spending model hint
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingShortNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingHint = spendingShortNames[spendingModelKey] || 'Custom';

        const defaultName = `${profile.name} - ${marketProfileName} - ${spendingHint} - ${new Date().toLocaleDateString()}`;
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

        const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
        const marketProfileName = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey]?.name || 'Historical';
        
        // Get spending model hint
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingShortNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingHint = spendingShortNames[spendingModelKey] || 'Custom';

        const defaultName = `${profile.name} - ${marketProfileName} - ${spendingHint} - Multi - ${new Date().toLocaleDateString()}`;
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
