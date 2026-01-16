/**
 * Audit Logs Viewer Component
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/formatters.js';

/**
 * Render logs viewer with filtering and pagination
 */
export async function renderLogsViewer(container) {
    container.innerHTML = `
        <!-- Filters -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin-bottom: 15px;">🔍 Filters</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">User ID</label>
                    <input type="number" id="filter-user-id" placeholder="Filter by user ID" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
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
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border-left: 4px solid var(--success-color);">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;">Unique IPs</div>
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
        const filters = {
            user_id: container.querySelector('#filter-user-id').value || undefined,
            action: container.querySelector('#filter-action').value || undefined,
            table_name: container.querySelector('#filter-table').value || undefined,
            ip_address: container.querySelector('#filter-ip').value || undefined,
            start_date: container.querySelector('#filter-start-date').value || undefined,
            end_date: container.querySelector('#filter-end-date').value || undefined,
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
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Timestamp</th>
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Action</th>
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">User</th>
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">IP / Location</th>
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Device</th>
                        <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Status</th>
                        <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Details</th>
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
            <td style="padding: 12px; font-size: 12px;">${log.user_id || 'Anonymous'}</td>
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
    // For now, just show alert - in production, create a proper modal
    // You could fetch the full log details from the API if needed
    alert(`Log details for log ID: ${logId}\n\nIn production, this would show a detailed modal with all log information.`);
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
