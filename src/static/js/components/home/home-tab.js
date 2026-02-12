/**
 * Home & Mortgage tab component for managing one or more homes.
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { loadTemplate } from '../../utils/template-loader.js';
import { setupContextualHelp } from '../../utils/contextual-help.js';
import { validatePositiveNumber, clearFieldError } from '../../utils/validation.js';

const DEFAULT_INITIAL_RENT_PM = 4000;
const DEFAULT_RENT_INCREASE_ANNUAL_PCT = 0.03;

function buildDefaultHomeAsset(index = 1) {
    return {
        id: crypto.randomUUID(),
        name: index === 1 ? 'Primary Residence' : `Home ${index}`,
        current_value: 0,
        appreciation_annual_pct: 0.03,
        property_tax_rate: 0.015,
        home_insurance_annual: 0,
        maintenance_annual_pct: 0.01,
        has_mortgage: true,
        purchase_price: 0,
        down_payment: 0,
        loan_amount: 0,
        interest_rate: 0,
        loan_term_years: 30,
        remaining_loan_balance: 0,
        initial_rent_pm: DEFAULT_INITIAL_RENT_PM,
        rent_increase_annual_pct: DEFAULT_RENT_INCREASE_ANNUAL_PCT,
        is_primary_residence: index === 1,
    };
}

function normalizeHomeAsset(asset, index) {
    const fallback = buildDefaultHomeAsset(index + 1);
    return {
        ...fallback,
        ...(asset || {}),
        id: asset?.id || fallback.id,
        name: asset?.name || fallback.name,
        is_primary_residence: Boolean(asset?.is_primary_residence),
    };
}

function extractHomeAssets(profileData) {
    const assets = Array.isArray(profileData?.home_assets) ? profileData.home_assets : [];

    if (assets.length > 0) {
        const normalized = assets.map((asset, idx) => normalizeHomeAsset(asset, idx));
        if (!normalized.some((h) => h.is_primary_residence)) {
            normalized[0].is_primary_residence = true;
        }
        return normalized;
    }

    if (profileData?.home_asset) {
        const migrated = normalizeHomeAsset(profileData.home_asset, 0);
        migrated.is_primary_residence = true;
        return [migrated];
    }

    return [buildDefaultHomeAsset(1)];
}

function getSelectedHomeIndex(container) {
    const selector = container.querySelector('#home_selector');
    const selected = Number(selector?.value ?? 0);
    return Number.isInteger(selected) && selected >= 0 ? selected : 0;
}

function readHomeForm(container, existingHome = {}) {
    const formData = new FormData(container.querySelector('#home-form'));
    const hasMortgage = formData.get('has_mortgage') === 'yes';

    const home = {
        ...existingHome,
        id: existingHome.id || crypto.randomUUID(),
        name: formData.get('home_name') || 'Primary Residence',
        is_primary_residence: formData.get('is_primary_residence') === 'on',
        current_value: parseFloat(formData.get('current_value')) || 0,
        appreciation_annual_pct: (parseFloat(formData.get('appreciation_annual_pct')) / 100) || 0,
        property_tax_rate: (parseFloat(formData.get('property_tax_rate')) / 100) || 0,
        home_insurance_annual: parseFloat(formData.get('home_insurance_annual')) || 0,
        maintenance_annual_pct: (parseFloat(formData.get('maintenance_annual_pct')) / 100) || 0,
        has_mortgage: hasMortgage,
        initial_rent_pm: parseFloat(formData.get('initial_rent_pm')) || 0,
        rent_increase_annual_pct: (parseFloat(formData.get('rent_increase_annual_pct')) / 100) || 0,
    };

    if (hasMortgage) {
        home.purchase_price = parseFloat(formData.get('purchase_price')) || 0;
        home.down_payment = parseFloat(formData.get('down_payment')) || 0;
        home.loan_amount = parseFloat(formData.get('loan_amount')) || 0;
        home.interest_rate = (parseFloat(formData.get('interest_rate')) / 100) || 0;
        home.loan_term_years = parseInt(formData.get('loan_term_years')) || 0;
        home.remaining_loan_balance = parseFloat(formData.get('remaining_loan_balance')) || 0;
    } else {
        home.purchase_price = 0;
        home.down_payment = 0;
        home.loan_amount = 0;
        home.interest_rate = 0;
        home.loan_term_years = 0;
        home.remaining_loan_balance = 0;
    }

    return home;
}

function populateHomeSelector(container, homeAssets, selectedIndex) {
    const selector = container.querySelector('#home_selector');
    if (!selector) return;

    selector.innerHTML = '';
    homeAssets.forEach((home, idx) => {
        const option = document.createElement('option');
        option.value = String(idx);
        option.textContent = `${home.name || `Home ${idx + 1}`}${home.is_primary_residence ? ' (Primary)' : ''}`;
        selector.appendChild(option);
    });

    selector.value = String(Math.min(Math.max(selectedIndex, 0), homeAssets.length - 1));
}

export async function renderHomeTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">🏠</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to manage your home asset.
                </p>
                <button id="go-to-welcome-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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

    const template = await loadTemplate('/js/components/home/home-tab.html');
    container.innerHTML = template;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/home-tab.css';
    document.head.appendChild(link);

    setupContextualHelp(container);
    setupHomeFormHandlers(container, profile);
}

function _setVal(container, selector, value) {
    const el = container.querySelector(selector);
    if (el) el.value = value;
}
function _setChecked(container, selector, value) {
    const el = container.querySelector(selector);
    if (el) el.checked = value;
}

function populateHomeForm(container, homeAsset) {
    _setVal(container, '#home_name', homeAsset.name || 'Primary Residence');
    _setChecked(container, '#is_primary_residence', Boolean(homeAsset.is_primary_residence));
    _setVal(container, '#current_value', homeAsset.current_value || '');
    _setVal(container, '#appreciation_annual_pct', homeAsset.appreciation_annual_pct * 100 || 3);
    _setVal(container, '#property_tax_rate', homeAsset.property_tax_rate * 100 || 1.5);
    _setVal(container, '#home_insurance_annual', homeAsset.home_insurance_annual || '');
    _setVal(container, '#maintenance_annual_pct', homeAsset.maintenance_annual_pct * 100 || 1);

    const hasMortgage = homeAsset.has_mortgage ?? true;
    _setChecked(container, '#has_mortgage_yes', hasMortgage);
    _setChecked(container, '#has_mortgage_no', !hasMortgage);
    toggleMortgageDetails(container, hasMortgage);

    _setVal(container, '#purchase_price', homeAsset.purchase_price || '');
    _setVal(container, '#down_payment', homeAsset.down_payment || '');
    _setVal(container, '#loan_amount', homeAsset.loan_amount || '');
    _setVal(container, '#interest_rate', homeAsset.interest_rate * 100 || '');
    _setVal(container, '#loan_term_years', homeAsset.loan_term_years || '');
    _setVal(container, '#remaining_loan_balance', homeAsset.remaining_loan_balance || '');

    const initialRent = Number(homeAsset.initial_rent_pm);
    const rentIncreasePct = Number(homeAsset.rent_increase_annual_pct);
    _setVal(container, '#initial_rent_pm', Number.isFinite(initialRent) && initialRent > 0 ? initialRent : DEFAULT_INITIAL_RENT_PM);
    _setVal(container, '#rent_increase_annual_pct',
        Number.isFinite(rentIncreasePct) && rentIncreasePct > 0
            ? (rentIncreasePct * 100)
            : (DEFAULT_RENT_INCREASE_ANNUAL_PCT * 100));
}

function setupHomeFormHandlers(container, profile) {
    const form = container.querySelector('#home-form');
    const cancelBtn = container.querySelector('#cancel-btn');
    const hasMortgageRadios = container.querySelectorAll('input[name="has_mortgage"]');
    const addHomeBtn = container.querySelector('#add-home-btn');
    const deleteHomeBtn = container.querySelector('#delete-home-btn');
    const selector = container.querySelector('#home_selector');

    if (!form || !cancelBtn || !selector || !addHomeBtn || !deleteHomeBtn) {
        console.error('Home form elements not found');
        return;
    }

    let homeAssets = extractHomeAssets(profile.data);
    let selectedIndex = 0;

    const refreshView = () => {
        populateHomeSelector(container, homeAssets, selectedIndex);
        populateHomeForm(container, homeAssets[selectedIndex]);
        deleteHomeBtn.disabled = homeAssets.length <= 1;
    };

    const syncCurrentFormToModel = () => {
        const current = homeAssets[selectedIndex] || buildDefaultHomeAsset(selectedIndex + 1);
        homeAssets[selectedIndex] = readHomeForm(container, current);
    };

    refreshView();

    hasMortgageRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            toggleMortgageDetails(container, e.target.value === 'yes');
        });
    });

    const purchasePriceInput = container.querySelector('#purchase_price');
    const downPaymentInput = container.querySelector('#down_payment');
    const loanAmountInput = container.querySelector('#loan_amount');

    const updateLoanAmount = () => {
        const purchasePrice = parseFloat(purchasePriceInput.value) || 0;
        const downPayment = parseFloat(downPaymentInput.value) || 0;
        if (purchasePrice > 0 && downPayment >= 0) {
            loanAmountInput.value = (purchasePrice - downPayment).toFixed(0);
        }
    };
    if (purchasePriceInput) purchasePriceInput.addEventListener('blur', updateLoanAmount);
    if (downPaymentInput) downPaymentInput.addEventListener('blur', updateLoanAmount);

    selector.addEventListener('change', () => {
        syncCurrentFormToModel();
        selectedIndex = getSelectedHomeIndex(container);
        refreshView();
    });

    addHomeBtn.addEventListener('click', () => {
        syncCurrentFormToModel();
        const newHome = buildDefaultHomeAsset(homeAssets.length + 1);
        homeAssets.push(newHome);
        selectedIndex = homeAssets.length - 1;
        refreshView();
    });

    deleteHomeBtn.addEventListener('click', () => {
        if (homeAssets.length <= 1) {
            showError('At least one home is required.');
            return;
        }

        const toDelete = homeAssets[selectedIndex];
        if (!confirm(`Delete "${toDelete?.name || 'this home'}"?`)) {
            return;
        }

        homeAssets.splice(selectedIndex, 1);
        selectedIndex = Math.max(0, selectedIndex - 1);
        if (!homeAssets.some((h) => h.is_primary_residence)) {
            homeAssets[0].is_primary_residence = true;
        }
        refreshView();
    });

    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard unsaved changes?')) {
            window.app.showTab('dashboard');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fieldsToValidate = [
            'current_value', 'appreciation_annual_pct', 'property_tax_rate',
            'home_insurance_annual', 'maintenance_annual_pct', 'initial_rent_pm',
            'rent_increase_annual_pct', 'purchase_price', 'down_payment',
            'loan_amount', 'interest_rate', 'loan_term_years', 'remaining_loan_balance',
        ];

        let isValid = true;
        fieldsToValidate.forEach((fieldId) => {
            const input = container.querySelector(`#${fieldId}`);
            if (input && input.offsetParent !== null) {
                const isPercentage = ['appreciation_annual_pct', 'property_tax_rate', 'maintenance_annual_pct', 'rent_increase_annual_pct', 'interest_rate'].includes(fieldId);
                const maxVal = isPercentage ? 100 : Infinity;

                if (!validatePositiveNumber(input, maxVal)) {
                    isValid = false;
                } else {
                    clearFieldError(input);
                }
            }
        });

        if (!isValid) {
            showError('Please correct the highlighted errors.');
            return;
        }

        const saveBtn = container.querySelector('#save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        showSpinner('Saving home details...');
        try {
            syncCurrentFormToModel();

            // Enforce a single primary residence only when selected home is marked primary.
            const selectedHome = homeAssets[selectedIndex];
            if (selectedHome?.is_primary_residence) {
                const selectedHomeId = selectedHome.id;
                homeAssets = homeAssets.map((home) => ({
                    ...home,
                    is_primary_residence: home.id === selectedHomeId,
                }));
            }

            // Guarantee there is always at least one primary residence.
            if (!homeAssets.some((home) => home.is_primary_residence) && homeAssets.length > 0) {
                homeAssets[0].is_primary_residence = true;
            }

            const primaryHome = homeAssets.find((home) => home.is_primary_residence) || homeAssets[0];

            const updatedProfileData = {
                ...profile.data,
                home_assets: homeAssets,
                home_asset: { ...primaryHome },
            };

            const result = await profilesAPI.update(profile.name, {
                data: updatedProfileData,
            });

            store.setState({ currentProfile: result.profile });
            showSuccess(`Saved ${homeAssets.length} home${homeAssets.length === 1 ? '' : 's'} successfully!`);
            hideSpinner();
            window.app.showTab('dashboard');
        } catch (error) {
            console.error('Error saving home details:', error);
            hideSpinner();
            showError(error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
}

function toggleMortgageDetails(container, hasMortgage) {
    const mortgageDetailsSection = container.querySelector('#mortgage-details-section');
    if (mortgageDetailsSection) {
        mortgageDetailsSection.style.display = hasMortgage ? 'block' : 'none';
        mortgageDetailsSection.querySelectorAll('input, select').forEach((input) => {
            input.disabled = !hasMortgage;
        });
    }
}
