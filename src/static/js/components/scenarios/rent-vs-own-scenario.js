/**
 * Rent vs. Own Scenario component.
 * Allows users to configure and run a rent vs. own analysis for their primary residence.
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { loadTemplate } from '../../utils/template-loader.js';
import { setupContextualHelp } from '../../utils/contextual-help.js';
import { validatePositiveNumber, clearFieldError, setFieldError } from '../../utils/validation.js';
import { apiClient } from '../../api/client.js';

export async function renderRentVsOwnScenario(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">🤔</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to run a Rent vs. Own scenario.
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

    const homeAsset = profile.data?.home_asset;

    if (!homeAsset) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">🏡</div>
                <h2 style="margin-bottom: var(--space-4);">No Home Asset Defined</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please define your primary residence in the "Home & Mortgage" tab before running this scenario.
                </p>
                <button id="go-to-home-tab-btn" style="padding: var(--space-3) var(--space-6); background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: var(--font-md);">
                    Go to Home & Mortgage
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-home-tab-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('home'));
        }, 0);
        return;
    }

    // Load template
    const template = await loadTemplate('/js/components/scenarios/rent-vs-own-scenario.html');
    container.innerHTML = template;

    // Dynamically load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/rent-vs-own-scenario.css';
    document.head.appendChild(link);

    // Populate form fields with current home asset defaults
    populateScenarioForm(container, homeAsset);

    // Initialize contextual help
    setupContextualHelp(container);

    // Setup event handlers
    setupScenarioFormHandlers(container, profile, homeAsset);
}

function populateScenarioForm(container, homeAsset) {
    // Scenario Name
    container.querySelector('#scenario_name').value = `Rent vs. Own - ${homeAsset.name || 'Primary Residence'} - ${new Date().toLocaleDateString()}`;

    // Owning Scenario Overrides
    container.querySelector('#own_purchase_price').value = homeAsset.purchase_price || homeAsset.current_value || '';
    container.querySelector('#own_down_payment_pct').value = (homeAsset.down_payment / (homeAsset.purchase_price || homeAsset.current_value) * 100).toFixed(0) || 20;
    container.querySelector('#own_mortgage_term_years').value = homeAsset.loan_term_years || 30;
    container.querySelector('#own_interest_rate_pct').value = (homeAsset.interest_rate * 100 || 4.5);
    container.querySelector('#own_property_tax_rate_pct').value = (homeAsset.property_tax_rate * 100 || 1.5);
    container.querySelector('#own_home_insurance_annual').value = homeAsset.home_insurance_annual || 1500;
    container.querySelector('#own_maintenance_annual_pct').value = (homeAsset.maintenance_annual_pct * 100 || 1);
    container.querySelector('#own_appreciation_annual_pct').value = (homeAsset.appreciation_annual_pct * 100 || 3);
    container.querySelector('#own_closing_costs_pct').value = 3; // Default 3% closing costs

    // Renting Scenario Overrides
    container.querySelector('#rent_initial_monthly_rent').value = homeAsset.initial_rent_pm || 2000;
    container.querySelector('#rent_annual_rent_increase_pct').value = (homeAsset.rent_increase_annual_pct * 100 || 3);

    // General Scenario Parameters
    container.querySelector('#time_horizon_years').value = 10;
    container.querySelector('#opportunity_cost_investment_return_pct').value = 7;
}

function setupScenarioFormHandlers(container, profile, homeAsset) {
    const form = container.querySelector('#rent-vs-own-form');
    const runScenarioBtn = container.querySelector('#run-scenario-btn');
    const resultsContainer = container.querySelector('#scenario-results');

    if (!form || !runScenarioBtn || !resultsContainer) {
        console.error('Scenario form elements not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Basic validation
        const fieldsToValidate = [
            'scenario_name', 'own_purchase_price', 'own_down_payment_pct',
            'own_mortgage_term_years', 'own_interest_rate_pct', 'own_property_tax_rate_pct',
            'own_home_insurance_annual', 'own_maintenance_annual_pct', 'own_appreciation_annual_pct',
            'own_closing_costs_pct', 'rent_initial_monthly_rent', 'rent_annual_rent_increase_pct',
            'time_horizon_years', 'opportunity_cost_investment_return_pct'
        ];
        let isValid = true;
        fieldsToValidate.forEach(fieldId => {
            const input = container.querySelector(`#${fieldId}`);
            if (input) {
                if (input.type === 'number') {
                    const maxVal = ['own_down_payment_pct', 'own_interest_rate_pct', 'own_property_tax_rate_pct',
                                    'own_maintenance_annual_pct', 'own_appreciation_annual_pct', 'own_closing_costs_pct',
                                    'rent_annual_rent_increase_pct', 'opportunity_cost_investment_return_pct'].includes(fieldId) ? 100 : Infinity;
                    if (!validatePositiveNumber(input, maxVal)) {
                        isValid = false;
                    } else {
                        clearFieldError(input);
                    }
                } else if (input.value.trim() === '') {
                    setFieldError(input, 'Required field');
                    isValid = false;
                } else {
                    clearFieldError(input);
                }
            }
        });

        if (!isValid) {
            showError('Please correct the highlighted errors before running the scenario.');
            return;
        }

        runScenarioBtn.disabled = true;
        runScenarioBtn.textContent = 'Running...';
        showSpinner('Running scenario analysis...');

        try {
            const formData = new FormData(form);
            const scenarioName = formData.get('scenario_name');

            const scenarioParameters = {
                type: 'rent_vs_own',
                name: scenarioName,
                base_home_asset_id: homeAsset.id,
                time_horizon_years: parseInt(formData.get('time_horizon_years')),
                opportunity_cost_investment_return_pct: parseFloat(formData.get('opportunity_cost_investment_return_pct')) / 100,
                own_scenario: {
                    purchase_price: parseFloat(formData.get('own_purchase_price')),
                    down_payment_pct: parseFloat(formData.get('own_down_payment_pct')) / 100,
                    mortgage_term_years: parseInt(formData.get('own_mortgage_term_years')),
                    interest_rate_pct: parseFloat(formData.get('own_interest_rate_pct')) / 100,
                    property_tax_rate_pct: parseFloat(formData.get('own_property_tax_rate_pct')) / 100,
                    home_insurance_annual: parseFloat(formData.get('own_home_insurance_annual')),
                    maintenance_annual_pct: parseFloat(formData.get('own_maintenance_annual_pct')) / 100,
                    appreciation_annual_pct: parseFloat(formData.get('own_appreciation_annual_pct')) / 100,
                    closing_costs_pct: parseFloat(formData.get('own_closing_costs_pct')) / 100
                },
                rent_scenario: {
                    initial_monthly_rent: parseFloat(formData.get('rent_initial_monthly_rent')),
                    annual_rent_increase_pct: parseFloat(formData.get('rent_annual_rent_increase_pct')) / 100
                }
            };

            const response = await apiClient.post('/api/home-ownership/scenario', {
                profile_name: profile.name,
                name: scenarioName,
                parameters: scenarioParameters
            });

            showSuccess('Scenario analyzed and saved successfully!');
            displayResults(resultsContainer, response.scenario.results);
            
        } catch (error) {
            console.error('Error running scenario:', error);
            showError(error.message || 'Failed to run scenario analysis.');
        } finally {
            hideSpinner();
            runScenarioBtn.disabled = false;
            runScenarioBtn.textContent = 'Run Scenario';
        }
    });

    // Handle existing scenarios
    async function loadExistingScenarios() {
        try {
            const response = await apiClient.get('/api/home-ownership/scenarios');
            const scenarios = response.scenarios;
            const select = container.querySelector('#existing_scenarios_select');
            select.innerHTML = '<option value="">Load Existing Scenario...</option>';
            scenarios.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                select.appendChild(option);
            });

            select.addEventListener('change', async (e) => {
                const scenarioId = e.target.value;
                if (scenarioId) {
                    showSpinner('Loading scenario...');
                    try {
                        const scenarioResponse = await apiClient.get(`/api/home-ownership/scenario/${scenarioId}`);
                        const loadedScenario = scenarioResponse.scenario;
                        
                        // Populate form with loaded scenario parameters
                        populateScenarioFormWithLoadedData(container, loadedScenario.parameters);
                        displayResults(resultsContainer, loadedScenario.results);
                        showSuccess('Scenario loaded successfully!');
                    } catch (error) {
                        console.error('Error loading scenario:', error);
                        showError(error.message || 'Failed to load scenario.');
                    } finally {
                        hideSpinner();
                    }
                }
            });
        } catch (error) {
            console.error('Error loading existing scenarios:', error);
            showError('Failed to load existing scenarios.');
        }
    }

    loadExistingScenarios();
}

function populateScenarioFormWithLoadedData(container, params) {
    container.querySelector('#scenario_name').value = params.name || '';

    // Owning Scenario Overrides
    container.querySelector('#own_purchase_price').value = params.own_scenario.purchase_price || '';
    container.querySelector('#own_down_payment_pct').value = (params.own_scenario.down_payment_pct * 100) || '';
    container.querySelector('#own_mortgage_term_years').value = params.own_scenario.mortgage_term_years || '';
    container.querySelector('#own_interest_rate_pct').value = (params.own_scenario.interest_rate_pct * 100) || '';
    container.querySelector('#own_property_tax_rate_pct').value = (params.own_scenario.property_tax_rate_pct * 100) || '';
    container.querySelector('#own_home_insurance_annual').value = params.own_scenario.home_insurance_annual || '';
    container.querySelector('#own_maintenance_annual_pct').value = (params.own_scenario.maintenance_annual_pct * 100) || '';
    container.querySelector('#own_appreciation_annual_pct').value = (params.own_scenario.appreciation_annual_pct * 100) || '';
    container.querySelector('#own_closing_costs_pct').value = (params.own_scenario.closing_costs_pct * 100) || '';

    // Renting Scenario Overrides
    container.querySelector('#rent_initial_monthly_rent').value = params.rent_scenario.initial_monthly_rent || '';
    container.querySelector('#rent_annual_rent_increase_pct').value = (params.rent_scenario.annual_rent_increase_pct * 100) || '';

    // General Scenario Parameters
    container.querySelector('#time_horizon_years').value = params.time_horizon_years || '';
    container.querySelector('#opportunity_cost_investment_return_pct').value = (params.opportunity_cost_investment_return_pct * 100) || '';
}


function displayResults(container, results) {
    // Clear previous results
    container.innerHTML = '';
    
    if (!results || !results.summary) {
        container.innerHTML = '<p class="error-message">No results to display.</p>';
        return;
    }

    const { own_scenario, rent_scenario, summary } = results;

    container.innerHTML = `
        <div class="scenario-results-section">
            <h3 class="form-section-title">Analysis Summary (${summary.time_horizon_years} Years)</h3>
            <div class="summary-cards-grid">
                <div class="summary-card ${summary.net_worth_difference > 0 ? 'positive' : 'negative'}">
                    <h4>Net Worth Difference</h4>
                    <p class="summary-value">${formatCurrency(summary.net_worth_difference)}</p>
                    <p class="summary-label">Own vs. Rent</p>
                </div>
                <div class="summary-card">
                    <h4>Recommendation</h4>
                    <p class="summary-value">${summary.recommendation}</p>
                    <p class="summary-label">Based on Net Worth</p>
                </div>
                <!-- Add more summary cards as needed -->
            </div>

            <div class="results-comparison-grid">
                <div class="own-results">
                    <h4 class="form-section-title" style="color: var(--success-color);">Owning Scenario</h4>
                    <ul>
                        <li><strong>Initial Cash Outlay:</strong> ${formatCurrency(own_scenario.initial_cash_outlay)}</li>
                        <li><strong>Total Costs (${summary.time_horizon_years} Yrs):</strong> ${formatCurrency(own_scenario.total_costs)}</li>
                        <li><strong>Ending Home Value:</strong> ${formatCurrency(own_scenario.ending_home_value)}</li>
                        <li><strong>Ending Equity:</strong> ${formatCurrency(own_scenario.ending_equity)}</li>
                        <li><strong>Net Worth Contribution:</strong> ${formatCurrency(own_scenario.net_worth_contribution)}</li>
                        <li><strong>Total Interest Paid:</strong> ${formatCurrency(own_scenario.total_interest_paid)}</li>
                    </ul>
                </div>
                <div class="rent-results">
                    <h4 class="form-section-title" style="color: var(--info-color);">Renting Scenario</h4>
                    <ul>
                        <li><strong>Initial Monthly Rent:</strong> ${formatCurrency(rent_scenario.initial_monthly_rent)}</li>
                        <li><strong>Total Costs (${summary.time_horizon_years} Yrs):</strong> ${formatCurrency(rent_scenario.total_costs)}</li>
                        <li><strong>Opportunity Investment Gain:</strong> ${formatCurrency(rent_scenario.opportunity_investment_gain)}</li>
                        <li><strong>Net Worth Contribution:</strong> ${formatCurrency(rent_scenario.net_worth_contribution)}</li>
                    </ul>
                </div>
            </div>
            <!-- Add a Chart.js chart here later for visual comparison -->
        </div>
    `;
}

// Re-import formatCurrency from utils to use here
import { formatCurrency } from '../../utils/formatters.js';

