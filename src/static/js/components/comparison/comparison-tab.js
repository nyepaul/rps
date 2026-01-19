/**
 * Comparison tab component - Compare saved scenarios
 */

import { store } from '../../state/store.js';
import { scenariosAPI } from '../../api/scenarios.js';
import { formatCurrency, formatPercent, formatDate, formatCompact } from '../../utils/formatters.js';
import { showLoading, showError, showSuccess } from '../../utils/dom.js';
import { renderStandardTimelineChart } from '../../utils/charts.js';

let comparisonChartInstances = {};

export async function renderComparisonTab(container) {
    // Clean up previous keyboard handler if exists
    if (container._comparisonKeyboardHandler) {
        document.removeEventListener('keydown', container._comparisonKeyboardHandler);
        container._comparisonKeyboardHandler = null;
    }

    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">📊</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to compare scenarios.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    showLoading(container, 'Loading saved scenarios...');

    try {
        const response = await scenariosAPI.list();
        const scenarios = response.scenarios || [];
        store.set('scenarios', scenarios);

        if (scenarios.length === 0) {
            renderEmptyState(container, profile);
            return;
        }

        renderComparisonView(container, profile, scenarios);
    } catch (error) {
        console.error('Failed to load scenarios:', error);
        showError(container, `Failed to load scenarios: ${error.message}`);
    }
}

function renderEmptyState(container, profile) {
    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: var(--space-8); text-align: center;">
            <div style="font-size: 64px; margin-bottom: var(--space-5);">📊</div>
            <h2 style="margin-bottom: var(--space-4);">No Saved Scenarios</h2>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                Run an analysis and save it as a scenario to compare different strategies.
            </p>
            <button onclick="window.app.showTab('analysis')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
                Run Analysis
            </button>
        </div>
    `;
}

function renderComparisonView(container, profile, scenarios) {
    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: var(--font-3xl); margin-bottom: var(--space-1);">Scenario Comparison</h1>
                    <p style="color: var(--text-secondary);">
                        ${scenarios.length} saved scenario${scenarios.length !== 1 ? 's' : ''} for <strong>${profile.name}</strong>
                    </p>
                </div>
                <button onclick="window.app.showTab('analysis')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; flex-shrink: 0;">
                    + New Analysis
                </button>
            </div>

            <!-- Comparison Table -->
            <div style="background: var(--bg-secondary); border-radius: 12px; overflow: hidden; margin-bottom: 30px;">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
                        <thead>
                            <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                                <th style="padding: 16px; text-align: left; font-weight: 600; font-size: 13px; color: var(--text-secondary);">
                                    <input type="checkbox" id="select-all-scenarios" title="Select all for comparison">
                                </th>
                                <th style="padding: 16px; text-align: left; font-weight: 600; font-size: 13px; color: var(--text-secondary);">SCENARIO</th>
                                <th style="padding: 16px; text-align: center; font-weight: 600; font-size: 13px; color: var(--text-secondary);" title="The statistical probability that your portfolio remains above zero through the end of retirement (based on 10,000+ Monte Carlo trials).">
                                    SUCCESS RATE ⓘ
                                </th>
                                <th style="padding: 16px; text-align: right; font-weight: 600; font-size: 13px; color: var(--text-secondary);">MEDIAN ENDING</th>
                                <th style="padding: 16px; text-align: right; font-weight: 600; font-size: 13px; color: var(--text-secondary);">5TH PERCENTILE</th>
                                <th style="padding: 16px; text-align: right; font-weight: 600; font-size: 13px; color: var(--text-secondary);">95TH PERCENTILE</th>
                                <th style="padding: 16px; text-align: center; font-weight: 600; font-size: 13px; color: var(--text-secondary);">CREATED</th>
                                <th style="padding: 16px; text-align: center; font-weight: 600; font-size: 13px; color: var(--text-secondary);">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="scenarios-table-body">
                            ${scenarios.map(scenario => renderScenarioRow(scenario)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Comparison Chart Section -->
            <div id="comparison-chart-section" style="display: none; background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <h3 style="font-size: 20px; margin: 0;">Portfolio Projection Comparison</h3>
                        <p style="color: var(--text-secondary); margin: 5px 0 0 0; font-size: 13px;">
                            Scroll or +/- keys to zoom, drag to pan
                        </p>
                    </div>
                    <button id="reset-comparison-zoom" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Reset Zoom
                    </button>
                </div>
                <div style="position: relative; height: 400px;">
                    <canvas id="comparison-chart"></canvas>
                </div>
            </div>

            <!-- Quick Tips -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px;">
                <h3 style="font-size: 16px; margin-bottom: 15px; color: var(--text-secondary);">Tips for Scenario Comparison</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <span style="font-size: 20px;">1️⃣</span>
                        <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Run analysis with different assumptions to create scenarios</p>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <span style="font-size: 20px;">2️⃣</span>
                        <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Select scenarios using checkboxes to compare visually</p>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <span style="font-size: 20px;">3️⃣</span>
                        <p style="color: var(--text-secondary); font-size: 14px; margin: 0;">Focus on success rate and 5th percentile for realistic planning</p>
                    </div>
                </div>
            </div>
        </div>

        <style>
            #scenarios-table-body tr:hover {
                background: var(--bg-tertiary);
            }
            .success-badge {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 14px;
            }
            .success-excellent { background: rgba(40, 167, 69, 0.2); color: var(--success-color); }
            .success-good { background: rgba(255, 193, 7, 0.2); color: var(--warning-color); }
            .success-poor { background: rgba(220, 53, 69, 0.2); color: var(--danger-color); }
            .success-info { background: rgba(23, 162, 184, 0.2); color: var(--info-color); }
        </style>
    `;

    setupComparisonHandlers(container, scenarios);
}

