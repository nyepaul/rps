/**
 * Dashboard tab component
 */

import { store } from '../../state/store.js';
import { scenariosAPI } from '../../api/scenarios.js';
import { profilesAPI } from '../../api/profiles.js';
import { formatCurrency, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';
import { renderStandardTimelineChart } from '../../utils/charts.js';

export function renderDashboardTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">📊</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to view your dashboard.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};

    // Calculate totals from actual asset data
    const sumAssets = (arr) => (arr || []).reduce((sum, a) => sum + (a.value || a.current_value || 0), 0);
    const liquidAssets = sumAssets(assets.taxable_accounts);
    const retirementAssets = sumAssets(assets.retirement_accounts);
    const realEstateAssets = sumAssets(assets.real_estate);
    const totalAssets = liquidAssets + retirementAssets + realEstateAssets + sumAssets(assets.other_assets);

    // Calculate ages from dates
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = calcAge(profile.birth_date);
    const retirementAge = profile.retirement_date ? calcAge(profile.birth_date) + Math.round((new Date(profile.retirement_date) - new Date()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <h1 style="font-size: 36px; margin-bottom: 10px;">Dashboard</h1>
            <p style="color: var(--text-secondary); margin-bottom: 30px;">
                Profile: <strong>${profile.name}</strong>
            </p>

            <!-- Quick Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px;">
                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Liquid Assets</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--success-color);">
                        ${liquidAssets > 0 ? formatCompact(liquidAssets) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Retirement Assets</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--info-color);">
                        ${retirementAssets > 0 ? formatCompact(retirementAssets) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Annual Income</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--accent-color);">
                        ${financial.annual_income ? formatCompact(financial.annual_income) : 'Not set'}
                    </div>
                </div>

                <div class="stat-card">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Annual Expenses</div>
                    <div style="font-size: 32px; font-weight: bold; color: var(--warning-color);">
                        ${financial.annual_expenses ? formatCompact(financial.annual_expenses) : 'Not set'}
                    </div>
                </div>
            </div>

            <!-- Profile Summary -->
            <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Profile Summary</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Current Age</div>
                        <div style="font-size: 20px; font-weight: 600;">${currentAge || 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Retirement Date</div>
                        <div style="font-size: 20px; font-weight: 600;">${profile.retirement_date ? new Date(profile.retirement_date).toLocaleDateString() : 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Total Assets</div>
                        <div style="font-size: 20px; font-weight: 600;">${totalAssets > 0 ? formatCompact(totalAssets) : 'Not set'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); margin-bottom: 5px;">Social Security</div>
                        <div style="font-size: 20px; font-weight: 600;">${financial.social_security_benefit ? formatCurrency(financial.social_security_benefit) + '/mo' : 'Not set'}</div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Quick Actions</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <button onclick="window.app.showTab('profile')" class="action-btn">
                        ✏️ Edit Profile
                    </button>
                    <button onclick="window.app.showTab('analysis')" class="action-btn">
                        📊 Run Analysis
                    </button>
                    <button onclick="window.app.showTab('comparison')" class="action-btn">
                        🔄 Compare Scenarios
                    </button>
                    <button onclick="window.app.showTab('actions')" class="action-btn">
                        ✅ View Action Items
                    </button>
                </div>
            </div>

            <!-- Saved Scenarios -->
            <div id="scenario-analysis-section" style="background: var(--bg-secondary); padding: 25px; border-radius: 12px;">
                <h2 style="font-size: 24px; margin-bottom: 20px;">Saved Scenarios</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Select a scenario to view its projection and restore its data to your profile.
                </p>
                
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px;">
                    <select id="scenario-selector" style="flex: 1; padding: 12px; border-radius: 8px; border: 2px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 16px;">
                        <option value="">Loading scenarios...</option>
                    </select>
                </div>

                <div id="scenario-chart-container" style="display: none; background: var(--bg-primary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); margin-top: 20px;">
                    <h3 id="chart-title" style="margin-top: 0; margin-bottom: 15px; font-size: 18px;"></h3>
                    <div id="chart-loading" style="display: none; text-align: center; padding: 40px; color: var(--text-secondary);">
                        <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
                        Loading projection...
                    </div>
                    <canvas id="scenario-chart" style="max-height: 400px;"></canvas>
                </div>
            </div>
        </div>

        <style>
            .stat-card {
                background: var(--bg-secondary);
                padding: 20px;
                border-radius: 12px;
                border: 1px solid var(--border-color);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow);
            }
            .action-btn {
                padding: 15px;
                background: var(--accent-color);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
            }
            .action-btn:hover {
                background: var(--accent-hover);
                transform: translateY(-2px);
            }
            
            /* Modal Styles */
            .custom-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s;
            }
            .custom-modal {
                background: var(--bg-secondary);
                padding: 30px;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                animation: slideUp 0.3s;
            }
            .modal-title {
                font-size: 24px;
                margin-bottom: 15px;
                color: var(--text-primary);
            }
            .modal-body {
                margin-bottom: 25px;
                color: var(--text-secondary);
                line-height: 1.6;
            }
            .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 15px;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>
    `;
    loadAndRenderScenarios(profile);
}

let dashboardChartInstances = {};

function renderScenarioGraph(scenario) {
    const container = document.getElementById('scenario-chart-container');
    const canvas = document.getElementById('scenario-chart');
    const title = document.getElementById('chart-title');
    const loader = document.getElementById('chart-loading');
    
    if (!container || !canvas) return;

    // Hide loader
    if (loader) loader.style.display = 'none';
    canvas.style.display = 'block';

    if (!scenario) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (title) title.textContent = `Projection: ${scenario.name}`;

    // Extract timeline from scenario result
    const results = scenario.results || {};
    const isMultiScenario = results.scenarios && Object.keys(results.scenarios).length > 0;
    
    let timeline = null;
    if (isMultiScenario) {
        // Use moderate scenario for dashboard preview
        const subScenario = results.scenarios.moderate || Object.values(results.scenarios)[0];
        timeline = subScenario.timeline;
    } else {
        timeline = results.timeline;
    }

    if (!timeline) {
        console.warn('No timeline data for scenario preview');
        canvas.style.display = 'none';
        loader.style.display = 'block';
        loader.textContent = 'No timeline data available';
        return;
    }

    renderStandardTimelineChart(timeline, 'scenario-chart', dashboardChartInstances);
}

async function loadAndRenderScenarios(currentProfile) {
    const selector = document.getElementById('scenario-selector');
    const chartContainer = document.getElementById('scenario-chart-container');
    const chartLoader = document.getElementById('chart-loading');
    const chartCanvas = document.getElementById('scenario-chart');
    
    if (!selector) return;

    try {
        const response = await scenariosAPI.list();
        const scenarios = response.scenarios || [];
        
        if (scenarios.length === 0) {
            selector.innerHTML = '<option value="" disabled selected>No saved scenarios found. Run an analysis to save one.</option>';
            selector.disabled = true;
            return;
        }

        // Clear and populate
        selector.innerHTML = '<option value="" selected>Select a scenario to load...</option>';
        scenarios.forEach(scenario => {
            const option = document.createElement('option');
            option.value = scenario.id;
            option.textContent = scenario.name + (scenario.profile_name ? ` (${scenario.profile_name})` : '');
            selector.appendChild(option);
        });

        // Event Listeners
        selector.addEventListener('change', async () => {
            const scenarioId = selector.value;
            const hasSelection = !!scenarioId;
            
            if (!hasSelection) {
                chartContainer.style.display = 'none';
                return;
            }

            // 1. Auto-load graph preview
            chartContainer.style.display = 'block';
            if (chartLoader) chartLoader.style.display = 'block';
            if (chartCanvas) chartCanvas.style.display = 'none';
            document.getElementById('chart-title').textContent = 'Loading projection...';

            try {
                const res = await scenariosAPI.get(scenarioId);
                const scenario = res.scenario;
                renderScenarioGraph(scenario);

                // 2. Trigger loading confirmation after a brief moment so they see the graph
                setTimeout(() => {
                    confirmLoadScenario(scenarioId, scenario.name, currentProfile);
                }, 500);

            } catch (err) {
                console.error(err);
                if (chartLoader) chartLoader.style.display = 'none';
                showError('Failed to load scenario details');
                chartContainer.style.display = 'none';
            }
        });

    } catch (error) {
        console.error('Error fetching scenarios:', error);
        selector.innerHTML = '<option value="">Error loading scenarios</option>';
    }
}

function confirmLoadScenario(scenarioId, scenarioName, currentProfile) {
    // Create Modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal-overlay';
    
    modalOverlay.innerHTML = `
        <div class="custom-modal">
            <h3 class="modal-title">Load Scenario?</h3>
            <div class="modal-body">
                <p>You are about to load <strong>"${scenarioName}"</strong>.</p>
                <p style="color: var(--warning-color); background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 8px; border: 1px solid var(--warning-color);">
                    <strong>⚠️ Warning:</strong> This will overwrite your current profile data (assets, expenses, settings) with the data saved in this scenario. This action cannot be undone.
                </p>
                <p>Are you sure you want to proceed?</p>
            </div>
            <div class="modal-actions">
                <button id="cancel-load" style="padding: 10px 20px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="confirm-load" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Load & Overwrite</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    const cancelBtn = modalOverlay.querySelector('#cancel-load');
    const confirmBtn = modalOverlay.querySelector('#confirm-load');
    
    cancelBtn.onclick = () => modalOverlay.remove();
    
    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Loading...';
        
        try {
            await executeLoadScenario(scenarioId, currentProfile);
            modalOverlay.remove();
        } catch (error) {
            modalOverlay.remove(); // Remove modal to show error toast
            showError(`Failed to load scenario: ${error.message}`);
        }
    };
}

