/**
 * Shared chart rendering utilities to ensure consistency across the app
 */

import { formatCurrency, formatCompact } from './formatters.js';

// Keep track of all active chart instances for theme updates
const activeCharts = new Set();

// Listen for theme changes to update all charts
window.addEventListener('themeChanged', () => {
    const style = getComputedStyle(document.body);
    const successColor = style.getPropertyValue('--success-color').trim() || '#28a745';
    const dangerColor = style.getPropertyValue('--danger-color').trim() || '#dc3545';
    const accentColor = style.getPropertyValue('--accent-color').trim() || '#3498db';
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#212529';
    
    activeCharts.forEach(chart => {
        // Update chart options
        if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = textPrimary;
        if (chart.options.scales.x.title) chart.options.scales.x.title.color = textPrimary;
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = textPrimary;
        
        if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = textPrimary;
        }

        // Update datasets colors if they match standard theme colors
        // This is a heuristic; for perfect results, we'd store the "intent" of the dataset
        chart.data.datasets.forEach(dataset => {
            // We re-apply the standard colors based on the dataset order/label usually used
            // This assumes the standard timeline chart structure
            if (dataset.label.includes('95th') || dataset.label.includes('Optimistic')) {
                dataset.borderColor = successColor;
                dataset.backgroundColor = successColor + '20';
            } else if (dataset.label.includes('Median')) {
                dataset.borderColor = accentColor;
            } else if (dataset.label.includes('5th') || dataset.label.includes('Conservative')) {
                dataset.borderColor = dangerColor;
                dataset.backgroundColor = dangerColor + '20';
            }
        });

        chart.update();
    });
});

/**
 * Renders a standardized retirement timeline chart
 * 
 * @param {Object} timeline - Data containing years, p5, median, p95 arrays
 * @param {string|HTMLElement} canvasOrId - DOM ID of the canvas element or the element itself
 * @param {Object} existingInstances - Object to track and destroy previous chart instances
 * @param {Object} options - Optional overrides (e.g. { container: parentNode })
 */
export function renderStandardTimelineChart(timeline, canvasOrId, existingInstances = {}, options = {}) {
    let canvas;
    let canvasId;

    if (typeof canvasOrId === 'string') {
        canvasId = canvasOrId;
        if (options.container) {
            canvas = options.container.querySelector('#' + canvasId);
        } else {
            canvas = document.getElementById(canvasId);
        }
    } else {
        canvas = canvasOrId;
        canvasId = canvas.id || 'unknown-chart';
    }

    if (!canvas) {
        console.warn('Canvas element not found for chart:', canvasOrId);
        return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Destroy existing instance if provided
    if (existingInstances[canvasId]) {
        existingInstances[canvasId].destroy();
        delete existingInstances[canvasId];
    }

    // 2. Setup colors and styles
    const style = getComputedStyle(document.body);
    const successColor = style.getPropertyValue('--success-color').trim() || '#28a745';
    const dangerColor = style.getPropertyValue('--danger-color').trim() || '#dc3545';
    const accentColor = style.getPropertyValue('--accent-color').trim() || '#3498db';
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#212529';
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#666';

    // 3. Handle Multi-Scenario vs Single
    // If timeline is from a multi-scenario result, it might be nested
    const years = timeline.years || [];
    const p95 = timeline.p95 || [];
    const median = timeline.median || [];
    const p5 = timeline.p5 || [];

    // 5. Create Chart
    const ChartConstructor = typeof Chart !== 'undefined' ? Chart : window.Chart;
    if (!ChartConstructor) {
        console.error('Chart.js not found');
        return null;
    }

    const chart = new ChartConstructor(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: '95th Percentile (Optimistic)',
                    data: p95,
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
                    data: median,
                    borderColor: accentColor,
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '5th Percentile (Conservative)',
                    data: p5,
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
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    yAlign: 'top',
                    xAlign: 'left',
                    caretPadding: 10,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw, 0)}`
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
                        x: { min: 'original', max: 'original' }
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

    // Track active instance for theme updates
    activeCharts.add(chart);
    
    // Override destroy to remove from set
    const originalDestroy = chart.destroy.bind(chart);
    chart.destroy = () => {
        activeCharts.delete(chart);
        originalDestroy();
    };

    if (existingInstances) {
        existingInstances[canvasId] = chart;
    }
    
    return chart;
}
