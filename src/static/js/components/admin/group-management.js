/**
 * Group Management Component
 * Allows Super Admins to manage groups and Local Admins to view their managed groups.
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { store } from '../../state/store.js';

/**
 * Render group management interface
 */
export async function renderGroupManagement(container) {
    const currentUser = store.get('currentUser');

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
            <div>Loading groups...</div>
        </div>
    `;

    try {
        const response = await apiClient.get('/api/admin/groups');
        const groups = response.groups;

        container.innerHTML = `
            <div>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="font-size: 18px; margin-bottom: 5px;">🏗️ Group Management</h3>
                        <p style="color: var(--text-secondary); font-size: 13px; margin: 0;">
                            ${currentUser.is_super_admin ? 'Manage all user groups and assignments' : 'View and manage users in your assigned groups'}
                        </p>
                    </div>
                    ${currentUser.is_super_admin ? `
                        <button id="create-group-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            + New Group
                        </button>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                    ${groups.length === 0 ? `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--bg-secondary); border-radius: 12px;">
                            <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
                            <div style="color: var(--text-secondary);">No groups found</div>
                        </div>
                    ` : groups.map(group => renderGroupCard(group, currentUser)).join('')}
                </div>
            </div>
        `;

        setupGroupActionHandlers(container, currentUser);

    } catch (error) {
        console.error('Failed to load groups:', error);
        showError(`Failed to load groups: ${error.message}`);
    }
}

