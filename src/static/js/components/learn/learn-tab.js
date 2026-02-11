/**
 * Learn tab component - Educational content
 */

import { API_ENDPOINTS } from '../../config.js';
import { apiClient } from '../../api/client.js';
import {
    bindFeatureIndexActions,
    createFeatureIndex,
    filterFeatureIndex,
    renderFeatureIndexRows
} from '../../utils/feature-index.js';

// Article definitions mapping to skill files
const ARTICLES = {
    'retirement-basics': {
        section: 'Retirement Basics',
        icon: '📚',
        articles: [
            {
                id: 'four-percent-rule',
                title: 'Understanding the 4% Rule',
                description: 'Learn about the classic withdrawal strategy and its limitations in modern retirement planning.',
                skillFile: 'retirement-planning-SKILL.md',
                section: 'Withdrawal Strategies'
            },
            {
                id: 'account-types',
                title: 'Types of Retirement Accounts',
                description: '401(k), IRA, Roth IRA, and more. Understand the differences and tax implications.',
                skillFile: 'tax-strategy-SKILL.md',
                section: 'Account Types'
            },
            {
                id: 'social-security',
                title: 'Social Security Basics',
                description: 'How Social Security works, when to claim, and strategies to maximize your benefits.',
                skillFile: 'retirement-planning-SKILL.md',
                section: 'Social Security Optimization'
            }
        ]
    },
    'investment-strategies': {
        section: 'Investment Strategies',
        icon: '📈',
        articles: [
            {
                id: 'asset-allocation',
                title: 'Asset Allocation',
                description: 'Balance risk and return with the right mix of stocks, bonds, and other investments.',
                skillFile: 'investment-policy-SKILL.md',
                section: 'Asset Allocation'
            },
            {
                id: 'rebalancing',
                title: 'Rebalancing Your Portfolio',
                description: 'Maintain your target allocation and manage risk as markets fluctuate.',
                skillFile: 'investment-policy-SKILL.md',
                section: 'Rebalancing'
            },
            {
                id: 'dollar-cost-averaging',
                title: 'Dollar Cost Averaging',
                description: 'Reduce market timing risk by investing consistently over time.',
                skillFile: 'investment-policy-SKILL.md',
                section: 'Investment Strategies'
            }
        ]
    },
    'tax-optimization': {
        section: 'Tax Optimization',
        icon: '💰',
        articles: [
            {
                id: 'roth-conversions',
                title: 'Roth Conversions',
                description: 'Convert traditional retirement accounts to Roth for tax-free growth and withdrawals.',
                skillFile: 'tax-strategy-SKILL.md',
                section: 'Roth Conversion'
            },
            {
                id: 'withdrawal-strategies',
                title: 'Tax-Efficient Withdrawal Strategies',
                description: 'Minimize taxes by withdrawing from accounts in the optimal order.',
                skillFile: 'retirement-planning-SKILL.md',
                section: 'Tax-Efficient Withdrawal Sequencing'
            },
            {
                id: 'rmds',
                title: 'Required Minimum Distributions (RMDs)',
                description: 'Understand RMD rules and strategies to manage them effectively.',
                skillFile: 'tax-strategy-SKILL.md',
                section: 'RMDs'
            }
        ]
    },
    'advanced-topics': {
        section: 'Advanced Topics',
        icon: '🎯',
        articles: [
            {
                id: 'monte-carlo',
                title: 'Monte Carlo Simulation',
                description: 'Understand how probabilistic analysis helps plan for uncertainty in retirement.',
                skillFile: 'retirement-planning-SKILL.md',
                section: 'Monte Carlo Simulation Framework'
            },
            {
                id: 'sequence-risk',
                title: 'Sequence of Returns Risk',
                description: 'Why the order of investment returns matters more than average returns in retirement.',
                skillFile: 'retirement-planning-SKILL.md',
                section: 'Sequence of Returns Risk'
            },
            {
                id: 'healthcare-planning',
                title: 'Healthcare Planning',
                description: 'Plan for Medicare, supplemental insurance, and long-term care costs.',
                skillFile: 'healthcare-gap-SKILL.md',
                section: 'Healthcare Planning'
            }
        ]
    }
};

