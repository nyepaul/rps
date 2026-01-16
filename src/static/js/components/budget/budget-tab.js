/**
 * Budget Tab Component
 * Manages current and future income/expense budgets
 */

import { store } from '../../state/store.js';
import { showError, showSuccess, showLoading } from '../../utils/dom.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';
import { APP_CONFIG } from '../../config.js';

let currentPeriod = 'current';
let budgetData = null;

/**
 * Render Budget Tab
 */
export function renderBudgetTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 10px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Please create or select a profile to manage your budget.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    // Initialize budget data
    budgetData = profile.data?.budget || getDefaultBudget();

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 12px;">
            <div style="margin-bottom: 12px;">
                <h1 style="margin: 0; font-size: 24px;">💵 Budget Planning</h1>
                <p style="color: var(--text-secondary); margin: 4px 0 0 0; font-size: 13px;">
                    Plan your current and future income/expenses
                </p>
            </div>

            <!-- Summary Cards -->
            <div id="budget-summary"></div>

            <!-- Period Toggle - Above content sections -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 12px 0; padding: 12px 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 600; color: var(--text-secondary); font-size: 13px;">Viewing:</span>
                    <div id="period-toggle" style="display: flex; gap: 4px; background: var(--bg-primary); padding: 3px; border-radius: 6px;">
                        <button class="period-btn active" data-period="current" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">
                            Current
                        </button>
                        <button class="period-btn" data-period="future" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">
                            Future
                        </button>
                    </div>
                    <span id="period-context" style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">
                        (Pre-retirement budget)
                    </span>
                </div>
                <button id="save-budget-btn" style="padding: 8px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Save Budget
                </button>
            </div>

            <!-- Two Column Layout -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div id="income-section"></div>
                <div id="expense-section"></div>
            </div>
        </div>
    `;

    // Render sections
    renderBudgetSummary(container);
    renderIncomeSection(container);
    renderExpenseSection(container);

    // Setup event handlers
    setupBudgetEventHandlers(profile, container);
}

/**
 * Get historical average rate based on 60/40 allocation
 */
function getHistoricalAverageRate() {
    const historical = APP_CONFIG.MARKET_PROFILES.historical;
    if (!historical) return 0.04; // Fallback
    
    // Use moderate 60/40 allocation as standard baseline
    const stockWeight = 0.60;
    const bondWeight = 0.40;
    
    return (stockWeight * historical.stock_return_mean) + (bondWeight * historical.bond_return_mean);
}

/**
 * Get default budget structure
 */
function getDefaultBudget() {
    const historicalRate = getHistoricalAverageRate();
    
    return {
        version: '1.1',
        income: {
            current: {
                employment: {
                    primary_person: 0,
                    spouse: 0
                },
                rental_income: [],
                part_time_consulting: [],
                business_income: [],
                investment_income: [],
                other_income: []
            },
            future: {
                rental_income: [],
                part_time_consulting: [],
                business_income: [],
                investment_income: [],
                other_income: []
            }
        },
        expenses: {
            current: getDefaultExpenses(),
            future: getDefaultExpenses()
        },
        investment_config: {
            current: { type: 'rate', value: historicalRate, strategy: 'constant' },
            future: { type: 'rate', value: historicalRate, strategy: 'constant' }
        }
    };
}

function getDefaultExpenses() {
    return {
        housing: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        transportation: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        food: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        healthcare: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        insurance: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        discretionary: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} },
        other: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {} }
    };
}

/**
 * Render Budget Summary Cards
 */
function renderBudgetSummary(container) {
    const summaryContainer = container.querySelector('#budget-summary');

    const currentIncome = calculateTotalIncome('current');
    const futureIncome = calculateTotalIncome('future');
    const currentExpenses = calculateTotalExpenses('current');
    const futureExpenses = calculateTotalExpenses('future');

    const currentCashFlow = currentIncome - currentExpenses;
    const futureCashFlow = futureIncome - futureExpenses;

    summaryContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px;">
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Current Income</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(currentIncome)}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Future Income</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(futureIncome)}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid #ef4444;">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Current Expenses</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(currentExpenses)}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Future Expenses</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(futureExpenses)}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid ${currentCashFlow >= 0 ? '#10b981' : '#ef4444'};">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Current Cash Flow</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(currentCashFlow)}</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; border-left: 3px solid ${futureCashFlow >= 0 ? '#10b981' : '#ef4444'};">
                <div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">Future Cash Flow</div>
                <div style="font-size: 16px; font-weight: 600;">${formatCurrency(futureCashFlow)}</div>
            </div>
        </div>
    `;
}

