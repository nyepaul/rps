/**
 * System Information Component
 */

import { apiClient } from '../../api/client.js';
import { showError } from '../../utils/dom.js';

/**
 * Render system information dashboard
 */
export async function renderSystemInfo(container) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
            <div>Loading system information...</div>
        </div>
    `;

    try {
        const response = await apiClient.get('/api/admin/system/info');
        const info = response.system_info;

        container.innerHTML = `
            <div style="max-width: 1000px;">
                <!-- System Stats Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Users</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_users.toLocaleString()}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 25px; border-radius: 12px; color: white;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Profiles</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_profiles.toLocaleString()}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 12px; color: white;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Scenarios</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_scenarios.toLocaleString()}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 25px; border-radius: 12px; color: white;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Audit Logs</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_audit_logs.toLocaleString()}</div>
                    </div>
                </div>

                <!-- System Details -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 20px;">🖥️ System Information</h3>
                    <div style="display: grid; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                            <span style="color: var(--text-secondary);">App Version</span>
                            <span style="font-weight: 600; font-family: monospace;">v${info.app_version || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                            <span style="color: var(--text-secondary);">Release Date</span>
                            <span style="font-weight: 600;">${info.release_date || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                            <span style="color: var(--text-secondary);">Database Size</span>
                            <span style="font-weight: 600;">${info.database_size_mb || 'N/A'} MB</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                            <span style="color: var(--text-secondary);">Python Version</span>
                            <span style="font-weight: 600; font-family: monospace;">${info.python_version?.split(' ')[0] || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
                            <span style="color: var(--text-secondary);">Platform</span>
                            <span style="font-weight: 600;">${info.system_platform || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Security Features -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 20px;">🔒 Security Features</h3>
                    <div style="display: grid; gap: 10px;">
                        ${renderSecurityFeature('Encryption at Rest', 'AES-256-GCM', 'All profile data encrypted')}
                        ${renderSecurityFeature('Password Hashing', 'bcrypt', 'Adaptive cost factor')}
                        ${renderSecurityFeature('Session Security', 'HttpOnly Cookies', 'Server-side sessions')}
                        ${renderSecurityFeature('CSRF Protection', 'Enabled', 'Token validation on all state-changing requests')}
                        ${renderSecurityFeature('Rate Limiting', 'Enabled', 'Protection against brute force')}
                        ${renderSecurityFeature('Audit Logging', 'Enhanced', 'Comprehensive activity tracking')}
                    </div>
                </div>

                <!-- Demo Account Management -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 2px solid var(--warning-color);">
                    <h3 style="font-size: 18px; margin-bottom: 15px;">🎭 Demo Account Management</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 14px;">
                        Reset the demo account with comprehensive upper-class family profile data. This will delete all existing demo profiles and create a new default profile.
                    </p>
                    <div style="background: var(--warning-bg); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--warning-color);">
                        <div style="font-weight: 600; margin-bottom: 8px;">Demo Account Details:</div>
                        <div style="font-size: 13px; font-family: monospace;">
                            <div>Username: <strong>demo</strong></div>
                            <div>Password: <strong>demo123</strong></div>
                        </div>
                    </div>
                    <div style="background: var(--info-bg); padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 13px;">
                        <strong>📋 Profile includes:</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            <li>Upper-class couple ($280K/year combined income)</li>
                            <li>Two children in college (ages 19 and 21)</li>
                            <li>$2.3M investment portfolio (401k, Roth, Brokerage)</li>
                            <li>$1.85M primary residence in San Francisco</li>
                            <li>Comprehensive budget with typical expenses</li>
                            <li>529 college funds for both children</li>
                        </ul>
                    </div>
                    <button id="reset-demo-btn" style="padding: 12px 24px; background: var(--warning-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">
                        🔄 Reset Demo Account
                    </button>
                    <div id="reset-demo-result" style="margin-top: 15px; display: none;"></div>
                </div>

                <!-- Documentation Links -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px;">📚 Documentation</h3>
                    <div style="display: grid; gap: 10px;">
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 System Security Documentation</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Complete security architecture and encryption details</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/system-security" target="_blank" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/system-security?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 User & Profile Relationship Guide</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Data hierarchy and secure segregation</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/user-profile-relationship" target="_blank" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/user-profile-relationship?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 Asset Fields Reference</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Complete asset type and field documentation</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/asset-fields" target="_blank" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/asset-fields?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup reset demo button
        setupResetDemoButton(container);

    } catch (error) {
        console.error('Failed to load system info:', error);
        showError(`Failed to load system info: ${error.message}`);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--danger-color);">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <div>Failed to load system information</div>
            </div>
        `;
    }
}

/**
 * Setup reset demo account button
 */
function setupResetDemoButton(container) {
    const resetBtn = container.querySelector('#reset-demo-btn');
    const resultDiv = container.querySelector('#reset-demo-result');

    if (!resetBtn) return;

    resetBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset the demo account? This will delete all existing demo profiles and create a new default profile with comprehensive data.')) {
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
                        <div>Profile: <strong>${response.profile_name}</strong></div>
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


/**
 * Render security feature item
 */
function renderSecurityFeature(name, value, description) {
    return `
        <div style="display: flex; align-items: start; padding: 12px; background: var(--bg-primary); border-radius: 8px; gap: 12px;">
            <div style="font-size: 20px;">✅</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 3px;">${name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    <span style="color: var(--accent-color); font-weight: 600;">${value}</span> - ${description}
                </div>
            </div>
        </div>
    `;
}