// Curated acronym glossary used throughout the app UI and reports.
const ACRONYM_GLOSSARY = [
    { term: '401(k)', category: 'Retirement', definition: 'Employer-sponsored defined-contribution retirement plan in the U.S.' },
    { term: '403(b)', category: 'Retirement', definition: 'Tax-advantaged retirement plan commonly used by public schools and nonprofits.' },
    { term: '457(b)', category: 'Retirement', definition: 'Deferred compensation retirement plan often used by government and certain nonprofit employees.' },
    { term: 'IRA', category: 'Retirement', definition: 'Individual Retirement Account with tax-advantaged savings rules.' },
    { term: 'SEP IRA', category: 'Retirement', definition: 'Simplified Employee Pension IRA, often used by self-employed individuals and small businesses.' },
    { term: 'SIMPLE IRA', category: 'Retirement', definition: 'Savings Incentive Match Plan for Employees IRA for small employers.' },
    { term: 'RMD', category: 'Retirement', definition: 'Required Minimum Distribution: mandatory annual withdrawals from certain retirement accounts starting at a specific age.' },
    { term: 'Roth IRA', category: 'Retirement', definition: 'IRA funded with after-tax dollars; qualified withdrawals are tax-free.' },
    { term: 'Roth 401(k)', category: 'Retirement', definition: '401(k) sub-account funded after-tax with tax-free qualified withdrawals.' },
    { term: 'COLA', category: 'Retirement', definition: 'Cost-of-Living Adjustment, commonly used for benefit or income inflation adjustments.' },
    { term: 'SS', category: 'Retirement', definition: 'Social Security benefits in retirement planning context.' },
    { term: 'SSA', category: 'Retirement', definition: 'Social Security Administration.' },
    { term: 'FRA', category: 'Retirement', definition: 'Full Retirement Age for Social Security benefits.' },
    { term: 'AIME', category: 'Retirement', definition: 'Average Indexed Monthly Earnings used in Social Security benefit calculations.' },
    { term: 'PIA', category: 'Retirement', definition: 'Primary Insurance Amount: baseline monthly Social Security benefit at FRA.' },
    { term: 'AGI', category: 'Tax', definition: 'Adjusted Gross Income used as a starting point for many tax calculations.' },
    { term: 'MAGI', category: 'Tax', definition: 'Modified Adjusted Gross Income used for eligibility and phaseout rules.' },
    { term: 'MFJ', category: 'Tax', definition: 'Married Filing Jointly tax filing status.' },
    { term: 'MFS', category: 'Tax', definition: 'Married Filing Separately tax filing status.' },
    { term: 'HOH', category: 'Tax', definition: 'Head of Household tax filing status.' },
    { term: 'STCG', category: 'Tax', definition: 'Short-Term Capital Gains, typically taxed at ordinary income rates.' },
    { term: 'LTCG', category: 'Tax', definition: 'Long-Term Capital Gains tax category for assets held over one year.' },
    { term: 'QBI', category: 'Tax', definition: 'Qualified Business Income deduction concept for eligible business income.' },
    { term: 'IRMAA', category: 'Tax/Healthcare', definition: 'Income-Related Monthly Adjustment Amount for Medicare premiums.' },
    { term: 'FICA', category: 'Tax', definition: 'Federal payroll taxes for Social Security and Medicare.' },
    { term: 'SALT', category: 'Tax', definition: 'State and Local Tax deduction category in U.S. federal tax calculations.' },
    { term: 'AMT', category: 'Tax', definition: 'Alternative Minimum Tax.' },
    { term: 'IRS', category: 'Tax', definition: 'Internal Revenue Service.' },
    { term: 'HSA', category: 'Healthcare', definition: 'Health Savings Account with tax advantages for qualified medical expenses.' },
    { term: 'HMO', category: 'Healthcare', definition: 'Health Maintenance Organization insurance plan type.' },
    { term: 'PPO', category: 'Healthcare', definition: 'Preferred Provider Organization insurance plan type.' },
    { term: 'ACA', category: 'Healthcare', definition: 'Affordable Care Act health insurance framework.' },
    { term: 'LTC', category: 'Healthcare', definition: 'Long-Term Care.' },
    { term: 'HOA', category: 'Housing', definition: 'Homeowners Association fee/organization for managed communities.' },
    { term: 'REIT', category: 'Investment', definition: 'Real Estate Investment Trust.' },
    { term: 'APY', category: 'Investment', definition: 'Annual Percentage Yield including compounding.' },
    { term: 'ETF', category: 'Investment', definition: 'Exchange-Traded Fund.' },
    { term: 'NAV', category: 'Investment', definition: 'Net Asset Value.' },
    { term: 'YTD', category: 'Investment', definition: 'Year-To-Date performance period.' },
    { term: 'CAGR', category: 'Investment', definition: 'Compound Annual Growth Rate.' },
    { term: 'DCA', category: 'Investment', definition: 'Dollar-Cost Averaging investment strategy.' },
    { term: 'CPI', category: 'Economics', definition: 'Consumer Price Index, a common inflation benchmark.' },
    { term: 'GDP', category: 'Economics', definition: 'Gross Domestic Product.' },
    { term: 'RPS', category: 'App', definition: 'Retirement Planning System (this application).' },
    { term: 'AI', category: 'App', definition: 'Artificial Intelligence features/providers used by advisor tools.' },
    { term: 'LLM', category: 'App', definition: 'Large Language Model used by AI advisory integrations.' },
    { term: 'UI', category: 'App', definition: 'User Interface.' },
    { term: 'UX', category: 'App', definition: 'User Experience.' },
    { term: 'API', category: 'Technical', definition: 'Application Programming Interface used for frontend/backend communication.' },
    { term: 'CSRF', category: 'Security', definition: 'Cross-Site Request Forgery protection token/mechanism.' },
    { term: 'CSP', category: 'Security', definition: 'Content Security Policy browser security header.' },
    { term: 'DEK', category: 'Security', definition: 'Data Encryption Key used to encrypt user-sensitive fields.' },
    { term: 'IV', category: 'Security', definition: 'Initialization Vector used with encryption algorithms.' },
    { term: 'AES', category: 'Security', definition: 'Advanced Encryption Standard.' },
    { term: 'GCM', category: 'Security', definition: 'Galois/Counter Mode (an authenticated encryption mode).' },
    { term: 'PBKDF2', category: 'Security', definition: 'Password-Based Key Derivation Function 2.' },
    { term: 'TLS', category: 'Security', definition: 'Transport Layer Security protocol used for encrypted network connections.' },
    { term: 'MFA', category: 'Security', definition: 'Multi-Factor Authentication.' },
    { term: 'PII', category: 'Security', definition: 'Personally Identifiable Information.' },
    { term: 'JSON', category: 'Technical', definition: 'JavaScript Object Notation data format used in API payloads.' },
    { term: 'NDJSON', category: 'Technical', definition: 'Newline-Delimited JSON format.' },
    { term: 'CSV', category: 'Technical', definition: 'Comma-Separated Values file format for table data import/export.' },
    { term: 'PDF', category: 'Technical', definition: 'Portable Document Format used for generated reports.' },
    { term: 'SQL', category: 'Technical', definition: 'Structured Query Language for database operations.' },
    { term: 'DB', category: 'Technical', definition: 'Database.' },
    { term: 'URL', category: 'Technical', definition: 'Uniform Resource Locator web address.' },
    { term: 'HTTP', category: 'Technical', definition: 'Hypertext Transfer Protocol.' },
    { term: 'HTTPS', category: 'Technical', definition: 'HTTP over TLS (secure HTTP).' },
    { term: 'DNS', category: 'Technical', definition: 'Domain Name System.' },
    { term: 'CDN', category: 'Technical', definition: 'Content Delivery Network.' },
    { term: 'RTT', category: 'Technical', definition: 'Round-Trip Time network latency metric.' },
    { term: 'CPU', category: 'Technical', definition: 'Central Processing Unit.' },
    { term: 'GPU', category: 'Technical', definition: 'Graphics Processing Unit.' },
    { term: 'HTML', category: 'Technical', definition: 'HyperText Markup Language.' },
    { term: 'CSS', category: 'Technical', definition: 'Cascading Style Sheets.' },
    { term: 'JS', category: 'Technical', definition: 'JavaScript.' },
    { term: 'SVG', category: 'Technical', definition: 'Scalable Vector Graphics format.' },
    { term: 'DOM', category: 'Technical', definition: 'Document Object Model for browser page structure.' },
    { term: 'ARIA', category: 'Accessibility', definition: 'Accessible Rich Internet Applications attributes for assistive technologies.' }
];

