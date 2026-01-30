/**
 * User Activity Report Component
 * Displays comprehensive user activity with multi-user filtering
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

// Track selected users for filtering
let selectedUserIds = new Set();
let allUsers = [];

/**
 * Render user activity report with filtering
 */
export async function renderUserActivityReport(container) {
    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="font-size: 24px; font-weight: bold; margin: 0;">📊 User Activity Report</h2>
                <button id="export-activity-csv" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                    📥 Export CSV
                </button>
            </div>

            <!-- Filters Panel -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="font-size: 16px; margin-bottom: 15px;">🔍 Filters</h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 15px;">
                    <!-- User Selection -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Select Users (click to search)</label>
                        <div style="position: relative;" id="report-user-select-container">
                            <input
                                type="text"
                                id="user-search"
                                placeholder="Click to select or type to search..."
                                autocomplete="off"
                                style="width: 100%; padding: 8px 30px 8px 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer;"
                            >
                            <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none; font-size: 10px;">▼</span>
                            <div id="user-dropdown" style="
                                display: none;
                                position: absolute;
                                top: 100%;
                                left: 0;
                                right: 0;
                                background: var(--bg-tertiary);
                                border: 1px solid var(--border-color);
                                border-radius: 6px;
                                max-height: 250px;
                                overflow-y: auto;
                                z-index: 1000;
                                margin-top: 4px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            "></div>
                        </div>
                        <div id="selected-users" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px;"></div>
                    </div>

                    <!-- Date Range -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Start Date</label>
                        <input
                            type="date"
                            id="filter-start-date"
                            style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
                    </div>

                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">End Date</label>
                        <input
                            type="date"
                            id="filter-end-date"
                            style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
                    </div>

                    <!-- Quick Date Ranges -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Quick Range</label>
                        <select id="quick-range" style="width: 100%; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);">
                            <option value="">Custom</option>
                            <option value="7">Last 7 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="60">Last 60 days</option>
                            <option value="90">Last 90 days</option>
                        </select>
                    </div>
                </div>

                <!-- Action Type Filters -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600;">Action Types</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; border: 1px solid var(--border-color);">
                            <input type="checkbox" id="select-all-actions" style="cursor: pointer;">
                            <span style="font-size: 13px; font-weight: 700;">Select All</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="LOGIN_ATTEMPT" style="cursor: pointer;">
                            <span style="font-size: 13px;">Login Attempts</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="CREATE" style="cursor: pointer;">
                            <span style="font-size: 13px;">Create</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="UPDATE" style="cursor: pointer;">
                            <span style="font-size: 13px;">Update</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="DELETE" style="cursor: pointer;">
                            <span style="font-size: 13px;">Delete</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="READ" style="cursor: pointer;">
                            <span style="font-size: 13px;">Read</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" class="action-type-filter" value="ADMIN_ACCESS" style="cursor: pointer;">
                            <span style="font-size: 13px;">Admin Access</span>
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="apply-activity-filters" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Apply Filters
                    </button>
                    <button id="clear-activity-filters" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                        Clear
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div id="activity-loading" style="text-align: center; padding: 40px; display: none;">
                <div style="font-size: 18px; color: var(--text-secondary);">Loading report...</div>
            </div>

            <!-- Summary Statistics -->
            <div id="activity-summary" style="display: none;"></div>

            <!-- User Activity Table -->
            <div id="activity-table-container" style="display: none;"></div>
        </div>
    `;

    // Load all users for filtering
    await loadUsers();

    // Setup event handlers
    setupFilterHandlers(container);

    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    container.querySelector('#filter-start-date').value = startDate.toISOString().split('T')[0];
    container.querySelector('#filter-end-date').value = endDate.toISOString().split('T')[0];

    // Load initial report
    await loadActivityReport(container);
}

/**
 * Load all users for the filter dropdown
 */
async function loadUsers() {
    try {
        const response = await apiClient.get('/api/admin/users');
        allUsers = response.users || [];
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users for filtering');
    }
}

/**
 * Setup filter event handlers
 */
function setupFilterHandlers(container) {
    const userSearch = container.querySelector('#user-search');
    const userDropdown = container.querySelector('#user-dropdown');
    const quickRange = container.querySelector('#quick-range');
    const startDate = container.querySelector('#filter-start-date');
    const endDate = container.querySelector('#filter-end-date');

    const renderDropdown = (filterText = '') => {
        const lowerFilter = filterText.toLowerCase();
        // Filter users: match name/email AND not already selected
        const filtered = allUsers.filter(u => 
            !selectedUserIds.has(u.id) && 
            (u.username.toLowerCase().includes(lowerFilter) || 
             (u.email && u.email.toLowerCase().includes(lowerFilter)))
        ).slice(0, 50); // Limit to 50 for performance

        if (filtered.length === 0) {
            userDropdown.innerHTML = `<div style="padding: 12px; color: var(--text-secondary); text-align: center; font-size: 13px;">No users found</div>`;
            return;
        }

        userDropdown.innerHTML = filtered.map(user => `
            <div class="user-select-row" data-user-id="${user.id}" style="
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.2s;
            " onmouseenter="this.style.background='var(--bg-primary)'" onmouseleave="this.style.background='transparent'">
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(user.username)}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${user.email ? escapeHtml(user.email) : ''}</div>
                ${user.is_admin ? '<span style="font-size: 9px; background: #764ba222; color: #764ba2; padding: 1px 4px; border-radius: 3px;">ADMIN</span>' : ''}
            </div>
        `).join('');

        // Add click handlers
        userDropdown.querySelectorAll('.user-select-row').forEach(row => {
            row.addEventListener('click', () => {
                const userId = parseInt(row.dataset.userId);
                addSelectedUser(userId, container);
                userSearch.value = '';
                // Keep dropdown open if user wants to select more? No, usually close it.
                // But for multi-select, sometimes keeping it open is nice. 
                // Let's close it to be consistent with standard dropdowns.
                // But wait, if I click again it should open.
                // Let's hide it and user can click again.
                // Actually, re-rendering it with updated filter (removing selected) might be better UX?
                // Let's just hide it for now.
                userDropdown.style.display = 'none';
            });
        });
    };

    // Show dropdown on click/focus
    const showDropdown = () => {
        renderDropdown(''); // Show all (minus selected)
        userDropdown.style.display = 'block';
    };

    userSearch.addEventListener('focus', showDropdown);
    userSearch.addEventListener('click', showDropdown);

    // Filter on input
    userSearch.addEventListener('input', () => {
        renderDropdown(userSearch.value);
        userDropdown.style.display = 'block';
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userSearch.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.style.display = 'none';
        }
    });

    // Quick date range selector
    quickRange.addEventListener('change', (e) => {
        if (e.target.value) {
            const days = parseInt(e.target.value);
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - days);

            startDate.value = start.toISOString().split('T')[0];
            endDate.value = end.toISOString().split('T')[0];
        }
    });

    // Select All actions logic
    const selectAllCheckbox = container.querySelector('#select-all-actions');
    const actionCheckboxes = container.querySelectorAll('.action-type-filter');

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', () => {
            actionCheckboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
            });
        });

        // Update Select All state when individual boxes are clicked
        actionCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = Array.from(actionCheckboxes).every(c => c.checked);
                const someChecked = Array.from(actionCheckboxes).some(c => c.checked);
                selectAllCheckbox.checked = allChecked;
                selectAllCheckbox.indeterminate = someChecked && !allChecked;
            });
        });
    }

    // Apply filters
    container.querySelector('#apply-activity-filters').addEventListener('click', () => {
        loadActivityReport(container);
    });

    // Clear filters
    container.querySelector('#clear-activity-filters').addEventListener('click', () => {
        selectedUserIds.clear();
        container.querySelector('#selected-users').innerHTML = '';
        container.querySelector('#user-search').value = '';

        // Reset dates to last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        container.querySelector('#filter-start-date').value = startDate.toISOString().split('T')[0];
        container.querySelector('#filter-end-date').value = endDate.toISOString().split('T')[0];
        container.querySelector('#quick-range').value = '30';

        // Clear action type filters
        container.querySelectorAll('.action-type-filter').forEach(cb => cb.checked = false);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        loadActivityReport(container);
    });

    // Export CSV
    container.querySelector('#export-activity-csv').addEventListener('click', () => {
        exportActivityCSV(container);
    });
}

/**
 * Add a user to the selected users list
 */
function addSelectedUser(userId, container) {
    if (selectedUserIds.has(userId)) {
        return; // Already selected
    }

    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    selectedUserIds.add(userId);

    const selectedContainer = container.querySelector('#selected-users');
    const tag = document.createElement('div');
    tag.style.cssText = 'display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; background: var(--accent-color); color: white; border-radius: 6px; font-size: 13px;';
    tag.innerHTML = `
        <span>${escapeHtml(user.username)}</span>
        <button
            class="remove-user"
            data-user-id="${userId}"
            style="background: none; border: none; color: white; cursor: pointer; font-weight: bold; padding: 0; margin-left: 3px;"
        >×</button>
    `;

    tag.querySelector('.remove-user').addEventListener('click', () => {
        selectedUserIds.delete(userId);
        tag.remove();
    });

    selectedContainer.appendChild(tag);
}

/**
 * Load and display activity report
 */
async function loadActivityReport(container) {
    const loadingDiv = container.querySelector('#activity-loading');
    const summaryDiv = container.querySelector('#activity-summary');
    const tableDiv = container.querySelector('#activity-table-container');

    // Show loading
    loadingDiv.style.display = 'block';
    summaryDiv.style.display = 'none';
    tableDiv.style.display = 'none';

    try {
        // Gather filter values
        const startDate = container.querySelector('#filter-start-date').value;
        const endDate = container.querySelector('#filter-end-date').value;

        const actionTypes = Array.from(container.querySelectorAll('.action-type-filter:checked'))
            .map(cb => cb.value);

        // Build query params
        const params = new URLSearchParams();
        if (selectedUserIds.size > 0) {
            params.append('user_ids', Array.from(selectedUserIds).join(','));
        }
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (actionTypes.length > 0) {
            params.append('action_types', actionTypes.join(','));
        }

        const response = await apiClient.get(`/api/admin/reports/user-activity?${params.toString()}`);

        // Hide loading
        loadingDiv.style.display = 'none';

        // Render summary
        renderSummary(response.summary, summaryDiv);
        summaryDiv.style.display = 'block';

        // Render table
        renderActivityTable(response.users, tableDiv);
        tableDiv.style.display = 'block';

        showSuccess('Report loaded successfully');
    } catch (error) {
        console.error('Error loading activity report:', error);
        showError('Failed to load activity report');
        loadingDiv.style.display = 'none';
    }
}

/**
 * Render summary statistics
 */
function renderSummary(summary, container) {
    const stats = [
        { label: 'Total Users', value: summary.total_users, icon: '👥' },
        { label: 'Total Actions', value: summary.total_actions.toLocaleString(), icon: '🎯' },
        { label: 'Avg Actions/User', value: summary.avg_actions_per_user, icon: '📊' },
        { label: 'Failed Actions', value: summary.total_failed_actions.toLocaleString(), icon: '❌' },
        { label: 'Login Attempts', value: summary.total_login_attempts.toLocaleString(), icon: '🔑' },
        { label: 'Most Active User', value: summary.most_active_user || 'N/A', icon: '⭐' }
    ];

    container.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 16px; margin-bottom: 15px;">📈 Summary (${summary.period_start} to ${summary.period_end})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                ${stats.map(stat => `
                    <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; margin-bottom: 5px;">${stat.icon}</div>
                        <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">${stat.value}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${stat.label}</div>
                    </div>
                `).join('')}
            </div>

            ${summary.action_distribution && summary.action_distribution.length > 0 ? `
                <div style="margin-top: 20px;">
                    <h4 style="font-size: 14px; margin-bottom: 10px;">Action Distribution</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${summary.action_distribution.slice(0, 10).map(action => `
                            <div style="background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; font-size: 13px;">
                                <strong>${action.action}:</strong> ${action.count.toLocaleString()}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render activity table
 */
function renderActivityTable(users, container) {
    if (users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No activity data found for the selected filters.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px;">
            <h3 style="font-size: 16px; margin-bottom: 15px;">👤 User Activity Details</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">User</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Total Actions</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Active Days</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Failed</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Logins</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Admin Actions</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Unique IPs</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Last Activity</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 12px;">
                                    <div style="font-weight: 600;">${escapeHtml(user.username)}</div>
                                    ${user.email ? `<div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(user.email)}</div>` : ''}
                                </td>
                                <td style="padding: 12px; text-align: center; font-weight: 600;">${user.total_actions.toLocaleString()}</td>
                                <td style="padding: 12px; text-align: center;">${user.active_days}</td>
                                <td style="padding: 12px; text-align: center; color: ${user.failed_actions > 0 ? '#ff4444' : 'inherit'};">${user.failed_actions}</td>
                                <td style="padding: 12px; text-align: center;">${user.login_attempts}</td>
                                <td style="padding: 12px; text-align: center;">${user.admin_actions}</td>
                                <td style="padding: 12px; text-align: center;">${user.unique_ips}</td>
                                <td style="padding: 12px; font-size: 13px;">${formatDateTime(user.last_activity)}</td>
                                <td style="padding: 12px; text-align: center;">
                                    <button
                                        class="view-user-details"
                                        data-user='${JSON.stringify(user).replace(/'/g, "&apos;")}'
                                        style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
                                    >
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Add event listeners for detail buttons
    container.querySelectorAll('.view-user-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const userData = JSON.parse(btn.dataset.user);
            showUserDetailModal(userData);
        });
    });
}

/**
 * Show detailed user activity modal
 */
function showUserDetailModal(user) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="font-size: 24px; font-weight: bold; margin: 0;">Activity Details: ${escapeHtml(user.username)}</h2>
                <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <!-- Activity Metrics -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.total_actions.toLocaleString()}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Total Actions</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.active_days}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Active Days</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.creates}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Creates</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.updates}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Updates</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.deletes}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Deletes</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 18px; font-weight: bold;">${user.reads}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Reads</div>
                </div>
            </div>

            <!-- Top Actions -->
            ${user.top_actions && user.top_actions.length > 0 ? `
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">🎯 Top Actions</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${user.top_actions.map(action => `
                            <div style="background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; font-size: 13px;">
                                <strong>${action.action}:</strong> ${action.count.toLocaleString()}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Top Tables -->
            ${user.top_tables && user.top_tables.length > 0 ? `
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">🗄️ Most Active Tables</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${user.top_tables.map(table => `
                            <div style="background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; font-size: 13px;">
                                <strong>${table.table}:</strong> ${table.count.toLocaleString()}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Daily Activity Chart -->
            ${user.daily_activity && user.daily_activity.length > 0 ? `
                <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 10px;">📅 Daily Activity (Last 30 Days)</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${user.daily_activity.map(day => {
                            const maxCount = Math.max(...user.daily_activity.map(d => d.count));
                            const barWidth = (day.count / maxCount * 100);
                            return `
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <div style="min-width: 100px; font-size: 12px;">${day.date}</div>
                                    <div style="flex: 1; background: var(--bg-primary); border-radius: 4px; height: 20px; position: relative;">
                                        <div style="background: var(--accent-color); height: 100%; width: ${barWidth}%; border-radius: 4px;"></div>
                                    </div>
                                    <div style="min-width: 50px; text-align: right; font-size: 12px; font-weight: 600;">${day.count}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal handlers
    modal.querySelector('#close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Export activity report to CSV
 */
async function exportActivityCSV(container) {
    try {
        // Get current filter values
        const startDate = container.querySelector('#filter-start-date').value;
        const endDate = container.querySelector('#filter-end-date').value;

        const actionTypes = Array.from(container.querySelectorAll('.action-type-filter:checked'))
            .map(cb => cb.value);

        const params = new URLSearchParams();
        if (selectedUserIds.size > 0) {
            params.append('user_ids', Array.from(selectedUserIds).join(','));
        }
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (actionTypes.length > 0) {
            params.append('action_types', actionTypes.join(','));
        }

        const response = await apiClient.get(`/api/admin/reports/user-activity?${params.toString()}`);

        // Build CSV
        const headers = [
            'Username',
            'Email',
            'Total Actions',
            'Active Days',
            'Failed Actions',
            'Login Attempts',
            'Creates',
            'Updates',
            'Deletes',
            'Reads',
            'Admin Actions',
            'Unique IPs',
            'First Activity',
            'Last Activity'
        ];

        const rows = response.users.map(user => [
            user.username,
            user.email || '',
            user.total_actions,
            user.active_days,
            user.failed_actions,
            user.login_attempts,
            user.creates,
            user.updates,
            user.deletes,
            user.reads,
            user.admin_actions,
            user.unique_ips,
            user.first_activity,
            user.last_activity
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-activity-report-${startDate}-to-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showSuccess('Report exported successfully');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showError('Failed to export report');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

/**
 * Format datetime string
 */
function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
}
