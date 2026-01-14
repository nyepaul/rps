/**
 * Asset list component - Display assets by category with accordion
 */

import { formatCurrency } from '../../utils/formatters.js';
import { getAssetTypeLabel } from './asset-form-fields.js';

/**
 * Render asset list with categories
 */
export function renderAssetList(assets, container) {
    const categories = [
        { key: 'retirement_accounts', label: 'Retirement Accounts', icon: '🏦' },
        { key: 'taxable_accounts', label: 'Taxable Accounts', icon: '💰' },
        { key: 'real_estate', label: 'Real Estate', icon: '🏠' },
        { key: 'pensions_annuities', label: 'Pensions & Annuities', icon: '💵' },
        { key: 'other_assets', label: 'Other Assets', icon: '📦' }
    ];

    container.innerHTML = categories.map(category => {
        const items = assets[category.key] || [];
        const total = calculateCategoryTotal(items, category.key);
        const isEmpty = items.length === 0;

        return `
            <div class="asset-category" data-category="${category.key}">
                <div class="category-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; margin-bottom: ${isEmpty ? '20px' : '0'};">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 32px;">${category.icon}</span>
                        <div>
                            <h3 style="margin: 0; font-size: 20px;">${category.label}</h3>
                            <small style="color: var(--text-secondary);">${items.length} asset${items.length !== 1 ? 's' : ''}</small>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="text-align: right;">
                            <div style="font-size: 24px; font-weight: 600; color: var(--accent-color);">
                                ${formatCurrency(total, 0)}
                            </div>
                        </div>
                        <span class="expand-icon" style="font-size: 24px; transition: transform 0.3s;">${isEmpty ? '' : '▼'}</span>
                    </div>
                </div>

                <div class="category-content" style="display: none; padding: 0 20px 20px 20px; background: var(--bg-secondary); border-radius: 0 0 8px 8px; margin-bottom: 20px;">
                    ${isEmpty ? renderEmptyState(category.key) : renderAssetItems(items, category.key)}
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for accordion
    setupAccordionHandlers(container);
}

/**
 * Calculate total value for a category
 */
function calculateCategoryTotal(items, categoryKey) {
    if (categoryKey === 'pensions_annuities') {
        // For pensions, show monthly benefit total (not present value)
        return items.reduce((sum, item) => sum + (item.monthly_benefit || 0), 0);
    }

    return items.reduce((sum, item) => {
        const value = item.value || item.current_value || 0;
        return sum + value;
    }, 0);
}

/**
 * Render empty state for category
 */
function renderEmptyState(categoryKey) {
    return `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">📂</div>
            <p>No assets in this category yet</p>
            <button class="add-asset-btn" data-category="${categoryKey}" style="margin-top: 15px; padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                + Add Asset
            </button>
        </div>
    `;
}

/**
 * Render asset items in a category
 */
function renderAssetItems(items, categoryKey) {
    return `
        <div style="display: grid; gap: 15px; margin-top: 20px;">
            ${items.map((item, index) => renderAssetCard(item, categoryKey, index)).join('')}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button class="add-asset-btn" data-category="${categoryKey}" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                + Add Another
            </button>
        </div>
    `;
}

/**
 * Render individual asset card
 */
function renderAssetCard(asset, categoryKey, index) {
    const typeLabel = getAssetTypeLabel(asset.type);

    let primaryValue = '';
    let secondaryInfo = '';

    if (categoryKey === 'pensions_annuities') {
        primaryValue = `${formatCurrency(asset.monthly_benefit || 0, 0)}/month`;
        secondaryInfo = asset.provider ? `<div><strong>Provider:</strong> ${asset.provider}</div>` : '';
    } else if (categoryKey === 'real_estate') {
        primaryValue = formatCurrency(asset.value || asset.current_value || 0, 0);
        secondaryInfo = `
            ${asset.purchase_price ? `<div><strong>Purchase:</strong> ${formatCurrency(asset.purchase_price, 0)}</div>` : ''}
            ${asset.mortgage_balance ? `<div><strong>Mortgage:</strong> ${formatCurrency(asset.mortgage_balance, 0)}</div>` : ''}
        `;
    } else {
        primaryValue = formatCurrency(asset.value || 0, 0);
        secondaryInfo = asset.institution ? `<div><strong>Institution:</strong> ${asset.institution}</div>` : '';
    }

    return `
        <div class="asset-card" data-category="${categoryKey}" data-index="${index}" style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <h4 style="margin: 0; font-size: 18px;">${asset.name}</h4>
                        <span style="padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                            ${typeLabel}
                        </span>
                    </div>

                    <div style="font-size: 24px; font-weight: 600; color: var(--accent-color); margin-bottom: 8px;">
                        ${primaryValue}
                    </div>

                    <div style="font-size: 14px; color: var(--text-secondary);">
                        ${secondaryInfo}
                        ${asset.account_number ? `<div><strong>Account:</strong> ****${asset.account_number}</div>` : ''}
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button class="edit-asset-btn" data-category="${categoryKey}" data-index="${index}" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                        ✏️ Edit
                    </button>
                    <button class="delete-asset-btn" data-category="${categoryKey}" data-index="${index}" style="padding: 8px 16px; background: var(--danger-bg); color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup accordion click handlers
 */
function setupAccordionHandlers(container) {
    container.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', () => {
            const category = header.parentElement;
            const content = category.querySelector('.category-content');
            const icon = category.querySelector('.expand-icon');
            const isEmpty = content.querySelector('.add-asset-btn[data-category]') &&
                           content.textContent.includes('No assets');

            if (isEmpty) return; // Don't toggle if empty

            const isOpen = content.style.display === 'block';

            if (isOpen) {
                content.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
                category.style.marginBottom = '20px';
            } else {
                content.style.display = 'block';
                icon.style.transform = 'rotate(180deg)';
                category.style.marginBottom = '0';
            }
        });
    });

    // Add hover effects to cards
    container.querySelectorAll('.asset-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.boxShadow = '0 4px 12px var(--shadow)';
            card.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = 'none';
            card.style.transform = 'translateY(0)';
        });
    });

    // Add hover effects to buttons
    container.querySelectorAll('button').forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
    });
}
