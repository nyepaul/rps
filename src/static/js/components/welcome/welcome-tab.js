/**
 * Welcome tab component with profile management
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { STORAGE_KEYS } from '../../config.js';
import { showLoading, showError, createElement, showSuccess } from '../../utils/dom.js';

export function renderWelcomeTab(container) {
    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto; padding: 10px;">
            <h1 style="font-size: 28px; margin-bottom: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                RPS
            </h1>

            <!-- Profiles Section -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px; margin-bottom: 15px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2 style="font-size: 20px; margin: 0;">Your Profiles</h2>
                    <button id="create-profile-btn" style="padding: 6px 14px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        + New Profile
                    </button>
                </div>
                <div id="profiles-container">
                    <div style="text-align: center; padding: 15px; color: var(--text-secondary);">
                        Loading profiles...
                    </div>
                </div>
            </div>

            <!-- Features Info -->
            <div style="text-align: center; padding: 15px; background: var(--info-bg); border-radius: 8px;">
                <h3 style="margin-bottom: 10px; font-size: 16px;">What You Can Do</h3>
                <ul style="text-align: left; display: inline-block; margin: 0; font-size: 13px;">
                    <li>Run Monte Carlo simulations with 10,000+ scenarios</li>
                    <li>Optimize Social Security claiming strategies</li>
                    <li>Analyze Roth conversion opportunities</li>
                    <li>Get AI-powered financial recommendations</li>
                    <li>Create multiple "what-if" scenarios</li>
                    <li>Track action items and progress</li>
                </ul>
            </div>
        </div>
    `;

    // Load and display profiles
    loadProfiles(container);

    // Set up create button
    const createBtn = container.querySelector('#create-profile-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => showCreateProfileModal(container));
    }
}

async function loadProfiles(container) {
    const profilesContainer = container.querySelector('#profiles-container');
    const defaultProfileName = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);

    try {
        const data = await profilesAPI.list();
        const profiles = data.profiles || [];

        if (profiles.length === 0) {
            profilesContainer.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                    <p>No profiles yet. Create your first profile to get started!</p>
                </div>
            `;
            return;
        }

        profilesContainer.innerHTML = profiles.map(profile => {
            const isDefault = profile.name === defaultProfileName;
            return `
                <div class="profile-item" data-profile="${profile.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--bg-primary); border: 2px solid ${isDefault ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <strong style="font-size: 16px;">${profile.name}</strong>
                            ${isDefault ? '<span style="font-size: 11px; padding: 2px 8px; background: var(--accent-color); color: white; border-radius: 10px;">DEFAULT</span>' : ''}
                        </div>
                        <small style="color: var(--text-secondary);">Updated: ${new Date(profile.updated_at).toLocaleDateString()}</small>
                    </div>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation()">
                        <button class="set-default-btn" data-profile="${profile.name}" title="${isDefault ? 'Current default' : 'Set as default'}" style="padding: 6px 10px; background: ${isDefault ? 'var(--text-secondary)' : 'var(--bg-tertiary)'}; color: ${isDefault ? 'white' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            ${isDefault ? '★ Default' : '☆ Set Default'}
                        </button>
                        <button class="edit-profile-btn" data-profile="${profile.name}" title="Edit profile" style="padding: 6px 10px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer;">
                            ✏️
                        </button>
                        <button class="delete-profile-btn" data-profile="${profile.name}" title="Delete profile" style="padding: 6px 10px; background: var(--danger-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event handlers
        setupProfileHandlers(container, profiles);

    } catch (error) {
        profilesContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--danger-color);">
                Error loading profiles: ${error.message}
            </div>
        `;
    }
}

function setupProfileHandlers(container, profiles) {
    // Click to load profile
    container.querySelectorAll('.profile-item').forEach(item => {
        item.addEventListener('click', async () => {
            const profileName = item.dataset.profile;
            await loadProfile(profileName);
        });

        // Hover effects
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 4px 12px var(--shadow)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = 'none';
        });
    });

    // Set default buttons
    container.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);
            showSuccess(`"${profileName}" set as default profile`);
            loadProfiles(container); // Refresh display
        });
    });

    // Edit buttons
    container.querySelectorAll('.edit-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            const profile = profiles.find(p => p.name === profileName);
            if (profile) {
                showEditProfileModal(container, profile);
            }
        });
    });

    // Delete buttons
    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const profileName = btn.dataset.profile;
            
            if (confirm(`Delete profile "${profileName}"? This cannot be undone.`)) {
                try {
                    await profilesAPI.delete(profileName);
                    // Clear default if this was it
                    if (localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE) === profileName) {
                        localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
                    }
                    // Clear current profile if this was it
                    const currentProfile = store.get('currentProfile');
                    if (currentProfile?.name === profileName) {
                        store.setState({ currentProfile: null });
                    }
                    showSuccess(`Profile "${profileName}" deleted`);
                    loadProfiles(container);
                } catch (error) {
                    showError(`Error deleting profile: ${error.message}`);
                }
            }
        });
    });
}

function showCreateProfileModal(container) {
    const modal = createModal(`
        <h2 style="margin-bottom: 20px;">Create New Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Profile Name *</label>
                <input type="text" name="name" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Birth Date</label>
                <input type="date" name="birth_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Target Retirement Date</label>
                <input type="date" name="retirement_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="set_default">
                    <span>Set as default profile</span>
                </label>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Create Profile
                </button>
            </div>
        </form>
    `);

    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const profileData = {
            name: formData.get('name'),
            birth_date: formData.get('birth_date') || null,
            retirement_date: formData.get('retirement_date') || null,
            data: {},
        };

        try {
            const result = await profilesAPI.create(profileData);

            // Set as default if checked
            if (formData.get('set_default')) {
                localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileData.name);
            }

            store.setState({ currentProfile: result.profile });
            modal.remove();
            window.app.showTab('profile');
        } catch (error) {
            showError(`Error creating profile: ${error.message}`);
        }
    });
}

function showEditProfileModal(container, profile) {
    const modal = createModal(`
        <h2 style="margin-bottom: 20px;">Edit Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Profile Name *</label>
                <input type="text" name="name" value="${profile.name}" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Birth Date</label>
                <input type="date" name="birth_date" value="${profile.birth_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Target Retirement Date</label>
                <input type="date" name="retirement_date" value="${profile.retirement_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Save Changes
                </button>
            </div>
        </form>
    `);

    modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const updates = {
            name: formData.get('name'),
            birth_date: formData.get('birth_date') || null,
            retirement_date: formData.get('retirement_date') || null,
        };

        try {
            const result = await profilesAPI.update(profile.name, updates);

            // Update default profile name if it changed
            const defaultProfile = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);
            if (defaultProfile === profile.name && updates.name !== profile.name) {
                localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, updates.name);
            }

            // Update current profile if this was it
            const currentProfile = store.get('currentProfile');
            if (currentProfile?.name === profile.name) {
                store.setState({ currentProfile: result.profile });
            }

            modal.remove();
            showSuccess('Profile updated');
            loadProfiles(container);
        } catch (error) {
            showError(`Error updating profile: ${error.message}`);
        }
    });
}

function createModal(content) {
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

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: var(--bg-secondary);
        padding: 30px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
    `;
    dialog.innerHTML = content;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    return modal;
}

async function loadProfile(profileName) {
    try {
        const data = await profilesAPI.get(profileName);
        store.setState({ currentProfile: data.profile });
        window.app.showTab('dashboard');
    } catch (error) {
        showError(`Error loading profile: ${error.message}`);
    }
}

// Export function to load default profile on app start
export async function loadDefaultProfile() {
    const defaultProfileName = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);
    if (!defaultProfileName) return false;

    try {
        const data = await profilesAPI.get(defaultProfileName);
        store.setState({ currentProfile: data.profile });
        return true;
    } catch (error) {
        // Default profile no longer exists, clear it
        localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
        return false;
    }
}
