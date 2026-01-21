/**
 * Accounts tab component - Manage accounts and withdrawal strategy
 */

import { store } from '../../state/store.js';
import { formatCurrency, formatPercent } from '../../utils/formatters.js';
import { showArticle } from '../learn/learn-tab.js';
import { analysisAPI } from '../../api/analysis.js';

export function renderAccountsTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">💼</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to manage accounts.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const assets = data.assets || {};

    // Filter assets by withdrawal category
    const taxableAccounts = assets.taxable_accounts || [];
    const taxDeferredAccounts = (assets.retirement_accounts || []).filter(a => 
        !a.type.includes('roth') && !a.name.toLowerCase().includes('roth')
    );
    const rothAccounts = (assets.retirement_accounts || []).filter(a => 
        a.type.includes('roth') || a.name.toLowerCase().includes('roth')
    );

    // Calculate totals from actual asset data
    const sumAssets = (arr) => (arr || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);

    const liquidAssets = sumAssets(taxableAccounts);
    const retirementAssets = sumAssets(assets.retirement_accounts);
    const realEstateAssets = sumAssets(assets.real_estate);
    const otherAssets = sumAssets(assets.other_assets);
    const totalAssets = liquidAssets + retirementAssets + realEstateAssets + otherAssets;

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="margin-bottom: var(--space-3);">
                <h1 style="font-size: var(--font-2xl); margin: 0;">Account Management</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    Withdrawal strategy and asset allocation for <strong>${profile.name}</strong>
                </p>
            </div>

            <!-- Account Overview -->
            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin-bottom: var(--space-3); color: var(--accent-color);">💰 Account Summary</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3);">
                    <div class="account-card" data-category="liquid" style="cursor: pointer; padding: 12px; border-radius: 6px;">
                        <div class="account-type" style="font-size: 10px; margin-bottom: 4px;">Liquid Assets</div>
                        <div class="account-balance" style="font-size: 20px; margin-bottom: 2px;">${formatCurrency(liquidAssets, 0)}</div>
                        <div class="account-desc" style="font-size: 10px;">Taxable accounts</div>
                    </div>
                    <div class="account-card" data-category="retirement" style="cursor: pointer; padding: 12px; border-radius: 6px;">
                        <div class="account-type" style="font-size: 10px; margin-bottom: 4px;">Retirement Assets</div>
                        <div class="account-balance" style="font-size: 20px; margin-bottom: 2px;">${formatCurrency(retirementAssets, 0)}</div>
                        <div class="account-desc" style="font-size: 10px;">401(k), IRA, Roth</div>
                    </div>
                    <div class="account-card" data-category="total" style="cursor: pointer; padding: 12px; border-radius: 6px;">
                        <div class="account-type" style="font-size: 10px; margin-bottom: 4px;">Total Portfolio</div>
                        <div class="account-balance" style="font-size: 20px; margin-bottom: 2px;">${formatCurrency(totalAssets, 0)}</div>
                        <div class="account-desc" style="font-size: 10px;">Combined value</div>
                    </div>
                </div>

                <!-- Asset List Container -->
                <div id="asset-list-container" style="margin-top: 15px; display: none; border-top: 1px solid var(--border-color); padding-top: 15px; animation: fadeIn 0.3s ease-in-out;">
                    <!-- Content will be injected here -->
                </div>
            </div>

            <!-- Withdrawal Strategy -->
            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin-bottom: var(--space-3); color: var(--accent-color);">🔄 Withdrawal Strategy</h2>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-3);">
                    <!-- Current State & Tips -->
                    <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                        <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--accent-color);">
                            <h3 style="font-size: 13px; margin-bottom: 10px; color: var(--accent-color); font-weight: 700;">📊 ACTIVE RATE</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                ${renderCurrentWithdrawalState(data)}
                            </div>
                        </div>
                        <div style="padding: 12px; background: var(--warning-bg); border-radius: 6px; border: 1px solid var(--warning-color);">
                            <strong style="font-size: 12px;">💡 Planning Keys:</strong>
                            <ul style="margin: 8px 0 0 0; padding-left: 18px; color: var(--text-secondary); font-size: 11px; line-height: 1.4;">
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Required Minimum Distributions (RMDs)" data-title="RMD Rules" style="cursor: pointer; color: var(--accent-color); margin-bottom: 4px;">RMDs start at age 73</li>
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Social Security Taxation" data-title="Social Security Taxes" style="cursor: pointer; color: var(--accent-color); margin-bottom: 4px;">Social Security may be taxable</li>
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Federal Income Tax Brackets (2024)" data-title="Tax Bracket Management" style="cursor: pointer; color: var(--accent-color);">Active bracket management</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Steps -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Taxable Section -->
                        <div class="strategy-card" data-target="list-taxable" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--success-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">1️⃣ Taxable Accounts First</h3>
                                <span class="toggle-icon" style="font-size: 10px;">▶</span>
                            </div>
                            <div id="list-taxable" style="display: none; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                ${renderConstituentAccounts(taxableAccounts)}
                            </div>
                        </div>

                        <!-- Tax-Deferred Section -->
                        <div class="strategy-card" data-target="list-deferred" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--info-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">2️⃣ Tax-Deferred Second</h3>
                                <span class="toggle-icon" style="font-size: 10px;">▶</span>
                            </div>
                            <div id="list-deferred" style="display: none; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                ${renderConstituentAccounts(taxDeferredAccounts)}
                            </div>
                        </div>

                        <!-- Roth Section -->
                        <div class="strategy-card" data-target="list-roth" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--accent-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">3️⃣ Roth Accounts Last</h3>
                                <span class="toggle-icon" style="font-size: 10px;">▶</span>
                            </div>
                            <div id="list-roth" style="display: none; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                ${renderConstituentAccounts(rothAccounts)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rebalancing and Asset Allocation -->
            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);" id="rebalancing-section">
                <h2 style="font-size: 16px; margin-bottom: var(--space-3); color: var(--accent-color);">⚖️ Allocation & Rebalancing</h2>
                
                <div style="display: grid; grid-template-columns: 300px 1fr; gap: var(--space-3);">
                    <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <h3 style="font-size: 12px; margin-bottom: 10px; font-weight: 700;">TARGETS</h3>
                        <div style="display: grid; gap: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-size: 11px;">Stocks %</label>
                                <input type="number" id="target-stocks" style="width: 60px; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px;" value="60">
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-size: 11px;">Bonds %</label>
                                <input type="number" id="target-bonds" style="width: 60px; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px;" value="40">
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-size: 11px;">Cash %</label>
                                <input type="number" id="target-cash" style="width: 60px; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px;" value="0">
                            </div>
                        </div>
                        <button id="run-rebalancing" style="margin-top: 12px; width: 100%; padding: 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            Analyze
                        </button>
                    </div>

                    <div id="rebalancing-results" style="display: none;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                    <thead>
                                        <tr style="text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">
                                            <th style="padding: 4px;">Class</th>
                                            <th style="padding: 4px;">Cur</th>
                                            <th style="padding: 4px;">Tgt</th>
                                            <th style="padding: 4px; text-align: right;">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody id="allocation-table-body"></tbody>
                                </table>
                            </div>
                            <div id="rebalancing-recommendations" style="font-size: 11px; color: var(--text-secondary);"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RMD Estimates -->
            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin-bottom: var(--space-3); color: var(--accent-color);">📅 RMD Projections</h2>
                <div id="rmd-content"></div>
            </div>
        </div>

        <style>
            .account-card {
                background: var(--bg-primary);
                padding: var(--space-5);
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
                margin-bottom: var(--space-4);
            }
            .account-type {
                font-size: var(--font-base);
                color: var(--text-secondary);
                margin-bottom: var(--space-3);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .account-balance {
                font-size: var(--font-3xl);
                font-weight: bold;
                color: var(--accent-color);
                margin-bottom: var(--space-3);
            }
            .account-desc {
                font-size: var(--font-sm);
                color: var(--text-light);
            }
            .rmd-info-box:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px var(--shadow);
            }
        </style>
    `;

    setupAccountCardInteractions(container, assets);
    setupLearnLinks(container);
    setupRebalancing(container, profile.name);
    setupRMD(container, profile, assets);
    setupWithdrawalStrategyToggles(container);
}

/**
 * Render current withdrawal state from profile
 */
function renderCurrentWithdrawalState(data) {
    const withdrawalStrategy = data.withdrawal_strategy || {};
    const withdrawalRate = withdrawalStrategy.withdrawal_rate || 0.04;
    const withdrawalRatePercent = (withdrawalRate * 100).toFixed(1);

    // Calculate total portfolio value for reference
    const assets = data.assets || {};
    const taxableValue = (assets.taxable_accounts || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const retirementValue = (assets.retirement_accounts || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const totalPortfolio = taxableValue + retirementValue;
    const annualWithdrawal = totalPortfolio * withdrawalRate;

    return `
        <div style="text-align: center;">
            <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">Withdrawal Rate</div>
            <div style="font-size: var(--font-2xl); font-weight: bold; color: var(--accent-color);">${withdrawalRatePercent}%</div>
            <div style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">Annual rate</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">Annual Amount</div>
            <div style="font-size: var(--font-2xl); font-weight: bold; color: var(--success-color);">${formatCurrency(annualWithdrawal, 0)}</div>
            <div style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">Based on current portfolio</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">Strategy</div>
            <div style="font-size: var(--font-base); font-weight: 600; color: var(--text-primary);">Tax-Efficient</div>
            <div style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">Taxable → Deferred → Roth</div>
        </div>
    `;
}

/**
 * Render a simple list of accounts for the withdrawal strategy section
 */
function renderConstituentAccounts(accounts) {
    if (!accounts || accounts.length === 0) {
        return '<p style="font-size: var(--font-sm); color: var(--text-light); font-style: italic;">No accounts found in this category.</p>';
    }

    return `
        <div style="display: grid; gap: var(--space-2);">
            ${accounts.map(acc => `
                <div style="display: flex; justify-content: space-between; font-size: var(--font-base); padding: var(--space-1) 0;">
                    <span>${acc.name}</span>
                    <span style="font-family: monospace; font-weight: 500;">${formatCurrency(acc.value, 0)}</span>
                </div>
            `).join('')}
            <div style="border-top: 1px dashed var(--border-color); margin-top: var(--space-1); padding-top: var(--space-1); display: flex; justify-content: space-between; font-weight: bold; font-size: var(--font-base);">
                <span>Total</span>
                <span>${formatCurrency(accounts.reduce((sum, a) => sum + (a.value || 0), 0), 0)}</span>
            </div>
        </div>
    `;
}

/**
 * Set up click listeners for the withdrawal strategy cards
 */
function setupWithdrawalStrategyToggles(container) {
    const cards = container.querySelectorAll('.strategy-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            const targetId = card.dataset.target;
            const targetList = container.querySelector(`#${targetId}`);
            const icon = card.querySelector('.toggle-icon');
            
            if (targetList.style.display === 'none') {
                targetList.style.display = 'block';
                icon.textContent = '▼';
                icon.style.transform = 'rotate(0deg)';
                card.style.transform = 'scale(1.01)';
            } else {
                targetList.style.display = 'none';
                icon.textContent = '▶';
                card.style.transform = 'scale(1)';
            }
        });
    });
}

