/**
 * Backup Manager - Super Admin Backup Controls
 */

import { apiClient } from '../../api/client.js';
import { showError, showSuccess } from '../../utils/dom.js';

// Module state for selective backup
let selectiveState = {
    profiles: [],
    groups: [],
    selectedProfileIds: new Set(),
    selectedGroupIds: new Set(),
    selectiveBackups: []
};

/**
 * Render backup management interface
 */
export async function renderBackupManager(container) {
    container.innerHTML = `
        <div style="max-width: 1200px;">
            <div style="margin-bottom: 30px;">
                <h2 style="font-size: 24px; margin-bottom: 10px;">💾 Backup Management</h2>
                <p style="color: var(--text-secondary); margin: 0;">
                    Run and schedule system and data backups separately
                </p>
            </div>

            <!-- Backup Mode Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="tab-system" class="backup-mode-tab active" style="padding: 10px 20px; border: none; background: var(--accent-color); color: white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    System Backups
                </button>
                <button id="tab-selective" class="backup-mode-tab" style="padding: 10px 20px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Selective Backup
                </button>
            </div>

            <!-- System Backups Section -->
            <div id="system-backup-section">
                <!-- Backup Controls -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <!-- Data Backup Card -->
                    <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; border-left: 4px solid var(--accent-color); display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; flex: 1;">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">📋 Data Backups</h3>
                                <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 13px;">Profiles, scenarios, and application data</p>
                            </div>
                            <div style="text-align: right;">
                                <div id="total-backup-count" style="font-size: 24px; font-weight: 700; color: var(--accent-color);">--</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">Total Backups</div>
                            </div>
                        </div>
                        <button id="run-data-backup" style="width: 100%; padding: 12px; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                            🔄 Create New Backup
                        </button>
                    </div>

                <!-- System Backup Card -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; border-left: 4px solid #9b59b6; display: flex; flex-direction: column;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <span style="font-size: 32px;">⚙️</span>
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">System Backup</h3>
                                <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-secondary);">Configuration & scripts</p>
                            </div>
                        </div>
                        <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
                            Backs up system configuration, scripts, and settings. Essential for disaster recovery.
                        </p>
                    </div>
                    <button id="run-system-backup" style="width: 100%; padding: 12px; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; margin-top: 20px;">
                        Run System Backup
                    </button>
                </div>

                <!-- Full Backup Card -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; border-left: 4px solid #27ae60; display: flex; flex-direction: column;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <span style="font-size: 32px;">📦</span>
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">Full Backup</h3>
                                <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-secondary);">Complete backup</p>
                            </div>
                        </div>
                        <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
                            Backs up everything: database, configuration, logs, and documentation.
                        </p>
                    </div>
                    <button id="run-full-backup" style="width: 100%; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; margin-top: 20px;">
                        Run Full Backup
                    </button>
                </div>
            </div>

                <!-- Backup Schedule Status -->
                <div id="schedule-status" style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                    <h3 style="font-size: 18px; margin-bottom: 15px;">🕐 Automated Backup Schedule</h3>
                </div>

                <!-- Backup History -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="font-size: 18px; margin: 0;">📚 Backup History</h3>
                        <div style="display: flex; gap: 10px;">
                            <button id="filter-all" class="backup-filter active" data-type="all" style="padding: 8px 16px; border: 1px solid var(--border-color); background: var(--accent-color); color: white; border-radius: 6px; cursor: pointer; font-size: 13px;">
                                All
                            </button>
                            <button id="filter-full" class="backup-filter" data-type="full" style="padding: 8px 16px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px;">
                                Full
                            </button>
                            <button id="filter-data" class="backup-filter" data-type="data" style="padding: 8px 16px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px;">
                                Data
                            </button>
                            <button id="filter-system" class="backup-filter" data-type="system" style="padding: 8px 16px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px;">
                                System
                            </button>
                            <button id="refresh-backups" style="padding: 8px 16px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px;">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>

                    <div id="backup-list" style="min-height: 200px;">
                        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <div class="spinner" style="
                                width: 32px;
                                height: 32px;
                                border: 3px solid var(--border-color);
                                border-top-color: var(--accent-color);
                                border-radius: 50%;
                                animation: spin 0.8s linear infinite;
                                margin: 0 auto 10px;
                            "></div>
                            <style>
                                 spin {
                                    to { transform: rotate(360deg); }
                                }
                            </style>
                            Loading backups...
                        </div>
                    </div>
                </div>
            </div>

            <!-- Selective Backup Section (hidden by default) -->
            <div id="selective-backup-section" style="display: none;">
                <!-- Selection Controls -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <!-- Group Selection -->
                    <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; border-left: 4px solid #9b59b6;">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px;">👥 Select by Group</h3>
                        <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 13px;">
                            Backup all profiles belonging to users in selected groups
                        </p>
                        <div id="group-selection-list" style="max-height: 250px; overflow-y: auto;">
                            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading groups...</div>
                        </div>
                    </div>

                    <!-- Profile Selection -->
                    <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; border-left: 4px solid var(--accent-color);">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px;">📋 Select Individual Profiles</h3>
                        <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 13px;">
                            Select specific profiles to include in the backup
                        </p>
                        <div style="margin-bottom: 10px;">
                            <input type="text" id="profile-search" placeholder="Search profiles..."
                                   style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 14px;">
                        </div>
                        <div id="profile-selection-list" style="max-height: 200px; overflow-y: auto;">
                            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading profiles...</div>
                        </div>
                    </div>
                </div>

                <!-- Create Backup Section -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px; margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; font-size: 18px;">Create Selective Backup</h3>
                            <div id="selection-summary" style="color: var(--text-secondary); font-size: 14px;">
                                No profiles selected
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="backup-label" placeholder="Optional backup label..."
                                   style="padding: 10px 15px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); width: 200px;">
                            <button id="create-selective-backup" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; white-space: nowrap;">
                                Create Backup
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Selective Backup History -->
                <div style="background: var(--bg-secondary); padding: 25px; border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="font-size: 18px; margin: 0;">📦 Selective Backups</h3>
                        <button id="refresh-selective-backups" style="padding: 8px 16px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px;">
                            🔄 Refresh
                        </button>
                    </div>
                    <div id="selective-backup-list" style="min-height: 150px;">
                        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                            <div class="spinner" style="
                                width: 32px;
                                height: 32px;
                                border: 3px solid var(--border-color);
                                border-top-color: var(--accent-color);
                                border-radius: 50%;
                                animation: spin 0.8s linear infinite;
                                margin: 0 auto 10px;
                            "></div>
                            <style>
                                 spin {
                                    to { transform: rotate(360deg); }
                                }
                            </style>
                            Loading selective backups...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Setup event handlers
    setupBackupControls(container);
    setupTabSwitching(container);
    setupSelectiveBackupControls(container);

    // Load initial data
    await Promise.all([
        loadScheduleStatus(container),
        loadBackups(container, 'all')
    ]);
}

/**
 * Setup tab switching between system and selective backups
 */
function setupTabSwitching(container) {
    const systemTab = container.querySelector('#tab-system');
    const selectiveTab = container.querySelector('#tab-selective');
    const systemSection = container.querySelector('#system-backup-section');
    const selectiveSection = container.querySelector('#selective-backup-section');

    systemTab.addEventListener('click', () => {
        systemTab.classList.add('active');
        systemTab.style.background = 'var(--accent-color)';
        systemTab.style.color = 'white';
        systemTab.style.border = 'none';

        selectiveTab.classList.remove('active');
        selectiveTab.style.background = 'transparent';
        selectiveTab.style.color = 'var(--text-primary)';
        selectiveTab.style.border = '1px solid var(--border-color)';

        systemSection.style.display = 'block';
        selectiveSection.style.display = 'none';
    });

    selectiveTab.addEventListener('click', async () => {
        selectiveTab.classList.add('active');
        selectiveTab.style.background = 'var(--accent-color)';
        selectiveTab.style.color = 'white';
        selectiveTab.style.border = 'none';

        systemTab.classList.remove('active');
        systemTab.style.background = 'transparent';
        systemTab.style.color = 'var(--text-primary)';
        systemTab.style.border = '1px solid var(--border-color)';

        systemSection.style.display = 'none';
        selectiveSection.style.display = 'block';

        // Load selective backup data if not already loaded
        if (selectiveState.profiles.length === 0) {
            await loadSelectiveBackupData(container);
        }
    });
}

/**
 * Setup selective backup controls
 */
function setupSelectiveBackupControls(container) {
    // Create backup button
    const createBtn = container.querySelector('#create-selective-backup');
    createBtn.addEventListener('click', async () => {
        await createSelectiveBackup(container);
    });

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-selective-backups');
    refreshBtn.addEventListener('click', async () => {
        await loadSelectiveBackups(container);
    });

    // Profile search
    const searchInput = container.querySelector('#profile-search');
    searchInput.addEventListener('input', () => {
        filterProfiles(container, searchInput.value);
    });
}

/**
 * Load selective backup data (profiles and groups)
 */
async function loadSelectiveBackupData(container) {
    try {
        const [profilesRes, groupsRes, backupsRes] = await Promise.all([
            apiClient.get('/api/admin/backup/selective/profiles'),
            apiClient.get('/api/admin/backup/selective/groups'),
            apiClient.get('/api/admin/backup/selective')
        ]);

        selectiveState.profiles = profilesRes.profiles || [];
        selectiveState.groups = groupsRes.groups || [];
        selectiveState.selectiveBackups = backupsRes.backups || [];

        renderGroupSelection(container);
        renderProfileSelection(container);
        renderSelectiveBackups(container);
    } catch (error) {
        console.error('Error loading selective backup data:', error);
        showError('Failed to load backup data');
    }
}

/**
 * Render group selection list
 */
function renderGroupSelection(container) {
    const groupList = container.querySelector('#group-selection-list');

    if (selectiveState.groups.length === 0) {
        groupList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                No groups available
            </div>
        `;
        return;
    }

    groupList.innerHTML = selectiveState.groups.map(group => `
        <label style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;"
               class="group-select-item" data-group-id="${group.id}">
            <input type="checkbox" class="group-checkbox" data-group-id="${group.id}"
                   ${selectiveState.selectedGroupIds.has(group.id) ? 'checked' : ''}
                   style="width: 18px; height: 18px; cursor: pointer;">
            <div style="flex: 1;">
                <div style="font-weight: 600;">${group.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${group.member_count} members · ${group.profile_count} profiles
                </div>
            </div>
        </label>
    `).join('');

    // Add event listeners
    groupList.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const groupId = parseInt(checkbox.dataset.groupId);
            if (checkbox.checked) {
                selectiveState.selectedGroupIds.add(groupId);
            } else {
                selectiveState.selectedGroupIds.delete(groupId);
            }
            updateSelectionSummary(container);
        });
    });
}

