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
        { name: 'cost_basis', label: 'Cost Basis', type: 'currency', placeholder: '$0', help: 'For taxable accounts' }
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
        { name: 'value', label: 'Current Balance', type: 'currency', required: true, placeholder: '$0' },
        { name: 'cost_basis', label: 'Cost Basis', type: 'currency', placeholder: '$0', help: 'For calculating capital gains' }
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
        { name: 'value', label: 'Current Market Value', type: 'currency', required: true, placeholder: '$0' },
        { name: 'purchase_price', label: 'Purchase Price', type: 'currency', placeholder: '$0' },
        { name: 'mortgage_balance', label: 'Mortgage Balance', type: 'currency', placeholder: '$0' },
        { name: 'annual_costs', label: 'Annual Costs', type: 'currency', placeholder: '$0', help: 'Property taxes, HOA, insurance, etc.' },
        { name: 'address', label: 'Address', type: 'text', placeholder: 'Optional' }
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
        { name: 'inflation_adjusted', label: 'Inflation Adjusted', type: 'checkbox', help: 'Check if benefits increase with inflation' }
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
 */
export function generateFormFields(category, asset = {}, skipType = false) {
    const fields = FIELD_DEFINITIONS[category];
    if (!fields) {
        throw new Error(`Unknown asset category: ${category}`);
    }

    return fields.filter(field => !(skipType && field.name === 'type')).map(field => {
        const value = asset[field.name] || '';
        const id = `asset-${field.name}`;

        let inputHTML = '';

        if (field.type === 'select') {
            inputHTML = `
                <select id="${id}" name="${field.name}" ${field.required ? 'required' : ''}>
                    ${field.options.map(opt => `
                        <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                            ${opt.label}
                        </option>
                    `).join('')}
                </select>
            `;
        } else if (field.type === 'checkbox') {
            inputHTML = `
                <label style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" id="${id}" name="${field.name}" ${value ? 'checked' : ''}>
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
                    ${field.required ? 'required' : ''}
                >${value}</textarea>
            `;
        } else {
            // text, currency, date
            const inputType = field.type === 'currency' ? 'text' : field.type;
            inputHTML = `
                <input
                    type="${inputType}"
                    id="${id}"
                    name="${field.name}"
                    value="${field.type === 'currency' && value ? formatCurrency(value, 0) : value}"
                    placeholder="${field.placeholder || ''}"
                    ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}
                    ${field.required ? 'required' : ''}
                >
            `;
        }

        // Skip label for checkbox (it has its own label)
        if (field.type === 'checkbox') {
            return `
                <div class="form-group">
                    ${inputHTML}
                    ${field.help ? `<small>${field.help}</small>` : ''}
                </div>
            `;
        }

        return `
            <div class="form-group">
                <label for="${id}">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                ${inputHTML}
                ${field.help ? `<small>${field.help}</small>` : ''}
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

    for (const field of fields) {
        let value = formData.get(field.name);

        if (field.type === 'currency') {
            data[field.name] = value ? parseCurrency(value) : 0;
        } else if (field.type === 'checkbox') {
            data[field.name] = form.querySelector(`[name="${field.name}"]`).checked;
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