function renderGroupCard(group, currentUser) {
    return `
        <div class="group-card" data-group-id="${group.id}" data-group-name="${group.name}" style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 15px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="margin: 0; font-size: 16px;">${group.name}</h4>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">${group.description || 'No description'}</p>
                </div>
                ${currentUser.is_super_admin ? `
                    <div style="display: flex; gap: 5px;">
                        <button class="edit-group-btn" data-group-id="${group.id}" style="background: transparent; border: none; cursor: pointer; font-size: 14px;">✏️</button>
                        <button class="delete-group-btn" data-group-id="${group.id}" style="background: transparent; border: none; cursor: pointer; font-size: 14px;">🗑️</button>
                    </div>
                ` : ''}
            </div>
            
            <div style="flex: 1;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Actions</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="view-members-btn" data-group-id="${group.id}" style="padding: 6px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        👥 View Members
                    </button>
                    ${currentUser.is_super_admin ? `
                        <button class="manage-assignments-btn" data-group-id="${group.id}" style="padding: 6px 12px; background: var(--accent-color)20; color: var(--accent-color); border: 1px solid var(--accent-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            🔗 Assignments
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div style="font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--border-color); pt: 10px;">
                Created: ${new Date(group.created_at).toLocaleDateString()}
            </div>
        </div>
    `;
}

function setupGroupActionHandlers(container, currentUser) {
    // Create group
    const createBtn = container.querySelector('#create-group-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => showGroupModal(container, null));
    }

    // Edit group
    container.querySelectorAll('.edit-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const groupId = btn.dataset.groupId;
            const response = await apiClient.get(`/api/admin/groups/${groupId}`);
            showGroupModal(container, response.group);
        });
    });

    // Delete group
    container.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const groupId = btn.dataset.groupId;
            const groupName = btn.closest('.group-card').dataset.groupName;
            if (confirm(`Are you sure you want to delete group "${groupName}"? This will NOT delete users, only their association with this group.`)) {
                await apiClient.delete(`/api/admin/groups/${groupId}`);
                showSuccess('Group deleted');
                renderGroupManagement(container);
            }
        });
    });

    // View members
    container.querySelectorAll('.view-members-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const groupId = btn.dataset.groupId;
            showMembersModal(groupId);
        });
    });

    // Manage assignments
    container.querySelectorAll('.manage-assignments-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const groupId = btn.dataset.groupId;
            showAssignmentsModal(groupId);
        });
    });
}

function showGroupModal(container, group = null) {
    const isEdit = !!group;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h3 style="margin-top: 0;">${isEdit ? 'Edit Group' : 'Create New Group'}</h3>
            <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">Group Name</label>
                    <input type="text" id="group-name" value="${group?.name || ''}" placeholder="e.g., Thompson Family" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">Description</label>
                    <textarea id="group-desc" placeholder="Optional description..." style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px;">${group?.description || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                    <button class="cancel-modal-btn" style="padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button class="save-group-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">${isEdit ? 'Save Changes' : 'Create Group'}</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.cancel-modal-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.save-group-btn').addEventListener('click', async () => {
        const name = modal.querySelector('#group-name').value;
        const description = modal.querySelector('#group-desc').value;
        
        if (!name) return showError('Group name is required');

        try {
            if (isEdit) {
                await apiClient.put(`/api/admin/groups/${group.id}`, { name, description });
                showSuccess('Group updated');
            } else {
                await apiClient.post('/api/admin/groups', { name, description });
                showSuccess('Group created');
            }
            modal.remove();
            renderGroupManagement(container);
        } catch (error) {
            showError(error.message);
        }
    });
}

async function showMembersModal(groupId) {
    try {
        const response = await apiClient.get(`/api/admin/groups/${groupId}`);
        const group = response.group;
        const members = response.members;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
        
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">Members of ${group.name}</h3>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>
                
                ${members.length === 0 ? `
                    <div style="text-align: center; padding: 20px; color: var(--text-secondary);">No members in this group</div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${members.map(member => `
                            <div style="padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600;">${member.username}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${member.email}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    } catch (error) {
        showError(error.message);
    }
}

async function showAssignmentsModal(groupId) {
    try {
        const [groupsRes, usersRes] = await Promise.all([
            apiClient.get(`/api/admin/groups/${groupId}`),
            apiClient.get('/api/admin/users')
        ]);
        
        const group = groupsRes.group;
        const members = groupsRes.members;
        const memberIds = new Set(members.map(m => m.id));
        const allUsers = usersRes.users;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
        
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0;">Manage Assignments: ${group.name}</h3>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Assign users to this group and manage local admins</p>
                    </div>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>

                <div style="margin-bottom: 25px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent-color); margin-bottom: 10px;">User Group Membership</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                        ${allUsers.map(user => `
                            <label style="display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--bg-primary); border-radius: 6px; cursor: pointer;">
                                <input type="checkbox" class="user-membership-toggle" data-user-id="${user.id}" ${memberIds.has(user.id) ? 'checked' : ''}>
                                <span style="font-size: 13px;">${user.username}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #764ba2; margin-bottom: 10px;">Local Admins (Can manage this group)</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                        ${allUsers.filter(u => u.is_admin).map(admin => {
                            // Need to fetch managed groups for each admin? That's heavy.
                            // Better to have a dedicated endpoint for "who can manage this group"
                            return `
                                <div class="admin-manager-item" data-admin-id="${admin.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--bg-primary); border-radius: 6px;">
                                    <button class="admin-assignment-toggle" data-admin-id="${admin.id}" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer; background: var(--bg-secondary);">Loading...</button>
                                    <span style="font-size: 13px;">${admin.username}</span>
                                </div>
                            `;
                        }).join('')}
                        ${allUsers.filter(u => u.is_admin).length === 0 ? '<p style="font-size: 12px; color: var(--text-secondary);">No admins found to assign</p>' : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());

        // Handle user membership toggles
        modal.querySelectorAll('.user-membership-toggle').forEach(toggle => {
            toggle.addEventListener('change', async () => {
                const userId = toggle.dataset.userId;
                try {
                    if (toggle.checked) {
                        await apiClient.post(`/api/admin/groups/${groupId}/members/${userId}`);
                    } else {
                        await apiClient.delete(`/api/admin/groups/${groupId}/members/${userId}`);
                    }
                } catch (error) {
                    showError(error.message);
                    toggle.checked = !toggle.checked; // Revert
                }
            });
        });

        // Initialize admin assignments
        for (const adminItem of modal.querySelectorAll('.admin-manager-item')) {
            const adminId = adminItem.dataset.adminId;
            const btn = adminItem.querySelector('.admin-assignment-toggle');
            
            try {
                const res = await apiClient.get(`/api/admin/users/${adminId}/managed-groups`);
                const managedIds = new Set(res.groups.map(g => g.id));
                const isAssigned = managedIds.has(parseInt(groupId));
                
                btn.textContent = isAssigned ? 'Revoke Access' : 'Grant Access';
                btn.style.color = isAssigned ? 'var(--danger-color)' : 'var(--success-color)';
                
                btn.addEventListener('click', async () => {
                    const currentlyAssigned = btn.textContent === 'Revoke Access';
                    try {
                        if (currentlyAssigned) {
                            await apiClient.delete(`/api/admin/users/${adminId}/managed-groups/${groupId}`);
                            btn.textContent = 'Grant Access';
                            btn.style.color = 'var(--success-color)';
                        } else {
                            await apiClient.post(`/api/admin/users/${adminId}/managed-groups/${groupId}`);
                            btn.textContent = 'Revoke Access';
                            btn.style.color = 'var(--danger-color)';
                        }
                    } catch (error) {
                        showError(error.message);
                    }
                });
            } catch (error) {
                btn.textContent = 'Error';
            }
        }

    } catch (error) {
        showError(error.message);
    }
}
