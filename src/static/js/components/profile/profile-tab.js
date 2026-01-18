/**
 * Profile tab component - Edit profile data
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError } from '../../utils/dom.js';

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
                <button onclick="window.app.showTab('welcome')" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
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
        <div style="max-width: 1000px; margin: 0 auto; padding: var(--space-5);">
            <h1 style="font-size: var(--font-3xl); margin-bottom: var(--space-1);">Edit Profile</h1>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-4);">
                Update your retirement planning information
            </p>

            <form id="profile-form">
                <!-- My Details -->
                <div class="form-section">
                    <h2 style="font-size: var(--font-xl); margin-bottom: var(--space-3); border-bottom: 2px solid var(--accent-color); padding-bottom: var(--space-2);">
                        My Details
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="name">Name *</label>
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
                            <label for="current_age">Current Age <span class="calc-badge">calculated</span></label>
                            <input type="number" id="current_age" name="current_age" value="${person.current_age || ''}" min="0" max="120" class="calculated-field" readonly>
                            <small>Based on birth date</small>
                        </div>
                        <div class="form-group">
                            <label for="retirement_age">Retirement Age <span class="calc-badge">calculated</span></label>
                            <input type="number" id="retirement_age" name="retirement_age" value="${person.retirement_age || ''}" min="0" max="120" class="calculated-field" readonly>
                            <small>Based on birth &amp; retirement dates</small>
                        </div>
                        <div class="form-group">
                            <label for="life_expectancy">Life Expectancy</label>
                            <input type="number" id="life_expectancy" name="life_expectancy" value="${person.life_expectancy || 95}" min="0" max="120">
                            <small>Default: 95 years</small>
                        </div>
                    </div>
                </div>

                <!-- Spouse Details -->
                <div class="form-section">
                    <h2 style="font-size: var(--font-xl); margin-bottom: var(--space-3); border-bottom: 2px solid var(--accent-color); padding-bottom: var(--space-2);">
                        Spouse Details
                    </h2>
                    <div class="form-grid">
                        <div class="form-group">
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
                            <label for="spouse_current_age">Current Age <span class="calc-badge">calculated</span></label>
                            <input type="number" id="spouse_current_age" name="spouse_current_age" value="${spouse.current_age || ''}" min="0" max="120" class="calculated-field" readonly>
                            <small>Based on birth date</small>
                        </div>
                        <div class="form-group">
                            <label for="spouse_retirement_age">Retirement Age <span class="calc-badge">calculated</span></label>
                            <input type="number" id="spouse_retirement_age" name="spouse_retirement_age" value="${spouse.retirement_age || ''}" min="0" max="120" class="calculated-field" readonly>
                            <small>Based on birth &amp; retirement dates</small>
                        </div>
                        <div class="form-group">
                            <label for="spouse_life_expectancy">Life Expectancy</label>
                            <input type="number" id="spouse_life_expectancy" name="spouse_life_expectancy" value="${spouse.life_expectancy || 95}" min="0" max="120">
                            <small>Default: 95 years</small>
                        </div>
                    </div>
                </div>

                <!-- Children -->
                <div class="form-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                        <h2 style="font-size: var(--font-xl); border-bottom: 2px solid var(--accent-color); padding-bottom: var(--space-2); margin: 0;">
                            Children
                        </h2>
                        <button type="button" id="add-child-btn" style="padding: var(--space-2) var(--space-4); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-base);">
                            + Add Child
                        </button>
                    </div>
                    <div id="children-list">
                        ${children.length === 0 ? '<p style="color: var(--text-secondary); font-style: italic;">No children added. Click "Add Child" to include dependent information.</p>' : ''}
                        ${children.map((child, index) => `
                            <div class="child-item" data-index="${index}" style="background: var(--bg-primary); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
                                    <h3 style="font-size: var(--font-md); margin: 0;">Child ${index + 1}</h3>
                                    <button type="button" class="remove-child-btn" data-index="${index}" style="padding: var(--space-1) var(--space-3); background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: var(--font-sm);">
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

                <!-- Action Buttons -->
                <div style="display: flex; gap: var(--space-3); margin-top: var(--space-5); justify-content: flex-end;">
                    <button type="button" id="cancel-btn" style="padding: var(--space-3) var(--space-6); background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-base);">
                        Cancel
                    </button>
                    <button type="submit" id="save-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-base);">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>

        <style>
            .form-section {
                background: var(--bg-secondary);
                padding: var(--space-5);
                border-radius: 10px;
                margin-bottom: var(--space-4);
            }
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: var(--space-3);
            }
            .form-group {
                display: flex;
                flex-direction: column;
            }
            .form-group label {
                font-weight: 600;
                margin-bottom: var(--space-1);
                color: var(--text-primary);
                font-size: var(--font-base);
            }
            .form-group input {
                padding: var(--space-2) var(--space-3);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-primary);
                color: var(--text-primary);
                font-size: var(--font-base);
                transition: border-color 0.2s;
            }
            .form-group input:focus {
                outline: none;
                border-color: var(--accent-color);
            }
            .form-group small {
                margin-top: var(--space-1);
                color: var(--text-secondary);
                font-size: var(--font-sm);
            }
            #save-btn:hover {
                background: var(--accent-hover);
            }
            #cancel-btn:hover {
                background: var(--bg-quaternary);
            }
            .calc-badge {
                display: inline-block;
                font-size: var(--font-xs);
                font-weight: 500;
                text-transform: uppercase;
                background: var(--accent-color);
                color: white;
                padding: var(--space-1) var(--space-2);
                border-radius: 4px;
                margin-left: var(--space-2);
                vertical-align: middle;
            }
            .calculated-field {
                background: var(--bg-tertiary) !important;
                color: var(--accent-color) !important;
                font-weight: 600;
                cursor: default;
            }
            .calculated-field:focus {
                border-color: var(--border-color) !important;
            }
            @media (max-width: 639px) {
                .form-grid {
                    grid-template-columns: 1fr;
                }
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

                // Preserve existing spouse financial data (managed in Assets tab)
                if (profile.data?.spouse?.social_security_benefit) {
                    spouse.social_security_benefit = profile.data.spouse.social_security_benefit;
                }
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
                    financial: profile.data?.financial || {}
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
