/**
 * Application configuration
 */

// API Base URL (can be overridden by environment)
export const API_URL = window.location.origin;

// API Endpoints
export const API_ENDPOINTS = {
    // Authentication
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',
    AUTH_REGISTER: '/api/auth/register',
    AUTH_SESSION: '/api/auth/session',

    // Profiles
    PROFILES_LIST: '/api/profiles',
    PROFILE_GET: (name) => `/api/profile/${encodeURIComponent(name)}`,
    PROFILE_CREATE: '/api/profiles',
    PROFILE_UPDATE: (name) => `/api/profile/${encodeURIComponent(name)}`,
    PROFILE_DELETE: (name) => `/api/profile/${encodeURIComponent(name)}`,

    // Analysis
    ANALYSIS_RUN: '/api/analysis',
    ANALYSIS_SS: '/api/analysis/social-security',
    ANALYSIS_ROTH: '/api/analysis/roth-conversion',
    ANALYSIS_REBALANCE: '/api/analysis/rebalance',

    // Scenarios
    SCENARIOS_LIST: '/api/scenarios',
    SCENARIO_GET: (id) => `/api/scenario/${id}`,
    SCENARIO_CREATE: '/api/scenarios',
    SCENARIO_UPDATE: (id) => `/api/scenario/${id}`,
    SCENARIO_DELETE: (id) => `/api/scenario/${id}`,

    // Action Items
    ACTION_ITEMS_LIST: '/api/action-items',
    ACTION_ITEM_GET: (id) => `/api/action-item/${id}`,
    ACTION_ITEM_CREATE: '/api/action-items',
    ACTION_ITEM_UPDATE: (id) => `/api/action-item/${id}`,
    ACTION_ITEM_DELETE: (id) => `/api/action-item/${id}`,

    // Skills (Educational Content)
    SKILLS_LIST: '/api/skills',
    SKILL_GET: (filename) => `/api/skills/${encodeURIComponent(filename)}`,

    // Reports
    REPORT_ANALYSIS: '/api/reports/analysis',
    REPORT_PORTFOLIO: '/api/reports/portfolio',
    REPORT_ACTION_PLAN: '/api/reports/action-plan',
};