function setupRebalancing(container, profileName) {
    const runBtn = container.querySelector('#run-rebalancing');
    if (!runBtn) return;

    runBtn.addEventListener('click', async () => {
        const targetStocks = parseFloat(container.querySelector('#target-stocks').value) / 100;
        const targetBonds = parseFloat(container.querySelector('#target-bonds').value) / 100;
        const targetCash = parseFloat(container.querySelector('#target-cash').value) / 100;

        const targetAllocation = {
            stocks: targetStocks,
            bonds: targetBonds,
            cash: targetCash
        };

        try {
            runBtn.disabled = true;
            runBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analyzing...';
            
            const data = await analysisAPI.analyzeRebalancing(profileName, targetAllocation);
            
            const tableBody = container.querySelector('#allocation-table-body');
            const recsList = container.querySelector('#rebalancing-recommendations');
            const resultsDiv = container.querySelector('#rebalancing-results');
            
            const { current_allocation, target_allocation, imbalance_dollars } = data;
            
            tableBody.innerHTML = `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px;">Stocks</td>
                    <td style="padding: 10px;">${formatPercent(current_allocation.stocks)}</td>
                    <td style="padding: 10px;">${formatPercent(target_allocation.stocks)}</td>
                    <td style="padding: 10px; text-align: right; color: ${imbalance_dollars.stocks < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">
                        ${formatCurrency(imbalance_dollars.stocks, 0)}
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px;">Bonds</td>
                    <td style="padding: 10px;">${formatPercent(current_allocation.bonds)}</td>
                    <td style="padding: 10px;">${formatPercent(target_allocation.bonds)}</td>
                    <td style="padding: 10px; text-align: right; color: ${imbalance_dollars.bonds < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">
                        ${formatCurrency(imbalance_dollars.bonds, 0)}
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px;">Cash</td>
                    <td style="padding: 10px;">${formatPercent(current_allocation.cash)}</td>
                    <td style="padding: 10px;">${formatPercent(target_allocation.cash)}</td>
                    <td style="padding: 10px; text-align: right; color: ${imbalance_dollars.cash < 0 ? 'var(--danger-color)' : 'var(--success-color)'}">
                        ${formatCurrency(imbalance_dollars.cash, 0)}
                    </td>
                </tr>
                <tr style="background: var(--bg-tertiary); font-weight: bold;">
                    <td style="padding: 10px;">Total</td>
                    <td colspan="3" style="padding: 10px; text-align: right;">${formatCurrency(data.total_value, 0)}</td>
                </tr>
            `;

            recsList.innerHTML = data.recommendations.map(rec => `
                <li style="padding: 10px; margin-bottom: 10px; background: var(--bg-primary); border-radius: 6px; border-left: 4px solid var(--accent-color);">
                    ${rec}
                </li>
            `).join('');
            
            resultsDiv.style.display = 'block';
        } catch (error) {
            console.error('Rebalancing analysis failed:', error);
            alert('Analysis failed. Please check your asset data.');
        } finally {
            runBtn.disabled = false;
            runBtn.textContent = 'Analyze Allocation';
        }
    });
}