function renderGlossaryRows(items) {
    return items
        .slice()
        .sort((a, b) => a.term.localeCompare(b.term))
        .map((item) => `
            <a
                class="glossary-row glossary-row-link"
                href="${getGlossaryReferenceUrl(item)}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open reference for ${item.term}"
            >
                <div class="glossary-term-wrap">
                    <div class="glossary-term">${item.term}</div>
                    <div class="glossary-category">${item.category}</div>
                </div>
                <div class="glossary-definition">
                    <div>${item.definition}</div>
                </div>
            </a>
        `)
        .join('');
}

function getGlossaryReferenceUrl(item) {
    const term = encodeURIComponent(item.term);

    const financeCategories = new Set([
        'Retirement',
        'Tax',
        'Tax/Healthcare',
        'Healthcare',
        'Housing',
        'Investment',
        'Economics'
    ]);

    if (financeCategories.has(item.category)) {
        return `https://www.investopedia.com/search?q=${term}`;
    }

    return `https://en.wikipedia.org/wiki/Special:Search?search=${term}`;
}

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
    if (!markdown) return '';

    let html = markdown
        // Code blocks (must be first)
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Checkboxes
        .replace(/^- \[x\] (.+)$/gm, '<li class="checkbox checked">✓ $1</li>')
        .replace(/^- \[ \] (.+)$/gm, '<li class="checkbox">☐ $1</li>')
        // Unordered lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Paragraphs (double newlines)
        .replace(/\n\n/g, '</p><p>');

    // Wrap loose text in paragraphs
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[123]>)/g, '$1');
    html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<li>)/g, '<ul>$1');
    html = html.replace(/(<\/li>)<\/p>/g, '$1</ul>');

    return html;
}

