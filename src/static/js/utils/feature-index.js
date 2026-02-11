/**
 * Feature index helper for in-app "where do I find this?" navigation.
 */

import { APP_CONFIG } from '../config.js';

const TAB_METADATA = {
    welcome: {
        title: 'Welcome & Profiles',
        summary: 'Create profiles, select defaults, and start planning.',
        location: 'Welcome tab'
    },
    dashboard: {
        title: 'Dashboard',
        summary: 'Net worth, liquidity, debt ratio, and key financial health indicators.',
        location: 'Dashboard tab'
    },
    profile: {
        title: 'Profile Setup',
        summary: 'Household basics, dependents, filing status, and core assumptions.',
        location: 'Profile tab'
    },
    home: {
        title: 'Home & Mortgage',
        summary: 'Primary residence and mortgage planning.',
        location: 'Home tab'
    },
    income: {
        title: 'Income Planning',
        summary: 'Salary, pensions, Social Security assumptions, and income streams.',
        location: 'Income tab'
    },
    expenses: {
        title: 'Expenses & Budget',
        summary: 'Recurring expenses, retirement spending, advisor fee (AUM) impact, and budget controls.',
        location: 'Expenses tab'
    },
    assets: {
        title: 'Assets & Accounts',
        summary: 'Retirement, taxable, real estate, and other asset values.',
        location: 'Assets tab'
    },
    cashflow: {
        title: 'Cash Flow Analysis',
        summary: 'Year-by-year inflows/outflows and cash gap diagnostics.',
        location: 'Cashflow tab'
    },
    analysis: {
        title: 'Monte Carlo Analysis',
        summary: 'Success probability, timeline projections, and planning modules.',
        location: 'Analysis tab'
    },
    comparison: {
        title: 'Scenario Comparison',
        summary: 'Side-by-side what-if comparisons and trajectory differences.',
        location: 'Comparison tab'
    },
    'rent-vs-own': {
        title: 'Rent vs Own Scenario',
        summary: 'Housing decision analysis for buy vs rent outcomes.',
        location: 'Rent vs Own tab'
    },
    tax: {
        title: 'Tax Optimization',
        summary: 'Roth conversions, Social Security strategy, RMDs, Medicare, and state taxes.',
        location: 'Tax tab'
    },
    withdrawal: {
        title: 'Withdrawal Strategy',
        summary: 'Tax-efficient withdrawal order and retirement drawdown planning.',
        location: 'Withdrawal tab'
    },
    actions: {
        title: 'Action Items',
        summary: 'Prioritized execution checklist and status tracking.',
        location: 'Actions tab'
    },
    advisor: {
        title: 'AI Advisor',
        summary: 'Optional AI assistance for planning questions and strategy reviews.',
        location: 'Advisor tab'
    },
    summary: {
        title: 'Reports & Summary',
        summary: 'Generate and view PDF reports for analysis and action plans.',
        location: 'Summary tab'
    },
    'financial-data': {
        title: 'Financial Data',
        summary: 'Detailed planning modules and advanced retirement data views.',
        location: 'Financial Data tab'
    },
    learn: {
        title: 'Learning Hub',
        summary: 'Educational content, glossary, and feature navigation.',
        location: 'Learn tab'
    }
};

