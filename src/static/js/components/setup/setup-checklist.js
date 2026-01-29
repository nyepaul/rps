/**
 * Setup Checklist Component
 * Shows profile completion status and guides users
 */

import { checkSetupCompletion, getSetupMessage } from '../../utils/setup-checker.js';
import { store } from '../../state/store.js';

/**
 * Render setup checklist modal
 */
export function renderSetupChecklist() {
    const profile = store.get('currentProfile');

    if (!profile) {
        return null;
    }

    const status = checkSetupCompletion(profile);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'setup-checklist-modal';
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
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); border-radius: 12px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
            <!-- Header -->
            <div style="padding: 24px; border-bottom: 2px solid var(--border-color); background: linear-gradient(135deg, var(--success-color), #51cf66); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div>
                        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                            ${status.isComplete ? '🎉 Setup Complete!' : '📋 Complete Your Setup'}
                        </h2>
                        <p style="margin: 0; font-size: 14px; opacity: 0.95;">
                            ${getSetupMessage(status.percentage)}
                        </p>
                    </div>
                    <button id="close-setup-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        ×
                    </button>
                </div>

                <!-- Progress Bar -->
                <div style="background: rgba(255,255,255,0.3); border-radius: 12px; height: 24px; overflow: hidden; position: relative;">
                    <div style="background: white; height: 100%; width: ${status.percentage}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--success-color); position: absolute; left: 50%; transform: translateX(-50%);">
                            ${status.completedCount} / ${status.totalCount} Complete (${status.percentage}%)
                        </span>
                    </div>
                </div>
            </div>

            <!-- Checklist -->
            <div style="padding: 24px;">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${status.checklist.map((item, index) => `
                        <div class="setup-checklist-item" data-tab="${item.tab}" style="
                            padding: 16px;
                            background: ${item.completed ? 'var(--success-bg)' : 'var(--bg-tertiary)'};
                            border: 2px solid ${item.completed ? 'var(--success-color)' : 'var(--border-color)'};
                            border-radius: 8px;
                            cursor: ${item.completed ? 'default' : 'pointer'};
                            transition: all 0.2s;
                            ${!item.completed ? 'opacity: 0.9;' : ''}
                        " ${!item.completed ? `onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateX(4px)'"` : ''} ${!item.completed ? `onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateX(0)'"` : ''}>
                            <div style="display: flex; align-items: start; gap: 12px;">
                                <div style="font-size: 24px; flex-shrink: 0;">
                                    ${item.completed ? '✅' : '⬜'}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: ${item.completed ? 'var(--success-text)' : 'var(--text-primary)'}; ${item.completed ? 'text-decoration: line-through; opacity: 0.8;' : ''}">
                                        ${item.label}
                                    </div>
                                    <div style="font-size: 13px; color: var(--text-secondary);">
                                        ${item.description}
                                    </div>
                                    ${!item.completed ? `
                                        <div style="margin-top: 8px;">
                                            <button class="go-to-tab-btn" data-tab="${item.tab}" style="
                                                padding: 6px 12px;
                                                background: var(--accent-color);
                                                color: white;
                                                border: none;
                                                border-radius: 4px;
                                                cursor: pointer;
                                                font-size: 12px;
                                                font-weight: 600;
                                                transition: all 0.2s;
                                            " onmouseover="this.style.background='var(--accent-hover)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='var(--accent-color)'; this.style.transform='translateY(0)'">
                                                → Go to ${item.tab.charAt(0).toUpperCase() + item.tab.slice(1)}
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${status.isComplete ? `
                    <div style="margin-top: 24px; padding: 16px; background: var(--success-bg); border: 2px solid var(--success-color); border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
                        <div style="font-weight: 600; font-size: 16px; color: var(--success-text); margin-bottom: 4px;">
                            Congratulations!
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary);">
                            Your profile is fully set up and ready for analysis. Run the Monte Carlo simulation to see your retirement outlook!
                        </div>
                    </div>
                ` : `
                    ${status.nextItem ? `
                        <div style="margin-top: 20px; padding: 16px; background: var(--info-bg); border: 2px solid var(--info-color); border-radius: 8px;">
                            <div style="font-weight: 600; font-size: 14px; color: var(--info-color); margin-bottom: 8px;">
                                📍 Next Step
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                                ${status.nextItem.label}
                            </div>
                            <button class="go-to-tab-btn" data-tab="${status.nextItem.tab}" style="
                                padding: 8px 16px;
                                background: var(--info-color);
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 13px;
                                font-weight: 600;
                                width: 100%;
                                transition: all 0.2s;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 152, 173, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                Continue Setup →
                            </button>
                        </div>
                    ` : ''}
                `}
            </div>
        </div>
    `;

    return modal;
}

/**
 * Update modal content with current profile data
 */
function updateModalContent(modal) {
    const profile = store.get('currentProfile');
    if (!profile) {
        modal.remove();
        return;
    }

    const status = checkSetupCompletion(profile);

    // Find the content container (the inner div)
    const contentDiv = modal.querySelector('div > div');
    if (!contentDiv) return;

    // Update the content while preserving the modal wrapper
    contentDiv.innerHTML = `
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 2px solid var(--border-color); background: linear-gradient(135deg, var(--success-color), #51cf66); color: white;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                        ${status.isComplete ? '🎉 Setup Complete!' : '📋 Complete Your Setup'}
                    </h2>
                    <p style="margin: 0; font-size: 14px; opacity: 0.95;">
                        ${getSetupMessage(status.percentage)}
                    </p>
                </div>
                <button id="close-setup-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                    ×
                </button>
            </div>

            <!-- Progress Bar -->
            <div style="background: rgba(255,255,255,0.3); border-radius: 12px; height: 24px; overflow: hidden; position: relative;">
                <div style="background: white; height: 100%; width: ${status.percentage}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 12px; font-weight: 700; color: var(--success-color); position: absolute; left: 50%; transform: translateX(-50%);">
                        ${status.completedCount} / ${status.totalCount} Complete (${status.percentage}%)
                    </span>
                </div>
            </div>
        </div>

        <!-- Checklist -->
        <div style="padding: 24px;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${status.checklist.map((item, index) => `
                    <div class="setup-checklist-item" data-tab="${item.tab}" style="
                        padding: 16px;
                        background: ${item.completed ? 'var(--success-bg)' : 'var(--bg-tertiary)'};
                        border: 2px solid ${item.completed ? 'var(--success-color)' : 'var(--border-color)'};
                        border-radius: 8px;
                        cursor: ${item.completed ? 'default' : 'pointer'};
                        transition: all 0.2s;
                        ${!item.completed ? 'opacity: 0.9;' : ''}
                    " ${!item.completed ? `onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateX(4px)'"` : ''} ${!item.completed ? `onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateX(0)'"` : ''}>
                        <div style="display: flex; align-items: start; gap: 12px;">
                            <div style="font-size: 24px; flex-shrink: 0;">
                                ${item.completed ? '✅' : '⬜'}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: ${item.completed ? 'var(--success-text)' : 'var(--text-primary)'}; ${item.completed ? 'text-decoration: line-through; opacity: 0.8;' : ''}">
                                    ${item.label}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary);">
                                    ${item.description}
                                </div>
                                ${!item.completed ? `
                                    <div style="margin-top: 8px;">
                                        <button class="go-to-tab-btn" data-tab="${item.tab}" style="
                                            padding: 6px 12px;
                                            background: var(--accent-color);
                                            color: white;
                                            border: none;
                                            border-radius: 4px;
                                            cursor: pointer;
                                            font-size: 12px;
                                            font-weight: 600;
                                            transition: all 0.2s;
                                        " onmouseover="this.style.background='var(--accent-hover)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='var(--accent-color)'; this.style.transform='translateY(0)'">
                                            → Go to ${item.tab.charAt(0).toUpperCase() + item.tab.slice(1)}
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            ${status.isComplete ? `
                <div style="margin-top: 24px; padding: 16px; background: var(--success-bg); border: 2px solid var(--success-color); border-radius: 8px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
                    <div style="font-weight: 600; font-size: 16px; color: var(--success-text); margin-bottom: 4px;">
                        Congratulations!
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        Your profile is fully set up and ready for analysis. Run the Monte Carlo simulation to see your retirement outlook!
                    </div>
                </div>
            ` : `
                ${status.nextItem ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--info-bg); border: 2px solid var(--info-color); border-radius: 8px;">
                        <div style="font-weight: 600; font-size: 14px; color: var(--info-color); margin-bottom: 8px;">
                            📍 Next Step
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                            ${status.nextItem.label}
                        </div>
                        <button class="go-to-tab-btn" data-tab="${status.nextItem.tab}" style="
                            padding: 8px 16px;
                            background: var(--info-color);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            width: 100%;
                            transition: all 0.2s;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 152, 173, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            Continue Setup →
                        </button>
                    </div>
                ` : ''}
            `}
        </div>
    `;

    // Re-attach event listeners after content update
    attachModalEventListeners(modal);
}

/**
 * Attach event listeners to modal
 */
function attachModalEventListeners(modal) {
    // Close button handler
    const closeBtn = modal.querySelector('#close-setup-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Unsubscribe from store updates
            if (modal._storeUnsubscribe) {
                modal._storeUnsubscribe();
            }

            modal.remove();
        });
    }

    // Add click handlers for "Go to" buttons
    const goToButtons = modal.querySelectorAll('.go-to-tab-btn');
    if (goToButtons.length > 0) {
        goToButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tab = btn.getAttribute('data-tab');

                // Close the modal so user can interact with the tab
                if (modal._storeUnsubscribe) {
                    modal._storeUnsubscribe();
                }
                modal.remove();

                // Navigate to the tab
                if (window.app && window.app.showTab) {
                    window.app.showTab(tab);
                }
            });
        });
    }

    // Add click handlers for checklist items (clicking row also navigates)
    const checklistItems = modal.querySelectorAll('.setup-checklist-item');
    checklistItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking a button inside
            if (e.target.closest('.go-to-tab-btn')) return;

            const tab = item.getAttribute('data-tab');
            if (!tab) return;

            // Close modal and navigate
            if (modal._storeUnsubscribe) {
                modal._storeUnsubscribe();
            }
            modal.remove();

            if (window.app && window.app.showTab) {
                window.app.showTab(tab);
            }
        });
    });

    // Close on background click
    const existingListener = modal._backgroundClickListener;
    if (existingListener) {
        modal.removeEventListener('click', existingListener);
    }

    const backgroundClickListener = (e) => {
        if (e.target === modal) {
            // Unsubscribe from store updates
            if (modal._storeUnsubscribe) {
                modal._storeUnsubscribe();
            }
            modal.remove();
        }
    };

    modal._backgroundClickListener = backgroundClickListener;
    modal.addEventListener('click', backgroundClickListener);
}

/**
 * Show setup checklist modal
 */
export function showSetupChecklist() {
    // Remove existing modal if any
    const existing = document.getElementById('setup-checklist-modal');
    if (existing) {
        // Unsubscribe from store updates before removing
        if (existing._storeUnsubscribe) {
            existing._storeUnsubscribe();
        }
        existing.remove();
    }

    const modal = renderSetupChecklist();
    if (modal) {
        document.body.appendChild(modal);

        // Attach initial event listeners
        attachModalEventListeners(modal);

        // Subscribe to store changes for reactive updates
        modal._storeUnsubscribe = store.subscribe((state) => {
            // Only update if the modal is still in the DOM
            if (document.getElementById('setup-checklist-modal')) {
                updateModalContent(modal);
            }
        });
    }
}

/**
 * Update setup button status
 */
export function updateSetupButton() {
    const setupBtn = document.getElementById('setup-btn');
    if (!setupBtn) return;

    const profile = store.get('currentProfile');

    if (!profile) {
        setupBtn.style.display = 'none';
        return;
    }

    const status = checkSetupCompletion(profile);

    // Show/hide button
    setupBtn.style.display = 'flex';

    // Update badge
    const badge = setupBtn.querySelector('.setup-badge');
    if (badge) {
        badge.textContent = `${status.percentage}%`;
    }

    // Update button state - hide if complete
    if (status.isComplete) {
        setupBtn.style.display = 'none';
    } else {
        setupBtn.style.display = 'flex';
        setupBtn.classList.remove('complete');
        setupBtn.classList.add('incomplete');
        const text = setupBtn.querySelector('.setup-text');
        if (text) {
            text.textContent = 'Complete Setup';
        }
    }
}
