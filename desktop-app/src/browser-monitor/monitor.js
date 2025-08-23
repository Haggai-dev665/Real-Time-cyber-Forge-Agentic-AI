const { session } = require('electron');

class BrowserMonitor {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.visitedPages = [];
    this.isMonitoring = false;
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Monitor all web requests
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (this.isMonitoring && details.resourceType === 'mainFrame') {
        this.handlePageVisit(details);
      }
      callback({});
    });

    // Monitor completed requests for analysis
    session.defaultSession.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      if (this.isMonitoring && details.resourceType === 'mainFrame') {
        this.analyzePageLoad(details);
      }
    });

    console.log('Browser monitoring initialized');
  }

  handlePageVisit(details) {
    const pageData = {
      url: details.url,
      timestamp: new Date().toISOString(),
      method: details.method,
      resourceType: details.resourceType,
      referrer: details.referrer || null
    };

    this.visitedPages.push(pageData);
    
    // Keep only last 1000 visits to prevent memory issues
    if (this.visitedPages.length > 1000) {
      this.visitedPages = this.visitedPages.slice(-1000);
    }

    // Send to renderer for display
    this.mainWindow.webContents.send('page-visited', pageData);
    
    console.log(`Page visited: ${details.url}`);
  }

  analyzePageLoad(details) {
    const analysisData = {
      url: details.url,
      statusCode: details.statusCode,
      timestamp: new Date().toISOString(),
      responseHeaders: details.responseHeaders,
      fromCache: details.fromCache || false
    };

    // Perform basic security checks
    const securityAnalysis = this.performSecurityAnalysis(analysisData);
    
    if (securityAnalysis.hasWarnings) {
      this.mainWindow.webContents.send('security-warning', {
        url: details.url,
        warnings: securityAnalysis.warnings
      });
    }

    // Send analysis data to backend for ML processing
    this.mainWindow.webContents.send('analysis-data', {
      ...analysisData,
      security: securityAnalysis
    });
  }

  performSecurityAnalysis(data) {
    const warnings = [];
    const url = new URL(data.url);

    // Check for insecure protocols
    if (url.protocol === 'http:' && !url.hostname.includes('localhost')) {
      warnings.push({
        type: 'insecure_protocol',
        message: 'Page loaded over insecure HTTP protocol',
        severity: 'medium'
      });
    }

    // Check for suspicious domains
    const suspiciousDomains = ['malware', 'phishing', 'suspicious'];
    if (suspiciousDomains.some(keyword => url.hostname.includes(keyword))) {
      warnings.push({
        type: 'suspicious_domain',
        message: 'Domain contains suspicious keywords',
        severity: 'high'
      });
    }

    // Check response headers for security indicators
    if (data.responseHeaders) {
      const headers = this.flattenHeaders(data.responseHeaders);
      
      if (!headers['strict-transport-security']) {
        warnings.push({
          type: 'missing_hsts',
          message: 'Missing HTTP Strict Transport Security header',
          severity: 'low'
        });
      }

      if (!headers['x-frame-options'] && !headers['frame-options']) {
        warnings.push({
          type: 'missing_frame_protection',
          message: 'Missing clickjacking protection headers',
          severity: 'medium'
        });
      }
    }

    return {
      hasWarnings: warnings.length > 0,
      warnings: warnings,
      riskScore: this.calculateRiskScore(warnings)
    };
  }

  flattenHeaders(headers) {
    const flattened = {};
    for (const [key, values] of Object.entries(headers)) {
      flattened[key.toLowerCase()] = Array.isArray(values) ? values.join(', ') : values;
    }
    return flattened;
  }

  calculateRiskScore(warnings) {
    let score = 0;
    warnings.forEach(warning => {
      switch (warning.severity) {
        case 'high': score += 30; break;
        case 'medium': score += 20; break;
        case 'low': score += 10; break;
      }
    });
    return Math.min(score, 100);
  }

  startMonitoring() {
    this.isMonitoring = true;
    console.log('Browser monitoring started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('Browser monitoring stopped');
  }

  getAnalysisData() {
    return {
      visitedPages: this.visitedPages,
      totalVisits: this.visitedPages.length,
      isMonitoring: this.isMonitoring
    };
  }
}

function setupBrowserMonitoring(mainWindow) {
  const monitor = new BrowserMonitor(mainWindow);
  monitor.startMonitoring();
  return monitor;
}

module.exports = { setupBrowserMonitoring, BrowserMonitor };