function setupRMD(container, profile, assets) {
    const rmdContent = container.querySelector('#rmd-content');
    if (!rmdContent) return;

    const retirementAccounts = assets.retirement_accounts || [];
    const preTaxAccounts = retirementAccounts.filter(a => 
        !a.type.includes('roth') && !a.name.toLowerCase().includes('roth')
    );

    if (preTaxAccounts.length === 0) {
        rmdContent.innerHTML = `
            <p style="color: var(--text-secondary); font-style: italic;">No pre-tax retirement accounts found. RMDs do not apply to Roth accounts or taxable brokerage accounts.</p>
        `;
        return;
    }

    const birthDate = new Date(profile.birth_date || '1980-01-01');
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const rmdFactor = getRMDFactor(age < 73 ? 73 : age);
    const totalPreTax = preTaxAccounts.reduce((sum, a) => sum + (a.value || 0), 0);
    const estimatedRMD = totalPreTax / rmdFactor;
    
    let rmdInfo = '';
    if (age < 73) {
        const yearsToRMD = 73 - age;
        rmdInfo = `<p style="color: var(--text-secondary); margin-bottom: 20px;">
            You are <strong>${age}</strong> years old. Your Required Minimum Distributions (RMDs) are estimated to start in <strong>${yearsToRMD}</strong> years (age 73).
        </p>`;
    } else {
        rmdInfo = `<p style="color: var(--text-secondary); margin-bottom: 20px;">
            You are <strong>${age}</strong> years old and subject to Required Minimum Distributions (RMDs).
        </p>`;
    }

    rmdContent.innerHTML = `
        ${rmdInfo}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div class="rmd-info-box" data-target="rmd-detail-assets" style="background: var(--bg-primary); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;">
                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Total Pre-Tax Assets</div>
                <div style="font-size: 24px; font-weight: bold; color: var(--accent-color); margin-top: 5px;">${formatCurrency(totalPreTax, 0)}</div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">Click for breakdown</div>
            </div>
            <div class="rmd-info-box" data-target="rmd-detail-calc" style="background: var(--bg-primary); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;">
                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Estimated Annual RMD</div>
                <div style="font-size: 24px; font-weight: bold; color: var(--success-color); margin-top: 5px;">${formatCurrency(estimatedRMD, 0)}</div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">Click for formula</div>
            </div>
            <div class="rmd-info-box" data-target="rmd-detail-factor" style="background: var(--bg-primary); padding: 20px; border-radius: 8px; text-align: center; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;">
                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">RMD Factor</div>
                <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${rmdFactor}</div>
                <div style="font-size: 11px; color: var(--text-light); margin-top: 5px;">Click for IRS table</div>
            </div>
        </div>

        <!-- Detail Sections -->
        <div id="rmd-detail-assets" class="rmd-detail-pane" style="display: none; background: var(--bg-tertiary); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--accent-color);">
            <h4 style="margin-top: 0; margin-bottom: 10px;">Pre-Tax Asset Breakdown</h4>
            <ul style="margin: 0; padding-left: 20px;">
                ${preTaxAccounts.map(a => `<li>${a.name}: <strong>${formatCurrency(a.value, 0)}</strong></li>`).join('')}
            </ul>
        </div>

        <div id="rmd-detail-calc" class="rmd-detail-pane" style="display: none; background: var(--bg-tertiary); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--success-color);">
            <h4 style="margin-top: 0; margin-bottom: 10px;">RMD Calculation Formula</h4>
            <div style="font-size: 14px;">
                The IRS calculates your Required Minimum Distribution using the following formula:
                <br><br>
                <div style="background: var(--bg-primary); padding: 10px; border-radius: 4px; text-align: center; font-family: monospace;">
                    Annual RMD = (Account Balance as of Dec 31) / (IRS Life Expectancy Factor)
                </div>
                <br>
                In your case: <code>${formatCurrency(totalPreTax, 0)} / ${rmdFactor} = ${formatCurrency(estimatedRMD, 0)}</code>
            </div>
        </div>

        <div id="rmd-detail-factor" class="rmd-detail-pane" style="display: none; background: var(--bg-tertiary); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border-color);">
            <h4 style="margin-top: 0; margin-bottom: 10px;">IRS Uniform Lifetime Table (Snippet)</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; text-align: center;">
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">Age</div>
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">Factor</div>
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">Age</div>
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">Factor</div>
                ${[73, 74, 75, 76, 77, 78, 79, 80].map(a => `
                    <div style="${a === (age < 73 ? 73 : age) ? 'color: var(--accent-color); font-weight: bold;' : ''}">${a}</div>
                    <div style="${a === (age < 73 ? 73 : age) ? 'color: var(--accent-color); font-weight: bold;' : ''}">${getRMDFactor(a)}</div>
                `).join('')}
            </div>
        </div>

        <h3 style="font-size: 18px; margin-bottom: 15px;">Eligible Accounts</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="text-align: left; color: var(--text-secondary); font-size: 13px; border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 10px;">Account Name</th>
                    <th style="padding: 10px; text-align: right;">Balance</th>
                    <th style="padding: 10px; text-align: right;">Est. RMD</th>
                </tr>
            </thead>
            <tbody>
                ${preTaxAccounts.map(a => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px 10px;">${a.name}</td>
                        <td style="padding: 12px 10px; text-align: right; font-family: monospace;">${formatCurrency(a.value, 0)}</td>
                        <td style="padding: 12px 10px; text-align: right; font-family: monospace;">${formatCurrency(a.value / rmdFactor, 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3 style="font-size: 18px; margin-top: 30px; margin-bottom: 15px;">5-Year Projection</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 15px;">Estimated RMDs for the next 5 years, assuming a 5% annual growth rate on account balances.</p>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; color: var(--text-secondary); font-size: 13px; border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 10px;">Year</th>
                        <th style="padding: 10px;">Age</th>
                        <th style="padding: 10px; text-align: right;">Projected Balance</th>
                        <th style="padding: 10px; text-align: right;">Projected RMD</th>
                    </tr>
                </thead>
                <tbody>
                    ${[0, 1, 2, 3, 4].map(yearOffset => {
                        const projAge = age + yearOffset;
                        const projBalance = totalPreTax * Math.pow(1.05, yearOffset);
                        const projFactor = getRMDFactor(projAge < 73 ? 73 : projAge);
                        const projRMD = projBalance / projFactor;
                        return `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 10px;">${today.getFullYear() + yearOffset}</td>
                                <td style="padding: 10px;">${projAge}</td>
                                <td style="padding: 10px; text-align: right; font-family: monospace;">${formatCurrency(projBalance, 0)}</td>
                                <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: 600; color: ${projAge >= 73 ? 'var(--success-color)' : 'var(--text-secondary)'}">
                                    ${formatCurrency(projRMD, 0)}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Add click listeners to RMD info boxes
    const boxes = rmdContent.querySelectorAll('.rmd-info-box');
    boxes.forEach(box => {
        box.addEventListener('click', () => {
            const targetId = box.dataset.target;
            const targetPane = rmdContent.querySelector(`#${targetId}`);
            
            // Check if already visible
            const isVisible = targetPane.style.display === 'block';
            
            // Hide all panes first
            rmdContent.querySelectorAll('.rmd-detail-pane').forEach(p => p.style.display = 'none');
            boxes.forEach(b => {
                b.style.borderColor = 'var(--border-color)';
                b.style.backgroundColor = 'var(--bg-primary)';
            });

            if (!isVisible) {
                targetPane.style.display = 'block';
                box.style.borderColor = 'var(--accent-color)';
                box.style.backgroundColor = 'var(--bg-tertiary)';
            }
        });

        box.addEventListener('mouseenter', () => {
            if (box.style.borderColor !== 'var(--accent-color)') {
                box.style.borderColor = 'var(--text-light)';
            }
        });

        box.addEventListener('mouseleave', () => {
            if (box.style.borderColor !== 'var(--accent-color)') {
                box.style.borderColor = 'var(--border-color)';
            }
        });
    });
}

