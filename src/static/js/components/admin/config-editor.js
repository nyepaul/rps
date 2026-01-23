/**
 * Audit Configuration Editor Component
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render configuration editor
 */
export async function renderConfigEditor(container) {
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="
                width: 32px;
                height: 32px;
                border: 3px solid var(--border-color);
                border-top-color: var(--accent-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 10px;
            "></div>
            <div>Loading configuration...</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    try {
        const response = await apiClient.get('/api/admin/config');
        const config = response.config;

        container.innerHTML = `
            <div style="max-width: 900px;">
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 20px;">⚙️ Audit Logging Configuration</h3>

                    <!-- Master Switch -->
                    <div style="padding: 15px; background: var(--bg-primary); border-radius: 8px; margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Enable Audit Logging</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Master switch for all audit logging</div>
                            </div>
                            <input type="checkbox" id="config-enabled" ${config.enabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                        </label>
                    </div>

                    <!-- Collection Settings -->
                    <div style="margin-bottom: 25px;">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text-primary);">📊 Data Collection</h4>
                        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 15px;">
                            Configure what data to collect when logging audit events. Collected data is encrypted at rest.
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
                            ${renderCheckboxGroup('collect', config.collect, [
                                ['ip_address', 'IP Address', 'Client IP address'],
                                ['user_agent', 'User Agent', 'Browser and device info'],
                                ['geo_location', 'Geo Location', 'Country, region, city'],
                                ['request_method', 'Request Method', 'HTTP method (GET, POST, etc)'],
                                ['request_endpoint', 'Request Endpoint', 'API endpoint path'],
                                ['request_body_size', 'Request Size', 'Size of request body'],
                                ['response_status', 'Response Status', 'HTTP status code'],
                                ['session_id', 'Session ID', 'User session identifier'],
                                ['referrer', 'Referrer', 'Page that referred the request'],
                                ['device_info', 'Device Info', 'Detailed device information'],
                                ['request_headers', 'Request Headers', '⚠️ May contain sensitive data']
                            ])}
                        </div>
                    </div>

                    <!-- Display Settings -->
                    <div style="margin-bottom: 25px;">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text-primary);">👁️ Data Display</h4>
                        <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 15px;">
                            Configure what data to display in the admin logs viewer. Data is still collected and stored.
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
                            ${renderCheckboxGroup('display', config.display, [
                                ['ip_address', 'IP Address', 'Show IP addresses'],
                                ['user_agent', 'User Agent', 'Show user agent strings'],
                                ['geo_location', 'Geo Location', 'Show geographic info'],
                                ['request_method', 'Request Method', 'Show HTTP methods'],
                                ['request_endpoint', 'Request Endpoint', 'Show API paths'],
                                ['request_body_size', 'Request Size', 'Show request sizes'],
                                ['response_status', 'Response Status', 'Show HTTP status codes'],
                                ['session_id', 'Session ID', '⚠️ Privacy: hide by default'],
                                ['referrer', 'Referrer', 'Show referrer URLs'],
                                ['device_info', 'Device Info', 'Show device information'],
                                ['request_headers', 'Request Headers', '⚠️ May contain sensitive data']
                            ])}
                        </div>
                    </div>

                    <!-- Additional Settings -->
                    <div style="margin-bottom: 25px;">
                        <h4 style="font-size: 16px; margin-bottom: 15px; color: var(--text-primary);">🔧 Additional Settings</h4>
                        <div style="display: grid; gap: 15px;">
                            <div style="padding: 15px; background: var(--bg-primary); border-radius: 8px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Retention Period (days)</label>
                                <input type="number" id="config-retention-days" value="${config.retention_days}" min="1" max="3650" style="width: 200px; padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 5px;">How long to keep audit logs (1-3650 days)</div>
                            </div>
                            <div style="padding: 15px; background: var(--bg-primary); border-radius: 8px;">
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                    <input type="checkbox" id="config-log-read-ops" ${config.log_read_operations ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                                    <div>
                                        <div style="font-weight: 600;">Log READ Operations</div>
                                        <div style="font-size: 11px; color: var(--text-secondary);">⚠️ Warning: Can generate very large log volumes</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Save Button -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
                        <button id="save-config-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            💾 Save Configuration
                        </button>
                        <span id="save-status" style="margin-left: 15px; font-size: 13px;"></span>
                    </div>
                </div>

                <!-- Info Box -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px;">🔒 Privacy & Security Notes</h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.7;">
                        <li>All collected data is encrypted at rest using AES-256-GCM</li>
                        <li>Request headers and session IDs are disabled by default for privacy</li>
                        <li>IP addresses are anonymized in reports (last octet masked)</li>
                        <li>Geo-location data is approximate (city-level, not precise GPS)</li>
                        <li>Log READ operations only for debugging - can fill disk quickly</li>
                    </ul>
                </div>
            </div>
        `;

        // Setup save handler
        container.querySelector('#save-config-btn').addEventListener('click', async () => {
            await saveConfiguration(container);
        });

    } catch (error) {
        console.error('Failed to load configuration:', error);
        showError(`Failed to load configuration: ${error.message}`);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--danger-color);">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <div>Failed to load configuration</div>
                <div style="font-size: 13px; margin-top: 10px;">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Render checkbox group
 */
function renderCheckboxGroup(groupName, config, items) {
    return items.map(([key, label, description]) => {
        const isChecked = config[key];
        return `
            <div style="padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid ${isChecked ? 'var(--accent-color)' : 'var(--border-color)'};">
                <label style="display: flex; align-items: start; gap: 10px; cursor: pointer;">
                    <input type="checkbox" class="config-${groupName}" data-key="${key}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 2px; cursor: pointer; flex-shrink: 0;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">${label}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${description}</div>
                    </div>
                </label>
            </div>
        `;
    }).join('');
}

/**
 * Save configuration
 */
async function saveConfiguration(container) {
    const statusElement = container.querySelector('#save-status');
    statusElement.textContent = '💾 Saving...';
    statusElement.style.color = 'var(--text-secondary)';

    try {
        // Collect configuration
        const config = {
            enabled: container.querySelector('#config-enabled').checked,
            retention_days: parseInt(container.querySelector('#config-retention-days').value),
            log_read_operations: container.querySelector('#config-log-read-ops').checked,
            collect: {},
            display: {}
        };

        // Collect checkboxes
        container.querySelectorAll('.config-collect').forEach(checkbox => {
            config.collect[checkbox.getAttribute('data-key')] = checkbox.checked;
        });

        container.querySelectorAll('.config-display').forEach(checkbox => {
            config.display[checkbox.getAttribute('data-key')] = checkbox.checked;
        });

        // Save to API
        await apiClient.put('/api/admin/config', config);

        statusElement.textContent = '✅ Saved successfully';
        statusElement.style.color = 'var(--success-color)';
        showSuccess('Configuration saved successfully');

        // Clear success message after 3 seconds
        setTimeout(() => {
            statusElement.textContent = '';
        }, 3000);

    } catch (error) {
        console.error('Failed to save configuration:', error);
        statusElement.textContent = `❌ Save failed: ${error.message}`;
        statusElement.style.color = 'var(--danger-color)';
        showError(`Failed to save configuration: ${error.message}`);
    }
}