/**
 * Calculate investment income from assets
 */
function calculateInvestmentIncome(period) {
    const profile = store.get('currentProfile');
    if (!profile || !profile.data?.assets) return 0;

    const historicalRate = getHistoricalAverageRate();

    // Initialize config if missing
    if (!budgetData.investment_config) {
        budgetData.investment_config = {
            current: { type: 'rate', value: historicalRate },
            future: { type: 'rate', value: historicalRate }
        };
    }

    const config = budgetData.investment_config[period] || { type: 'rate', value: historicalRate };

    // Fixed amount override
    if (config.type === 'fixed') {
        return config.value;
    }

    // Rate based calculation
    const assets = profile.data.assets;
    let totalInvestmentAssets = 0;

    // Sum up investment accounts
    const retirementAccounts = assets.retirement_accounts || [];
    const taxableAccounts = assets.taxable_accounts || [];

    for (const account of retirementAccounts) {
        totalInvestmentAssets += account.value || 0;
    }

    for (const account of taxableAccounts) {
        totalInvestmentAssets += account.value || 0;
    }

    return totalInvestmentAssets * (config.value || 0);
}

/**
 * Calculate total income for a period
 */
function calculateTotalIncome(period) {
    let total = 0;
    const income = budgetData.income[period];

    // Employment (current only)
    if (period === 'current') {
        total += income.employment?.primary_person || 0;
        total += income.employment?.spouse || 0;
    }

    // Add calculated investment income
    total += calculateInvestmentIncome(period);

    // Other income categories (excluding investment_income which is now calculated)
    const categories = ['rental_income', 'part_time_consulting', 'business_income', 'other_income'];
    for (const category of categories) {
        const items = income[category] || [];
        for (const item of items) {
            const amount = item.amount || 0;
            const frequency = item.frequency || 'monthly';
            total += annualAmount(amount, frequency);
        }
    }

    return total;
}

/**
 * Calculate total expenses for a period
 */
function calculateTotalExpenses(period) {
    let total = 0;
    const expenses = budgetData.expenses[period];

    const categories = ['housing', 'transportation', 'food', 'healthcare', 'insurance', 'discretionary', 'other'];
    for (const category of categories) {
        const cat = expenses[category] || {};
        const amount = cat.amount || 0;
        const frequency = cat.frequency || 'monthly';
        total += annualAmount(amount, frequency);
    }

    return total;
}

/**
 * Convert amount to annual
 */
function annualAmount(amount, frequency) {
    if (frequency === 'monthly') return amount * 12;
    if (frequency === 'quarterly') return amount * 4;
    return amount;
}

/**
 * Render Income Section
 */
