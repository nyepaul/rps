/**
 * Main application entry point
 */

import { store } from './state/store.js';
import { apiClient } from './api/client.js';
import { API_ENDPOINTS, STORAGE_KEYS, APP_CONFIG } from './config.js';
import { showSetupChecklist, updateSetupButton } from './components/setup/setup-checklist.js';
import { showFeedbackModal } from './components/feedback/feedback-modal.js';
import { showRoadmapViewer } from './components/roadmap/roadmap-viewer.js';

/**
 * Initialize application
 */
async function init() {
    console.log('🚀 Retirement Planning System - Initializing...');

    // Log version for debugging
    try {
        const versionData = await apiClient.get('/api/version');
        console.log(`📦 RPS Version: ${versionData.version}`);
        console.log(`📅 Release: ${versionData.release_date}`);
        console.log(`📝 Notes: ${versionData.release_notes}`);
    } catch (error) {
        console.warn('Could not fetch version info');
    }

    // Check authentication status
    await checkAuth();

    // Set up tab navigation
    setupTabNavigation();

    // Set up setup button
    setupSetupButton();

    // Set up feedback button
    setupFeedback();

    // Set up roadmap link
    setupRoadmapLink();

    // Set up settings button
    setupSettings();

    // Set up logout button
    setupLogout();

    // Load saved preferences
    loadThemePreference();
    loadCompactModePreference();

    // Try to load default profile
    await loadDefaultProfileOnStartup();

    // Load and display version
    loadVersion();

    // Show initial tab - always start with welcome as landing page
    // Note: We always show Welcome on page load, regardless of previous session
    showTab('welcome');

    console.log('✅ Application initialized');
}

/**
 * Load and display application version
 */
async function loadVersion() {
    try {
        const data = await apiClient.get('/api/version');
        // Store version info in global state
        store.setState({
            appVersion: data.version,
            appReleaseDate: data.release_date,
            appReleaseNotes: data.release_notes
        });
        const versionSpan = document.getElementById('app-version');
        if (versionSpan && data.version) {
            versionSpan.textContent = `v${data.version}`;
            versionSpan.title = `Released: ${data.release_date}\n${data.release_notes}`;
            versionSpan.style.cursor = 'help';
            versionSpan.style.textDecoration = 'underline dotted';
        }
    } catch (error) {
        console.warn('Could not load version:', error);
    }
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

            // Show admin tab if user is admin
            if (data.user.is_admin) {
                const adminTab = document.querySelector('.admin-only-tab');
                if (adminTab) {
                    adminTab.style.display = 'inline-block';
                }
            }
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
        case 'income': {
            const { renderIncomeTab } = await import('./components/income/income-tab.js');
            renderIncomeTab(tabContent);
            break;
        }
        case 'budget': {
            const { renderBudgetTab } = await import('./components/budget/budget-tab.js');
            renderBudgetTab(tabContent);
            break;
        }
        case 'cashflow': {
            const { renderCashFlowTab } = await import('./components/cashflow/cashflow-tab.js');
            renderCashFlowTab(tabContent);
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
        case 'tax': {
            const { renderTaxTab } = await import('./components/tax/tax-tab.js');
            renderTaxTab(tabContent);
            break;
        }
        case 'admin': {
            const { renderAdminTab } = await import('./components/admin/admin-tab.js');
            renderAdminTab(tabContent);
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
 * Set up logout button
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to logout?')) {
                await logout();
            }
        });
    }
}

/**
 * Set up feedback button
 */
function setupFeedback() {
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            showFeedbackModal();
        });
    }
}

/**
 * Set up roadmap link
 */
function setupRoadmapLink() {
    const roadmapLink = document.getElementById('view-roadmap-link');
    if (roadmapLink) {
        roadmapLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRoadmapViewer();
        });
    }
}

/**
 * Set up setup button
 */
function setupSetupButton() {
    const setupBtn = document.getElementById('setup-btn');
    if (setupBtn) {
        setupBtn.addEventListener('click', () => {
            showSetupChecklist();
        });
    }

    // Update button status initially
    updateSetupButton();

    // Listen for profile changes and update button
    store.subscribe((state) => {
        updateSetupButton();
    });
}

/**
 * Open settings modal
 * @param {string} defaultTab - The tab to open by default ('general' or 'api-keys')
 */
