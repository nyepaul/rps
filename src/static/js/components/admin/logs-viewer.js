/**
 * Audit Logs Viewer Component
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/formatters.js';

// Sort state
let currentSort = {
    column: 'created_at',
    direction: 'desc'
};

// User mapping for filter (username -> user_id)
let userMapping = {};

/**
 * Render logs viewer with filtering and pagination
 */
export async function renderLogsViewer(container) {
    // Reset sort state when rendering
    currentSort = {
        column: 'created_at',
        direction: 'desc'
    };
    container.innerHTML = `
        <!-- Filters -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin-bottom: 15px;">🔍 Filters</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">User</label>
                    <input
                        type="text"
                        id="filter-user-id"
                        list="users-datalist"
                        placeholder="Type or select user..."
                        style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                    >
                    <datalist id="users-datalist"></datalist>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Action</label>
                    <select id="filter-action" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                        <option value="">All Actions</option>
                        <option value="CREATE">CREATE</option>
                        <option value="READ">READ</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="LOGIN_ATTEMPT">LOGIN_ATTEMPT</option>
                        <option value="NETWORK_ACCESS">NETWORK_ACCESS</option>
                        <option value="ADMIN_ACCESS">ADMIN_ACCESS</option>
                        <option value="ADMIN_ACCESS_DENIED">ADMIN_ACCESS_DENIED</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Table</label>
                    <input type="text" id="filter-table" placeholder="Table name" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">IP Address</label>
                    <input type="text" id="filter-ip" placeholder="IP address" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Start Date</label>
                    <input type="date" id="filter-start-date" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">End Date</label>
                    <input type="date" id="filter-end-date" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                </div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button id="apply-filters-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Apply Filters
                </button>
                <button id="clear-filters-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                    Clear
                </button>
                <button id="export-logs-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; margin-left: auto;">
                    📥 Export CSV
                </button>
            </div>
        </div>

        <!-- Statistics -->
        <div id="logs-statistics" style="margin-bottom: 20px;"></div>

        <!-- Logs Table -->
        <div style="background: var(--bg-secondary); border-radius: 12px; overflow: hidden;">
            <div id="logs-table-container"></div>
        </div>

        <!-- Pagination -->
        <div id="logs-pagination" style="margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 15px;"></div>
    `;

    // Load users into dropdown
    await loadUsersFilter(container);

    // Setup event handlers
    setupLogsViewerHandlers(container);

    // Load statistics
    await loadStatistics(container);

    // Load logs with default filters
    await loadLogs(container);
}

/**
 * Setup event handlers for logs viewer
 */
function setupLogsViewerHandlers(container) {
    // Apply filters
    container.querySelector('#apply-filters-btn').addEventListener('click', async () => {
        await loadLogs(container, 0); // Reset to page 0
    });

    // Clear filters
    container.querySelector('#clear-filters-btn').addEventListener('click', () => {
        container.querySelector('#filter-user-id').value = '';
        container.querySelector('#filter-action').value = '';
        container.querySelector('#filter-table').value = '';
        container.querySelector('#filter-ip').value = '';
        container.querySelector('#filter-start-date').value = '';
        container.querySelector('#filter-end-date').value = '';
        loadLogs(container, 0);
    });

    // Export logs
    container.querySelector('#export-logs-btn').addEventListener('click', async () => {
        await exportLogs(container);
    });
}

/**
 * Load users into filter dropdown
 */
async function loadUsersFilter(container) {
    try {
        // Get all users
        const response = await apiClient.get('/api/admin/users?limit=1000');
        const users = response.users || [];

        const datalist = container.querySelector('#users-datalist');
        if (!users.length) {
            return;
        }

        // Sort users alphabetically by username
        users.sort((a, b) => a.username.localeCompare(b.username));

        // Build username -> user_id mapping
        userMapping = {};

        // Add special "coward" mapping for unauthenticated users
        userMapping['coward'] = null;

        users.forEach(user => {
            userMapping[user.username.toLowerCase()] = user.id;
            // Also map "username (ID: x)" format
            userMapping[`${user.username.toLowerCase()} (id: ${user.id})`] = user.id;
        });

        // Populate datalist with "coward" at the top
        const cowardOption = '<option value="coward">coward (Unauthenticated)</option>';
        const userOptions = users.map(user => `
            <option value="${user.username}">
                ${user.username} (ID: ${user.id})${user.is_admin ? ' - Admin' : ''}
            </option>
        `).join('');

        datalist.innerHTML = cowardOption + userOptions;

    } catch (error) {
        console.error('Error loading users filter:', error);
    }
}

