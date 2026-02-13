/**
 * System Information Component
 */

import { apiClient } from '../../api/client.js';
import { showError, escapeHtml } from '../../utils/dom.js';

/**
 * Render system information dashboard
 */
export async function renderSystemInfo(container) {
    try {
        // Load both system info and database schema
        const [infoResponse, schemaResponse] = await Promise.all([
            apiClient.get('/api/admin/system/info'),
            apiClient.get('/api/admin/database/schema')
        ]);

        const info = infoResponse.system_info;
        const schema = schemaResponse.schema;

        container.innerHTML = `
            <div style="max-width: 1000px;">
                <!-- System Stats Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 0;">
                    <div class="stat-card" data-stat="users" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Users</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_users.toLocaleString()}</div>
                        <div style="position: absolute; bottom: 8px; right: 12px; font-size: 10px; opacity: 0.6;">click for details</div>
                    </div>
                    <div class="stat-card" data-stat="profiles" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 25px; border-radius: 12px; color: white; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Profiles</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_profiles.toLocaleString()}</div>
                        <div style="position: absolute; bottom: 8px; right: 12px; font-size: 10px; opacity: 0.6;">click for details</div>
                    </div>
                    <div class="stat-card" data-stat="scenarios" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 25px; border-radius: 12px; color: white; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Total Scenarios</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_scenarios.toLocaleString()}</div>
                        <div style="position: absolute; bottom: 8px; right: 12px; font-size: 10px; opacity: 0.6;">click for details</div>
                    </div>
                    <div class="stat-card" data-stat="logs" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 25px; border-radius: 12px; color: white; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Audit Logs</div>
                        <div style="font-size: 36px; font-weight: 700;">${info.total_audit_logs.toLocaleString()}</div>
                        <div style="position: absolute; bottom: 8px; right: 12px; font-size: 10px; opacity: 0.6;">click for details</div>
                    </div>
                </div>

                <!-- Stats Detail Panel (inserted by click handlers) -->
                <div id="stats-detail-panel" style="margin-bottom: 30px;"></div>

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

                <!-- Database Schema Viewer -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 15px;">🗄️ Database Schema</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 15px; font-size: 14px;">
                        Interactive entity-relationship diagram showing all database tables and their relationships. Click to open in full view.
                    </p>
                    <div id="schema-diagram-preview" style="background: var(--bg-primary); padding: 15px; border-radius: 8px; overflow: hidden; cursor: pointer; position: relative;">
                        <div id="schema-diagram" style="min-height: 400px; max-height: 600px; overflow: hidden;"></div>
                        <div style="position: absolute; bottom: 15px; right: 15px; background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none;">
                            🔍 Click to expand
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding: 12px; background: var(--info-bg); border-radius: 8px; font-size: 13px;">
                        <strong>📊 Schema Stats:</strong>
                        <span style="margin-left: 10px;">Tables: <strong>${schema.tables.length}</strong></span>
                        <span style="margin-left: 20px;">Total Columns: <strong>${schema.tables.reduce((sum, t) => sum + t.columns.length, 0)}</strong></span>
                        <span style="margin-left: 20px;">Relationships: <strong>${schema.tables.reduce((sum, t) => sum + t.foreign_keys.length, 0)}</strong></span>
                    </div>
                </div>

                <!-- Documentation Links -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px;">📚 Documentation</h3>
                    <div style="display: grid; gap: 10px;">
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 System Security Documentation</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Complete security architecture and encryption details</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/system-security" target="_blank" rel="noopener noreferrer" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/system-security?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 User & Profile Relationship Guide</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Data hierarchy and secure segregation</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/user-profile-relationship" target="_blank" rel="noopener noreferrer" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/user-profile-relationship?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                        <div style="padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 5px;">📄 Asset Fields Reference</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">Complete asset type and field documentation</div>
                            <div style="display: flex; gap: 10px;">
                                <a href="/api/admin/documentation/asset-fields" target="_blank" rel="noopener noreferrer" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">👁️ View</a>
                                <a href="/api/admin/documentation/asset-fields?download=true" style="padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; text-decoration: none; font-size: 11px; font-weight: 600; transition: all 0.2s;">💾 Save</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render database schema diagram
        await renderDatabaseSchema(container, schema);

        // Setup stat card click handlers
        setupStatCardClicks(container);

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

/**
 * Setup click handlers on stat cards to show detail panels
 */
function setupStatCardClicks(container) {
    let activeCard = null;
    let detailData = null;

    const cards = container.querySelectorAll('.stat-card');
    const panel = container.querySelector('#stats-detail-panel');

    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });

        card.addEventListener('click', async () => {
            const stat = card.dataset.stat;

            // Toggle off if clicking same card
            if (activeCard === stat) {
                panel.innerHTML = '';
                activeCard = null;
                cards.forEach(c => c.style.outline = '');
                return;
            }

            // Highlight active card
            cards.forEach(c => c.style.outline = '');
            card.style.outline = '3px solid rgba(255,255,255,0.8)';
            activeCard = stat;

            // Show loading
            panel.innerHTML = `
                <div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; text-align: center; color: var(--text-secondary);">
                    Loading...
                </div>`;

            // Fetch detail data (cache across clicks)
            if (!detailData) {
                try {
                    detailData = await apiClient.get('/api/admin/system/stats-detail');
                } catch (err) {
                    const safeErrorMessage = escapeHtml(err?.message || 'Unknown error');
                    panel.innerHTML = `<div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; color: var(--danger-color);">Failed to load: ${safeErrorMessage}</div>`;
                    return;
                }
            }

            renderDetailPanel(panel, stat, detailData);
        });
    });
}

