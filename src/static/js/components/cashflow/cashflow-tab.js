/**
 * Cash Flow Tab Component
 * Shows money coming in and going out over time
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { scenariosAPI } from '../../api/scenarios.js';
import { analysisAPI } from '../../api/analysis.js';

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
                <button onclick="window.app.showTab('welcome')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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
                <canvas id="cashflow-chart" style="max-height: 350px;"></canvas>
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

    // Initialize chart and data with default: through life expectancy, annual view
    (async () => {
        await renderCashFlowChart(container, profile, monthsToLifeExpectancy, 'annual', null, monthsToLifeExpectancy, lifeExpectancyAge);
        setupEventHandlers(container, profile, monthsToLifeExpectancy, lifeExpectancyAge);
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
    const scenarioSelect = container.querySelector('#scenario-select');
    const refreshBtn = container.querySelector('#refresh-chart');
    const resetZoomBtn = container.querySelector('#reset-zoom');
    const resetMetricsBtn = container.querySelector('#reset-metrics');

    const refresh = async () => {
        const periodValue = timePeriodSelect.value;
        const months = periodValue === 'life' ? monthsToLifeExpectancy : parseInt(periodValue);
        const viewType = viewTypeSelect.value;
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

        await renderCashFlowChart(container, profile, months, viewType, scenarioData, monthsToLifeExpectancy, lifeExpectancyAge);
    };

    timePeriodSelect.addEventListener('change', () => refresh());
    viewTypeSelect.addEventListener('change', () => refresh());
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
 * Fetch Monte Carlo analysis data for accurate projections
 */
