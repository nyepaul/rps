/**
 * Comparison tab component - Compare saved scenarios
 */

import { store } from '../../state/store.js';
import { scenariosAPI } from '../../api/scenarios.js';
import { formatCurrency, formatPercent, formatDate, formatCompact } from '../../utils/formatters.js';
import { showLoading, showError, showSuccess } from '../../utils/dom.js';

let comparisonChartInstance = null;

export async function renderComparisonTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to compare scenarios.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
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
        <div style="max-width: 800px; margin: 0 auto; padding: 40px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
            <h2 style="margin-bottom: 15px;">No Saved Scenarios</h2>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Run an analysis and save it as a scenario to compare different strategies.
            </p>
            <button onclick="window.app.showTab('analysis')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                Run Analysis
            </button>
        </div>
    `;
}

function renderComparisonView(container, profile, scenarios) {
    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h1 style="font-size: 28px; margin-bottom: 5px;">Scenario Comparison</h1>
                    <p style="color: var(--text-secondary);">
                        ${scenarios.length} saved scenario${scenarios.length !== 1 ? 's' : ''} for <strong>${profile.name}</strong>
                    </p>
                </div>
                <button onclick="window.app.showTab('analysis')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
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
                                <th style="padding: 16px; text-align: center; font-weight: 600; font-size: 13px; color: var(--text-secondary);">SUCCESS RATE</th>
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
                <h3 style="font-size: 20px; margin-bottom: 15px;">Portfolio Projection Comparison</h3>
                <p style="color: var(--text-secondary); margin-bottom: 15px;">
                    Select 2 or more scenarios above to compare their projections
                </p>
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
        </style>
    `;

    setupComparisonHandlers(container, scenarios);
}

function renderScenarioRow(scenario) {
    const results = scenario.results || {};
    const successRate = results.success_rate || 0;

    let successClass = 'success-poor';
    let successLabel = 'Poor';
    if (successRate >= 0.9) {
        successClass = 'success-excellent';
        successLabel = 'Excellent';
    } else if (successRate >= 0.75) {
        successClass = 'success-good';
        successLabel = 'Good';
    }

    return `
        <tr data-scenario-id="${scenario.id}" style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
            <td style="padding: 16px;">
                <input type="checkbox" class="scenario-checkbox" value="${scenario.id}">
            </td>
            <td style="padding: 16px;">
                <div style="font-weight: 600; color: var(--text-primary);">${scenario.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${(results.simulations || 10000).toLocaleString()} simulations
                </div>
            </td>
            <td style="padding: 16px; text-align: center;">
                <span class="success-badge ${successClass}">
                    ${formatPercent(successRate, 0)}
                </span>
            </td>
            <td style="padding: 16px; text-align: right; font-weight: 500;">
                ${formatCurrency(results.median_final_balance || 0, 0)}
            </td>
            <td style="padding: 16px; text-align: right; color: var(--text-secondary);">
                ${formatCurrency(results.percentile_10 || results.percentile_5 || 0, 0)}
            </td>
            <td style="padding: 16px; text-align: right; color: var(--success-color);">
                ${formatCurrency(results.percentile_90 || results.percentile_95 || 0, 0)}
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

        if (selectedIds.length < 2) {
            chartSection.style.display = 'none';
            return;
        }

        chartSection.style.display = 'block';
        renderComparisonChart(selectedIds, allScenarios);
    }
}

function renderComparisonChart(selectedIds, allScenarios) {
    const ctx = document.getElementById('comparison-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (comparisonChartInstance) {
        comparisonChartInstance.destroy();
    }

    const selectedScenarios = allScenarios.filter(s => selectedIds.includes(s.id));
    const colors = ['#3498db', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'];

    // Build datasets from scenarios with timeline data
    const datasets = [];
    let labels = [];

    selectedScenarios.forEach((scenario, i) => {
        const timeline = scenario.results?.timeline;
        if (timeline && timeline.median) {
            if (timeline.years && timeline.years.length > labels.length) {
                labels = timeline.years;
            }
            datasets.push({
                label: scenario.name,
                data: timeline.median,
                borderColor: colors[i % colors.length],
                backgroundColor: 'transparent',
                tension: 0.3,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }
    });

    if (datasets.length === 0) {
        // No timeline data available, show message
        ctx.parentElement.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
                <p>Timeline data not available for selected scenarios.</p>
                <p style="font-size: 13px;">Run new analyses to generate timeline projections.</p>
            </div>
        `;
        return;
    }

    const style = getComputedStyle(document.body);
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#666';

    comparisonChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
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
                title: {
                    display: true,
                    text: 'Median Portfolio Value Over Time',
                    color: textSecondary,
                    font: { size: 14 }
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
                    grid: { color: 'rgba(128,128,128,0.1)' },
                    ticks: {
                        color: textSecondary,
                        callback: (value) => formatCompact(value)
                    }
                },
                x: {
                    grid: { display: false },
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
