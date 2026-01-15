/**
 * Dashboard tab component
 */

import { store } from '../../state/store.js';
import { formatCurrency, formatCompact } from '../../utils/formatters.js';

export function renderDashboardTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to view your dashboard.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};

    // Calculate totals from actual asset data
    const sumAssets = (arr) => (arr || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);
    const liquidAssets = sumAssets(assets.taxable_accounts);
    const retirementAssets = sumAssets(assets.retirement_accounts);
    const realEstateAssets = sumAssets(assets.real_estate);
    const totalAssets = liquidAssets + retirementAssets + realEstateAssets + sumAssets(assets.other_assets);

    // Calculate ages from dates
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = calcAge(profile.birth_date);
    const retirementAge = profile.retirement_date ? calcAge(profile.birth_date) + Math.round((new Date(profile.retirement_date) - new Date()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Dashboard</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Quick Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px;">
                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Liquid Assets</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--success-color);">
                        ${liquidAssets > 0 ? formatCompact(liquidAssets) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Retirement Assets</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--info-color);">
                        ${retirementAssets > 0 ? formatCompact(retirementAssets) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Annual Income</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--accent-color);">
                        ${financial.annual_income ? formatCompact(financial.annual_income) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Annual Expenses</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--warning-color);">
                        ${financial.annual_expenses ? formatCompact(financial.annual_expenses) : 'Not set'}
                    </div>
                </div>
            </div>

            <!-- Profile Summary -->
            <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Profile Summary</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Current Age</div>
                        <div style="font-size: 20px; font-weight: 600;">${currentAge || 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Retirement Date</div>
                        <div style="font-size: 20px; font-weight: 600;">${profile.retirement_date ? new Date(profile.retirement_date).toLocaleDateString() : 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Total Assets</div>
                        <div style="font-size: 20px; font-weight: 600;">${totalAssets > 0 ? formatCompact(totalAssets) : 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Social Security</div>
                        <div style="font-size: 20px; font-weight: 600;">${financial.social_security_benefit ? formatCurrency(financial.social_security_benefit) + '/mo' : 'Not set'}</div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Quick Actions</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <button onclick="window.app.showTab('profile')" class="action-btn">
                        ✏️ Edit Profile
                    </button>
                    <button onclick="window.app.showTab('analysis')" class="action-btn">
                        📊 Run Analysis
                    </button>
                    <button onclick="window.app.showTab('comparison')" class="action-btn">
                        🔄 Compare Scenarios
                    </button>
                    <button onclick="window.app.showTab('actions')" class="action-btn">
                        ✅ View Action Items
                    </button>
                </div>
            </div>
        </div>

        <style>
            .stat-card {
                background: var(--bg-secondary);
                padding: 20px;
                border-radius: 12px;
                border: 1px solid var(--border-color);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow);
            }
            .action-btn {
                padding: 15px;
                background: var(--accent-color);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
            }
            .action-btn:hover {
                background: var(--accent-hover);
                transform: translateY(-2px);
            }
        </style>
    `;
}