async function fetchMonteCarloData(profile) {
    try {
        console.log('Fetching Monte Carlo analysis for accurate cash flow projections...');
        const response = await analysisAPI.runAnalysis(
            profile.name,
            250,  // Use only 250 simulations for fast response (backend runs 3x scenarios = 750 total)
            'moderate',  // Default to moderate (60/40) allocation
            'constant_real'
        );

        if (response && response.scenarios) {
            // Extract the moderate scenario timeline
            const moderateScenario = response.scenarios.moderate;
            if (moderateScenario && moderateScenario.timeline) {
                console.log('Monte Carlo data fetched successfully');
                return moderateScenario;
            }
        }

        console.warn('No timeline data in Monte Carlo response');
        return null;
    } catch (error) {
        console.error('Failed to fetch Monte Carlo data:', error);
        return null;
    }
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
        // Each person's benefits start when they retire individually
        let retirementBenefits = 0;

        // Person 1 benefits (start at their retirement date)
        if (isRetired) {
            retirementBenefits += financial.social_security_benefit || 0;
            retirementBenefits += financial.pension_benefit || 0;
        }

        // Person 2 (spouse) benefits (start at their retirement date)
        if (data.spouse) {
            const spouseRetirementDate = data.spouse.retirement_date ? new Date(data.spouse.retirement_date) : null;
            const spouseIsRetired = spouseRetirementDate && currentDate >= spouseRetirementDate;

            if (spouseIsRetired) {
                retirementBenefits += data.spouse.social_security_benefit || 0;
                retirementBenefits += data.spouse.pension_benefit || 0;
            }
        }

        // Get expenses from budget with retirement blending
        // Blended Budget Logic (matching backend retirement_model.py):
        // Both working -> 100% current
        // One retired -> 50% current / 50% future
        // Both retired -> 100% future
        let expenses = 0;

        if (budget.expenses && (budget.expenses.current || budget.expenses.future)) {
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
        } else if (financial.annual_expenses) {
            // Fallback to financial annual expenses
            expenses = financial.annual_expenses / 12;
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

        // Add savings to portfolio if positive cash flow before retirement
        if (!anyoneRetired && totalWorkIncome > expenses) {
            const monthlySavings = totalWorkIncome - expenses;
            currentPortfolio += monthlySavings;
        }

        const totalIncome = totalWorkIncome + retirementBenefits + investmentIncome;
        const netCashFlow = totalIncome - expenses;

        monthlyData.push({
            date: currentDate,
            label: monthLabel,
            workIncome: totalWorkIncome,
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
async function renderCashFlowChart(container, profile, months, viewType, scenarioData = null, monthsToLifeExpectancy = 360, lifeExpectancyAge = 95) {
    // Show loading indicator
    let canvasElement = container.querySelector('#cashflow-chart');
    const originalContent = canvasElement ? canvasElement.parentElement.innerHTML : '';
    if (canvasElement && canvasElement.parentElement) {
        canvasElement.parentElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 350px; flex-direction: column; gap: 12px;">
                <div style="font-size: 32px;">⏳</div>
                <div style="color: var(--text-secondary); font-size: 14px;">Fetching accurate Monte Carlo projections...</div>
            </div>
        `;
    }

    // Fetch accurate Monte Carlo data for portfolio projections with timeout
    let monteCarloData = null;
    try {
        // Add 30-second timeout to prevent infinite hang
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Monte Carlo fetch timeout')), 30000)
        );
        monteCarloData = await Promise.race([
            fetchMonteCarloData(profile),
            timeoutPromise
        ]);
    } catch (error) {
        console.warn('Monte Carlo data fetch failed or timed out, using simplified projection:', error);
        monteCarloData = null;
    }

    // Restore canvas (always restore, even on error)
    if (canvasElement && canvasElement.parentElement) {
        canvasElement.parentElement.innerHTML = originalContent;
    }

    const monthlyData = calculateMonthlyCashFlow(profile, months);
    const chartData = viewType === 'annual' ? aggregateToAnnual(monthlyData) : monthlyData;

    // Replace portfolio values with accurate Monte Carlo data if available
    let monteCarloPortfolioData = null;
    if (monteCarloData && monteCarloData.timeline) {
        console.log('Using Monte Carlo portfolio projections (accurate)');
        monteCarloPortfolioData = mapScenarioToChartData(monteCarloData.timeline, chartData, viewType);

        // Update chart data with accurate portfolio values
        if (monteCarloPortfolioData) {
            chartData.forEach((period, index) => {
                if (monteCarloPortfolioData[index] !== null) {
                    period.portfolioValue = monteCarloPortfolioData[index];
                }
            });
        }
    } else {
        console.warn('Using simplified JavaScript projection (less accurate)');
    }

    // Process scenario data if available
    let scenarioMedianData = null;
    if (scenarioData && scenarioData.results) {
        console.log('Processing scenario data...');
        console.log('Full scenario results:', scenarioData.results);

        // Check if it's a multi-scenario result (has scenarios object)
        if (scenarioData.results.scenarios) {
            console.log('Multi-scenario detected');
            // For multi-scenario, use the 'base' scenario or the first scenario
            const scenarios = scenarioData.results.scenarios;
            const scenarioKeys = Object.keys(scenarios);
            const selectedKey = scenarios['base'] ? 'base' : scenarioKeys[0];

            if (selectedKey && scenarios[selectedKey]?.timeline) {
                console.log(`Using scenario: ${selectedKey}`);
                scenarioMedianData = mapScenarioToChartData(scenarios[selectedKey].timeline, chartData, viewType);
            }
        }
        // Check if it's a single scenario result (direct timeline)
        else if (scenarioData.results.timeline) {
            console.log('Single scenario detected');
            scenarioMedianData = mapScenarioToChartData(scenarioData.results.timeline, chartData, viewType);
        }
        // Check if results is the timeline data itself (backward compatibility)
        else if (scenarioData.results.years && scenarioData.results.median) {
            console.log('Direct timeline data detected');
            scenarioMedianData = mapScenarioToChartData(scenarioData.results, chartData, viewType);
        }

        console.log('Mapped scenario data:', scenarioMedianData);
    } else {
        console.log('No scenario data available');
    }

    // Merge scenario portfolio values into table data if available
    let tableData = viewType === 'annual' ? chartData : monthlyData;
    if (scenarioMedianData) {
        console.log('Merging scenario data into table. First 5 years:');
        console.log('Original portfolio values:', tableData.slice(0, 5).map(d => d.portfolioValue));
        console.log('Scenario median values:', scenarioMedianData.slice(0, 5));

        tableData = tableData.map((period, index) => ({
            ...period,
            portfolioValue: scenarioMedianData[index] !== null ? scenarioMedianData[index] : period.portfolioValue
        }));

        console.log('Merged portfolio values:', tableData.slice(0, 5).map(d => d.portfolioValue));
    } else {
        console.log('No scenario data available for table merge');
    }

    // Update summary cards
    renderSummaryCards(container, chartData);

    // Update table title
    const tableTitle = container.querySelector('#table-title');
    if (tableTitle) {
        tableTitle.textContent = viewType === 'annual' ? 'Annual Cash Flow Details' : 'Monthly Cash Flow Details';
    }

    // Update table
    renderCashFlowTable(container, tableData, viewType);

    // Render chart
    const canvas = container.querySelector('#cashflow-chart');
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (window.cashFlowChart) {
        window.cashFlowChart.destroy();
    }

    // Build datasets array
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
                    text: `Cash Flow Projection (${viewType === 'annual' ? 'Annual' : 'Monthly'}) - ${Math.floor(months / 12)} years through age ${lifeExpectancyAge} - ${monteCarloPortfolioData ? 'Monte Carlo Portfolio ✓' : 'Simplified Portfolio'} - Scroll or +/- to zoom, drag to pan`,
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim()
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim(),
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
                            3: 'expenses',
                            4: 'net-cash-flow'
                        };

                        const metric = datasetToMetricMap[index];
                        if (metric) {
                            metricVisibilityState[metric] = meta.hidden !== null ? meta.hidden : chart.data.datasets[index].hidden;

                            // Update summary card visual state
                            updateSummaryCardVisuals(container);
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
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim()
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim(),
                        callback: function(value) {
                            return formatCurrency(Math.abs(value), 0);
                        }
                    },
                    grid: {
                        color: 'rgba(128, 128, 128, 0.2)'
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
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim()
                    },
                    ticks: {
                        font: {
                            size: 13,
                            weight: '500'
                        },
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim(),
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
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim()
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

    // Restore metric visibility state from previous settings
    restoreMetricVisibility();

    // Setup metric isolation handlers after chart is created
    setupMetricIsolation(container);
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
        <div class="metric-card" data-metric="work-income" style="background: linear-gradient(135deg, #2ed573, #26d07c); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Work Income</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalWorkIncome, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">Salary & other</div>
        </div>
        <div class="metric-card" data-metric="retirement-benefits" style="background: linear-gradient(135deg, #3498db, #5faee3); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Retirement Benefits</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalRetirementBenefits, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">SS & Pension</div>
        </div>
        <div class="metric-card" data-metric="investment-withdrawals" style="background: linear-gradient(135deg, #9b59b6, #8e44ad); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Withdrawals</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalInvestmentIncome, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">Portfolio</div>
        </div>
        <div class="metric-card" data-metric="expenses" style="background: linear-gradient(135deg, #ff6b6b, #ee5a6f); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Expenses</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${formatCurrency(totalExpenses, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">Avg: ${formatCurrency(avgMonthlyExpenses, 0)}/mo</div>
        </div>
        <div class="metric-card" data-metric="net-cash-flow" style="background: linear-gradient(135deg, ${totalNet >= 0 ? '#f1c40f, #f39c12' : '#e74c3c, #c0392b'}); padding: 10px; border-radius: 6px; color: white; cursor: pointer; transition: all 0.2s; border: 3px solid transparent;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="font-size: 10px; opacity: 0.9; margin-bottom: 2px;">Net Cash Flow</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 1px;">${totalNet >= 0 ? '+' : ''}${formatCurrency(totalNet, 0)}</div>
            <div style="font-size: 9px; opacity: 0.8;">Avg: ${avgMonthlyNet >= 0 ? '+' : ''}${formatCurrency(avgMonthlyNet, 0)}/mo</div>
        </div>
    `;
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
        'expenses': [3],
        'net-cash-flow': [4]
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
    const metricCards = container.querySelectorAll('.metric-card');
    const chart = window.cashFlowChart;

    if (!chart) {
        console.warn('Cash flow chart not found, metric isolation disabled');
        return;
    }

    // Map metric names to dataset indices
    const metricToDatasetMap = {
        'work-income': [0],              // Work Income
        'retirement-benefits': [1],       // Retirement Benefits (SS/Pension)
        'investment-withdrawals': [2],    // Investment Withdrawals
        'expenses': [3],                  // Expenses
        'net-cash-flow': [4]              // Net Cash Flow
    };

    // Restore visual state of cards on initial setup
    restoreCardVisualState(container);

    metricCards.forEach(card => {
        card.addEventListener('click', () => {
            const metric = card.getAttribute('data-metric');
            const datasetIndices = metricToDatasetMap[metric] || [];

            // Toggle visibility of this metric's datasets
            datasetIndices.forEach(index => {
                const dataset = chart.data.datasets[index];
                if (dataset) {
                    dataset.hidden = !dataset.hidden;
                }
            });

            // Update saved state
            const isHidden = datasetIndices.every(index => chart.data.datasets[index]?.hidden);
            metricVisibilityState[metric] = isHidden;

            // Update card styling based on visibility
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

            chart.update();
        });
    });
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
