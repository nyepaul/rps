/**
 * Analysis tab component - Run Monte Carlo simulations
 */

import { analysisAPI } from '../../api/analysis.js';
import { profilesAPI } from '../../api/profiles.js';
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
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
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
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="show-calculation-info" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        <span>📐</span> How Calculations Work
                    </button>
                    <div id="scenario-loader-container" style="display: flex; gap: 8px; align-items: center;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 700;">LOAD SAVED:</span>
                        <select id="saved-scenario-select" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px; min-width: 180px;">
                            <option value="">-- Select Scenario --</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Analysis Configuration -->
            <div class="analysis-panel" style="padding: 12px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <!-- Market Conditions Section -->
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label style="font-weight: 700; font-size: 14px; color: var(--accent-color);">
                            📊 MARKET CONDITIONS
                        </label>
                        <button id="market-conditions-help-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 12px; padding: 4px 8px;">
                            ℹ️ Why This Matters
                        </button>
                    </div>

                    <!-- Mode Selector -->
                    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                        <button class="market-mode-btn" data-mode="simple" style="flex: 1; padding: 8px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Simple
                        </button>
                        <button class="market-mode-btn" data-mode="preset" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Presets
                        </button>
                        <button class="market-mode-btn" data-mode="timeline" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Timeline
                        </button>
                        <button class="market-mode-btn" data-mode="cycle" style="flex: 1; padding: 8px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Cycle
                        </button>
                    </div>

                    <!-- Simple Mode (Default) -->
                    <div id="market-mode-simple" class="market-mode-content">
                        <select id="market-profile-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; margin-bottom: 8px;">
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
                        <div style="background: var(--warning-bg); color: var(--warning-text); padding: 8px; border-radius: 4px; font-size: 11px; border: 1px solid var(--warning-color);">
                            ⚠️ <strong>Note:</strong> Simple mode uses ONE market condition for your ENTIRE retirement (30-40 years). This is unrealistic. Consider using Presets or Timeline for more accurate projections.
                        </div>
                    </div>

                    <!-- Preset Mode -->
                    <div id="market-mode-preset" class="market-mode-content" style="display: none;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;" id="preset-scenarios-container">
                            ${Object.entries(APP_CONFIG.PRESET_SCENARIOS).map(([key, preset]) => `
                                <button class="preset-scenario-btn" data-preset="${key}" style="padding: 12px; background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 6px; cursor: pointer; text-align: left; transition: all 0.2s;">
                                    <div style="font-size: 24px; margin-bottom: 4px;">${preset.icon}</div>
                                    <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text-primary);">${preset.name}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${preset.description}</div>
                                </button>
                            `).join('')}
                        </div>
                        <div id="preset-selected-display" style="margin-top: 10px; padding: 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--accent-color); display: none;">
                            <strong style="color: var(--accent-color);">Selected:</strong> <span id="preset-selected-name"></span>
                        </div>
                    </div>

                    <!-- Timeline Mode -->
                    <div id="market-mode-timeline" class="market-mode-content" style="display: none;">
                        <div id="timeline-periods-container" style="margin-bottom: 10px;">
                            <!-- Timeline periods will be added here dynamically -->
                        </div>
                        <button id="add-timeline-period-btn" style="width: 100%; padding: 8px; background: var(--success-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            + Add Period
                        </button>
                    </div>

                    <!-- Cycle Mode -->
                    <div id="market-mode-cycle" class="market-mode-content" style="display: none;">
                        <div style="margin-bottom: 10px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="cycle-repeat-checkbox" checked style="cursor: pointer;">
                                <span style="font-size: 13px; color: var(--text-primary);">Repeat cycle throughout retirement</span>
                            </label>
                        </div>
                        <div id="cycle-pattern-container" style="margin-bottom: 10px;">
                            <!-- Cycle pattern elements will be added here dynamically -->
                        </div>
                        <button id="add-cycle-element-btn" style="width: 100%; padding: 8px; background: var(--success-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            + Add Phase
                        </button>
                    </div>
                </div>

                <!-- Spending Strategy & Run -->
                <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: flex-end;">
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

                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 700; font-size: 12px; color: var(--accent-color);">SIMULATIONS</label>
                        <select id="simulations-select" style="width: 100%; padding: 8px; font-size: 13px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                            <option value="1000" ${parseInt(savedSimulations) === 1000 ? 'selected' : ''}>1,000</option>
                            <option value="5000" ${parseInt(savedSimulations) === 5000 ? 'selected' : ''}>5,000</option>
                            <option value="10000" ${parseInt(savedSimulations) === 10000 ? 'selected' : ''}>10,000</option>
                        </select>
                    </div>

                    <button id="run-analysis-btn" class="primary-btn" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 700; height: fit-content;">
                        RUN ANALYSIS
                    </button>
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
            .market-mode-btn.active {
                background: var(--accent-color) !important;
                color: white !important;
                border-color: var(--accent-color) !important;
            }
            .market-mode-btn:hover {
                opacity: 0.9;
            }
            .preset-scenario-btn:hover {
                border-color: var(--accent-color);
                background: var(--bg-secondary);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .preset-scenario-btn.selected {
                border-color: var(--accent-color);
                border-width: 3px;
                background: var(--bg-secondary);
            }
            .timeline-period {
                background: var(--bg-primary);
                padding: 12px;
                border-radius: 6px;
                border: 1px solid var(--border-color);
                margin-bottom: 8px;
            }
            .cycle-phase {
                background: var(--bg-primary);
                padding: 12px;
                border-radius: 6px;
                border: 1px solid var(--border-color);
                margin-bottom: 8px;
            }
            .remove-btn {
                background: var(--danger-color);
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
            }
            .remove-btn:hover {
                opacity: 0.9;
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
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .stat-item:hover {
                border-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
    setupMarketConditionsHandlers(container, profile);
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

// Global state for market periods
let currentMarketMode = 'simple';
let selectedPreset = null;
let timelinePeriods = [];
let cyclePattern = [];
let timelinePeriodCounter = 0;
let cyclePhaseCounter = 0;

function setupMarketConditionsHandlers(container, profile) {
    // Mode switching
    const modeBtns = container.querySelectorAll('.market-mode-btn');
    const modeContents = container.querySelectorAll('.market-mode-content');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            currentMarketMode = mode;

            // Update button styles
            modeBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--bg-tertiary)';
                b.style.color = 'var(--text-primary)';
                b.style.borderColor = 'var(--border-color)';
            });
            btn.classList.add('active');

            // Show/hide content
            modeContents.forEach(content => {
                content.style.display = 'none';
            });
            const targetContent = container.querySelector(`#market-mode-${mode}`);
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // Reset selections when switching modes
            if (mode !== 'preset') {
                selectedPreset = null;
            }
        });
    });

    // Preset scenario selection
    const presetBtns = container.querySelectorAll('.preset-scenario-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetKey = btn.getAttribute('data-preset');
            selectedPreset = presetKey;

            // Update button styles
            presetBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            // Show selected display
            const display = container.querySelector('#preset-selected-display');
            const nameSpan = container.querySelector('#preset-selected-name');
            if (display && nameSpan) {
                nameSpan.textContent = APP_CONFIG.PRESET_SCENARIOS[presetKey].name;
                display.style.display = 'block';
            }
        });
    });

    // Timeline: Add period button
    const addTimelinePeriodBtn = container.querySelector('#add-timeline-period-btn');
    if (addTimelinePeriodBtn) {
        addTimelinePeriodBtn.addEventListener('click', () => {
            addTimelinePeriod(container, profile);
        });
    }

    // Cycle: Add phase button
    const addCycleElementBtn = container.querySelector('#add-cycle-element-btn');
    if (addCycleElementBtn) {
        addCycleElementBtn.addEventListener('click', () => {
            addCyclePhase(container);
        });
    }

    // Market conditions help button
    const marketConditionsHelpBtn = container.querySelector('#market-conditions-help-btn');
    if (marketConditionsHelpBtn) {
        marketConditionsHelpBtn.addEventListener('click', () => {
            showMarketConditionsExplanationModal();
        });
    }

    // Initialize with one timeline period and one cycle phase
    addTimelinePeriod(container, profile);
    addCyclePhase(container);
}

