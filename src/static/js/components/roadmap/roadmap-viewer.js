/**
 * Roadmap Viewer - Public view of application roadmap
 * All authenticated users can view, only super-admin can edit
 */

import { apiClient } from '../../api/client.js';

let currentModal = null;

/**
 * Show the roadmap viewer modal
 */
export async function showRoadmapViewer() {
    // Remove existing modal if any
    if (currentModal) {
        currentModal.remove();
    }

    // Create modal backdrop
    const modal = document.createElement('div');
    modal.id = 'roadmap-viewer-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--bg-primary);
            border-radius: 12px;
            width: 100%;
            max-width: 900px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h2 style="margin: 0; font-size: 20px;">🗺️ Product Roadmap</h2>
                    <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 13px;">
                        See what's coming next to RPS
                    </p>
                </div>
                <button id="close-roadmap-modal" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">×</button>
            </div>
            <div id="roadmap-content" style="
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            ">
                <div style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <p style="color: var(--text-secondary); margin-top: 16px;">Loading roadmap...</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    currentModal = modal;

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRoadmapViewer();
        }
    });

    // Close button
    modal.querySelector('#close-roadmap-modal').addEventListener('click', closeRoadmapViewer);

    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeRoadmapViewer();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Load roadmap data
    await loadRoadmapContent();
}

/**
 * Close the roadmap viewer modal
 */
export function closeRoadmapViewer() {
    if (currentModal) {
        currentModal.remove();
        currentModal = null;
    }
}

/**
 * Load and render roadmap content
 */
async function loadRoadmapContent() {
    const container = document.getElementById('roadmap-content');
    if (!container) return;

    try {
        const response = await apiClient.get('/api/roadmap/public');
        const { items, stats, can_edit } = response;

        if (items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <p>No roadmap items available yet.</p>
                </div>
            `;
            return;
        }

        // Build stats bar
        const statsHtml = `
            <div style="
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 24px;
            ">
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: var(--accent-color);">${stats.total}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Total Items</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #40c057;">${stats.completed}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Completed</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #fab005;">${stats.in_progress}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">In Progress</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #228be6;">${stats.planned}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Planned</div>
                </div>
            </div>
        `;

        // Group items by phase
        const phases = {
            'phase1': { label: 'Phase 1 - Current Focus', icon: '🎯', items: [] },
            'phase2': { label: 'Phase 2 - Next Up', icon: '📅', items: [] },
            'phase3': { label: 'Phase 3 - Future', icon: '🔮', items: [] },
            'backlog': { label: 'Backlog', icon: '📋', items: [] }
        };

        items.forEach(item => {
            const phase = phases[item.phase] || phases.backlog;
            phase.items.push(item);
        });

        // Build items HTML
        let itemsHtml = '';
        for (const [phaseKey, phase] of Object.entries(phases)) {
            if (phase.items.length === 0) continue;

            itemsHtml += `
                <div style="margin-bottom: 24px;">
                    <h3 style="
                        font-size: 16px;
                        margin: 0 0 12px 0;
                        padding-bottom: 8px;
                        border-bottom: 2px solid var(--border-color);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        ${phase.icon} ${phase.label}
                        <span style="
                            background: var(--bg-secondary);
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 12px;
                            font-weight: 600;
                            color: var(--text-secondary);
                        ">${phase.items.length}</span>
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${phase.items.map(item => renderRoadmapItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        // Admin edit notice
        const editNotice = can_edit ? `
            <div style="
                background: linear-gradient(135deg, var(--accent-color), #7c3aed);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <span>👑</span>
                <span>You have super-admin access. Edit roadmap items in the Admin Panel.</span>
            </div>
        ` : '';

        container.innerHTML = editNotice + statsHtml + itemsHtml;

    } catch (error) {
        console.error('Error loading roadmap:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <p>Failed to load roadmap: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render a single roadmap item
 */
function renderRoadmapItem(item) {
    const priorityColors = {
        critical: '#e03131',
        high: '#f76707',
        medium: '#1098ad',
        low: '#868e96'
    };

    const statusConfig = {
        planned: { icon: '📋', label: 'Planned', color: '#228be6' },
        in_progress: { icon: '⚡', label: 'In Progress', color: '#fab005' },
        completed: { icon: '✅', label: 'Completed', color: '#40c057' },
        on_hold: { icon: '⏸️', label: 'On Hold', color: '#868e96' }
    };

    const status = statusConfig[item.status] || statusConfig.planned;

    return `
        <div style="
            background: var(--bg-secondary);
            padding: 14px 16px;
            border-radius: 8px;
            border-left: 4px solid ${priorityColors[item.priority] || '#868e96'};
        ">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                        ${status.icon} ${item.title}
                    </div>
                    ${item.description ? `
                        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                            ${item.description}
                        </div>
                    ` : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end; flex-shrink: 0;">
                    <span style="
                        background: ${status.color};
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                    ">${status.label}</span>
                    <span style="
                        background: ${priorityColors[item.priority]};
                        color: white;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    ">${item.priority}</span>
                </div>
            </div>
            ${item.target_version ? `
                <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                    🏷️ Target: v${item.target_version}
                </div>
            ` : ''}
        </div>
    `;
}
