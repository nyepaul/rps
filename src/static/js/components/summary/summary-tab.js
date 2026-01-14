/**
 * Summary tab component - Reports and summaries
 */

import { store } from '../../state/store.js';

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
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Reports & Summary</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <div style="background: var(--bg-secondary); padding: 40px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                    <h2 style="font-size: 28px; margin-bottom: 15px;">Comprehensive Reports</h2>
                    <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto;">
                        Generate detailed PDF reports with charts, analysis, and recommendations for your retirement plan.
                    </p>
                </div>

                <div style="display: grid; gap: 20px; margin-bottom: 30px;">
                    <div style="background: var(--bg-primary); padding: 25px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <h3 style="font-size: 20px; margin-bottom: 10px;">📈 Analysis Report</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Monte Carlo simulation results, success rates, and statistical analysis
                        </p>
                        <button onclick="alert('PDF generation coming soon!')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Generate PDF
                        </button>
                    </div>

                    <div style="background: var(--bg-primary); padding: 25px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <h3 style="font-size: 20px; margin-bottom: 10px;">💼 Portfolio Summary</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Current assets, allocation, and projected growth over time
                        </p>
                        <button onclick="alert('PDF generation coming soon!')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Generate PDF
                        </button>
                    </div>

                    <div style="background: var(--bg-primary); padding: 25px; border-radius: 8px; border: 2px solid var(--border-color);">
                        <h3 style="font-size: 20px; margin-bottom: 10px;">✅ Action Plan</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Prioritized recommendations and next steps for optimizing your retirement
                        </p>
                        <button onclick="alert('PDF generation coming soon!')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Generate PDF
                        </button>
                    </div>
                </div>

                <div style="text-align: center; padding: 20px; background: var(--info-bg); border-radius: 8px;">
                    <p style="color: var(--text-secondary); margin-bottom: 15px;">
                        PDF report generation is coming soon! In the meantime, you can:
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="window.app.showTab('analysis')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            View Analysis
                        </button>
                        <button onclick="window.app.showTab('actions')" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                            View Action Items
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
