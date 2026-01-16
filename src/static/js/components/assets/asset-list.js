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
                        <th style="text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Description</th>
                        <th style="text-align: right; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Value / Equity</th>
                        <th style="text-align: center; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); width: 80px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allAssets.map(asset => renderAssetRow(asset)).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Add hover effects and click-to-edit functionality
    container.querySelectorAll('tbody tr').forEach(row => {
        // Set cursor to pointer to indicate clickability
        row.style.cursor = 'pointer';

        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--bg-tertiary)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
        });

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
    let secondaryValueDisplay = '';

    if (asset.categoryKey === 'pensions_annuities') {
        valueDisplay = `${formatCurrency(asset.monthly_benefit || 0, 0)}/mo`;
    } else if (asset.categoryKey === 'real_estate') {
        // For real estate, show market value and mortgage
        const marketValue = asset.value || asset.current_value || 0;
        const mortgage = asset.mortgage_balance || 0;
        const equity = marketValue - mortgage;

        if (mortgage > 0) {
            valueDisplay = formatCurrency(equity, 0);
            secondaryValueDisplay = `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                Market: ${formatCurrency(marketValue, 0)}<br>
                Mortgage: <span style="color: var(--danger-color);">-${formatCurrency(mortgage, 0)}</span>
            </div>`;
        } else {
            valueDisplay = formatCurrency(marketValue, 0);
        }
    } else {
        valueDisplay = formatCurrency(asset.value || asset.current_value || 0, 0);
    }

    // Helper to generate description based on asset type
    const getDescriptionDisplay = (a) => {
        const descriptions = [];

        // Get type-specific description
        if (a.type) {
            const typeLabels = {
                // Retirement accounts
                '401k': '401(k)',
                '403b': '403(b)',
                '457': '457',
                'traditional_ira': 'Traditional IRA',
                'roth_ira': 'Roth IRA',
                'sep_ira': 'SEP IRA',
                'simple_ira': 'SIMPLE IRA',
                // Taxable accounts
                'brokerage': 'Brokerage Account',
                'savings': 'Savings Account',
                'checking': 'Checking Account',
                'cash': 'Cash',
                'cd': 'Certificate of Deposit',
                'money_market': 'Money Market',
                // Real estate
                'primary_residence': 'Primary Residence',
                'rental_property': 'Rental Property',
                'vacation_home': 'Vacation Home',
                'land': 'Land',
                'commercial': 'Commercial Property',
                // Pensions/Annuities
                'pension': 'Pension',
                'annuity': 'Annuity',
                // Other assets
                'business_interest': 'Business Interest',
                'collectible': 'Collectible',
                'trust': 'Trust',
                'hsa': 'Health Savings Account',
                'cryptocurrency': 'Cryptocurrency',
                'other': 'Other'
            };

            const typeDesc = typeLabels[a.type];
            if (typeDesc) {
                descriptions.push(typeDesc);
            }
        }

        // Add additional relevant info based on category
        if (a.categoryKey === 'real_estate') {
            if (a.address) {
                descriptions.push(a.address);
            }
            if (a.annual_rental_income && a.annual_rental_income > 0) {
                descriptions.push(`Rental: ${formatCurrency(a.annual_rental_income, 0)}/yr`);
            }
        } else if (a.categoryKey === 'taxable_accounts') {
            if (a.type === 'cd' && a.interest_rate) {
                descriptions.push(`${a.interest_rate}% APY`);
            }
            if (a.type === 'cd' && a.maturity_date) {
                const maturityDate = new Date(a.maturity_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                descriptions.push(`Matures: ${maturityDate}`);
            }
        } else if (a.categoryKey === 'pensions_annuities') {
            if (a.provider) {
                descriptions.push(a.provider);
            }
            if (a.start_age) {
                descriptions.push(`Starts at age ${a.start_age}`);
            } else if (a.start_date) {
                const startDate = new Date(a.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                descriptions.push(`Starts: ${startDate}`);
            }
            if (a.inflation_adjusted) {
                descriptions.push('<span style="color: var(--success-color);">COLA adjusted</span>');
            }
        } else if (a.categoryKey === 'other_assets') {
            if (a.type === 'business_interest' && a.ownership_pct) {
                descriptions.push(`${a.ownership_pct}% ownership`);
            }
            if (a.annual_income && a.annual_income > 0) {
                descriptions.push(`Income: ${formatCurrency(a.annual_income, 0)}/yr`);
            }
        }

        // If no descriptions, add allocation info as fallback for investment accounts
        if (descriptions.length === 0 && (a.stock_pct !== undefined || a.bond_pct !== undefined || a.cash_pct !== undefined)) {
            const s = Math.round((a.stock_pct || 0) * 100);
            const b = Math.round((a.bond_pct || 0) * 100);
            const c = Math.round((a.cash_pct || 0) * 100);

            if (c === 100 && s === 0 && b === 0) {
                descriptions.push('<span style="color: var(--success-color);">100% Cash</span>');
            } else if (s === 100 && b === 0 && c === 0) {
                descriptions.push('<span style="color: var(--accent-color);">100% Stocks</span>');
            } else {
                const parts = [];
                if (s > 0) parts.push(`${s}% Stocks`);
                if (b > 0) parts.push(`${b}% Bonds`);
                if (c > 0) parts.push(`${c}% Cash`);
                if (parts.length > 0) {
                    descriptions.push(parts.join(', '));
                }
            }
        }

        return descriptions.length > 0 ? descriptions.join(' • ') : '—';
    };

    const descriptionDisplay = getDescriptionDisplay(asset);

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
            <td style="padding: 8px 12px; text-align: left; font-size: 12px; color: var(--text-secondary);">
                ${descriptionDisplay}
            </td>
            <td style="padding: 8px 12px; text-align: right;">
                <div>
                    <span style="font-size: 14px; font-weight: 600; color: var(--accent-color);">${valueDisplay}</span>
                    ${asset.categoryKey === 'real_estate' && asset.mortgage_balance > 0 ?
                        `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px; font-weight: normal;">(Equity)</div>` : ''
                    }
                    ${secondaryValueDisplay}
                </div>
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
