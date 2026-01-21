/**
 * Admin Tab - Main admin dashboard with sub-tabs
 */

import { store } from '../../state/store.js';
import { showError } from '../../utils/dom.js';
import { renderLogsViewer } from './logs-viewer.js';
import { renderUserTimeline } from './user-timeline.js';
import { renderConfigEditor } from './config-editor.js';
import { renderUserManagement } from './user-management.js';
import { renderSystemInfo } from './system-info.js';
import { renderFeedbackViewer } from './feedback-viewer.js';
import { renderRoadmapPanel } from './roadmap-panel.js';
import { renderBackupManager } from './backup-manager.js';
import { renderUsersByLocationReport } from './users-by-location-report.js';
import { renderPasswordRequests } from './password-requests.js';

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
        <div style="max-width: 1400px; margin: 0 auto;">
            <!-- Header -->
            <div style="margin-bottom: 30px;">
                <h1 style="font-size: 28px; margin-bottom: 10px;">⚙️ Admin Dashboard</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 14px;">
                    System administration, audit logs, and configuration management
                </p>
            </div>

            <!-- Admin Sub-Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid var(--border-color); padding-bottom: 0; overflow-x: visible; align-items: center;">
                <button class="admin-subtab active" data-subtab="logs" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid var(--accent-color); cursor: pointer; font-weight: 600; color: var(--accent-color); transition: all 0.2s; white-space: nowrap;">
                    📋 Audit Logs
                </button>

                <!-- User Section Dropdown -->
                <div class="admin-group-dropdown" style="position: relative; display: inline-block;">
                    <button class="admin-group-trigger" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 8px;">
                        👥 User <span style="font-size: 10px;">▼</span>
                    </button>
                    <div class="admin-group-content" style="display: none; position: absolute; top: 100%; left: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; min-width: 200px; padding: 8px 0;">
                        <button class="admin-subtab group-item" data-subtab="timeline" style="width: 100%; text-align: left; padding: 10px 20px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 500; transition: all 0.2s;">
                            📖 User Timeline
                        </button>
                        <button class="admin-subtab group-item" data-subtab="feedback" style="width: 100%; text-align: left; padding: 10px 20px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 500; transition: all 0.2s;">
                            💬 Feedback
                        </button>
                        <button class="admin-subtab group-item" data-subtab="password_requests" style="width: 100%; text-align: left; padding: 10px 20px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 500; transition: all 0.2s;">
                            🔑 Pwd Requests
                        </button>
                        <button class="admin-subtab group-item" data-subtab="users" style="width: 100%; text-align: left; padding: 10px 20px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary); font-weight: 500; transition: all 0.2s;">
                            👤 Accounts
                        </button>
                    </div>
                </div>

                ${user.is_super_admin ? `
                <button class="admin-subtab" data-subtab="roadmap" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap;">
                    🗺️ Roadmap
                </button>
                <button class="admin-subtab" data-subtab="backups" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap;">
                    💾 Backups
                </button>
                <button class="admin-subtab" data-subtab="reports" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap;">
                    📊 Reports
                </button>
                ` : ''}
                <button class="admin-subtab" data-subtab="config" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap;">
                    ⚙️ Configuration
                </button>
                <button class="admin-subtab" data-subtab="system" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap;">
                    🖥️ System Info
                </button>
            </div>

            <!-- Sub-tab Content -->
            <div id="admin-subtab-content"></div>
        </div>
    `;

    // Setup sub-tab switching
    setupSubTabSwitching(container);

    // Load default sub-tab (logs)
    await showSubTab(container, 'logs');
}

/**
 * Setup sub-tab switching functionality
 */
function setupSubTabSwitching(container) {
    const subtabButtons = container.querySelectorAll('.admin-subtab');
    const groupTrigger = container.querySelector('.admin-group-trigger');
    const groupContent = container.querySelector('.admin-group-content');

    // Setup dropdown toggle
    if (groupTrigger && groupContent) {
        groupTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = groupContent.style.display === 'block';
            groupContent.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            groupContent.style.display = 'none';
        });
    }

    subtabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const subtab = btn.getAttribute('data-subtab');
            const isGroupItem = btn.classList.contains('group-item');

            // Update active state for all buttons
            subtabButtons.forEach(b => {
                if (b === btn) {
                    b.classList.add('active');
                    if (b.classList.contains('group-item')) {
                        b.style.background = 'var(--bg-tertiary)';
                        b.style.color = 'var(--accent-color)';
                    } else {
                        b.style.borderBottomColor = 'var(--accent-color)';
                        b.style.color = 'var(--accent-color)';
                    }
                } else {
                    b.classList.remove('active');
                    if (b.classList.contains('group-item')) {
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

    // Show loading
    contentContainer.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>Loading ${subtab}...</div>
        </div>
    `;

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
            case 'reports':
                await renderUsersByLocationReport(contentContainer);
                break;
            case 'config':
                await renderConfigEditor(contentContainer);
                break;
            case 'users':
                await renderUserManagement(contentContainer);
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
