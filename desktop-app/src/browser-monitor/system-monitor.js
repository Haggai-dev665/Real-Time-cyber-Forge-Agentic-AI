/**
 * System-Wide Browser Monitor
 * Captures HTTP/HTTPS requests from all browsers on the system
 * Uses Chrome DevTools Protocol for Chromium-based browsers
 * Uses native APIs for Safari on macOS
 */

const { exec, spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const dns = require('dns');
const { promisify } = require('util');
const os = require('os');
const path = require('path');

class SystemBrowserMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isMonitoring = false;
    this.browserConnections = new Map();
    this.capturedRequests = [];
    this.capturedResponses = [];
    this.dnsLookup = promisify(dns.lookup);
    this.stats = {
      totalRequests: 0,
      totalResponses: 0,
      threatsDetected: 0,
      browsersConnected: 0,
      startTime: null
    };
    
    // Browser configurations with debug ports
    this.browserConfigs = {
      chrome: {
        name: 'Google Chrome',
        debugPort: 9222,
        macPath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        winPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        linuxPath: '/usr/bin/google-chrome'
      },
      brave: {
        name: 'Brave',
        debugPort: 9223,
        macPath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        winPath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        linuxPath: '/usr/bin/brave-browser'
      },
      edge: {
        name: 'Microsoft Edge',
        debugPort: 9224,
        macPath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        winPath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        linuxPath: '/usr/bin/microsoft-edge'
      },
      chromium: {
        name: 'Chromium',
        debugPort: 9225,
        macPath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
        winPath: 'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        linuxPath: '/usr/bin/chromium-browser'
      },
      arc: {
        name: 'Arc',
        debugPort: 9226,
        macPath: '/Applications/Arc.app/Contents/MacOS/Arc'
      },
      opera: {
        name: 'Opera',
        debugPort: 9227,
        macPath: '/Applications/Opera.app/Contents/MacOS/Opera',
        winPath: 'C:\\Program Files\\Opera\\opera.exe',
        linuxPath: '/usr/bin/opera'
      }
    };
  }

  /**
   * Start monitoring all detected browsers
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ System monitor already running');
      return { success: true, browsersConnected: this.browserConnections.size };
    }

    console.log('🚀 Starting system-wide browser monitoring...');
    this.isMonitoring = true;
    this.stats.startTime = new Date();

    // Detect and connect to running browsers
    const runningBrowsers = await this.detectRunningBrowsers();
    console.log(`📍 Detected ${runningBrowsers.length} running browsers with debug ports`);

    // Connect to each browser and wait for connections
    for (const browser of runningBrowsers) {
      await this.connectToBrowser(browser);
    }

    const connectedCount = this.browserConnections.size;
    console.log(`🌐 System monitor started: ${connectedCount} browsers connected`);

    // Start polling for new browser instances
    this.browserPollInterval = setInterval(async () => {
      await this.pollForNewBrowsers();
    }, 5000);

    this.sendToRenderer('system-monitor-status', {
      status: 'running',
      browsersConnected: connectedCount,
      startTime: this.stats.startTime
    });

    return {
      success: true,
      browsersConnected: connectedCount
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    console.log('🛑 Stopping system-wide browser monitoring...');
    this.isMonitoring = false;

    if (this.browserPollInterval) {
      clearInterval(this.browserPollInterval);
    }

    // Close all WebSocket connections
    for (const [key, connection] of this.browserConnections) {
      try {
        connection.ws.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    this.browserConnections.clear();

    this.sendToRenderer('system-monitor-status', {
      status: 'stopped',
      browsersConnected: 0
    });
  }

  /**
   * Detect running Chromium-based browsers
   */
  async detectRunningBrowsers() {
    const platform = os.platform();
    const runningBrowsers = [];

    for (const [key, config] of Object.entries(this.browserConfigs)) {
      try {
        // Check if browser is running with debug port
        const isRunning = await this.checkDebugPort(config.debugPort);
        
        if (isRunning) {
          runningBrowsers.push({
            id: key,
            ...config,
            status: 'running'
          });
          console.log(`✅ Found ${config.name} with debug port ${config.debugPort}`);
        }
      } catch (error) {
        // Browser not running with debug port
      }
    }

    return runningBrowsers;
  }

  /**
   * Check if a debug port is active
   */
  async checkDebugPort(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            JSON.parse(data);
            resolve(true);
          } catch {
            resolve(false);
          }
        });
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Poll for newly opened browser instances
   */
  async pollForNewBrowsers() {
    if (!this.isMonitoring) return;

    const runningBrowsers = await this.detectRunningBrowsers();
    
    for (const browser of runningBrowsers) {
      const connectionKey = `${browser.id}-main`;
      if (!this.browserConnections.has(connectionKey)) {
        console.log(`🔍 New browser detected: ${browser.name}`);
        await this.connectToBrowser(browser);
      }
    }
  }

  /**
   * Connect to a browser via Chrome DevTools Protocol
   */
  async connectToBrowser(browser) {
    try {
      const debugUrl = `http://127.0.0.1:${browser.debugPort}`;
      
      // Get list of available targets (tabs, extensions, etc.)
      const response = await this.fetchJSON(`${debugUrl}/json/list`);
      
      if (!response || response.length === 0) {
        console.log(`⚠️ No targets found for ${browser.name}`);
        return;
      }

      // Connect to page targets
      let connectedTabs = 0;
      for (const target of response) {
        if (target.type === 'page' && target.webSocketDebuggerUrl) {
          await this.connectToTarget(browser, target);
          connectedTabs++;
        }
      }

      this.stats.browsersConnected++;
      console.log(`✅ Connected to ${browser.name} with ${connectedTabs} tabs`);

      this.sendToRenderer('browser-connected', {
        browser: browser.name,
        tabs: connectedTabs,
        debugPort: browser.debugPort
      });

    } catch (error) {
      console.error(`❌ Failed to connect to ${browser.name}:`, error.message);
    }
  }

  /**
   * Connect to a specific browser target (tab)
   */
  async connectToTarget(browser, target) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const connectionKey = `${browser.id}-${target.id}`;
        let messageId = 1;

        ws.on('open', () => {
          console.log(`📡 Connected to tab: ${target.title?.substring(0, 50)}...`);

          // Enable Network domain to capture requests
          ws.send(JSON.stringify({ id: messageId++, method: 'Network.enable' }));
          
          // Enable Page domain for navigation events
          ws.send(JSON.stringify({ id: messageId++, method: 'Page.enable' }));
          
          // Enable Security domain
          ws.send(JSON.stringify({ id: messageId++, method: 'Security.enable' }));

          this.browserConnections.set(connectionKey, {
            ws,
            browser,
            target,
            messageId
          });

          resolve();
        });

        ws.on('message', (data) => {
          this.handleCDPMessage(browser, target, JSON.parse(data.toString()));
        });

        ws.on('close', () => {
          console.log(`🔌 Disconnected from tab: ${target.title?.substring(0, 30)}...`);
          this.browserConnections.delete(connectionKey);
          this.updateStats();
        });

        ws.on('error', (error) => {
          console.error(`WebSocket error for ${target.title}:`, error.message);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle Chrome DevTools Protocol messages
   */
  handleCDPMessage(browser, target, message) {
    if (!message.method) return;

    switch (message.method) {
      case 'Network.requestWillBeSent':
        this.handleRequest(browser, target, message.params);
        break;
      
      case 'Network.responseReceived':
        this.handleResponse(browser, target, message.params);
        break;
      
      case 'Network.loadingFailed':
        this.handleLoadingFailed(browser, target, message.params);
        break;
      
      case 'Page.frameNavigated':
        this.handleNavigation(browser, target, message.params);
        break;
      
      case 'Security.securityStateChanged':
        this.handleSecurityChange(browser, target, message.params);
        break;
    }
  }

  /**
   * Handle outgoing HTTP request
   */
  async handleRequest(browser, target, params) {
    const { request, requestId, timestamp, initiator, type } = params;
    
    try {
      const url = new URL(request.url);
      
      // Skip chrome-extension and devtools URLs
      if (url.protocol === 'chrome-extension:' || url.protocol === 'devtools:') {
        return;
      }

      const requestData = {
        id: requestId,
        browser: browser.name,
        tabTitle: target.title,
        url: request.url,
        method: request.method,
        hostname: url.hostname,
        path: url.pathname,
        query: url.search,
        protocol: url.protocol.replace(':', ''),
        headers: request.headers,
        postData: request.postData,
        timestamp: new Date(timestamp * 1000).toISOString(),
        resourceType: type,
        initiator: initiator?.type || 'unknown'
      };

      this.capturedRequests.push(requestData);
      this.stats.totalRequests++;

      // Keep only last 500 requests in memory
      if (this.capturedRequests.length > 500) {
        this.capturedRequests = this.capturedRequests.slice(-500);
      }

      // Send to renderer
      this.sendToRenderer('browser-request', requestData);

      // Perform threat analysis
      await this.analyzeRequest(requestData);

    } catch (error) {
      // Invalid URL, skip
    }
  }

  /**
   * Handle HTTP response
   */
  async handleResponse(browser, target, params) {
    const { response, requestId, timestamp, type } = params;
    
    try {
      const url = new URL(response.url);
      
      // Skip chrome-extension and devtools URLs
      if (url.protocol === 'chrome-extension:' || url.protocol === 'devtools:') {
        return;
      }

      const responseData = {
        id: requestId,
        browser: browser.name,
        tabTitle: target.title,
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        hostname: url.hostname,
        mimeType: response.mimeType,
        headers: response.headers,
        securityState: response.securityState,
        securityDetails: response.securityDetails,
        timestamp: new Date(timestamp * 1000).toISOString(),
        resourceType: type,
        fromCache: response.fromDiskCache || response.fromServiceWorker
      };

      this.capturedResponses.push(responseData);
      this.stats.totalResponses++;

      // Keep only last 500 responses
      if (this.capturedResponses.length > 500) {
        this.capturedResponses = this.capturedResponses.slice(-500);
      }

      // Send to renderer
      this.sendToRenderer('browser-response', responseData);

      // Perform security analysis
      await this.analyzeResponse(responseData);

    } catch (error) {
      // Invalid URL, skip
    }
  }

  /**
   * Handle page navigation
   */
  handleNavigation(browser, target, params) {
    const frame = params.frame;
    if (frame.parentId) return; // Only main frame

    const navigationData = {
      browser: browser.name,
      url: frame.url,
      title: frame.name || target.title,
      securityOrigin: frame.securityOrigin,
      timestamp: new Date().toISOString()
    };

    this.sendToRenderer('browser-navigation', navigationData);
  }

  /**
   * Handle loading failures
   */
  handleLoadingFailed(browser, target, params) {
    const { requestId, errorText, canceled, blockedReason } = params;

    if (blockedReason) {
      this.sendToRenderer('request-blocked', {
        browser: browser.name,
        requestId,
        reason: blockedReason,
        errorText
      });
    }
  }

  /**
   * Handle security state changes
   */
  handleSecurityChange(browser, target, params) {
    const { securityState, explanations } = params;

    if (securityState === 'insecure' || securityState === 'dangerous') {
      this.sendToRenderer('security-warning', {
        browser: browser.name,
        tabTitle: target.title,
        securityState,
        explanations,
        timestamp: new Date().toISOString()
      });

      this.stats.threatsDetected++;
    }
  }

  /**
   * Analyze request for threats
   */
  async analyzeRequest(request) {
    const threats = [];

    // Check for suspicious URLs
    const suspiciousPatterns = [
      /phishing/i, /malware/i, /hack/i, /exploit/i,
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP address
      /data:/i, /javascript:/i // Data URIs
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(request.url)) {
        threats.push({
          type: 'suspicious_url',
          pattern: pattern.toString(),
          severity: 'medium'
        });
      }
    }

    // Check for sensitive data in URLs
    const sensitivePatterns = [
      /password/i, /token/i, /api_key/i, /secret/i,
      /credit.?card/i, /ssn/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(request.url) || pattern.test(request.query || '')) {
        threats.push({
          type: 'sensitive_data_exposure',
          pattern: pattern.toString(),
          severity: 'high'
        });
      }
    }

    if (threats.length > 0) {
      this.stats.threatsDetected += threats.length;
      
      this.sendToRenderer('threat-detected', {
        request,
        threats,
        timestamp: new Date().toISOString()
      });
    }

    return threats;
  }

  /**
   * Analyze response for threats
   */
  async analyzeResponse(response) {
    const threats = [];

    // Check for insecure protocol
    if (response.url.startsWith('http://') && !response.hostname.includes('localhost')) {
      threats.push({
        type: 'insecure_protocol',
        message: 'Data transmitted over unencrypted HTTP',
        severity: 'medium'
      });
    }

    // Check security headers
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'content-security-policy'
    ];

    const missingHeaders = securityHeaders.filter(
      header => !response.headers?.[header]
    );

    if (missingHeaders.length > 2) {
      threats.push({
        type: 'missing_security_headers',
        missingHeaders,
        severity: 'low'
      });
    }

    // Check for error responses that might leak info
    if (response.status >= 500) {
      threats.push({
        type: 'server_error',
        message: 'Server error may expose sensitive information',
        severity: 'low'
      });
    }

    if (threats.length > 0) {
      this.stats.threatsDetected += threats.length;
      
      this.sendToRenderer('threat-detected', {
        response,
        threats,
        timestamp: new Date().toISOString()
      });
    }

    return threats;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      browsersConnected: this.browserConnections.size,
      requestsCaptured: this.capturedRequests.length,
      responsesCaptured: this.capturedResponses.length,
      uptime: this.stats.startTime 
        ? Math.floor((Date.now() - this.stats.startTime) / 1000)
        : 0
    };
  }

  /**
   * Get recent requests
   */
  getRecentRequests(limit = 50) {
    return this.capturedRequests.slice(-limit);
  }

  /**
   * Get recent responses
   */
  getRecentResponses(limit = 50) {
    return this.capturedResponses.slice(-limit);
  }

  /**
   * Helper: Fetch JSON from URL
   */
  async fetchJSON(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Helper: Send message to renderer
   */
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Update stats and notify renderer
   */
  updateStats() {
    this.sendToRenderer('system-monitor-stats', this.getStats());
  }

  /**
   * Launch a browser with remote debugging enabled
   */
  async launchBrowserWithDebugging(browserKey = 'chrome') {
    const config = this.browserConfigs[browserKey];
    if (!config) {
      throw new Error(`Unknown browser: ${browserKey}`);
    }

    const platform = os.platform();
    let browserPath;

    if (platform === 'darwin') {
      browserPath = config.macPath;
    } else if (platform === 'win32') {
      browserPath = config.winPath;
    } else {
      browserPath = config.linuxPath;
    }

    // Check if browser exists
    const fs = require('fs');
    if (!fs.existsSync(browserPath)) {
      throw new Error(`Browser not found at: ${browserPath}`);
    }

    // Create a unique user data directory to avoid conflicts
    const userDataDir = path.join(os.tmpdir(), `cyberforge-${browserKey}-${Date.now()}`);

    const args = [
      `--remote-debugging-port=${config.debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check'
    ];

    console.log(`🚀 Launching ${config.name} with debugging on port ${config.debugPort}...`);

    return new Promise((resolve, reject) => {
      let browserProcess;
      
      if (platform === 'darwin') {
        // On macOS, use 'open' command with args
        browserProcess = spawn('open', ['-a', browserPath, '--args', ...args], {
          detached: true,
          stdio: 'ignore'
        });
      } else {
        browserProcess = spawn(browserPath, args, {
          detached: true,
          stdio: 'ignore'
        });
      }

      browserProcess.unref();

      // Wait for browser to start and debug port to be available
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkPort = async () => {
        attempts++;
        const isReady = await this.checkDebugPort(config.debugPort);
        
        if (isReady) {
          console.log(`✅ ${config.name} is ready on port ${config.debugPort}`);
          
          // Connect to the browser
          await this.connectToBrowser({
            id: browserKey,
            ...config,
            status: 'running'
          });
          
          resolve({
            success: true,
            browser: config.name,
            port: config.debugPort
          });
        } else if (attempts < maxAttempts) {
          setTimeout(checkPort, 500);
        } else {
          reject(new Error(`Timeout waiting for ${config.name} to start`));
        }
      };

      // Start checking after a short delay
      setTimeout(checkPort, 1000);
    });
  }

  /**
   * Get list of available browsers on the system
   */
  getAvailableBrowsers() {
    const platform = os.platform();
    const fs = require('fs');
    const available = [];

    for (const [key, config] of Object.entries(this.browserConfigs)) {
      let browserPath;
      if (platform === 'darwin') {
        browserPath = config.macPath;
      } else if (platform === 'win32') {
        browserPath = config.winPath;
      } else {
        browserPath = config.linuxPath;
      }

      if (browserPath && fs.existsSync(browserPath)) {
        available.push({
          id: key,
          name: config.name,
          path: browserPath,
          debugPort: config.debugPort
        });
      }
    }

    return available;
  }
}

/**
 * Setup function for the system monitor
 */
function setupSystemBrowserMonitoring(mainWindow) {
  const monitor = new SystemBrowserMonitor(mainWindow);
  return monitor;
}

module.exports = {
  SystemBrowserMonitor,
  setupSystemBrowserMonitoring
};