// Extract a section from markdown content
function extractSection(content, sectionName) {
    if (!sectionName || !content) return content;

    // Try to find the section
    const regex = new RegExp(`(^|\\n)##+ .*${sectionName}[\\s\\S]*?(?=\\n##+ |$)`, 'i');
    const match = content.match(regex);

    if (match) {
        return match[0].trim();
    }

    // If exact section not found, return full content
    return content;
}

function ensureLearnModalStyles() {
    if (document.getElementById('learn-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'learn-modal-styles';
    style.textContent = `
        .learn-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .learn-modal.active { opacity: 1; }
        .learn-modal.closing { opacity: 0; }
        .learn-modal-content {
            background: var(--bg-secondary);
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            transform: translateY(20px);
            transition: transform 0.2s;
        }
        .learn-modal.active .learn-modal-content { transform: translateY(0); }
        .learn-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid var(--border-color);
        }
        .learn-modal-header h2 {
            font-size: 24px;
            margin: 0;
            color: var(--text-primary);
        }
        .learn-modal-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0 5px;
            line-height: 1;
        }
        .learn-modal-close:hover { color: var(--text-primary); }
        .learn-modal-body {
            padding: 25px;
            overflow-y: auto;
            flex: 1;
        }
        .learn-loading { text-align: center; padding: 40px; }
        .learn-loading .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--border-color);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        .learn-error {
            text-align: center;
            padding: 40px;
            color: var(--danger-color);
        }
        .learn-article-content {
            line-height: 1.7;
            color: var(--text-primary);
        }
        .learn-article-content h1 {
            font-size: 28px;
            margin: 0 0 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--border-color);
        }
        .learn-article-content h2 {
            font-size: 22px;
            margin: 30px 0 15px;
            color: var(--accent-color);
        }
        .learn-article-content h3 { font-size: 18px; margin: 25px 0 10px; }
        .learn-article-content p { margin: 0 0 15px; }
        .learn-article-content ul, .learn-article-content ol { margin: 0 0 15px; padding-left: 25px; }
        .learn-article-content li { margin-bottom: 8px; }
        .learn-article-content code {
            background: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 14px;
        }
        .learn-article-content pre {
            background: var(--bg-tertiary);
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 15px 0;
        }
        .learn-article-content pre code { background: none; padding: 0; }
        .learn-article-content blockquote {
            border-left: 4px solid var(--accent-color);
            margin: 15px 0;
            padding: 10px 20px;
            background: var(--bg-tertiary);
            border-radius: 0 8px 8px 0;
        }
        .learn-article-content hr { border: none; border-top: 1px solid var(--border-color); margin: 30px 0; }
        .learn-article-content a { color: var(--accent-color); text-decoration: none; }
        .learn-article-content a:hover { text-decoration: underline; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

// Fetch and display article content
export async function showArticle(article) {
    ensureLearnModalStyles();

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'learn-modal';
    modal.innerHTML = `
        <div class="learn-modal-content">
            <div class="learn-modal-header">
                <h2>${article.title}</h2>
                <button class="learn-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="learn-modal-body">
                <div class="learn-loading">
                    <div class="spinner"></div>
                    <p>Loading content...</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.learn-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Keyboard close
    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', keyHandler);
        }
    };
    document.addEventListener('keydown', keyHandler);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('active'));

    // Fetch content
    try {
        const response = await apiClient.get(API_ENDPOINTS.SKILL_GET(article.skillFile));

        if (response.content) {
            let content = response.content;

            // Extract relevant section if specified
            if (article.section) {
                content = extractSection(content, article.section);
            }

            const htmlContent = markdownToHtml(content);
            modal.querySelector('.learn-modal-body').innerHTML = `
                <div class="learn-article-content">
                    ${htmlContent}
                </div>
            `;
        } else {
            throw new Error('No content returned');
        }
    } catch (error) {
        console.error('Error loading article:', error);
        modal.querySelector('.learn-modal-body').innerHTML = `
            <div class="learn-error">
                <p>Unable to load article content.</p>
                <p style="font-size: 14px; color: var(--text-secondary);">${error.message || 'Please try again later.'}</p>
            </div>
        `;
    }
}