/**
 * Render profile selection list
 */
function renderProfileSelection(container, filter = '') {
    const profileList = container.querySelector('#profile-selection-list');
    const filterLower = filter.toLowerCase();

    const filteredProfiles = selectiveState.profiles.filter(profile => {
        if (!filter) return true;
        return profile.name.toLowerCase().includes(filterLower) ||
               profile.username.toLowerCase().includes(filterLower);
    });

    if (filteredProfiles.length === 0) {
        profileList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                ${filter ? 'No matching profiles' : 'No profiles available'}
            </div>
        `;
        return;
    }

    profileList.innerHTML = filteredProfiles.map(profile => `
        <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--border-color); cursor: pointer;"
               class="profile-select-item">
            <input type="checkbox" class="profile-checkbox" data-profile-id="${profile.id}"
                   ${selectiveState.selectedProfileIds.has(profile.id) ? 'checked' : ''}
                   style="width: 16px; height: 16px; cursor: pointer;">
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${profile.name}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    ${profile.username}
                    ${profile.groups.length > 0 ? ` · ${profile.groups.map(g => g.name).join(', ')}` : ''}
                </div>
            </div>
        </label>
    `).join('');

    // Add event listeners
    profileList.querySelectorAll('.profile-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const profileId = parseInt(checkbox.dataset.profileId);
            if (checkbox.checked) {
                selectiveState.selectedProfileIds.add(profileId);
            } else {
                selectiveState.selectedProfileIds.delete(profileId);
            }
            updateSelectionSummary(container);
        });
    });
}

/**
 * Filter profiles by search term
 */
function filterProfiles(container, searchTerm) {
    renderProfileSelection(container, searchTerm);
}

/**
 * Update selection summary
 */
function updateSelectionSummary(container) {
    const summary = container.querySelector('#selection-summary');
    const profileCount = selectiveState.selectedProfileIds.size;
    const groupCount = selectiveState.selectedGroupIds.size;

    const parts = [];
    if (profileCount > 0) {
        parts.push(`${profileCount} profile${profileCount > 1 ? 's' : ''}`);
    }
    if (groupCount > 0) {
        parts.push(`${groupCount} group${groupCount > 1 ? 's' : ''}`);
    }

    summary.textContent = parts.length > 0 ? `Selected: ${parts.join(' + ')}` : 'No profiles selected';
}

/**
 * Create selective backup
 */
async function createSelectiveBackup(container) {
    const profileIds = Array.from(selectiveState.selectedProfileIds);
    const groupIds = Array.from(selectiveState.selectedGroupIds);

    if (profileIds.length === 0 && groupIds.length === 0) {
        showError('Please select at least one profile or group');
        return;
    }

    const label = container.querySelector('#backup-label').value.trim();
    const btn = container.querySelector('#create-selective-backup');
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.textContent = 'Creating backup...';

        const response = await apiClient.post('/api/admin/backup/selective', {
            profile_ids: profileIds,
            group_ids: groupIds,
            label: label || null
        });

        if (response.success) {
            showSuccess(response.message);

            // Clear selections
            selectiveState.selectedProfileIds.clear();
            selectiveState.selectedGroupIds.clear();
            container.querySelector('#backup-label').value = '';

            // Refresh lists
            await loadSelectiveBackupData(container);
        } else {
            showError(response.message || 'Backup failed');
        }
    } catch (error) {
        console.error('Error creating selective backup:', error);
        showError(`Failed to create backup: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/**
 * Load selective backups list
 */
async function loadSelectiveBackups(container) {
    const listContainer = container.querySelector('#selective-backup-list');

    try {
        const response = await apiClient.get('/api/admin/backup/selective');
        selectiveState.selectiveBackups = response.backups || [];
        renderSelectiveBackups(container);
    } catch (error) {
        console.error('Error loading selective backups:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--error-color);">
                Failed to load backups
            </div>
        `;
    }
}

/**
 * Render selective backups list
 */
function renderSelectiveBackups(container) {
    const listContainer = container.querySelector('#selective-backup-list');

    if (!selectiveState.selectiveBackups || selectiveState.selectiveBackups.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                <div>No selective backups found</div>
                <div style="font-size: 13px; margin-top: 10px;">Select profiles or groups above and create a backup</div>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border-color);">
                    <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Label / Filename</th>
                    <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Profiles</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Size</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Created</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${selectiveState.selectiveBackups.map(backup => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px;">
                            <div style="font-weight: 500;">${backup.label || 'Untitled'}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${backup.filename}</div>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            <span style="display: inline-block; padding: 4px 12px; background: var(--accent-color); color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                ${backup.profile_count}
                            </span>
                        </td>
                        <td style="padding: 12px; text-align: right; font-size: 13px;">${backup.size_human}</td>
                        <td style="padding: 12px; text-align: right; font-size: 13px; color: var(--text-secondary);">${formatDate(backup.created_at)}</td>
                        <td style="padding: 12px; text-align: right;">
                            <button class="selective-view-btn" data-filename="${backup.filename}"
                                    style="padding: 6px 12px; margin-right: 8px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px;">
                                📋 View
                            </button>
                            <button class="selective-restore-btn" data-filename="${backup.filename}"
                                    style="padding: 6px 12px; margin-right: 8px; background: #d35400; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                ↻ Restore
                            </button>
                            <button class="selective-delete-btn" data-filename="${backup.filename}"
                                    style="padding: 6px 12px; background: #c0392b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Add event listeners
    listContainer.querySelectorAll('.selective-view-btn').forEach(btn => {
        btn.addEventListener('click', () => showSelectiveBackupDetails(btn.dataset.filename));
    });

    listContainer.querySelectorAll('.selective-restore-btn').forEach(btn => {
        btn.addEventListener('click', () => showSelectiveRestoreModal(container, btn.dataset.filename));
    });

    listContainer.querySelectorAll('.selective-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSelectiveBackup(container, btn.dataset.filename));
    });
}

/**
 * Show selective backup details modal
 */
async function showSelectiveBackupDetails(filename) {
    try {
        const response = await apiClient.get(`/api/admin/backup/selective/${encodeURIComponent(filename)}`);

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        modal.innerHTML = `
            <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="padding: 25px; border-bottom: 2px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; font-size: 20px;">📦 Backup Details</h2>
                        <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
                    </div>
                </div>

                <div style="padding: 25px;">
                    <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Backup Information</h3>
                        <div style="display: grid; gap: 10px; font-size: 14px;">
                            <div><strong>Label:</strong> ${response.metadata?.label || 'None'}</div>
                            <div><strong>Created:</strong> ${response.metadata?.created_at || 'Unknown'}</div>
                            <div><strong>Profiles:</strong> ${response.profiles?.length || 0}</div>
                            <div><strong>Scenarios:</strong> ${response.scenario_count || 0}</div>
                            <div><strong>Action Items:</strong> ${response.action_item_count || 0}</div>
                        </div>
                    </div>

                    <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Profiles in Backup</h3>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${(response.profiles || []).map(p => `
                                <div style="padding: 10px; border-bottom: 1px solid var(--border-color);">
                                    <div style="font-weight: 500;">${p.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${p.username} · Updated: ${formatDate(p.updated_at)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#close-modal').addEventListener('click', () => document.body.removeChild(modal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) document.body.removeChild(modal);
        });

    } catch (error) {
        console.error('Error loading backup details:', error);
        showError('Failed to load backup details');
    }
}

/**
 * Show selective restore modal
 */
async function showSelectiveRestoreModal(container, filename) {
    try {
        const response = await apiClient.get(`/api/admin/backup/selective/${encodeURIComponent(filename)}`);

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        modal.innerHTML = `
            <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="padding: 25px; border-bottom: 2px solid var(--border-color);">
                    <h2 style="margin: 0; font-size: 20px; color: var(--warning-color);">⚠️ Restore from Backup</h2>
                </div>

                <div style="padding: 25px;">
                    <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
                        <strong>Warning:</strong> This will restore the selected profiles. Existing data may be overwritten depending on the restore mode.
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600;">Restore Mode:</label>
                        <select id="restore-mode" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
                            <option value="merge">Merge (Update existing, add new)</option>
                            <option value="replace">Replace (Delete related data first)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600;">Select Profiles to Restore:</label>
                        <div style="margin-bottom: 10px;">
                            <button id="select-all-profiles" style="padding: 6px 12px; margin-right: 8px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px;">
                                Select All
                            </button>
                            <button id="select-none-profiles" style="padding: 6px 12px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px;">
                                Select None
                            </button>
                        </div>
                        <div id="restore-profile-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                            ${(response.profiles || []).map(p => `
                                <label style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;">
                                    <input type="checkbox" class="restore-profile-cb" data-profile-id="${p.id}" checked style="width: 16px; height: 16px;">
                                    <div>
                                        <div style="font-weight: 500;">${p.name}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">${p.username}</div>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="cancel-restore" style="padding: 10px 20px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Cancel
                        </button>
                        <button id="confirm-restore" style="padding: 10px 20px; background: var(--warning-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Restore Selected
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Select all/none buttons
        modal.querySelector('#select-all-profiles').addEventListener('click', () => {
            modal.querySelectorAll('.restore-profile-cb').forEach(cb => cb.checked = true);
        });

        modal.querySelector('#select-none-profiles').addEventListener('click', () => {
            modal.querySelectorAll('.restore-profile-cb').forEach(cb => cb.checked = false);
        });

        // Cancel button
        modal.querySelector('#cancel-restore').addEventListener('click', () => document.body.removeChild(modal));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) document.body.removeChild(modal);
        });

        // Confirm restore
        modal.querySelector('#confirm-restore').addEventListener('click', async () => {
            const selectedIds = Array.from(modal.querySelectorAll('.restore-profile-cb:checked'))
                .map(cb => parseInt(cb.dataset.profileId));

            if (selectedIds.length === 0) {
                showError('Please select at least one profile to restore');
                return;
            }

            const restoreMode = modal.querySelector('#restore-mode').value;
            document.body.removeChild(modal);

            await performSelectiveRestore(container, filename, selectedIds, restoreMode);
        });

    } catch (error) {
        console.error('Error showing restore modal:', error);
        showError('Failed to load backup details');
    }
}

/**
 * Perform selective restore
 */
async function performSelectiveRestore(container, filename, profileIds, restoreMode) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10001;';
    overlay.innerHTML = `
        <div style="background: var(--bg-primary); padding: 40px; border-radius: 12px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
            <h3 style="margin: 0 0 15px 0;">Restoring Profiles...</h3>
            <p style="margin: 0; color: var(--text-secondary);">Please wait...</p>
        </div>
    `;
    document.body.appendChild(overlay);

    try {
        const response = await apiClient.post(`/api/admin/backup/selective/${encodeURIComponent(filename)}/restore`, {
            profile_ids: profileIds,
            restore_mode: restoreMode
        });

        document.body.removeChild(overlay);

        if (response.success) {
            showSuccess(`Restored ${response.result.profiles_restored} new profiles, updated ${response.result.profiles_updated} existing`);
        } else {
            showError(response.message || 'Restore completed with errors');
        }

        // Refresh the selective backup data
        await loadSelectiveBackupData(container);

    } catch (error) {
        document.body.removeChild(overlay);
        console.error('Error restoring backup:', error);
        showError(`Restore failed: ${error.message}`);
    }
}

