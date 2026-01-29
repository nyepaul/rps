/**
 * Expense Tab Component
 * Manages current and future expenses (income handled on Income tab)
 */

import { store } from '../../state/store.js';
import { showError, showSuccess, showLoading } from '../../utils/dom.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';
import { APP_CONFIG } from '../../config.js';
import { showAIImportModal } from '../ai/ai-import-modal.js';
import { apiClient } from '../../api/client.js';
import { parseCSV, EXPENSE_CONFIG, validateCSVFile } from '../../utils/csv-parser.js';

let currentPeriod = 'current';
let budgetData = null;

/**
 * Render Expense Tab
 */
export function renderBudgetTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8);">
                <div style="font-size: 48px; margin-bottom: var(--space-5);">📊</div>
                <h2 style="margin-bottom: var(--space-3);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-5);">
                    Please create or select a profile to manage your expenses.
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

    // Initialize budget data
    budgetData = profile.data?.budget || getDefaultBudget();

    // Ensure all income categories exist for both periods
    if (!budgetData.income) budgetData.income = {};
    if (!budgetData.income.current) budgetData.income.current = {};
    if (!budgetData.income.future) budgetData.income.future = {};

    // Ensure all arrays exist
    const categories = ['rental_income', 'part_time_consulting', 'business_income', 'investment_income', 'other_income'];
    categories.forEach(cat => {
        if (!Array.isArray(budgetData.income.current[cat])) budgetData.income.current[cat] = [];
        if (!Array.isArray(budgetData.income.future[cat])) budgetData.income.future[cat] = [];
    });

    // Initialize college expenses based on children
    if (!budgetData.college_expenses) {
        budgetData.college_expenses = initializeCollegeExpenses(profile.data?.children || []);
    }

    // Ensure expenses structure exists
    if (!budgetData.expenses) budgetData.expenses = {};
    if (!budgetData.expenses.current) budgetData.expenses.current = {};
    if (!budgetData.expenses.future) budgetData.expenses.future = {};

    // Convert any legacy single-object expenses to array format at load time
    ['current', 'future'].forEach(period => {
        Object.keys(budgetData.expenses[period]).forEach(category => {
            const catData = budgetData.expenses[period][category];
            // If it's a single object with an amount, convert to array
            if (catData && !Array.isArray(catData) && typeof catData === 'object' && catData.amount !== undefined) {
                budgetData.expenses[period][category] = [catData];
            }
        });
    });

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="margin-bottom: var(--space-2); display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="margin: 0; font-size: var(--font-2xl);">💸 Expense Management</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Tracking <strong>${profile.name}'s</strong> recurring costs
                    </p>
                </div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <button id="ai-import-expenses-btn" style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        AI Import
                    </button>
                    <div style="display: flex; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                        <button id="export-expenses-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-right: 1px solid var(--border-color); cursor: pointer; font-size: 11px;">
                            Export
                        </button>
                        <button id="import-expenses-csv-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; cursor: pointer; font-size: 11px;">
                            TXT/CSV
                        </button>
                    </div>
                    <div style="position: relative;">
                        <button id="expense-actions-btn" style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                            Actions ▾
                        </button>
                        <div id="expense-actions-menu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 100;">
                            <button class="action-menu-item" data-action="copy-to-post" style="width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; cursor: pointer; font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                📋 Copy Pre → Post Retirement
                            </button>
                            <button class="action-menu-item" data-action="copy-to-pre" style="width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; cursor: pointer; font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                📋 Copy Post → Pre Retirement
                            </button>
                            <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>
                            <button class="action-menu-item" data-action="clear-current" style="width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; cursor: pointer; font-size: 13px; color: var(--danger-color); display: flex; align-items: center; gap: 8px;">
                                🗑️ Clear Current Period
                            </button>
                            <button class="action-menu-item" data-action="clear-all" style="width: 100%; padding: 10px 14px; border: none; background: none; text-align: left; cursor: pointer; font-size: 13px; color: var(--danger-color); display: flex; align-items: center; gap: 8px;">
                                🗑️ Clear All Expenses
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div id="budget-summary"></div>

            <!-- Period Toggle -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div id="period-toggle" style="display: flex; gap: 2px; background: var(--bg-primary); padding: 2px; border-radius: 6px;">
                        <button class="period-btn active" data-period="current" style="padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 12px;">
                            Pre-Retirement
                        </button>
                        <button class="period-btn" data-period="future" style="padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; transition: all 0.2s; font-size: 12px;">
                            Post-Retirement
                        </button>
                    </div>
                </div>
                <button id="save-budget-btn" style="padding: 6px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700;">
                    Save Changes
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 12px;">
                <!-- Left Column: Expense Section -->
                <div id="expense-section"></div>

                <!-- Right Column: Summary and College -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- College Expenses Section -->
                    <div id="college-expenses-section"></div>
                    
                    <!-- Income/Investment Info (Simplified) -->
                    <div id="income-section"></div>
                </div>
            </div>
        </div>
    `;

    // Render sections
    renderBudgetSummary(container);
    renderCollegeExpensesSection(container);
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
        housing: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        utilities: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        transportation: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        food: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        healthcare: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        insurance: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        travel: { amount: 0, frequency: 'annual', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        entertainment: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        dining_out: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        personal_care: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        clothing: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        gifts: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        childcare_education: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        charitable_giving: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        subscriptions: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        pet_care: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        home_maintenance: { amount: 0, frequency: 'annual', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        debt_payments: { amount: 0, frequency: 'monthly', inflation_adjusted: false, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        taxes: { amount: 0, frequency: 'annual', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        discretionary: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true },
        other: { amount: 0, frequency: 'monthly', inflation_adjusted: true, subcategories: {}, start_date: null, end_date: null, ongoing: true }
    };
}

/**
 * Initialize college expenses for children
 */
function initializeCollegeExpenses(children) {
    const currentYear = new Date().getFullYear();
    const collegeExpenses = [];

    for (const child of children) {
        if (!child.birth_year) continue;

        const age = currentYear - child.birth_year;
        const collegeStartYear = child.birth_year + 18;
        const collegeEndYear = child.birth_year + 22;  // Default to 5 years (age 18-22)

        // Only add if they haven't finished college yet (< 23 years old)
        if (age < 23) {
            collegeExpenses.push({
                child_name: child.name || 'Child',
                birth_year: child.birth_year,
                start_year: collegeStartYear,
                end_year: collegeEndYear,
                annual_cost: 30000, // Default $30k/year
                enabled: true
            });
        }
    }

    return collegeExpenses;
}

/**
 * Render College Expenses Section
 */
function renderCollegeExpensesSection(parentContainer) {
    const container = parentContainer.querySelector('#college-expenses-section');
    const profile = store.get('currentProfile');
    const children = profile.data?.children || [];

    // Update college expenses if children changed
    if (!budgetData.college_expenses) {
        budgetData.college_expenses = initializeCollegeExpenses(children);
    }

    const collegeExpenses = budgetData.college_expenses || [];

    // Hide section if no children or no college expenses
    if (children.length === 0 || collegeExpenses.length === 0) {
        container.innerHTML = '';
        return;
    }

    const currentYear = new Date().getFullYear();

    let html = `
        <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); flex-wrap: wrap; gap: var(--space-2);">
                <h2 style="margin: 0; display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-md);">
                    <span style="font-size: var(--font-lg);">🎓</span>
                    College Expenses
                </h2>
                <button id="sync-children-btn" style="padding: var(--space-1) var(--space-3); background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--font-sm);" title="Sync with children in profile">
                    🔄 Sync Children
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
    `;

    for (let i = 0; i < collegeExpenses.length; i++) {
        const expense = collegeExpenses[i];
        const age = currentYear - expense.birth_year;
        const yearsUntilCollege = expense.start_year - currentYear;

        let statusText = '';
        if (yearsUntilCollege > 0) {
            statusText = `📅 Starts in ${yearsUntilCollege} year${yearsUntilCollege > 1 ? 's' : ''} (${expense.start_year})`;
        } else if (currentYear <= expense.end_year) {
            statusText = `<span style="color: var(--warning-color);">📚 Currently in college (${expense.start_year}-${expense.end_year})</span>`;
        } else {
            statusText = `<span style="color: var(--text-secondary);">✅ Completed (${expense.start_year}-${expense.end_year})</span>`;
        }

        html += `
            <div class="college-expense-row" data-index="${i}" style="padding: var(--space-2) var(--space-3); background: var(--bg-primary); border-radius: 4px; border: 1px solid ${expense.enabled ? 'var(--border-color)' : 'var(--text-secondary)'}; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; flex-wrap: wrap; gap: var(--space-2); ${expense.enabled ? '' : 'opacity: 0.6;'}" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='${expense.enabled ? 'var(--border-color)' : 'var(--text-secondary)'}'">
                <div style="display: flex; align-items: center; gap: var(--space-2); flex: 1; font-size: var(--font-sm); flex-wrap: wrap;">
                    <span style="font-size: var(--font-md);">🎓</span>
                    <span style="font-weight: 600;">${expense.child_name}</span>
                    <span style="color: var(--text-secondary);">Age ${age}</span>
                    <span style="color: var(--text-secondary);">${formatCurrency(expense.annual_cost, 0)}/year</span>
                    <span style="font-size: var(--font-xs); margin-left: var(--space-1);">${statusText}</span>
                    ${!expense.enabled ? '<span style="color: var(--danger-color); font-size: var(--font-xs); font-weight: 600;">DISABLED</span>' : ''}
                </div>
                <span style="font-size: var(--font-xs); color: var(--text-secondary);">✏️</span>
            </div>
        `;
    }

    html += `
            </div>
            <div style="margin-top: var(--space-2); padding: var(--space-2); background: var(--info-bg); border-radius: 4px; font-size: var(--font-xs); color: var(--info-color);">
                <strong>ℹ️ Tip:</strong> College expenses are automatically initialized based on children in your profile. Click any entry to customize the annual cost and years.
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Setup event listeners
    container.querySelectorAll('.college-expense-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // If already editing, close the editor
            if (row.classList.contains('editing')) {
                const cancelBtn = row.querySelector('.cancel-inline-edit');
                if (cancelBtn) cancelBtn.click();
                row.classList.remove('editing');
                return;
            }

            row.classList.add('editing');
            const index = parseInt(row.getAttribute('data-index'));
            const expense = budgetData.college_expenses[index];
            makeCollegeExpenseRowEditable(row, expense, index, parentContainer);
        });
    });

    // Sync button
    const syncBtn = container.querySelector('#sync-children-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            budgetData.college_expenses = initializeCollegeExpenses(children);
            renderCollegeExpensesSection(parentContainer);
            renderBudgetSummary(parentContainer);
        });
    }
}

