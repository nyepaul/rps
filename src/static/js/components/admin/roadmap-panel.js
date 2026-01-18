/**
 * Feature Roadmap Panel - Super Admin Only
 * View and manage product development roadmap
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';

/**
 * Render roadmap panel
 */
export async function renderRoadmapPanel(container) {
    try {
        const response = await apiClient.get('/api/roadmap');
        const items = response.items || [];

        // Get statistics
        const statsResponse = await apiClient.get('/api/roadmap/stats');
        const stats = statsResponse || {};

        container.innerHTML = `
            <div style="padding: var(--space-5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
                    <div>
                        <h2 style="font-size: var(--font-2xl); margin: 0 0 var(--space-2) 0;">📋 Feature Roadmap</h2>
                        <p style="color: var(--text-secondary); margin: 0;">Product development planning and gap analysis tracking</p>
                    </div>
                    <button id="add-roadmap-item-btn" style="padding: var(--space-3) var(--space-5); background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: var(--font-base);">
                        + Add Item
                    </button>
                </div>

                <!-- Statistics -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
                    <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; border-left: 4px solid var(--accent-color);">
                        <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">Total Items</div>
                        <div style="font-size: var(--font-2xl); font-weight: 700;">${stats.total || 0}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; border-left: 4px solid var(--success-color);">
                        <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">Completed</div>
                        <div style="font-size: var(--font-2xl); font-weight: 700;">${stats.by_status?.completed || 0}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; border-left: 4px solid var(--warning-color);">
                        <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">In Progress</div>
                        <div style="font-size: var(--font-2xl); font-weight: 700;">${stats.by_status?.in_progress || 0}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; border-left: 4px solid var(--info-color);">
                        <div style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">Planned</div>
                        <div style="font-size: var(--font-2xl); font-weight: 700;">${stats.by_status?.planned || 0}</div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="background: var(--bg-secondary); padding: var(--space-4); border-radius: 8px; margin-bottom: var(--space-4);">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3);">
                        <div>
                            <label style="font-size: var(--font-sm); font-weight: 600; margin-bottom: var(--space-2); display: block;">Phase</label>
                            <select id="filter-phase" style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="">All Phases</option>
                                <option value="phase1">Phase 1</option>
                                <option value="phase2">Phase 2</option>
                                <option value="phase3">Phase 3</option>
                                <option value="backlog">Backlog</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: var(--font-sm); font-weight: 600; margin-bottom: var(--space-2); display: block;">Priority</label>
                            <select id="filter-priority" style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: var(--font-sm); font-weight: 600; margin-bottom: var(--space-2); display: block;">Status</label>
                            <select id="filter-status" style="width: 100%; padding: var(--space-2); border: 1px solid var(--border-color); border-radius: 4px;">
                                <option value="">All Statuses</option>
                                <option value="planned">Planned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="on_hold">On Hold</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Roadmap Items -->
                <div id="roadmap-items-container"></div>
            </div>
        `;

        // Render items
        renderRoadmapItems(container, items);

        // Set up event handlers
        setupRoadmapEventHandlers(container);

    } catch (error) {
        console.error('Error loading roadmap:', error);
        container.innerHTML = `
            <div style="padding: var(--space-5); text-align: center;">
                <p style="color: var(--danger-color);">Error loading roadmap: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render roadmap items
 */
function renderRoadmapItems(container, items) {
    const itemsContainer = container.querySelector('#roadmap-items-container');

    if (items.length === 0) {
        itemsContainer.innerHTML = `
            <div style="text-align: center; padding: var(--space-8); color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: var(--space-4);">📋</div>
                <p>No roadmap items yet. Click "Add Item" to create one.</p>
            </div>
        `;
        return;
    }

    // Group by category
    const grouped = {};
    items.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });

    let html = '';
    for (const [category, categoryItems] of Object.entries(grouped)) {
        html += `
            <div style="margin-bottom: var(--space-6);">
                <h3 style="font-size: var(--font-lg); margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 2px solid var(--border-color);">
                    ${category} (${categoryItems.length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                    ${categoryItems.map(item => renderRoadmapItemCard(item)).join('')}
                </div>
            </div>
        `;
    }

    itemsContainer.innerHTML = html;
}

/**
 * Render a single roadmap item card
 */
function renderRoadmapItemCard(item) {
    const priorityColors = {
        critical: '#e03131',
        high: '#f76707',
        medium: '#1098ad',
        low: '#868e96'
    };

    const phaseLabels = {
        phase1: 'Phase 1',
        phase2: 'Phase 2',
        phase3: 'Phase 3',
        backlog: 'Backlog',
        completed: 'Completed'
    };

    const statusIcons = {
        planned: '📋',
        in_progress: '⚡',
        completed: '✅',
        on_hold: '⏸️',
        cancelled: '❌'
    };

    return `
        <div class="roadmap-item-card" data-id="${item.id}" style="
            background: var(--bg-secondary);
            padding: var(--space-4);
            border-radius: 8px;
            border-left: 4px solid ${priorityColors[item.priority] || '#868e96'};
            transition: all 0.2s;
            cursor: pointer;
        " onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
                <h4 style="font-size: var(--font-base); font-weight: 600; margin: 0; flex: 1;">
                    ${statusIcons[item.status] || '📋'} ${item.title}
                </h4>
                <div style="display: flex; gap: var(--space-2); flex-shrink: 0; margin-left: var(--space-3);">
                    <span style="background: ${priorityColors[item.priority]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: var(--font-xs); font-weight: 600; text-transform: uppercase;">
                        ${item.priority}
                    </span>
                    <span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: var(--font-xs); font-weight: 600;">
                        ${phaseLabels[item.phase] || item.phase}
                    </span>
                </div>
            </div>
            ${item.description ? `
                <p style="font-size: var(--font-sm); color: var(--text-secondary); margin: 0 0 var(--space-2) 0; line-height: 1.5;">
                    ${item.description}
                </p>
            ` : ''}
            <div style="display: flex; gap: var(--space-4); font-size: var(--font-xs); color: var(--text-secondary);">
                ${item.impact ? `<span>Impact: ${item.impact}</span>` : ''}
                ${item.effort ? `<span>Effort: ${item.effort}</span>` : ''}
                ${item.target_version ? `<span>Target: v${item.target_version}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Set up event handlers
 */
function setupRoadmapEventHandlers(container) {
    // Add item button
    const addBtn = container.querySelector('#add-roadmap-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => showAddItemModal(container));
    }

    // Filter handlers
    const filterPhase = container.querySelector('#filter-phase');
    const filterPriority = container.querySelector('#filter-priority');
    const filterStatus = container.querySelector('#filter-status');

    [filterPhase, filterPriority, filterStatus].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => applyFilters(container));
        }
    });

    // Item click handlers
    container.querySelectorAll('.roadmap-item-card').forEach(card => {
        card.addEventListener('click', () => {
            const itemId = card.getAttribute('data-id');
            showItemDetailsModal(container, itemId);
        });
    });
}

/**
 * Apply filters
 */
async function applyFilters(container) {
    const phase = container.querySelector('#filter-phase').value;
    const priority = container.querySelector('#filter-priority').value;
    const status = container.querySelector('#filter-status').value;

    try {
        const params = new URLSearchParams();
        if (phase) params.append('phase', phase);
        if (priority) params.append('priority', priority);
        if (status) params.append('status', status);

        const response = await apiClient.get(`/api/roadmap?${params.toString()}`);
        renderRoadmapItems(container, response.items || []);
        setupRoadmapEventHandlers(container);
    } catch (error) {
        console.error('Error applying filters:', error);
        showError(container, 'Failed to apply filters');
    }
}

/**
 * Show add item modal
 */
function showAddItemModal(container) {
    // This would open a modal with a form to add a new item
    // For now, just show an alert
    alert('Add item modal - TODO: Implement form');
}

/**
 * Show item details modal
 */
function showItemDetailsModal(container, itemId) {
    // This would open a modal with item details and edit options
    // For now, just show an alert
    alert(`Item details for ID ${itemId} - TODO: Implement details modal`);
}

export { renderRoadmapItems, setupRoadmapEventHandlers };
