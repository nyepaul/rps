/**
 * Cash Flow Tab Component
 * Shows money coming in and going out over time
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { scenariosAPI } from '../../api/scenarios.js';
import { analysisAPI } from '../../api/analysis.js';
import { APP_CONFIG } from '../../config.js';
import { calculateAllocation } from '../../utils/financial-calculations.js';
import { getChartThemeColors, registerChartForThemeUpdates } from '../../utils/charts.js';

// Track metric visibility state across chart refreshes
const metricVisibilityState = {
    'work-income': false,         // false = visible, true = hidden
    'retirement-benefits': false,
    'investment-withdrawals': false,
    'expenses': false,
    'net-cash-flow': false
};

export function renderCashFlowTab(container) {
    // Clean up previous keyboard handler if exists
    if (container._cashflowKeyboardHandler) {
        document.removeEventListener('keydown', container._cashflowKeyboardHandler);
        container._cashflowKeyboardHandler = null;
    }

    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8);">
                <div style="font-size: 48px; margin-bottom: var(--space-5);">💸</div>
                <h2 style="margin-bottom: var(--space-3);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-5);">
                    Please create or select a profile to view cash flow.
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

    const data = profile.data || {};
    const incomeStreams = data.income_streams || [];
    const financial = data.financial || {};
    const budget = data.budget || {};

    // Calculate current date and projection range
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Calculate months to life expectancy from profile
    const birthDate = profile.birth_date ? new Date(profile.birth_date) : null;
    const lifeExpectancyAge = data.person?.life_expectancy || 95; // Get from profile, default 95
    let monthsToLifeExpectancy = 360; // Default fallback

    if (birthDate) {
        const currentAge = (today - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
        const yearsRemaining = Math.max(0, lifeExpectancyAge - currentAge);
        monthsToLifeExpectancy = Math.ceil(yearsRemaining * 12);
    }

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="margin-bottom: var(--space-3);">
                <h1 style="font-size: var(--font-2xl); margin-bottom: 2px;">💸 Cash Flow</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    Visualize money coming in and going out over time. Investment withdrawals follow the tax-efficient strategy.
                </p>
            </div>

            <!-- Controls -->
            <div style="background: var(--bg-secondary); padding: var(--space-2) var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); display: flex; gap: var(--space-3); align-items: flex-end; flex-wrap: wrap; border: 1px solid var(--border-color);">
                <div>
                    <label style="display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--text-secondary);">Time Period</label>
                    <select id="time-period" style="padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                        <option value="12">Next 12 months</option>
                        <option value="24">Next 24 months</option>
                        <option value="36">Next 36 months</option>
                        <option value="60">Next 5 years</option>
                        <option value="120">Next 10 years</option>
                        <option value="180">Next 15 years</option>
                        <option value="240">Next 20 years</option>
                        <option value="300">Next 25 years</option>
                        <option value="360">Next 30 years</option>
                        <option value="life" selected>Life (Age ${lifeExpectancyAge})</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--text-secondary);">View</label>
                    <select id="view-type" style="padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                        <option value="monthly">Monthly</option>
                        <option value="annual" selected>Annual</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--text-secondary);">Market Scenario</label>
                    <select id="market-scenario" style="padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; min-width: 130px;">
                        ${Object.keys(APP_CONFIG).includes('MARKET_PROFILES') ? 
                            Object.keys(APP_CONFIG.MARKET_PROFILES).map(key => `
                                <option value="${key}" ${key === 'balanced' ? 'selected' : ''}>${APP_CONFIG.MARKET_PROFILES[key].name}</option>
                            `).join('') : `
                            <option value="conservative">Conservative (30/70)</option>
                            <option value="moderate" selected>Moderate (60/40)</option>
                            <option value="aggressive">Aggressive (80/20)</option>
                        `}
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--text-secondary);">Compare Scenario</label>
                    <select id="scenario-select" style="padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px; min-width: 150px;">
                        <option value="">None</option>
                    </select>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button id="refresh-chart" style="padding: 4px 10px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                        Refresh
                    </button>
                    <button id="reset-zoom" style="padding: 4px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;">
                        Reset Zoom
                    </button>
                </div>
            </div>

            <!-- Chart -->
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                <canvas id="cashflow-chart" style="max-height: 700px;"></canvas>
            </div>

            <!-- Summary Cards -->
            <div id="summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 12px;"></div>

            <!-- Detailed Table -->
            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h2 style="font-size: 15px; margin: 0;" id="table-title">Cash Flow Details</h2>
                </div>
                <div id="cashflow-table" style="overflow-x: auto;"></div>
            </div>
        </div>
    `;

    // Initialize chart and data with default: through life expectancy, annual view, moderate scenario
    (async () => {
        try {
            await renderCashFlowChart(container, profile, monthsToLifeExpectancy, 'annual', null, monthsToLifeExpectancy, lifeExpectancyAge, 'balanced');
            setupEventHandlers(container, profile, monthsToLifeExpectancy, lifeExpectancyAge);
        } catch (error) {
            console.error('Error initializing cash flow chart:', error);
            const chartContainer = container.querySelector('#cashflow-chart')?.parentElement;
            if (chartContainer) {
                chartContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 700px; flex-direction: column; gap: 12px; color: var(--danger-color);">
                        <div style="font-size: 32px;">⚠️</div>
                        <div style="font-size: 14px;">Failed to initialize chart</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${error.message}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Check browser console for details</div>
                    </div>
                `;
            }
        }
    })();

    // Load scenarios for the dropdown
    loadScenarios(container, profile);
}

/**
 * Load scenarios for the dropdown
 */
