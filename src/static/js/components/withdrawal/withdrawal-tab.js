/**
 * Withdrawal Strategy tab component
 */

import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';

const WITHDRAWAL_GLOSSARY = {
    taxable: {
        title: 'Taxable Accounts',
        definition: 'Accounts funded with after-tax dollars. Withdrawals are generally tax-free on principal, while gains may be taxed.'
    },
    tax_deferred: {
        title: 'Tax-Deferred Accounts',
        definition: 'Traditional retirement accounts (e.g., 401(k), IRA) where taxes are deferred until withdrawal.'
    },
    roth: {
        title: 'Roth Accounts',
        definition: 'Accounts funded with after-tax dollars where qualified withdrawals are generally tax-free.'
    },
    rmd: {
        title: 'RMD (Required Minimum Distribution)',
        definition: 'Minimum annual withdrawal required from certain retirement accounts starting at age 73 under current rules.'
    },
    social_security_taxation: {
        title: 'Social Security Taxation',
        definition: 'Depending on combined income, a portion of Social Security benefits may be taxable at the federal level.'
    },
    tax_bracket_management: {
        title: 'Tax Bracket Management',
        definition: 'Planning withdrawals to stay within targeted tax brackets and avoid unnecessary marginal-rate increases.'
    },
    withdrawal_rate: {
        title: 'Withdrawal Rate',
        definition: 'The annual percentage of your portfolio withdrawn for spending. It affects sustainability and depletion risk.'
    },
    tax_efficient_sequence: {
        title: 'Tax-Efficient Withdrawal Sequence',
        definition: 'A common strategy that uses taxable assets first, tax-deferred accounts second, and Roth accounts last to improve tax flexibility over time.'
    }
};

function glossaryTerm(label, key) {
    return `<button type="button" class="withdrawal-glossary-term" data-glossary="${key}" style="background:none;border:none;color:inherit;font:inherit;font-weight:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;padding:0;" title="Click for definition">${label}</button>`;
}

function wireGlossaryClicks(root) {
    if (!root) return;
    root.querySelectorAll('.withdrawal-glossary-term').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGlossaryDefinition(el.dataset.glossary);
        });
    });
}

function showGlossaryDefinition(key) {
    const item = WITHDRAWAL_GLOSSARY[key];
    if (!item) return;

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; max-width: 540px; width: 100%; border: 2px solid var(--accent-color);">
                <h3 style="margin: 0 0 10px 0; color: var(--accent-color);">${item.title}</h3>
                <p style="margin: 0; line-height: 1.6; color: var(--text-primary);">${item.definition}</p>
                <div style="margin-top: 16px; text-align: right;">
                    <button id="close-withdrawal-glossary-definition" style="padding: 8px 16px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-withdrawal-glossary-definition').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

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
                <button id="go-to-welcome-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Required Minimum Distributions (RMDs)" data-title="RMD Rules" style="cursor: pointer; color: var(--accent-color); margin-bottom: 4px;">${glossaryTerm('RMDs', 'rmd')} start at age 73</li>
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Social Security Taxation" data-title="Social Security Taxes" style="cursor: pointer; color: var(--accent-color); margin-bottom: 4px;">${glossaryTerm('Social Security', 'social_security_taxation')} may be taxable</li>
                                <li class="learn-link" data-skill="tax-strategy-SKILL.md" data-section="Federal Income Tax Brackets (2024)" data-title="Tax Bracket Management" style="cursor: pointer; color: var(--accent-color);">${glossaryTerm('Active bracket management', 'tax_bracket_management')}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Steps -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Taxable Section -->
                        <div class="strategy-card" data-target="list-taxable" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--success-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">1️⃣ ${glossaryTerm('Taxable', 'taxable')} Accounts First</h3>
                                <span class="toggle-icon" style="font-size: 10px;">▶</span>
                            </div>
                            <div id="list-taxable" style="display: none; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                ${renderConstituentAccounts(taxableAccounts)}
                            </div>
                        </div>

                        <!-- Tax-Deferred Section -->
                        <div class="strategy-card" data-target="list-deferred" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--info-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">2️⃣ ${glossaryTerm('Tax-Deferred', 'tax_deferred')} Second</h3>
                                <span class="toggle-icon" style="font-size: 10px;">▶</span>
                            </div>
                            <div id="list-deferred" style="display: none; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                ${renderConstituentAccounts(taxDeferredAccounts)}
                            </div>
                        </div>

                        <!-- Roth Section -->
                        <div class="strategy-card" data-target="list-roth" style="background: var(--bg-primary); padding: 10px; border-radius: 6px; border-left: 4px solid var(--accent-color); cursor: pointer; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 13px;">3️⃣ ${glossaryTerm('Roth', 'roth')} Accounts Last</h3>
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
    wireGlossaryClicks(container);
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
            <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">${glossaryTerm('Withdrawal Rate', 'withdrawal_rate')}</div>
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
            <div style="font-size: var(--font-base); font-weight: 600; color: var(--text-primary);">${glossaryTerm('Tax-Efficient', 'tax_efficient_sequence')}</div>
            <div style="font-size: var(--font-xs); color: var(--text-light); margin-top: var(--space-1);">${glossaryTerm('Taxable', 'taxable')} → ${glossaryTerm('Deferred', 'tax_deferred')} → ${glossaryTerm('Roth', 'roth')}</div>
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
            if (!targetList) return;

            const title = (card.querySelector('h3')?.textContent || 'Strategy Breakdown').trim();
            showStrategyBreakdownModal(title, targetList.innerHTML);
        });
    });
}

function showStrategyBreakdownModal(title, detailsHtml) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            width: min(760px, 96vw);
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
            display: flex;
            flex-direction: column;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border-color);">
                <h2 style="margin: 0; font-size: 16px;">${title}</h2>
                <button id="close-withdrawal-strategy-modal" aria-label="Close" style="
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 24px;
                    cursor: pointer;
                    line-height: 1;
                ">×</button>
            </div>
            <div style="padding: 14px 16px; overflow: auto;">
                ${detailsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#close-withdrawal-strategy-modal')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
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
