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

                <!-- Documentation Links -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px;">📚 Documentation</h3>
                    <div style="display: grid; gap: 10px;">
                        <a href="#" onclick="alert('Open SYSTEM_SECURITY_DOCUMENTATION.md'); return false;" style="display: block; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; color: white; text-decoration: none; transition: all 0.2s;">
                            <div style="font-weight: 600; margin-bottom: 3px;">System Security Documentation</div>
                            <div style="font-size: 12px; opacity: 0.9;">Complete security architecture and encryption details</div>
                        </a>
                        <a href="#" onclick="alert('Open USER_PROFILE_SCENARIO_RELATIONSHIP.md'); return false;" style="display: block; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; color: white; text-decoration: none; transition: all 0.2s;">
                            <div style="font-weight: 600; margin-bottom: 3px;">User & Profile Relationship Guide</div>
                            <div style="font-size: 12px; opacity: 0.9;">Data hierarchy and secure segregation</div>
                        </a>
                        <a href="#" onclick="alert('Open ASSET_FIELDS_REFERENCE.md'); return false;" style="display: block; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; color: white; text-decoration: none; transition: all 0.2s;">
                            <div style="font-weight: 600; margin-bottom: 3px;">Asset Fields Reference</div>
                            <div style="font-size: 12px; opacity: 0.9;">Complete asset type and field documentation</div>
                        </a>
                    </div>
                </div>
            </div>
        `;

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