async function openSettings(defaultTab = 'general') {
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
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Settings</h2>
                <span style="font-size: 12px; color: var(--text-light);">v${store.getState().appVersion || APP_CONFIG.VERSION}</span>
            </div>

            <!-- Settings Tabs -->
            <div style="display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid var(--border-color);">
                <button class="settings-tab active" data-settings-tab="general" style="padding: 10px 20px; background: transparent; border: none; border-bottom: 3px solid var(--accent-color); cursor: pointer; font-weight: 600; color: var(--accent-color); transition: all 0.2s;">
                    General
                </button>
                <button class="settings-tab" data-settings-tab="api-keys" style="padding: 10px 20px; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: var(--text-secondary); transition: all 0.2s;">
                    🔐 API Keys
                </button>
            </div>

            <!-- General Settings Tab -->
            <div id="settings-general" class="settings-tab-content" style="display: block;">

            <!-- Appearance Settings -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--text-secondary);">Appearance</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Theme</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-left: 10px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="theme-mode" value="light" ${!document.body.classList.contains('dark-mode') && !document.body.classList.contains('high-contrast-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">Light</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Standard light theme (default)</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="theme-mode" value="dark" ${document.body.classList.contains('dark-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">Dark</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Easy on the eyes in low light</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="theme-mode" value="high-contrast" ${document.body.classList.contains('high-contrast-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">High Contrast</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Maximum contrast for accessibility (WCAG AAA)</div>
                            </div>
                        </label>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Display Density</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-left: 10px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="display-density" value="compact" ${document.body.classList.contains('compact-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">Compact</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Minimal spacing, dense layout - fits more on screen</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="display-density" value="normal" ${!document.body.classList.contains('compact-mode') && !document.body.classList.contains('comfortable-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">Normal</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Balanced spacing and readability (default)</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="display-density" value="comfortable" ${document.body.classList.contains('comfortable-mode') ? 'checked' : ''}>
                            <div>
                                <div style="font-weight: 500;">Comfortable</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Spacious layout, generous padding - easier on the eyes</div>
                            </div>
                        </label>
                    </div>
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
            </div>

            <!-- API Keys Tab -->
            <div id="settings-api-keys" class="settings-tab-content" style="display: none;">
                <div id="api-keys-content">Loading...</div>
            </div>

            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                <button id="close-settings-btn" style="padding: 10px 20px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">
                    Close
                </button>
                <button id="save-settings-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Save Settings
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup tab switching
    const tabButtons = modal.querySelectorAll('.settings-tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-settings-tab');

            // Update active tab button
            tabButtons.forEach(b => {
                if (b === btn) {
                    b.classList.add('active');
                    b.style.borderBottomColor = 'var(--accent-color)';
                    b.style.color = 'var(--accent-color)';
                } else {
                    b.classList.remove('active');
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                }
            });

            // Show/hide content
            modal.querySelectorAll('.settings-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            modal.querySelector(`#settings-${tabName}`).style.display = 'block';
        });
    });

    // Load API Keys content
    const { renderAPIKeysSettings } = await import('./components/settings/api-keys-settings.js');
    const apiKeysContent = modal.querySelector('#api-keys-content');
    await renderAPIKeysSettings(apiKeysContent);

    // Activate the default tab
    if (defaultTab === 'api-keys') {
        const apiKeysBtn = modal.querySelector('[data-settings-tab="api-keys"]');
        if (apiKeysBtn) {
            apiKeysBtn.click();
        }
    }

    // Set up event handlers
    modal.querySelectorAll('input[name="theme-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleTheme(e.target.value);
        });
    });

    // Display density radio buttons
    modal.querySelectorAll('input[name="display-density"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setDisplayDensity(e.target.value);
        });
    });

    // Update market profile description on change
    modal.querySelector('#market-profile-setting').addEventListener('change', (e) => {
        const profile = APP_CONFIG.MARKET_PROFILES[e.target.value];
        modal.querySelector('#market-profile-description').textContent = profile.description;
    });

    modal.querySelector('#save-settings-btn').addEventListener('click', () => {
        // Save simulations setting
        const simulations = parseInt(modal.querySelector('#simulations-setting').value);
        if (simulations >= APP_CONFIG.MIN_SIMULATIONS && simulations <= APP_CONFIG.MAX_SIMULATIONS) {
            localStorage.setItem(STORAGE_KEYS.SIMULATIONS, simulations);
        }

        // Save market profile
        const marketProfile = modal.querySelector('#market-profile-setting').value;
        localStorage.setItem(STORAGE_KEYS.MARKET_PROFILE, marketProfile);

        import('./utils/dom.js').then(({ showSuccess }) => {
            showSuccess('Settings saved successfully!');
        });
        modal.remove();
    });

    modal.querySelector('#close-settings-btn').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Toggle theme (light/dark/high-contrast)
 */
function toggleTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('dark-mode', 'high-contrast-mode');

    // Apply the selected theme
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (theme === 'high-contrast') {
        document.body.classList.add('high-contrast-mode');
    }
    // light mode has no class

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else if (theme === 'high-contrast') {
        document.body.classList.add('high-contrast-mode');
    }
    // light mode (default) has no class
}

/**
 * Set display density (compact, normal, or comfortable)
 */
function setDisplayDensity(density) {
    // Remove all density classes
    document.body.classList.remove('compact-mode', 'comfortable-mode');

    // Add the selected density class
    if (density === 'compact') {
        document.body.classList.add('compact-mode');
    } else if (density === 'comfortable') {
        document.body.classList.add('comfortable-mode');
    }
    // normal mode has no class

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.DISPLAY_DENSITY, density);
}

/**
 * Toggle compact mode (legacy function for backwards compatibility)
 */
function toggleCompactMode(isCompact) {
    setDisplayDensity(isCompact ? 'compact' : 'normal');
}

/**
 * Load display density preference from localStorage
 */
function loadCompactModePreference() {
    const density = localStorage.getItem(STORAGE_KEYS.DISPLAY_DENSITY);

    if (density) {
        // New system: density can be 'compact', 'normal', or 'comfortable'
        setDisplayDensity(density);
    } else {
        // Legacy fallback: check old compact mode setting
        const compact = localStorage.getItem(STORAGE_KEYS.COMPACT_MODE);
        if (compact === 'true') {
            setDisplayDensity('compact');
        }
    }
}

/**
 * Logout user
 */
async function logout() {
    try {
        await apiClient.post(API_ENDPOINTS.AUTH_LOGOUT);
    } catch (error) {
        console.error('❌ Logout failed:', error);
    } finally {
        // Clear all local storage
        localStorage.clear();
        sessionStorage.clear();

        // Force hard redirect to login (no cache)
        window.location.replace('/login?t=' + Date.now());
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.app = { store, apiClient, showTab, openSettings };
