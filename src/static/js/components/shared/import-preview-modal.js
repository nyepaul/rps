/**
 * Import Preview Modal Component
 * Displays parsed CSV data for review before saving
 */

import { formatCurrency } from '../../utils/formatters.js';
import { aiAPI } from '../../api/ai.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';

/**
 * Render and show the preview modal
 * @param {Array} items - Parsed items to import
 * @param {string} type - 'income', 'expense', or 'asset'
 * @param {function} onConfirm - Callback with confirmed items to save
 * @param {string} filename - Name of the imported file
 */
export function renderImportPreviewModal(items, type, onConfirm, filename) {
    // Remove existing modal
    const existingModal = document.getElementById('import-preview-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'import-preview-modal';
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
        z-index: 10000;
    `;

    // Calculate totals
    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount || item.value) || 0), 0);

    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); width: 90%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; padding: 0; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <!-- Header -->
            <div style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Preview Import</h3>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        File: ${filename} • ${items.length} items found
                    </div>
                </div>
                <button id="close-preview-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <!-- Content -->
            <div style="padding: 20px; overflow-y: auto; flex: 1;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                            <th style="padding: 8px; width: 40px;"><input type="checkbox" id="select-all-import" checked></th>
                            <th style="padding: 8px;">Name</th>
                            <th style="padding: 8px;">${type === 'asset' ? 'Type' : 'Category'}</th>
                            <th style="padding: 8px; text-align: right;">Amount</th>
                            ${type === 'expense' ? '<th style="padding: 8px;">Frequency</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="import-preview-body">
                        <!-- Content rendered by renderRow -->
                    </tbody>
                </table>
            </div>

            <!-- Footer -->
            <div style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-tertiary);">
                <div style="font-weight: 600;">
                    Total: <span id="import-total">${formatCurrency(totalAmount, 0)}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="ai-enhance-btn" style="padding: 8px 16px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        Enhance with AI
                    </button>
                    <div style="width: 1px; height: 30px; background: var(--border-color); margin: 0 5px;"></div>
                    <button id="cancel-preview-btn" style="padding: 8px 16px; background: white; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="confirm-import-btn" style="padding: 8px 24px; background: var(--success-color); color: var(--text-on-success); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                        Import ${items.length} Items
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event Handlers
    const closeBtn = modal.querySelector('#close-preview-modal');
    const cancelBtn = modal.querySelector('#cancel-preview-btn');
    const confirmBtn = modal.querySelector('#confirm-import-btn');
    const aiBtn = modal.querySelector('#ai-enhance-btn');
    const selectAll = modal.querySelector('#select-all-import');
    const checkboxes = modal.querySelectorAll('.import-item-checkbox');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // AI Enhancement Handler
    aiBtn.addEventListener('click', async () => {
        const profile = store.get('currentProfile');
        if (!profile) {
            showError('No active profile to check against.');
            return;
        }

        try {
            showSpinner('AI is analyzing your data...');
            aiBtn.disabled = true;
            aiBtn.style.opacity = '0.7';

            // Prepare items for analysis
            const itemsToAnalyze = items.map(item => ({
                name: item.name,
                amount: parseFloat(item.amount || item.value) || 0,
                category: item.category || 'other', // Current category
                type: item.type || 'other'
            }));

            const result = await aiAPI.enhanceCSV(profile.name, type, itemsToAnalyze);
            
            if (result.items) {
                // Update local items with AI suggestions
                // The backend returns the full list with "reconciliation" and "ai_suggestions" fields
                
                // Refresh table with new data
                const tbody = modal.querySelector('#import-preview-body');
                tbody.innerHTML = result.items.map((item, index) => renderRow(item, index, type)).join('');
                
                // Re-attach listeners to new inputs
                attachRowListeners(modal, result.items);
                
                // Update original items ref
                // Note: We need to update the original 'items' array reference carefully
                // or just map results back to it
                result.items.forEach((enhancedItem, i) => {
                    if (items[i]) {
                        items[i].category = enhancedItem.category || enhancedItem.ai_suggestions?.suggested_category || items[i].category;
                        items[i]._reconciliation = enhancedItem.reconciliation;
                        items[i]._ai = enhancedItem.ai_suggestions;
                    }
                });

                showSuccess(`Analysis complete! Found ${result.enhanced_count || 0} suggestions.`);
            }

        } catch (error) {
            console.error('AI Enhance error:', error);
            showError('AI analysis failed: ' + error.message);
        } finally {
            hideSpinner();
            aiBtn.disabled = false;
            aiBtn.style.opacity = '1';
        }
    });

    // Select All Toggle
    selectAll.addEventListener('change', (e) => {
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateImportButton();
    });

    // Initial Render of Body
    const tbody = modal.querySelector('#import-preview-body');
    tbody.innerHTML = items.map((item, index) => renderRow(item, index, type)).join('');

    // Function to attach listeners (re-usable)
    function attachRowListeners(container, itemsRef) {
        // Individual Checkbox Toggle
        const checks = container.querySelectorAll('.import-item-checkbox');
        checks.forEach(cb => {
            cb.addEventListener('change', updateImportButton);
        });

        // Editable Fields
        container.querySelectorAll('.edit-field, .edit-select').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = e.target.dataset.index;
                const field = e.target.dataset.field;
                itemsRef[index][field] = e.target.value;
            });
            
            // Add focus styles
            input.addEventListener('focus', () => {
                input.style.borderColor = 'var(--accent-color)';
                input.style.background = 'var(--bg-primary)';
            });
            
            input.addEventListener('blur', () => {
                input.style.borderColor = 'transparent';
                input.style.background = 'transparent';
            });
        });
    }

    // Initial attachment
    attachRowListeners(modal, items);

    // Update Import Button Text
    function updateImportButton() {
        const checkedCount = modal.querySelectorAll('.import-item-checkbox:checked').length;
        confirmBtn.textContent = `Import ${checkedCount} Items`;
        confirmBtn.disabled = checkedCount === 0;
        if (checkedCount === 0) {
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
        } else {
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }

    // Confirm Import
    confirmBtn.addEventListener('click', () => {
        const selectedItems = [];
        checkboxes.forEach((cb, i) => {
            if (cb.checked) {
                selectedItems.push(items[i]);
            }
        });
        
        modal.remove();
        if (onConfirm) onConfirm(selectedItems);
    });
}

/**
 * Render a single row
 */
function renderRow(item, index, type) {
    // Check for AI/Reconciliation status
    const recon = item.reconciliation || {};
    const ai = item.ai_suggestions || {};
    
    let statusBadge = '';
    let rowStyle = 'border-bottom: 1px solid var(--border-color);';
    let warningIcon = '';

    if (recon.status === 'exact_match') {
        statusBadge = `<span style="font-size: 10px; background: var(--bg-tertiary); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Skipping (Exists)</span>`;
        rowStyle = 'border-bottom: 1px solid var(--border-color); opacity: 0.6;';
    } else if (recon.status === 'potential_duplicate' || ai.is_duplicate) {
        statusBadge = `<span style="font-size: 10px; background: var(--warning-bg); color: var(--warning-text); padding: 2px 6px; border-radius: 4px;">Possible Duplicate</span>`;
        warningIcon = '⚠️ ';
    } else if (ai.suggested_category && ai.suggested_category !== (item.category || 'other')) {
        statusBadge = `<span style="font-size: 10px; background: var(--info-bg); color: var(--info-color); padding: 2px 6px; border-radius: 4px;">AI Suggested</span>`;
        // Apply suggestion
        item.category = ai.suggested_category; 
    }

    return `
        <tr style="${rowStyle}">
            <td style="padding: 8px;">
                <input type="checkbox" class="import-item-checkbox" data-index="${index}" ${recon.status === 'exact_match' ? '' : 'checked'}>
            </td>
            <td style="padding: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    ${warningIcon}
                    <input type="text" class="edit-field" data-field="name" data-index="${index}" value="${item.name}" style="width: 100%; border: 1px solid transparent; background: transparent; padding: 4px;">
                </div>
                ${statusBadge ? `<div style="margin-left: 4px; margin-top: 2px;">${statusBadge}</div>` : ''}
            </td>
            <td style="padding: 8px;">
                ${renderCategorySelect(type, item, index)}
            </td>
            <td style="padding: 8px; text-align: right;">
                ${formatCurrency(item.amount || item.value, 0)}
            </td>
            ${type === 'expense' ? `<td style="padding: 8px;">${item.frequency || 'Monthly'}</td>` : ''}
        </tr>
    `;
}

