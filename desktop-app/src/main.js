const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { setupBrowserMonitoring } = require('./browser-monitor/monitor');
const { setupEnhancedBrowserMonitoring } = require('./browser-monitor/enhanced-monitor');
const BrowserSelector = require('./browser-monitor/browser-selector');
const { setupAIInterface } = require('./ai-interface/ai-client');
const AuthService = require('./auth/AuthService');
const WebSocket = require('ws');

class CyberForgeApp {
  constructor() {
    this.mainWindow = null;
    this.wsConnection = null;
    this.aiInterface = null;
    this.browserMonitor = null;
    this.enhancedBrowserMonitor = null;
    this.browserSelector = new BrowserSelector();
    this.authService = new AuthService();
    this.dashboardAccessGranted = false;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      title: 'Cyber Forge AI - Advanced Security Platform',
      titleBarStyle: 'hiddenInset',
      frame: true,
      minWidth: 1200,
      minHeight: 800
    });

    // Disable sandbox for development environment
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--no-sandbox')) {
      app.commandLine.appendSwitch('--no-sandbox');
    }

    // Load the advanced interface
    await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'advanced-index.html'));

    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }

    // Set up browser monitoring (traditional)
    this.browserMonitor = setupBrowserMonitoring(this.mainWindow);
    
    // Set up enhanced browser monitoring for external browsers
    this.enhancedBrowserMonitor = setupEnhancedBrowserMonitoring(this.mainWindow);
    
    // Set up AI interface
    this.aiInterface = setupAIInterface();
    
    // Connect to backend
    this.connectToBackend();
  }

  connectToBackend() {
    const backendUrl = process.env.BACKEND_URL || 'ws://localhost:8000';
    
    try {
      this.wsConnection = new WebSocket(`${backendUrl}/ws`, {
        headers: this.authService.getAuthHeaders()
      });
      
      this.wsConnection.on('open', () => {
        console.log('Connected to backend');
        this.mainWindow.webContents.send('backend-status', 'connected');
        
        // Send authentication info if logged in
        if (this.authService.isAuthenticated()) {
          this.wsConnection.send(JSON.stringify({
            type: 'authenticate',
            token: this.authService.getAuthToken()
          }));
        }
      });

      this.wsConnection.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleBackendMessage(message);
      });

      this.wsConnection.on('error', (error) => {
        console.error('Backend connection error:', error);
        this.mainWindow.webContents.send('backend-status', 'error');
      });

      this.wsConnection.on('close', () => {
        console.log('Backend connection closed');
        this.mainWindow.webContents.send('backend-status', 'disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectToBackend(), 5000);
      });
    } catch (error) {
      console.error('Failed to connect to backend:', error);
    }
  }

  handleBackendMessage(message) {
    switch (message.type) {
      case 'analysis_result':
        this.mainWindow.webContents.send('analysis-result', message.data);
        break;
      case 'threat_alert':
        this.mainWindow.webContents.send('threat-alert', message.data);
        break;
      case 'ai_insight':
        this.mainWindow.webContents.send('ai-insight', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  setupIPCHandlers() {
    console.log('Setting up IPC handlers...');

    // Clear any existing handlers to prevent conflicts
    ipcMain.removeAllListeners();

    // Health Check
    ipcMain.handle('health-check', async () => {
      console.log('Health check requested');
      try {
        const response = await fetch(`${this.backendUrl}/health`);
        const data = await response.json();
        console.log('Backend health check successful:', data);
        return { success: true, data };
      } catch (error) {
        console.error('Backend health check error:', error.message);
        return { 
          success: false, 
          error: 'Backend not available',
          data: { status: 'offline', message: 'Backend service unavailable: ' + error.message }
        };
      }
    });

    // Get Threats
    ipcMain.handle('get-threats', async () => {
      console.log('Get threats requested');
      try {
        // Mock threats data for now - replace with actual backend call
        const mockThreats = [
          {
            id: '1',
            type: 'Malware Detection',
            severity: 'high',
            description: 'Suspicious JavaScript execution detected',
            timestamp: new Date().toISOString(),
            status: 'active'
          },
          {
            id: '2',
            type: 'Network Intrusion',
            severity: 'medium',
            description: 'Unusual network traffic pattern',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            status: 'investigating'
          },
          {
            id: '3',
            type: 'Data Exfiltration',
            severity: 'low',
            description: 'Potential data leak attempt blocked',
            timestamp: new Date(Date.now() - 600000).toISOString(),
            status: 'resolved'
          }
        ];
        
        console.log('Returning threats data:', mockThreats);
        return { success: true, data: mockThreats };
      } catch (error) {
        console.error('Get threats error:', error);
        return { success: false, error: error.message, data: [] };
      }
    });

    // ML Service Health Check
    ipcMain.handle('ml:checkHealth', async () => {
      console.log('ML health check requested');
      try {
        const response = await fetch('http://127.0.0.1:8001/health');
        const data = await response.json();
        console.log('ML health check successful:', data);
        return { success: true, data };
      } catch (error) {
        console.error('ML health check error:', error.message);
        return { 
          success: false, 
          error: 'ML service not available',
          data: { status: 'offline', message: 'AI service unavailable: ' + error.message }
        };
      }
    });

    // System Statistics
    ipcMain.handle('get-system-stats', async () => {
      console.log('System stats requested');
      try {
        const os = require('os');
        const process = require('process');
        
        const cpuUsage = process.cpuUsage();
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        const stats = {
          cpu: Math.min(Math.random() * 80 + 10, 85), // Realistic CPU usage simulation
          memory: ((totalMem - freeMem) / totalMem) * 100,
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version
        };
        
        console.log('System stats:', stats);
        return { success: true, data: stats };
      } catch (error) {
        console.error('System stats error:', error);
        return { success: false, error: error.message };
      }
    });

    // Browser selection handlers
    ipcMain.handle('get-browser-list', async () => {
      try {
        const browsers = await this.browserSelector.detectInstalledBrowsers();
        return browsers;
      } catch (error) {
        console.error('Error getting browser list:', error);
        return [];
      }
    });

    ipcMain.handle('select-browsers', async (event, browserNames) => {
      try {
        const selectedBrowsers = this.browserSelector.setSelectedBrowsers(browserNames);
        
        // Start enhanced monitoring for selected browsers
        if (this.enhancedBrowserMonitor) {
          await this.enhancedBrowserMonitor.setupBrowserMonitoring(selectedBrowsers);
          this.enhancedBrowserMonitor.startMonitoring();
        }
        
        // Grant dashboard access
        this.dashboardAccessGranted = true;
        
        return { success: true, browsers: selectedBrowsers };
      } catch (error) {
        console.error('Error selecting browsers:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('check-dashboard-access', () => {
      return this.dashboardAccessGranted;
    });

    ipcMain.handle('get-monitoring-data', () => {
      if (this.enhancedBrowserMonitor) {
        return this.enhancedBrowserMonitor.getMonitoringData();
      }
      return this.browserMonitor?.getAnalysisData() || [];
    });

    // ML Service Integration Handlers
    ipcMain.handle('ml:chatWithAI', async (event, { message, conversationId, context }) => {
      try {
        const response = await fetch('http://127.0.0.1:8001/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            query: message, 
            context: context || 'chat', 
            conversation_history: conversationId ? [conversationId] : []
          })
        });
        
        const data = await response.json();
        return { success: true, data: { response: data.response || data.result || "Response received" } };
      } catch (error) {
        console.error('ML chat error:', error);
        return { 
          success: false, 
          error: error.message,
          data: { response: "I'm having technical difficulties. Please try again later." }
        };
      }
    });

    ipcMain.handle('ml:analyzeWebsite', async (event, { url, content }) => {
      try {
        const response = await fetch('http://127.0.0.1:8001/analyze-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url, context: 'website_analysis' })
        });
        
        return await response.json();
      } catch (error) {
        console.error('ML website analysis error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('ml:scanForThreats', async (event, data) => {
      try {
        const response = await fetch('http://127.0.0.1:8001/scan-threats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            urls: Array.isArray(data) ? data : [data],
            context: 'threat_scan',
            scan_id: Date.now().toString()
          })
        });
        
        return await response.json();
      } catch (error) {
        console.error('ML threat scan error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('ml:getAIInsights', async (event, { query, context }) => {
      try {
        const response = await fetch('http://127.0.0.1:8001/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, context: context || 'insights' })
        });
        
        const data = await response.json();
        return { success: true, data: { insights: data.insights, recommendations: data.recommendations } };
      } catch (error) {
        console.error('ML insights error:', error);
        return { success: false, error: error.message };
      }
    });

    // Window Controls
    ipcMain.handle('toggle-fullscreen', () => {
      try {
        if (this.mainWindow) {
          this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          return { success: true };
        }
        return { success: false, error: 'Main window not available' };
      } catch (error) {
        console.error('Toggle fullscreen error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('minimize-window', () => {
      try {
        if (this.mainWindow) {
          this.mainWindow.minimize();
          return { success: true };
        }
        return { success: false, error: 'Main window not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('maximize-window', () => {
      try {
        if (this.mainWindow) {
          if (this.mainWindow.isMaximized()) {
            this.mainWindow.unmaximize();
          } else {
            this.mainWindow.maximize();
          }
          return { success: true };
        }
        return { success: false, error: 'Main window not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('close-window', () => {
      try {
        if (this.mainWindow) {
          this.mainWindow.close();
          return { success: true };
        }
        return { success: false, error: 'Main window not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Additional handlers
    ipcMain.handle('get-analysis-data', async () => {
      return this.browserMonitor?.getAnalysisData() || [];
    });

    ipcMain.handle('send-to-backend', async (event, data) => {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify(data));
        return true;
      }
      return false;
    });

    ipcMain.handle('query-ai', async (event, query) => {
      return this.aiInterface?.queryAI(query) || 'AI service unavailable';
    });

    // Handle browser monitoring events
    ipcMain.on('page-visited', (event, pageData) => {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify({
          type: 'page_visit',
          data: pageData
        }));
      }
    });

    console.log('IPC handlers setup complete');
  }

  async initialize() {
    await app.whenReady();
    
    // Set up IPC handlers IMMEDIATELY after app is ready
    this.setupIPCHandlers();
    
    // Initialize authentication service
    await this.authService.initialize();
    
    await this.createMainWindow();

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createMainWindow();
      }
    });
  }
}

// Initialize the application
const cyberForgeApp = new CyberForgeApp();
cyberForgeApp.initialize().catch(console.error);
