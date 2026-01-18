/**
 * Summary tab component - Reports and summaries
 */

import { store } from '../../state/store.js';
import { API_ENDPOINTS } from '../../config.js';
import { showError, showSuccess } from '../../utils/dom.js';

// Generate PDF report
async function generatePdf(container, reportType, profileName, buttonSelector) {
    const button = container.querySelector(buttonSelector);
    if (!button) return;
    const originalText = button.textContent;

    try {
        // Update button state
        button.disabled = true;
        button.innerHTML = `
            <span class="pdf-spinner"></span>
            Generating...
        `;

        const endpoint = API_ENDPOINTS[`REPORT_${reportType.toUpperCase()}`];
        if (!endpoint) {
            throw new Error('Unknown report type');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ profile_name: profileName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate PDF');
        }

        // Get the PDF blob
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profileName}_${reportType}_report.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded successfully!`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        showError(error.message || 'Failed to generate PDF');
    } finally {
        // Restore button state
        button.disabled = false;
        button.textContent = originalText;
    }
}

export function renderSummaryTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📄</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to generate reports.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 12px 16px;">
            <h1 style="font-size: 18px; margin-bottom: 6px; font-weight: 600;">Reports & Summary</h1>
            <p style="color: var(--text-secondary); margin-bottom: 12px; font-size: 13px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="font-size: 40px; margin-bottom: 8px;">📊</div>
                    <h2 style="font-size: 18px; margin-bottom: 8px; font-weight: 600;">Comprehensive Reports</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; font-size: 13px;">
                        Generate detailed PDF reports with analysis, portfolio summaries, and action plans.
                    </p>
                </div>

                <div style="display: grid; gap: 12px; margin-bottom: 16px;">
                    <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="font-size: 24px;">📈</div>
                            <div style="flex: 1;">
                                <h3 style="font-size: 15px; margin-bottom: 6px; font-weight: 600;">Analysis Report</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 12px;">
                                    Monte Carlo simulation results, success rates, scenario comparisons, and statistical analysis.
                                </p>
                                <button id="btn-analysis-pdf" class="pdf-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Download PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="font-size: 24px;">💼</div>
                            <div style="flex: 1;">
                                <h3 style="font-size: 15px; margin-bottom: 6px; font-weight: 600;">Portfolio Summary</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 12px;">
                                    Current assets breakdown, account allocations, retirement accounts, taxable accounts, and financial overview.
                                </p>
                                <button id="btn-portfolio-pdf" class="pdf-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Download PDF
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--bg-primary); padding: 14px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="font-size: 24px;">✅</div>
                            <div style="flex: 1;">
                                <h3 style="font-size: 15px; margin-bottom: 6px; font-weight: 600;">Action Plan</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 12px;">
                                    Prioritized action items, recommendations, and next steps for optimizing your retirement plan.
                                </p>
                                <button id="btn-action-plan-pdf" class="pdf-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; padding: 12px; background: var(--bg-tertiary); border-radius: 6px;">
                    <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 12px;">
                        Want to see your data in other formats?
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.app.showTab('analysis')" style="padding: 6px 12px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;">
                            View Interactive Analysis
                        </button>
                        <button onclick="window.app.showTab('actions')" style="padding: 6px 12px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Manage Action Items
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .pdf-btn:hover {
                background: var(--accent-hover) !important;
            }
            .pdf-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed !important;
            }
            .pdf-spinner {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: pdf-spin 0.8s linear infinite;
            }
            @keyframes pdf-spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    // Attach event listeners
    const analysisBtn = container.querySelector('#btn-analysis-pdf');
    if (analysisBtn) {
        analysisBtn.addEventListener('click', () => {
            generatePdf(container, 'analysis', profile.name, '#btn-analysis-pdf');
        });
    }

    const portfolioBtn = container.querySelector('#btn-portfolio-pdf');
    if (portfolioBtn) {
        portfolioBtn.addEventListener('click', () => {
            generatePdf(container, 'portfolio', profile.name, '#btn-portfolio-pdf');
        });
    }

    const actionPlanBtn = container.querySelector('#btn-action-plan-pdf');
    if (actionPlanBtn) {
        actionPlanBtn.addEventListener('click', () => {
            generatePdf(container, 'action_plan', profile.name, '#btn-action-plan-pdf');
        });
    }
}