/**
 * Helper to render category/type select dropdown
 */
function renderCategorySelect(type, item, index) {
    const value = type === 'asset' ? (item.type || 'other') : (item.category || 'other');
    const field = type === 'asset' ? 'type' : 'category';
    
    let options = [];
    
    if (type === 'income') {
        options = [
            {v: 'salary', l: 'Salary'},
            {v: 'bonus', l: 'Bonus'},
            {v: 'rental', l: 'Rental'},
            {v: 'dividend', l: 'Dividend'},
            {v: 'interest', l: 'Interest'},
            {v: 'pension', l: 'Pension'},
            {v: 'social_security', l: 'Social Security'},
            {v: 'other', l: 'Other'}
        ];
    } else if (type === 'expense') {
        options = [
            {v: 'housing', l: 'Housing'},
            {v: 'food', l: 'Food'},
            {v: 'transportation', l: 'Transportation'},
            {v: 'utilities', l: 'Utilities'},
            {v: 'healthcare', l: 'Healthcare'},
            {v: 'insurance', l: 'Insurance'},
            {v: 'debt', l: 'Debt'},
            {v: 'entertainment', l: 'Entertainment'},
            {v: 'other', l: 'Other'}
        ];
    } else if (type === 'asset') {
        options = [
            {v: '401k', l: '401(k)'},
            {v: 'ira', l: 'IRA'},
            {v: 'roth_ira', l: 'Roth IRA'},
            {v: 'brokerage', l: 'Brokerage'},
            {v: 'savings', l: 'Savings'},
            {v: 'checking', l: 'Checking'},
            {v: 'real_estate', l: 'Real Estate'},
            {v: 'vehicle', l: 'Vehicle'},
            {v: 'other', l: 'Other'}
        ];
    }

    return `
        <select class="edit-select" data-field="${field}" data-index="${index}" style="width: 100%; border: 1px solid transparent; background: transparent; padding: 4px;">
            ${options.map(opt => `
                <option value="${opt.v}" ${value.toLowerCase().includes(opt.v) ? 'selected' : ''}>${opt.l}</option>
            `).join('')}
        </select>
    `;
}