/**
 * Delete selective backup
 */
async function deleteSelectiveBackup(container, filename) {
    if (!confirm(`Are you sure you want to delete this backup?\n\n${filename}`)) {
        return;
    }

    try {
        await apiClient.delete(`/api/admin/backup/selective/${encodeURIComponent(filename)}`);
        showSuccess('Backup deleted successfully');
        await loadSelectiveBackups(container);
    } catch (error) {
        console.error('Error deleting backup:', error);
        showError(`Failed to delete backup: ${error.message}`);
    }
}

/**
 * Setup backup control event handlers
 */
function setupBackupControls(container) {
    // Data backup button
    const dataBtn = container.querySelector('#run-data-backup');
    dataBtn.addEventListener('click', async () => {
        await runBackup(container, 'data');
    });

    // System backup button
    const systemBtn = container.querySelector('#run-system-backup');
    systemBtn.addEventListener('click', async () => {
        await runBackup(container, 'system');
    });

    // Full backup button
    const fullBtn = container.querySelector('#run-full-backup');
    fullBtn.addEventListener('click', async () => {
        await runBackup(container, 'full');
    });

    // Filter buttons
    const filterButtons = container.querySelectorAll('.backup-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.getAttribute('data-type');

            // Update active state
            filterButtons.forEach(b => {
                if (b === btn) {
                    b.classList.add('active');
                    b.style.background = 'var(--accent-color)';
                    b.style.color = 'white';
                } else {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-primary)';
                }
            });

            // Load filtered backups
            await loadBackups(container, type);
        });
    });

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-backups');
    refreshBtn.addEventListener('click', async () => {
        const activeFilter = container.querySelector('.backup-filter.active');
        const type = activeFilter ? activeFilter.getAttribute('data-type') : 'all';
        await loadBackups(container, type);
    });
}