/**
 * Make college expense row editable inline
 */
function makeCollegeExpenseRowEditable(rowElement, expense, index, parentContainer) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - expense.birth_year;
    const originalHTML = rowElement.innerHTML;

    rowElement.innerHTML = `
        <div style="padding: 10px 12px; background: var(--bg-tertiary); border-radius: 6px; border: 2px solid var(--accent-color);">
            <div style="margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--accent-color);">
                ${expense.child_name} (Age ${age})
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 10px; margin-bottom: 10px;">
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Annual Cost
                    </label>
                    <input type="number" name="annual_cost" value="${expense.annual_cost}" min="0" step="1000"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Start Year
                    </label>
                    <input type="number" name="start_year" value="${expense.start_year}" min="2000" max="2100"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        End Year
                    </label>
                    <input type="number" name="end_year" value="${expense.end_year}" min="2000" max="2100"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div style="display: flex; align-items: flex-end;">
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; font-weight: 600; padding: 4px 0;">
                        <input type="checkbox" name="enabled" ${expense.enabled ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                        <span>Enabled</span>
                    </label>
                </div>
            </div>
            <div style="display: flex; gap: 6px; justify-content: space-between; padding-top: 6px; border-top: 1px solid var(--border-color);">
                <button class="delete-college-expense" style="padding: 5px 12px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                    Delete
                </button>
                <div style="display: flex; gap: 6px;">
                    <button class="cancel-inline-edit" style="padding: 5px 12px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                        Cancel
                    </button>
                    <button class="save-inline-edit" style="padding: 5px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        💾 Save
                    </button>
                </div>
            </div>
        </div>
    `;

    // Handle save
    const saveBtn = rowElement.querySelector('.save-inline-edit');
    saveBtn.addEventListener('click', async () => {
        const updatedExpense = {
            ...expense,
            annual_cost: parseFloat(rowElement.querySelector('[name="annual_cost"]').value),
            start_year: parseInt(rowElement.querySelector('[name="start_year"]').value),
            end_year: parseInt(rowElement.querySelector('[name="end_year"]').value),
            enabled: rowElement.querySelector('[name="enabled"]').checked
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            budgetData.college_expenses[index] = updatedExpense;

            rowElement.classList.remove('editing');
            renderCollegeExpensesSection(parentContainer);
            renderBudgetSummary(parentContainer);

            const profile = store.get('currentProfile');
            if (profile) {
                await saveBudget(profile, parentContainer);
            }
        } catch (error) {
            alert('Failed to save: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save';
        }
    });

    // Handle cancel
    const cancelBtn = rowElement.querySelector('.cancel-inline-edit');
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rowElement.innerHTML = originalHTML;
        rowElement.classList.remove('editing');
    });

    // Handle delete
    const deleteBtn = rowElement.querySelector('.delete-college-expense');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove college expense for ${expense.child_name}?`)) {
            budgetData.college_expenses.splice(index, 1);
            rowElement.classList.remove('editing');
            renderCollegeExpensesSection(parentContainer);
            renderBudgetSummary(parentContainer);

            const profile = store.get('currentProfile');
            if (profile) {
                await saveBudget(profile, parentContainer);
            }
        }
    });

    // Click outside to cancel (but not on inputs or buttons)
    const editContainer = rowElement.querySelector('div');

    // Stop propagation on interactive elements to prevent closing
    const interactiveElements = editContainer.querySelectorAll('input, select, textarea, button, label');
    interactiveElements.forEach(elem => {
        elem.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Click on the container background (not interactive elements) to cancel
    editContainer.addEventListener('click', (e) => {
        // Only close if clicking directly on the container background
        if (e.target === editContainer) {
            rowElement.innerHTML = originalHTML;
            rowElement.classList.remove('editing');
        }
    });

    // Focus first input
    setTimeout(() => {
        const firstInput = rowElement.querySelector('input[name="annual_cost"]');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    }, 100);
}

/**
 * Show college expense editor modal
 */
function showCollegeExpenseModal(parentContainer, index) {
    const expense = budgetData.college_expenses[index];

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
        <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; max-width: 650px; width: 90%;">
            <h2 style="margin: 0 0 var(--space-3) 0; font-size: var(--font-lg);">Edit College Expense - ${expense.child_name}</h2>
            <form id="college-expense-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3);">
                <div style="grid-column: 1 / -1;">
                    <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: var(--font-sm);">
                        <input type="checkbox" id="expense-enabled" ${expense.enabled ? 'checked' : ''}>
                        <span style="font-weight: 600;">Include in expense calculations</span>
                    </label>
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-xs);">Annual College Cost</label>
                    <input type="number" id="college-annual-cost" value="${expense.annual_cost}" min="0" step="1000" required
                           style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-xs);">Start Year</label>
                    <input type="number" id="college-start-year" value="${expense.start_year}" min="2000" max="2100" required
                           style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-xs);">End Year</label>
                    <input type="number" id="college-end-year" value="${expense.end_year}" min="2000" max="2100" required
                           style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                </div>
                <div style="grid-column: 1 / -1; background: var(--info-bg); padding: var(--space-2); border-radius: 4px; font-size: var(--font-xs); color: var(--info-color);">
                    <strong>Note:</strong> College expenses are spread annually from ${expense.start_year} to ${expense.end_year}
                </div>
                <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border-color);">
                    <button type="button" id="delete-college-btn" style="padding: var(--space-2) var(--space-3); background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--font-xs);">
                        Delete
                    </button>
                    <div style="display: flex; gap: var(--space-2);">
                        <button type="button" id="cancel-btn" style="padding: var(--space-2) var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: var(--font-xs);">
                            Cancel
                        </button>
                        <button type="submit" style="padding: var(--space-2) var(--space-3); background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--font-xs);">
                            Update
                        </button>
                    </div>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Delete button
    modal.querySelector('#delete-college-btn').addEventListener('click', async () => {
        if (confirm(`Remove college expense for ${expense.child_name}?`)) {
            budgetData.college_expenses.splice(index, 1);
            modal.remove();
            renderCollegeExpensesSection(parentContainer);
            renderBudgetSummary(parentContainer);

            const profile = store.get('currentProfile');
            if (profile) {
                await saveBudget(profile, parentContainer);
            }
        }
    });

    modal.querySelector('#college-expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        budgetData.college_expenses[index] = {
            ...expense,
            annual_cost: parseFloat(modal.querySelector('#college-annual-cost').value),
            start_year: parseInt(modal.querySelector('#college-start-year').value),
            end_year: parseInt(modal.querySelector('#college-end-year').value),
            enabled: modal.querySelector('#expense-enabled').checked
        };

        // Auto-save to backend
        modal.remove();
        renderCollegeExpensesSection(parentContainer);
        renderBudgetSummary(parentContainer);

        const profile = store.get('currentProfile');
        if (profile) {
            await saveBudget(profile, parentContainer);
        }
    });
}

/**
 * Render Expense Summary Cards
 */
function renderBudgetSummary(container) {
    const summaryContainer = container.querySelector('#budget-summary');

    const currentExpenses = calculateTotalExpenses('current');
    const futureExpenses = calculateTotalExpenses('future');

    summaryContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; border-left: 4px solid #ef4444; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">PRE-RETIREMENT</div>
                <div style="font-size: 16px; font-weight: 700;">${formatCurrency(currentExpenses)}<span style="font-size: 11px; font-weight: normal; opacity: 0.7;">/yr</span></div>
            </div>
            <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; border-left: 4px solid #f59e0b; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">POST-RETIREMENT</div>
                <div style="font-size: 16px; font-weight: 700;">${formatCurrency(futureExpenses)}<span style="font-size: 11px; font-weight: normal; opacity: 0.7;">/yr</span></div>
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
 * @param {string} period - 'current' or 'future'
 * @param {Date} asOfDate - Optional date to calculate expenses as of (for date-range filtering)
 */
function calculateTotalExpenses(period, asOfDate = null) {
    let total = 0;
    const expenses = budgetData.expenses[period];
    if (!expenses) return total;

    const today = asOfDate || new Date();
    const currentYear = today.getFullYear();

    // Get all categories (including custom ones)
    const allCategories = Object.keys(expenses);

    for (const category of allCategories) {
        const catData = expenses[category];

        // Handle both array (new format) and object (legacy format) structures
        let expenseItems = [];
        if (Array.isArray(catData)) {
            expenseItems = catData;
        } else if (catData && typeof catData === 'object' && catData.amount !== undefined) {
            // Legacy format: single object
            expenseItems = [catData];
        }

        // Sum all active items in this category
        for (const item of expenseItems) {
            // Check if expense is active based on date range
            if (!isExpenseActive(item, today)) {
                continue; // Skip inactive expenses
            }

            const amount = item.amount || 0;
            const frequency = item.frequency || 'monthly';
            total += annualAmount(amount, frequency);
        }
    }

    // Add college expenses for the current year
    const collegeExpenses = budgetData.college_expenses || [];
    for (const expense of collegeExpenses) {
        if (!expense.enabled) continue;

        // Check if this year is within the college period
        if (currentYear >= expense.start_year && currentYear <= expense.end_year) {
            total += expense.annual_cost;
        }
    }

    return total;
}

/**
 * Check if an expense is active on a given date
 * @param {object} expense - Expense object with start_date, end_date, ongoing fields
 * @param {Date} checkDate - Date to check against
 * @returns {boolean} - True if expense is active on this date
 */
function isExpenseActive(expense, checkDate) {
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

    // Check if spouse exists in profile
    const profile = store.get('currentProfile');
    const hasSpouse = profile?.data?.spouse?.name ? true : false;

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
                <div style="display: grid; grid-template-columns: ${hasSpouse ? '1fr 1fr' : '1fr'}; gap: 8px;">
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 3px;">Primary Salary</label>
                        <input type="text" id="employment-primary" value="${formatCurrency(income.employment?.primary_person || 0)}"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    ${hasSpouse ? `
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 3px;">Spouse Salary</label>
                        <input type="text" id="employment-spouse" value="${formatCurrency(income.employment?.spouse || 0)}"
                               style="width: 100%; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                    </div>
                    ` : ''}
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

    // Setup event listeners (pass parent container, not income section)
    setupIncomeEventListeners(parentContainer);
    
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
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px;">
                <span style="font-weight: 500;">${item.name || 'Unnamed'}</span>
                <span style="color: var(--text-secondary);">${formatCurrency(item.amount || 0)}/${item.frequency || 'monthly'} (${formatCurrency(amount)}/yr)</span>
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
function setupIncomeEventListeners(parentContainer) {
    const incomeSection = parentContainer.querySelector('#income-section');
    if (!incomeSection) return;

    // Employment inputs (current period only)
    if (currentPeriod === 'current') {
        const primaryInput = incomeSection.querySelector('#employment-primary');
        const spouseInput = incomeSection.querySelector('#employment-spouse');

        if (primaryInput) {
            primaryInput.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                budgetData.income.current.employment.primary_person = value;
                e.target.value = formatCurrency(value);
                renderBudgetSummary(parentContainer);
            });
        }

        if (spouseInput) {
            spouseInput.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                budgetData.income.current.employment.spouse = value;
                e.target.value = formatCurrency(value);
                renderBudgetSummary(parentContainer);
            });
        }
    }

    // Add income buttons
    incomeSection.querySelectorAll('.add-income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            showIncomeItemModal(parentContainer, category, null);
        });
    });

    // Edit income buttons
    incomeSection.querySelectorAll('.edit-income-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            const index = parseInt(e.target.getAttribute('data-index'));
            showIncomeItemModal(parentContainer, category, index);
        });
    });

    // Delete income buttons
    incomeSection.querySelectorAll('.delete-income-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const category = e.target.getAttribute('data-category');
            const index = parseInt(e.target.getAttribute('data-index'));

            console.log('Delete clicked:', { category, index, currentPeriod });

            if (confirm('Are you sure you want to delete this income item?')) {
                console.log('Before delete:', budgetData.income[currentPeriod][category]);
                budgetData.income[currentPeriod][category].splice(index, 1);
                console.log('After delete:', budgetData.income[currentPeriod][category]);

                renderIncomeSection(parentContainer);
                renderBudgetSummary(parentContainer);

                // Auto-save to backend
                const profile = store.get('currentProfile');
                if (profile) {
                    try {
                        await saveBudget(profile, parentContainer);
                        console.log('Delete saved successfully');
                    } catch (error) {
                        console.error('Error saving after delete:', error);
                        showError('Failed to save changes: ' + error.message);
                    }
                }
            }
        });
    });
}

/**
 * Show income item modal
 */
function showIncomeItemModal(parentContainer, category, index) {
    const isEdit = index !== null;

    // Get profile data for calculating default dates
    const profile = store.get('currentProfile');
    const retirementDate = profile?.retirement_date || '';

    // Calculate life expectancy date (birth date + life expectancy years)
    let lifeExpectancyDate = '';
    if (profile?.birth_date && profile?.data?.person?.life_expectancy) {
        const birthDate = new Date(profile.birth_date);
        const lifeExpectancy = profile.data.person.life_expectancy;
        const lifeExpectancyYear = birthDate.getFullYear() + lifeExpectancy;
        lifeExpectancyDate = `${lifeExpectancyYear}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
    }

    // Determine default start and end dates based on period
    let defaultStartDate = new Date().toISOString().split('T')[0];
    let defaultEndDate = '';

    if (!isEdit) {
        if (currentPeriod === 'current') {
            // Current period: start today, end at retirement
            defaultStartDate = new Date().toISOString().split('T')[0];
            defaultEndDate = retirementDate;
        } else {
            // Future period: start at retirement, end at life expectancy
            defaultStartDate = retirementDate;
            defaultEndDate = lifeExpectancyDate;
        }
    }

    const item = isEdit ? budgetData.income[currentPeriod][category][index] : {
        name: '',
        amount: 0,
        frequency: 'monthly',
        start_date: defaultStartDate,
        end_date: defaultEndDate,
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

    modal.querySelector('#income-item-form').addEventListener('submit', async (e) => {
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

        // Auto-save to backend
        modal.remove();
        renderIncomeSection(parentContainer);
        renderBudgetSummary(parentContainer);

        const profile = store.get('currentProfile');
        if (profile) {
            await saveBudget(profile, parentContainer);
        }
    });
}

