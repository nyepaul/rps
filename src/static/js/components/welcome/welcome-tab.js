/**
 * Welcome tab component with profile management
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { STORAGE_KEYS } from '../../config.js';
import { showError, showSuccess } from '../../utils/dom.js';

export function renderWelcomeTab(container) {
    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: var(--space-4);">
            <!-- Getting Started Section -->
            <div id="getting-started" style="background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: var(--space-4); overflow: hidden;">
                <div id="getting-started-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; padding: 10px 16px; background: var(--accent-color); color: var(--text-on-accent);">
                    <span style="font-size: 14px; font-weight: 600; font-family: var(--font-display);">Getting Started</span>
                    <span id="getting-started-toggle" style="font-size: 12px; opacity: 0.85;">Show</span>
                </div>
                <div id="getting-started-body" style="display: none; padding: 12px 16px;">
                    <div class="gs-step" data-tab="welcome" data-action="create" style="display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 18px;">1.</span>
                        <a class="gs-link" href="#" style="font-size: 13px; font-weight: 600; color: var(--accent-color); text-decoration: none; min-width: 130px;">Create a profile</a>
                        <span style="font-size: 12px; color: var(--text-secondary);">Name, birth date, retirement date</span>
                    </div>
                    <div class="gs-step" data-tab="profile" style="display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 18px;">2.</span>
                        <a class="gs-link" href="#" style="font-size: 13px; font-weight: 600; color: var(--accent-color); text-decoration: none; min-width: 130px;">Enter financial data</a>
                        <span style="font-size: 12px; color: var(--text-secondary);">Income, expenses, assets, accounts</span>
                    </div>
                    <div class="gs-step" data-tab="analysis" style="display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 18px;">3.</span>
                        <a class="gs-link" href="#" style="font-size: 13px; font-weight: 600; color: var(--accent-color); text-decoration: none; min-width: 130px;">Run analysis</a>
                        <span style="font-size: 12px; color: var(--text-secondary);">Monte Carlo simulation, calculation report</span>
                    </div>
                    <div class="gs-step" data-tab="scenarios" style="display: flex; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 18px;">4.</span>
                        <a class="gs-link" href="#" style="font-size: 13px; font-weight: 600; color: var(--accent-color); text-decoration: none; min-width: 130px;">Compare scenarios</a>
                        <span style="font-size: 12px; color: var(--text-secondary);">What-if variations on your plan</span>
                    </div>
                    <div class="gs-step" data-tab="action-items" style="display: flex; align-items: baseline; gap: 8px; padding: 6px 0;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 18px;">5.</span>
                        <a class="gs-link" href="#" style="font-size: 13px; font-weight: 600; color: var(--accent-color); text-decoration: none; min-width: 130px;">Review action items</a>
                        <span style="font-size: 12px; color: var(--text-secondary);">Concrete next steps from your analysis</span>
                    </div>
                </div>
            </div>

            <!-- About Section -->
            <div id="about-app" style="background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: var(--space-4); overflow: hidden;">
                <div id="about-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; padding: 10px 16px; background: var(--info-color, #2563eb); color: #fff;">
                    <span style="font-size: 14px; font-weight: 600; font-family: var(--font-display);">About This App</span>
                    <span id="about-toggle" style="font-size: 12px; opacity: 0.85;">Show</span>
                </div>
                <div id="about-body" style="display: none; padding: 12px 16px; font-size: 13px; line-height: 1.5; color: var(--text-primary);">
                    <div style="margin-bottom: 10px;">
                        <strong style="font-size: 13px;">Purpose</strong>
                        <p style="margin: 4px 0 0; color: var(--text-secondary);">Local-first retirement and wealth planning. Model your financial future with Monte Carlo simulations, tax-aware projections, and scenario comparison -- all running on your own machine.</p>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <strong style="font-size: 13px;">Functionality</strong>
                        <ul style="margin: 4px 0 0; padding-left: 18px; color: var(--text-secondary);">
                            <li>Multi-profile support for household planning</li>
                            <li>Monte Carlo simulation with configurable market assumptions</li>
                            <li>Tax bracket modeling (federal + state), Roth conversions, RMDs</li>
                            <li>Scenario comparison for what-if analysis</li>
                            <li>AI-powered financial advisor (optional, requires API key)</li>
                            <li>Action items and strategic roadmap tracking</li>
                        </ul>
                    </div>
                    <div>
                        <strong style="font-size: 13px;">Security</strong>
                        <ul style="margin: 4px 0 0; padding-left: 18px; color: var(--text-secondary);">
                            <li>All data stored locally in SQLite -- nothing leaves your machine</li>
                            <li>Profile data encrypted at rest with AES-256-GCM</li>
                            <li>Bcrypt password hashing, session-based authentication</li>
                            <li>Rate limiting, audit logging, input validation on all endpoints</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Profiles Section -->
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: var(--space-5); border: 1px solid var(--border-color); box-shadow: 0 4px 12px var(--shadow-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
                    <h2 style="font-size: 18px; margin: 0; font-family: var(--font-display);">Your Profiles</h2>
                    <button id="create-profile-btn" style="padding: 8px 16px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        + New Profile
                    </button>
                </div>
                <div id="profiles-container">
                    <div style="text-align: center; padding: var(--space-5); color: var(--text-secondary);">
                        <div class="spinner" style="width: 24px; height: 24px; border: 3px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                        Loading profiles...
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
        </style>
    `;

    // Load and display profiles
    loadProfiles(container);

    // Set up create button
    const createBtn = container.querySelector('#create-profile-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => showCreateProfileModal(container));
    }

    // Set up Getting Started toggle
    const gsHeader = container.querySelector('#getting-started-header');
    const gsBody = container.querySelector('#getting-started-body');
    const gsToggle = container.querySelector('#getting-started-toggle');
    if (gsHeader) {
        gsHeader.addEventListener('click', () => {
            const isHidden = gsBody.style.display === 'none';
            gsBody.style.display = isHidden ? 'block' : 'none';
            gsToggle.textContent = isHidden ? 'Hide' : 'Show';
        });
    }

    // Set up About toggle
    const aboutHeader = container.querySelector('#about-header');
    const aboutBody = container.querySelector('#about-body');
    const aboutToggle = container.querySelector('#about-toggle');
    if (aboutHeader) {
        aboutHeader.addEventListener('click', () => {
            const isHidden = aboutBody.style.display === 'none';
            aboutBody.style.display = isHidden ? 'block' : 'none';
            aboutToggle.textContent = isHidden ? 'Hide' : 'Show';
        });
    }

    // Set up Getting Started step links
    container.querySelectorAll('.gs-step').forEach(step => {
        const link = step.querySelector('.gs-link');
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = step.dataset.tab;
                if (step.dataset.action === 'create') {
                    showCreateProfileModal(container);
                } else {
                    window.app.showTab(tab);
                }
            });
        }
    });
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
                <div class="profile-item" data-profile="${profile.name}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-primary); border: 2px solid ${isDefault ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 14px;">${profile.name}</strong>
                            ${isDefault ? '<span style="font-size: 10px; padding: 2px 6px; background: var(--accent-color); color: var(--text-on-accent); border-radius: 8px;">DEFAULT</span>' : ''}
                        </div>
                        <small style="color: var(--text-secondary); font-size: 11px;">Updated: ${new Date(profile.updated_at).toLocaleDateString()}</small>
                    </div>
                    <div class="profile-actions" style="display: flex; gap: 6px;">
                        <button class="set-default-btn" data-profile="${profile.name}" title="${isDefault ? 'Current default' : 'Set as default'}" style="padding: 5px 8px; background: ${isDefault ? 'var(--text-secondary)' : 'var(--bg-tertiary)'}; color: ${isDefault ? 'var(--text-on-accent)' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                            ${isDefault ? '★ Default' : '☆ Set Default'}
                        </button>
                        <button class="edit-profile-btn" data-profile="${profile.name}" title="Edit profile" style="padding: 5px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 4px; cursor: pointer;">
                            ✏️
                        </button>
                        <button class="delete-profile-btn" data-profile="${profile.name}" title="Delete profile" style="padding: 5px 8px; background: var(--danger-color); color: var(--text-on-danger); border: none; border-radius: 4px; cursor: pointer;">
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
    // Stop propagation on action button containers so clicks don't trigger profile load
    container.querySelectorAll('.profile-actions').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    // Click to load profile
    container.querySelectorAll('.profile-item').forEach(item => {
        item.addEventListener('click', async () => {
            const profileName = item.dataset.profile;
            await loadProfile(profileName);
        });

        // Hover effects
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 4px 12px var(--shadow-color)';
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
        <h2 style="margin-bottom: 20px; font-family: var(--font-display);">Create New Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Profile Name *</label>
                <input type="text" name="name" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Birth Date</label>
                <input type="date" name="birth_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Target Retirement Date</label>
                <input type="date" name="retirement_date" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                    <input type="checkbox" name="set_default">
                    <span>Set as default profile</span>
                </label>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
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
        <h2 style="margin-bottom: 20px; font-family: var(--font-display);">Edit Profile</h2>
        <form id="profile-form">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Profile Name *</label>
                <input type="text" name="name" value="${profile.name}" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Birth Date</label>
                <input type="date" name="birth_date" value="${profile.birth_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 13px;">Target Retirement Date</label>
                <input type="date" name="retirement_date" value="${profile.retirement_date || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="cancel-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Cancel
                </button>
                <button type="submit" style="padding: 10px 20px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
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
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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