const SPOTLIGHT_ENTRIES = [
    {
        id: 'advisor-fee-aum-impact',
        title: 'Advisor Fee Impact (AUM)',
        area: 'Expenses',
        location: 'Expenses tab -> Advisor Fee Impact (AUM)',
        summary: 'Identify advisor-managed accounts, set fee rates, and apply AUM fee totals into Advisor Fees expense.',
        keywords: [
            'aum',
            'assets under management',
            'advisor fees',
            'advisory fee',
            'managed accounts',
            'expense ratio',
            'fee drag'
        ],
        action: { type: 'tab', target: 'expenses', label: 'Open Expenses' }
    },
    {
        id: 'legacy-family-planning',
        title: 'Legacy Wealth & Family Planning',
        area: 'Analysis',
        location: 'Analysis tab -> Additional Planning Modules',
        summary: 'Find Family Legacy & Gifting Goals and estate-oriented recommendations.',
        keywords: [
            'legacy wealth',
            'family planning',
            'family legacy',
            'gifting goals',
            'wealth transfer',
            'heirs'
        ],
        action: { type: 'tab', target: 'analysis', label: 'Open Analysis' }
    },
    {
        id: 'estate-tax-gifting',
        title: 'Estate Tax & Gifting Strategy',
        area: 'Analysis',
        location: 'Analysis tab -> Estate Tax & Gifting Strategy',
        summary: 'Net estate, taxable estate estimates, and annual gift capacity.',
        keywords: ['estate', 'estate tax', 'gifting', 'taxable estate', 'legacy'],
        action: { type: 'tab', target: 'analysis', label: 'Open Analysis' }
    },
    {
        id: 'roadmap-solutions',
        title: 'Roadmap Solutions',
        area: 'Roadmap',
        location: 'Roadmap viewer',
        summary: 'Browse all implemented roadmap items by phase and completion status.',
        keywords: ['roadmap', 'phase 1', 'phase 2', 'phase 3', 'backlog', 'status'],
        action: { type: 'roadmap', target: 'public', label: 'Open Roadmap' }
    },
    {
        id: 'tab-restore-behavior',
        title: 'Back/Refresh Tab Restore',
        area: 'Navigation',
        location: 'Global navigation',
        summary: 'The app restores your active tab on refresh and browser back/forward.',
        keywords: ['refresh', 'back button', 'tab restore', 'navigation'],
        action: { type: 'tab', target: 'dashboard', label: 'Open Dashboard' }
    }
];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function buildTabEntries() {
    const tabs = APP_CONFIG?.PROGRESSIVE_TABS?.ALWAYS || [];
    return tabs.map((tabName) => {
        const meta = TAB_METADATA[tabName] || {};
        return {
            id: `tab-${tabName}`,
            title: meta.title || String(tabName),
            area: 'App Functionality',
            location: meta.location || `${tabName} tab`,
            summary: meta.summary || 'Open this area for related planning features.',
            keywords: [tabName, meta.title || '', meta.summary || '', meta.location || ''],
            action: { type: 'tab', target: tabName, label: `Open ${meta.title || tabName}` }
        };
    });
}

function buildRoadmapEntries(roadmapItems = []) {
    return roadmapItems.map((item) => ({
        id: `roadmap-${item.id}`,
        title: item.title || 'Roadmap Item',
        area: 'Roadmap Solution',
        location: `${(item.phase || 'phase').toUpperCase()} / ${(item.status || 'planned').toUpperCase()}`,
        summary: item.description || item.notes || 'Roadmap item details available in roadmap viewer.',
        keywords: [
            item.title || '',
            item.description || '',
            item.notes || '',
            item.phase || '',
            item.status || ''
        ],
        action: { type: 'roadmap', target: String(item.id), label: 'View in Roadmap' }
    }));
}

export function createFeatureIndex(options = {}) {
    const roadmapItems = options.roadmapItems || [];
    const allEntries = [
        ...SPOTLIGHT_ENTRIES,
        ...buildTabEntries(),
        ...buildRoadmapEntries(roadmapItems)
    ];

    const unique = new Map();
    allEntries.forEach((item) => {
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    });
    return Array.from(unique.values());
}

export function filterFeatureIndex(items, query) {
    const q = normalize(query);
    if (!q) return items;

    return items.filter((item) => {
        const haystack = [
            item.title,
            item.area,
            item.location,
            item.summary,
            ...(item.keywords || [])
        ]
            .map(normalize)
            .join(' ');
        return haystack.includes(q);
    });
}

export function renderFeatureIndexRows(items) {
    if (!items.length) {
        return '<div style="padding: 10px 0; color: var(--text-secondary); font-size: 12px;">No feature index matches found.</div>';
    }

    return items.map((item) => `
        <div
            class="feature-index-row"
            data-action="${escapeHtml(item.action?.type || '')}"
            data-target="${escapeHtml(item.action?.target || '')}"
            role="button"
            tabindex="0"
            aria-label="${escapeHtml(item.action?.label || item.title || 'Open')}"
            style="display: grid; grid-template-columns: minmax(210px, 300px) 1fr; gap: 12px; padding: 10px 8px; border-top: 1px solid var(--border-color); align-items: center; cursor: pointer; border-radius: 6px; transition: background 0.15s ease, transform 0.15s ease;"
        >
            <div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${escapeHtml(item.title)}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(item.area)} • ${escapeHtml(item.location)}</div>
            </div>
            <div style="font-size: 12px; color: var(--text-primary); line-height: 1.45;">${escapeHtml(item.summary)}</div>
        </div>
    `).join('');
}

export function bindFeatureIndexActions(root, options = {}) {
    if (!root) return;

    const openRoadmap = options.onRoadmapOpen || (() => {});

    const runAction = (row) => {
        if (!row) return;
        const action = row.dataset.action;
        const target = row.dataset.target;

        if (action === 'tab' && target) {
            window.app?.showTab?.(target);
            return;
        }

        if (action === 'roadmap') {
            openRoadmap(target);
        }
    };

    root.addEventListener('click', (event) => {
        const row = event.target.closest('.feature-index-row');
        if (!row) return;
        runAction(row);
    });

    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('.feature-index-row');
        if (!row) return;
        event.preventDefault();
        runAction(row);
    });
}
