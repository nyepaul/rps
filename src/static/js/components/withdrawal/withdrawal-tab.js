/**
 * Withdrawal Strategy tab component
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';

export function renderWithdrawalTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">🔄</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to view withdrawal strategy.
                </p>
                <button id="go-to-welcome-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
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

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="margin-bottom: var(--space-3);">
                <h1 style="font-size: var(--font-2xl); margin: 0;">Withdrawal Strategy</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    Tax-efficient withdrawal sequencing for <strong>${profile.name}</strong>
                </p>
            </div>

            <div style="background: var(--bg-secondary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border: 1px solid var(--border-color);">
                <h2 style="font-size: 16px; margin-bottom: var(--space-3); color: var(--accent-color);">🔄 Strategy Overview</h2>

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
        </div>
    `;

    setupWithdrawalStrategyToggles(container);
    // Note: Learn links functionality would need importing showArticle if needed,
    // but the links exist in HTML. We should probably add the handler back if we want them to work.
    // For now, I'll add a simple handler if learn links exist.
    setupLearnLinks(container);
}

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

function setupLearnLinks(container) {
    // Dynamic import to avoid circular dependencies if any
    container.querySelectorAll('.learn-link').forEach(link => {
        link.addEventListener('click', async () => {
            try {
                const { showArticle } = await import('../learn/learn-tab.js');
                const article = {
                    title: link.dataset.title,
                    skillFile: link.dataset.skill,
                    section: link.dataset.section
                };
                showArticle(article);
            } catch (e) {
                console.error('Error loading learn module', e);
            }
        });
    });
}
