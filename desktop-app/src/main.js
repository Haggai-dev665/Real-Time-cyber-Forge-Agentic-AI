const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');
const { setupBrowserMonitoring } = require('./browser-monitor/monitor');
const { setupEnhancedBrowserMonitoring } = require('./browser-monitor/enhanced-monitor');
const BrowserSelector = require('./browser-monitor/browser-selector');
const AuthService = require('./auth/AuthService');
const WebSocket = require('ws');

class CyberForgeApp {
  constructor() {
    this.mainWindow = null;
    this.authWindow = null;
    this.wsConnection = null;
    this.aiInterface = null;
    this.browserMonitor = null;
    this.enhancedBrowserMonitor = null;
    this.browserSelector = new BrowserSelector();
    this.authService = new AuthService();
    this.dashboardAccessGranted = false;
    this.isAuthenticated = false;
    this.dashboardLoaded = false;
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  }

  async createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1600,
      height: 1000,
      show: false, // Don't show until we determine auth state
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

    // Set main window reference in auth service
    this.authService.setMainWindow(this.mainWindow);

    // Set callback for successful authentication
    this.authService.setOnAuthSuccess(() => {
      this.onAuthenticationSuccess();
    });

    // Check if user is already authenticated
    const authResult = await this.authService.getCurrentUser();
    
    if (authResult.success && authResult.user) {
      console.log('✅ User already authenticated:', authResult.user.email);
      this.isAuthenticated = true;
      await this.loadDashboard();
    } else {
      console.log('🔐 User not authenticated, showing login page');
      await this.loadAuthPage();
    }

    // Show window after loading appropriate page
    this.mainWindow.show();

    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  async loadAuthPage() {
    console.log('📄 Loading authentication page...');
    await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'auth-page.html'));
    this.mainWindow.setTitle('Cyber Forge AI - Sign In');
  }

  async loadDashboard() {
    // Prevent loading dashboard multiple times
    if (this.dashboardLoaded) {
      console.log('⚠️ Dashboard already loaded, skipping...');
      return;
    }
    
    console.log('📊 Loading main dashboard...');
    
    // Load the Caido-style interface
    await this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'caido-index.html'));
    this.mainWindow.setTitle('Cyber Forge AI - Advanced Security Platform');
    this.dashboardLoaded = true;

    // Set up browser monitoring (traditional)
    this.browserMonitor = setupBrowserMonitoring(this.mainWindow);
    
    // Set up enhanced browser monitoring for external browsers
    this.enhancedBrowserMonitor = setupEnhancedBrowserMonitoring(this.mainWindow);
    
    // Connect to backend
    this.connectToBackend();
  }

  async onAuthenticationSuccess() {
    console.log('🎉 Authentication successful! Loading dashboard...');
    this.isAuthenticated = true;
    
    // Only load dashboard if not already loaded
    if (!this.dashboardLoaded) {
      await this.loadDashboard();
    } else {
      console.log('✅ Dashboard already loaded');
    }
  }

  async handleLogout() {
    console.log('👋 User logging out...');
    await this.authService.logout();
    this.isAuthenticated = false;
    
    // Disconnect from backend
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    
    // Clear monitoring
    this.browserMonitor = null;
    this.enhancedBrowserMonitor = null;
    
    // Load auth page
    await this.loadAuthPage();
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
        
        // Send client identification
        this.wsConnection.send(JSON.stringify({
          type: 'identify',
          client_type: 'desktop',
          version: require('../package.json').version || '1.0.0',
          platform: process.platform,
          timestamp: new Date().toISOString()
        }));
        
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
      case 'connection_established':
        console.log('Backend connection established:', message.clientId);
        break;
      case 'identification_confirmed':
        console.log('Client identification confirmed:', message.clientType);
        break;
      case 'authentication_confirmed':
        console.log('Client authentication confirmed:', message.userId);
        break;
      case 'connection_acknowledged':
        console.log('Connection acknowledged');
        break;
      case 'analysis_result':
        this.mainWindow.webContents.send('analysis-result', message.data);
        break;
      case 'threat_alert':
        this.mainWindow.webContents.send('threat-alert', message.data);
        break;
      case 'ai_insight':
        this.mainWindow.webContents.send('ai-insight', message.data);
        break;
      case 'heartbeat_response':
      case 'heartbeat':
        // Handle heartbeat response
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
      const headers = { 'User-Agent': 'cyber-forge-desktop/1.0' };
      const token = this.authService.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const response = await axios.get(`${this.backendUrl}/health`, { headers });
        console.log('Backend health check successful:', response.data);
        return { success: true, data: response.data };
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
      const headers = { 'User-Agent': 'cyber-forge-desktop/1.0' };
      const token = this.authService.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const response = await axios.get(`${this.backendUrl}/api/threats?status=all&limit=100`, { headers });
        const threats = response.data?.data?.threats || response.data?.threats || [];
        return { success: true, data: threats };
      } catch (error) {
        console.error('Get threats error:', error.message);
        return { success: false, error: error.message, data: [] };
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

    // Logout and return to auth page
    ipcMain.handle('auth:fullLogout', async () => {
      await this.handleLogout();
      return { success: true };
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
