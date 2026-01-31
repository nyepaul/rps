/**
 * User Report Component
 * Display comprehensive activity report for a user
 */

import { apiClient } from '../../api/client.js';
import { showError } from '../../utils/dom.js';

/**
 * Show user report modal
 */
export async function showUserReport(userId, username) {
    try {
        // Fetch user report data
        const response = await apiClient.get(`/api/admin/users/${userId}/report`);
        const report = response.report;

        // Create modal
        const modal = document.createElement('div');
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
            z-index: 1000;
            overflow-y: auto;
            padding: 20px;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                    <div>
                        <h2 style="margin: 0 0 5px 0; font-size: 24px;">User Activity Report</h2>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">Comprehensive activity overview for ${username}</p>
                    </div>
                    <button onclick="this.closest('.user-report-modal').remove()" style="background: transparent; border: none; font-size: 32px; cursor: pointer; color: var(--text-secondary); line-height: 1; padding: 0; width: 32px; height: 32px;">&times;</button>
                </div>

                <div style="display: grid; gap: 20px;">
                    <!-- User Info Section -->
                    ${renderUserInfoSection(report.user)}

                    <!-- Activity Summary -->
                    ${renderActivitySummary(report)}

                    <!-- Content Overview -->
                    ${renderContentOverview(report)}

                    <!-- Recent Activity -->
                    ${renderRecentActivity(report.recent_activity)}

                    <!-- Top Actions -->
                    ${renderTopActions(report.activity_by_action)}

                    <!-- Profiles List -->
                    ${renderProfilesList(report.profiles)}

                    <!-- Recent Scenarios -->
                    ${renderRecentScenarios(report.recent_scenarios)}
                </div>
            </div>
        `;

        modal.classList.add('user-report-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Failed to load user report:', error);
        showError(`Failed to load user report: ${error.message}`);
    }
}

/**
 * Render user info section
 */
function renderUserInfoSection(user) {
    const statusBadge = user.is_active
        ? '<span style="background: var(--success-color)20; color: var(--success-color); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">Active</span>'
        : '<span style="background: var(--danger-color)20; color: var(--danger-color); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">Inactive</span>';

    const adminBadge = user.is_super_admin
        ? '<span style="background: #e03131; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">⭐ Super Admin</span>'
        : user.is_admin
        ? '<span style="background: #764ba220; color: #764ba2; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">Admin</span>'
        : '<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">User</span>';

    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">User Information</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Username</div>
                    <div style="font-weight: 600; font-size: 16px;">${user.username}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Email</div>
                    <div style="font-size: 14px;">${user.email}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">User ID</div>
                    <div style="font-family: monospace; font-size: 14px;">#${user.id}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Status</div>
                    <div>${statusBadge} ${adminBadge}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Account Created</div>
                    <div style="font-size: 14px;">${formatDateTime(user.created_at)}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Last Login</div>
                    <div style="font-size: 14px;">${user.last_login ? formatDateTime(user.last_login) : 'Never'}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render activity summary
 */
function renderActivitySummary(report) {
    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Activity Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 6px;">
                    <div style="font-size: 28px; font-weight: 700; color: var(--accent-color); margin-bottom: 5px;">${report.total_activity_count || 0}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Total Actions</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 6px;">
                    <div style="font-size: 28px; font-weight: 700; color: var(--success-color); margin-bottom: 5px;">${report.first_activity ? daysSince(report.first_activity) : 0}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Days Active</div>
                </div>
                <div style="text-align: center; padding: 15px; background: var(--bg-secondary); border-radius: 6px;">
                    <div style="font-size: 28px; font-weight: 700; color: #f59e0b; margin-bottom: 5px;">${report.last_activity ? daysSince(report.last_activity) : 'N/A'}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${report.last_activity ? 'Days Since Last Activity' : 'No Activity'}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render content overview
 */
function renderContentOverview(report) {
    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Content Overview</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Profiles</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.profile_count || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Scenarios</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.scenario_count || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Conversations</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.conversation_count || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Messages</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.conversation_message_count || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Action Items</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.action_item_count || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                    <span style="color: var(--text-secondary); font-size: 14px;">Feedback Submissions</span>
                    <span style="font-weight: 600; font-size: 14px;">${report.feedback_count || 0}</span>
                </div>
            </div>
            ${report.action_items_by_status && Object.keys(report.action_items_by_status).length > 0 ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Action Items by Status</div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${Object.entries(report.action_items_by_status).map(([status, count]) => `
                            <span style="padding: 4px 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; font-size: 12px;">
                                <span style="color: var(--text-secondary);">${status}:</span> <span style="font-weight: 600;">${count}</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render recent activity
 */
function renderRecentActivity(activities) {
    if (!activities || activities.length === 0) {
        return `
            <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Recent Activity</h3>
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 32px; margin-bottom: 10px;">📭</div>
                    <div>No activity recorded</div>
                </div>
            </div>
        `;
    }

    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Recent Activity (Last 20)</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead style="position: sticky; top: 0; background: var(--bg-primary); z-index: 1;">
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <th style="text-align: left; padding: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 600;">Date/Time</th>
                            <th style="text-align: left; padding: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 600;">Action</th>
                            <th style="text-align: left; padding: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 600;">Endpoint</th>
                            <th style="text-align: center; padding: 8px; font-size: 11px; color: var(--text-secondary); font-weight: 600;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activities.map(activity => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 8px; font-size: 11px; color: var(--text-secondary); white-space: nowrap;">${formatDateTime(activity.created_at)}</td>
                                <td style="padding: 8px; font-weight: 600; font-size: 12px;">${activity.action || 'N/A'}</td>
                                <td style="padding: 8px; font-family: monospace; font-size: 11px; color: var(--text-secondary);">${activity.request_method || ''} ${activity.request_endpoint || activity.table_name || ''}</td>
                                <td style="padding: 8px; text-align: center;">
                                    ${activity.status_code ? `<span style="padding: 2px 8px; background: ${getStatusColor(activity.status_code)}20; color: ${getStatusColor(activity.status_code)}; border-radius: 4px; font-size: 11px; font-weight: 600;">${activity.status_code}</span>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render top actions
 */
function renderTopActions(actions) {
    if (!actions || actions.length === 0) {
        return '';
    }

    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Top Actions</h3>
            <div style="display: grid; gap: 8px;">
                ${actions.map((action, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: var(--bg-secondary); border-radius: 6px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-weight: 700; font-size: 16px; color: var(--text-secondary); width: 24px;">#${index + 1}</span>
                            <span style="font-weight: 600; font-size: 13px;">${action.action}</span>
                        </div>
                        <span style="font-weight: 700; font-size: 16px; color: var(--accent-color);">${action.count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render profiles list
 */
function renderProfilesList(profiles) {
    if (!profiles || profiles.length === 0) {
        return '';
    }

    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Profiles (${profiles.length})</h3>
            <div style="display: grid; gap: 8px; max-height: 200px; overflow-y: auto;">
                ${profiles.map(profile => `
                    <div style="padding: 12px 15px; background: var(--bg-secondary); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 13px;">${profile.name}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">ID: ${profile.id}</div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); text-align: right;">${formatDate(profile.created_at)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render recent scenarios
 */
function renderRecentScenarios(scenarios) {
    if (!scenarios || scenarios.length === 0) {
        return '';
    }

    return `
        <div style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; color: var(--text-secondary);">Recent Scenarios</h3>
            <div style="display: grid; gap: 8px; max-height: 200px; overflow-y: auto;">
                ${scenarios.map(scenario => `
                    <div style="padding: 12px 15px; background: var(--bg-secondary); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 13px;">${scenario.name}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">ID: ${scenario.id}</div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); text-align: right;">${formatDate(scenario.created_at)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Helper: Format date
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Helper: Format date and time
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Helper: Calculate days since date
 */
function daysSince(dateString) {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Helper: Get status code color
 */
function getStatusColor(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return 'var(--success-color)';
    if (statusCode >= 300 && statusCode < 400) return '#3b82f6';
    if (statusCode >= 400 && statusCode < 500) return '#f59e0b';
    if (statusCode >= 500) return 'var(--danger-color)';
    return 'var(--text-secondary)';
}
