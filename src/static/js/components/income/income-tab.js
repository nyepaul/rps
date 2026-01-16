/**
 * Income Tab Component
 * Models current and future income streams with start/stop dates
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';
import { showError, showSuccess } from '../../utils/dom.js';

export function renderIncomeTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">💰</div>
                <h2 style="margin-bottom: 10px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Please create or select a profile to manage income streams.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const financial = data.financial || {};
    const spouse = data.spouse || {};
    const hasSpouse = spouse.name ? true : false;
    const primaryName = profile.name || 'Primary';
    const spouseName = spouse.name || 'Spouse';
    const incomeStreams = data.income_streams || [];

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="margin-bottom: 20px;">
                <h1 style="font-size: 28px; margin-bottom: 8px;">💰 Income Planning</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                    Model your current income, retirement benefits, and future income streams
                </p>
            </div>

            <!-- Financial Summary Section -->
            <div id="financial-summary" style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid var(--accent-color); padding-bottom: 8px;">
                    📊 Financial Summary
                </h2>
                <form id="financial-form">
                    <!-- Household Income/Expenses -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label for="annual_income" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 14px;">Annual Household Income</label>
                            <input type="text" id="annual_income" name="annual_income" value="${financial.annual_income ? formatCurrency(financial.annual_income, 0) : ''}" placeholder="$0" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                            <small style="color: var(--text-secondary); font-size: 12px;">Current annual gross income</small>
                        </div>
                        <div class="form-group">
                            <label for="annual_expenses" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 14px;">Annual Household Expenses</label>
                            <input type="text" id="annual_expenses" name="annual_expenses" value="${financial.annual_expenses ? formatCurrency(financial.annual_expenses, 0) : ''}" placeholder="$0" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                            <small style="color: var(--text-secondary); font-size: 12px;">Current annual spending</small>
                        </div>
                    </div>

                    <!-- Retirement Benefits by Person -->
                    <h3 style="font-size: 16px; margin-bottom: 15px; color: var(--text-secondary);">Retirement Benefits</h3>
                    <div style="display: grid; grid-template-columns: ${hasSpouse ? '1fr 1fr' : '1fr'}; gap: 20px;">
                        <!-- Primary Person Benefits -->
                        <div style="background: var(--bg-primary); padding: 18px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <h4 style="font-size: 14px; margin-bottom: 12px; font-weight: 600;">${primaryName}'s Benefits</h4>
                            <div style="display: grid; gap: 15px;">
                                <div class="form-group">
                                    <label for="social_security_benefit" style="font-weight: 500; margin-bottom: 5px; display: block; font-size: 13px;">Social Security (monthly)</label>
                                    <input type="text" id="social_security_benefit" name="social_security_benefit" value="${financial.social_security_benefit ? formatCurrency(financial.social_security_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Estimated monthly benefit at FRA</small>
                                </div>
                                <div class="form-group">
                                    <label for="pension_benefit" style="font-weight: 500; margin-bottom: 5px; display: block; font-size: 13px;">Pension (monthly)</label>
                                    <input type="text" id="pension_benefit" name="pension_benefit" value="${financial.pension_benefit ? formatCurrency(financial.pension_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Monthly pension amount</small>
                                </div>
                            </div>
                        </div>

                        ${hasSpouse ? `
                        <!-- Spouse Benefits -->
                        <div style="background: var(--bg-primary); padding: 18px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <h4 style="font-size: 14px; margin-bottom: 12px; font-weight: 600;">${spouseName}'s Benefits</h4>
                            <div style="display: grid; gap: 15px;">
                                <div class="form-group">
                                    <label for="spouse_social_security" style="font-weight: 500; margin-bottom: 5px; display: block; font-size: 13px;">Social Security (monthly)</label>
                                    <input type="text" id="spouse_social_security" name="spouse_social_security" value="${spouse.social_security_benefit ? formatCurrency(spouse.social_security_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Estimated monthly benefit at FRA</small>
                                </div>
                                <div class="form-group">
                                    <label for="spouse_pension" style="font-weight: 500; margin-bottom: 5px; display: block; font-size: 13px;">Pension (monthly)</label>
                                    <input type="text" id="spouse_pension" name="spouse_pension" value="${spouse.pension_benefit ? formatCurrency(spouse.pension_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Monthly pension amount</small>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div style="margin-top: 20px; text-align: right;">
                        <button type="submit" id="save-financial-btn" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                            Save Financial Info
                        </button>
                    </div>
                </form>
            </div>

            <!-- Income Streams Section -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="font-size: 20px; margin: 0; border-bottom: 2px solid var(--accent-color); padding-bottom: 8px;">
                        💵 Income Streams
                    </h2>
                    <button id="add-income-stream-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        + Add Income Stream
                    </button>
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 13px;">
                    Model employment, consulting, rental income, and other income sources with specific start and end dates
                </p>
                <div id="income-streams-list"></div>
            </div>

            <!-- Investment Income Section -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px;">
                <h2 style="font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid var(--accent-color); padding-bottom: 8px;">
                    📈 Investment Income
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 13px;">
                    Investment income is calculated based on your assets and configured in the Budget tab
                </p>
                <div id="investment-income-summary" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        Configure investment income settings in the <strong>Budget</strong> tab to see projections here.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Setup event handlers
    setupFinancialFormHandlers(container, profile);
    setupIncomeStreamsHandlers(container, profile, incomeStreams);
}

/**
 * Setup financial form handlers
 */
