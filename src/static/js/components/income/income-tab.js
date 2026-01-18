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
            <div style="text-align: center; padding: var(--space-8);">
                <div style="font-size: 48px; margin-bottom: var(--space-5);">💰</div>
                <h2 style="margin-bottom: var(--space-3);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-5);">
                    Please create or select a profile to manage income streams.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-5);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); flex-wrap: wrap; gap: var(--space-3);">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: var(--font-3xl); margin: 0 0 var(--space-2) 0;">💰 Income Streams</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: var(--font-base);">
                        Track current and future income with start and end dates
                    </p>
                </div>
                <button id="add-income-stream-btn" style="padding: var(--space-3) var(--space-5); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: var(--font-base); flex-shrink: 0;">
                    + Add Income
                </button>
            </div>

            <!-- Income Streams Table -->
            <div style="background: var(--bg-secondary); border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div id="income-streams-list"></div>
            </div>
        </div>
    `;

    // Setup event handlers
    setupIncomeStreamsHandlers(container, profile, incomeStreams);
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
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 48px; margin-bottom: var(--space-4); opacity: 0.5;">💼</div>
                <h3 style="margin-bottom: var(--space-2); color: var(--text-primary);">No Income Streams Yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-5); font-size: var(--font-base);">
                    Click "Add Income" to track your income sources
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
        <div style="padding: var(--space-3);">
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                ${sortedStreams.map((stream, index) => renderIncomeStreamRow(stream, index)).join('')}
            </div>
        </div>
    `;

    // Setup row click handlers (inline edit on click)
    listContainer.querySelectorAll('.income-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking action buttons
            if (e.target.closest('.edit-income-stream-btn') || e.target.closest('.delete-income-stream-btn')) {
                return;
            }

            // If already editing, close the editor
            if (row.classList.contains('editing')) {
                const cancelBtn = row.querySelector('.cancel-inline-edit');
                if (cancelBtn) cancelBtn.click();
                row.classList.remove('editing');
                return;
            }

            row.classList.add('editing');
            const index = parseInt(row.dataset.index);
            const stream = incomeStreams[index];
            makeIncomeRowEditable(row, stream, index, incomeStreams, container);
        });
    });

    // Setup edit handlers
    listContainer.querySelectorAll('.edit-income-stream-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = btn.closest('.income-row');

            // If already editing, close the editor
            if (row.classList.contains('editing')) {
                const cancelBtn = row.querySelector('.cancel-inline-edit');
                if (cancelBtn) cancelBtn.click();
                row.classList.remove('editing');
                return;
            }

            row.classList.add('editing');
            const index = parseInt(btn.dataset.index);
            const stream = incomeStreams[index];
            makeIncomeRowEditable(row, stream, index, incomeStreams, container);
        });
    });

    // Setup delete handlers
    listContainer.querySelectorAll('.delete-income-stream-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent row click
            const index = parseInt(btn.dataset.index);
            const stream = incomeStreams[index];

            if (confirm(`Delete income stream "${stream.name}"?`)) {
                await deleteIncomeStream(container, index, incomeStreams);
            }
        });
    });
}

/**
 * Render income stream row
 */
function renderIncomeStreamRow(stream, index) {
    // Format dates
    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const startDate = formatDate(stream.start_date);
    const endDate = formatDate(stream.end_date);

    // Build date display
    let dateInfo = '';
    if (startDate && endDate) {
        dateInfo = `📅 ${startDate} → ${endDate}`;
    } else if (startDate) {
        dateInfo = `📅 From ${startDate}`;
    } else if (endDate) {
        dateInfo = `📅 Until ${endDate}`;
    } else {
        dateInfo = '⏳ Ongoing';
    }

    const annual = stream.amount * 12;

    return `
        <div class="income-row" data-index="${index}" style="padding: var(--space-2) var(--space-3); background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; flex-wrap: wrap; gap: var(--space-2);" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--border-color)'">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex: 1; font-size: var(--font-sm); flex-wrap: wrap;">
                <span style="font-size: var(--font-md);">💰</span>
                <span style="font-weight: 600;">${stream.name}</span>
                ${stream.description ? `<span style="color: var(--text-secondary); font-size: var(--font-sm);">${stream.description}</span>` : ''}
                <span style="color: var(--text-secondary);">${formatCurrency(stream.amount, 0)}/monthly (${formatCurrency(annual, 0)}/yr)</span>
                <span style="font-size: var(--font-xs); color: var(--text-secondary);">${dateInfo}</span>
            </div>
            <div style="display: flex; gap: var(--space-1); margin-left: var(--space-2);">
                <button class="edit-income-stream-btn" data-index="${index}"
                    style="padding: var(--space-1) var(--space-2); background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: var(--font-base);"
                    title="Edit">✏️</button>
                <button class="delete-income-stream-btn" data-index="${index}"
                    style="padding: var(--space-1) var(--space-2); background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: var(--font-base);"
                    title="Delete">🗑️</button>
            </div>
        </div>
    `;
}

