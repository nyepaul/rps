/**
 * Dashboard tab component - Profile Management
 * Shows all available profiles with selection, info, and deletion options
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { formatCurrency, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { STORAGE_KEYS } from '../../config.js';
import { calculateNetWorth, calculateLiquidAssets, calculateRetirementAssets, calculateRealEstateEquity, calculateTotalDebts } from '../../utils/financial-calculations.js';

export async function renderDashboardTab(container) {
    const currentUser = store.get('currentUser');
    const currentProfile = store.get('currentProfile');

    // Clear container while loading (global spinner handles the loading indicator)
    container.innerHTML = '';

    try {
        // Fetch all profiles for the current user
        const result = await profilesAPI.list();
        const profiles = result.profiles || [];

        renderProfileDashboard(container, profiles, currentProfile, currentUser);
    } catch (error) {
        console.error('Error loading profiles:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px; color: var(--danger-color);">⚠️</div>
                <h2 style="margin-bottom: 10px;">Error Loading Profiles</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    ${error.message || 'Could not load your profiles'}
                </p>
                <button onclick="window.location.reload()" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

/**
 * Render the profile dashboard
 */
function renderProfileDashboard(container, profiles, currentProfile, currentUser) {
    const hasProfiles = profiles && profiles.length > 0;

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); flex-wrap: wrap; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: 15px; margin: 0; font-weight: 600;">📊 Profile Dashboard</h1>
                </div>
                <button id="create-profile-btn" style="padding: 4px 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; flex-shrink: 0;">
                    + New
                </button>
            </div>

            ${currentProfile ? renderFinancialSummary(currentProfile) : ''}

            ${hasProfiles ? `
            <!-- Profiles Grid -->
            <div>
                <div id="profiles-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                    ${profiles.map(profile => renderProfileCard(profile, currentProfile)).join('')}
                </div>
            </div>
            ` : `
            <!-- No Profiles State -->
            <div style="text-align: center; padding: 40px 20px; background: var(--bg-secondary); border-radius: 8px; border: 2px dashed var(--border-color);">
                <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📁</div>
                <h2 style="margin-bottom: 12px; font-size: 18px;">No Profiles Yet</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 13px; max-width: 400px; margin-left: auto; margin-right: auto;">
                    Create your first financial planning profile to start modeling your retirement.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Get Started
                </button>
            </div>
            `}
        </div>
    `;

    setupDashboardHandlers(container, profiles);
}

/**
 * Render financial summary for active profile
 */
function renderFinancialSummary(profile) {
    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};
    const spouse = data.spouse || {};
    const incomeStreams = data.income_streams || [];
    const budget = data.budget || {};
    const expensesCurrent = budget.expenses?.current || {};

    // Calculate net worth and breakdown
    const { netWorth, totalAssets, totalDebts, breakdown } = calculateNetWorth(assets);

    // Calculate total annual income from currently active income streams
    const today = new Date();
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    const totalAnnualIncome = incomeStreams.reduce((sum, stream) => {
        const amount = parseFloat(stream.amount) || 0;
        if (amount <= 0) return sum;

        // Check if stream has started
        if (stream.start_date && new Date(stream.start_date) > today) {
            return sum;
        }

        // Check if stream has ended
        const endDate = stream.end_date ? new Date(stream.end_date) : retirementDate;
        if (endDate && today > endDate) {
            return sum;
        }

        return sum + amount * 12;
    }, 0);

    // Calculate total annual expenses
    const totalAnnualExpenses = Object.values(expensesCurrent).flat().reduce((sum, expense) => {
        return sum + (parseFloat(expense.amount) || 0) * 12;
    }, 0);

    const annualSavings = totalAnnualIncome - totalAnnualExpenses;
    const savingsRate = totalAnnualIncome > 0 ? (annualSavings / totalAnnualIncome) * 100 : 0;

    // Calculate age
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = profile.birth_date ? calcAge(profile.birth_date) : null;

    // Calculate years to retirement
    let yearsToRetirement = null;
    if (profile.retirement_date) {
        const retDate = new Date(profile.retirement_date);
        const diffTime = retDate - today;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        yearsToRetirement = Math.max(0, Math.ceil(diffDays / 365));
    }

    // Generate unique IDs for canvas elements
    const assetChartId = `asset-chart-${Date.now()}`;
    const cashflowChartId = `cashflow-chart-${Date.now()}-1`;
    const savingsGaugeId = `savings-gauge-${Date.now()}`;

    setTimeout(() => {
        // Asset Allocation Pie Chart
        const assetCanvas = document.getElementById(assetChartId);
        if (assetCanvas && window.Chart) {
            const chartData = {
                labels: ['Retirement Accounts', 'Taxable Accounts', 'Real Estate Equity', 'Other Assets'],
                datasets: [{
                    data: [
                        breakdown.retirementAssets,
                        breakdown.taxableAssets,
                        breakdown.realEstateAssets,
                        breakdown.otherAssets
                    ],
                    backgroundColor: [
                        '#3498db', // blue
                        '#2ecc71', // green
                        '#e74c3c', // red
                        '#95a5a6'  // gray
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            };

            new Chart(assetCanvas, {
                type: 'doughnut',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: { size: 13, weight: 'bold' },
                                color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-primary').trim()
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${label}: $${(value / 1000).toFixed(0)}K (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Income vs Expenses Bar Chart
        const cashflowCanvas = document.getElementById(cashflowChartId);
        if (cashflowCanvas && window.Chart) {
            new Chart(cashflowCanvas, {
                type: 'bar',
                data: {
                    labels: ['Annual Cash Flow'],
                    datasets: [
                        {
                            label: 'Income',
                            data: [totalAnnualIncome],
                            backgroundColor: '#2ecc71',
                            borderWidth: 0
                        },
                        {
                            label: 'Expenses',
                            data: [totalAnnualExpenses],
                            backgroundColor: '#e74c3c',
                            borderWidth: 0
                        },
                        {
                            label: 'Savings',
                            data: [annualSavings],
                            backgroundColor: annualSavings >= 0 ? '#3498db' : '#e67e22',
                            borderWidth: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 8,
                                font: { size: 13, weight: 'bold' },
                                color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-primary').trim()
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: $${(context.parsed.x / 1000).toFixed(0)}K`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                callback: function(value) {
                                    return '$' + (value / 1000).toFixed(0) + 'K';
                                },
                                font: { size: 11, weight: 'bold' },
                                color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-secondary').trim()
                            },
                            grid: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                            }
                        },
                        y: {
                            ticks: {
                                font: { size: 11, weight: 'bold' },
                                color: getComputedStyle(document.documentElement).getPropertyValue('--chart-text-secondary').trim()
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        // Savings Rate Gauge (using doughnut)
        const gaugeCanvas = document.getElementById(savingsGaugeId);
        if (gaugeCanvas && window.Chart) {
            const displayRate = Math.min(100, Math.max(0, savingsRate));
            new Chart(gaugeCanvas, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [displayRate, 100 - displayRate],
                        backgroundColor: [
                            displayRate >= 20 ? '#2ecc71' : displayRate >= 10 ? '#f39c12' : '#e74c3c',
                            '#ecf0f1'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    rotation: -90,
                    circumference: 180,
                    cutout: '75%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                },
                plugins: [{
                    afterDraw: (chart) => {
                        const ctx = chart.ctx;
                        const width = chart.width;
                        const height = chart.height;
                        ctx.restore();

                        const fontSize = (height / 70).toFixed(2);
                        ctx.font = `900 ${fontSize}em sans-serif`;
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--chart-text-primary').trim();

                        const text = displayRate.toFixed(0) + '%';
                        const textX = Math.round((width - ctx.measureText(text).width) / 2);
                        const textY = height / 1.5;

                        ctx.fillText(text, textX, textY);
                        ctx.save();
                    }
                }]
            });
        }
    }, 100);

    return `
        <!-- Active Profile Financial Summary -->
        <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 2px solid var(--accent-color); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 11px; font-weight: 700; background: var(--accent-color); color: white; padding: 4px 10px; border-radius: 4px;">ACTIVE PROFILE</span>
                    <h2 style="font-size: 20px; margin: 0; font-weight: 700;">${profile.name}</h2>
                </div>
                <button onclick="window.app.showTab('profile')" style="padding: 6px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                    Edit Profile
                </button>
            </div>

            <!-- Key Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px;">
                <!-- Net Worth -->
                <div id="metric-networth" class="metric-card" style="background: linear-gradient(135deg, #2ecc71, #27ae60); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">💰 Net Worth</div>
                    <div style="font-size: 18px; font-weight: 700;">${formatCompact(netWorth)}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>

                <!-- Annual Income -->
                <div id="metric-income" class="metric-card" style="background: linear-gradient(135deg, #3498db, #2980b9); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">📈 Annual Income</div>
                    <div style="font-size: 18px; font-weight: 700;">${totalAnnualIncome > 0 ? formatCompact(totalAnnualIncome) : 'Not set'}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>

                <!-- Annual Expenses -->
                <div id="metric-expenses" class="metric-card" style="background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">📉 Annual Expenses</div>
                    <div style="font-size: 18px; font-weight: 700;">${totalAnnualExpenses > 0 ? formatCompact(totalAnnualExpenses) : 'Not set'}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>

                <!-- Savings Rate -->
                <div id="metric-savings-rate" class="metric-card" style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">💵 Savings Rate</div>
                    <div style="font-size: 18px; font-weight: 700;">${totalAnnualIncome > 0 ? savingsRate.toFixed(1) + '%' : 'N/A'}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>

                ${currentAge ? `
                <!-- Current Age -->
                <div id="metric-age" class="metric-card" style="background: linear-gradient(135deg, #1abc9c, #16a085); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">👤 Current Age</div>
                    <div style="font-size: 18px; font-weight: 700;">${currentAge}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>
                ` : ''}

                ${yearsToRetirement !== null ? `
                <!-- Years to Retirement -->
                <div id="metric-retirement" class="metric-card" style="background: linear-gradient(135deg, #f39c12, #e67e22); padding: 12px; border-radius: 6px; color: white; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                    <div style="font-size: 10px; opacity: 0.9; margin-bottom: 4px;">🏖️ To Retirement</div>
                    <div style="font-size: 18px; font-weight: 700;">${yearsToRetirement} ${yearsToRetirement === 1 ? 'year' : 'years'}</div>
                    <div style="font-size: 9px; opacity: 0.7; margin-top: 4px;">Click for details</div>
                </div>
                ` : ''}
            </div>

            <!-- Charts Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
                <!-- Asset Allocation Chart -->
                <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <h3 style="font-size: 13px; margin: 0 0 10px 0; font-weight: 600; color: var(--text-secondary);">Asset Allocation</h3>
                    <div style="height: 180px; display: flex; align-items: center; justify-content: center;">
                        ${totalAssets > 0 ? `
                            <canvas id="${assetChartId}" style="max-height: 180px;"></canvas>
                        ` : `
                            <div style="text-align: center; color: var(--text-secondary); font-size: 12px;">
                                <div style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;">📊</div>
                                <div>No assets added yet</div>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Cash Flow Chart -->
                <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <h3 style="font-size: 13px; margin: 0 0 10px 0; font-weight: 600; color: var(--text-secondary);">Annual Cash Flow</h3>
                    <div style="height: 180px; display: flex; align-items: center; justify-content: center;">
                        ${(totalAnnualIncome > 0 || totalAnnualExpenses > 0) ? `
                            <canvas id="${cashflowChartId}" style="max-height: 180px;"></canvas>
                        ` : `
                            <div style="text-align: center; color: var(--text-secondary); font-size: 12px;">
                                <div style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;">💸</div>
                                <div>No income or expenses set</div>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Savings Rate Gauge -->
                ${totalAnnualIncome > 0 ? `
                <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <h3 style="font-size: 13px; margin: 0 0 10px 0; font-weight: 600; color: var(--text-secondary);">Savings Rate</h3>
                    <div style="height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="width: 150px; height: 100px; position: relative;">
                            <canvas id="${savingsGaugeId}"></canvas>
                        </div>
                        <div style="text-align: center; margin-top: 8px; font-size: 11px; color: var(--text-secondary);">
                            ${savingsRate >= 20 ? '✅ Excellent!' : savingsRate >= 10 ? '👍 Good' : '⚠️ Consider increasing'}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render a profile card
 */
function renderProfileCard(profile, currentProfile) {
    const isActive = currentProfile && currentProfile.name === profile.name;
    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};
    const incomeStreams = data.income_streams || [];

    // Calculate net worth (assets - debts)
    const { netWorth } = calculateNetWorth(assets);

    // Calculate total annual income from currently active income streams
    const today = new Date();
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    const totalAnnualIncome = incomeStreams.reduce((sum, stream) => {
        const amount = parseFloat(stream.amount) || 0;
        if (amount <= 0) return sum;

        // Check if stream has started
        if (stream.start_date && new Date(stream.start_date) > today) {
            return sum; // Not started yet
        }

        // Check if stream has ended (use retirement date if no end date specified)
        const endDate = stream.end_date ? new Date(stream.end_date) : retirementDate;
        if (endDate && today > endDate) {
            return sum; // Already ended
        }

        return sum + amount * 12;
    }, 0);

    // Calculate age
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = profile.birth_date ? calcAge(profile.birth_date) : null;

    // Format last updated
    const lastUpdated = profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Unknown';

    return `
        <div class="profile-card ${isActive ? 'active-profile-card' : ''}" data-profile-name="${profile.name}" style="
            background: var(--bg-secondary);
            border-radius: 6px;
            padding: 8px;
            border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
            transition: all 0.2s;
            position: relative;
            box-shadow: ${isActive ? '0 1px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)'};
            ${isActive ? 'cursor: pointer;' : ''}
        ">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <h3 style="font-size: 13px; margin: 0; font-weight: 700; color: var(--text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${profile.name}</h3>
                <span style="font-size: 9px; color: var(--text-secondary); opacity: 0.8;">${lastUpdated}</span>
            </div>

            <!-- Stats (horizontal) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
                <div style="text-align: left; padding: 4px 6px; background: var(--bg-primary); border-radius: 4px;">
                    <div style="font-size: 8px; color: var(--text-secondary); margin-bottom: 1px;">Net Worth</div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--success-color);">
                        ${netWorth !== 0 ? formatCompact(netWorth) : '--'}
                    </div>
                </div>
                <div style="text-align: left; padding: 4px 6px; background: var(--bg-primary); border-radius: 4px;">
                    <div style="font-size: 8px; color: var(--text-secondary); margin-bottom: 1px;">Income</div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--accent-color);">
                        ${totalAnnualIncome > 0 ? formatCompact(totalAnnualIncome) : '--'}
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 3px;">
                ${!isActive ? `
                <button class="load-profile-btn" data-profile-name="${profile.name}" style="flex: 1; padding: 4px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">
                    Load
                </button>
                ` : `
                <button disabled style="flex: 1; padding: 4px; background: var(--bg-tertiary); color: var(--text-secondary); border: none; border-radius: 4px; cursor: not-allowed; font-size: 10px; font-weight: 600;">
                    Current
                </button>
                `}
                <button class="view-info-btn" data-profile-name="${profile.name}" style="padding: 4px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">
                    Info
                </button>
                <button class="delete-profile-btn" data-profile-name="${profile.name}" style="padding: 4px 6px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 10px; opacity: 0.6;" onmouseover="this.style.opacity='1'; this.style.background='var(--danger-color)'; this.style.color='white'" onmouseout="this.style.opacity='0.6'; this.style.background='transparent'; this.style.color='var(--danger-color)'">
                    ✕
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup dashboard event handlers
 */
function setupDashboardHandlers(container, profiles) {
    // Create Profile Button
    const createBtn = container.querySelector('#create-profile-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            window.app.showTab('welcome');
        });
    }

    // Load Profile Buttons
    container.querySelectorAll('.load-profile-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const profileName = btn.dataset.profileName;
            await loadProfile(profileName, container);
        });
    });

    // Edit Profile Buttons
    container.querySelectorAll('.edit-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            editProfile(profileName);
        });
    });

    // View Info Buttons
    container.querySelectorAll('.view-info-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            const profile = profiles.find(p => p.name === profileName);
            if (profile) {
                showProfileInfoModal(profile);
            }
        });
    });

    // Clone Profile Buttons
    container.querySelectorAll('.clone-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            await cloneProfile(profileName, container);
        });
    });

    // Delete Profile Buttons
    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            await deleteProfile(profileName, container);
        });
    });

    // Active Profile Card Click (opens edit)
    const activeProfileCard = container.querySelector('.active-profile-card');
    if (activeProfileCard) {
        activeProfileCard.addEventListener('click', (e) => {
            // Only trigger if clicking the card itself, not buttons
            if (e.target.classList.contains('profile-card') ||
                e.target.classList.contains('active-profile-card') ||
                e.target.closest('.profile-card') === activeProfileCard &&
                !e.target.closest('button')) {
                const profileName = activeProfileCard.dataset.profileName;
                editProfile(profileName);
            }
        });

        // Add hover effect
        activeProfileCard.addEventListener('mouseenter', () => {
            activeProfileCard.style.transform = 'translateY(-2px)';
            activeProfileCard.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });
        activeProfileCard.addEventListener('mouseleave', () => {
            activeProfileCard.style.transform = '';
            activeProfileCard.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
        });
    }

    // Metric Card Click Handlers - fetch fresh complete profile data from API
    const networthCard = container.querySelector('#metric-networth');
    if (networthCard) {
        networthCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showNetWorthDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showNetWorthDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }

    const incomeCard = container.querySelector('#metric-income');
    if (incomeCard) {
        incomeCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showIncomeDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showIncomeDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }

    const expensesCard = container.querySelector('#metric-expenses');
    if (expensesCard) {
        expensesCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showExpensesDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showExpensesDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }

    const savingsCard = container.querySelector('#metric-savings-rate');
    if (savingsCard) {
        savingsCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showSavingsRateDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showSavingsRateDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }

    const ageCard = container.querySelector('#metric-age');
    if (ageCard) {
        ageCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showAgeDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showAgeDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }

    const retirementCard = container.querySelector('#metric-retirement');
    if (retirementCard) {
        retirementCard.addEventListener('click', async () => {
            const currentProfile = store.get('currentProfile');
            if (currentProfile && currentProfile.name) {
                try {
                    const result = await profilesAPI.get(currentProfile.name);
                    showRetirementDetails(result.profile);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                    showRetirementDetails(currentProfile); // Fallback to store data
                }
            }
        });
    }
}

/**
 * Load a profile
 */
async function loadProfile(profileName, container) {
    showSpinner(`Loading profile "${profileName}"...`);
    try {
        const result = await profilesAPI.get(profileName);
        store.setState({ currentProfile: result.profile });

        // Set as default profile
        localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);

        showSuccess(`Profile "${profileName}" loaded successfully!`);

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error loading profile:', error);
        showError(`Failed to load profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Edit a profile
 */
async function editProfile(profileName) {
    showSpinner(`Opening profile "${profileName}"...`);
    try {
        const result = await profilesAPI.get(profileName);
        store.setState({ currentProfile: result.profile });

        // Set as default profile
        localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);

        // Navigate to profile tab
        window.app.showTab('profile');
    } catch (error) {
        console.error('Error loading profile for edit:', error);
        showError(`Failed to open profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Clone a profile
 */
async function cloneProfile(profileName, container) {
    // Prompt for new profile name
    const newName = prompt(`Enter a name for the cloned profile:`, `${profileName} (Copy)`);

    // User cancelled
    if (newName === null) {
        return;
    }

    // Validate name
    if (!newName || !newName.trim()) {
        showError('Profile name cannot be empty');
        return;
    }

    showSpinner(`Cloning profile "${profileName}"...`);
    try {
        const result = await profilesAPI.clone(profileName, newName.trim());
        showSuccess(`Profile "${profileName}" cloned as "${newName.trim()}"!`);

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error cloning profile:', error);
        showError(`Failed to clone profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Delete a profile
 */
async function deleteProfile(profileName, container) {
    const currentProfile = store.get('currentProfile');
    const isActive = currentProfile && currentProfile.name === profileName;

    const confirmMsg = isActive
        ? `Are you sure you want to delete the ACTIVE profile "${profileName}"?\n\nThis will permanently delete all data and cannot be undone.`
        : `Are you sure you want to delete profile "${profileName}"?\n\nThis action cannot be undone.`;

    if (!confirm(confirmMsg)) {
        return;
    }

    showSpinner(`Deleting profile "${profileName}"...`);
    try {
        await profilesAPI.delete(profileName);
        showSuccess(`Profile "${profileName}" deleted successfully!`);

        // If deleted profile was active, clear it
        if (isActive) {
            store.setState({ currentProfile: null });
            localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
        }

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error deleting profile:', error);
        showError(`Failed to delete profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Show profile info modal
 */
function showProfileInfoModal(profile) {
    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};
    const spouse = data.spouse || {};
    const children = data.children || [];
    const incomeStreams = data.income_streams || [];
    const expenseItems = data.expenses || [];

    // Calculate net worth and breakdown
    const { netWorth, totalAssets, totalDebts, breakdown } = calculateNetWorth(assets);

    // Calculate total annual income from currently active income streams
    const today = new Date();
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    const totalAnnualIncome = incomeStreams.reduce((sum, stream) => {
        const amount = parseFloat(stream.amount) || 0;
        if (amount <= 0) return sum;

        // Check if stream has started
        if (stream.start_date && new Date(stream.start_date) > today) {
            return sum; // Not started yet
        }

        // Check if stream has ended (use retirement date if no end date specified)
        const endDate = stream.end_date ? new Date(stream.end_date) : retirementDate;
        if (endDate && today > endDate) {
            return sum; // Already ended
        }

        return sum + amount * 12;
    }, 0);

    // Calculate total annual expenses
    const totalAnnualExpenses = expenseItems.reduce((sum, expense) => {
        return sum + (parseFloat(expense.amount) || 0) * 12;
    }, 0);
    const retirementTotal = breakdown.retirementAssets;
    const taxableTotal = breakdown.taxableAssets;
    const realEstateEquity = breakdown.realEstateAssets; // This is already equity (value - mortgage)
    const realEstateGross = breakdown.realEstateGross;
    const mortgageDebts = breakdown.mortgageDebts;
    const otherTotal = breakdown.otherAssets;

    // Calculate age
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = profile.birth_date ? calcAge(profile.birth_date) : null;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 28px;">${profile.name}</h2>
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        Created: ${new Date(profile.created_at).toLocaleDateString()} •
                        Updated: ${new Date(profile.updated_at).toLocaleDateString()}
                    </div>
                </div>
                <button id="close-modal-btn" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Close
                </button>
            </div>

            <!-- Personal Info -->
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Personal Information</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                        ${profile.birth_date ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Birth Date</div>
                            <div style="font-size: 14px; font-weight: 500;">${new Date(profile.birth_date).toLocaleDateString()}</div>
                        </div>
                        ` : ''}
                        ${currentAge ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Current Age</div>
                            <div style="font-size: 14px; font-weight: 500;">${currentAge}</div>
                        </div>
                        ` : ''}
                        ${profile.retirement_date ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Retirement Date</div>
                            <div style="font-size: 14px; font-weight: 500;">${new Date(profile.retirement_date).toLocaleDateString()}</div>
                        </div>
                        ` : ''}
                        ${spouse.name ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Spouse</div>
                            <div style="font-size: 14px; font-weight: 500;">${spouse.name}</div>
                        </div>
                        ` : ''}
                        ${children.length > 0 ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Children</div>
                            <div style="font-size: 14px; font-weight: 500;">${children.length}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Financial Summary -->
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Financial Summary</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Income</span>
                            <span style="font-size: 16px; font-weight: 600;">${totalAnnualIncome > 0 ? formatCurrency(totalAnnualIncome, 0) : 'Not set'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Expenses</span>
                            <span style="font-size: 16px; font-weight: 600;">${totalAnnualExpenses > 0 ? formatCurrency(totalAnnualExpenses, 0) : 'Not set'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Savings</span>
                            <span style="font-size: 16px; font-weight: 600; color: ${(totalAnnualIncome - totalAnnualExpenses) > 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${(totalAnnualIncome > 0 || totalAnnualExpenses > 0) ? formatCurrency(totalAnnualIncome - totalAnnualExpenses, 0) : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Assets & Debts Summary -->
            <div>
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Assets & Net Worth</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; gap: 12px;">
                        <!-- Assets -->
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Retirement Accounts</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(retirementTotal, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Taxable Accounts</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(taxableTotal, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Real Estate (Market Value)</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(realEstateGross, 0)}</span>
                        </div>
                        ${mortgageDebts > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary); padding-left: 16px;">• Mortgage Balances</span>
                            <span style="font-size: 16px; font-weight: 600; color: var(--danger-color);">-${formatCurrency(mortgageDebts, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary); padding-left: 16px; font-weight: 600;">= Real Estate Equity</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(realEstateEquity, 0)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Other Assets</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(otherTotal, 0)}</span>
                        </div>

                        <!-- Totals -->
                        <div style="display: flex; justify-content: space-between; padding-top: 8px; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                            <span style="font-size: 15px; font-weight: 600;">Total Assets</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(totalAssets, 0)}</span>
                        </div>
                        ${totalDebts > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                            <span style="font-size: 15px; font-weight: 600;">Total Debts</span>
                            <span style="font-size: 16px; font-weight: 600; color: var(--danger-color);">-${formatCurrency(totalDebts, 0)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding-top: 12px;">
                            <span style="font-size: 17px; font-weight: 700;">Net Worth</span>
                            <span style="font-size: 20px; font-weight: 700; color: var(--success-color);">${formatCurrency(netWorth, 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ============================================================================
// METRIC DETAIL MODALS
// ============================================================================

function showNetWorthDetails(profile) {
    const data = profile.data || {};
    const assets = data.assets || {};
    const { netWorth, totalAssets, totalDebts, breakdown } = calculateNetWorth(assets);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">💰 Net Worth Details</h2>
                <button id="close-networth-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Net Worth</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${formatCurrency(netWorth, 0)}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Total Assets</div>
                    <div style="font-size: 20px; font-weight: bold; color: #22c55e;">${formatCurrency(totalAssets, 0)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Total Debts</div>
                    <div style="font-size: 20px; font-weight: bold; color: #ef4444;">${formatCurrency(totalDebts, 0)}</div>
                </div>
            </div>

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Asset Breakdown</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                ${Object.entries(breakdown.assets).map(([category, amount]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-secondary); border-radius: 6px;">
                        <span style="color: var(--text-primary);">${category}</span>
                        <span style="font-weight: bold; color: #22c55e;">${formatCurrency(amount, 0)}</span>
                    </div>
                `).join('')}
            </div>

            ${totalDebts > 0 ? `
                <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Debt Breakdown</h3>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${Object.entries(breakdown.debts).map(([category, amount]) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-secondary); border-radius: 6px;">
                            <span style="color: var(--text-primary);">${category}</span>
                            <span style="font-weight: bold; color: #ef4444;">${formatCurrency(amount, 0)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 What is Net Worth?</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Net worth is your total assets minus your total debts. It's the fundamental measure of your financial health
                    and represents what you would have if you sold everything and paid off all debts. Growing your net worth
                    is the primary goal of wealth building.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-networth-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showIncomeDetails(profile) {
    const data = profile.data || {};
    const incomeStreams = data.income_streams || [];
    const activeStreams = incomeStreams.filter(s => s.period === 'current' || s.period === 'both');
    const futureStreams = incomeStreams.filter(s => s.period === 'future' || s.period === 'both');

    const totalActive = activeStreams.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const totalFuture = futureStreams.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">📈 Income Details</h2>
                <button id="close-income-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Annual Income (Active)</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${formatCurrency(totalActive, 0)}</div>
            </div>

            ${activeStreams.length > 0 ? `
                <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Active Income Streams</h3>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${activeStreams.map(stream => `
                        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #22c55e;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: var(--text-primary);">${stream.name}</span>
                                <span style="font-weight: bold; color: #22c55e;">${formatCurrency(stream.amount, 0)}/yr</span>
                            </div>
                            ${stream.source ? `<div style="font-size: 12px; color: var(--text-secondary);">Source: ${stream.source}</div>` : ''}
                            ${stream.start_date ? `<div style="font-size: 12px; color: var(--text-secondary);">Started: ${stream.start_date}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : '<p style="color: var(--text-secondary); margin-bottom: 25px;">No active income streams.</p>'}

            ${futureStreams.length > 0 ? `
                <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Future Income Streams</h3>
                <div style="background: rgba(59,130,246,0.1); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 5px;">Projected Future Income</div>
                    <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${formatCurrency(totalFuture, 0)}/yr</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${futureStreams.map(stream => `
                        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #3b82f6;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: var(--text-primary);">${stream.name}</span>
                                <span style="font-weight: bold; color: #3b82f6;">${formatCurrency(stream.amount, 0)}/yr</span>
                            </div>
                            ${stream.source ? `<div style="font-size: 12px; color: var(--text-secondary);">Source: ${stream.source}</div>` : ''}
                            ${stream.start_date ? `<div style="font-size: 12px; color: var(--text-secondary);">Starts: ${stream.start_date}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 About Income Streams</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Income streams represent your sources of money. Active streams are currently generating income,
                    while future streams (like pensions or Social Security) will begin at a specified date. Diversifying
                    your income sources reduces financial risk.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-income-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showExpensesDetails(profile) {
    const data = profile.data || {};
    const expenses = data.expenses || [];
    const totalAnnual = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Group by category
    const byCategory = {};
    expenses.forEach(exp => {
        const cat = exp.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(exp.amount) || 0);
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">📉 Expense Details</h2>
                <button id="close-expense-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Annual Expenses</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${formatCurrency(totalAnnual, 0)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">Monthly: ${formatCurrency(totalAnnual / 12, 0)}</div>
            </div>

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Breakdown by Category</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
                ${Object.entries(byCategory).sort(([,a], [,b]) => b - a).map(([category, amount]) => {
                    const percentage = (amount / totalAnnual * 100).toFixed(1);
                    return `
                        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-weight: 600; color: var(--text-primary);">${category}</span>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold; color: #ef4444;">${formatCurrency(amount, 0)}/yr</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${percentage}%</div>
                                </div>
                            </div>
                            <div style="background: rgba(239,68,68,0.2); border-radius: 4px; height: 6px; overflow: hidden;">
                                <div style="background: #ef4444; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Individual Expenses</h3>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 25px; max-height: 200px; overflow-y: auto;">
                ${expenses.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0)).map(exp => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-secondary); border-radius: 4px;">
                        <div>
                            <div style="font-size: 14px; color: var(--text-primary);">${exp.name}</div>
                            ${exp.category ? `<div style="font-size: 11px; color: var(--text-secondary);">${exp.category}</div>` : ''}
                        </div>
                        <span style="font-weight: 600; color: #ef4444;">${formatCurrency(exp.amount, 0)}</span>
                    </div>
                `).join('')}
            </div>

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 Managing Expenses</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Understanding your expense breakdown helps identify opportunities to optimize spending. Focus on
                    the largest categories first for maximum impact. Even small percentage reductions in major
                    categories can significantly accelerate your path to financial independence.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-expense-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showSavingsRateDetails(profile) {
    const data = profile.data || {};
    const incomeStreams = data.income_streams || [];
    const expenses = data.expenses || [];

    const totalAnnualIncome = incomeStreams
        .filter(s => s.period === 'current' || s.period === 'both')
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

    const totalAnnualExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const annualSavings = totalAnnualIncome - totalAnnualExpenses;
    const savingsRate = totalAnnualIncome > 0 ? (annualSavings / totalAnnualIncome) * 100 : 0;

    // Years to Financial Independence (simplified 4% rule)
    const assets = data.assets || {};
    const { netWorth } = calculateNetWorth(assets);
    const targetAmount = totalAnnualExpenses * 25; // 4% rule
    const yearsToFI = annualSavings > 0 ? Math.max(0, (targetAmount - netWorth) / annualSavings) : 999;

    // Savings rate benchmarks
    let rating = '';
    let ratingColor = '';
    if (savingsRate < 10) {
        rating = 'Low - Build your savings habit';
        ratingColor = '#ef4444';
    } else if (savingsRate < 20) {
        rating = 'Good - Above average';
        ratingColor = '#f59e0b';
    } else if (savingsRate < 30) {
        rating = 'Great - Well positioned';
        ratingColor = '#eab308';
    } else if (savingsRate < 50) {
        rating = 'Excellent - Strong progress';
        ratingColor = '#22c55e';
    } else {
        rating = 'Outstanding - Exceptional';
        ratingColor = '#10b981';
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">💵 Savings Rate Details</h2>
                <button id="close-savings-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Your Savings Rate</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${savingsRate.toFixed(1)}%</div>
                <div style="font-size: 14px; margin-top: 8px; padding: 8px 12px; background: ${ratingColor}33; border-radius: 6px; color: ${ratingColor}; font-weight: 600;">
                    ${rating}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Income</div>
                    <div style="font-size: 16px; font-weight: bold; color: #22c55e;">${formatCompact(totalAnnualIncome)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Expenses</div>
                    <div style="font-size: 16px; font-weight: bold; color: #ef4444;">${formatCompact(totalAnnualExpenses)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Savings</div>
                    <div style="font-size: 16px; font-weight: bold; color: #3b82f6;">${formatCompact(annualSavings)}</div>
                </div>
            </div>

            ${yearsToFI < 100 ? `
                <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 3px solid #3b82f6;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 5px;">Years to Financial Independence</div>
                    <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${yearsToFI.toFixed(1)} years</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                        Based on 4% rule (${formatCurrency(targetAmount, 0)} target)
                    </div>
                </div>
            ` : ''}

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Savings Rate Benchmarks</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 60px; font-size: 13px; color: var(--text-secondary);">&lt; 10%</div>
                    <div style="flex: 1; height: 24px; background: #ef444433; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; color: var(--text-primary);">Low - Build savings habit</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 60px; font-size: 13px; color: var(--text-secondary);">10-20%</div>
                    <div style="flex: 1; height: 24px; background: #f59e0b33; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; color: var(--text-primary);">Good - Above average</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 60px; font-size: 13px; color: var(--text-secondary);">20-30%</div>
                    <div style="flex: 1; height: 24px; background: #eab30833; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; color: var(--text-primary);">Great - Well positioned</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 60px; font-size: 13px; color: var(--text-secondary);">30-50%</div>
                    <div style="flex: 1; height: 24px; background: #22c55e33; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; color: var(--text-primary);">Excellent - Strong progress</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 60px; font-size: 13px; color: var(--text-secondary);">&gt; 50%</div>
                    <div style="flex: 1; height: 24px; background: #10b98133; border-radius: 4px; display: flex; align-items: center; padding: 0 10px; font-size: 12px; color: var(--text-primary);">Outstanding - Exceptional</div>
                </div>
            </div>

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 Why Savings Rate Matters</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Your savings rate is the single most important metric for building wealth. It determines both how quickly
                    you can reach financial independence and how much you'll need to sustain your lifestyle. A higher savings
                    rate means reaching your goals faster, regardless of investment returns.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-savings-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showAgeDetails(profile) {
    const birthDate = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
    const currentAge = profile.current_age || 0;
    const retirementAge = profile.retirement_age || 65;

    let daysUntilBirthday = 0;
    let nextBirthdayAge = currentAge + 1;
    if (birthDate) {
        const today = new Date();
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (nextBirthday < today) {
            nextBirthday.setFullYear(today.getFullYear() + 1);
        }
        daysUntilBirthday = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
    }

    // Life expectancy milestones
    const lifeExpectancy = 85; // Typical planning horizon
    const percentOfLife = (currentAge / lifeExpectancy * 100).toFixed(1);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">👤 Age & Life Timeline</h2>
                <button id="close-age-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Current Age</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${currentAge} years</div>
                ${birthDate ? `
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Next birthday in ${daysUntilBirthday} days (Age ${nextBirthdayAge})
                    </div>
                ` : ''}
            </div>

            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; color: var(--text-secondary);">Life Progress</span>
                    <span style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${percentOfLife}%</span>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; height: 24px; overflow: hidden; position: relative;">
                    <div style="background: linear-gradient(90deg, #3b82f6, #8b5cf6); height: 100%; width: ${percentOfLife}%; transition: width 0.5s;"></div>
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-primary);">
                        Age ${currentAge} of ${lifeExpectancy} (planning horizon)
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Years to Retirement</div>
                    <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${Math.max(0, retirementAge - currentAge)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Planned Retirement Age</div>
                    <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${retirementAge}</div>
                </div>
            </div>

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Age-Based Planning Considerations</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
                ${currentAge < 30 ? `
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #22c55e;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">20s: Foundation Building</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Focus on career growth, emergency fund, and starting to invest. Time is your greatest asset.</div>
                    </div>
                ` : ''}
                ${currentAge >= 30 && currentAge < 40 ? `
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">30s: Wealth Acceleration</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Peak earning potential emerging. Maximize retirement contributions and consider real estate.</div>
                    </div>
                ` : ''}
                ${currentAge >= 40 && currentAge < 50 ? `
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #8b5cf6;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">40s: Peak Earning Years</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Highest income years. Catch-up contributions, refine retirement plan, update estate documents.</div>
                    </div>
                ` : ''}
                ${currentAge >= 50 && currentAge < 60 ? `
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #f59e0b;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">50s: Pre-Retirement Planning</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Eligible for catch-up contributions ($7,500 401k, $1,000 IRA). Review healthcare and Social Security strategy.</div>
                    </div>
                ` : ''}
                ${currentAge >= 60 ? `
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #ef4444;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">60+: Transition Phase</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">Social Security claiming strategy critical. Medicare at 65. RMDs start at 73. Tax planning for distributions.</div>
                    </div>
                ` : ''}
            </div>

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 Time & Wealth Building</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Your age determines your planning timeline and strategy. Younger investors can take more risk and benefit
                    from decades of compounding. As you age, focus shifts to wealth preservation, tax efficiency, and
                    distribution strategies. The key is aligning your plan with your life stage.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-age-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showRetirementDetails(profile) {
    const data = profile.data || {};
    const currentAge = profile.current_age || 0;
    const retirementAge = profile.retirement_age || 65;
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);

    // Calculate more detailed countdown
    const monthsToRetirement = yearsToRetirement * 12;
    const daysToRetirement = yearsToRetirement * 365;
    const workingDaysToRetirement = yearsToRetirement * 260; // ~260 working days/year

    // Get action items related to retirement
    const actionItems = data.action_items || [];
    const retirementActions = actionItems.filter(a =>
        !a.completed && (
            a.title.toLowerCase().includes('retire') ||
            a.title.toLowerCase().includes('401') ||
            a.title.toLowerCase().includes('ira') ||
            a.category === 'retirement'
        )
    ).slice(0, 5);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">🏖️ Retirement Timeline</h2>
                <button id="close-retirement-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            ${yearsToRetirement > 0 ? `
                <div style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(124,58,237,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Years Until Retirement</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--text-primary);">${yearsToRetirement.toFixed(1)} years</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
                        Target retirement age: ${retirementAge}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Months</div>
                        <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${monthsToRetirement}</div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Days</div>
                        <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${daysToRetirement.toLocaleString()}</div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px;">Work Days</div>
                        <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${workingDaysToRetirement.toLocaleString()}</div>
                    </div>
                </div>
            ` : `
                <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                    <div style="font-size: 18px; font-weight: bold; color: var(--text-primary); margin-bottom: 10px;">🎉 You've Reached Retirement Age!</div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        You are at or past your planned retirement age of ${retirementAge}. Focus on optimizing withdrawals and enjoying your retirement.
                    </div>
                </div>
            `}

            ${retirementActions.length > 0 ? `
                <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Retirement Action Items</h3>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${retirementActions.map(action => `
                        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid ${action.priority === 'high' ? '#ef4444' : action.priority === 'medium' ? '#f59e0b' : '#3b82f6'};">
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">${action.title}</div>
                            ${action.description ? `<div style="font-size: 12px; color: var(--text-secondary);">${action.description}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: var(--text-primary);">Retirement Planning Milestones</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 50 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 50: Catch-Up Contributions</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">+$7,500 401(k), +$1,000 IRA annually</div>
                        </div>
                        ${currentAge >= 50 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${50 - currentAge} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 59.5 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 59½: Penalty-Free Withdrawals</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Access retirement accounts without 10% penalty</div>
                        </div>
                        ${currentAge >= 59.5 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${(59.5 - currentAge).toFixed(1)} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 62 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 62: Early Social Security</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Reduced benefits (~70% of full amount)</div>
                        </div>
                        ${currentAge >= 62 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${62 - currentAge} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 65 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 65: Medicare Eligibility</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Health insurance coverage begins</div>
                        </div>
                        ${currentAge >= 65 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${65 - currentAge} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 67 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 67: Full Retirement Age</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">100% Social Security benefits (born 1960+)</div>
                        </div>
                        ${currentAge >= 67 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${67 - currentAge} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 70 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 70: Maximum Social Security</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">~124% of full amount with delayed credits</div>
                        </div>
                        ${currentAge >= 70 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${70 - currentAge} years</span>`}
                    </div>
                </div>
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 6px; ${currentAge >= 73 ? 'opacity: 0.5;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">Age 73: Required Minimum Distributions</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Must begin withdrawals from traditional accounts</div>
                        </div>
                        ${currentAge >= 73 ? '<span style="color: #22c55e;">✓ Eligible</span>' : `<span style="color: var(--text-secondary);">${73 - currentAge} years</span>`}
                    </div>
                </div>
            </div>

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 15px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 Retirement Planning Strategy</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    Successful retirement planning requires understanding key milestones and making strategic decisions about
                    Social Security, Medicare, and retirement account withdrawals. The timing of these decisions can significantly
                    impact your lifetime retirement income. Use the Monte Carlo simulations and tax optimization tools to model
                    different scenarios.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-retirement-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
