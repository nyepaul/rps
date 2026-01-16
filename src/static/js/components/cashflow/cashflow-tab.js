/**
 * Cash Flow Tab Component
 * Shows money coming in and going out over time
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';

export function renderCashFlowTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">💸</div>
                <h2 style="margin-bottom: 10px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Please create or select a profile to view cash flow.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
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

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="margin-bottom: 20px;">
                <h1 style="font-size: 28px; margin-bottom: 8px;">💸 Cash Flow</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                    Visualize money coming in and going out over time. Investment withdrawals follow the tax-efficient strategy (Taxable → Tax-Deferred → Roth).
                </p>
            </div>

            <!-- Controls -->
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">Time Period</label>
                    <select id="time-period" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                        <option value="12">Next 12 months</option>
                        <option value="24">Next 24 months</option>
                        <option value="36">Next 36 months</option>
                        <option value="60">Next 5 years</option>
                        <option value="120">Next 10 years</option>
                        <option value="180">Next 15 years</option>
                        <option value="240" selected>Next 20 years (Full Retirement)</option>
                        <option value="300">Next 25 years</option>
                        <option value="360">Next 30 years (Extended)</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary);">View Type</label>
                    <select id="view-type" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                        <option value="monthly">Monthly</option>
                        <option value="annual" selected>Annual</option>
                    </select>
                </div>
                <button id="refresh-chart" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 20px;">
                    Refresh
                </button>
            </div>

            <!-- Chart -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <canvas id="cashflow-chart" style="max-height: 400px;"></canvas>
            </div>

            <!-- Summary Cards -->
            <div id="summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px;"></div>

            <!-- Detailed Table -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px;">
                <h2 style="font-size: 18px; margin-bottom: 16px;" id="table-title">Cash Flow Details</h2>
                <div id="cashflow-table" style="overflow-x: auto;"></div>
            </div>
        </div>
    `;

    // Initialize chart and data with default: 20 years (240 months), annual view
    renderCashFlowChart(container, profile, 240, 'annual');
    setupEventHandlers(container, profile);
}

/**
 * Setup event handlers
 */
function setupEventHandlers(container, profile) {
    const timePeriodSelect = container.querySelector('#time-period');
    const viewTypeSelect = container.querySelector('#view-type');
    const refreshBtn = container.querySelector('#refresh-chart');

    const refresh = () => {
        const months = parseInt(timePeriodSelect.value);
        const viewType = viewTypeSelect.value;
        renderCashFlowChart(container, profile, months, viewType);
    };

    timePeriodSelect.addEventListener('change', refresh);
    viewTypeSelect.addEventListener('change', refresh);
    refreshBtn.addEventListener('click', refresh);
}

/**
 * Check if an expense is active on a given date
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
 * Calculate monthly cash flow data with portfolio growth projection
 */