/**
 * Load statistics
 */
async function loadStatistics(container) {
    const statsContainer = container.querySelector('#logs-statistics');

    try {
        const response = await apiClient.get('/api/admin/logs/statistics?days=30');
        const stats = response.statistics;

        statsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid var(--accent-color);">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Total Logs (30d)</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${stats.total_logs.toLocaleString()}</div>
                </div>
                <div id="unique-ips-stat" style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid var(--success-color); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;"
                     onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'"
                     onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                     title="Click to view IP locations on map">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Unique IPs 🗺️</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${stats.unique_ips.toLocaleString()}</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid var(--danger-color);">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Failed Actions</div>
                    <div style="font-size: 28px; font-weight: 700; color: var(--danger-color);">${stats.failed_actions.toLocaleString()}</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid #764ba2;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Top Action</div>
                    <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${getTopAction(stats.by_action)}</div>
                </div>
            </div>
        `;

        // Setup click handler for Unique IPs stat
        const uniqueIpsStat = statsContainer.querySelector('#unique-ips-stat');
        if (uniqueIpsStat) {
            uniqueIpsStat.addEventListener('click', async () => {
                await showIPLocationsMap();
            });
        }

    } catch (error) {
        console.error('Failed to load statistics:', error);
        statsContainer.innerHTML = `<div style="color: var(--danger-color); padding: 20px;">Failed to load statistics</div>`;
    }
}

/**
 * Get top action from stats
 */
function getTopAction(byAction) {
    if (!byAction || Object.keys(byAction).length === 0) {
        return 'N/A';
    }

    let topAction = '';
    let topCount = 0;

    for (const [action, count] of Object.entries(byAction)) {
        if (count > topCount) {
            topCount = count;
            topAction = action;
        }
    }

    return `${topAction} (${topCount})`;
}

/**
 * Load logs with current filters
 */
async function loadLogs(container, offset = 0) {
    const tableContainer = container.querySelector('#logs-table-container');
    const paginationContainer = container.querySelector('#logs-pagination');

    // Show loading
    tableContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
            <div>Loading logs...</div>
        </div>
    `;

    try {
        // Get filter values
        const userInput = container.querySelector('#filter-user-id').value || '';
        let userId = undefined;

        if (userInput) {
            // Check if it's a number (direct user ID)
            if (!isNaN(userInput) && userInput.trim() !== '') {
                userId = userInput;
            } else {
                // Look up username in mapping
                userId = userMapping[userInput.toLowerCase()];
                // If userId is null (for "coward"), convert to string 'null' for API
                if (userId === null) {
                    userId = 'null';
                }
            }
        }

        const filters = {
            user_id: userId,
            action: container.querySelector('#filter-action').value || undefined,
            table_name: container.querySelector('#filter-table').value || undefined,
            ip_address: container.querySelector('#filter-ip').value || undefined,
            start_date: container.querySelector('#filter-start-date').value || undefined,
            end_date: container.querySelector('#filter-end-date').value || undefined,
            sort_by: currentSort.column,
            sort_direction: currentSort.direction,
            limit: 50,
            offset: offset
        };

        // Build query string
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined) {
                params.append(key, value);
            }
        }

        // Fetch logs
        const response = await apiClient.get(`/api/admin/logs?${params.toString()}`);
        const logs = response.logs;
        const total = response.total;
        const limit = response.limit;

        if (logs.length === 0) {
            tableContainer.innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                    <h3 style="margin-bottom: 10px;">No logs found</h3>
                    <p style="color: var(--text-secondary);">Try adjusting your filters</p>
                </div>
            `;
            paginationContainer.innerHTML = '';
            return;
        }

        // Render table
        tableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                        ${renderSortableHeader('created_at', 'Timestamp', 'left')}
                        ${renderSortableHeader('action', 'Action', 'left')}
                        ${renderSortableHeader('username', 'User', 'left')}
                        ${renderSortableHeader('ip_address', 'IP / Location', 'left')}
                        ${renderSortableHeader('user_agent', 'Device', 'left')}
                        ${renderSortableHeader('status_code', 'Status', 'center')}
                        ${renderSortableHeader('table_name', 'Details', 'center')}
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => renderLogRow(log)).join('')}
                </tbody>
            </table>
        `;

        // Render pagination
        renderPagination(paginationContainer, total, offset, limit, (newOffset) => {
            loadLogs(container, newOffset);
        });

        // Setup row click handlers for details
        setupLogRowHandlers(container);

        // Setup sort handlers
        setupSortHandlers(container);

    } catch (error) {
        console.error('Failed to load logs:', error);
        showError(`Failed to load logs: ${error.message}`);
        tableContainer.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--danger-color);">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <div>Failed to load logs</div>
                <div style="font-size: 13px; margin-top: 10px;">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Render a sortable table header
 */
function renderSortableHeader(column, label, align = 'left') {
    const isActive = currentSort.column === column;
    const arrow = isActive ? (currentSort.direction === 'asc' ? '↑' : '↓') : '⇅';
    const arrowOpacity = isActive ? '1' : '0.3';

    return `
        <th class="sortable-header" data-column="${column}" style="text-align: ${align}; padding: 12px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; transition: background 0.2s;" onmouseenter="this.style.background='var(--bg-primary)'" onmouseleave="this.style.background='transparent'">
            ${label} <span style="opacity: ${arrowOpacity}; font-size: 10px; margin-left: 4px;">${arrow}</span>
        </th>
    `;
}

/**
 * Setup sort handlers
 */
function setupSortHandlers(container) {
    container.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');

            // Toggle direction if clicking same column, otherwise default to desc
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'desc'; // Default to descending for new column
            }

            // Reload logs with new sort
            loadLogs(container, 0);
        });
    });
}

