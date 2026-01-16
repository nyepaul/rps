/**
 * Actions tab component - Manage action items
 */

import { actionItemsAPI } from '../../api/action-items.js';
import { store } from '../../state/store.js';
import { apiClient } from '../../api/client.js';
import { showSuccess, showError, showLoading } from '../../utils/dom.js';
import { formatDate } from '../../utils/formatters.js';

export function renderActionsTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h2 style="margin-bottom: 15px;">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Please create or select a profile to view action items.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h1 style="font-size: 36px; margin-bottom: 10px;">Action Items</h1>
                    <p style="color: var(--text-secondary);">
                        Profile: <strong>${profile.name}</strong>
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="generate-actions-btn" style="padding: 12px 24px; background: var(--info-bg); color: var(--info-color); border: 1px solid var(--info-color); border-radius: 6px; cursor: pointer; font-size: 16px;">
                        💡 Generate Recommendations
                    </button>
                    <button id="add-action-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                        + Add Action Item
                    </button>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid var(--border-color);">
                <button class="filter-tab active" data-filter="all" style="padding: 12px 24px; background: none; border: none; cursor: pointer; font-size: 16px; font-weight: 600; border-bottom: 3px solid var(--accent-color); color: var(--accent-color);">
                    All (<span id="count-all">0</span>)
                </button>
                <button class="filter-tab" data-filter="pending" style="padding: 12px 24px; background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-secondary); border-bottom: 3px solid transparent;">
                    To Do (<span id="count-pending">0</span>)
                </button>
                <button class="filter-tab" data-filter="completed" style="padding: 12px 24px; background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-secondary); border-bottom: 3px solid transparent;">
                    Completed (<span id="count-completed">0</span>)
                </button>
            </div>

            <!-- Action Items List -->
            <div id="action-items-container"></div>
        </div>

        <style>
            .filter-tab:hover {
                color: var(--accent-color);
            }
            .filter-tab.active {
                color: var(--accent-color);
                border-bottom-color: var(--accent-color) !important;
            }
            .action-item {
                background: var(--bg-secondary);
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 15px;
                display: flex;
                gap: 15px;
                align-items: flex-start;
                transition: all 0.2s;
                border: 2px solid transparent;
            }
            .action-item:hover {
                border-color: var(--accent-color);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px var(--shadow);
            }
            .action-item.completed {
                opacity: 0.7;
            }
            .action-item.completed .action-title {
                text-decoration: line-through;
            }
            .action-checkbox {
                width: 24px;
                height: 24px;
                cursor: pointer;
                margin-top: 4px;
            }
            .action-content {
                flex: 1;
            }
            .action-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--text-primary);
            }
            .action-description {
                color: var(--text-secondary);
                margin-bottom: 10px;
                line-height: 1.5;
            }
            .action-meta {
                display: flex;
                gap: 15px;
                font-size: 13px;
                color: var(--text-light);
            }
            .action-actions {
                display: flex;
                gap: 10px;
            }
            .action-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .action-btn:hover {
                transform: translateY(-1px);
            }
            .btn-edit {
                background: var(--info-bg);
                color: var(--info-color);
            }
            .btn-delete {
                background: var(--danger-bg);
                color: var(--danger-color);
            }
        </style>
    `;

    // Load action items and set up handlers
    loadActionItems(container, profile);
    setupActionsHandlers(container, profile);
}

async function loadActionItems(container, profile) {
    const listContainer = container.querySelector('#action-items-container');
    if (!listContainer) return;
    showLoading(listContainer, 'Loading action items...');

    try {
        const data = await actionItemsAPI.list(profile.name);
        const items = data.action_items || [];

        // Update counts
        const allCount = items.length;
        const pendingCount = items.filter(item => item.status !== 'completed').length;
        const completedCount = items.filter(item => item.status === 'completed').length;

        const countAll = container.querySelector('#count-all');
        const countPending = container.querySelector('#count-pending');
        const countCompleted = container.querySelector('#count-completed');

        if (countAll) countAll.textContent = allCount;
        if (countPending) countPending.textContent = pendingCount;
        if (countCompleted) countCompleted.textContent = completedCount;

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: var(--bg-secondary); border-radius: 12px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📝</div>
                    <h2 style="margin-bottom: 15px;">No Action Items Yet</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Create action items to track tasks and recommendations for your retirement plan.
                    </p>
                    <button id="add-first-action-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                        + Add First Action Item
                    </button>
                </div>
            `;

            const addFirstBtn = listContainer.querySelector('#add-first-action-btn');
            if (addFirstBtn) {
                addFirstBtn.addEventListener('click', () => {
                    showAddActionItemModal(container, profile);
                });
            }
            return;
        }

        // Display items
        displayActionItems(container, items, 'all');

    } catch (error) {
        console.error('Error loading action items:', error);
        showError(listContainer, error.message);
    }
}