/**
 * Render Expense Section
 */
function renderExpenseSection(parentContainer) {
    const container = parentContainer.querySelector('#expense-section');
    const expenses = budgetData.expenses[currentPeriod];

    const categories = [
        { key: 'housing', label: 'Housing', icon: '🏠', description: 'Mortgage, rent, HOA fees' },
        { key: 'utilities', label: 'Utilities', icon: '💡', description: 'Electric, gas, water, internet' },
        { key: 'transportation', label: 'Transportation', icon: '🚗', description: 'Car payment, gas, maintenance' },
        { key: 'food', label: 'Food', icon: '🍽️', description: 'Groceries' },
        { key: 'dining_out', label: 'Dining Out', icon: '🍴', description: 'Restaurants, takeout, delivery' },
        { key: 'healthcare', label: 'Healthcare', icon: '🏥', description: 'Medical, dental, prescriptions' },
        { key: 'insurance', label: 'Insurance', icon: '🛡️', description: 'Health, life, home, auto' },
        { key: 'travel', label: 'Travel & Vacation', icon: '✈️', description: 'Flights, hotels, vacation expenses' },
        { key: 'entertainment', label: 'Entertainment', icon: '🎬', description: 'Movies, concerts, hobbies, activities' },
        { key: 'personal_care', label: 'Personal Care', icon: '💇', description: 'Hair, gym, spa' },
        { key: 'clothing', label: 'Clothing', icon: '👕', description: 'Clothes, shoes, accessories' },
        { key: 'gifts', label: 'Gifts & Occasions', icon: '🎁', description: 'Birthdays, holidays, weddings' },
        { key: 'childcare_education', label: 'Childcare & Education', icon: '🎓', description: 'Daycare, tuition, supplies' },
        { key: 'charitable_giving', label: 'Charitable Giving', icon: '💝', description: 'Donations, tithing' },
        { key: 'subscriptions', label: 'Subscriptions', icon: '📱', description: 'Streaming, apps, memberships' },
        { key: 'pet_care', label: 'Pet Care', icon: '🐾', description: 'Food, vet, grooming' },
        { key: 'home_maintenance', label: 'Home Maintenance', icon: '🔧', description: 'Repairs, landscaping, improvements' },
        { key: 'debt_payments', label: 'Debt Payments', icon: '💳', description: 'Credit cards, loans (non-mortgage)' },
        { key: 'taxes', label: 'Taxes', icon: '📋', description: 'Property tax, estimated tax payments' },
        { key: 'discretionary', label: 'Discretionary', icon: '🎉', description: 'Shopping, misc spending' },
        { key: 'other', label: 'Other', icon: '📌', description: 'Miscellaneous expenses' }
    ];

    // Find custom categories (in expenses but not in standard list)
    const standardKeys = categories.map(c => c.key);
    const customCategories = Object.keys(expenses)
        .filter(key => !standardKeys.includes(key) && expenses[key] && (Array.isArray(expenses[key]) ? expenses[key].length > 0 : expenses[key].amount !== undefined))
        .map(key => ({
            key,
            label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            icon: '📝',
            description: 'Custom category',
            isCustom: true
        }));

    const allCategories = [...categories, ...customCategories];

    let html = `
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--accent-color);">
                    <span style="font-size: 18px;">💳</span>
                    EXPENSE CATEGORIES
                </h2>
                <button id="add-custom-category-btn" style="padding: 4px 10px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 700;">
                    + New
                </button>
            </div>
            <div style="padding: 8px 12px; margin-bottom: 10px; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid var(--accent-color);">
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                    <strong style="color: var(--text-primary);">💡 Tip:</strong> Click on any expense item to edit its details
                </p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
    `;

    for (const cat of allCategories) {
        const catData = expenses[cat.key];

        // Convert legacy single object to array format
        let expenseItems = [];
        if (Array.isArray(catData)) {
            expenseItems = catData;
        } else if (catData && typeof catData === 'object' && catData.amount !== undefined) {
            expenseItems = [catData];
            budgetData.expenses[currentPeriod][cat.key] = expenseItems;
        }

        const categoryTotal = expenseItems.reduce((sum, item) => {
            return sum + annualAmount(item.amount || 0, item.frequency || 'monthly');
        }, 0);

        html += `
            <div style="background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color); padding: 8px; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${expenseItems.length > 0 ? '6px' : '0'};">
                    <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                        <span style="font-size: 14px;">${cat.icon}</span>
                        <span style="font-weight: 700; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.label}</span>
                        ${categoryTotal > 0 ? `<span style="color: var(--accent-color); font-weight: 700; font-size: 11px;">${formatCurrency(categoryTotal, 0)}/yr</span>` : ''}
                    </div>
                    <button class="add-expense-btn" data-category="${cat.key}" style="padding: 2px 6px; background: var(--accent-color); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; flex-shrink: 0;">
                        +
                    </button>
                </div>
        `;

        if (expenseItems.length > 0) {
            html += `<div style="display: flex; flex-direction: column; gap: 4px;">`;
            expenseItems.forEach((expense, index) => {
                const annual = annualAmount(expense.amount || 0, expense.frequency || 'monthly');

                html += `
                    <div class="expense-item-row" data-category="${cat.key}" data-index="${index}" style="padding: 4px 6px; background: var(--bg-secondary); border-radius: 3px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                        <div style="display: flex; align-items: center; gap: 4px; flex: 1; font-size: 11px; overflow: hidden;">
                            <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${expense.name || cat.label}</span>
                            <span style="color: var(--text-secondary); white-space: nowrap;">${formatCurrency(expense.amount || 0, 0)}/${expense.frequency[0].toLowerCase()}</span>
                        </div>
                        <div style="display: flex; gap: 2px; flex-shrink: 0;">
                            <button class="delete-expense-item-btn" data-category="${cat.key}" data-index="${index}" style="padding: 0 4px; background: transparent; border: none; cursor: pointer; font-size: 10px; color: var(--danger-color);" title="Delete">✕</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;
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
 * Make expense item editable inline
 */
function makeExpenseItemEditable(rowElement, category, index, expense, parentContainer) {
    const categoryLabels = {
        housing: 'Housing',
        utilities: 'Utilities',
        transportation: 'Transportation',
        food: 'Food',
        dining_out: 'Dining Out',
        healthcare: 'Healthcare',
        insurance: 'Insurance',
        travel: 'Travel & Vacation',
        entertainment: 'Entertainment',
        personal_care: 'Personal Care',
        clothing: 'Clothing',
        gifts: 'Gifts & Occasions',
        childcare_education: 'Childcare & Education',
        charitable_giving: 'Charitable Giving',
        subscriptions: 'Subscriptions',
        pet_care: 'Pet Care',
        home_maintenance: 'Home Maintenance',
        debt_payments: 'Debt Payments',
        taxes: 'Taxes',
        discretionary: 'Discretionary',
        other: 'Other'
    };

    // Get category label (use predefined or convert from key)
    const categoryLabel = categoryLabels[category] || category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const originalHTML = rowElement.innerHTML;

    // Get profile data for calculating default dates
    const profile = store.get('currentProfile');
    const retirementDate = profile?.retirement_date || '';

    // Calculate life expectancy date (birth date + life expectancy years)
    let lifeExpectancyDate = '';
    if (profile?.birth_date && profile?.data?.person?.life_expectancy) {
        const birthDate = new Date(profile.birth_date);
        const lifeExpectancy = profile.data.person.life_expectancy;
        const lifeExpectancyYear = birthDate.getFullYear() + lifeExpectancy;
        lifeExpectancyDate = `${lifeExpectancyYear}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
    }

    // Determine default start and end dates based on period and ongoing status
    let defaultStartDate = expense.start_date || '';
    let defaultEndDate = expense.end_date || '';

    if (expense.ongoing === false) {
        if (currentPeriod === 'current') {
            // Current period: start blank (assumes today), end at retirement
            if (!expense.start_date) defaultStartDate = '';
            if (!expense.end_date && retirementDate) defaultEndDate = retirementDate;
        } else {
            // Future period: start at retirement, end at life expectancy
            if (!expense.start_date && retirementDate) defaultStartDate = retirementDate;
            if (!expense.end_date && lifeExpectancyDate) defaultEndDate = lifeExpectancyDate;
        }
    }

    rowElement.innerHTML = `
        <div style="padding: 10px 12px; background: var(--bg-tertiary); border-radius: 6px; border: 2px solid var(--accent-color);">
            <div style="margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--accent-color);">
                ${categoryLabel}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px 10px; margin-bottom: 10px;">
                <div style="grid-column: 1 / -1;">
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Description / Name
                    </label>
                    <input type="text" name="name" value="${expense.name || ''}" placeholder="${categoryLabel}"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Amount
                    </label>
                    <input type="number" name="amount" value="${expense.amount || 0}" min="0" step="0.01"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Frequency
                    </label>
                    <select name="frequency" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                        <option value="monthly" ${expense.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="quarterly" ${expense.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="annual" ${expense.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Start Date
                    </label>
                    <input type="date" name="start_date" value="${defaultStartDate}" ${expense.ongoing !== false ? 'disabled' : ''}
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        End Date
                    </label>
                    <input type="date" name="end_date" value="${defaultEndDate}" ${expense.ongoing !== false ? 'disabled' : ''}
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div style="grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px;">
                        <input type="checkbox" name="inflation_adjusted" ${expense.inflation_adjusted ? 'checked' : ''}>
                        <span>Adjust for inflation</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; font-weight: 600;">
                        <input type="checkbox" name="ongoing" ${expense.ongoing !== false ? 'checked' : ''}>
                        <span>⏳ Ongoing</span>
                    </label>
                </div>
            </div>
            <div style="display: flex; gap: 6px; justify-content: flex-end; padding-top: 6px; border-top: 1px solid var(--border-color);">
                <button class="cancel-inline-edit" style="padding: 5px 12px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                    Cancel
                </button>
                <button class="save-inline-edit" style="padding: 5px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                    💾 Save
                </button>
            </div>
        </div>
    `;

    // Handle ongoing checkbox toggle
    const ongoingCheckbox = rowElement.querySelector('[name="ongoing"]');
    const startDateInput = rowElement.querySelector('[name="start_date"]');
    const endDateInput = rowElement.querySelector('[name="end_date"]');

    ongoingCheckbox.addEventListener('change', () => {
        const isOngoing = ongoingCheckbox.checked;
        startDateInput.disabled = isOngoing;
        endDateInput.disabled = isOngoing;
        if (isOngoing) {
            startDateInput.value = '';
            endDateInput.value = '';
        } else {
            // Apply period-specific defaults when unchecking ongoing
            if (currentPeriod === 'current') {
                // Current period: start blank (today), end at retirement
                if (!startDateInput.value) startDateInput.value = '';
                if (!endDateInput.value && retirementDate) endDateInput.value = retirementDate;
            } else {
                // Future period: start at retirement, end at life expectancy
                if (!startDateInput.value && retirementDate) startDateInput.value = retirementDate;
                if (!endDateInput.value && lifeExpectancyDate) endDateInput.value = lifeExpectancyDate;
            }
        }
    });

    // Handle save
    const saveBtn = rowElement.querySelector('.save-inline-edit');
    saveBtn.addEventListener('click', async () => {
        const ongoing = rowElement.querySelector('[name="ongoing"]').checked;
        const startDate = rowElement.querySelector('[name="start_date"]').value || null;
        const endDate = rowElement.querySelector('[name="end_date"]').value || null;

        const updatedExpense = {
            name: rowElement.querySelector('[name="name"]').value,
            amount: parseFloat(rowElement.querySelector('[name="amount"]').value) || 0,
            frequency: rowElement.querySelector('[name="frequency"]').value,
            inflation_adjusted: rowElement.querySelector('[name="inflation_adjusted"]').checked,
            ongoing: ongoing,
            start_date: ongoing ? null : startDate,
            end_date: ongoing ? null : endDate
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            // Ensure array structure
            if (!Array.isArray(budgetData.expenses[currentPeriod][category])) {
                budgetData.expenses[currentPeriod][category] = [];
            }

            // Update the item at the specified index
            budgetData.expenses[currentPeriod][category][index] = updatedExpense;

            rowElement.classList.remove('editing');
            renderExpenseSection(parentContainer);
            renderBudgetSummary(parentContainer);

            const profile = store.get('currentProfile');
            if (profile) {
                await saveBudget(profile, parentContainer);
            }
        } catch (error) {
            alert('Failed to save: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save';
        }
    });

    // Handle cancel
    const cancelBtn = rowElement.querySelector('.cancel-inline-edit');
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rowElement.innerHTML = originalHTML;
        rowElement.classList.remove('editing');
    });

    // Click outside to cancel (but not on inputs or buttons)
    const editContainer = rowElement.querySelector('div');

    // Stop propagation on interactive elements to prevent closing
    const interactiveElements = editContainer.querySelectorAll('input, select, textarea, button, label');
    interactiveElements.forEach(elem => {
        elem.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Click on the container background (not interactive elements) to cancel
    editContainer.addEventListener('click', (e) => {
        // Only close if clicking directly on the container background
        if (e.target === editContainer) {
            rowElement.innerHTML = originalHTML;
            rowElement.classList.remove('editing');
        }
    });

    // Focus first input
    setTimeout(() => {
        const firstInput = rowElement.querySelector('input[name="name"]');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    }, 100);
}

/**
 * Setup expense event listeners
 */
function setupExpenseEventListeners(container) {
    // Add custom category button handler
    const addCustomCategoryBtn = container.querySelector('#add-custom-category-btn');
    if (addCustomCategoryBtn) {
        addCustomCategoryBtn.addEventListener('click', () => {
            addCustomExpenseCategory(container);
        });
    }

    // Add expense button handlers
    container.querySelectorAll('.add-expense-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = btn.getAttribute('data-category');
            addExpenseItem(container, category);
        });
    });

    // Edit expense item button handlers
    container.querySelectorAll('.edit-expense-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = btn.getAttribute('data-category');
            const index = parseInt(btn.getAttribute('data-index'));
            editExpenseItem(container, category, index);
        });
    });

    // Delete expense item button handlers
    container.querySelectorAll('.delete-expense-item-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const category = btn.getAttribute('data-category');
            const index = parseInt(btn.getAttribute('data-index'));

            if (confirm('Delete this expense item?')) {
                // Ensure array structure
                if (!Array.isArray(budgetData.expenses[currentPeriod][category])) {
                    budgetData.expenses[currentPeriod][category] = [];
                }

                budgetData.expenses[currentPeriod][category].splice(index, 1);
                renderExpenseSection(container);
                renderBudgetSummary(container);

                const profile = store.get('currentProfile');
                if (profile) {
                    await saveBudget(profile, container);
                }
            }
        });
    });

    // Click on expense item row to edit
    container.querySelectorAll('.expense-item-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button')) return;

            const category = row.getAttribute('data-category');
            const index = parseInt(row.getAttribute('data-index'));
            editExpenseItem(container, category, index);
        });
    });
}