async function executeLoadScenario(scenarioId, currentProfile) {
    // showLoading(document.body, 'Restoring scenario data...'); // Removed to prevent wiping body on error
    
    try {
        // 1. Fetch scenario details
        const res = await scenariosAPI.get(scenarioId);
        const scenario = res.scenario;
        
        if (!scenario || !scenario.parameters) {
            throw new Error('Scenario data is invalid or missing parameters.');
        }

        const snapshot = scenario.parameters.profile_snapshot;
        
        if (!snapshot) {
            throw new Error('This scenario does not contain a profile snapshot to restore.');
        }

        // 2. Restore Profile Data
        console.log('Restoring profile data...', snapshot);
        await profilesAPI.update(currentProfile.name, { data: snapshot });
        
        // 3. Update active profile in store
        // We fetch the updated profile to be sure we have the latest server state
        const profileRes = await profilesAPI.get(currentProfile.name);
        store.set('currentProfile', profileRes.profile);
        
        // 4. Restore Simulation Settings if present
        if (scenario.parameters.simulations) {
            localStorage.setItem('rps_simulations', scenario.parameters.simulations);
        }

        // 5. Success & Redirect
        // Remove the loading overlay we added to body
        const loader = document.querySelector('.loading-overlay'); // Assuming showLoading adds this class or similar structure, wait showLoading replaces content of container.
        // Actually showLoading(document.body) replaces body content! That's dangerous if showLoading implementation is aggressive.
        // Let's check showLoading implementation in dom.js again.
        
        // showLoading uses container.innerHTML = ...
        // If I used document.body, I just wiped the app.
        // GOOD CATCH. I should not use showLoading(document.body).
        
        // Instead, I should have a global loader or just reload the app.
        // Since I wiped the body (if I did), I must reload.
        
        window.location.reload(); 
        
    } catch (error) {
        console.error(error);
        // If we wiped body, we are in trouble. 
        // But wait, I haven't executed this yet.
        throw error; 
    }
}
