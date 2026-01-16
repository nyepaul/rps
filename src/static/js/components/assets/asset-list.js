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
        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 12px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${allAssets.map(asset => renderAssetRow(asset)).join('')}
            </div>
        </div>
    `;

    // Add click-to-edit functionality
    container.querySelectorAll('.asset-row').forEach(row => {
        // Click on row to edit (but not when clicking action buttons)
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on action buttons
            if (e.target.closest('.edit-asset-btn') || e.target.closest('.delete-asset-btn')) {
                return;
            }

            // Trigger the edit button click
            const editBtn = row.querySelector('.edit-asset-btn');
            if (editBtn) {
                editBtn.click();
            }
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
    } else if (asset.categoryKey === 'real_estate') {
        // For real estate, show equity and mortgage info inline
        const marketValue = asset.value || asset.current_value || 0;
        const mortgage = asset.mortgage_balance || 0;
        const equity = marketValue - mortgage;

        if (mortgage > 0) {
            valueDisplay = `${formatCurrency(equity, 0)} equity (Mkt: ${formatCurrency(marketValue, 0)} - Mort: ${formatCurrency(mortgage, 0)})`;
        } else {
            valueDisplay = formatCurrency(marketValue, 0);
        }
    } else {
        valueDisplay = formatCurrency(asset.value || asset.current_value || 0, 0);
    }

    // Build compact description
    const descParts = [];

    if (asset.institution) {
        descParts.push(asset.institution);
    }

    // Add key details inline
    if (asset.categoryKey === 'real_estate' && asset.address) {
        descParts.push(asset.address);
    }
    if (asset.categoryKey === 'pensions_annuities') {
        if (asset.provider) descParts.push(asset.provider);
        if (asset.start_age) descParts.push(`Age ${asset.start_age}`);
    }

    const description = descParts.length > 0 ? descParts.join(' • ') : '';

    return `
        <div class="asset-row" data-category="${asset.categoryKey}" data-index="${asset.index}" style="padding: 6px 10px; background: var(--bg-primary); border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--border-color)'">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px;">
                <span style="font-size: 16px;">${asset.categoryIcon}</span>
                <span style="font-weight: 600;">${asset.name}</span>
                <span style="color: var(--text-secondary);">${typeLabel}</span>
                ${description ? `<span style="color: var(--text-secondary); font-size: 12px;">${description}</span>` : ''}
                <span style="color: var(--accent-color); font-weight: 600; margin-left: auto;">${valueDisplay}</span>
            </div>
            <div style="display: flex; gap: 4px; margin-left: 8px;">
                <button class="edit-asset-btn" data-category="${asset.categoryKey}" data-index="${asset.index}"
                    style="padding: 4px 8px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; font-size: 14px;"
                    title="Edit">✏️</button>
                <button class="delete-asset-btn" data-category="${asset.categoryKey}" data-index="${asset.index}"
                    style="padding: 4px 8px; background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: 14px;"
                    title="Delete">🗑️</button>
            </div>
        </div>
    `;
}
