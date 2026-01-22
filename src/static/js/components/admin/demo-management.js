/**
 * Demo Account Management Component
 * Allows admins to reset the demo account to a baseline state
 */

import { apiClient } from '../../api/client.js';
import { showError } from '../../utils/dom.js';

/**
 * Render demo management interface
 */
export async function renderDemoManagement(container) {
    container.innerHTML = `
        <div style="max-width: 800px;">
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--warning-color);">
                <h3 style="font-size: 16px; margin-bottom: 10px; color: var(--warning-color);">🎭 Demo Account Management</h3>
                <p style="color: var(--text-secondary); margin-bottom: 12px; font-size: 13px;">
                    Reset the demo account with multiple family templates. This will delete all existing demo profiles and recreate two comprehensive scenarios representing different wealth levels.
                </p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                    <div style="background: var(--warning-bg); padding: 10px; border-radius: 6px; border-left: 3px solid var(--warning-color);">
                        <div style="font-weight: 700; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">DEMO ACCOUNT DETAILS:</div>
                        <div style="font-size: 12px; font-family: monospace;">
                            <div>Username: <strong>demo</strong></div>
                            <div>Password: <strong>demo1234</strong></div>
                        </div>
                    </div>
                    <div style="background: var(--info-bg); padding: 10px; border-radius: 6px; border-left: 3px solid var(--accent-color);">
                        <div style="font-weight: 700; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">📋 INCLUDED PROFILES:</div>
                        <div style="font-size: 11px; line-height: 1.4; color: var(--text-secondary);">
                            <strong>1. Demo Thompson (Upper-Class)</strong>
                            <div style="margin-bottom: 4px;">$336K Income, $2.3M Portfolio, $1.85M SF Home, 2 College Kids.</div>
                            
                            <strong>2. Demo Starman (Middle-Class)</strong>
                            <div>$165K Income, $575K Portfolio, $450K Austin Home, 3 Kids (7-14).</div>
                        </div>
                    </div>
                </div>

                <button id="reset-demo-btn" style="padding: 10px 20px; background: var(--warning-color); color: #000; border: 2px solid #000; border-radius: 6px; cursor: pointer; font-weight: 800; font-size: 13px; box-shadow: 0 2px 4px var(--shadow);">
                    🔄 Reset Demo Account
                </button>
                <div id="reset-demo-result" style="margin-top: 15px; display: none;"></div>
            </div>
        </div>
    `;

    setupResetDemoButton(container);
}

/**
 * Setup reset demo account button
 */
function setupResetDemoButton(container) {
    const resetBtn = container.querySelector('#reset-demo-btn');
    const resultDiv = container.querySelector('#reset-demo-result');

    if (!resetBtn) return;

    resetBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset the demo account? This will delete all existing demo profiles and recreate both the Thompson and Starman templates.')) {
            return;
        }

        // Disable button and show loading
        resetBtn.disabled = true;
        resetBtn.textContent = '⏳ Resetting...';
        resultDiv.style.display = 'none';

        try {
            const response = await apiClient.post('/api/admin/reset-demo-account', {});

            // Show success message
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div style="padding: 15px; background: var(--success-bg); border: 1px solid var(--success-color); border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--success-color);">✅ Demo Account Reset Successfully</div>
                    <div style="font-size: 13px;">
                        <div>Username: <strong>${response.username}</strong></div>
                        <div>Password: <strong>${response.password}</strong></div>
                        <div>Profiles: <strong>${(response.profiles || []).join(', ')}</strong></div>
                    </div>
                </div>
            `;

            // Reset button
            resetBtn.disabled = false;
            resetBtn.textContent = '🔄 Reset Demo Account';

        } catch (error) {
            console.error('Failed to reset demo account:', error);

            // Show error message
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div style="padding: 15px; background: var(--danger-bg); border: 1px solid var(--danger-color); border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--danger-color);">❌ Reset Failed</div>
                    <div style="font-size: 13px;">${error.message || 'Unknown error occurred'}</div>
                </div>
            `;

            // Reset button
            resetBtn.disabled = false;
            resetBtn.textContent = '🔄 Reset Demo Account';
        }
    });
}
