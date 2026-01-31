/**
 * Asset list component - Simple flat list of all assets
 */

import { formatCurrency } from '../../utils/formatters.js';
import { getAssetTypeLabel, generateFormFields, extractFormData, getAllAccountTypeOptions, getCategoryForType } from './asset-form-fields.js';
import { makeRowEditable } from './inline-editor.js';
import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { showError, showSuccess } from '../../utils/dom.js';
import { isPotentialDuplicate, updateDuplicateDetection } from './assets-tab.js';

// Track current sort state
let currentSort = 'category';

/**
 * Render all assets in a simple flat list
 */
export function renderAssetList(assets, container, onSaveCallback) {
    // Update duplicate detection before rendering
    updateDuplicateDetection(assets);

    // Collect all assets into a flat array with their category info
    const allAssets = [];

    const categoryInfo = {
        retirement_accounts: { label: 'Retirement', icon: '🏦' },
        taxable_accounts: { label: 'Bank/Brokerage', icon: '💰' },
        real_estate: { label: 'Real Estate', icon: '🏠' },
        pensions_annuities: { label: 'Income Stream', icon: '💵' },
        education_accounts: { label: 'Education (529)', icon: '🎓' },
        other_assets: { label: 'Other', icon: '📦' },
        liabilities: { label: 'Liabilities', icon: '💳' }
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

    // Sort assets based on currentSort
    allAssets.sort((a, b) => {
        const getVal = (item) => item.value || item.current_value || item.monthly_benefit || 0;

        if (currentSort === 'value-desc') {
            return getVal(b) - getVal(a);
        }
        if (currentSort === 'value-asc') {
            return getVal(a) - getVal(b);
        }
        if (currentSort === 'name-asc') {
            return (a.name || '').localeCompare(b.name || '');
        }
        if (currentSort === 'institution-asc') {
            return (a.institution || '').localeCompare(b.institution || '');
        }

        // Default: Sort by category, then by value (descending)
        const categoryOrder = ['retirement_accounts', 'taxable_accounts', 'real_estate', 'pensions_annuities', 'education_accounts', 'other_assets', 'liabilities'];
        const catDiff = categoryOrder.indexOf(a.categoryKey) - categoryOrder.indexOf(b.categoryKey);
        if (catDiff !== 0) return catDiff;

        return getVal(b) - getVal(a);
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">
                    ${allAssets.length} Assets
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px; color: var(--text-secondary);">Sort by</span>
                    <select id="asset-sort-select" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 12px; cursor: pointer; outline: none;">
                        <option value="category" ${currentSort === 'category' ? 'selected' : ''}>Category</option>
                        <option value="value-desc" ${currentSort === 'value-desc' ? 'selected' : ''}>Value (High to Low)</option>
                        <option value="value-asc" ${currentSort === 'value-asc' ? 'selected' : ''}>Value (Low to High)</option>
                        <option value="name-asc" ${currentSort === 'name-asc' ? 'selected' : ''}>Name (A-Z)</option>
                        <option value="institution-asc" ${currentSort === 'institution-asc' ? 'selected' : ''}>Institution (A-Z)</option>
                    </select>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${allAssets.map(asset => renderAssetRow(asset)).join('')}
            </div>
        </div>
    `;

    // Handle Sort Change
    const sortSelect = container.querySelector('#asset-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            // Re-render the list with the new sort order
            renderAssetList(assets, container, onSaveCallback);
        });
    }

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
                other_assets: [],
                liabilities: []
            };

            showSimpleEditModal(asset, asset.categoryKey, asset.index, assets);
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

    // Check if this asset is a potential duplicate
    const isDuplicate = asset.id && isPotentialDuplicate(asset.id);
    const duplicateStyle = isDuplicate
        ? 'border: 2px solid var(--warning-color, #f0ad4e); background: rgba(240, 173, 78, 0.1);'
        : 'border: 1px solid var(--border-color); background: var(--bg-primary);';
    const duplicateBadge = isDuplicate
        ? '<span style="background: var(--warning-color, #f0ad4e); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 8px;">POSSIBLE DUPLICATE</span>'
        : '';

    return `
        <div class="asset-row" data-category="${asset.categoryKey}" data-index="${asset.index}" data-id="${asset.id || ''}" style="padding: 8px 12px; ${duplicateStyle} border-radius: 6px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; gap: 12px;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--accent-color)'" onmouseout="this.style.background='${isDuplicate ? 'rgba(240, 173, 78, 0.1)' : 'var(--bg-primary)'}'; this.style.borderColor='${isDuplicate ? 'var(--warning-color, #f0ad4e)' : 'var(--border-color)'}'">
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap;">
                    <span style="font-size: 16px;">${asset.categoryIcon}</span>
                    <span style="font-weight: 600;">${asset.name}</span>
                    <span style="color: var(--text-secondary);">${typeLabel}</span>
                    ${duplicateBadge}
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

/**
 * Show simple edit modal for an asset
 */
function showSimpleEditModal(asset, originalCategory, assetIndex, allAssets) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // Track current category (may change if type changes)
    let currentCategory = originalCategory;

    const renderForm = (category) => {
        const typeLabel = getAssetTypeLabel(asset.type);

        modalContent.innerHTML = `
            <div style="padding: 30px;">
                <h2 style="margin: 0 0 20px 0; font-size: 24px;">✏️ Edit Asset</h2>

                <form id="asset-edit-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    ${generateFormFields(category, asset, false, getAllAccountTypeOptions())}
                </form>

                <div style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 2px solid var(--border-color);">
                    <button id="cancel-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Cancel
                    </button>
                    <button id="save-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Save Changes
                    </button>
                </div>
            </div>
        `;

        // Setup type change handler
        const typeSelect = modalContent.querySelector('select[name="type"]');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const newType = e.target.value;
                const form = modalContent.querySelector('#asset-edit-form');

                // Extract current form data
                const formData = extractFormData(form, currentCategory);

                // Merge with existing asset data
                Object.assign(asset, formData);
                asset.type = newType;

                // Check if category changed
                const newCategory = getCategoryForType(newType);
                if (newCategory && newCategory !== currentCategory) {
                    console.log(`[Asset Edit] Category change: ${currentCategory} -> ${newCategory}`);
                    currentCategory = newCategory;
                }

                // Re-render form with new fields
                renderForm(currentCategory);
            });
        }

        // Setup cancel button
        const cancelBtn = modalContent.querySelector('#cancel-btn');
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        // Setup save button
        const saveBtn = modalContent.querySelector('#save-btn');
        saveBtn.addEventListener('click', async () => {
            const form = modalContent.querySelector('#asset-edit-form');

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Extract form data
            const formData = extractFormData(form, currentCategory);

            // Merge with existing asset (preserves id, created_at, etc.)
            const updatedAsset = {
                ...asset,
                ...formData,
                updated_at: new Date().toISOString()
            };

            console.log(`[Asset Edit] Saving asset:`, updatedAsset);
            console.log(`[Asset Edit] Original category: ${originalCategory}, Current category: ${currentCategory}`);

            // If category changed, move the asset
            if (currentCategory !== originalCategory) {
                // Remove from original category
                allAssets[originalCategory].splice(assetIndex, 1);
                // Add to new category
                allAssets[currentCategory].push(updatedAsset);
            } else {
                // Update in place
                allAssets[originalCategory][assetIndex] = updatedAsset;
            }

            // Save to backend
            try {
                const profile = store.get('currentProfile');
                if (!profile) {
                    showError('No profile selected');
                    return;
                }

                const updatedData = {
                    ...profile.data,
                    assets: allAssets
                };

                const result = await profilesAPI.update(profile.name, {
                    data: updatedData
                });

                // Update store
                store.setState({ currentProfile: result.profile });

                showSuccess('Asset updated successfully!');
                modal.remove();

                // Refresh the Assets tab
                if (window.app && window.app.showTab) {
                    window.app.showTab('assets');
                }
            } catch (error) {
                console.error('Error saving asset:', error);
                showError(`Failed to save asset: ${error.message}`);
            }
        });
    };

    renderForm(currentCategory);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (confirm('Close without saving? Any changes will be lost.')) {
                modal.remove();
            }
        }
    });
}
