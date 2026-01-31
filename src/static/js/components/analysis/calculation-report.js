/**
 * Calculation Report - Detailed breakdown of all financial calculations
 */

import { store } from '../../state/store.js';
import { showError, showSpinner, hideSpinner } from '../../utils/dom.js';

/**
 * Show calculation report modal
 */
export async function showCalculationReport() {
    const profile = store.get('currentProfile');
    if (!profile) {
        showError('No profile selected');
        return;
    }

    // Show loading
    showSpinner();

    try {
        // Fetch calculation report from backend
        const response = await fetch('/api/analysis/calculation-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                profile_name: profile.name
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate report');
        }

        const report = await response.json();
        hideSpinner();

        // Render the report in a modal
        renderReportModal(report);
    } catch (error) {
        hideSpinner();
        showError(`Failed to generate report: ${error.message}`);
    }
}

/**
 * Render the calculation report in a modal
 */
function renderReportModal(report) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'calculation-report-modal';
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
        z-index: 10000;
        padding: 20px;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    const generated = new Date(report.generated_at).toLocaleString();

    // Build HTML for each section
    const sectionsHTML = report.sections.map(section => `
        <div style="margin-bottom: 32px;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--accent-color); border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">
                ${section.title}
            </h3>
            ${section.note ? `<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; font-style: italic;">${section.note}</p>` : ''}
            <table style="width: 100%; border-collapse: collapse;">
                ${section.items.map(item => `
                    <tr style="border-bottom: 1px solid ${item.is_total ? 'var(--accent-color)' : 'var(--border-color)'};">
                        <td style="padding: 10px 0; color: ${item.is_total ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: ${item.is_total ? '700' : '400'}; font-size: ${item.is_total ? '16px' : '14px'};">
                            ${item.label}
                            ${item.note ? `<br><span style="font-size: 11px; color: var(--success-color); font-weight: 400;">${item.note}</span>` : ''}
                        </td>
                        <td style="padding: 10px 0; text-align: right; font-weight: ${item.is_total ? '700' : '600'}; font-size: ${item.is_total ? '16px' : '14px'}; color: ${
                            item.color === 'positive' ? 'var(--success-color)' :
                            item.color === 'negative' ? 'var(--danger-color)' :
                            item.is_total ? 'var(--text-primary)' : 'var(--text-secondary)'
                        };">
                            ${item.value}
                        </td>
                    </tr>
                `).join('')}
            </table>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <div style="padding: 32px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: var(--text-primary);">
                        📊 Calculation Report
                    </h2>
                    <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                        ${report.profile_name} • Generated ${generated}
                    </p>
                </div>
                <button id="close-report-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Close
                </button>
            </div>

            <div style="background: var(--bg-tertiary); border-left: 4px solid var(--accent-color); padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">About This Report</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                    This report shows detailed calculations for your current financial situation including all income sources,
                    retirement contributions, expenses, taxes, and net cash flow. All amounts are annualized based on your
                    current profile data.
                </p>
            </div>

            ${sectionsHTML}

            <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid var(--border-color); text-align: center;">
                <button id="print-report-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 12px;">
                    🖨️ Print Report
                </button>
                <button id="close-report-btn-2" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Close
                </button>
            </div>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close handlers
    const closeHandler = () => modal.remove();
    modal.querySelector('#close-report-btn').addEventListener('click', closeHandler);
    modal.querySelector('#close-report-btn-2').addEventListener('click', closeHandler);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeHandler();
    });

    // Print handler
    modal.querySelector('#print-report-btn').addEventListener('click', () => {
        window.print();
    });

    // ESC key handler
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeHandler();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}
