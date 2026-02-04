// Application configuration and constants
const APP_CONFIG = {
  // App metadata
  name: 'CyberForge',
  version: '2.0.0',
  description: 'AI-Powered Cybersecurity Platform',
  
  // Features
  features: {
    browserMonitoring: true,
    threatDetection: true,
    aiAgent: true,
    realTimeAlerts: true,
    mlAnalysis: true
  },
  
  // Browser monitoring configuration
  browserMonitoring: {
    supportedBrowsers: ['chrome', 'brave', 'edge', 'chromium', 'arc', 'opera'],
    debugPorts: {
      chrome: 9222,
      brave: 9223,
      edge: 9224,
      chromium: 9225,
      arc: 9226,
      opera: 9227
    },
    maxRequests: 1000,
    threatAnalysis: true
  },
  
  // UI Configuration
  ui: {
    theme: 'dark',
    animations: true,
    notifications: true,
    autoUpdates: true
  },
  
  // Security settings
  security: {
    autoScan: true,
    threatThreshold: 0.7,
    alertSeverity: ['critical', 'high', 'medium'],
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_CONFIG };
} else {
  window.APP_CONFIG = APP_CONFIG;
}