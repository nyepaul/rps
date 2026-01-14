/**
 * Comparison tab component - Compare scenarios
 */

import { store } from '../../state/store.js';

export function renderComparisonTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔄</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to compare scenarios.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Scenario Comparison</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <div style="background: var(--bg-secondary); padding: 40px; border-radius: 12px; text-align: center;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔄</div>
                <h2 style="font-size: 28px; margin-bottom: 15px;">Scenario Comparison</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                    Compare different retirement scenarios side-by-side to understand the impact of various decisions.
                </p>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 40px;">
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px;">
                        <h3 style="margin-bottom: 10px;">📊 What-If Analysis</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">Compare different retirement ages, savings rates, or investment strategies</p>
                    </div>
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px;">
                        <h3 style="margin-bottom: 10px;">💰 Cost Comparison</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">See how different spending levels affect your retirement timeline</p>
                    </div>
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px;">
                        <h3 style="margin-bottom: 10px;">📈 Investment Mix</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">Compare conservative vs aggressive investment allocations</p>
                    </div>
                </div>

                <div style="margin-top: 40px;">
                    <p style="color: var(--text-light); font-size: 14px; margin-bottom: 15px;">
                        This feature is coming soon! In the meantime, you can:
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="window.app.showTab('analysis')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Run Analysis
                        </button>
                        <button onclick="window.app.showTab('advisor')" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                            Ask AI Advisor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