function calculateMonthlyCashFlow(profile, months) {
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

    // Portfolio growth assumptions (conservative for planning)
    const monthlyGrowthRate = 0.06 / 12; // 6% annual return assumption
    const monthlyInflationRate = 0.03 / 12; // 3% annual inflation

    // Calculate portfolio value by account type for proper withdrawal ordering
    const portfolioByType = calculatePortfolioByType(assets);
    let currentPortfolio = portfolioByType.taxable + portfolioByType.taxDeferred + portfolioByType.roth;

    const monthlyData = [];

    for (let i = 0; i < months; i++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);

        const monthLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const dateStr = currentDate.toISOString().split('T')[0];

        // Check if retired
        const isRetired = retirementDate && currentDate >= retirementDate;

        // Calculate work income for this month
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

        // Calculate retirement benefits (Social Security, Pension)
        let retirementBenefits = 0;
        if (isRetired) {
            // Social Security (monthly)
            retirementBenefits += financial.social_security_benefit || 0;
            // Spouse Social Security
            if (data.spouse && data.spouse.social_security_benefit) {
                retirementBenefits += data.spouse.social_security_benefit;
            }
            // Pensions (monthly)
            retirementBenefits += financial.pension_benefit || 0;
            if (data.spouse && data.spouse.pension_benefit) {
                retirementBenefits += data.spouse.pension_benefit;
            }
        }

        // Get expenses from budget
        let expenses = 0;
        if (budget.expenses && budget.expenses.current) {
            // Calculate total monthly expenses from all categories
            const categories = ['housing', 'utilities', 'transportation', 'food', 'healthcare', 'insurance',
                              'entertainment', 'personal_care', 'clothing', 'childcare_education',
                              'charitable_giving', 'subscriptions', 'pet_care', 'debt_payments',
                              'taxes', 'discretionary', 'other'];
            categories.forEach(category => {
                const cat = budget.expenses.current[category] || {};

                // Check if expense is active on this date
                if (!isExpenseActiveOnDate(cat, currentDate)) {
                    return; // Skip inactive expenses
                }

                const amount = cat.amount || 0;
                const frequency = cat.frequency || 'monthly';

                // Convert to monthly
                if (frequency === 'monthly') {
                    expenses += amount;
                } else if (frequency === 'quarterly') {
                    expenses += amount / 3;
                } else if (frequency === 'annual') {
                    expenses += amount / 12;
                }
            });
        } else if (financial.annual_expenses) {
            // Fallback to financial annual expenses
            expenses = financial.annual_expenses / 12;
        }

        // Calculate investment income needed
        // After retirement, we withdraw to cover shortfall between expenses and other income
        let investmentIncome = 0;
        if (isRetired) {
            const otherIncome = workIncome + retirementBenefits;
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

        // Add savings to portfolio if positive cash flow before retirement
        if (!isRetired && workIncome > expenses) {
            const monthlySavings = workIncome - expenses;
            currentPortfolio += monthlySavings;
        }

        const totalIncome = workIncome + retirementBenefits + investmentIncome;
        const netCashFlow = totalIncome - expenses;

        monthlyData.push({
            date: currentDate,
            label: monthLabel,
            workIncome,
            retirementBenefits,
            investmentIncome,
            totalIncome,
            expenses,
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

    return { taxable, taxDeferred, roth };
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

/**
 * Render cash flow chart
 */
function renderCashFlowChart(container, profile, months, viewType) {
    const monthlyData = calculateMonthlyCashFlow(profile, months);
    const chartData = viewType === 'annual' ? aggregateToAnnual(monthlyData) : monthlyData;

    // Update summary cards
    renderSummaryCards(container, chartData);

    // Update table title
    const tableTitle = container.querySelector('#table-title');
    if (tableTitle) {
        tableTitle.textContent = viewType === 'annual' ? 'Annual Cash Flow Details' : 'Monthly Cash Flow Details';
    }

    // Update table
    renderCashFlowTable(container, viewType === 'annual' ? chartData : monthlyData, viewType);

    // Render chart
    const canvas = container.querySelector('#cashflow-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (window.cashFlowChart) {
        window.cashFlowChart.destroy();
    }

    window.cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.label),
            datasets: [
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
                {
                    label: 'Expenses',
                    data: chartData.map(d => -d.expenses), // Negative for visual
                    backgroundColor: 'rgba(255, 107, 107, 0.7)',
                    borderColor: 'rgba(255, 107, 107, 1)',
                    borderWidth: 1
                },
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
            ]
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
                    text: `Cash Flow Projection (${viewType === 'annual' ? 'Annual' : 'Monthly'})`,
                    font: { size: 16 }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = Math.abs(context.parsed.y);
                            label += formatCurrency(value, 0);
                            return label;
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
                        text: 'Annual Cash Flow'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(Math.abs(value), 0);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Portfolio Balance'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, 0);
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Render summary cards
 */
function renderSummaryCards(container, chartData) {
    const totalWorkIncome = chartData.reduce((sum, d) => sum + d.workIncome, 0);
    const totalRetirementBenefits = chartData.reduce((sum, d) => sum + d.retirementBenefits, 0);
    const totalInvestmentIncome = chartData.reduce((sum, d) => sum + d.investmentIncome, 0);
    const totalIncome = chartData.reduce((sum, d) => sum + d.totalIncome, 0);
    const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    const totalNet = totalIncome - totalExpenses;
    const avgMonthlyIncome = totalIncome / chartData.length;
    const avgMonthlyExpenses = totalExpenses / chartData.length;
    const avgMonthlyNet = totalNet / chartData.length;

    const summaryContainer = container.querySelector('#summary-cards');
    summaryContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #2ed573, #26d07c); padding: 16px; border-radius: 8px; color: white;">
            <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Work Income</div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px;">${formatCurrency(totalWorkIncome, 0)}</div>
            <div style="font-size: 10px; opacity: 0.8;">Salary & other work</div>
        </div>
        <div style="background: linear-gradient(135deg, #3498db, #5faee3); padding: 16px; border-radius: 8px; color: white;">
            <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Retirement Benefits</div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px;">${formatCurrency(totalRetirementBenefits, 0)}</div>
            <div style="font-size: 10px; opacity: 0.8;">Social Security & Pension</div>
        </div>
        <div style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 16px; border-radius: 8px; color: white;">
            <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Investment Withdrawals</div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px;">${formatCurrency(totalInvestmentIncome, 0)}</div>
            <div style="font-size: 10px; opacity: 0.8;">Portfolio withdrawals</div>
        </div>
        <div style="background: linear-gradient(135deg, #ff6b6b, #ee5a6f); padding: 16px; border-radius: 8px; color: white;">
            <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Total Expenses</div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px;">${formatCurrency(totalExpenses, 0)}</div>
            <div style="font-size: 10px; opacity: 0.8;">Avg: ${formatCurrency(avgMonthlyExpenses, 0)}/mo</div>
        </div>
        <div style="background: linear-gradient(135deg, ${totalNet >= 0 ? '#f1c40f, #f39c12' : '#e74c3c, #c0392b'}); padding: 16px; border-radius: 8px; color: white;">
            <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">Net Cash Flow</div>
            <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px;">${totalNet >= 0 ? '+' : ''}${formatCurrency(totalNet, 0)}</div>
            <div style="font-size: 10px; opacity: 0.8;">Avg: ${avgMonthlyNet >= 0 ? '+' : ''}${formatCurrency(avgMonthlyNet, 0)}/mo</div>
        </div>
    `;
}

/**
 * Render cash flow table
 */
function renderCashFlowTable(container, displayData, viewType) {
    const tableContainer = container.querySelector('#cashflow-table');

    // Limit display based on view type
    const maxRows = viewType === 'annual' ? 20 : 24;
    const limitedData = displayData.slice(0, maxRows);
    const periodLabel = viewType === 'annual' ? 'Year' : 'Month';

    tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                    <th style="text-align: left; padding: 10px; font-size: 12px; font-weight: 600;">${periodLabel}</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">Work</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">SS/Pension</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">Withdrawals</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">Expenses</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">Net</th>
                    <th style="text-align: right; padding: 10px; font-size: 12px; font-weight: 600;">Portfolio</th>
                </tr>
            </thead>
            <tbody>
                ${limitedData.map(period => `
                    <tr style="border-bottom: 1px solid var(--border-color); ${period.isRetired ? 'background: rgba(52, 152, 219, 0.05);' : ''}">
                        <td style="padding: 8px 10px; font-size: 12px;">
                            ${period.label}
                            ${period.isRetired ? '<span style="font-size: 10px; color: var(--info-color); margin-left: 4px;">🏖️</span>' : ''}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; color: var(--success-color); font-weight: 500;">
                            ${period.workIncome > 0 ? formatCurrency(period.workIncome, 0) : '—'}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; color: var(--info-color); font-weight: 500;">
                            ${period.retirementBenefits > 0 ? formatCurrency(period.retirementBenefits, 0) : '—'}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; color: #9b59b6; font-weight: 500;">
                            ${period.investmentIncome > 0 ? formatCurrency(period.investmentIncome, 0) : '—'}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; color: var(--danger-color); font-weight: 500;">
                            ${formatCurrency(period.expenses, 0)}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; color: ${period.netCashFlow >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ${period.netCashFlow >= 0 ? '+' : ''}${formatCurrency(period.netCashFlow, 0)}
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; color: var(--text-primary);">
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
