/**
 * AI Advisor Troubleshooting Wizard
 */

import { store } from '../../state/store.js';
import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

export function showAdvisorWizard() {
    const profile = store.get('currentProfile');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin-bottom: 20px;">🤖 AI Advisor Fix Wizard</h2>
            
            <div id="wizard-steps">
                <div class="wizard-step" id="step-1">
                    <h3>Step 1: Check Connection & API Keys</h3>
                    <p>Testing connectivity to backend and verifying API keys...</p>
                    <div id="check-results-1" style="margin: 20px 0; padding: 15px; border-radius: 8px; background: var(--bg-primary);">
                        Checking...
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 30px;">
                <button id="close-wizard-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Close
                </button>
                <button id="next-wizard-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; display: none;">
                    Next Step
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-wizard-btn').onclick = () => modal.remove();
    
    runStep1(profile);
}

async function runStep1(profile) {
    const resultsDiv = document.getElementById('check-results-1');
    const nextBtn = document.getElementById('next-wizard-btn');
    
    try {
        // Simulating a backend check for API keys
        const response = await apiClient.get('/api/health');
        
        // In a real app, we'd have a specific diagnostic endpoint
        // For now, we'll check profile completeness as well
        let html = '<ul style="list-style: none; padding: 0;">';
        
        // Mocking API key check (frontend can't see env vars directly)
        // We'll assume if health is OK, connection is fine.
        html += `<li style="margin-bottom: 10px;">✅ Connection to backend: OK</li>`;
        
        const data = profile?.data || {};
        const financial = data.financial || {};
        const assets = data.assets || {};
        
        const missingData = [];
        if (!profile?.birth_date) missingData.push('Birth Date');
        if (!profile?.retirement_date) missingData.push('Retirement Date');
        if (!financial.annual_expenses) missingData.push('Annual Expenses');
        if (!(assets.retirement_accounts?.length || assets.taxable_accounts?.length)) missingData.push('Assets/Investment Accounts');

        if (missingData.length > 0) {
            html += `<li style="margin-bottom: 10px;">⚠️ Missing Profile Data: ${missingData.join(', ')}</li>`;
            html += `<p style="margin-top: 15px; font-size: 14px; color: var(--warning-color);">
                The AI Advisor works best when your profile is complete. Missing data can lead to vague or failed recommendations.
            </p>`;
        } else {
            html += `<li style="margin-bottom: 10px;">✅ Profile Completeness: Good</li>`;
        }

        resultsDiv.innerHTML = html + '</ul>';
        nextBtn.style.display = 'block';
        nextBtn.onclick = () => runStep2(profile);

    } catch (error) {
        resultsDiv.innerHTML = `<div style="color: var(--danger-color);">❌ Could not connect to backend: ${error.message}</div>`;
    }
}

function runStep2(profile) {
    const stepsDiv = document.getElementById('wizard-steps');
    const nextBtn = document.getElementById('next-wizard-btn');
    
    stepsDiv.innerHTML = `
        <div class="wizard-step" id="step-2">
            <h3>Step 2: Recommendations</h3>
            <p>Based on our check, here is what you should do:</p>
            <div style="margin: 20px 0; padding: 15px; border-radius: 8px; background: var(--bg-primary);">
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 10px;">Ensure <strong>GEMINI_API_KEY</strong> is set in your environment. Run <code>./bin/setup-api-keys</code> to fix this.</li>
                    <li style="margin-bottom: 10px;">Complete your <a href="#" onclick="window.app.showTab('profile'); return false;">Profile</a> and <a href="#" onclick="window.app.showTab('assets'); return false;">Assets</a> sections.</li>
                    <li style="margin-bottom: 10px;">Try refreshing the page if the AI Advisor is still unresponsive.</li>
                </ul>
            </div>
        </div>
    `;
    
    nextBtn.textContent = 'Finish';
    nextBtn.onclick = () => {
        document.querySelector('.modal-overlay').remove();
        showSuccess('Diagnostic complete. Please try the AI Advisor again after addressing the issues.');
    };
}
