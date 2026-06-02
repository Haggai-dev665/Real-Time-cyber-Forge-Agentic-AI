// CyberForge Agent Manager
// Handles agent control center, browser intelligence, and agent lifecycle

(() => {
  // Import API client (resilient across Tauri/Electron/web + script load timing)
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('./api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  // Convenience reference for toast notifications (extracted to toast-system.js)
  function showToast(type, title, message) {
    if (window.CyberForgeToast?.showToast) {
      window.CyberForgeToast.showToast(type, title, message);
    }
  }

  // Cross-module references resolved at call-time from the main app's window globals.
  // The main app must expose these via window.CyberForgeApp or equivalent.
  function browserIconFallback(key) {
    if (window.CyberForgeApp?.browserIconFallback) return window.CyberForgeApp.browserIconFallback(key);
    const map = { chrome: 'fab fa-chrome', firefox: 'fab fa-firefox-browser', edge: 'fab fa-edge', brave: 'fas fa-shield-halved', opera: 'fab fa-opera', chromium: 'fab fa-chrome', arc: 'fas fa-globe' };
    return map[key] || 'fas fa-globe';
  }
  function startUrlMonitoring() {
    const spinner = document.getElementById('ac-url-spinner');
    const badge   = document.getElementById('url-monitor-status');
    const beam    = document.getElementById('ac-scan-beam');
    if (spinner) spinner.style.display = '';
    if (badge)  { badge.textContent = 'Starting…'; badge.className = 'url-feed-badge'; }

    if (window.CyberForgeApp?.startUrlMonitoring) {
      window.CyberForgeApp.startUrlMonitoring();
      if (beam)  beam.style.display = '';
      if (badge) { badge.textContent = 'Active'; badge.className = 'url-feed-badge active'; }
    } else {
      // No Electron bridge — manual-only mode
      if (badge) { badge.textContent = 'Manual mode'; badge.className = 'url-feed-badge'; }
      appendAgentConsole('URL auto-monitoring not available (desktop bridge required). Use scan field.', 'warning');
    }
    if (spinner) setTimeout(() => { if (spinner) spinner.style.display = 'none'; }, 2000);
  }
  function stopUrlMonitoring() { if (window.CyberForgeApp?.stopUrlMonitoring) window.CyberForgeApp.stopUrlMonitoring(); }
  function loadAgentTasksData() { if (window.CyberForgeApp?.loadAgentTasksData) window.CyberForgeApp.loadAgentTasksData(); }

  // Lazy accessor for shared app state (navigation, screen rendering)
  function _getAppState() { return window.CyberForgeApp?.state || {}; }
  function renderScreen(screen) { if (window.CyberForgeApp?.renderScreen) window.CyberForgeApp.renderScreen(screen); }

  // Proxy object so `state.activeScreen = ...` writes through to the main app state
  const state = new Proxy({}, {
    get(_t, prop) { return _getAppState()[prop]; },
    set(_t, prop, value) { const s = _getAppState(); s[prop] = value; return true; }
  });

  // =========================================
  // AGENT CENTER — Main init for the agent-control screen
  // This is SEPARATE from initAgentControlPanel() which handles
  // the floating panel on the dashboard.
  // =========================================

  let _agentCenterStatsInterval = null;
  let _agentCenterSyncInterval = null;
  let _agentCenterMLInterval = null;
  let _sessionScanCount = 0;

  function _updateKPI(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = parseInt(el.textContent, 10) || 0;
    if (prev === value) return;
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
    el.textContent = String(value);
    el.style.animation = 'ac-count-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) backwards';
  }

  function initAgentCenter() {
    console.log('[AgentCenter] Initializing agent control center v3...');
    _sessionScanCount = 0;

    bindAgentControlActions();
    autoStartDefaultAgent();
    syncAgentCenterWithBackend();
    refreshAgentOpenBrowsers();
    loadAgentCenterSystemStats();
    loadAgentActivityLog();
    loadMLModelsStatus();
    animateKPICounters();

    // Start URL monitoring immediately — don't wait for agent confirmation
    startUrlMonitoring();

    if (_agentCenterStatsInterval) clearInterval(_agentCenterStatsInterval);
    _agentCenterStatsInterval = setInterval(() => {
      if (!document.getElementById('agent-control-page')) {
        clearInterval(_agentCenterStatsInterval);
        _agentCenterStatsInterval = null;
        return;
      }
      loadAgentCenterSystemStats();
    }, 5000);

    if (_agentCenterSyncInterval) clearInterval(_agentCenterSyncInterval);
    _agentCenterSyncInterval = setInterval(() => {
      if (!document.getElementById('agent-control-page')) {
        clearInterval(_agentCenterSyncInterval);
        _agentCenterSyncInterval = null;
        return;
      }
      syncAgentCenterWithBackend();
    }, 20000);

    if (_agentCenterMLInterval) clearInterval(_agentCenterMLInterval);
    _agentCenterMLInterval = setInterval(() => {
      if (!document.getElementById('agent-control-page')) {
        clearInterval(_agentCenterMLInterval);
        _agentCenterMLInterval = null;
        return;
      }
      loadMLModelsStatus();
    }, 30000);

    appendAgentConsole('Agent Center v3 initialized. Type "help" for commands.', 'info');
    console.log('[AgentCenter] Agent Center v3 initialized.');
  }

  async function safeGetAgentAlerts({ userId, limit = 20 } = {}) {
    if (typeof cyberforgeAPI?.getAgentAlerts === 'function') {
      return cyberforgeAPI.getAgentAlerts({ userId, limit });
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (limit) params.set('limit', String(limit));

    const response = await fetch(`${backendUrl}/api/agent/alerts?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      throw new Error(`Agent alerts request failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    return {
      success: true,
      data: {
        data: {
          alerts: payload?.data?.alerts || payload?.alerts || []
        }
      }
    };
  }

  async function safeStartAgent({ userId, agentName = 'default', config = {} } = {}) {
    if (typeof cyberforgeAPI?.startAgent === 'function') {
      return cyberforgeAPI.startAgent({ userId, agentName, config });
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userId, agentName, config }),
      signal: AbortSignal.timeout(9000)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: payload?.message || `HTTP ${response.status}` };
    }

    return payload?.success !== false ? { success: true, data: payload?.data || payload } : payload;
  }

  async function safeGetAgentStatus(agentName = 'default') {
    if (typeof cyberforgeAPI?.getAgentStatus === 'function') {
      return cyberforgeAPI.getAgentStatus(agentName);
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/status/${encodeURIComponent(agentName)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      throw new Error(`Agent status request failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    return {
      success: true,
      data: {
        data: payload?.data || payload || {}
      }
    };
  }

  async function safeHealthCheck() {
    if (typeof cyberforgeAPI?.healthCheck === 'function') {
      return cyberforgeAPI.healthCheck();
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const response = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(18000) });
    const payload = await response.json().catch(() => ({}));
    return { success: response.ok, data: payload };
  }

  async function safeMLHealthCheck() {
    if (typeof cyberforgeAPI?.mlHealthCheck === 'function') {
      return cyberforgeAPI.mlHealthCheck();
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const response = await fetch(`${backendUrl}/api/cyberforge-ml/health`, { signal: AbortSignal.timeout(18000) });
    const payload = await response.json().catch(() => ({}));
    return { success: response.ok, data: payload };
  }

  async function safeStopAgent(agentName = 'default') {
    if (typeof cyberforgeAPI?.stopAgent === 'function') {
      return cyberforgeAPI.stopAgent(agentName);
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ agentName }),
      signal: AbortSignal.timeout(9000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }
    return data?.success !== false ? { success: true, data: data?.data || data } : data;
  }

  async function safeCreateAgentTask(taskData) {
    if (typeof cyberforgeAPI?.createAgentTask === 'function') {
      return cyberforgeAPI.createAgentTask(taskData);
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/task/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(taskData),
      signal: AbortSignal.timeout(9000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }
    return data?.success !== false ? { success: true, data: data?.data || data } : data;
  }

  async function autoStartDefaultAgent() {
    try {
      const statusResult = await safeGetAgentStatus('default');
      const statusData = statusResult?.data?.data || statusResult?.data || {};
      const isRunning = !!statusData?.isRunning || !!statusData?.running;
      if (isRunning) {
        setAgentControlStatus(true, 'Agent Online');
        // Agent already running on backend — still start local monitoring
        startBrowserIntelligencePolling(60000);
        startUrlMonitoring();
        return;
      }

      const userId = resolveCurrentUserId();
      const startResult = await safeStartAgent({ userId, agentName: 'default', config: { source: 'agent-center-auto-start' } });
      if (startResult?.success) {
        setAgentControlStatus(true, 'Agent Online');
        appendAgentConsole('Default agent auto-started', 'success');
        // Start browser intelligence collection for auto-started agent
        startBrowserIntelligencePolling(60000);
        // Start real-time URL monitoring
        startUrlMonitoring();
      } else {
        appendAgentConsole(startResult?.error || 'Auto-start failed', 'warning');
      }
    } catch (error) {
      appendAgentConsole(`Auto-start check failed: ${error.message}`, 'warning');
    }
  }

  function _applyStatBar(barId, pctId, value) {
    const bar = document.getElementById(barId);
    const pct = document.getElementById(pctId);
    if (bar) {
      bar.style.width = value + '%';
      // Keep gradient colors set in CSS; override only on high usage
      if (value > 80) bar.style.background = 'linear-gradient(90deg,#E5573E,#EE6A50)';
      else if (value > 60) bar.style.background = 'linear-gradient(90deg,#D8B65A,#D8B65A)';
      else bar.style.background = '';
    }
    if (pct) pct.textContent = value + '%';
  }

  async function loadAgentCenterSystemStats() {
    const resSpinner = document.getElementById('ac-res-spinner');
    if (resSpinner) resSpinner.style.display = '';

    try {
      // Try Electron bridge first
      let data = null;
      const result = await window.electronAPI?.getSystemStats?.();
      if (result?.success && result.data) {
        data = result.data;
      }

      // Fallback: derive memory from performance API
      if (!data && performance?.memory) {
        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        const totalMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
        data = { cpu: 0, memory: Math.round((usedMB / totalMB) * 100), disk: 0, uptime: performance.now() / 1000 };
      }

      if (data) {
        const cpu  = Math.min(100, Math.round(data.cpu    || 0));
        const mem  = Math.min(100, Math.round(data.memory || 0));
        const disk = Math.min(100, Math.round(data.disk   || 0));

        _applyStatBar('ac-cpu-bar',  'ac-cpu-pct',  cpu);
        _applyStatBar('ac-mem-bar',  'ac-mem-pct',  mem);
        _applyStatBar('ac-disk-bar', 'ac-disk-pct', disk);

        const uptimeEl = document.getElementById('ac-uptime');
        if (uptimeEl) {
          if (data.uptime) {
            const s = Math.round(data.uptime);
            const d = Math.floor(s / 86400);
            const h = Math.floor((s % 86400) / 3600);
            const m = Math.floor((s % 3600) / 60);
            uptimeEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
          } else {
            uptimeEl.textContent = 'Active';
          }
        }
      } else {
        // No stats available — show placeholder percentages
        ['ac-cpu-pct','ac-mem-pct','ac-disk-pct'].forEach(id => {
          const el = document.getElementById(id);
          if (el && el.textContent === '—') el.textContent = 'N/A';
        });
        const uptimeEl = document.getElementById('ac-uptime');
        if (uptimeEl && uptimeEl.textContent === '—') uptimeEl.textContent = 'Active';
      }
    } catch (e) {
      console.warn('[AgentCenter] System stats fetch failed:', e.message);
    } finally {
      if (resSpinner) resSpinner.style.display = 'none';
    }
  }

  const _severityIcon = {
    critical: '<i class="fas fa-circle-exclamation" style="color:#E5573E;font-size:11px;flex-shrink:0;margin-top:1px"></i>',
    error:    '<i class="fas fa-circle-exclamation" style="color:#E5573E;font-size:11px;flex-shrink:0;margin-top:1px"></i>',
    warning:  '<i class="fas fa-triangle-exclamation" style="color:#D8B65A;font-size:11px;flex-shrink:0;margin-top:1px"></i>',
    success:  '<i class="fas fa-circle-check" style="color:#F69D39;font-size:11px;flex-shrink:0;margin-top:1px"></i>',
    info:     '<i class="fas fa-circle-info" style="color:#5E7A88;font-size:11px;flex-shrink:0;margin-top:1px"></i>',
  };

  function _activityItemHtml(time, severity, msg) {
    const icon = _severityIcon[severity] || _severityIcon.info;
    return `<div class="activity-item ${severity}">${icon}<span class="activity-time">${time}</span><span class="activity-msg">${msg}</span></div>`;
  }

  async function loadAgentActivityLog() {
    const log = document.getElementById('agent-activity-log');
    const activitySpinner = document.getElementById('ac-activity-spinner');
    if (!log) return;
    if (activitySpinner) activitySpinner.style.display = '';

    try {
      const userId = resolveCurrentUserId();
      const alertsResult = await safeGetAgentAlerts({ userId, limit: 20 });
      const alerts = alertsResult?.data?.data?.alerts || alertsResult?.data?.alerts || [];

      if (alerts.length === 0) {
        const healthResult = await safeHealthCheck();
        const items = [
          { time: new Date().toLocaleTimeString(), severity: healthResult?.success ? 'success' : 'error', msg: healthResult?.success ? 'Backend connected and healthy' : 'Backend health check failed' },
          { time: new Date().toLocaleTimeString(), severity: 'info', msg: 'Agent Center session started' }
        ];
        log.innerHTML = items.map(i => _activityItemHtml(i.time, i.severity, i.msg)).join('');
        _updateKPI('ac-kpi-threats', 0);
      } else {
        log.innerHTML = alerts.slice(0, 20).map(a => _activityItemHtml(
          a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '--',
          a.severity || 'info',
          a.message || a.title || 'Alert'
        )).join('');

        const threatCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'error' || a.severity === 'warning').length;
        _updateKPI('ac-kpi-threats', threatCount);
      }
    } catch (e) {
      log.innerHTML = _activityItemHtml(new Date().toLocaleTimeString(), 'error', `Failed to load activity: ${e.message}`);
    } finally {
      if (activitySpinner) activitySpinner.style.display = 'none';
    }
  }

  function prependActivityItem(severity, msg) {
    const log = document.getElementById('agent-activity-log');
    if (!log) return;
    const item = document.createElement('div');
    item.innerHTML = _activityItemHtml(new Date().toLocaleTimeString(), severity, msg);
    log.insertBefore(item.firstElementChild, log.firstChild);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  function _pushUrlFeedItem(url, status, category) {
    const feed = document.getElementById('agent-url-feed');
    if (!feed) return;

    // Remove empty placeholder on first real entry
    const placeholder = feed.querySelector('.ac-url-empty-state, .detecting-state, .url-feed-empty');
    if (placeholder) placeholder.remove();

    // Activate scan beam + status badge
    const beam = document.getElementById('ac-scan-beam');
    if (beam) beam.style.display = '';
    const monitor = document.getElementById('url-monitor-status');
    if (monitor) { monitor.textContent = 'Active'; monitor.className = 'url-feed-badge active'; }

    // Update scan count pill
    const countEl = document.getElementById('ac-url-count-val');
    if (countEl) countEl.textContent = String((parseInt(countEl.textContent, 10) || 0) + 1);

    // Update threat pill if this is a threat
    if (status === 'threat') {
      const threatPill = document.getElementById('ac-url-threat-count');
      const threatVal = document.getElementById('ac-url-threat-val');
      if (threatPill) threatPill.style.display = 'inline-flex';
      if (threatVal) threatVal.textContent = String((parseInt(threatVal.textContent, 10) || 0) + 1);
    }

    const isThreat = status === 'threat';
    const shortUrl = url.length > 52 ? url.slice(0, 50) + '…' : url;
    const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const statusLabel = { threat: '⚠ Threat', completed: '✓ Safe', scanning: 'Scanning', detected: 'Detected', error: 'Error' }[status] || status;

    const item = document.createElement('div');
    item.className = `url-feed-item status-${status}`;
    item.title = url;
    item.innerHTML =
      `<span class="url-feed-time">${time}</span>` +
      `<span class="url-feed-browser"><i class="fas fa-${isThreat ? 'skull-crossbones' : 'satellite-dish'}" style="color:${isThreat ? '#E5573E' : '#F69D39'}"></i></span>` +
      `<span class="url-feed-label">${shortUrl}</span>` +
      (category ? `<span class="url-feed-category">${category}</span>` : '') +
      `<span class="url-status ${status}">${statusLabel}</span>`;

    feed.insertBefore(item, feed.firstChild);
    // Stagger animation delays for visual cascade
    Array.from(feed.children).forEach((child, i) => {
      child.style.animationDelay = (i === 0 ? '0ms' : `${i * 20}ms`);
    });
    while (feed.children.length > 30) feed.removeChild(feed.lastChild);
  }

  async function refreshAgentOpenBrowsers() {
    const list = document.getElementById('agent-open-browsers-list');
    if (!list) return;

    console.log('[AgentCenter] refreshAgentOpenBrowsers called');
    list.innerHTML = '<div class="detecting-state"><i class="fas fa-spinner fa-spin"></i> Scanning system for browsers...</div>';

    // Check if Tauri bridge is available
    if (!window.electronAPI?.detectSystemBrowsers) {
      console.error('[AgentCenter] window.electronAPI.detectSystemBrowsers is not defined');
      list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Browser detection bridge not available. The app must run inside Tauri desktop shell.</div>`;
      return;
    }

    try {
      console.log('[AgentCenter] Calling detectSystemBrowsers...');
      const detection = await window.electronAPI.detectSystemBrowsers();
      console.log('[AgentCenter] Detection result:', detection);

      if (!detection || !detection.browsers) {
        list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i> Browser detection returned empty result.</div>`;
        return;
      }

      const browsers = detection.browsers;
      const osLabel = detection.osDisplay || detection.os || 'Unknown OS';

      // Sort: running first, then installed, then not installed
      const sorted = [...browsers].sort((a, b) => {
        if (a.isRunning && !b.isRunning) return -1;
        if (!a.isRunning && b.isRunning) return 1;
        if (a.isInstalled && !b.isInstalled) return -1;
        if (!a.isInstalled && b.isInstalled) return 1;
        return 0;
      });

      const installedBrowsers = sorted.filter(b => b.isInstalled);
      if (!installedBrowsers.length) {
        list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i> No browsers detected on ${osLabel}.</div>`;
        return;
      }

      list.innerHTML = installedBrowsers.map((browser) => {
        const iconClass = browser.iconClass || browserIconFallback(browser.key);
        const running = !!browser.isRunning;
        const isDefault = !!browser.isDefault;
        const version = browser.version ? `v${browser.version}` : '';
        const badges = [];
        if (running) badges.push('<span class="agent-browser-state running">Running</span>');
        if (isDefault) badges.push('<span class="agent-browser-state default">Default</span>');
        if (!running && !isDefault) badges.push('<span class="agent-browser-state idle">Idle</span>');

        return `
          <div class="agent-browser-item ${running ? 'is-running' : ''}">
            <div class="agent-browser-icon"><i class="${iconClass}"></i></div>
            <div class="agent-browser-meta">
              <div class="agent-browser-name">${browser.name}</div>
              <div class="agent-browser-sub">${version}${version && browser.installPath ? ' &bull; ' : ''}${browser.installPath || ''}</div>
            </div>
            <div class="agent-browser-badges">${badges.join('')}</div>
          </div>
        `;
      }).join('');

      // Scan footer
      const runningCount = installedBrowsers.filter(b => b.isRunning).length;
      list.insertAdjacentHTML('beforeend', `
        <div class="agent-browsers-footer">
          <span>${osLabel} &bull; ${installedBrowsers.length} installed &bull; ${runningCount} running</span>
          <span>Scanned ${detection.scanTimestamp ? new Date(detection.scanTimestamp).toLocaleTimeString() : 'now'}</span>
        </div>
      `);

      _updateKPI('ac-kpi-browsers', installedBrowsers.length);
      console.log(`[AgentCenter] Rendered ${installedBrowsers.length} browsers (${runningCount} running)`);

      // Persist this snapshot to the backend
      persistBrowserIntelligence(detection).catch(err => {
        console.warn('[AgentCenter] Failed to persist browser intel:', err.message);
      });

    } catch (error) {
      console.error('[AgentCenter] Browser detection error:', error);
      list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Detection failed: ${error.message}</div>`;
    }
  }

  // ——————————————————————————————————————————————
  // BROWSER INTELLIGENCE – Persist & Poll
  // ——————————————————————————————————————————————

  let _browserIntelPollingId = null;

  /**
   * POST browser detection results to the backend for persistence in Appwrite.
   */
  async function persistBrowserIntelligence(detection) {
    if (!detection || !detection.browsers) return;

    const userId = resolveCurrentUserId();
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';

    const payload = {
      userId,
      deviceId: localStorage.getItem('cyberforge_device_id') || '',
      os: detection.os || '',
      osDisplay: detection.osDisplay || detection.os || '',
      defaultBrowser: detection.defaultBrowser || '',
      browsers: detection.browsers,
      scanTimestamp: detection.scanTimestamp || new Date().toISOString()
    };

    const response = await fetch(`${backendUrl}/api/agent/browser-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[BrowserIntel] Saved snapshot:', result?.data?.documentId);
    return result;
  }

  /**
   * Fetch past browser intelligence snapshots from the backend.
   */
  async function fetchBrowserIntelligenceHistory(limit = 20) {
    const userId = resolveCurrentUserId();
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';

    const response = await fetch(`${backendUrl}/api/agent/browser-intelligence?userId=${encodeURIComponent(userId)}&limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result?.data?.snapshots || [];
  }

  /**
   * Start a polling loop that re-detects browsers every 60 seconds and
   * persists the result.  Idempotent – calling multiple times won't stack.
   */
  function startBrowserIntelligencePolling(intervalMs = 60000) {
    stopBrowserIntelligencePolling();

    console.log(`[BrowserIntel] Starting polling every ${intervalMs / 1000}s`);

    _browserIntelPollingId = setInterval(async () => {
      try {
        if (!window.electronAPI?.detectSystemBrowsers) return;
        const detection = await window.electronAPI.detectSystemBrowsers();
        if (detection?.browsers) {
          await persistBrowserIntelligence(detection);
        }
      } catch (err) {
        console.warn('[BrowserIntel] Polling tick failed:', err.message);
      }
    }, intervalMs);
  }

  function stopBrowserIntelligencePolling() {
    if (_browserIntelPollingId) {
      clearInterval(_browserIntelPollingId);
      _browserIntelPollingId = null;
      console.log('[BrowserIntel] Polling stopped');
    }
  }

  function resolveCurrentUserId() {
    const user = cyberforgeAPI.getCurrentUser?.() || {};
    return user.id || user._id || user.$id || user.userId || 'desktop-user';
  }

  function setAgentControlStatus(isOnline, label = 'Agent Offline') {
    const indicator = document.getElementById('agent-status-indicator');
    if (!indicator) return;
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');
    if (dot) dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    if (text) text.textContent = label;
  }

  function appendAgentConsole(message, level = 'info') {
    const consoleOutput = document.getElementById('agent-console-output');
    if (!consoleOutput) return;

    const line = document.createElement('div');
    line.className = `console-line ${level} console-line-new`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'console-time';
    timeSpan.textContent = new Date().toLocaleTimeString();

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;

    line.appendChild(timeSpan);
    line.appendChild(msgSpan);
    consoleOutput.appendChild(line);

    // Prune to 200 lines
    while (consoleOutput.children.length > 200) {
      consoleOutput.removeChild(consoleOutput.firstChild);
    }

    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function withButtonSpinner(btn, asyncFn) {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    return asyncFn().finally(() => { btn.innerHTML = orig; btn.disabled = false; });
  }

  function bindAgentControlActions() {
    const stopBtn = document.getElementById('stop-agent');
    const browserRegistrationBtn = document.getElementById('open-browser-registration');
    const refreshBrowsersBtn = document.getElementById('refresh-agent-browsers');
    const sendBtn = document.getElementById('send-agent-command');
    const commandInput = document.getElementById('agent-command');
    const consoleClearBtn = document.getElementById('ac-console-clear');
    const healthBtn = document.getElementById('ac-action-health');
    const mlStatusBtn = document.getElementById('ac-action-mlstatus');
    const analyzeBtn = document.getElementById('ac-action-analyze');
    const scanSubmitBtn = document.getElementById('ac-scan-submit');
    const statsRefreshBtn = document.getElementById('ac-stats-refresh');
    const resyncHeroBtn = document.getElementById('ac-resync-hero');

    browserRegistrationBtn?.addEventListener('click', () => {
      state.activeScreen = 'browser-registration';
      renderScreen('browser-registration');
      showToast('info', 'Browser Registration', 'Opened Browser Registration in the right panel.');
    });

    refreshBrowsersBtn?.addEventListener('click', () => {
      refreshAgentOpenBrowsers();
    });

    stopBtn?.addEventListener('click', async () => {
      const result = await safeStopAgent('default');
      if (result?.success) {
        setAgentControlStatus(false, 'Agent Offline');
        appendAgentConsole('Agent stopped by operator', 'warning');
        showToast('info', 'Agent Stopped', 'Backend agent has been stopped.');
        syncAgentCenterWithBackend();
        stopBrowserIntelligencePolling();
        stopUrlMonitoring();
      } else {
        appendAgentConsole(result?.error || 'Failed to stop agent', 'error');
        showToast('error', 'Agent Stop Failed', result?.error || 'Backend rejected stop request');
      }
    });

    consoleClearBtn?.addEventListener('click', () => {
      const out = document.getElementById('agent-console-output');
      if (out) out.innerHTML = '';
    });

    healthBtn?.addEventListener('click', () => {
      withButtonSpinner(healthBtn, async () => {
        const t0 = Date.now();
        try {
          const result = await safeHealthCheck();
          const latency = Date.now() - t0;
          if (result?.success) {
            appendAgentConsole(`Health OK — ${latency}ms — status: ${result.data?.status || 'healthy'}`, 'success');
            healthBtn.style.boxShadow = '0 0 0 3px rgba(246,157,57,0.3)';
            setTimeout(() => { if (healthBtn) healthBtn.style.boxShadow = ''; }, 1500);
          } else {
            appendAgentConsole(`Health check failed — ${latency}ms`, 'error');
            healthBtn.style.boxShadow = '0 0 0 3px rgba(229,87,62,0.3)';
            setTimeout(() => { if (healthBtn) healthBtn.style.boxShadow = ''; }, 1500);
          }
        } catch (e) {
          appendAgentConsole(`Health check error: ${e.message}`, 'error');
        }
      });
    });

    mlStatusBtn?.addEventListener('click', () => {
      withButtonSpinner(mlStatusBtn, async () => {
        await loadMLModelsStatus();
      });
    });

    const runAnalyzeUrl = async () => {
      const scanInput = document.getElementById('ac-scan-url');
      const url = scanInput?.value?.trim();
      if (!url) {
        appendAgentConsole('Enter a URL in the scan field first.', 'warning');
        return;
      }
      const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
      try {
        appendAgentConsole(`Analyzing: ${url}`, 'cmd');
        const response = await fetch(`${backendUrl}/api/cyberforge-ml/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: url }),
          signal: AbortSignal.timeout(20000)
        });
        const data = await response.json().catch(() => ({}));
        const risk = (data?.risk_level || data?.data?.risk_level || 'unknown').toLowerCase();
        const score = data?.risk_score ?? data?.data?.risk_score ?? '--';
        const preview = (data?.response || data?.data?.response || '').slice(0, 120);
        const isThreat = risk === 'high' || risk === 'critical';
        appendAgentConsole(`Risk: ${risk} (score: ${score}) — ${preview}`, isThreat ? 'error' : 'result');

        // Push to URL monitor feed
        _pushUrlFeedItem(url, isThreat ? 'threat' : 'completed', risk);

        // Update session counters
        _sessionScanCount++;
        _updateKPI('ac-kpi-scans', _sessionScanCount);
        if (isThreat) {
          const curThreats = parseInt(document.getElementById('ac-kpi-threats')?.textContent, 10) || 0;
          _updateKPI('ac-kpi-threats', curThreats + 1);
          prependActivityItem('warning', `Threat detected: ${url} — ${risk} risk`);
        } else {
          prependActivityItem('success', `Scan clean: ${url} — ${risk} risk`);
        }
      } catch (e) {
        appendAgentConsole(`Analyze failed: ${e.message}`, 'error');
        _pushUrlFeedItem(url, 'detected', 'error');
      }
    };

    analyzeBtn?.addEventListener('click', () => {
      withButtonSpinner(analyzeBtn, runAnalyzeUrl);
    });

    scanSubmitBtn?.addEventListener('click', () => {
      withButtonSpinner(scanSubmitBtn, runAnalyzeUrl);
    });

    statsRefreshBtn?.addEventListener('click', () => {
      loadAgentCenterSystemStats();
    });

    resyncHeroBtn?.addEventListener('click', () => {
      withButtonSpinner(resyncHeroBtn, async () => {
        await syncAgentCenterWithBackend();
        await loadMLModelsStatus();
      });
    });

    const sendCommand = async () => {
      const command = commandInput?.value?.trim();
      if (!command) return;
      appendAgentConsole(command, 'cmd');
      commandInput.value = '';

      const lower = command.toLowerCase();

      if (lower === 'help') {
        appendAgentConsole('Commands: help | ping | status | scan <url> | analyze <url> | models | clear', 'info');
        return;
      }

      if (lower === 'clear') {
        const out = document.getElementById('agent-console-output');
        if (out) out.innerHTML = '';
        return;
      }

      if (lower === 'ping') {
        const t0 = Date.now();
        try {
          await safeHealthCheck();
          appendAgentConsole(`pong — ${Date.now() - t0}ms`, 'success');
        } catch (e) {
          appendAgentConsole(`ping failed — ${e.message}`, 'error');
        }
        return;
      }

      if (lower === 'status') {
        await syncAgentCenterWithBackend();
        return;
      }

      if (lower === 'models') {
        await loadMLModelsStatus();
        return;
      }

      if (lower.startsWith('scan ')) {
        const targetUrl = command.slice(5).trim();
        const userId = resolveCurrentUserId();
        const createTaskResult = await safeCreateAgentTask({
          agentId: 'default',
          userId,
          taskType: 'security_scan',
          targetUrl,
          priority: 'normal',
          parameters: { source: 'agent-console' }
        });
        if (createTaskResult?.success) {
          appendAgentConsole(`Task created: ${createTaskResult?.data?.data?.taskId || 'pending'}`, 'success');
          showToast('success', 'Task Created', 'Agent task submitted to backend.');
          loadAgentTasksData();
        } else {
          appendAgentConsole(createTaskResult?.error || 'Task creation failed', 'error');
          showToast('error', 'Task Failed', createTaskResult?.error || 'Backend rejected task');
        }
        return;
      }

      if (lower.startsWith('analyze ')) {
        const targetUrl = command.slice(8).trim();
        const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
        try {
          appendAgentConsole(`Analyzing: ${targetUrl}`, 'info');
          const response = await fetch(`${backendUrl}/api/cyberforge-ml/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: targetUrl }),
            signal: AbortSignal.timeout(20000)
          });
          const data = await response.json().catch(() => ({}));
          const risk = (data?.risk_level || data?.data?.risk_level || 'unknown').toLowerCase();
          const score = data?.risk_score ?? data?.data?.risk_score ?? '--';
          const preview = (data?.response || data?.data?.response || '').slice(0, 150);
          const isThreat = risk === 'high' || risk === 'critical';
          appendAgentConsole(`Risk: ${risk} (score: ${score}) — ${preview}`, isThreat ? 'error' : 'result');
          _pushUrlFeedItem(targetUrl, isThreat ? 'threat' : 'completed', risk);
          _sessionScanCount++;
          _updateKPI('ac-kpi-scans', _sessionScanCount);
          if (isThreat) {
            const cur = parseInt(document.getElementById('ac-kpi-threats')?.textContent, 10) || 0;
            _updateKPI('ac-kpi-threats', cur + 1);
            prependActivityItem('warning', `Threat detected: ${targetUrl} — ${risk} risk`);
          }
        } catch (e) {
          appendAgentConsole(`Analyze failed: ${e.message}`, 'error');
        }
        return;
      }

      appendAgentConsole("Unknown command. Type 'help'.", 'warning');
    };

    sendBtn?.addEventListener('click', sendCommand);
    commandInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendCommand();
      }
    });
  }

  async function syncAgentCenterWithBackend() {
    console.log('[AgentCenter] syncing with backend...');

    const backendEl = document.getElementById('ac-backend');
    const mlEl = document.getElementById('ac-ml');
    const agentCountEl = document.getElementById('ac-agent-count');
    const statusSpinner = document.getElementById('ac-status-spinner');
    const stripBackend = document.getElementById('ac-strip-backend');
    const stripML = document.getElementById('ac-strip-ml');
    const stripAgents = document.getElementById('ac-strip-agents-val');
    const stripSynced = document.getElementById('ac-strip-synced');
    const lastSyncEl = document.getElementById('ac-last-sync');

    if (statusSpinner) statusSpinner.style.display = '';

    const safeListAgents = async () => {
      if (typeof cyberforgeAPI?.listAgents === 'function') {
        return cyberforgeAPI.listAgents();
      }

      const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`${backendUrl}/api/agent/list`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(7000)
      });

      if (!response.ok) throw new Error(`Agent list request failed: HTTP ${response.status}`);

      const payload = await response.json();
      return {
        success: true,
        data: {
          data: {
            agents: payload?.data?.agents || payload?.agents || [],
            count: payload?.data?.count ?? payload?.count ?? 0
          }
        }
      };
    };

    try {
      const [listResult, statusResult, mlResult, healthResult] = await Promise.all([
        safeListAgents(),
        safeGetAgentStatus('default'),
        safeMLHealthCheck(),
        safeHealthCheck()
      ]);

      const backendOk = !!(healthResult?.success);

      // Meta card values
      if (backendEl) { backendEl.textContent = backendOk ? 'Connected' : 'Offline'; backendEl.style.color = backendOk ? '#F69D39' : '#C8452F'; }

      // Status strip chips
      if (stripBackend) {
        stripBackend.className = `ac-chip ${backendOk ? 'ac-chip-online' : 'ac-chip-offline'}`;
        stripBackend.innerHTML = `Backend: ${backendOk ? 'Online' : 'Offline'}`;
      }

      const defaultStatus = statusResult?.data?.data || statusResult?.data || {};
      const isOnline = !!defaultStatus?.isRunning || !!defaultStatus?.running || !!defaultStatus?.exists;
      setAgentControlStatus(isOnline, isOnline ? 'Agent Online' : 'Agent Offline');

      let agentCount = listResult?.data?.data?.count || 0;
      // Desktop app itself is always at least 1 agent when backend is reachable
      if (backendOk && agentCount < 1) agentCount = 1;
      if (agentCountEl) { agentCountEl.textContent = agentCount; agentCountEl.style.color = agentCount > 0 ? '#F69D39' : '#C8452F'; }
      if (stripAgents) stripAgents.textContent = agentCount;

      _updateKPI('ac-kpi-agents', agentCount);
      const taskCount = listResult?.data?.data?.taskCount ?? listResult?.data?.taskCount ?? 0;
      if (taskCount > 0) _updateKPI('ac-kpi-tasks', taskCount);

      const mlHealthy = !!(mlResult?.success && (mlResult?.data?.success || mlResult?.data?.status === 'healthy'));
      if (mlEl) { mlEl.textContent = mlHealthy ? 'Healthy' : 'Degraded'; mlEl.style.color = mlHealthy ? '#F69D39' : '#F69D39'; }
      if (stripML) {
        stripML.className = `ac-chip ${mlHealthy ? 'ac-chip-online' : 'ac-chip-offline'}`;
        stripML.innerHTML = `ML: ${mlHealthy ? 'Healthy' : 'Degraded'}`;
      }

      const syncTime = new Date().toLocaleTimeString();
      if (stripSynced) stripSynced.textContent = `Synced ${syncTime}`;
      if (lastSyncEl) lastSyncEl.textContent = syncTime;

      appendAgentConsole(`Sync: agents=${agentCount}, ml=${mlHealthy ? 'healthy' : 'degraded'}, backend=${backendOk ? 'ok' : 'failed'}`, backendOk ? 'success' : 'warning');
      console.log('[AgentCenter] Backend sync complete');
    } catch (error) {
      setAgentControlStatus(false, 'Backend Unreachable');
      if (backendEl) { backendEl.textContent = 'Unreachable'; backendEl.style.color = '#C8452F'; }
      if (mlEl) { mlEl.textContent = 'Unknown'; mlEl.style.color = '#C8452F'; }
      if (stripBackend) { stripBackend.className = 'ac-chip ac-chip-offline'; stripBackend.textContent = 'Backend: Offline'; }
      if (stripML) { stripML.className = 'ac-chip ac-chip-offline'; stripML.textContent = 'ML: Unknown'; }
      appendAgentConsole(`Backend sync failed: ${error.message}`, 'error');
      console.error('[AgentCenter] Backend sync error:', error);
    } finally {
      if (statusSpinner) statusSpinner.style.display = 'none';
    }
  }

  async function loadMLModelsStatus() {
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const modelCountEl = document.getElementById('ac-ml-model-count');
    const stripModels = document.getElementById('ac-strip-models-val');

    // Map dot data-model → key in ML health response
    const modelKeyMap = {
      phishing: 'phishing_detection',
      malware: 'malware_detection',
      anomaly: 'anomaly_detection',
      webattack: 'web_attack_detection'
    };

    try {
      const response = await fetch(`${backendUrl}/api/cyberforge-ml/health`, { signal: AbortSignal.timeout(18000) });
      const data = await response.json().catch(() => ({}));
      const modelsLoaded = data?.ml_models_loaded || data?.data?.ml_models_loaded || [];
      const modelsAvailable = data?.models_available || data?.data?.models_available || [];

      document.querySelectorAll('#agent-control-page .ac-ml-dot').forEach(dot => {
        const key = dot.dataset.model;
        const backendKey = modelKeyMap[key] || key;
        const isLoaded = modelsLoaded.includes(backendKey) || modelsAvailable.includes(backendKey);
        dot.className = `ac-ml-dot ${isLoaded ? 'online' : 'offline'}`;
      });

      const count = modelsLoaded.length || modelsAvailable.length;
      if (modelCountEl) modelCountEl.textContent = `${count} model${count !== 1 ? 's' : ''}`;
      if (stripModels) stripModels.textContent = count;

      if (count > 0) {
        appendAgentConsole(`ML models: ${count} loaded — ${modelsLoaded.join(', ') || modelsAvailable.join(', ')}`, 'success');
      }
    } catch (e) {
      document.querySelectorAll('#agent-control-page .ac-ml-dot').forEach(dot => {
        dot.className = 'ac-ml-dot offline';
      });
      if (modelCountEl) modelCountEl.textContent = '-- models';
      console.warn('[AgentCenter] ML model status fetch failed:', e.message);
    }
  }

  function animateKPICounters() {
    const targets = [
      { id: 'ac-kpi-agents', target: parseInt(document.getElementById('ac-kpi-agents')?.textContent, 10) || 0 },
      { id: 'ac-kpi-threats', target: parseInt(document.getElementById('ac-kpi-threats')?.textContent, 10) || 0 },
      { id: 'ac-kpi-browsers', target: parseInt(document.getElementById('ac-kpi-browsers')?.textContent, 10) || 0 },
      { id: 'ac-kpi-scans', target: parseInt(document.getElementById('ac-kpi-scans')?.textContent, 10) || 0 },
      { id: 'ac-kpi-tasks', target: parseInt(document.getElementById('ac-kpi-tasks')?.textContent, 10) || 0 }
    ];

    targets.forEach(({ id, target }) => {
      if (!target || target === 0) return;
      const el = document.getElementById(id);
      if (!el) return;

      const duration = 600;
      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        el.textContent = Math.round(progress * target);
        if (progress < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }

  window.CyberForgeAgent = {
    initAgentCenter,
    safeGetAgentAlerts,
    safeStartAgent,
    safeGetAgentStatus,
    safeHealthCheck,
    safeMLHealthCheck,
    safeStopAgent,
    safeCreateAgentTask,
    autoStartDefaultAgent,
    loadAgentCenterSystemStats,
    loadAgentActivityLog,
    refreshAgentOpenBrowsers,
    persistBrowserIntelligence,
    fetchBrowserIntelligenceHistory,
    startBrowserIntelligencePolling,
    stopBrowserIntelligencePolling,
    resolveCurrentUserId,
    setAgentControlStatus,
    appendAgentConsole,
    prependActivityItem,
    bindAgentControlActions,
    syncAgentCenterWithBackend,
    loadMLModelsStatus,
    animateKPICounters,
    withButtonSpinner,
    pushUrlFeedItem: _pushUrlFeedItem
  };
})();
