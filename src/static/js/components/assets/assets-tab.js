/**
 * Assets tab - Main component for asset management
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { renderAssetList } from './asset-list.js';
import { showAssetWizard } from './asset-wizard.js';
import { showAIUploadModal } from './asset-ai-upload.js';
import { exportAssetsCSV, importAssetsCSV } from './asset-csv-handler.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { calculateNetWorth, calculateRealEstateEquity, calculateTotalDebts } from '../../utils/financial-calculations.js';

export function renderAssetsTab(container) {
    const profile = store.get('currentProfile');
    let currentFilter = 'total'; // Default filter

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">💰</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to manage assets.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const assets = profile.data?.assets || {
        retirement_accounts: [],
        taxable_accounts: [],
        real_estate: [],
        pensions_annuities: [],
        other_assets: []
    };

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: 24px; margin-bottom: 5px;">💰 Asset Management</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Manage your retirement accounts, real estate, and other assets
                    </p>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0;">
                    <button id="add-asset-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 13px;">
                        + Add Asset
                    </button>
                    <button id="ai-import-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 13px;">
                        📷 Import
                    </button>
                    <button id="csv-export-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 13px;">
                        ⬇️ Export
                    </button>
                    <button id="csv-import-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 13px;">
                        ⬆️ Import
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div id="asset-summary" style="margin-bottom: 15px;"></div>

            <!-- Asset Categories -->
            <div id="asset-categories"></div>
        </div>
    `;

    // Function to update the view
    const updateView = () => {
        // Always get fresh data from store to avoid stale closures
        const latestProfile = store.get('currentProfile');
        const latestAssets = latestProfile.data?.assets || {
            retirement_accounts: [],
            taxable_accounts: [],
            real_estate: [],
            pensions_annuities: [],
            other_assets: []
        };

        const summaryContainer = container.querySelector('#asset-summary');
        const listContainer = container.querySelector('#asset-categories');

        // Render summary cards with current filter
        renderSummaryCards(latestAssets, summaryContainer, currentFilter);

        // Filter assets
        const filteredAssets = filterAssets(latestAssets, currentFilter);

        // Create save callback for inline editing
        // Pass a callback that receives category, index, and updatedAsset
        const saveCallback = async (category, index, updatedAsset) => {
            // Update the asset in the ORIGINAL assets object (not filtered)
            latestAssets[category][index] = updatedAsset;
            await saveAssets(latestProfile, latestAssets);
            updateView();
        };

        // Render asset list with save callback for inline editing
        renderAssetList(filteredAssets, listContainer, saveCallback);

        // Setup list handlers (edit/delete) - keeping old edit button for fallback
        setupAssetListHandlers(container, latestProfile, latestAssets, updateView);
    };

    // Initial render
    updateView();

    // Set up other event handlers (financial form, buttons)
    // Initial call uses captured assets/profile but updateView within them will refresh
    setupGeneralHandlers(container, profile, assets, updateView);

    // Setup summary card click handler (delegation)
    container.querySelector('#asset-summary').addEventListener('click', (e) => {
        const card = e.target.closest('.summary-card');
        if (card) {
            currentFilter = card.dataset.filter;
            updateView();
        }
    });
}

/**
 * Filter assets based on selected category
 */
function filterAssets(assets, filterKey) {
    if (filterKey === 'total') {
        // Return everything except pensions (which are income, usually)
        // Or should total net worth show everything?
        // Let's exclude pensions from "Net Worth" view list if they are excluded from calculation
        // But user might want to see them.
        // Based on calculation: Net Worth = Retirement + Taxable + Real Estate + Other
        const { pensions_annuities, ...netWorthAssets } = assets;
        return netWorthAssets;
    }
    
    if (filterKey === 'pensions_annuities') {
        return { pensions_annuities: assets.pensions_annuities };
    }

    // specific category
    if (assets[filterKey]) {
        return { [filterKey]: assets[filterKey] };
    }

    return assets;
}

/**
 * Render summary cards showing totals
 */
