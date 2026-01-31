/**
 * Profile tab component - Edit profile data
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { setupContextualHelp } from '../../utils/contextual-help.js';

export function renderProfileTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">👤</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to edit.
                </p>
                <button id="go-to-welcome-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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

    const data = profile.data || {};
    const person = data.person || {};
    const spouse = data.spouse || {};
    const children = data.children || [];
    const financial = data.financial || {};
    const address = data.address || {};

    container.innerHTML = `
        <div style="max-width: 1100px; margin: 0 auto; padding: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-3);">
                <div>
                    <h1 style="font-size: var(--font-2xl); margin: 0;">Profile Settings</h1>
                    <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                        Manage personal and dependent information for <strong>${profile.name}</strong>
                    </p>
                </div>
                <div style="display: flex; gap: var(--space-2);">
                    <button type="button" id="cancel-btn" style="padding: 6px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                        Cancel
                    </button>
                    <button type="submit" form="profile-form" id="save-btn" style="padding: 6px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                        Save Changes
                    </button>
                </div>
            </div>

            <form id="profile-form">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: var(--space-3);">
                    <!-- Column 1: Personal Details -->
                    <div class="form-section" style="margin-bottom: 0;">
                        <h2 style="font-size: 15px; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2); color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                            👤 Personal Details
                        </h2>
                        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="name">Profile Name *</label>
                                <input type="text" id="name" name="name" value="${profile.name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="birth_date">Birth Date</label>
                                <input type="date" id="birth_date" name="birth_date" value="${profile.birth_date || ''}">
                            </div>
                            <div class="form-group">
                                <label for="retirement_date">Retirement Date</label>
                                <input type="date" id="retirement_date" name="retirement_date" value="${profile.retirement_date || ''}">
                            </div>
                            <div class="form-group">
                                <label for="current_age">Current Age</label>
                                <input type="number" id="current_age" value="${person.current_age || ''}" class="calculated-field" readonly>
                            </div>
                            <div class="form-group">
                                <label for="retirement_age">Retirement Age</label>
                                <input type="number" id="retirement_age" value="${person.retirement_age || ''}" class="calculated-field" readonly>
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="life_expectancy">Life Expectancy (years) <button type="button" class="help-icon" data-tooltip="Used to calculate how long your portfolio needs to last. Conservative estimates (95-100) are recommended to ensure you don't outlive your money.">?</button></label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <input type="number" id="life_expectancy" name="life_expectancy" value="${person.life_expectancy || 95}" min="0" max="120" style="flex: 1;">
                                    <span style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">Default: 95</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="ss_benefit">Social Security (Monthly)</label>
                                <input type="number" id="ss_benefit" name="ss_benefit" value="${financial.social_security_benefit || 0}" placeholder="$0">
                            </div>
                            <div class="form-group">
                                <label for="ss_claiming_age">Claiming Age</label>
                                <select id="ss_claiming_age" name="ss_claiming_age">
                                    <option value="62" ${financial.ss_claiming_age == 62 ? 'selected' : ''}>62 (Early)</option>
                                    <option value="67" ${(!financial.ss_claiming_age || financial.ss_claiming_age == 67) ? 'selected' : ''}>67 (Full)</option>
                                    <option value="70" ${financial.ss_claiming_age == 70 ? 'selected' : ''}>70 (Max)</option>
                                </select>
                            </div>
                        </div>

                        <h3 style="font-size: 14px; margin: 16px 0 8px 0; padding-top: 12px; border-top: 1px solid var(--border-color); color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                            💰 Retirement Contributions
                        </h3>
                        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="form-group">
                                <label for="annual_401k">401k/403b Contribution Rate</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="number" id="annual_401k" name="annual_401k" value="${(person.annual_401k_contribution_rate || 0) * 100}" placeholder="0" step="0.5" min="0" max="100" style="flex: 1;">
                                    <span style="font-size: 13px;">%</span>
                                </div>
                                <small style="color: var(--text-secondary); font-size: 11px;">% of salary (pre-tax, reduces take-home)</small>
                            </div>
                            <div class="form-group">
                                <label for="employer_match">Employer Match Rate</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="number" id="employer_match" name="employer_match" value="${(person.employer_match_rate || 0) * 100}" placeholder="0" step="0.5" min="0" max="100" style="flex: 1;">
                                    <span style="font-size: 13px;">%</span>
                                </div>
                                <small style="color: var(--text-secondary); font-size: 11px;">% of salary (employer adds this)</small>
                            </div>
                        </div>
                    </div>

                    <!-- Column 2: Address & Location -->
                    <div class="form-section" style="margin-bottom: 0;">
                        <h2 style="font-size: 15px; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2); color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                            📍 Location & Tax State
                        </h2>
                        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="address_street">Street Address</label>
                                <input type="text" id="address_street" name="address_street" value="${address.street || ''}" placeholder="123 Main St">
                            </div>
                            <div class="form-group">
                                <label for="address_city">City</label>
                                <input type="text" id="address_city" name="address_city" value="${address.city || ''}" placeholder="City">
                            </div>
                            <div class="form-group">
                                <label for="address_zip">ZIP Code</label>
                                <input type="text" id="address_zip" name="address_zip" value="${address.zip || ''}" placeholder="ZIP" maxlength="10">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="address_state">State (for Tax Calculation)</label>
                                <select id="address_state" name="address_state" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                                    <option value="">Select State</option>
                                    <option value="AL" ${address.state === 'AL' ? 'selected' : ''}>Alabama</option>
                                    <option value="AK" ${address.state === 'AK' ? 'selected' : ''}>Alaska</option>
                                    <option value="AZ" ${address.state === 'AZ' ? 'selected' : ''}>Arizona</option>
                                    <option value="AR" ${address.state === 'AR' ? 'selected' : ''}>Arkansas</option>
                                    <option value="CA" ${address.state === 'CA' ? 'selected' : ''}>California</option>
                                    <option value="CO" ${address.state === 'CO' ? 'selected' : ''}>Colorado</option>
                                    <option value="CT" ${address.state === 'CT' ? 'selected' : ''}>Connecticut</option>
                                    <option value="DE" ${address.state === 'DE' ? 'selected' : ''}>Delaware</option>
                                    <option value="FL" ${address.state === 'FL' ? 'selected' : ''}>Florida</option>
                                    <option value="GA" ${address.state === 'GA' ? 'selected' : ''}>Georgia</option>
                                    <option value="HI" ${address.state === 'HI' ? 'selected' : ''}>Hawaii</option>
                                    <option value="ID" ${address.state === 'ID' ? 'selected' : ''}>Idaho</option>
                                    <option value="IL" ${address.state === 'IL' ? 'selected' : ''}>Illinois</option>
                                    <option value="IN" ${address.state === 'IN' ? 'selected' : ''}>Indiana</option>
                                    <option value="IA" ${address.state === 'IA' ? 'selected' : ''}>Iowa</option>
                                    <option value="KS" ${address.state === 'KS' ? 'selected' : ''}>Kansas</option>
                                    <option value="KY" ${address.state === 'KY' ? 'selected' : ''}>Kentucky</option>
                                    <option value="LA" ${address.state === 'LA' ? 'selected' : ''}>Louisiana</option>
                                    <option value="ME" ${address.state === 'ME' ? 'selected' : ''}>Maine</option>
                                    <option value="MD" ${address.state === 'MD' ? 'selected' : ''}>Maryland</option>
                                    <option value="MA" ${address.state === 'MA' ? 'selected' : ''}>Massachusetts</option>
                                    <option value="MI" ${address.state === 'MI' ? 'selected' : ''}>Michigan</option>
                                    <option value="MN" ${address.state === 'MN' ? 'selected' : ''}>Minnesota</option>
                                    <option value="MS" ${address.state === 'MS' ? 'selected' : ''}>Mississippi</option>
                                    <option value="MO" ${address.state === 'MO' ? 'selected' : ''}>Missouri</option>
                                    <option value="MT" ${address.state === 'MT' ? 'selected' : ''}>Montana</option>
                                    <option value="NE" ${address.state === 'NE' ? 'selected' : ''}>Nebraska</option>
                                    <option value="NV" ${address.state === 'NV' ? 'selected' : ''}>Nevada</option>
                                    <option value="NH" ${address.state === 'NH' ? 'selected' : ''}>New Hampshire</option>
                                    <option value="NJ" ${address.state === 'NJ' ? 'selected' : ''}>New Jersey</option>
                                    <option value="NM" ${address.state === 'NM' ? 'selected' : ''}>New Mexico</option>
                                    <option value="NY" ${address.state === 'NY' ? 'selected' : ''}>New York</option>
                                    <option value="NC" ${address.state === 'NC' ? 'selected' : ''}>North Carolina</option>
                                    <option value="ND" ${address.state === 'ND' ? 'selected' : ''}>North Dakota</option>
                                    <option value="OH" ${address.state === 'OH' ? 'selected' : ''}>Ohio</option>
                                    <option value="OK" ${address.state === 'OK' ? 'selected' : ''}>Oklahoma</option>
                                    <option value="OR" ${address.state === 'OR' ? 'selected' : ''}>Oregon</option>
                                    <option value="PA" ${address.state === 'PA' ? 'selected' : ''}>Pennsylvania</option>
                                    <option value="RI" ${address.state === 'RI' ? 'selected' : ''}>Rhode Island</option>
                                    <option value="SC" ${address.state === 'SC' ? 'selected' : ''}>South Carolina</option>
                                    <option value="SD" ${address.state === 'SD' ? 'selected' : ''}>South Dakota</option>
                                    <option value="TN" ${address.state === 'TN' ? 'selected' : ''}>Tennessee</option>
                                    <option value="TX" ${address.state === 'TX' ? 'selected' : ''}>Texas</option>
                                    <option value="UT" ${address.state === 'UT' ? 'selected' : ''}>Utah</option>
                                    <option value="VT" ${address.state === 'VT' ? 'selected' : ''}>Vermont</option>
                                    <option value="VA" ${address.state === 'VA' ? 'selected' : ''}>Virginia</option>
                                    <option value="WA" ${address.state === 'WA' ? 'selected' : ''}>Washington</option>
                                    <option value="WV" ${address.state === 'WV' ? 'selected' : ''}>West Virginia</option>
                                    <option value="WI" ${address.state === 'WI' ? 'selected' : ''}>Wisconsin</option>
                                    <option value="WY" ${address.state === 'WY' ? 'selected' : ''}>Wyoming</option>
                                    <option value="DC" ${address.state === 'DC' ? 'selected' : ''}>District of Columbia</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: Spouse Details -->
                    <div class="form-section" style="margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2);">
                            <h2 style="font-size: 15px; margin: 0; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                                💑 Spouse Details
                            </h2>
                            ${spouse.name ? `
                            <button type="button" id="clear-spouse-btn" style="padding: 2px 8px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                Clear
                            </button>
                            ` : ''}
                        </div>
                        <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="spouse_name">Name</label>
                                <input type="text" id="spouse_name" name="spouse_name" value="${spouse.name || ''}" placeholder="Leave blank if no spouse">
                            </div>
                            <div class="form-group">
                                <label for="spouse_birth_date">Birth Date</label>
                                <input type="date" id="spouse_birth_date" name="spouse_birth_date" value="${spouse.birth_date || ''}">
                            </div>
                            <div class="form-group">
                                <label for="spouse_retirement_date">Retirement Date</label>
                                <input type="date" id="spouse_retirement_date" name="spouse_retirement_date" value="${spouse.retirement_date || ''}">
                            </div>
                            <div class="form-group">
                                <label for="spouse_current_age">Current Age</label>
                                <input type="number" id="spouse_current_age" value="${spouse.current_age || ''}" class="calculated-field" readonly>
                            </div>
                            <div class="form-group">
                                <label for="spouse_retirement_age">Retirement Age</label>
                                <input type="number" id="spouse_retirement_age" value="${spouse.retirement_age || ''}" class="calculated-field" readonly>
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label for="spouse_life_expectancy">Life Expectancy (years)</label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <input type="number" id="spouse_life_expectancy" name="spouse_life_expectancy" value="${spouse.life_expectancy || 95}" min="0" max="120" style="flex: 1;">
                                    <span style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;">Default: 95</span>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="spouse_ss_benefit">Social Security (Monthly)</label>
                                <input type="number" id="spouse_ss_benefit" name="spouse_ss_benefit" value="${spouse.social_security_benefit || 0}" placeholder="$0">
                            </div>
                            <div class="form-group">
                                <label for="spouse_ss_claiming_age">Claiming Age</label>
                                <select id="spouse_ss_claiming_age" name="spouse_ss_claiming_age">
                                    <option value="62" ${spouse.ss_claiming_age == 62 ? 'selected' : ''}>62 (Early)</option>
                                    <option value="67" ${(!spouse.ss_claiming_age || spouse.ss_claiming_age == 67) ? 'selected' : ''}>67 (Full)</option>
                                    <option value="70" ${spouse.ss_claiming_age == 70 ? 'selected' : ''}>70 (Max)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: Children -->
                    <div class="form-section" style="margin-bottom: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-2);">
                            <h2 style="font-size: 15px; margin: 0; color: var(--accent-color); display: flex; align-items: center; gap: 8px;">
                                👶 Children
                            </h2>
                            <button type="button" id="add-child-btn" style="padding: 2px 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                + Add
                            </button>
                        </div>
                        <div id="children-list">
                            ${children.length === 0 ? '<p style="color: var(--text-secondary); font-style: italic; font-size: 12px; margin: 10px 0;">No children added.</p>' : ''}
                            ${children.map((child, index) => `
                                <div class="child-item" data-index="${index}" style="background: var(--bg-primary); padding: var(--space-2); border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <span style="font-weight: 600; font-size: 13px;">Child ${index + 1}</span>
                                        <button type="button" class="remove-child-btn" data-index="${index}" style="padding: 2px 6px; background: transparent; color: var(--danger-color); border: none; cursor: pointer; font-size: 11px;">
                                            ✕ Remove
                                        </button>
                                    </div>
                                    <div class="form-grid" style="grid-template-columns: repeat(2, 1fr); gap: 8px;">
                                        <div class="form-group">
                                            <label for="child_${index}_name" style="font-size: 11px;">Name</label>
                                            <input id="child_${index}_name" type="text" name="child_${index}_name" value="${child.name || ''}" placeholder="Optional" style="padding: 4px 8px; font-size: 12px;">
                                        </div>
                                        <div class="form-group">
                                            <label for="child_${index}_birth_year" style="font-size: 11px;">Birth Year</label>
                                            <input id="child_${index}_birth_year" type="number" name="child_${index}_birth_year" value="${child.birth_year || ''}" min="1900" max="2100" placeholder="e.g. 2010" style="padding: 4px 8px; font-size: 12px;">
                                        </div>
                                        <div class="form-group" style="grid-column: span 2;">
                                            <label for="child_${index}_notes" style="font-size: 11px;">Notes</label>
                                            <input id="child_${index}_notes" type="text" name="child_${index}_notes" value="${child.notes || ''}" placeholder="Notes" style="padding: 4px 8px; font-size: 12px;">
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <style>
            .form-section {
                background: var(--bg-secondary);
                padding: var(--space-3);
                border-radius: 8px;
                border: 1px solid var(--border-color);
            }
            .form-grid {
                display: grid;
                gap: var(--space-2);
            }
            .form-group {
                display: flex;
                flex-direction: column;
            }
            .form-group label {
                font-weight: 600;
                margin-bottom: 2px;
                color: var(--text-secondary);
                font-size: 12px;
            }
            .form-group input, .form-group select {
                padding: 6px 10px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background: var(--bg-primary);
                color: var(--text-primary);
                font-size: 13px;
                transition: border-color 0.2s;
            }
            .form-group input:focus, .form-group select:focus {
                outline: none;
                border-color: var(--accent-color);
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
            }
            .calculated-field {
                background: var(--bg-tertiary) !important;
                color: var(--text-secondary) !important;
                font-weight: 600;
                cursor: default;
            }
            @media (max-width: 900px) {
                #profile-form > div {
                    grid-template-columns: 1fr !important;
                }
            }
        </style>
    `;

    // Initialize contextual help
    setupContextualHelp(container);

    // Set up event handlers
    setupProfileFormHandlers(container, profile);
}

function setupProfileFormHandlers(container, profile) {
    const form = container.querySelector('#profile-form');
    const cancelBtn = container.querySelector('#cancel-btn');

    if (!form || !cancelBtn) {
        console.error('Profile form elements not found');
        return;
    }

    // Add child button
    const addChildBtn = container.querySelector('#add-child-btn');
    if (addChildBtn) {
        addChildBtn.addEventListener('click', () => {
            addChildToForm(container);
        });
    }

    // Remove child buttons
    setupRemoveChildButtons(container);

    // Clear spouse button
    const clearSpouseBtn = container.querySelector('#clear-spouse-btn');
    if (clearSpouseBtn) {
        clearSpouseBtn.addEventListener('click', () => {
            if (confirm('Clear all spouse information? This will remove all spouse details from the profile.')) {
                clearSpouseFields(container);
            }
        });
    }

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard unsaved changes?')) {
            window.app.showTab('dashboard');
        }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check for validation errors
        const invalidFields = container.querySelectorAll('.is-invalid');
        if (invalidFields.length > 0) {
            showError('Please fix the validation errors before saving.');
            // Scroll to first error
            invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const saveBtn = container.querySelector('#save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        showSpinner('Saving profile...');
        try {
            // Collect form data
            const formData = new FormData(form);

            // Parse person fields
            const personFields = ['current_age', 'retirement_age', 'life_expectancy'];
            const person = {};

            // Add name to person object (for setup checker)
            const personName = formData.get('name');
            if (personName) {
                person.name = personName;
            }

            // Add numeric fields
            personFields.forEach(field => {
                const value = formData.get(field);
                if (value) {
                    person[field] = parseInt(value, 10);
                }
            });

            // Parse spouse data
            const spouse = {};
            const spouseName = formData.get('spouse_name');
            if (spouseName) {
                spouse.name = spouseName;
                spouse.birth_date = formData.get('spouse_birth_date') || null;
                spouse.retirement_date = formData.get('spouse_retirement_date') || null;

                const spouseAge = formData.get('spouse_current_age');
                if (spouseAge) spouse.current_age = parseInt(spouseAge, 10);

                const spouseRetAge = formData.get('spouse_retirement_age');
                if (spouseRetAge) spouse.retirement_age = parseInt(spouseRetAge, 10);

                const spouseLifeExp = formData.get('spouse_life_expectancy');
                if (spouseLifeExp) spouse.life_expectancy = parseInt(spouseLifeExp, 10);

                // Social Security Fields for Spouse
                const spouseSS = formData.get('spouse_ss_benefit');
                if (spouseSS) spouse.social_security_benefit = parseFloat(spouseSS);
                
                const spouseSSAge = formData.get('spouse_ss_claiming_age');
                if (spouseSSAge) spouse.ss_claiming_age = parseInt(spouseSSAge, 10);

                // Preserve existing spouse financial data (managed in Assets tab)
                if (profile.data?.spouse?.pension_benefit) {
                    spouse.pension_benefit = profile.data.spouse.pension_benefit;
                }
            }

            // Parse children data
            const children = [];
            const childItems = container.querySelectorAll('.child-item');
            childItems.forEach((item, index) => {
                const childName = formData.get(`child_${index}_name`);
                const birthYear = formData.get(`child_${index}_birth_year`);
                const notes = formData.get(`child_${index}_notes`);

                if (childName || birthYear || notes) {
                    children.push({
                        name: childName || '',
                        birth_year: birthYear ? parseInt(birthYear, 10) : null,
                        notes: notes || ''
                    });
                }
            });

            // Parse address data
            const address = {};
            const addressStreet = formData.get('address_street');
            const addressCity = formData.get('address_city');
            const addressState = formData.get('address_state');
            const addressZip = formData.get('address_zip');

            if (addressStreet) address.street = addressStreet;
            if (addressCity) address.city = addressCity;
            if (addressState) address.state = addressState;
            if (addressZip) address.zip = addressZip;

            // Build updated profile data
            const updatedProfile = {
                name: formData.get('name'),
                birth_date: formData.get('birth_date') || null,
                retirement_date: formData.get('retirement_date') || null,
                data: {
                    ...profile.data,
                    person: {
                        ...(profile.data?.person || {}),
                        ...person
                    },
                    spouse: {
                        ...(profile.data?.spouse || {}),
                        ...spouse
                    },
                    children: children,
                    address: Object.keys(address).length > 0 ? address : {},
                    financial: {
                        ...(profile.data?.financial || {}),
                        social_security_benefit: parseFloat(formData.get('ss_benefit') || 0),
                        ss_claiming_age: parseInt(formData.get('ss_claiming_age') || 67),
                        annual_401k_contribution_rate: (parseFloat(formData.get('annual_401k') || 0) / 100),
                        employer_match_rate: (parseFloat(formData.get('employer_match') || 0) / 100)
                    }
                }
            };

            // Save to API
            const result = await profilesAPI.update(profile.name, updatedProfile);

            // Update store
            store.setState({ currentProfile: result.profile });

            // Show success message
            showSuccess('Profile saved successfully!');

            hideSpinner();

            // Navigate to dashboard
            setTimeout(() => {
                window.app.showTab('dashboard');
            }, 1000);

        } catch (error) {
            console.error('Error saving profile:', error);
            hideSpinner();
            showError(error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });


    // Add automatic age calculation
    setupAgeCalculation(container);
    setupSpouseAgeCalculation(container);
}

/**
 * Add a new child to the form
 */
