/**
 * Dashboard tab component - Profile Management
 * Shows all available profiles with selection, info, and deletion options
 */

import { store } from '../../state/store.js';
import { profilesAPI } from '../../api/profiles.js';
import { formatCurrency, formatCompact } from '../../utils/formatters.js';
import { showSuccess, showError, showSpinner, hideSpinner } from '../../utils/dom.js';
import { STORAGE_KEYS } from '../../config.js';
import { calculateNetWorth, calculateLiquidAssets, calculateRetirementAssets, calculateRealEstateEquity, calculateTotalDebts } from '../../utils/financial-calculations.js';

export async function renderDashboardTab(container) {
    const currentUser = store.get('currentUser');
    const currentProfile = store.get('currentProfile');

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>Loading profiles...</div>
        </div>
    `;

    try {
        // Fetch all profiles for the current user
        const result = await profilesAPI.list();
        const profiles = result.profiles || [];

        renderProfileDashboard(container, profiles, currentProfile, currentUser);
    } catch (error) {
        console.error('Error loading profiles:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px; color: var(--danger-color);">⚠️</div>
                <h2 style="margin-bottom: 10px;">Error Loading Profiles</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    ${error.message || 'Could not load your profiles'}
                </p>
                <button onclick="window.location.reload()" style="padding: 10px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

/**
 * Render the profile dashboard
 */
function renderProfileDashboard(container, profiles, currentProfile, currentUser) {
    const hasProfiles = profiles && profiles.length > 0;

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: var(--space-2) var(--space-3);">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); flex-wrap: wrap; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                    <h1 style="font-size: 15px; margin: 0; font-weight: 600;">📊 Profile Dashboard</h1>
                </div>
                <button id="create-profile-btn" style="padding: 4px 8px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; flex-shrink: 0;">
                    + New
                </button>
            </div>

            ${currentProfile ? `
            <!-- Current Profile Banner -->
            <div style="background: linear-gradient(135deg, var(--accent-color), var(--info-color)); padding: 4px 10px; border-radius: 4px; margin-bottom: var(--space-2); color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">ACTIVE</span>
                        <span style="font-size: 13px; font-weight: 700;">${currentProfile.name}</span>
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <button onclick="window.app.showTab('profile')" style="padding: 2px 6px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; color: white; cursor: pointer; font-size: 10px;">
                            Settings
                        </button>
                        <button onclick="window.app.showTab('aie')" style="padding: 2px 6px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; color: white; cursor: pointer; font-size: 10px;">
                            Data
                        </button>
                    </div>
                </div>
            </div>
            ` : ''}

            ${hasProfiles ? `
            <!-- Profiles Grid -->
            <div>
                <div id="profiles-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                    ${profiles.map(profile => renderProfileCard(profile, currentProfile)).join('')}
                </div>
            </div>
            ` : `
            <!-- No Profiles State -->
            <div style="text-align: center; padding: 40px 20px; background: var(--bg-secondary); border-radius: 8px; border: 2px dashed var(--border-color);">
                <div style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;">📁</div>
                <h2 style="margin-bottom: 12px; font-size: 18px;">No Profiles Yet</h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 13px; max-width: 400px; margin-left: auto; margin-right: auto;">
                    Create your first financial planning profile to start modeling your retirement.
                </p>
                <button onclick="window.app.showTab('welcome')" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                    Get Started
                </button>
            </div>
            `}
        </div>
    `;

    setupDashboardHandlers(container, profiles);
}

/**
 * Render a profile card
 */
