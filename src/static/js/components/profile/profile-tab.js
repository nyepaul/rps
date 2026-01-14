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
    setupProfileFormHandlers(profile);
}

function setupProfileFormHandlers(profile) {
    const form = document.getElementById('profile-form');
    const cancelBtn = document.getElementById('cancel-btn');

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard unsaved changes?')) {
            window.app.showTab('dashboard');
        }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = document.getElementById('save-btn');
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
                           'retirement_assets', 'social_security_benefit', 'pension_benefit'];
    currencyFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
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
}
