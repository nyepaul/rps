/**
 * Asset wizard - Multi-step modal for adding/editing assets
 */

import { store } from '../../state/store.js';
import { generateFormFields, extractFormData, getAssetTypeLabel } from './asset-form-fields.js';
import { formatCurrency } from '../../utils/formatters.js';

const CATEGORIES = {
    retirement_accounts: { label: 'Retirement Accounts', icon: '🏦', description: '401(k), IRA, Roth IRA, etc.' },
    taxable_accounts: { label: 'Taxable Accounts', icon: '💰', description: 'Brokerage, Savings, Checking' },
    real_estate: { label: 'Real Estate', icon: '🏠', description: 'Properties and Land' },
    pensions_annuities: { label: 'Pensions & Annuities', icon: '💵', description: 'Retirement Income Streams' },
    other_assets: { label: 'Other Assets', icon: '📦', description: 'Business, Collectibles, etc.' }
};

// Account types grouped by visual category for selection UI
const ACCOUNT_TYPES = {
    retirement: {
        label: 'Retirement Accounts',
        icon: '🏦',
        types: [
            { value: '401k', label: '401(k)', category: 'retirement_accounts' },
            { value: 'roth_401k', label: 'Roth 401(k)', category: 'retirement_accounts' },
            { value: 'traditional_ira', label: 'Traditional IRA', category: 'retirement_accounts' },
            { value: 'roth_ira', label: 'Roth IRA', category: 'retirement_accounts' },
            { value: 'sep_ira', label: 'SEP IRA', category: 'retirement_accounts' },
            { value: 'simple_ira', label: 'SIMPLE IRA', category: 'retirement_accounts' },
            { value: '403b', label: '403(b)', category: 'retirement_accounts' },
            { value: '457', label: '457', category: 'retirement_accounts' }
        ]
    },
    taxable: {
        label: 'Bank & Brokerage',
        icon: '💰',
        types: [
            { value: 'brokerage', label: 'Brokerage Account', category: 'taxable_accounts' },
            { value: 'savings', label: 'Savings Account', category: 'taxable_accounts' },
            { value: 'checking', label: 'Checking Account', category: 'taxable_accounts' },
            { value: 'money_market', label: 'Money Market', category: 'taxable_accounts' },
            { value: 'cd', label: 'Certificate of Deposit', category: 'taxable_accounts' },
            { value: 'cash', label: 'Cash', category: 'taxable_accounts' }
        ]
    },
    real_estate: {
        label: 'Real Estate',
        icon: '🏠',
        types: [
            { value: 'primary_residence', label: 'Primary Residence', category: 'real_estate' },
            { value: 'rental_property', label: 'Rental Property', category: 'real_estate' },
            { value: 'vacation_home', label: 'Vacation Home', category: 'real_estate' },
            { value: 'land', label: 'Land', category: 'real_estate' },
            { value: 'commercial', label: 'Commercial Property', category: 'real_estate' }
        ]
    },
    income: {
        label: 'Income Streams',
        icon: '💵',
        types: [
            { value: 'pension', label: 'Pension', category: 'pensions_annuities' },
            { value: 'annuity', label: 'Annuity', category: 'pensions_annuities' }
        ]
    },
    other: {
        label: 'Other Assets',
        icon: '📦',
        types: [
            { value: 'hsa', label: 'Health Savings Account (HSA)', category: 'other_assets' },
            { value: 'business_interest', label: 'Business Interest', category: 'other_assets' },
            { value: 'cryptocurrency', label: 'Cryptocurrency', category: 'other_assets' },
            { value: 'trust', label: 'Trust', category: 'other_assets' },
            { value: 'collectible', label: 'Collectible', category: 'other_assets' },
            { value: 'other', label: 'Other', category: 'other_assets' }
        ]
    }
};

// Map account type to category
function getCategoryForType(accountType) {
    for (const group of Object.values(ACCOUNT_TYPES)) {
        for (const type of group.types) {
            if (type.value === accountType) {
                return type.category;
            }
        }
    }
    return 'other_assets';
}

/**
 * Show asset wizard modal
 * @param {string|null} preselectedCategory - Category to jump to (null for category selection)
 * @param {object|null} existingAsset - Asset to edit (null for new asset)
 * @param {function} onSave - Callback with updated assets
 * @param {number|null} assetIndex - Index of asset being edited
 */
