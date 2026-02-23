/**
 * CyberForge Tauri API Bridge
 * 
 * Drop-in replacement for Electron's preload.js + contextBridge.
 * Exposes the exact same `window.electronAPI` interface so that
 * ALL existing renderer JS (cyberforge-app.js, auth-page.js, ai-assistant-v2.js, etc.)
 * works without modification.
 * 
 * Under the hood, calls are routed to Tauri's invoke() and event system.
 */

// Safely destructure Tauri APIs — withGlobalTauri must be true in tauri.conf.json
let invoke, listen, emit, getCurrentWebviewWindow;
try {
    invoke = window.__TAURI__.core.invoke;
    listen = window.__TAURI__.event.listen;
    emit = window.__TAURI__.event.emit;
    getCurrentWebviewWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow;
} catch (e) {
    console.error('[CyberForge Bridge] window.__TAURI__ not available:', e.message);
    console.error('[CyberForge Bridge] Ensure "withGlobalTauri": true is set in tauri.conf.json');
    // Create no-op fallbacks so the rest of the file doesn't crash
    invoke = function(cmd) { return Promise.reject(new Error('Tauri runtime not available — invoke(' + cmd + ') failed')); };
    listen = function() { return Promise.resolve(function(){}); };
    emit = function() { return Promise.resolve(); };
    getCurrentWebviewWindow = function() { return {}; };
}

const PROD_URL = 'https://cyberforge-ddd97655464f.herokuapp.com';
const backendUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('cyberforge_backend_url')) || PROD_URL;
const wsUrl = `${backendUrl.startsWith('https') ? 'wss' : 'ws'}://${backendUrl.replace(/^https?:\/\//, '')}/ws`;

// Event listener cleanup registry
const _listeners = {};

function onEvent(eventName, callback) {
    // Wrap Tauri's listen to match Electron's (event, data) signature
    listen(eventName, (event) => {
        callback(event, event.payload);
    }).then(unlisten => {
        if (!_listeners[eventName]) _listeners[eventName] = [];
        _listeners[eventName].push(unlisten);
    });
}

function removeAllListeners(channel) {
    if (_listeners[channel]) {
        _listeners[channel].forEach(unlisten => unlisten());
        delete _listeners[channel];
    }
}

// ─────────────────────────────────────────────
// Expose the same API that preload.js exposed
// ─────────────────────────────────────────────

window.electronAPI = {
    // Shared config
    config: {
        backendUrl,
        wsUrl
    },

    // System and health
    getSystemStats: () => invoke('get_system_stats'),
    healthCheck: () => invoke('health_check'),
    getThreats: () => invoke('get_threats'),

    // Window controls
    toggleFullscreen: () => invoke('toggle_fullscreen'),
    minimizeWindow: () => invoke('minimize_window'),
    maximizeWindow: () => invoke('maximize_window'),
    closeWindow: () => invoke('close_window'),

    // Backend communication
    sendToBackend: (data) => invoke('send_to_backend', { data }),

    // Analysis data
    getAnalysisData: () => invoke('get_analysis_data'),

    // Browser selection and monitoring
    getBrowserList: () => invoke('get_available_browsers'),
    detectSystemBrowsers: () => invoke('detect_system_browsers'),
    getActiveBrowserUrls: () => invoke('get_active_browser_urls'),
    selectBrowsers: (browserNames) => invoke('select_browsers', { browserNames }).catch(() => ({ success: true, browsers: browserNames })),
    checkDashboardAccess: () => Promise.resolve(true),
    getMonitoringData: () => Promise.resolve([]),

    // AI interface
    queryAI: (query) => invoke('query_ai', { query }).catch(() => 'AI service unavailable'),

    // Authentication — mirrors Electron's auth sub-object
    auth: {
        login: (credentials) => invoke('auth_login', { credentials }),
        register: (data) => invoke('auth_register', { data }),
        logout: () => invoke('auth_logout'),
        fullLogout: () => invoke('auth_logout'),
        getUser: () => invoke('auth_get_user'),
        getToken: () => invoke('auth_get_token'),
        isAuthenticated: () => invoke('auth_is_authenticated'),
        updateProfile: (profileData) => invoke('auth_update_profile', { profileData }),
        changePassword: (passwordData) => invoke('auth_change_password', { passwordData }),
        googleAuth: () => invoke('auth_google_url').then(url => { window.open(url, '_blank'); return { success: true }; }),
        onAuthSuccess: () => invoke('navigate_to', { page: 'dashboard' }),
        checkSession: () => invoke('auth_check_session'),
    },

    // Event listeners — map to Tauri events
    onBackendStatus: (callback) => onEvent('backend-status', callback),
    onAnalysisResult: (callback) => onEvent('analysis-result', callback),
    onThreatAlert: (callback) => onEvent('threat-alert', callback),
    onAIInsight: (callback) => onEvent('ai-insight', callback),

    // Auth events
    onAuthStateChanged: (callback) => onEvent('auth-state-changed', callback),

    // Enhanced monitoring event listeners
    onEnhancedPageVisited: (callback) => onEvent('enhanced-page-visited', callback),
    onNetworkResponseData: (callback) => onEvent('network-response-data', callback),
    onNetworkRequestData: (callback) => onEvent('network-request-data', callback),
    onSecurityWarning: (callback) => onEvent('security-warning', callback),

    // System-wide browser monitor
    systemMonitor: {
        start: () => invoke('system_monitor_stats').then(() => ({ success: true })),
        stop: () => Promise.resolve({ success: true }),
        getStats: () => invoke('system_monitor_stats'),
        getRequests: (limit) => Promise.resolve([]),
        getResponses: (limit) => Promise.resolve([]),
        launchBrowser: (browserKey) => Promise.resolve({ success: false, error: 'Use native browser launch' }),
        getAvailableBrowsers: () => invoke('get_available_browsers'),
        detectSystemBrowsers: () => invoke('detect_system_browsers'),
        getActiveBrowserUrls: () => invoke('get_active_browser_urls'),

        // Event listeners for real-time data
        onRequest: (callback) => onEvent('browser-request', (_, data) => callback(data)),
        onResponse: (callback) => onEvent('browser-response', (_, data) => callback(data)),
        onNavigation: (callback) => onEvent('browser-navigation', (_, data) => callback(data)),
        onThreat: (callback) => onEvent('threat-detected', (_, data) => callback(data)),
        onBrowserConnected: (callback) => onEvent('browser-connected', (_, data) => callback(data)),
        onStatusChange: (callback) => onEvent('system-monitor-status', (_, data) => callback(data)),
        onStatsUpdate: (callback) => onEvent('system-monitor-stats', (_, data) => callback(data)),
        onConsole: (callback) => onEvent('browser-console', (_, data) => callback(data)),
    },

    // Setup wizard
    setup: {
        runWizard: () => Promise.resolve({ success: true, completed: true }),
        getStatus: () => Promise.resolve({ completed: true, browsers: [], platform: navigator.platform }),
    },

    // Browser integration
    browserIntegration: {
        launch: (browserId) => Promise.resolve({ success: false, error: 'Use system browser' }),
        getStatus: () => Promise.resolve({}),
        getShortcuts: () => Promise.resolve([]),
    },

    // Remove listeners
    removeAllListeners: removeAllListeners,

    // Send page visit data
    sendPageVisit: (pageData) => emit('page-visited', pageData),
};

// Also expose for modules that check for __TAURI__
window.__CYBERFORGE_RUNTIME__ = 'tauri';

console.log('🚀 CyberForge Tauri Bridge loaded — window.electronAPI is ready');