function renderSummaryCards(assets, container, selectedFilter) {
    // Use the financial calculations utility for consistent net worth calculation
    const { netWorth, breakdown } = calculateNetWorth(assets);
    const retirementTotal = breakdown.retirementAssets;
    const taxableTotal = breakdown.taxableAssets;
    const realEstateEquity = breakdown.realEstateAssets; // This is equity (value - mortgage)
    const otherTotal = breakdown.otherAssets;
    const pensionMonthly = calculateTotal(assets.pensions_annuities, 'monthly_benefit');

    const cards = [
        { key: 'total', label: 'Total Net Worth', value: netWorth, icon: '💎' },
        { key: 'retirement_accounts', label: 'Retirement Accounts', value: retirementTotal, icon: '🏦' },
        { key: 'taxable_accounts', label: 'Taxable Accounts', value: taxableTotal, icon: '💰' },
        { key: 'real_estate', label: 'Real Estate Equity', value: realEstateEquity, icon: '🏠' },
        { key: 'other_assets', label: 'Other Assets', value: otherTotal, icon: '📦' },
        { key: 'pensions_annuities', label: 'Monthly Pension', value: pensionMonthly, icon: '💵', suffix: '/mo' }
    ];

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            ${cards.map(card => {
                const isSelected = card.key === selectedFilter;
                return `
                <div class="summary-card" data-filter="${card.key}" style="
                    background: ${isSelected ? 'linear-gradient(135deg, var(--accent-color) 0%, #764ba2 100%)' : 'var(--bg-secondary)'}; 
                    padding: 20px; 
                    border-radius: 12px; 
                    cursor: pointer;
                    transition: all 0.2s;
                    ${isSelected ? 'box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transform: translateY(-2px);' : 'border: 1px solid transparent;'}
                    ${!isSelected ? ':hover { border-color: var(--accent-color); transform: translateY(-2px); }' : ''}
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="font-size: 24px;">${card.icon}</span>
                        <div style="font-size: 14px; ${isSelected ? 'color: rgba(255,255,255,0.9);' : 'color: var(--text-secondary);'} font-weight: 600;">
                            ${card.label}
                        </div>
                    </div>
                    <div style="font-size: 28px; font-weight: 700; ${isSelected ? 'color: white;' : 'color: var(--text-primary);'}">
                        ${formatCurrency(card.value, 0)}${card.suffix || ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Add hover effect manually since inline styles with :hover pseudo-class don't work directly in style attribute
    container.querySelectorAll('.summary-card').forEach(card => {
        if (!card.style.background.includes('linear-gradient')) {
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = 'var(--accent-color)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.borderColor = 'transparent';
                card.style.transform = 'translateY(0)';
            });
        }
    });
}

/**
 * Calculate total for an array of assets
 */
function calculateTotal(items, field1 = 'value', field2 = null) {
    if (!items || !Array.isArray(items)) {
        return 0;
    }
    return items.reduce((sum, item) => {
        const value = item[field1] || (field2 ? item[field2] : 0) || 0;
        return sum + value;
    }, 0);
}

/**
 * Setup handlers for asset list items (Edit/Delete)
 */
function setupAssetListHandlers(container, profile, assets, refreshCallback) {
    // Edit buttons are now handled in asset-list.js for inline editing

    // Delete buttons
    container.querySelectorAll('.delete-asset-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const category = btn.dataset.category;
            const index = parseInt(btn.dataset.index);
            const asset = assets[category][index];

            if (confirm(`Are you sure you want to delete "${asset.name}"?`)) {
                // Remove asset from array
                assets[category].splice(index, 1);
                await saveAssets(profile, assets);
                showSuccess(`Deleted "${asset.name}"`);
                if (refreshCallback) refreshCallback();
            }
        });
    });
}

/**
 * Setup general event handlers (Top Buttons)
 */
function setupGeneralHandlers(container, profile, assets, refreshCallback) {
    // Main "Add Asset" button
    const addAssetBtn = container.querySelector('#add-asset-btn');
    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', () => {
            showAssetWizard(null, null, async (updatedAssets) => {
                await saveAssets(profile, updatedAssets);
                if (refreshCallback) refreshCallback();
            });
        });
    }

    // AI Import button
    const aiImportBtn = container.querySelector('#ai-import-btn');
    if (aiImportBtn) {
        aiImportBtn.addEventListener('click', () => {
            showAIUploadModal(assets, async (updatedAssets) => {
                await saveAssets(profile, updatedAssets);
                if (refreshCallback) refreshCallback();
            }, profile);
        });
    }

    // CSV Export button
    const csvExportBtn = container.querySelector('#csv-export-btn');
    if (csvExportBtn) {
        csvExportBtn.addEventListener('click', async () => {
            try {
                await exportAssetsCSV(profile.name);
                showSuccess('Assets exported successfully!');
            } catch (error) {
                showError(`Error exporting CSV: ${error.message}`);
            }
        });
    }

    // CSV Import button
    const csvImportBtn = container.querySelector('#csv-import-btn');
    if (csvImportBtn) {
        csvImportBtn.addEventListener('click', async () => {
            try {
                await importAssetsCSV(profile.name, (updatedProfile) => {
                    store.setState({ currentProfile: updatedProfile });
                    // Full refresh needed as profile object changed
                    window.app.showTab('assets'); 
                    showSuccess('Assets imported successfully!');
                });
            } catch (error) {
                showError(`Error importing CSV: ${error.message}`);
            }
        });
    }
}

/**
 * Save assets to profile
 */
async function saveAssets(profile, updatedAssets) {
    try {
        const updatedData = {
            ...profile.data,
            assets: updatedAssets
        };

        const result = await profilesAPI.update(profile.name, {
            data: updatedData
        });

        // Update store
        store.setState({ currentProfile: result.profile });
        
        // Note: View refresh is handled by the callback passed to showAssetWizard/etc
        return true;
    } catch (error) {
        console.error('Error saving assets:', error);
        showError(`Error saving assets: ${error.message}`);
        return false;
    }
}
