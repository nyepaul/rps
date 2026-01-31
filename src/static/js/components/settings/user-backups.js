/**
 * User Backups - Interface for users to manage their own data backups
 */

import { apiClient } from '../../api/client.js';
import { showError, showSuccess } from '../../utils/dom.js';

/**
 * Render user backups interface
 */
export function renderUserBackups(container) {
    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <div>
                    <h3 style="margin: 0; font-size: 18px;">💾 My Data Backups</h3>
                    <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 13px;">
                        Snapshot your profiles, scenarios, and preferences for safekeeping
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="import-user-backup-btn" style="padding: 10px 20px; background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); border-radius: 6px; cursor: pointer; font-weight: 600;">
                        📥 Import File
                    </button>
                    <button id="create-user-backup-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        + New Backup
                    </button>
                </div>
            </div>

            <!-- Hidden file input for import -->
            <input type="file" id="backup-import-input" accept=".json" style="display: none;">

            <div id="user-backups-list" style="min-height: 200px;">
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
                    Loading your backups...
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            </div>

            <div style="margin-top: 30px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--info-color);">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--info-color);">ℹ️ About User Backups</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                    <li>Backups include all your profiles, scenarios, and personalized settings.</li>
                    <li>Restoring a backup will <strong>completely replace</strong> your current data.</li>
                    <li>The system creates an automatic backup before every restore for safety.</li>
                    <li>Your sensitive data remains encrypted even within the backup files.</li>
                </ul>
            </div>
        </div>
    `;

    const createBtn = container.querySelector('#create-user-backup-btn');
    createBtn.addEventListener('click', () => showCreateBackupModal(container));

    const importBtn = container.querySelector('#import-user-backup-btn');
    const fileInput = container.querySelector('#backup-import-input');
    
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleImport(e, container));

    loadUserBackups(container);
}

/**
 * Handle backup file import
 */
async function handleImport(event, container) {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm(`⚠️ WARNING: Importing this file will replace all your current profiles and data. A safety backup of your current state will be created first. Proceed?`)) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Show loading state
            const importBtn = container.querySelector('#import-user-backup-btn');
            const originalText = importBtn.textContent;
            importBtn.disabled = true;
            importBtn.textContent = 'Importing...';

            const response = await fetch('/api/backups/import', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Import failed');
            }

            showSuccess('Backup imported and restored successfully! Refreshing...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            showError(`Import failed: ${error.message}`);
            // Reset button
            const importBtn = container.querySelector('#import-user-backup-btn');
            importBtn.disabled = false;
            importBtn.textContent = '📥 Import File';
        }
    }
    
    // Clear input
    event.target.value = '';
}

/**
 * Load backups for the current user
 */
async function loadUserBackups(container) {
    const listContainer = container.querySelector('#user-backups-list');
    
    try {
        const response = await apiClient.get('/api/backups');
        const backups = response.backups;

        if (backups.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px; background: var(--bg-primary); border-radius: 12px; border: 2px dashed var(--border-color);">
                    <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
                    <div style="color: var(--text-secondary); font-weight: 500;">No backups found</div>
                    <p style="font-size: 13px; color: var(--text-light); margin-top: 5px;">Create your first backup to secure your planning data</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${backups.map(backup => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: var(--bg-primary); border-radius: 10px; border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">${backup.label || 'Untitled Backup'}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-family: monospace;">
                                ${backup.filename} • ${(backup.size_bytes / 1024).toFixed(1)} KB
                            </div>
                            <div style="font-size: 11px; color: var(--text-light); margin-top: 2px;">
                                ${new Date(backup.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="download-backup-btn" data-id="${backup.id}" style="padding: 6px 12px; background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                ⬇️ Download
                            </button>
                            <button class="restore-backup-btn" data-id="${backup.id}" style="padding: 6px 12px; background: var(--warning-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                ↻ Restore
                            </button>
                            <button class="delete-backup-btn" data-id="${backup.id}" style="padding: 6px 12px; background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); border-radius: 4px; cursor: pointer; font-size: 12px;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Setup handlers
        listContainer.querySelectorAll('.download-backup-btn').forEach(btn => {
            btn.addEventListener('click', () => downloadBackup(btn.dataset.id));
        });

        listContainer.querySelectorAll('.restore-backup-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmRestore(btn.dataset.id, container));
        });

        listContainer.querySelectorAll('.delete-backup-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDelete(btn.dataset.id, container));
        });

    } catch (error) {
        listContainer.innerHTML = `<div style="color: var(--danger-color); padding: 20px;">Failed to load backups: ${error.message}</div>`;
    }
}

/**
 * Show modal to create a new backup
 */
function showCreateBackupModal(parentContainer) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000;`;
    
    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h3 style="margin: 0 0 20px 0;">Create New Backup</h3>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500;">Backup Label (optional)</label>
                <input type="text" id="backup-label-input" placeholder="e.g. Before major changes" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancel-create-btn" style="padding: 10px 20px; background: transparent; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Cancel</button>
                <button id="confirm-create-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Create Backup</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#cancel-create-btn').onclick = close;
    
    modal.querySelector('#confirm-create-btn').onclick = async () => {
        const label = modal.querySelector('#backup-label-input').value;
        close();
        try {
            await apiClient.post('/api/backups', { label });
            showSuccess('Backup created successfully');
            loadUserBackups(parentContainer);
        } catch (error) {
            showError(`Failed to create backup: ${error.message}`);
        }
    };
}

/**
 * Download a backup file
 */
function downloadBackup(backupId) {
    window.location.href = `/api/backups/${backupId}/download`;
}

/**
 * Confirm and perform restore
 */
async function confirmRestore(backupId, parentContainer) {
    if (confirm("⚠️ WARNING: Restoring will overwrite all your current data. A safety backup of your current state will be created first. Proceed?")) {
        try {
            const response = await apiClient.post(`/api/backups/${backupId}/restore`);
            showSuccess('Data restored successfully! Refreshing page...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            showError(`Restore failed: ${error.message}`);
        }
    }
}

/**
 * Confirm and perform delete
 */
async function confirmDelete(backupId, parentContainer) {
    if (confirm("Are you sure you want to delete this backup? This cannot be undone.")) {
        try {
            await apiClient.delete(`/api/backups/${backupId}`);
            showSuccess('Backup deleted');
            loadUserBackups(parentContainer);
        } catch (error) {
            showError(`Delete failed: ${error.message}`);
        }
    }
}
