/**
 * Assets tab - Main component for asset management
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { renderAssetList } from './asset-list.js';
import { showAssetWizard } from './asset-wizard.js';
import { showAIImportModal } from '../ai/ai-import-modal.js';
import { exportAssetsCSV, importAssetsCSV } from './asset-csv-handler.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { calculateNetWorth } from '../../utils/financial-calculations.js';

/**
 * Extract account number digits from a string
 */
function extractAccountDigits(str) {
    if (!str) return null;
    const matches = str.match(/\(?(\d{4,})\)?/g);
    if (matches && matches.length > 0) {
        return matches[matches.length - 1].replace(/[^\d]/g, '');
    }
    return null;
}

/**
 * Detect potential duplicate assets across all categories
 * Returns array of asset IDs that may be duplicates
 */
function detectPotentialDuplicates(assets) {
    const allAssets = [];
    const categories = ['retirement_accounts', 'taxable_accounts', 'real_estate', 'pensions_annuities', 'education_accounts', 'other_assets', 'liabilities'];

    // Flatten all assets with their category
    for (const cat of categories) {
        if (assets[cat]) {
            for (const asset of assets[cat]) {
                allAssets.push({ ...asset, _category: cat });
            }
        }
    }

    const duplicateIds = new Set();

    // Compare each asset to all others
    for (let i = 0; i < allAssets.length; i++) {
        for (let j = i + 1; j < allAssets.length; j++) {
            const a = allAssets[i];
            const b = allAssets[j];

            // Extract account digits from name or account_number
            const aDigits = extractAccountDigits(a.account_number) || extractAccountDigits(a.name);
            const bDigits = extractAccountDigits(b.account_number) || extractAccountDigits(b.name);

            // Check for matching account digits
            if (aDigits && bDigits && aDigits === bDigits) {
                // Check if institution is similar
                const aInst = (a.institution || '').toLowerCase().replace(/[^a-z]/g, '');
                const bInst = (b.institution || '').toLowerCase().replace(/[^a-z]/g, '');

                if (aInst === bInst || aInst.includes(bInst) || bInst.includes(aInst) || !aInst || !bInst) {
                    // Check if values are similar (within 5%)
                    const valueDiff = Math.abs((a.value || 0) - (b.value || 0));
                    const maxValue = Math.max(a.value || 0, b.value || 0);
                    const pctDiff = maxValue > 0 ? valueDiff / maxValue : 0;

                    if (pctDiff < 0.05) {
                        // Very likely duplicates
                        if (a.id) duplicateIds.add(a.id);
                        if (b.id) duplicateIds.add(b.id);
                    }
                }
            }
        }
    }

    return Array.from(duplicateIds);
}

// Store duplicate IDs for highlighting (module-level for access by render functions)
let potentialDuplicateIds = [];

/**
 * Check if an asset is a potential duplicate
 */
export function isPotentialDuplicate(assetId) {
    return potentialDuplicateIds.includes(assetId);
}

/**
 * Update the list of potential duplicates
 */