/**
 * Run a backup
 */
async function runBackup(container, type) {
    const btnId = `run-${type}-backup`;
    const btn = container.querySelector(`#${btnId}`);
    const originalText = btn.textContent;

    try {
        // Disable button and show loading
        btn.disabled = true;
        btn.textContent = 'Running backup...';
        btn.style.opacity = '0.6';

        // Run backup
        const response = await apiClient.post(`/api/admin/backup/${type}`);

        if (response.success) {
            showSuccess(response.message || 'Backup completed successfully');

            // Reload backup list
            const activeFilter = container.querySelector('.backup-filter.active');
            const filterType = activeFilter ? activeFilter.getAttribute('data-type') : 'all';
            await loadBackups(container, filterType);
        } else {
            showError(response.message || 'Backup failed');
        }
    } catch (error) {
        console.error(`Error running ${type} backup:`, error);
        showError(`Failed to run ${type} backup: ${error.message}`);
    } finally {
        // Re-enable button
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
    }
}

/**
 * Load schedule status
 */
async function loadScheduleStatus(container) {
    const scheduleContainer = container.querySelector('#schedule-status');

    try {
        const response = await apiClient.get('/api/admin/backup/schedule');

        const statusHtml = response.timer_installed ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div style="text-align: center; padding: 20px; background: var(--bg-primary); border-radius: 8px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Status</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success-color);">✓ Enabled</div>
                </div>
                <div style="text-align: center; padding: 20px; background: var(--bg-primary); border-radius: 8px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Schedule</div>
                    <div style="font-size: 16px; font-weight: 600;">${response.schedule || 'Daily at 2:00 AM'}</div>
                </div>
                <div style="text-align: center; padding: 20px; background: var(--bg-primary); border-radius: 8px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Next Run</div>
                    <div style="font-size: 14px; font-weight: 600;">${response.next_run || 'Unknown'}</div>
                </div>
            </div>
        ` : `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 10px; color: var(--warning-color);">
                    Automated Backups Not Configured
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Run the following command to set up automated daily backups:
                </p>
                <code style="display: block; padding: 15px; background: var(--bg-primary); border-radius: 6px; font-family: monospace; margin-bottom: 10px;">
                    sudo ./bin/setup-backup-timer
                </code>
                <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                    See <a href="#" style="color: var(--accent-color);">docs/BACKUP_GUIDE.md</a> for details
                </p>
            </div>
        `;

        scheduleContainer.innerHTML = `
            <h3 style="font-size: 18px; margin-bottom: 15px;">🕐 Automated Backup Schedule</h3>
            ${statusHtml}
        `;
    } catch (error) {
        console.error('Error loading schedule status:', error);
        scheduleContainer.innerHTML = `
            <h3 style="font-size: 18px; margin-bottom: 15px;">🕐 Automated Backup Schedule</h3>
            <div style="text-align: center; padding: 20px; color: var(--error-color);">
                Failed to load schedule status
            </div>
        `;
    }
}

/**
 * Load backups list
 */
async function loadBackups(container, type = 'all') {
    const listContainer = container.querySelector('#backup-list');

    try {
        const response = await apiClient.get(`/api/admin/backups?type=${type}`);

        // Update total count if viewing all
        if (type === 'all') {
            const countEl = container.querySelector('#total-backup-count');
            if (countEl) countEl.textContent = response.backups.length;
        }

        if (!response.backups || response.backups.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                    <div>No ${type === 'all' ? '' : type + ' '}backups found</div>
                </div>
            `;
            return;
        }

        // Render backup table
        const tableHtml = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color);">
                        <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Type</th>
                        <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Filename</th>
                        <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Size</th>
                        <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Created</th>
                        <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-secondary);">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${response.backups.map(backup => {
                        const typeColors = {
                            full: '#27ae60',
                            data: 'rgba(59, 130, 246, 0.8)', // Matching --accent-color (#3b82f6)
                            system: 'rgba(118, 75, 162, 0.8)'
                        };
                        const typeColor = typeColors[backup.type] || '#999';

                        return `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 12px;">
                                    <span style="display: inline-block; padding: 4px 12px; background: ${typeColor}; color: white; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                                        ${backup.type}
                                    </span>
                                </td>
                                <td style="padding: 12px; font-family: monospace; font-size: 13px;">${backup.filename}</td>
                                <td style="padding: 12px; text-align: right; font-size: 13px;">${backup.size_human}</td>
                                <td style="padding: 12px; text-align: right; font-size: 13px; color: var(--text-secondary);">${formatDate(backup.created_at)}</td>
                                <td style="padding: 12px; text-align: right;">
                                    <button class="view-metadata-btn" data-type="${backup.type}" data-filename="${backup.filename}"
                                            style="padding: 6px 12px; margin-right: 8px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 12px;">
                                        📋 Info
                                    </button>
                                    <button class="restore-btn" data-type="${backup.type}" data-filename="${backup.filename}"
                                            style="padding: 6px 12px; margin-right: 8px; background: #d35400; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                        ↻ Restore
                                    </button>
                                    <button class="delete-btn" data-type="${backup.type}" data-filename="${backup.filename}"
                                            style="padding: 6px 12px; background: #c0392b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                        🗑️ Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        listContainer.innerHTML = tableHtml;

        // Add event listeners for action buttons
        setupBackupActions(container);

    } catch (error) {
        console.error('Error loading backups:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--error-color);">
                <div style="font-size: 32px; margin-bottom: 10px;">❌</div>
                Failed to load backups: ${error.message}
            </div>
        `;
    }
}

