/**
 * Accounts tab component - Manage accounts and withdrawal strategy
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';

export function renderAccountsTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">💼</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to manage accounts.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const assets = data.assets || {};

    // Calculate totals from actual asset data
    const sumAssets = (arr) => (arr || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);

    const liquidAssets = sumAssets(assets.taxable_accounts);
    const retirementAssets = sumAssets(assets.retirement_accounts);
    const realEstateAssets = sumAssets(assets.real_estate);
    const otherAssets = sumAssets(assets.other_assets);
    // Pensions are monthly income, not lump sum assets
    const totalAssets = liquidAssets + retirementAssets + realEstateAssets + otherAssets;

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Account Management</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Account Overview -->
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Account Summary</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    <div class="account-card">
                        <div class="account-icon">💵</div>
                        <div class="account-type">Liquid Assets</div>
                        <div class="account-balance">${formatCurrency(liquidAssets, 0)}</div>
                        <div class="account-desc">Checking, savings, taxable investments</div>
                    </div>
                    <div class="account-card">
                        <div class="account-icon">🏦</div>
                        <div class="account-type">Retirement Assets</div>
                        <div class="account-balance">${formatCurrency(retirementAssets, 0)}</div>
                        <div class="account-desc">401(k), IRA, Roth IRA accounts</div>
                    </div>
                    <div class="account-card">
                        <div class="account-icon">📊</div>
                        <div class="account-type">Total Assets</div>
                        <div class="account-balance">${formatCurrency(totalAssets, 0)}</div>
                        <div class="account-desc">Combined portfolio value</div>
                    </div>
                </div>
            </div>

            <!-- Withdrawal Strategy -->
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Withdrawal Strategy</h2>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">
                    Plan which accounts to withdraw from first to minimize taxes and maximize portfolio longevity.
                </p>

                <div style="display: grid; gap: 15px;">
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border-left: 4px solid var(--success-color);">
                        <h3 style="margin-bottom: 10px;">1️⃣ Taxable Accounts First</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">
                            Withdraw from taxable accounts early to allow tax-advantaged accounts to grow longer.
                        </p>
                    </div>
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border-left: 4px solid var(--info-color);">
                        <h3 style="margin-bottom: 10px;">2️⃣ Tax-Deferred Accounts Second</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">
                            Traditional 401(k) and IRA withdrawals are taxed as ordinary income. Use after taxable accounts.
                        </p>
                    </div>
                    <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border-left: 4px solid var(--accent-color);">
                        <h3 style="margin-bottom: 10px;">3️⃣ Roth Accounts Last</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">
                            Let Roth accounts grow tax-free as long as possible. These provide maximum flexibility.
                        </p>
                    </div>
                </div>

                <div style="margin-top: 25px; padding: 20px; background: var(--warning-bg); border-radius: 8px;">
                    <strong>⚠️ Important Considerations:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px; color: var(--text-secondary);">
                        <li>Required Minimum Distributions (RMDs) start at age 73</li>
                        <li>Social Security benefits may be taxed depending on income</li>
                        <li>Consider tax bracket management in each year</li>
                        <li>Healthcare subsidies may be affected by income</li>
                    </ul>
                </div>
            </div>

            <!-- Account Details (Placeholder) -->
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Detailed Account Management</h2>
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🚧</div>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Advanced account tracking and management features coming soon!
                    </p>
                    <p style="color: var(--text-light); font-size: 14px; margin-bottom: 20px;">
                        Future features will include:
                    </p>
                    <ul style="text-align: left; display: inline-block; color: var(--text-secondary); font-size: 14px;">
                        <li>Individual account tracking</li>
                        <li>Asset allocation by account</li>
                        <li>Tax-efficient rebalancing</li>
                        <li>Withdrawal sequence optimization</li>
                        <li>RMD calculations and tracking</li>
                    </ul>
                    <div style="margin-top: 30px;">
                        <button onclick="window.app.showTab('profile')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px;">
                            Edit Profile Data
                        </button>
                        <button onclick="window.app.showTab('analysis')" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                            Run Analysis
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .account-card {
                background: var(--bg-primary);
                padding: 25px;
                border-radius: 8px;
                text-align: center;
                border: 2px solid var(--border-color);
                transition: all 0.2s;
            }
            .account-card:hover {
                border-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow);
            }
            .account-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            .account-type {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .account-balance {
                font-size: 28px;
                font-weight: bold;
                color: var(--accent-color);
                margin-bottom: 10px;
            }
            .account-desc {
                font-size: 13px;
                color: var(--text-light);
            }
        </style>
    `;
}
