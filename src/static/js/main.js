/**
 * Main application entry point
 */

import { store } from './state/store.js';
import { apiClient } from './api/client.js';
import { API_ENDPOINTS, STORAGE_KEYS } from './config.js';

/**
 * Initialize application
 */
async function init() {
    console.log('🚀 Retirement Planning System - Initializing...');

    // Check authentication status
    await checkAuth();

    // Set up tab navigation
    setupTabNavigation();

    // Set up settings button
    setupSettings();

    // Load saved theme preference
    loadThemePreference();

    // Show initial tab (welcome or last viewed)
    const lastTab = localStorage.getItem(STORAGE_KEYS.LAST_TAB) || 'welcome';
    showTab(lastTab);

    console.log('✅ Application initialized');
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
    try {
        const data = await apiClient.get(API_ENDPOINTS.AUTH_SESSION);
        if (data.authenticated) {
            store.setState({ currentUser: data.user });
            console.log('✅ User authenticated:', data.user.username);
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('❌ Auth check failed:', error);
        // Redirect to login on error
        window.location.href = '/login';
    }
}

/**
 * Set up tab navigation
 */
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab[data-tab]');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            showTab(tabName);
        });
    });
}

/**
 * Show specific tab
 */
async function showTab(tabName) {
    // Update active button
    const tabButtons = document.querySelectorAll('.tab[data-tab]');
    tabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Update state
    store.setState({ currentTab: tabName });

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.LAST_TAB, tabName);

    // Load tab content
    const container = document.getElementById('tab-content-container');

    try {
        await loadTabComponent(tabName, container);
        console.log(`📄 Showing tab: ${tabName}`);
    } catch (error) {
        console.error(`❌ Error loading tab ${tabName}:`, error);
        container.innerHTML = `
            <div class="tab-content active">
                <div style="background: var(--danger-bg); padding: 20px; border-radius: 8px; margin: 20px;">
                    <strong>Error:</strong> Could not load ${tabName} tab. ${error.message}
                </div>
            </div>
        `;
    }
}

/**
 * Load tab component dynamically
 */
async function loadTabComponent(tabName, container) {
    // Show loading state
    container.innerHTML = `
        <div class="tab-content active">
            <div style="text-align: center; padding: 60px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                <div>Loading ${tabName}...</div>
            </div>
        </div>
    `;

    // Create container div
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content active';

    // Load the appropriate component
    switch (tabName) {
        case 'welcome': {
            const { renderWelcomeTab } = await import('./components/welcome/welcome-tab.js');
            renderWelcomeTab(tabContent);
            break;
        }
        case 'dashboard': {
            const { renderDashboardTab } = await import('./components/dashboard/dashboard-tab.js');
            renderDashboardTab(tabContent);
            break;
        }
        case 'profile': {
            const { renderProfileTab } = await import('./components/profile/profile-tab.js');
            renderProfileTab(tabContent);
            break;
        }
        case 'analysis': {
            const { renderAnalysisTab } = await import('./components/analysis/analysis-tab.js');
            renderAnalysisTab(tabContent);
            break;
        }
        case 'actions': {
            const { renderActionsTab } = await import('./components/actions/actions-tab.js');
            renderActionsTab(tabContent);
            break;
        }
        case 'advisor': {
            const { renderAdvisorTab } = await import('./components/advisor/advisor-tab.js');
            renderAdvisorTab(tabContent);
            break;
        }
        case 'accounts': {
            const { renderAccountsTab } = await import('./components/accounts/accounts-tab.js');
            renderAccountsTab(tabContent);
            break;
        }
        case 'comparison': {
            const { renderComparisonTab } = await import('./components/comparison/comparison-tab.js');
            renderComparisonTab(tabContent);
            break;
        }
        case 'summary': {
            const { renderSummaryTab } = await import('./components/summary/summary-tab.js');
            renderSummaryTab(tabContent);
            break;
        }
        case 'learn': {
            const { renderLearnTab } = await import('./components/learn/learn-tab.js');
            renderLearnTab(tabContent);
            break;
        }
        default:
            throw new Error(`Unknown tab: ${tabName}`);
    }

    // Replace container content
    container.innerHTML = '';
    container.appendChild(tabContent);
}

/**
 * Set up settings button
 */
function setupSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
}

/**
 * Open settings modal
 */
function openSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal';
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

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 500px; width: 90%;">
            <h2 style="margin-bottom: 20px;">Settings</h2>
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" id="dark-mode-toggle" ${document.body.classList.contains('dark-mode') ? 'checked' : ''}>
                    <span>Dark Mode</span>
                </label>
            </div>
            <div style="margin-bottom: 20px;">
                <button id="logout-btn" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Logout
                </button>
            </div>
            <div style="text-align: right;">
                <button id="close-settings-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Set up event handlers
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        toggleTheme(e.target.checked);
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await logout();
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Toggle dark/light theme
 */
function toggleTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, 'light');
    }
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

/**
 * Logout user
 */
async function logout() {
    try {
        await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
        window.location.href = '/login';
    } catch (error) {
        console.error('❌ Logout failed:', error);
        // Redirect anyway
        window.location.href = '/login';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.app = { store, apiClient, showTab };