function renderProfileCard(profile, currentProfile) {
    const isActive = currentProfile && currentProfile.name === profile.name;
    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};

    // Calculate net worth (assets - debts)
    const { netWorth } = calculateNetWorth(assets);

    // Calculate age
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = profile.birth_date ? calcAge(profile.birth_date) : null;

    // Format last updated
    const lastUpdated = profile.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Unknown';

    return `
        <div class="profile-card ${isActive ? 'active-profile-card' : ''}" data-profile-name="${profile.name}" style="
            background: var(--bg-secondary);
            border-radius: 6px;
            padding: 8px;
            border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
            transition: all 0.2s;
            position: relative;
            box-shadow: ${isActive ? '0 1px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)'};
            ${isActive ? 'cursor: pointer;' : ''}
        ">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <h3 style="font-size: 13px; margin: 0; font-weight: 700; color: var(--text-primary); max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${profile.name}</h3>
                <span style="font-size: 9px; color: var(--text-secondary); opacity: 0.8;">${lastUpdated}</span>
            </div>

            <!-- Stats (horizontal) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
                <div style="text-align: left; padding: 4px 6px; background: var(--bg-primary); border-radius: 4px;">
                    <div style="font-size: 8px; color: var(--text-secondary); margin-bottom: 1px;">Net Worth</div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--success-color);">
                        ${netWorth !== 0 ? formatCompact(netWorth) : '--'}
                    </div>
                </div>
                <div style="text-align: left; padding: 4px 6px; background: var(--bg-primary); border-radius: 4px;">
                    <div style="font-size: 8px; color: var(--text-secondary); margin-bottom: 1px;">Income</div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--accent-color);">
                        ${financial.annual_income ? formatCompact(financial.annual_income) : '--'}
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 3px;">
                ${!isActive ? `
                <button class="load-profile-btn" data-profile-name="${profile.name}" style="flex: 1; padding: 4px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">
                    Load
                </button>
                ` : `
                <button disabled style="flex: 1; padding: 4px; background: var(--bg-tertiary); color: var(--text-secondary); border: none; border-radius: 4px; cursor: not-allowed; font-size: 10px; font-weight: 600;">
                    Current
                </button>
                `}
                <button class="view-info-btn" data-profile-name="${profile.name}" style="padding: 4px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">
                    Info
                </button>
                <button class="delete-profile-btn" data-profile-name="${profile.name}" style="padding: 4px 6px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 10px; opacity: 0.6;" onmouseover="this.style.opacity='1'; this.style.background='var(--danger-color)'; this.style.color='white'" onmouseout="this.style.opacity='0.6'; this.style.background='transparent'; this.style.color='var(--danger-color)'">
                    ✕
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup dashboard event handlers
 */
function setupDashboardHandlers(container, profiles) {
    // Create Profile Button
    const createBtn = container.querySelector('#create-profile-btn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            window.app.showTab('welcome');
        });
    }

    // Load Profile Buttons
    container.querySelectorAll('.load-profile-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const profileName = btn.dataset.profileName;
            await loadProfile(profileName, container);
        });
    });

    // Edit Profile Buttons
    container.querySelectorAll('.edit-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            editProfile(profileName);
        });
    });

    // View Info Buttons
    container.querySelectorAll('.view-info-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            const profile = profiles.find(p => p.name === profileName);
            if (profile) {
                showProfileInfoModal(profile);
            }
        });
    });

    // Clone Profile Buttons
    container.querySelectorAll('.clone-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            await cloneProfile(profileName, container);
        });
    });

    // Delete Profile Buttons
    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card click
            const profileName = btn.dataset.profileName;
            await deleteProfile(profileName, container);
        });
    });

    // Active Profile Card Click (opens edit)
    const activeProfileCard = container.querySelector('.active-profile-card');
    if (activeProfileCard) {
        activeProfileCard.addEventListener('click', (e) => {
            // Only trigger if clicking the card itself, not buttons
            if (e.target.classList.contains('profile-card') ||
                e.target.classList.contains('active-profile-card') ||
                e.target.closest('.profile-card') === activeProfileCard &&
                !e.target.closest('button')) {
                const profileName = activeProfileCard.dataset.profileName;
                editProfile(profileName);
            }
        });

        // Add hover effect
        activeProfileCard.addEventListener('mouseenter', () => {
            activeProfileCard.style.transform = 'translateY(-2px)';
            activeProfileCard.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });
        activeProfileCard.addEventListener('mouseleave', () => {
            activeProfileCard.style.transform = '';
            activeProfileCard.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
        });
    }
}

/**
 * Load a profile
 */
async function loadProfile(profileName, container) {
    showSpinner(`Loading profile "${profileName}"...`);
    try {
        const result = await profilesAPI.get(profileName);
        store.setState({ currentProfile: result.profile });

        // Set as default profile
        localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);

        showSuccess(`Profile "${profileName}" loaded successfully!`);

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error loading profile:', error);
        showError(`Failed to load profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Edit a profile
 */
