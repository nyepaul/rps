/**
 * Main application entry point
 */

import { store } from './state/store.js';
import { apiClient } from './api/client.js';
import { API_ENDPOINTS, STORAGE_KEYS, APP_CONFIG } from './config.js';

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

    // Load saved preferences
    loadThemePreference();
    loadCompactModePreference();

    // Try to load default profile
    await loadDefaultProfileOnStartup();

    // Show initial tab based on whether we have a profile loaded
    const currentProfile = store.get('currentProfile');
    let initialTab = localStorage.getItem(STORAGE_KEYS.LAST_TAB) || 'welcome';

    // If we loaded a default profile, go to dashboard
    if (currentProfile && initialTab === 'welcome') {
        initialTab = 'dashboard';
    }

    showTab(initialTab);

    console.log('✅ Application initialized');
}

/**
 * Load default profile on startup
 */
async function loadDefaultProfileOnStartup() {
    const defaultProfileName = localStorage.getItem(STORAGE_KEYS.DEFAULT_PROFILE);
    if (!defaultProfileName) return;

    try {
        const { profilesAPI } = await import('./api/profiles.js');
        const data = await profilesAPI.get(defaultProfileName);
        store.setState({ currentProfile: data.profile });
        console.log('✅ Default profile loaded:', defaultProfileName);
    } catch (error) {
        // Default profile no longer exists, clear it
        console.warn('⚠️ Default profile not found, clearing:', defaultProfileName);
        localStorage.removeItem(STORAGE_KEYS.DEFAULT_PROFILE);
    }
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
        case 'assets': {
            const { renderAssetsTab } = await import('./components/assets/assets-tab.js');
            renderAssetsTab(tabContent);
            break;
        }
        case 'budget': {
            const { renderBudgetTab } = await import('./components/budget/budget-tab.js');
            renderBudgetTab(tabContent);
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
    const currentSimulations = localStorage.getItem(STORAGE_KEYS.SIMULATIONS) || APP_CONFIG.DEFAULT_SIMULATIONS;
    const currentMarketProfile = localStorage.getItem(STORAGE_KEYS.MARKET_PROFILE) || 'historical';

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
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <h2 style="margin-bottom: 20px;">Settings</h2>

            <!-- Appearance Settings -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--text-secondary);">Appearance</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="dark-mode-toggle" ${document.body.classList.contains('dark-mode') ? 'checked' : ''}>
                        <span>Dark Mode</span>
                    </label>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="compact-mode-toggle" ${document.body.classList.contains('compact-mode') ? 'checked' : ''}>
                        <span>Compact Mode</span>
                    </label>
                </div>
            </div>

            <!-- Analysis Settings -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--text-secondary);">Monte Carlo Analysis</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Default Number of Simulations</label>
                    <input type="number" id="simulations-setting"
                           value="${currentSimulations}"
                           min="${APP_CONFIG.MIN_SIMULATIONS}"
                           max="${APP_CONFIG.MAX_SIMULATIONS}"
                           style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                    <small style="display: block; margin-top: 5px; color: var(--text-secondary);">
                        Range: ${APP_CONFIG.MIN_SIMULATIONS.toLocaleString()} - ${APP_CONFIG.MAX_SIMULATIONS.toLocaleString()}. More simulations = more accurate (but slower)
                    </small>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Market Assumptions Profile</label>
                    <select id="market-profile-setting" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <optgroup label="📊 Base Scenarios">
                            ${['historical', 'conservative', 'balanced', 'aggressive'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="📉 Bear/Crisis Scenarios">
                            ${['bear-market', 'recession', 'stagflation', 'crisis-2008'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="📈 Bull/Optimistic Scenarios">
                            ${['bull-market', 'post-covid', 'roaring-20s'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="🎯 Historical Periods">
                            ${['dotcom-boom', 'dotcom-bust', 'great-recession', 'decade-2010s'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="🌍 Global & Alternative">
                            ${['emerging', 'international', 'gold-hedge', 'real-estate'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="💰 Income & Stability">
                            ${['dividend', 'bonds-heavy'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                        <optgroup label="🏭 Sector-Specific">
                            ${['tech-heavy', 'healthcare', 'financials', 'energy'].map(key => `
                                <option value="${key}" ${currentMarketProfile === key ? 'selected' : ''}>
                                    ${APP_CONFIG.MARKET_PROFILES[key].name}
                                </option>
                            `).join('')}
                        </optgroup>
                    </select>
                    <small id="market-profile-description" style="display: block; margin-top: 5px; color: var(--text-secondary);">
                        ${APP_CONFIG.MARKET_PROFILES[currentMarketProfile]?.description || 'Select a market profile'}
                    </small>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                <button id="logout-btn" style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Logout
                </button>
                <div style="display: flex; gap: 10px;">
                    <button id="close-settings-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="save-settings-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Set up event handlers
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
        toggleTheme(e.target.checked);
    });

    document.getElementById('compact-mode-toggle').addEventListener('change', (e) => {
        toggleCompactMode(e.target.checked);
    });

    // Update market profile description on change
    document.getElementById('market-profile-setting').addEventListener('change', (e) => {
        const profile = APP_CONFIG.MARKET_PROFILES[e.target.value];
        document.getElementById('market-profile-description').textContent = profile.description;
    });

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        // Save simulations setting
        const simulations = parseInt(document.getElementById('simulations-setting').value);
        if (simulations >= APP_CONFIG.MIN_SIMULATIONS && simulations <= APP_CONFIG.MAX_SIMULATIONS) {
            localStorage.setItem(STORAGE_KEYS.SIMULATIONS, simulations);
        }

        // Save market profile
        const marketProfile = document.getElementById('market-profile-setting').value;
        localStorage.setItem(STORAGE_KEYS.MARKET_PROFILE, marketProfile);

        alert('Settings saved successfully!');
        modal.remove();
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
 * Toggle compact mode
 */
function toggleCompactMode(isCompact) {
    if (isCompact) {
        document.body.classList.add('compact-mode');
        localStorage.setItem(STORAGE_KEYS.COMPACT_MODE, 'true');
    } else {
        document.body.classList.remove('compact-mode');
        localStorage.setItem(STORAGE_KEYS.COMPACT_MODE, 'false');
    }
}

/**
 * Load compact mode preference from localStorage
 */
function loadCompactModePreference() {
    const compact = localStorage.getItem(STORAGE_KEYS.COMPACT_MODE);
    if (compact === 'true') {
        document.body.classList.add('compact-mode');
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
