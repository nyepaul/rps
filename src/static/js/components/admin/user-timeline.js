/**
 * User Activity Timeline Component
 * Displays human-readable narrative of user actions
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

// User mapping for input (username -> user_id)
let userMapping = {};
let allUsers = []; // Store full user objects

// Sort state for activity table
let activitySort = {
    column: 'timestamp',
    direction: 'desc'
};

// Current events array for navigation in activity details modal
let currentEvents = [];

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
                    <div style="position: relative;" id="user-select-container">
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">User (click to select)</label>
                        <div style="position: relative;">
                            <input
                                type="text"
                                id="timeline-user-input"
                                placeholder="Click to select or type to search..."
                                autocomplete="off"
                                style="width: 100%; padding: 10px; padding-right: 30px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer;"
                            >
                            <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none;">▼</span>
                        </div>
                        <div id="user-dropdown-list" style="
                            display: none;
                            position: absolute;
                            top: 100%;
                            left: 0;
                            right: 0;
                            background: var(--bg-tertiary);
                            border: 1px solid var(--border-color);
                            border-radius: 6px;
                            max-height: 300px;
                            overflow-y: auto;
                            z-index: 100;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            margin-top: 4px;
                        "></div>
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

            <!-- Timeline Content -->
            <div id="timeline-content" style="display: none;"></div>
        </div>
    `;

    // Load all users into dropdown
    await loadAllUsers();

    // Setup event handlers
    setupTimelineHandlers(container);
}

/**
 * Setup event handlers for timeline
 */
function setupTimelineHandlers(container) {
    const userInput = container.querySelector('#timeline-user-input');
    const dropdown = container.querySelector('#user-dropdown-list');
    const startDateInput = container.querySelector('#timeline-start-date');
    const endDateInput = container.querySelector('#timeline-end-date');

    const renderDropdown = (filterText = '') => {
        const lowerFilter = filterText.toLowerCase();
        const filtered = allUsers.filter(u => 
            u.username.toLowerCase().includes(lowerFilter) || 
            (u.email && u.email.toLowerCase().includes(lowerFilter))
        );

        if (filtered.length === 0) {
            dropdown.innerHTML = `<div style="padding: 12px; color: var(--text-secondary); text-align: center; font-size: 13px;">No users found</div>`;
            return;
        }

        dropdown.innerHTML = filtered.map(user => `
            <div class="user-select-row" data-user-id="${user.id}" data-username="${user.username}" style="
                padding: 10px 12px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.2s;
            " onmouseenter="this.style.background='var(--bg-primary)'" onmouseleave="this.style.background='transparent'">
                <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${user.username}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${user.email || ''}</div>
                ${user.is_admin ? '<span style="font-size: 10px; background: #764ba222; color: #764ba2; padding: 2px 6px; border-radius: 4px;">ADMIN</span>' : ''}
            </div>
        `).join('');

        // Add click handlers
        dropdown.querySelectorAll('.user-select-row').forEach(row => {
            row.addEventListener('click', () => {
                const userId = row.dataset.userId;
                const username = row.dataset.username;
                userInput.value = username;
                dropdown.style.display = 'none';
                loadUserTimeline(container, userId);
            });
        });
    };

    // Show dropdown on click/focus
    const showDropdown = () => {
        renderDropdown(''); // Always show all on click/focus
        dropdown.style.display = 'block';
    };

    userInput.addEventListener('focus', showDropdown);
    userInput.addEventListener('click', showDropdown);

    // Filter on input
    userInput.addEventListener('input', () => {
        renderDropdown(userInput.value);
        dropdown.style.display = 'block';
    });

    // Hide dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!userInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Date change handlers
    const reloadIfUserSelected = () => {
        const username = userInput.value;
        const userId = userMapping[username.toLowerCase()];
        if (userId) {
            loadUserTimeline(container, userId);
        }
    };

    startDateInput.addEventListener('change', reloadIfUserSelected);
    endDateInput.addEventListener('change', reloadIfUserSelected);
}

/**
 * Load all users
 */
async function loadAllUsers() {
    try {
        // Get all users from users endpoint (no limit to get all)
        const response = await apiClient.get('/api/admin/users?limit=1000');
        allUsers = response.users || [];

        // Sort users alphabetically by username
        allUsers.sort((a, b) => a.username.localeCompare(b.username));

        // Build username -> user_id mapping for quick lookup
        userMapping = {};
        allUsers.forEach(user => {
            userMapping[user.username.toLowerCase()] = user.id;
        });

    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users list');
    }
}

/**
 * Load and display user timeline
 */