function setupFinancialFormHandlers(container, profile) {
    const financialForm = container.querySelector('#financial-form');
    if (!financialForm) return;

    // Add currency formatting on blur
    const currencyFields = ['annual_income', 'annual_expenses', 'social_security_benefit',
                           'pension_benefit', 'spouse_social_security', 'spouse_pension'];
    currencyFields.forEach(fieldName => {
        const field = container.querySelector(`#${fieldName}`);
        if (field) {
            field.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                if (value > 0) {
                    e.target.value = formatCurrency(value, 0);
                }
            });
        }
    });

    financialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = container.querySelector('#save-financial-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const formData = new FormData(financialForm);
            const financial = {};

            // Primary person financial fields
            const primaryFields = ['annual_income', 'annual_expenses', 'social_security_benefit', 'pension_benefit'];
            primaryFields.forEach(field => {
                const value = formData.get(field);
                if (value) {
                    financial[field] = parseCurrency(value);
                }
            });

            // Spouse financial fields
            const spouseUpdates = {};
            const spouseSS = formData.get('spouse_social_security');
            if (spouseSS) {
                spouseUpdates.social_security_benefit = parseCurrency(spouseSS);
            }
            const spousePension = formData.get('spouse_pension');
            if (spousePension) {
                spouseUpdates.pension_benefit = parseCurrency(spousePension);
            }

            const updatedData = {
                ...profile.data,
                financial: {
                    ...(profile.data?.financial || {}),
                    ...financial
                },
                spouse: {
                    ...(profile.data?.spouse || {}),
                    ...spouseUpdates
                }
            };

            const result = await profilesAPI.update(profile.name, { data: updatedData });
            store.setState({ currentProfile: result.profile });
            showSuccess('Financial information saved!');

            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Financial Info';
        } catch (error) {
            console.error('Error saving financial info:', error);
            showError('Failed to save: ' + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Financial Info';
        }
    });
}

/**
 * Setup income streams handlers
 */
function setupIncomeStreamsHandlers(container, profile, incomeStreams) {
    renderIncomeStreamsList(container, incomeStreams);

    // Add income stream button
    const addBtn = container.querySelector('#add-income-stream-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showIncomeStreamModal(container, profile, null, incomeStreams);
        });
    }
}

/**
 * Render income streams list
 */
