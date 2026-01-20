/**
 * User Activity Timeline Component
 * Displays human-readable narrative of user actions
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

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
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 15px; align-items: end;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; font-weight: 600;">User ID</label>
                        <input
                            type="number"
                            id="timeline-user-id"
                            placeholder="Enter user ID"
                            style="width: 100%; padding: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary);"
                        >
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
                    <div>
                        <button
                            id="load-timeline-btn"
                            style="width: 100%; padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"
                        >
                            Load Timeline
                        </button>
                    </div>
                </div>

                <!-- Quick User Selection -->
                <div id="recent-users-container" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600;">Recent Active Users:</label>
                    <div id="recent-users-list" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
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

    // Setup event handlers
    setupTimelineHandlers(container);

    // Load recent users
    await loadRecentUsers(container);
}

/**
 * Setup event handlers for timeline
 */
function setupTimelineHandlers(container) {
    const loadBtn = container.querySelector('#load-timeline-btn');
    const userIdInput = container.querySelector('#timeline-user-id');

    loadBtn.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        if (!userId) {
            showError('Please enter a user ID');
            return;
        }

        await loadUserTimeline(container, parseInt(userId));
    });

    // Allow Enter key to load timeline
    userIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadBtn.click();
        }
    });
}

/**
 * Load recent users for quick selection
 */
async function loadRecentUsers(container) {
    try {
        // Get users list from existing users endpoint
        const response = await apiClient.get('/api/admin/users?limit=10');
        const users = response.users || [];

        const recentUsersList = container.querySelector('#recent-users-list');
        if (!users.length) {
            recentUsersList.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No users found</span>';
            return;
        }

        recentUsersList.innerHTML = users.map(user => `
            <button
                class="quick-user-btn"
                data-user-id="${user.id}"
                style="padding: 6px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text-primary); transition: all 0.2s;"
                onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-color)'"
                onmouseout="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--border-color)'"
            >
                ${user.username} (ID: ${user.id})
            </button>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.quick-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = parseInt(btn.getAttribute('data-user-id'));
                container.querySelector('#timeline-user-id').value = userId;
                await loadUserTimeline(container, userId);
            });
        });

    } catch (error) {
        console.error('Error loading recent users:', error);
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

        <!-- Narrative -->
        <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 18px; margin-bottom: 15px;">📖 Activity Narrative</h3>
            <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; line-height: 1.8; font-size: 15px;">
                ${narrative}
            </div>
        </div>

        <!-- Detailed Events Timeline -->
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px;">
            <h3 style="font-size: 18px; margin-bottom: 20px;">🕐 Detailed Event Timeline</h3>
            <div style="position: relative;">
                ${events.length > 0 ? renderEventTimeline(events) : '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No events recorded</p>'}
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