function getRMDFactor(age) {
    const rmd_factors = {
        73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
        78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
        83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
        88: 13.7, 89: 12.9, 90: 12.2
    };
    if (age < 73) return 26.5;
    return rmd_factors[age] || 12.2;
}

function setupLearnLinks(container) {
    container.querySelectorAll('.learn-link').forEach(link => {
        link.addEventListener('click', () => {
            const article = {
                title: link.dataset.title,
                skillFile: link.dataset.skill,
                section: link.dataset.section
            };
            showArticle(article);
        });
    });
}

function setupAccountCardInteractions(container, assets) {
    const cards = container.querySelectorAll('.account-card');
    const listContainer = container.querySelector('#asset-list-container');
    let activeCategory = null;

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            
            // If clicking the same category, collapse it
            if (activeCategory === category) {
                listContainer.style.display = 'none';
                card.style.borderColor = 'var(--border-color)';
                card.style.backgroundColor = 'var(--bg-primary)';
                activeCategory = null;
                return;
            }

            // Highlight selected card and reset others
            cards.forEach(c => {
                c.style.borderColor = 'var(--border-color)';
                c.style.backgroundColor = 'var(--bg-primary)';
            });
            card.style.borderColor = 'var(--accent-color)';
            card.style.backgroundColor = 'var(--bg-tertiary)';
            
            activeCategory = category;
            let displayAssets = [];
            let title = '';

            if (category === 'liquid') {
                displayAssets = assets.taxable_accounts || [];
                title = 'Liquid Assets';
            } else if (category === 'retirement') {
                displayAssets = assets.retirement_accounts || [];
                title = 'Retirement Assets';
            } else if (category === 'total') {
                displayAssets = [
                    ...(assets.taxable_accounts || []), 
                    ...(assets.retirement_accounts || []),
                    ...(assets.real_estate || []),
                    ...(assets.other_assets || [])
                ];
                title = 'All Assets';
            }

            renderAssetList(listContainer, title, displayAssets);
        });
    });
}

