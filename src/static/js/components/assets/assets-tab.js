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

export function renderAssetsTab(container) {
    const profile = store.get('currentProfile');

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

    const financial = profile.data?.financial || {};
    const spouse = profile.data?.spouse || {};
    const hasSpouse = spouse.name ? true : false;
    const primaryName = profile.name || 'Primary';
    const spouseName = spouse.name || 'Spouse';

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h1 style="font-size: 24px; margin-bottom: 5px;">💰 Asset Management</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Manage your retirement accounts, real estate, and other assets
                    </p>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
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

            <!-- Financial Information Section -->
            <div id="financial-section" style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 15px;">
                <h2 style="font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid var(--accent-color); padding-bottom: 8px;">
                    Financial Information
                </h2>
                <form id="financial-form">
                    <!-- Household Income/Expenses -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label for="annual_income" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Annual Income</label>
                            <input type="text" id="annual_income" name="annual_income" value="${financial.annual_income ? formatCurrency(financial.annual_income, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                            <small style="color: var(--text-secondary); font-size: 11px;">Your current annual gross income</small>
                        </div>
                        <div class="form-group">
                            <label for="annual_expenses" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Annual Expenses</label>
                            <input type="text" id="annual_expenses" name="annual_expenses" value="${financial.annual_expenses ? formatCurrency(financial.annual_expenses, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                            <small style="color: var(--text-secondary); font-size: 11px;">Your current annual spending</small>
                        </div>
                    </div>

                    <!-- Benefits by Person -->
                    <div style="display: grid; grid-template-columns: ${hasSpouse ? '1fr 1fr' : '1fr'}; gap: 20px;">
                        <!-- Primary Person Benefits -->
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px;">
                            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">${primaryName}'s Benefits</h3>
                            <div style="display: grid; gap: 12px;">
                                <div class="form-group">
                                    <label for="social_security_benefit" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Social Security (monthly)</label>
                                    <input type="text" id="social_security_benefit" name="social_security_benefit" value="${financial.social_security_benefit ? formatCurrency(financial.social_security_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Estimated monthly benefit at full retirement age</small>
                                </div>
                                <div class="form-group">
                                    <label for="pension_benefit" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Pension (monthly)</label>
                                    <input type="text" id="pension_benefit" name="pension_benefit" value="${financial.pension_benefit ? formatCurrency(financial.pension_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Monthly pension amount, if applicable</small>
                                </div>
                            </div>
                        </div>

                        ${hasSpouse ? `
                        <!-- Spouse Benefits -->
                        <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px;">
                            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">${spouseName}'s Benefits</h3>
                            <div style="display: grid; gap: 12px;">
                                <div class="form-group">
                                    <label for="spouse_social_security" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Social Security (monthly)</label>
                                    <input type="text" id="spouse_social_security" name="spouse_social_security" value="${spouse.social_security_benefit ? formatCurrency(spouse.social_security_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Estimated monthly benefit at full retirement age</small>
                                </div>
                                <div class="form-group">
                                    <label for="spouse_pension" style="font-weight: 600; margin-bottom: 5px; display: block; font-size: 13px;">Pension (monthly)</label>
                                    <input type="text" id="spouse_pension" name="spouse_pension" value="${spouse.pension_benefit ? formatCurrency(spouse.pension_benefit, 0) : ''}" placeholder="$0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                    <small style="color: var(--text-secondary); font-size: 11px;">Monthly pension amount, if applicable</small>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div style="margin-top: 15px; text-align: right;">
                        <button type="submit" id="save-financial-btn" style="padding: 8px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            Save Financial Info
                        </button>
                    </div>
                </form>
            </div>

            <!-- Summary Cards -->
            <div id="asset-summary" style="margin-bottom: 15px;"></div>

            <!-- Asset Categories -->
            <div id="asset-categories"></div>
        </div>
    `;

    // Render summary cards
    renderSummaryCards(assets, container.querySelector('#asset-summary'));

    // Render asset lists by category
    renderAssetList(assets, container.querySelector('#asset-categories'));

    // Set up event handlers
    setupEventHandlers(container, profile, assets);
}

/**
 * Render summary cards showing totals
 */
function renderSummaryCards(assets, container) {
    const retirementTotal = calculateTotal(assets.retirement_accounts);
    const taxableTotal = calculateTotal(assets.taxable_accounts);
    const realEstateTotal = calculateTotal(assets.real_estate, 'value', 'current_value');
    const otherTotal = calculateTotal(assets.other_assets);
    const pensionMonthly = calculateTotal(assets.pensions_annuities, 'monthly_benefit');

    const netWorth = retirementTotal + taxableTotal + realEstateTotal + otherTotal;

    const cards = [
        { label: 'Total Net Worth', value: netWorth, icon: '💎', highlight: true },
        { label: 'Retirement Accounts', value: retirementTotal, icon: '🏦' },
        { label: 'Taxable Accounts', value: taxableTotal, icon: '💰' },
        { label: 'Real Estate', value: realEstateTotal, icon: '🏠' },
        { label: 'Other Assets', value: otherTotal, icon: '📦' },
        { label: 'Monthly Pension', value: pensionMonthly, icon: '💵', suffix: '/mo' }
    ];

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            ${cards.map(card => `
                <div style="background: ${card.highlight ? 'linear-gradient(135deg, var(--accent-color) 0%, #764ba2 100%)' : 'var(--bg-secondary)'}; padding: 20px; border-radius: 12px; ${card.highlight ? 'box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);' : ''}">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span style="font-size: 24px;">${card.icon}</span>
                        <div style="font-size: 14px; ${card.highlight ? 'color: rgba(255,255,255,0.9);' : 'color: var(--text-secondary);'} font-weight: 600;">
                            ${card.label}
                        </div>
                    </div>
                    <div style="font-size: 28px; font-weight: 700; ${card.highlight ? 'color: white;' : 'color: var(--text-primary);'}">
                        ${formatCurrency(card.value, 0)}${card.suffix || ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Calculate total for an array of assets
 */
function calculateTotal(items, field1 = 'value', field2 = null) {
    return items.reduce((sum, item) => {
        const value = item[field1] || (field2 ? item[field2] : 0) || 0;
        return sum + value;
    }, 0);
}

/**
 * Setup event handlers
 */
function setupEventHandlers(container, profile, assets) {
    // Financial form submission
    const financialForm = container.querySelector('#financial-form');
    if (financialForm) {
        // Add currency formatting on blur
        const currencyFields = ['annual_income', 'annual_expenses', 'social_security_benefit',
                               'pension_benefit', 'spouse_social_security', 'spouse_pension'];
        currencyFields.forEach(fieldName => {
            const field = container.querySelector(`#${fieldName}`);
            if (field) {
                field.addEventListener('blur', (e) => {
                    const value = parseCurrency(e.target.value);
                    if (value > 0) {
                        e.target.value = formatCurrency(value, 0);
                    }
                });
            }
        });

        financialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = container.querySelector('#save-financial-btn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            try {
                const formData = new FormData(financialForm);
                const financial = {};

                // Primary person financial fields
                const primaryFields = ['annual_income', 'annual_expenses', 'social_security_benefit', 'pension_benefit'];
                primaryFields.forEach(field => {
                    const value = formData.get(field);
                    if (value) {
                        financial[field] = parseCurrency(value);
                    }
                });

                // Spouse financial fields
                const spouseUpdates = {};
                const spouseSS = formData.get('spouse_social_security');
                if (spouseSS) {
                    spouseUpdates.social_security_benefit = parseCurrency(spouseSS);
                }
                const spousePension = formData.get('spouse_pension');
                if (spousePension) {
                    spouseUpdates.pension_benefit = parseCurrency(spousePension);
                }

                const updatedData = {
                    ...profile.data,
                    financial: {
                        ...(profile.data?.financial || {}),
                        ...financial
                    },
                    spouse: {
                        ...(profile.data?.spouse || {}),
                        ...spouseUpdates
                    }
                };

                const result = await profilesAPI.update(profile.name, { data: updatedData });
                store.setState({ currentProfile: result.profile });
                showSuccess('Financial information saved!');

                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Financial Info';
            } catch (error) {
                console.error('Error saving financial info:', error);
                showError(container, error.message);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Financial Info';
            }
        });
    }

    // Main "Add Asset" button
    const addAssetBtn = container.querySelector('#add-asset-btn');
    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', () => {
            showAssetWizard(null, null, (updatedAssets) => {
                saveAssets(profile, updatedAssets);
            });
        });
    }

    // AI Import button
    const aiImportBtn = container.querySelector('#ai-import-btn');
    if (aiImportBtn) {
        aiImportBtn.addEventListener('click', () => {
            showAIUploadModal(assets, (updatedAssets) => {
                saveAssets(profile, updatedAssets);
            });
        });
    }

    // CSV Export button
    const csvExportBtn = container.querySelector('#csv-export-btn');
    if (csvExportBtn) {
        csvExportBtn.addEventListener('click', async () => {
            try {
                await exportAssetsCSV(profile.name);
            } catch (error) {
                alert(`Error exporting CSV: ${error.message}`);
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
                    window.app.showTab('assets'); // Refresh tab
                });
            } catch (error) {
                alert(`Error importing CSV: ${error.message}`);
            }
        });
    }

    // Edit buttons
    container.querySelectorAll('.edit-asset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            const index = parseInt(e.target.dataset.index);
            const asset = assets[category][index];

            showAssetWizard(category, asset, (updatedAssets) => {
                saveAssets(profile, updatedAssets);
            }, index);
        });
    });

    // Delete buttons
    container.querySelectorAll('.delete-asset-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const category = e.target.dataset.category;
            const index = parseInt(e.target.dataset.index);
            const asset = assets[category][index];

            if (confirm(`Are you sure you want to delete "${asset.name}"?`)) {
                // Remove asset from array
                assets[category].splice(index, 1);
                await saveAssets(profile, assets);
            }
        });
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

        // Refresh tab
        window.app.showTab('assets');
    } catch (error) {
        console.error('Error saving assets:', error);
        alert(`Error saving assets: ${error.message}`);
    }
}
