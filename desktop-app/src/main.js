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
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      title: 'Cyber Forge AI - Real-Time Security Analysis'
    });

    // Disable sandbox for development environment
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--no-sandbox')) {
      app.commandLine.appendSwitch('--no-sandbox');
    }

    await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }

    // Set up browser monitoring (traditional)
    this.browserMonitor = setupBrowserMonitoring(this.mainWindow);
    
    // Set up enhanced browser monitoring for external browsers
    this.enhancedBrowserMonitor = setupEnhancedBrowserMonitoring(this.mainWindow);
    
    // Set up AI interface
    this.aiInterface = setupAIInterface();

    // Set up IPC handlers
    this.setupIPCHandlers();
    
    // Connect to backend
    this.connectToBackend();

    this.setupEventHandlers();
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
        await this.enhancedBrowserMonitor.setupBrowserMonitoring(selectedBrowsers);
        this.enhancedBrowserMonitor.startMonitoring();
        
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
  }

  setupEventHandlers() {
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
  }

  async initialize() {
    await app.whenReady();
    
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