function renderAssetList(container, title, assetList) {
    container.style.display = 'block';
    
    if (assetList.length === 0) {
        container.innerHTML = `
            <h3 style="margin-bottom: 15px; font-size: 18px;">${title}</h3>
            <p style="color: var(--text-secondary); font-style: italic; padding: 10px;">No assets found in this category.</p>
        `;
        return;
    }

    const sortedAssets = [...assetList].sort((a, b) => (b.value || 0) - (a.value || 0));

    container.innerHTML = `
        <h3 style="margin-bottom: 15px; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
            ${title}
            <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary);">
                ${sortedAssets.length} item${sortedAssets.length !== 1 ? 's' : ''}
            </span>
        </h3>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; color: var(--text-secondary); font-size: 13px; border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 10px; font-weight: 600;">Asset Name</th>
                        <th style="padding: 10px; font-weight: 600;">Type</th>
                        <th style="padding: 10px; font-weight: 600;">Allocation (S/B/C)</th>
                        <th style="padding: 10px; text-align: right; font-weight: 600;">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedAssets.map(asset => `
                        <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                            <td style="padding: 12px 10px; font-weight: 500;">${asset.name}</td>
                            <td style="padding: 12px 10px; color: var(--text-secondary); font-size: 14px;">${formatAssetType(asset.type)}</td>
                            <td style="padding: 12px 10px; font-size: 12px; color: var(--text-light);">
                                ${asset.stock_pct !== undefined ? `${Math.round(asset.stock_pct * 100)}/${Math.round(asset.bond_pct * 100)}/${Math.round(asset.cash_pct * 100)}` : 'N/A'}
                            </td>
                            <td style="padding: 12px 10px; text-align: right; font-weight: 500; font-family: monospace; font-size: 14px;">
                                ${formatCurrency(asset.value || 0, 0)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function formatAssetType(type) {
    if (!type) return 'N/A';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}