async function loadScenarios(container, profile) {
    try {
        const response = await scenariosAPI.list();
        const scenarios = response.scenarios || [];

        // Filter scenarios for current profile
        const profileScenarios = scenarios.filter(s =>
            s.profile_id === profile.id || s.name.includes(profile.name)
        );

        const scenarioSelect = container.querySelector('#scenario-select');
        if (scenarioSelect) {
            // Clear existing options except "None"
            scenarioSelect.innerHTML = '<option value="">None</option>';

            // Add scenario options
            profileScenarios.forEach(scenario => {
                const option = document.createElement('option');
                option.value = scenario.id;
                option.textContent = scenario.name;
                scenarioSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load scenarios:', error);
    }
}

/**
 * Setup event handlers
 */
function setupEventHandlers(container, profile, monthsToLifeExpectancy, lifeExpectancyAge) {
    const timePeriodSelect = container.querySelector('#time-period');
    const viewTypeSelect = container.querySelector('#view-type');
    const marketScenarioSelect = container.querySelector('#market-scenario');
    const scenarioSelect = container.querySelector('#scenario-select');
    const refreshBtn = container.querySelector('#refresh-chart');
    const resetZoomBtn = container.querySelector('#reset-zoom');
    const resetMetricsBtn = container.querySelector('#reset-metrics');

    const refresh = async () => {
        const periodValue = timePeriodSelect.value;
        const months = periodValue === 'life' ? monthsToLifeExpectancy : parseInt(periodValue);
        const viewType = viewTypeSelect.value;
        const marketScenario = marketScenarioSelect.value;
        const scenarioId = scenarioSelect.value;

        // Load scenario data if selected
        let scenarioData = null;
        if (scenarioId) {
            try {
                const response = await scenariosAPI.get(scenarioId);
                scenarioData = response.scenario;
                console.log('Loaded scenario data:', scenarioData);
                console.log('Scenario results:', scenarioData?.results);
                console.log('Timeline:', scenarioData?.results?.timeline);
            } catch (error) {
                console.error('Failed to load scenario:', error);
            }
        }

        await renderCashFlowChart(container, profile, months, viewType, scenarioData, monthsToLifeExpectancy, lifeExpectancyAge, marketScenario);
    };

    timePeriodSelect.addEventListener('change', () => refresh());
    viewTypeSelect.addEventListener('change', () => refresh());
    marketScenarioSelect.addEventListener('change', () => refresh());
    scenarioSelect.addEventListener('change', () => refresh());
    refreshBtn.addEventListener('click', () => refresh());

    // Reset zoom button
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            if (window.cashFlowChart) {
                window.cashFlowChart.resetZoom();
            }
        });
    }

    // Reset metrics button - show all metrics
    if (resetMetricsBtn) {
        resetMetricsBtn.addEventListener('click', () => {
            // Reset all metrics to visible
            Object.keys(metricVisibilityState).forEach(key => {
                metricVisibilityState[key] = false;
            });

            // Apply to chart
            if (window.cashFlowChart) {
                window.cashFlowChart.data.datasets.forEach((dataset, index) => {
                    // Keep first 5 datasets (the main metrics) visible, leave others as-is
                    if (index < 5) {
                        dataset.hidden = false;
                    }
                });
                window.cashFlowChart.update();
            }

            // Restore card visual state
            const metricCards = container.querySelectorAll('.metric-card');
            metricCards.forEach(card => {
                card.style.borderColor = 'rgba(255, 255, 255, 0.9)';
                card.style.opacity = '1';
                card.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
            });
        });
    }

    // Handle keyboard zoom controls (+ and -)
    const keyboardZoomHandler = (e) => {
        if (!window.cashFlowChart) return;

        // Check if + or = key (zoom in)
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            window.cashFlowChart.zoom(1.1);
        }
        // Check if - or _ key (zoom out)
        else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            window.cashFlowChart.zoom(0.9);
        }
    };

    // Add keyboard listener
    document.addEventListener('keydown', keyboardZoomHandler);

    // Store handler reference for cleanup
    container._cashflowKeyboardHandler = keyboardZoomHandler;
}

/**
 * Fetch Detailed Cash Flow data (Deterministic Projection)
 * @param {Object} profile - The profile to analyze
 * @param {string} marketScenario - The market scenario: 'conservative', 'moderate', or 'aggressive'
 */
async function fetchDetailedCashflow(profile, marketScenario = 'balanced') {
    try {
        console.log(`Fetching Detailed Cashflow projection for tax visualization (${marketScenario})...`);
        
        // Use scenario key directly if it exists in MARKET_PROFILES, else fallback to balanced
        const marketProfile = APP_CONFIG.MARKET_PROFILES[marketScenario] || APP_CONFIG.MARKET_PROFILES['balanced'];

        // Use the new endpoint that returns granular tax data
        const response = await fetch('/api/analysis/cashflow-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile_name: profile.name,
                simulations: 1000,
                market_profile: marketProfile,
                spending_model: 'constant_real'
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data && data.ledger) {
            console.log('✓ Detailed ledger data received:', data.ledger);
            return data.ledger;
        }

        console.warn('No ledger data in response');
        return null;
    } catch (error) {
        console.error('Failed to fetch Detailed Cashflow:', error);
        return null;
    }
}

// ... (Rest of file unchanged until renderCashFlowChart) ...

/**
 * Render cash flow chart
 */
