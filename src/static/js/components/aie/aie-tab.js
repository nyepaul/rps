/**
 * AIE Tab - Assets, Income, Expenses consolidated view
 */

import { renderAssetsTab } from '../assets/assets-tab.js';
import { renderIncomeTab } from '../income/income-tab.js';
import { renderBudgetTab } from '../budget/budget-tab.js';

/**
 * Render AIE tab with sub-navigation
 */
export function renderAIETab(container) {
    console.log('AIE: Rendering AIE tab with Assets as default');

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

    // Set up sub-tab navigation (query from container to ensure elements exist)
    setupSubtabNavigation(container);

    console.log('AIE: Event listeners attached, loading default subtab: Assets');

    // IMPORTANT: Always load Assets by default when AIE tab is opened
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(() => {
        showAIESubtab('assets', container);
    }, 0);
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
function setupSubtabNavigation(container) {
    const subtabButtons = container.querySelectorAll('.aie-subtab');

    subtabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const subtab = button.getAttribute('data-subtab');
            showAIESubtab(subtab, container);
        });
    });
}

/**
 * Show specific AIE sub-tab
 * @param {string} subtabName - The subtab to display ('assets', 'income', or 'expenses')
 * @param {HTMLElement} [parentContainer] - Optional parent container for scoped queries
 */
function showAIESubtab(subtabName, parentContainer = null) {
    console.log('AIE: Switching to subtab:', subtabName);

    // Update active button (use parent container scope if provided)
    const scope = parentContainer || document;
    const subtabButtons = scope.querySelectorAll('.aie-subtab');
    subtabButtons.forEach(button => {
        if (button.getAttribute('data-subtab') === subtabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Get content container
    const contentContainer = document.getElementById('aie-subtab-content');
    if (!contentContainer) {
        console.error('AIE: Could not find aie-subtab-content container');
        return;
    }

    try {
        console.log('AIE: Rendering subtab content for:', subtabName);
        // Load the appropriate component directly into the container
        // The render functions handle setting innerHTML and event listeners
        switch (subtabName) {
            case 'assets':
                console.log('AIE: Loading Assets (default subtab)');
                renderAssetsTab(contentContainer);
                break;
            case 'income':
                renderIncomeTab(contentContainer);
                break;
            case 'expenses':
                renderBudgetTab(contentContainer);
                break;
            default:
                throw new Error(`Unknown AIE subtab: ${subtabName}`);
        }
        console.log('AIE: Successfully rendered subtab:', subtabName);
    } catch (error) {
        console.error(`Error loading AIE subtab ${subtabName}:`, error);
        contentContainer.innerHTML = `
            <div style="background: var(--danger-bg); padding: 20px; border-radius: 8px; margin: 20px;">
                <strong>Error:</strong> Could not load ${subtabName}. ${error.message}
            </div>
        `;
    }
}