/**
 * Render a log row
 */
function renderLogRow(log) {
    const timestamp = new Date(log.created_at).toLocaleString();
    const actionColor = getActionColor(log.action);
    const statusColor = log.status_code >= 400 ? 'var(--danger-color)' : 'var(--success-color)';

    // Format location
    let location = 'Unknown';
    if (log.geo_location) {
        const geo = log.geo_location;
        location = `${geo.city}, ${geo.country}`;
    }

    // Format device
    let device = 'Unknown';
    if (log.device_info) {
        const dev = log.device_info;
        device = `${dev.browser} on ${dev.os}`;
    }

    return `
        <tr class="log-row" data-log-id="${log.id}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;">
            <td style="padding: 12px; font-size: 12px;">${timestamp}</td>
            <td style="padding: 12px;">
                <span style="display: inline-block; padding: 4px 8px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${log.action}
                </span>
            </td>
            <td style="padding: 12px; font-size: 12px;">
                ${log.username ? log.username : (log.user_id ? `User ${log.user_id}` : 'coward')}
            </td>
            <td style="padding: 12px; font-size: 12px;">
                <div>${log.ip_address || 'N/A'}</div>
                <div style="font-size: 10px; color: var(--text-secondary);">${location}</div>
            </td>
            <td style="padding: 12px; font-size: 11px; color: var(--text-secondary);">${device}</td>
            <td style="padding: 12px; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${log.status_code || 'N/A'}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <button class="view-details-btn" data-log-id="${log.id}" style="padding: 4px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    View
                </button>
            </td>
        </tr>
    `;
}

/**
 * Get color for action type
 */
function getActionColor(action) {
    const colorMap = {
        'CREATE': 'var(--success-color)',
        'READ': 'var(--accent-color)',
        'UPDATE': '#FFA500',
        'DELETE': 'var(--danger-color)',
        'LOGIN_ATTEMPT': '#764ba2',
        'NETWORK_ACCESS': '#3498db',
        'ADMIN_ACCESS': 'var(--success-color)',
        'ADMIN_ACCESS_DENIED': 'var(--danger-color)'
    };

    return colorMap[action] || 'var(--text-secondary)';
}