async function renderCashFlowChart(container, profile, months, viewType, scenarioData = null, monthsToLifeExpectancy = 360, lifeExpectancyAge = 95, marketScenario = 'balanced') {
    let canvasElement = container.querySelector('#cashflow-chart');

    // Get scenario display name for UI
    const scenarioNames = {
        'conservative': 'Conservative (30/70)',
        'moderate': 'Moderate (60/40)',
        'aggressive': 'Aggressive (80/20)'
    };
    const scenarioDisplayName = scenarioNames[marketScenario] || 'Moderate';

    // Fetch Detailed Ledger for tax transparency
    let detailedLedger = null;
    try {
        console.log('Fetching detailed cashflow data...');
        detailedLedger = await fetchDetailedCashflow(profile, marketScenario);
        console.log('✓ Detailed ledger data received');
    } catch (error) {
        console.warn('⚠ Tax projection fetch failed, using simplified view:', error.message);
        detailedLedger = null;
    }

    const monthlyData = calculateMonthlyCashFlow(profile, months, marketScenario);
    const chartData = viewType === 'annual' ? aggregateToAnnual(monthlyData) : monthlyData;

    // Merge Detailed Ledger Data into Chart Data
    if (detailedLedger) {
        console.log('Merging detailed tax data into chart...');
        
        // Map ledger data for fast lookup
        // We'll use a string key "year-month" for precise matching
        const ledgerMap = {};
        detailedLedger.forEach(row => {
            const key = `${row.year}-${row.month}`;
            ledgerMap[key] = row;
        });

        // Create an annual aggregation of the ledger data for the annual view
        const annualLedgerMap = {};
        if (viewType === 'annual') {
            detailedLedger.forEach(row => {
                if (!annualLedgerMap[row.year]) {
                    annualLedgerMap[row.year] = {
                        federal_tax: 0,
                        state_tax: 0,
                        fica_tax: 0,
                        ltcg_tax: 0,
                        expenses_excluding_tax: 0,
                        portfolio_balance: 0 // Will take the last one
                    };
                }
                annualLedgerMap[row.year].federal_tax += (row.federal_tax || 0);
                annualLedgerMap[row.year].state_tax += (row.state_tax || 0);
                annualLedgerMap[row.year].fica_tax += (row.fica_tax || 0);
                annualLedgerMap[row.year].ltcg_tax += (row.ltcg_tax || 0);
                annualLedgerMap[row.year].expenses_excluding_tax += (row.expenses_excluding_tax || 0);
                annualLedgerMap[row.year].portfolio_balance = row.portfolio_balance; // Year-end balance
            });
        }

        // Update chartData with tax specifics
        chartData.forEach(period => {
            if (viewType === 'annual') {
                const year = parseInt(period.label);
                const row = annualLedgerMap[year];
                if (row) {
                    period.federalTax = row.federal_tax + (row.ltcg_tax || 0);
                    period.stateTax = row.state_tax;
                    period.ficaTax = row.fica_tax;
                    period.totalTax = period.federalTax + period.stateTax + period.ficaTax;
                    period.livingExpenses = row.expenses_excluding_tax;
                    period.totalExpenses = period.totalTax + period.livingExpenses;
                    period.portfolioValue = row.portfolio_balance;
                }
            } else {
                const year = period.date.getFullYear();
                const month = period.date.getMonth() + 1;
                const key = `${year}-${month}`;
                const row = ledgerMap[key];
                if (row) {
                    period.federalTax = row.federal_tax + (row.ltcg_tax || 0);
                    period.stateTax = row.state_tax;
                    period.ficaTax = row.fica_tax;
                    period.totalTax = period.federalTax + period.stateTax + period.ficaTax;
                    period.livingExpenses = row.expenses_excluding_tax;
                    period.totalExpenses = period.totalTax + period.livingExpenses;
                    period.portfolioValue = row.portfolio_balance;
                }
            }
        });
    }

    // Process scenario data if available (for comparison chart)
    let scenarioMedianData = null;
    let monteCarloPortfolioData = null;

    if (scenarioData && scenarioData.results) {
        console.log('Processing scenario data...');

        // Check if it's a multi-scenario result (has scenarios object)
        if (scenarioData.results.scenarios) {
            const scenarios = scenarioData.results.scenarios;
            const scenarioKeys = Object.keys(scenarios);
            const selectedKey = scenarios['base'] ? 'base' : scenarioKeys[0];

            if (selectedKey && scenarios[selectedKey]?.timeline) {
                scenarioMedianData = mapScenarioToChartData(scenarios[selectedKey].timeline, chartData, viewType);
            }
        }
        // Check if it's a single scenario result (direct timeline)
        else if (scenarioData.results.timeline) {
            scenarioMedianData = mapScenarioToChartData(scenarioData.results.timeline, chartData, viewType);
        }
        // Check if results is the timeline data itself (backward compatibility)
        else if (scenarioData.results.years && scenarioData.results.median) {
            scenarioMedianData = mapScenarioToChartData(scenarioData.results, chartData, viewType);
        }
    }

    // Render chart first (most critical)
    const canvas = container.querySelector('#cashflow-chart');
    if (!canvas) {
        console.error('Canvas element not found after restoring');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
    }

    // Destroy existing chart if it exists
    if (window.cashFlowChart) {
        window.cashFlowChart.destroy();
    }

    // Build datasets array with Tax Separation
    const datasets = [
        {
            label: 'Work Income',
            data: chartData.map(d => d.workIncome),
            backgroundColor: 'rgba(46, 213, 115, 0.8)',
            borderColor: 'rgba(46, 213, 115, 1)',
            borderWidth: 1,
            stack: 'income'
        },
        {
            label: 'Retirement Benefits (SS/Pension)',
            data: chartData.map(d => d.retirementBenefits),
            backgroundColor: 'rgba(52, 152, 219, 0.8)',
            borderColor: 'rgba(52, 152, 219, 1)',
            borderWidth: 1,
            stack: 'income'
        },
        {
            label: 'Investment Withdrawals',
            data: chartData.map(d => d.investmentIncome),
            backgroundColor: 'rgba(155, 89, 182, 0.8)',
            borderColor: 'rgba(155, 89, 182, 1)',
            borderWidth: 1,
            stack: 'income'
        },
        // --- EXPENSE STACK (Living + Taxes) ---
        {
            label: 'Living Expenses',
            data: chartData.map(d => -(d.livingExpenses || d.expenses)), // Negative for visual
            backgroundColor: 'rgba(255, 107, 107, 0.7)',
            borderColor: 'rgba(255, 107, 107, 1)',
            borderWidth: 1,
            stack: 'expenses'
        },
        {
            label: 'Taxes',
            data: chartData.map(d => -(d.totalTax || 0)),
            backgroundColor: 'rgba(231, 76, 60, 0.9)', // Red
            borderColor: 'rgba(192, 57, 43, 1)',
            borderWidth: 1,
            stack: 'expenses',
            hidden: !detailedLedger, // Hide if no data
            // Store tax breakdown for tooltip
            taxBreakdown: chartData.map(d => ({
                federal: d.federalTax || 0,
                state: d.stateTax || 0,
                fica: d.ficaTax || 0
            }))
        },
        // --------------------------------------
        {
            label: 'Net Cash Flow',
            data: chartData.map(d => d.netCashFlow),
            type: 'line',
            borderColor: 'rgba(241, 196, 15, 1)',
            backgroundColor: 'rgba(241, 196, 15, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: 'y'
        },
        {
            label: 'Portfolio Balance',
            data: chartData.map(d => d.portfolioValue),
            type: 'line',
            borderColor: 'rgba(52, 211, 153, 1)',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y1'
        }
    ];

    // Add scenario median data if available
    if (scenarioMedianData) {
        datasets.push({
            label: 'Scenario Median Portfolio (MC)',
            data: scenarioMedianData,
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 3,
            borderDash: [10, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 5,
            yAxisID: 'y1'
        });
    }

    const colors = getChartThemeColors();

    try {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            return;
        }

        window.cashFlowChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.label),
                datasets: datasets
            },
            options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: `Cash Flow Projection (${viewType === 'annual' ? 'Annual' : 'Monthly'}) - ${Math.floor(months / 12)} years through age ${lifeExpectancyAge} - ${monteCarloPortfolioData ? `Monte Carlo (${scenarioDisplayName}) ✓` : 'Simplified Portfolio'} - Scroll or +/- to zoom, drag to pan`,
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    color: colors.textPrimary
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: colors.textPrimary,
                        padding: 15,
                        usePointStyle: true
                    },
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;

                        // Call default behavior to toggle dataset
                        const meta = chart.getDatasetMeta(index);
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        chart.update();

                        // Update metricVisibilityState based on dataset index
                        const datasetToMetricMap = {
                            0: 'work-income',
                            1: 'retirement-benefits',
                            2: 'investment-withdrawals',
                            3: 'expenses',  // Living Expenses
                            4: 'expenses',  // Taxes (consolidated)
                            5: 'net-cash-flow'
                        };

                        const metric = datasetToMetricMap[index];
                        if (metric) {
                            metricVisibilityState[metric] = meta.hidden !== null ? meta.hidden : chart.data.datasets[index].hidden;

                            // Update summary card visual state
                            updateSummaryCardVisuals(container);
                        }
                    },
                    onHover: (e, legendItem, legend) => {
                        e.native.target.style.cursor = 'pointer';
                    },
                    onLeave: (e, legendItem, legend) => {
                        e.native.target.style.cursor = 'default';
                    }
                },
                tooltip: {
                    enabled: true,
                    position: 'nearest',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    yAlign: 'top',
                    xAlign: 'left',
                    caretPadding: 10,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            // Use dataset.label for the series name (e.g., "Work Income")
                            // context.label is the x-axis value (year)
                            let label = context.dataset.label || '';

                            // Special handling for consolidated Taxes dataset
                            if (label === 'Taxes' && context.dataset.taxBreakdown) {
                                const breakdown = context.dataset.taxBreakdown[context.dataIndex];
                                const total = Math.abs(context.parsed.y);

                                return [
                                    `${label}: ${formatCurrency(total, 0)}`,
                                    `  Federal: ${formatCurrency(breakdown.federal, 0)}`,
                                    `  State: ${formatCurrency(breakdown.state, 0)}`,
                                    `  FICA: ${formatCurrency(breakdown.fica, 0)}`
                                ];
                            }

                            if (label) {
                                label += ': ';
                            }
                            const value = Math.abs(context.parsed.y);
                            label += formatCurrency(value, 0);
                            return label;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: null
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    },
                    limits: {
                        x: {
                            min: 'original',
                            max: 'original'
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Annual Cash Flow',
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: colors.textPrimary
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        color: colors.textPrimary,
                        callback: function(value) {
                            return formatCurrency(Math.abs(value), 0);
                        }
                    },
                    grid: {
                        color: colors.gridColor
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Portfolio Balance',
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: colors.textPrimary
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        color: colors.textPrimary,
                        callback: function(value) {
                            return formatCurrency(value, 0);
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        color: colors.textPrimary
                    },
                    grid: {
                        display: false
                    }
                }
            },
            barPercentage: 0.6,
            categoryPercentage: 0.7
        }
        });

        registerChartForThemeUpdates(window.cashFlowChart);
        console.log('Cash flow chart created successfully');
    } catch (error) {
        console.error('Error creating cash flow chart:', error);
        // Show error message to user
        if (canvasElement && canvasElement.parentElement) {
            canvasElement.parentElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 350px; flex-direction: column; gap: 12px; color: var(--danger-color);">
                    <div style="font-size: 32px;">⚠️</div>
                    <div style="font-size: 14px;">Failed to render chart: ${error.message}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Check console for details</div>
                </div>
            `;
        }
        return;
    }

    // Restore metric visibility state from previous settings
    restoreMetricVisibility();

    // Setup metric isolation handlers after chart is created
    setupMetricIsolation(container);

    // Update summary cards (after chart is created)
    try {
        renderSummaryCards(container, chartData, monthlyData.length, profile);
    } catch (error) {
        console.error('Error rendering summary cards:', error);
    }

    // Update table title
    try {
        const tableTitle = container.querySelector('#table-title');
        if (tableTitle) {
            tableTitle.textContent = viewType === 'annual' ? 'Annual Cash Flow Details' : 'Monthly Cash Flow Details';
        }

        // Prepare table data (use monthly data for more granular table view)
        const tableData = viewType === 'annual' ? chartData : monthlyData;

        // Update table
        renderCashFlowTable(container, tableData, viewType);
    } catch (error) {
        console.error('Error rendering cash flow table:', error);
    }
}

/**
 * Render summary cards
 */
function renderSummaryCards(container, chartData, totalMonths, profile) {
    const summaryContainer = container.querySelector('#summary-cards');
    if (!summaryContainer) {
        console.warn('Summary cards container not found');
        return;
    }

    const totalWorkIncome = chartData.reduce((sum, d) => sum + d.workIncome, 0);
    const totalRetirementBenefits = chartData.reduce((sum, d) => sum + d.retirementBenefits, 0);
    const totalInvestmentIncome = chartData.reduce((sum, d) => sum + d.investmentIncome, 0);
    const totalIncome = chartData.reduce((sum, d) => sum + d.totalIncome, 0);
    const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    const totalNet = totalIncome - totalExpenses;

    // FIX: Use totalMonths for accurate monthly averages (not chartData.length which could be years)
    const avgMonthlyIncome = totalIncome / totalMonths;
    const avgMonthlyExpenses = totalExpenses / totalMonths;
    const avgMonthlyNet = totalNet / totalMonths;
    const totalYears = Math.round(totalMonths / 12 * 10) / 10; // e.g., 35.2 years

    // Store data for detail modal
    window.cashFlowSummaryData = {
        workIncome: { total: totalWorkIncome, avgMonthly: totalWorkIncome / totalMonths },
        retirementBenefits: { total: totalRetirementBenefits, avgMonthly: totalRetirementBenefits / totalMonths },
        withdrawals: { total: totalInvestmentIncome, avgMonthly: totalInvestmentIncome / totalMonths },
        expenses: { total: totalExpenses, avgMonthly: avgMonthlyExpenses },
        netCashFlow: { total: totalNet, avgMonthly: avgMonthlyNet },
        totalMonths,
        totalYears,
        chartData,
        profile
    };

    summaryContainer.innerHTML = `
        <div class="metric-card" data-metric="work-income" data-detail="true" style="background: linear-gradient(135deg, #2ed573, #26d07c); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Work Income</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalWorkIncome, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">${formatCurrency(totalWorkIncome / totalMonths, 0)}/mo avg</div>
        </div>
        <div class="metric-card" data-metric="retirement-benefits" data-detail="true" style="background: linear-gradient(135deg, #3498db, #5faee3); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Retirement Benefits</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalRetirementBenefits, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">${formatCurrency(totalRetirementBenefits / totalMonths, 0)}/mo avg</div>
        </div>
        <div class="metric-card" data-metric="investment-withdrawals" data-detail="true" style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Portfolio Withdrawals</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalInvestmentIncome, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">${formatCurrency(totalInvestmentIncome / totalMonths, 0)}/mo avg</div>
        </div>
        <div class="metric-card" data-metric="expenses" data-detail="true" style="background: linear-gradient(135deg, #ff6b6b, #ee5a6f); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Expenses</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalExpenses, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">${formatCurrency(avgMonthlyExpenses, 0)}/mo avg</div>
        </div>
        <div class="metric-card" data-metric="net-cash-flow" data-detail="true" style="background: linear-gradient(135deg, ${totalNet >= 0 ? '#f1c40f, #f39c12' : '#e74c3c, #c0392b'}); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Net Cash Flow</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${totalNet >= 0 ? '+' : ''}${formatCurrency(totalNet, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">${avgMonthlyNet >= 0 ? '+' : ''}${formatCurrency(avgMonthlyNet, 0)}/mo avg</div>
        </div>
    `;

    // Setup click handlers for detail modals (shift+click for details, regular click toggles chart)
    setupCardDetailHandlers(container);
}

/**
 * Restore metric visibility from saved state
 */
function restoreMetricVisibility() {
    const chart = window.cashFlowChart;
    if (!chart) return;

    // Map metric names to dataset indices
    const metricToDatasetMap = {
        'work-income': [0],
        'retirement-benefits': [1],
        'investment-withdrawals': [2],
        'expenses': [3, 4],  // Living Expenses + Taxes (consolidated)
        'net-cash-flow': [5]
    };

    // Apply saved visibility state to datasets
    Object.keys(metricVisibilityState).forEach(metric => {
        const isHidden = metricVisibilityState[metric];
        const datasetIndices = metricToDatasetMap[metric] || [];

        datasetIndices.forEach(index => {
            const dataset = chart.data.datasets[index];
            if (dataset) {
                dataset.hidden = isHidden;
            }
        });
    });

    chart.update();
}

/**
 * Setup click handlers for card detail modals
 */
function setupCardDetailHandlers(container) {
    const metricCards = container.querySelectorAll('.metric-card[data-detail="true"]');

    metricCards.forEach(card => {
        // Single click shows detail modal
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const metric = card.getAttribute('data-metric');
            showCardDetailModal(metric);
        });

        // Add visual hint
        card.title = 'Click for details';
    });
}

/**
 * Show detailed breakdown modal for a metric card
 */
function showCardDetailModal(metric) {
    const data = window.cashFlowSummaryData;
    if (!data) return;

    const { chartData, totalMonths, totalYears, profile } = data;
    const profileData = profile?.data || {};
    const financial = profileData.financial || {};
    const spouse = profileData.spouse || null;

    // Build detail content based on metric type
    let title = '';
    let content = '';

    // Aggregate by year for the breakdown table
    const yearlyBreakdown = {};
    chartData.forEach(d => {
        const year = d.label?.toString().includes('-')
            ? d.date?.getFullYear()
            : parseInt(d.label);
        if (!yearlyBreakdown[year]) {
            yearlyBreakdown[year] = { workIncome: 0, retirementBenefits: 0, investmentIncome: 0, expenses: 0, netCashFlow: 0 };
        }
        yearlyBreakdown[year].workIncome += d.workIncome || 0;
        yearlyBreakdown[year].retirementBenefits += d.retirementBenefits || 0;
        yearlyBreakdown[year].investmentIncome += d.investmentIncome || 0;
        yearlyBreakdown[year].expenses += d.expenses || 0;
        yearlyBreakdown[year].netCashFlow += d.netCashFlow || 0;
    });

    const years = Object.keys(yearlyBreakdown).sort((a, b) => a - b);

    switch (metric) {
        case 'work-income':
            title = '💼 Work Income Details';
            const incomeStreams = profileData.income_streams || [];
            content = `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Summary</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Total: <strong>${formatCurrency(data.workIncome.total, 0)}</strong> over ${totalYears} years<br>
                        Average: <strong>${formatCurrency(data.workIncome.avgMonthly, 0)}/month</strong>
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Income Sources</h4>
                    ${incomeStreams.length > 0 ? incomeStreams.map(s => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                            <span>${s.name || s.type || 'Income'}</span>
                            <span>${formatCurrency(s.amount || 0, 0)}/mo ${s.end_date ? `(ends ${s.end_date})` : ''}</span>
                        </div>
                    `).join('') : '<p style="color: var(--text-secondary); font-size: 13px;">No income streams configured</p>'}
                </div>
                ${buildYearlyTable(years, yearlyBreakdown, 'workIncome', 'Annual Work Income')}
            `;
            break;

        case 'retirement-benefits':
            title = '🏖️ Retirement Benefits Details';
            const p1SS = financial.social_security_benefit || 0;
            const p1Pension = financial.pension_benefit || 0;
            const p1ClaimingAge = financial.ss_claiming_age || 67;
            const p2SS = spouse?.social_security_benefit || 0;
            const p2Pension = spouse?.pension_benefit || 0;
            const p2ClaimingAge = spouse?.ss_claiming_age || 67;

            content = `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Summary</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Total: <strong>${formatCurrency(data.retirementBenefits.total, 0)}</strong> over ${totalYears} years<br>
                        Average: <strong>${formatCurrency(data.retirementBenefits.avgMonthly, 0)}/month</strong>
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Person 1 Benefits</h4>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                        <span>Social Security (claiming at age ${p1ClaimingAge})</span>
                        <span>${formatCurrency(p1SS, 0)}/mo</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                        <span>Pension (starts at retirement)</span>
                        <span>${formatCurrency(p1Pension, 0)}/mo</span>
                    </div>
                    ${spouse ? `
                    <h4 style="margin: 16px 0 8px 0; font-size: 14px;">Spouse Benefits</h4>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                        <span>Social Security (claiming at age ${p2ClaimingAge})</span>
                        <span>${formatCurrency(p2SS, 0)}/mo</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                        <span>Pension</span>
                        <span>${formatCurrency(p2Pension, 0)}/mo</span>
                    </div>
                    ` : ''}
                    <div style="margin-top: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                        <strong>Note:</strong> This is the lifetime total of all retirement benefits collected.
                        Monthly benefits are ${formatCurrency((p1SS + p1Pension + p2SS + p2Pension), 0)}/mo combined when all benefits are active.
                    </div>
                </div>
                ${buildYearlyTable(years, yearlyBreakdown, 'retirementBenefits', 'Annual Benefits')}
            `;
            break;

        case 'investment-withdrawals':
            title = '📊 Portfolio Withdrawals Details';
            const withdrawalRate = profileData.withdrawal_strategy?.withdrawal_rate || 0.04;
            content = `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Summary</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Total: <strong>${formatCurrency(data.withdrawals.total, 0)}</strong> over ${totalYears} years<br>
                        Average: <strong>${formatCurrency(data.withdrawals.avgMonthly, 0)}/month</strong>
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Withdrawal Strategy</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Target Rate: <strong>${(withdrawalRate * 100).toFixed(1)}%</strong> annually<br>
                        Strategy: Tax-efficient waterfall (Taxable → Tax-Deferred → Roth)
                    </p>
                    <div style="margin-top: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                        <strong>Note:</strong> Withdrawals only occur after retirement to cover shortfalls between income/benefits and expenses.
                        The actual withdrawal each month is the minimum of your target rate and the amount needed.
                    </div>
                </div>
                ${buildYearlyTable(years, yearlyBreakdown, 'investmentIncome', 'Annual Withdrawals')}
            `;
            break;

        case 'expenses':
            title = '💸 Expenses Details';
            const annualExpenses = financial.annual_expenses || 0;
            content = `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Summary</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Total: <strong>${formatCurrency(data.expenses.total, 0)}</strong> over ${totalYears} years<br>
                        Average: <strong>${formatCurrency(data.expenses.avgMonthly, 0)}/month</strong> (${formatCurrency(data.expenses.avgMonthly * 12, 0)}/year)
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Expense Configuration</h4>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                        <span>Annual Expenses (from profile)</span>
                        <span>${formatCurrency(annualExpenses, 0)}/year</span>
                    </div>
                    <div style="margin-top: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                        <strong>Includes:</strong> Living expenses + Federal tax + State tax + FICA tax.<br>
                        Expenses are adjusted based on retirement status (current vs. future budget).
                    </div>
                </div>
                ${buildYearlyTable(years, yearlyBreakdown, 'expenses', 'Annual Expenses')}
            `;
            break;

        case 'net-cash-flow':
            title = '📈 Net Cash Flow Details';
            content = `
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Summary</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Total: <strong style="color: ${data.netCashFlow.total >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                            ${data.netCashFlow.total >= 0 ? '+' : ''}${formatCurrency(data.netCashFlow.total, 0)}</strong> over ${totalYears} years<br>
                        Average: <strong>${data.netCashFlow.avgMonthly >= 0 ? '+' : ''}${formatCurrency(data.netCashFlow.avgMonthly, 0)}/month</strong>
                    </p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">Calculation</h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Net Cash Flow = (Work Income + Retirement Benefits + Withdrawals) - Expenses
                    </p>
                    <div style="margin-top: 12px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                        ${data.netCashFlow.total < 0
                            ? '<strong>Note:</strong> A negative net cash flow over the projection period indicates your plan may need adjustments. Consider reducing expenses, increasing income, or adjusting your retirement date.'
                            : '<strong>Note:</strong> A positive net cash flow indicates you have surplus funds that will grow your portfolio over time.'}
                    </div>
                </div>
                ${buildYearlyTable(years, yearlyBreakdown, 'netCashFlow', 'Annual Net Cash Flow', true)}
            `;
            break;

        default:
            return;
    }

    // Create and show modal
    showModal(title, content);
}

/**
 * Build a yearly breakdown table
 */
function buildYearlyTable(years, yearlyBreakdown, field, title, showSign = false) {
    if (years.length === 0) return '';

    const rows = years.map(year => {
        const value = yearlyBreakdown[year]?.[field] || 0;
        const displayValue = showSign && value >= 0 ? `+${formatCurrency(value, 0)}` : formatCurrency(value, 0);
        const color = showSign ? (value >= 0 ? 'var(--success-color)' : 'var(--danger-color)') : 'inherit';
        return `<tr>
            <td style="padding: 4px 8px; border-bottom: 1px solid var(--border-color);">${year}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid var(--border-color); text-align: right; color: ${color};">${displayValue}</td>
        </tr>`;
    }).join('');

    return `
        <div>
            <h4 style="margin: 0 0 8px 0; font-size: 14px;">${title} (${years.length} Years)</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: var(--bg-tertiary);">
                        <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid var(--border-color);">Year</th>
                        <th style="padding: 6px 8px; text-align: right; border-bottom: 2px solid var(--border-color);">Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Show a modal dialog
 */
function showModal(title, content) {
    // Remove existing modal if any
    const existing = document.querySelector('.cashflow-detail-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'cashflow-detail-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(2px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: var(--bg-primary);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    `;

    modal.innerHTML = `
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px;">${title}</h3>
            <button class="modal-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); padding: 4px 8px; border-radius: 4px;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='none'">&times;</button>
        </div>
        <div style="padding: 20px; overflow-y: auto; flex: 1;">
            ${content}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const closeBtn = modal.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

/**
 * Restore card visual state based on saved visibility
 */
function restoreCardVisualState(container) {
    updateSummaryCardVisuals(container);
}

/**
 * Update summary card visual state to match current visibility
 */
function updateSummaryCardVisuals(container) {
    const metricCards = container.querySelectorAll('.metric-card');

    metricCards.forEach(card => {
        const metric = card.getAttribute('data-metric');
        const isHidden = metricVisibilityState[metric];

        if (isHidden) {
            // Dataset is hidden - show dim styling
            card.style.borderColor = 'transparent';
            card.style.opacity = '0.4';
            card.style.boxShadow = 'none';
        } else {
            // Dataset is visible - show highlighted styling
            card.style.borderColor = 'rgba(255, 255, 255, 0.9)';
            card.style.opacity = '1';
            card.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
        }
    });
}

/**
 * Setup metric isolation - toggle chart datasets when clicking summary cards
 */
function setupMetricIsolation(container) {
    // Note: Click handlers for details are set up in setupCardDetailHandlers()
    // This function now only restores visual state on initial setup
    const chart = window.cashFlowChart;

    if (!chart) {
        console.warn('Cash flow chart not found, metric isolation disabled');
        return;
    }

    // Restore visual state of cards on initial setup
    restoreCardVisualState(container);
}

/**
 * Render cash flow table
 */
function renderCashFlowTable(container, displayData, viewType) {
    const tableContainer = container.querySelector('#cashflow-table');
    if (!tableContainer) {
        console.warn('Cash flow table container not found');
        return;
    }

    // Limit display based on view type (show all years in annual view, limit months)
    const maxRows = viewType === 'annual' ? displayData.length : 24;
    const limitedData = viewType === 'annual' ? displayData : displayData.slice(0, maxRows);
    const periodLabel = viewType === 'annual' ? 'Year' : 'Month';

    tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color);">
                    <th style="text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 700;">${periodLabel}</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">Work</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">SS/Pension</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">Draws</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">Expenses</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">Net</th>
                    <th style="text-align: right; padding: 6px 10px; font-size: 11px; font-weight: 700;">Portfolio</th>
                </tr>
            </thead>
            <tbody>
                ${limitedData.map(period => `
                    <tr style="border-bottom: 1px solid var(--border-color); ${period.isRetired ? 'background: rgba(52, 152, 219, 0.05);' : ''}">
                        <td style="padding: 4px 10px; font-size: 11px;">
                            ${period.label}
                            ${period.isRetired ? '<span style="font-size: 9px; color: var(--info-color); margin-left: 2px;">🏖️</span>' : ''}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; color: var(--success-color); font-weight: 500;">
                            ${period.workIncome > 0 ? formatCurrency(period.workIncome, 0) : '—'}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; color: var(--info-color); font-weight: 500;">
                            ${period.retirementBenefits > 0 ? formatCurrency(period.retirementBenefits, 0) : '—'}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; color: #9b59b6; font-weight: 500;">
                            ${period.investmentIncome > 0 ? formatCurrency(period.investmentIncome, 0) : '—'}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; color: var(--danger-color); font-weight: 500;">
                            ${formatCurrency(period.expenses, 0)}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; font-weight: 600; color: ${period.netCashFlow >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ${period.netCashFlow >= 0 ? '+' : ''}${formatCurrency(period.netCashFlow, 0)}
                        </td>
                        <td style="padding: 4px 10px; text-align: right; font-size: 11px; font-weight: 600; color: var(--text-primary);">
                            ${formatCurrency(period.portfolioValue || 0, 0)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${displayData.length > maxRows ? `
            <div style="padding: 12px; text-align: center; color: var(--text-secondary); font-size: 12px;">
                Showing first ${maxRows} ${viewType === 'annual' ? 'years' : 'months'}. View chart for complete projection.
            </div>
        ` : ''}
    `;
}

/**
 * Check if an expense/income item is active on a given date
 */
function isExpenseActiveOnDate(expense, checkDate) {
    // If ongoing or no date constraints, it's always active
    if (expense.ongoing !== false || (!expense.start_date && !expense.end_date)) {
        return true;
    }

    const check = checkDate.getTime();

    // Check start date
    if (expense.start_date) {
        const start = new Date(expense.start_date).getTime();
        if (check < start) {
            return false; // Before start date
        }
    }

    // Check end date
    if (expense.end_date) {
        const end = new Date(expense.end_date).getTime();
        if (check > end) {
            return false; // After end date
        }
    }

    return true;
}

/**
 * Calculate total monthly expenses for a specific period (current or future)
 */
function calculatePeriodExpenses(budget, period, currentDate) {
    let expenses = 0;

    if (!budget.expenses || !budget.expenses[period]) {
        return expenses;
    }

    // All expense categories
    const categories = ['housing', 'utilities', 'transportation', 'food', 'dining_out', 'healthcare', 'insurance',
                      'travel', 'entertainment', 'personal_care', 'clothing', 'gifts', 'childcare_education',
                      'charitable_giving', 'subscriptions', 'pet_care', 'home_maintenance', 'debt_payments',
                      'taxes', 'discretionary', 'other'];

    categories.forEach(category => {
        const catData = budget.expenses[period][category];

        if (!catData) {
            return; // Skip if no data for this category
        }

        // Handle both array format (multiple instances) and legacy single object format
        const expenseItems = Array.isArray(catData) ? catData : [catData];

        expenseItems.forEach(expense => {
            // Check if expense is active on this date
            if (!isExpenseActiveOnDate(expense, currentDate)) {
                return; // Skip inactive expenses
            }

            const amount = expense.amount || 0;
            const frequency = expense.frequency || 'monthly';

            // Convert to monthly
            if (frequency === 'monthly') {
                expenses += amount;
            } else if (frequency === 'quarterly') {
                expenses += amount / 3;
            } else if (frequency === 'annual') {
                expenses += amount / 12;
            }
        });
    });

    return expenses;
}

/**
 * Calculate total monthly income from budget categories for a specific period (current or future)
 */
function calculatePeriodIncome(budget, period, currentDate) {
    let income = 0;

    if (!budget.income || !budget.income[period]) {
        return income;
    }

    // Income categories that can have multiple items with start/end dates
    const categories = ['rental_income', 'part_time_consulting', 'business_income', 'other_income'];

    categories.forEach(category => {
        const items = budget.income[period][category] || [];
        if (!Array.isArray(items)) return;

        items.forEach(item => {
            // Check if this income item is active on this date
            if (!isExpenseActiveOnDate(item, currentDate)) {
                return; // Skip inactive income
            }

            const amount = item.amount || 0;
            const frequency = item.frequency || 'monthly';

            // Convert to monthly
            if (frequency === 'monthly') {
                income += amount;
            } else if (frequency === 'quarterly') {
                income += amount / 3;
            } else if (frequency === 'annual') {
                income += amount / 12;
            }
        });
    });

    return income;
}

/**
 * Calculate monthly cash flow data with portfolio growth projection
 */
function calculateMonthlyCashFlow(profile, months, marketScenario = 'balanced') {
    const data = profile.data || {};
    const incomeStreams = data.income_streams || [];
    const financial = data.financial || {};
    const budget = data.budget || {};
    const assets = data.assets || {};

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get retirement date
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    // Get withdrawal strategy settings
    const withdrawalStrategy = data.withdrawal_strategy || {};
    const annualWithdrawalRate = withdrawalStrategy.withdrawal_rate || 0.04; // Default to 4%

    // Calculate portfolio value by account type for proper withdrawal ordering
    const portfolioByType = calculatePortfolioByType(assets);
    let currentPortfolio = portfolioByType.taxable + portfolioByType.taxDeferred + portfolioByType.roth;

    // --- Market-Scenario-Aware Assumptions ---
    const marketProfile = APP_CONFIG.MARKET_PROFILES[marketScenario] || APP_CONFIG.MARKET_PROFILES['balanced'];
    
    // Get user's ACTUAL allocation from their assets
    const userAlloc = calculateAllocation(data.assets);
    const hasAssets = (portfolioByType.taxable + portfolioByType.taxDeferred + portfolioByType.roth) > 0;

    // Calculate blended growth rate
    // If user has assets, use their REAL mix for Stocks/Bonds/Cash.
    // If not, use the scenario's suggested mix.
    const stockAllocation = hasAssets ? userAlloc.stocks : (marketProfile.stock_allocation || 0.6);
    const bondAllocation = hasAssets ? userAlloc.bonds : (marketProfile.bond_allocation || 0.4);
    const cashAllocation = hasAssets ? userAlloc.cash : (marketProfile.cash_allocation || 0.0);
    
    // Other asset classes (REITs, Gold, Crypto) - use scenario targets as these are often "tactical" 
    const reitAllocation = marketProfile.reit_allocation || 0.0;
    const goldAllocation = marketProfile.gold_allocation || 0.0;
    const cryptoAllocation = marketProfile.crypto_allocation || 0.0;
    
    const annualGrowthRate = 
        (stockAllocation * (marketProfile.stock_return_mean || 0.10)) + 
        (bondAllocation * (marketProfile.bond_return_mean || 0.04)) +
        (cashAllocation * (marketProfile.cash_return_mean || 0.015)) +
        (reitAllocation * (marketProfile.reit_return_mean || 0.08)) +
        (goldAllocation * (marketProfile.gold_return_mean || 0.04)) +
        (cryptoAllocation * (marketProfile.crypto_return_mean || 0.20));
    
    const monthlyGrowthRate = annualGrowthRate / 12;
    const monthlyInflationRate = (marketProfile.inflation_mean || 0.03) / 12;

    const monthlyData = [];

    for (let i = 0; i < months; i++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);

        const monthLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const dateStr = currentDate.toISOString().split('T')[0];

        // Check if retired
        const isRetired = retirementDate && currentDate >= retirementDate;

        // Calculate work income for this month (from income_streams)
        let workIncome = 0;
        incomeStreams.forEach(stream => {
            const streamStart = stream.start_date ? new Date(stream.start_date) : null;
            const streamEnd = stream.end_date ? new Date(stream.end_date) : null;

            // Check if this income stream is active in this month
            const isActive = (!streamStart || currentDate >= streamStart) &&
                           (!streamEnd || currentDate <= streamEnd);

            if (isActive) {
                workIncome += stream.amount || 0;
            }
        });

        // Calculate additional income from budget with retirement blending
        // (rental, consulting, business, other income)
        let budgetIncome = 0;
        if (budget.income && (budget.income.current || budget.income.future)) {
            // Determine retirement status for both people
            const person1Retired = retirementDate && currentDate >= retirementDate;
            const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const person2Retired = spouseRetirementDate && currentDate >= spouseRetirementDate;

            // Calculate retirement weight
            let retirementWeight = 0.0;
            if (person1Retired) retirementWeight += 0.5;
            if (person2Retired) retirementWeight += 0.5;

            // Calculate budget income based on retirement status
            if (retirementWeight === 0) {
                // Both working - use current income
                budgetIncome = calculatePeriodIncome(budget, 'current', currentDate);
            } else if (retirementWeight === 1.0) {
                // Both retired - use future income
                budgetIncome = calculatePeriodIncome(budget, 'future', currentDate);
            } else {
                // Transition period (one retired) - blend 50/50
                const currentIncome = calculatePeriodIncome(budget, 'current', currentDate);
                const futureIncome = calculatePeriodIncome(budget, 'future', currentDate);
                budgetIncome = (currentIncome * 0.5) + (futureIncome * 0.5);
            }
        }

        // Calculate retirement benefits (Social Security, Pension)
        let retirementBenefits = 0;

        // --- Person 1 Social Security (based on claiming age) ---
        const p1ClaimingAge = financial.ss_claiming_age || 67;
        const p1BirthDate = profile.birth_date ? new Date(profile.birth_date) : null;
        let p1SSStarted = false;
        
        if (p1BirthDate) {
            const p1SSDate = new Date(p1BirthDate);
            p1SSDate.setFullYear(p1SSDate.getFullYear() + p1ClaimingAge);
            p1SSStarted = currentDate >= p1SSDate;
        } else {
            // Fallback to retirement date if birth date missing
            p1SSStarted = isRetired;
        }

        if (p1SSStarted) {
            retirementBenefits += financial.social_security_benefit || 0;
        }
        
        // Pension always starts at retirement
        if (isRetired) {
            retirementBenefits += financial.pension_benefit || 0;
        }

        // --- Person 2 (spouse) Social Security ---
        if (data.spouse) {
            const p2ClaimingAge = data.spouse.ss_claiming_age || 67;
            const p2BirthDate = data.spouse.birth_date ? new Date(data.spouse.birth_date) : null;
            let p2SSStarted = false;
            
            if (p2BirthDate) {
                const p2SSDate = new Date(p2BirthDate);
                p2SSDate.setFullYear(p2SSDate.getFullYear() + p2ClaimingAge);
                p2SSStarted = currentDate >= p2SSDate;
            } else {
                const spouseRetirementDate = data.spouse.retirement_date ? new Date(data.spouse.retirement_date) : null;
                p2SSStarted = spouseRetirementDate && currentDate >= spouseRetirementDate;
            }

            if (p2SSStarted) {
                retirementBenefits += data.spouse.social_security_benefit || 0;
            }
            
            // Spouse pension starts at their retirement
            const spouseRetirementDate = data.spouse.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const spouseIsRetired = spouseRetirementDate && currentDate >= spouseRetirementDate;
            if (spouseIsRetired) {
                retirementBenefits += data.spouse.pension_benefit || 0;
            }
        }

        // Get expenses from budget with retirement blending
        // Blended Budget Logic (matching backend retirement_model.py):
        // Both working -> 100% current
        // One retired -> 50% current / 50% future
        // Both retired -> 100% future
        let expenses = 0;

        // IMPORTANT: Prioritize financial.annual_expenses if provided (more accurate)
        if (financial.annual_expenses) {
            // Use the summary field - it's the source of truth
            expenses = financial.annual_expenses / 12;
        } else if (budget.expenses && (budget.expenses.current || budget.expenses.future)) {
            // Fallback to detailed budget categories only if annual_expenses not provided
            // Determine retirement status for both people
            const person1Retired = retirementDate && currentDate >= retirementDate;

            // Check if there's a spouse and their retirement date
            const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const person2Retired = spouseRetirementDate && currentDate >= spouseRetirementDate;

            // Calculate retirement weight
            let retirementWeight = 0.0;
            if (person1Retired) retirementWeight += 0.5;
            if (person2Retired) retirementWeight += 0.5;

            // Calculate expenses based on retirement status
            if (retirementWeight === 0) {
                // Both working - use current expenses
                expenses = calculatePeriodExpenses(budget, 'current', currentDate);
            } else if (retirementWeight === 1.0) {
                // Both retired - use future expenses
                expenses = calculatePeriodExpenses(budget, 'future', currentDate);
            } else {
                // Transition period (one retired) - blend 50/50
                const currentExpenses = calculatePeriodExpenses(budget, 'current', currentDate);
                const futureExpenses = calculatePeriodExpenses(budget, 'future', currentDate);
                expenses = (currentExpenses * 0.5) + (futureExpenses * 0.5);
            }
        }

        // Combine work income and budget income (rental, consulting, business, other)
        const totalWorkIncome = workIncome + budgetIncome;

        // Calculate investment income needed
        // After retirement (either person), we withdraw to cover shortfall between expenses and other income
        let investmentIncome = 0;

        // Check if anyone is retired
        const spouseRetirementDate = data.spouse?.retirement_date ? new Date(data.spouse.retirement_date) : null;
        const spouseIsRetired = spouseRetirementDate && currentDate >= spouseRetirementDate;
        const anyoneRetired = isRetired || spouseIsRetired;

        if (anyoneRetired) {
            const otherIncome = totalWorkIncome + retirementBenefits;
            const shortfall = expenses - otherIncome;

            // Only withdraw if there's a shortfall and we have portfolio
            if (shortfall > 0 && currentPortfolio > 0) {
                // Use the configured withdrawal rate, but cap at actual need and available portfolio
                const maxWithdrawal = (currentPortfolio * annualWithdrawalRate) / 12;
                investmentIncome = Math.min(shortfall, maxWithdrawal);

                // Deduct withdrawal from portfolio
                currentPortfolio -= investmentIncome;
            }
        }

        // Apply portfolio growth (returns on remaining portfolio after withdrawals)
        // Only apply growth if not retired or if portfolio still has value
        if (currentPortfolio > 0) {
            const monthlyGrowth = currentPortfolio * monthlyGrowthRate;
            currentPortfolio += monthlyGrowth;
        }

        // --- Realistic Tax Calculation for Chart ---
        // (Uses profile tax settings if available)
        let monthlyFederalTax = 0;
        let monthlyStateTax = 0;
        let monthlyFicaTax = 0;

        const fedRate = financial.tax_bracket_federal || 0.12; // Use 12% as a more realistic baseline for retirees
        const stateRate = financial.tax_bracket_state || 0.05;
        const ficaRate = 0.0765;

        // FICA only on work income (salary - not rental/business income)
        monthlyFicaTax = workIncome * ficaRate;

        // Income stacking for Federal/State (All income: Work + Budget + Pension + SS taxable portion)
        // SS taxation: rough rule of thumb (50% taxable for most)
        const taxableSS = (isRetired ? (financial.social_security_benefit || 0) * 0.5 : 0);
        const monthlyTaxableOrdinary = totalWorkIncome + (isRetired ? (financial.pension_benefit || 0) : 0) + taxableSS + investmentIncome;
        
        // Apply standard deduction (monthly)
        const filingStatus = financial.filing_status || 'mfj';
        const stdDeductionMonthly = (filingStatus === 'mfj' ? 29200 : 14600) / 12;
        
        const taxableAfterDeduction = Math.max(0, monthlyTaxableOrdinary - stdDeductionMonthly);
        monthlyFederalTax = taxableAfterDeduction * fedRate;
        monthlyStateTax = taxableAfterDeduction * stateRate;

        // Total expenses including taxes
        const totalExpensesThisMonth = expenses + monthlyFederalTax + monthlyStateTax + monthlyFicaTax;
        const totalIncome = totalWorkIncome + retirementBenefits + investmentIncome;
        const netCashFlow = totalIncome - totalExpensesThisMonth;

        // --- Update Portfolio Balance ---
        // Add surplus or subtract shortfall (remaining after withdrawals)
        currentPortfolio += netCashFlow;

        // Floor portfolio at 0
        if (currentPortfolio < 0) currentPortfolio = 0;

        monthlyData.push({
            date: currentDate,
            label: monthLabel,
            workIncome: totalWorkIncome,  // Include all income (salary + rental + consulting + business + other)
            retirementBenefits,
            investmentIncome,
            totalIncome,
            expenses: totalExpensesThisMonth,
            federalTax: monthlyFederalTax,
            stateTax: monthlyStateTax,
            ficaTax: monthlyFicaTax,
            livingExpenses: expenses,
            netCashFlow,
            portfolioValue: currentPortfolio,
            isRetired
        });
    }

    return monthlyData;
}

/**
 * Calculate portfolio value by account type for withdrawal strategy
 */
function calculatePortfolioByType(assets) {
    if (!assets) return { taxable: 0, taxDeferred: 0, roth: 0 };

    let taxable = 0;
    let taxDeferred = 0;
    let roth = 0;

    // Taxable accounts (withdraw first - most tax efficient)
    if (assets.taxable_accounts) {
        assets.taxable_accounts.forEach(account => {
            taxable += account.value || account.current_value || 0;
        });
    }

    // Retirement accounts - separate into tax-deferred and Roth
    if (assets.retirement_accounts) {
        assets.retirement_accounts.forEach(account => {
            const value = account.value || account.current_value || 0;
            const accountType = (account.type || '').toLowerCase();
            const accountName = (account.name || '').toLowerCase();

            // Roth accounts (withdraw last - tax-free growth)
            if (accountType.includes('roth') || accountName.includes('roth')) {
                roth += value;
            } else {
                // Tax-deferred (withdraw second - Traditional IRA, 401k, etc.)
                taxDeferred += value;
            }
        });
    }

    // Other assets (HSA, Crypto, etc.)
    if (assets.other_assets) {
        assets.other_assets.forEach(asset => {
            const value = asset.value || asset.current_value || 0;
            const type = (asset.type || '').toLowerCase();
            
            if (type === 'hsa') {
                roth += value; // HSA treated like Roth (tax-free out)
            } else {
                taxable += value; // Most others treated as taxable
            }
        });
    }

    return { taxable, taxDeferred, roth };
}

/**
 * Map scenario timeline data to chart data format
 */
function mapScenarioToChartData(timeline, chartData, viewType) {
    if (!timeline || !timeline.years || !timeline.median) {
        return null;
    }

    const scenarioYears = timeline.years;
    const scenarioMedian = timeline.median;

    // Create a map of year to median value
    const yearToMedian = {};
    scenarioYears.forEach((year, index) => {
        yearToMedian[year] = scenarioMedian[index];
    });

    // Map to chart data labels
    const mappedData = chartData.map(dataPoint => {
        if (viewType === 'annual') {
            // For annual view, match by year
            const year = parseInt(dataPoint.label);
            return yearToMedian[year] !== undefined ? yearToMedian[year] : null;
        } else {
            // For monthly view, extract year from label and use that year's value
            const year = dataPoint.date ? dataPoint.date.getFullYear() : null;
            return year && yearToMedian[year] !== undefined ? yearToMedian[year] : null;
        }
    });

    return mappedData;
}

/**
 * Aggregate monthly data to annual
 */
function aggregateToAnnual(monthlyData) {
    const annualData = [];
    const yearMap = new Map();

    monthlyData.forEach(month => {
        const year = month.date.getFullYear();
        if (!yearMap.has(year)) {
            yearMap.set(year, {
                label: year.toString(),
                workIncome: 0,
                retirementBenefits: 0,
                investmentIncome: 0,
                totalIncome: 0,
                expenses: 0,
                federalTax: 0,
                stateTax: 0,
                ficaTax: 0,
                ltcgTax: 0,
                livingExpenses: 0,
                netCashFlow: 0,
                portfolioValue: 0,
                months: 0
            });
        }

        const yearData = yearMap.get(year);
        yearData.workIncome += month.workIncome;
        yearData.retirementBenefits += month.retirementBenefits;
        yearData.investmentIncome += month.investmentIncome;
        yearData.totalIncome += month.totalIncome;
        yearData.expenses += month.expenses;
        yearData.federalTax += (month.federalTax || 0);
        yearData.stateTax += (month.stateTax || 0);
        yearData.ficaTax += (month.ficaTax || 0);
        yearData.ltcgTax += (month.ltcgTax || 0);
        yearData.livingExpenses += (month.livingExpenses || 0);
        yearData.netCashFlow += month.netCashFlow;
        // Use end-of-year portfolio value (last month of year)
        yearData.portfolioValue = month.portfolioValue;
        yearData.months++;
    });

    yearMap.forEach(yearData => {
        annualData.push(yearData);
    });

    return annualData;
}