function addChildToForm(container) {
    const childrenList = container.querySelector('#children-list');
    const existingChildren = childrenList.querySelectorAll('.child-item');
    const newIndex = existingChildren.length;

    // Remove "no children" message if present
    const noChildrenMsg = childrenList.querySelector('p');
    if (noChildrenMsg) {
        noChildrenMsg.remove();
    }

    const childHtml = `
        <div class="child-item" data-index="${newIndex}" style="background: var(--bg-primary); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="font-size: 16px; margin: 0;">Child ${newIndex + 1}</h3>
                <button type="button" class="remove-child-btn" data-index="${newIndex}" style="padding: 4px 12px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Remove
                </button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="child_${newIndex}_name">Name</label>
                    <input id="child_${newIndex}_name" type="text" name="child_${newIndex}_name" value="" placeholder="Optional">
                </div>
                <div class="form-group">
                    <label for="child_${newIndex}_birth_year">Birth Year</label>
                    <input id="child_${newIndex}_birth_year" type="number" name="child_${newIndex}_birth_year" value="" min="1900" max="2100" placeholder="e.g., 2010">
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label for="child_${newIndex}_notes">Notes</label>
                    <input id="child_${newIndex}_notes" type="text" name="child_${newIndex}_notes" value="" placeholder="e.g., College 2028-2032">
                </div>
            </div>
        </div>
    `;

    childrenList.insertAdjacentHTML('beforeend', childHtml);

    // Re-setup remove buttons
    setupRemoveChildButtons(container);
}