/**
 * Add a new custom expense category
 */
function addCustomExpenseCategory(parentContainer) {
    const categoryName = prompt('Enter custom category name (e.g., "Boat Expenses", "RV Maintenance"):');
    if (!categoryName || !categoryName.trim()) return;

    // Convert to snake_case key
    const categoryKey = categoryName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check if category already exists
    if (budgetData.expenses[currentPeriod][categoryKey]) {
        alert('A category with this name already exists.');
        return;
    }

    // Create empty array for the new category
    budgetData.expenses[currentPeriod][categoryKey] = [];

    // Re-render to show the new category
    renderExpenseSection(parentContainer);

    // Automatically add the first item
    setTimeout(() => {
        addExpenseItem(parentContainer, categoryKey);
    }, 100);
}

/**
 * Add new expense item to category
 */
function addExpenseItem(parentContainer, category) {
    // Get profile data for calculating default dates
    const profile = store.get('currentProfile');
    const retirementDate = profile?.retirement_date || '';

    // Calculate life expectancy date
    let lifeExpectancyDate = '';
    if (profile?.birth_date && profile?.data?.person?.life_expectancy) {
        const birthDate = new Date(profile.birth_date);
        const lifeExpectancy = profile.data.person.life_expectancy;
        const lifeExpectancyYear = birthDate.getFullYear() + lifeExpectancy;
        lifeExpectancyDate = `${lifeExpectancyYear}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${String(birthDate.getDate()).padStart(2, '0')}`;
    }

    // Determine default dates based on period
    let defaultStartDate = '';
    let defaultEndDate = '';
    if (currentPeriod === 'current') {
        defaultEndDate = retirementDate;
    } else {
        defaultStartDate = retirementDate;
        defaultEndDate = lifeExpectancyDate;
    }

    const newItem = {
        name: '',
        amount: 0,
        frequency: 'monthly',
        inflation_adjusted: true,
        ongoing: false,
        start_date: defaultStartDate,
        end_date: defaultEndDate
    };

    // Ensure array structure
    if (!Array.isArray(budgetData.expenses[currentPeriod][category])) {
        const existing = budgetData.expenses[currentPeriod][category];
        if (existing && typeof existing === 'object' && existing.amount !== undefined) {
            // Convert legacy single object to array
            budgetData.expenses[currentPeriod][category] = [existing];
        } else {
            budgetData.expenses[currentPeriod][category] = [];
        }
    }

    budgetData.expenses[currentPeriod][category].push(newItem);
    renderExpenseSection(parentContainer);

    // Automatically start editing the new item
    const newIndex = budgetData.expenses[currentPeriod][category].length - 1;
    setTimeout(() => {
        editExpenseItem(parentContainer, category, newIndex);
    }, 100);
}