export function renderLearnTab(container) {
    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-3);">
            <div style="margin-bottom: var(--space-3);">
                <h1 style="font-size: var(--font-2xl); margin: 0;">Learning Hub</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    Master retirement planning concepts and strategies
                </p>
            </div>

            <div class="learn-section" style="margin-bottom: var(--space-3);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: var(--space-2);">
                    <h2 style="font-size: 16px; margin: 0; color: var(--accent-color);">🧭 Feature Index & Roadmap Locator</h2>
                    <input
                        id="feature-index-filter"
                        type="text"
                        placeholder="Search features, modules, phases, tabs, or keywords..."
                        style="min-width: 260px; max-width: 460px; width: 100%; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; font-size: 12px;"
                    />
                </div>
                <p style="margin: 0 0 10px 0; color: var(--text-secondary); font-size: 12px;">
                    Direct shortcuts to app functionality and roadmap solutions.
                    Legacy wealth/family planning is under <strong>Analysis -> Additional Planning Modules -> Family Legacy & Gifting Goals</strong>.
                </p>
                <div id="feature-index-list"></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: var(--space-3);">
                ${Object.entries(ARTICLES).map(([key, category]) => `
                    <div class="learn-section">
                        <h2 style="font-size: 16px; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2); color: var(--accent-color);">
                            ${category.icon} ${category.section}
                        </h2>
                        <div class="article-grid">
                            ${category.articles.map(article => `
                                <div class="article-card" data-article-id="${article.id}">
                                    <h3 style="font-size: 14px; margin-bottom: 4px;">${article.title}</h3>
                                    <p style="font-size: 12px; margin-bottom: 8px;">${article.description}</p>
                                    <button class="learn-btn" data-article='${JSON.stringify(article).replace(/'/g, "&#39;")}' style="padding: 4px 10px; font-size: 11px;">
                                        Read More
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="learn-section" style="margin-top: var(--space-3);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: var(--space-2);">
                    <h2 style="font-size: 16px; margin: 0; color: var(--accent-color);">🧾 Acronym Glossary</h2>
                    <input
                        id="acronym-glossary-filter"
                        type="text"
                        placeholder="Filter acronym or definition (e.g., RMD, CSRF, tax)..."
                        style="min-width: 260px; max-width: 460px; width: 100%; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; font-size: 12px;"
                    />
                </div>
                <p style="margin: 0 0 10px 0; color: var(--text-secondary); font-size: 12px;">
                    Common acronyms used across planning, tax, security, and app settings.
                </p>
                <div id="acronym-glossary-list">
                    ${renderGlossaryRows(ACRONYM_GLOSSARY)}
                </div>
            </div>
        </div>

        <style>
            .learn-section {
                background: var(--bg-secondary);
                padding: var(--space-3);
                border-radius: 8px;
                border: 1px solid var(--border-color);
            }
            .article-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: var(--space-2);
            }
            .article-card {
                background: var(--bg-primary);
                padding: var(--space-2);
                border-radius: 6px;
                border: 1px solid var(--border-color);
                transition: all 0.2s;
                cursor: pointer;
            }
            .article-card:hover {
                border-color: var(--accent-color);
                transform: translateX(4px);
                background: var(--bg-tertiary);
            }
            .article-card h3 {
                color: var(--text-primary);
                font-weight: 600;
            }
            .article-card p {
                color: var(--text-secondary);
                line-height: 1.4;
            }
            .glossary-row {
                display: grid;
                grid-template-columns: minmax(180px, 220px) 1fr;
                gap: 12px;
                padding: 10px 0;
                border-top: 1px solid var(--border-color);
            }
            .glossary-row-link {
                text-decoration: none;
                color: inherit;
                cursor: pointer;
                border-radius: 6px;
                padding: 10px 8px;
                margin: 0 -8px;
                transition: background 0.15s ease, transform 0.15s ease;
            }
            .glossary-row-link:hover {
                background: var(--bg-primary);
                transform: translateX(2px);
            }
            .glossary-row-link:focus-visible {
                outline: 2px solid var(--accent-color);
                outline-offset: 2px;
            }
            .glossary-row:first-child {
                border-top: 1px solid var(--border-color);
            }
            #feature-index-list .feature-index-row:first-child {
                border-top: 1px solid var(--border-color);
            }
            .feature-index-link:hover {
                border-color: var(--accent-color) !important;
                background: var(--bg-tertiary) !important;
            }
            .glossary-term-wrap {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .glossary-term {
                font-weight: 700;
                color: var(--text-primary);
                font-size: 13px;
            }
            .glossary-category {
                color: var(--text-secondary);
                font-size: 11px;
            }
            .glossary-definition {
                color: var(--text-primary);
                font-size: 12px;
                line-height: 1.45;
            }
            .learn-btn {
                background: var(--accent-color);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            }
            .learn-btn:hover {
                background: var(--accent-hover);
            }
            @media (max-width: 600px) {
                div[style*="grid-template-columns: repeat(auto-fit, minmax(500px, 1fr))"] {
                    grid-template-columns: 1fr !important;
                }
                .glossary-row {
                    grid-template-columns: 1fr;
                    gap: 6px;
                }
            }

            /* Modal styles */
            .learn-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .learn-modal.active {
                opacity: 1;
            }
            .learn-modal.closing {
                opacity: 0;
            }
            .learn-modal-content {
                background: var(--bg-secondary);
                border-radius: 12px;
                width: 90%;
                max-width: 800px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                transform: translateY(20px);
                transition: transform 0.2s;
            }
            .learn-modal.active .learn-modal-content {
                transform: translateY(0);
            }
            .learn-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 25px;
                border-bottom: 1px solid var(--border-color);
            }
            .learn-modal-header h2 {
                font-size: 24px;
                margin: 0;
                color: var(--text-primary);
            }
            .learn-modal-close {
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: var(--text-secondary);
                padding: 0 5px;
                line-height: 1;
            }
            .learn-modal-close:hover {
                color: var(--text-primary);
            }
            .learn-modal-body {
                padding: 25px;
                overflow-y: auto;
                flex: 1;
            }
            .learn-loading {
                text-align: center;
                padding: 40px;
            }
            .learn-loading .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid var(--border-color);
                border-top-color: var(--accent-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .learn-error {
                text-align: center;
                padding: 40px;
                color: var(--danger-color);
            }
            .learn-article-content {
                line-height: 1.7;
                color: var(--text-primary);
            }
            .learn-article-content h1 {
                font-size: 28px;
                margin: 0 0 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid var(--border-color);
            }
            .learn-article-content h2 {
                font-size: 22px;
                margin: 30px 0 15px;
                color: var(--accent-color);
            }
            .learn-article-content h3 {
                font-size: 18px;
                margin: 25px 0 10px;
            }
            .learn-article-content p {
                margin: 0 0 15px;
            }
            .learn-article-content ul, .learn-article-content ol {
                margin: 0 0 15px;
                padding-left: 25px;
            }
            .learn-article-content li {
                margin-bottom: 8px;
            }
            .learn-article-content li.checkbox {
                list-style: none;
                margin-left: -20px;
            }
            .learn-article-content li.checkbox.checked {
                color: var(--success-color);
            }
            .learn-article-content code {
                background: var(--bg-tertiary);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 14px;
            }
            .learn-article-content pre {
                background: var(--bg-tertiary);
                padding: 15px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 15px 0;
            }
            .learn-article-content pre code {
                background: none;
                padding: 0;
            }
            .learn-article-content blockquote {
                border-left: 4px solid var(--accent-color);
                margin: 15px 0;
                padding: 10px 20px;
                background: var(--bg-tertiary);
                border-radius: 0 8px 8px 0;
            }
            .learn-article-content hr {
                border: none;
                border-top: 1px solid var(--border-color);
                margin: 30px 0;
            }
            .learn-article-content strong {
                color: var(--text-primary);
            }
            .learn-article-content a {
                color: var(--accent-color);
                text-decoration: none;
            }
            .learn-article-content a:hover {
                text-decoration: underline;
            }
        </style>
    `;

    // Add event listeners to article cards
    container.querySelectorAll('.article-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const btn = card.querySelector('.learn-btn');
            if (btn) {
                const articleData = btn.dataset.article;
                if (articleData) {
                    const article = JSON.parse(articleData);
                    showArticle(article);
                }
            }
        });
    });

    // Feature index
    const featureIndexInput = container.querySelector('#feature-index-filter');
    const featureIndexList = container.querySelector('#feature-index-list');
    let featureIndexItems = createFeatureIndex();

    const renderFeatureIndex = () => {
        if (!featureIndexList) return;
        const query = featureIndexInput ? featureIndexInput.value : '';
        const filtered = filterFeatureIndex(featureIndexItems, query);
        featureIndexList.innerHTML = renderFeatureIndexRows(filtered);
    };

    renderFeatureIndex();

    if (featureIndexInput) {
        featureIndexInput.addEventListener('input', () => renderFeatureIndex());
    }

    bindFeatureIndexActions(container, {
        onRoadmapOpen: () => {
            const roadmapLink = document.getElementById('view-roadmap-link');
            if (roadmapLink) {
                roadmapLink.click();
                return;
            }
            window.app?.showTab?.('welcome');
        }
    });

    // Hydrate index with roadmap items when available
    apiClient.get('/api/roadmap/public')
        .then((response) => {
            const roadmapItems = response?.items || [];
            featureIndexItems = createFeatureIndex({ roadmapItems });
            renderFeatureIndex();
        })
        .catch(() => {
            // Keep base index functional even if roadmap fetch fails.
        });

    // Acronym glossary filter
    const glossaryInput = container.querySelector('#acronym-glossary-filter');
    const glossaryList = container.querySelector('#acronym-glossary-list');
    if (glossaryInput && glossaryList) {
        glossaryInput.addEventListener('input', () => {
            const q = glossaryInput.value.trim().toLowerCase();
            if (!q) {
                glossaryList.innerHTML = renderGlossaryRows(ACRONYM_GLOSSARY);
                return;
            }

            const filtered = ACRONYM_GLOSSARY.filter((item) =>
                item.term.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                item.definition.toLowerCase().includes(q)
            );

            glossaryList.innerHTML = filtered.length
                ? renderGlossaryRows(filtered)
                : '<div style="padding: 10px 0; color: var(--text-secondary); font-size: 12px;">No glossary matches found.</div>';
        });
    }
}
