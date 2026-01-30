/**
 * User Management Component
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { store } from '../../state/store.js';
import { showUserReport } from './user-report.js';

/**
 * Render user management interface
 */
export async function renderUserManagement(container) {
    // Get current user to check super admin status
    const currentUser = store.get('currentUser');

    try {
        const response = await apiClient.get('/api/admin/users');
        const users = response.users;

        container.innerHTML = `
            <div>
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h3 style="font-size: 18px; margin-bottom: 10px;">👥 User Management</h3>
                    <p style="color: var(--text-secondary); font-size: 13px; margin: 0;">
                        Manage user accounts, admin privileges, and account status
                    </p>
                </div>

                <!-- Users Table -->
                <div style="background: var(--bg-secondary); border-radius: 12px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">ID</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Username</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Groups</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Email</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Status</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Admin</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Super Admin</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Created</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Last Login</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => renderUserRow(user, currentUser)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Setup user action handlers
        setupUserActionHandlers(container);

    } catch (error) {
        console.error('Failed to load users:', error);
        showError(`Failed to load users: ${error.message}`);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: var(--danger-color);">
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                <div>Failed to load users</div>
            </div>
        `;
    }
}

/**
 * Render user row
 */
function renderUserRow(user, currentUser) {
    const createdDate = new Date(user.created_at).toLocaleDateString();
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';

    return `
        <tr class="user-row" data-user-id="${user.id}" data-username="${user.username}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px; font-size: 13px; font-family: monospace;">${user.id}</td>
            <td style="padding: 12px; font-weight: 600;">${user.username}</td>
            <td style="padding: 12px; font-size: 12px; color: var(--text-secondary);">
                ${user.group_names ? `<span style="display: inline-block; padding: 2px 6px; background: var(--info-bg); color: var(--info-color); border-radius: 4px; font-weight: 600;">${user.group_names}</span>` : '<span style="font-style: italic; opacity: 0.5;">None</span>'}
            </td>
            <td style="padding: 12px; font-size: 13px;">${user.email}</td>
            <td style="padding: 12px; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; background: ${user.is_active ? 'var(--success-color)20' : 'var(--danger-color)20'}; color: ${user.is_active ? 'var(--success-color)' : 'var(--danger-color)'}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; background: ${user.is_admin ? '#764ba220' : 'var(--bg-tertiary)'}; color: ${user.is_admin ? '#764ba2' : 'var(--text-secondary)'}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${user.is_admin ? 'Admin' : 'User'}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; background: ${user.is_super_admin ? '#e03131' : 'var(--bg-tertiary)'}; color: ${user.is_super_admin ? 'white' : 'var(--text-secondary)'}; border-radius: 4px; font-size: 11px; font-weight: 600;">
                    ${user.is_super_admin ? '⭐ Super Admin' : '—'}
                </span>
            </td>
            <td style="padding: 12px; font-size: 12px; color: var(--text-secondary);">${createdDate}</td>
            <td style="padding: 12px; font-size: 12px; color: var(--text-secondary);">${lastLogin}</td>
        </tr>
    `;
}

/**
 * Setup user action handlers
 */
function setupUserActionHandlers(container) {
    // Row click to manage user
    container.querySelectorAll('.user-row').forEach(row => {
        row.addEventListener('click', async () => {
            const userId = parseInt(row.getAttribute('data-user-id'));
            
            // Need to fetch full user object including status flags
            // Alternatively we could put data attributes on the row
            // Better to fetch fresh data
            try {
                const response = await apiClient.get('/api/admin/users');
                const user = response.users.find(u => u.id === userId);
                if (user) {
                    showUserManagementModal(user, store.get('currentUser'), container);
                }
            } catch (error) {
                console.error('Failed to load user data:', error);
                showError('Failed to load user data');
            }
        });
    });
}

/**
 * Show User Management Modal
 */
