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
            <div style="margin-bottom: var(--space-3);">
                <h1 style="font-size: var(--font-2xl); margin: 0;">⚙️ Admin Dashboard</h1>
                <p style="color: var(--text-secondary); margin: 0; font-size: 13px;">
                    System administration and audit logs
                </p>
            </div>

            <!-- Admin Sub-Tabs -->
            <div style="display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 0; overflow-x: visible; align-items: center; background: var(--bg-secondary); border-radius: 6px 6px 0 0; padding: 0 10px;">
                <button class="admin-subtab active" data-subtab="logs" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid var(--accent-color); cursor: pointer; font-weight: 700; color: var(--accent-color); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
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
                <button class="admin-subtab" data-subtab="reports" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    📊 Reports
                </button>
                ` : ''}
                <button class="admin-subtab" data-subtab="config" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    ⚙️ Config
                </button>
                <button class="admin-subtab" data-subtab="system" style="padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-weight: 700; color: var(--text-secondary); transition: all 0.2s; white-space: nowrap; font-size: 13px;">
                    🖥️ System
                </button>
            </div>

            <!-- Sub-tab Content -->
            <div id="admin-subtab-content" style="padding: 0;"></div>
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
