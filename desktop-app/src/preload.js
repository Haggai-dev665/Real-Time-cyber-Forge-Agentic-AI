const { contextBridge, ipcRenderer } = require('electron');

// Always use production Heroku backend
const backendUrl = 'https://cyberforge-ddd97655464f.herokuapp.com';
const wsUrl = 'wss://cyberforge-ddd97655464f.herokuapp.com/ws';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Shared config
  config: {
    backendUrl,
    wsUrl
  },

  // System and health
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  healthCheck: () => ipcRenderer.invoke('health-check'),
  getThreats: () => ipcRenderer.invoke('get-threats'),
  
  // Window controls
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Backend communication
  sendToBackend: (data) => ipcRenderer.invoke('send-to-backend', data),
  
  // Analysis data
  getAnalysisData: () => ipcRenderer.invoke('get-analysis-data'),
  
  // Browser selection and monitoring
  getBrowserList: () => ipcRenderer.invoke('get-browser-list'),
  selectBrowsers: (browserNames) => ipcRenderer.invoke('select-browsers', browserNames),
  checkDashboardAccess: () => ipcRenderer.invoke('check-dashboard-access'),
  getMonitoringData: () => ipcRenderer.invoke('get-monitoring-data'),
  
  // AI interface
  queryAI: (query) => ipcRenderer.invoke('query-ai', query),
  
  // Authentication (enhanced with Google OAuth)
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    logout: () => ipcRenderer.invoke('auth:logout'),
    fullLogout: () => ipcRenderer.invoke('auth:fullLogout'),
    getUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    updateProfile: (profileData) => ipcRenderer.invoke('auth:updateProfile', profileData),
    changePassword: (passwordData) => ipcRenderer.invoke('auth:changePassword', passwordData),
    googleAuth: () => ipcRenderer.invoke('auth:googleAuth'),
    onAuthSuccess: () => ipcRenderer.invoke('auth:onAuthSuccess'),
    checkSession: () => ipcRenderer.invoke('auth:checkSession')
  },
  
  // Event listeners
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', callback),
  onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', callback),
  onThreatAlert: (callback) => ipcRenderer.on('threat-alert', callback),
  onAIInsight: (callback) => ipcRenderer.on('ai-insight', callback),
  
  // Auth events
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', callback),
  
  // Enhanced monitoring event listeners
  onEnhancedPageVisited: (callback) => ipcRenderer.on('enhanced-page-visited', callback),
  onNetworkResponseData: (callback) => ipcRenderer.on('network-response-data', callback),
  onNetworkRequestData: (callback) => ipcRenderer.on('network-request-data', callback),
  onSecurityWarning: (callback) => ipcRenderer.on('security-warning', callback),
  
  // System-wide browser monitor
  systemMonitor: {
    start: () => ipcRenderer.invoke('system-monitor:start'),
    stop: () => ipcRenderer.invoke('system-monitor:stop'),
    getStats: () => ipcRenderer.invoke('system-monitor:stats'),
    getRequests: (limit) => ipcRenderer.invoke('system-monitor:requests', limit),
    getResponses: (limit) => ipcRenderer.invoke('system-monitor:responses', limit),
    launchBrowser: (browserKey) => ipcRenderer.invoke('system-monitor:launch-browser', browserKey),
    getAvailableBrowsers: () => ipcRenderer.invoke('system-monitor:available-browsers'),
    
    // Event listeners for real-time data
    onRequest: (callback) => ipcRenderer.on('browser-request', (event, data) => callback(data)),
    onResponse: (callback) => ipcRenderer.on('browser-response', (event, data) => callback(data)),
    onNavigation: (callback) => ipcRenderer.on('browser-navigation', (event, data) => callback(data)),
    onThreat: (callback) => ipcRenderer.on('threat-detected', (event, data) => callback(data)),
    onBrowserConnected: (callback) => ipcRenderer.on('browser-connected', (event, data) => callback(data)),
    onStatusChange: (callback) => ipcRenderer.on('system-monitor-status', (event, data) => callback(data)),
    onStatsUpdate: (callback) => ipcRenderer.on('system-monitor-stats', (event, data) => callback(data)),
    onConsole: (callback) => ipcRenderer.on('browser-console', (event, data) => callback(data))
  },
  
  // Setup wizard
  setup: {
    runWizard: () => ipcRenderer.invoke('run-setup-wizard'),
    getStatus: () => ipcRenderer.invoke('get-setup-status')
  },
  
  // Browser integration (for launching browsers with monitoring)
  browserIntegration: {
    launch: (browserId) => ipcRenderer.invoke('browser-integration:launch', browserId),
    getStatus: () => ipcRenderer.invoke('browser-integration:status'),
    getShortcuts: () => ipcRenderer.invoke('browser-integration:get-shortcuts')
  },
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Send page visit data
  sendPageVisit: (pageData) => ipcRenderer.send('page-visited', pageData)
});