/**
 * Learn tab component - Educational content
 */

import { API_ENDPOINTS } from '../../config.js';
import { apiClient } from '../../api/client.js';

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

// Fetch and display article content
export async function showArticle(article) {
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
}