/**
 * Make income row editable inline
 */
function makeIncomeRowEditable(rowElement, stream, index, incomeStreams, parentContainer) {
    const originalHTML = rowElement.innerHTML;

    rowElement.innerHTML = `
        <div style="padding: 10px 12px; background: var(--bg-tertiary); border-radius: 6px; border: 2px solid var(--accent-color);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 10px; margin-bottom: 10px;">
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Name
                    </label>
                    <input type="text" name="name" value="${stream.name || ''}" required
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Monthly Amount
                    </label>
                    <input type="text" name="amount" value="${stream.amount || 0}"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Start Date
                    </label>
                    <input type="date" name="start_date" value="${stream.start_date || ''}"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        End Date
                    </label>
                    <input type="date" name="end_date" value="${stream.end_date || ''}"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                </div>
                <div style="grid-column: 1 / -1;">
                    <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                        Description
                    </label>
                    <input type="text" name="description" value="${stream.description || ''}"
                           style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
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

    // Handle save
    const saveBtn = rowElement.querySelector('.save-inline-edit');
    saveBtn.addEventListener('click', async () => {
        const updatedStream = {
            name: rowElement.querySelector('[name="name"]').value,
            amount: parseFloat(rowElement.querySelector('[name="amount"]').value.replace(/[$,]/g, '')) || 0,
            start_date: rowElement.querySelector('[name="start_date"]').value || null,
            end_date: rowElement.querySelector('[name="end_date"]').value || null,
            description: rowElement.querySelector('[name="description"]').value
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            incomeStreams[index] = updatedStream;
            const profile = store.get('currentProfile');
            await saveIncomeStreams(profile, incomeStreams);
            rowElement.classList.remove('editing');
            renderIncomeStreamsList(parentContainer, incomeStreams);
            showSuccess('Income stream updated!');
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

    // Click anywhere except Save button to cancel
    const editContainer = rowElement.querySelector('div');
    editContainer.addEventListener('click', (e) => {
        // Only close if not clicking on Save button or input fields
        if (!e.target.closest('.save-inline-edit') && !e.target.closest('input, select, textarea, label')) {
            e.stopPropagation();
            rowElement.innerHTML = originalHTML;
            rowElement.classList.remove('editing');
        }
    });

    // Focus first input
    setTimeout(() => {
        const firstInput = rowElement.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
    }, 100);
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
        <div style="background: var(--bg-secondary); padding: var(--space-5); border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin: 0 0 var(--space-4) 0; font-size: var(--font-xl);">${isEdit ? 'Edit' : 'Add'} Income Stream</h2>
            <form id="income-stream-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4);">
                <div style="grid-column: 1 / -1;">
                    <label style="display: block; margin-bottom: var(--space-2); font-weight: 500; font-size: var(--font-sm);">Name *</label>
                    <input type="text" id="stream-name" value="${stream.name}" required placeholder="e.g., Consulting Work, Rental Income"
                           style="width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-base);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-2); font-weight: 500; font-size: var(--font-sm);">Monthly Amount *</label>
                    <input type="text" id="stream-amount" value="${stream.amount ? formatCurrency(stream.amount, 0) : ''}" required placeholder="$0"
                           style="width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-base);">
                    <small style="color: var(--text-secondary); font-size: var(--font-xs);">Average monthly income</small>
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-2); font-weight: 500; font-size: var(--font-sm);">Start Date</label>
                    <input type="date" id="stream-start-date" value="${stream.start_date || ''}"
                           style="width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-base);">
                    <small style="color: var(--text-secondary); font-size: var(--font-xs);">When income begins</small>
                </div>
                <div>
                    <label style="display: block; margin-bottom: var(--space-2); font-weight: 500; font-size: var(--font-sm);">End Date</label>
                    <input type="date" id="stream-end-date" value="${stream.end_date || ''}"
                           style="width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-base);">
                    <small style="color: var(--text-secondary); font-size: var(--font-xs);">Optional end date</small>
                </div>
                <div style="grid-column: 1 / -1;">
                    <label style="display: block; margin-bottom: var(--space-2); font-weight: 500; font-size: var(--font-sm);">Description</label>
                    <textarea id="stream-description" placeholder="Optional notes about this income stream"
                              style="width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: var(--font-base); min-height: 60px;">${stream.description || ''}</textarea>
                </div>
                <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: var(--space-3); padding-top: var(--space-2); border-top: 1px solid var(--border-color);">
                    <button type="button" id="cancel-btn" style="padding: var(--space-2) var(--space-4); background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: var(--font-sm);">
                        Cancel
                    </button>
                    <button type="submit" style="padding: var(--space-2) var(--space-4); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-sm); font-weight: 600;">
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
