/**
 * Admin Tab - Main admin dashboard with sub-tabs
 */

import { store } from '../../state/store.js';
import { showError } from '../../utils/dom.js';
import { renderLogsViewer } from './logs-viewer.js';
import { renderConfigEditor } from './config-editor.js';
import { renderUserManagement } from './user-management.js';
import { renderSystemInfo } from './system-info.js';
import { renderFeedbackViewer } from './feedback-viewer.js';
import { renderRoadmapPanel } from './roadmap-panel.js';

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
            <div style="display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid var(--border-color); padding-bottom: 0;">
                <button class="admin-subtab active" data-subtab="logs" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid var(--accent-color); cursor: pointer; font-weight: 600; color: var(--accent-color); transition: all 0.2s;">
                    📋 Audit Logs
                </button>
                <button class="admin-subtab" data-subtab="feedback" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
                    💬 Feedback
                </button>
                ${user.is_super_admin ? `
                <button class="admin-subtab" data-subtab="roadmap" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
                    🗺️ Roadmap
                </button>
                ` : ''}
                <button class="admin-subtab" data-subtab="config" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
                    ⚙️ Configuration
                </button>
                <button class="admin-subtab" data-subtab="users" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
                    👥 Users
                </button>
                <button class="admin-subtab" data-subtab="system" style="padding: 12px 24px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
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

    subtabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const subtab = btn.getAttribute('data-subtab');

            // Update active state
            subtabButtons.forEach(b => {
                if (b === btn) {
                    b.classList.add('active');
                    b.style.borderBottomColor = 'var(--accent-color)';
                    b.style.color = 'var(--accent-color)';
                } else {
                    b.classList.remove('active');
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                }
            });

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
            case 'feedback':
                await renderFeedbackViewer(contentContainer);
                break;
            case 'roadmap':
                await renderRoadmapPanel(contentContainer);
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
