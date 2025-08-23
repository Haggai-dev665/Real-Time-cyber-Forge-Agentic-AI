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