/**
 * Setup log row click handlers
 */
function setupLogRowHandlers(container) {
    container.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const logId = btn.getAttribute('data-log-id');
            await showLogDetails(logId);
        });
    });

    // Row click to view details
    container.querySelectorAll('.log-row').forEach(row => {
        row.addEventListener('click', async () => {
            const logId = row.getAttribute('data-log-id');
            await showLogDetails(logId);
        });
    });

    // Row hover effect
    container.querySelectorAll('.log-row').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--bg-tertiary)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
        });
    });
}

/**
 * Show log details modal
 */
async function showLogDetails(logId) {
    try {
        // Fetch full log details from API
        const log = await apiClient.get(`/api/admin/logs/${logId}`);

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'log-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
        `;

        const timestamp = new Date(log.created_at).toLocaleString();
        const actionColor = getActionColor(log.action);
        const statusColor = log.status_code >= 400 ? 'var(--danger-color)' : 'var(--success-color)';

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 20px;">📋 Audit Log Details</h2>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                </div>

                <div style="display: grid; gap: 20px;">
                    <!-- Basic Info -->
                    <div>
                        <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Basic Information</h3>
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Log ID:</span>
                                <span style="font-family: monospace;">${log.id}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Timestamp:</span>
                                <span>${timestamp}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Action:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${log.action}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Status Code:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${log.status_code || 'N/A'}</span>
                            </div>
                            ${log.table_name ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Table:</span>
                                    <span style="font-family: monospace;">${log.table_name}</span>
                                </div>
                            ` : ''}
                            ${log.record_id ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Record ID:</span>
                                    <span style="font-family: monospace;">${log.record_id}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- User Info -->
                    <div>
                        <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">User Information</h3>
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">User ID:</span>
                                <span>${log.user_id || 'N/A'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Username:</span>
                                <span>${log.username || 'Anonymous'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">IP Address:</span>
                                <span style="font-family: monospace;">${log.ip_address || 'N/A'}</span>
                            </div>
                            ${log.geo_location ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Location:</span>
                                    <span>${log.geo_location.city}, ${log.geo_location.region}, ${log.geo_location.country}</span>
                                </div>
                                ${log.geo_location.lat && log.geo_location.lon ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Coordinates:</span>
                                        <span style="font-family: monospace;">${log.geo_location.lat.toFixed(4)}, ${log.geo_location.lon.toFixed(4)}</span>
                                    </div>
                                ` : ''}
                            ` : ''}
                        </div>
                    </div>

                    <!-- Map -->
                    ${log.geo_location && log.geo_location.lat && log.geo_location.lon ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">🗺️ Location Map</h3>
                            <div id="location-map" style="height: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);"></div>
                        </div>
                    ` : ''}

                    <!-- Device Info -->
                    ${log.device_info ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Device Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Browser:</span>
                                    <span>${log.device_info.browser || 'Unknown'}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">OS:</span>
                                    <span>${log.device_info.os || 'Unknown'}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Device:</span>
                                    <span>${log.device_info.device || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Details -->
                    ${log.details ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Additional Details</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
                                <pre style="margin: 0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: var(--text-primary);">${JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Error Message -->
                    ${log.error_message ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--danger-color); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">❌ Error Message</h3>
                            <div style="background: var(--danger-color)10; border-left: 4px solid var(--danger-color); padding: 15px; border-radius: 8px;">
                                <pre style="margin: 0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: var(--danger-color);">${log.error_message}</pre>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div style="margin-top: 20px; text-align: right;">
                    <button class="close-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);

        // Setup close handlers
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Initialize map if coordinates are available
        if (log.geo_location && log.geo_location.lat && log.geo_location.lon) {
            // Wait for DOM to be ready
            setTimeout(() => {
                const mapContainer = document.getElementById('location-map');
                if (mapContainer && typeof L !== 'undefined') {
                    try {
                        // Initialize map centered on the location
                        const map = L.map('location-map').setView(
                            [log.geo_location.lat, log.geo_location.lon],
                            10 // zoom level
                        );

                        // Add CartoDB Dark Matter tile layer for dark background
                        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                            attribution: '© OpenStreetMap contributors © CARTO',
                            maxZoom: 19,
                            crossOrigin: true
                        }).addTo(map);

                        // Add bright cyan marker with glow effect
                        const customIcon = L.divIcon({
                            className: 'custom-marker',
                            html: '<div style="background: #00ddff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 0 15px rgba(0, 221, 255, 0.6), 0 2px 8px rgba(0,0,0,0.8);"></div>',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });

                        const marker = L.marker([log.geo_location.lat, log.geo_location.lon], { icon: customIcon }).addTo(map);

                        // Add popup with location details (dark theme)
                        marker.bindPopup(`
                            <div style="text-align: center; padding: 8px; background: #1a1a1a; color: #ffffff; border-radius: 6px;">
                                <strong style="font-size: 14px; color: #00ddff; text-shadow: 0 0 8px rgba(0, 221, 255, 0.6);">${log.geo_location.city}</strong><br>
                                <span style="font-size: 12px; color: #aaaaaa;">${log.geo_location.region}, ${log.geo_location.country}</span><br>
                                <span style="font-size: 11px; color: #00ddff; font-family: monospace; text-shadow: 0 0 6px rgba(0, 221, 255, 0.4);">${log.ip_address}</span>
                            </div>
                        `).openPopup();
                    } catch (error) {
                        console.error('Failed to initialize map:', error);
                        mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--danger-color);">Failed to load map</div>';
                    }
                }
            }, 100);
        }

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

    } catch (error) {
        console.error('Failed to load log details:', error);
        showError(`Failed to load log details: ${error.message}`);
    }
}

/**
 * Render pagination controls
 */
function renderPagination(container, total, offset, limit, onPageChange) {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} style="padding: 8px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; ${currentPage === 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
            ← Previous
        </button>
        <div style="display: flex; gap: 5px;">
    `;

    // Show page numbers (with ellipsis for many pages)
    const maxPagesToShow = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" data-page="1" style="padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span style="padding: 8px;">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="page-btn" data-page="${i}" style="padding: 8px 12px; background: ${i === currentPage ? 'var(--accent-color)' : 'var(--bg-secondary)'}; color: ${i === currentPage ? 'white' : 'var(--text-primary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: ${i === currentPage ? '600' : 'normal'};">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span style="padding: 8px;">...</span>`;
        }
        paginationHTML += `<button class="page-btn" data-page="${totalPages}" style="padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">${totalPages}</button>`;
    }

    paginationHTML += `
        </div>
        <button ${currentPage === totalPages ? 'disabled' : ''} style="padding: 8px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; ${currentPage === totalPages ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
            Next →
        </button>
    `;

    container.innerHTML = paginationHTML;

    // Setup pagination handlers
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.getAttribute('data-page'));
            onPageChange((page - 1) * limit);
        });
    });

    // Previous/Next buttons
    const buttons = container.querySelectorAll('button');
    buttons[0].addEventListener('click', () => {
        if (currentPage > 1) {
            onPageChange((currentPage - 2) * limit);
        }
    });
    buttons[buttons.length - 1].addEventListener('click', () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage * limit);
        }
    });
}

/**
 * Export logs to CSV
 */
async function exportLogs(container) {
    try {
        // Get filter values
        const filters = {
            user_id: container.querySelector('#filter-user-id').value || undefined,
            action: container.querySelector('#filter-action').value || undefined,
            table_name: container.querySelector('#filter-table').value || undefined,
            ip_address: container.querySelector('#filter-ip').value || undefined,
            start_date: container.querySelector('#filter-start-date').value || undefined,
            end_date: container.querySelector('#filter-end-date').value || undefined,
            format: 'csv'
        };

        // Build query string
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined) {
                params.append(key, value);
            }
        }

        // Download CSV
        const url = `/api/admin/logs/export?${params.toString()}`;
        window.location.href = url;

        showSuccess('Logs exported successfully');

    } catch (error) {
        console.error('Failed to export logs:', error);
        showError(`Failed to export logs: ${error.message}`);
    }
}

/**
 * Show IP locations map modal
 */
async function showIPLocationsMap() {
    try {
        // Fetch all unique IP locations directly from the server
        const response = await apiClient.get('/api/admin/logs/ip-locations');
        const uniqueIPs = response.locations || [];

        if (uniqueIPs.length === 0) {
            showError('No IP locations available to display');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'ip-map-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 20px;">🗺️ IP Locations Map (${uniqueIPs.length} Unique IPs)</h2>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                </div>

                <div id="ip-locations-map" style="height: 600px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); margin-bottom: 20px;"></div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        💡 Click markers to see IP details • Larger markers = more access attempts
                    </div>
                    <button class="close-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);

        // Setup close handlers
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Initialize map
        setTimeout(() => {
            const mapContainer = document.getElementById('ip-locations-map');
            if (mapContainer && typeof L !== 'undefined') {
                try {
                    // Calculate bounds to fit all markers
                    const lats = uniqueIPs.map(ip => ip.lat);
                    const lons = uniqueIPs.map(ip => ip.lon);
                    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

                    // Initialize map
                    const map = L.map('ip-locations-map').setView([centerLat, centerLon], 2);

                    // Add CartoDB Dark Matter tile layer for dark background
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                        attribution: '© OpenStreetMap contributors © CARTO',
                        maxZoom: 19,
                        crossOrigin: true
                    }).addTo(map);

                    // Calculate access count thresholds for color coding
                    const accessCounts = uniqueIPs.map(ip => ip.count).sort((a, b) => b - a);
                    const highThreshold = accessCounts[Math.floor(accessCounts.length * 0.25)] || accessCounts[0];
                    const lowThreshold = accessCounts[Math.floor(accessCounts.length * 0.75)] || accessCounts[accessCounts.length - 1];

                    // Add markers for each unique IP
                    const markers = [];
                    uniqueIPs.forEach(ipData => {
                        // Determine color based on access count (precedence)
                        let markerColor, glowColor, labelColor;
                        if (ipData.count >= highThreshold) {
                            // High activity - bright red/orange
                            markerColor = '#ff4444';
                            glowColor = 'rgba(255, 68, 68, 0.6)';
                            labelColor = '#ff4444';
                        } else if (ipData.count >= lowThreshold) {
                            // Medium activity - bright yellow/gold
                            markerColor = '#ffaa00';
                            glowColor = 'rgba(255, 170, 0, 0.6)';
                            labelColor = '#ffaa00';
                        } else {
                            // Low activity - bright cyan/blue
                            markerColor = '#00ddff';
                            glowColor = 'rgba(0, 221, 255, 0.6)';
                            labelColor = '#00ddff';
                        }

                        // Scale marker size based on access count
                        const maxCount = Math.max(...uniqueIPs.map(ip => ip.count));
                        const markerSize = Math.max(10, Math.min(24, 10 + (ipData.count / maxCount) * 14));

                        // Create custom icon with color based on count
                        const customIcon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="background: ${markerColor}; width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 0 15px ${glowColor}, 0 2px 8px rgba(0,0,0,0.8);"></div>`,
                            iconSize: [markerSize, markerSize],
                            iconAnchor: [markerSize / 2, markerSize / 2]
                        });

                        const marker = L.marker([ipData.lat, ipData.lon], { icon: customIcon }).addTo(map);

                        // Add popup with IP details and button to view individual accesses
                        const popupContent = `
                            <div style="text-align: center; padding: 10px; min-width: 220px; background: #1a1a1a; color: #ffffff; border-radius: 8px;">
                                <div style="font-size: 16px; font-weight: 700; margin-bottom: 10px; color: ${labelColor}; font-family: monospace; text-shadow: 0 0 8px ${glowColor};">${ipData.ip}</div>
                                <div style="font-size: 15px; font-weight: 600; margin-bottom: 5px; color: #ffffff;">${ipData.city}</div>
                                <div style="font-size: 13px; color: #aaaaaa; margin-bottom: 10px;">${ipData.region}, ${ipData.country}</div>
                                <div style="font-size: 12px; padding: 6px 12px; background: ${markerColor}; border-radius: 6px; color: #000000; font-weight: 700; box-shadow: 0 0 10px ${glowColor}; margin-bottom: 10px;">
                                    ${ipData.count} access${ipData.count !== 1 ? 'es' : ''}
                                </div>
                                <button class="view-ip-logs-btn" data-ip="${ipData.ip}" style="padding: 8px 16px; background: ${markerColor}; color: #000000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; width: 100%; transition: opacity 0.2s; box-shadow: 0 0 8px ${glowColor};">
                                    📋 View All Accesses
                                </button>
                            </div>
                        `;

                        marker.bindPopup(popupContent);

                        // Add click handler for the button
                        marker.on('popupopen', () => {
                            const btn = document.querySelector('.view-ip-logs-btn[data-ip="' + ipData.ip + '"]');
                            if (btn) {
                                btn.addEventListener('click', () => {
                                    showIPAccessDetails(ipData.ip, ipData.city, ipData.region, ipData.country);
                                });
                                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.8');
                                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
                            }
                        });

                        markers.push(marker);
                    });

                    // Fit map to show all markers
                    if (markers.length > 0) {
                        const group = L.featureGroup(markers);
                        map.fitBounds(group.getBounds().pad(0.1));
                    }

                } catch (error) {
                    console.error('Failed to initialize map:', error);
                    mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--danger-color);">Failed to load map</div>';
                }
            }
        }, 100);

    } catch (error) {
        console.error('Failed to load IP locations:', error);
        showError(`Failed to load IP locations: ${error.message}`);
    }
}

