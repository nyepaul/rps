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
};

// Application Settings
export const APP_CONFIG = {
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
};

// Local Storage Keys
export const STORAGE_KEYS = {
    CURRENT_PROFILE: 'current_profile',
    THEME: 'theme_preference',
    LAST_TAB: 'last_active_tab',
    USER_SETTINGS: 'user_settings',
};