/**
 * Edit expense item inline
 */
function editExpenseItem(parentContainer, category, index) {
    const expenseItems = budgetData.expenses[currentPeriod][category];
    if (!Array.isArray(expenseItems) || !expenseItems[index]) return;

    const expense = expenseItems[index];
    const row = parentContainer.querySelector(`.expense-item-row[data-category="${category}"][data-index="${index}"]`);
    if (!row) return;

    // If already editing, close the editor
    if (row.classList.contains('editing')) {
        const cancelBtn = row.querySelector('.cancel-inline-edit');
        if (cancelBtn) cancelBtn.click();
        row.classList.remove('editing');
        return;
    }

    row.classList.add('editing');
    makeExpenseItemEditable(row, category, index, expense, parentContainer);
}

/**
 * Show expense editor modal
 */
function showExpenseEditorModal(parentContainer, category) {
    const categoryLabels = {
        housing: 'Housing',
        utilities: 'Utilities',
        transportation: 'Transportation',
        food: 'Food',
        dining_out: 'Dining Out',
        healthcare: 'Healthcare',
        insurance: 'Insurance',
        travel: 'Travel & Vacation',
        entertainment: 'Entertainment',
        personal_care: 'Personal Care',
        clothing: 'Clothing',
        gifts: 'Gifts & Occasions',
        childcare_education: 'Childcare & Education',
        charitable_giving: 'Charitable Giving',
        subscriptions: 'Subscriptions',
        pet_care: 'Pet Care',
        home_maintenance: 'Home Maintenance',
        debt_payments: 'Debt Payments',
        taxes: 'Taxes',
        discretionary: 'Discretionary',
        other: 'Other'
    };

    const expense = budgetData.expenses[currentPeriod][category] || {
        amount: 0,
        frequency: 'monthly',
        inflation_adjusted: true,
        start_date: null,
        end_date: null,
        ongoing: true
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
        <div style="background: var(--bg-secondary); padding: var(--space-5); border-radius: 8px; max-width: 500px; width: 90%;">
            <h2 style="margin: 0 0 var(--space-4) 0; font-size: var(--font-lg);">Edit ${categoryLabels[category]}</h2>
            <form id="expense-form">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
                    <div>
                        <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-sm);">Amount</label>
                        <input type="number" id="expense-amount" value="${expense.amount}" min="0" step="0.01" required
                               style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-sm);">Frequency</label>
                        <select id="expense-frequency" style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                            <option value="monthly" ${expense.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${expense.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="annual" ${expense.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: var(--space-3);">
                    <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: var(--font-sm);">
                        <input type="checkbox" id="expense-inflation" ${expense.inflation_adjusted ? 'checked' : ''}>
                        <span>Adjust for inflation</span>
                    </label>
                </div>
                <div style="margin-bottom: var(--space-3); padding: var(--space-3); background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color);">
                    <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: var(--font-sm); font-weight: 600; margin-bottom: var(--space-2);">
                        <input type="checkbox" id="expense-ongoing" ${expense.ongoing !== false ? 'checked' : ''}>
                        <span>⏳ Ongoing expense (no end date)</span>
                    </label>
                    <div id="date-fields" style="display: ${expense.ongoing !== false ? 'none' : 'grid'}; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-2);">
                        <div>
                            <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-sm); color: var(--text-secondary);">Start Date</label>
                            <input type="date" id="expense-start-date" value="${expense.start_date || ''}"
                                   style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: var(--space-1); font-weight: 500; font-size: var(--font-sm); color: var(--text-secondary);">End Date</label>
                            <input type="date" id="expense-end-date" value="${expense.end_date || ''}"
                                   style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-sm);">
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
                    <button type="button" id="cancel-btn" style="padding: var(--space-2) var(--space-4); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: var(--font-sm);">
                        Cancel
                    </button>
                    <button type="submit" style="padding: var(--space-2) var(--space-4); background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--font-sm);">
                        Update
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus the amount field and select its content
    const amountInput = modal.querySelector('#expense-amount');
    setTimeout(() => {
        amountInput.focus();
        amountInput.select();
    }, 100);

    // Toggle date fields based on ongoing checkbox
    const ongoingCheckbox = modal.querySelector('#expense-ongoing');
    const dateFields = modal.querySelector('#date-fields');
    ongoingCheckbox.addEventListener('change', () => {
        dateFields.style.display = ongoingCheckbox.checked ? 'none' : 'grid';
    });

    // Event handlers
    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const ongoing = modal.querySelector('#expense-ongoing').checked;
        const startDate = modal.querySelector('#expense-start-date').value || null;
        const endDate = modal.querySelector('#expense-end-date').value || null;

        budgetData.expenses[currentPeriod][category] = {
            amount: parseFloat(modal.querySelector('#expense-amount').value),
            frequency: modal.querySelector('#expense-frequency').value,
            inflation_adjusted: modal.querySelector('#expense-inflation').checked,
            ongoing: ongoing,
            start_date: ongoing ? null : startDate,
            end_date: ongoing ? null : endDate,
            subcategories: expense.subcategories || {}
        };

        // Auto-save to backend
        modal.remove();
        renderExpenseSection(parentContainer);
        renderBudgetSummary(parentContainer);

        const profile = store.get('currentProfile');
        if (profile) {
            await saveBudget(profile, parentContainer);
        }
    });
}