function showUserManagementModal(user, currentUser, parentContainer) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
    
    // Determine permissions
    const canManageGroups = currentUser.is_super_admin;
    const canDelete = currentUser.is_admin && user.id !== currentUser.id;
    const canToggleAdmin = currentUser.is_admin;
    const canToggleSuperAdmin = currentUser.is_super_admin;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
                <div>
                    <h3 style="margin: 0;">${user.username}</h3>
                    <div style="color: var(--text-secondary); font-size: 13px;">${user.email}</div>
                </div>
                <button class="close-modal-btn" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <div style="display: grid; gap: 15px;">
                <!-- Status & Roles -->
                <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-secondary);">Account Status</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <button id="toggle-active-btn" style="padding: 8px 12px; background: ${user.is_active ? 'var(--bg-tertiary)' : 'var(--success-color)'}; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; color: ${user.is_active ? 'var(--text-primary)' : 'white'};">
                            ${user.is_active ? '🚫 Deactivate' : '✅ Activate'}
                        </button>
                        ${canToggleAdmin ? `
                            <button id="toggle-admin-btn" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                                ${user.is_admin ? '👤 Remove Admin' : '👑 Make Admin'}
                            </button>
                        ` : ''}
                        ${canToggleSuperAdmin ? `
                            <button id="toggle-super-admin-btn" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                                ${user.is_super_admin ? '⚪ Remove Super Admin' : '⭐ Grant Super Admin'}
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Data & Management -->
                <div style="background: var(--bg-primary); padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-secondary);">Data & Management</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button id="view-profiles-btn" style="padding: 8px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                            📁 View Profiles
                        </button>
                        <button id="view-report-btn" style="padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                            📊 Activity Report
                        </button>
                        <button id="reset-password-btn" style="padding: 8px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            🔑 Reset Password
                        </button>
                        <button id="manage-backups-btn" style="padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                            💾 Backups
                        </button>
                        ${canManageGroups ? `
                            <button id="manage-groups-btn" style="padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; grid-column: span 2;">
                                🔗 Manage Groups
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Danger Zone -->
                ${canDelete ? `
                    <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                        <button id="delete-user-btn" style="width: 100%; padding: 10px; background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); border-radius: 6px; cursor: pointer; font-weight: 600;">
                            🗑️ Delete User
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event Listeners
    const close = () => modal.remove();
    modal.querySelector('.close-modal-btn').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#toggle-active-btn').onclick = async () => {
        if (confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} this user?`)) {
            await toggleUserActive(user.id, !user.is_active);
            modal.remove();
            renderUserManagement(parentContainer);
        }
    };

    if (canToggleAdmin) {
        modal.querySelector('#toggle-admin-btn').onclick = async () => {
            if (confirm(`Are you sure you want to ${user.is_admin ? 'remove admin' : 'make admin'}?`)) {
                await toggleUserAdmin(user.id, !user.is_admin);
                modal.remove();
                renderUserManagement(parentContainer);
            }
        };
    }

    if (canToggleSuperAdmin) {
        modal.querySelector('#toggle-super-admin-btn').onclick = async () => {
            if (confirm(`Are you sure?`)) {
                await toggleUserSuperAdmin(user.id, !user.is_super_admin);
                modal.remove();
                renderUserManagement(parentContainer);
            }
        };
    }

    modal.querySelector('#view-profiles-btn').onclick = () => viewUserProfiles(user.id);
    modal.querySelector('#view-report-btn').onclick = () => showUserReport(user.id, user.username);
    modal.querySelector('#reset-password-btn').onclick = () => resetUserPassword(user.id, user.username);
    modal.querySelector('#manage-backups-btn').onclick = () => showManageUserBackupsModal(user.id, user.username);
    
    if (canManageGroups) {
        modal.querySelector('#manage-groups-btn').onclick = () => {
            // We need to pass parentContainer to refresh the table later if needed
            // But showManageUserGroupsModal refreshes the table itself if passed
            showManageUserGroupsModal(user.id, user.username, parentContainer);
        };
    }

    if (canDelete) {
        modal.querySelector('#delete-user-btn').onclick = async () => {
            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete user "${user.username}" and ALL their data.\n\n` +
                `Type the username "${user.username}" to confirm:`
            );
            if (confirmed) {
                const typed = prompt(`Type "${user.username}" to confirm:`);
                if (typed === user.username) {
                    await deleteUser(user.id, user.username);
                    modal.remove();
                    renderUserManagement(parentContainer);
                }
            }
        };
    }
}

/**
 * Toggle user active status
 */
async function toggleUserActive(userId, isActive) {
    try {
        await apiClient.put(`/api/admin/users/${userId}`, { is_active: isActive });
        showSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        console.error('Failed to update user:', error);
        showError(`Failed to update user: ${error.message}`);
    }
}

/**
 * Toggle user admin status
 */
async function toggleUserAdmin(userId, isAdmin) {
    try {
        await apiClient.put(`/api/admin/users/${userId}`, { is_admin: isAdmin });
        showSuccess(`User ${isAdmin ? 'promoted to admin' : 'demoted from admin'} successfully`);
    } catch (error) {
        console.error('Failed to update user:', error);
        showError(`Failed to update user: ${error.message}`);
    }
}

/**
 * Toggle user super admin status (super admin only)
 */
async function toggleUserSuperAdmin(userId, isSuperAdmin) {
    try {
        await apiClient.put(`/api/admin/users/${userId}/super-admin`, {
            is_super_admin: isSuperAdmin
        });
        const message = isSuperAdmin
            ? 'User granted super admin privileges successfully (and promoted to admin if needed)'
            : 'User revoked from super admin successfully';
        showSuccess(message);
    } catch (error) {
        console.error('Failed to update super admin status:', error);

        // Show specific error message
        if (error.message.includes('Super admin privileges required')) {
            showError('Only super admins can manage super admin status');
        } else if (error.message.includes('Cannot revoke your own')) {
            showError('You cannot revoke your own super admin status');
        } else {
            showError(`Failed to update super admin status: ${error.message}`);
        }
    }
}

/**
 * Reset user password (admin only)
 */
async function resetUserPassword(userId, username) {
    try {
        // First check if user has encrypted data
        const usersResponse = await apiClient.get('/api/admin/users');
        const user = usersResponse.users.find(u => u.id === userId);

        // Warning about data loss
        const hasWarning = user && user.encrypted_dek;
        if (hasWarning) {
            const confirmed = confirm(
                `⚠️  CRITICAL WARNING ⚠️\n\n` +
                `User "${username}" has encrypted data protected by their password.\n\n` +
                `Resetting their password WITHOUT the old password will:\n` +
                `• PERMANENTLY DELETE all their encrypted profile data\n` +
                `• Make their financial data UNRECOVERABLE\n` +
                `• This CANNOT be undone!\n\n` +
                `Only proceed if:\n` +
                `1. User has forgotten their password AND\n` +
                `2. Data loss is acceptable AND\n` +
                `3. You have explained this to the user\n\n` +
                `Do you want to continue with password reset?`
            );

            if (!confirmed) {
                showError('Password reset cancelled');
                return;
            }
        }

        // Prompt for new password
        const newPassword = prompt(
            `Reset password for user "${username}":\n\n` +
            `Enter a new password (minimum 8 characters):`
        );

        if (!newPassword) {
            return; // User cancelled
        }

        if (newPassword.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        // Confirm password
        const confirmPassword = prompt(
            `Confirm new password for "${username}":`
        );

        if (newPassword !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        // Reset password
        const response = await apiClient.put(`/api/admin/users/${userId}/password`, {
            new_password: newPassword
        });

        let message = `Password reset successfully for user "${username}".\n\n` +
            `⚠️  Make sure to securely communicate the new password to the user.`;

        if (response.dek_lost) {
            message += `\n\n🔴 IMPORTANT: User's encrypted data was PERMANENTLY DELETED because the old password was not available to re-encrypt it. The user will need to re-enter all their profile information.`;
        }

        showSuccess(message);

    } catch (error) {
        console.error('Failed to reset password:', error);

        // Show specific error message
        if (error.message.includes('at least 8 characters')) {
            showError('Password must be at least 8 characters');
        } else {
            showError(`Failed to reset password: ${error.message}`);
        }
    }
}

