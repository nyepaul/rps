/**
 * Inline asset editor - click to edit directly in the list
 */

import { formatCurrency } from '../../utils/formatters.js';
import { FIELD_DEFINITIONS } from './asset-form-fields.js';

/**
 * Convert an asset row to inline edit mode
 */
export function makeRowEditable(rowElement, asset, category, index, onSave, onCancel) {
    const originalHTML = rowElement.innerHTML;

    // Get relevant fields for this asset type
    const fields = FIELD_DEFINITIONS[category] || [];
    const relevantFields = fields.filter(field => {
        // Show fields that are relevant for this asset type
        if (field.showFor && !field.showFor.includes(asset.type)) {
            return false;
        }
        // Skip some fields in inline edit for simplicity
        if (['notes', 'tags'].includes(field.name)) {
            return false;
        }
        return true;
    });

    // Build inline edit form with optimized multi-column layout
    rowElement.innerHTML = `
        <div style="padding: 10px 12px; background: var(--bg-tertiary); border-radius: 6px; border: 2px solid var(--accent-color);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 10px; margin-bottom: 10px;">
                ${relevantFields.map(field => renderInlineField(field, asset)).join('')}
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
        const updatedAsset = {};

        // Collect all field values
        relevantFields.forEach(field => {
            const input = rowElement.querySelector(`[name="${field.name}"]`);
            if (!input) return;

            let value = input.value;

            // Handle different field types
            if (field.type === 'currency') {
                value = value.replace(/[$,]/g, '');
                value = value ? parseFloat(value) : 0;
            } else if (field.type === 'number') {
                value = value ? parseFloat(value) : (field.name.includes('_pct') ? 0 : null);
            } else if (field.type === 'checkbox') {
                value = input.checked;
            } else if (field.type === 'date') {
                value = value || null;
            }

            updatedAsset[field.name] = value;
        });

        // Merge with existing asset data (keep fields we didn't edit)
        const finalAsset = { ...asset, ...updatedAsset };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            await onSave(finalAsset, category, index);
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
        if (onCancel) onCancel();
    });

    // Click anywhere except Save button to cancel
    const editContainer = rowElement.querySelector('div');
    editContainer.addEventListener('click', (e) => {
        // Only close if not clicking on Save button or input fields
        if (!e.target.closest('.save-inline-edit') && !e.target.closest('input, select, textarea, label')) {
            e.stopPropagation();
            rowElement.innerHTML = originalHTML;
            if (onCancel) onCancel();
        }
    });

    // Focus first input
    setTimeout(() => {
        const firstInput = rowElement.querySelector('input, select');
        if (firstInput) firstInput.focus();
    }, 100);
}

/**
 * Render a single field for inline editing
 */
function renderInlineField(field, asset) {
    const value = asset[field.name];
    const displayValue = formatFieldValue(field, value);

    let inputHTML = '';

    if (field.type === 'select') {
        const options = field.options || [];
        inputHTML = `
            <select name="${field.name}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                ${options.map(opt => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optLabel = typeof opt === 'string' ? opt : opt.label;
                    return `<option value="${optValue}" ${value === optValue ? 'selected' : ''}>${optLabel}</option>`;
                }).join('')}
            </select>
        `;
    } else if (field.type === 'checkbox') {
        inputHTML = `
            <input type="checkbox" name="${field.name}" ${value ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; margin-top: 2px;">
        `;
    } else if (field.type === 'currency') {
        const numValue = value || 0;
        inputHTML = `
            <input type="text" name="${field.name}" value="${numValue}" placeholder="${field.placeholder || ''}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
        `;
    } else {
        inputHTML = `
            <input type="${field.type || 'text'}" name="${field.name}" value="${displayValue}"
                ${field.min !== undefined ? `min="${field.min}"` : ''}
                ${field.max !== undefined ? `max="${field.max}"` : ''}
                ${field.step !== undefined ? `step="${field.step}"` : ''}
                ${field.maxlength !== undefined ? `maxlength="${field.maxlength}"` : ''}
                placeholder="${field.placeholder || ''}"
                style="width: 100%; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
        `;
    }

    return `
        <div>
            <label style="display: block; font-size: 9px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px;">
                ${field.label}
            </label>
            ${inputHTML}
        </div>
    `;
}

/**
 * Format field value for display
 */
function formatFieldValue(field, value) {
    if (value === null || value === undefined) return '';
    if (field.type === 'currency') return value;
    if (field.type === 'number') return value;
    if (field.type === 'date') return value || '';
    return String(value);
}
