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
 * Show add/edit item modal
 */
function showItemModal(container, item = null) {
    const isEdit = !!item;
    const modalId = 'roadmap-item-modal';

    // Remove existing modal
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const categories = [
        'Healthcare & Medical', 'Tax Planning', 'Debt Management', 'Education Funding',
        'Insurance Analysis', 'Social Security', 'Estate Planning', 'Business Owner',
        'Investment Analysis', 'Life Events', 'Pension & Annuity', 'Real Estate',
        'RMD Planning', 'Cash Flow', 'Scenario Modeling', 'Withdrawal Strategy',
        'Family & Legacy', 'Retirement Lifestyle', 'Risk Analysis',
        'Compliance & Documentation', 'Technical Improvements', 'UI/UX Enhancements'
    ];

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); display: flex; align-items: center;
        justify-content: center; z-index: 10000; padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 18px;">${isEdit ? '✏️ Edit' : '➕ Add'} Roadmap Item</h2>
                <button id="close-item-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>
            <form id="roadmap-item-form" style="padding: 24px;">
                <div style="display: grid; gap: 16px;">
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 6px;">Title *</label>
                        <input type="text" name="title" required value="${item?.title || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 6px;">Description</label>
                        <textarea name="description" rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px; resize: vertical;">${item?.description || ''}</textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Category *</label>
                            <select name="category" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="">Select...</option>
                                ${categories.map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Priority</label>
                            <select name="priority" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="low" ${item?.priority === 'low' ? 'selected' : ''}>Low</option>
                                <option value="medium" ${!item || item?.priority === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="high" ${item?.priority === 'high' ? 'selected' : ''}>High</option>
                                <option value="critical" ${item?.priority === 'critical' ? 'selected' : ''}>Critical</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Phase</label>
                            <select name="phase" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="backlog" ${!item || item?.phase === 'backlog' ? 'selected' : ''}>Backlog</option>
                                <option value="phase1" ${item?.phase === 'phase1' ? 'selected' : ''}>Phase 1</option>
                                <option value="phase2" ${item?.phase === 'phase2' ? 'selected' : ''}>Phase 2</option>
                                <option value="phase3" ${item?.phase === 'phase3' ? 'selected' : ''}>Phase 3</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Status</label>
                            <select name="status" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="planned" ${!item || item?.status === 'planned' ? 'selected' : ''}>Planned</option>
                                <option value="in_progress" ${item?.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${item?.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="on_hold" ${item?.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                                <option value="cancelled" ${item?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Impact</label>
                            <select name="impact" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="">Not set</option>
                                <option value="low" ${item?.impact === 'low' ? 'selected' : ''}>Low</option>
                                <option value="medium" ${item?.impact === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="high" ${item?.impact === 'high' ? 'selected' : ''}>High</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Effort</label>
                            <select name="effort" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="">Not set</option>
                                <option value="small" ${item?.effort === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${item?.effort === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${item?.effort === 'large' ? 'selected' : ''}>Large</option>
                                <option value="xl" ${item?.effort === 'xl' ? 'selected' : ''}>XL</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-weight: 600; margin-bottom: 6px;">Target Version</label>
                            <input type="text" name="target_version" value="${item?.target_version || ''}" placeholder="e.g., 4.0.0" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">
                        </div>
                    </div>
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 6px;">Notes</label>
                        <textarea name="notes" rows="2" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; resize: vertical;">${item?.notes || ''}</textarea>
                    </div>
                </div>
                <div style="display: flex; justify-content: ${isEdit ? 'space-between' : 'flex-end'}; margin-top: 24px; gap: 12px;">
                    ${isEdit ? `<button type="button" id="delete-item-btn" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Delete</button>` : ''}
                    <div style="display: flex; gap: 12px;">
                        <button type="button" id="cancel-item-btn" style="padding: 10px 20px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                        <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">${isEdit ? 'Save Changes' : 'Add Item'}</button>
                    </div>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('#close-item-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancel-item-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Delete handler
    if (isEdit) {
        modal.querySelector('#delete-item-btn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this roadmap item?')) {
                try {
                    await apiClient.delete(`/api/roadmap/${item.id}`);
                    showSuccess(container, 'Item deleted');
                    closeModal();
                    await renderRoadmapPanel(container);
                } catch (error) {
                    showError(container, `Failed to delete: ${error.message}`);
                }
            }
        });
    }

    // Form submit
    modal.querySelector('#roadmap-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Clean empty strings to null
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            if (isEdit) {
                await apiClient.put(`/api/roadmap/${item.id}`, data);
                showSuccess(container, 'Item updated');
            } else {
                await apiClient.post('/api/roadmap', data);
                showSuccess(container, 'Item added');
            }
            closeModal();
            await renderRoadmapPanel(container);
        } catch (error) {
            showError(container, `Failed to save: ${error.message}`);
        }
    });
}

/**
 * Show add item modal
 */
function showAddItemModal(container) {
    showItemModal(container, null);
}

/**
 * Show item details modal for editing
 */
async function showItemDetailsModal(container, itemId) {
    try {
        const response = await apiClient.get(`/api/roadmap/${itemId}`);
        showItemModal(container, response.item);
    } catch (error) {
        showError(container, `Failed to load item: ${error.message}`);
    }
}

export { renderRoadmapItems, setupRoadmapEventHandlers };
