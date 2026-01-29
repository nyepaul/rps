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

    // Calculate debt-to-asset ratio
    const debtToAssetRatio = totalAssets > 0 ? (totalDebts / totalAssets * 100) : 0;
    const debtRatioStatus = debtToAssetRatio > 50 ? 'High Risk' : debtToAssetRatio > 30 ? 'Moderate' : debtToAssetRatio > 0 ? 'Low' : 'Debt-Free';
    const debtRatioColor = debtToAssetRatio > 50 ? '#ef4444' : debtToAssetRatio > 30 ? '#f59e0b' : debtToAssetRatio > 0 ? '#22c55e' : '#10b981';
    const debtRatioIcon = debtToAssetRatio > 50 ? '🔴' : debtToAssetRatio > 30 ? '🟡' : debtToAssetRatio > 0 ? '🟢' : '✅';

    // Calculate liquidity (liquid assets vs total assets)
    const liquidAssets = calculateLiquidAssets(assets);
    const liquidityRatio = totalAssets > 0 ? (liquidAssets / totalAssets * 100) : 0;
    const liquidityStatus = liquidityRatio > 40 ? 'High' : liquidityRatio > 20 ? 'Moderate' : 'Low';
    const liquidityColor = liquidityRatio > 40 ? '#22c55e' : liquidityRatio > 20 ? '#f59e0b' : '#ef4444';

    // Asset allocation analysis
    const retirementPct = totalAssets > 0 ? (breakdown.retirementAssets / totalAssets * 100) : 0;
    const taxablePct = totalAssets > 0 ? (breakdown.taxableAssets / totalAssets * 100) : 0;
    const realEstatePct = totalAssets > 0 ? (breakdown.realEstateAssets / totalAssets * 100) : 0;
    const otherPct = totalAssets > 0 ? (breakdown.otherAssets / totalAssets * 100) : 0;

    // Asset category emojis
    const assetEmojis = {
        'Retirement Accounts': '🏦',
        'Taxable Accounts': '📈',
        'Real Estate': '🏠',
        'Vehicles': '🚗',
        'Other Assets': '📦',
        'Cash & Checking': '💵',
        'Savings': '💰'
    };

    // Debt category emojis
    const debtEmojis = {
        'Mortgage': '🏠',
        'Auto Loans': '🚗',
        'Student Loans': '🎓',
        'Credit Cards': '💳',
        'Other Debts': '📄'
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 800px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">💰 Net Worth Details</h2>
                <button id="close-networth-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <!-- Summary Cards Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 16px; border-left: 4px solid #22c55e;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Net Worth</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${formatCompact(netWorth)}</div>
                </div>
                <div style="background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.15)); border-radius: 8px; padding: 16px; border-left: 4px solid #10b981;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Total Assets</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${formatCompact(totalAssets)}</div>
                </div>
                <div style="background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.15)); border-radius: 8px; padding: 16px; border-left: 4px solid #ef4444;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Total Debts</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${formatCompact(totalDebts)}</div>
                </div>
            </div>

            <!-- Asset Allocation Analysis -->
            <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>📊</span> Asset Allocation
            </h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                ${retirementPct > 0 ? `
                    <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid #3b82f6;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                                    🏦 Retirement Accounts
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    401(k), IRA, Roth IRA
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: #3b82f6; font-size: 16px;">${retirementPct.toFixed(1)}%</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${formatCurrency(breakdown.retirementAssets, 0)}</div>
                            </div>
                        </div>
                        <div style="background: rgba(59,130,246,0.15); border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #3b82f6, #2563eb); height: 100%; width: ${retirementPct}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                ` : ''}
                ${taxablePct > 0 ? `
                    <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid #22c55e;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                                    📈 Taxable Accounts
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    Brokerage, cash, savings
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: #22c55e; font-size: 16px;">${taxablePct.toFixed(1)}%</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${formatCurrency(breakdown.taxableAssets, 0)}</div>
                            </div>
                        </div>
                        <div style="background: rgba(34,197,94,0.15); border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #22c55e, #16a34a); height: 100%; width: ${taxablePct}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                ` : ''}
                ${realEstatePct > 0 ? `
                    <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid #8b5cf6;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                                    🏠 Real Estate
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    Primary residence, rentals
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: #8b5cf6; font-size: 16px;">${realEstatePct.toFixed(1)}%</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${formatCurrency(breakdown.realEstateAssets, 0)}</div>
                            </div>
                        </div>
                        <div style="background: rgba(139,92,246,0.15); border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #8b5cf6, #7c3aed); height: 100%; width: ${realEstatePct}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                ` : ''}
                ${otherPct > 0 ? `
                    <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid #f59e0b;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                                    📦 Other Assets
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    Vehicles, collectibles, etc.
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: bold; color: #f59e0b; font-size: 16px;">${otherPct.toFixed(1)}%</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${formatCurrency(breakdown.otherAssets, 0)}</div>
                            </div>
                        </div>
                        <div style="background: rgba(245,158,11,0.15); border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #f59e0b, #d97706); height: 100%; width: ${otherPct}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Financial Health Metrics -->
            <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>🔍</span> Financial Health
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; border-left: 3px solid ${debtRatioColor};">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Debt-to-Asset Ratio</div>
                    <div style="font-size: 20px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
                        ${debtRatioIcon} ${debtRatioStatus}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        ${debtToAssetRatio.toFixed(1)}% of assets are debt
                    </div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; border-left: 3px solid ${liquidityColor};">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Liquidity</div>
                    <div style="font-size: 20px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
                        ${liquidityStatus}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        ${formatCurrency(liquidAssets, 0)} readily accessible
                    </div>
                </div>
            </div>

            ${totalDebts > 0 ? `
                <!-- Debt Breakdown -->
                <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <span>💳</span> Debt Breakdown
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 25px;">
                    ${(() => {
                        // Construct debts object from breakdown
                        const debts = {};
                        if (breakdown.mortgageDebts > 0) debts['Mortgage'] = breakdown.mortgageDebts;
                        if (breakdown.otherLiabilities > 0) debts['Other Debts'] = breakdown.otherLiabilities;
                        return Object.entries(debts).sort(([,a], [,b]) => b - a).map(([category, amount]) => {
                            const debtPct = totalDebts > 0 ? (amount / totalDebts * 100) : 0;
                            const emoji = debtEmojis[category] || '📄';
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 2px solid #ef4444;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${emoji} ${category}</div>
                                        <div style="font-size: 10px; color: var(--text-secondary);">${debtPct.toFixed(1)}% of total debt</div>
                                    </div>
                                    <div style="font-weight: bold; color: #ef4444; font-size: 14px;">
                                        ${formatCurrency(amount, 0)}
                                    </div>
                                </div>
                            `;
                        }).join('');
                    })()}
                </div>
            ` : ''}

            <!-- Insights & Tips -->
            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">💡 Wealth Building Tips</h4>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.7;">
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                        <li style="margin-bottom: 6px;">Net worth = Assets - Debts. Focus on increasing both sides of this equation</li>
                        ${debtToAssetRatio > 30 ? `<li style="margin-bottom: 6px; color: #f59e0b;"><strong>Priority:</strong> Your debt-to-asset ratio is ${debtToAssetRatio.toFixed(0)}% - focus on debt reduction</li>` : ''}
                        ${liquidityRatio < 20 ? `<li style="margin-bottom: 6px; color: #f59e0b;"><strong>Tip:</strong> Build emergency fund - aim for 3-6 months expenses in liquid assets</li>` : ''}
                        ${retirementPct < 30 ? `<li style="margin-bottom: 6px;">Retirement accounts are only ${retirementPct.toFixed(0)}% - consider increasing tax-advantaged savings</li>` : ''}
                        <li style="margin-bottom: 6px;">Track net worth monthly to measure progress toward financial goals</li>
                        <li>Diversification across asset types reduces risk and improves long-term returns</li>
                    </ul>
                </div>
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

    // Determine if income is active based on dates (no end_date or end_date in future)
    const today = new Date();
    const isActive = (stream) => {
        if (!stream.end_date) return true; // Ongoing income
        const endDate = new Date(stream.end_date);
        return endDate >= today;
    };
    const isFuture = (stream) => {
        if (!stream.start_date) return false;
        const startDate = new Date(stream.start_date);
        return startDate > today;
    };

    const activeStreams = incomeStreams.filter(s => isActive(s) && !isFuture(s));
    const futureStreams = incomeStreams.filter(s => isFuture(s));

    const totalActive = activeStreams.reduce((sum, s) => sum + (parseFloat(s.amount) || 0) * 12, 0);
    const totalFuture = futureStreams.reduce((sum, s) => sum + (parseFloat(s.amount) || 0) * 12, 0);
    const monthlyActive = totalActive / 12;

    // Group by source for diversification analysis
    const bySource = {};
    activeStreams.forEach(s => {
        const source = s.source || 'Manual';
        bySource[source] = (bySource[source] || 0) + (parseFloat(s.amount) || 0) * 12;
    });

    // Calculate concentration risk
    const largestSource = Math.max(...Object.values(bySource), 0);
    const concentration = totalActive > 0 ? (largestSource / totalActive * 100) : 0;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">📈 Income Analysis</h2>
                <button id="close-income-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border-radius: 8px; padding: 20px; border-left: 4px solid #22c55e;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Annual Income</div>
                    <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${formatCurrency(totalActive, 0)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 20px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Monthly Average</div>
                    <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${formatCurrency(monthlyActive, 0)}</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 20px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Income Streams</div>
                    <div style="font-size: 28px; font-weight: bold; color: var(--text-primary);">${activeStreams.length}</div>
                </div>
            </div>

            ${activeStreams.length > 0 ? `
                <h3 style="margin: 25px 0 15px 0; font-size: 18px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    💰 Active Income Streams
                    <span style="font-size: 12px; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 12px; color: var(--text-secondary); font-weight: normal;">${activeStreams.length} ${activeStreams.length === 1 ? 'source' : 'sources'}</span>
                </h3>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${activeStreams.map((stream, idx) => {
                        const annual = (parseFloat(stream.amount) || 0) * 12;
                        const percentage = totalActive > 0 ? (annual / totalActive * 100) : 0;
                        const sourceColor = stream.source === 'detected' ? '#3b82f6' : stream.source === 'merged' ? '#8b5cf6' : '#22c55e';
                        return `
                        <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid ${sourceColor}; position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--text-primary); font-size: 15px; margin-bottom: 4px;">${idx + 1}. ${stream.name}</div>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary);">
                                        ${stream.source ? `<span>📍 ${stream.source}</span>` : ''}
                                        ${stream.frequency ? `<span>🔁 ${stream.frequency}</span>` : '<span>🔁 monthly</span>'}
                                        ${stream.start_date ? `<span>📅 Since ${stream.start_date}</span>` : ''}
                                        ${stream.confidence ? `<span>🎯 ${(stream.confidence * 100).toFixed(0)}% confidence</span>` : ''}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold; color: #22c55e; font-size: 18px;">${formatCurrency(annual, 0)}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${percentage.toFixed(1)}% of total</div>
                                </div>
                            </div>
                            <div style="background: var(--bg-tertiary); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 8px;">
                                <div style="background: ${sourceColor}; height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    `}).join('')}
                </div>

                <!-- Income Diversification -->
                <div style="background: rgba(59,130,246,0.1); border-radius: 8px; padding: 18px; margin-bottom: 25px; border-left: 3px solid #3b82f6;">
                    <h4 style="margin: 0 0 12px 0; font-size: 15px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                        📊 Diversification Analysis
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 3px;">Largest Source</div>
                            <div style="font-size: 18px; font-weight: bold; color: var(--text-primary);">${concentration.toFixed(0)}%</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 3px;">Risk Level</div>
                            <div style="font-size: 14px; font-weight: 600; color: ${concentration > 80 ? '#ef4444' : concentration > 60 ? '#f59e0b' : '#22c55e'};">
                                ${concentration > 80 ? '🔴 High' : concentration > 60 ? '🟡 Medium' : '🟢 Low'}
                            </div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 10px; line-height: 1.5;">
                        ${concentration > 70 ? '⚠️ High concentration in one income source. Consider diversifying to reduce risk.' : '✅ Good income diversification helps protect against job loss or economic changes.'}
                    </div>
                </div>
            ` : '<p style="color: var(--text-secondary); margin-bottom: 25px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">No active income streams. Add income sources to track your earnings.</p>'}

            ${futureStreams.length > 0 ? `
                <h3 style="margin: 25px 0 15px 0; font-size: 18px; color: var(--text-primary);">🔮 Future Income Streams</h3>
                <div style="background: rgba(59,130,246,0.1); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px;">Projected Annual Income</div>
                    <div style="font-size: 26px; font-weight: bold; color: #3b82f6;">${formatCurrency(totalFuture, 0)}</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                    ${futureStreams.map((stream, idx) => {
                        const annual = (parseFloat(stream.amount) || 0) * 12;
                        return `
                        <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 15px;">${idx + 1}. ${stream.name}</span>
                                <span style="font-weight: bold; color: #3b82f6; font-size: 18px;">${formatCurrency(annual, 0)}/yr</span>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary);">
                                ${stream.source ? `<span>📍 ${stream.source}</span>` : ''}
                                ${stream.start_date ? `<span>📅 Starts ${stream.start_date}</span>` : ''}
                            </div>
                        </div>
                    `}).join('')}
                </div>
            ` : ''}

            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 18px; margin-top: 25px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-primary);">💡 Income Planning Tips</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Diversify:</strong> Multiple income sources provide financial security</li>
                    <li><strong>Track Changes:</strong> Monitor income trends to spot issues early</li>
                    <li><strong>Plan Transitions:</strong> Prepare for retirement income changes in advance</li>
                    <li><strong>Consider Taxes:</strong> Different income types have different tax implications</li>
                </ul>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-income-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showExpensesDetails(profile) {
    const data = profile.data || {};
    const budget = data.budget || {};
    const expensesCurrent = budget.expenses?.current || {};

    // Flatten all expenses from all categories
    const expenses = Object.entries(expensesCurrent).flatMap(([category, items]) =>
        items.map(item => ({ ...item, category }))
    );

    // Calculate total annual expenses (convert monthly to annual)
    const totalAnnual = expenses.reduce((sum, exp) => {
        const amount = parseFloat(exp.amount) || 0;
        const frequency = (exp.frequency || 'monthly').toLowerCase();
        const multiplier = frequency === 'annual' ? 1 : 12;
        return sum + (amount * multiplier);
    }, 0);

    const totalMonthly = totalAnnual / 12;
    const expenseCount = expenses.length;

    // Group by category with annual totals
    const byCategory = {};
    expenses.forEach(exp => {
        const cat = exp.category || 'Other';
        const amount = parseFloat(exp.amount) || 0;
        const frequency = (exp.frequency || 'monthly').toLowerCase();
        const multiplier = frequency === 'annual' ? 1 : 12;
        const annualAmount = amount * multiplier;
        byCategory[cat] = (byCategory[cat] || 0) + annualAmount;
    });

    // Group by source
    const bySource = {
        specified: 0,
        detected: 0,
        merged: 0
    };
    expenses.forEach(exp => {
        const source = exp.source || 'specified';
        const amount = parseFloat(exp.amount) || 0;
        const frequency = (exp.frequency || 'monthly').toLowerCase();
        const multiplier = frequency === 'annual' ? 1 : 12;
        const annualAmount = amount * multiplier;
        bySource[source] = (bySource[source] || 0) + annualAmount;
    });

    // Calculate concentration risk (largest category as % of total)
    const largestCategory = Math.max(...Object.values(byCategory), 0);
    const concentration = totalAnnual > 0 ? (largestCategory / totalAnnual * 100) : 0;
    const concentrationRisk = concentration > 50 ? 'High' : concentration > 35 ? 'Medium' : 'Low';
    const concentrationColor = concentration > 50 ? '#ef4444' : concentration > 35 ? '#f59e0b' : '#22c55e';
    const concentrationIcon = concentration > 50 ? '🔴' : concentration > 35 ? '🟡' : '🟢';

    // Source badge colors
    const sourceBadges = {
        'specified': { color: '#10b981', text: '✓ Manual', borderColor: '#10b981' },
        'detected': { color: '#3b82f6', text: '🔍 Detected', borderColor: '#3b82f6' },
        'merged': { color: '#8b5cf6', text: '⚡ Merged', borderColor: '#8b5cf6' }
    };

    // Category insights
    const categoryInsights = [];
    Object.entries(byCategory).sort(([,a], [,b]) => b - a).forEach(([category, amount], idx) => {
        const percentage = (amount / totalAnnual * 100);
        if (idx === 0 && percentage > 50) {
            categoryInsights.push(`${category} dominates at ${percentage.toFixed(0)}% - consider diversifying`);
        } else if (idx === 0 && percentage > 35) {
            categoryInsights.push(`${category} is your largest expense category at ${percentage.toFixed(0)}%`);
        }
    });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; padding: 30px; max-width: 800px; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">📉 Expense Details</h2>
                <button id="close-expense-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <!-- Summary Cards Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2)); border-radius: 8px; padding: 16px; border-left: 4px solid #ef4444;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Annual Total</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${formatCompact(totalAnnual)}</div>
                </div>
                <div style="background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.15)); border-radius: 8px; padding: 16px; border-left: 4px solid #f87171;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Monthly Avg</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${formatCompact(totalMonthly)}</div>
                </div>
                <div style="background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.1)); border-radius: 8px; padding: 16px; border-left: 4px solid #fca5a5;">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">Expense Items</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${expenseCount}</div>
                </div>
            </div>

            <!-- Category Breakdown -->
            <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>📊</span> Category Breakdown
            </h3>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                ${Object.entries(byCategory).sort(([,a], [,b]) => b - a).map(([category, amount]) => {
                    const percentage = (amount / totalAnnual * 100);
                    const monthlyAmount = amount / 12;

                    // Category emoji mapping
                    const categoryEmojis = {
                        'housing': '🏠',
                        'utilities': '💡',
                        'food': '🍽️',
                        'transportation': '🚗',
                        'entertainment': '🎬',
                        'healthcare': '🏥',
                        'insurance': '🛡️',
                        'shopping': '🛍️',
                        'other': '📦'
                    };
                    const emoji = categoryEmojis[category.toLowerCase()] || '📦';

                    return `
                        <div style="padding: 14px; background: var(--bg-secondary); border-radius: 8px; border-left: 3px solid #ef4444;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--text-primary); font-size: 14px; margin-bottom: 4px;">
                                        ${emoji} ${category}
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">
                                        ${formatCurrency(monthlyAmount, 0)}/mo • ${formatCurrency(amount, 0)}/yr
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold; color: #ef4444; font-size: 16px;">${percentage.toFixed(1)}%</div>
                                    <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">of total</div>
                                </div>
                            </div>
                            <div style="background: rgba(239,68,68,0.15); border-radius: 4px; height: 8px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #ef4444, #dc2626); height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Spending Analysis -->
            <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>🔍</span> Spending Analysis
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; border-left: 3px solid ${concentrationColor};">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Concentration Risk</div>
                    <div style="font-size: 20px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">
                        ${concentrationIcon} ${concentrationRisk}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        Largest category: ${concentration.toFixed(0)}%
                    </div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 16px; border-left: 3px solid #8b5cf6;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Data Sources</div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.8;">
                        ${bySource.specified > 0 ? `<div><span style="color: #10b981;">●</span> Manual: ${formatCurrency(bySource.specified, 0)}</div>` : ''}
                        ${bySource.detected > 0 ? `<div><span style="color: #3b82f6;">●</span> Detected: ${formatCurrency(bySource.detected, 0)}</div>` : ''}
                        ${bySource.merged > 0 ? `<div><span style="color: #8b5cf6;">●</span> Merged: ${formatCurrency(bySource.merged, 0)}</div>` : ''}
                    </div>
                </div>
            </div>

            <!-- Individual Expenses -->
            <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>📋</span> All Expenses (${expenseCount})
            </h3>
            <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 25px; max-height: 280px; overflow-y: auto; padding-right: 8px;">
                ${expenses.sort((a, b) => {
                    const amountA = parseFloat(a.amount) || 0;
                    const amountB = parseFloat(b.amount) || 0;
                    const freqA = (a.frequency || 'monthly').toLowerCase();
                    const freqB = (b.frequency || 'monthly').toLowerCase();
                    const multA = freqA === 'annual' ? 1 : 12;
                    const multB = freqB === 'annual' ? 1 : 12;
                    return (amountB * multB) - (amountA * multA);
                }).map(exp => {
                    const amount = parseFloat(exp.amount) || 0;
                    const frequency = (exp.frequency || 'monthly').toLowerCase();
                    const multiplier = frequency === 'annual' ? 1 : 12;
                    const annualAmount = amount * multiplier;
                    const percentage = totalAnnual > 0 ? (annualAmount / totalAnnual * 100) : 0;
                    const source = exp.source || 'specified';
                    const badge = sourceBadges[source];

                    // Build tooltip for detected/merged items
                    let tooltip = '';
                    if (source !== 'specified' && exp.confidence) {
                        tooltip = `Confidence: ${(exp.confidence * 100).toFixed(0)}%`;
                        if (exp.detected_from) tooltip += `\\nFrom: ${exp.detected_from}`;
                        if (exp.variance) tooltip += `\\nVariance: ±$${exp.variance.toFixed(2)}`;
                    }

                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--bg-secondary); border-radius: 6px; border-left: 2px solid ${badge.borderColor};">
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                                    <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${exp.name}</span>
                                    ${source !== 'specified' ? `
                                        <span title="${tooltip}" style="font-size: 9px; padding: 2px 6px; background: ${badge.color}; color: white; border-radius: 3px; font-weight: 600; white-space: nowrap;">
                                            ${badge.text}
                                        </span>
                                    ` : ''}
                                </div>
                                <div style="font-size: 10px; color: var(--text-secondary);">
                                    ${exp.category} • ${frequency === 'annual' ? 'Annual' : 'Monthly'} • ${percentage.toFixed(1)}% of total
                                </div>
                            </div>
                            <div style="text-align: right; margin-left: 12px;">
                                <div style="font-weight: bold; color: #ef4444; font-size: 14px; white-space: nowrap;">
                                    ${formatCurrency(amount, 0)}
                                </div>
                                <div style="font-size: 10px; color: var(--text-secondary);">
                                    /${frequency === 'annual' ? 'yr' : 'mo'}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Insights & Tips -->
            <div style="background: rgba(59,130,246,0.15); border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 3px solid #3b82f6;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">💡 Optimization Tips</h4>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.7;">
                    ${categoryInsights.length > 0 ? `
                        <div style="margin-bottom: 10px; padding: 8px; background: rgba(59,130,246,0.1); border-radius: 4px;">
                            <strong style="color: var(--text-primary);">Key Insight:</strong> ${categoryInsights[0]}
                        </div>
                    ` : ''}
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                        <li style="margin-bottom: 6px;">Focus on your top 3 expense categories - they represent ${
                            Object.values(byCategory).sort((a,b) => b - a).slice(0, 3).reduce((sum, amt) => sum + amt, 0) / totalAnnual * 100
                        }% of spending</li>
                        <li style="margin-bottom: 6px;">Even a 10% reduction in your largest category could save ${
                            formatCurrency(largestCategory * 0.10, 0)
                        }/year</li>
                        <li style="margin-bottom: 6px;">Review detected expenses for accuracy - CSV imports may need fine-tuning</li>
                        <li>Consider setting category-specific budgets to track progress over time</li>
                    </ul>
                </div>
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

    // Get expenses from budget structure (same as showExpensesDetails)
    const budget = data.budget || {};
    const expensesCurrent = budget.expenses?.current || {};
    const expenses = Object.entries(expensesCurrent).flatMap(([category, items]) =>
        items.map(item => ({ ...item, category }))
    );

    // Income is monthly, multiply by 12 for annual
    const totalAnnualIncome = incomeStreams
        .filter(s => s.period === 'current' || s.period === 'both')
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0) * 12, 0);

    // Calculate annual expenses (convert monthly to annual where needed)
    const totalAnnualExpenses = expenses.reduce((sum, exp) => {
        const amount = parseFloat(exp.amount) || 0;
        const frequency = (exp.frequency || 'monthly').toLowerCase();
        const multiplier = frequency === 'annual' ? 1 : 12;
        return sum + (amount * multiplier);
    }, 0);
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
    const birthDate = profile.birth_date ? new Date(profile.birth_date) : null;
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    // Calculate current age from birth date
    let currentAge = 0;
    if (birthDate) {
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            currentAge--;
        }
    }

    // Calculate retirement age from retirement date
    let retirementAge = 65;
    if (retirementDate && birthDate) {
        retirementAge = retirementDate.getFullYear() - birthDate.getFullYear();
    }

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
    const birthDate = profile.birth_date ? new Date(profile.birth_date) : null;
    const retirementDate = profile.retirement_date ? new Date(profile.retirement_date) : null;

    // Calculate current age from birth date
    let currentAge = 0;
    if (birthDate) {
        const today = new Date();
        currentAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            currentAge--;
        }
    }

    // Calculate retirement age from retirement date
    let retirementAge = 65;
    if (retirementDate && birthDate) {
        retirementAge = retirementDate.getFullYear() - birthDate.getFullYear();
    }

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