/**
 * Setup remove child button handlers
 */
function setupRemoveChildButtons(container) {
    const removeButtons = container.querySelectorAll('.remove-child-btn');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = btn.dataset.index;
            const childItem = container.querySelector(`.child-item[data-index="${index}"]`);
            if (childItem && confirm('Remove this child from the profile?')) {
                childItem.remove();

                // Reindex remaining children
                reindexChildren(container);

                // Show "no children" message if all removed
                const childrenList = container.querySelector('#children-list');
                const remainingChildren = childrenList.querySelectorAll('.child-item');
                if (remainingChildren.length === 0) {
                    childrenList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No children added. Click "Add Child" to include dependent information.</p>';
                }
            }
        });
    });
}

/**
 * Reindex children after removal
 */
function reindexChildren(container) {
    const childItems = container.querySelectorAll('.child-item');
    childItems.forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        item.querySelector('h3').textContent = `Child ${newIndex + 1}`;
        item.querySelector('.remove-child-btn').dataset.index = newIndex;

        // Update input names
        const inputs = item.querySelectorAll('input');
        inputs.forEach(input => {
            const name = input.getAttribute('name');
            if (name) {
                const field = name.split('_').slice(2).join('_');
                input.setAttribute('name', `child_${newIndex}_${field}`);
            }
        });
    });
}