/**
 * Render detail panel content for a given stat type
 */
function renderDetailPanel(panel, stat, data) {
    const closeBtn = `<span class="stats-detail-close" style="float: right; cursor: pointer; opacity: 0.5; font-size: 18px;">&#x2715;</span>`;

    if (stat === 'users') {
        const rows = data.users.map(u => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${u.username}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">${u.email || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: center;">${u.profile_count}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: center;">${u.scenario_count}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${u.is_active ? '#43e97b' : '#f5576c'};"></span>
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">${u.last_login ? new Date(u.last_login).toLocaleDateString() : 'never'}</td>
            </tr>
        `).join('');

        panel.innerHTML = `
            <div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; margin-top: -8px;">
                ${closeBtn}
                <h4 style="margin: 0 0 12px 0; font-size: 15px;">All Users (${data.users.length})</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: var(--bg-primary);">
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Username</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Email</th>
                                <th style="padding: 8px 12px; text-align: center; font-weight: 600;">Profiles</th>
                                <th style="padding: 8px 12px; text-align: center; font-weight: 600;">Scenarios</th>
                                <th style="padding: 8px 12px; text-align: center; font-weight: 600;">Active</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Last Login</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    else if (stat === 'profiles') {
        const rows = data.profiles.map(p => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${p.name || '(unnamed)'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">${p.username}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">${new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');

        panel.innerHTML = `
            <div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; margin-top: -8px;">
                ${closeBtn}
                <h4 style="margin: 0 0 12px 0; font-size: 15px;">All Profiles (${data.profiles.length})</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: var(--bg-primary);">
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Profile Name</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Owner</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Created</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    else if (stat === 'scenarios') {
        const rows = data.scenarios.map(s => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${s.name || '(unnamed)'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">${s.username}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">${new Date(s.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');

        panel.innerHTML = `
            <div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; margin-top: -8px;">
                ${closeBtn}
                <h4 style="margin: 0 0 12px 0; font-size: 15px;">All Scenarios (${data.scenarios.length})</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: var(--bg-primary);">
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Scenario Name</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Owner</th>
                                <th style="padding: 8px 12px; text-align: left; font-weight: 600;">Created</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }

    else if (stat === 'logs') {
        // Action breakdown bar chart
        const maxCount = data.action_breakdown.length ? data.action_breakdown[0].count : 1;
        const bars = data.action_breakdown.map(a => `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <div style="width: 160px; font-size: 12px; text-align: right; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.action}">${a.action}</div>
                <div style="flex: 1; height: 18px; background: var(--bg-primary); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${(a.count / maxCount * 100).toFixed(1)}%; height: 100%; background: linear-gradient(90deg, #43e97b, #38f9d7); border-radius: 4px;"></div>
                </div>
                <div style="width: 60px; font-size: 12px; font-weight: 600;">${a.count.toLocaleString()}</div>
            </div>
        `).join('');

        // Recent log entries
        const logRows = data.recent_logs.map(l => `
            <tr>
                <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">${new Date(l.created_at).toLocaleString()}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px;">${l.username}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px;"><code style="background: var(--bg-primary); padding: 2px 6px; border-radius: 3px;">${l.action}</code></td>
                <td style="padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">${l.table_name || '-'}</td>
            </tr>
        `).join('');

        panel.innerHTML = `
            <div style="background: var(--bg-secondary); border-radius: 0 0 12px 12px; padding: 20px; margin-top: -8px;">
                ${closeBtn}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin: 0 0 12px 0; font-size: 15px;">Action Breakdown (Top 15)</h4>
                        ${bars}
                    </div>
                    <div>
                        <h4 style="margin: 0 0 12px 0; font-size: 15px;">Recent Entries (Last 50)</h4>
                        <div style="max-height: 350px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--bg-primary);">
                                        <th style="padding: 6px 10px; text-align: left; font-weight: 600; font-size: 12px;">Time</th>
                                        <th style="padding: 6px 10px; text-align: left; font-weight: 600; font-size: 12px;">User</th>
                                        <th style="padding: 6px 10px; text-align: left; font-weight: 600; font-size: 12px;">Action</th>
                                        <th style="padding: 6px 10px; text-align: left; font-weight: 600; font-size: 12px;">Table</th>
                                    </tr>
                                </thead>
                                <tbody>${logRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // Attach close button handler (CSP blocks inline onclick)
    const closeEl = panel.querySelector('.stats-detail-close');
    if (closeEl) {
        closeEl.addEventListener('click', () => {
            panel.innerHTML = '';
            document.querySelectorAll('.stat-card').forEach(c => c.style.outline = '');
        });
    }
}

/**
 * Load Mermaid.js library dynamically
 */
async function loadMermaid() {
    // Check if already loaded
    if (window.mermaid) {
        return window.mermaid;
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Mermaid.js load timed out')), 15000);

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        script.onload = () => {
            clearTimeout(timeout);
            try {
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    er: { useMaxWidth: true }
                });
                resolve(window.mermaid);
            } catch (e) {
                reject(new Error('Mermaid init failed: ' + e.message));
            }
        };
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load Mermaid.js from CDN'));
        };
        document.head.appendChild(script);
    });
}

/**
 * Generate Mermaid ER diagram syntax from schema
 */
function generateMermaidDiagram(schema) {
    let diagram = 'erDiagram\n';

    // Add each table
    schema.tables.forEach(table => {
        // Add table with columns
        diagram += `    ${table.name} {\n`;

        table.columns.forEach(col => {
            const type = col.type || 'TEXT';
            const pk = col.primary_key ? ' PK' : '';
            const nn = col.not_null && !col.primary_key ? ' "NOT NULL"' : '';
            diagram += `        ${type} ${col.name}${pk}${nn}\n`;
        });

        diagram += '    }\n';
    });

    // Add relationships
    schema.tables.forEach(table => {
        table.foreign_keys.forEach(fk => {
            // Determine relationship cardinality
            // In SQLite, most foreign keys are many-to-one (||--o{)
            diagram += `    ${fk.referenced_table} ||--o{ ${table.name} : "${fk.column}"\n`;
        });
    });

    return diagram;
}

/**
 * Render database schema diagram using Mermaid.js
 */
async function renderDatabaseSchema(container, schema) {
    const diagramDiv = container.querySelector('#schema-diagram');

    if (!diagramDiv) {
        console.error('Schema diagram container not found');
        return;
    }

    try {
        // Show loading
        diagramDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner" style="
                    width: 24px;
                    height: 24px;
                    border: 3px solid var(--border-color);
                    border-top-color: var(--accent-color);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 10px;
                "></div>
                <style>
                     spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
                <div style="color: var(--text-secondary);">Loading diagram...</div>
            </div>
        `;

        // Load Mermaid.js
        const mermaid = await loadMermaid();

        // Generate Mermaid syntax
        const mermaidCode = generateMermaidDiagram(schema);

        // Create unique ID for this diagram
        const diagramId = `mermaid-diagram-${Date.now()}`;

        // Render diagram
        const { svg } = await mermaid.render(diagramId, mermaidCode);

        // Insert SVG
        diagramDiv.innerHTML = svg;

        // Add some styling to the SVG
        const svgElement = diagramDiv.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.maxWidth = '100%';
        }

        // Setup click handler to open full view
        const previewDiv = container.querySelector('#schema-diagram-preview');
        if (previewDiv) {
            previewDiv.addEventListener('click', () => {
                openSchemaModal(svg, schema);
            });
        }

    } catch (error) {
        console.error('Error rendering schema diagram:', error);
        const safeErrorMessage = escapeHtml(error?.message || 'Unknown error');
        diagramDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                <div>Failed to render diagram</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 10px;">${safeErrorMessage}</div>
            </div>
        `;
    }
}

/**
 * Open schema diagram in full-screen modal with pan/zoom controls
 */
function openSchemaModal(svgContent, schema) {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        flex-direction: column;
    `;

    // Create header with controls
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 15px 20px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
    `;
    header.innerHTML = `
        <div style="font-size: 18px; font-weight: 600;">
            🗄️ Database Schema - ${schema.tables.length} Tables, ${schema.tables.reduce((sum, t) => sum + t.foreign_keys.length, 0)} Relationships
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <button id="zoom-in-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; cursor: pointer; font-size: 16px;">➕ Zoom In</button>
            <button id="zoom-out-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; cursor: pointer; font-size: 16px;">➖ Zoom Out</button>
            <button id="reset-view-btn" style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; cursor: pointer; font-size: 16px;">🔄 Reset</button>
            <button id="print-schema-btn" style="padding: 8px 16px; background: rgba(59,130,246,0.8); border: 1px solid rgba(59,130,246,1); border-radius: 6px; color: white; cursor: pointer; font-size: 16px;">🖨️ Print</button>
            <button id="close-modal-btn" style="padding: 8px 16px; background: rgba(239,68,68,0.8); border: 1px solid rgba(239,68,68,1); border-radius: 6px; color: white; cursor: pointer; font-size: 16px;">✕ Close</button>
        </div>
    `;

    // Create diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.style.cssText = `
        flex: 1;
        overflow: hidden;
        position: relative;
        background: white;
        margin: 20px;
        border-radius: 8px;
        cursor: grab;
    `;

    // Create inner container for pan/zoom
    const innerContainer = document.createElement('div');
    innerContainer.id = 'schema-zoom-container';
    innerContainer.style.cssText = `
        transform-origin: 0 0;
        transition: transform 0.2s ease;
    `;
    innerContainer.innerHTML = svgContent;

    diagramContainer.appendChild(innerContainer);
    modal.appendChild(header);
    modal.appendChild(diagramContainer);
    document.body.appendChild(modal);

    // Pan and zoom state
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    // Update transform
    function updateTransform() {
        innerContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // Zoom in
    modal.querySelector('#zoom-in-btn').addEventListener('click', () => {
        scale *= 1.2;
        updateTransform();
    });

    // Zoom out
    modal.querySelector('#zoom-out-btn').addEventListener('click', () => {
        scale *= 0.8;
        updateTransform();
    });

    // Reset view
    modal.querySelector('#reset-view-btn').addEventListener('click', () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
    });

    // Print
    modal.querySelector('#print-schema-btn').addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>RPS Database Schema</title>
                <style>
                    @page { size: landscape; margin: 0.5in; }
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    .stats { text-align: center; margin-bottom: 20px; color: #666; }
                    svg { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <h1>🗄️ RPS Database Schema</h1>
                <div class="stats">
                    ${schema.tables.length} Tables |
                    ${schema.tables.reduce((sum, t) => sum + t.columns.length, 0)} Columns |
                    ${schema.tables.reduce((sum, t) => sum + t.foreign_keys.length, 0)} Relationships
                </div>
                ${svgContent}
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    });

    // Close modal
    modal.querySelector('#close-modal-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Mouse wheel zoom
    diagramContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = diagramContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldScale = scale;
        if (e.deltaY < 0) {
            scale *= 1.1;
        } else {
            scale *= 0.9;
        }

        // Adjust translation to zoom towards mouse position
        translateX -= (mouseX - translateX) * (scale / oldScale - 1);
        translateY -= (mouseY - translateY) * (scale / oldScale - 1);

        updateTransform();
    });

    // Pan with mouse drag
    diagramContainer.addEventListener('mousedown', (e) => {
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        diagramContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            diagramContainer.style.cursor = 'grab';
        }
    });

    // ESC key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            window.removeEventListener('keydown', handleEscape);
        }
    };
    window.addEventListener('keydown', handleEscape);
}