function renderScenarioRow(scenario) {
    const results = scenario.results || {};
    const isMultiScenario = results.scenarios && Object.keys(results.scenarios).length > 0;

    let successRate, medianEnding, p5, p95, simulations;

    if (isMultiScenario) {
        // For multi-scenarios, show stats for the 'moderate' case as the representative baseline
        const moderateScenario = results.scenarios.moderate || Object.values(results.scenarios)[0];
        successRate = moderateScenario.success_rate || 0;
        medianEnding = moderateScenario.median_final_balance || 0;
        p5 = moderateScenario.percentile_10 || moderateScenario.percentile_5 || 0;
        p95 = moderateScenario.percentile_90 || moderateScenario.percentile_95 || 0;
        simulations = results.simulations || scenario.parameters?.simulations || 10000;
    } else {
        successRate = results.success_rate || 0;
        medianEnding = results.median_final_balance || 0;
        p5 = results.percentile_10 || results.percentile_5 || 0;
        p95 = results.percentile_90 || results.percentile_95 || 0;
        simulations = results.simulations || scenario.parameters?.simulations || 10000;
    }

    // Determine status class and label based on success rate
    let successClass = 'success-poor';
    let successStatus = 'Needs Attention';
    if (successRate >= 0.9) {
        successClass = 'success-excellent';
        successStatus = 'Excellent';
    } else if (successRate >= 0.75) {
        successClass = 'success-good';
        successStatus = 'Good';
    }

    return `
        <tr data-scenario-id="${scenario.id}" style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
            <td style="padding: 16px;">
                <input type="checkbox" class="scenario-checkbox" value="${scenario.id}">
            </td>
            <td style="padding: 16px;">
                <div style="font-weight: 600; color: var(--text-primary);">${scenario.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${isMultiScenario ? 'Multiple allocations (showing Moderate)' : `${simulations.toLocaleString()} simulations`}
                </div>
            </td>
            <td style="padding: 16px; text-align: center;">
                <span class="success-badge ${successClass}" title="${successStatus}${isMultiScenario ? ' - Baseline Moderate Case' : ''}">
                    ${formatPercent(successRate, 0)}
                </span>
            </td>
            <td style="padding: 16px; text-align: right; font-weight: 500;">
                ${formatCurrency(medianEnding, 0)}
            </td>
            <td style="padding: 16px; text-align: right; color: var(--text-secondary);">
                ${formatCurrency(p5, 0)}
            </td>
            <td style="padding: 16px; text-align: right; color: var(--success-color);">
                ${formatCurrency(p95, 0)}
            </td>
            <td style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
                ${formatDate(scenario.created_at)}
            </td>
            <td style="padding: 16px; text-align: center;">
                <button class="delete-scenario-btn" data-id="${scenario.id}"
                    style="background: none; border: none; cursor: pointer; color: var(--danger-color); font-size: 16px; padding: 5px;"
                    title="Delete scenario">
                    🗑️
                </button>
            </td>
        </tr>
    `;
}

