/**
 * Unified Import Preview Modal
 * Allows users to review, edit actions, and confirm imported data
 */

import { profilesAPI } from '../../api/profiles.js';
import { apiClient } from '../../api/client.js';
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
    let itemStates = items.map(item => ({
        item,
        action: 'add',
        ai_suggestion: null
    }));

    const renderModalContent = () => {
        const counts = { add: 0, merge: 0, skip: 0 };
        itemStates.forEach(s => counts[s.action]++);

        modal.innerHTML = `
        <div class="modal-content" style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 1000px; width: 95%; max-height: 90vh; border: 1px solid var(--border-color); display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Review Imported ${config.type.charAt(0).toUpperCase() + config.type.slice(1)}s</h2>
                <button id="close-preview-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 300px; gap: 20px; margin-bottom: 20px;">
                <div>
                    ${warnings.length > 0 ? `
                        <div style="background: var(--warning-bg); border-left: 4px solid var(--warning-color); padding: 12px; margin-bottom: 15px; font-size: 13px;">
                            <strong>⚠️ Parsing Warnings:</strong>
                            <ul style="margin: 5px 0 0 20px; padding: 0;">
                                ${warnings.slice(0, 3).map(w => `<li>${w}</li>`).join('')}
                                ${warnings.length > 3 ? `<li>...and ${warnings.length - 3} more</li>` : ''}
                            </ul>
                        </div>
                    ` : ''}

                    <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">✨ Smart AI Optimization</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">Use AI to detect hidden duplicates and improve categorization.</div>
                        </div>
                        <button id="run-ai-btn" style="padding: 8px 16px; background: #764ba2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <span>🚀</span> Run AI Analysis
                        </button>
                    </div>
                </div>

                <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Import Options:</label>
                    
                    ${config.type === 'expense' ? `
                        <div style="margin-bottom: 10px;">
                            <span style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Target Period</span>
                            <select id="import-period-select" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
                                <option value="current" ${extraData.period === 'current' ? 'selected' : ''}>Pre-Retirement</option>
                                <option value="future" ${extraData.period === 'future' ? 'selected' : ''}>Post-Retirement</option>
                                <option value="both">Both Periods</option>
                            </select>
                        </div>
                    ` : ''}

                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                        <button id="apply-all-merge" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; cursor: pointer; margin-bottom: 5px;">Set All to Merge</button>
                        <button id="apply-all-add" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; cursor: pointer;">Set All to Add</button>
                    </div>
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto; margin-bottom: 20px; border: 1px solid var(--border-color); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 10;">
                        <tr>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Name / AI Insight</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Amount</th>
                            ${config.type === 'expense' ? '<th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Category</th>' : ''}
                            ${config.type === 'asset' ? '<th style="padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color);">Type</th>' : ''}
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid var(--border-color);">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemStates.map((state, idx) => {
                            const item = state.item;
                            const ai = state.ai_suggestion;
                            const isDuplicate = ai?.is_duplicate || item.match_status === 'match_found';
                            const confidence = ai?.confidence || item.match_confidence || 0;

                            return `
                            <tr style="border-bottom: 1px solid var(--border-color); ${isDuplicate && state.action === 'add' ? 'background: var(--warning-bg)22;' : ''}">
                                <td style="padding: 10px 12px;">
                                    <div style="font-weight: 600;">${item.name}</div>
                                    ${isDuplicate ? `
                                        <div style="font-size: 11px; color: var(--warning-color); margin-top: 2px;">
                                            ⚠️ Probable Duplicate of: <strong>${ai?.duplicate_of || item.matched_existing_item?.name}</strong> (${(confidence * 100).toFixed(0)}% match)
                                        </div>
                                    ` : ''}
                                    ${ai?.suggested_category && ai.suggested_category.toLowerCase() !== item.category?.toLowerCase() ? `
                                        <div style="font-size: 11px; color: var(--accent-color); margin-top: 2px;">
                                            ✨ AI Suggests: <strong>${ai.suggested_category}</strong> (${ai.reasoning})
                                        </div>
                                    ` : ''}
                                </td>
                                <td style="padding: 10px 12px;">${formatCurrency(item.amount || item.balance || 0)}</td>
                                ${config.type === 'expense' ? `<td style="padding: 10px 12px; text-transform: capitalize;">${item.category}</td>` : ''}
                                ${config.type === 'asset' ? `<td style="padding: 10px 12px; text-transform: capitalize;">${item.type.replace('_', ' ')}</td>` : ''}
                                <td style="padding: 10px 12px; text-align: center;">
                                    <div class="action-toggles" data-index="${idx}" style="display: inline-flex; background: var(--bg-primary); border-radius: 6px; padding: 2px; border: 1px solid var(--border-color);">
                                        <button class="toggle-btn ${state.action === 'add' ? 'active' : ''}" data-action="add" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${state.action === 'add' ? 'var(--accent-color)' : 'transparent'}; color: ${state.action === 'add' ? 'white' : 'var(--text-secondary)'};">Add</button>
                                        <button class="toggle-btn ${state.action === 'merge' ? 'active' : ''}" data-action="merge" title="Update existing item with same name" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${state.action === 'merge' ? 'var(--info-color)' : 'transparent'}; color: ${state.action === 'merge' ? 'white' : 'var(--text-secondary)'};">Merge</button>
                                        <button class="toggle-btn ${state.action === 'skip' ? 'active' : ''}" data-action="skip" style="padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; background: ${state.action === 'skip' ? 'var(--danger-color)' : 'transparent'}; color: ${state.action === 'skip' ? 'white' : 'var(--text-secondary)'};">Skip</button>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 14px; color: var(--text-secondary);">
                    Summary: <span id="summary-text" style="font-weight: 600; color: var(--text-primary);">Adding ${counts.add}, merging ${counts.merge}, skipping ${counts.skip}</span>
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

        attachEventListeners();
    };

    const attachEventListeners = () => {
        // Close buttons
        modal.querySelector('#close-preview-btn').onclick = () => modal.remove();
        modal.querySelector('#cancel-preview-btn').onclick = () => modal.remove();

        // Toggle handlers
        modal.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = btn.closest('.action-toggles');
                const idx = parseInt(container.dataset.index);
                const action = btn.dataset.action;
                itemStates[idx].action = action;
                renderModalContent();
            });
        });

        // Apply All buttons
        modal.querySelector('#apply-all-merge').onclick = () => {
            itemStates.forEach(s => s.action = 'merge');
            renderModalContent();
        };
        modal.querySelector('#apply-all-add').onclick = () => {
            itemStates.forEach(s => s.action = 'add');
            renderModalContent();
        };

        // AI Optimization Button
        modal.querySelector('#run-ai-btn').onclick = async () => {
            await runAIEnhancement();
        };

        // Confirm button
        modal.querySelector('#confirm-import-btn').onclick = handleConfirmImport;
    };

    const runAIEnhancement = async () => {
        showSpinner('Analyzing with AI...');
        try {
            const response = await apiClient.post('/api/enhance-csv-import', {
                type: config.type,
                items: itemStates.map(s => s.item),
                profile_name: profileName,
                extra_data: {
                    period: modal.querySelector('#import-period-select')?.value || extraData.period
                }
            });

            if (response.items) {
                // Update items with AI results
                itemStates = response.items.map(enrichedItem => {
                    const action = (enrichedItem.match_status === 'match_found' || enrichedItem.ai_suggestions?.is_duplicate) ? 'merge' : 'add';
                    
                    return {
                        item: enrichedItem,
                        action: action,
                        ai_suggestion: enrichedItem.ai_suggestions || null
                    };
                });

                showSuccess(`AI analysis complete: ${response.enhanced_count || 0} items optimized.`);
                renderModalContent();
            }
        } catch (error) {
            console.error('AI Enhancement Error:', error);
            showError(`AI Analysis failed: ${error.message}`);
        } finally {
            hideSpinner();
        }
    };

    const handleConfirmImport = async () => {
        showSpinner('Importing data...');
        try {
            // Get current profile data
            const profile = store.get('currentProfile');
            const profileData = profile.data || {};
            
            let dataKey = '';
            let secondaryKey = ''; 

            const periodSelect = modal.querySelector('#import-period-select');
            const targetPeriod = periodSelect ? periodSelect.value : (extraData.period || 'current');

            if (config.type === 'income') {
                dataKey = 'income_streams';
                if (!profileData.financial) profileData.financial = {};
                if (!profileData.financial.income_streams) profileData.financial.income_streams = [];
            } else if (config.type === 'expense') {
                dataKey = 'budget';
                if (!profileData.budget) profileData.budget = {};
                if (targetPeriod !== 'both') {
                    secondaryKey = targetPeriod;
                    if (!profileData.budget[targetPeriod]) profileData.budget[targetPeriod] = {};
                }
            } else if (config.type === 'asset') {
                if (!profileData.assets) profileData.assets = {};
            }

            const itemsToProcess = itemStates.filter(s => s.action !== 'skip');
            
            if (config.type === 'asset') {
                itemsToProcess.forEach(({ item, action, ai_suggestion }) => {
                    const category = ai_suggestion?.suggested_category || item.type;
                    if (!profileData.assets[category]) profileData.assets[category] = [];
                    
                    const arr = profileData.assets[category];
                    if (action === 'merge') {
                        const matchName = ai_suggestion?.duplicate_of || item.matched_existing_item?.name || item.name;
                        const existingIdx = arr.findIndex(ai => ai.name.toLowerCase() === matchName.toLowerCase());
                        if (existingIdx !== -1) {
                            arr[existingIdx] = { ...arr[existingIdx], ...item, type: category };
                            return;
                        }
                    }
                    arr.push({ ...item, id: Date.now() + Math.random(), type: category });
                });
            } else if (config.type === 'expense' && targetPeriod === 'both') {
                ['current', 'future'].forEach(p => {
                    if (!profileData.budget[p]) profileData.budget[p] = {};
                    itemsToProcess.forEach(({ item, action, ai_suggestion }) => {
                        const cat = ai_suggestion?.suggested_category || item.category || 'other';
                        if (!profileData.budget[p][cat]) profileData.budget[p][cat] = [];
                        
                        const arr = profileData.budget[p][cat];
                        if (action === 'merge') {
                            const matchName = ai_suggestion?.duplicate_of || item.matched_existing_item?.name || item.name;
                            const existingIdx = arr.findIndex(ti => ti.name.toLowerCase() === matchName.toLowerCase());
                            if (existingIdx !== -1) {
                                arr[existingIdx] = { ...arr[existingIdx], ...item, category: cat };
                                return;
                            }
                        }
                        arr.push({ ...item, id: Date.now() + Math.random(), category: cat });
                    });
                });
            } else {
                itemsToProcess.forEach(({ item, action, ai_suggestion }) => {
                    const matchName = ai_suggestion?.duplicate_of || item.matched_existing_item?.name || item.name;

                    if (action === 'merge') {
                        let searchArray = [];
                        if (config.type === 'expense') {
                            const cat = ai_suggestion?.suggested_category || item.category || 'other';
                            if (!profileData.budget[secondaryKey][cat]) profileData.budget[secondaryKey][cat] = [];
                            searchArray = profileData.budget[secondaryKey][cat];
                        } else {
                            searchArray = profileData.financial.income_streams;
                        }

                        const existingIdx = searchArray.findIndex(ti => ti.name.toLowerCase() === matchName.toLowerCase());
                        if (existingIdx !== -1) {
                            searchArray[existingIdx] = { ...searchArray[existingIdx], ...item };
                            if (config.type === 'expense') searchArray[existingIdx].category = ai_suggestion?.suggested_category || item.category;
                            return;
                        }
                    }
                    
                    if (config.type === 'expense') {
                        const cat = ai_suggestion?.suggested_category || item.category || 'other';
                        if (!profileData.budget[secondaryKey][cat]) profileData.budget[secondaryKey][cat] = [];
                        profileData.budget[secondaryKey][cat].push({ ...item, id: Date.now() + Math.random(), category: cat });
                    } else {
                        profileData.financial.income_streams.push({ ...item, id: Date.now() + Math.random() });
                    }
                });
            }

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
    };

    // Initial render
    renderModalContent();
}