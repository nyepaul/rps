/**
 * User Activity Timeline Component
 * Displays human-readable narrative of user actions
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

// User mapping for input (username -> user_id)
let userMapping = {};

// Sort state for activity table
let activitySort = {
    column: 'timestamp',
    direction: 'desc'
};

/**
 * Render user activity timeline viewer
 */
export async function renderUserTimeline(container) {
    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <!-- Header -->
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 10px;">📖 User Activity Timeline</h2>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                    View a human-readable narrative of user actions and interactions
                </p>
            </div>

            <!-- User Selection & Filters -->
            <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="font-size: 16px; margin-bottom: 15px;">📋 Select User & Filters</h3>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; align-items: end;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">User (auto-loads on selection)</label>
                        <input
                            type="text"
                            id="timeline-user-input"
                            list="timeline-users-datalist"
                            placeholder="Type or select user..."
                            style="width: 100%; padding: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
                        <datalist id="timeline-users-datalist"></datalist>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">Start Date</label>
                        <input
                            type="date"
                            id="timeline-start-date"
                            style="width: 100%; padding: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">End Date</label>
                        <input
                            type="date"
                            id="timeline-end-date"
                            style="width: 100%; padding: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div id="timeline-loading" style="display: none; text-align: center; padding: 40px; background: var(--bg-secondary); border-radius: 12px;">
                <div style="font-size: 48px; margin-bottom: 15px;">⏳</div>
                <p style="color: var(--text-secondary);">Loading user timeline...</p>
            </div>

            <!-- Timeline Content -->
            <div id="timeline-content" style="display: none;"></div>
        </div>
    `;

    // Load all users into dropdown
    await loadAllUsers(container);

    // Setup event handlers
    setupTimelineHandlers(container);
}

/**
 * Setup event handlers for timeline
 */
function setupTimelineHandlers(container) {
    const userInput = container.querySelector('#timeline-user-input');
    let loadTimeout = null;

    const attemptLoadTimeline = async () => {
        const userValue = userInput.value.trim();
        if (!userValue) {
            return;
        }

        // Check if it's a number (direct user ID) or username
        let userId;
        if (!isNaN(userValue)) {
            userId = parseInt(userValue);
        } else {
            // Look up username in mapping
            userId = userMapping[userValue.toLowerCase()];
            if (!userId) {
                // silently ignore if user not found (might still be typing)
                return;
            }
        }

        await loadUserTimeline(container, userId);
    };

    // Auto-load on input with debounce
    userInput.addEventListener('input', () => {
        // Clear previous timeout
        if (loadTimeout) {
            clearTimeout(loadTimeout);
        }

        // Set new timeout to load after user stops typing
        loadTimeout = setTimeout(async () => {
            const userValue = userInput.value.trim();
            if (userValue && userMapping[userValue.toLowerCase()]) {
                // Exact match found - auto-load
                await attemptLoadTimeline();
            }
        }, 500); // Wait 500ms after last keystroke
    });

    // Also load on blur if valid user
    userInput.addEventListener('blur', async () => {
        if (loadTimeout) {
            clearTimeout(loadTimeout);
        }
        await attemptLoadTimeline();
    });

    // Allow Enter key to load timeline immediately
    userInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            if (loadTimeout) {
                clearTimeout(loadTimeout);
            }
            await attemptLoadTimeline();
        }
    });

    // Also listen for date changes to reload timeline
    const startDateInput = container.querySelector('#timeline-start-date');
    const endDateInput = container.querySelector('#timeline-end-date');

    const reloadIfUserSelected = async () => {
        const userValue = userInput.value.trim();
        if (userValue) {
            // User already selected, reload with new date filters
            await attemptLoadTimeline();
        }
    };

    startDateInput.addEventListener('change', reloadIfUserSelected);
    endDateInput.addEventListener('change', reloadIfUserSelected);
}

/**
 * Load all users into datalist
 */
async function loadAllUsers(container) {
    try {
        // Get all users from users endpoint (no limit to get all)
        const response = await apiClient.get('/api/admin/users?limit=1000');
        const users = response.users || [];

        const datalist = container.querySelector('#timeline-users-datalist');
        if (!users.length) {
            return;
        }

        // Sort users alphabetically by username
        users.sort((a, b) => a.username.localeCompare(b.username));

        // Build username -> user_id mapping
        userMapping = {};
        users.forEach(user => {
            userMapping[user.username.toLowerCase()] = user.id;
            // Also map "username (ID: x)" format
            userMapping[`${user.username.toLowerCase()} (id: ${user.id})`] = user.id;
        });

        // Populate datalist with all users
        datalist.innerHTML = users.map(user => `
            <option value="${user.username}">
                ${user.username} (ID: ${user.id})${user.is_admin ? ' - Admin' : ''}
            </option>
        `).join('');

    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users list');
    }
}

/**
 * Load and display user timeline
 */
async function loadUserTimeline(container, userId) {
    const loadingDiv = container.querySelector('#timeline-loading');
    const contentDiv = container.querySelector('#timeline-content');
    const startDate = container.querySelector('#timeline-start-date').value;
    const endDate = container.querySelector('#timeline-end-date').value;

    // Show loading
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
        // Build query params
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        params.append('limit', '1000');

        // Fetch timeline
        const timeline = await apiClient.get(`/api/admin/users/${userId}/timeline?${params}`);

        // Hide loading
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

        // Render timeline
        renderTimeline(contentDiv, timeline);

    } catch (error) {
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        contentDiv.innerHTML = `
            <div style="background: var(--danger-bg); padding: 20px; border-radius: 12px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <h3 style="margin-bottom: 10px;">Error Loading Timeline</h3>
                <p style="color: var(--text-secondary); margin: 0;">
                    ${error.message || 'Failed to load user timeline'}
                </p>
            </div>
        `;
        showError('Failed to load user timeline');
    }
}

/**
 * Render timeline content
 */
function renderTimeline(container, timeline) {
    const userInfo = timeline.user_info || {};
    const events = timeline.events || [];
    const narrative = timeline.narrative || 'No activity recorded.';
    const summary = timeline.summary || '';

    // Reset sort state
    activitySort = {
        column: 'timestamp',
        direction: 'desc'
    };

    // Sort events by timestamp descending on initial load
    const sortedEvents = events.length > 0 ? sortActivityEvents(events, 'timestamp', 'desc') : [];

    container.innerHTML = `
        <!-- User Info -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 18px; margin-bottom: 15px;">👤 User Information</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Username</div>
                    <div style="font-weight: 600;">${userInfo.username || 'Unknown'}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Email</div>
                    <div style="font-weight: 600;">${userInfo.email || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Status</div>
                    <div style="font-weight: 600; color: ${userInfo.is_active ? 'var(--success-color)' : 'var(--danger-color)'};">
                        ${userInfo.is_active ? '✓ Active' : '✗ Inactive'}
                    </div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Role</div>
                    <div style="font-weight: 600;">${userInfo.is_admin ? '⚙️ Admin' : '👤 User'}</div>
                </div>
            </div>
        </div>

        <!-- Summary -->
        <div style="background: linear-gradient(135deg, var(--accent-color-light) 0%, var(--bg-secondary) 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid var(--accent-color);">
            <h3 style="font-size: 18px; margin-bottom: 10px;">📊 Activity Summary</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.6;">${summary}</p>
        </div>

        <!-- Activity Timeline Table -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 18px; margin-bottom: 15px;">📖 Activity Timeline</h3>
            <div id="activity-table-container">
                ${sortedEvents.length > 0 ? renderActivityTable(sortedEvents) : '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No events recorded</p>'}
            </div>
        </div>

        <!-- Export Button -->
        <div style="margin-top: 20px; text-align: center;">
            <button
                id="export-timeline-btn"
                style="padding: 12px 24px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600;"
            >
                📥 Export Timeline as JSON
            </button>
        </div>
    `;

    // Setup export handler
    const exportBtn = container.querySelector('#export-timeline-btn');
    exportBtn.addEventListener('click', () => {
        exportTimeline(timeline);
    });

    // Setup sort handlers if events exist
    if (sortedEvents.length > 0) {
        setupActivityTableSort(container, sortedEvents);
    }
}

/**
 * Render activity table with rows and columns
 */
function renderActivityTable(events) {
    const renderSortableHeader = (column, label) => {
        const isActive = activitySort.column === column;
        const arrow = isActive ? (activitySort.direction === 'asc' ? '↑' : '↓') : '⇅';
        const arrowOpacity = isActive ? '1' : '0.3';

        return `
            <th class="activity-sortable-header" data-column="${column}" style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; transition: background 0.2s;" onmouseenter="this.style.background='var(--bg-primary)'" onmouseleave="this.style.background='transparent'">
                ${label} <span style="opacity: ${arrowOpacity}; font-size: 10px; margin-left: 4px;">${arrow}</span>
            </th>
        `;
    };

    return `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                        ${renderSortableHeader('timestamp', 'Date')}
                        ${renderSortableHeader('time', 'Time')}
                        ${renderSortableHeader('action', 'Action')}
                        ${renderSortableHeader('description', 'Description')}
                        <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Context</th>
                    </tr>
                </thead>
                <tbody>
                    ${events.map((event, index) => renderActivityRow(event, index)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render a single activity row
 */
function renderActivityRow(event, index) {
    const timestamp = event.timestamp || '';
    const description = event.description || 'Unknown action';
    const action = event.action || '';
    const context = event.context || {};

    // Format date and time
    let dateStr = '';
    let timeStr = '';
    try {
        const dt = new Date(timestamp);
        dateStr = dt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        timeStr = dt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        dateStr = timestamp;
        timeStr = '';
    }

    // Get icon and color based on action type
    const icon = getActionIcon(action);
    const actionColor = getActionColor(action);

    // Build context info
    const contextItems = [];
    if (context.location) contextItems.push(`📍 ${context.location}`);
    if (context.browser) contextItems.push(`🌐 ${context.browser}`);
    if (context.device) contextItems.push(`📱 ${context.device}`);
    if (context.profile) contextItems.push(`👤 ${context.profile}`);

    return `
        <tr class="activity-row" data-event-index="${index}" style="border-bottom: 1px solid var(--border-color); transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px; font-size: 13px; white-space: nowrap;">${dateStr}</td>
            <td style="padding: 12px; font-size: 13px; white-space: nowrap;">${timeStr}</td>
            <td style="padding: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">${icon}</span>
                    <span style="display: inline-block; padding: 4px 8px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                        ${action}
                    </span>
                </div>
            </td>
            <td style="padding: 12px; font-size: 13px;">${description}</td>
            <td style="padding: 12px; font-size: 12px; color: var(--text-secondary);">
                ${contextItems.length > 0 ? contextItems.join('<br>') : '-'}
            </td>
        </tr>
    `;
}

/**
 * Setup sort handlers for activity table
 */
function setupActivityTableSort(container, events) {
    const headers = container.querySelectorAll('.activity-sortable-header');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');

            // Toggle direction if clicking same column, otherwise default to desc
            if (activitySort.column === column) {
                activitySort.direction = activitySort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                activitySort.column = column;
                activitySort.direction = 'desc';
            }

            // Sort and re-render
            const sortedEvents = sortActivityEvents(events, activitySort.column, activitySort.direction);
            const tableContainer = container.querySelector('#activity-table-container');
            tableContainer.innerHTML = renderActivityTable(sortedEvents);

            // Re-setup handlers
            setupActivityTableSort(container, events);
        });
    });

    // Setup row click handlers
    const rows = container.querySelectorAll('.activity-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            const eventIndex = parseInt(row.getAttribute('data-event-index'));
            const event = events[eventIndex];
            if (event) {
                showActivityDetails(event);
            }
        });
    });
}