/**
 * Clear all spouse fields
 */
function clearSpouseFields(container) {
    container.querySelector('#spouse_name').value = '';
    container.querySelector('#spouse_birth_date').value = '';
    container.querySelector('#spouse_retirement_date').value = '';
    container.querySelector('#spouse_current_age').value = '';
    container.querySelector('#spouse_retirement_age').value = '';
    container.querySelector('#spouse_life_expectancy').value = '';

    // Hide the clear button
    const clearBtn = container.querySelector('#clear-spouse-btn');
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate, referenceDate = new Date()) {
    if (!birthDate) return null;

    const birth = new Date(birthDate);
    const age = referenceDate.getFullYear() - birth.getFullYear();
    const monthDiff = referenceDate.getMonth() - birth.getMonth();

    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
        return age - 1;
    }

    return age;
}

/**
 * Set up automatic age calculation based on dates
 */
function setupAgeCalculation(container) {
    const birthDateField = container.querySelector('#birth_date');
    const retirementDateField = container.querySelector('#retirement_date');
    const currentAgeField = container.querySelector('#current_age');
    const retirementAgeField = container.querySelector('#retirement_age');

    if (!birthDateField || !currentAgeField || !retirementAgeField) {
        return;
    }

    // Function to update ages
    const updateAges = () => {
        const birthDate = birthDateField.value;
        let retirementDate = retirementDateField ? retirementDateField.value : null;

        if (birthDate) {
            // Calculate current age
            const currentAge = calculateAge(birthDate);
            if (currentAge !== null) {
                currentAgeField.value = currentAge;
            }

            // SMART DEFAULT: Auto-fill retirement date if empty
            if (retirementDateField && !retirementDate) {
                const birth = new Date(birthDate);
                // Default to age 67 (SS Full Retirement Age)
                birth.setFullYear(birth.getFullYear() + 67);
                // Format as YYYY-MM-DD
                const defaultDate = birth.toISOString().split('T')[0];
                retirementDateField.value = defaultDate;
                retirementDate = defaultDate;
                
                // Add visual cue
                retirementDateField.style.transition = 'background-color 0.5s';
                retirementDateField.style.backgroundColor = 'var(--info-bg)';
                setTimeout(() => {
                    retirementDateField.style.backgroundColor = '';
                }, 1000);
            }

            // Calculate retirement age if retirement date is set
            if (retirementDate) {
                const retirementAge = calculateAge(birthDate, new Date(retirementDate));
                if (retirementAge !== null) {
                    retirementAgeField.value = retirementAge;
                    
                    // VALIDATION: Check if retirement age is reasonable (> 18)
                    if (retirementAge < 18) {
                        setFieldError(retirementDateField, 'Retirement date must be at least 18 years after birth date');
                    } else {
                        clearFieldError(retirementDateField);
                    }
                }
            } else {
                clearFieldError(retirementDateField);
            }
        }
    };

    // Update ages when birth date changes
    birthDateField.addEventListener('change', updateAges);
    birthDateField.addEventListener('blur', updateAges);

    // Update retirement age when retirement date changes
    if (retirementDateField) {
        retirementDateField.addEventListener('change', updateAges);
        retirementDateField.addEventListener('blur', updateAges);
    }

    // Calculate initial values on load
    updateAges();
}

