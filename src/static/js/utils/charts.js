/**
 * Shared chart rendering utilities to ensure consistency across the app
 */

import { formatCurrency, formatCompact } from './formatters.js';

/**
 * Renders a standardized retirement timeline chart
 * 
 * @param {Object} timeline - Data containing years, p5, median, p95 arrays
 * @param {string} canvasId - DOM ID of the canvas element
 * @param {Object} existingInstances - Object to track and destroy previous chart instances
 * @param {Object} options - Optional overrides (e.g. { showMilestones: true })
 */
export function renderStandardTimelineChart(timeline, canvasId, existingInstances = {}, options = {}) {
    const ctx = document.getElementById(canvasId);
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
    const textSecondary = style.getPropertyValue('--text-secondary').trim() || '#666';

    // 3. Setup milestones (0, 5, 10, 15, 20, 30, 40 years)
    const milestones = [0, 5, 10, 15, 20, 30, 40];
    const pointRadii = (timeline.years || []).map((_, index) => milestones.includes(index) ? 6 : 0);
    const pointHoverRadii = (timeline.years || []).map((_, index) => milestones.includes(index) ? 8 : 4);

    // 4. Handle Multi-Scenario vs Single
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
                    pointRadius: pointRadii,
                    pointHoverRadius: pointHoverRadii,
                    pointBackgroundColor: accentColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
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
                    labels: { color: textSecondary, usePointStyle: true, padding: 15 }
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
                    ticks: { color: textSecondary, maxTicksLimit: 15 },
                    title: { display: true, text: 'Year', color: textSecondary }
                }
            }
        },
        plugins: [{
            id: 'milestoneLabels',
            afterDatasetsDraw(chart) {
                const {ctx, data} = chart;
                const dataset = data.datasets[1]; // Median
                
                ctx.save();
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                
                milestones.forEach(index => {
                    const meta = chart.getDatasetMeta(1);
                    const point = meta.data[index];
                    
                    if (point && !point.skip) {
                        const val = formatCurrency(dataset.data[index], 0);
                        const textWidth = ctx.measureText(val).width;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fillRect(point.x - (textWidth/2) - 4, point.y - 28, textWidth + 8, 16);
                        ctx.fillStyle = accentColor;
                        ctx.fillText(val, point.x, point.y - 16);
                    }
                });
                ctx.restore();
            }
        }]
    });

    if (existingInstances) {
        existingInstances[canvasId] = chart;
    }
    
    return chart;
}