/**
 * Show all access records for a specific IP address
 */
async function showIPAccessDetails(ipAddress, city, region, country) {
    try {
        // Fetch all logs for this IP (using high limit to get all records)
        const params = new URLSearchParams({
            ip_address: ipAddress,
            limit: 500,
            offset: 0
        });

        const response = await apiClient.get(`/api/admin/logs?${params.toString()}`);
        const logs = response.logs || [];

        if (logs.length === 0) {
            showError(`No access records found for ${ipAddress}`);
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'ip-access-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; width: 90%; max-width: 1000px; max-height: 90vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <div>
                        <h2 style="margin: 0; font-size: 20px;">📋 Access Records for ${ipAddress}</h2>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-secondary);">
                            ${city}, ${region}, ${country} • ${logs.length} record${logs.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button class="close-access-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                </div>

                <div style="flex: 1; overflow-y: auto; margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 1;">
                            <tr style="border-bottom: 2px solid var(--border-color);">
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Timestamp</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Action</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">User</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Status</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr class="access-log-row" data-log-id="${log.id}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseenter="this.style.background='var(--bg-tertiary)'" onmouseleave="this.style.background='transparent'">
                                    <td style="padding: 12px; font-size: 13px;">
                                        ${new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td style="padding: 12px;">
                                        <span style="font-size: 11px; padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; font-weight: 600;">${log.action}</span>
                                    </td>
                                    <td style="padding: 12px; font-size: 13px;">
                                        ${log.username || '<i style="color: var(--text-secondary);">anonymous</i>'}
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        ${log.status_code ? `<span style="font-size: 11px; padding: 4px 8px; background: ${log.status_code >= 400 ? 'var(--danger-color)' : 'var(--success-color)'}; color: white; border-radius: 4px; font-weight: 600;">${log.status_code}</span>` : '—'}
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        <button class="view-log-detail-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <button class="close-access-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);

        // Setup close handlers
        modal.querySelectorAll('.close-access-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Setup row click handlers to show log details
        modal.querySelectorAll('.access-log-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                // Don't trigger if clicking the button directly
                if (e.target.classList.contains('view-log-detail-btn')) {
                    return;
                }
                const logId = row.getAttribute('data-log-id');
                if (logId) {
                    await showLogDetails(parseInt(logId));
                }
            });
        });

        // Setup button click handlers
        modal.querySelectorAll('.view-log-detail-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent row click from also firing
                const row = btn.closest('.access-log-row');
                const logId = row?.getAttribute('data-log-id');
                if (logId) {
                    await showLogDetails(parseInt(logId));
                }
            });
        });

    } catch (error) {
        console.error('Failed to load IP access details:', error);
        showError(`Failed to load access details: ${error.message}`);
    }
}
