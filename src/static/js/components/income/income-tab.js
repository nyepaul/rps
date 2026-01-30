/**
 * Income Tab Component
 * Models current and future income streams with start/stop dates
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';
import { showError, showSuccess } from '../../utils/dom.js';
import { showAIImportModal } from "../ai/ai-import-modal.js";
import { showTransactionImportModal } from "../transactions/transaction-import-modal.js";
import { INCOME_CONFIG } from "../../utils/csv-parser.js";
import { showCSVImportModal } from "../shared/csv-import-modal.js";

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

    const data = profile.data || {};
    const financial = data.financial || {};
    const spouse = data.spouse || {};
    const hasSpouse = spouse.name ? true : false;
    const primaryName = profile.name || 'Primary';
    const spouseName = spouse.name || 'Spouse';
    const incomeStreams = data.income_streams || [];

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: var(--font-2xl); margin: 0;">💰 Income Streams</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Tracking <strong>${profile.name}'s</strong> recurring income
                    </p>
                </div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <button id="add-income-stream-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        + Add Income
                    </button>
                    <button id="ai-import-income-btn" style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        AI Import
                    </button>
                    <button id="transaction-import-btn" style="padding: 6px 12px; background: var(--info-color, #2196F3); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;" title="Import bank transactions CSV">
                        📊 Import CSV
                    </button>
                    <div style="display: flex; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                        <button id="csv-export-income-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-right: 1px solid var(--border-color); cursor: pointer; font-size: 11px;">
                            Export
                        </button>
                        <button id="csv-import-income-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; cursor: pointer; font-size: 11px;">
                            TXT/CSV
                        </button>
                    </div>
                    <button id="delete-all-income-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--danger-color); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;" title="Delete all income streams">
                        🗑️
                    </button>
                </div>
            </div>

            <!-- Income Streams Table -->
            <div style="background: var(--bg-secondary); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
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

    // AI Import button
    const aiBtn = container.querySelector('#ai-import-income-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            showAIImportModal('income', profile.name, async (extractedIncome) => {
                let added = 0, updated = 0;

                // Add extracted items with reconciliation
                for (const item of extractedIncome) {
                    // Find existing income stream by name (case-insensitive)
                    const existingIndex = incomeStreams.findIndex(
                        s => s.name?.toLowerCase() === item.name?.toLowerCase()
                    );

                    if (existingIndex >= 0) {
                        // Update existing - preserve dates, update amount
                        const existing = incomeStreams[existingIndex];
                        incomeStreams[existingIndex] = {
                            ...existing,
                            amount: item.amount ?? existing.amount,
                            description: existing.description || `Imported via AI | ${item.frequency || ''}`
                        };
                        updated++;
                    } else {
                        // Add new income stream
                        incomeStreams.push({
                            name: item.name,
                            amount: item.amount || 0,
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: profile.retirement_date || null,
                            description: `Imported via AI | ${item.frequency || ''}`
                        });
                        added++;
                    }
                }

                await saveIncomeStreams(profile, incomeStreams);
                renderIncomeStreamsList(container, incomeStreams);

                // Show summary
                const parts = [];
                if (added > 0) parts.push(`${added} added`);
                if (updated > 0) parts.push(`${updated} updated`);
                if (parts.length > 0) {
                    showSuccess(`Income streams imported: ${parts.join(', ')}`);
                }
            });
        });
    }

    // Transaction Import button
    const transactionBtn = container.querySelector('#transaction-import-btn');
    if (transactionBtn) {
        transactionBtn.addEventListener('click', () => {
            showTransactionImportModal(profile.name, incomeStreams, async () => {
                // Reload profile after import
                await profilesAPI.get(profile.name);
                const updatedProfile = store.get('currentProfile');
                if (updatedProfile) {
                    const updatedStreams = updatedProfile.data?.income_streams || [];
                    renderIncomeStreamsList(container, updatedStreams);
                    showSuccess('Transactions imported successfully!');
                }
            });
        });
    }

    // Add income stream button
    const addBtn = container.querySelector('#add-income-stream-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showIncomeStreamModal(container, profile, null, incomeStreams);
        });
    }

    // CSV Export button
    const csvExportBtn = container.querySelector('#csv-export-income-btn');
    if (csvExportBtn) {
        csvExportBtn.addEventListener('click', () => {
            exportIncomeCSV(profile, incomeStreams);
        });
    }

    // CSV Import button
    const csvImportBtn = container.querySelector("#csv-import-income-btn");
    if (csvImportBtn) {
        csvImportBtn.addEventListener("click", () => {
            showCSVImportModal({
                title: "Import Income from CSV",
                config: INCOME_CONFIG,
                profileName: profile.name,
                onComplete: (updatedProfile) => {
                    renderIncomeStreamsList(container, updatedProfile.data?.income_streams || []);
                },
            });
        });
    }

    // Delete All button
    const deleteAllBtn = container.querySelector('#delete-all-income-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            showDeleteAllIncomeModal(container, profile, incomeStreams);
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
            <div style="padding: 8px 12px; margin-bottom: 12px; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid var(--accent-color);">
                <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                    <strong style="color: var(--text-primary);">💡 Tip:</strong> Click on any income stream to edit its details inline
                </p>
            </div>
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

    // Determine source badge
    const source = stream.source || 'specified';
    const sourceBadges = {
        'specified': { color: '#10b981', text: '✓ Manual', borderColor: '#10b981' },
        'detected': { color: '#3b82f6', text: '🔍 Detected', borderColor: '#3b82f6' },
        'merged': { color: '#8b5cf6', text: '⚡ Merged', borderColor: '#8b5cf6' }
    };
    const badge = sourceBadges[source] || sourceBadges['specified'];

    // Build tooltip for detected/merged items
    let tooltip = '';
    if (source === 'detected' || source === 'merged') {
        const parts = [];
        if (stream.detected_from) parts.push(`From: ${stream.detected_from}`);
        if (stream.confidence) parts.push(`Confidence: ${(stream.confidence * 100).toFixed(0)}%`);
        if (stream.variance !== undefined) parts.push(`Variance: ±$${stream.variance.toFixed(2)}`);
        if (stream.first_seen && stream.last_seen) {
            parts.push(`Period: ${stream.first_seen} to ${stream.last_seen}`);
        }
        tooltip = parts.join(' • ');
    }

    return `
        <div class="income-row" data-index="${index}" style="padding: 8px 12px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); border-left: 3px solid ${badge.borderColor}; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; flex-wrap: wrap; gap: var(--space-2);" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--border-color)'">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex: 1; font-size: 13px; flex-wrap: wrap;">
                <span style="font-weight: 700;">${stream.name}</span>
                <span style="display: inline-block; padding: 2px 8px; background: ${badge.color}; color: white; border-radius: 12px; font-size: 10px; font-weight: 600;" ${tooltip ? `title="${tooltip}"` : ''}>${badge.text}</span>
                <span style="color: var(--text-secondary);">${formatCurrency(stream.amount, 0)}/mo (${formatCurrency(annual, 0)}/yr)</span>
                <span style="font-size: 11px; color: var(--text-secondary); opacity: 0.8;">${dateInfo}</span>
            </div>
            <div style="display: flex; gap: 4px; margin-left: 8px;">
                <button class="edit-income-stream-btn" data-index="${index}"
                    style="padding: 2px 6px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: 14px;"
                    title="Edit">✏️</button>
                <button class="delete-income-stream-btn" data-index="${index}"
                    style="padding: 2px 6px; background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: 14px;"
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

    // Get retirement date for pre-populating end date
    const profile = store.get('currentProfile');
    const retirementDate = profile?.retirement_date || '';

    // Pre-populate end date with retirement date if no end date is specified
    // (income typically ends at retirement)
    let defaultEndDate = stream.end_date || '';
    if (!stream.end_date && retirementDate) {
        defaultEndDate = retirementDate;
    }

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
                    <input type="date" name="end_date" value="${defaultEndDate}"
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

/**
 * Export income streams to CSV
 */
