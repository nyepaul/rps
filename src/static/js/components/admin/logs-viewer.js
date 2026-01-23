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

// Current logs array for IP access details navigation
let currentIPLogs = [];

// Current logs array for main audit logs navigation
let currentAuditLogs = [];

// Cache for fetched log details to avoid re-fetching
const logDetailsCache = new Map();

// Debounce flag to prevent rapid navigation
let isNavigating = false;

// Store current map instance to properly clean up
let currentAuditLogMap = null;
let currentIPMap = null; // For the global IP locations map

// Prefetched data storage
let prefetchedLogsData = null;

// Helper to update map theme
function updateMapTheme(map) {
    if (!map) return;
    
    const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
    const tileLayerUrl = isDarkMode 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        
    map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
            layer.setUrl(tileLayerUrl);
        }
    });
}

// Listen for theme changes
window.addEventListener('themeChanged', () => {
    updateMapTheme(currentAuditLogMap);
    updateMapTheme(currentIPMap);
    // Also update any location-map in log details modal if it exists
    // (This handles the case where showLogDetails uses a local map variable but we can find it via DOM?)
    // Actually showLogDetails map is hard to reach if not stored. 
    // We should update showLogDetails to store its map in a variable or attach to the DOM element.
});

/**
 * Prefetch logs in the background
 */
