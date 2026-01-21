/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showErrorInContainer, showLoading } from '../../utils/dom.js';
import { formatCurrency, formatPercent, formatCompact } from '../../utils/formatters.js';
import { renderStandardTimelineChart } from '../../utils/charts.js';
import { APP_CONFIG } from '../../config.js';

// Store last analysis result for saving as scenario
let lastAnalysisResult = null;
let lastSimulations = null;
let timelineChartInstances = {}; // Changed to object to store multiple chart instances

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
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
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
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-3);">
                <div>
                    <h1 style="font-size: var(--font-2xl); margin: 0;">Retirement Analysis</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Monte Carlo simulations for <strong>${profile.name}</strong>
                    </p>
                </div>
                <div id="scenario-loader-container" style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 11px; color: var(--text-secondary); font-weight: 700;">LOAD SAVED:</span>
                    <select id="saved-scenario-select" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px; min-width: 180px;">
                        <option value="">-- Select Scenario --</option>
                    </select>
                </div>
            </div>

            <!-- Analysis Configuration -->
            <div class="analysis-panel" style="padding: 12px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                    <!-- Market Assumptions Selector -->
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 700; font-size: 12px; color: var(--accent-color);">
                            MARKET ASSUMPTIONS
                        </label>
                        <select id="market-profile-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
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
                        <div id="market-profile-description" style="margin-top: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: 700; color: var(--text-primary);">${marketProfile.name}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                <div class="form-group">
                                    <label style="font-size: 9px; margin-bottom: 2px; display: block; opacity: 0.8;">Stock %</label>
                                    <input type="number" id="custom-stock-return" value="${(marketProfile.stock_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 2px 4px; border-radius: 3px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 11px;">
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 9px; margin-bottom: 2px; display: block; opacity: 0.8;">Bond %</label>
                                    <input type="number" id="custom-bond-return" value="${(marketProfile.bond_return_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 2px 4px; border-radius: 3px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 11px;">
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 9px; margin-bottom: 2px; display: block; opacity: 0.8;">Inflation %</label>
                                    <input type="number" id="custom-inflation" value="${(marketProfile.inflation_mean * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 2px 4px; border-radius: 3px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 11px;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right side: Spending & Run -->
                    <div style="display: flex; flex-direction: column; gap: 12px;">
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

                        <div style="display: grid; grid-template-columns: 1fr 150px; gap: 10px; align-items: flex-end;">
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-weight: 700; font-size: 12px; color: var(--accent-color);">SIMULATIONS</label>
                                <select id="simulations-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                                    <option value="1000" ${parseInt(savedSimulations) === 1000 ? 'selected' : ''}>1,000</option>
                                    <option value="5000" ${parseInt(savedSimulations) === 5000 ? 'selected' : ''}>5,000</option>
                                    <option value="10000" ${parseInt(savedSimulations) === 10000 ? 'selected' : ''}>10,000</option>
                                </select>
                            </div>
                            <button id="run-analysis-btn" class="primary-btn" style="padding: 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 700; width: 100%;">
                                RUN ANALYSIS
                            </button>
                        </div>
                    </div>
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

    // Get the analysis result data (might be wrapped in lastAnalysisResult)
    const totalAssets = lastAnalysisResult?.total_assets || data.total_assets || 0;
    const yearsProjected = lastAnalysisResult?.years_projected || data.years_projected || 0;

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Simulation Results</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations || 10000).toLocaleString()} Monte Carlo simulations
            </p>
            ${totalAssets > 0 ? `
                <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--accent-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                Investment Portfolio
                                <span style="cursor: help; margin-left: 5px;" title="Retirement + Taxable accounts only. Real estate handled separately with costs and sale proceeds.">ℹ️</span>
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
                </div>
            ` : ''}

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

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Multi-Scenario Analysis</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations).toLocaleString()} Monte Carlo simulations per scenario
            </p>

            <!-- Starting Balance Highlight -->
            <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--accent-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                            Investment Portfolio
                            <span style="cursor: help; margin-left: 5px;" title="Retirement + Taxable accounts only. Real estate handled separately with costs and sale proceeds.">ℹ️</span>
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

        // Build comprehensive scenario name from simulation parameters
        const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
        const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
        const marketProfileName = marketProfile?.name || 'Historical';

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant-Inflation-Adjusted',
            'retirement_smile': 'Retirement-Smile',
            'conservative_decline': 'Conservative-Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Get stock allocation
        const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | ${marketProfileName} (${stockAllocation}% stocks) | ${spendingName} | ${simCount} sims | ${timestamp}`;

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

        // Build comprehensive multi-scenario name from simulation parameters
        const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
        const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
        const marketProfileName = marketProfile?.name || 'Historical';

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant-Inflation-Adjusted',
            'retirement_smile': 'Retirement-Smile',
            'conservative_decline': 'Conservative-Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Get stock allocation
        const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | Multi-Scenario | ${marketProfileName} (${stockAllocation}% stocks) | ${spendingName} | ${simCount} sims | ${timestamp}`;

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
 * Show modal explaining spending strategy with expenses
 */
function showSpendingStrategyExplanationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 750px; max-height: 90vh; overflow-y: auto; padding: var(--space-6); position: relative;">
            <button id="close-spending-modal" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">💰 How Spending Strategies Work</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--accent-color), #5faee3); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 Key Concept</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        <strong>Your actual expenses from the Expenses tab are ALWAYS the foundation.</strong><br><br>
                        Spending strategies are applied as MULTIPLIERS on top of your real expenses to model how spending patterns naturally change as you age.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Formula</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px; font-family: monospace; text-align: center;">
                    <div style="font-size: 16px; color: var(--text-primary); font-weight: bold; margin-bottom: 10px;">
                        Final Spending = (Your Expenses - Housing) × Strategy Multiplier + Housing
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 10px;">
                        Note: Housing costs remain constant regardless of strategy
                    </div>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Three Strategies</h3>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--success-color);">✓ Constant Inflation-Adjusted</h4>
                    <p style="margin: 0 0 10px 0; color: var(--text-secondary);">
                        <strong>Multiplier:</strong> Always 1.0x (no change)<br>
                        <strong>Best For:</strong> Conservative planning, maintaining lifestyle<br>
                        <strong>Reality:</strong> Assumes you'll spend the same (inflation-adjusted) amount every year
                    </p>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 3px solid var(--success-color);">
                        <strong>Example:</strong> $80,000/year stays $80,000/year (adjusted for inflation)
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--warning-color);">📈 Retirement Smile</h4>
                    <p style="margin: 0 0 10px 0; color: var(--text-secondary);">
                        <strong>Multiplier:</strong> 1.0x → 0.8x → 1.2x (varies by age)<br>
                        <strong>Best For:</strong> Realistic planning based on typical behavior<br>
                        <strong>Reality:</strong> High spending early (travel, activities), lower in middle years, higher again for healthcare
                    </p>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 3px solid var(--warning-color);">
                        <strong>Example:</strong> $80,000/year → $72,000 at age 75 (0.9x) → $64,000 at age 80 (0.8x) → $76,000 at age 85 (0.95x) → rises for healthcare
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="font-size: 16px; margin-bottom: 10px; color: var(--info-color);">📉 Conservative Decline</h4>
                    <p style="margin: 0 0 10px 0; color: var(--text-secondary);">
                        <strong>Multiplier:</strong> 1.0x → gradually decreases 1%/year after age 70<br>
                        <strong>Best For:</strong> Conservative planning, assuming reduced activity<br>
                        <strong>Reality:</strong> Spending gradually decreases as you become less active
                    </p>
                    <div style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 3px solid var(--info-color);">
                        <strong>Example:</strong> $80,000/year → $72,000 at age 80 (0.9x) → $64,000 at age 90 (0.8x)
                    </div>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Step-by-Step Example</h3>
                <div style="background: var(--accent-color); padding: 20px; border-radius: 8px; color: white;">
                    <p style="margin: 0 0 15px 0; font-size: 15px;">
                        <strong>Your Profile:</strong><br>
                        • Annual Expenses (from Expenses tab): $80,000<br>
                        • Housing Costs: $20,000<br>
                        • Other Expenses: $60,000<br>
                        • Selected Strategy: Retirement Smile<br>
                        • Your Age: 75
                    </p>
                    <p style="margin: 0 0 10px 0; font-size: 15px;">
                        <strong>Calculation at Age 75:</strong><br>
                        1. Multiplier for age 75 in Retirement Smile: 0.9x<br>
                        2. Non-Housing Expenses: $60,000 × 0.9 = $54,000<br>
                        3. Add Housing Back: $54,000 + $20,000 = <strong>$74,000</strong>
                    </p>
                    <p style="margin: 0; font-size: 14px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                        <strong>Result:</strong> The simulation uses $74,000 for your expenses at age 75, instead of the constant $80,000.
                    </p>
                </div>

                <div style="background: var(--warning-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>💡 Important:</strong> Spending strategies help model realistic behavior patterns while still using YOUR specific expense data as the foundation. This gives you more accurate projections than assuming constant spending forever.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button id="close-spending-modal-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('#close-spending-modal').addEventListener('click', closeModal);
    modal.querySelector('#close-spending-modal-btn').addEventListener('click', closeModal);
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

                <div style="background: var(--info-color); padding: 20px; border-radius: 8px; margin-bottom: 15px; color: white;">
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

                <div style="background: linear-gradient(135deg, var(--success-color), #26d07c); padding: 15px; border-radius: 8px; margin-bottom: 10px; color: white;">
                    <strong>Success Rate:</strong> Percentage of simulations where portfolio lasts through life expectancy
                </div>

                <div style="background: linear-gradient(135deg, var(--info-color), #5faee3); padding: 15px; border-radius: 8px; margin-bottom: 10px; color: white;">
                    <strong>Median Balance:</strong> The middle outcome - half do better, half worse
                </div>

                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 10px; color: white;">
                    <strong>10th Percentile:</strong> The "bad luck" scenario - only 10% do worse
                </div>

                <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 15px; border-radius: 8px; margin-bottom: 15px; color: white;">
                    <strong>90th Percentile:</strong> The "good luck" scenario - only 10% do better
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why Run Multiple Simulations?</h3>
                <p style="margin-bottom: 15px; color: var(--text-secondary);">
                    Markets don't give you average returns every year. One simulation might hit a bear market early (worst case),
                    another might see strong growth (best case). Running 10,000 simulations shows you the full spectrum of
                    what could happen based on historical market patterns.
                </p>

                <div style="background: var(--accent-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>💡 Pro Tip:</strong> A 85-90%+ success rate is generally considered a robust retirement plan.
                    100% is often too conservative (leaves money on the table), while below 70% suggests adjustments are needed.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button id="close-calc-modal-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
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
