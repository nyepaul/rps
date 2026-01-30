/**
 * Unified Import Preview Modal
 * Allows users to review, edit actions, and confirm imported data
 */

import { profilesAPI } from '../../api/profiles.js';
import { store } from '../../state/store.js';
import { showError, showSuccess, showSpinner, hideSpinner } from '../../utils/dom.js';
import { formatCurrency } from '../../utils/formatters.js';

/**
 * Show the import preview modal
 * @param {Object} options - Configuration options
 * @param {Array} options.items - Parsed data items
 * @param {Array} options.warnings - Parsing warnings
 * @param {Object} options.config - Parser configuration (INCOME_CONFIG, etc.)
 * @param {string} options.profileName - Current profile name
 * @param {Function} options.onComplete - Callback when import finishes
 * @param {Object} options.extraData - Optional extra data (e.g., period)
 */
export function showImportPreviewModal({ items, warnings, config, profileName, onComplete, extraData = {} }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 2100;
    `;

    // Track state of each item (action: 'add', 'merge', 'skip')
    // Default to 'add' for all initially
    const itemStates = items.map(item => ({
        item,
        action: 'add' 
    }));

    modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 900px; width: 95%; max-height: 90vh; border: 1px solid var(--border-color); display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Review Imported ${config.type.charAt(0).toUpperCase() + config.type.slice(1)}s</h2>
                <button id="close-preview-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            ${warnings.length > 0 ? `
                <div style="background: var(--warning-bg); border-left: 4px solid var(--warning-color); padding: 12px; margin-bottom: 20px; font-size: 13px;">
                    <strong>⚠️ Warnings:</strong>
                    <ul style="margin: 5px 0 0 20px; padding: 0;">
                        ${warnings.slice(0, 3).map(w => `<li>${w}</li>`).join('')}
                        ${warnings.length > 3 ? `<li>...and ${warnings.length - 3} more</li>` : ''}
                    </ul>
                </div>
            ` : ''}

            ${config.type === 'expense' ? `
                <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Import to Period:</label>
                    <select id="import-period-select" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 13px;">
                        <option value="current" ${extraData.period === 'current' ? 'selected' : ''}>Pre-Retirement</option>
                        <option value="future" ${extraData.period === 'future' ? 'selected' : ''}>Post-Retirement</option>
                        <option value="both">Both Periods</option>
                    </select>
                </div>
            ` : ''}

            <div style="flex: 1; overflow-y: auto; margin-bottom: 20px; border: 1px solid var(--border-color); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 10;">
                        <tr>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Name</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Amount/Value</th>
                            ${config.type === 'expense' ? '<th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Category</th>' : ''}
                            ${config.type === 'asset' ? '<th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Type</th>' : ''}
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 10px 12px;">${item.name}</td>
                                <td style="padding: 10px 12px;">${formatCurrency(item.amount || item.balance || 0)}</td>
                                ${config.type === 'expense' ? `<td style="padding: 10px 12px; text-transform: capitalize;">${item.category}</td>` : ''}
                                ${config.type === 'asset' ? `<td style="padding: 10px 12px; text-transform: capitalize;">${item.type.replace('_', ' ')}</td>` : ''}
                                <td style="padding: 10px 12px; text-align: center;">
                                    <div class="action-toggles" data-index="${idx}" style="display: inline-flex; background: var(--bg-primary); border-radius: 6px; padding: 2px; border: 1px solid var(--border-color);">
                                        <button class="toggle-btn ${itemStates[idx].action === 'add' ? 'active' : ''}" data-action="add" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${itemStates[idx].action === 'add' ? 'var(--accent-color)' : 'transparent'}; color: ${itemStates[idx].action === 'add' ? 'white' : 'var(--text-secondary)'};">Add</button>
                                        <button class="toggle-btn ${itemStates[idx].action === 'merge' ? 'active' : ''}" data-action="merge" title="Update existing item with same name" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${itemStates[idx].action === 'merge' ? 'var(--info-color)' : 'transparent'}; color: ${itemStates[idx].action === 'merge' ? 'white' : 'var(--text-secondary)'};">Merge</button>
                                        <button class="toggle-btn ${itemStates[idx].action === 'skip' ? 'active' : ''}" data-action="skip" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${itemStates[idx].action === 'skip' ? 'var(--danger-color)' : 'transparent'}; color: ${itemStates[idx].action === 'skip' ? 'white' : 'var(--text-secondary)'};">Skip</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 14px; color: var(--text-secondary);">
                    Summary: <span id="summary-text" style="font-weight: 600; color: var(--text-primary);">Adding ${items.length}, merging 0, skipping 0</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="cancel-preview-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 14px;">
                        Back
                    </button>
                    <button id="confirm-import-btn" style="padding: 10px 25px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
                        Confirm Import
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const summaryText = modal.querySelector('#summary-text');
    const updateSummary = () => {
        const counts = { add: 0, merge: 0, skip: 0 };
        itemStates.forEach(s => counts[s.action]++);
        summaryText.textContent = `Adding ${counts.add}, merging ${counts.merge}, skipping ${counts.skip}`;
    };

    // Toggle handlers
    modal.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = btn.closest('.action-toggles');
            const idx = parseInt(container.dataset.index);
            const action = btn.dataset.action;

            // Update state
            itemStates[idx].action = action;

            // Update UI
            container.querySelectorAll('.toggle-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-secondary)';
            });
            
            btn.classList.add('active');
            const colors = { add: 'var(--accent-color)', merge: 'var(--info-color)', skip: 'var(--danger-color)' };
            btn.style.background = colors[action];
            btn.style.color = 'white';

            updateSummary();
        });
    });

    modal.querySelector('#close-preview-btn').onclick = () => modal.remove();
    modal.querySelector('#cancel-preview-btn').onclick = () => modal.remove();

    modal.querySelector('#confirm-import-btn').addEventListener('click', async () => {
        showSpinner('Importing data...');
        try {
            // Get current profile data
            const profile = store.get('currentProfile');
            const profileData = profile.data || {};
            
            // Depending on config type, find the target array in profileData
            let targetArray = [];
            let dataKey = '';
            let secondaryKey = ''; // For budget categories

            if (config.type === 'income') {
                dataKey = 'income_streams';
                targetArray = profileData.financial?.income_streams || [];
            } else if (config.type === 'expense') {
                const periodSelect = modal.querySelector('#import-period-select');
                const targetPeriod = periodSelect ? periodSelect.value : (extraData.period || 'current');
                
                dataKey = 'budget';
                
                if (targetPeriod === 'both') {
                    // Handled specially below
                } else {
                    secondaryKey = targetPeriod;
                    targetArray = profileData.budget?.[targetPeriod] || [];
                }
            }

            const itemsToProcess = itemStates.filter(s => s.action !== 'skip');
            
            if (config.type === 'asset') {
                // ... (existing asset handling)
            } else if (config.type === 'expense' && modal.querySelector('#import-period-select')?.value === 'both') {
                // Special handling for 'both' periods
                ['current', 'future'].forEach(p => {
                    if (!profileData.budget[p]) profileData.budget[p] = {};
                    itemsToProcess.forEach(({ item, action }) => {
                        const cat = item.category || 'other';
                        if (!profileData.budget[p][cat]) profileData.budget[p][cat] = [];
                        
                        const arr = profileData.budget[p][cat];
                        if (action === 'merge') {
                            const existingIdx = arr.findIndex(ti => ti.name.toLowerCase() === item.name.toLowerCase());
                            if (existingIdx !== -1) {
                                arr[existingIdx] = { ...arr[existingIdx], ...item };
                                return;
                            }
                        }
                        arr.push({ ...item, id: Date.now() + Math.random() });
                    });
                });
            } else {
                // Standard handling for Income/Expenses
                itemsToProcess.forEach(({ item, action }) => {
                    if (action === 'merge') {
                        let searchArray = targetArray;
                        if (config.type === 'expense') {
                            const cat = item.category || 'other';
                            if (!profileData.budget[secondaryKey][cat]) profileData.budget[secondaryKey][cat] = [];
                            searchArray = profileData.budget[secondaryKey][cat];
                        }

                        const existingIdx = searchArray.findIndex(ti => ti.name.toLowerCase() === item.name.toLowerCase());
                        if (existingIdx !== -1) {
                            searchArray[existingIdx] = { ...searchArray[existingIdx], ...item };
                            return;
                        }
                    }
                    
                    // Add
                    if (config.type === 'expense') {
                        const cat = item.category || 'other';
                        if (!profileData.budget[secondaryKey][cat]) profileData.budget[secondaryKey][cat] = [];
                        profileData.budget[secondaryKey][cat].push({ ...item, id: Date.now() + Math.random() });
                    } else {
                        targetArray.push({ ...item, id: Date.now() + Math.random() });
                    }
                });

                // Set back to profile data
                if (config.type === 'income') {
                    if (!profileData.financial) profileData.financial = {};
                    profileData.financial.income_streams = targetArray;
                }
            }

            // Save updated profile
            const result = await profilesAPI.update(profile.name, { data: profileData });
            store.setState({ currentProfile: result.profile });

            hideSpinner();
            showSuccess(`Successfully imported ${itemsToProcess.length} items.`);
            modal.remove();
            
            if (onComplete) onComplete(result.profile);

        } catch (error) {
            hideSpinner();
            console.error('Import confirmation error:', error);
            showError(`Failed to save imported data: ${error.message}`);
        }
    });
}
