/**
 * User Management Component
 */

import { apiClient } from '../../api/client.js';
import { showSuccess, showError } from '../../utils/dom.js';
import { store } from '../../state/store.js';

/**
 * Render user management interface
 */
export async function renderUserManagement(container) {
    // Get current user to check super admin status
    const currentUser = store.get('currentUser');

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
            <div>Loading users...</div>
        </div>
    `;

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
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Email</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Status</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Admin</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Super Admin</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Created</th>
                                <th style="text-align: left; padding: 12px; font-size: 12px; font-weight: 600;">Last Login</th>
                                <th style="text-align: center; padding: 12px; font-size: 12px; font-weight: 600;">Actions</th>
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
        <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 12px; font-size: 13px; font-family: monospace;">${user.id}</td>
            <td style="padding: 12px; font-weight: 600;">${user.username}</td>
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
            <td style="padding: 12px; text-align: center;">
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button class="toggle-active-btn" data-user-id="${user.id}" data-is-active="${user.is_active}" style="padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;" title="${user.is_active ? 'Deactivate' : 'Activate'}">
                        ${user.is_active ? '🚫' : '✅'}
                    </button>
                    <button class="toggle-admin-btn" data-user-id="${user.id}" data-is-admin="${user.is_admin}" style="padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;" title="${user.is_admin ? 'Remove Admin' : 'Make Admin'}">
                        ${user.is_admin ? '👤' : '👑'}
                    </button>
                    ${currentUser && currentUser.is_super_admin ? `
                        <button class="toggle-super-admin-btn" data-user-id="${user.id}" data-is-super-admin="${user.is_super_admin}" data-is-admin="${user.is_admin}" style="padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 11px;" title="${user.is_super_admin ? 'Remove Super Admin' : 'Grant Super Admin'}">
                            ${user.is_super_admin ? '⭐' : '⚪'}
                        </button>
                    ` : ''}
                    <button class="reset-password-btn" data-user-id="${user.id}" data-username="${user.username}" style="padding: 4px 8px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Reset Password">
                        🔑
                    </button>
                    <button class="view-user-profiles-btn" data-user-id="${user.id}" style="padding: 4px 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" title="View Profiles">
                        📁
                    </button>
                    ${currentUser && user.id !== currentUser.id && currentUser.is_admin ? `
                        <button class="delete-user-btn" data-user-id="${user.id}" data-username="${user.username}" style="padding: 4px 8px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Delete User">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
}

/**
 * Setup user action handlers
 */
function setupUserActionHandlers(container) {
    // Toggle active status
    container.querySelectorAll('.toggle-active-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const isActive = btn.getAttribute('data-is-active') === 'true';

            if (confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'activate'} this user?`)) {
                await toggleUserActive(userId, !isActive);
                await renderUserManagement(container);  // Refresh
            }
        });
    });

    // Toggle admin status
    container.querySelectorAll('.toggle-admin-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const isAdmin = btn.getAttribute('data-is-admin') === 'true';

            if (confirm(`Are you sure you want to ${isAdmin ? 'remove admin privileges from' : 'grant admin privileges to'} this user?`)) {
                await toggleUserAdmin(userId, !isAdmin);
                await renderUserManagement(container);  // Refresh
            }
        });
    });

    // Toggle super admin status (only visible to super admins)
    container.querySelectorAll('.toggle-super-admin-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const isSuperAdmin = btn.getAttribute('data-is-super-admin') === 'true';

            const action = isSuperAdmin ? 'revoke super admin privileges from' : 'grant super admin privileges to';
            const message = isSuperAdmin
                ? `Are you sure you want to ${action} this user?`
                : `Are you sure you want to ${action} this user? (User will also be promoted to admin if needed)`;

            if (confirm(message)) {
                await toggleUserSuperAdmin(userId, !isSuperAdmin);
                await renderUserManagement(container);  // Refresh
            }
        });
    });

    // Reset password
    container.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const username = btn.getAttribute('data-username');
            await resetUserPassword(userId, username);
        });
    });

    // View user profiles
    container.querySelectorAll('.view-user-profiles-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            await viewUserProfiles(userId);
        });
    });

    // Delete user (admin only)
    container.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.getAttribute('data-user-id'));
            const username = btn.getAttribute('data-username');

            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete user "${username}" and ALL their data including:\n\n` +
                `• All profiles\n` +
                `• All scenarios\n` +
                `• All action items\n` +
                `• All conversations\n` +
                `• All feedback submissions\n\n` +
                `This action CANNOT be undone!\n\n` +
                `Type the username "${username}" in the next prompt to confirm deletion.`
            );

            if (confirmed) {
                const typedUsername = prompt(`Type "${username}" to confirm deletion:`);
                if (typedUsername === username) {
                    await deleteUser(userId, username);
                    await renderUserManagement(container);  // Refresh
                } else if (typedUsername !== null) {
                    showError('Username did not match. Deletion cancelled.');
                }
            }
        });
    });
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
