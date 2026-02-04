/**
 * Profile tab component - Edit profile data
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { setupContextualHelp } from '../../utils/contextual-help.js';
import { setFieldError, setFieldWarning, clearFieldError, validateAge } from '../../utils/validation.js';
import { loadTemplate } from '../../utils/template-loader.js';




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

    // Inline Validation Listeners
    const lifeExpInput = container.querySelector('#life_expectancy');
    if (lifeExpInput) {
        lifeExpInput.addEventListener('blur', () => {
            const val = parseInt(lifeExpInput.value);
            if (val < 60) setFieldWarning(lifeExpInput, 'Short life expectancy may underestimate needed savings');
            else if (val > 110) setFieldWarning(lifeExpInput, 'Unusually long life expectancy');
            else clearFieldError(lifeExpInput);
        });
    }

    const ssBenefitInput = container.querySelector('#ss_benefit');
    if (ssBenefitInput) {
        ssBenefitInput.addEventListener('blur', () => {
            const val = parseFloat(ssBenefitInput.value);
            if (val > 5000) setFieldWarning(ssBenefitInput, 'Unusually high SS benefit (max 2024 is ~$3,822)');
            else if (val < 0) setFieldError(ssBenefitInput, 'Benefit cannot be negative');
            else clearFieldError(ssBenefitInput);
        });
    }

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
    
    // Setup smart defaults (IP geolocation)
    setupSmartDefaults(container);
}

/**
 * Setup smart defaults for form fields
 */
function setupSmartDefaults(container) {
    const stateSelect = container.querySelector('#address_state');
    
    // Only fetch if state is not already selected
    if (stateSelect && !stateSelect.value) {
        // Use a timeout to not block rendering
        setTimeout(async () => {
            try {
                const response = await fetch('https://ipapi.co/json/');
                if (response.ok) {
                    const data = await response.json();
                    if (data.region_code && data.country_code === 'US') {
                        // Check if the option exists
                        const option = stateSelect.querySelector(`option[value="${data.region_code}"]`);
                        if (option) {
                            stateSelect.value = data.region_code;
                            
                            // Visual cue
                            stateSelect.style.transition = 'background-color 0.5s';
                            stateSelect.style.backgroundColor = 'var(--info-bg)';
                            setTimeout(() => {
                                stateSelect.style.backgroundColor = '';
                            }, 1000);
                            
                            // Add a small note
                            const label = stateSelect.previousElementSibling;
                            if (label) {
                                const badge = document.createElement('span');
                                badge.textContent = ' (Auto-detected)';
                                badge.style.fontSize = '10px';
                                badge.style.color = 'var(--accent-color)';
                                badge.style.fontWeight = 'normal';
                                label.appendChild(badge);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to auto-detect location:', error);
            }
        }, 1000);
    }
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
                <button type="button" class="remove-child-btn" data-index="${newIndex}" style="padding: 4px 12px; background: var(--danger-color); color: var(--text-on-danger); border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
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
                    validateAge(retirementDateField, retirementAge, { min: 18, max: 90, label: 'Retirement Age' });
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
                    validateAge(spouseRetirementDateField, retirementAge, { min: 18, max: 90, label: 'Spouse Retirement Age' });
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

