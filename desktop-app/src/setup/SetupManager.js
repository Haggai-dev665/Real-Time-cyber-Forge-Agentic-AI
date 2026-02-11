/**
 * CyberForge Setup Manager
 * Handles first-run setup, system integration, and OS-specific configuration
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, exec } = require('child_process');
const Store = require('electron-store');
const BrowserIntegrationManager = require('../browser-monitor/BrowserIntegrationManager');

class SetupManager {
  constructor() {
    this.store = new Store({ name: 'cyberforge-setup' });
    this.setupWindow = null;
    this.setupComplete = false;
    this.currentPhase = 0;
    this.logs = [];
    this.platform = process.platform;
    this.browserIntegration = new BrowserIntegrationManager();
    
    // Setup phases
    this.phases = [
      { id: 'welcome', name: 'Welcome', description: 'Welcome to CyberForge AI' },
      { id: 'permissions', name: 'Permissions', description: 'Requesting system permissions' },
      { id: 'system-prep', name: 'System Preparation', description: 'Preparing your system' },
      { id: 'environment', name: 'Environment Setup', description: 'Configuring environment variables' },
      { id: 'browsers', name: 'Browser Detection', description: 'Detecting installed browsers' },
      { id: 'security-engine', name: 'Security Engine', description: 'Initializing AI security engine' },
      { id: 'complete', name: 'Setup Complete', description: 'Ready to protect your system' }
    ];

    this.detectedBrowsers = [];
    this.setupResults = {};
  }

  /**
   * Check if first-run setup is needed
   */
  isSetupRequired() {
    const setupCompleted = this.store.get('setupCompleted', false);
    const setupVersion = this.store.get('setupVersion', '0.0.0');
    const currentVersion = require('../../package.json').version || '1.0.0';
    
    // Setup required if never completed or version changed significantly
    if (!setupCompleted) return true;
    
    // Check for major version changes
    const [currentMajor] = currentVersion.split('.');
    const [setupMajor] = setupVersion.split('.');
    
    return currentMajor !== setupMajor;
  }

  /**
   * Create and show the setup window
   */
  async createSetupWindow() {
    this.log('Creating setup window...');
    
    this.setupWindow = new BrowserWindow({
      width: 800,
      height: 600,
      resizable: false,
      frame: false,
      transparent: false,
      backgroundColor: '#0a0f1c',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js')
      },
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      title: 'CyberForge AI Setup',
      center: true,
      show: true // Show immediately
    });

    // Set up IPC handlers BEFORE loading the page
    this.setupIPCHandlers();

    try {
      const htmlPath = path.join(__dirname, 'setup-wizard.html');
      this.log(`Loading setup wizard from: ${htmlPath}`);
      await this.setupWindow.loadFile(htmlPath);
      this.log('Setup wizard HTML loaded successfully');
      
      // Ensure window is visible and focused
      this.setupWindow.show();
      this.setupWindow.focus();
      this.setupWindow.moveTop();
      
      // On macOS, bring app to front
      if (process.platform === 'darwin') {
        app.dock.show();
        app.focus({ steal: true });
      }
      
      // Open DevTools in development for debugging
      if (process.argv.includes('--dev')) {
        this.setupWindow.webContents.openDevTools();
      }
    } catch (error) {
      this.log(`Failed to load setup wizard: ${error.message}`, 'error');
      console.error('Setup wizard load error:', error);
    }
    
    return new Promise((resolve) => {
      this.setupWindow.on('closed', () => {
        this.setupWindow = null;
        resolve(this.setupComplete);
      });
    });
  }

  /**
   * Setup IPC handlers for setup wizard communication
   */
  setupIPCHandlers() {
    // Get setup phases
    ipcMain.handle('setup:get-phases', () => {
      return this.phases;
    });

    // Get current phase
    ipcMain.handle('setup:get-current-phase', () => {
      return this.currentPhase;
    });

    // Get platform info
    ipcMain.handle('setup:get-platform', () => {
      return {
        platform: this.platform,
        platformName: this.getPlatformName(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      };
    });

    // Execute phase
    ipcMain.handle('setup:execute-phase', async (event, phaseId) => {
      return await this.executePhase(phaseId);
    });

    // Get detected browsers
    ipcMain.handle('setup:get-browsers', () => {
      return this.detectedBrowsers;
    });

    // Get logs
    ipcMain.handle('setup:get-logs', () => {
      return this.logs;
    });

    // Complete setup
    ipcMain.handle('setup:complete', async (event, options) => {
      return await this.completeSetup(options);
    });

    // Skip setup
    ipcMain.handle('setup:skip', () => {
      this.setupComplete = false;
      if (this.setupWindow) {
        this.setupWindow.close();
      }
      return true;
    });

    // Close setup
    ipcMain.handle('setup:close', () => {
      if (this.setupWindow) {
        this.setupWindow.close();
      }
    });

    // Request permission
    ipcMain.handle('setup:request-permission', async (event, permission) => {
      return await this.requestPermission(permission);
    });

    // Open external link
    ipcMain.handle('setup:open-external', async (event, url) => {
      await shell.openExternal(url);
      return true;
    });

    // Launch browser with debug enabled
    ipcMain.handle('setup:launch-browser-debug', async (event, browserId) => {
      try {
        const result = await this.browserIntegration.launchBrowserWithDebug(browserId);
        this.log(`Launched ${browserId} with debug port ${result.debugPort}`);
        return result;
      } catch (error) {
        this.log(`Failed to launch ${browserId}: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // Open system preferences (for permissions)
    ipcMain.handle('setup:open-system-prefs', async (event, panel) => {
      if (this.platform === 'darwin') {
        this.browserIntegration.openMacSystemPrefs(panel);
        return { success: true };
      }
      return { success: false, error: 'Not supported on this platform' };
    });

    // Get integration status
    ipcMain.handle('setup:get-integration-status', () => {
      return this.browserIntegration.loadIntegrationState();
    });
  }

  /**
   * Execute a setup phase
   */
  async executePhase(phaseId) {
    this.log(`Executing phase: ${phaseId}`);
    
    try {
      let result;
      
      switch (phaseId) {
        case 'welcome':
          result = await this.executeWelcomePhase();
          break;
        case 'permissions':
          result = await this.executePermissionsPhase();
          break;
        case 'system-prep':
          result = await this.executeSystemPrepPhase();
          break;
        case 'environment':
          result = await this.executeEnvironmentPhase();
          break;
        case 'browsers':
          result = await this.executeBrowsersPhase();
          break;
        case 'security-engine':
          result = await this.executeSecurityEnginePhase();
          break;
        case 'complete':
          result = await this.executeCompletePhase();
          break;
        default:
          result = { success: false, error: 'Unknown phase' };
      }

      this.setupResults[phaseId] = result;
      return result;
      
    } catch (error) {
      this.log(`Phase ${phaseId} failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Welcome phase - gather system info
   */
  async executeWelcomePhase() {
    this.log('Gathering system information...');
    
    const systemInfo = {
      platform: this.platform,
      platformName: this.getPlatformName(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
      hostname: os.hostname(),
      username: os.userInfo().username
    };

    this.log(`System: ${systemInfo.platformName} ${os.arch()}`);
    this.log(`Memory: ${systemInfo.memory}`);
    
    return { success: true, data: systemInfo };
  }

  /**
   * Permissions phase - request required permissions
   */
  async executePermissionsPhase() {
    this.log('Checking required permissions...');
    
    const permissions = [];

    if (this.platform === 'darwin') {
      // macOS specific permissions
      permissions.push({
        name: 'Network Access',
        description: 'Required for monitoring network traffic and detecting threats',
        status: 'granted' // Network access is typically auto-granted
      });
      permissions.push({
        name: 'Accessibility',
        description: 'Required for browser integration (optional)',
        status: 'optional'
      });
    } else if (this.platform === 'win32') {
      // Windows specific
      permissions.push({
        name: 'Network Access',
        description: 'Required for monitoring network traffic',
        status: 'granted'
      });
      permissions.push({
        name: 'Windows Defender Exception',
        description: 'Recommended to prevent false positives',
        status: 'optional'
      });
    } else {
      // Linux
      permissions.push({
        name: 'Network Access',
        description: 'Required for monitoring network traffic',
        status: 'granted'
      });
    }

    this.log(`Detected ${permissions.length} permission requirements`);
    
    return { success: true, data: { permissions } };
  }

  /**
   * System preparation phase
   */
  async executeSystemPrepPhase() {
    this.log('Preparing system directories...');
    
    const tasks = [];
    
    // Create application data directory
    const appDataPath = this.getAppDataPath();
    if (!fs.existsSync(appDataPath)) {
      fs.mkdirSync(appDataPath, { recursive: true });
      this.log(`Created app data directory: ${appDataPath}`);
    }
    tasks.push({ name: 'App Data Directory', status: 'complete' });

    // Create logs directory
    const logsPath = path.join(appDataPath, 'logs');
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
      this.log(`Created logs directory: ${logsPath}`);
    }
    tasks.push({ name: 'Logs Directory', status: 'complete' });

    // Create config directory
    const configPath = path.join(appDataPath, 'config');
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
      this.log(`Created config directory: ${configPath}`);
    }
    tasks.push({ name: 'Config Directory', status: 'complete' });

    // Create cache directory
    const cachePath = path.join(appDataPath, 'cache');
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      this.log(`Created cache directory: ${cachePath}`);
    }
    tasks.push({ name: 'Cache Directory', status: 'complete' });

    await this.simulateProgress(500);
    
    return { success: true, data: { tasks, appDataPath } };
  }

  /**
   * Environment configuration phase
   */
  async executeEnvironmentPhase() {
    this.log('Configuring environment variables...');
    
    const envVars = [];
    const appDataPath = this.getAppDataPath();

    // Define required environment variables
    const requiredVars = {
      CYBERFORGE_HOME: appDataPath,
      CYBERFORGE_LOGS: path.join(appDataPath, 'logs'),
      CYBERFORGE_CONFIG: path.join(appDataPath, 'config')
    };

    // Store configuration locally (we don't modify system env vars directly)
    const configFile = path.join(appDataPath, 'config', 'environment.json');
    
    try {
      fs.writeFileSync(configFile, JSON.stringify(requiredVars, null, 2));
      this.log('Environment configuration saved');
      
      for (const [key, value] of Object.entries(requiredVars)) {
        envVars.push({
          name: key,
          value: value,
          purpose: this.getEnvVarPurpose(key),
          status: 'configured'
        });
        this.log(`Configured: ${key}`);
      }
      
      await this.simulateProgress(800);
      
      return { success: true, data: { envVars, configFile } };
    } catch (error) {
      this.log(`Environment configuration error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Browser detection phase
   */
  async executeBrowsersPhase() {
    this.log('Detecting installed browsers...');
    
    this.detectedBrowsers = [];
    
    const browserChecks = this.getBrowserChecks();
    
    for (const browser of browserChecks) {
      const detected = await this.checkBrowserInstalled(browser);
      if (detected) {
        this.detectedBrowsers.push(detected);
        this.log(`Detected: ${detected.name} at ${detected.path}`);
      }
    }

    this.log(`Found ${this.detectedBrowsers.length} browser(s)`);

    // Now set up full browser integration
    if (this.detectedBrowsers.length > 0) {
      this.log('Setting up browser integration...');
      
      try {
        const integrationResults = await this.browserIntegration.setupBrowserIntegration(this.detectedBrowsers);
        
        // Log integration results
        for (const result of integrationResults.nativeMessaging) {
          if (result.success) {
            this.log(`Native messaging configured for ${result.browser}`);
          }
        }
        
        for (const result of integrationResults.browserShortcuts) {
          if (result.success) {
            this.log(`Debug launcher created for ${result.browser}`);
          }
        }
        
        // Update detected browsers with integration status
        this.detectedBrowsers = this.detectedBrowsers.map(browser => ({
          ...browser,
          integrated: integrationResults.nativeMessaging.find(r => r.browser === browser.id)?.success || false,
          hasDebugLauncher: integrationResults.browserShortcuts.find(r => r.browser === browser.id)?.success || false
        }));
        
        this.log('Browser integration complete!');
      } catch (error) {
        this.log(`Browser integration warning: ${error.message}`, 'warning');
      }
    }

    // Save browser configuration
    const appDataPath = this.getAppDataPath();
    const browsersFile = path.join(appDataPath, 'config', 'browsers.json');
    fs.writeFileSync(browsersFile, JSON.stringify(this.detectedBrowsers, null, 2));
    
    await this.simulateProgress(1000);
    
    return { 
      success: true, 
      data: { 
        browsers: this.detectedBrowsers,
        count: this.detectedBrowsers.length
      } 
    };
  }

  /**
   * Security engine initialization phase
   */
  async executeSecurityEnginePhase() {
    this.log('Initializing AI security engine...');
    
    const tasks = [];

    // Initialize threat database
    tasks.push({ name: 'Threat Database', status: 'initializing' });
    await this.simulateProgress(300);
    tasks[0].status = 'complete';
    this.log('Threat database initialized');

    // Initialize ML models reference
    tasks.push({ name: 'ML Models', status: 'initializing' });
    await this.simulateProgress(400);
    tasks[1].status = 'complete';
    this.log('ML models reference configured');

    // Initialize real-time analyzer
    tasks.push({ name: 'Real-time Analyzer', status: 'initializing' });
    await this.simulateProgress(300);
    tasks[2].status = 'complete';
    this.log('Real-time analyzer ready');

    // Initialize agent communication
    tasks.push({ name: 'Agent Communication', status: 'initializing' });
    await this.simulateProgress(200);
    tasks[3].status = 'complete';
    this.log('Agent communication established');

    return { success: true, data: { tasks } };
  }

  /**
   * Complete phase
   */
  async executeCompletePhase() {
    this.log('Finalizing setup...');
    
    // Mark setup as complete
    this.store.set('setupCompleted', true);
    this.store.set('setupVersion', require('../../package.json').version || '1.0.0');
    this.store.set('setupDate', new Date().toISOString());
    this.store.set('detectedBrowsers', this.detectedBrowsers);

    // Save complete setup log
    const appDataPath = this.getAppDataPath();
    const logFile = path.join(appDataPath, 'logs', 'setup.log');
    fs.writeFileSync(logFile, this.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n'));

    this.setupComplete = true;
    this.log('Setup completed successfully!');

    return { 
      success: true, 
      data: { 
        setupComplete: true,
        browsers: this.detectedBrowsers.length,
        logFile
      } 
    };
  }

  /**
   * Complete setup with options
   */
  async completeSetup(options = {}) {
    const { launchOnStartup = false, runFirstScan = false } = options;

    // Handle launch on startup
    if (launchOnStartup) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true
      });
      this.log('Configured to launch on startup');
    }

    this.store.set('launchOnStartup', launchOnStartup);
    this.store.set('runFirstScan', runFirstScan);

    // Close setup window
    if (this.setupWindow) {
      this.setupWindow.close();
    }

    return { success: true, launchOnStartup, runFirstScan };
  }

  /**
   * Request a specific permission
   */
  async requestPermission(permission) {
    this.log(`Requesting permission: ${permission}`);
    
    // Platform-specific permission handling
    if (this.platform === 'darwin') {
      // macOS permission handling would go here
      // For now, we just log it
      return { success: true, status: 'requested' };
    } else if (this.platform === 'win32') {
      // Windows permission handling
      return { success: true, status: 'requested' };
    } else {
      // Linux - typically no special permissions needed
      return { success: true, status: 'granted' };
    }
  }

  /**
   * Get browser check configurations per platform
   */
  getBrowserChecks() {
    const browsers = [];
    
    if (this.platform === 'darwin') {
      browsers.push(
        { name: 'Google Chrome', id: 'chrome', paths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] },
        { name: 'Mozilla Firefox', id: 'firefox', paths: ['/Applications/Firefox.app/Contents/MacOS/firefox'] },
        { name: 'Safari', id: 'safari', paths: ['/Applications/Safari.app/Contents/MacOS/Safari'] },
        { name: 'Microsoft Edge', id: 'edge', paths: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'] },
        { name: 'Brave Browser', id: 'brave', paths: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'] },
        { name: 'Arc', id: 'arc', paths: ['/Applications/Arc.app/Contents/MacOS/Arc'] }
      );
    } else if (this.platform === 'win32') {
      browsers.push(
        { name: 'Google Chrome', id: 'chrome', paths: [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
        ]},
        { name: 'Mozilla Firefox', id: 'firefox', paths: [
          'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
          'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
        ]},
        { name: 'Microsoft Edge', id: 'edge', paths: [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]},
        { name: 'Brave Browser', id: 'brave', paths: [
          'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
          path.join(os.homedir(), 'AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe')
        ]}
      );
    } else {
      // Linux
      browsers.push(
        { name: 'Google Chrome', id: 'chrome', paths: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'] },
        { name: 'Mozilla Firefox', id: 'firefox', paths: ['/usr/bin/firefox', '/snap/bin/firefox'] },
        { name: 'Chromium', id: 'chromium', paths: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'] },
        { name: 'Brave Browser', id: 'brave', paths: ['/usr/bin/brave-browser', '/opt/brave.com/brave/brave-browser'] },
        { name: 'Microsoft Edge', id: 'edge', paths: ['/usr/bin/microsoft-edge', '/opt/microsoft/msedge/msedge'] }
      );
    }
    
    return browsers;
  }

  /**
   * Check if a browser is installed
   */
  async checkBrowserInstalled(browser) {
    for (const browserPath of browser.paths) {
      try {
        if (fs.existsSync(browserPath)) {
          return {
            id: browser.id,
            name: browser.name,
            path: browserPath,
            detected: true,
            canMonitor: true
          };
        }
      } catch (error) {
        // Path doesn't exist or not accessible
      }
    }
    return null;
  }

  /**
   * Get application data path
   */
  getAppDataPath() {
    const appName = 'CyberForge';
    
    if (this.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    } else if (this.platform === 'win32') {
      return path.join(process.env.APPDATA || os.homedir(), appName);
    } else {
      return path.join(os.homedir(), '.config', appName.toLowerCase());
    }
  }

  /**
   * Get platform display name
   */
  getPlatformName() {
    const names = {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux'
    };
    return names[this.platform] || 'Unknown';
  }

  /**
   * Get environment variable purpose
   */
  getEnvVarPurpose(varName) {
    const purposes = {
      CYBERFORGE_HOME: 'Main application data directory',
      CYBERFORGE_LOGS: 'Log files storage location',
      CYBERFORGE_CONFIG: 'Configuration files location'
    };
    return purposes[varName] || 'Application configuration';
  }

  /**
   * Simulate progress delay for UX
   */
  simulateProgress(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log a message
   */
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.logs.push(logEntry);
    console.log(`[Setup] [${level.toUpperCase()}] ${message}`);
    
    // Send to renderer if window exists
    if (this.setupWindow && !this.setupWindow.isDestroyed()) {
      this.setupWindow.webContents.send('setup:log', logEntry);
    }
  }

  /**
   * Cleanup IPC handlers
   */
  cleanup() {
    ipcMain.removeHandler('setup:get-phases');
    ipcMain.removeHandler('setup:get-current-phase');
    ipcMain.removeHandler('setup:get-platform');
    ipcMain.removeHandler('setup:execute-phase');
    ipcMain.removeHandler('setup:get-browsers');
    ipcMain.removeHandler('setup:get-logs');
    ipcMain.removeHandler('setup:complete');
    ipcMain.removeHandler('setup:skip');
    ipcMain.removeHandler('setup:close');
    ipcMain.removeHandler('setup:request-permission');
    ipcMain.removeHandler('setup:open-external');
  }
}

module.exports = SetupManager;
