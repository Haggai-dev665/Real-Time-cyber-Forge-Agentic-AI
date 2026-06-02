// Browser Intelligence / URL Monitoring Utility
// Extracted from cyberforge-app.js — all browser monitoring, URL scanning,
// behavioral alerting, and system-monitor integration logic.

(() => {
  'use strict';

  // ── API client proxy (same resilient pattern as main app) ────────────
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[BrowserIntel] Could not require api-client.js, falling back to window API:', error?.message || error);
    }
  }

  function resolveAPIClient() {
    return importedAPI || window.cyberforgeAPI || window.apiClient || null;
  }

  const cyberforgeAPI = new Proxy({}, {
    get(_target, prop) {
      const api = resolveAPIClient();
      const value = api?.[prop];
      if (typeof value === 'function') {
        return value.bind(api);
      }
      return value;
    }
  });

  // ── Toast wrapper ────────────────────────────────────────────────────
  function showToast(type, title, message) {
    if (window.CyberForgeToast?.showToast) {
      window.CyberForgeToast.showToast(type, title, message);
    }
  }

  // ── Shared helper: access main-app state via window ──────────────────
  function _state() {
    return window.CyberForgeApp?.state;
  }

  // ── Delegate helpers (remain in cyberforge-app; call via window) ──────
  function appendAgentConsole(message, level) {
    if (typeof window.CyberForgeApp?.appendAgentConsole === 'function') {
      window.CyberForgeApp.appendAgentConsole(message, level);
    }
  }

  function logAgentAction(text, type) {
    if (typeof window.CyberForgeApp?.logAgentAction === 'function') {
      window.CyberForgeApp.logAgentAction(text, type);
    }
  }

  function addEvent(severity, title, description, source) {
    if (typeof window.CyberForgeApp?.addEvent === 'function') {
      window.CyberForgeApp.addEvent(severity, title, description, source);
    }
  }

  function setAgentState(newStatus) {
    if (typeof window.CyberForgeApp?.setAgentState === 'function') {
      window.CyberForgeApp.setAgentState(newStatus);
    }
  }

  function updateHeaderStats() {
    if (typeof window.CyberForgeApp?.updateHeaderStats === 'function') {
      window.CyberForgeApp.updateHeaderStats();
    }
  }

  function _renderIntelAlertsList(container) {
    if (typeof window.CyberForgeApp?._renderIntelAlertsList === 'function') {
      window.CyberForgeApp._renderIntelAlertsList(container);
    }
  }

  function resolveCurrentUserId() {
    const user = cyberforgeAPI.getCurrentUser?.() || {};
    return user.id || user._id || user.$id || user.userId || 'desktop-user';
  }

  // ══════════════════════════════════════════════════════════════════════
  // URL MONITORING STATE
  // ══════════════════════════════════════════════════════════════════════

  let _urlMonitorPollingId = null;
  const _seenUrls = new Set();          // Track already-processed URLs this session
  const _urlScanHistory = [];           // Last 100 scanned URLs for UI display
  const URL_MONITOR_INTERVAL = 5000;    // Check every 5 seconds
  const MAX_SCAN_HISTORY = 100;

  // ══════════════════════════════════════════════════════════════════════
  // BROWSER INTELLIGENCE ENGINE STATE
  // ══════════════════════════════════════════════════════════════════════

  const _intelState = {
    sessions: [],
    alerts: [],
    totalDomains: 0,
    totalAlerts: 0,
    averageRisk: 0,
    pollerId: null
  };

  // ══════════════════════════════════════════════════════════════════════
  // SYSTEM BROWSER MONITOR STATE
  // ══════════════════════════════════════════════════════════════════════

  const systemMonitorState = {
    isConnected: false,
    connectedBrowsers: [],
    requestCount: 0,
    threatCount: 0,
    startTime: null,
    recentRequests: []
  };

  const agentState = {
    get status() { return _state()?.status; },
    get memory() { return _state()?.memory || {}; },
    set status(v) { if (_state()) _state().status = v; },
  };

  // Store for console logs
  const browserConsoleLogs = [];
  const MAX_CONSOLE_LOGS = 200;

  // ══════════════════════════════════════════════════════════════════════
  // URL MONITORING FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Start real-time URL monitoring.
   * Polls the Tauri bridge for active browser tab URLs, and for each new URL:
   *   1. Logs it in the Agent Center console
   *   2. Creates a web_scan task on the backend
   *   3. Tracks it for duplicate suppression
   */
  function startUrlMonitoring() {
    stopUrlMonitoring();
    console.log('[URLMonitor] Starting real-time URL monitoring...');
    appendAgentConsole('URL monitoring started — scanning active browser tabs every 5s', 'info');
    // Log to floating panel too
    if (window.CyberForgeAgentUI?.fpLog) {
      window.CyberForgeAgentUI.fpLog('URL monitor active');
    }
    // Start intelligence snapshot push to backend
    _startIntelligenceSnapshotPush();
    // Update the URL monitor status badge
    const badge = document.getElementById('url-monitor-status');
    if (badge) {
      badge.textContent = 'Monitoring';
      badge.classList.add('active');
    }

    // Do an immediate first scan
    _pollActiveUrls();

    _urlMonitorPollingId = setInterval(_pollActiveUrls, URL_MONITOR_INTERVAL);
  }

  function stopUrlMonitoring() {
    if (_urlMonitorPollingId) {
      clearInterval(_urlMonitorPollingId);
      _urlMonitorPollingId = null;
      console.log('[URLMonitor] Stopped');
      const badge = document.getElementById('url-monitor-status');
      if (badge) {
        badge.textContent = 'Stopped';
        badge.classList.remove('active');
      }
      if (window.CyberForgeAgentUI?.fpLog) {
        window.CyberForgeAgentUI.fpLog('URL monitor stopped');
      }
    }
  }

  async function _pollActiveUrls() {
    try {
      // Try Tauri bridge first, then systemMonitor fallback
      const getUrls = window.electronAPI?.getActiveBrowserUrls
        || window.electronAPI?.systemMonitor?.getActiveBrowserUrls;
      if (!getUrls) return;

      const result = await getUrls();
      const tabs = result?.tabs || [];

      for (const tab of tabs) {
        if (!tab.url || tab.url === 'firefox-active-tab' || tab.url === 'linux-active-window') {
          // Can't auto-scan without a real URL — but log the activity
          if (tab.title && !_seenUrls.has(`title:${tab.title}`)) {
            _seenUrls.add(`title:${tab.title}`);
            appendAgentConsole(`🔍 [${tab.browser}] Active: ${tab.title}`, 'info');
            _updateLiveUrlFeed(tab.browser, tab.title, '', 'detected');
          }
          continue;
        }

        // Normalise URL for dedup (strip trailing slash, fragment)
        const normUrl = _normaliseUrl(tab.url);
        if (_seenUrls.has(normUrl)) continue;
        _seenUrls.add(normUrl);

        // ── Feed URL to Browser Intelligence Engine (Rust) ───────────
        try {
          const processIntel = window.electronAPI?.processBrowserIntelligence;
          if (processIntel) {
            const intelResult = await processIntel(
              tab.browser || 'unknown',
              tab.browserKey || tab.browser || 'unknown',
              tab.url,
              tab.title || ''
            );
            // If any behavioral alerts were generated, handle them
            if (intelResult && Array.isArray(intelResult) && intelResult.length > 0) {
              for (const alert of intelResult) {
                _handleBehavioralAlert(alert);
              }
            }
          }
        } catch (intelErr) {
          console.debug('[BrowserIntel] Process error:', intelErr.message);
        }

        // Log in the Agent Center console
        const shortUrl = tab.url.length > 80 ? tab.url.substring(0, 77) + '...' : tab.url;
        appendAgentConsole(`🌐 [${tab.browser}] Navigated to: ${shortUrl}`, 'info');

        // Log to the floating panel activity log
        if (window.CyberForgeAgentUI?.fpLog) {
          window.CyberForgeAgentUI.fpLog(`🌐 ${tab.browser}: ${tab.url.length > 50 ? tab.url.substring(0, 47) + '...' : tab.url}`);
        }

        // Update the live URL feed in the Agent Center UI
        _updateLiveUrlFeed(tab.browser, tab.title || shortUrl, tab.url, 'scanning');

        // Auto-create a scan task on the backend
        _autoCreateScanTask(tab).catch(err => {
          console.warn('[URLMonitor] Task creation failed:', err.message);
        });
      }
    } catch (err) {
      // Silently ignore — this runs every 5s, don't spam errors
      console.debug('[URLMonitor] Poll error:', err.message);
    }
  }

  function _normaliseUrl(url) {
    try {
      const u = new URL(url);
      // Remove fragment and normalize trailing slash
      u.hash = '';
      let path = u.pathname.replace(/\/+$/, '') || '/';
      return `${u.protocol}//${u.host}${path}${u.search}`;
    } catch {
      return url;
    }
  }

  async function _autoCreateScanTask(tab) {
    const userId = resolveCurrentUserId();
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    let agentId = localStorage.getItem('cyberforge_agent_id') || 'default';

    // ── Call the real-time scan endpoint ──────────────────────────────
    // This runs: webscrapper → analysis → ML classification → Gemini → results
    const payload = {
      url: tab.url,
      browser: tab.browserKey || tab.browser,
      pageTitle: tab.title || '',
      userId,
      agentId
    };

    appendAgentConsole(`⏳ Scanning ${tab.url.substring(0, 60)}...`, 'info');

    const response = await fetch(`${backendUrl}/api/agent/scan-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000) // 90s — scraping can be slow
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const scanData = result?.data;

    if (!scanData) {
      appendAgentConsole(`⚠️ No scan data returned for ${tab.url.substring(0, 50)}`, 'warning');
      return result;
    }

    // ── Process scan results ─────────────────────────────────────────
    const riskScore = scanData.riskScore || 0;
    const category = scanData.category || 'unknown';
    const riskLevel = scanData.riskLevel || 'unknown';
    const confidence = Math.round((scanData.confidence || 0) * 100);

    // ── Feed ML risk score into Browser Intelligence Engine ───────
    try {
      const feedRisk = window.electronAPI?.feedIntelligenceMlRisk;
      if (feedRisk && riskScore > 0) {
        await feedRisk(tab.browserKey || tab.browser || 'unknown', riskScore);
      }
    } catch (feedErr) {
      console.debug('[BrowserIntel] ML risk feed error:', feedErr.message);
    }

    // Determine status for UI
    let feedStatus = 'completed';
    if (riskScore >= 70) feedStatus = 'threat';
    else if (riskScore >= 30) feedStatus = 'scanning'; // medium risk = yellow
    else feedStatus = 'completed'; // low/minimal = green

    // Log to Agent Center console
    const riskEmoji = riskScore >= 70 ? '🚨' : riskScore >= 30 ? '⚠️' : '✅';
    const shortUrl = tab.url.length > 50 ? tab.url.substring(0, 47) + '...' : tab.url;
    appendAgentConsole(
      `${riskEmoji} [${category.toUpperCase()}] ${shortUrl} — Risk: ${riskScore}/100 (${confidence}% confidence)`,
      riskScore >= 70 ? 'error' : riskScore >= 30 ? 'warning' : 'success'
    );

    // Log Gemini summary
    if (scanData.summary) {
      appendAgentConsole(`💡 Gemini: ${scanData.summary.substring(0, 120)}${scanData.summary.length > 120 ? '...' : ''}`, 'info');
    }

    // Log recommendations
    if (scanData.recommendations && scanData.recommendations.length > 0) {
      appendAgentConsole(`📋 Recommendations: ${scanData.recommendations.slice(0, 2).join(' | ')}`, 'info');
    }

    // Log to floating panel
    if (window.CyberForgeAgentUI?.fpLog) {
      window.CyberForgeAgentUI.fpLog(`${riskEmoji} ${category} (${riskScore}/100) — ${shortUrl}`);
    }

    // Update URL feed with final status
    _updateLiveUrlFeed(tab.browser, tab.title || shortUrl, tab.url, feedStatus, null, scanData);

    // If alert was created, show toast
    if (scanData.alertCreated) {
      if (typeof showToast === 'function') {
        showToast('warning', '🚨 Security Alert',
          `${category} threat detected on ${shortUrl} (risk: ${riskScore}/100)`);
      }
    }

    // Log performance
    console.log(`[URLMonitor] Scan complete for ${tab.url}: scraper=${scanData.scraperDuration}ms, ml=${scanData.mlDuration}ms, gemini=${scanData.geminiDuration}ms`);

    return result;
  }

  /**
   * Update the live URL scanning feed in the Agent Center UI.
   * @param {string} browser
   * @param {string} label
   * @param {string} url
   * @param {'detected'|'scanning'|'queued'|'completed'|'threat'} status
   * @param {string|null} taskId
   * @param {Object|null} scanData – full scan results from /api/agent/scan-url
   */
  function _updateLiveUrlFeed(browser, label, url, status, taskId, scanData) {
    // Build entry with rich scan data when available
    const entry = {
      browser, label, url, status, taskId,
      time: new Date().toLocaleTimeString(),
      riskScore: scanData?.riskScore ?? null,
      category: scanData?.category ?? null,
      confidence: scanData?.confidence != null ? Math.round(scanData.confidence * 100) : null,
      summary: scanData?.summary ?? null
    };

    _urlScanHistory.unshift(entry);
    if (_urlScanHistory.length > MAX_SCAN_HISTORY) _urlScanHistory.pop();

    // Render into the UI if the element exists
    const feedContainer = document.getElementById('agent-url-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = _urlScanHistory.slice(0, 20).map(e => {
      const statusBadge = {
        detected: '<span class="url-status detected">Detected</span>',
        scanning: '<span class="url-status scanning">Medium Risk</span>',
        queued: '<span class="url-status queued">Queued</span>',
        completed: '<span class="url-status completed">Safe</span>',
        threat: '<span class="url-status threat">Threat</span>'
      };

      // If we have a risk score, show it instead of generic badge
      let badge = statusBadge[e.status] || '';
      if (e.riskScore != null && e.status !== 'detected') {
        const scoreClass = e.riskScore >= 70 ? 'threat' : e.riskScore >= 30 ? 'scanning' : 'completed';
        badge = `<span class="url-status ${scoreClass}">${e.riskScore}/100</span>`;
      }

      const displayLabel = e.label?.length > 40 ? e.label.substring(0, 37) + '...' : (e.label || '');
      const categoryTag = e.category ? `<span class="url-feed-category">${e.category}</span>` : '';

      return `
        <div class="url-feed-item" title="${e.summary || e.url || ''}">
          <span class="url-feed-time">${e.time}</span>
          <span class="url-feed-browser">${e.browser}</span>
          <span class="url-feed-label">${displayLabel}</span>
          ${categoryTag}
          ${badge}
        </div>`;
    }).join('');

    // Also update the floating panel URL feed
    _updateFloatingPanelUrlFeed();
  }

  /**
   * Write a compact URL feed into the floating agent panel.
   */
  function _updateFloatingPanelUrlFeed() {
    const fpFeed = document.getElementById('fp-url-feed');
    const fpDot = document.getElementById('fp-url-scan-dot');
    if (!fpFeed) return;

    if (fpDot) fpDot.classList.add('pulse');

    const recent = _urlScanHistory.slice(0, 5);
    if (recent.length === 0) {
      fpFeed.innerHTML = '<div class="fp-url-empty">Open a browser to start scanning</div>';
      return;
    }

    fpFeed.innerHTML = recent.map(entry => {
      const statusIcon = { detected: '🔍', scanning: '⏳', queued: '📋', completed: '✅', threat: '🚨' };
      const icon = statusIcon[entry.status] || '🔍';
      const displayLabel = (entry.url || entry.label || '').length > 35
        ? (entry.url || entry.label).substring(0, 32) + '...'
        : (entry.url || entry.label);
      return `<div class="fp-url-row">${icon} <span class="fp-url-text" title="${entry.url || ''}">${displayLabel}</span></div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // BEHAVIORAL ALERTS & INTELLIGENCE SNAPSHOT
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Handle a behavioral alert generated by the Rust intelligence engine.
   * Fired inline from _pollActiveUrls when process_browser_intelligence returns alerts.
   */
  function _handleBehavioralAlert(alert) {
    _intelState.alerts.unshift(alert);
    if (_intelState.alerts.length > 200) _intelState.alerts.pop();
    _intelState.totalAlerts = _intelState.alerts.length;

    // Update sidebar badge
    const badge = document.getElementById('intel-alerts-count');
    if (badge) badge.textContent = _intelState.totalAlerts.toString();

    // Update risk badge in sidebar
    const riskBadge = document.getElementById('intel-risk-badge');
    if (riskBadge && alert.risk_score != null) {
      riskBadge.textContent = Math.round(alert.risk_score).toString();
      riskBadge.className = 'sidebar-nav-badge ' +
        (alert.risk_score >= 70 ? 'alert' : alert.risk_score >= 40 ? 'live-badge' : 'agent-badge');
    }

    // Log to Agent Center console
    const emoji = alert.risk_score >= 70 ? '🚨' : alert.risk_score >= 40 ? '⚠️' : '🔍';
    appendAgentConsole(
      `${emoji} [BEHAVIORAL] ${alert.reason}: ${alert.domain || 'unknown'} (${Math.round(alert.risk_score || 0)}/100)`,
      alert.risk_score >= 70 ? 'error' : alert.risk_score >= 40 ? 'warning' : 'info'
    );

    // Log to floating panel
    if (window.CyberForgeAgentUI?.fpLog) {
      window.CyberForgeAgentUI.fpLog(`${emoji} ${alert.reason}: ${alert.domain || ''}`);
    }

    // Update floating panel behavioral alert section
    _updateFloatingPanelBehavioralAlerts();

    // Push alert to backend
    _pushAlertToBackend(alert).catch(err => {
      console.debug('[BrowserIntel] Alert push failed:', err.message);
    });

    // If on intel-alerts screen, refresh it
    if (_state()?.activeScreen === 'intel-alerts') {
      const alertsList = document.getElementById('intel-alerts-list');
      if (alertsList) _renderIntelAlertsList(alertsList);
    }

    // Show toast for high risk
    if (alert.risk_score >= 60 && typeof showToast === 'function') {
      showToast('warning', '🧠 Behavioral Alert',
        `${alert.reason}: ${alert.domain || 'unknown'} — Risk ${Math.round(alert.risk_score)}/100`);
    }
  }

  async function _pushAlertToBackend(alert) {
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    await fetch(`${backendUrl}/api/browser-intelligence/alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...alert,
        user_id: resolveCurrentUserId(),
        device_id: localStorage.getItem('cyberforge_device_id') || 'unknown'
      }),
      signal: AbortSignal.timeout(10000)
    });
  }

  /**
   * Periodically push intelligence snapshots to backend.
   */
  function _startIntelligenceSnapshotPush() {
    if (_intelState.pollerId) return;
    _intelState.pollerId = setInterval(async () => {
      try {
        const getSnapshot = window.electronAPI?.getIntelligenceSnapshot;
        if (!getSnapshot) return;
        const snapshot = await getSnapshot();
        if (!snapshot) return;

        _intelState.sessions = snapshot.sessions || [];
        _intelState.totalDomains = snapshot.total_domains_tracked || 0;
        _intelState.totalAlerts = snapshot.total_alerts || 0;
        _intelState.averageRisk = snapshot.average_risk || 0;

        // Push to backend
        const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
        const token = localStorage.getItem('authToken') || '';
        await fetch(`${backendUrl}/api/browser-intelligence/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            ...snapshot,
            user_id: resolveCurrentUserId(),
            device_id: localStorage.getItem('cyberforge_device_id') || 'unknown'
          }),
          signal: AbortSignal.timeout(15000)
        });
      } catch (err) {
        console.debug('[BrowserIntel] Snapshot push failed:', err.message);
      }
    }, 30000); // Every 30 seconds
  }

  // ────────────────────────────────────────────
  // FLOATING PANEL BEHAVIORAL ALERTS
  // ────────────────────────────────────────────

  function _updateFloatingPanelBehavioralAlerts() {
    const container = document.getElementById('fp-behavioral-alerts');
    if (!container) return;
    const recent = _intelState.alerts.slice(0, 5);
    if (!recent.length) {
      container.innerHTML = '<div class="fp-empty">No behavioral alerts</div>';
      return;
    }
    container.innerHTML = recent.map(a => {
      const cls = a.risk_score >= 70 ? 'threat' : a.risk_score >= 40 ? 'warning' : 'info';
      return `<div class="fp-alert-item ${cls}">
        <span class="fp-alert-reason">${a.reason || 'Alert'}</span>
        <span class="fp-alert-domain">${a.domain || ''}</span>
        <span class="fp-alert-score">${Math.round(a.risk_score || 0)}</span>
      </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // ADD BROWSER MODAL
  // ══════════════════════════════════════════════════════════════════════

  function initAddBrowserModal() {
    const addBrowserBtn = document.getElementById('agent-add-browser');
    const modal = document.getElementById('add-browser-modal');
    const closeBtn = document.getElementById('add-browser-close');
    const cancelBtn = document.getElementById('add-browser-cancel');
    const testBtn = document.getElementById('add-browser-test');
    const connectBtn = document.getElementById('add-browser-connect');
    const statusEl = document.getElementById('browser-connection-status');
    
    if (!addBrowserBtn || !modal) return;
    
    // Open modal
    addBrowserBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      // Reset state
      statusEl.className = 'connection-status';
      statusEl.querySelector('.status-text').textContent = 'Not connected';
      connectBtn.disabled = true;
    });
    
    // Close modal
    const closeModal = () => {
      modal.style.display = 'none';
    };
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Test connection
    testBtn?.addEventListener('click', async () => {
      const host = document.getElementById('browser-host').value || 'localhost';
      const port = document.getElementById('browser-port').value || '9222';
      const name = document.getElementById('browser-name').value || 'Browser';
      
      statusEl.className = 'connection-status testing';
      statusEl.querySelector('.status-text').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing connection...';
      testBtn.disabled = true;
      
      try {
        // Try to connect via the system monitor
        const response = await fetch(`http://${host}:${port}/json/version`);
        if (response.ok) {
          const data = await response.json();
          statusEl.className = 'connection-status success';
          statusEl.querySelector('.status-text').innerHTML = `<i class="fas fa-check-circle"></i> Connected! ${data.Browser || 'Browser'} detected`;
          connectBtn.disabled = false;
          
          // Store connection info
          modal.dataset.browserInfo = JSON.stringify({
            name: name || data.Browser?.split('/')[0] || 'Chrome',
            host,
            port,
            webSocketDebuggerUrl: data.webSocketDebuggerUrl
          });
        } else {
          throw new Error('Browser not responding');
        }
      } catch (error) {
        statusEl.className = 'connection-status error';
        statusEl.querySelector('.status-text').innerHTML = `<i class="fas fa-times-circle"></i> Connection failed. Is the browser running with debugging enabled?`;
        connectBtn.disabled = true;
      } finally {
        testBtn.disabled = false;
      }
    });
    
    // Connect to browser
    connectBtn?.addEventListener('click', async () => {
      try {
        const browserInfo = JSON.parse(modal.dataset.browserInfo || '{}');
        
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        connectBtn.disabled = true;
        
        // Trigger the system monitor to connect
        if (window.electronAPI?.systemMonitor) {
          // Start the monitor if not already running
          await window.electronAPI.systemMonitor.start();
          
          // Log the connection
          logAgentAction(`Manually connected to ${browserInfo.name} at ${browserInfo.host}:${browserInfo.port}`, 'success');
          showToast('success', 'Browser Connected', `Now monitoring ${browserInfo.name}`);
          
          // Update UI
          const connectBrowsersBtn = document.getElementById('agent-connect-browsers');
          if (connectBrowsersBtn) {
            connectBrowsersBtn.classList.add('connected');
            connectBrowsersBtn.innerHTML = '<i class="fas fa-check"></i><span>Connected</span>';
          }
          
          setAgentState('monitoring');
          systemMonitorState.isConnected = true;
          
          if (!systemMonitorState.connectedBrowsers.includes(browserInfo.name)) {
            systemMonitorState.connectedBrowsers.push(browserInfo.name);
          }
          
          updateLiveStats();
          closeModal();
        } else {
          throw new Error('System monitor not available');
        }
      } catch (error) {
        showToast('error', 'Connection Failed', error.message);
        connectBtn.innerHTML = '<i class="fas fa-check"></i> Connect';
        connectBtn.disabled = false;
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SYSTEM BROWSER MONITOR INTEGRATION
  // ══════════════════════════════════════════════════════════════════════

  function initSystemMonitor() {
    // Check if system monitor API is available
    if (!window.electronAPI?.systemMonitor) {
      console.log('System monitor API not available');
      return;
    }

    // Bind connect browsers button
    const connectBtn = document.getElementById('agent-connect-browsers');
    if (connectBtn) {
      connectBtn.addEventListener('click', toggleSystemMonitor);
    }

    // Set up event listeners for system monitor
    window.electronAPI.systemMonitor.onRequest((request) => {
      handleMonitorRequest(request);
    });

    window.electronAPI.systemMonitor.onResponse((response) => {
      handleMonitorResponse(response);
    });

    window.electronAPI.systemMonitor.onThreat((threat) => {
      handleMonitorThreat(threat);
    });

    window.electronAPI.systemMonitor.onBrowserConnected((browser) => {
      handleBrowserConnected(browser);
    });

    window.electronAPI.systemMonitor.onStatusChange((status) => {
      handleMonitorStatusChange(status);
    });

    window.electronAPI.systemMonitor.onStatsUpdate((stats) => {
      updateMonitorStats(stats);
    });

    window.electronAPI.systemMonitor.onConsole((consoleData) => {
      handleBrowserConsole(consoleData);
    });

    console.log('System monitor initialized');
  }

  async function toggleSystemMonitor() {
    const connectBtn = document.getElementById('agent-connect-browsers');
    
    if (systemMonitorState.isConnected) {
      // Stop monitoring
      try {
        await window.electronAPI.systemMonitor.stop();
        systemMonitorState.isConnected = false;
        systemMonitorState.connectedBrowsers = [];
        
        if (connectBtn) {
          connectBtn.classList.remove('connected');
          connectBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
        }
        
        setAgentState('idle');
        logAgentAction('Browser monitoring stopped', 'warning');
        showToast('info', 'Monitoring Stopped', 'Browser monitoring has been disconnected');
        updateLiveStats();
      } catch (error) {
        console.error('Failed to stop monitoring:', error);
        showToast('error', 'Error', 'Failed to stop monitoring');
      }
    } else {
      // Start monitoring - first try to connect to existing browsers
      try {
        if (connectBtn) {
          connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>...</span>';
        }
        
        const result = await window.electronAPI.systemMonitor.start();
        
        // Check if any browsers were connected
        if (result.browsersConnected === 0) {
          // No browsers found, offer to launch one
          logAgentAction('No browsers with debugging enabled found', 'warning');
          showToast('warning', 'No Browsers Found', 'Launching Chrome with debugging...');
          
          // Try to launch Chrome with debugging
          try {
            const launchResult = await window.electronAPI.systemMonitor.launchBrowser('chrome');
            if (launchResult.success) {
              systemMonitorState.isConnected = true;
              systemMonitorState.startTime = Date.now();
              systemMonitorState.connectedBrowsers.push(launchResult.browser);
              
              if (connectBtn) {
                connectBtn.classList.add('connected');
                connectBtn.innerHTML = '<i class="fas fa-unlink"></i><span>Stop</span>';
              }
              
              setAgentState('monitoring');
              logAgentAction(`Launched ${launchResult.browser} with debugging`, 'success');
              showToast('success', 'Browser Launched', `${launchResult.browser} is now being monitored`);
              updateLiveStats();
              
              const pulse = document.querySelector('.agent-pulse');
              if (pulse) {
                pulse.classList.add('monitoring');
                pulse.classList.remove('offline');
              }
            } else {
              throw new Error(launchResult.error || 'Failed to launch browser');
            }
          } catch (launchError) {
            console.error('Failed to launch browser:', launchError);
            if (connectBtn) {
              connectBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
            }
            showToast('error', 'Launch Failed', launchError.message || 'Could not launch browser');
          }
        } else {
          // Browsers were found and connected
          systemMonitorState.isConnected = true;
          systemMonitorState.startTime = Date.now();
          
          if (connectBtn) {
            connectBtn.classList.add('connected');
            connectBtn.innerHTML = '<i class="fas fa-unlink"></i><span>Stop</span>';
          }
          
          setAgentState('monitoring');
          logAgentAction(`Connected to ${result.browsersConnected} browser(s)`, 'success');
          showToast('success', 'Connected', `Monitoring ${result.browsersConnected} browser(s)`);
          updateLiveStats();
          
          const pulse = document.querySelector('.agent-pulse');
          if (pulse) {
            pulse.classList.add('monitoring');
            pulse.classList.remove('offline');
          }
        }
      } catch (error) {
        console.error('Failed to start monitoring:', error);
        if (connectBtn) {
          connectBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
        }
        showToast('error', 'Connection Failed', error.message || 'Could not start browser monitoring');
      }
    }
  }

  // Launch a specific browser with debugging
  async function launchBrowserForMonitoring(browserKey = 'chrome') {
    const connectBtn = document.getElementById('agent-connect-browsers');
    
    try {
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>...</span>';
      }
      
      logAgentAction(`Launching ${browserKey} with debugging...`, 'info');
      
      const result = await window.electronAPI.systemMonitor.launchBrowser(browserKey);
      
      if (result.success) {
        systemMonitorState.isConnected = true;
        systemMonitorState.startTime = Date.now();
        
        if (!systemMonitorState.connectedBrowsers.includes(result.browser)) {
          systemMonitorState.connectedBrowsers.push(result.browser);
        }
        
        if (connectBtn) {
          connectBtn.classList.add('connected');
          connectBtn.innerHTML = '<i class="fas fa-unlink"></i><span>Stop</span>';
        }
        
        setAgentState('monitoring');
        logAgentAction(`${result.browser} launched and connected`, 'success');
        showToast('success', 'Browser Launched', `Now monitoring ${result.browser}`);
        updateLiveStats();
        
        const pulse = document.querySelector('.agent-pulse');
        if (pulse) {
          pulse.classList.add('monitoring');
          pulse.classList.remove('offline');
        }
      } else {
        throw new Error(result.error || 'Launch failed');
      }
    } catch (error) {
      console.error('Failed to launch browser:', error);
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
      }
      showToast('error', 'Launch Failed', error.message);
    }
  }

  function handleMonitorRequest(request) {
    systemMonitorState.requestCount++;
    agentState.memory.browsersMonitored = systemMonitorState.connectedBrowsers.length;
    
    // Add to recent requests
    const formattedRequest = {
      id: request.requestId || Date.now(),
      method: request.method || 'GET',
      url: request.url,
      browser: request.browser || 'Unknown',
      timestamp: new Date()
    };
    
    systemMonitorState.recentRequests.unshift(formattedRequest);
    if (systemMonitorState.recentRequests.length > 50) {
      systemMonitorState.recentRequests.pop();
    }
    
    // Update UI
    updateRequestFeed();
    updateLiveStats();
    
    // Log significant requests
    if (systemMonitorState.requestCount % 10 === 0) {
      logAgentAction(`Captured ${systemMonitorState.requestCount} requests`, 'info');
    }
  }

  function handleMonitorResponse(response) {
    // Update request with response status
    const requestIndex = systemMonitorState.recentRequests.findIndex(
      r => r.id === response.requestId
    );
    
    if (requestIndex !== -1) {
      systemMonitorState.recentRequests[requestIndex].status = response.status;
      systemMonitorState.recentRequests[requestIndex].mimeType = response.mimeType;
      updateRequestFeed();
    }
  }

  function handleMonitorThreat(threat) {
    systemMonitorState.threatCount++;
    agentState.memory.threatsDetected++;
    agentState.memory.alertsRaised++;
    
    // Add to events
    addEvent('warning', 'Threat Detected', 
      `${threat.type}: ${threat.details || threat.url}`, 
      threat.browser || 'Browser Monitor'
    );
    
    // Update state
    setAgentState('investigating');
    logAgentAction(`Threat detected: ${threat.type}`, 'warning');
    showToast('warning', 'Threat Detected', `${threat.type} - Investigating...`);
    
    // Update pulse to alert
    const pulse = document.querySelector('.agent-pulse');
    if (pulse) {
      pulse.classList.add('alert');
      setTimeout(() => pulse.classList.remove('alert'), 5000);
    }
    
    updateLiveStats();
    
    // Return to monitoring after investigation
    setTimeout(() => {
      if (agentState.status === 'investigating') {
        setAgentState('monitoring');
        logAgentAction('Investigation complete', 'info');
      }
    }, 5000);
  }

  function handleBrowserConnected(browser) {
    if (!systemMonitorState.connectedBrowsers.includes(browser.name)) {
      systemMonitorState.connectedBrowsers.push(browser.name);
    }
    
    agentState.memory.browsersMonitored = systemMonitorState.connectedBrowsers.length;
    
    logAgentAction(`Connected to ${browser.name}`, 'success');
    addEvent('success', 'Browser Connected', 
      `Now monitoring ${browser.name} (${browser.targets || 1} targets)`, 
      'System Monitor'
    );
    
    updateLiveStats();
  }

  function handleMonitorStatusChange(status) {
    if (status.isMonitoring) {
      setAgentState('monitoring');
      logAgentAction('System monitoring active', 'success');
    } else {
      setAgentState('idle');
      logAgentAction('System monitoring stopped', 'warning');
    }
    
    systemMonitorState.isConnected = status.isMonitoring;
    updateLiveStats();
  }

  function updateMonitorStats(stats) {
    systemMonitorState.requestCount = stats.requestCount || systemMonitorState.requestCount;
    systemMonitorState.threatCount = stats.threatCount || systemMonitorState.threatCount;
    systemMonitorState.connectedBrowsers = stats.browsers || systemMonitorState.connectedBrowsers;
    
    agentState.memory.browsersMonitored = systemMonitorState.connectedBrowsers.length;
    agentState.memory.threatsDetected = systemMonitorState.threatCount;
    
    updateLiveStats();
    updateHeaderStats();
  }

  function handleBrowserConsole(consoleData) {
    // Add to console logs store
    const logEntry = {
      id: Date.now(),
      level: consoleData.type || 'log',
      message: consoleData.message,
      browser: consoleData.browser,
      tabTitle: consoleData.tabTitle,
      source: consoleData.url || consoleData.source || 'browser',
      lineNumber: consoleData.lineNumber,
      timestamp: new Date(consoleData.timestamp || Date.now()),
      stackTrace: consoleData.stackTrace
    };

    browserConsoleLogs.unshift(logEntry);
    if (browserConsoleLogs.length > MAX_CONSOLE_LOGS) {
      browserConsoleLogs.pop();
    }

    // Update the console output if on console page
    updateConsoleOutput(logEntry);

    // Log errors and warnings to agent activity
    if (consoleData.type === 'error') {
      logAgentAction(`Console Error: ${consoleData.message?.substring(0, 50)}...`, 'error');
      addEvent('error', 'Browser Console Error', 
        `${consoleData.browser}: ${consoleData.message?.substring(0, 100)}`, 
        consoleData.tabTitle || 'Browser'
      );
    } else if (consoleData.type === 'warning') {
      logAgentAction(`Console Warning: ${consoleData.message?.substring(0, 50)}...`, 'warning');
    }

    // Update stats
    updateLiveStats();
  }

  function updateConsoleOutput(logEntry) {
    // Check if console output container exists (user is on console page)
    const consoleOutput = document.getElementById('console-output');
    if (!consoleOutput) return;

    // Remove loading placeholder if present
    const loading = consoleOutput.querySelector('.loading-placeholder');
    if (loading) loading.remove();

    // Remove empty message if present
    const empty = consoleOutput.querySelector('.console-empty');
    if (empty) empty.remove();

    // Create log entry element
    const entryEl = document.createElement('div');
    entryEl.className = `console-entry ${logEntry.level}`;
    entryEl.innerHTML = `
      <span class="log-icon"><i class="fas fa-${getLogIcon(logEntry.level)}"></i></span>
      <span class="log-browser" title="${logEntry.browser}">${logEntry.browser || 'Browser'}</span>
      <span class="log-message">${escapeHtml(logEntry.message || '')}</span>
      <span class="log-source">${logEntry.source}${logEntry.lineNumber ? ':' + logEntry.lineNumber : ''}</span>
      <span class="log-time">${formatTime(logEntry.timestamp)}</span>
    `;

    // Add to top of console
    consoleOutput.insertBefore(entryEl, consoleOutput.firstChild);

    // Limit entries in DOM
    while (consoleOutput.children.length > MAX_CONSOLE_LOGS) {
      consoleOutput.removeChild(consoleOutput.lastChild);
    }
  }

  function getLogIcon(level) {
    const icons = {
      log: 'chevron-right',
      info: 'info-circle',
      warning: 'exclamation-triangle',
      warn: 'exclamation-triangle',
      error: 'times-circle',
      exception: 'bug'
    };
    return icons[level] || 'chevron-right';
  }

  function formatTime(date) {
    if (!date) return '';
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleTimeString();
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateLiveStats() {
    // Update browser count
    const browserStat = document.getElementById('agent-browsers-count');
    if (browserStat) {
      browserStat.textContent = systemMonitorState.connectedBrowsers.length;
    }
    
    // Update request count
    const requestStat = document.getElementById('agent-requests-count');
    if (requestStat) {
      requestStat.textContent = formatNumber(systemMonitorState.requestCount);
    }
    
    // Update threat count
    const threatStat = document.getElementById('agent-threats-count');
    if (threatStat) {
      threatStat.textContent = systemMonitorState.threatCount;
      if (systemMonitorState.threatCount > 0) {
        threatStat.parentElement?.classList.add('has-threats');
      }
    }
    
    // Update uptime
    const uptimeStat = document.getElementById('agent-uptime');
    if (uptimeStat && systemMonitorState.startTime) {
      const seconds = Math.floor((Date.now() - systemMonitorState.startTime) / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        uptimeStat.textContent = `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        uptimeStat.textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
      } else {
        uptimeStat.textContent = `0:${String(seconds).padStart(2, '0')}`;
      }
    }
    
    // Update live indicator
    const liveIndicator = document.querySelector('.live-indicator');
    if (liveIndicator) {
      liveIndicator.style.display = systemMonitorState.isConnected ? 'flex' : 'none';
    }
  }

  function updateRequestFeed() {
    const feedContainer = document.getElementById('agent-request-feed');
    if (!feedContainer) return;
    
    if (systemMonitorState.recentRequests.length === 0) {
      feedContainer.innerHTML = `
        <div class="agent-request-empty">
          <i class="fas fa-wifi"></i>
          <span>Waiting for browser activity...</span>
          <small>Click "Connect" or go to Browser Registration to launch browsers</small>
        </div>
      `;
      return;
    }
    
    // Show last 8 requests
    const recentRequests = systemMonitorState.recentRequests.slice(0, 8);
    
    feedContainer.innerHTML = recentRequests.map(req => {
      const methodClass = req.method.toLowerCase();
      const statusClass = req.status ? 
        (req.status < 300 ? 'success' : req.status < 400 ? 'redirect' : 'error') : '';
      
      // Extract domain from URL
      let domain = req.url;
      try {
        const urlObj = new URL(req.url);
        domain = urlObj.hostname + urlObj.pathname.substring(0, 30);
        if (urlObj.pathname.length > 30) domain += '...';
      } catch (e) {
        domain = req.url.substring(0, 40);
      }
      
      // Browser icon
      const browserIcons = {
        'Chrome': 'fab fa-chrome',
        'Brave': 'fab fa-brave',
        'Edge': 'fab fa-edge',
        'Opera': 'fab fa-opera',
        'Firefox': 'fab fa-firefox-browser',
        'Safari': 'fab fa-safari',
        'Arc': 'fas fa-browser',
        'Chromium': 'fab fa-chrome'
      };
      const browserIcon = browserIcons[req.browser] || 'fas fa-globe';
      
      return `
        <div class="agent-request-item">
          <span class="request-method ${methodClass}">${req.method}</span>
          <span class="request-url" title="${req.url}">${domain}</span>
          <span class="request-browser"><i class="${browserIcon}"></i></span>
          ${req.status ? `<span class="request-status ${statusClass}">${req.status}</span>` : ''}
        </div>
      `;
    }).join('');
    
    // Also update the HTTP History table if visible
    updateHttpHistoryFromMonitor();
  }
  
  function updateHttpHistoryFromMonitor() {
    const tbody = document.getElementById('requests-tbody');
    if (!tbody || _state()?.activeScreen !== 'http-history') return;
    
    // Clear existing and add from system monitor
    if (systemMonitorState.recentRequests.length > 0) {
      tbody.innerHTML = systemMonitorState.recentRequests.map((req, index) => {
        let hostname = '', pathname = '', query = '';
        try {
          const urlObj = new URL(req.url);
          hostname = urlObj.hostname;
          pathname = urlObj.pathname;
          query = urlObj.search;
        } catch (e) {
          hostname = req.url;
        }
        
        const statusClass = req.status ? 
          (req.status < 300 ? '' : req.status < 400 ? 'redirect' : 'error') : '';
        
        return `
          <tr class="cf-table-row" data-request-id="${req.id}">
            <td class="cell-id">${index + 1}</td>
            <td class="cell-host">${hostname}</td>
            <td class="cell-method method-${req.method.toLowerCase()}">${req.method}</td>
            <td class="cell-path">${pathname}</td>
            <td class="cell-query">${query || '-'}</td>
            <td class="cell-status ${statusClass}">${req.status || '-'}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Update uptime periodically
  setInterval(() => {
    if (systemMonitorState.isConnected && systemMonitorState.startTime) {
      updateLiveStats();
    }
  }, 1000);

  // Expose console logs for the console page
  window.getBrowserConsoleLogs = () => browserConsoleLogs;

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.CyberForgeBrowserIntel = {
    // URL monitoring
    startUrlMonitoring,
    stopUrlMonitoring,
    _pollActiveUrls,
    _normaliseUrl,
    _autoCreateScanTask,
    _updateLiveUrlFeed,
    _updateFloatingPanelUrlFeed,

    // Behavioral alerts / intelligence
    _handleBehavioralAlert,
    _pushAlertToBackend,
    _startIntelligenceSnapshotPush,
    _updateFloatingPanelBehavioralAlerts,

    // Add browser modal
    initAddBrowserModal,

    // System monitor integration
    initSystemMonitor,
    toggleSystemMonitor,
    launchBrowserForMonitoring,
    handleMonitorRequest,
    handleMonitorResponse,
    handleMonitorThreat,
    handleBrowserConnected,
    handleMonitorStatusChange,
    updateMonitorStats,
    handleBrowserConsole,
    updateConsoleOutput,
    getLogIcon,
    formatTime,
    escapeHtml,
    updateLiveStats,
    updateRequestFeed,
    updateHttpHistoryFromMonitor,
    formatNumber,

    // Expose internal state for debugging / main app access
    systemMonitorState,
    _intelState,
    _urlScanHistory,
    browserConsoleLogs
  };
})();
