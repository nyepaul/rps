/**
 * CSV Import/Export handlers
 */

import { assetsAPI } from '../../api/assets.js';
import { parseCSV, ASSET_CONFIG, validateCSVFile, parseCSVLine, detectDelimiter } from '../../utils/csv-parser.js';

/**
 * Export assets to CSV
 */
export async function exportAssetsCSV(profileName) {
    try {
        const blob = await assetsAPI.exportCSV(profileName);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profileName.replace(/ /g, '_')}_assets_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error('CSV export error:', error);
        throw error;
    }
}

/**
 * Import assets from CSV
 */
export async function importAssetsCSV(profileName, onSuccess) {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,text/csv';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show import modal
        showImportModal(profileName, file, onSuccess);
    });

    fileInput.click();
}

/**
 * Show import preview modal
 */
function showImportModal(profileName, file, onSuccess) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
        <div style="padding: 30px; border-bottom: 2px solid var(--border-color);">
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">⬆️ Import Assets from CSV</h2>
            <p style="margin: 0; color: var(--text-secondary);">
                File: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)
            </p>
        </div>

        <div style="padding: 30px;">
            <div id="preview-section">
                <h4 style="margin-bottom: 15px;">Preview:</h4>
                <div id="csv-preview" style="font-family: monospace; font-size: 12px; background: var(--bg-primary); padding: 15px; border-radius: 8px; overflow-x: auto; max-height: 400px; overflow-y: auto;">
                    <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                        Loading preview...
                    </div>
                </div>
            </div>

            <div id="error-section" style="display: none; margin-top: 20px; padding: 20px; background: var(--danger-bg); border: 2px solid var(--danger-color); border-radius: 8px; color: var(--danger-color);"></div>

            <div id="success-section" style="display: none; margin-top: 20px; padding: 20px; background: var(--success-bg); border: 2px solid var(--success-color); border-radius: 8px; color: var(--success-color);"></div>
        </div>

        <div style="padding: 20px 30px; border-top: 2px solid var(--border-color); display: flex; justify-content: space-between;">
            <button id="cancel-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                Cancel
            </button>
            <button id="import-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                ⬆️ Import Assets
            </button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Read and preview CSV
    const reader = new FileReader();
    reader.onload = (e) => {
        const csvText = e.target.result;
        previewCSV(csvText, content);
    };
    reader.readAsText(file);

    // Setup handlers
    const cancelBtn = content.querySelector('#cancel-btn');
    const importBtn = content.querySelector('#import-btn');
    const errorSection = content.querySelector('#error-section');
    const successSection = content.querySelector('#success-section');

    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });

    importBtn.addEventListener('click', async () => {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';
        errorSection.style.display = 'none';
        successSection.style.display = 'none';

        try {
            const result = await assetsAPI.importCSV(profileName, file);

            successSection.textContent = result.message || 'Assets imported successfully!';
            successSection.style.display = 'block';

            importBtn.style.display = 'none';

            // Call success callback after delay
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess(result.profile);
                }
                modal.remove();
            }, 2000);
        } catch (error) {
            console.error('Import error:', error);
            errorSection.textContent = error.message;
            errorSection.style.display = 'block';
            importBtn.disabled = false;
            importBtn.textContent = '⬆️ Import Assets';
        }
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Preview CSV content
 */
function previewCSV(csvText, container) {
    const previewDiv = container.querySelector('#csv-preview');
    const lines = csvText.trim().split('\n');

    if (lines.length === 0) {
        previewDiv.innerHTML = '<div style="color: var(--danger-color);">Empty CSV file</div>';
        return;
    }

    // Detect delimiter from first line
    const delimiter = detectDelimiter(lines[0]);

    // Show first 10 lines
    const previewLines = lines.slice(0, 10);
    const hasMore = lines.length > 10;

    let html = '<table style="width: 100%; border-collapse: collapse;">';

    // Header row
    html += '<tr style="background: var(--bg-tertiary); font-weight: 600;">';
    const headers = parseCSVLine(previewLines[0], delimiter);
    headers.forEach(header => {
        html += `<th style="padding: 8px; border: 1px solid var(--border-color); text-align: left;">${escapeHtml(header)}</th>`;
    });
    html += '</tr>';

    // Data rows
    for (let i = 1; i < previewLines.length; i++) {
        html += '<tr>';
        const cells = parseCSVLine(previewLines[i], delimiter);
        cells.forEach(cell => {
            html += `<td style="padding: 8px; border: 1px solid var(--border-color);">${escapeHtml(cell)}</td>`;
        });
        html += '</tr>';
    }

    html += '</table>';

    if (hasMore) {
        html += `<div style="margin-top: 10px; color: var(--text-secondary); text-align: center;">... and ${lines.length - 10} more rows</div>`;
    }

    previewDiv.innerHTML = html;
}

// Note: parseCSVLine is now imported from csv-parser.js utility

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