async function editProfile(profileName) {
    showSpinner(`Opening profile "${profileName}"...`);
    try {
        const result = await profilesAPI.get(profileName);
        store.setState({ currentProfile: result.profile });

        // Set as default profile
        localStorage.setItem(STORAGE_KEYS.DEFAULT_PROFILE, profileName);

        // Navigate to profile tab
        window.app.showTab('profile');
    } catch (error) {
        console.error('Error loading profile for edit:', error);
        showError(`Failed to open profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Clone a profile
 */
async function cloneProfile(profileName, container) {
    // Prompt for new profile name
    const newName = prompt(`Enter a name for the cloned profile:`, `${profileName} (Copy)`);

    // User cancelled
    if (newName === null) {
        return;
    }

    // Validate name
    if (!newName || !newName.trim()) {
        showError('Profile name cannot be empty');
        return;
    }

    showSpinner(`Cloning profile "${profileName}"...`);
    try {
        const result = await profilesAPI.clone(profileName, newName.trim());
        showSuccess(`Profile "${profileName}" cloned as "${newName.trim()}"!`);

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error cloning profile:', error);
        showError(`Failed to clone profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Delete a profile
 */
async function deleteProfile(profileName, container) {
    const currentProfile = store.get('currentProfile');
    const isActive = currentProfile && currentProfile.name === profileName;

    const confirmMsg = isActive
        ? `Are you sure you want to delete the ACTIVE profile "${profileName}"?\n\nThis will permanently delete all data and cannot be undone.`
        : `Are you sure you want to delete profile "${profileName}"?\n\nThis action cannot be undone.`;

    if (!confirm(confirmMsg)) {
        return;
    }

    showSpinner(`Deleting profile "${profileName}"...`);
    try {
        await profilesAPI.delete(profileName);
        showSuccess(`Profile "${profileName}" deleted successfully!`);

        // If deleted profile was active, clear it
        if (isActive) {
            store.setState({ currentProfile: null });
            localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
        }

        // Refresh dashboard
        await renderDashboardTab(container);
    } catch (error) {
        console.error('Error deleting profile:', error);
        showError(`Failed to delete profile: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

/**
 * Show profile info modal
 */
function showProfileInfoModal(profile) {
    const data = profile.data || {};
    const financial = data.financial || {};
    const assets = data.assets || {};
    const spouse = data.spouse || {};
    const children = data.children || [];

    // Calculate net worth and breakdown
    const { netWorth, totalAssets, totalDebts, breakdown } = calculateNetWorth(assets);
    const retirementTotal = breakdown.retirementAssets;
    const taxableTotal = breakdown.taxableAssets;
    const realEstateEquity = breakdown.realEstateAssets; // This is already equity (value - mortgage)
    const realEstateGross = breakdown.realEstateGross;
    const mortgageDebts = breakdown.mortgageDebts;
    const otherTotal = breakdown.otherAssets;

    // Calculate age
    const calcAge = (dateStr) => {
        if (!dateStr) return null;
        const birth = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };
    const currentAge = profile.birth_date ? calcAge(profile.birth_date) : null;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 28px;">${profile.name}</h2>
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        Created: ${new Date(profile.created_at).toLocaleDateString()} •
                        Updated: ${new Date(profile.updated_at).toLocaleDateString()}
                    </div>
                </div>
                <button id="close-modal-btn" style="padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Close
                </button>
            </div>

            <!-- Personal Info -->
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Personal Information</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                        ${profile.birth_date ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Birth Date</div>
                            <div style="font-size: 14px; font-weight: 500;">${new Date(profile.birth_date).toLocaleDateString()}</div>
                        </div>
                        ` : ''}
                        ${currentAge ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Current Age</div>
                            <div style="font-size: 14px; font-weight: 500;">${currentAge}</div>
                        </div>
                        ` : ''}
                        ${profile.retirement_date ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Retirement Date</div>
                            <div style="font-size: 14px; font-weight: 500;">${new Date(profile.retirement_date).toLocaleDateString()}</div>
                        </div>
                        ` : ''}
                        ${spouse.name ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Spouse</div>
                            <div style="font-size: 14px; font-weight: 500;">${spouse.name}</div>
                        </div>
                        ` : ''}
                        ${children.length > 0 ? `
                        <div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Children</div>
                            <div style="font-size: 14px; font-weight: 500;">${children.length}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Financial Summary -->
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Financial Summary</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Income</span>
                            <span style="font-size: 16px; font-weight: 600;">${financial.annual_income ? formatCurrency(financial.annual_income, 0) : 'Not set'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Expenses</span>
                            <span style="font-size: 16px; font-weight: 600;">${financial.annual_expenses ? formatCurrency(financial.annual_expenses, 0) : 'Not set'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="font-size: 14px; color: var(--text-secondary);">Annual Savings</span>
                            <span style="font-size: 16px; font-weight: 600; color: ${(financial.annual_income - financial.annual_expenses) > 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${(financial.annual_income && financial.annual_expenses) ? formatCurrency(financial.annual_income - financial.annual_expenses, 0) : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Assets & Debts Summary -->
            <div>
                <h3 style="font-size: 18px; margin-bottom: 12px; color: var(--accent-color);">Assets & Net Worth</h3>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: 8px;">
                    <div style="display: grid; gap: 12px;">
                        <!-- Assets -->
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Retirement Accounts</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(retirementTotal, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Taxable Accounts</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(taxableTotal, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Real Estate (Market Value)</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(realEstateGross, 0)}</span>
                        </div>
                        ${mortgageDebts > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary); padding-left: 16px;">• Mortgage Balances</span>
                            <span style="font-size: 16px; font-weight: 600; color: var(--danger-color);">-${formatCurrency(mortgageDebts, 0)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary); padding-left: 16px; font-weight: 600;">= Real Estate Equity</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(realEstateEquity, 0)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                            <span style="font-size: 14px; color: var(--text-secondary);">Other Assets</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(otherTotal, 0)}</span>
                        </div>

                        <!-- Totals -->
                        <div style="display: flex; justify-content: space-between; padding-top: 8px; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                            <span style="font-size: 15px; font-weight: 600;">Total Assets</span>
                            <span style="font-size: 16px; font-weight: 600;">${formatCurrency(totalAssets, 0)}</span>
                        </div>
                        ${totalDebts > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                            <span style="font-size: 15px; font-weight: 600;">Total Debts</span>
                            <span style="font-size: 16px; font-weight: 600; color: var(--danger-color);">-${formatCurrency(totalDebts, 0)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding-top: 12px;">
                            <span style="font-size: 17px; font-weight: 700;">Net Worth</span>
                            <span style="font-size: 20px; font-weight: 700; color: var(--success-color);">${formatCurrency(netWorth, 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
