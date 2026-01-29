/**
 * Admin Tab - Main admin dashboard with sub-tabs
 */

import { store } from '../../state/store.js';
import { showError } from '../../utils/dom.js';
import { apiClient } from '../../api/client.js';
import { renderLogsViewer, prefetchLogs } from './logs-viewer.js';
import { renderUserTimeline } from './user-timeline.js';
import { renderConfigEditor } from './config-editor.js';
import { renderUserManagement } from './user-management.js';
import { renderSystemInfo } from './system-info.js';
import { renderFeedbackViewer } from './feedback-viewer.js';
import { renderRoadmapPanel } from './roadmap-panel.js';
import { renderBackupManager } from './backup-manager.js';
import { renderUsersByLocationReport } from './users-by-location-report.js';
import { renderUserActivityReport } from './user-activity-report.js';
import { renderPasswordRequests } from './password-requests.js';
import { renderDemoManagement } from './demo-management.js';
import { renderGroupManagement } from './group-management.js';

/**
 * Render admin tab with sub-tabs
 */
export async function renderAdminTab(container) {
    const user = store.get('currentUser');

    // Check if user is admin
    if (!user || !user.is_admin) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                <h2 style="margin-bottom: 15px;">Access Denied</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Admin privileges required to access this page.
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="margin-bottom: var(--space-3); position: relative;">
                <h1 style="font-size: var(--font-2xl); margin: 0;">⚙️ Admin Dashboard</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    System administration and audit logs
                </p>

                <!-- Notification Indicator -->
                <div id="admin-notification-indicator" style="position: absolute; top: 0; right: 0; display: none;">
                    <style>
                        @keyframes pulse-glow {
                            0%, 100% {
                                opacity: 1;
                                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                            }
                            50% {
                                opacity: 0.8;
                                box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
                            }
                        }
                        .notification-pulse {
                            animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                        }
                    </style>
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);" class="notification-pulse">
                        <span style="font-size: 16px;">🔔</span>
                        <div id="notification-text" style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.3;">
                            <span id="notification-count" style="font-size: 14px;"></span>
                            <span id="notification-details" style="font-size: 10px; opacity: 0.9;"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Admin Sub-Tabs -->
            <div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 0; overflow-x: visible; align-items: center; background: var(--bg-secondary); border-radius: 6px 6px 0 0; padding: 0 10px;">
                <button class="admin-subtab active" data-subtab="system" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid var(--accent-color); cursor: pointer; font-weight: 700; color: var(--accent-color); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    🖥️ System
                </button>
                <button class="admin-subtab" data-subtab="logs" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    📋 Logs
                </button>

                <!-- User Section Dropdown -->
                <div class="admin-group-dropdown" style="position: relative; display: inline-block;">
                    <button class="admin-group-trigger" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                        👥 User <span style="font-size: 9px;">▼</span>
                    </button>
                    <div class="admin-group-content" style="display: none; position: absolute; top: 100%; left: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 180px; padding: 4px 0;">
                        <button class="admin-subtab group-item" data-subtab="timeline" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            📖 Timeline
                        </button>
                        <button class="admin-subtab group-item" data-subtab="feedback" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            💬 Feedback
                        </button>
                        <button class="admin-subtab group-item" data-subtab="password_requests" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            🔑 Pwd Requests
                        </button>
                        <button class="admin-subtab group-item" data-subtab="users" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            👤 Accounts
                        </button>
                        <button class="admin-subtab group-item" data-subtab="groups" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            🏗️ Groups
                        </button>
                        <button class="admin-subtab group-item" data-subtab="demo_management" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            🎭 Demo Mgmt
                        </button>
                    </div>
                </div>

                ${user.is_super_admin ? `
                <button class="admin-subtab" data-subtab="roadmap" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    🗺️ Roadmap
                </button>
                <button class="admin-subtab" data-subtab="backups" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    💾 Backups
                </button>

                <!-- Reports Section Dropdown -->
                <div class="admin-reports-dropdown" style="position: relative; display: inline-block;">
                    <button class="admin-reports-trigger" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                        📊 Reports <span style="font-size: 9px;">▼</span>
                    </button>
                    <div class="admin-reports-content" style="display: none; position: absolute; top: 100%; left: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 200px; padding: 4px 0;">
                        <button class="admin-subtab reports-item" data-subtab="user_activity" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            📊 User Activity
                        </button>
                        <button class="admin-subtab reports-item" data-subtab="users_by_location" style="width: 100%; text-align: left; padding: 8px 16px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 600; font-size: 12px;">
                            🌍 Users by Location
                        </button>
                    </div>
                </div>
                ` : ''}
                <button class="admin-subtab" data-subtab="config" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    ⚙️ Config
                </button>
            </div>

            <!-- Sub-tab Content -->
            <div id="admin-subtab-content" style="padding: 0;"></div>
        </div>
    `;

    // Setup sub-tab switching
    setupSubTabSwitching(container);

    // Load default sub-tab (system)
    await showSubTab(container, 'system');

    // Prefetch logs in background
    prefetchLogs();

    // Load notification counts
    loadNotificationCounts(container);

    // Refresh notification counts every 30 seconds
    setInterval(() => loadNotificationCounts(container), 30000);
}

/**
 * Setup sub-tab switching functionality
 */
function setupSubTabSwitching(container) {
    const subtabButtons = container.querySelectorAll('.admin-subtab');
    const groupTrigger = container.querySelector('.admin-group-trigger');
    const groupContent = container.querySelector('.admin-group-content');
    const reportsTrigger = container.querySelector('.admin-reports-trigger');
    const reportsContent = container.querySelector('.admin-reports-content');

    // Setup User dropdown toggle
    if (groupTrigger && groupContent) {
        groupTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = groupContent.style.display === 'block';
            groupContent.style.display = isVisible ? 'none' : 'block';
            // Close reports dropdown
            if (reportsContent) reportsContent.style.display = 'none';
        });
    }

    // Setup Reports dropdown toggle
    if (reportsTrigger && reportsContent) {
        reportsTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = reportsContent.style.display === 'block';
            reportsContent.style.display = isVisible ? 'none' : 'block';
            // Close user dropdown
            if (groupContent) groupContent.style.display = 'none';
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        if (groupContent) groupContent.style.display = 'none';
        if (reportsContent) reportsContent.style.display = 'none';
    });

    subtabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const subtab = btn.getAttribute('data-subtab');
            const isGroupItem = btn.classList.contains('group-item');
            const isReportsItem = btn.classList.contains('reports-item');

            // Update active state for all buttons
            subtabButtons.forEach(b => {
                if (b === btn) {
                    b.classList.add('active');
                    if (b.classList.contains('group-item') || b.classList.contains('reports-item')) {
                        b.style.background = 'var(--bg-tertiary)';
                        b.style.color = 'var(--accent-color)';
                    } else {
                        b.style.borderBottomColor = 'var(--accent-color)';
                        b.style.color = 'var(--accent-color)';
                    }
                } else {
                    b.classList.remove('active');
                    if (b.classList.contains('group-item') || b.classList.contains('reports-item')) {
                        b.style.background = 'transparent';
                        b.style.color = 'var(--text-secondary)';
                    } else {
                        b.style.borderBottomColor = 'transparent';
                        b.style.color = 'var(--text-secondary)';
                    }
                }
            });

            // Update group trigger state if item is inside dropdown
            if (groupTrigger) {
                if (isGroupItem) {
                    groupTrigger.style.borderBottomColor = 'var(--accent-color)';
                    groupTrigger.style.color = 'var(--accent-color)';
                    groupTrigger.innerHTML = `👥 User (${btn.textContent.trim().split(' ')[1]}) <span style="font-size: 10px;">▼</span>`;
                } else {
                    groupTrigger.style.borderBottomColor = 'transparent';
                    groupTrigger.style.color = 'var(--text-secondary)';
                    groupTrigger.innerHTML = `👥 User <span style="font-size: 10px;">▼</span>`;
                }
            }

            // Update reports trigger state if item is inside dropdown
            if (reportsTrigger) {
                if (isReportsItem) {
                    reportsTrigger.style.borderBottomColor = 'var(--accent-color)';
                    reportsTrigger.style.color = 'var(--accent-color)';
                    const reportName = btn.textContent.trim().split(' ').slice(1).join(' ');
                    reportsTrigger.innerHTML = `📊 Reports (${reportName}) <span style="font-size: 10px;">▼</span>`;
                } else {
                    reportsTrigger.style.borderBottomColor = 'transparent';
                    reportsTrigger.style.color = 'var(--text-secondary)';
                    reportsTrigger.innerHTML = `📊 Reports <span style="font-size: 10px;">▼</span>`;
                }
            }

            // Show subtab content
            await showSubTab(container, subtab);
        });
    });
}

/**
 * Show specific sub-tab content
 */
async function showSubTab(container, subtab) {
    const contentContainer = container.querySelector('#admin-subtab-content');

    // Clear content - each module handles its own loading state
    contentContainer.innerHTML = '';

    try {
        switch (subtab) {
            case 'logs':
                await renderLogsViewer(contentContainer);
                break;
            case 'timeline':
                await renderUserTimeline(contentContainer);
                break;
            case 'feedback':
                await renderFeedbackViewer(contentContainer);
                break;
            case 'password_requests':
                await renderPasswordRequests(contentContainer);
                break;
            case 'roadmap':
                await renderRoadmapPanel(contentContainer);
                break;
            case 'backups':
                await renderBackupManager(contentContainer);
                break;
            case 'user_activity':
                await renderUserActivityReport(contentContainer);
                break;
            case 'users_by_location':
                await renderUsersByLocationReport(contentContainer);
                break;
            case 'config':
                await renderConfigEditor(contentContainer);
                break;
            case 'users':
                await renderUserManagement(contentContainer);
                break;
            case 'groups':
                await renderGroupManagement(contentContainer);
                break;
            case 'demo_management':
                await renderDemoManagement(contentContainer);
                break;
            case 'system':
                await renderSystemInfo(contentContainer);
                break;
            default:
                contentContainer.innerHTML = `<div>Unknown subtab: ${subtab}</div>`;
        }
    } catch (error) {
        console.error(`Error loading ${subtab}:`, error);
        showError(`Failed to load ${subtab}: ${error.message}`);
        contentContainer.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                <div style="color: var(--danger-color);">Error loading ${subtab}</div>
                <div style="color: var(--text-secondary); margin-top: 10px;">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Load and display notification counts for pending items
 */
async function loadNotificationCounts(container) {
    try {
        const indicator = container.querySelector('#admin-notification-indicator');
        if (!indicator) return;

        // Fetch pending counts
        const [feedbackData, passwordData] = await Promise.all([
            apiClient.get('/api/feedback').catch(() => ({ feedback: [] })),
            apiClient.get('/api/admin/password-requests').catch(() => ({ requests: [] }))
        ]);

        const pendingFeedback = feedbackData.feedback?.filter(f => f.status === 'new').length || 0;
        const pendingPasswords = passwordData.requests?.filter(r => r.status === 'pending').length || 0;
        const totalPending = pendingFeedback + pendingPasswords;

        if (totalPending > 0) {
            // Show and update indicator
            indicator.style.display = 'block';

            const countEl = indicator.querySelector('#notification-count');
            const detailsEl = indicator.querySelector('#notification-details');
            const notificationBox = indicator.querySelector('.notification-pulse');

            countEl.textContent = `${totalPending} Pending`;

            const details = [];
            if (pendingFeedback > 0) details.push(`${pendingFeedback} feedback`);
            if (pendingPasswords > 0) details.push(`${pendingPasswords} pwd req`);
            detailsEl.textContent = details.join(' • ');

            // Add click handler to navigate to relevant section
            notificationBox.style.cursor = 'pointer';
            notificationBox.onclick = () => {
                // Navigate to feedback if there's pending feedback, otherwise password requests
                const targetTab = pendingFeedback > 0 ? 'feedback' : 'password_requests';
                showSubTab(container, targetTab);
            };
        } else {
            // Hide indicator
            indicator.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading notification counts:', error);
        // Silently fail - don't show error to user for background polling
    }
}