function renderIncomeSection(parentContainer) {
    const container = parentContainer.querySelector('#income-section');
    const income = budgetData.income[currentPeriod];

    let html = `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
            <h2 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                <span style="font-size: 18px;">💰</span>
                Income Sources
            </h2>
    `;

    // Employment (current only)
    if (currentPeriod === 'current') {
        html += `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <h3 style="font-size: 13px; margin-bottom: 8px; color: var(--text-secondary); font-weight: 600;">Employment Income</h3>
                <div style="display: grid; gap: 8px;">
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 3px;">Primary Salary</label>
                        <input type="text" id="employment-primary" value="${formatCurrency(income.employment?.primary_person || 0)}"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 3px;">Spouse Salary</label>
                        <input type="text" id="employment-spouse" value="${formatCurrency(income.employment?.spouse || 0)}"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                </div>
            </div>
        `;
    }

    // Calculate investment income from assets
    const calculatedInvestmentIncome = calculateInvestmentIncome(currentPeriod);
    const config = (budgetData.investment_config && budgetData.investment_config[currentPeriod]) || { type: 'rate', value: 0.04, strategy: 'constant' };
    
    let configLabel = '';
    if (config.type === 'fixed') {
        configLabel = 'Fixed Amount Override';
    } else {
        const strategyNames = {
            'constant': 'Constant',
            'smile': 'Smile',
            'decline': 'Decline'
        };
        const strategyLabel = strategyNames[config.strategy] || 'Constant';
        configLabel = `${(config.value * 100).toFixed(1)}% of assets (${strategyLabel})`;
    }

    // Show calculated investment income
    html += `
        <div style="margin-bottom: 12px; padding: 8px 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <h3 style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; font-weight: 600; margin: 0;">
                    <span style="font-size: 14px;">📊</span>
                    Investment Income (Calculated)
                </h3>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="font-size: 11px; color: var(--success-color); font-weight: 600; background: var(--success-bg); padding: 2px 8px; border-radius: 3px;">AUTO</span>
                    <button id="edit-investment-config-btn" style="padding: 2px 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;">⚙️</button>
                </div>
            </div>
            <div style="font-size: 13px; font-weight: 500;">
                ${formatCurrency(calculatedInvestmentIncome)}/year
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                ${configLabel}
            </div>
        </div>
    `;

    // Other income categories (excluding investment income which is calculated)
    const categories = [
        { key: 'rental_income', label: 'Rental Income', icon: '🏠' },
        { key: 'part_time_consulting', label: 'Part-Time/Consulting', icon: '💼' },
        { key: 'business_income', label: 'Business Income', icon: '📈' },
        { key: 'other_income', label: 'Other Income', icon: '💵' }
    ];

    for (const cat of categories) {
        const items = income[cat.key] || [];
        html += `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <h3 style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; font-weight: 600; margin: 0;">
                        <span style="font-size: 14px;">${cat.icon}</span>
                        ${cat.label}
                    </h3>
                    <button class="add-income-btn" data-category="${cat.key}" style="padding: 4px 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        + Add
                    </button>
                </div>
                <div id="income-list-${cat.key}" style="display: flex; flex-direction: column; gap: 4px;">
                    ${items.map((item, index) => renderIncomeItem(item, cat.key, index)).join('')}
                    ${items.length === 0 ? `<div style="color: var(--text-secondary); font-size: 12px; font-style: italic; padding: 4px 0;">No items</div>` : ''}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Setup event listeners
    setupIncomeEventListeners(container);
    
    // Config button listener
    const configBtn = container.querySelector('#edit-investment-config-btn');
    if (configBtn) {
        configBtn.addEventListener('click', () => {
            showInvestmentConfigModal(container);
        });
    }
}

/**
 * Show investment config modal
 */
function showInvestmentConfigModal(parentContainer) {
    const historicalRate = getHistoricalAverageRate();
    const config = (budgetData.investment_config && budgetData.investment_config[currentPeriod]) || { type: 'rate', value: historicalRate, strategy: 'constant' };
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px;">Configure Investment Income</h2>
            <p style="margin-bottom: 15px; font-size: 13px; color: var(--text-secondary);">
                Configure how investment income is estimated for the <strong>${currentPeriod}</strong> period.
            </p>
            <form id="investment-config-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; font-size: 13px;">Calculation Method</label>
                    <div style="display: flex; gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                            <input type="radio" name="config_type" value="rate" ${config.type === 'rate' ? 'checked' : ''}>
                            Percentage of Assets
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                            <input type="radio" name="config_type" value="fixed" ${config.type === 'fixed' ? 'checked' : ''}>
                            Fixed Amount
                        </label>
                    </div>
                </div>

                <div id="rate-input-group" style="margin-bottom: 15px; ${config.type === 'rate' ? '' : 'display: none;'}">
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Withdrawal/Yield Rate (%)</label>
                        <input type="number" id="config-rate" value="${(config.type === 'rate' ? config.value * 100 : historicalRate * 100).toFixed(2)}" step="0.1" min="0" max="100"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                        <small style="color: var(--text-secondary); font-size: 11px;">Historical average: ${(historicalRate * 100).toFixed(1)}%</small>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Withdrawal Model</label>
                        <select id="config-strategy" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                            <option value="constant" ${config.strategy === 'constant' ? 'selected' : ''}>Constant (Inflation Adjusted)</option>
                            <option value="smile" ${config.strategy === 'smile' ? 'selected' : ''}>Retirement Smile (Variable)</option>
                            <option value="decline" ${config.strategy === 'decline' ? 'selected' : ''}>Conservative Decline</option>
                        </select>
                        <small style="color: var(--text-secondary); font-size: 11px; display: block; margin-top: 2px;">
                            Applies spending curve to this base rate
                        </small>
                    </div>
                </div>

                <div id="fixed-input-group" style="margin-bottom: 15px; ${config.type === 'fixed' ? '' : 'display: none;'}">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Annual Amount ($)</label>
                    <input type="text" id="config-amount" value="${config.type === 'fixed' ? formatCurrency(config.value, 0) : ''}"
                           style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" id="cancel-config-btn" style="padding: 6px 14px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 6px 14px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Update
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Toggle inputs based on type
    const typeRadios = modal.querySelectorAll('input[name="config_type"]');
    const rateGroup = modal.querySelector('#rate-input-group');
    const fixedGroup = modal.querySelector('#fixed-input-group');

    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'rate') {
                rateGroup.style.display = 'block';
                fixedGroup.style.display = 'none';
            } else {
                rateGroup.style.display = 'none';
                fixedGroup.style.display = 'block';
            }
        });
    });

    // Formatting for fixed amount
    const amountInput = modal.querySelector('#config-amount');
    amountInput.addEventListener('blur', (e) => {
        const val = parseCurrency(e.target.value);
        e.target.value = formatCurrency(val, 0);
    });

    // Close handlers
    modal.querySelector('#cancel-config-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Submit handler
    modal.querySelector('#investment-config-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const type = modal.querySelector('input[name="config_type"]:checked').value;
        const strategy = modal.querySelector('#config-strategy').value;
        let value = 0;

        if (type === 'rate') {
            value = parseFloat(modal.querySelector('#config-rate').value) / 100;
        } else {
            value = parseCurrency(modal.querySelector('#config-amount').value);
        }

        // Initialize config structure if needed
        if (!budgetData.investment_config) {
            budgetData.investment_config = {};
        }

        budgetData.investment_config[currentPeriod] = { type, value, strategy };

        // Update view
        renderIncomeSection(parentContainer);
        renderBudgetSummary(parentContainer);
        
        modal.remove();
    });
}

/**
 * Render individual income item
 */
function renderIncomeItem(item, category, index) {
    const amount = annualAmount(item.amount || 0, item.frequency || 'monthly');
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color);">
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; margin-bottom: 2px; font-size: 13px;">${item.name || 'Unnamed'}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    ${formatCurrency(item.amount || 0)}/${item.frequency || 'monthly'}
                    (${formatCurrency(amount)}/yr)
                </div>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="edit-income-btn" data-category="${category}" data-index="${index}" style="padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;">
                    Edit
                </button>
                <button class="delete-income-btn" data-category="${category}" data-index="${index}" style="padding: 4px 8px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    Del
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup income event listeners
 */
function setupIncomeEventListeners(container) {
    // Employment inputs (current period only)
    if (currentPeriod === 'current') {
        const primaryInput = container.querySelector('#employment-primary');
        const spouseInput = container.querySelector('#employment-spouse');

        if (primaryInput) {
            primaryInput.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                budgetData.income.current.employment.primary_person = value;
                e.target.value = formatCurrency(value);
                renderBudgetSummary(container);
            });
        }

        if (spouseInput) {
            spouseInput.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                budgetData.income.current.employment.spouse = value;
                e.target.value = formatCurrency(value);
                renderBudgetSummary(container);
            });
        }
    }

    // Add income buttons
    container.querySelectorAll('.add-income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            showIncomeItemModal(container, category, null);
        });
    });

    // Edit income buttons
    container.querySelectorAll('.edit-income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            const index = parseInt(e.target.getAttribute('data-index'));
            showIncomeItemModal(container, category, index);
        });
    });

    // Delete income buttons
    container.querySelectorAll('.delete-income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            const index = parseInt(e.target.getAttribute('data-index'));
            if (confirm('Are you sure you want to delete this income item?')) {
                budgetData.income[currentPeriod][category].splice(index, 1);
                renderIncomeSection(container);
                renderBudgetSummary(container);
            }
        });
    });
}

/**
 * Show income item modal
 */
function showIncomeItemModal(parentContainer, category, index) {
    const isEdit = index !== null;
    const item = isEdit ? budgetData.income[currentPeriod][category][index] : {
        name: '',
        amount: 0,
        frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        inflation_adjusted: true,
        taxable: true
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px;">${isEdit ? 'Edit' : 'Add'} Income Item</h2>
            <form id="income-item-form">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Name</label>
                    <input type="text" id="income-name" value="${item.name}" required
                           style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Amount</label>
                        <input type="number" id="income-amount" value="${item.amount}" min="0" step="0.01" required
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Frequency</label>
                        <select id="income-frequency" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                            <option value="monthly" ${item.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${item.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="annual" ${item.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Start Date</label>
                        <input type="date" id="income-start-date" value="${item.start_date}" required
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">End Date (Optional)</label>
                        <input type="date" id="income-end-date" value="${item.end_date || ''}"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="income-inflation" ${item.inflation_adjusted ? 'checked' : ''}>
                        <span>Adjust for inflation</span>
                    </label>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="income-taxable" ${item.taxable ? 'checked' : ''}>
                        <span>Taxable income</span>
                    </label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" id="cancel-btn" style="padding: 6px 14px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 6px 14px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        ${isEdit ? 'Update' : 'Add'}
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#income-item-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const newItem = {
            name: modal.querySelector('#income-name').value,
            amount: parseFloat(modal.querySelector('#income-amount').value),
            frequency: modal.querySelector('#income-frequency').value,
            start_date: modal.querySelector('#income-start-date').value,
            end_date: modal.querySelector('#income-end-date').value || null,
            inflation_adjusted: modal.querySelector('#income-inflation').checked,
            taxable: modal.querySelector('#income-taxable').checked
        };

        if (isEdit) {
            budgetData.income[currentPeriod][category][index] = newItem;
        } else {
            if (!budgetData.income[currentPeriod][category]) {
                budgetData.income[currentPeriod][category] = [];
            }
            budgetData.income[currentPeriod][category].push(newItem);
        }

        renderIncomeSection(parentContainer);
        renderBudgetSummary(parentContainer);
        modal.remove();
    });
}

/**
 * Render Expense Section
 */
function renderExpenseSection(parentContainer) {
    const container = parentContainer.querySelector('#expense-section');
    const expenses = budgetData.expenses[currentPeriod];

    const categories = [
        { key: 'housing', label: 'Housing', icon: '🏠' },
        { key: 'transportation', label: 'Transportation', icon: '🚗' },
        { key: 'food', label: 'Food', icon: '🍽️' },
        { key: 'healthcare', label: 'Healthcare', icon: '🏥' },
        { key: 'insurance', label: 'Insurance', icon: '🛡️' },
        { key: 'discretionary', label: 'Discretionary', icon: '🎉' },
        { key: 'other', label: 'Other', icon: '📌' }
    ];

    let html = `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
            <h2 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                <span style="font-size: 18px;">💳</span>
                Expense Categories
            </h2>
            <div style="display: flex; flex-direction: column; gap: 6px;">
    `;

    for (const cat of categories) {
        const expense = expenses[cat.key] || { amount: 0, frequency: 'monthly' };
        const annual = annualAmount(expense.amount || 0, expense.frequency || 'monthly');

        html += `
            <div style="padding: 8px 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <span style="font-size: 16px;">${cat.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 500; font-size: 13px; margin-bottom: 2px;">${cat.label}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${formatCurrency(expense.amount || 0)}/${expense.frequency || 'monthly'} (${formatCurrency(annual)}/yr)</div>
                    </div>
                </div>
                <button class="edit-expense-btn" data-category="${cat.key}" style="padding: 4px 10px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    Edit
                </button>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Setup event listeners
    setupExpenseEventListeners(parentContainer);
}

/**
 * Setup expense event listeners
 */
function setupExpenseEventListeners(container) {
    container.querySelectorAll('.edit-expense-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            showExpenseEditorModal(container, category);
        });
    });
}

