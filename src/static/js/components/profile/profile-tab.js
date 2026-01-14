/**
 * Profile tab component - Edit profile data
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { formatCurrency, parseCurrency } from '../../utils/formatters.js';

export function renderProfileTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">👤</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to edit.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const person = data.person || {};
    const spouse = data.spouse || {};
    const children = data.children || [];
    const financial = data.financial || {};

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Edit Profile</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Update your retirement planning information
            </p>

            <form id="profile-form">
                <!-- Basic Information -->
                <div class="form-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">
                        Basic Information
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="name">Profile Name *</label>
                            <input type="text" id="name" name="name" value="${profile.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="birth_date">Birth Date</label>
                            <input type="date" id="birth_date" name="birth_date" value="${profile.birth_date || ''}">
                        </div>
                        <div class="form-group">
                            <label for="retirement_date">Target Retirement Date</label>
                            <input type="date" id="retirement_date" name="retirement_date" value="${profile.retirement_date || ''}">
                        </div>
                    </div>
                </div>

                <!-- Personal Details -->
                <div class="form-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">
                        Personal Details
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="current_age">Current Age</label>
                            <input type="number" id="current_age" name="current_age" value="${person.current_age || ''}" min="0" max="120">
                        </div>
                        <div class="form-group">
                            <label for="retirement_age">Planned Retirement Age</label>
                            <input type="number" id="retirement_age" name="retirement_age" value="${person.retirement_age || ''}" min="0" max="120">
                        </div>
                        <div class="form-group">
                            <label for="life_expectancy">Life Expectancy</label>
                            <input type="number" id="life_expectancy" name="life_expectancy" value="${person.life_expectancy || ''}" min="0" max="120">
                        </div>
                    </div>
                </div>

                <!-- Spouse Information -->
                <div class="form-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">
                        Spouse Information
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="spouse_name">Spouse Name</label>
                            <input type="text" id="spouse_name" name="spouse_name" value="${spouse.name || ''}" placeholder="Optional">
                        </div>
                        <div class="form-group">
                            <label for="spouse_birth_date">Spouse Birth Date</label>
                            <input type="date" id="spouse_birth_date" name="spouse_birth_date" value="${spouse.birth_date || ''}">
                        </div>
                        <div class="form-group">
                            <label for="spouse_retirement_date">Spouse Retirement Date</label>
                            <input type="date" id="spouse_retirement_date" name="spouse_retirement_date" value="${spouse.retirement_date || ''}">
                        </div>
                        <div class="form-group">
                            <label for="spouse_current_age">Spouse Current Age</label>
                            <input type="number" id="spouse_current_age" name="spouse_current_age" value="${spouse.current_age || ''}" min="0" max="120">
                        </div>
                        <div class="form-group">
                            <label for="spouse_retirement_age">Spouse Retirement Age</label>
                            <input type="number" id="spouse_retirement_age" name="spouse_retirement_age" value="${spouse.retirement_age || ''}" min="0" max="120">
                        </div>
                        <div class="form-group">
                            <label for="spouse_life_expectancy">Spouse Life Expectancy</label>
                            <input type="number" id="spouse_life_expectancy" name="spouse_life_expectancy" value="${spouse.life_expectancy || ''}" min="0" max="120">
                        </div>
                        <div class="form-group">
                            <label for="spouse_social_security">Spouse Social Security (monthly)</label>
                            <input type="text" id="spouse_social_security" name="spouse_social_security" value="${spouse.social_security_benefit || ''}" placeholder="$0">
                            <small>Estimated monthly benefit at full retirement age</small>
                        </div>
                        <div class="form-group">
                            <label for="spouse_pension">Spouse Pension (monthly)</label>
                            <input type="text" id="spouse_pension" name="spouse_pension" value="${spouse.pension_benefit || ''}" placeholder="$0">
                            <small>Monthly pension amount, if applicable</small>
                        </div>
                    </div>
                </div>

                <!-- Children -->
                <div class="form-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="font-size: 24px; border-bottom: 2px solid var(--accent-color); padding-bottom: 10px; margin: 0;">
                            Children
                        </h2>
                        <button type="button" id="add-child-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            + Add Child
                        </button>
                    </div>
                    <div id="children-list">
                        ${children.length === 0 ? '<p style="color: var(--text-secondary); font-style: italic;">No children added. Click "Add Child" to include dependent information.</p>' : ''}
                        ${children.map((child, index) => `
                            <div class="child-item" data-index="${index}" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <h3 style="font-size: 18px; margin: 0;">Child ${index + 1}</h3>
                                    <button type="button" class="remove-child-btn" data-index="${index}" style="padding: 4px 12px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                                        Remove
                                    </button>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Name</label>
                                        <input type="text" name="child_${index}_name" value="${child.name || ''}" placeholder="Optional">
                                    </div>
                                    <div class="form-group">
                                        <label>Birth Year</label>
                                        <input type="number" name="child_${index}_birth_year" value="${child.birth_year || ''}" min="1900" max="2100" placeholder="e.g., 2010">
                                    </div>
                                    <div class="form-group" style="grid-column: span 2;">
                                        <label>Notes</label>
                                        <input type="text" name="child_${index}_notes" value="${child.notes || ''}" placeholder="e.g., College 2028-2032">
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Financial Information -->
                <div class="form-section">
                    <h2 style="font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid var(--accent-color); padding-bottom: 10px;">
                        Financial Information
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="annual_income">Annual Income</label>
                            <input type="text" id="annual_income" name="annual_income" value="${financial.annual_income || ''}" placeholder="$0">
                            <small>Your current annual gross income</small>
                        </div>
                        <div class="form-group">
                            <label for="annual_expenses">Annual Expenses</label>
                            <input type="text" id="annual_expenses" name="annual_expenses" value="${financial.annual_expenses || ''}" placeholder="$0">
                            <small>Your current annual spending</small>
                        </div>
                        <div class="form-group">
                            <label for="liquid_assets">Liquid Assets</label>
                            <input type="text" id="liquid_assets" name="liquid_assets" value="${financial.liquid_assets || ''}" placeholder="$0">
                            <small>Cash, savings, taxable investments</small>
                        </div>
                        <div class="form-group">
                            <label for="retirement_assets">Retirement Assets</label>
                            <input type="text" id="retirement_assets" name="retirement_assets" value="${financial.retirement_assets || ''}" placeholder="$0">
                            <small>401k, IRA, Roth IRA, etc.</small>
                        </div>
                        <div class="form-group">
                            <label for="social_security_benefit">Social Security Benefit (monthly)</label>
                            <input type="text" id="social_security_benefit" name="social_security_benefit" value="${financial.social_security_benefit || ''}" placeholder="$0">
                            <small>Estimated monthly benefit at full retirement age</small>
                        </div>
                        <div class="form-group">
                            <label for="pension_benefit">Pension Benefit (monthly)</label>
                            <input type="text" id="pension_benefit" name="pension_benefit" value="${financial.pension_benefit || ''}" placeholder="$0">
                            <small>Monthly pension amount, if applicable</small>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 15px; margin-top: 40px; justify-content: flex-end;">
                    <button type="button" id="cancel-btn" style="padding: 12px 30px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                        Cancel
                    </button>
                    <button type="submit" id="save-btn" style="padding: 12px 30px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>

        <style>
            .form-section {
                background: var(--bg-secondary);
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
            }
            .form-group {
                display: flex;
                flex-direction: column;
            }
            .form-group label {
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--text-primary);
            }
            .form-group input {
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-primary);
                color: var(--text-primary);
                font-size: 16px;
                transition: border-color 0.2s;
            }
            .form-group input:focus {
                outline: none;
                border-color: var(--accent-color);
            }
            .form-group small {
                margin-top: 5px;
                color: var(--text-secondary);
                font-size: 13px;
            }
            #save-btn:hover {
                background: var(--accent-hover);
            }
            #cancel-btn:hover {
                background: var(--bg-quaternary);
            }
        </style>
    `;

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

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard unsaved changes?')) {
            window.app.showTab('dashboard');
        }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = container.querySelector('#save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Collect form data
            const formData = new FormData(form);

            // Parse financial fields as numbers
            const financialFields = ['annual_income', 'annual_expenses', 'liquid_assets',
                                    'retirement_assets', 'social_security_benefit', 'pension_benefit'];
            const financial = {};
            financialFields.forEach(field => {
                const value = formData.get(field);
                if (value) {
                    financial[field] = parseCurrency(value);
                }
            });

            // Parse person fields as numbers
            const personFields = ['current_age', 'retirement_age', 'life_expectancy'];
            const person = {};
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

                const spouseSS = formData.get('spouse_social_security');
                if (spouseSS) spouse.social_security_benefit = parseCurrency(spouseSS);

                const spousePension = formData.get('spouse_pension');
                if (spousePension) spouse.pension_benefit = parseCurrency(spousePension);
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
                    spouse: Object.keys(spouse).length > 0 ? spouse : {},
                    children: children,
                    financial: {
                        ...(profile.data?.financial || {}),
                        ...financial
                    }
                }
            };

            // Save to API
            const result = await profilesAPI.update(profile.name, updatedProfile);

            // Update store
            store.setState({ currentProfile: result.profile });

            // Show success message
            showSuccess('Profile saved successfully!');

            // Navigate to dashboard
            setTimeout(() => {
                window.app.showTab('dashboard');
            }, 1000);

        } catch (error) {
            console.error('Error saving profile:', error);
            showError(document.querySelector('.form-section'), error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    // Add currency formatting on blur for financial fields
    const currencyFields = ['annual_income', 'annual_expenses', 'liquid_assets',
                           'retirement_assets', 'social_security_benefit', 'pension_benefit',
                           'spouse_social_security', 'spouse_pension'];
    currencyFields.forEach(fieldName => {
        const field = container.querySelector(`#${fieldName}`);
        if (field) {
            field.addEventListener('blur', (e) => {
                const value = parseCurrency(e.target.value);
                if (value > 0) {
                    e.target.value = formatCurrency(value, 0);
                }
            });

            // Format initial value if present
            if (field.value) {
                const value = parseCurrency(field.value);
                if (value > 0) {
                    field.value = formatCurrency(value, 0);
                }
            }
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
        <div class="child-item" data-index="${newIndex}" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="font-size: 18px; margin: 0;">Child ${newIndex + 1}</h3>
                <button type="button" class="remove-child-btn" data-index="${newIndex}" style="padding: 4px 12px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Remove
                </button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="child_${newIndex}_name" value="" placeholder="Optional">
                </div>
                <div class="form-group">
                    <label>Birth Year</label>
                    <input type="number" name="child_${newIndex}_birth_year" value="" min="1900" max="2100" placeholder="e.g., 2010">
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label>Notes</label>
                    <input type="text" name="child_${newIndex}_notes" value="" placeholder="e.g., College 2028-2032">
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
            const index = e.target.dataset.index;
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
        const retirementDate = retirementDateField ? retirementDateField.value : null;

        if (birthDate) {
            // Calculate current age
            const currentAge = calculateAge(birthDate);
            if (currentAge !== null) {
                currentAgeField.value = currentAge;
            }

            // Calculate retirement age if retirement date is set
            if (retirementDate) {
                const retirementAge = calculateAge(birthDate, new Date(retirementDate));
                if (retirementAge !== null) {
                    retirementAgeField.value = retirementAge;
                }
            }
        }
    };

    // Update ages when birth date changes
    birthDateField.addEventListener('change', updateAges);

    // Update retirement age when retirement date changes
    if (retirementDateField) {
        retirementDateField.addEventListener('change', updateAges);
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
        const retirementDate = spouseRetirementDateField ? spouseRetirementDateField.value : null;

        if (birthDate) {
            // Calculate current age
            const currentAge = calculateAge(birthDate);
            if (currentAge !== null) {
                spouseCurrentAgeField.value = currentAge;
            }

            // Calculate retirement age if retirement date is set
            if (retirementDate) {
                const retirementAge = calculateAge(birthDate, new Date(retirementDate));
                if (retirementAge !== null) {
                    spouseRetirementAgeField.value = retirementAge;
                }
            }
        }
    };

    // Update ages when birth date changes
    spouseBirthDateField.addEventListener('change', updateSpouseAges);

    // Update retirement age when retirement date changes
    if (spouseRetirementDateField) {
        spouseRetirementDateField.addEventListener('change', updateSpouseAges);
    }

    // Calculate initial values on load
    updateSpouseAges();
}