// Application Settings
export const APP_CONFIG = {
    VERSION: '3.8.115',
    DEFAULT_SIMULATIONS: 10000,
    MAX_SIMULATIONS: 50000,
    MIN_SIMULATIONS: 100,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    AUTOSAVE_INTERVAL: 30000, // 30 seconds
    CHART_COLORS: {
        primary: '#3498db',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8',
    },

    // Market Assumption Profiles
    MARKET_PROFILES: {
        // Base Scenarios
        historical: {
            name: 'Historical Average',
            description: 'Based on long-term historical market data',
            stock_return_mean: 0.10,
            stock_return_std: 0.18,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },
        conservative: {
            name: 'Conservative',
            description: 'Lower risk, more stable returns',
            stock_return_mean: 0.08,
            stock_return_std: 0.15,
            bond_return_mean: 0.04,
            bond_return_std: 0.05,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        balanced: {
            name: 'Balanced',
            description: 'Moderate risk and returns, well-diversified',
            stock_return_mean: 0.10,
            stock_return_std: 0.16,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },
        aggressive: {
            name: 'Aggressive Growth',
            description: 'Higher risk, higher expected returns',
            stock_return_mean: 0.13,
            stock_return_std: 0.20,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },

        // Bear/Crisis Scenarios
        'bear-market': {
            name: 'Bear Market',
            description: 'Negative returns (-20% to -40% decline)',
            stock_return_mean: -0.05,
            stock_return_std: 0.25,
            bond_return_mean: 0.035,
            bond_return_std: 0.05,
            inflation_mean: 0.02,
            inflation_std: 0.01
        },
        recession: {
            name: 'Recession',
            description: 'Economic contraction with low returns',
            stock_return_mean: 0.02,
            stock_return_std: 0.22,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.015,
            inflation_std: 0.01
        },
        stagflation: {
            name: 'Stagflation',
            description: 'High inflation with low growth',
            stock_return_mean: 0.04,
            stock_return_std: 0.20,
            bond_return_mean: 0.02,
            bond_return_std: 0.08,
            inflation_mean: 0.05,
            inflation_std: 0.02
        },
        'crisis-2008': {
            name: '2008 Financial Crisis',
            description: '2008 Financial Crisis conditions (-37% S&P 500)',
            stock_return_mean: -0.22,
            stock_return_std: 0.35,
            bond_return_mean: 0.05,
            bond_return_std: 0.08,
            inflation_mean: 0.001,
            inflation_std: 0.01
        },

        // Bull/Optimistic Scenarios
        'bull-market': {
            name: 'Bull Market',
            description: 'Sustained upward trend with strong gains',
            stock_return_mean: 0.18,
            stock_return_std: 0.14,
            bond_return_mean: 0.035,
            bond_return_std: 0.05,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        'post-covid': {
            name: 'Post-COVID Recovery',
            description: 'Post-COVID Recovery (2020-2021) conditions',
            stock_return_mean: 0.16,
            stock_return_std: 0.20,
            bond_return_mean: 0.015,
            bond_return_std: 0.06,
            inflation_mean: 0.045,
            inflation_std: 0.02
        },
        'roaring-20s': {
            name: 'Roaring 20s Boom',
            description: 'Strong sustained economic boom',
            stock_return_mean: 0.14,
            stock_return_std: 0.16,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },

        // Historical Periods
        'dotcom-boom': {
            name: 'Dot-com Boom (1997-1999)',
            description: 'Late 90s tech bubble gains',
            stock_return_mean: 0.25,
            stock_return_std: 0.30,
            bond_return_mean: 0.055,
            bond_return_std: 0.06,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        'dotcom-bust': {
            name: 'Dot-com Bust (2000-2002)',
            description: 'Tech bubble crash period',
            stock_return_mean: -0.15,
            stock_return_std: 0.32,
            bond_return_mean: 0.06,
            bond_return_std: 0.06,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        'great-recession': {
            name: 'Great Recession (2008-2009)',
            description: 'Financial crisis with unprecedented volatility',
            stock_return_mean: -0.30,
            stock_return_std: 0.38,
            bond_return_mean: 0.055,
            bond_return_std: 0.08,
            inflation_mean: -0.004,
            inflation_std: 0.01
        },
        'decade-2010s': {
            name: '2010s Bull Run',
            description: '2010-2019 sustained bull market',
            stock_return_mean: 0.14,
            stock_return_std: 0.15,
            bond_return_mean: 0.03,
            bond_return_std: 0.05,
            inflation_mean: 0.018,
            inflation_std: 0.01
        },

        // Global & Alternative
        emerging: {
            name: 'Emerging Markets',
            description: 'High growth potential with high volatility',
            stock_return_mean: 0.13,
            stock_return_std: 0.26,
            bond_return_mean: 0.05,
            bond_return_std: 0.08,
            inflation_mean: 0.04,
            inflation_std: 0.02
        },
        international: {
            name: 'International Diversified',
            description: 'Global diversification outside US',
            stock_return_mean: 0.095,
            stock_return_std: 0.19,
            bond_return_mean: 0.035,
            bond_return_std: 0.07,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        'gold-hedge': {
            name: 'Inflation Hedge',
            description: 'Gold/commodities for inflation protection',
            stock_return_mean: 0.08,
            stock_return_std: 0.16,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.02,
            inflation_std: 0.01
        },
        'real-estate': {
            name: 'REIT Focus',
            description: 'Real estate investment trust exposure',
            stock_return_mean: 0.10,
            stock_return_std: 0.20,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },

        // Income & Stability
        dividend: {
            name: 'Dividend Aristocrats',
            description: 'Income stability with blue chip dividends',
            stock_return_mean: 0.09,
            stock_return_std: 0.14,
            bond_return_mean: 0.045,
            bond_return_std: 0.05,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },
        'bonds-heavy': {
            name: 'Bond Heavy (30/70)',
            description: 'Capital preservation focus',
            stock_return_mean: 0.10,
            stock_return_std: 0.18,
            bond_return_mean: 0.045,
            bond_return_std: 0.05,
            inflation_mean: 0.025,
            inflation_std: 0.01
        },

        // Sector-Specific
        'tech-heavy': {
            name: 'Technology Sector',
            description: 'Aggressive tech/AI sector focus',
            stock_return_mean: 0.15,
            stock_return_std: 0.24,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },
        healthcare: {
            name: 'Healthcare Sector',
            description: 'Defensive healthcare sector focus',
            stock_return_mean: 0.115,
            stock_return_std: 0.16,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },
        financials: {
            name: 'Financial Sector',
            description: 'Cyclical financial sector exposure',
            stock_return_mean: 0.105,
            stock_return_std: 0.23,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.03,
            inflation_std: 0.01
        },
        energy: {
            name: 'Energy Sector',
            description: 'Volatile energy and commodity exposure',
            stock_return_mean: 0.09,
            stock_return_std: 0.25,
            bond_return_mean: 0.04,
            bond_return_std: 0.06,
            inflation_mean: 0.035,
            inflation_std: 0.015
        }
    },
};

// Local Storage Keys
export const STORAGE_KEYS = {
    CURRENT_PROFILE: 'current_profile',
    DEFAULT_PROFILE: 'default_profile',
    THEME: 'theme_preference',
    COMPACT_MODE: 'compact_mode', // Legacy - kept for backwards compatibility
    DISPLAY_DENSITY: 'display_density', // New: 'compact', 'normal', or 'comfortable'
    LAST_TAB: 'last_active_tab',
    USER_SETTINGS: 'user_settings',
    SIMULATIONS: 'rps_simulations',
    MARKET_PROFILE: 'rps_market_profile'
};