export async function prefetchLogs() {
    try {
        console.log('🔄 Prefetching logs in background...');
        const response = await apiClient.get('/api/admin/logs?limit=50&offset=0&sort_by=created_at&sort_direction=desc');
        prefetchedLogsData = response;
        console.log('✅ Logs prefetched');
    } catch (error) {
        console.warn('Failed to prefetch logs:', error);
    }
}

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
    const applyBtn = container.querySelector('#apply-filters-btn');
    const clearBtn = container.querySelector('#clear-filters-btn');
    const exportBtn = container.querySelector('#export-logs-btn');

    // Check if elements exist (view might have been switched)
    if (!applyBtn || !clearBtn || !exportBtn) return;

    // Apply filters
    applyBtn.addEventListener('click', async () => {
        await loadLogs(container, 0); // Reset to page 0
    });

    // Clear filters
    clearBtn.addEventListener('click', () => {
        const userIdInput = container.querySelector('#filter-user-id');
        if (userIdInput) userIdInput.value = '';
        
        const actionInput = container.querySelector('#filter-action');
        if (actionInput) actionInput.value = '';
        
        const tableInput = container.querySelector('#filter-table');
        if (tableInput) tableInput.value = '';
        
        const ipInput = container.querySelector('#filter-ip');
        if (ipInput) ipInput.value = '';
        
        const startDate = container.querySelector('#filter-start-date');
        if (startDate) startDate.value = '';
        
        const endDate = container.querySelector('#filter-end-date');
        if (endDate) endDate.value = '';
        
        loadLogs(container, 0);
    });

    // Export logs
    exportBtn.addEventListener('click', async () => {
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
    if (!statsContainer) return; // View switched

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
                     title="Click to view list of unique IP addresses">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Unique IPs 🌐</div>
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
                await showIPListView();
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

    if (!tableContainer || !paginationContainer) return; // View switched

    // Clear cache when loading new logs
    logDetailsCache.clear();

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

        const actionFilter = container.querySelector('#filter-action').value || undefined;
        const tableFilter = container.querySelector('#filter-table').value || undefined;
        const ipFilter = container.querySelector('#filter-ip').value || undefined;
        const startFilter = container.querySelector('#filter-start-date').value || undefined;
        const endFilter = container.querySelector('#filter-end-date').value || undefined;

        const filters = {
            user_id: userId,
            action: actionFilter,
            table_name: tableFilter,
            ip_address: ipFilter,
            start_date: startFilter,
            end_date: endFilter,
            sort_by: currentSort.column,
            sort_direction: currentSort.direction,
            limit: 50,
            offset: offset
        };

        // Check for prefetched data (only if default view: offset 0 and no filters)
        let response;
        const isDefaultView = offset === 0 && !userId && !actionFilter && !tableFilter && !ipFilter && !startFilter && !endFilter && currentSort.column === 'created_at' && currentSort.direction === 'desc';

        if (isDefaultView && prefetchedLogsData) {
            console.log('🚀 Using prefetched logs');
            response = prefetchedLogsData;
            prefetchedLogsData = null; // Clear after use
        } else {
            // Build query string
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined) {
                    params.append(key, value);
                }
            }

            // Fetch logs
            response = await apiClient.get(`/api/admin/logs?${params.toString()}`);
        }

        const logs = response.logs;
        const total = response.total;
        const limit = response.limit;

        // Store logs for navigation
        currentAuditLogs = logs;

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
                    ${logs.map((log, index) => renderLogRow(log, index)).join('')}
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
function renderLogRow(log, index) {
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
        <tr class="log-row" data-log-id="${log.id}" data-log-index="${index}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;">
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
        'NETWORK_ACCESS': 'var(--accent-color)',
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
            const row = btn.closest('.log-row');
            const logIndex = parseInt(row?.getAttribute('data-log-index'));
            if (logIndex >= 0 && logIndex < currentAuditLogs.length) {
                await showAuditLogDetailsWithNavigation(logIndex);
            }
        });
    });

    // Row click to view details
    container.querySelectorAll('.log-row').forEach(row => {
        row.addEventListener('click', async () => {
            const logIndex = parseInt(row.getAttribute('data-log-index'));
            if (logIndex >= 0 && logIndex < currentAuditLogs.length) {
                await showAuditLogDetailsWithNavigation(logIndex);
            }
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
 * Show audit log details modal with navigation (for main audit logs table)
 */
async function showAuditLogDetailsWithNavigation(logIndex) {
    const log = currentAuditLogs[logIndex];
    if (!log) return;

    // Prevent rapid navigation to avoid rate limiting
    if (isNavigating) return;
    isNavigating = true;

    // Previous = earlier in time (higher index, older logs)
    // Next = later in time (lower index, newer logs)
    const hasPrev = logIndex < currentAuditLogs.length - 1;
    const hasNext = logIndex > 0;

    try {
        // Check cache first to avoid unnecessary API calls
        let fullLog = logDetailsCache.get(log.id);

        if (!fullLog) {
            // Fetch full log details from API only if not cached
            fullLog = await apiClient.get(`/api/admin/logs/${log.id}`);
            // Cache the result
            logDetailsCache.set(log.id, fullLog);
        }

        // Check if modal already exists
        let modal = document.querySelector('.log-details-modal.audit-log-modal');
        const isExisting = !!modal;

        if (!modal) {
            // Create modal
            modal = document.createElement('div');
            modal.className = 'log-details-modal audit-log-modal';
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
        }

        const timestamp = new Date(fullLog.created_at).toLocaleString();
        const actionColor = getActionColor(fullLog.action);
        const statusColor = fullLog.status_code >= 400 ? 'var(--danger-color)' : 'var(--success-color)';

        modal.innerHTML = `
            <div class="audit-log-details-content" style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h2 style="margin: 0; font-size: 20px;">📋 Audit Log Details</h2>
                        <span style="font-size: 12px; color: var(--text-secondary); font-weight: 400;">(${logIndex + 1} of ${currentAuditLogs.length})</span>
                    </div>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                </div>

                <!-- Navigation Buttons (Top) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px 15px; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="display: flex; gap: 10px;">
                        <button class="prev-log-btn" ${!hasPrev ? 'disabled' : ''} style="padding: 8px 16px; background: ${hasPrev ? 'var(--bg-secondary)' : 'var(--bg-primary)'}; color: ${hasPrev ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasPrev ? 'pointer' : 'not-allowed'}; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            ← Previous
                        </button>
                        <button class="next-log-btn" ${!hasNext ? 'disabled' : ''} style="padding: 8px 16px; background: ${hasNext ? 'var(--bg-secondary)' : 'var(--bg-primary)'}; color: ${hasNext ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasNext ? 'pointer' : 'not-allowed'}; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            Next →
                        </button>
                    </div>
                    <button class="close-modal-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        Close
                    </button>
                </div>

                <div style="display: grid; gap: 20px;">
                    <!-- Basic Info -->
                    <div>
                        <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Basic Information</h3>
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Log ID:</span>
                                <span style="font-family: monospace;">${fullLog.id}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Timestamp:</span>
                                <span>${timestamp}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Action:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.action}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Status Code:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.status_code || 'N/A'}</span>
                            </div>
                            ${fullLog.table_name ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Table:</span>
                                    <span style="font-family: monospace;">${fullLog.table_name}</span>
                                </div>
                            ` : ''}
                            ${fullLog.record_id ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Record ID:</span>
                                    <span style="font-family: monospace;">${fullLog.record_id}</span>
                                </div>
                            ` : ''}
                            ${fullLog.details?.page || fullLog.details?.tab || fullLog.details?.last_page ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Page/View:</span>
                                    <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color)15; color: var(--accent-color); border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">📄 ${fullLog.details?.page || fullLog.details?.tab || fullLog.details?.last_page}</span>
                                </div>
                            ` : ''}
                            ${fullLog.details?._description ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Description:</span>
                                    <span style="font-size: 12px; color: var(--text-primary);">${fullLog.details._description}</span>
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
                                <span>${fullLog.user_id || 'N/A'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Username:</span>
                                <span>${fullLog.username || 'Anonymous'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">IP Address:</span>
                                <span style="font-family: monospace;">${fullLog.ip_address || 'N/A'}</span>
                            </div>
                            ${fullLog.geo_location ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Location:</span>
                                    <span>${fullLog.geo_location.city}, ${fullLog.geo_location.region}, ${fullLog.geo_location.country}</span>
                                </div>
                                ${fullLog.geo_location.lat && fullLog.geo_location.lon ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Coordinates:</span>
                                        <span style="font-family: monospace;">${fullLog.geo_location.lat.toFixed(4)}, ${fullLog.geo_location.lon.toFixed(4)}</span>
                                    </div>
                                ` : ''}
                            ` : ''}
                        </div>
                    </div>

                    <!-- Map -->
                    ${fullLog.geo_location && fullLog.geo_location.lat && fullLog.geo_location.lon ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">🗺️ Location Map</h3>
                            <div id="audit-log-location-map" style="height: 300px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);"></div>
                        </div>
                    ` : ''}

                    <!-- Device Info -->
                    ${fullLog.device_info ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Device Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Browser:</span>
                                    <span>${fullLog.device_info.browser || 'Unknown'}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">OS:</span>
                                    <span>${fullLog.device_info.os || 'Unknown'}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Device:</span>
                                    <span>${fullLog.device_info.device || 'Unknown'}</span>
                                </div>
                                ${fullLog.user_agent ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">User Agent:</span>
                                        <span style="font-family: monospace; font-size: 10px; word-break: break-all;">${fullLog.user_agent}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Request Information -->
                    ${fullLog.request_method || fullLog.request_endpoint || fullLog.referrer || fullLog.session_id || fullLog.request_query ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Request Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.request_method ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Method:</span>
                                        <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color)20; color: var(--accent-color); border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.request_method}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_endpoint ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Endpoint:</span>
                                        <span style="font-family: monospace; font-size: 11px;">${fullLog.request_endpoint}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_query ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Query Params:</span>
                                        <span style="font-family: monospace; font-size: 11px; word-break: break-all;">${fullLog.request_query || '(none)'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.referrer ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Referrer:</span>
                                        <span style="font-family: monospace; font-size: 11px; word-break: break-all;">${fullLog.referrer}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.session_id ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Session ID:</span>
                                        <span style="font-family: monospace; font-size: 11px;">${fullLog.session_id}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_size ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Request Size:</span>
                                        <span>${fullLog.request_size} bytes</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Details -->
                    ${fullLog.details ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Additional Details</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
                                <pre style="margin: 0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: var(--text-primary);">${JSON.stringify(fullLog.details, null, 2)}</pre>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Error Message -->
                    ${fullLog.error_message ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--danger-color); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">❌ Error Message</h3>
                            <div style="background: var(--danger-color)10; border-left: 4px solid var(--danger-color); padding: 15px; border-radius: 8px;">
                                <pre style="margin: 0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: var(--danger-color);">${fullLog.error_message}</pre>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add to document if new
        if (!isExisting) {
            document.body.appendChild(modal);

            // Setup one-time event handlers for new modal
            // Keyboard navigation
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    // Clean up map before closing
                    if (currentAuditLogMap) {
                        currentAuditLogMap.remove();
                        currentAuditLogMap = null;
                    }
                    modal.remove();
                    document.removeEventListener('keydown', keyHandler);
                } else if (e.key === 'ArrowLeft') {
                    // Previous = earlier in time (higher index)
                    const currentIndex = parseInt(modal.dataset.currentIndex || '0');
                    if (currentIndex < currentAuditLogs.length - 1) {
                        showAuditLogDetailsWithNavigation(currentIndex + 1);
                    }
                } else if (e.key === 'ArrowRight') {
                    // Next = later in time (lower index)
                    const currentIndex = parseInt(modal.dataset.currentIndex || '0');
                    if (currentIndex > 0) {
                        showAuditLogDetailsWithNavigation(currentIndex - 1);
                    }
                }
            };
            document.addEventListener('keydown', keyHandler);
            modal.dataset.keyHandler = 'attached';

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    // Clean up map before closing
                    if (currentAuditLogMap) {
                        currentAuditLogMap.remove();
                        currentAuditLogMap = null;
                    }
                    modal.remove();
                    document.removeEventListener('keydown', keyHandler);
                }
            });
        }

        // Store current index on modal for keyboard navigation
        modal.dataset.currentIndex = logIndex;

        // Scroll to bottom of modal content (use setTimeout to ensure rendering is complete)
        const modalContent = modal.querySelector('.audit-log-details-content');
        if (modalContent) {
            setTimeout(() => {
                modalContent.scrollTop = modalContent.scrollHeight;
            }, 50);
        }

        // Setup/update close button handlers
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.replaceWith(newBtn);
            newBtn.addEventListener('click', () => {
                // Clean up map before closing
                if (currentAuditLogMap) {
                    currentAuditLogMap.remove();
                    currentAuditLogMap = null;
                }
                modal.remove();
                // Keyboard handler cleanup is handled by modal removal
            });
        });

        // Previous button handlers (earlier in time = higher index) - attach to ALL prev buttons
        const prevBtns = Array.from(modal.querySelectorAll('.prev-log-btn'));
        for (const prevBtn of prevBtns) {
            // Remove old listeners by cloning
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);

            if (hasPrev) {
                newPrevBtn.addEventListener('click', () => {
                    showAuditLogDetailsWithNavigation(logIndex + 1);
                });
                newPrevBtn.addEventListener('mouseenter', () => newPrevBtn.style.background = 'var(--bg-primary)');
                newPrevBtn.addEventListener('mouseleave', () => newPrevBtn.style.background = 'var(--bg-tertiary)');
            }
        }

        // Next button handlers (later in time = lower index) - attach to ALL next buttons
        const nextBtns = Array.from(modal.querySelectorAll('.next-log-btn'));
        for (const nextBtn of nextBtns) {
            // Remove old listeners by cloning
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

            if (hasNext) {
                newNextBtn.addEventListener('click', () => {
                    showAuditLogDetailsWithNavigation(logIndex - 1);
                });
                newNextBtn.addEventListener('mouseenter', () => newNextBtn.style.background = 'var(--bg-primary)');
                newNextBtn.addEventListener('mouseleave', () => newNextBtn.style.background = 'var(--bg-tertiary)');
            }
        }

        // Initialize map if coordinates are available
        if (fullLog.geo_location && fullLog.geo_location.lat && fullLog.geo_location.lon) {
            setTimeout(() => {
                const mapContainer = document.getElementById('audit-log-location-map');
                if (mapContainer && typeof L !== 'undefined') {
                    try {
                        // Clean up old map instance if it exists
                        if (currentAuditLogMap) {
                            currentAuditLogMap.remove();
                            currentAuditLogMap = null;
                        }

                        // Create new map
                        currentAuditLogMap = L.map('audit-log-location-map').setView(
                            [fullLog.geo_location.lat, fullLog.geo_location.lon],
                            10
                        );

                        const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
                        const tileLayerUrl = isDarkMode 
                            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

                        L.tileLayer(tileLayerUrl, {
                            attribution: '© OpenStreetMap contributors © CARTO',
                            maxZoom: 19,
                            crossOrigin: true
                        }).addTo(currentAuditLogMap);

                        const customIcon = L.divIcon({
                            className: 'custom-marker',
                            html: '<div style="background: #00ddff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 0 15px rgba(0, 221, 255, 0.6), 0 2px 8px rgba(0,0,0,0.8);"></div>',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });

                        const marker = L.marker([fullLog.geo_location.lat, fullLog.geo_location.lon], { icon: customIcon }).addTo(currentAuditLogMap);

                        marker.bindPopup(`
                            <div style="text-align: center; padding: 8px; background: #1a1a1a; color: #ffffff; border-radius: 6px;">
                                <strong style="font-size: 14px; color: #00ddff; text-shadow: 0 0 8px rgba(0, 221, 255, 0.6);">${fullLog.geo_location.city}</strong><br>
                                <span style="font-size: 12px; color: #aaaaaa;">${fullLog.geo_location.region}, ${fullLog.geo_location.country}</span><br>
                                <span style="font-size: 11px; color: #00ddff; font-family: monospace; text-shadow: 0 0 6px rgba(0, 221, 255, 0.4);">${fullLog.ip_address}</span>
                            </div>
                        `).openPopup();

                        // Scroll to bottom after map is rendered
                        setTimeout(() => {
                            if (modalContent) {
                                modalContent.scrollTop = modalContent.scrollHeight;
                            }
                        }, 100);
                    } catch (error) {
                        console.error('Failed to initialize map:', error);
                        mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--danger-color);">Failed to load map</div>';
                    }
                }
            }, 100);
        }

        // Reset navigation flag after a small delay to prevent rapid-fire requests
        setTimeout(() => {
            isNavigating = false;
        }, 300);

    } catch (error) {
        console.error('Failed to load log details:', error);

        // Handle rate limiting specifically
        if (error.message && error.message.includes('429')) {
            showError('Too many requests. Please wait a moment before navigating.');
        } else {
            showError(`Failed to load log details: ${error.message}`);
        }

        // Reset navigation flag on error after delay
        setTimeout(() => {
            isNavigating = false;
        }, 500);
    }
}

/**
 * Show log details modal
 */
export async function showLogDetails(logId) {
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
                            ${log.details?.page || log.details?.tab || log.details?.last_page ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Page/View:</span>
                                    <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color)15; color: var(--accent-color); border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">📄 ${log.details?.page || log.details?.tab || log.details?.last_page}</span>
                                </div>
                            ` : ''}
                            ${log.details?._description ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Description:</span>
                                    <span style="font-size: 12px; color: var(--text-primary);">${log.details._description}</span>
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

                        const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
                        const tileLayerUrl = isDarkMode 
                            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

                        // Add CartoDB tile layer
                        L.tileLayer(tileLayerUrl, {
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
 * Show IP list view modal with drill-down capabilities
 */
export async function showIPListView(days = null) {
    try {
        // Fetch all unique IP locations directly from the server
        let url = '/api/admin/logs/ip-locations';
        if (days) {
            url += `?days=${days}`;
        }
        const response = await apiClient.get(url);
        const uniqueIPs = response.locations || [];

        if (uniqueIPs.length === 0) {
            showError('No IP addresses available to display');
            return;
        }

        // Sort by access count descending by default
        uniqueIPs.sort((a, b) => b.count - a.count);

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'ip-list-modal';
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
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; width: 90%; max-width: 1200px; max-height: 90vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 20px;">🌐 Unique IP Addresses (${uniqueIPs.length} Total)</h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="view-map-btn" style="padding: 10px 20px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;">
                            🗺️ View Map
                        </button>
                        <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                    </div>
                </div>

                <div style="margin-bottom: 15px; display: flex; gap: 10px;">
                    <input type="text" id="ip-search-input" placeholder="Search by IP address, city, or country..." style="flex: 1; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                    <select id="ip-sort-select" style="padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer;">
                        <option value="count-desc">Most Active First</option>
                        <option value="count-asc">Least Active First</option>
                        <option value="ip-asc">IP Address (A-Z)</option>
                        <option value="ip-desc">IP Address (Z-A)</option>
                        <option value="country-asc">Country (A-Z)</option>
                        <option value="country-desc">Country (Z-A)</option>
                    </select>
                </div>

                <div id="ip-list-container" style="flex: 1; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary);">
                    <!-- IP list will be rendered here -->
                </div>

                <div style="margin-top: 15px; text-align: center;">
                    <button class="close-modal-btn" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(modal);

        // Render IP list
        const renderIPList = (ips) => {
            const listContainer = modal.querySelector('#ip-list-container');

            if (ips.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
                        <div>No IP addresses match your search</div>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 1;">
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="text-align: left; padding: 12px 20px; font-size: 12px; font-weight: 600;">IP Address</th>
                            <th style="text-align: left; padding: 12px 20px; font-size: 12px; font-weight: 600;">Location</th>
                            <th style="text-align: center; padding: 12px 20px; font-size: 12px; font-weight: 600;">Access Count</th>
                            <th style="text-align: center; padding: 12px 20px; font-size: 12px; font-weight: 600;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ips.map((ipData) => `
                            <tr class="ip-list-row" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;"
                                onmouseenter="this.style.background='var(--bg-tertiary)'"
                                onmouseleave="this.style.background='transparent'">
                                <td style="padding: 12px 20px;">
                                    <span style="font-family: monospace; font-weight: 600; color: var(--accent-color);">${ipData.ip}</span>
                                </td>
                                <td style="padding: 12px 20px; font-size: 14px;">
                                    <div style="font-weight: 500;">${ipData.city}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${ipData.region}, ${ipData.country}</div>
                                </td>
                                <td style="padding: 12px 20px; text-align: center;">
                                    <span style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${ipData.count.toLocaleString()}</span>
                                </td>
                                <td style="padding: 12px 20px; text-align: center;">
                                    <button class="view-ip-details-btn" data-ip="${ipData.ip}" data-city="${ipData.city}" data-region="${ipData.region}" data-country="${ipData.country}"
                                            style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: opacity 0.2s;">
                                        📋 View Details
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Setup click handlers for detail buttons
            listContainer.querySelectorAll('.view-ip-details-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const ip = btn.getAttribute('data-ip');
                    const city = btn.getAttribute('data-city');
                    const region = btn.getAttribute('data-region');
                    const country = btn.getAttribute('data-country');
                    showIPAccessDetails(ip, city, region, country);
                });
                btn.addEventListener('mouseenter', () => btn.style.opacity = '0.8');
                btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
            });

            // Make rows clickable too
            listContainer.querySelectorAll('.ip-list-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('view-ip-details-btn')) {
                        const btn = row.querySelector('.view-ip-details-btn');
                        btn.click();
                    }
                });
            });
        };

        // Initial render
        renderIPList(uniqueIPs);

        // Setup search functionality
        const searchInput = modal.querySelector('#ip-search-input');
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const filtered = uniqueIPs.filter(ip =>
                ip.ip.toLowerCase().includes(searchTerm) ||
                ip.city.toLowerCase().includes(searchTerm) ||
                ip.region.toLowerCase().includes(searchTerm) ||
                ip.country.toLowerCase().includes(searchTerm)
            );
            renderIPList(filtered);
        });

        // Setup sort functionality
        const sortSelect = modal.querySelector('#ip-sort-select');
        sortSelect.addEventListener('change', () => {
            const sortValue = sortSelect.value;
            const searchTerm = searchInput.value.toLowerCase();

            // Apply current filter
            let filtered = uniqueIPs.filter(ip =>
                ip.ip.toLowerCase().includes(searchTerm) ||
                ip.city.toLowerCase().includes(searchTerm) ||
                ip.region.toLowerCase().includes(searchTerm) ||
                ip.country.toLowerCase().includes(searchTerm)
            );

            // Apply sort
            switch(sortValue) {
                case 'count-desc':
                    filtered.sort((a, b) => b.count - a.count);
                    break;
                case 'count-asc':
                    filtered.sort((a, b) => a.count - b.count);
                    break;
                case 'ip-asc':
                    filtered.sort((a, b) => a.ip.localeCompare(b.ip));
                    break;
                case 'ip-desc':
                    filtered.sort((a, b) => b.ip.localeCompare(a.ip));
                    break;
                case 'country-asc':
                    filtered.sort((a, b) => a.country.localeCompare(b.country));
                    break;
                case 'country-desc':
                    filtered.sort((a, b) => b.country.localeCompare(a.country));
                    break;
            }

            renderIPList(filtered);
        });

        // Setup "View Map" button
        const viewMapBtn = modal.querySelector('#view-map-btn');
        viewMapBtn.addEventListener('click', async () => {
            modal.remove(); // Close list view
            await showIPLocationsMap(days); // Open map view with same filter
        });
        viewMapBtn.addEventListener('mouseenter', () => viewMapBtn.style.opacity = '0.8');
        viewMapBtn.addEventListener('mouseleave', () => viewMapBtn.style.opacity = '1');

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

    } catch (error) {
        console.error('Failed to load IP list:', error);
        showError(`Failed to load IP list: ${error.message}`);
    }
}

/**
 * Show IP locations map modal
 */
export async function showIPLocationsMap(days = null) {
    try {
        // Fetch all unique IP locations directly from the server
        let url = '/api/admin/logs/ip-locations';
        if (days) {
            url += `?days=${days}`;
        }
        const response = await apiClient.get(url);
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
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="view-list-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;">
                            📋 View List
                        </button>
                        <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                    </div>
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
                if (currentIPMap) {
                    currentIPMap.remove();
                    currentIPMap = null;
                }
                modal.remove();
            });
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (currentIPMap) {
                    currentIPMap.remove();
                    currentIPMap = null;
                }
                modal.remove();
            }
        });

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                if (currentIPMap) {
                    currentIPMap.remove();
                    currentIPMap = null;
                }
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Setup "View List" button
        const viewListBtn = modal.querySelector('#view-list-btn');
        viewListBtn.addEventListener('click', async () => {
            if (currentIPMap) {
                currentIPMap.remove();
                currentIPMap = null;
            }
            modal.remove(); // Close map view
            await showIPListView(days); // Open list view with same filter
        });
        viewListBtn.addEventListener('mouseenter', () => viewListBtn.style.background = 'var(--border-color)');
        viewListBtn.addEventListener('mouseleave', () => viewListBtn.style.background = 'var(--bg-tertiary)');

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
                    currentIPMap = L.map('ip-locations-map').setView([centerLat, centerLon], 2);

                    const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
                    const tileLayerUrl = isDarkMode 
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

                    // Add CartoDB tile layer
                    L.tileLayer(tileLayerUrl, {
                        attribution: '© OpenStreetMap contributors © CARTO',
                        maxZoom: 19,
                        crossOrigin: true
                    }).addTo(currentIPMap);

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

                        const marker = L.marker([ipData.lat, ipData.lon], { icon: customIcon }).addTo(currentIPMap);

                        // Add popup with IP details - access count is clickable
                        const popupContent = `
                            <div style="text-align: center; padding: 10px; min-width: 220px; background: #1a1a1a; color: #ffffff; border-radius: 8px;">
                                <div style="font-size: 16px; font-weight: 700; margin-bottom: 10px; color: ${labelColor}; font-family: monospace; text-shadow: 0 0 8px ${glowColor};">${ipData.ip}</div>
                                <div style="font-size: 15px; font-weight: 600; margin-bottom: 5px; color: #ffffff;">${ipData.city}</div>
                                <div style="font-size: 13px; color: #aaaaaa; margin-bottom: 10px;">${ipData.region}, ${ipData.country}</div>
                                <button class="view-ip-logs-btn" data-ip="${ipData.ip}" style="padding: 10px 16px; background: ${markerColor}; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; width: 100%; transition: opacity 0.2s; box-shadow: 0 0 10px ${glowColor}; color: #000000;">
                                    📋 ${ipData.count} access${ipData.count !== 1 ? 'es' : ''}
                                </button>
                            </div>
                        `;

                        marker.bindPopup(popupContent);

                        // Add click handler for the access count button
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
                        currentIPMap.fitBounds(group.getBounds().pad(0.1));
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
 * Show log details modal with navigation (for IP access details)
 */
async function showLogDetailsWithNavigation(logIndex) {
    const log = currentIPLogs[logIndex];
    if (!log) return;

    // Prevent rapid navigation to avoid rate limiting
    if (isNavigating) return;
    isNavigating = true;

    // Previous = earlier in time (higher index, older logs)
    // Next = later in time (lower index, newer logs)
    const hasPrev = logIndex < currentIPLogs.length - 1;
    const hasNext = logIndex > 0;

    try {
        // Check cache first to avoid unnecessary API calls
        let fullLog = logDetailsCache.get(log.id);

        if (!fullLog) {
            // Fetch full log details from API only if not cached
            fullLog = await apiClient.get(`/api/admin/logs/${log.id}`);
            // Cache the result
            logDetailsCache.set(log.id, fullLog);
        }

        // Check if modal already exists
        let modal = document.querySelector('.log-details-modal.ip-log-modal');
        const isExisting = !!modal;

        if (!modal) {
            // Create modal
            modal = document.createElement('div');
            modal.className = 'log-details-modal ip-log-modal';
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
        }

        const timestamp = new Date(fullLog.created_at).toLocaleString();
        const actionColor = getActionColor(fullLog.action);
        const statusColor = fullLog.status_code >= 400 ? 'var(--danger-color)' : 'var(--success-color)';

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h2 style="margin: 0; font-size: 20px;">📋 Audit Log Details</h2>
                        <span style="font-size: 12px; color: var(--text-secondary); font-weight: 400;">(${logIndex + 1} of ${currentIPLogs.length})</span>
                    </div>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
                </div>

                <!-- Navigation Buttons (Top) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 10px 15px; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="display: flex; gap: 10px;">
                        <button class="prev-log-btn" ${!hasPrev ? 'disabled' : ''} style="padding: 8px 16px; background: ${hasPrev ? 'var(--bg-secondary)' : 'var(--bg-primary)'}; color: ${hasPrev ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasPrev ? 'pointer' : 'not-allowed'}; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            ← Previous
                        </button>
                        <button class="next-log-btn" ${!hasNext ? 'disabled' : ''} style="padding: 8px 16px; background: ${hasNext ? 'var(--bg-secondary)' : 'var(--bg-primary)'}; color: ${hasNext ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasNext ? 'pointer' : 'not-allowed'}; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            Next →
                        </button>
                    </div>
                    <button class="close-modal-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        Close
                    </button>
                </div>

                <div style="display: grid; gap: 20px;">
                    <!-- Basic Info -->
                    <div>
                        <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Basic Information</h3>
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Log ID:</span>
                                <span style="font-family: monospace;">${fullLog.id}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Timestamp:</span>
                                <span>${timestamp}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Action:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.action}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Status Code:</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.status_code || 'N/A'}</span>
                            </div>
                            ${fullLog.table_name ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Table:</span>
                                    <span style="font-family: monospace;">${fullLog.table_name}</span>
                                </div>
                            ` : ''}
                            ${fullLog.details?.page || fullLog.details?.tab || fullLog.details?.last_page ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Page/View:</span>
                                    <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color)15; color: var(--accent-color); border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">📄 ${fullLog.details?.page || fullLog.details?.tab || fullLog.details?.last_page}</span>
                                </div>
                            ` : ''}
                            ${fullLog.details?._description ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Description:</span>
                                    <span style="font-size: 12px; color: var(--text-primary);">${fullLog.details._description}</span>
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
                                <span>${fullLog.user_id || 'N/A'}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                <span style="font-weight: 600; color: var(--text-secondary);">Username:</span>
                                <span>${fullLog.username || 'Anonymous'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Network Info -->
                    ${fullLog.ip_address ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Network Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">IP Address:</span>
                                    <span style="font-family: monospace;">${fullLog.ip_address}</span>
                                </div>
                                ${fullLog.geo_location ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Location:</span>
                                        <span>${fullLog.geo_location.city || 'Unknown'}, ${fullLog.geo_location.region || 'Unknown'}, ${fullLog.geo_location.country || 'Unknown'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.user_agent ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">User Agent:</span>
                                        <span style="font-family: monospace; font-size: 10px; word-break: break-all;">${fullLog.user_agent}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Request Information -->
                    ${fullLog.request_method || fullLog.request_endpoint || fullLog.referrer || fullLog.session_id || fullLog.request_query ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Request Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.request_method ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Method:</span>
                                        <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color)20; color: var(--accent-color); border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.request_method}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_endpoint ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Endpoint:</span>
                                        <span style="font-family: monospace; font-size: 11px;">${fullLog.request_endpoint}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_query ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Query Params:</span>
                                        <span style="font-family: monospace; font-size: 11px; word-break: break-all;">${fullLog.request_query || '(none)'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.referrer ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Referrer:</span>
                                        <span style="font-family: monospace; font-size: 11px; word-break: break-all;">${fullLog.referrer}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.session_id ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Session ID:</span>
                                        <span style="font-family: monospace; font-size: 11px;">${fullLog.session_id}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.request_size ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Request Size:</span>
                                        <span>${fullLog.request_size} bytes</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Device & Browser Information -->
                    ${fullLog.device_info ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Device & Browser Information</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.device_info.browser ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Browser:</span>
                                        <span>${fullLog.device_info.browser} ${fullLog.device_info.browser_version || ''}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.device_info.os ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Operating System:</span>
                                        <span>${fullLog.device_info.os} ${fullLog.device_info.os_version || ''}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.device_info.device ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Device:</span>
                                        <span>${fullLog.device_info.device}${fullLog.device_info.device_brand !== 'Unknown' ? ` (${fullLog.device_info.device_brand})` : ''}</span>
                                    </div>
                                ` : ''}
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">Device Type:</span>
                                    <span>${fullLog.device_info.is_mobile ? '📱 Mobile' : fullLog.device_info.is_tablet ? '📱 Tablet' : fullLog.device_info.is_pc ? '💻 Desktop' : fullLog.device_info.is_bot ? '🤖 Bot' : 'Unknown'}</span>
                                </div>
                                ${fullLog.device_info.fingerprint ? `
                                    ${fullLog.device_info.fingerprint.screen_resolution ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Screen Resolution:</span>
                                            <span>${fullLog.device_info.fingerprint.screen_resolution}</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.device_info.fingerprint.viewport_size ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Viewport Size:</span>
                                            <span>${fullLog.device_info.fingerprint.viewport_size}</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.device_info.fingerprint.device_pixel_ratio ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Pixel Ratio:</span>
                                            <span>${fullLog.device_info.fingerprint.device_pixel_ratio}x</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.device_info.fingerprint.color_depth ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Color Depth:</span>
                                            <span>${fullLog.device_info.fingerprint.color_depth}-bit</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.device_info.fingerprint.primary_language ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Language:</span>
                                            <span>${fullLog.device_info.fingerprint.primary_language}</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.device_info.fingerprint.timezone_offset_hours !== undefined ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Timezone Offset:</span>
                                            <span>UTC${fullLog.device_info.fingerprint.timezone_offset_hours >= 0 ? '+' : ''}${fullLog.device_info.fingerprint.timezone_offset_hours}</span>
                                        </div>
                                    ` : ''}
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Do Not Track:</span>
                                        <span>${fullLog.device_info.fingerprint.dnt_enabled ? '✅ Enabled' : '❌ Disabled'}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Client Fingerprint Details (from details.client_fingerprint) -->
                    ${fullLog.details?.client_fingerprint ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Client Fingerprint</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.details.client_fingerprint.composite_hash ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Fingerprint Hash:</span>
                                        <span style="font-family: monospace;">${fullLog.details.client_fingerprint.composite_hash}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.canvas_hash ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Canvas Hash:</span>
                                        <span style="font-family: monospace;">${fullLog.details.client_fingerprint.canvas_hash}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.audio_hash ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Audio Hash:</span>
                                        <span style="font-family: monospace;">${fullLog.details.client_fingerprint.audio_hash}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.webgl_vendor ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">WebGL Vendor:</span>
                                        <span style="font-size: 11px;">${fullLog.details.client_fingerprint.webgl_vendor}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.webgl_renderer ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">WebGL Renderer:</span>
                                        <span style="font-size: 11px;">${fullLog.details.client_fingerprint.webgl_renderer}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.font_count ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Detected Fonts:</span>
                                        <span>${fullLog.details.client_fingerprint.font_count} fonts</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.cpu_cores ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">CPU Cores:</span>
                                        <span>${fullLog.details.client_fingerprint.cpu_cores}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.device_memory ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Device Memory:</span>
                                        <span>${fullLog.details.client_fingerprint.device_memory} GB</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.touch_points !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Touch Points:</span>
                                        <span>${fullLog.details.client_fingerprint.touch_points}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.color_scheme ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Color Scheme:</span>
                                        <span>${fullLog.details.client_fingerprint.color_scheme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.reduced_motion !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Reduced Motion:</span>
                                        <span>${fullLog.details.client_fingerprint.reduced_motion ? '✅ Enabled' : '❌ Disabled'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.webdriver !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">WebDriver:</span>
                                        <span style="color: ${fullLog.details.client_fingerprint.webdriver ? 'var(--danger-color)' : 'var(--success-color)'};">${fullLog.details.client_fingerprint.webdriver ? '⚠️ Detected (Bot?)' : '✅ Not Detected'}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.network_type ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Network Type:</span>
                                        <span>${fullLog.details.client_fingerprint.network_type}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.network_downlink ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Downlink Speed:</span>
                                        <span>${fullLog.details.client_fingerprint.network_downlink} Mbps</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.client_fingerprint.network_rtt ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Network RTT:</span>
                                        <span>${fullLog.details.client_fingerprint.network_rtt} ms</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Session Analytics -->
                    ${fullLog.details?.session_analytics ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Session Analytics</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.details.session_analytics.engagement_score !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Engagement Score:</span>
                                        <span>
                                            <span style="display: inline-block; padding: 4px 12px; background: ${fullLog.details.session_analytics.engagement_score >= 70 ? 'var(--success-color)' : fullLog.details.session_analytics.engagement_score >= 40 ? 'var(--warning-color)' : 'var(--danger-color)'}20; color: ${fullLog.details.session_analytics.engagement_score >= 70 ? 'var(--success-color)' : fullLog.details.session_analytics.engagement_score >= 40 ? 'var(--warning-color)' : 'var(--danger-color)'}; border-radius: 4px; font-size: 12px; font-weight: 600;">${fullLog.details.session_analytics.engagement_score}/100</span>
                                        </span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.session_analytics.total_clicks !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Total Clicks:</span>
                                        <span>${fullLog.details.session_analytics.total_clicks}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.session_analytics.total_key_presses !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Key Presses:</span>
                                        <span>${fullLog.details.session_analytics.total_key_presses}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.session_analytics.max_scroll_depth !== undefined ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Max Scroll Depth:</span>
                                        <span>${fullLog.details.session_analytics.max_scroll_depth}%</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.session_analytics.scroll_milestones?.length ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Scroll Milestones:</span>
                                        <span>${fullLog.details.session_analytics.scroll_milestones.map(m => m + '%').join(', ')}</span>
                                    </div>
                                ` : ''}
                                ${fullLog.details.session_analytics.last_page ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Last Page:</span>
                                        <span>${fullLog.details.session_analytics.last_page}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Performance Metrics -->
                    ${fullLog.details?.performance_metrics || fullLog.details?.performance ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Performance Metrics</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${(fullLog.details.performance_metrics?.navigation || fullLog.details.performance?.navigation) ? (() => {
                                    const nav = fullLog.details.performance_metrics?.navigation || fullLog.details.performance?.navigation;
                                    return `
                                        ${nav.ttfb !== undefined ? `
                                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                                <span style="font-weight: 600; color: var(--text-secondary);">Time to First Byte:</span>
                                                <span>${nav.ttfb} ms</span>
                                            </div>
                                        ` : ''}
                                        ${nav.dom_interactive !== undefined ? `
                                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                                <span style="font-weight: 600; color: var(--text-secondary);">DOM Interactive:</span>
                                                <span>${nav.dom_interactive} ms</span>
                                            </div>
                                        ` : ''}
                                        ${nav.dom_complete !== undefined ? `
                                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                                <span style="font-weight: 600; color: var(--text-secondary);">DOM Complete:</span>
                                                <span>${nav.dom_complete} ms</span>
                                            </div>
                                        ` : ''}
                                        ${nav.load_complete !== undefined ? `
                                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                                <span style="font-weight: 600; color: var(--text-secondary);">Page Load:</span>
                                                <span style="color: ${nav.load_complete < 2000 ? 'var(--success-color)' : nav.load_complete < 5000 ? 'var(--warning-color)' : 'var(--danger-color)'};">${nav.load_complete} ms</span>
                                            </div>
                                        ` : ''}
                                        ${nav.transfer_size !== undefined ? `
                                            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                                <span style="font-weight: 600; color: var(--text-secondary);">Transfer Size:</span>
                                                <span>${(nav.transfer_size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        ` : ''}
                                    `;
                                })() : ''}
                                ${(fullLog.details.performance_metrics?.first_contentful_paint || fullLog.details.performance?.first_contentful_paint) ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">First Contentful Paint:</span>
                                        <span>${fullLog.details.performance_metrics?.first_contentful_paint || fullLog.details.performance?.first_contentful_paint} ms</span>
                                    </div>
                                ` : ''}
                                ${(fullLog.details.performance_metrics?.resources || fullLog.details.performance?.resources) ? (() => {
                                    const res = fullLog.details.performance_metrics?.resources || fullLog.details.performance?.resources;
                                    return `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Resources Loaded:</span>
                                            <span>${res.count} (${(res.total_transfer_size / 1024).toFixed(1)} KB total)</span>
                                        </div>
                                    `;
                                })() : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Risk Assessment / IP Intelligence -->
                    ${fullLog.details?.risk_assessment || fullLog.details?.ip_intelligence ? `
                        <div>
                            <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Security Assessment</h3>
                            <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                                ${fullLog.details.risk_assessment ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">Risk Score:</span>
                                        <span style="display: inline-block; padding: 4px 12px; background: ${fullLog.details.risk_assessment.level === 'high' ? 'var(--danger-color)' : fullLog.details.risk_assessment.level === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}20; color: ${fullLog.details.risk_assessment.level === 'high' ? 'var(--danger-color)' : fullLog.details.risk_assessment.level === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${fullLog.details.risk_assessment.score}/100 (${fullLog.details.risk_assessment.level})</span>
                                    </div>
                                    ${fullLog.details.risk_assessment.factors?.length ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Risk Factors:</span>
                                            <span>${fullLog.details.risk_assessment.factors.join(', ')}</span>
                                        </div>
                                    ` : ''}
                                ` : ''}
                                ${fullLog.details.ip_intelligence?.ip_analysis ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">IP Type:</span>
                                        <span>${fullLog.details.ip_intelligence.ip_analysis.type}</span>
                                    </div>
                                    ${fullLog.details.ip_intelligence.ip_analysis.reverse_dns ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Reverse DNS:</span>
                                            <span style="font-family: monospace; font-size: 11px;">${fullLog.details.ip_intelligence.ip_analysis.reverse_dns}</span>
                                        </div>
                                    ` : ''}
                                    ${fullLog.details.ip_intelligence.ip_analysis.risk_indicators?.length ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">IP Indicators:</span>
                                            <span>${fullLog.details.ip_intelligence.ip_analysis.risk_indicators.join(', ')}</span>
                                        </div>
                                    ` : ''}
                                ` : ''}
                                ${fullLog.details.ip_intelligence?.vpn_detection ? `
                                    <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                        <span style="font-weight: 600; color: var(--text-secondary);">VPN/Proxy:</span>
                                        <span style="color: ${fullLog.details.ip_intelligence.vpn_detection.is_vpn || fullLog.details.ip_intelligence.vpn_detection.is_proxy ? 'var(--warning-color)' : 'var(--success-color)'};">
                                            ${fullLog.details.ip_intelligence.vpn_detection.is_vpn ? '⚠️ VPN Detected' : fullLog.details.ip_intelligence.vpn_detection.is_proxy ? '⚠️ Proxy Detected' : '✅ Direct Connection'}
                                            ${fullLog.details.ip_intelligence.vpn_detection.confidence ? ` (${fullLog.details.ip_intelligence.vpn_detection.confidence}% confidence)` : ''}
                                        </span>
                                    </div>
                                    ${fullLog.details.ip_intelligence.vpn_detection.indicators?.length ? `
                                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                            <span style="font-weight: 600; color: var(--text-secondary);">Detection Indicators:</span>
                                            <span>${fullLog.details.ip_intelligence.vpn_detection.indicators.join(', ')}</span>
                                        </div>
                                    ` : ''}
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Navigation & Close Buttons -->
                <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                        <button class="prev-log-btn" ${!hasPrev ? 'disabled' : ''} style="padding: 10px 20px; background: ${hasPrev ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}; color: ${hasPrev ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasPrev ? 'pointer' : 'not-allowed'}; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            ← Previous
                        </button>
                        <button class="next-log-btn" ${!hasNext ? 'disabled' : ''} style="padding: 10px 20px; background: ${hasNext ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}; color: ${hasNext ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasNext ? 'pointer' : 'not-allowed'}; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                            Next →
                        </button>
                    </div>
                    <button class="close-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add to document if new
        if (!isExisting) {
            document.body.appendChild(modal);

            // Setup one-time event handlers for new modal
            // Keyboard navigation
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', keyHandler);
                } else if (e.key === 'ArrowLeft') {
                    // Previous = earlier in time (higher index)
                    const currentIndex = parseInt(modal.dataset.currentIndex || '0');
                    if (currentIndex < currentIPLogs.length - 1) {
                        showLogDetailsWithNavigation(currentIndex + 1);
                    }
                } else if (e.key === 'ArrowRight') {
                    // Next = later in time (lower index)
                    const currentIndex = parseInt(modal.dataset.currentIndex || '0');
                    if (currentIndex > 0) {
                        showLogDetailsWithNavigation(currentIndex - 1);
                    }
                }
            };
            document.addEventListener('keydown', keyHandler);
            modal.dataset.keyHandler = 'attached';

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    document.removeEventListener('keydown', keyHandler);
                }
            });
        }

        // Store current index on modal for keyboard navigation
        modal.dataset.currentIndex = logIndex;

        // Setup/update close button handlers
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.replaceWith(newBtn);
            newBtn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // Previous button handlers (earlier in time = higher index) - attach to ALL prev buttons
        const prevBtns = Array.from(modal.querySelectorAll('.prev-log-btn'));
        for (const prevBtn of prevBtns) {
            // Remove old listeners by cloning
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);

            if (hasPrev) {
                newPrevBtn.addEventListener('click', () => {
                    showLogDetailsWithNavigation(logIndex + 1);
                });
                newPrevBtn.addEventListener('mouseenter', () => newPrevBtn.style.background = 'var(--bg-primary)');
                newPrevBtn.addEventListener('mouseleave', () => newPrevBtn.style.background = 'var(--bg-tertiary)');
            }
        }

        // Next button handlers (later in time = lower index) - attach to ALL next buttons
        const nextBtns = Array.from(modal.querySelectorAll('.next-log-btn'));
        for (const nextBtn of nextBtns) {
            // Remove old listeners by cloning
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

            if (hasNext) {
                newNextBtn.addEventListener('click', () => {
                    showLogDetailsWithNavigation(logIndex - 1);
                });
                newNextBtn.addEventListener('mouseenter', () => newNextBtn.style.background = 'var(--bg-primary)');
                newNextBtn.addEventListener('mouseleave', () => newNextBtn.style.background = 'var(--bg-tertiary)');
            }
        }

        // Reset navigation flag after a small delay to prevent rapid-fire requests
        setTimeout(() => {
            isNavigating = false;
        }, 300);

    } catch (error) {
        console.error('Failed to load log details:', error);

        // Handle rate limiting specifically
        if (error.message && error.message.includes('429')) {
            showError('Too many requests. Please wait a moment before navigating.');
        } else {
            showError(`Failed to load log details: ${error.message}`);
        }

        // Reset navigation flag on error after delay
        setTimeout(() => {
            isNavigating = false;
        }, 500);
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

        // Store logs for navigation
        currentIPLogs = logs;

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
                            ${logs.map((log, index) => `
                                <tr class="access-log-row" data-log-id="${log.id}" data-log-index="${index}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseenter="this.style.background='var(--bg-tertiary)'" onmouseleave="this.style.background='transparent'">
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

        // Setup row click handlers to show log details with navigation
        modal.querySelectorAll('.access-log-row').forEach(row => {
            row.addEventListener('click', async (e) => {
                // Don't trigger if clicking the button directly
                if (e.target.classList.contains('view-log-detail-btn')) {
                    return;
                }
                const logIndex = parseInt(row.getAttribute('data-log-index'));
                if (logIndex >= 0 && logIndex < currentIPLogs.length) {
                    await showLogDetailsWithNavigation(logIndex);
                }
            });
        });

        // Setup button click handlers
        modal.querySelectorAll('.view-log-detail-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent row click from also firing
                const row = btn.closest('.access-log-row');
                const logIndex = parseInt(row?.getAttribute('data-log-index'));
                if (logIndex >= 0 && logIndex < currentIPLogs.length) {
                    await showLogDetailsWithNavigation(logIndex);
                }
            });
        });

    } catch (error) {
        console.error('Failed to load IP access details:', error);
        showError(`Failed to load access details: ${error.message}`);
    }
}