function addTimelinePeriod(container, profile) {
    const periodsContainer = container.querySelector('#timeline-periods-container');
    const periodId = timelinePeriodCounter++;
    const retirementYear = new Date(profile.retirement_date).getFullYear();
    const currentYear = new Date().getFullYear();

    const periodDiv = document.createElement('div');
    periodDiv.className = 'timeline-period';
    periodDiv.setAttribute('data-period-id', periodId);
    periodDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: end;">
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Start Year</label>
                <input type="number" class="period-start-year" value="${retirementYear + (timelinePeriods.length * 5)}" min="${currentYear}" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">End Year</label>
                <input type="number" class="period-end-year" value="${retirementYear + (timelinePeriods.length * 5) + 4}" min="${currentYear}" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Market Condition</label>
                <select class="period-market-profile" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
                    ${Object.keys(APP_CONFIG.MARKET_PROFILES).map(key => `
                        <option value="${key}">${APP_CONFIG.MARKET_PROFILES[key].name}</option>
                    `).join('')}
                </select>
            </div>
            <button class="remove-btn remove-period-btn" data-period-id="${periodId}" style="padding: 6px 12px;">Remove</button>
        </div>
    `;

    periodsContainer.appendChild(periodDiv);

    // Add remove handler
    const removeBtn = periodDiv.querySelector('.remove-period-btn');
    removeBtn.addEventListener('click', () => {
        periodDiv.remove();
        timelinePeriods = timelinePeriods.filter(p => p.id !== periodId);
    });

    // Track period
    timelinePeriods.push({
        id: periodId,
        element: periodDiv
    });
}

function addCyclePhase(container) {
    const patternsContainer = container.querySelector('#cycle-pattern-container');
    const phaseId = cyclePhaseCounter++;

    const phaseDiv = document.createElement('div');
    phaseDiv.className = 'cycle-phase';
    phaseDiv.setAttribute('data-phase-id', phaseId);
    phaseDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 120px 1fr auto; gap: 8px; align-items: end;">
            <div>
                <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Duration (years)</label>
                <input type="number" class="phase-duration" value="${cyclePattern.length === 0 ? 7 : cyclePattern.length === 1 ? 2 : 3}" min="1" max="20" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
            </div>
                        <div>
                            <label style="font-size: 11px; display: block; margin-bottom: 4px; color: var(--text-secondary);">Market Condition</label>
                            <select class="phase-market-profile" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
                                ${Object.keys(APP_CONFIG.MARKET_PROFILES).map(key => `
                                    <option value="${key}">${APP_CONFIG.MARKET_PROFILES[key].name}</option>
                                `).join('')}
                            </select>
                        </div>            <button class="remove-btn remove-phase-btn" data-phase-id="${phaseId}" style="padding: 6px 12px;">Remove</button>
        </div>
    `;

    patternsContainer.appendChild(phaseDiv);

    // Add remove handler
    const removeBtn = phaseDiv.querySelector('.remove-phase-btn');
    removeBtn.addEventListener('click', () => {
        phaseDiv.remove();
        cyclePattern = cyclePattern.filter(p => p.id !== phaseId);
    });

    // Track phase
    cyclePattern.push({
        id: phaseId,
        element: phaseDiv
    });
}

function showMarketConditionsExplanationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">📊 Why Market Conditions Matter</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--danger-color), #e74c3c); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🚨 Critical Issue with "Simple" Mode</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        <strong>Simple mode uses ONE market condition for your ENTIRE 30-40 year retirement.</strong><br><br>
                        This is fundamentally unrealistic. No retirement experiences 30 years of continuous recession OR continuous bull market. Real retirements span multiple market cycles.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Sequence of Returns Risk</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        <strong>The most important risk in retirement:</strong> WHEN market crashes happen matters more than IF they happen.<br><br>

                        • <strong>Early Crash:</strong> A market crash in years 1-5 of retirement can devastate your portfolio because you're withdrawing during the downturn<br>
                        • <strong>Mid Crash:</strong> Less damaging but still significant<br>
                        • <strong>Late Crash:</strong> Least impactful since you've already withdrawn most of what you need
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">The Four Modes Explained</h3>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--text-primary);">1️⃣ Simple Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Uses one market condition for entire retirement. Unrealistic but useful for understanding individual market profiles. Always supplement with Preset or Timeline analysis.
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--success-color);">2️⃣ Preset Scenarios (Recommended)</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Pre-configured realistic scenarios modeling sequence of returns risk:<br>
                        • Early Retirement Crash - Worst case<br>
                        • Lucky Start - Best case<br>
                        • Mid-Retirement Crisis<br>
                        • Realistic Market Cycles - Repeating economic cycles<br>
                        <strong>Start here if you're unsure!</strong>
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--info-color);">3️⃣ Timeline Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Define specific year ranges with different market conditions. Perfect for testing "what if" scenarios:<br>
                        • What if recession happens in years 2028-2030?<br>
                        • What if strong bull market in first 10 years?<br>
                        Gives you precise control over when market conditions occur.
                    </p>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="font-size: 16px; margin-bottom: 8px; color: var(--warning-color);">4️⃣ Cycle Mode</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                        Define a repeating pattern of market phases:<br>
                        • 7 years expansion → 2 years recession → 3 years recovery (repeat)<br>
                        Models realistic economic cycles throughout retirement.
                    </p>
                </div>

                <div style="background: var(--accent-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>💡 Best Practice:</strong> Run analysis with multiple approaches:<br>
                    1. Start with "Early Retirement Crash" preset (worst case)<br>
                    2. Try "Realistic Market Cycles" preset (typical case)<br>
                    3. Try "Lucky Start" preset (best case)<br><br>
                    This gives you a realistic range of outcomes instead of a single unrealistic projection.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
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
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Real Estate (%)</label>
                            <input type="number" id="custom-reit-return" value="${((selectedProfile.reit_return_mean || 0.08) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Gold (%)</label>
                            <input type="number" id="custom-gold-return" value="${((selectedProfile.gold_return_mean || 0.04) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11px; margin-bottom: 4px; display: block;">Crypto (%)</label>
                            <input type="number" id="custom-crypto-return" value="${((selectedProfile.crypto_return_mean || 0.20) * 100).toFixed(1)}" step="0.1" style="width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
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

            // Create custom market profile from inputs (used for simple mode and base assumptions)
            const customStockReturn = container.querySelector('#custom-stock-return');
            const customBondReturn = container.querySelector('#custom-bond-return');
            const customInflation = container.querySelector('#custom-inflation');
            const customReitReturn = container.querySelector('#custom-reit-return');
            const customGoldReturn = container.querySelector('#custom-gold-return');
            const customCryptoReturn = container.querySelector('#custom-crypto-return');

            const marketProfile = {
                ...templateProfile,
                stock_return_mean: customStockReturn ? parseFloat(customStockReturn.value) / 100 : templateProfile.stock_return_mean,
                bond_return_mean: customBondReturn ? parseFloat(customBondReturn.value) / 100 : templateProfile.bond_return_mean,
                inflation_mean: customInflation ? parseFloat(customInflation.value) / 100 : templateProfile.inflation_mean,
                reit_return_mean: customReitReturn ? parseFloat(customReitReturn.value) / 100 : (templateProfile.reit_return_mean || 0.08),
                gold_return_mean: customGoldReturn ? parseFloat(customGoldReturn.value) / 100 : (templateProfile.gold_return_mean || 0.04),
                crypto_return_mean: customCryptoReturn ? parseFloat(customCryptoReturn.value) / 100 : (templateProfile.crypto_return_mean || 0.20)
            };

            const spendingModel = spendingModelSelect?.value || 'constant_real';

            // Collect market periods based on current mode
            let marketPeriods = null;
            const retirementYear = new Date(profile.retirement_date).getFullYear();
            const currentYear = new Date().getFullYear();

            if (currentMarketMode === 'preset' && selectedPreset) {
                // Use preset scenario
                const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
                const yearsProjected = 40; // Approximate, actual will be calculated by backend
                marketPeriods = preset.buildPeriods(currentYear, retirementYear, yearsProjected);
            } else if (currentMarketMode === 'timeline') {
                // Build timeline from user input
                const periods = [];
                const periodElements = container.querySelectorAll('.timeline-period');

                periodElements.forEach(elem => {
                    const startYear = parseInt(elem.querySelector('.period-start-year').value);
                    const endYear = parseInt(elem.querySelector('.period-end-year').value);
                    const profileKey = elem.querySelector('.period-market-profile').value;
                    const profileData = APP_CONFIG.MARKET_PROFILES[profileKey];

                    if (profileData && startYear && endYear && startYear <= endYear) {
                        periods.push({
                            start_year: startYear,
                            end_year: endYear,
                            assumptions: {
                                ...profileData
                            }
                        });
                    }
                });

                if (periods.length > 0) {
                    marketPeriods = {
                        type: 'timeline',
                        periods: periods
                    };
                }
            } else if (currentMarketMode === 'cycle') {
                // Build cycle pattern from user input
                const pattern = [];
                const phaseElements = container.querySelectorAll('.cycle-phase');

                phaseElements.forEach(elem => {
                    const duration = parseInt(elem.querySelector('.phase-duration').value);
                    const profileKey = elem.querySelector('.phase-market-profile').value;
                    const profileData = APP_CONFIG.MARKET_PROFILES[profileKey];

                    if (profileData && duration && duration > 0) {
                        pattern.push({
                            duration: duration,
                            assumptions: {
                                ...profileData
                            }
                        });
                    }
                });

                if (pattern.length > 0) {
                    const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
                    marketPeriods = {
                        type: 'cycle',
                        pattern: pattern,
                        repeat: repeatCheckbox ? repeatCheckbox.checked : true
                    };
                }
            }
            // If currentMarketMode === 'simple', marketPeriods remains null (uses base marketProfile)

            // Pass spending model and market periods to API
            const result = await analysisAPI.runAnalysis(profile.name, simulations, marketProfile, spendingModel, marketPeriods);

            // DEBUG: Log the response
            console.log('Analysis API Response:', JSON.stringify(result, null, 2));

            // Store for saving as scenario
            lastAnalysisResult = result;
            lastSimulations = simulations;

            // Display results
            displayResults(resultsContainer, result, profile, simulations);

            // Update profile to record that analysis was run
            try {
                const updatedData = { ...profile.data, last_analysis_date: new Date().toISOString() };
                await profilesAPI.update(profile.name, { data: updatedData });
                // Update store with new profile data
                const updatedProfile = { ...profile, data: updatedData };
                store.setState({ currentProfile: updatedProfile });
            } catch (updateError) {
                console.warn('Could not update profile with analysis date:', updateError);
            }

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

            ${data.warnings && data.warnings.length > 0 ? `
                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 20px; color: white;">
                    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Market Period Warnings</div>
                    ${data.warnings.map(warning => `<div style="margin-bottom: 8px; font-size: 13px;">• ${warning}</div>`).join('')}
                </div>
            ` : ''}

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

    // Add click handlers to stat items for explanations
    setupStatItemClickHandlers(container);

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

    // Check if any scenario has warnings
    const anyWarnings = Object.values(scenarios).some(s => s.warnings && s.warnings.length > 0);
    const allWarnings = anyWarnings ? Object.values(scenarios).flatMap(s => s.warnings || []).filter((v, i, a) => a.indexOf(v) === i) : [];

    container.innerHTML = `
        <div class="result-card">
            <h2 style="font-size: 24px; margin-bottom: 10px;">Multi-Scenario Analysis</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                Based on ${(data.simulations || simulations).toLocaleString()} Monte Carlo simulations per scenario
            </p>

            ${allWarnings.length > 0 ? `
                <div style="background: linear-gradient(135deg, var(--warning-color), #f39c12); padding: 15px; border-radius: 8px; margin-bottom: 20px; color: white;">
                    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Market Period Warnings</div>
                    ${allWarnings.map(warning => `<div style="margin-bottom: 8px; font-size: 13px;">• ${warning}</div>`).join('')}
                </div>
            ` : ''}

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

    // Add click handlers to stat items for explanations in all scenarios
    setupStatItemClickHandlers(container);

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

        // Build market condition description based on the mode used
        let marketDescription = '';

        if (currentMarketMode === 'preset' && selectedPreset) {
            // Preset mode: use the preset name
            const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
            marketDescription = preset?.name || 'Preset';
        } else if (currentMarketMode === 'timeline') {
            // Timeline mode: count the periods
            const periodCount = container.querySelectorAll('.timeline-period').length;
            marketDescription = `Timeline (${periodCount} period${periodCount !== 1 ? 's' : ''})`;
        } else if (currentMarketMode === 'cycle') {
            // Cycle mode: count phases and note repeat setting
            const phaseCount = container.querySelectorAll('.cycle-phase').length;
            const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
            const repeats = repeatCheckbox?.checked ? 'repeating' : 'once';
            marketDescription = `Cycle (${phaseCount} phase${phaseCount !== 1 ? 's' : ''}, ${repeats})`;
        } else {
            // Simple mode: use market profile name and stock allocation
            const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
            const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
            const marketProfileName = marketProfile?.name || 'Historical';
            const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);
            marketDescription = `${marketProfileName} (${stockAllocation}% stocks)`;
        }

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | ${marketDescription} | ${spendingName} | ${simCount} sims | ${timestamp}`;

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

        // Build market condition description based on the mode used
        let marketDescription = '';

        if (currentMarketMode === 'preset' && selectedPreset) {
            // Preset mode: use the preset name
            const preset = APP_CONFIG.PRESET_SCENARIOS[selectedPreset];
            marketDescription = preset?.name || 'Preset';
        } else if (currentMarketMode === 'timeline') {
            // Timeline mode: count the periods
            const periodCount = container.querySelectorAll('.timeline-period').length;
            marketDescription = `Timeline (${periodCount} period${periodCount !== 1 ? 's' : ''})`;
        } else if (currentMarketMode === 'cycle') {
            // Cycle mode: count phases and note repeat setting
            const phaseCount = container.querySelectorAll('.cycle-phase').length;
            const repeatCheckbox = container.querySelector('#cycle-repeat-checkbox');
            const repeats = repeatCheckbox?.checked ? 'repeating' : 'once';
            marketDescription = `Cycle (${phaseCount} phase${phaseCount !== 1 ? 's' : ''}, ${repeats})`;
        } else {
            // Simple mode: use market profile name and stock allocation
            const savedMarketProfileKey = localStorage.getItem('rps_market_profile') || 'historical';
            const marketProfile = APP_CONFIG.MARKET_PROFILES[savedMarketProfileKey];
            const marketProfileName = marketProfile?.name || 'Historical';
            const stockAllocation = Math.round((marketProfile?.stock_allocation || 0.5) * 100);
            marketDescription = `${marketProfileName} (${stockAllocation}% stocks)`;
        }

        // Get spending model
        const spendingModelSelect = container.querySelector('#spending-model-select');
        const spendingModelKey = spendingModelSelect?.value || 'constant_real';
        const spendingFullNames = {
            'constant_real': 'Constant',
            'retirement_smile': 'Smile',
            'conservative_decline': 'Decline'
        };
        const spendingName = spendingFullNames[spendingModelKey] || 'Custom';

        // Get simulations count
        const simulationsSelect = container.querySelector('#simulations-select');
        const simCount = simulationsSelect?.value || lastSimulations || '10000';

        // Build descriptive name with key parameters
        const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const defaultName = `${profile.name} | Multi | ${marketDescription} | ${spendingName} | ${simCount} sims | ${timestamp}`;

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
 * Setup click handlers on stat items to show explanation modals
 */