function displayActionItems(container, items, filter) {
    const listContainer = container.querySelector('#action-items-container');
    if (!listContainer) return;

    let filteredItems = items;

    if (filter === 'pending') {
        filteredItems = items.filter(item => item.status !== 'completed');
    } else if (filter === 'completed') {
        filteredItems = items.filter(item => item.status === 'completed');
    }

    if (filteredItems.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No ${filter === 'all' ? '' : filter} action items found.
            </div>
        `;
        return;
    }

    listContainer.innerHTML = filteredItems.map(item => `
        <div class="action-item ${item.status === 'completed' ? 'completed' : ''}" data-id="${item.id}">
            <input
                type="checkbox"
                class="action-checkbox"
                data-id="${item.id}"
                ${item.status === 'completed' ? 'checked' : ''}
            >
            <div class="action-content">
                <div class="action-title">${item.title || 'Untitled Action'}</div>
                ${item.description ? `
                    <div class="action-description">${item.description}</div>
                ` : ''}
                <div class="action-meta">
                    <span>Priority: ${getPriorityLabel(item.priority)}</span>
                    ${item.due_date ? `<span>Due: ${formatDate(item.due_date)}</span>` : ''}
                    ${item.created_at ? `<span>Created: ${formatDate(item.created_at)}</span>` : ''}
                </div>
            </div>
            <div class="action-actions">
                <button class="action-btn btn-edit" data-id="${item.id}">Edit</button>
                <button class="action-btn btn-delete" data-id="${item.id}">Delete</button>
            </div>
        </div>
    `).join('');

    // Add event listeners
    listContainer.querySelectorAll('.action-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const isChecked = e.target.checked;

            try {
                if (isChecked) {
                    await actionItemsAPI.markComplete(id);
                    showSuccess('Action item completed!');
                } else {
                    await actionItemsAPI.markIncomplete(id);
                    showSuccess('Action item reopened.');
                }

                // Reload items
                const profile = store.get('currentProfile');
                loadActionItems(container, profile);

            } catch (error) {
                console.error('Error updating action item:', error);
                e.target.checked = !isChecked; // Revert checkbox
                alert(`Error updating action item: ${error.message}`);
            }
        });
    });

    listContainer.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            const item = items.find(i => i.id == id);
            if (item) {
                showEditActionItemModal(item);
            }
        });
    });

    listContainer.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;

            if (!confirm('Are you sure you want to delete this action item?')) {
                return;
            }

            try {
                await actionItemsAPI.delete(id);
                showSuccess('Action item deleted.');

                const profile = store.get('currentProfile');
                loadActionItems(container, profile);

            } catch (error) {
                console.error('Error deleting action item:', error);
                alert(`Error deleting action item: ${error.message}`);
            }
        });
    });
}

function setupActionsHandlers(container, profile) {
    // Generate actions button
    const generateBtn = container.querySelector('#generate-actions-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            showLoading(generateBtn, 'Generating...');
            generateBtn.disabled = true;

            try {
                const response = await apiClient.post('/api/action-items/generate', {
                    profile_name: profile.name
                });
                showSuccess('Recommendations generated based on your profile!');
                loadActionItems(container, profile);
            } catch (error) {
                console.error('Error generating action items:', error);
                showError('Failed to generate recommendations.');
            } finally {
                generateBtn.innerHTML = '💡 Generate Recommendations';
                generateBtn.disabled = false;
            }
        });
    }

    // Add action button
    const addBtn = container.querySelector('#add-action-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showAddActionItemModal(container, profile);
        });
    }

    // Filter tabs
    container.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            const filter = tab.dataset.filter;

            // Update active tab
            container.querySelectorAll('.filter-tab').forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            e.target.classList.add('active');
            e.target.style.borderBottomColor = 'var(--accent-color)';
            e.target.style.color = 'var(--accent-color)';

            // Load and filter items
            const data = await actionItemsAPI.list(profile.name);
            const items = data.action_items || [];
            displayActionItems(container, items, filter);
        });
    });
}

function showAddActionItemModal(parentContainer, profile) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%;">
            <h2 style="margin-bottom: 20px;">Add Action Item</h2>
            <form id="add-action-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Title *</label>
                    <input type="text" name="title" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                    <textarea name="description" rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);"></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Priority</label>
                        <select name="priority" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Due Date</label>
                        <input type="date" name="due_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" id="cancel-modal-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Add Action Item
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    const cancelBtn = modal.querySelector('#cancel-modal-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
    }

    const form = modal.querySelector('#add-action-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            const actionItemData = {
                profile_name: profile.name,
                title: formData.get('title'),
                description: formData.get('description') || '',
                priority: formData.get('priority'),
                due_date: formData.get('due_date') || null,
                status: 'pending'
            };

            try {
                await actionItemsAPI.create(actionItemData);
                showSuccess('Action item created!');
                modal.remove();
                loadActionItems(parentContainer, profile);
            } catch (error) {
                console.error('Error creating action item:', error);
                alert(`Error creating action item: ${error.message}`);
            }
        });
    }
}

function showEditActionItemModal(item) {
    // Similar to add modal, but pre-filled with item data
    console.log('Edit action item:', item);
    alert('Edit functionality coming soon!');
}

function getPriorityLabel(priority) {
    const labels = {
        low: '🟢 Low',
        medium: '🟡 Medium',
        high: '🔴 High'
    };
    return labels[priority] || priority;
}
