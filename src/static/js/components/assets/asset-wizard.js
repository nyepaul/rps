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
        currentStep: preselectedCategory ? 2 : 1,
        category: preselectedCategory || (existingAsset ? getCategoryForAsset(existingAsset, assets) : null),
        assetData: existingAsset ? { ...existingAsset } : {},
        assetIndex: assetIndex
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
        { num: 1, label: 'Category' },
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
 * Step 1: Category Selection
 */
function renderStep1CategorySelection(state) {
    return `
        <div>
            <h3 style="margin-bottom: 20px; font-size: 20px;">Choose Asset Category</h3>
            <div style="display: grid; gap: 15px;">
                ${Object.entries(CATEGORIES).map(([key, cat]) => `
                    <div class="category-option" data-category="${key}" style="padding: 20px; background: var(--bg-primary); border: 2px solid ${state.category === key ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="font-size: 36px;">${cat.icon}</span>
                            <div>
                                <div style="font-size: 18px; font-weight: 600; margin-bottom: 5px;">${cat.label}</div>
                                <div style="font-size: 14px; color: var(--text-secondary);">${cat.description}</div>
                            </div>
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
        return '<p>Please select a category first.</p>';
    }

    const categoryLabel = CATEGORIES[state.category].label;

    return `
        <div>
            <h3 style="margin-bottom: 20px; font-size: 20px;">
                ${CATEGORIES[state.category].icon} ${categoryLabel} Details
            </h3>
            <form id="asset-form" style="display: grid; gap: 20px;">
                ${generateFormFields(state.category, state.assetData)}
            </form>
        </div>
    `;
}

/**
 * Step 3: Review
 */
function renderStep3Review(state) {
    const categoryLabel = CATEGORIES[state.category].label;
    const typeLabel = getAssetTypeLabel(state.assetData.type);

    let valueDisplay = '';
    if (state.category === 'pensions_annuities') {
        valueDisplay = `${formatCurrency(state.assetData.monthly_benefit || 0, 0)}/month`;
    } else {
        const value = state.assetData.value || state.assetData.current_value || 0;
        valueDisplay = formatCurrency(value, 0);
    }

    // Build details list
    const details = [];
    for (const [key, value] of Object.entries(state.assetData)) {
        if (key === 'name' || key === 'type' || !value) continue;

        let displayValue = value;
        if (typeof value === 'number' && key.includes('value') || key.includes('balance') || key.includes('cost') || key.includes('price')) {
            displayValue = formatCurrency(value, 0);
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        }

        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        details.push(`<div><strong>${label}:</strong> ${displayValue}</div>`);
    }

    return `
        <div>
            <h3 style="margin-bottom: 20px; font-size: 20px;">Review Asset</h3>
            <div style="background: var(--bg-primary); padding: 25px; border-radius: 8px; border: 2px solid var(--accent-color);">
                <div style="display: flex; align-items: start; gap: 15px; margin-bottom: 20px;">
                    <span style="font-size: 48px;">${CATEGORIES[state.category].icon}</span>
                    <div style="flex: 1;">
                        <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;">
                            ${state.assetData.name}
                        </div>
                        <div style="padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 14px; color: var(--text-secondary); display: inline-block;">
                            ${typeLabel}
                        </div>
                    </div>
                </div>

                <div style="font-size: 32px; font-weight: 700; color: var(--accent-color); margin-bottom: 20px;">
                    ${valueDisplay}
                </div>

                <div style="font-size: 14px; color: var(--text-secondary); display: grid; gap: 8px;">
                    ${details.join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render footer buttons
 */
function renderFooterButtons(state, isEditing) {
    const showBack = state.currentStep > 1;
    const showNext = state.currentStep < 3;
    const showSave = state.currentStep === 3;

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
                    Next →
                </button>
            ` : ''}
            ${showSave ? `
                <button id="save-btn" style="padding: 12px 24px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    💾 ${isEditing ? 'Save Changes' : 'Add Asset'}
                </button>
            ` : ''}
        </div>
    `;
}

/**
 * Setup event handlers
 */
function setupWizardHandlers(wizard, state, assets, onSave, modal, isEditing) {
    // Category selection
    wizard.querySelectorAll('.category-option').forEach(option => {
        option.addEventListener('click', () => {
            state.category = option.dataset.category;
            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });

        option.addEventListener('mouseenter', () => {
            if (state.category !== option.dataset.category) {
                option.style.borderColor = 'var(--accent-color)';
                option.style.transform = 'translateX(5px)';
            }
        });

        option.addEventListener('mouseleave', () => {
            if (state.category !== option.dataset.category) {
                option.style.borderColor = 'var(--border-color)';
                option.style.transform = 'translateX(0)';
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
            state.currentStep--;
            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });
    }

    // Next button
    const nextBtn = wizard.querySelector('#next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (state.currentStep === 1) {
                if (!state.category) {
                    alert('Please select a category');
                    return;
                }
                state.currentStep++;
            } else if (state.currentStep === 2) {
                // Validate and extract form data
                const form = wizard.querySelector('#asset-form');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                state.assetData = extractFormData(form, state.category);
                state.assetData.id = state.assetData.id || generateId();
                state.assetData.created_at = state.assetData.created_at || new Date().toISOString();
                state.assetData.updated_at = new Date().toISOString();
                state.currentStep++;
            }
            renderWizardStep(wizard, state, assets, onSave, modal, isEditing);
        });
    }

    // Save button
    const saveBtn = wizard.querySelector('#save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            // Update or add asset
            if (isEditing && state.assetIndex !== null) {
                assets[state.category][state.assetIndex] = state.assetData;
            } else {
                assets[state.category].push(state.assetData);
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
