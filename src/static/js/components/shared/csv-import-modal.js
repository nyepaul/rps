/**
 * Unified CSV Import Modal
 * Standardized upload interface for all data types (Income, Expenses, Assets)
 */

import { parseCSV, validateCSVFile } from '../../utils/csv-parser.js';
import { showError, showSuccess, showSpinner, hideSpinner } from '../../utils/dom.js';
import { showImportPreviewModal } from './import-preview-modal.js';

/**
 * Show the CSV import modal
 * @param {Object} options - Configuration options
 * @param {string} options.title - Modal title
 * @param {Object} options.config - Parser configuration (INCOME_CONFIG, etc.)
 * @param {string} options.profileName - Current profile name
 * @param {Function} options.onComplete - Callback when import finishes
 * @param {Object} options.extraData - Optional extra data to pass to the preview (e.g., period)
 */
export function showCSVImportModal({ title, config, profileName, onComplete, extraData = {} }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 2000;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">${title}</h2>
                <button id="close-modal-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="margin-bottom: 20px;">
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 15px;">
                    Upload a CSV file exported from your bank or created manually. 
                    The system will automatically match your columns.
                </p>
                
                <div id="drop-zone" style="
                    border: 2px dashed var(--border-color);
                    border-radius: 8px;
                    padding: 40px 20px;
                    text-align: center;
                    background: var(--bg-primary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">
                    <div style="font-size: 40px; margin-bottom: 10px;">📄</div>
                    <div style="font-weight: 600;">Click to select or drag & drop</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">CSV files only (max 10MB)</div>
                    <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
                </div>
                
                <div id="file-info" style="margin-top: 15px; display: none; padding: 10px; background: var(--bg-tertiary); border-radius: 6px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span id="filename" style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;"></span>
                        <span id="filesize" style="color: var(--text-secondary);"></span>
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button id="import-btn" disabled style="padding: 10px 25px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; opacity: 0.5;">
                    Continue to Preview
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#csv-file-input');
    const dropZone = modal.querySelector('#drop-zone');
    const fileInfo = modal.querySelector('#file-info');
    const filenameSpan = modal.querySelector('#filename');
    const filesizeSpan = modal.querySelector('#filesize');
    const importBtn = modal.querySelector('#import-btn');
    const closeBtn = modal.querySelector('#close-modal-btn');
    const cancelBtn = modal.querySelector('#cancel-btn');

    let selectedFile = null;

    // Handlers
    const handleFileSelect = (file) => {
        const validation = validateCSVFile(file);
        if (!validation.valid) {
            showError(validation.errors[0]);
            return;
        }

        selectedFile = file;
        filenameSpan.textContent = file.name;
        filesizeSpan.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        fileInfo.style.display = 'block';
        importBtn.disabled = false;
        importBtn.style.opacity = '1';
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'var(--bg-secondary)';
    };

    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'var(--bg-secondary)';
    });

    dropZone.addEventListener('dragleave', () => {
        if (!selectedFile) {
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = 'var(--bg-primary)';
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    closeBtn.addEventListener('click', () => modal.remove());
    cancelBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    importBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        showSpinner('Parsing CSV...');
        
        try {
            const text = await selectedFile.text();
            
            // Use Web Worker for parsing to keep UI responsive
            const worker = new Worker('/js/workers/csv-worker.js', { type: 'module' });
            
            worker.onmessage = function(e) {
                const { success, result, error } = e.data;
                
                if (success) {
                    processParseResult(result);
                } else {
                    handleParseError(error);
                }
                worker.terminate();
            };
            
            worker.onerror = function(error) {
                console.error('Worker error:', error);
                // Fallback to main thread parsing if worker fails
                console.warn('Falling back to main thread parsing...');
                try {
                    const fallbackResult = parseCSV(text, config);
                    processParseResult(fallbackResult);
                } catch (err) {
                    handleParseError(err.message);
                }
                worker.terminate();
            };

            // Start worker
            worker.postMessage({ text, config });

        } catch (error) {
            handleParseError(error.message);
        }
    });

    function handleParseError(message) {
        hideSpinner();
        console.error('CSV Import Error:', message);
        showError(`Error processing file: ${message}`);
    }

    function processParseResult(result) {
        if (result.errors.length > 0) {
            hideSpinner();
            showError(`Failed to parse CSV: ${result.errors[0]}`);
            return;
        }

        if (result.items.length === 0) {
            hideSpinner();
            showError('No valid data items found in the CSV file.');
            return;
        }

        hideSpinner();
        modal.remove();

        // Open the preview modal
        showImportPreviewModal({
            items: result.items,
            warnings: result.warnings,
            config,
            profileName,
            onComplete,
            extraData
        });
    }
}