function exportIncomeCSV(profile, incomeStreams) {
    if (incomeStreams.length === 0) {
        showError('No income streams to export');
        return;
    }

    const headers = ['Name', 'Amount', 'Start Date', 'End Date', 'Description', 'Owner'];
    const rows = incomeStreams.map(stream => [
        stream.name || '',
        stream.amount || 0,
        stream.start_date || '',
        stream.end_date || '',
        stream.description || '',
        stream.owner || 'primary'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${profile.name}_income_streams_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showSuccess('Income streams exported to CSV');
}

/**
 * Show delete all income modal
 */
function showDeleteAllIncomeModal(container, profile, incomeStreams) {
    if (incomeStreams.length === 0) {
        showError('No income streams to delete');
        return;
    }

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;">
                <h3 style="margin: 0 0 16px 0; color: var(--danger-color);">⚠️ Delete All Income Streams</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary);">
                    This will permanently delete <strong>ALL ${incomeStreams.length}</strong> income streams.
                </p>
                <p style="margin: 0 0 20px 0; color: var(--danger-color); font-weight: 600;">
                    This action cannot be undone!
                </p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-delete" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="confirm-delete" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Delete All
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#cancel-delete').addEventListener('click', () => modal.remove());
    modal.querySelector('#confirm-delete').addEventListener('click', async () => {
        try {
            incomeStreams.length = 0; // Clear array
            await saveIncomeStreams(profile, incomeStreams);
            renderIncomeStreamsList(container, incomeStreams);
            showSuccess('All income streams deleted');
            modal.remove();
        } catch (error) {
            showError('Failed to delete: ' + error.message);
        }
    });
}
