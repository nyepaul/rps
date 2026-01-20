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
                            <div>Password: <strong>demo1234</strong></div>
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

        // Render database schema diagram
        await renderDatabaseSchema(container, schema);

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

/**
 * Load Mermaid.js library dynamically
 */
async function loadMermaid() {
    // Check if already loaded
    if (window.mermaid) {
        return window.mermaid;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.innerHTML = `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                er: {
                    useMaxWidth: true
                }
            });
            window.mermaid = mermaid;
            window.dispatchEvent(new Event('mermaid-loaded'));
        `;

        script.onerror = () => reject(new Error('Failed to load Mermaid.js'));
        document.head.appendChild(script);

        window.addEventListener('mermaid-loaded', () => resolve(window.mermaid), { once: true });
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
                <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
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
        diagramDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                <div>Failed to render diagram</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 10px;">${error.message}</div>
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