/**
 * Sort activity events by column
 */
function sortActivityEvents(events, column, direction) {
    const sorted = [...events].sort((a, b) => {
        let aVal, bVal;

        switch (column) {
            case 'timestamp':
                aVal = new Date(a.timestamp || 0).getTime();
                bVal = new Date(b.timestamp || 0).getTime();
                break;
            case 'time':
                aVal = new Date(a.timestamp || 0).getTime();
                bVal = new Date(b.timestamp || 0).getTime();
                break;
            case 'action':
                aVal = (a.action || '').toLowerCase();
                bVal = (b.action || '').toLowerCase();
                break;
            case 'description':
                aVal = (a.description || '').toLowerCase();
                bVal = (b.description || '').toLowerCase();
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    return sorted;
}

/**
 * Get color for action type
 */
function getActionColor(action) {
    const colorMap = {
        'LOGIN_SUCCESS': 'var(--success-color)',
        'LOGIN_ATTEMPT': '#764ba2',
        'LOGOUT': '#FFA500',
        'CREATE': 'var(--success-color)',
        'UPDATE': '#FFA500',
        'DELETE': 'var(--danger-color)',
        'READ': 'var(--accent-color)',
        'UI_CLICK': 'var(--accent-color)',
        'UI_PAGE_VIEW': 'var(--accent-color)',
        'UI_TAB_SWITCH': 'var(--accent-color)',
        'UI_FORM_SUBMIT': 'var(--success-color)',
        'UI_SEARCH': 'var(--accent-color)',
        'UI_DOWNLOAD': 'var(--success-color)',
        'RUN_ANALYSIS': '#764ba2',
        'ADMIN_ACCESS': 'var(--success-color)',
        'SESSION_START': 'var(--success-color)',
        'SESSION_END': '#FFA500',
        'SESSION_IDLE': 'var(--text-secondary)',
        'SESSION_RESUME': 'var(--success-color)'
    };

    return colorMap[action] || 'var(--text-secondary)';
}

/**
 * Render event timeline with visual styling
 */
function renderEventTimeline(events) {
    return events.map((event, index) => {
        const timestamp = event.timestamp || '';
        const description = event.description || 'Unknown action';
        const action = event.action || '';
        const context = event.context || {};

        // Format timestamp
        let timeStr = '';
        try {
            const dt = new Date(timestamp);
            timeStr = dt.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            timeStr = timestamp;
        }

        // Get icon based on action type
        const icon = getActionIcon(action);

        // Build context info
        const contextItems = [];
        if (context.location) contextItems.push(`📍 ${context.location}`);
        if (context.browser) contextItems.push(`🌐 ${context.browser}`);
        if (context.device) contextItems.push(`📱 ${context.device}`);
        if (context.profile) contextItems.push(`👤 Profile: ${context.profile}`);

        return `
            <div style="display: flex; gap: 20px; margin-bottom: 20px; padding: 15px; background: var(--bg-primary); border-radius: 8px; border-left: 3px solid var(--accent-color-light);">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: var(--accent-color-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 5px; font-size: 15px;">${description}</div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                        🕐 ${timeStr}
                    </div>
                    ${contextItems.length > 0 ? `
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary);">
                            ${contextItems.join(' • ')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Get icon for action type
 */
function getActionIcon(action) {
    const iconMap = {
        'LOGIN_SUCCESS': '🔓',
        'LOGIN_ATTEMPT': '🔐',
        'LOGOUT': '🚪',
        'CREATE': '✨',
        'UPDATE': '✏️',
        'DELETE': '🗑️',
        'READ': '👁️',
        'UI_CLICK': '👆',
        'UI_PAGE_VIEW': '📄',
        'UI_TAB_SWITCH': '🔄',
        'UI_FORM_SUBMIT': '📝',
        'UI_SEARCH': '🔍',
        'UI_DOWNLOAD': '📥',
        'RUN_ANALYSIS': '📊',
        'ADMIN_ACCESS': '⚙️',
        'SESSION_START': '▶️',
        'SESSION_END': '⏹️',
        'SESSION_IDLE': '⏸️',
        'SESSION_RESUME': '▶️'
    };

    return iconMap[action] || '•';
}

/**
 * Show activity details modal
 */
function showActivityDetails(event) {
    const timestamp = event.timestamp || '';
    const description = event.description || 'Unknown action';
    const action = event.action || '';
    const context = event.context || {};

    // Format timestamp
    let timeStr = '';
    try {
        const dt = new Date(timestamp);
        timeStr = dt.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        timeStr = timestamp;
    }

    // Get icon and color
    const icon = getActionIcon(action);
    const actionColor = getActionColor(action);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'activity-details-modal';
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
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                <h2 style="margin: 0; font-size: 20px;">📋 Activity Details</h2>
                <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
            </div>

            <div style="display: grid; gap: 20px;">
                <!-- Timestamp & Action -->
                <div>
                    <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Event Information</h3>
                    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                            <span style="font-weight: 600; color: var(--text-secondary);">Timestamp:</span>
                            <span>${timeStr}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                            <span style="font-weight: 600; color: var(--text-secondary);">Action Type:</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 18px;">${icon}</span>
                                <span style="display: inline-block; padding: 4px 12px; background: ${actionColor}20; color: ${actionColor}; border-radius: 4px; font-size: 12px; font-weight: 600; width: fit-content;">${action}</span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                            <span style="font-weight: 600; color: var(--text-secondary);">Description:</span>
                            <span>${description}</span>
                        </div>
                    </div>
                </div>

                <!-- Context Information -->
                ${Object.keys(context).length > 0 ? `
                    <div>
                        <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Context</h3>
                        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; display: grid; gap: 10px;">
                            ${context.location ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">📍 Location:</span>
                                    <span>${context.location}</span>
                                </div>
                            ` : ''}
                            ${context.browser ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">🌐 Browser:</span>
                                    <span>${context.browser}</span>
                                </div>
                            ` : ''}
                            ${context.device ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">📱 Device:</span>
                                    <span>${context.device}</span>
                                </div>
                            ` : ''}
                            ${context.profile ? `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <span style="font-weight: 600; color: var(--text-secondary);">👤 Profile:</span>
                                    <span>${context.profile}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                <!-- Full Event Data -->
                <div>
                    <h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Raw Event Data</h3>
                    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px;">
                        <pre style="margin: 0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: var(--text-primary); max-height: 300px; overflow-y: auto;">${JSON.stringify(event, null, 2)}</pre>
                    </div>
                </div>
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

    // Close on Escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Export timeline as JSON
 */
function exportTimeline(timeline) {
    const dataStr = JSON.stringify(timeline, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-timeline-${timeline.user_id}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccess('Timeline exported successfully');
}