async function loadUserTimeline(container, userId) {
    const contentDiv = container.querySelector('#timeline-content');
    const startDate = container.querySelector('#timeline-start-date').value;
    const endDate = container.querySelector('#timeline-end-date').value;

    // Clear content
    contentDiv.style.display = 'none';

    try {
        // Build query params
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        params.append('limit', '1000');

        // Fetch timeline
        const timeline = await apiClient.get(`/api/admin/users/${userId}/timeline?${params}`);

        // Show content
        contentDiv.style.display = 'block';

        // Render timeline
        renderTimeline(contentDiv, timeline);

    } catch (error) {
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
    const summary = timeline.summary || '';

    // Reset sort state
    activitySort = {
        column: 'timestamp',
        direction: 'desc'
    };

    // Sort events by timestamp descending on initial load
    const sortedEvents = events.length > 0 ? sortActivityEvents(events, 'timestamp', 'desc') : [];

    // Store SORTED events for modal navigation so indices match the displayed table
    currentEvents = sortedEvents;

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

            // Update currentEvents to reflect sorted order for navigation
            currentEvents = sortedEvents;

            const tableContainer = container.querySelector('#activity-table-container');
            tableContainer.innerHTML = renderActivityTable(sortedEvents);

            // Re-setup handlers
            setupActivityTableSort(container, sortedEvents);
        });
    });

    // Setup row click handlers
    const rows = container.querySelectorAll('.activity-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            const eventIndex = parseInt(row.getAttribute('data-event-index'));
            if (eventIndex >= 0 && eventIndex < currentEvents.length) {
                showActivityDetails(eventIndex);
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
 * Show activity details modal with navigation
 */
function showActivityDetails(eventIndex) {
    const event = currentEvents[eventIndex];
    if (!event) return;

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

    // Check if prev/next are available
    // Previous = earlier in time (higher index, older events)
    // Next = later in time (lower index, newer events)
    const hasPrev = eventIndex < currentEvents.length - 1;
    const hasNext = eventIndex > 0;

    // Check if modal already exists
    let modal = document.querySelector('.activity-details-modal');
    const isExisting = !!modal;

    if (!modal) {
        // Create modal
        modal = document.createElement('div');
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
    }

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h2 style="margin: 0; font-size: 20px;">📋 Activity Details</h2>
                    <span style="font-size: 12px; color: var(--text-secondary); font-weight: 400;">(${eventIndex + 1} of ${currentEvents.length})</span>
                </div>
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

            <!-- Navigation & Close Buttons -->
            <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px;">
                    <button class="prev-activity-btn" ${!hasPrev ? 'disabled' : ''} style="padding: 10px 20px; background: ${hasPrev ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}; color: ${hasPrev ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasPrev ? 'pointer' : 'not-allowed'}; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                        ← Previous
                    </button>
                    <button class="next-activity-btn" ${!hasNext ? 'disabled' : ''} style="padding: 10px 20px; background: ${hasNext ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}; color: ${hasNext ? 'var(--text-primary)' : 'var(--text-secondary)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: ${hasNext ? 'pointer' : 'not-allowed'}; font-weight: 600; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
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
                if (currentIndex < currentEvents.length - 1) {
                    showActivityDetails(currentIndex + 1);
                }
            } else if (e.key === 'ArrowRight') {
                // Next = later in time (lower index)
                const currentIndex = parseInt(modal.dataset.currentIndex || '0');
                if (currentIndex > 0) {
                    showActivityDetails(currentIndex - 1);
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
    modal.dataset.currentIndex = eventIndex;

    // Setup/update close button handlers
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);
        newBtn.addEventListener('click', () => {
            modal.remove();
        });
    });

    // Previous button handler (earlier in time = higher index)
    const prevBtn = modal.querySelector('.prev-activity-btn');
    if (prevBtn) {
        // Remove old listeners by cloning
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.replaceWith(newPrevBtn);

        if (hasPrev) {
            newPrevBtn.addEventListener('click', () => {
                showActivityDetails(eventIndex + 1);
            });
            newPrevBtn.addEventListener('mouseenter', () => newPrevBtn.style.background = 'var(--bg-primary)');
            newPrevBtn.addEventListener('mouseleave', () => newPrevBtn.style.background = 'var(--bg-tertiary)');
        }
    }

    // Next button handler (later in time = lower index)
    const nextBtn = modal.querySelector('.next-activity-btn');
    if (nextBtn) {
        // Remove old listeners by cloning
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.replaceWith(newNextBtn);

        if (hasNext) {
            newNextBtn.addEventListener('click', () => {
                showActivityDetails(eventIndex - 1);
            });
            newNextBtn.addEventListener('mouseenter', () => newNextBtn.style.background = 'var(--bg-primary)');
            newNextBtn.addEventListener('mouseleave', () => newNextBtn.style.background = 'var(--bg-tertiary)');
        }
    }
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
