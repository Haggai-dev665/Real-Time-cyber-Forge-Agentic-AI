const { session } = require('electron');
const WebSocket = require('ws');
const dns = require('dns');
const { promisify } = require('util');

class EnhancedBrowserMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.visitedPages = [];
    this.isMonitoring = false;
    this.browserConnections = new Map();
    this.selectedBrowsers = [];
    this.dnsLookup = promisify(dns.lookup);
  }

  async setupBrowserMonitoring(browsers) {
    this.selectedBrowsers = browsers;
    
    for (const browser of browsers) {
      try {
        await this.connectToBrowser(browser);
      } catch (error) {
        console.error(`Failed to connect to ${browser.name}:`, error);
      }
    }
  }

  async connectToBrowser(browser) {
    try {
      const debugUrl = `http://localhost:${browser.debugPort}`;
      
      // Get list of tabs
      const response = await fetch(`${debugUrl}/json`);
      const tabs = await response.json();
      
      for (const tab of tabs) {
        if (tab.webSocketDebuggerUrl) {
          await this.connectToTab(browser, tab);
        }
      }
    } catch (error) {
      console.error(`Error connecting to ${browser.name}:`, error);
    }
  }

  async connectToTab(browser, tab) {
    try {
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      
      ws.on('open', () => {
        console.log(`Connected to ${browser.name} tab: ${tab.title}`);
        
        // Enable necessary domains
        ws.send(JSON.stringify({
          id: 1,
          method: 'Page.enable'
        }));
        
        ws.send(JSON.stringify({
          id: 2,
          method: 'Network.enable'
        }));
        
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.enable'
        }));
      });
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleBrowserEvent(browser, message);
        } catch (error) {
          console.error('Error handling browser event:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${browser.name}:`, error);
      });
      
      this.browserConnections.set(`${browser.name}-${tab.id}`, ws);
    } catch (error) {
      console.error(`Error connecting to tab ${tab.id}:`, error);
    }
  }

  async handleBrowserEvent(browser, message) {
    if (message.method === 'Page.frameNavigated') {
      await this.handlePageNavigation(browser, message.params);
    } else if (message.method === 'Network.responseReceived') {
      await this.handleNetworkResponse(browser, message.params);
    } else if (message.method === 'Network.requestWillBeSent') {
      await this.handleNetworkRequest(browser, message.params);
    }
  }

  async handlePageNavigation(browser, params) {
    const frame = params.frame;
    if (frame.parentId) return; // Only handle main frame navigations
    
    try {
      const url = new URL(frame.url);
      const ipAddress = await this.getIPAddress(url.hostname);
      
      const pageData = {
        id: Date.now(),
        browser: browser.name,
        url: frame.url,
        hostname: url.hostname,
        protocol: url.protocol,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        ipAddress: ipAddress,
        timestamp: new Date().toISOString(),
        title: frame.name || 'Loading...',
        securityState: frame.securityState || 'unknown',
        loaderId: frame.loaderId
      };
      
      this.visitedPages.push(pageData);
      
      // Keep only last 1000 visits
      if (this.visitedPages.length > 1000) {
        this.visitedPages = this.visitedPages.slice(-1000);
      }
      
      // Send enhanced data to renderer
      this.mainWindow.webContents.send('enhanced-page-visited', pageData);
      
      console.log(`Enhanced page visit: ${frame.url} [${ipAddress}] in ${browser.name}`);
    } catch (error) {
      console.error('Error handling page navigation:', error);
    }
  }

  async handleNetworkResponse(browser, params) {
    try {
      const response = params.response;
      const url = new URL(response.url);
      
      const responseData = {
        id: params.requestId,
        browser: browser.name,
        url: response.url,
        hostname: url.hostname,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        mimeType: response.mimeType,
        timing: response.timing,
        securityDetails: response.securityDetails,
        timestamp: new Date().toISOString()
      };
      
      // Send network response data
      this.mainWindow.webContents.send('network-response-data', responseData);
      
      // Perform security analysis
      const securityAnalysis = await this.performEnhancedSecurityAnalysis(responseData);
      
      if (securityAnalysis.hasWarnings) {
        this.mainWindow.webContents.send('security-warning', {
          browser: browser.name,
          url: response.url,
          warnings: securityAnalysis.warnings,
          riskScore: securityAnalysis.riskScore
        });
      }
    } catch (error) {
      console.error('Error handling network response:', error);
    }
  }

  async handleNetworkRequest(browser, params) {
    try {
      const request = params.request;
      const url = new URL(request.url);
      
      const requestData = {
        id: params.requestId,
        browser: browser.name,
        url: request.url,
        method: request.method,
        headers: request.headers,
        timestamp: new Date().toISOString(),
        initiator: params.initiator
      };
      
      this.mainWindow.webContents.send('network-request-data', requestData);
    } catch (error) {
      console.error('Error handling network request:', error);
    }
  }

  async getIPAddress(hostname) {
    try {
      const result = await this.dnsLookup(hostname);
      return result.address;
    } catch (error) {
      console.error(`DNS lookup failed for ${hostname}:`, error);
      return 'Unable to resolve';
    }
  }

  async performEnhancedSecurityAnalysis(responseData) {
    const warnings = [];
    let riskScore = 0;
    
    try {
      const url = new URL(responseData.url);
      const headers = responseData.headers || {};
      
      // Protocol security check
      if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
        warnings.push({
          type: 'insecure_protocol',
          message: 'Insecure HTTP protocol detected',
          severity: 'medium',
          details: 'Data transmitted over HTTP is not encrypted'
        });
        riskScore += 30;
      }
      
      // Security headers analysis
      const securityHeaders = {
        'strict-transport-security': 'HSTS header missing',
        'content-security-policy': 'CSP header missing',
        'x-frame-options': 'X-Frame-Options header missing',
        'x-content-type-options': 'X-Content-Type-Options header missing',
        'referrer-policy': 'Referrer-Policy header missing'
      };
      
      for (const [header, message] of Object.entries(securityHeaders)) {
        if (!headers[header] && !headers[header.toLowerCase()]) {
          warnings.push({
            type: 'missing_security_header',
            message: message,
            severity: 'low',
            details: `Security header ${header} is not present`
          });
          riskScore += 5;
        }
      }
      
      // Suspicious domain patterns
      const suspiciousPatterns = [
        'malware', 'phishing', 'suspicious', 'fake', 'scam',
        'temporary', 'bit.ly', 'tinyurl', 'short.link'
      ];
      
      if (suspiciousPatterns.some(pattern => url.hostname.includes(pattern))) {
        warnings.push({
          type: 'suspicious_domain',
          message: 'Potentially suspicious domain detected',
          severity: 'high',
          details: 'Domain contains keywords associated with malicious activity'
        });
        riskScore += 50;
      }
      
      // SSL/TLS certificate analysis
      if (responseData.securityDetails) {
        const securityDetails = responseData.securityDetails;
        
        if (securityDetails.certificateHasWeakSignature) {
          warnings.push({
            type: 'weak_certificate',
            message: 'Weak certificate signature detected',
            severity: 'medium',
            details: 'SSL certificate uses weak cryptographic signature'
          });
          riskScore += 25;
        }
        
        if (securityDetails.modernSSL === false) {
          warnings.push({
            type: 'outdated_ssl',
            message: 'Outdated SSL/TLS configuration',
            severity: 'medium',
            details: 'Website uses outdated SSL/TLS protocols'
          });
          riskScore += 20;
        }
      }
      
      // Response status analysis
      if (responseData.status >= 400) {
        warnings.push({
          type: 'http_error',
          message: `HTTP error status: ${responseData.status}`,
          severity: 'low',
          details: `Server returned error status: ${responseData.statusText}`
        });
        riskScore += 10;
      }
      
    } catch (error) {
      console.error('Error in security analysis:', error);
    }
    
    return {
      hasWarnings: warnings.length > 0,
      warnings: warnings,
      riskScore: Math.min(riskScore, 100),
      timestamp: new Date().toISOString()
    };
  }

  startMonitoring() {
    this.isMonitoring = true;
    console.log('Enhanced browser monitoring started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    
    // Close all browser connections
    for (const [key, ws] of this.browserConnections) {
      try {
        ws.close();
      } catch (error) {
        console.error(`Error closing connection ${key}:`, error);
      }
    }
    
    this.browserConnections.clear();
    console.log('Enhanced browser monitoring stopped');
  }

  getMonitoringData() {
    return {
      visitedPages: this.visitedPages,
      totalVisits: this.visitedPages.length,
      isMonitoring: this.isMonitoring,
      selectedBrowsers: this.selectedBrowsers.map(b => b.name),
      connectionCount: this.browserConnections.size
    };
  }
}

function setupEnhancedBrowserMonitoring(mainWindow) {
  const monitor = new EnhancedBrowserMonitor(mainWindow);
  return monitor;
}

module.exports = { setupEnhancedBrowserMonitoring, EnhancedBrowserMonitor };