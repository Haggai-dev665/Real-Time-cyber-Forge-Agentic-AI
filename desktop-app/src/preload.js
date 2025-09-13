const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
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
  
  // Authentication
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    updateProfile: (profileData) => ipcRenderer.invoke('auth:updateProfile', profileData),
    changePassword: (passwordData) => ipcRenderer.invoke('auth:changePassword', passwordData)
  },
  
  // Event listeners
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', callback),
  onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', callback),
  onThreatAlert: (callback) => ipcRenderer.on('threat-alert', callback),
  onAIInsight: (callback) => ipcRenderer.on('ai-insight', callback),
  
  // Enhanced monitoring event listeners
  onEnhancedPageVisited: (callback) => ipcRenderer.on('enhanced-page-visited', callback),
  onNetworkResponseData: (callback) => ipcRenderer.on('network-response-data', callback),
  onNetworkRequestData: (callback) => ipcRenderer.on('network-request-data', callback),
  onSecurityWarning: (callback) => ipcRenderer.on('security-warning', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Send page visit data
  sendPageVisit: (pageData) => ipcRenderer.send('page-visited', pageData)
});