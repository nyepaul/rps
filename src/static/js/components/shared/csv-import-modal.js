/**
 * Shared CSV Import Modal Component
 * Unified interface for importing CSV data across different tabs
 */

import { parseCSV, validateCSVFile, detectDelimiter } from '../../utils/csv-parser.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render and show the CSV import modal
 * @param {string} type - 'income', 'expense', or 'asset'
 * @param {object} config - Configuration object from csv-parser.js
 * @param {function} onPreview - Callback when file is parsed and ready for preview
 */
export function renderCSVImportModal(type, config, onPreview) {
    // Remove existing modal if any
    const existingModal = document.getElementById('csv-import-modal');
    if (existingModal) existingModal.remove();

    const typeLabels = {
        'income': 'Income Streams',
        'expense': 'Expenses',
        'asset': 'Assets'
    };

    const label = typeLabels[type] || 'Data';

    const modal = document.createElement('div');
    modal.id = 'csv-import-modal';
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

    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); width: 90%; max-width: 500px; padding: 24px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Import ${label} from CSV</h3>
                <button id="close-import-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="margin-bottom: 20px;">
                <div id="drop-zone" style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
                    <p style="margin: 0 0 10px 0; font-weight: 600;">Click to upload or drag & drop</p>
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">Supported format: .csv</p>
                    <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
                </div>
            </div>

            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 6px; font-size: 13px; color: var(--text-secondary); margin-bottom: 20px;">
                <strong>Expected Columns:</strong><br>
                ${config.requiredColumns.join(', ')}<br>
                <em style="font-size: 11px; margin-top: 5px; display: block;">(Headers are auto-detected, order doesn't matter)</em>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancel-import-btn" style="padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event Handlers
    const closeBtn = modal.querySelector('#close-import-modal');
    const cancelBtn = modal.querySelector('#cancel-import-btn');
    const dropZone = modal.querySelector('#drop-zone');
    const fileInput = modal.querySelector('#csv-file-input');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // File Input
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0], config, onPreview, modal);
        }
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'var(--bg-tertiary)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'transparent';
        
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0], config, onPreview, modal);
        }
    });
}

/**
 * Handle file processing
 */
function handleFile(file, config, onPreview, modal) {
    // Basic validation
    const validation = validateCSVFile(file);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
        const text = e.target.result;
        try {
            const result = parseCSV(text, config);
            
            if (result.errors && result.errors.length > 0) {
                // Show errors but allow proceeding if some rows are valid
                console.warn('CSV parsing warnings:', result.errors);
                if (result.data.length === 0) {
                    showError(`Failed to parse CSV: ${result.errors[0]}`);
                    return;
                }
            }

            // Close import modal and trigger preview callback
            modal.remove();
            if (onPreview) {
                onPreview(result.data, file.name);
            }

        } catch (error) {
            console.error('CSV parse error:', error);
            showError('Failed to parse CSV file. Please check the format.');
        }
    };

    reader.onerror = () => {
        showError('Error reading file');
    };

    reader.readAsText(file);
}