function setupStatItemClickHandlers(container) {
    // Find all stat items and attach appropriate click handlers
    const statItems = container.querySelectorAll('.stat-item');

    statItems.forEach(item => {
        const label = item.querySelector('.stat-label');
        if (!label) return;

        const labelText = label.textContent.trim();

        // Determine which modal to show based on label text
        if (labelText.includes('Success Rate')) {
            item.addEventListener('click', showSuccessRateModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Median Final Balance')) {
            item.addEventListener('click', showMedianBalanceModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('10th Percentile')) {
            item.addEventListener('click', () => showPercentileModal(10));
            item.style.cursor = 'pointer';
        } else if (labelText.includes('90th Percentile')) {
            item.addEventListener('click', () => showPercentileModal(90));
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Expected Value')) {
            item.addEventListener('click', showExpectedValueModal);
            item.style.cursor = 'pointer';
        } else if (labelText.includes('Std Deviation')) {
            item.addEventListener('click', showStdDeviationModal);
            item.style.cursor = 'pointer';
        }
    });
}

/**
 * Show modal explaining Success Rate metric
 */
function showSuccessRateModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--success-color);">📊 Success Rate</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--success-color), #26d07c); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The percentage of Monte Carlo simulations where your portfolio lasted through your entire projected retirement without running out of money.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Run thousands of simulations with randomized market returns<br>
                        2. Count how many simulations ended with money remaining<br>
                        3. Divide successful simulations by total simulations<br><br>
                        <strong>Example:</strong> If 8,500 out of 10,000 simulations didn't run out of money, your success rate is 85%.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--success-color);">90%+ (Excellent):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Very robust plan. You can retire with confidence. Your plan handles most market scenarios including prolonged downturns.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">75-89% (Good):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Solid plan with acceptable risk. Consider small adjustments like working 1-2 more years or reducing spending by 5-10%.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--danger-color);">Below 75% (Needs Attention):</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Plan needs adjustments. Consider: delaying retirement, increasing savings, reducing expenses, or adjusting portfolio allocation.
                        </p>
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <strong>💡 Important Note:</strong> 100% success rate often means you're being too conservative and leaving money on the table. A 85-95% success rate typically represents an optimal balance between security and enjoying your wealth.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Median Final Balance metric
 */
function showMedianBalanceModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--info-color);">💰 Median Final Balance</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The middle outcome from all simulations - half of the scenarios ended with more money than this, and half ended with less. This represents your "typical" outcome.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Collect final portfolio balances from all simulations<br>
                        2. Sort all outcomes from lowest to highest<br>
                        3. Take the middle value (50th percentile)<br><br>
                        <strong>Example:</strong> If you run 10,000 simulations and sort them, the median is the balance at position 5,000.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why Median vs Average?</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        The median is more useful than the average (expected value) because it's not skewed by extreme outcomes. A few very successful simulations can pull the average up significantly, making it less representative of a typical outcome.<br><br>
                        <strong>Think of it this way:</strong> If you retire 100 times, the median tells you what would happen in the 50th "most typical" retirement.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--success-color);">Positive Balance:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Your plan is likely successful. You'll probably have money left over in a typical scenario.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Close to Zero:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Your plan is cutting it close. Consider adjustments to add a margin of safety.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--danger-color);">Zero or Negative:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            In a typical scenario, you run out of money. Plan needs significant adjustments.
                        </p>
                    </div>
                </div>

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
                    <strong>💡 Pro Tip:</strong> A high median final balance suggests you might be able to spend more in retirement or retire earlier. Consider running scenarios with increased spending to optimize your plan.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Percentile metrics
 */