/**
 * Setup action button event listeners
 */
function setupBackupActions(container) {
    // View metadata buttons
    const metadataButtons = container.querySelectorAll('.view-metadata-btn');
    metadataButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.getAttribute('data-type');
            const filename = btn.getAttribute('data-filename');
            await showBackupMetadata(type, filename);
        });
    });

    // Restore buttons
    const restoreButtons = container.querySelectorAll('.restore-btn');
    restoreButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.getAttribute('data-type');
            const filename = btn.getAttribute('data-filename');
            await showRestoreConfirmation(container, type, filename);
        });
    });

    // Delete buttons
    const deleteButtons = container.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.getAttribute('data-type');
            const filename = btn.getAttribute('data-filename');
            await showDeleteConfirmation(container, type, filename);
        });
    });
}

/**
 * Show backup metadata modal
 */
async function showBackupMetadata(backupType, filename) {
    try {
        const response = await apiClient.get(`/api/admin/backup/${backupType}/${encodeURIComponent(filename)}/metadata`);

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        modal.innerHTML = `
            <div style="background: var(--bg-primary); border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="padding: 25px; border-bottom: 2px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; font-size: 20px;">📋 Backup Information</h2>
                        <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
                    </div>
                </div>

                <div style="padding: 25px;">
                    <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Backup Details</h3>
                        <div style="display: grid; gap: 12px; font-size: 14px;">
                            ${Object.entries(response.metadata).map(([key, value]) => `
                                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px;">
                                    <div style="color: var(--text-secondary); font-weight: 600;">${key}:</div>
                                    <div>${value}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Contents (${response.file_count} files)</h3>
                        <div style="max-height: 200px; overflow-y: auto; font-size: 13px; font-family: monospace; color: var(--text-secondary);">
                            ${response.files.slice(0, 50).map(file => `<div style="padding: 4px 0;">${file}</div>`).join('')}
                            ${response.files.length > 50 ? `<div style="padding: 4px 0; color: var(--text-secondary); font-style: italic;">... and ${response.files.length - 50} more files</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal on click
        modal.querySelector('#close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

    } catch (error) {
        console.error('Error loading metadata:', error);
        showError(`Failed to load backup metadata: ${error.message}`);
    }
}

/**
 * Show restore confirmation dialog
 */
async function showRestoreConfirmation(container, backupType, filename) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 600px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
            <div style="padding: 25px; border-bottom: 2px solid var(--border-color);">
                <h2 style="margin: 0; font-size: 20px; color: var(--warning-color);">⚠️ Confirm Restore</h2>
            </div>

            <div style="padding: 25px;">
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; border-left: 4px solid var(--warning-color); margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; font-weight: 600; color: var(--warning-color);">
                        This will restore data from the selected backup and may overwrite current data.
                    </p>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        <div style="margin-bottom: 8px;"><strong>Backup:</strong> ${filename}</div>
                        <div><strong>Type:</strong> ${backupType}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px;">Restore Type:</label>
                    <select id="restore-type" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                        <option value="full">Full Restore (Database + Configuration)</option>
                        <option value="database">Database Only</option>
                        <option value="config">Configuration Only</option>
                    </select>
                </div>

                <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
                    <strong>⚠️ Important:</strong> A pre-restore backup of current data will be created automatically. The application may need to be restarted after restore.
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-restore" style="padding: 10px 20px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Cancel
                    </button>
                    <button id="confirm-restore" style="padding: 10px 20px; background: var(--warning-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Restore Backup
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle cancel
    modal.querySelector('#cancel-restore').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // Handle confirm
    modal.querySelector('#confirm-restore').addEventListener('click', async () => {
        const restoreType = modal.querySelector('#restore-type').value;
        document.body.removeChild(modal);
        await performRestore(container, backupType, filename, restoreType);
    });
}

/**
 * Perform the actual restore
 */
async function performRestore(container, backupType, filename, restoreType) {
    // Show loading overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10001;';
    overlay.innerHTML = `
        <div style="background: var(--bg-primary); padding: 40px; border-radius: 12px; text-align: center; max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
            <h3 style="margin: 0 0 15px 0;">Restoring Backup...</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
                This may take a minute. Please wait...
            </p>
        </div>
    `;
    document.body.appendChild(overlay);

    try {
        const response = await apiClient.post('/api/admin/backup/restore', {
            backup_type: backupType,
            filename: filename,
            restore_type: restoreType
        });

        document.body.removeChild(overlay);

        if (response.success) {
            // Show success with warning about restart
            const successModal = document.createElement('div');
            successModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
            successModal.innerHTML = `
                <div style="background: var(--bg-primary); padding: 40px; border-radius: 12px; text-align: center; max-width: 500px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">✓</div>
                    <h2 style="margin: 0 0 15px 0; color: var(--success-color);">Restore Complete!</h2>
                    <p style="margin: 0 0 20px 0; color: var(--text-secondary);">
                        The backup has been restored successfully.
                    </p>
                    <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; text-align: left;">
                        <strong>⚠️ Action Required:</strong><br>
                        Please restart the application for changes to take effect:<br>
                        <code style="display: block; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 4px;">
                            sudo systemctl restart rps
                        </code>
                    </div>
                    <button id="close-success" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        OK
                    </button>
                </div>
            `;
            document.body.appendChild(successModal);

            successModal.querySelector('#close-success').addEventListener('click', () => {
                document.body.removeChild(successModal);
                // Reload backup list
                const activeFilter = container.querySelector('.backup-filter.active');
                const filterType = activeFilter ? activeFilter.getAttribute('data-type') : 'all';
                loadBackups(container, filterType);
            });
        } else {
            showError(response.message || 'Restore failed');
        }

    } catch (error) {
        document.body.removeChild(overlay);
        console.error('Error restoring backup:', error);
        showError(`Failed to restore backup: ${error.message}`);
    }
}

/**
 * Show delete confirmation dialog
 */
async function showDeleteConfirmation(container, backupType, filename) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    modal.innerHTML = `
        <div style="background: var(--bg-primary); border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
            <div style="padding: 25px; border-bottom: 2px solid var(--border-color);">
                <h2 style="margin: 0; font-size: 20px; color: var(--danger-color);">🗑️ Delete Backup</h2>
            </div>

            <div style="padding: 25px;">
                <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; border-left: 4px solid var(--danger-color); margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; font-weight: 600; color: var(--danger-color);">
                        Are you sure you want to delete this backup?
                    </p>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        <div style="margin-bottom: 8px;"><strong>Backup:</strong> ${filename}</div>
                        <div><strong>Type:</strong> ${backupType}</div>
                    </div>
                </div>

                <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;">
                    <strong>⚠️ Warning:</strong> This action cannot be undone. The backup file will be permanently deleted.
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-delete" style="padding: 10px 20px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Cancel
                    </button>
                    <button id="confirm-delete" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Delete Backup
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle cancel
    modal.querySelector('#cancel-delete').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // Handle confirm
    modal.querySelector('#confirm-delete').addEventListener('click', async () => {
        document.body.removeChild(modal);
        await performDelete(container, backupType, filename);
    });
}

/**
 * Perform the actual deletion
 */
async function performDelete(container, backupType, filename) {
    try {
        await apiClient.delete(`/api/admin/backup/${backupType}/${encodeURIComponent(filename)}`);

        showSuccess(`Backup ${filename} deleted successfully`);

        // Reload backup list
        const activeFilter = container.querySelector('.backup-filter.active');
        const filterType = activeFilter ? activeFilter.getAttribute('data-type') : 'all';
        await loadBackups(container, filterType);

    } catch (error) {
        console.error('Error deleting backup:', error);
        showError(`Failed to delete backup: ${error.message}`);
    }
}

/**
 * Format date for display
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}