/**
 * Set up automatic age calculation for spouse based on dates
 */
function setupSpouseAgeCalculation(container) {
    const spouseBirthDateField = container.querySelector('#spouse_birth_date');
    const spouseRetirementDateField = container.querySelector('#spouse_retirement_date');
    const spouseCurrentAgeField = container.querySelector('#spouse_current_age');
    const spouseRetirementAgeField = container.querySelector('#spouse_retirement_age');

    if (!spouseBirthDateField || !spouseCurrentAgeField || !spouseRetirementAgeField) {
        return;
    }

    // Function to update spouse ages
    const updateSpouseAges = () => {
        const birthDate = spouseBirthDateField.value;
        let retirementDate = spouseRetirementDateField ? spouseRetirementDateField.value : null;

        if (birthDate) {
            // Calculate current age
            const currentAge = calculateAge(birthDate);
            if (currentAge !== null) {
                spouseCurrentAgeField.value = currentAge;
            }

            // SMART DEFAULT: Auto-fill retirement date if empty
            if (spouseRetirementDateField && !retirementDate) {
                const birth = new Date(birthDate);
                // Default to age 67
                birth.setFullYear(birth.getFullYear() + 67);
                const defaultDate = birth.toISOString().split('T')[0];
                spouseRetirementDateField.value = defaultDate;
                retirementDate = defaultDate;

                // Add visual cue
                spouseRetirementDateField.style.transition = 'background-color 0.5s';
                spouseRetirementDateField.style.backgroundColor = 'var(--info-bg)';
                setTimeout(() => {
                    spouseRetirementDateField.style.backgroundColor = '';
                }, 1000);
            }

            // Calculate retirement age if retirement date is set
            if (retirementDate) {
                const retirementAge = calculateAge(birthDate, new Date(retirementDate));
                if (retirementAge !== null) {
                    spouseRetirementAgeField.value = retirementAge;
                    
                    // VALIDATION: Check if retirement age is reasonable (> 18)
                    if (retirementAge < 18) {
                        setFieldError(spouseRetirementDateField, 'Retirement date must be at least 18 years after birth date');
                    } else {
                        clearFieldError(spouseRetirementDateField);
                    }
                }
            } else {
                clearFieldError(spouseRetirementDateField);
            }
        }
    };

    // Update ages when birth date changes
    spouseBirthDateField.addEventListener('change', updateSpouseAges);
    spouseBirthDateField.addEventListener('blur', updateSpouseAges);

    // Update retirement age when retirement date changes
    if (spouseRetirementDateField) {
        spouseRetirementDateField.addEventListener('change', updateSpouseAges);
        spouseRetirementDateField.addEventListener('blur', updateSpouseAges);
    }

    // Calculate initial values on load
    updateSpouseAges();
}

// --- Validation Helpers ---

function setFieldError(inputElement, message) {
    // Check if error already exists
    let errorDiv = inputElement.parentElement.querySelector('.field-error');
    
    inputElement.style.borderColor = 'var(--danger-color)';
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = 'var(--danger-color)';
        errorDiv.style.fontSize = '11px';
        errorDiv.style.marginTop = '4px';
        inputElement.parentElement.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    inputElement.classList.add('is-invalid');
}

function clearFieldError(inputElement) {
    if (!inputElement) return;
    
    const errorDiv = inputElement.parentElement.querySelector('.field-error');
    if (errorDiv) {
        errorDiv.remove();
    }
    
    inputElement.style.borderColor = ''; // Reset to default (via CSS)
    inputElement.classList.remove('is-invalid');
}
