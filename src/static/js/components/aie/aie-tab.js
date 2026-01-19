/**
 * AIE Tab - Assets, Income, Expenses consolidated view
 */

import { renderAssetsTab } from '../assets/assets-tab.js';
import { renderIncomeTab } from '../income/income-tab.js';
import { renderBudgetTab } from '../budget/budget-tab.js';

/**
 * Render AIE tab with sub-navigation
 */
export async function renderAIETab(container) {
    container.innerHTML = `
        <div class="aie-container">
            <div class="aie-header">
                <h2>Assets, Income & Expenses</h2>
                <p class="help-text">Manage your financial data</p>
            </div>

            <div class="aie-subtabs">
                <button class="aie-subtab active" data-subtab="assets">
                    💰 Assets
                </button>
                <button class="aie-subtab" data-subtab="income">
                    💵 Income
                </button>
                <button class="aie-subtab" data-subtab="expenses">
                    💸 Expenses
                </button>
            </div>

            <div id="aie-subtab-content"></div>
        </div>
    `;

    // Add styles for sub-tabs
    addAIEStyles();

    // Set up sub-tab navigation
    setupSubtabNavigation();

    // Load default subtab (assets)
    await showAIESubtab('assets');
}

/**
 * Add inline styles for AIE subtabs
 */
function addAIEStyles() {
    // Check if styles already exist
    if (document.getElementById('aie-styles')) return;

    const style = document.createElement('style');
    style.id = 'aie-styles';
    style.textContent = `
        .aie-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0;
        }

        .aie-header {
            padding: 20px 20px 10px 20px;
        }

        .aie-header h2 {
            margin: 0 0 5px 0;
            font-size: 24px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .aie-header .help-text {
            margin: 0;
            color: var(--text-secondary);
            font-size: 14px;
        }

        .aie-subtabs {
            display: flex;
            gap: 0;
            border-bottom: 2px solid var(--border-color);
            padding: 0 20px;
            margin-bottom: 20px;
            background: var(--bg-secondary);
        }

        .aie-subtab {
            padding: 12px 24px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-size: 15px;
            font-weight: 500;
            color: var(--text-secondary);
            transition: all 0.2s;
            margin-bottom: -2px;
        }

        .aie-subtab:hover {
            color: var(--text-primary);
            background: var(--bg-tertiary);
        }

        .aie-subtab.active {
            color: var(--accent-color);
            border-bottom-color: var(--accent-color);
            background: var(--bg-primary);
        }

        #aie-subtab-content {
            padding: 0 20px 20px 20px;
        }

        @media (max-width: 768px) {
            .aie-subtabs {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }

            .aie-subtab {
                padding: 10px 16px;
                font-size: 14px;
                white-space: nowrap;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Set up sub-tab navigation
 */
function setupSubtabNavigation() {
    const subtabButtons = document.querySelectorAll('.aie-subtab');

    subtabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const subtab = button.getAttribute('data-subtab');
            showAIESubtab(subtab);
        });
    });
}

/**
 * Show specific AIE sub-tab
 */
async function showAIESubtab(subtabName) {
    // Update active button
    const subtabButtons = document.querySelectorAll('.aie-subtab');
    subtabButtons.forEach(button => {
        if (button.getAttribute('data-subtab') === subtabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Get container
    const container = document.getElementById('aie-subtab-content');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>Loading ${subtabName}...</div>
        </div>
    `;

    // Create subtab content container
    const subtabContent = document.createElement('div');
    subtabContent.className = 'aie-subtab-content';

    try {
        // Load the appropriate component
        switch (subtabName) {
            case 'assets':
                await renderAssetsTab(subtabContent);
                break;
            case 'income':
                await renderIncomeTab(subtabContent);
                break;
            case 'expenses':
                await renderBudgetTab(subtabContent);
                break;
            default:
                throw new Error(`Unknown AIE subtab: ${subtabName}`);
        }

        // Replace container content
        container.innerHTML = '';
        container.appendChild(subtabContent);
    } catch (error) {
        console.error(`Error loading AIE subtab ${subtabName}:`, error);
        container.innerHTML = `
            <div style="background: var(--danger-bg); padding: 20px; border-radius: 8px; margin: 20px;">
                <strong>Error:</strong> Could not load ${subtabName}. ${error.message}
            </div>
        `;
    }
}