function showPercentileModal(percentile) {
    const is10th = percentile === 10;
    const color = is10th ? 'var(--warning-color)' : 'var(--success-color)';
    const title = is10th ? '10th Percentile' : '90th Percentile';
    const emoji = is10th ? '📉' : '📈';

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: ${color};">${emoji} ${title}</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, ${color}, ${is10th ? '#f39c12' : '#26d07c'}); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        ${is10th
                            ? 'The "bad luck" scenario. Only 10% of simulations performed worse than this. This represents what happens if markets are poor during your retirement.'
                            : 'The "good luck" scenario. Only 10% of simulations performed better than this. This represents what happens if markets are favorable during your retirement.'}
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Sort all simulation outcomes from lowest to highest<br>
                        2. ${is10th ? 'Find the value at the 10% position' : 'Find the value at the 90% position'}<br>
                        3. ${is10th ? '90% of outcomes are better than this' : '90% of outcomes are worse than this'}<br><br>
                        <strong>Example:</strong> In 10,000 simulations, the ${title.toLowerCase()} is the balance at position ${is10th ? '1,000' : '9,000'}.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Real-World Analogy</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        ${is10th
                            ? '<strong>Imagine retiring into the Great Recession or a prolonged bear market.</strong><br><br>This scenario captures what happens when you face poor market conditions early in retirement - often called "sequence of returns risk." A recession in your first 5-10 retirement years can have a lasting impact on your portfolio.'
                            : '<strong>Imagine retiring at the start of a bull market with strong growth.</strong><br><br>This scenario captures what happens when markets perform well during your retirement. While this is the optimistic case, don\'t count on it - plan for the median or 10th percentile instead.'}
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Use This Information</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    ${is10th
                        ? `<div style="margin-bottom: 15px;">
                            <strong style="color: var(--success-color);">Positive Balance:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                Even in the worst 10% of outcomes, you still have money. Very strong plan!
                            </p>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--warning-color);">Close to Zero:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                If unlucky with market timing, you might just barely make it. Consider adding a buffer.
                            </p>
                        </div>
                        <div>
                            <strong style="color: var(--danger-color);">Zero:</strong>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                                Poor market timing would exhaust your portfolio. This is your downside risk - plan accordingly.
                            </p>
                        </div>`
                        : `<div>
                            <p style="margin: 0; color: var(--text-secondary);">
                                The 90th percentile shows your upside potential. If markets perform well, you could have significantly more wealth than expected. However, <strong>don't plan around this optimistic scenario</strong> - use it to understand your potential for legacy wealth or charitable giving if markets are favorable.
                            </p>
                        </div>`}
                </div>

                <div style="background: ${color}; padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>💡 ${is10th ? 'Risk Management' : 'Opportunity Planning'}:</strong>
                    ${is10th
                        ? 'Focus on this metric for risk assessment. If you can survive the 10th percentile scenario comfortably, your plan is robust against market downturns.'
                        : 'Use this metric to understand your upside. If the 90th percentile is very high, you might consider more aggressive spending or leaving a larger legacy.'}
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Expected Value metric
 */
function showExpectedValueModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: var(--accent-color);">🎲 Expected Value</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, var(--accent-color), #5faee3); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        The mathematical average (mean) of all simulation outcomes. This is the simple average of all final portfolio balances across all simulations.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Add up all final portfolio balances from every simulation<br>
                        2. Divide by the total number of simulations<br><br>
                        <strong>Formula:</strong> Expected Value = Sum of all outcomes ÷ Number of simulations<br><br>
                        <strong>Example:</strong> If 10,000 simulations average to a total of $50 billion, the expected value is $5 million.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Why It's Often Higher Than Median</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">
                        Retirement portfolios have <strong>asymmetric risk</strong>:<br><br>
                        • <strong>Downside is limited:</strong> You can only lose 100% (portfolio goes to $0)<br>
                        • <strong>Upside is unlimited:</strong> Strong markets can multiply your wealth many times<br><br>
                        This means a few very successful simulations (10x or 20x growth in bull markets) can pull the average way up, even though most outcomes cluster around the median.<br><br>
                        <strong>Result:</strong> The expected value is typically much higher than the median because of these extreme positive outliers.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Interpret</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Don't Plan Around This Number</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            The expected value is NOT what you should expect in retirement. It's heavily influenced by unlikely best-case scenarios. Focus on the median instead.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--info-color);">Use It For Portfolio Growth Understanding</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            It shows how much compound growth potential your portfolio has over time. A high expected value relative to starting balance indicates strong growth assumptions.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--success-color);">Legacy and Estate Planning</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            If you're interested in leaving wealth to heirs, this metric shows the average amount you might leave behind.
                        </p>
                    </div>
                </div>

                <div style="background: var(--warning-color); padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>⚠️ Important Warning:</strong> Because the expected value includes unlikely best-case scenarios, it's often 2-3x higher than the median. Don't mistake this for a typical outcome - use the median for realistic planning.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Show modal explaining Standard Deviation metric
 */
function showStdDeviationModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative;">
            <button class="close-modal-btn" style="position: absolute; top: 15px; right: 15px; background: var(--bg-tertiary); border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>

            <h2 style="font-size: 28px; margin-bottom: 20px; color: #9b59b6;">📊 Standard Deviation</h2>

            <div style="line-height: 1.8; color: var(--text-primary);">
                <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
                    <h3 style="font-size: 20px; margin: 0 0 12px 0; font-weight: bold;">🎯 What It Means</h3>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                        A measure of uncertainty and volatility. It shows how spread out the simulation outcomes are. Higher standard deviation = more uncertainty and wider range of possible outcomes.
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How It's Calculated</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: var(--text-secondary);">
                        1. Find the expected value (average)<br>
                        2. Calculate how far each outcome deviates from the average<br>
                        3. Square those deviations, average them, then take the square root<br><br>
                        <strong>Formula:</strong> σ = √[Σ(x - μ)² / n]<br>
                        Where x = each outcome, μ = mean, n = number of simulations
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">What Does This Tell You?</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--info-color);">Outcome Uncertainty</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Higher standard deviation means there's a bigger spread between best-case and worst-case scenarios. You have less predictability about your final outcome.
                        </p>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <strong style="color: var(--warning-color);">Portfolio Volatility Impact</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            Aggressive portfolios (80-100% stocks) typically have higher standard deviations. Conservative portfolios (30-40% stocks) have lower standard deviations.
                        </p>
                    </div>
                    <div>
                        <strong style="color: var(--success-color);">Risk Tolerance Gauge</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">
                            A high standard deviation relative to your starting portfolio indicates you're taking on significant risk. Make sure you're comfortable with that level of uncertainty.
                        </p>
                    </div>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">Real-World Example</h3>
                <div style="background: var(--accent-color); padding: 20px; border-radius: 8px; margin-bottom: 15px; color: white;">
                    <p style="margin: 0; line-height: 1.6;">
                        <strong>Scenario A:</strong> Expected value = $5M, Std Dev = $2M<br>
                        → Most outcomes fall between $3M and $7M (within 1 standard deviation)<br><br>

                        <strong>Scenario B:</strong> Expected value = $5M, Std Dev = $10M<br>
                        → Outcomes could range wildly from -$5M (ran out) to $15M+<br><br>

                        Both have the same expected value, but Scenario B has much more uncertainty!
                    </p>
                </div>

                <h3 style="font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: var(--text-primary);">How to Use This Information</h3>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 0 0 10px 0; color: var(--text-secondary);">
                        <strong>Compare Allocation Strategies:</strong> Look at how standard deviation changes between conservative, moderate, and aggressive portfolios. Higher stock allocation = higher standard deviation = more uncertainty.
                    </p>
                    <p style="margin: 0; color: var(--text-secondary);">
                        <strong>Risk-Adjusted Planning:</strong> If you see high standard deviation alongside a low median, that's a red flag - you have high uncertainty AND low typical outcomes. Consider adjusting your plan.
                    </p>
                </div>

                <div style="background: #9b59b6; padding: 15px; border-radius: 8px; margin-top: 20px; color: white;">
                    <strong>💡 Pro Tip:</strong> Don't obsess over this number - it's more of an academic metric. Focus on success rate and median balance for practical planning. Standard deviation is useful mainly for comparing allocation strategies.
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button class="close-modal-bottom-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Got It!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    modal.querySelector('.close-modal-bottom-btn').addEventListener('click', closeModal);
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

                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
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

                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--info-color); color: var(--text-primary);">
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