/**
 * Setup expense event handlers
 */
function setupBudgetEventHandlers(profile, container) {
    // AI Import button
    const aiImportBtn = container.querySelector('#ai-import-expenses-btn');
    if (aiImportBtn) {
        aiImportBtn.addEventListener('click', () => {
            showAIImportModal('expenses', profile.name, async (extractedExpenses) => {
                let added = 0, updated = 0;

                // Map extracted expenses with reconciliation
                for (const item of extractedExpenses) {
                    const category = item.category || 'other';
                    if (!budgetData.expenses[currentPeriod][category]) {
                        budgetData.expenses[currentPeriod][category] = [];
                    }

                    // Find existing expense by name in same category (case-insensitive)
                    const existingIndex = budgetData.expenses[currentPeriod][category].findIndex(
                        e => e.name?.toLowerCase() === item.name?.toLowerCase()
                    );

                    if (existingIndex >= 0) {
                        // Update existing expense - preserve settings, update amount
                        const existing = budgetData.expenses[currentPeriod][category][existingIndex];
                        budgetData.expenses[currentPeriod][category][existingIndex] = {
                            ...existing,
                            amount: item.amount ?? existing.amount,
                            frequency: item.frequency || existing.frequency
                        };
                        updated++;
                    } else {
                        // Add new expense
                        budgetData.expenses[currentPeriod][category].push({
                            name: item.name,
                            amount: item.amount || 0,
                            frequency: item.frequency || 'monthly',
                            inflation_adjusted: true,
                            ongoing: true,
                            start_date: null,
                            end_date: null
                        });
                        added++;
                    }
                }

                renderExpenseSection(container);
                renderBudgetSummary(container);
                await saveBudget(profile, container);

                // Show summary
                const parts = [];
                if (added > 0) parts.push(`${added} added`);
                if (updated > 0) parts.push(`${updated} updated`);
                if (parts.length > 0) {
                    showSuccess(`Expenses imported: ${parts.join(', ')}`);
                }
            });
        });
    }

    // Export button
    const exportBtn = container.querySelector('#export-expenses-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportExpensesCSV(profile));
    }

    // Actions dropdown menu
    const actionsBtn = container.querySelector('#expense-actions-btn');
    const actionsMenu = container.querySelector('#expense-actions-menu');
    if (actionsBtn && actionsMenu) {
        // Toggle menu
        actionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            actionsMenu.style.display = actionsMenu.style.display === 'none' ? 'block' : 'none';
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            actionsMenu.style.display = 'none';
        });

        // Menu item hover effects
        actionsMenu.querySelectorAll('.action-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--bg-tertiary)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'none';
            });
        });

        // Handle menu actions
        actionsMenu.querySelectorAll('.action-menu-item').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                actionsMenu.style.display = 'none';

                switch (action) {
                    case 'import-csv':
                        showImportExpensesCSVModal(profile, container);
                        break;
                    case 'copy-to-post':
                        showCopyExpensesModal(profile, container, 'current', 'future');
                        break;
                    case 'copy-to-pre':
                        showCopyExpensesModal(profile, container, 'future', 'current');
                        break;
                    case 'clear-current':
                        showClearExpensesModal(profile, container, currentPeriod);
                        break;
                    case 'clear-all':
                        showClearExpensesModal(profile, container, 'all');
                        break;
                }
            });
        });
    }

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

            // Re-render sections
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
 * Show modal for copying expenses between periods
 */
