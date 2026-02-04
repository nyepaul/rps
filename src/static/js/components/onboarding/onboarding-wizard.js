/**
 * Onboarding Wizard Component
 * Guided 5-step flow for new users to set up their first profile
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showSuccess, showError } from '../../utils/dom.js';

// Wizard State
const state = {
    step: 1,
    totalSteps: 5,
    data: {
        name: '',
        birthYear: '',
        retirementAge: 65,
        annualIncome: 80000,
        annualExpenses: 60000,
        portfolio: 50000,
        priorities: []
    }
};

/**
 * Initialize and show the onboarding wizard
 */
export function startOnboarding() {
    // Create overlay if not exists
    let overlay = document.getElementById('onboarding-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'onboarding-overlay';
        document.body.appendChild(overlay);
    }

    // Determine simplified current year
    const currentYear = new Date().getFullYear();
    // Default birth year to 35 years ago
    state.data.birthYear = currentYear - 35;

    renderWizard(overlay);
    
    // Animate in
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
}

/**
 * Render the wizard structure and current step
 */
function renderWizard(container) {
    container.innerHTML = `
        <div class="onboarding-container">
            <!-- Progress -->
            <div class="onboarding-progress">
                <div class="onboarding-progress-bar" style="width: ${(state.step / state.totalSteps) * 100}%"></div>
            </div>

            <!-- Steps -->
            <div class="onboarding-steps">
                ${renderStep1()}
                ${renderStep2()}
                ${renderStep3()}
                ${renderStep4()}
                ${renderStep5()}
            </div>

            <!-- Footer -->
            <div class="onboarding-footer">
                <button id="wizard-back" class="btn-wizard btn-wizard-secondary" ${state.step === 1 ? 'style="visibility: hidden;"' : ''}>
                    Back
                </button>
                <button id="wizard-next" class="btn-wizard btn-wizard-primary">
                    ${state.step === state.totalSteps ? 'Create Profile' : 'Next'}
                </button>
            </div>
        </div>
    `;

    // Attach event listeners
    document.getElementById('wizard-next').addEventListener('click', handleNext);
    document.getElementById('wizard-back').addEventListener('click', handleBack);
    
    // Attach input listeners
    setupInputListeners();
}

/**
 * Step 1: Welcome
 */
function renderStep1() {
    return `
        <div class="onboarding-step ${state.step === 1 ? 'active' : ''}" id="step-1">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 class="onboarding-title">Profile Setup</h2>
                <p class="onboarding-subtitle">
                    Initialize your first retirement profile.
                </p>
            </div>
            
            <div class="wizard-form-group">
                <label class="wizard-label">What should we call this profile?</label>
                <input type="text" class="wizard-input" id="wiz-name" value="${state.data.name}" placeholder="e.g., My Plan, Family Finances">
            </div>
        </div>
    `;
}

/**
 * Step 2: Personal Info
 */
function renderStep2() {
    const currentYear = new Date().getFullYear();
    return `
        <div class="onboarding-step ${state.step === 2 ? 'active' : ''}" id="step-2">
            <h2 class="onboarding-title">About You</h2>
            <p class="onboarding-subtitle">We use your age to project timelines.</p>

            <div class="wizard-form-group">
                <label class="wizard-label">What year were you born?</label>
                <input type="number" class="wizard-input" id="wiz-birth-year" value="${state.data.birthYear}" min="1940" max="${currentYear}">
            </div>

            <div class="wizard-form-group">
                <label class="wizard-label">Target Retirement Age</label>
                <input type="number" class="wizard-input" id="wiz-retire-age" value="${state.data.retirementAge}" min="40" max="80">
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">
                    Standard retirement age is 65-67.
                </p>
            </div>
        </div>
    `;
}

/**
 * Step 3: Financial Snapshot
 */
function renderStep3() {
    return `
        <div class="onboarding-step ${state.step === 3 ? 'active' : ''}" id="step-3">
            <h2 class="onboarding-title">Financial Snapshot</h2>
            <p class="onboarding-subtitle">Estimates are fine. You can refine this later.</p>

            <div class="wizard-form-group">
                <label class="wizard-label">Annual Income (Pre-tax)</label>
                <input type="number" class="wizard-input" id="wiz-income" value="${state.data.annualIncome}" step="1000">
            </div>

            <div class="wizard-form-group">
                <label class="wizard-label">Annual Expenses</label>
                <input type="number" class="wizard-input" id="wiz-expenses" value="${state.data.annualExpenses}" step="1000">
            </div>

            <div class="wizard-form-group">
                <label class="wizard-label">Current Invested Assets</label>
                <input type="number" class="wizard-input" id="wiz-portfolio" value="${state.data.portfolio}" step="1000">
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 6px;">
                    Include 401k, IRA, Brokerage. Don't include home value.
                </p>
            </div>
        </div>
    `;
}

/**
 * Step 4: Priorities
 */
