/**
 * Asset list component - Simple flat list of all assets
 */

import { formatCurrency } from '../../utils/formatters.js';
import { getAssetTypeLabel } from './asset-form-fields.js';
import { makeRowEditable } from './inline-editor.js';
import { showAssetWizard } from './asset-wizard.js';
import { store } from '../../state/store.js';

/**
 * Render all assets in a simple flat list
 */
export function renderAssetList(assets, container, onSaveCallback) {
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

    // Add click-to-edit functionality - opens asset wizard modal
    container.querySelectorAll('.asset-row').forEach((row, idx) => {
        const asset = allAssets[idx];

        const openEditModal = () => {
            const profile = store.get('currentProfile');
            if (!profile) return;

            // Get the full assets object from profile
            const assets = profile.data?.assets || {
                retirement_accounts: [],
                taxable_accounts: [],
                real_estate: [],
                pensions_annuities: [],
                other_assets: []
            };

            // Open asset wizard with the existing asset
            showAssetWizard(
                asset.categoryKey,
                asset,
                onSaveCallback, // Pass through the save callback from parent
                asset.index
            );
        };

        // Click on row to open edit modal
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (e.target.closest('.delete-asset-btn')) {
                return;
            }

            openEditModal();
        });

        // Also attach to edit button specifically
        const editBtn = row.querySelector('.edit-asset-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal();
            });
        }
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

    // Build attributes list to show horizontally
    const attributes = [];

    // Institution
    if (asset.institution) {
        attributes.push({ label: 'Institution', value: asset.institution });
    }

    // For retirement/taxable accounts, show allocations
    if (asset.categoryKey === 'retirement_accounts' || asset.categoryKey === 'taxable_accounts') {
        if (asset.stock_pct !== undefined && asset.stock_pct !== null) {
            attributes.push({ label: 'Stocks', value: `${(asset.stock_pct * 100).toFixed(0)}%` });
        }
        if (asset.bond_pct !== undefined && asset.bond_pct !== null) {
            attributes.push({ label: 'Bonds', value: `${(asset.bond_pct * 100).toFixed(0)}%` });
        }
        if (asset.cash_pct !== undefined && asset.cash_pct !== null && asset.cash_pct > 0) {
            attributes.push({ label: 'Cash', value: `${(asset.cash_pct * 100).toFixed(0)}%` });
        }
        if (asset.account_number) {
            attributes.push({ label: 'Acct', value: `****${asset.account_number}` });
        }
    }

    // Real estate attributes
    if (asset.categoryKey === 'real_estate') {
        if (asset.address) {
            attributes.push({ label: 'Address', value: asset.address });
        }
        if (asset.rental_income) {
            attributes.push({ label: 'Rent', value: formatCurrency(asset.rental_income, 0) + '/mo' });
        }
    }

    // Pension/annuity attributes
    if (asset.categoryKey === 'pensions_annuities') {
        if (asset.provider) {
            attributes.push({ label: 'Provider', value: asset.provider });
        }
        if (asset.start_age) {
            attributes.push({ label: 'Start Age', value: asset.start_age });
        }
    }

    const attributesHTML = attributes.map(attr =>
        `<span style="color: var(--text-secondary); font-size: 12px;">
            <span style="font-weight: 600;">${attr.label}:</span> ${attr.value}
        </span>`
    ).join('<span style="color: var(--border-color); margin: 0 4px;">•</span>');

    return `
        <div class="asset-row" data-category="${asset.categoryKey}" data-index="${asset.index}" style="padding: 8px 12px; background: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; gap: 12px;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--border-color)'">
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <span style="font-size: 16px;">${asset.categoryIcon}</span>
                    <span style="font-weight: 600;">${asset.name}</span>
                    <span style="color: var(--text-secondary);">${typeLabel}</span>
                    <span style="color: var(--accent-color); font-weight: 600; margin-left: auto;">${valueDisplay}</span>
                </div>
                ${attributesHTML ? `<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-left: 24px;">${attributesHTML}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px;">
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
