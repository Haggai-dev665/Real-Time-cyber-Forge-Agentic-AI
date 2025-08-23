const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Backend communication
  sendToBackend: (data) => ipcRenderer.invoke('send-to-backend', data),
  
  // Analysis data
  getAnalysisData: () => ipcRenderer.invoke('get-analysis-data'),
  
  // AI interface
  queryAI: (query) => ipcRenderer.invoke('query-ai', query),
  
  // Authentication
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    updateProfile: (profileData) => ipcRenderer.invoke('auth:updateProfile', profileData),
    changePassword: (passwordData) => ipcRenderer.invoke('auth:changePassword', passwordData)
  },
  
  // Event listeners
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', callback),
  onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', callback),
  onThreatAlert: (callback) => ipcRenderer.on('threat-alert', callback),
  onAIInsight: (callback) => ipcRenderer.on('ai-insight', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Send page visit data
  sendPageVisit: (pageData) => ipcRenderer.send('page-visited', pageData)
});