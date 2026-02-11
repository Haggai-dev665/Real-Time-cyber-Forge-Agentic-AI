/**
 * CyberForge Setup Wizard Preload Script
 * Exposes secure APIs for the setup wizard renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  // Get setup phases
  getPhases: () => ipcRenderer.invoke('setup:get-phases'),
  
  // Get current phase
  getCurrentPhase: () => ipcRenderer.invoke('setup:get-current-phase'),
  
  // Get platform information
  getPlatform: () => ipcRenderer.invoke('setup:get-platform'),
  
  // Execute a setup phase
  executePhase: (phaseId) => ipcRenderer.invoke('setup:execute-phase', phaseId),
  
  // Get detected browsers
  getBrowsers: () => ipcRenderer.invoke('setup:get-browsers'),
  
  // Get setup logs
  getLogs: () => ipcRenderer.invoke('setup:get-logs'),
  
  // Complete setup
  complete: (options) => ipcRenderer.invoke('setup:complete', options),
  
  // Skip setup
  skip: () => ipcRenderer.invoke('setup:skip'),
  
  // Close setup window
  close: () => ipcRenderer.invoke('setup:close'),
  
  // Request permission
  requestPermission: (permission) => ipcRenderer.invoke('setup:request-permission', permission),
  
  // Open external link
  openExternal: (url) => ipcRenderer.invoke('setup:open-external', url),
  
  // Launch browser with debug enabled
  launchBrowserDebug: (browserId) => ipcRenderer.invoke('setup:launch-browser-debug', browserId),
  
  // Open system preferences (macOS)
  openSystemPrefs: (panel) => ipcRenderer.invoke('setup:open-system-prefs', panel),
  
  // Get integration status
  getIntegrationStatus: () => ipcRenderer.invoke('setup:get-integration-status'),
  
  // Listen for log events
  onLog: (callback) => {
    ipcRenderer.on('setup:log', (event, logEntry) => callback(logEntry));
  },
  
  // Remove log listener
  removeLogListener: () => {
    ipcRenderer.removeAllListeners('setup:log');
  }
});
