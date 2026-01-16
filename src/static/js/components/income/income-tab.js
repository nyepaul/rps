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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h1 style="font-size: 28px; margin: 0 0 8px 0;">💰 Income Streams</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                        Track current and future income with start and end dates
                    </p>
                </div>
                <button id="add-income-stream-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
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
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">💼</div>
                <h3 style="margin-bottom: 8px; color: var(--text-primary);">No Income Streams Yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
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
        <div style="padding: 12px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${sortedStreams.map((stream, index) => renderIncomeStreamRow(stream, index)).join('')}
            </div>
        </div>
    `;

    // Setup row click handlers (edit on click)
    listContainer.querySelectorAll('.income-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking action buttons
            if (e.target.closest('.edit-income-stream-btn') || e.target.closest('.delete-income-stream-btn')) {
                return;
            }
            const index = parseInt(row.dataset.index);
            showIncomeStreamModal(container, store.get('currentProfile'), index, incomeStreams);
        });
    });

    // Setup edit handlers
    listContainer.querySelectorAll('.edit-income-stream-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            showIncomeStreamModal(container, store.get('currentProfile'), index, incomeStreams);
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
        <div class="income-row" data-index="${index}" style="padding: 6px 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--border-color)'">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px;">
                <span style="font-size: 16px;">💰</span>
                <span style="font-weight: 600;">${stream.name}</span>
                ${stream.description ? `<span style="color: var(--text-secondary); font-size: 12px;">${stream.description}</span>` : ''}
                <span style="color: var(--text-secondary);">${formatCurrency(stream.amount, 0)}/monthly (${formatCurrency(annual, 0)}/yr)</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${dateInfo}</span>
            </div>
            <div style="display: flex; gap: 4px; margin-left: 8px;">
                <button class="edit-income-stream-btn" data-index="${index}"
                    style="padding: 4px 8px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: 14px;"
                    title="Edit">✏️</button>
                <button class="delete-income-stream-btn" data-index="${index}"
                    style="padding: 4px 8px; background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: 14px;"
                    title="Delete">🗑️</button>
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