function renderStep4() {
    const priorities = [
        { id: 'safety', icon: '🛡️', label: 'Safety First' },
        { id: 'growth', icon: '📈', label: 'Max Growth' },
        { id: 'tax', icon: '⚖️', label: 'Tax Efficiency' },
        { id: 'early', icon: '🏖️', label: 'Retire Early' }
    ];

    return `
        <div class="onboarding-step ${state.step === 4 ? 'active' : ''}" id="step-4">
            <h2 class="onboarding-title">Your Priorities</h2>
            <p class="onboarding-subtitle">Select what matters most to you (Optional)</p>

            <div class="priority-grid">
                ${priorities.map(p => `
                    <div class="priority-card ${state.data.priorities.includes(p.id) ? 'selected' : ''}" data-id="${p.id}">
                        <span class="priority-icon">${p.icon}</span>
                        <span class="priority-label">${p.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Step 5: Result Preview
 */
function renderStep5() {
    // Quick Calculation logic for preview
    // Simple 4% rule check + Savings Rate projection
    const savings = state.data.annualIncome - state.data.annualExpenses;
    const savingsRate = (savings / state.data.annualIncome) * 100;
    const target = state.data.annualExpenses * 25;
    
    // Simple projection
    const currentYear = new Date().getFullYear();
    const yearsToRetire = (state.data.birthYear + state.data.retirementAge) - currentYear;
    let projected = state.data.portfolio;
    for(let i=0; i<yearsToRetire; i++) {
        projected = (projected + savings) * 1.06; // 6% real return
    }
    
    const successProb = Math.min(99, Math.max(10, (projected / target) * 100));
    let status = "On Track";
    if (successProb < 50) status = "Needs Adjustment";
    else if (successProb > 120) status = "Excellent";

    return `
        <div class="onboarding-step ${state.step === 5 ? 'active' : ''}" id="step-5">
            <h2 class="onboarding-title">Quick Look</h2>
            <p class="onboarding-subtitle">Here's a rough estimate based on your inputs.</p>

            <div class="result-preview">
                <div class="result-score">${Math.round(successProb)}%</div>
                <div class="result-label">Probability of Success</div>
                
                <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 24px;">
                    Status: <strong>${status}</strong>
                </div>

                <div style="text-align: left; background: var(--bg-tertiary); padding: 16px; border-radius: 8px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Projected Nest Egg:</span>
                        <strong>${formatCurrency(projected, 0)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Target Amount:</span>
                        <strong>${formatCurrency(target, 0)}</strong>
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; margin-top: 24px; font-size: 13px; color: var(--text-secondary);">
                Ready to see the detailed analysis?
            </p>
        </div>
    `;
}

/**
 * Handle input changes
 */
function setupInputListeners() {
    // Step 1
    const nameInput = document.getElementById('wiz-name');
    if (nameInput) nameInput.addEventListener('input', (e) => state.data.name = e.target.value);

    // Step 2
    const birthInput = document.getElementById('wiz-birth-year');
    if (birthInput) birthInput.addEventListener('input', (e) => state.data.birthYear = parseInt(e.target.value));
    
    const retireInput = document.getElementById('wiz-retire-age');
    if (retireInput) retireInput.addEventListener('input', (e) => state.data.retirementAge = parseInt(e.target.value));

    // Step 3
    const incomeInput = document.getElementById('wiz-income');
    if (incomeInput) incomeInput.addEventListener('input', (e) => state.data.annualIncome = parseFloat(e.target.value));

    const expenseInput = document.getElementById('wiz-expenses');
    if (expenseInput) expenseInput.addEventListener('input', (e) => state.data.annualExpenses = parseFloat(e.target.value));

    const portInput = document.getElementById('wiz-portfolio');
    if (portInput) portInput.addEventListener('input', (e) => state.data.portfolio = parseFloat(e.target.value));

    // Step 4 Priority Cards
    const cards = document.querySelectorAll('.priority-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            if (state.data.priorities.includes(id)) {
                state.data.priorities = state.data.priorities.filter(p => p !== id);
                card.classList.remove('selected');
            } else {
                state.data.priorities.push(id);
                card.classList.add('selected');
            }
        });
    });
}

/**
 * Navigation Handlers
 */
function handleNext() {
    if (state.step < state.totalSteps) {
        // Validation
        if (state.step === 1 && !state.data.name) {
            const input = document.getElementById('wiz-name');
            input.focus();
            input.style.borderColor = 'var(--danger-color)';
            return;
        }
        
        state.step++;
        refreshUI();
    } else {
        createProfile();
    }
}

function handleBack() {
    if (state.step > 1) {
        state.step--;
        refreshUI();
    }
}

function refreshUI() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        renderWizard(overlay);
    }
}

/**
 * Create Profile and Finish
 */
async function createProfile() {
    const btn = document.getElementById('wizard-next');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        // Construct Profile Data
        const birthDate = `${state.data.birthYear}-01-01`;
        const retireYear = state.data.birthYear + state.data.retirementAge;
        const retireDate = `${retireYear}-01-01`;

        const profileData = {
            financial: {
                annual_income: state.data.annualIncome,
                annual_expenses: state.data.annualExpenses,
                tax_bracket_federal: 0.22, // Reasonable default
                tax_bracket_state: 0.05
            },
            assets: {
                taxable_accounts: [
                    {
                        name: "Initial Portfolio",
                        type: "brokerage",
                        value: state.data.portfolio,
                        institution: "Various"
                    }
                ],
                retirement_accounts: [],
                other_assets: []
            },
            priorities: state.data.priorities
        };

        const payload = {
            name: state.data.name,
            birth_date: birthDate,
            retirement_date: retireDate,
            data: profileData
        };

        const result = await profilesAPI.create(payload);

        // Set as current
        store.setState({ currentProfile: result.profile });
        
        // Close wizard
        const overlay = document.getElementById('onboarding-overlay');
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);

        showSuccess(`Profile "${state.data.name}" created!`);
        
        // Navigate to Dashboard
        if (window.app && window.app.showTab) {
            window.app.showTab('dashboard');
        }

    } catch (error) {
        console.error('Wizard error:', error);
        showError(`Failed to create profile: ${error.message}`);
        btn.disabled = false;
        btn.textContent = 'Create Profile';
    }
}
