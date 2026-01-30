/**
 * Actions tab component - Manage action items
 */

import { actionItemsAPI } from "../../api/action-items.js";
import { store } from "../../state/store.js";
import { showSuccess, showError, showLoading } from "../../utils/dom.js";
import { formatDate } from "../../utils/formatters.js";

export function renderActionsTab(container) {
    const profile = store.get('currentProfile');

    if (!profile) {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8) var(--space-5);">
                <div style="font-size: 64px; margin-bottom: var(--space-5);">✅</div>
                <h2 style="margin-bottom: var(--space-4);">No Profile Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Please create or select a profile to view action items.
                </p>
                <button id="go-to-welcome-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    Go to Welcome
                </button>
            </div>
        `;
        setTimeout(() => {
            const btn = container.querySelector('#go-to-welcome-btn');
            if (btn) btn.addEventListener('click', () => window.app.showTab('welcome'));
        }, 0);
        return;
    }

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: var(--font-2xl); margin: 0;">Action Items</h1>
                    <p style="color: var(--text-secondary); font-size: 13px; margin: 0;">
                        Recommendations for <strong>${profile.name}</strong>
                    </p>
                </div>
                <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; flex-shrink: 0;">
                    <button id="generate-actions-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s ease;" onmouseover="this.style.background='var(--accent-hover)';" onmouseout="this.style.background='var(--accent-color)';">
                        💡 Generate
                    </button>
                    <button id="add-action-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        + Add
                    </button>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-3); border-bottom: 1px solid var(--border-color); flex-wrap: wrap;">
                <button class="filter-tab active" data-filter="all" style="padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; border-bottom: 2px solid var(--accent-color); color: var(--accent-color);">
                    All (<span id="count-all">0</span>)
                </button>
                <button class="filter-tab" data-filter="pending" style="padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-secondary); border-bottom: 2px solid transparent;">
                    To Do (<span id="count-pending">0</span>)
                </button>
                <button class="filter-tab" data-filter="completed" style="padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-secondary); border-bottom: 2px solid transparent;">
                    Done (<span id="count-completed">0</span>)
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
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                display: flex;
                gap: 12px;
                align-items: flex-start;
                transition: all 0.2s;
                border: 1px solid var(--border-color);
            }
            .action-item:hover {
                border-color: var(--accent-color);
                background: var(--bg-tertiary);
            }
            .action-item.completed {
                opacity: 0.6;
            }
            .action-item.completed .action-title {
                text-decoration: line-through;
            }
            .action-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
                margin-top: 2px;
            }
            .action-content {
                flex: 1;
            }
            .action-title {
                font-size: 14px;
                font-weight: 700;
                margin-bottom: 2px;
                color: var(--text-primary);
            }
            .action-description {
                color: var(--text-secondary);
                margin-bottom: 6px;
                line-height: 1.4;
                font-size: 12px;
            }
            .action-meta {
                display: flex;
                gap: 10px;
                font-size: 11px;
                color: var(--text-light);
            }
            .action-actions {
                display: flex;
                gap: 6px;
            }
            .action-btn {
                padding: 4px 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s;
            }
            .action-btn:hover {
                transform: translateY(-1px);
            }
            .btn-edit {
                background: var(--bg-tertiary);
                color: var(--accent-color);
                border: 1px solid var(--border-color);
            }
            .btn-delete {
                background: transparent;
                color: var(--danger-color);
                border: 1px solid var(--danger-color);
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
                    <button id="add-first-action-btn" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.2s ease;" onmouseover="this.style.background='var(--accent-hover)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)';" onmouseout="this.style.background='var(--accent-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
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

    listContainer.innerHTML = filteredItems.map(item => {
        // Smart title selection: use title, or first line of description, or "Untitled Action"
        let displayTitle = item.title;
        let displayDescription = item.description;

        if (!displayTitle && displayDescription) {
            // Use description as title if no title exists
            displayTitle = displayDescription;
            displayDescription = ''; // Don't show description separately
        } else if (!displayTitle) {
            displayTitle = 'Untitled Action';
        }

        return `
            <div class="action-item ${item.status === 'completed' ? 'completed' : ''}" data-id="${item.id}" style="cursor: pointer;">
                <input
                    type="checkbox"
                    class="action-checkbox"
                    data-id="${item.id}"
                    ${item.status === 'completed' ? 'checked' : ''}
                >
                <div class="action-content">
                    <div class="action-title">${displayTitle}</div>
                    ${displayDescription ? `
                        <div class="action-description">${displayDescription}</div>
                    ` : ''}
                    <div class="action-meta">
                        ${item.category ? `<span>${getCategoryBadge(item.category)}</span>` : ''}
                        <span>${getPriorityLabel(item.priority)}</span>
                        ${item.due_date ? `<span>Due: ${formatDate(item.due_date)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners
    listContainer.querySelectorAll('.action-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            e.stopPropagation(); // Prevent row click
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

    // Row click handler for editing
    listContainer.querySelectorAll('.action-item').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking the checkbox
            if (e.target.classList.contains('action-checkbox')) {
                return;
            }
            
            const id = row.dataset.id;
            const item = items.find(i => i.id == id);
            if (item) {
                showActionItemModal(container, store.get('currentProfile'), item);
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
                await apiClient.post("/api/action-items/generate", {
                    profile_name: profile.name
                });
                showSuccess("Recommendations generated based on your profile!");
                loadActionItems(container, profile);
            } catch (error) {
                console.error('Error generating action items:', error);
                const errorMsg = error.message || 'Failed to generate recommendations.';
                const isApiKeyError = /API[_ ]key|api-keys|setup-api-keys|Gemini|Claude/i.test(errorMsg) && 
                                     (errorMsg.includes('not configured') || errorMsg.includes('not set') || errorMsg.includes('missing'));

                // Check if this is an API key error
                if (isApiKeyError) {
                    showError(errorMsg + ' Opening API settings...');
                    setTimeout(() => {
                        if (window.app && window.app.openSettings) {
                            window.app.openSettings('api-keys', 'gemini-api-key');
                        }
                    }, 1200);
                } else {
                    showError(errorMsg);
                }
            } finally {
                generateBtn.innerHTML = '💡 Generate';
                generateBtn.disabled = false;
            }
        });
    }

    // Add action button
    const addBtn = container.querySelector('#add-action-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showActionItemModal(container, profile);
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

function showActionItemModal(parentContainer, profile, item = null) {
    const isEdit = item !== null;
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; max-width: 600px; width: 90%; border: 1px solid var(--border-color);">
            <h2 style="margin-bottom: 20px;">${isEdit ? 'Edit' : 'Add'} Action Item</h2>
            <form id="action-item-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Title *</label>
                    <input type="text" name="title" value="${item?.title || ''}" required style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Description</label>
                    <textarea name="description" rows="3" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">${item?.description || ''}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Priority</label>
                        <select name="priority" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                            <option value="low" ${item?.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${(!item || item.priority === 'medium') ? 'selected' : ''}>Medium</option>
                            <option value="high" ${item?.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Due Date</label>
                        <input type="date" name="due_date" value="${item?.due_date || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; margin-top: 20px;">
                    <div>
                        ${isEdit ? `
                        <button type="button" id="delete-modal-btn" style="padding: 8px 16px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            Delete
                        </button>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="cancel-modal-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 13px;">
                            Cancel
                        </button>
                        <button type="submit" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                            ${isEdit ? 'Save Changes' : 'Add Action Item'}
                        </button>
                    </div>
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

    if (isEdit) {
        const deleteBtn = modal.querySelector('#delete-modal-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this action item?')) {
                    return;
                }

                try {
                    await actionItemsAPI.delete(item.id);
                    showSuccess('Action item deleted.');
                    modal.remove();
                    loadActionItems(parentContainer, profile);
                } catch (error) {
                    console.error('Error deleting action item:', error);
                    alert(`Error deleting action item: ${error.message}`);
                }
            });
        }
    }

    const form = modal.querySelector('#action-item-form');
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
                status: isEdit ? item.status : 'pending'
            };

            try {
                if (isEdit) {
                    await actionItemsAPI.update(item.id, actionItemData);
                    showSuccess('Action item updated!');
                } else {
                    await actionItemsAPI.create(actionItemData);
                    showSuccess('Action item created!');
                }
                modal.remove();
                loadActionItems(parentContainer, profile);
            } catch (error) {
                console.error('Error saving action item:', error);
                alert(`Error saving action item: ${error.message}`);
            }
        });
    }
}

function showAddActionItemModal(parentContainer, profile) {
    showActionItemModal(parentContainer, profile);
}

function getPriorityLabel(priority) {
    const labels = {
        low: '🟢 Low',
        medium: '🟡 Medium',
        high: '🔴 High'
    };
    return labels[priority] || priority;
}

function getCategoryBadge(category) {
    const badges = {
        'Retirement': '<span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">💼 Retirement</span>',
        'Healthcare': '<span style="background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">🏥 Healthcare</span>',
        'Savings': '<span style="background: #e0e7ff; color: #4338ca; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">💰 Savings</span>',
        'Estate': '<span style="background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">📜 Estate</span>',
        'Education': '<span style="background: #fce7f3; color: #9f1239; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">🎓 Education</span>',
        'Tax': '<span style="background: #fef2f2; color: #991b1b; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">📊 Tax</span>',
        'Inheritance': '<span style="background: #f3e8ff; color: #6b21a8; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">🏛️ Inheritance</span>',
        'Profile': '<span style="background: #e2e8f0; color: #475569; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">👤 Profile</span>'
    };
    return badges[category] || `<span style="background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${category}</span>`;
}