function setupComparisonHandlers(container, scenarios) {
    const checkboxes = container.querySelectorAll('.scenario-checkbox');
    const selectAllCheckbox = container.querySelector('#select-all-scenarios');
    const chartSection = container.querySelector('#comparison-chart-section');
    const resetZoomBtn = container.querySelector('#reset-comparison-zoom');

    // Handle select all
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateComparisonChart(scenarios);
        });
    }

    // Handle individual checkbox changes
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            updateComparisonChart(scenarios);

            // Update select all state
            const allChecked = Array.from(checkboxes).every(c => c.checked);
            const someChecked = Array.from(checkboxes).some(c => c.checked);
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = someChecked && !allChecked;
            }
        });
    });

    // Handle reset zoom button
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            const chart = comparisonChartInstances['comparison-chart'];
            if (chart) {
                chart.resetZoom();
            }
        });
    }

    // Handle keyboard zoom controls (+ and -)
    const keyboardZoomHandler = (e) => {
        const chart = comparisonChartInstances['comparison-chart'];
        if (!chart || !chartSection || chartSection.style.display === 'none') return;

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

    // Store handler reference for cleanup
    if (!container._comparisonKeyboardHandler) {
        container._comparisonKeyboardHandler = keyboardZoomHandler;
    }

    // Handle delete buttons
    container.querySelectorAll('.delete-scenario-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const scenario = scenarios.find(s => s.id == id);

            if (confirm(`Delete scenario "${scenario?.name || id}"?`)) {
                try {
                    await scenariosAPI.delete(id);
                    showSuccess('Scenario deleted');
                    // Re-render the tab
                    renderComparisonTab(container);
                } catch (error) {
                    console.error('Delete error:', error);
                    alert(`Failed to delete: ${error.message}`);
                }
            }
        });
    });

    function updateComparisonChart(allScenarios) {
        const selectedIds = Array.from(checkboxes)
            .filter(c => c.checked)
            .map(c => parseInt(c.value));

        if (selectedIds.length < 1) {
            chartSection.style.display = 'none';
            return;
        }

        chartSection.style.display = 'block';
        renderComparisonChart(container, selectedIds, allScenarios);
    }
}

function renderComparisonChart(container, selectedIds, allScenarios) {
    const canvasId = 'comparison-chart';
    const ctx = container.querySelector('#' + canvasId);
    if (!ctx) return;

    // Destroy existing chart
    if (comparisonChartInstances[canvasId]) {
        comparisonChartInstances[canvasId].destroy();
        delete comparisonChartInstances[canvasId];
    }

    const selectedScenarios = allScenarios.filter(s => selectedIds.includes(s.id));
    const colors = ['#3498db', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'];

    // Build datasets from scenarios
    const datasets = [];
    let labels = [];
    let colorIndex = 0;
    const milestones = [0, 5, 10, 15, 20, 30, 40];

    selectedScenarios.forEach((scenario) => {
        const results = scenario.results || {};
        const isMultiScenario = results.scenarios && Object.keys(results.scenarios).length > 0;
        
        let timeline = null;
        if (isMultiScenario) {
            const subScenario = results.scenarios.moderate || Object.values(results.scenarios)[0];
            timeline = subScenario.timeline;
        } else {
            timeline = results.timeline;
        }
        
        if (timeline && timeline.median) {
            if (timeline.years && timeline.years.length > labels.length) {
                labels = timeline.years;
            }
            
            const color = colors[colorIndex % colors.length];
            datasets.push({
                label: scenario.name,
                data: timeline.median.map(d => d),
                borderColor: color,
                backgroundColor: 'transparent',
                tension: 0.3,
                borderWidth: 3,
                pointRadius: (timeline.years || []).map((_, idx) => milestones.includes(indexToYearOffset(idx, timeline)) ? 5 : 0),
                pointHoverRadius: 6,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 1
            });
            colorIndex++;
        }
    });

    function indexToYearOffset(idx, timeline) {
        // Simplified for standard milestone check
        return idx;
    }

    if (datasets.length === 0) {
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                <p>Timeline data not available for selected scenarios.</p>
            </div>
        `;
        return;
    }

    const style = getComputedStyle(document.body);
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#212529';
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#666';
    const ChartConstructor = typeof Chart !== 'undefined' ? Chart : window.Chart;

    comparisonChartInstances[canvasId] = new ChartConstructor(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textPrimary,
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 14,
                            weight: '600'
                        }
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
                        label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw, 0)}`
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy',
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
                        mode: 'xy'
                    },
                    limits: {
                        x: {
                            min: 'original',
                            max: 'original'
                        },
                        y: {
                            min: 'original',
                            max: 'original'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(128,128,128,0.2)' },
                    ticks: {
                        color: textPrimary,
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        callback: (value) => formatCompact(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textPrimary,
                        maxTicksLimit: 15,
                        font: {
                            size: 13,
                            weight: '500'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Year',
                        color: textPrimary,
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}
