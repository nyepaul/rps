/**
 * Dynamic form field definitions for different asset types
 */

import { formatCurrency, parseCurrency } from '../../utils/formatters.js';

// Field definitions by asset category
export const FIELD_DEFINITIONS = {
    retirement_accounts: [
        { name: 'name', label: 'Account Name', type: 'text', required: true, placeholder: "e.g., Jane's Traditional IRA" },
        { name: 'type', label: 'Account Type', type: 'select', required: true, options: [
            { value: '', label: '-- Select Type --' },
            { value: 'traditional_ira', label: 'Traditional IRA' },
            { value: 'roth_ira', label: 'Roth IRA' },
            { value: 'sep_ira', label: 'SEP IRA' },
            { value: '401k', label: '401(k)' },
            { value: 'roth_401k', label: 'Roth 401(k)' },
            { value: '403b', label: '403(b)' },
            { value: '457', label: '457' },
            { value: 'simple_ira', label: 'SIMPLE IRA' }
        ]},
        { name: 'institution', label: 'Financial Institution', type: 'text', placeholder: 'e.g., Vanguard' },
        { name: 'account_number', label: 'Account Number (Last 4 digits)', type: 'text', maxlength: 4, placeholder: '****' },
        { name: 'value', label: 'Current Balance', type: 'currency', required: true, placeholder: '$0' },
        { name: 'stock_pct', label: 'Stock Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '60' },
        { name: 'bond_pct', label: 'Bond Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '40' },
        { name: 'cash_pct', label: 'Cash Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '0' }
    ],

    taxable_accounts: [
        { name: 'name', label: 'Account Name', type: 'text', required: true, placeholder: 'e.g., Joint Brokerage' },
        { name: 'type', label: 'Account Type', type: 'select', required: true, options: [
            { value: '', label: '-- Select Type --' },
            { value: 'brokerage', label: 'Brokerage Account' },
            { value: 'savings', label: 'Savings Account' },
            { value: 'checking', label: 'Checking Account' },
            { value: 'cash', label: 'Cash' },
            { value: 'cd', label: 'Certificate of Deposit' },
            { value: 'money_market', label: 'Money Market' }
        ]},
        { name: 'institution', label: 'Financial Institution', type: 'text', placeholder: 'e.g., Fidelity' },
        { name: 'account_number', label: 'Account Number (Last 4 digits)', type: 'text', maxlength: 4, placeholder: '****' },
        { name: 'principal', label: 'Principal Amount', type: 'currency', required: true, placeholder: '$0', showFor: ['cd'], help: 'Amount originally deposited' },
        { name: 'interest_rate', label: 'Interest Rate (APY %)', type: 'number', min: 0, max: 20, step: 0.01, placeholder: '4.50', showFor: ['cd'] },
        { name: 'maturity_date', label: 'Maturity Date', type: 'date', placeholder: 'YYYY-MM-DD', showFor: ['cd'] },
        { name: 'term_months', label: 'Term (Months)', type: 'number', min: 1, max: 120, placeholder: '12', showFor: ['cd'], help: 'CD term length' },
        { name: 'value', label: 'Current Balance', type: 'currency', required: true, placeholder: '$0', requiredFor: ['brokerage', 'savings', 'checking', 'cash', 'money_market'], help: 'Current value including accrued interest', helpFor: { 'cd': 'Current value including accrued interest (optional)' } },
        { name: 'cost_basis', label: 'Cost Basis', type: 'currency', placeholder: '$0', showFor: ['brokerage'], help: 'For calculating capital gains' },
        { name: 'stock_pct', label: 'Stock Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '60', showFor: ['brokerage'] },
        { name: 'bond_pct', label: 'Bond Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '40', showFor: ['brokerage'] },
        { name: 'cash_pct', label: 'Cash Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '0', showFor: ['brokerage'] }
    ],

    real_estate: [
        { name: 'name', label: 'Property Name', type: 'text', required: true, placeholder: 'e.g., Primary Residence' },
        { name: 'type', label: 'Property Type', type: 'select', required: true, options: [
            { value: '', label: '-- Select Type --' },
            { value: 'primary_residence', label: 'Primary Residence' },
            { value: 'rental_property', label: 'Rental Property' },
            { value: 'vacation_home', label: 'Vacation Home' },
            { value: 'land', label: 'Land' },
            { value: 'commercial', label: 'Commercial Property' }
        ]},
        { name: 'address', label: 'Address', type: 'text', placeholder: 'Optional' },
        { name: 'value', label: 'Current Market Value', type: 'currency', required: true, placeholder: '$0' },
        { name: 'purchase_price', label: 'Purchase Price', type: 'currency', placeholder: '$0', help: 'Original purchase price (for cost basis)' },
        { name: 'purchase_date', label: 'Purchase Date', type: 'date', placeholder: 'YYYY-MM-DD', hideFor: ['land'] },
        { name: 'mortgage_balance', label: 'Mortgage Balance', type: 'currency', placeholder: '$0', hideFor: ['land'] },
        { name: 'annual_rental_income', label: 'Annual Rental Income', type: 'currency', placeholder: '$0', showFor: ['rental_property', 'vacation_home', 'commercial'], help: 'Gross rental income per year' },
        { name: 'annual_expenses', label: 'Annual Operating Expenses', type: 'currency', placeholder: '$0', showFor: ['rental_property', 'vacation_home', 'commercial'], help: 'Maintenance, repairs, management fees, utilities' },
        { name: 'occupancy_rate', label: 'Occupancy Rate (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '95', showFor: ['rental_property', 'commercial'], help: 'Average occupancy percentage' },
        { name: 'annual_costs', label: 'Annual Property Costs', type: 'currency', placeholder: '$0', help: 'Property taxes, HOA fees, insurance' }
    ],

    pensions_annuities: [
        { name: 'name', label: 'Pension/Annuity Name', type: 'text', required: true, placeholder: 'e.g., State Pension' },
        { name: 'type', label: 'Type', type: 'select', required: true, options: [
            { value: '', label: '-- Select Type --' },
            { value: 'pension', label: 'Pension' },
            { value: 'annuity', label: 'Annuity' }
        ]},
        { name: 'provider', label: 'Provider/Employer', type: 'text', placeholder: 'e.g., CalPERS' },
        { name: 'monthly_benefit', label: 'Monthly Benefit', type: 'currency', required: true, placeholder: '$0' },
        { name: 'start_date', label: 'Start Date', type: 'date', placeholder: 'YYYY-MM-DD' },
        { name: 'start_age', label: 'Start Age', type: 'number', min: 50, max: 100, placeholder: '65', help: 'Age when benefits begin' },
        { name: 'inflation_adjusted', label: 'Inflation Adjusted', type: 'checkbox', help: 'Check if benefits increase with inflation' },
        { name: 'survivor_benefit_pct', label: 'Survivor Benefit (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '50', showFor: ['pension'], help: 'Percentage paid to survivor' },
        { name: 'annuity_type', label: 'Annuity Type', type: 'select', showFor: ['annuity'], options: [
            { value: '', label: '-- Select --' },
            { value: 'fixed', label: 'Fixed' },
            { value: 'variable', label: 'Variable' },
            { value: 'indexed', label: 'Indexed' }
        ]},
        { name: 'current_value', label: 'Current Value', type: 'currency', placeholder: '$0', showFor: ['annuity'], help: 'Current account value if deferred' }
    ],

    other_assets: [
        { name: 'name', label: 'Asset Name', type: 'text', required: true, placeholder: 'e.g., Coin Collection' },
        { name: 'type', label: 'Asset Type', type: 'select', required: true, options: [
            { value: '', label: '-- Select Type --' },
            { value: 'business_interest', label: 'Business Interest' },
            { value: 'collectible', label: 'Collectible' },
            { value: 'trust', label: 'Trust' },
            { value: 'hsa', label: 'Health Savings Account (HSA)' },
            { value: 'cryptocurrency', label: 'Cryptocurrency' },
            { value: 'other', label: 'Other' }
        ]},
        { name: 'value', label: 'Estimated Value', type: 'currency', required: true, placeholder: '$0' },
        { name: 'institution', label: 'Financial Institution', type: 'text', placeholder: 'e.g., Fidelity', showFor: ['hsa'] },
        { name: 'stock_pct', label: 'Stock Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '60', showFor: ['hsa'] },
        { name: 'bond_pct', label: 'Bond Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '40', showFor: ['hsa'] },
        { name: 'cash_pct', label: 'Cash Allocation (%)', type: 'number', min: 0, max: 100, step: 1, placeholder: '0', showFor: ['hsa'] },
        { name: 'ownership_pct', label: 'Ownership Percentage (%)', type: 'number', min: 0, max: 100, step: 0.1, placeholder: '25', showFor: ['business_interest'], help: 'Your ownership stake' },
        { name: 'annual_income', label: 'Annual Income/Distributions', type: 'currency', placeholder: '$0', showFor: ['business_interest', 'trust'], help: 'Annual distributions or income received' },
        { name: 'valuation_method', label: 'Valuation Method', type: 'select', showFor: ['business_interest'], options: [
            { value: '', label: '-- Select --' },
            { value: 'professional_appraisal', label: 'Professional Appraisal' },
            { value: 'comparable_sales', label: 'Comparable Sales' },
            { value: 'book_value', label: 'Book Value' },
            { value: 'revenue_multiple', label: 'Revenue Multiple' },
            { value: 'earnings_multiple', label: 'Earnings Multiple' }
        ]},
        { name: 'cost_basis', label: 'Cost Basis', type: 'currency', placeholder: '$0', showFor: ['cryptocurrency', 'collectible'], help: 'Original purchase price' },
        { name: 'purchase_date', label: 'Purchase Date', type: 'date', placeholder: 'YYYY-MM-DD', showFor: ['cryptocurrency', 'collectible'] },
        { name: 'trust_type', label: 'Trust Type', type: 'select', showFor: ['trust'], options: [
            { value: '', label: '-- Select --' },
            { value: 'revocable', label: 'Revocable Living Trust' },
            { value: 'irrevocable', label: 'Irrevocable Trust' },
            { value: 'charitable', label: 'Charitable Trust' },
            { value: 'special_needs', label: 'Special Needs Trust' },
            { value: 'other', label: 'Other' }
        ]},
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional details about this asset' }
    ]
};

// Asset type labels for display
export const ASSET_TYPE_LABELS = {
    traditional_ira: 'Traditional IRA',
    roth_ira: 'Roth IRA',
    sep_ira: 'SEP IRA',
    '401k': '401(k)',
    'roth_401k': 'Roth 401(k)',
    '403b': '403(b)',
    '457': '457',
    simple_ira: 'SIMPLE IRA',
    brokerage: 'Brokerage Account',
    savings: 'Savings Account',
    checking: 'Checking Account',
    cash: 'Cash',
    cd: 'Certificate of Deposit',
    money_market: 'Money Market',
    primary_residence: 'Primary Residence',
    rental_property: 'Rental Property',
    vacation_home: 'Vacation Home',
    land: 'Land',
    commercial: 'Commercial Property',
    pension: 'Pension',
    annuity: 'Annuity',
    business_interest: 'Business Interest',
    collectible: 'Collectible',
    trust: 'Trust',
    hsa: 'HSA',
    cryptocurrency: 'Cryptocurrency',
    other: 'Other'
};

/**
 * Generate form HTML for a specific asset category
 * @param {string} category - Asset category
 * @param {object} asset - Existing asset data
 * @param {boolean} skipType - Skip the type field (when already selected in wizard)
 * @param {Array} customTypeOptions - Custom options for type field (for cross-category editing)
 */
export function generateFormFields(category, asset = {}, skipType = false, customTypeOptions = null) {
    const fields = FIELD_DEFINITIONS[category];
    if (!fields) {
        throw new Error(`Unknown asset category: ${category}`);
    }

    const currentType = asset.type || '';
    const isCashLike = ['savings', 'checking', 'cash', 'cd', 'money_market'].includes(currentType);

    return fields.filter(field => {
        // Filter out fields that don't apply to the current type
        if (skipType && field.name === 'type') return false;

        // Check if field should be hidden for current type
        if (field.hideFor && currentType && field.hideFor.includes(currentType)) {
            return false;
        }

        // Check if field has showFor constraint and current type matches
        if (field.showFor && currentType) {
            if (!field.showFor.includes(currentType)) return false;
        }

        if (isCashLike) {
            const nonCashFields = ['cost_basis', 'stock_pct', 'bond_pct', 'cash_pct'];
            if (nonCashFields.includes(field.name)) return false;
        }

        return true;
    }).map(field => {
        let rawValue = asset[field.name];
        let displayValue = (rawValue !== undefined && rawValue !== null) ? rawValue : '';
        
        // Convert decimals to percentages for display
        if (field.type === 'number' && field.name.endsWith('_pct') && displayValue !== '') {
            displayValue = Math.round(Number(displayValue) * 100);
        }

        const id = `asset-${field.name}`;

        // Determine if field is required for current type
        let isRequired = field.required;
        if (field.requiredFor && currentType) {
            isRequired = field.requiredFor.includes(currentType);
        }

        // Get context-specific help text
        let helpText = field.help;
        if (field.helpFor && currentType && field.helpFor[currentType]) {
            helpText = field.helpFor[currentType];
        }

        let inputHTML = '';

        if (field.type === 'select') {
            // Use custom options for type field if provided (cross-category editing)
            const options = (field.name === 'type' && customTypeOptions) ? customTypeOptions : field.options;

            inputHTML = `
                <select id="${id}" name="${field.name}" ${isRequired ? 'required' : ''}>
                    ${options.map(opt => `
                        <option value="${opt.value}" ${displayValue === opt.value ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}>
                            ${opt.label}
                        </option>
                    `).join('')}
                </select>
            `;
        } else if (field.type === 'checkbox') {
            inputHTML = `
                <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="${id}" name="${field.name}" ${displayValue ? 'checked' : ''}>
                    <span>${field.label}</span>
                </label>
            `;
        } else if (field.type === 'textarea') {
            inputHTML = `
                <textarea
                    id="${id}"
                    name="${field.name}"
                    placeholder="${field.placeholder || ''}"
                    rows="3"
                    ${isRequired ? 'required' : ''}
                >${displayValue}</textarea>
            `;
        } else {
            // text, currency, date, number
            const inputType = field.type === 'currency' ? 'text' : field.type;
            const extraAttrs = [];
            if (field.min !== undefined) extraAttrs.push(`min="${field.min}"`);
            if (field.max !== undefined) extraAttrs.push(`max="${field.max}"`);
            if (field.step !== undefined) extraAttrs.push(`step="${field.step}"`);

            inputHTML = `
                <input
                    type="${inputType}"
                    id="${id}"
                    name="${field.name}"
                    value="${field.type === 'currency' && displayValue !== '' ? formatCurrency(displayValue, 0) : displayValue}"
                    placeholder="${field.placeholder || ''}"
                    ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}
                    ${extraAttrs.join(' ')}
                    ${isRequired ? 'required' : ''}
                >
            `;
        }

        // Skip label for checkbox (it has its own label)
        if (field.type === 'checkbox') {
            return `
                <div class="form-group">
                    ${inputHTML}
                    ${helpText ? `<small>${helpText}</small>` : ''}
                </div>
            `;
        }

        return `
            <div class="form-group">
                <label for="${id}">
                    ${field.label}${isRequired ? ' *' : ''}
                </label>
                ${inputHTML}
                ${helpText ? `<small>${helpText}</small>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Extract form data from a form element
 */
export function extractFormData(form, category) {
    const formData = new FormData(form);
    const data = {};
    const fields = FIELD_DEFINITIONS[category];
    const currentType = formData.get('type') || '';
    const isCashLike = ['savings', 'checking', 'cash', 'money_market'].includes(currentType);
    const isCD = currentType === 'cd';

    for (const field of fields) {
        // Skip fields that don't apply to current type
        if (field.showFor && currentType && !field.showFor.includes(currentType)) {
            continue;
        }
        if (field.hideFor && currentType && field.hideFor.includes(currentType)) {
            continue;
        }

        let value = formData.get(field.name);

        // Handle hidden fields for cash-like assets
        if (value === null && isCashLike && !isCD) {
            if (field.name === 'cash_pct') {
                data.cash_pct = 1.0;
                continue;
            }
            if (['stock_pct', 'bond_pct', 'cost_basis'].includes(field.name)) {
                data[field.name] = 0;
                continue;
            }
        }

        if (field.type === 'currency') {
            const parsedValue = value ? parseCurrency(value) : 0;
            data[field.name] = parsedValue;

            // For CDs, if value is not provided but principal is, use principal as value
            if (isCD && field.name === 'value' && parsedValue === 0 && data.principal) {
                data[field.name] = data.principal;
            }
        } else if (field.type === 'number') {
            // Convert percentages to decimals if it's an allocation field
            const numValue = value ? parseFloat(value) : 0;
            if (field.name.endsWith('_pct')) {
                data[field.name] = numValue / 100;
            } else {
                data[field.name] = numValue;
            }
        } else if (field.type === 'checkbox') {
            const checkbox = form.querySelector(`[name="${field.name}"]`);
            data[field.name] = checkbox ? checkbox.checked : false;
        } else if (field.type === 'date') {
            data[field.name] = value || null;
        } else {
            data[field.name] = value || '';
        }
    }

    return data;
}

/**
 * Get the display label for an asset type
 */
export function getAssetTypeLabel(type) {
    return ASSET_TYPE_LABELS[type] || type;
}