function showCopyExpensesModal(profile, container, fromPeriod = 'current', toPeriod = 'future') {
    const periodLabels = { current: 'Pre-Retirement', future: 'Post-Retirement' };
    const fromLabel = periodLabels[fromPeriod];
    const toLabel = periodLabels[toPeriod];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px; width: 90%;">
            <h2 style="margin-top: 0;">📋 Copy Expenses</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                Copy all expenses from <strong>${fromLabel}</strong> to <strong>${toLabel}</strong>.
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
                <label style="display: flex; align-items: flex-start; gap: 12px; padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; background: var(--bg-primary);">
                    <input type="radio" name="copy-mode" value="merge" checked style="margin-top: 4px;">
                    <div>
                        <div style="font-weight: 600;">Merge with Existing</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Keep current ${toLabel.toLowerCase()} expenses and add missing ones.</div>
                    </div>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 12px; padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; background: var(--bg-primary);">
                    <input type="radio" name="copy-mode" value="replace" style="margin-top: 4px;">
                    <div>
                        <div style="font-weight: 600; color: var(--danger-color);">Replace Everything</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Delete all ${toLabel.toLowerCase()} expenses and start fresh.</div>
                    </div>
                </label>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-copy-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="confirm-copy-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Copy Now</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#cancel-copy-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#confirm-copy-btn').addEventListener('click', async () => {
        const mode = modal.querySelector('input[name="copy-mode"]:checked').value;

        try {
            // Perform copy locally
            const sourceExpenses = budgetData.expenses[fromPeriod] || {};

            if (mode === 'replace') {
                // Deep clone source to target
                budgetData.expenses[toPeriod] = JSON.parse(JSON.stringify(sourceExpenses));
            } else {
                // Merge: add missing items
                Object.keys(sourceExpenses).forEach(category => {
                    if (!budgetData.expenses[toPeriod][category]) {
                        budgetData.expenses[toPeriod][category] = [];
                    }
                    const targetItems = budgetData.expenses[toPeriod][category];
                    (sourceExpenses[category] || []).forEach(srcItem => {
                        const exists = targetItems.some(t => t.name?.toLowerCase() === srcItem.name?.toLowerCase());
                        if (!exists) {
                            targetItems.push(JSON.parse(JSON.stringify(srcItem)));
                        }
                    });
                });
            }

            modal.remove();
            renderExpenseSection(container);
            renderBudgetSummary(container);
            await saveBudget(profile, container);
            showSuccess(`Copied expenses from ${fromLabel} to ${toLabel} (${mode})`);

        } catch (error) {
            console.error('Copy expenses error:', error);
            showError('Failed to copy expenses: ' + error.message);
        }
    });
}