export function updateDuplicateDetection(assets) {
    potentialDuplicateIds = detectPotentialDuplicates(assets);
    return potentialDuplicateIds;
}

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
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
        return;
    }

    const assets = profile.data?.assets || {
        retirement_accounts: [],
        taxable_accounts: [],
        real_estate: [],
        pensions_annuities: [],
        education_accounts: [],
        other_assets: [],
        liabilities: []
    };

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: var(--font-2xl); margin: 0;">💰 Asset Management</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Tracking <strong>${profile.name}'s</strong> portfolio
                    </p>
                </div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; flex-shrink: 0;">
                    <button id="add-asset-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                        + Add Asset
                    </button>
                    <button id="ai-import-assets-btn" style="padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        AI Import
                    </button>
                    <div style="display: flex; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                        <button id="csv-export-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-right: 1px solid var(--border-color); cursor: pointer; font-size: 11px;">
                            Export
                        </button>
                        <button id="csv-import-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; cursor: pointer; font-size: 11px;">
                            TXT/CSV
                        </button>
                    </div>
                    <button id="delete-all-assets-btn" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--danger-color); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;" title="Delete all assets">
                        🗑️
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div id="asset-summary" style="margin-bottom: 12px;"></div>

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
            other_assets: [],
            liabilities: []
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
                const { pensions_annuities: _, ...netWorthAssets } = assets;
                const netWorth = calculateNetWorth(netWorthAssets);        return netWorthAssets;
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
            ${cards.map(card => {
                const isSelected = card.key === selectedFilter;
                return `
                <div class="summary-card" data-filter="${card.key}" style="
                    background: ${isSelected ? 'var(--accent-color)' : 'var(--bg-secondary)'}; 
                    padding: 10px 12px; 
                    border-radius: 6px; 
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'};
                    ${isSelected ? 'box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);' : ''}
                ">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 16px;">${card.icon}</span>
                        <div style="font-size: 11px; ${isSelected ? 'color: white; opacity: 0.9;' : 'color: var(--text-secondary);'} font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">
                            ${card.label}
                        </div>
                    </div>
                    <div style="font-size: 18px; font-weight: 700; ${isSelected ? 'color: white;' : 'color: var(--text-primary);'}">
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
        btn.addEventListener('click', async () => {
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
    const aiImportBtn = container.querySelector('#ai-import-assets-btn');
    if (aiImportBtn) {
        aiImportBtn.addEventListener('click', () => {
            showAIImportModal('assets', profile.name, async (extractedAssets) => {
                let added = 0, updated = 0;

                // Helper: extract account number digits from name or account_number field
                const extractAccountDigits = (str) => {
                    if (!str) return null;
                    // Extract last 4+ digits, handling formats like "8737", "(8737)", "Wells Fargo 8737", "WF (8737)"
                    const matches = str.match(/\(?(\d{4,})\)?/g);
                    if (matches && matches.length > 0) {
                        // Get the last match and extract just digits
                        return matches[matches.length - 1].replace(/[^\d]/g, '');
                    }
                    return null;
                };

                // Helper: check if two assets are likely duplicates (fuzzy match)
                const isFuzzyMatch = (item, existing) => {
                    // Extract account digits from both name and account_number fields
                    const itemDigits = extractAccountDigits(item.account_number) || extractAccountDigits(item.name);
                    const existingDigits = extractAccountDigits(existing.account_number) || extractAccountDigits(existing.name);

                    // If both have account digits and they match, it's likely a duplicate
                    if (itemDigits && existingDigits && itemDigits === existingDigits) {
                        // Also check institution matches (fuzzy)
                        const itemInst = (item.institution || '').toLowerCase().replace(/[^a-z]/g, '');
                        const existingInst = (existing.institution || '').toLowerCase().replace(/[^a-z]/g, '');
                        if (itemInst && existingInst && (itemInst.includes(existingInst) || existingInst.includes(itemInst))) {
                            return true;
                        }
                        // If no institution but same digits, still likely duplicate
                        if (!itemInst || !existingInst) {
                            return true;
                        }
                    }
                    return false;
                };

                // Helper: find existing asset across all categories using multiple markers
                const findExistingAsset = (item) => {
                    const allCategories = ['retirement_accounts', 'taxable_accounts', 'real_estate', 'pensions_annuities', 'education_accounts', 'other_assets', 'liabilities'];

                    for (const cat of allCategories) {
                        if (!assets[cat]) continue;

                        for (let i = 0; i < assets[cat].length; i++) {
                            const existing = assets[cat][i];

                            // Priority 1: Exact account_number match
                            if (item.account_number && existing.account_number &&
                                item.account_number === existing.account_number) {
                                return { category: cat, index: i, existing };
                            }

                            // Priority 2: Fuzzy match on account digits (handles "8737" vs "(8737)")
                            if (isFuzzyMatch(item, existing)) {
                                return { category: cat, index: i, existing, fuzzy: true };
                            }

                            // Priority 3: Match by name + institution (both must match exactly)
                            if (item.institution && existing.institution &&
                                item.name?.toLowerCase() === existing.name?.toLowerCase() &&
                                item.institution.toLowerCase() === existing.institution.toLowerCase()) {
                                return { category: cat, index: i, existing };
                            }
                        }
                    }

                    return null;
                };

                // Process each extracted asset with reconciliation
                for (const item of extractedAssets) {
                    const type = item.type || 'brokerage';
                    let targetCategory = 'taxable_accounts';

                    if (['401k', '403b', '457', 'traditional_ira', 'roth_ira'].includes(type)) {
                        targetCategory = 'retirement_accounts';
                    } else if (['savings', 'checking', 'brokerage'].includes(type)) {
                        targetCategory = 'taxable_accounts';
                    }

                    if (!assets[targetCategory]) assets[targetCategory] = [];

                    const match = findExistingAsset(item);

                    if (match) {
                        // Update existing asset - preserve id and allocation, update value/cost_basis
                        console.log(`Matched "${item.name}" to existing "${match.existing.name}"${match.fuzzy ? ' (fuzzy)' : ''}`);
                        assets[match.category][match.index] = {
                            ...match.existing,
                            value: item.value ?? match.existing.value,
                            cost_basis: item.cost_basis ?? match.existing.cost_basis,
                            institution: item.institution || match.existing.institution,
                            account_number: item.account_number || match.existing.account_number
                        };
                        updated++;
                    } else {
                        // Add new asset
                        assets[targetCategory].push({
                            id: crypto.randomUUID(),
                            name: item.name,
                            type: type,
                            value: item.value || 0,
                            cost_basis: item.cost_basis || 0,
                            institution: item.institution || '',
                            account_number: item.account_number || '',
                            stock_pct: 0.6,
                            bond_pct: 0.3,
                            cash_pct: 0.1
                        });
                        added++;
                    }
                }

                await saveAssets(profile, assets);
                if (refreshCallback) refreshCallback();

                // Detect potential duplicates after import
                const duplicates = detectPotentialDuplicates(assets);

                // Show summary of what happened
                const parts = [];
                if (added > 0) parts.push(`${added} added`);
                if (updated > 0) parts.push(`${updated} updated`);
                if (duplicates.length > 0) parts.push(`${duplicates.length} potential duplicates detected`);
                if (parts.length > 0) {
                    if (duplicates.length > 0) {
                        showError(`Assets imported: ${parts.join(', ')}. Review highlighted items.`);
                    } else {
                        showSuccess(`Assets imported: ${parts.join(', ')}`);
                    }
                }
            });
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
                    if (refreshCallback) refreshCallback();
                    showSuccess('Assets imported successfully!');
                });
            } catch (error) {
                showError(`Error importing CSV: ${error.message}`);
            }
        });
    }

    // Delete All Assets button
    const deleteAllBtn = container.querySelector('#delete-all-assets-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            showDeleteAllAssetsModal(profile, refreshCallback);
        });
    }
}

/**
 * Show modal to confirm deleting all assets
 */
function showDeleteAllAssetsModal(profile, refreshCallback) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;">
                <h3 style="margin: 0 0 16px 0; color: var(--danger-color);">⚠️ Delete All Assets</h3>
                <p style="margin: 0 0 16px 0; color: var(--text-secondary);">
                    This will permanently delete <strong>ALL</strong> assets including:
                </p>
                <ul style="margin: 0 0 16px 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px;">
                    <li>Retirement accounts (401k, IRA, etc.)</li>
                    <li>Taxable accounts (brokerage, savings)</li>
                    <li>Real estate properties</li>
                    <li>Pensions & annuities</li>
                    <li>Other assets & liabilities</li>
                </ul>
                <p style="margin: 0 0 20px 0; color: var(--danger-color); font-weight: 600;">
                    This action cannot be undone!
                </p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-delete" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="confirm-delete" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Delete All Assets
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#cancel-delete').addEventListener('click', () => modal.remove());
    modal.querySelector('#confirm-delete').addEventListener('click', async () => {
        try {
            const emptyAssets = {
                retirement_accounts: [],
                taxable_accounts: [],
                real_estate: [],
                pensions_annuities: [],
                other_assets: [],
                liabilities: []
            };
            await saveAssets(profile, emptyAssets);
            if (refreshCallback) refreshCallback();
            showSuccess('All assets deleted');
            modal.remove();
        } catch (error) {
            showError('Failed to delete assets: ' + error.message);
        }
    });
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