export function showAssetWizard(preselectedCategory = null, existingAsset = null, onSave = null, assetIndex = null) {
    const profile = store.get('currentProfile');
    if (!profile) {
        alert('No profile selected');
        return;
    }

    const assets = profile.data?.assets || {
        retirement_accounts: [],
        taxable_accounts: [],
        real_estate: [],
        pensions_annuities: [],
        other_assets: []
    };

    const isEditing = existingAsset !== null;
    const wizardState = {
        currentStep: (preselectedCategory || isEditing) ? 2 : 1,
        category: preselectedCategory || (existingAsset ? getCategoryForAsset(existingAsset, assets) : null),
        assetData: existingAsset ? { ...existingAsset } : {},
        assetIndex: assetIndex,
        // Multi-select support
        selectedTypes: [],  // Array of {type, category} for multi-add
        currentTypeIndex: 0, // Which selected type we're editing
        completedAssets: []  // Assets completed so far in multi-add
    };

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
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

    const wizard = document.createElement('div');
    wizard.style.cssText = `
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 700px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    modal.appendChild(wizard);
    document.body.appendChild(modal);

    // Render initial step
    renderWizardStep(wizard, wizardState, assets, onSave, modal, isEditing);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (confirm('Close wizard? Any unsaved changes will be lost.')) {
                modal.remove();
            }
        }
    });
}

/**
 * Find which category an asset belongs to
 */
function getCategoryForAsset(asset, assets) {
    for (const [category, items] of Object.entries(assets)) {
        if (items.includes(asset)) {
            return category;
        }
    }
    return null;
}

/**
 * Render wizard step
 */
function renderWizardStep(wizard, state, assets, onSave, modal, isEditing) {
    wizard.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 30px;
        border-bottom: 2px solid var(--border-color);
    `;
    header.innerHTML = `
        <h2 style="margin: 0 0 10px 0; font-size: 28px;">
            ${isEditing ? '✏️ Edit Asset' : '+ Add New Asset'}
        </h2>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
            ${renderProgressIndicator(state.currentStep)}
        </div>
    `;
    wizard.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 30px;`;

    if (state.currentStep === 1) {
        content.innerHTML = renderStep1CategorySelection(state);
    } else if (state.currentStep === 2) {
        content.innerHTML = renderStep2AssetForm(state);
    } else if (state.currentStep === 3) {
        content.innerHTML = renderStep3Review(state);
    }

    wizard.appendChild(content);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 20px 30px;
        border-top: 2px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    footer.innerHTML = renderFooterButtons(state, isEditing);
    wizard.appendChild(footer);

    // Setup event handlers
    setupWizardHandlers(wizard, state, assets, onSave, modal, isEditing);
}

/**
 * Render progress indicator
 */
function renderProgressIndicator(currentStep) {
    const steps = [
        { num: 1, label: 'Type' },
        { num: 2, label: 'Details' },
        { num: 3, label: 'Review' }
    ];

    return steps.map(step => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;
        return `
            <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; ${
                    isActive ? 'background: var(--accent-color); color: white;' :
                    isCompleted ? 'background: var(--success-color); color: white;' :
                    'background: var(--bg-tertiary); color: var(--text-secondary);'
                }">
                    ${isCompleted ? '✓' : step.num}
                </div>
                <span style="font-size: 14px; font-weight: ${isActive ? '600' : '400'}; color: ${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                    ${step.label}
                </span>
            </div>
        `;
    }).join('<div style="width: 30px; height: 2px; background: var(--border-color); margin: 0 -15px;"></div>');
}

/**
 * Step 1: Account Type Selection (Multi-select)
 */
function renderStep1CategorySelection(state) {
    const selectedCount = state.selectedTypes.length;
    const isSelected = (typeValue) => state.selectedTypes.some(t => t.type === typeValue);

    return `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 20px;">Select the assets you want to add</h3>
                ${selectedCount > 0 ? `
                    <span style="padding: 6px 12px; background: var(--accent-color); color: white; border-radius: 20px; font-size: 13px; font-weight: 600;">
                        ${selectedCount} selected
                    </span>
                ` : ''}
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                Click to select multiple asset types, then click Next to enter details for each.
            </p>
            <div style="display: grid; gap: 20px; max-height: 400px; overflow-y: auto; padding-right: 10px;">
                ${Object.entries(ACCOUNT_TYPES).map(([groupKey, group]) => `
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="font-size: 20px;">${group.icon}</span>
                            <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">${group.label}</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${group.types.map(type => `
                                <button type="button" class="type-option" data-type="${type.value}" data-category="${type.category}"
                                    style="padding: 10px 16px; background: ${isSelected(type.value) ? 'var(--accent-color)' : 'var(--bg-primary)'};
                                    color: ${isSelected(type.value) ? 'white' : 'var(--text-primary)'};
                                    border: 2px solid ${isSelected(type.value) ? 'var(--accent-color)' : 'var(--border-color)'};
                                    border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
                                    ${isSelected(type.value) ? '✓ ' : ''}${type.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Step 2: Asset Form
 */
function renderStep2AssetForm(state) {
    if (!state.category) {
        return '<p>Please select an account type first.</p>';
    }

    const typeLabel = getAssetTypeLabel(state.assetData.type);
    const isMultiAdd = state.selectedTypes.length > 1;
    const currentNum = state.currentTypeIndex + 1;
    const totalNum = state.selectedTypes.length;

    return `
        <div>
            ${isMultiAdd ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="font-size: 14px; color: var(--text-secondary);">Adding asset ${currentNum} of ${totalNum}</span>
                    <div style="display: flex; gap: 4px;">
                        ${state.selectedTypes.map((_, i) => `
                            <div style="width: 24px; height: 6px; border-radius: 3px; background: ${i < currentNum ? 'var(--accent-color)' : 'var(--border-color)'};"></div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 12px 16px; background: var(--bg-primary); border-radius: 8px; border-left: 4px solid var(--accent-color);">
                <span style="font-size: 24px;">${CATEGORIES[state.category].icon}</span>
                <div>
                    <div style="font-size: 16px; font-weight: 600;">${typeLabel}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Enter the details below</div>
                </div>
            </div>
            <form id="asset-form" style="display: grid; gap: 20px;">
                <input type="hidden" name="type" value="${state.assetData.type}">
                ${generateFormFields(state.category, state.assetData, true)}
            </form>
        </div>
    `;
}

/**
 * Step 3: Review
 */
function renderStep3Review(state) {
    // For multi-add, show all completed assets
    const allAssets = [...state.completedAssets];
    if (state.assetData.name) {
        allAssets.push({ asset: state.assetData, category: state.category });
    }

    if (allAssets.length === 0) {
        return '<p>No assets to review.</p>';
    }

    const isSingleAsset = allAssets.length === 1;

    return `
        <div>
            <h3 style="margin-bottom: 20px; font-size: 20px;">
                ${isSingleAsset ? 'Review Asset' : `Review ${allAssets.length} Assets`}
            </h3>
            <div style="display: grid; gap: 15px; max-height: 450px; overflow-y: auto;">
                ${allAssets.map(({ asset, category }) => {
                    const typeLabel = getAssetTypeLabel(asset.type);
                    let valueDisplay = '';
                    if (category === 'pensions_annuities') {
                        valueDisplay = `${formatCurrency(asset.monthly_benefit || 0, 0)}/mo`;
                    } else {
                        valueDisplay = formatCurrency(asset.value || asset.current_value || 0, 0);
                    }

                    return `
                        <div style="background: var(--bg-primary); padding: 16px 20px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 28px;">${CATEGORIES[category].icon}</span>
                                <div>
                                    <div style="font-size: 16px; font-weight: 600;">${asset.name}</div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">${typeLabel}</div>
                                </div>
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--accent-color);">
                                ${valueDisplay}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${allAssets.length > 1 ? `
                <div style="margin-top: 20px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px; text-align: center;">
                    <span style="font-size: 14px; color: var(--text-secondary);">Total: </span>
                    <span style="font-size: 20px; font-weight: 700; color: var(--accent-color);">
                        ${formatCurrency(allAssets.reduce((sum, { asset, category }) => {
                            if (category === 'pensions_annuities') return sum;
                            return sum + (asset.value || asset.current_value || 0);
                        }, 0), 0)}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render footer buttons
 */
function renderFooterButtons(state, isEditing) {
    const showBack = state.currentStep > 1 && !isEditing;
    const showNext = state.currentStep < 3;
    const showSave = state.currentStep === 3;

    // Calculate button labels
    let nextLabel = 'Next →';
    if (state.currentStep === 1 && state.selectedTypes.length > 0) {
        nextLabel = `Next → (${state.selectedTypes.length} selected)`;
    }

    const totalAssets = state.completedAssets.length + (state.assetData?.name ? 1 : 0);
    const saveLabel = isEditing ? 'Save Changes' : (totalAssets > 1 ? `Add ${totalAssets} Assets` : 'Add Asset');

    return `
        <div>
            <button id="cancel-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                Cancel
            </button>
        </div>
        <div style="display: flex; gap: 10px;">
            ${showBack ? `
                <button id="back-btn" style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    ← Back
                </button>
            ` : ''}
            ${showNext ? `
                <button id="next-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ${nextLabel}
                </button>
            ` : ''}
            ${showSave ? `
                <button id="save-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ${saveLabel}
                </button>
            ` : ''}
        </div>
    `;
}

/**
 * Setup event handlers
 */
function setupWizardHandlers(wizard, state, assets, onSave, modal, isEditing) {
    // Account type selection (multi-select toggle)
    wizard.querySelectorAll('.type-option').forEach(option => {
        option.addEventListener('click', () => {
            const typeValue = option.dataset.type;
            const category = option.dataset.category;

            // Toggle selection
            const existingIndex = state.selectedTypes.findIndex(t => t.type === typeValue);
            if (existingIndex >= 0) {
                state.selectedTypes.splice(existingIndex, 1);
            } else {
                state.selectedTypes.push({ type: typeValue, category });
            }

            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });

        option.addEventListener('mouseenter', () => {
            const isSelected = state.selectedTypes.some(t => t.type === option.dataset.type);
            if (!isSelected) {
                option.style.borderColor = 'var(--accent-color)';
                option.style.background = 'var(--bg-tertiary)';
            }
        });

        option.addEventListener('mouseleave', () => {
            const isSelected = state.selectedTypes.some(t => t.type === option.dataset.type);
            if (!isSelected) {
                option.style.borderColor = 'var(--border-color)';
                option.style.background = 'var(--bg-primary)';
            }
        });
    });

    // Cancel button
    const cancelBtn = wizard.querySelector('#cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Cancel and close wizard? Any unsaved changes will be lost.')) {
                modal.remove();
            }
        });
    }

    // Back button
    const backBtn = wizard.querySelector('#back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (state.currentStep === 2 && state.currentTypeIndex > 0) {
                // Go back to previous asset in multi-add
                state.currentTypeIndex--;
                const prevCompleted = state.completedAssets.pop();
                if (prevCompleted) {
                    state.assetData = prevCompleted.asset;
                    state.category = prevCompleted.category;
                }
            } else if (state.currentStep === 3) {
                // From review, go back to last asset form
                state.currentStep = 2;
            } else {
                // Go back to type selection
                state.currentStep = 1;
                state.currentTypeIndex = 0;
                state.assetData = {};
                state.category = null;
            }
            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });
    }

    // Next button
    const nextBtn = wizard.querySelector('#next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (state.currentStep === 1) {
                // Multi-select mode
                if (state.selectedTypes.length === 0) {
                    alert('Please select at least one asset type');
                    return;
                }
                // Set up first selected type
                state.currentTypeIndex = 0;
                const firstType = state.selectedTypes[0];
                state.assetData = { type: firstType.type };
                state.category = firstType.category;
                state.currentStep++;
            } else if (state.currentStep === 2) {
                // Validate and extract form data
                const form = wizard.querySelector('#asset-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                const currentAsset = extractFormData(form, state.category);
                currentAsset.id = currentAsset.id || generateId();
                currentAsset.created_at = currentAsset.created_at || new Date().toISOString();
                currentAsset.updated_at = new Date().toISOString();

                // Check if there are more types to add
                if (state.currentTypeIndex < state.selectedTypes.length - 1) {
                    // Save current asset and move to next type
                    state.completedAssets.push({ asset: currentAsset, category: state.category });
                    state.currentTypeIndex++;
                    const nextType = state.selectedTypes[state.currentTypeIndex];
                    state.assetData = { type: nextType.type };
                    state.category = nextType.category;
                    // Stay on step 2 for next asset
                } else {
                    // Last asset - move to review
                    state.assetData = currentAsset;
                    state.currentStep++;
                }
            }
            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });
    }

    // Save button
    const saveBtn = wizard.querySelector('#save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (isEditing && state.assetIndex !== null) {
                // Editing single asset
                assets[state.category][state.assetIndex] = state.assetData;
            } else {
                // Add all completed assets
                for (const { asset, category } of state.completedAssets) {
                    assets[category].push(asset);
                }
                // Add the last/current asset
                if (state.assetData.name) {
                    assets[state.category].push(state.assetData);
                }
            }

            // Call save callback
            if (onSave) {
                onSave(assets);
            }

            modal.remove();
        });
    }
}

/**
 * Generate unique ID
 */
function generateId() {
    return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