/**
 * Show modal for clearing expenses
 */
function showClearExpensesModal(profile, container, period) {
    const periodLabels = { current: 'Pre-Retirement', future: 'Post-Retirement', all: 'All' };
    const label = periodLabels[period] || period;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2000';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; width: 90%;">
            <h2 style="margin-top: 0; color: var(--danger-color);">🗑️ Clear Expenses</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                ${period === 'all'
                    ? 'This will delete <strong>ALL</strong> expenses from both Pre-Retirement and Post-Retirement periods.'
                    : `This will delete all expenses from <strong>${label}</strong>.`}
            </p>
            <p style="color: var(--danger-color); font-weight: 600; margin-bottom: 20px;">
                This action cannot be undone!
            </p>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-clear-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="confirm-clear-btn" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Clear ${label}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#cancel-clear-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#confirm-clear-btn').addEventListener('click', async () => {
        try {
            if (period === 'all') {
                budgetData.expenses.current = {};
                budgetData.expenses.future = {};
            } else {
                budgetData.expenses[period] = {};
            }

            modal.remove();
            renderExpenseSection(container);
            renderBudgetSummary(container);
            await saveBudget(profile, container);
            showSuccess(`Cleared ${label.toLowerCase()} expenses`);

        } catch (error) {
            console.error('Clear expenses error:', error);
            showError('Failed to clear expenses: ' + error.message);
        }
    });
}

/**
 * Export expenses to CSV
 */
function exportExpensesCSV(profile) {
    const rows = [['Period', 'Category', 'Name', 'Amount', 'Frequency', 'Inflation Adjusted', 'Ongoing']];

    const periodLabels = { current: 'Pre-Retirement', future: 'Post-Retirement' };
    const categoryLabels = {
        housing: 'Housing', utilities: 'Utilities', transportation: 'Transportation',
        food: 'Food & Groceries', dining_out: 'Dining Out', healthcare: 'Healthcare',
        insurance: 'Insurance', travel: 'Travel & Vacation', entertainment: 'Entertainment',
        personal_care: 'Personal Care', clothing: 'Clothing', gifts: 'Gifts & Donations',
        childcare_education: 'Childcare & Education', charitable_giving: 'Charitable Giving',
        subscriptions: 'Subscriptions', pet_care: 'Pet Care', home_maintenance: 'Home Maintenance',
        debt_payments: 'Debt Payments', taxes: 'Taxes', discretionary: 'Discretionary', other: 'Other'
    };

    ['current', 'future'].forEach(period => {
        const expenses = budgetData.expenses[period] || {};
        Object.keys(expenses).forEach(category => {
            (expenses[category] || []).forEach(item => {
                rows.push([
                    periodLabels[period],
                    categoryLabels[category] || category,
                    item.name || '',
                    item.amount || 0,
                    item.frequency || 'monthly',
                    item.inflation_adjusted ? 'Yes' : 'No',
                    item.ongoing ? 'Yes' : 'No'
                ]);
            });
        });
    });

    // Generate CSV content
    const csvContent = rows.map(row =>
        row.map(cell => {
            const str = String(cell);
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
    ).join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${profile.name}_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showSuccess('Expenses exported to CSV');
}

/**
 * Import expenses from CSV
 */
function showImportExpensesCSVModal(profile, container) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
                <h3 style="margin: 0 0 16px 0;">📥 Import Expenses from CSV</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 14px;">
                    CSV should have columns: Name, Amount, Category, Frequency<br>
                    Categories: housing, transportation, food, healthcare, utilities, insurance, personal, entertainment, other
                </p>
                <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
                <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 30px; text-align: center; cursor: pointer; margin-bottom: 16px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">📄</div>
                    <div>Click or drop CSV file here</div>
                </div>
                <div id="file-info" style="display: none; margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 6px;"></div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Import to:</label>
                    <select id="import-period" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary);">
                        <option value="current">Pre-Retirement</option>
                        <option value="future">Post-Retirement</option>
                        <option value="both">Both Periods</option>
                    </select>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="import-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: none;">
                        Import
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#csv-file-input');
    const dropZone = modal.querySelector('#drop-zone');
    const fileInfo = modal.querySelector('#file-info');
    const importBtn = modal.querySelector('#import-btn');
    const periodSelect = modal.querySelector('#import-period');
    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-color)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    function handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            showError('Please select a CSV file');
            return;
        }
        selectedFile = file;
        fileInfo.style.display = 'block';
        fileInfo.textContent = `Selected: ${file.name}`;
        importBtn.style.display = 'block';
    }

    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());

    importBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Validate file first
        const validation = validateCSVFile(selectedFile);
        if (!validation.valid) {
            showError(validation.errors.join(', '));
            return;
        }

        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';

        try {
            const text = await selectedFile.text();
            const result = parseCSV(text, EXPENSE_CONFIG);

            // Check for parsing errors
            if (result.errors.length > 0) {
                throw new Error(result.errors.join(', '));
            }

            // Show warnings if any
            if (result.warnings.length > 0) {
                console.warn('CSV Import warnings:', result.warnings);
            }

            const targetPeriod = periodSelect.value;
            let added = 0;

            // Add parsed items to appropriate period(s)
            result.items.forEach(expense => {
                const category = expense.category;

                if (targetPeriod === 'current' || targetPeriod === 'both') {
                    if (!budgetData.expenses.current[category]) budgetData.expenses.current[category] = [];
                    budgetData.expenses.current[category].push(expense);
                    added++;
                }
                if (targetPeriod === 'future' || targetPeriod === 'both') {
                    if (!budgetData.expenses.future[category]) budgetData.expenses.future[category] = [];
                    budgetData.expenses.future[category].push({ ...expense });
                    if (targetPeriod !== 'both') added++;
                }
            });

            await saveBudget(profile, container);
            renderExpenseSection(container);
            renderBudgetSummary(container);
            showSuccess(`Imported ${added} expenses`);
            modal.remove();
        } catch (error) {
            showError('Import failed: ' + error.message);
            importBtn.disabled = false;
            importBtn.textContent = 'Import';
        }
    });
}

/**
 * Save budget
 */
async function saveBudget(profile, container) {
    const saveBtn = container.querySelector('#save-budget-btn');
    const originalText = saveBtn ? saveBtn.textContent : null;

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        // Import profiles API
        const { profilesAPI } = await import('../../api/profiles.js');

        // Update profile data
        const updatedData = {
            ...profile.data,
            budget: budgetData
        };

        console.log('Saving budget data:', JSON.parse(JSON.stringify(budgetData)));
        console.log('Profile name for save:', profile?.name, 'Profile object:', profile);

        if (!profile?.name) {
            throw new Error('Profile name is missing - cannot save');
        }

        // Save to backend
        const result = await profilesAPI.update(profile.name, { data: updatedData });

        console.log('Received from server:', result.profile.data.budget);
        console.log('Future part_time_consulting after save:', result.profile.data.budget.income.future.part_time_consulting);

        // Update store
        store.setState({ currentProfile: result.profile });

        // Show success message
        showSuccess('Expenses saved successfully!');

        // Update the budget data reference
        budgetData = result.profile.data.budget;

        // Refresh the budget summary totals
        renderBudgetSummary(container);

    } catch (error) {
        console.error('Error saving budget:', error);
        showError('Failed to save expenses: ' + error.message);
        throw error; // Re-throw so callers know it failed
    } finally {
        if (saveBtn && originalText) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}