/**
 * Delete user and all associated data (admin only)
 */
async function deleteUser(userId, username) {
    try {
        const response = await apiClient.delete(`/api/admin/users/${userId}`);

        // Show detailed success message
        const deleted = response.deleted;
        showSuccess(
            `User "${username}" deleted successfully.\n` +
            `Removed: ${deleted.profiles} profiles, ${deleted.conversations} conversations, ${deleted.feedback} feedback items.`
        );
    } catch (error) {
        console.error('Failed to delete user:', error);

        // Show specific error message
        if (error.message.includes('Cannot delete your own account')) {
            showError('You cannot delete your own account');
        } else if (error.message.includes('User not found')) {
            showError('User not found');
        } else {
            showError(`Failed to delete user: ${error.message}`);
        }
    }
}

/**
 * View user profiles
 */
async function viewUserProfiles(userId) {
    try {
        const response = await apiClient.get(`/api/admin/users/${userId}/profiles`);
        const profiles = response.profiles;

        // Create modal to show profiles
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">User Profiles (User ID: ${userId})</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>
                ${profiles.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
                        <div>No profiles found for this user</div>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${profiles.map(profile => `
                            <div style="padding: 15px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <div style="font-weight: 600; margin-bottom: 5px;">${profile.name}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">
                                    Created: ${new Date(profile.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        modal.classList.add('modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Failed to load user profiles:', error);
        showError(`Failed to load user profiles: ${error.message}`);
    }
}

/**
 * Show modal to manage which groups a user belongs to
 */
async function showManageUserGroupsModal(userId, username, parentContainer) {
    try {
        const [groupsRes, userGroupsRes] = await Promise.all([
            apiClient.get('/api/admin/groups'),
            apiClient.get(`/api/admin/users/${userId}/groups`)
        ]);
        
        const allGroups = groupsRes.groups;
        const userGroups = userGroupsRes.groups;
        const userGroupIds = new Set(userGroups.map(g => g.id));

        const modal = document.createElement('div');
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
        
        modal.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 450px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0;">Manage Groups: ${username}</h3>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Assign this user to one or more groups</p>
                    </div>
                    <button class="close-modal-btn" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding: 4px;">
                    ${allGroups.map(group => `
                        <label style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-primary); border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color); transition: border-color 0.2s;">
                            <input type="checkbox" class="group-membership-toggle" data-group-id="${group.id}" ${userGroupIds.has(group.id) ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 600; font-size: 14px;">${group.name}</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${group.description || 'No description'}</div>
                            </div>
                        </label>
                    `).join('')}
                    ${allGroups.length === 0 ? '<p style="text-align: center; color: var(--text-secondary);">No groups created yet. Go to the Groups tab to create one.</p>' : ''}
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                    <button class="close-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Handle close
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                renderUserManagement(parentContainer); // Refresh the table to show new group names
            });
        });
        
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); renderUserManagement(parentContainer); } });

        // Handle toggles
        modal.querySelectorAll('.group-membership-toggle').forEach(toggle => {
            toggle.addEventListener('change', async () => {
                const groupId = toggle.dataset.groupId;
                try {
                    if (toggle.checked) {
                        await apiClient.post(`/api/admin/users/${userId}/groups/${groupId}`);
                    } else {
                        await apiClient.delete(`/api/admin/users/${userId}/groups/${groupId}`);
                    }
                } catch (error) {
                    import('../../utils/dom.js').then(({ showError }) => {
                        showError(error.message);
                    });
                    toggle.checked = !toggle.checked; // Revert
                }
            });
        });

    } catch (error) {
        import('../../utils/dom.js').then(({ showError }) => {
            showError(`Failed to load groups: ${error.message}`);
        });
    }
}

/**
 * Show modal for admins to manage a specific user's backups
 */
async function showManageUserBackupsModal(userId, username) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0;">Backups: ${username}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">Manage snapshots for this account</p>
                </div>
                <button class="close-modal-btn" style="background: transparent; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                <button id="admin-create-backup-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    + New Admin Backup
                </button>
            </div>

            <div id="admin-user-backups-list" style="min-height: 150px;"></div>

            <div style="display: flex; justify-content: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                <button class="close-modal-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('.close-modal-btn').forEach(btn => btn.onclick = close);

    const refreshList = async () => {
        const listContainer = modal.querySelector('#admin-user-backups-list');
        try {
            const response = await apiClient.get(`/api/admin/users/${userId}/backups`);
            const backups = response.backups;

            if (backups.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No backups found for this user.</div>`;
                return;
            }

            listContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${backups.map(b => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                            <div>
                                <div style="font-weight: 600; font-size: 14px;">${b.label || 'Untitled'}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${b.filename}</div>
                                <div style="font-size: 10px; color: var(--text-light);">${new Date(b.created_at).toLocaleString()}</div>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="admin-restore-btn" data-id="${b.id}" style="padding: 4px 8px; background: var(--warning-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Restore</button>
                                <button class="admin-delete-btn" data-id="${b.id}" style="padding: 4px 8px; background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            listContainer.querySelectorAll('.admin-restore-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm(`⚠️ Really restore this backup for ${username}? Current data will be replaced.`)) {
                        try {
                            btn.disabled = true;
                            await apiClient.post(`/api/admin/users/${userId}/backups/${btn.dataset.id}/restore`);
                            alert('User data restored successfully.');
                            refreshList();
                        } catch (error) {
                            alert('Restore failed: ' + error.message);
                            btn.disabled = false;
                        }
                    }
                };
            });

            listContainer.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm('Delete this backup?')) {
                        try {
                            await apiClient.delete(`/api/admin/users/${userId}/backups/${btn.dataset.id}`);
                            refreshList();
                        } catch (error) {
                            alert('Delete failed: ' + error.message);
                        }
                    }
                };
            });

        } catch (error) {
            listContainer.innerHTML = `<div style="color: var(--danger-color);">Error: ${error.message}</div>`;
        }
    };

    modal.querySelector('#admin-create-backup-btn').onclick = async () => {
        const label = prompt('Backup Label:', `Admin Backup by ${store.get('currentUser').username}`);
        if (label === null) return;
        try {
            await apiClient.post(`/api/admin/users/${userId}/backups`, { label });
            refreshList();
        } catch (error) {
            alert('Backup failed: ' + error.message);
        }
    };

    await refreshList();
}