/**
 * Show expense editor modal
 */
function showExpenseEditorModal(parentContainer, category) {
    const categoryLabels = {
        housing: 'Housing',
        transportation: 'Transportation',
        food: 'Food',
        healthcare: 'Healthcare',
        insurance: 'Insurance',
        discretionary: 'Discretionary',
        other: 'Other'
    };

    const expense = budgetData.expenses[currentPeriod][category] || { amount: 0, frequency: 'monthly', inflation_adjusted: true };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px;">Edit ${categoryLabels[category]}</h2>
            <form id="expense-form">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Amount</label>
                        <input type="number" id="expense-amount" value="${expense.amount}" min="0" step="0.01" required
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">Frequency</label>
                        <select id="expense-frequency" style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                            <option value="monthly" ${expense.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${expense.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="annual" ${expense.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                        <input type="checkbox" id="expense-inflation" ${expense.inflation_adjusted ? 'checked' : ''}>
                        <span>Adjust for inflation</span>
                    </label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" id="cancel-btn" style="padding: 6px 14px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 6px 14px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        Update
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#expense-form').addEventListener('submit', (e) => {
        e.preventDefault();

        budgetData.expenses[currentPeriod][category] = {
            amount: parseFloat(modal.querySelector('#expense-amount').value),
            frequency: modal.querySelector('#expense-frequency').value,
            inflation_adjusted: modal.querySelector('#expense-inflation').checked,
            subcategories: expense.subcategories || {}
        };

        renderExpenseSection(parentContainer);
        renderBudgetSummary(parentContainer);
        modal.remove();
    });
}

/**
 * Setup budget event handlers
 */
function setupBudgetEventHandlers(profile, container) {
    // Period toggle
    container.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentPeriod = e.target.getAttribute('data-period');

            // Update button styles
            container.querySelectorAll('.period-btn').forEach(b => {
                if (b === e.target) {
                    b.classList.add('active');
                    b.style.background = 'var(--accent-color)';
                    b.style.color = 'white';
                } else {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-primary)';
                }
            });

            // Update context text
            const contextSpan = container.querySelector('#period-context');
            if (contextSpan) {
                contextSpan.textContent = currentPeriod === 'current'
                    ? '(Pre-retirement budget)'
                    : '(Post-retirement budget)';
            }

            // Re-render sections
            renderIncomeSection(container);
            renderExpenseSection(container);
        });
    });

    // Save button
    container.querySelector('#save-budget-btn').addEventListener('click', async () => {
        await saveBudget(profile, container);
    });

    // Initialize period button styles
    container.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.classList.contains('active')) {
            btn.style.background = 'var(--accent-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-primary)';
        }
    });
}

/**
 * Save budget
 */
async function saveBudget(profile, container) {
    const saveBtn = container.querySelector('#save-budget-btn');
    const originalText = saveBtn.textContent;

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        // Import profiles API
        const { profilesAPI } = await import('../../api/profiles.js');

        // Update profile data
        const updatedData = {
            ...profile.data,
            budget: budgetData
        };

        // Save to backend
        const result = await profilesAPI.update(profile.name, { data: updatedData });

        // Update store
        store.setState({ currentProfile: result.profile });

        // Show success message
        showSuccess('Budget saved successfully!');

        // Update the budget data reference
        budgetData = result.profile.data.budget;

    } catch (error) {
        console.error('Error saving budget:', error);
        showError('Failed to save budget: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}
