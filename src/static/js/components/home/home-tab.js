/**
 * Home & Mortgage tab component for managing primary residence details.
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { loadTemplate } from '../../utils/template-loader.js';
import { setupContextualHelp } from '../../utils/contextual-help.js';
import { validatePositiveNumber, setFieldError, clearFieldError } from '../../utils/validation.js';

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

    const homeAsset = profile.data?.home_asset || {};

    // Load template
    const template = await loadTemplate('/js/components/home/home-tab.html');
    container.innerHTML = template;

    // Dynamically load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/home-tab.css';
    document.head.appendChild(link);

    // Populate form fields
    populateHomeForm(container, homeAsset);

    // Initialize contextual help
    setupContextualHelp(container);

    // Setup event handlers
    setupHomeFormHandlers(container, profile);
}

function populateHomeForm(container, homeAsset) {
    // General Home Details
    container.querySelector('#home_name').value = homeAsset.name || 'Primary Residence';
    container.querySelector('#current_value').value = homeAsset.current_value || '';
    container.querySelector('#appreciation_annual_pct').value = (homeAsset.appreciation_annual_pct * 100 || 3);
    container.querySelector('#property_tax_rate').value = (homeAsset.property_tax_rate * 100 || 1.5);
    container.querySelector('#home_insurance_annual').value = homeAsset.home_insurance_annual || '';
    container.querySelector('#maintenance_annual_pct').value = (homeAsset.maintenance_annual_pct * 100 || 1);

    // Mortgage Details
    const hasMortgage = homeAsset.has_mortgage ?? true; // Default to true
    container.querySelector('#has_mortgage_yes').checked = hasMortgage;
    container.querySelector('#has_mortgage_no').checked = !hasMortgage;
    
    // Toggle mortgage details visibility
    toggleMortgageDetails(container, hasMortgage);

    container.querySelector('#purchase_price').value = homeAsset.purchase_price || '';
    container.querySelector('#down_payment').value = homeAsset.down_payment || '';
    container.querySelector('#loan_amount').value = homeAsset.loan_amount || '';
    container.querySelector('#interest_rate').value = (homeAsset.interest_rate * 100 || '');
    container.querySelector('#loan_term_years').value = homeAsset.loan_term_years || '';
    container.querySelector('#remaining_loan_balance').value = homeAsset.remaining_loan_balance || '';

    // Renting Details (for comparison)
    container.querySelector('#initial_rent_pm').value = homeAsset.initial_rent_pm || '';
    container.querySelector('#rent_increase_annual_pct').value = (homeAsset.rent_increase_annual_pct * 100 || 3);
}

function setupHomeFormHandlers(container, profile) {
    const form = container.querySelector('#home-form');
    const cancelBtn = container.querySelector('#cancel-btn');
    const hasMortgageRadios = container.querySelectorAll('input[name="has_mortgage"]');
    const mortgageDetailsSection = container.querySelector('#mortgage-details-section');

    if (!form || !cancelBtn) {
        console.error('Home form elements not found');
        return;
    }

    // Toggle mortgage details based on radio button
    hasMortgageRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleMortgageDetails(container, e.target.value === 'yes');
        });
    });

    // Auto-calculate loan_amount if purchase_price and down_payment are available
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

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard unsaved changes?')) {
            window.app.showTab('dashboard'); // Or back to assets tab
        }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Basic validation
        const fieldsToValidate = [
            'current_value', 'appreciation_annual_pct', 'property_tax_rate', 
            'home_insurance_annual', 'maintenance_annual_pct', 'initial_rent_pm', 
            'rent_increase_annual_pct', 'purchase_price', 'down_payment', 
            'loan_amount', 'interest_rate', 'loan_term_years', 'remaining_loan_balance'
        ];
        let isValid = true;
        fieldsToValidate.forEach(fieldId => {
            const input = container.querySelector(`#${fieldId}`);
            if (input && input.offsetParent !== null) { // Check if element is visible
                // For percentage fields, allow values between 0 and 100 (will be divided by 100 for model)
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
            const formData = new FormData(form);
            const newHomeAsset = {};

            // General Home Details
            newHomeAsset.id = profile.data?.home_asset?.id || crypto.randomUUID();
            newHomeAsset.name = formData.get('home_name') || 'Primary Residence';
            newHomeAsset.current_value = parseFloat(formData.get('current_value')) || 0;
            newHomeAsset.appreciation_annual_pct = (parseFloat(formData.get('appreciation_annual_pct')) / 100) || 0;
            newHomeAsset.property_tax_rate = (parseFloat(formData.get('property_tax_rate')) / 100) || 0;
            newHomeAsset.home_insurance_annual = parseFloat(formData.get('home_insurance_annual')) || 0;
            newHomeAsset.maintenance_annual_pct = (parseFloat(formData.get('maintenance_annual_pct')) / 100) || 0;
            newHomeAsset.is_primary_residence = true; // Always true for this component

            // Mortgage Details
            newHomeAsset.has_mortgage = formData.get('has_mortgage') === 'yes';
            if (newHomeAsset.has_mortgage) {
                newHomeAsset.purchase_price = parseFloat(formData.get('purchase_price')) || 0;
                newHomeAsset.down_payment = parseFloat(formData.get('down_payment')) || 0;
                newHomeAsset.loan_amount = parseFloat(formData.get('loan_amount')) || 0;
                newHomeAsset.interest_rate = (parseFloat(formData.get('interest_rate')) / 100) || 0;
                newHomeAsset.loan_term_years = parseInt(formData.get('loan_term_years')) || 0;
                newHomeAsset.remaining_loan_balance = parseFloat(formData.get('remaining_loan_balance')) || 0;
            } else {
                // Clear mortgage related fields if no mortgage
                newHomeAsset.purchase_price = 0;
                newHomeAsset.down_payment = 0;
                newHomeAsset.loan_amount = 0;
                newHomeAsset.interest_rate = 0;
                newHomeAsset.loan_term_years = 0;
                newHomeAsset.remaining_loan_balance = 0;
            }

            // Renting Details (for comparison)
            newHomeAsset.initial_rent_pm = parseFloat(formData.get('initial_rent_pm')) || 0;
            newHomeAsset.rent_increase_annual_pct = (parseFloat(formData.get('rent_increase_annual_pct')) / 100) || 0;

            // Build updated profile data
            const updatedProfileData = {
                ...profile.data,
                home_asset: newHomeAsset
            };

            // Save to API
            const result = await profilesAPI.update(profile.name, {
                data: updatedProfileData
            });

            // Update store
            store.setState({ currentProfile: result.profile });

            showSuccess('Home details saved successfully!');
            hideSpinner();
            window.app.showTab('dashboard'); // Navigate back
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
        // Disable/enable inputs for validation and data collection
        mortgageDetailsSection.querySelectorAll('input, select').forEach(input => {
            input.disabled = !hasMortgage;
        });
    }
}