function renderIncomeStreamsList(container, incomeStreams) {
    const listContainer = container.querySelector('#income-streams-list');
    if (!listContainer) return;

    if (incomeStreams.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; background: var(--bg-primary); border-radius: 8px; border: 1px dashed var(--border-color);">
                <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">💼</div>
                <h3 style="margin-bottom: 8px; color: var(--text-primary);">No Income Streams</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    Click "Add Income Stream" to model employment, consulting, rental income, and more
                </p>
            </div>
        `;
        return;
    }

    // Sort by start date
    const sortedStreams = [...incomeStreams].sort((a, b) => {
        const aDate = a.start_date || '9999-12-31';
        const bDate = b.start_date || '9999-12-31';
        return aDate.localeCompare(bDate);
    });

    listContainer.innerHTML = `
        <div style="display: grid; gap: 12px;">
            ${sortedStreams.map((stream, index) => renderIncomeStreamCard(stream, index)).join('')}
        </div>
    `;

    // Setup edit/delete handlers
    listContainer.querySelectorAll('.edit-income-stream-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            showIncomeStreamModal(container, store.get('currentProfile'), index, incomeStreams);
        });
    });

    listContainer.querySelectorAll('.delete-income-stream-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const stream = incomeStreams[index];

            if (confirm(`Delete income stream "${stream.name}"?`)) {
                await deleteIncomeStream(container, index, incomeStreams);
            }
        });
    });
}

/**
 * Render income stream card
 */
function renderIncomeStreamCard(stream, index) {
    const annualAmount = stream.amount * 12; // Assuming monthly
    const startDate = stream.start_date ? new Date(stream.start_date).toLocaleDateString() : 'Not set';
    const endDate = stream.end_date ? new Date(stream.end_date).toLocaleDateString() : 'Ongoing';

    return `
        <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${stream.name}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 8px;">
                    <div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Amount</div>
                        <div style="font-size: 14px; font-weight: 600; color: var(--accent-color);">${formatCurrency(stream.amount, 0)}/mo</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${formatCurrency(annualAmount, 0)}/yr</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">Start Date</div>
                        <div style="font-size: 13px;">${startDate}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">End Date</div>
                        <div style="font-size: 13px;">${endDate}</div>
                    </div>
                </div>
                ${stream.description ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: var(--text-secondary);">${stream.description}</p>` : ''}
            </div>
            <div style="display: flex; gap: 8px; margin-left: 16px;">
                <button class="edit-income-stream-btn" data-index="${index}" style="padding: 6px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Edit
                </button>
                <button class="delete-income-stream-btn" data-index="${index}" style="padding: 6px 12px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Delete
                </button>
            </div>
        </div>
    `;
}

/**
 * Show income stream modal
 */
function showIncomeStreamModal(parentContainer, profile, editIndex, incomeStreams) {
    const isEdit = editIndex !== null;
    const stream = isEdit ? incomeStreams[editIndex] : {
        name: '',
        amount: 0,
        start_date: '',
        end_date: '',
        description: ''
    };

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
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 24px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin: 0 0 20px 0; font-size: 22px;">${isEdit ? 'Edit' : 'Add'} Income Stream</h2>
            <form id="income-stream-form">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Name *</label>
                    <input type="text" id="stream-name" value="${stream.name}" required placeholder="e.g., Consulting Work, Rental Income"
                           style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Monthly Amount *</label>
                    <input type="text" id="stream-amount" value="${stream.amount ? formatCurrency(stream.amount, 0) : ''}" required placeholder="$0"
                           style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                    <small style="color: var(--text-secondary); font-size: 12px;">Average monthly income from this source</small>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Start Date</label>
                        <input type="date" id="stream-start-date" value="${stream.start_date || ''}"
                               style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                        <small style="color: var(--text-secondary); font-size: 12px;">When income begins</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">End Date</label>
                        <input type="date" id="stream-end-date" value="${stream.end_date || ''}"
                               style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                        <small style="color: var(--text-secondary); font-size: 12px;">Optional end date</small>
                    </div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Description</label>
                    <textarea id="stream-description" placeholder="Optional notes about this income stream"
                              style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px; min-height: 80px;">${stream.description || ''}</textarea>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" id="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        ${isEdit ? 'Save Changes' : 'Add Income Stream'}
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Cancel button
    modal.querySelector('#cancel-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Currency formatting
    const amountInput = modal.querySelector('#stream-amount');
    amountInput.addEventListener('blur', (e) => {
        const value = parseCurrency(e.target.value);
        if (value > 0) {
            e.target.value = formatCurrency(value, 0);
        }
    });

    // Form submission
    modal.querySelector('#income-stream-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newStream = {
            name: modal.querySelector('#stream-name').value,
            amount: parseCurrency(modal.querySelector('#stream-amount').value),
            start_date: modal.querySelector('#stream-start-date').value || null,
            end_date: modal.querySelector('#stream-end-date').value || null,
            description: modal.querySelector('#stream-description').value
        };

        try {
            if (isEdit) {
                incomeStreams[editIndex] = newStream;
            } else {
                incomeStreams.push(newStream);
            }

            await saveIncomeStreams(profile, incomeStreams);
            modal.remove();
            renderIncomeStreamsList(parentContainer, incomeStreams);
            showSuccess(isEdit ? 'Income stream updated!' : 'Income stream added!');
        } catch (error) {
            console.error('Error saving income stream:', error);
            showError('Failed to save: ' + error.message);
        }
    });
}

/**
 * Save income streams to profile
 */
async function saveIncomeStreams(profile, incomeStreams) {
    const updatedData = {
        ...profile.data,
        income_streams: incomeStreams
    };

    const result = await profilesAPI.update(profile.name, { data: updatedData });
    store.setState({ currentProfile: result.profile });
}

/**
 * Delete income stream
 */
async function deleteIncomeStream(container, index, incomeStreams) {
    try {
        incomeStreams.splice(index, 1);
        const profile = store.get('currentProfile');
        await saveIncomeStreams(profile, incomeStreams);
        renderIncomeStreamsList(container, incomeStreams);
        showSuccess('Income stream deleted!');
    } catch (error) {
        console.error('Error deleting income stream:', error);
        showError('Failed to delete: ' + error.message);
    }
}
