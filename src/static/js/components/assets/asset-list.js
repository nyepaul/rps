/**
 * Asset list component - Simple flat list of all assets
 */

import { formatCurrency } from '../../utils/formatters.js';
import { getAssetTypeLabel } from './asset-form-fields.js';

/**
 * Render all assets in a simple flat list
 */
export function renderAssetList(assets, container) {
    // Collect all assets into a flat array with their category info
    const allAssets = [];

    const categoryInfo = {
        retirement_accounts: { label: 'Retirement', icon: '🏦' },
        taxable_accounts: { label: 'Bank/Brokerage', icon: '💰' },
        real_estate: { label: 'Real Estate', icon: '🏠' },
        pensions_annuities: { label: 'Income Stream', icon: '💵' },
        other_assets: { label: 'Other', icon: '📦' }
    };

    for (const [categoryKey, items] of Object.entries(assets)) {
        if (!Array.isArray(items)) continue;
        items.forEach((item, index) => {
            allAssets.push({
                ...item,
                categoryKey,
                categoryLabel: categoryInfo[categoryKey]?.label || categoryKey,
                categoryIcon: categoryInfo[categoryKey]?.icon || '📁',
                index
            });
        });
    }

    // Sort by category, then by value (descending)
    allAssets.sort((a, b) => {
        const categoryOrder = ['retirement_accounts', 'taxable_accounts', 'real_estate', 'pensions_annuities', 'other_assets'];
        const catDiff = categoryOrder.indexOf(a.categoryKey) - categoryOrder.indexOf(b.categoryKey);
        if (catDiff !== 0) return catDiff;

        const aVal = a.value || a.current_value || a.monthly_benefit || 0;
        const bVal = b.value || b.current_value || b.monthly_benefit || 0;
        return bVal - aVal;
    });

    if (allAssets.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: var(--bg-secondary); border-radius: 12px;">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">💼</div>
                <h3 style="margin-bottom: 10px; color: var(--text-primary);">No Assets Yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Click "Add Asset" above to start tracking your assets</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 12px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                        <th style="text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Name</th>
                        <th style="text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Type</th>
                        <th style="text-align: center; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Allocation (S/B/C)</th>
                        <th style="text-align: right; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Balance</th>
                        <th style="text-align: center; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allAssets.map(asset => renderAssetRow(asset)).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Add hover effects
    container.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--bg-tertiary)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
        });
    });
}

/**
 * Render a single asset row
 */
function renderAssetRow(asset) {
    const typeLabel = getAssetTypeLabel(asset.type);

    let valueDisplay = '';
    if (asset.categoryKey === 'pensions_annuities') {
        valueDisplay = `${formatCurrency(asset.monthly_benefit || 0, 0)}/mo`;
    } else {
        valueDisplay = formatCurrency(asset.value || asset.current_value || 0, 0);
    }

    const allocationDisplay = (asset.stock_pct !== undefined) 
        ? `${Math.round(asset.stock_pct * 100)}/${Math.round(asset.bond_pct * 100)}/${Math.round(asset.cash_pct * 100)}`
        : '—';

    return `
        <tr data-category="${asset.categoryKey}" data-index="${asset.index}" style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
            <td style="padding: 8px 12px;">
                <div style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${asset.name}</div>
                ${asset.institution ? `<div style="font-size: 11px; color: var(--text-secondary);">${asset.institution}</div>` : ''}
            </td>
            <td style="padding: 8px 12px;">
                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--bg-primary); border-radius: 4px; font-size: 12px;">
                    <span>${asset.categoryIcon}</span>
                    <span>${typeLabel}</span>
                </span>
            </td>
            <td style="padding: 8px 12px; text-align: center; font-size: 12px; color: var(--text-secondary);">
                ${allocationDisplay}
            </td>
            <td style="padding: 8px 12px; text-align: right;">
                <span style="font-size: 14px; font-weight: 600; color: var(--accent-color);">${valueDisplay}</span>
            </td>
            <td style="padding: 8px 12px; text-align: center;">
                <button class="edit-asset-btn" data-category="${asset.categoryKey}" data-index="${asset.index}"
                    style="padding: 4px 8px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: 14px;"
                    title="Edit">✏️</button>
                <button class="delete-asset-btn" data-category="${asset.categoryKey}" data-index="${asset.index}"
                    style="padding: 4px 8px; background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: 14px;"
                    title="Delete">🗑️</button>
            </td>
        </tr>
    `;
}
