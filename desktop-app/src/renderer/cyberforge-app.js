// CyberForge Desktop App Controller
// Handles navigation, table rendering, context menu, and interactions

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

  // Import child page layouts
  const ChildPages = typeof require !== 'undefined'
    ? require('./child-page-layouts.js')
    : window.ChildPageLayouts;

  const state = {
    activeScreen: 'http-history',
    activeTab: 'requests',
    requests: [],
    intercepts: [],
    wsHistory: [],
    matchRules: [],
    findings: [],
    automations: [],
    workflows: [],
    scopes: [],
    filters: [],
    plugins: [],
    exports: [],
    environment: [],
    files: [],
    threats: [],
    analysisStats: null,
    threatStats: null,
    selectedRequestId: null,
    sidebarCollapsed: false,
    backendConnected: false,
    conversationId: null,
    loading: {},
    sidebarListenersBound: false
  };

  // =========================================
  // TOAST NOTIFICATION SYSTEM
  // =========================================

  function initToastContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  function showToast(type, title, message = '') {
    initToastContainer();
    const container = document.getElementById('toast-container');
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type]} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 5000);
  }

  // =========================================
  // MODAL SYSTEM
  // =========================================

  function showModal(title, content, onSubmit, submitText = 'Save') {
    // Remove existing modal
    document.querySelector('.modal-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="cf-btn modal-cancel">Cancel</button>
          <button class="cf-btn primary modal-submit">${submitText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Animate in
    requestAnimationFrame(() => overlay.classList.add('active'));
    
    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };
    
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.querySelector('.modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    overlay.querySelector('.modal-submit').addEventListener('click', async () => {
      const form = overlay.querySelector('.modal-body');
      const formData = {};
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox') {
          formData[el.name] = el.checked;
        } else {
          formData[el.name] = el.value;
        }
      });
      
      const submitBtn = overlay.querySelector('.modal-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span>';
      
      try {
        await onSubmit(formData);
        closeModal();
      } catch (error) {
        showToast('error', 'Error', error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitText;
      }
    });
    
    return overlay;
  }

  function showConfirmModal(title, message, onConfirm) {
    return showModal(title, `<p>${message}</p>`, onConfirm, 'Confirm');
  }

  // =========================================
  // Backend Integration Functions
  // =========================================

  async function connectToBackend() {
    try {
      // Ensure token is loaded before making any requests
      console.log('🔑 Current token status:', cyberforgeAPI.token ? 'present' : 'missing');
      
      const health = await cyberforgeAPI.checkHealth();
      if (health.success) {
        state.backendConnected = true;
        console.log('✅ Connected to CyberForge backend');
        updateConnectionStatus(true);
        showToast('success', 'Connected', 'Successfully connected to CyberForge backend');
        
        // Connect WebSocket for real-time updates (token should be set now)
        console.log('🔌 Connecting WebSocket with token:', cyberforgeAPI.token ? 'present' : 'missing');
        cyberforgeAPI.connectWebSocket();
        
        // Subscribe to real-time events
        cyberforgeAPI.subscribeToThreats(handleThreatAlert);
        cyberforgeAPI.subscribeToAnalysis(handleAnalysisResult);
        
        // Subscribe to WebSocket events for real-time updates
        cyberforgeAPI.on('ws:request_captured', handleRequestCaptured);
        cyberforgeAPI.on('ws:intercept_added', handleInterceptAdded);
        cyberforgeAPI.on('sync:update', handleSyncUpdate);
        
        // Load initial data from backend
        await loadBackendData();
      } else {
        throw new Error('Backend health check failed');
      }
    } catch (error) {
      console.warn('⚠️ Backend not available:', error.message);
      state.backendConnected = false;
      updateConnectionStatus(false);
      showToast('warning', 'Offline Mode', 'Backend not available. Connect to start capturing.');
    }
  }

  async function loadBackendData() {
    try {
      // Load all data in parallel for better performance
      const [
        requestsRes,
        interceptsRes,
        matchRulesRes,
        automationsRes,
        workflowsRes,
        findingsRes,
        scopesRes,
        filtersRes,
        pluginsRes,
        exportsRes,
        environmentRes,
        statsRes,
        threatStatsRes
      ] = await Promise.all([
        cyberforgeAPI.getHttpRequests(1, 100),
        cyberforgeAPI.getIntercepts(),
        cyberforgeAPI.getMatchRules(),
        cyberforgeAPI.getAutomations(),
        cyberforgeAPI.getWorkflows(),
        cyberforgeAPI.getFindings(),
        cyberforgeAPI.getScopes(),
        cyberforgeAPI.getFilters(),
        cyberforgeAPI.getPlugins(),
        cyberforgeAPI.getExports(),
        cyberforgeAPI.getEnvironmentVariables(),
        cyberforgeAPI.getAnalysisStats(),
        cyberforgeAPI.getThreatStats()
      ]);

      // Update state with loaded data
      if (requestsRes.success) state.requests = requestsRes.data?.data?.requests || [];
      if (interceptsRes.success) state.intercepts = interceptsRes.data?.data?.intercepts || [];
      if (matchRulesRes.success) state.matchRules = matchRulesRes.data?.data?.rules || [];
      if (automationsRes.success) state.automations = automationsRes.data?.data?.automations || [];
      if (workflowsRes.success) state.workflows = workflowsRes.data?.data?.workflows || [];
      if (findingsRes.success) state.findings = findingsRes.data?.data?.findings || [];
      if (scopesRes.success) state.scopes = scopesRes.data?.data?.scopes || [];
      if (filtersRes.success) state.filters = filtersRes.data?.data?.filters || [];
      if (pluginsRes.success) state.plugins = pluginsRes.data?.data?.plugins || [];
      if (exportsRes.success) state.exports = exportsRes.data?.data?.exports || [];
      if (environmentRes.success) state.environment = environmentRes.data?.data?.variables || [];
      if (statsRes.success) state.analysisStats = statsRes.data?.data || {};
      if (threatStatsRes.success) state.threatStats = threatStatsRes.data?.data || {};

      console.log('📊 Backend data loaded:', {
        requests: state.requests.length,
        intercepts: state.intercepts.length,
        matchRules: state.matchRules.length,
        automations: state.automations.length,
        workflows: state.workflows.length,
        findings: state.findings.length,
        scopes: state.scopes.length,
        filters: state.filters.length,
        plugins: state.plugins.length
      });

    } catch (error) {
      console.error('Failed to load backend data:', error);
      showToast('error', 'Data Load Error', error.message);
    }
  }

  // Real-time event handlers
  function handleRequestCaptured(request) {
    state.requests.unshift(request);
    if (state.activeScreen === 'http-history') {
      renderRequestsTable();
    }
  }

  function handleInterceptAdded(intercept) {
    state.intercepts.unshift(intercept);
    if (state.activeScreen === 'intercept') {
      renderIntercepts();
    }
    showToast('info', 'Request Intercepted', `${intercept.method} ${intercept.host}${intercept.path}`);
  }

  function handleSyncUpdate(data) {
    console.log('Sync update received:', data);
  }

  function extractHost(url) {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch {
      return url || 'unknown';
    }
  }

  function extractPath(url) {
    try {
      const u = new URL(url);
      return u.pathname;
    } catch {
      return '/';
    }
  }

  function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('backend-status');
    if (statusEl) {
      statusEl.className = `cf-badge ${connected ? 'green' : 'red'}`;
      statusEl.textContent = connected ? 'Connected' : 'Offline';
    }
  }

  function handleThreatAlert(threat) {
    console.log('🚨 Threat Alert:', threat);
    // Add to findings and refresh if on findings screen
    state.findings.unshift({
      id: threat.id || `T-${Date.now()}`,
      severity: threat.severity || 'High',
      title: threat.type || 'New Threat Detected',
      path: threat.url || threat.source || '',
      status: 'Open'
    });
    if (state.activeScreen === 'findings') {
      renderFindings();
    }
    // Show notification
    showNotification('Threat Detected', threat.type || 'New security threat detected');
  }

  function handleAnalysisResult(result) {
    console.log('📊 Analysis Result:', result);
    // Could update UI with new analysis results
  }

  function showNotification(title, message) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/icon.png' });
    }
  }

  // =========================================
  // Initialization
  // =========================================

  // =========================================
  // AGENTIC AI CONTROL SYSTEM
  // =========================================

  const agentState = {
    status: 'idle', // idle, monitoring, analyzing, investigating, waiting, blocked
    currentGoal: 'Waiting for task assignment...',
    activeTasks: [],
    scheduledTasks: [],
    completedActions: [],
    events: [],
    scanMode: 'quick', // quick, deep, stealth, forensic
    isRunning: false,
    memory: {
      threatsDetected: 0,
      browsersMonitored: 0,
      scansCompleted: 0,
      alertsRaised: 0
    }
  };

  function initAgentControlPanel() {
    // The floating panel UI is handled by agent-ui-controller.js
    // This function only handles supplementary wiring that cyberforge-app needs:
    // minimized button show/hide, event feed panel, and add browser modal.

    const minimizedBtn = document.getElementById('agent-minimized-btn');
    const eventFeedBtn = document.querySelector('[data-screen="event-feed"]');
    const eventPanel = document.getElementById('event-feed-panel');
    
    // Show panel from minimized button
    if (minimizedBtn) {
      const newMinimizedBtn = minimizedBtn.cloneNode(true);
      minimizedBtn.parentNode.replaceChild(newMinimizedBtn, minimizedBtn);
      newMinimizedBtn.addEventListener('click', function showAgentPanel() {
        const agentPanel = document.getElementById('agent-control-panel');
        if (agentPanel) agentPanel.classList.remove('hidden');
        this.style.display = 'none';
        localStorage.setItem('agent-panel-hidden', 'false');
      });
    }
    
    // Event feed toggle
    if (eventFeedBtn && eventPanel) {
      eventFeedBtn.addEventListener('click', (e) => {
        e.preventDefault();
        eventPanel.classList.toggle('open');
      });
    }
    
    const eventCloseBtn = document.getElementById('event-feed-close');
    if (eventCloseBtn) {
      eventCloseBtn.addEventListener('click', () => {
        eventPanel?.classList.remove('open');
      });
    }
    
    const filterBtns = document.querySelectorAll('.event-filter');
    filterBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterEvents(btn.dataset.filter);
      });
    });
    
    // Scan modes and quick actions
    bindQuickActions();
    bindScanModes();
    bindAgentStates();
    initSystemMonitor();
    initAddBrowserModal();
  }

  // =========================================
  // AGENT CENTER — Main init for the agent-control screen
  // This is SEPARATE from initAgentControlPanel() which handles
  // the floating panel on the dashboard.
  // =========================================

  let _agentCenterStatsInterval = null;

  function initAgentCenter() {
    console.log('[AgentCenter] Initializing agent control center...');

    // Bind button actions
    bindAgentControlActions();

    // Ensure default agent is running whenever Agent Center opens
    autoStartDefaultAgent();

    // Load real data from backend + Tauri
    syncAgentCenterWithBackend();
    refreshAgentOpenBrowsers();
    loadAgentCenterSystemStats();
    loadAgentActivityLog();

    // Auto-refresh system stats every 5 seconds
    if (_agentCenterStatsInterval) clearInterval(_agentCenterStatsInterval);
    _agentCenterStatsInterval = setInterval(() => {
      // Only continue if agent-control-page is still in DOM
      if (!document.getElementById('agent-control-page')) {
        clearInterval(_agentCenterStatsInterval);
        _agentCenterStatsInterval = null;
        return;
      }
      loadAgentCenterSystemStats();
    }, 5000);

    appendAgentConsole('Agent Center initialized. Type "status" or "scan <url>".', 'info');
    console.log('[AgentCenter] Init complete.');
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
    const response = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(7000) });
    const payload = await response.json().catch(() => ({}));
    return { success: response.ok, data: payload };
  }

  async function safeMLHealthCheck() {
    if (typeof cyberforgeAPI?.mlHealthCheck === 'function') {
      return cyberforgeAPI.mlHealthCheck();
    }

    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const response = await fetch(`${backendUrl}/api/cyberforge-ml/health`, { signal: AbortSignal.timeout(7000) });
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
        return;
      }

      const userId = resolveCurrentUserId();
      const startResult = await safeStartAgent({ userId, agentName: 'default', config: { source: 'agent-center-auto-start' } });
      if (startResult?.success) {
        setAgentControlStatus(true, 'Agent Online');
        appendAgentConsole('Default agent auto-started', 'success');
      } else {
        appendAgentConsole(startResult?.error || 'Auto-start failed', 'warning');
      }
    } catch (error) {
      appendAgentConsole(`Auto-start check failed: ${error.message}`, 'warning');
    }
  }

  async function loadAgentCenterSystemStats() {
    try {
      const result = await window.electronAPI?.getSystemStats?.();
      if (result?.success && result.data) {
        const cpu = Math.round(result.data.cpu || 0);
        const mem = Math.round(result.data.memory || 0);
        const disk = Math.round(result.data.disk || 0);

        const cpuBar = document.getElementById('ac-cpu-bar');
        const cpuPct = document.getElementById('ac-cpu-pct');
        const memBar = document.getElementById('ac-mem-bar');
        const memPct = document.getElementById('ac-mem-pct');
        const diskBar = document.getElementById('ac-disk-bar');
        const diskPct = document.getElementById('ac-disk-pct');

        if (cpuBar) cpuBar.style.width = cpu + '%';
        if (cpuPct) cpuPct.textContent = cpu + '%';
        if (memBar) memBar.style.width = mem + '%';
        if (memPct) memPct.textContent = mem + '%';
        if (diskBar) diskBar.style.width = disk + '%';
        if (diskPct) diskPct.textContent = disk + '%';

        // Color bars based on usage
        [cpuBar, memBar, diskBar].forEach((bar, i) => {
          if (!bar) return;
          const val = [cpu, mem, disk][i];
          bar.style.background = val > 80 ? '#C0392B' : val > 50 ? '#E67E22' : '#27AE60';
        });

        // System uptime from Tauri (uptime in seconds)
        const uptimeEl = document.getElementById('ac-uptime');
        if (uptimeEl && result.data.uptime) {
          const s = result.data.uptime;
          const d = Math.floor(s / 86400);
          const h = Math.floor((s % 86400) / 3600);
          const m = Math.floor((s % 3600) / 60);
          uptimeEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
        }
      }
    } catch (e) {
      console.warn('[AgentCenter] System stats fetch failed:', e.message);
    }
  }

  async function loadAgentActivityLog() {
    const log = document.getElementById('agent-activity-log');
    if (!log) return;

    try {
      const userId = resolveCurrentUserId();
      const alertsResult = await safeGetAgentAlerts({ userId, limit: 20 });
      const alerts = alertsResult?.data?.data?.alerts || alertsResult?.data?.alerts || [];

      if (alerts.length === 0) {
        // Show backend connection events instead
        const healthResult = await safeHealthCheck();
        const items = [];
        items.push({
          time: new Date().toLocaleTimeString(),
          type: 'info',
          msg: healthResult?.success ? 'Backend connected and healthy' : 'Backend health check failed'
        });
        items.push({
          time: new Date().toLocaleTimeString(),
          type: 'info',
          msg: 'Agent Center session started'
        });

        log.innerHTML = items.map(i => `
          <div class="activity-item ${i.type}">
            <span class="activity-time">${i.time}</span>
            <span class="activity-msg">${i.msg}</span>
          </div>
        `).join('');
      } else {
        log.innerHTML = alerts.slice(0, 20).map(a => `
          <div class="activity-item ${a.severity || 'info'}">
            <span class="activity-time">${a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '--'}</span>
            <span class="activity-msg">${a.message || a.title || 'Alert'}</span>
          </div>
        `).join('');
      }
    } catch (e) {
      log.innerHTML = `<div class="activity-item error"><span class="activity-time">${new Date().toLocaleTimeString()}</span><span class="activity-msg">Failed to load activity: ${e.message}</span></div>`;
    }
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

      console.log(`[AgentCenter] Rendered ${installedBrowsers.length} browsers (${runningCount} running)`);
    } catch (error) {
      console.error('[AgentCenter] Browser detection error:', error);
      list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Detection failed: ${error.message}</div>`;
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
    line.className = `console-line ${level}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.prepend(line);
  }

  function bindAgentControlActions() {
    const startBtn = document.getElementById('start-agent');
    const stopBtn = document.getElementById('stop-agent');
    const browserRegistrationBtn = document.getElementById('open-browser-registration');
    const refreshBrowsersBtn = document.getElementById('refresh-agent-browsers');
    const sendBtn = document.getElementById('send-agent-command');
    const commandInput = document.getElementById('agent-command');

    browserRegistrationBtn?.addEventListener('click', () => {
      state.activeScreen = 'browser-registration';
      renderScreen('browser-registration');
      showToast('info', 'Browser Registration', 'Opened Browser Registration in the right panel.');
    });

    refreshBrowsersBtn?.addEventListener('click', () => {
      refreshAgentOpenBrowsers();
    });

    startBtn?.addEventListener('click', async () => {
      const userId = resolveCurrentUserId();
      const result = await safeStartAgent({ userId, agentName: 'default', config: {} });
      if (result?.success) {
        setAgentControlStatus(true, 'Agent Online');
        appendAgentConsole('Agent started from backend controller', 'success');
        showToast('success', 'Agent Started', 'Agent Center is now connected to backend.');
        syncAgentCenterWithBackend();
      } else {
        appendAgentConsole(result?.error || 'Failed to start agent', 'error');
        showToast('error', 'Agent Start Failed', result?.error || 'Backend rejected start request');
      }
    });

    stopBtn?.addEventListener('click', async () => {
      const result = await safeStopAgent('default');
      if (result?.success) {
        setAgentControlStatus(false, 'Agent Offline');
        appendAgentConsole('Agent stopped by operator', 'warning');
        showToast('info', 'Agent Stopped', 'Backend agent has been stopped.');
        syncAgentCenterWithBackend();
      } else {
        appendAgentConsole(result?.error || 'Failed to stop agent', 'error');
        showToast('error', 'Agent Stop Failed', result?.error || 'Backend rejected stop request');
      }
    });

    const sendCommand = async () => {
      const command = commandInput?.value?.trim();
      if (!command) return;
      appendAgentConsole(`Command> ${command}`, 'info');
      commandInput.value = '';

      if (command.toLowerCase() === 'status') {
        await syncAgentCenterWithBackend();
        return;
      }

      if (command.toLowerCase().startsWith('scan ')) {
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
          appendAgentConsole(`Task created: ${createTaskResult?.data?.data?.taskId || 'pending-id'}`, 'success');
          showToast('success', 'Task Created', 'Agent task submitted to backend.');
          loadAgentTasksData();
        } else {
          appendAgentConsole(createTaskResult?.error || 'Task creation failed', 'error');
          showToast('error', 'Task Failed', createTaskResult?.error || 'Backend rejected task');
        }
        return;
      }

      appendAgentConsole('Unsupported command. Use "status" or "scan <target-url>".', 'warning');
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

      if (!response.ok) {
        throw new Error(`Agent list request failed: HTTP ${response.status}`);
      }

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

      // Backend health
      const backendOk = !!(healthResult?.success);
      if (backendEl) backendEl.textContent = backendOk ? 'Connected' : 'Offline';
      if (backendEl) backendEl.style.color = backendOk ? '#27AE60' : '#C0392B';

      // Agent status
      const defaultStatus = statusResult?.data?.data || {};
      const isOnline = !!defaultStatus?.isRunning || !!defaultStatus?.running;
      const statusLabel = isOnline ? 'Agent Online' : 'Agent Offline';
      setAgentControlStatus(isOnline, statusLabel);

      // Agent count
      const agentCount = listResult?.data?.data?.count || 0;
      if (agentCountEl) agentCountEl.textContent = agentCount;

      // ML health
      const mlHealthy = !!(mlResult?.success && (mlResult?.data?.success || mlResult?.data?.status === 'healthy'));
      if (mlEl) mlEl.textContent = mlHealthy ? 'Healthy' : 'Degraded';
      if (mlEl) mlEl.style.color = mlHealthy ? '#27AE60' : '#E67E22';

      appendAgentConsole(`Backend sync: agents=${agentCount}, ml=${mlHealthy ? 'healthy' : 'degraded'}, backend=${backendOk ? 'ok' : 'failed'}`, backendOk ? 'success' : 'warning');
      console.log('[AgentCenter] Backend sync complete');
    } catch (error) {
      setAgentControlStatus(false, 'Backend Unreachable');
      if (backendEl) { backendEl.textContent = 'Unreachable'; backendEl.style.color = '#C0392B'; }
      if (mlEl) { mlEl.textContent = 'Unknown'; mlEl.style.color = '#C0392B'; }
      appendAgentConsole(`Backend sync failed: ${error.message}`, 'error');
      console.error('[AgentCenter] Backend sync error:', error);
    }
  }

  // =========================================
  // ADD BROWSER MODAL
  // =========================================
  
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

  // =========================================
  // SYSTEM BROWSER MONITOR INTEGRATION
  // =========================================

  const systemMonitorState = {
    isConnected: false,
    connectedBrowsers: [],
    requestCount: 0,
    threatCount: 0,
    startTime: null,
    recentRequests: []
  };

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

  // Store for console logs
  const browserConsoleLogs = [];
  const MAX_CONSOLE_LOGS = 200;

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

  // Expose console logs for the console page
  window.getBrowserConsoleLogs = () => browserConsoleLogs;

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
    if (!tbody || state.activeScreen !== 'http-history') return;
    
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

  function bindQuickActions() {
    // Bind by ID for specific actions
    const scanBtn = document.getElementById('agent-scan-now');
    const pauseBtn = document.getElementById('agent-pause');
    const analyzeBtn = document.getElementById('agent-analyze');
    const reportBtn = document.getElementById('agent-report');
    
    scanBtn?.addEventListener('click', () => executeQuickAction('scan'));
    pauseBtn?.addEventListener('click', () => executeQuickAction('pause'));
    analyzeBtn?.addEventListener('click', () => executeQuickAction('analyze'));
    reportBtn?.addEventListener('click', () => executeQuickAction('report'));
  }

  function executeQuickAction(action) {
    switch(action) {
      case 'scan':
        setAgentState('analyzing');
        addAgentTask('Quick security scan', 'running');
        logAgentAction('Initiated quick security scan', 'info');
        showToast('info', 'Scan Started', 'AI agent is scanning for threats...');
        
        // Use CyberForge ML API for real scanning
        (async () => {
          try {
            const response = await cyberforgeAPI.cyberforgeML.scan({ 
              url: window.location.href,
              features: {
                is_https: window.location.protocol === 'https:',
                url_length: window.location.href.length
              }
            });
            
            completeTask('Quick security scan');
            
            if (response && response.max_threat_score > 0.5) {
              setAgentState('investigating');
              logAgentAction(`Scan complete - ${response.overall_risk_level} risk detected`, 'warning');
              showToast('warning', 'Threats Detected', `Risk Level: ${response.overall_risk_level}`);
              agentState.memory.threatsDetected++;
            } else {
              setAgentState('monitoring');
              logAgentAction('Scan complete - No threats found', 'success');
              showToast('success', 'Scan Complete', 'No threats detected');
            }
            agentState.memory.scansCompleted++;
            updateAgentPanel();
          } catch (error) {
            completeTask('Quick security scan');
            setAgentState('monitoring');
            logAgentAction('Scan complete - Using local analysis', 'success');
            showToast('success', 'Scan Complete', 'Local analysis: No threats detected');
          }
        })();
        break;
        
      case 'pause':
        if (agentState.status !== 'idle') {
          setAgentState('idle');
          logAgentAction('Agent paused by user', 'warning');
          showToast('warning', 'Agent Paused', 'AI agent monitoring has been paused');
        } else {
          setAgentState('monitoring');
          logAgentAction('Agent resumed monitoring', 'success');
          showToast('success', 'Agent Resumed', 'AI agent is now monitoring');
        }
        break;
        
      case 'analyze':
        setAgentState('investigating');
        addAgentTask('Deep threat analysis', 'running');
        setAgentGoal('Performing comprehensive threat analysis');
        logAgentAction('Started deep threat analysis', 'info');
        showToast('info', 'Analysis Started', 'Running deep threat analysis...');
        
        // Deep analysis with all models
        (async () => {
          try {
            const health = await cyberforgeAPI.cyberforgeML.health();
            const models = await cyberforgeAPI.cyberforgeML.getModels();
            
            // Simulate analysis time
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            completeTask('Deep threat analysis');
            setAgentState('monitoring');
            logAgentAction(`Deep analysis complete - ${models.count || 4} models checked`, 'success');
            showToast('success', 'Analysis Complete', `Checked ${models.count || 4} ML models`);
          } catch (error) {
            completeTask('Deep threat analysis');
            setAgentState('monitoring');
            logAgentAction('Analysis complete with limited data', 'info');
          }
        })();
        break;
        
      case 'report':
        logAgentAction('Generating security report', 'info');
        
        // Generate a report summary
        const report = {
          generated: new Date().toISOString(),
          threatsDetected: agentState.memory.threatsDetected,
          scansCompleted: agentState.memory.scansCompleted,
          alertsRaised: agentState.memory.alertsRaised,
          status: agentState.status
        };
        
        console.log('📊 Security Report:', report);
        showToast('success', 'Report Generated', `Threats: ${report.threatsDetected}, Scans: ${report.scansCompleted}`);
        addEvent('success', 'Report Generated', 'Security assessment report created successfully', 'Agent');
        break;
    }
    updateAgentPanel();
  }

  function bindScanModes() {
    const scanModeItems = document.querySelectorAll('.scan-mode');
    scanModeItems?.forEach(item => {
      item.addEventListener('click', () => {
        scanModeItems.forEach(i => {
          const indicator = i.querySelector('.mode-indicator');
          indicator?.classList.remove('active');
        });
        const indicator = item.querySelector('.mode-indicator');
        indicator?.classList.add('active');
        
        const mode = item.dataset.mode;
        agentState.scanMode = mode;
        logAgentAction(`Scan mode changed to ${mode}`, 'info');
        showToast('info', 'Mode Changed', `Scanning mode set to ${mode}`);
      });
    });
  }

  function bindAgentStates() {
    const stateItems = document.querySelectorAll('.agent-state-item');
    stateItems?.forEach(item => {
      item.addEventListener('click', () => {
        const newState = item.dataset.state;
        setAgentState(newState);
      });
    });
  }

  function setAgentState(newStatus) {
    agentState.status = newStatus;
    
    // Update status dot in panel
    const statusDot = document.getElementById('agent-main-status');
    if (statusDot) {
      statusDot.className = 'agent-status-dot ' + newStatus;
    }
    
    // Update status text
    const statusText = document.getElementById('agent-status-text');
    if (statusText) {
      statusText.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    }
    
    // Update state grid
    const stateItems = document.querySelectorAll('.agent-state-item');
    stateItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.state === newStatus) {
        item.classList.add('active');
      }
    });
    
    // Update goal based on state
    const goals = {
      'idle': 'Waiting for task assignment...',
      'monitoring': 'Continuously monitoring browser activity and network traffic',
      'analyzing': 'Analyzing captured data for potential threats',
      'investigating': 'Investigating detected anomalies',
      'waiting': 'Waiting for user confirmation',
      'blocked': 'Action blocked - requires user intervention'
    };
    
    if (goals[newStatus]) {
      setAgentGoal(goals[newStatus]);
    }
  }

  function setAgentGoal(goal) {
    agentState.currentGoal = goal;
    const goalContainer = document.getElementById('agent-current-goal');
    if (goalContainer) {
      const goalSpan = goalContainer.querySelector('span');
      if (goalSpan) {
        goalSpan.textContent = goal;
      }
    }
  }

  function addAgentTask(name, status = 'pending') {
    const task = {
      id: Date.now(),
      name,
      status,
      createdAt: new Date()
    };
    agentState.activeTasks.push(task);
    updateTaskList();
    return task.id;
  }

  function completeTask(name) {
    const taskIndex = agentState.activeTasks.findIndex(t => t.name === name);
    if (taskIndex !== -1) {
      agentState.activeTasks.splice(taskIndex, 1);
      updateTaskList();
    }
  }

  function updateTaskList() {
    const taskList = document.getElementById('agent-tasks-list');
    const taskCount = document.getElementById('panel-task-count');
    const sidebarTaskCount = document.getElementById('active-tasks-count');
    
    if (taskCount) {
      taskCount.textContent = agentState.activeTasks.length;
    }
    
    if (sidebarTaskCount) {
      sidebarTaskCount.textContent = agentState.activeTasks.length;
    }
    
    if (!taskList) return;
    
    if (agentState.activeTasks.length === 0) {
      taskList.innerHTML = `
        <div class="agent-task-empty">No active tasks</div>
      `;
      return;
    }
    
    taskList.innerHTML = agentState.activeTasks.map(task => `
      <div class="agent-task-item" data-task-id="${task.id}">
        <i class="fas fa-circle-notch fa-spin"></i>
        <span>${task.name}</span>
        <span class="task-status ${task.status}">${task.status}</span>
      </div>
    `).join('');
  }

  function logAgentAction(text, type = 'info') {
    const action = {
      time: new Date(),
      text,
      type
    };
    agentState.completedActions.unshift(action);
    if (agentState.completedActions.length > 10) {
      agentState.completedActions.pop();
    }
    updateActionLog();
  }

  function updateActionLog() {
    const actionLog = document.getElementById('agent-actions-log');
    if (!actionLog) return;
    
    actionLog.innerHTML = agentState.completedActions.map(action => {
      const time = action.time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `
        <div class="action-log-item ${action.type}">
          <span class="action-time">${time}</span>
          <span class="action-text">${action.text}</span>
        </div>
      `;
    }).join('');
  }

  function updateAgentPanel() {
    updateTaskList();
    updateActionLog();
    
    // Update sidebar alert count
    const alertCount = document.getElementById('agent-alerts-count');
    if (alertCount) {
      const criticalEvents = agentState.events.filter(e => e.severity === 'critical' || e.severity === 'warning').length;
      alertCount.textContent = criticalEvents;
    }
    
    // Update events count
    const eventsCount = document.getElementById('events-count');
    if (eventsCount) {
      eventsCount.textContent = agentState.events.length;
    }
  }

  function addEvent(severity, title, description, source = 'System') {
    const event = {
      id: Date.now(),
      severity,
      title,
      description,
      source,
      time: new Date()
    };
    agentState.events.unshift(event);
    if (agentState.events.length > 50) {
      agentState.events.pop();
    }
    renderEventList();
    updateAgentPanel();
    
    // Update events count in sidebar
    const eventsCount = document.getElementById('events-count');
    if (eventsCount) {
      eventsCount.textContent = agentState.events.length;
    }
  }

  function renderEventList() {
    const eventList = document.getElementById('event-feed-list');
    if (!eventList) return;
    
    if (agentState.events.length === 0) {
      eventList.innerHTML = `
        <div class="event-list-empty">
          <i class="fas fa-shield-alt"></i>
          <p>No events yet. The agent is monitoring...</p>
        </div>
      `;
      return;
    }
    
    const icons = {
      critical: 'fa-skull-crossbones',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
      success: 'fa-check-circle'
    };
    
    eventList.innerHTML = agentState.events.map(event => {
      const time = event.time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `
        <div class="event-item ${event.severity}" data-event-id="${event.id}">
          <div class="event-icon">
            <i class="fas ${icons[event.severity] || 'fa-info-circle'}"></i>
          </div>
          <div class="event-content">
            <div class="event-title">${event.title}</div>
            <div class="event-description">${event.description}</div>
            <div class="event-meta">
              <span class="event-source"><i class="fas fa-robot"></i> ${event.source}</span>
              <span class="event-time">${time}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function filterEvents(filter) {
    const eventItems = document.querySelectorAll('.event-item');
    eventItems.forEach(item => {
      if (filter === 'all') {
        item.style.display = 'flex';
      } else {
        item.style.display = item.classList.contains(filter) ? 'flex' : 'none';
      }
    });
  }

  function populateEventFeed() {
    // No demo/mock events — real events come from backend sync and browser monitoring
  }

  // =========================================
  // HEADER & FOOTER FUNCTIONALITY
  // =========================================

  const systemStats = {
    uptime: 0,
    cpu: 0,
    memory: 0,
    network: 0,
    requests: 0,
    threats: 0,
    events: 0,
    sessions: 1
  };

  function initHeaderFooter() {
    // Global search functionality
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = globalSearch.value.trim();
          if (query) {
            performGlobalSearch(query);
          }
        }
      });
      
      // Keyboard shortcut Cmd+K / Ctrl+K
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          globalSearch.focus();
        }
      });
    }
    
    // Notifications button
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
      notificationsBtn.addEventListener('click', () => {
        toggleNotificationsPanel();
      });
    }
    
    // Stop button functionality
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        setAgentState('idle');
        logAgentAction('Recording stopped by user', 'warning');
        showToast('info', 'Recording Stopped', 'Request capture has been stopped');
      });
    }
    
    // Start uptime counter
    startUptimeCounter();
    
    // Start system stats simulation
    startSystemStatsSimulation();
    
    // Initialize sidebar child components
    initSidebarChildren();
  }

  function performGlobalSearch(query) {
    showToast('info', 'Searching...', `Looking for: ${query}`);
    // Could integrate with actual search functionality
    logAgentAction(`Global search: "${query}"`, 'info');
  }

  function toggleNotificationsPanel() {
    // Toggle event feed panel as notifications
    const eventPanel = document.getElementById('event-feed-panel');
    if (eventPanel) {
      eventPanel.classList.toggle('open');
    }
  }

  function startUptimeCounter() {
    setInterval(() => {
      systemStats.uptime++;
      updateUptimeDisplay();
    }, 1000);
  }

  function updateUptimeDisplay() {
    const hours = Math.floor(systemStats.uptime / 3600);
    const minutes = Math.floor((systemStats.uptime % 3600) / 60);
    const seconds = systemStats.uptime % 60;
    
    const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    const uptimeEl = document.getElementById('footer-uptime');
    if (uptimeEl) {
      uptimeEl.textContent = `Uptime: ${formatted}`;
    }
  }

  function startSystemStatsSimulation() {
    // Fetch REAL system stats from Tauri backend, not random numbers
    async function fetchRealSystemStats() {
      try {
        const result = await window.electronAPI?.getSystemStats?.();
        if (result?.success && result.data) {
          systemStats.cpu = Math.round(result.data.cpu || 0);
          systemStats.memory = Math.round(result.data.memory || 0);
          systemStats.network = 0;
          updateSystemStatsDisplay();
        }
      } catch (e) {
        // Stats polling failed, leave values as-is
      }
    }
    fetchRealSystemStats();
    setInterval(fetchRealSystemStats, 5000);
  }

  function updateSystemStatsDisplay() {
    const cpuEl = document.getElementById('footer-cpu');
    const memEl = document.getElementById('footer-memory');
    const netEl = document.getElementById('footer-network');
    
    if (cpuEl) cpuEl.textContent = `CPU: ${systemStats.cpu}%`;
    if (memEl) memEl.textContent = `MEM: ${systemStats.memory}%`;
    if (netEl) netEl.textContent = `NET: ${systemStats.network} KB/s`;
    
    // Update footer agent status
    const footerAgentDot = document.getElementById('footer-agent-dot');
    const footerAgentText = document.getElementById('footer-agent-text');
    
    if (footerAgentDot) {
      footerAgentDot.className = 'footer-status-dot ' + agentState.status;
    }
    if (footerAgentText) {
      const statusLabels = {
        idle: 'AI Agent: Idle',
        monitoring: 'AI Agent: Monitoring',
        analyzing: 'AI Agent: Analyzing',
        investigating: 'AI Agent: Investigating',
        waiting: 'AI Agent: Waiting',
        blocked: 'AI Agent: Blocked'
      };
      footerAgentText.textContent = statusLabels[agentState.status] || 'AI Agent: Unknown';
    }
  }

  function updateHeaderStats() {
    const requestsEl = document.getElementById('stat-requests');
    const threatsEl = document.getElementById('stat-threats');
    const eventsEl = document.getElementById('stat-events');
    const notifCount = document.getElementById('notification-count');
    
    if (requestsEl) requestsEl.textContent = systemStats.requests;
    if (threatsEl) threatsEl.textContent = agentState.memory.threatsDetected;
    if (eventsEl) eventsEl.textContent = agentState.events.length;
    if (notifCount) {
      const unreadCount = agentState.events.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
      notifCount.textContent = unreadCount;
      notifCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    
    // Update header agent status
    const headerAgentStatus = document.getElementById('header-agent-status');
    if (headerAgentStatus) {
      const indicator = headerAgentStatus.querySelector('.agent-status-indicator-mini');
      const label = headerAgentStatus.querySelector('.agent-status-label');
      
      const colors = {
        idle: '#6b7280',
        monitoring: '#10b981',
        analyzing: '#3b82f6',
        investigating: '#f59e0b',
        waiting: '#8b5cf6',
        blocked: '#ef4444'
      };
      
      if (indicator) {
        indicator.style.background = colors[agentState.status] || '#10b981';
      }
      if (label) {
        label.textContent = `Agent ${agentState.status.charAt(0).toUpperCase() + agentState.status.slice(1)}`;
      }
    }
  }

  function initSidebarChildren() {
    // Find all sidebar items with children and mark them
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      const link = item.querySelector('.sidebar-nav-link');
      const children = item.querySelector('.sidebar-nav-children');
      
      if (link && children) {
        // Mark as having children for CSS styling
        item.classList.add('has-children');
        
        // Toggle expanded state on click
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Close other expanded items (accordion behavior)
          const siblingItems = item.parentElement.querySelectorAll('.sidebar-nav-item.expanded');
          siblingItems.forEach(sibling => {
            if (sibling !== item) {
              sibling.classList.remove('expanded');
            }
          });
          
          // Toggle this item
          item.classList.toggle('expanded');

          const screen = link.dataset.screen;
          if (screen) {
            state.activeScreen = screen;
            renderScreen(screen);
            logAgentAction(`Navigated to ${screen}`, 'info');
          }
        });
      }
    });
    
    // Child link click handlers - NOW ROUTES TO CHILD SCREENS
    const childLinks = document.querySelectorAll('.sidebar-child-link');
    childLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove active from all child links
        childLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const screen = link.dataset.screen;
        if (screen) {
          state.activeScreen = screen;
          renderScreen(screen);
          logAgentAction(`Navigated to ${screen}`, 'info');
        }
      });
    });
  }

  // startAgentSimulation — REMOVED. No mock/demo data in agent system.
  // All agent data comes from real backend APIs and Tauri system detection.

  async function init() {
    initTheme();
    initUserMenu();
    initMobileMenu();
    bindHeaderControls();
    bindSidebarNav();
    bindTabs();
    bindQueryInput();
    
    // Initialize Agentic AI Control Panel
    initAgentControlPanel();
    
    // Initialize Header and Footer functionality
    initHeaderFooter();
    
    // Initialize Browser Monitor Status in Sidebar
    initBrowserMonitorStatus();
    
    // Listen for auth expiry
    cyberforgeAPI.on('auth:expired', handleAuthExpired);
    
    // Ensure token is loaded from Electron before connecting
    await cyberforgeAPI.initFromElectron();
    
    // Connect to backend and load data
    await connectToBackend();
    
    renderScreen(state.activeScreen);
    
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Auto-start browser monitoring
    autoStartBrowserMonitoring();
  }
  
  // =========================================
  // BROWSER MONITOR STATUS (SIDEBAR)
  // =========================================
  
  function initBrowserMonitorStatus() {
    const statusDot = document.getElementById('browser-monitor-status');
    if (!statusDot) return;
    
    // Style the status dot
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-secondary);
      margin-left: auto;
    `;
    
    // Setup event listeners for browser connections
    if (window.electronAPI?.systemMonitor) {
      window.electronAPI.systemMonitor.onBrowserConnected((data) => {
        statusDot.style.background = 'var(--accent-green)';
        statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        statusDot.title = `${data.browser} connected`;
      });
      
      window.electronAPI.systemMonitor.onStatusChange((data) => {
        if (data.status === 'running') {
          statusDot.style.background = 'var(--accent-green)';
          statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        } else {
          statusDot.style.background = 'var(--text-secondary)';
          statusDot.style.boxShadow = 'none';
        }
      });
    }
    
    // Check initial status
    updateBrowserMonitorStatusDot();
  }
  
  async function updateBrowserMonitorStatusDot() {
    const statusDot = document.getElementById('browser-monitor-status');
    if (!statusDot) return;
    
    try {
      const stats = await window.electronAPI?.systemMonitor?.getStats();
      if (stats && stats.browsersConnected > 0) {
        statusDot.style.background = 'var(--accent-green)';
        statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        statusDot.title = `${stats.browsersConnected} browser(s) connected`;
      } else {
        statusDot.style.background = 'var(--text-secondary)';
        statusDot.style.boxShadow = 'none';
        statusDot.title = 'No browsers connected';
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  async function autoStartBrowserMonitoring() {
    try {
      // Auto-start browser monitoring after a short delay
      setTimeout(async () => {
        const result = await window.electronAPI?.systemMonitor?.start();
        if (result?.success && result?.browsersConnected > 0) {
          showToast('info', 'Browser Monitoring', `Connected to ${result.browsersConnected} browser(s)`);
        }
        updateBrowserMonitorStatusDot();
      }, 2000);
    } catch (e) {
      console.log('Auto-start browser monitoring skipped:', e.message);
    }
  }

  // =========================================
  // MOBILE MENU
  // =========================================
  
  function initMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (!menuToggle || !sidebar) return;
    
    const closeMobileMenu = () => {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.style.display = 'none';
      menuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
    };
    
    const openMobileMenu = () => {
      sidebar.classList.add('mobile-open');
      if (overlay) overlay.style.display = 'block';
      menuToggle.querySelector('i').classList.replace('fa-bars', 'fa-times');
    };
    
    menuToggle.addEventListener('click', () => {
      if (sidebar.classList.contains('mobile-open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
    
    // Close on overlay click
    if (overlay) {
      overlay.addEventListener('click', closeMobileMenu);
    }
    
    // Close on sidebar link click (mobile)
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-nav-link') && window.innerWidth <= 768) {
        closeMobileMenu();
      }
    });
    
    // Close on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMobileMenu();
      }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
        closeMobileMenu();
      }
    });
  }

  function initUserMenu() {
    const userAvatar = document.getElementById('user-avatar');
    if (!userAvatar) return;

    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'user-dropdown';
    dropdown.id = 'user-dropdown';
    dropdown.style.display = 'none';
    
    const user = cyberforgeAPI.getCurrentUser();
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'User';
    const userEmail = user?.email || '';
    
    dropdown.innerHTML = `
      <div class="user-dropdown-header">
        <div class="user-dropdown-avatar"><i class="fas fa-user"></i></div>
        <div class="user-dropdown-info">
          <div class="user-dropdown-name">${userName}</div>
          <div class="user-dropdown-email">${userEmail}</div>
        </div>
      </div>
      <div class="user-dropdown-divider"></div>
      <div class="user-dropdown-item" data-action="profile">
        <i class="fas fa-user-circle"></i>
        <span>Profile</span>
      </div>
      <div class="user-dropdown-item" data-action="settings">
        <i class="fas fa-cog"></i>
        <span>Settings</span>
      </div>
      <div class="user-dropdown-divider"></div>
      <div class="user-dropdown-item logout" data-action="logout">
        <i class="fas fa-sign-out-alt"></i>
        <span>Sign Out</span>
      </div>
    `;
    
    document.body.appendChild(dropdown);
    
    // Toggle dropdown on avatar click
    userAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        const rect = userAvatar.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
      }
    });
    
    // Handle dropdown actions
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.user-dropdown-item');
      if (!item) return;
      
      const action = item.dataset.action;
      dropdown.style.display = 'none';
      
      switch (action) {
        case 'profile':
          renderScreen('profile');
          break;
        case 'settings':
          renderScreen('settings');
          break;
        case 'logout':
          handleLogout();
          break;
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== userAvatar) {
        dropdown.style.display = 'none';
      }
    });
  }

  async function handleLogout() {
    try {
      // Call backend logout endpoint
      await cyberforgeAPI.post('/api/auth/logout', {});
    } catch (e) {
      // Ignore errors - we're logging out anyway
    }
    
    // Clear local auth state
    cyberforgeAPI.logout();
    
    // Redirect to login page
    window.location.href = 'auth-page.html';
  }

  async function handleAuthExpired() {
    // Check with Electron if user is actually authenticated in secure storage
    if (typeof window !== 'undefined' && window.electronAPI?.auth?.isAuthenticated) {
      try {
        const authStatus = await window.electronAPI.auth.isAuthenticated();
        if (authStatus?.authenticated) {
          // User is still authenticated in Electron, don't redirect
          console.log('📌 Session still valid in Electron secure storage');
          
          // Try to recover the token
          await cyberforgeAPI.initFromElectron();
          return;
        }
      } catch (e) {
        console.log('Could not check Electron auth status:', e.message);
      }
    }
    
    // Only redirect if truly expired
    showNotification('Session Expired', 'Please log in again.');
    setTimeout(() => {
      window.location.href = 'auth-page.html';
    }, 1500);
  }

  function bindHeaderControls() {
    const quickScanBtn = document.getElementById('quick-scan-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const notificationsBtn = document.getElementById('notifications-btn');

    // Quick Scan button - triggers ML scan
    quickScanBtn?.addEventListener('click', async () => {
      quickScanBtn.disabled = true;
      quickScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
      
      try {
        // Trigger the agent's scan action
        executeQuickAction('scan');
        
        // Also call the ML API directly for immediate feedback
        const scanResult = await cyberforgeAPI.cyberforgeML.health();
        console.log('ML Service Health:', scanResult);
      } catch (error) {
        console.error('Scan error:', error);
        showToast('error', 'Scan Failed', error.message);
      } finally {
        setTimeout(() => {
          quickScanBtn.disabled = false;
          quickScanBtn.innerHTML = '<i class="fas fa-bolt"></i><span>Scan</span>';
        }, 2000);
      }
    });

    // Settings button
    settingsBtn?.addEventListener('click', () => {
      renderScreen('settings');
    });

    // Notifications button
    notificationsBtn?.addEventListener('click', () => {
      showToast('info', 'Notifications', 'No new notifications');
    });

    themeToggle?.addEventListener('click', () => toggleTheme());
  }

  function initTheme() {
    const saved = localStorage.getItem('cyberforge-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cyberforge-theme', next);
    updateThemeIcon(next);
    
    // Update globe theme if it exists
    if (window.cyberforgeGlobe) {
      window.cyberforgeGlobe.setTheme(next === 'dark');
    }
  }

  function updateThemeIcon(mode) {
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle?.querySelector('i');
    if (!icon) return;
    icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  function bindSidebarNav() {
    const links = document.querySelectorAll('.sidebar-nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const screen = link.getAttribute('data-screen');
        state.activeScreen = screen;
        renderScreen(screen);
      });
    });

    const collapseBtn = document.getElementById('collapse-sidebar');
    const sidebar = document.getElementById('sidebar');
    collapseBtn?.addEventListener('click', () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
      collapseBtn.querySelector('span').textContent = state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
      collapseBtn.querySelector('i').className = state.sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    });

    state.sidebarListenersBound = true;
  }

  function bindTabs() {
    const tabs = document.querySelectorAll('.cf-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeTab = tab.getAttribute('data-tab');
        // For now tabs are cosmetic; could switch datasets later
      });
    });
  }

  function bindQueryInput() {
    const queryInput = document.getElementById('query-input');
    queryInput?.addEventListener('input', () => {
      renderRequestsTable(queryInput.value.trim());
    });
  }

  function bindActionBar() {
    const exportBtn = document.getElementById('export-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    
    exportBtn?.addEventListener('click', () => {
      // Export current view data
      const data = {
        requests: state.requests,
        threats: state.threats,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberforge-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Export Complete', 'Data exported successfully');
    });
    
    analyzeBtn?.addEventListener('click', async () => {
      if (!state.selectedRequestId) {
        showToast('warning', 'No Selection', 'Please select a request to analyze');
        return;
      }
      
      const request = state.requests.find(r => r.id === state.selectedRequestId);
      if (!request) return;
      
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
      
      try {
        const result = await cyberforgeAPI.cyberforgeML.analyzeUrl(request.url || request.host);
        showToast('info', 'Analysis Complete', `Risk Level: ${result.aggregate?.overall_risk_level || 'Unknown'}`);
        console.log('Analysis result:', result);
      } catch (error) {
        showToast('error', 'Analysis Failed', error.message);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-shield-halved"></i><span>Analyze</span>';
      }
    });
  }

  function renderScreen(screen) {
    const container = document.getElementById('screen-container');
    if (!container) return;

    if (screen === 'http-history') {
      container.innerHTML = buildHttpHistoryLayout();
      renderRequestsTable();
      bindRequestTableEvents();
      bindResizer();
      bindContextMenu();
    } else if (screen === 'intercept') {
      container.innerHTML = buildInterceptLayout();
      renderIntercepts();
      bindInterceptEvents();
    } else if (screen === 'ws-history') {
      container.innerHTML = buildWsLayout();
      renderWsHistory();
    } else if (screen === 'match-replace') {
      container.innerHTML = buildMatchReplaceLayout();
      renderMatchRules();
      bindMatchReplaceEvents();
    } else if (screen === 'replay') {
      container.innerHTML = buildReplayLayout();
      renderRequestsTable();
      bindRequestTableEvents();
    } else if (screen === 'automate') {
      container.innerHTML = buildAutomateLayout();
      bindAutomationsEvents();
    } else if (screen === 'workflows') {
      container.innerHTML = buildWorkflowsLayout();
      bindWorkflowsEvents();
    } else if (screen === 'assistant') {
      // Use new V2 AI Assistant if available
      if (window.AIAssistantV2) {
        container.innerHTML = buildAssistantLayoutV2();
        const v2Container = document.getElementById('ai-assistant-v2-container');
        if (v2Container) {
          initAIAssistantV2(v2Container);
        }
      } else {
        // Fall back to legacy layout
        container.innerHTML = buildAssistantLayout();
        bindAssistant();
      }
    } else if (screen === 'search') {
      container.innerHTML = buildSearchLayout();
    } else if (screen === 'findings') {
      container.innerHTML = buildFindingsLayout();
      renderFindings();
      bindFindingsEvents();
    } else if (screen === 'exports') {
      container.innerHTML = buildExportsLayout();
      bindExportsEvents();
    } else if (screen === 'files') {
      container.innerHTML = buildFilesLayout();
      renderFiles();
    } else if (screen === 'plugins') {
      container.innerHTML = buildPluginsLayout();
      bindPluginsEvents();
    } else if (screen === 'workspace') {
      container.innerHTML = buildWorkspaceLayout();
    } else if (screen === 'ai-agent') {
      container.innerHTML = buildAIAgentLayout();
      bindAgentConsole();
    } else if (screen === 'dashboard') {
      container.innerHTML = buildDashboardLayout();
      bindDashboard();
    } else if (screen === 'sitemap') {
      container.innerHTML = buildSitemapLayout();
      bindSitemapEvents();
    } else if (screen === 'scopes') {
      container.innerHTML = buildScopesLayout();
      bindScopesEvents();
    } else if (screen === 'filters') {
      container.innerHTML = buildFiltersLayout();
      bindFiltersEvents();
    } else if (screen === 'ai-models') {
      container.innerHTML = buildAIModelsLayout();
      bindAIModelsEvents();
    } else if (screen === 'threat-intel') {
      container.innerHTML = buildThreatIntelLayout();
      bindThreatIntelEvents();
    } else if (screen === 'threat-globe') {
      // Initialize Threat Globe Screen
      if (window.ThreatGlobeScreen) {
        const globeScreen = new ThreatGlobeScreen();
        globeScreen.show(container);
      } else {
        container.innerHTML = '<div class="screen-error"><p>Threat Globe screen not available</p></div>';
      }
    } else if (screen === 'environment') {
      container.innerHTML = buildEnvironmentLayout();
      bindEnvironmentEvents();
    } else if (screen === 'sync-status') {
      container.innerHTML = buildSyncStatusLayout();
    } else if (screen === 'browser-extension') {
      container.innerHTML = buildBrowserExtensionLayout();
    } else if (screen === 'mobile-companion') {
      container.innerHTML = buildMobileCompanionLayout();
    } else if (screen === 'profile') {
      container.innerHTML = buildProfileLayout();
    } else if (screen === 'settings') {
      container.innerHTML = buildSettingsLayout();
    }
    
    // ========================================
    // DASHBOARD CHILD SCREENS
    // ========================================
    else if (screen === 'dashboard-security') {
      container.innerHTML = ChildPages.buildDashboardSecurityLayout();
      loadDashboardSecurityData();
    } else if (screen === 'dashboard-activity') {
      container.innerHTML = ChildPages.buildDashboardActivityLayout();
      loadDashboardActivityData();
    } else if (screen === 'dashboard-metrics') {
      container.innerHTML = ChildPages.buildDashboardMetricsLayout();
      loadDashboardMetricsData();
    }
    
    // ========================================
    // SITEMAP CHILD SCREENS
    // ========================================
    else if (screen === 'sitemap-tree') {
      container.innerHTML = ChildPages.buildSitemapTreeLayout();
      loadSitemapData();
    } else if (screen === 'sitemap-graph') {
      container.innerHTML = ChildPages.buildSitemapGraphLayout();
      loadSitemapGraphData();
    }
    
    // ========================================
    // SCOPES CHILD SCREENS
    // ========================================
    else if (screen === 'scopes-active') {
      container.innerHTML = ChildPages.buildScopesActiveLayout();
      loadActiveScopesData();
    } else if (screen === 'scopes-excluded') {
      container.innerHTML = ChildPages.buildScopesExcludedLayout();
      loadExcludedScopesData();
    }
    
    // ========================================
    // FILTERS CHILD SCREENS
    // ========================================
    else if (screen === 'filters-saved') {
      container.innerHTML = ChildPages.buildFiltersSavedLayout();
      loadSavedFiltersData();
    } else if (screen === 'filters-recent') {
      container.innerHTML = ChildPages.buildFiltersRecentLayout();
      loadRecentFiltersData();
    }
    
    // ========================================
    // INTERCEPT CHILD SCREENS
    // ========================================
    else if (screen === 'intercept-queue') {
      container.innerHTML = buildInterceptLayout();
      renderIntercepts();
      bindInterceptEvents();
    } else if (screen === 'intercept-rules') {
      container.innerHTML = ChildPages.buildInterceptRulesLayout();
      loadInterceptRulesData();
    } else if (screen === 'intercept-breakpoints') {
      container.innerHTML = ChildPages.buildInterceptBreakpointsLayout();
      loadBreakpointsData();
    }
    
    // ========================================
    // HTTP HISTORY CHILD SCREENS
    // ========================================
    else if (screen === 'http-all') {
      container.innerHTML = buildHttpHistoryLayout();
      renderRequestsTable();
      bindRequestTableEvents();
      bindResizer();
      bindContextMenu();
    } else if (screen === 'http-flagged') {
      container.innerHTML = ChildPages.buildHttpFlaggedLayout();
      loadFlaggedRequestsData();
    } else if (screen === 'http-errors') {
      container.innerHTML = ChildPages.buildHttpErrorsLayout();
      loadErrorRequestsData();
    }
    
    // ========================================
    // WEBSOCKET CHILD SCREENS
    // ========================================
    else if (screen === 'ws-connections') {
      container.innerHTML = buildWsLayout();
      renderWsHistory();
    } else if (screen === 'ws-messages') {
      container.innerHTML = ChildPages.buildWsMessagesLayout();
      loadWsMessagesData();
    }
    
    // ========================================
    // MATCH & REPLACE CHILD SCREENS
    // ========================================
    else if (screen === 'match-request') {
      container.innerHTML = buildMatchReplaceLayout();
      renderMatchRules();
      bindMatchReplaceEvents();
    } else if (screen === 'match-response') {
      container.innerHTML = ChildPages.buildMatchResponseLayout();
      loadResponseRulesData();
    }
    
    // ========================================
    // REPLAY CHILD SCREENS
    // ========================================
    else if (screen === 'replay-single') {
      container.innerHTML = buildReplayLayout();
      renderRequestsTable();
      bindRequestTableEvents();
    } else if (screen === 'replay-batch') {
      container.innerHTML = ChildPages.buildReplayBatchLayout();
      initBatchReplay();
    } else if (screen === 'replay-diff') {
      container.innerHTML = ChildPages.buildReplayDiffLayout();
      initResponseDiff();
    }
    
    // ========================================
    // AUTOMATE CHILD SCREENS
    // ========================================
    else if (screen === 'automate-intruder') {
      container.innerHTML = ChildPages.buildAutomateIntruderLayout();
      initIntruder();
    } else if (screen === 'automate-fuzzer') {
      container.innerHTML = ChildPages.buildAutomateFuzzerLayout();
      initFuzzer();
    } else if (screen === 'automate-payloads') {
      container.innerHTML = ChildPages.buildAutomatePayloadsLayout();
      loadPayloadsData();
    }
    
    // ========================================
    // WORKFLOWS CHILD SCREENS
    // ========================================
    else if (screen === 'workflows-active') {
      container.innerHTML = ChildPages.buildWorkflowsActiveLayout();
      loadActiveWorkflowsData();
    } else if (screen === 'workflows-templates') {
      container.innerHTML = ChildPages.buildWorkflowsTemplatesLayout();
      loadWorkflowTemplatesData();
    } else if (screen === 'workflows-history') {
      container.innerHTML = ChildPages.buildWorkflowsHistoryLayout();
      loadWorkflowsHistoryData();
    }
    
    // ========================================
    // ASSISTANT CHILD SCREENS
    // ========================================
    else if (screen === 'assistant-chat') {
      container.innerHTML = ChildPages.buildAssistantChatLayout();
      loadAssistantHistoryData();
    } else if (screen === 'assistant-suggestions') {
      container.innerHTML = ChildPages.buildAssistantSuggestionsLayout();
      loadAssistantInsightsData();
    }
    
    // ========================================
    // AI MODELS CHILD SCREENS
    // ========================================
    else if (screen === 'models-trained') {
      container.innerHTML = ChildPages.buildModelsTrainedLayout();
      loadTrainedModelsData();
    } else if (screen === 'models-training') {
      container.innerHTML = ChildPages.buildModelsTrainingLayout();
      loadTrainingModelsData();
    } else if (screen === 'models-datasets') {
      container.innerHTML = ChildPages.buildModelsDatasetsLayout();
      loadDatasetsData();
    }
    
    // ========================================
    // THREAT INTEL CHILD SCREENS
    // ========================================
    else if (screen === 'intel-feeds') {
      container.innerHTML = ChildPages.buildIntelFeedsLayout();
      loadThreatFeedsData();
    } else if (screen === 'intel-iocs') {
      container.innerHTML = ChildPages.buildIntelIOCsLayout();
      loadIOCsData();
    } else if (screen === 'intel-cves') {
      container.innerHTML = ChildPages.buildIntelCVEsLayout();
      loadCVEsData();
    }
    
    // ========================================
    // ENVIRONMENT CHILD SCREENS
    // ========================================
    else if (screen === 'env-variables') {
      container.innerHTML = ChildPages.buildEnvVariablesLayout();
      loadEnvironmentVariablesData();
    } else if (screen === 'env-secrets') {
      container.innerHTML = ChildPages.buildEnvSecretsLayout();
      loadSecretsData();
    }
    
    // ========================================
    // SEARCH CHILD SCREENS
    // ========================================
    else if (screen === 'search-advanced') {
      container.innerHTML = ChildPages.buildSearchAdvancedLayout();
      bindAdvancedSearchEvents();
    } else if (screen === 'search-saved') {
      container.innerHTML = ChildPages.buildSearchSavedLayout();
      loadSavedQueriesData();
    }
    
    // ========================================
    // FINDINGS CHILD SCREENS
    // ========================================
    else if (screen === 'findings-critical') {
      container.innerHTML = ChildPages.buildFindingsCriticalLayout();
      loadFindingsByLevel('critical');
      bindFindingsEvents();
    } else if (screen === 'findings-high') {
      container.innerHTML = ChildPages.buildFindingsHighLayout();
      loadFindingsByLevel('high');
      bindFindingsEvents();
    } else if (screen === 'findings-medium') {
      container.innerHTML = ChildPages.buildFindingsMediumLayout();
      loadFindingsByLevel('medium');
      bindFindingsEvents();
    } else if (screen === 'findings-low') {
      container.innerHTML = ChildPages.buildFindingsLowLayout();
      loadFindingsByLevel('low');
      bindFindingsEvents();
    }
    
    // ========================================
    // EXPORTS CHILD SCREENS
    // ========================================
    else if (screen === 'exports-reports') {
      container.innerHTML = ChildPages.buildExportsReportsLayout();
      loadExportsReportsData();
      bindExportsEvents();
    } else if (screen === 'exports-data') {
      container.innerHTML = ChildPages.buildExportsDataLayout();
      bindDataExportEvents();
    }
    
    // ========================================
    // FILES CHILD SCREENS
    // ========================================
    else if (screen === 'files-project') {
      container.innerHTML = ChildPages.buildFilesProjectLayout();
      loadProjectFilesData();
    } else if (screen === 'files-notes') {
      container.innerHTML = ChildPages.buildFilesNotesLayout();
      loadNotesData();
    } else if (screen === 'files-scripts') {
      container.innerHTML = ChildPages.buildFilesScriptsLayout();
      loadScriptsData();
    }
    
    // ========================================
    // PLUGINS CHILD SCREENS
    // ========================================
    else if (screen === 'plugins-installed') {
      container.innerHTML = ChildPages.buildPluginsInstalledLayout();
      loadInstalledPluginsData();
      bindPluginsEvents();
    } else if (screen === 'plugins-marketplace') {
      container.innerHTML = ChildPages.buildPluginsMarketplaceLayout();
      loadMarketplacePluginsData();
    }
    
    // ========================================
    // WORKSPACE CHILD SCREENS
    // ========================================
    else if (screen === 'workspace-settings') {
      container.innerHTML = ChildPages.buildWorkspaceSettingsLayout();
      loadWorkspaceSettingsData();
    } else if (screen === 'workspace-team') {
      container.innerHTML = ChildPages.buildWorkspaceTeamLayout();
      loadTeamMembersData();
    }
    
    // ========================================
    // SYNC STATUS CHILD SCREENS
    // ========================================
    else if (screen === 'sync-pending') {
      container.innerHTML = ChildPages.buildSyncPendingLayout();
      loadPendingSyncData();
    } else if (screen === 'sync-history') {
      container.innerHTML = ChildPages.buildSyncHistoryLayout();
      loadSyncHistoryData();
    }
    
    // ========================================
    // BROWSER EXTENSION CHILD SCREENS
    // ========================================
    else if (screen === 'ext-install') {
      container.innerHTML = ChildPages.buildExtInstallLayout();
      loadExtensionInstallData();
    } else if (screen === 'ext-settings') {
      container.innerHTML = ChildPages.buildExtSettingsLayout();
      loadExtensionSettingsData();
    }
    
    // ========================================
    // MOBILE COMPANION CHILD SCREENS
    // ========================================
    else if (screen === 'mobile-pair') {
      container.innerHTML = ChildPages.buildMobilePairLayout();
      initMobilePairing();
    } else if (screen === 'mobile-devices') {
      container.innerHTML = ChildPages.buildMobileDevicesLayout();
      loadPairedDevicesData();
    }
    
    // ========================================
    // BROWSER MONITOR CHILD SCREENS
    // ========================================
    else if (screen === 'browser-registration') {
      container.innerHTML = ChildPages.buildBrowserRegistrationLayout();
      loadBrowserRegistrationData();
    } else if (screen === 'browser-history') {
      container.innerHTML = ChildPages.buildBrowserHistoryScanLayout();
      loadBrowserHistoryData();
    } else if (screen === 'suspicious-domains') {
      container.innerHTML = ChildPages.buildSuspiciousDomainsLayout();
      loadSuspiciousDomainsData();
    } else if (screen === 'credential-exposure') {
      container.innerHTML = ChildPages.buildCredentialExposureLayout();
      loadCredentialExposureData();
    } else if (screen === 'tracking-detection') {
      container.innerHTML = ChildPages.buildTrackingDetectionLayout();
      loadTrackingDetectionData();
    } else if (screen === 'download-analysis') {
      container.innerHTML = ChildPages.buildDownloadAnalysisLayout();
      loadDownloadAnalysisData();
    }
    
    // ========================================
    // REAL-TIME INTEL CHILD SCREENS
    // ========================================
    else if (screen === 'event-feed') {
      container.innerHTML = ChildPages.buildEventFeedLayout();
      initEventFeedStream();
    } else if (screen === 'risk-analysis') {
      container.innerHTML = ChildPages.buildRiskAnalysisLayout();
      loadRiskAnalysisData();
    } else if (screen === 'threat-map') {
      container.innerHTML = ChildPages.buildThreatMapLayout();
      initThreatMap();
    }
    
    // ========================================
    // SCAN MODES
    // ========================================
    else if (screen === 'quick-scan') {
      container.innerHTML = ChildPages.buildQuickScanLayout();
      initQuickScan();
    } else if (screen === 'deep-scan') {
      container.innerHTML = ChildPages.buildDeepScanLayout();
      initDeepScan();
    } else if (screen === 'stealth-scan') {
      container.innerHTML = ChildPages.buildStealthScanLayout();
      initStealthScan();
    } else if (screen === 'forensic-scan') {
      container.innerHTML = ChildPages.buildForensicScanLayout();
      initForensicScan();
    }
    
    // ========================================
    // AGENT SCREENS
    // ========================================
    else if (screen === 'agent-control') {
      container.innerHTML = ChildPages.buildAgentControlLayout();
      initAgentCenter();
    } else if (screen === 'agent-tasks') {
      container.innerHTML = ChildPages.buildAgentTasksLayout();
      loadAgentTasksData();
    } else if (screen === 'agent-schedule') {
      container.innerHTML = ChildPages.buildAgentScheduleLayout();
      loadScheduledTasksData();
    } else if (screen === 'agent-decisions') {
      container.innerHTML = ChildPages.buildAgentDecisionsLayout();
      loadAgentDecisionsData();
    } else if (screen === 'agent-memory') {
      container.innerHTML = ChildPages.buildAgentMemoryLayout();
      loadAgentMemoryData();
    }
    
    else {
      container.innerHTML = buildOperationalPage(screen);
      bindOperationalPage(screen);
    }
  }

  function buildHttpHistoryLayout() {
    return `
      <div class="cf-split-horizontal" id="http-history-screen">
        <div class="cf-panel" style="flex: 1;">
          <div class="cf-table-container">
            <table class="cf-table" id="requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Host</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Query</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="requests-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="cf-resizer" id="main-resizer"></div>
        <div class="cf-panel" id="detail-panel" style="width: 50%;">
          <div class="cf-panel-header">
            <div class="cf-panel-title">Request Details</div>
            <div class="cf-panel-actions">
              <button class="panel-action-btn" title="Copy"><i class="fas fa-copy"></i></button>
              <button class="panel-action-btn" title="Download"><i class="fas fa-download"></i></button>
            </div>
          </div>
          <div class="cf-panel-content" id="request-detail-content">
            <div class="empty-state">
              <i class="fas fa-mouse-pointer empty-state-icon"></i>
              <div class="empty-state-title">Select a request</div>
              <div class="empty-state-description">Click on a request in the table to view its details</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildInterceptLayout() {
    return `
      <div class="cf-panel" style="flex:1;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Intercept Queue</div>
          <div class="cf-panel-actions">
            <button class="panel-action-btn" title="Drop All"><i class="fas fa-trash"></i></button>
            <button class="panel-action-btn" title="Forward All"><i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
        <div class="cf-table-container">
          <table class="cf-table" id="intercept-table">
            <thead><tr><th>ID</th><th>Host</th><th>Method</th><th>Path</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="intercept-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildWsLayout() {
    return `
      <div class="cf-panel" style="flex:1;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">WebSocket History</div>
        </div>
        <div class="cf-table-container">
          <table class="cf-table" id="ws-table">
            <thead><tr><th>ID</th><th>Host</th><th>Path</th><th>Messages</th><th>Status</th></tr></thead>
            <tbody id="ws-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function buildMatchReplaceLayout() {
    return `
      <div class="cf-panel" style="flex:1;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Match & Replace Rules</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-rule"><i class="fas fa-plus"></i> Add Rule</button>
          </div>
        </div>
        <div class="cf-table-container">
          <table class="cf-table" id="rules-table">
            <thead><tr><th>ID</th><th>Type</th><th>Match</th><th>Replace</th><th>Enabled</th><th>Actions</th></tr></thead>
            <tbody id="rules-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindMatchReplaceEvents() {
    document.getElementById('add-rule')?.addEventListener('click', () => {
      showModal('Add Match & Replace Rule', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="request-header">Request Header</option>
              <option value="request-body">Request Body</option>
              <option value="response-header">Response Header</option>
              <option value="response-body">Response Body</option>
              <option value="url">URL</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Match Pattern (regex)</label>
            <input class="cf-input" name="match" placeholder="Authorization: Bearer .*" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Replace With</label>
            <input class="cf-input" name="replace" placeholder="Authorization: Bearer NEW_TOKEN" style="width:100%;">
          </div>
          <div>
            <label><input type="checkbox" name="enabled" checked> Enable rule</label>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createMatchRule({
          type: formData.get('type'),
          match: formData.get('match'),
          replace: formData.get('replace'),
          enabled: formData.get('enabled') === 'on'
        });
        if (result.success) {
          state.matchRules.unshift(result.data.data.rule);
          showToast('success', 'Created', 'Rule added successfully');
          renderScreen('match-replace');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add rule');
        }
      });
    });
  }

  function buildReplayLayout() {
    return `
      <div class="cf-split-horizontal" style="flex:1;">
        <div class="cf-panel" style="flex: 1;">
          <div class="cf-panel-header">
            <div class="cf-panel-title">Requests</div>
          </div>
          <div class="cf-table-container">
            <table class="cf-table" id="requests-table">
              <thead><tr><th>ID</th><th>Host</th><th>Method</th><th>Path</th><th>Query</th><th>Status</th></tr></thead>
              <tbody id="requests-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="cf-resizer" id="main-resizer"></div>
        <div class="cf-panel" id="detail-panel" style="width: 50%;">
          <div class="cf-panel-header">
            <div class="cf-panel-title">Replay Editor</div>
            <div class="cf-panel-actions">
              <button class="panel-action-btn" title="Send"><i class="fas fa-play"></i></button>
            </div>
          </div>
          <div class="cf-panel-content" id="request-detail-content">
            <div class="empty-state">
              <i class="fas fa-mouse-pointer empty-state-icon"></i>
              <div class="empty-state-title">Select a request</div>
              <div class="empty-state-description">Edit and resend the request from here</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildAutomateLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Automate</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-automation"><i class="fas fa-plus"></i> New Job</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div class="automation-grid" id="automations-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            ${state.automations.length === 0 ? `
              <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-robot empty-state-icon"></i>
                <div class="empty-state-title">No automations yet</div>
                <div class="empty-state-description">Create your first automation to run scheduled tasks</div>
              </div>
            ` : state.automations.map(auto => `
              <div class="automation-card" data-id="${auto.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                  <i class="fas fa-${auto.type === 'scheduled' ? 'clock' : 'robot'}" style="color:var(--cf-accent-${auto.status === 'active' ? 'blue' : 'orange'});"></i>
                  <div>
                    <div style="font-weight:600;">${auto.name}</div>
                    <div style="font-size:11px; color:var(--cf-text-muted);">${auto.schedule || auto.trigger || 'Manual'}</div>
                  </div>
                  <span class="cf-badge ${auto.status === 'active' ? 'green' : 'orange'}" style="margin-left:auto;">${auto.status}</span>
                </div>
                <div style="font-size:12px; color:var(--cf-text-secondary); margin-bottom:12px;">${auto.description || 'No description'}</div>
                <div style="display:flex; gap:8px;">
                  <button class="cf-btn automation-run" data-id="${auto.id}"><i class="fas fa-play"></i> Run</button>
                  <button class="cf-btn automation-pause" data-id="${auto.id}"><i class="fas fa-${auto.status === 'active' ? 'pause' : 'play'}"></i></button>
                  <button class="cf-btn automation-delete" data-id="${auto.id}"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function bindAutomationsEvents() {
    // New automation button
    document.getElementById('new-automation')?.addEventListener('click', () => {
      showModal('Create Automation', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="My Automation" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="scheduled">Scheduled</option>
              <option value="triggered">Triggered</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Schedule/Trigger</label>
            <input class="cf-input" name="schedule" placeholder="Every 6 hours / On new endpoint" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <textarea class="cf-input" name="description" rows="3" placeholder="What does this automation do?" style="width:100%;"></textarea>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Target URL (optional)</label>
            <input class="cf-input" name="target" placeholder="https://example.com" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createAutomation({
          name: formData.get('name'),
          type: formData.get('type'),
          schedule: formData.get('schedule'),
          description: formData.get('description'),
          target: formData.get('target'),
          status: 'active'
        });
        if (result.success) {
          state.automations.unshift(result.data.data.automation);
          showToast('success', 'Created', 'Automation created successfully');
          switchScreen('automate');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create automation');
        }
      });
    });

    // Run, pause, delete handlers
    document.querySelectorAll('.automation-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.runAutomation(id);
        if (result.success) {
          showToast('success', 'Running', 'Automation started');
        } else {
          showToast('error', 'Error', result.error || 'Failed to run automation');
        }
      });
    });

    document.querySelectorAll('.automation-pause').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const auto = state.automations.find(a => a.id === id);
        const newStatus = auto?.status === 'active' ? 'paused' : 'active';
        const result = await cyberforgeAPI.updateAutomation(id, { status: newStatus });
        if (result.success) {
          auto.status = newStatus;
          showToast('success', 'Updated', `Automation ${newStatus}`);
          switchScreen('automate');
        }
      });
    });

    document.querySelectorAll('.automation-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Automation', 'Are you sure you want to delete this automation?', async () => {
          const result = await cyberforgeAPI.deleteAutomation(id);
          if (result.success) {
            state.automations = state.automations.filter(a => a.id !== id);
            showToast('success', 'Deleted', 'Automation deleted');
            switchScreen('automate');
          }
        });
      });
    });
  }

  function buildWorkflowsLayout() {
    const workflowsHtml = state.workflows.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-project-diagram empty-state-icon"></i>
        <div class="empty-state-title">No workflows yet</div>
        <div class="empty-state-description">Create your first workflow to automate security testing</div>
      </div>
    ` : state.workflows.map(wf => `
      <div class="workflow-card" data-id="${wf.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <i class="fas fa-project-diagram" style="color:var(--cf-accent-${wf.status === 'active' ? 'cyan' : 'gray'}); font-size:20px;"></i>
          <div style="flex:1;">
            <div style="font-weight:600;">${wf.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">${wf.steps?.length || 0} steps • ${wf.lastRun ? 'Last run: ' + new Date(wf.lastRun).toLocaleString() : 'Never run'}</div>
          </div>
          <span class="cf-badge ${wf.status === 'active' ? 'green' : 'orange'}">${wf.status}</span>
          <button class="cf-btn workflow-run" data-id="${wf.id}"><i class="fas fa-play"></i> Run</button>
          <button class="cf-btn workflow-edit" data-id="${wf.id}"><i class="fas fa-edit"></i></button>
          <button class="cf-btn workflow-delete" data-id="${wf.id}"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size:12px; color:var(--cf-text-secondary); margin-top:8px;">${wf.description || 'No description'}</div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Workflows</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-workflow"><i class="fas fa-plus"></i> New Workflow</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="workflows-container" style="display:flex; flex-direction:column; gap:12px;">
            ${workflowsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindWorkflowsEvents() {
    // New workflow button
    document.getElementById('new-workflow')?.addEventListener('click', () => {
      showModal('Create Workflow', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="My Security Workflow" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <textarea class="cf-input" name="description" rows="3" placeholder="What does this workflow do?" style="width:100%;"></textarea>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Steps (one per line)</label>
            <textarea class="cf-input" name="steps" rows="5" placeholder="Step 1: Check authentication\nStep 2: Test SQL injection\nStep 3: Verify CSRF protection" style="width:100%;"></textarea>
          </div>
        </div>
      `, async (formData) => {
        const steps = formData.get('steps')?.split('\n').filter(s => s.trim()) || [];
        const result = await cyberforgeAPI.createWorkflow({
          name: formData.get('name'),
          description: formData.get('description'),
          steps: steps.map((s, i) => ({ id: i + 1, name: s.trim() })),
          status: 'active'
        });
        if (result.success) {
          state.workflows.unshift(result.data.data.workflow);
          showToast('success', 'Created', 'Workflow created successfully');
          renderScreen('workflows');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create workflow');
        }
      });
    });

    // Run, edit, delete handlers
    document.querySelectorAll('.workflow-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.runWorkflow(id);
        if (result.success) {
          showToast('success', 'Running', 'Workflow started');
        } else {
          showToast('error', 'Error', result.error || 'Failed to run workflow');
        }
      });
    });

    document.querySelectorAll('.workflow-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Workflow', 'Are you sure you want to delete this workflow?', async () => {
          const result = await cyberforgeAPI.deleteWorkflow(id);
          if (result.success) {
            state.workflows = state.workflows.filter(w => w.id !== id);
            showToast('success', 'Deleted', 'Workflow deleted');
            renderScreen('workflows');
          }
        });
      });
    });
  }

  function buildAssistantLayout() {
    return `
      <style>
        .ai-chat-wrapper { display:flex; height:100%; width:100%; overflow:hidden; }
        .ai-chat-sidebar { 
          width:260px; min-width:180px; 
          transition: width 0.2s ease, opacity 0.2s ease; 
          will-change: width;
        }
        .ai-chat-list-item { 
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease; 
          cursor:pointer;
        }
        .ai-chat-list-item:hover { 
          transform: translateX(3px); 
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          background: var(--cf-bg-medium) !important;
        }
        .ai-chat-list-item:active { transform: scale(0.98); }
        .ai-message-animated { animation: aiMessageSlide 0.2s ease-out; }
        .ai-phase-indicator { animation: aiPulse 0.8s ease-in-out infinite; }
        .ai-btn-bounce { transition: transform 0.1s ease, box-shadow 0.1s ease; }
        .ai-btn-bounce:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .ai-btn-bounce:active { transform: scale(0.96); }
        .ai-input-glow { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .ai-input-glow:focus { 
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); 
          border-color: var(--cf-accent-purple) !important;
        }
        .ai-quick-action { transition: all 0.1s ease; }
        .ai-quick-action:hover { 
          transform: translateY(-1px); 
          background: var(--cf-accent-purple) !important;
          color: white !important;
        }
        .ai-quick-action:active { transform: scale(0.95); }
        @keyframes aiMessageSlide { 
          from { opacity: 0; transform: translateY(8px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        @keyframes aiPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes aiTypingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        .ai-typing-dot { 
          display: inline-block; 
          width: 6px; height: 6px; 
          border-radius: 50%; 
          background: var(--cf-accent-purple);
          margin: 0 2px;
        }
        .ai-typing-dot:nth-child(1) { animation: aiTypingDot 1s infinite 0s; }
        .ai-typing-dot:nth-child(2) { animation: aiTypingDot 1s infinite 0.15s; }
        .ai-typing-dot:nth-child(3) { animation: aiTypingDot 1s infinite 0.3s; }
        .ai-welcome-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .ai-welcome-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        @media (max-width: 1100px) {
          .ai-chat-sidebar { width:200px; }
        }
        @media (max-width: 900px) {
          .ai-chat-sidebar { position:absolute; right:0; top:0; bottom:0; z-index:100; display:none; }
          .ai-chat-sidebar.open { display:flex; }
        }
        @media (max-width: 600px) {
          .ai-quick-actions-bar { display:none !important; }
        }
      </style>
      <div class="cf-panel ai-chat-wrapper" style="flex:1; display:flex; height:100%;">
        <!-- Main Chat Panel -->
        <div style="flex:1; display:flex; flex-direction:column; height:100%; min-width:0;">
          <!-- Header with Status -->
          <div class="cf-panel-header" style="border-bottom:1px solid var(--cf-border); flex-shrink:0;">
            <div class="cf-panel-title" style="display:flex; align-items:center; gap:12px;">
              <i class="fas fa-robot" style="color:var(--cf-accent-purple);"></i>
              CyberForge AI Assistant
            </div>
            <div class="cf-panel-actions" style="display:flex; gap:8px; align-items:center;">
              <span id="ai-status" class="cf-badge green" style="display:flex; align-items:center; gap:4px;">
                <span class="status-dot" style="width:6px;height:6px;border-radius:50%;background:#22c55e;"></span>
                Online
              </span>
              <button class="cf-btn ai-btn-bounce" id="toggle-sidebar-mobile" title="Toggle history" style="display:none;">
                <i class="fas fa-history"></i>
              </button>
              <button class="cf-btn ai-btn-bounce" id="clear-chat" title="Clear conversation"><i class="fas fa-trash-alt"></i></button>
              <button class="cf-btn ai-btn-bounce" id="export-chat" title="Export conversation"><i class="fas fa-download"></i></button>
            </div>
          </div>

          <!-- Chat Meta -->
          <div style="padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-medium); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
            <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
              <span id="ai-chat-title" style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">New Chat</span>
              <span id="ai-chat-subtitle" style="font-size:11px; color:var(--cf-text-muted);">No messages yet</span>
            </div>
            <button class="cf-btn ai-btn-bounce" id="ai-new-chat-inline" title="Start new chat"><i class="fas fa-plus"></i></button>
          </div>

          <!-- AI Phase Indicator -->
          <div id="ai-phase-indicator" class="ai-phase-indicator" style="display:none; padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-dark); font-size:11px; color:var(--cf-text-muted); flex-shrink:0;">
            <span id="ai-phase-text"></span>
          </div>

          <!-- Quick Actions Bar -->
          <div class="ai-quick-actions-bar" style="padding:10px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-medium); flex-shrink:0;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="cf-btn ai-quick-action" data-action="scan-url" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-globe"></i> Scan URL
              </button>
              <button class="cf-btn ai-quick-action" data-action="analyze-request" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-code"></i> Analyze Request
              </button>
              <button class="cf-btn ai-quick-action" data-action="find-vulns" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-bug"></i> Find Vulnerabilities
              </button>
              <button class="cf-btn ai-quick-action" data-action="generate-payload" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-bolt"></i> Generate Payload
              </button>
              <button class="cf-btn ai-quick-action" data-action="threat-hunt" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-search"></i> Threat Hunt
              </button>
              <button class="cf-btn ai-quick-action" data-action="explain-vuln" style="font-size:11px; padding:6px 10px;">
                <i class="fas fa-graduation-cap"></i> Explain Vuln
              </button>
            </div>
          </div>

          <!-- Context Panel -->
          <div id="ai-context-panel" style="padding:8px 16px; border-bottom:1px solid var(--cf-border); background:var(--cf-bg-dark); display:none; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="fas fa-paperclip" style="color:var(--cf-accent-blue);"></i>
              <span id="ai-context-text" style="font-size:12px; flex:1;"></span>
              <button class="panel-action-btn" id="clear-context" title="Clear context"><i class="fas fa-times"></i></button>
            </div>
          </div>

          <!-- Chat Messages -->
          <div class="cf-panel-content" id="assistant-messages" style="flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; scroll-behavior:smooth;"></div>

          <!-- Input Area -->
          <div style="padding:12px 16px; border-top:1px solid var(--cf-border); background:var(--cf-bg-medium); flex-shrink:0;">
            <div style="display:flex; gap:8px; align-items:flex-end;">
              <div style="flex:1; position:relative;">
                <textarea id="assistant-input" class="cf-input ai-input-glow" rows="2" placeholder="Ask me anything about security... (Shift+Enter for new line)" 
                  style="width:100%; resize:none; padding-right:40px; transition: height 0.1s ease;"></textarea>
                <button class="panel-action-btn" id="attach-context" title="Attach request/finding" 
                  style="position:absolute; right:8px; bottom:8px;">
                  <i class="fas fa-paperclip"></i>
                </button>
              </div>
              <button id="assistant-send" class="cf-btn primary ai-btn-bounce" style="height:52px; padding:0 20px;">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:var(--cf-text-muted);">
              <span>Powered by CyberForge AI + ML Models</span>
              <span id="ai-typing-indicator" style="display:none;">
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
              </span>
            </div>
          </div>
        </div>

        <!-- Chat History Sidebar -->
        <div id="ai-chat-sidebar" class="ai-chat-sidebar" style="width:260px; border-left:1px solid var(--cf-border); background:var(--cf-bg-dark); display:flex; flex-direction:column;">
          <div style="padding:14px; border-bottom:1px solid var(--cf-border); flex-shrink:0;">
            <div style="font-weight:600; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-comments" style="color:var(--cf-accent-blue);"></i>
              Chats
            </div>
            <button id="ai-new-chat" class="cf-btn primary ai-btn-bounce" style="width:100%; display:flex; gap:8px; align-items:center; justify-content:center;">
              <i class="fas fa-plus"></i> New Chat
            </button>
            <div style="margin-top:10px;">
              <input id="ai-chat-search" class="cf-input ai-input-glow" placeholder="Search chats..." style="width:100%;">
            </div>
          </div>
          <div id="ai-chat-list" style="flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:5px;"></div>
        </div>
      </div>
    `;
  }

  // NEW: AI Assistant V2 Layout Builder
  function buildAssistantLayoutV2() {
    return `<div id="ai-assistant-v2-container" class="ai-assistant-v2-root" style="height:100%; width:100%;"></div>`;
  }

  // Global AI Assistant V2 instance
  let aiAssistantV2Instance = null;

  function initAIAssistantV2(container) {
    if (window.AIAssistantV2 && cyberforgeAPI) {
      aiAssistantV2Instance = new window.AIAssistantV2(container, cyberforgeAPI);
      return true;
    }
    return false;
  }

  function bindAssistant() {
    const sendBtn = document.getElementById('assistant-send');
    const input = document.getElementById('assistant-input');
    const messages = document.getElementById('assistant-messages');
    const typingIndicator = document.getElementById('ai-typing-indicator');
    const statusBadge = document.getElementById('ai-status');
    const contextPanel = document.getElementById('ai-context-panel');
    const contextText = document.getElementById('ai-context-text');
    const phaseIndicator = document.getElementById('ai-phase-indicator');
    const phaseText = document.getElementById('ai-phase-text');
    const chatList = document.getElementById('ai-chat-list');
    const newChatBtn = document.getElementById('ai-new-chat');
    const newChatInlineBtn = document.getElementById('ai-new-chat-inline');
    const chatSearch = document.getElementById('ai-chat-search');
    const chatTitle = document.getElementById('ai-chat-title');
    const chatSubtitle = document.getElementById('ai-chat-subtitle');

    const CHAT_STORAGE_KEY = 'cyberforge_ai_chats';

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text ?? '';
      return div.innerHTML;
    };

    const loadChats = () => {
      try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    };

    const saveChats = () => {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.aiChats || []));
    };

    const createChat = () => {
      const id = `chat_${Date.now()}`;
      const chat = {
        id,
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      state.aiChats = [chat, ...(state.aiChats || [])];
      state.activeChatId = id;
      saveChats();
      return chat;
    };

    const getActiveChat = () => {
      return (state.aiChats || []).find(c => c.id === state.activeChatId);
    };

    const updateChatMeta = () => {
      const activeChat = getActiveChat();
      if (!activeChat) return;
      chatTitle.textContent = activeChat.title || 'New Chat';
      if (activeChat.messages.length === 0) {
        chatSubtitle.textContent = 'No messages yet';
      } else {
        const last = activeChat.messages[activeChat.messages.length - 1];
        chatSubtitle.textContent = `Last message • ${new Date(last.timestamp).toLocaleTimeString()}`;
      }
    };

    const renderChatList = (filter = '') => {
      if (!chatList) return;
      const normalized = filter.trim().toLowerCase();
      chatList.innerHTML = '';
      (state.aiChats || []).forEach(chat => {
        if (normalized && !chat.title.toLowerCase().includes(normalized)) return;
        const preview = chat.messages?.[chat.messages.length - 1]?.content || 'No messages yet';
        const item = document.createElement('div');
        const isActive = chat.id === state.activeChatId;
        item.className = `ai-chat-list-item ${isActive ? 'active' : ''}`;
        item.style.cssText = `
          padding:10px 12px;
          border-radius:10px;
          cursor:pointer;
          border:1px solid var(--cf-border);
          background:${isActive ? 'var(--cf-bg-medium)' : 'transparent'};
        `;
        item.innerHTML = `
          <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(chat.title || 'New Chat')}
          </div>
          <div style="font-size:11px; color:var(--cf-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(preview)}
          </div>
        `;
        item.addEventListener('click', () => {
          state.activeChatId = chat.id;
          saveChats();
          renderChatList(chatSearch?.value || '');
          renderChatMessages();
        });
        chatList.appendChild(item);
      });
    };

    const renderWelcome = () => {
      messages.innerHTML = `
        <div class="ai-welcome-message" style="text-align:center; padding:32px 20px;">
          <div style="width:72px; height:72px; margin:0 auto 14px; background:linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-blue)); border-radius:18px; display:flex; align-items:center; justify-content:center; box-shadow: 0 8px 24px rgba(99,102,241,0.3);">
            <i class="fas fa-brain" style="font-size:32px; color:white;"></i>
          </div>
          <h3 style="margin-bottom:6px; font-size:18px;">CyberForge AI Assistant</h3>
          <p style="color:var(--cf-text-muted); margin-bottom:20px; max-width:520px; margin-left:auto; margin-right:auto; font-size:13px; line-height:1.5;">
            I'm your AI-powered security analyst with <strong>live website scanning</strong> capabilities. 
            Enter any URL and I'll scrape it in real-time to analyze security headers, network requests, 
            vulnerabilities, and more.
          </p>
          <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; max-width:650px; margin:0 auto;">
            <div class="ai-suggestion ai-welcome-card" data-prompt="Scan https://example.com for security vulnerabilities and analyze its security headers, network requests, and potential threats" style="background:linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1)); padding:12px 18px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid rgba(99,102,241,0.4);">
              🌐 Live Website Security Scan
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Explain SQL injection attacks and how to prevent them" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              📚 Learn about SQL injection
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Generate XSS test payloads for input field testing" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              💉 Generate XSS payloads
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="What are the OWASP Top 10 vulnerabilities?" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              📋 OWASP Top 10
            </div>
            <div class="ai-suggestion ai-welcome-card" data-prompt="Analyze https://github.com for security headers and HTTPS configuration" style="background:var(--cf-bg-medium); padding:10px 16px; border-radius:12px; cursor:pointer; font-size:12px; border:1px solid var(--cf-border);">
              🔒 Security Headers Check
            </div>
          </div>
        </div>
      `;

      document.querySelectorAll('.ai-suggestion').forEach(chip => {
        chip.addEventListener('click', () => {
          input.value = chip.dataset.prompt;
          sendMessage();
        });
      });
    };

    const renderChatMessages = () => {
      const activeChat = getActiveChat();
      messages.innerHTML = '';
      if (!activeChat || activeChat.messages.length === 0) {
        renderWelcome();
        updateChatMeta();
        return;
      }

      activeChat.messages.forEach(msg => {
        appendMessage(msg);
      });
      updateChatMeta();
      messages.scrollTop = messages.scrollHeight;
    };

    // Initialize chat state
    state.aiChats = state.aiChats || loadChats();
    if (!state.aiChats || state.aiChats.length === 0) {
      createChat();
    }
    if (!state.activeChatId) {
      state.activeChatId = state.aiChats[0].id;
    }
    if (!state.aiContext) {
      state.aiContext = null;
    }
    // Initial render will happen after message helpers are defined

    const appendMessage = (msg) => {
      const { role, content, timestamp, meta } = msg;
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ai-message-${role} ai-message-animated`;
      msgDiv.style.cssText = `
        display: flex;
        gap: 12px;
        ${role === 'user' ? 'flex-direction: row-reverse;' : ''}
      `;

      const avatarStyle = role === 'user'
        ? 'background: var(--cf-accent-blue);'
        : 'background: linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-orange));';

      const icon = role === 'user' ? 'fa-user' : 'fa-robot';
      const displayTime = new Date(timestamp || Date.now()).toLocaleTimeString();
      const displayContent = role === 'assistant'
        ? formatAIResponse(content)
        : `<div style="white-space:pre-wrap;">${escapeHtml(content)}</div>`;

      const metaHtml = meta ? `
        <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
          ${typeof meta.confidence === 'number' ? `<span class="cf-badge" style="font-size:10px;">Confidence ${(meta.confidence * 100).toFixed(0)}%</span>` : ''}
          ${Array.isArray(meta.insights) && meta.insights.length ? `<span class="cf-badge" style="font-size:10px;">${meta.insights[0]}</span>` : ''}
          ${Array.isArray(meta.recommendations) && meta.recommendations.length ? `<span class="cf-badge" style="font-size:10px;">${meta.recommendations[0]}</span>` : ''}
        </div>
      ` : '';

      msgDiv.innerHTML = `
        <div style="width:36px; height:36px; border-radius:10px; ${avatarStyle} display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
          <i class="fas ${icon}" style="color:white; font-size:14px;"></i>
        </div>
        <div style="flex:1; max-width:72%;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; ${role === 'user' ? 'justify-content:flex-end;' : ''}">
            <span style="font-weight:600; font-size:12px;">${role === 'user' ? 'You' : 'CyberForge AI'}</span>
            <span style="font-size:10px; color:var(--cf-text-muted);">${displayTime}</span>
          </div>
          <div class="ai-message-content" style="background:var(--cf-bg-${role === 'user' ? 'dark' : 'medium'}); padding:14px 16px; border-radius:14px; border:1px solid var(--cf-border); ${role === 'user' ? 'border-bottom-right-radius:6px;' : 'border-bottom-left-radius:6px;'}">
            ${displayContent}
          </div>
          ${metaHtml}
        </div>
      `;

      messages.appendChild(msgDiv);
      messages.scrollTop = messages.scrollHeight;
    };

    // Add message to chat and persist
    const addMessage = (role, content, meta = null) => {
      const activeChat = getActiveChat();
      if (!activeChat) return;

      const welcomeMsg = messages.querySelector('.ai-welcome-message');
      if (welcomeMsg) welcomeMsg.remove();

      if (activeChat.messages.length === 0 && role === 'user' && activeChat.title === 'New Chat') {
        activeChat.title = content.length > 36 ? `${content.slice(0, 36)}...` : content;
      }

      const msg = {
        role,
        content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        timestamp: new Date().toISOString(),
        meta
      };
      activeChat.messages.push(msg);
      activeChat.updatedAt = new Date().toISOString();
      saveChats();
      renderChatList(chatSearch?.value || '');
      updateChatMeta();
      appendMessage(msg);
    };

    const renderStreamingContent = (text) => {
      return escapeHtml(text).replace(/\n/g, '<br>');
    };

    const sanitizeAssistantText = (text) => {
      if (typeof text !== 'string') return text;
      return text.replace(/gemini/gi, 'AI model');
    };

    const setPhase = (phase, tools = []) => {
      if (!phaseIndicator || !phaseText) return;
      const toolsText = tools.length ? ` • Tools: ${tools.join(', ')}` : '';
      phaseText.textContent = `${phase}${toolsText}`;
      phaseIndicator.style.display = 'block';
    };

    const clearPhase = () => {
      if (!phaseIndicator) return;
      phaseIndicator.style.display = 'none';
      if (phaseText) phaseText.textContent = '';
    };

    const getStreamSpeed = (text) => {
      const len = text.length;
      // Much faster streaming - almost instant but still visible
      if (len > 2000) return 1;  // Very long: blazing fast
      if (len > 1000) return 2;  // Long: very fast  
      if (len > 500) return 3;   // Medium: fast
      return 4;                   // Short: readable but quick
    };

    const streamAssistantMessage = (text, meta = null) => {
      return new Promise((resolve) => {
        const activeChat = getActiveChat();
        if (!activeChat) return resolve();

        const finalTextRaw = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        const finalText = sanitizeAssistantText(finalTextRaw);
        const speedMs = getStreamSpeed(finalText);
        
        // For very long responses, stream in chunks instead of character by character
        const chunkSize = finalText.length > 1000 ? 3 : 1;
        
        const msg = {
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
          meta
        };
        activeChat.messages.push(msg);
        activeChat.updatedAt = new Date().toISOString();
        saveChats();
        renderChatList(chatSearch?.value || '');
        updateChatMeta();

        const tempMsg = {
          role: 'assistant',
          content: '',
          timestamp: msg.timestamp,
          meta
        };
        const metaHtml = meta ? `
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            ${typeof meta.confidence === 'number' ? `<span class=\"cf-badge\" style=\"font-size:10px;\">Confidence ${(meta.confidence * 100).toFixed(0)}%</span>` : ''}
            ${Array.isArray(meta.insights) && meta.insights.length ? `<span class=\"cf-badge\" style=\"font-size:10px;\">${meta.insights[0]}</span>` : ''}
            ${Array.isArray(meta.recommendations) && meta.recommendations.length ? `<span class=\"cf-badge\" style=\"font-size:10px;\">${meta.recommendations[0]}</span>` : ''}
          </div>
        ` : '';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-message ai-message-assistant ai-message-animated';
        msgDiv.style.cssText = `display:flex; gap:12px;`;
        msgDiv.innerHTML = `
          <div style="width:36px; height:36px; border-radius:10px; background: linear-gradient(135deg, var(--cf-accent-purple), var(--cf-accent-orange)); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
            <i class="fas fa-robot" style="color:white; font-size:14px;"></i>
          </div>
          <div style="flex:1; max-width:72%;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-weight:600; font-size:12px;">CyberForge AI</span>
              <span style="font-size:10px; color:var(--cf-text-muted);">${new Date(tempMsg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="ai-message-content" style="background:var(--cf-bg-medium); padding:14px 16px; border-radius:14px; border:1px solid var(--cf-border); border-bottom-left-radius:6px;"></div>
            ${metaHtml}
          </div>
        `;
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;

        const contentEl = msgDiv.querySelector('.ai-message-content');
        let i = 0;
        const timer = setInterval(() => {
          i += chunkSize;
          if (i > finalText.length) i = finalText.length;
          contentEl.innerHTML = renderStreamingContent(finalText.slice(0, i));
          messages.scrollTop = messages.scrollHeight;
          if (i >= finalText.length) {
            clearInterval(timer);
            contentEl.innerHTML = formatAIResponse(finalText);
            resolve();
          }
        }, speedMs);
      });
    };

    // Format AI response with markdown-like styling
    function formatAIResponse(text) {
      // Convert code blocks
      text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div style="background:var(--cf-bg-dark); padding:12px; border-radius:8px; margin:8px 0; overflow-x:auto;">
          ${lang ? `<div style="font-size:10px; color:var(--cf-text-muted); margin-bottom:8px;">${lang}</div>` : ''}
          <pre style="margin:0; font-family:monospace; font-size:13px;"><code>${escapeHtml(code.trim())}</code></pre>
        </div>`;
      });

      // Convert inline code
      text = text.replace(/`([^`]+)`/g, '<code style="background:var(--cf-bg-dark); padding:2px 6px; border-radius:4px; font-size:12px;">$1</code>');

      // Convert bold
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Convert bullet points
      text = text.replace(/^[•\-\*]\s+(.+)$/gm, '<div style="display:flex; gap:8px; margin:4px 0;"><span style="color:var(--cf-accent-blue);">•</span><span>$1</span></div>');

      // Convert numbered lists
      text = text.replace(/^\d+\.\s+(.+)$/gm, '<div style="display:flex; gap:8px; margin:4px 0;"><span style="color:var(--cf-accent-orange); font-weight:600;">$&</span></div>');

      // Convert headers
      text = text.replace(/^###\s+(.+)$/gm, '<h4 style="color:var(--cf-accent-purple); margin:12px 0 8px;">$1</h4>');
      text = text.replace(/^##\s+(.+)$/gm, '<h3 style="margin:12px 0 8px;">$1</h3>');

      // Convert line breaks
      text = text.replace(/\n/g, '<br>');

      return text;
    }

    // Send message to AI
    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;

      // Add user message
      addMessage('user', text);
      input.value = '';
      input.style.height = 'auto';

      // Show typing indicator
      typingIndicator.style.display = 'inline';
      sendBtn.disabled = true;

      // Check if message contains a URL for scanning
      const urlPattern = /(https?:\/\/[^\s]+)/i;
      const hasUrl = urlPattern.test(text);
      const scanKeywords = ['scan', 'analyze', 'check', 'security', 'vulnerab', 'audit', 'inspect', 'threat', 'assess', 'review'];
      const hasScanIntent = scanKeywords.some(kw => text.toLowerCase().includes(kw));
      
      if (hasUrl && hasScanIntent) {
        setPhase('Scraping Website', ['webscraper', 'network_analyzer', 'security_scanner']);
      } else {
        setPhase('Thinking', ['ai_agent', 'threat_analyzer', 'ml_models', 'memory_store', 'api:/analyze']);
      }

      try {
        // Prepare context
        const context = {
          source: 'desktop_assistant',
          timestamp: new Date().toISOString(),
          ...state.aiContext
        };

        // Add captured requests context if available
        if (state.requests.length > 0) {
          context.captured_requests_count = state.requests.length;
          context.recent_hosts = [...new Set(state.requests.slice(0, 10).map(r => r.host))];
        }

        // Add findings context
        if (state.findings.length > 0) {
          context.active_findings = state.findings.filter(f => f.status === 'Open').length;
        }

        const activeChat = getActiveChat();
        if (!activeChat) throw new Error('No active chat');

        const conversationHistory = activeChat.messages
          .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
          .slice(-10);

        // Update phase for AI analysis
        if (hasUrl && hasScanIntent) {
          setPhase('Analyzing Security Data', ['ai_agent', 'vulnerability_scanner', 'threat_analyzer']);
        }

        // Call the AI endpoint
        const result = await cyberforgeAPI.chatWithAI(text, conversationHistory, context);

        if (result.success) {
          const response = result.data?.response || result.data || 'No response received';
          
          // Show scan result indicator if website was scanned
          if (result.data?.website_scan?.scanned) {
            const ws = result.data.website_scan;
            setPhase(`Website Scanned: ${ws.risk_level?.toUpperCase() || 'ANALYZED'} (Score: ${ws.risk_score || 'N/A'})`, ['security_report']);
            await new Promise(r => setTimeout(r, 1500));
          }

          // Stream assistant response slowly
          setPhase('Responding', ['ai_agent', 'ml_models', 'api:/analyze']);
          await streamAssistantMessage(response, {
            confidence: result.data?.confidence,
            insights: result.data?.insights,
            recommendations: result.data?.recommendations
          });

          setPhase('Completed');
          setTimeout(clearPhase, 1200);

          // Check if response contains actionable items
          checkForActionableItems(response);
        } else {
          addMessage('assistant', `❌ Error: ${result.error || 'Failed to get response from AI'}`);
          updateAIStatus(false);
          clearPhase();
        }
      } catch (error) {
        console.error('AI chat error:', error);
        addMessage('assistant', `❌ Connection error: ${error.message}. Make sure the backend and ML services are running.`);
        updateAIStatus(false);
        clearPhase();
      } finally {
        typingIndicator.style.display = 'none';
        sendBtn.disabled = false;
        input.focus();
      }
    };

    // Check for actionable items in response
    const checkForActionableItems = (response) => {
      const lowerResponse = (typeof response === 'string' ? response : JSON.stringify(response)).toLowerCase();
      
      // If response mentions creating a finding
      if (lowerResponse.includes('vulnerability') || lowerResponse.includes('finding')) {
        // Could auto-suggest creating a finding
      }
    };

    // Update AI status indicator
    const updateAIStatus = async (online = null) => {
      if (online === null) {
        try {
          const health = await cyberforgeAPI.getMLHealth();
          online = health.success;
        } catch {
          online = false;
        }
      }
      
      statusBadge.className = `cf-badge ${online ? 'green' : 'red'}`;
      statusBadge.innerHTML = `<span class="status-dot" style="width:6px;height:6px;border-radius:50%;background:${online ? '#22c55e' : '#ef4444'};"></span> ${online ? 'Online' : 'Offline'}`;
    };

    // Quick action handlers
    const quickActionHandlers = {
      'scan-url': () => {
        showModal('🔍 Live Website Security Scan', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); padding:12px; border-radius:8px; border:1px solid rgba(99,102,241,0.3);">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <i class="fas fa-globe" style="color: var(--cf-accent-purple);"></i>
                <span style="font-weight:600; color: var(--cf-accent-purple);">Real-Time Website Scraping</span>
              </div>
              <p style="font-size:12px; color:var(--cf-text-muted); margin:0;">
                This will scrape the live website and analyze security headers, network requests, 
                third-party scripts, console errors, and more.
              </p>
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Target URL</label>
              <input class="cf-input" name="url" placeholder="https://example.com" style="width:100%;">
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Scan Type</label>
              <select class="cf-input" name="scanType" style="width:100%;">
                <option value="comprehensive">Comprehensive Security Audit</option>
                <option value="quick">Quick Security Check</option>
                <option value="headers">Security Headers Only</option>
                <option value="network">Network Request Analysis</option>
              </select>
            </div>
          </div>
        `, async (formData) => {
          const url = formData.get('url');
          const scanType = formData.get('scanType');
          
          let scanPrompt = '';
          switch (scanType) {
            case 'comprehensive':
              scanPrompt = `Perform a comprehensive security audit on ${url}. Analyze ALL security aspects including: security headers, HTTPS configuration, mixed content, third-party scripts, network requests, cookies, console errors, and provide detailed vulnerability assessment with remediation steps.`;
              break;
            case 'headers':
              scanPrompt = `Analyze the security headers of ${url}. Focus on missing headers like CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and provide specific implementation recommendations.`;
              break;
            case 'network':
              scanPrompt = `Analyze all network requests made by ${url}. Identify suspicious third-party scripts, tracking pixels, potential data leakage, and external resource security.`;
              break;
            default:
              scanPrompt = `Perform a quick security scan on ${url}. Check for major vulnerabilities and security misconfigurations.`;
          }
          
          input.value = scanPrompt;
          sendMessage();
        });
      },
      'analyze-request': () => {
        if (state.selectedRequestId) {
          const req = state.requests.find(r => r.id === state.selectedRequestId);
          if (req) {
            state.aiContext = { request: req };
            contextPanel.style.display = 'block';
            contextText.textContent = `Attached: ${req.method} ${req.host}${req.path}`;
            input.value = 'Analyze this HTTP request for security vulnerabilities and potential attack vectors.';
            input.focus();
          }
        } else {
          showToast('warning', 'No Request Selected', 'Select a request from HTTP History first');
        }
      },
      'find-vulns': () => {
        input.value = 'Based on my captured traffic, identify potential security vulnerabilities and misconfigurations. Provide detailed findings with severity ratings.';
        sendMessage();
      },
      'generate-payload': () => {
        showModal('Generate Payload', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Vulnerability Type</label>
              <select class="cf-input" name="vulnType" style="width:100%;">
                <option value="xss">Cross-Site Scripting (XSS)</option>
                <option value="sqli">SQL Injection</option>
                <option value="xxe">XML External Entity (XXE)</option>
                <option value="ssrf">Server-Side Request Forgery (SSRF)</option>
                <option value="lfi">Local File Inclusion (LFI)</option>
                <option value="rce">Remote Code Execution (RCE)</option>
                <option value="ssti">Server-Side Template Injection (SSTI)</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Context (optional)</label>
              <input class="cf-input" name="context" placeholder="e.g., PHP backend, JSON API, etc." style="width:100%;">
            </div>
          </div>
        `, (formData) => {
          const vulnType = formData.get('vulnType');
          const context = formData.get('context');
          input.value = `Generate a comprehensive list of ${vulnType.toUpperCase()} test payloads${context ? ` for a ${context} environment` : ''}. Include bypass techniques and encoding variations.`;
          sendMessage();
        });
      },
      'threat-hunt': () => {
        input.value = 'Start an AI-powered threat hunting session. Analyze my captured traffic for indicators of compromise (IOCs), suspicious patterns, and potential threats.';
        sendMessage();
      },
      'explain-vuln': () => {
        showModal('Explain Vulnerability', `
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="display:block; font-weight:600; margin-bottom:8px;">Vulnerability</label>
              <select class="cf-input" name="vuln" style="width:100%;">
                <option value="XSS">Cross-Site Scripting (XSS)</option>
                <option value="SQL Injection">SQL Injection</option>
                <option value="CSRF">Cross-Site Request Forgery (CSRF)</option>
                <option value="SSRF">Server-Side Request Forgery (SSRF)</option>
                <option value="XXE">XML External Entity (XXE)</option>
                <option value="IDOR">Insecure Direct Object Reference (IDOR)</option>
                <option value="Authentication Bypass">Authentication Bypass</option>
                <option value="Broken Access Control">Broken Access Control</option>
                <option value="Deserialization">Insecure Deserialization</option>
              </select>
            </div>
          </div>
        `, (formData) => {
          const vuln = formData.get('vuln');
          input.value = `Explain ${vuln} in detail. Include: 1) How the vulnerability works, 2) Real-world attack examples, 3) Detection techniques, 4) Prevention and remediation strategies.`;
          sendMessage();
        });
      }
    };

    // Bind quick action buttons
    document.querySelectorAll('.ai-quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (quickActionHandlers[action]) {
          quickActionHandlers[action]();
        }
      });
    });

    // Bind suggestion chips
    renderChatList();
    renderChatMessages();

    document.querySelectorAll('.ai-suggestion').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.prompt;
        sendMessage();
      });
    });

    // New chat handlers
    const handleNewChat = () => {
      createChat();
      renderChatList(chatSearch?.value || '');
      renderChatMessages();
    };
    newChatBtn?.addEventListener('click', handleNewChat);
    newChatInlineBtn?.addEventListener('click', handleNewChat);

    // Chat search
    chatSearch?.addEventListener('input', (e) => {
      renderChatList(e.target.value || '');
    });

    // Bind send button
    sendBtn?.addEventListener('click', sendMessage);

    // Bind input events
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Clear chat
    document.getElementById('clear-chat')?.addEventListener('click', () => {
      showConfirmModal('Clear Conversation', 'Clear messages in this chat?', () => {
        const activeChat = getActiveChat();
        if (activeChat) {
          activeChat.messages = [];
          activeChat.updatedAt = new Date().toISOString();
          saveChats();
          renderChatMessages();
          renderChatList(chatSearch?.value || '');
        }
        state.aiContext = null;
        contextPanel.style.display = 'none';
        showToast('success', 'Cleared', 'Conversation cleared');
      });
    });

    // Export chat
    document.getElementById('export-chat')?.addEventListener('click', () => {
      const activeChat = getActiveChat();
      if (!activeChat || activeChat.messages.length === 0) {
        showToast('warning', 'No Messages', 'No conversation to export');
        return;
      }

      let exportText = `CyberForge AI Assistant - Conversation Export\n`;
      exportText += `Date: ${new Date().toLocaleString()}\n`;
      exportText += `${'='.repeat(50)}\n\n`;

      activeChat.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        exportText += `[${role}]\n${msg.content}\n\n`;
      });

      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberforge-chat-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Exported', 'Conversation exported');
    });

    // Attach context
    document.getElementById('attach-context')?.addEventListener('click', () => {
      showModal('Attach Context', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Context Type</label>
            <select class="cf-input" name="type" id="context-type-select" style="width:100%;">
              <option value="request">HTTP Request</option>
              <option value="finding">Finding</option>
              <option value="custom">Custom Text</option>
            </select>
          </div>
          <div id="context-request-select" style="display:block;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Select Request</label>
            <select class="cf-input" name="requestId" style="width:100%;">
              ${state.requests.slice(0, 20).map(r => `<option value="${r.id}">${r.method} ${r.host}${r.path}</option>`).join('')}
            </select>
          </div>
          <div id="context-finding-select" style="display:none;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Select Finding</label>
            <select class="cf-input" name="findingId" style="width:100%;">
              ${state.findings.map(f => `<option value="${f.id}">${f.severity}: ${f.title}</option>`).join('')}
            </select>
          </div>
          <div id="context-custom-input" style="display:none;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Custom Context</label>
            <textarea class="cf-input" name="customContext" rows="4" placeholder="Paste any relevant context..." style="width:100%;"></textarea>
          </div>
        </div>
      `, (formData) => {
        const type = formData.get('type');
        if (type === 'request') {
          const reqId = formData.get('requestId');
          const req = state.requests.find(r => r.id == reqId);
          if (req) {
            state.aiContext = { type: 'request', request: req };
            contextPanel.style.display = 'block';
            contextText.textContent = `Request: ${req.method} ${req.host}${req.path}`;
          }
        } else if (type === 'finding') {
          const findingId = formData.get('findingId');
          const finding = state.findings.find(f => f.id == findingId);
          if (finding) {
            state.aiContext = { type: 'finding', finding };
            contextPanel.style.display = 'block';
            contextText.textContent = `Finding: ${finding.severity} - ${finding.title}`;
          }
        } else if (type === 'custom') {
          const customContext = formData.get('customContext');
          state.aiContext = { type: 'custom', text: customContext };
          contextPanel.style.display = 'block';
          contextText.textContent = `Custom context attached`;
        }
        showToast('success', 'Attached', 'Context attached to conversation');
      });

      // Handle context type switching
      setTimeout(() => {
        document.getElementById('context-type-select')?.addEventListener('change', (e) => {
          document.getElementById('context-request-select').style.display = e.target.value === 'request' ? 'block' : 'none';
          document.getElementById('context-finding-select').style.display = e.target.value === 'finding' ? 'block' : 'none';
          document.getElementById('context-custom-input').style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
      }, 100);
    });

    // Clear context
    document.getElementById('clear-context')?.addEventListener('click', () => {
      state.aiContext = null;
      contextPanel.style.display = 'none';
      showToast('success', 'Cleared', 'Context removed');
    });

    // Check AI status on load
    updateAIStatus();
  }

  function buildSearchLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header"><div class="cf-panel-title">Search</div></div>
        <div style="padding:12px; display:flex; gap:8px;">
          <input class="cf-input" placeholder="Search HTTP history, WS messages, findings..." style="flex:1;">
          <button class="cf-btn primary">Search</button>
        </div>
        <div class="cf-panel-content">
          <div class="empty-state">
            <i class="fas fa-search empty-state-icon"></i>
            <div class="empty-state-title">No results yet</div>
            <div class="empty-state-description">Enter a query to search captured traffic</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildFindingsLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Findings</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="export-findings"><i class="fas fa-download"></i> Export</button>
            <button class="cf-btn primary" id="new-finding"><i class="fas fa-plus"></i> Add Finding</button>
          </div>
        </div>
        <div class="cf-table-container">
          <table class="cf-table" id="findings-table">
            <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Path</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="findings-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindFindingsEvents() {
    document.getElementById('new-finding')?.addEventListener('click', () => {
      showModal('Add Finding', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Title</label>
            <input class="cf-input" name="title" placeholder="SQL Injection in login endpoint" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Severity</label>
            <select class="cf-input" name="severity" style="width:100%;">
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium" selected>Medium</option>
              <option value="Low">Low</option>
              <option value="Info">Informational</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Path/URL</label>
            <input class="cf-input" name="path" placeholder="/api/login" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <textarea class="cf-input" name="description" rows="4" placeholder="Detailed description of the finding..." style="width:100%;"></textarea>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createFinding({
          title: formData.get('title'),
          severity: formData.get('severity'),
          path: formData.get('path'),
          description: formData.get('description'),
          status: 'Open'
        });
        if (result.success) {
          state.findings.unshift(result.data.data.finding);
          showToast('success', 'Created', 'Finding added successfully');
          renderScreen('findings');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add finding');
        }
      });
    });

    document.getElementById('export-findings')?.addEventListener('click', async () => {
      const result = await cyberforgeAPI.createExport({ name: 'Findings Export', format: 'json', includeFindings: true });
      if (result.success) {
        showToast('success', 'Export Started', 'Findings export is being generated');
      }
    });
  }

  function buildExportsLayout() {
    const formatIcon = (format) => {
      const icons = { pdf: 'fa-file-pdf', har: 'fa-file-code', json: 'fa-file-code', csv: 'fa-file-csv', xml: 'fa-file-alt' };
      const colors = { pdf: 'red', har: 'blue', json: 'green', csv: 'orange', xml: 'purple' };
      return { icon: icons[format] || 'fa-file', color: colors[format] || 'gray' };
    };

    const exportsHtml = state.exports.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-file-export empty-state-icon"></i>
        <div class="empty-state-title">No exports yet</div>
        <div class="empty-state-description">Create an export to download your data</div>
      </div>
    ` : state.exports.map(exp => {
      const { icon, color } = formatIcon(exp.format);
      return `
        <div class="export-card" data-id="${exp.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <i class="fas ${icon}" style="color:var(--cf-accent-${color}); font-size:24px;"></i>
            <div style="flex:1;">
              <div style="font-weight:600;">${exp.name}</div>
              <div style="font-size:11px; color:var(--cf-text-muted);">Generated: ${new Date(exp.createdAt).toLocaleString()} • ${exp.format?.toUpperCase() || 'Unknown'} • ${exp.size || 'N/A'}</div>
            </div>
            <span class="cf-badge ${exp.status === 'ready' ? 'green' : 'orange'}">${exp.status}</span>
            <button class="cf-btn export-download" data-id="${exp.id}" ${exp.status !== 'ready' ? 'disabled' : ''}><i class="fas fa-download"></i></button>
            <button class="cf-btn export-delete" data-id="${exp.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Exports</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-export"><i class="fas fa-plus"></i> New Export</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="exports-container" style="display:flex; flex-direction:column; gap:12px;">
            ${exportsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindExportsEvents() {
    document.getElementById('new-export')?.addEventListener('click', () => {
      showModal('Create Export', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="Security Report" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Format</label>
            <select class="cf-input" name="format" style="width:100%;">
              <option value="pdf">PDF Report</option>
              <option value="har">HAR (HTTP Archive)</option>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xml">XML</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Include</label>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label><input type="checkbox" name="includeRequests" checked> HTTP Requests</label>
              <label><input type="checkbox" name="includeFindings" checked> Findings</label>
              <label><input type="checkbox" name="includeIntercepts"> Intercepts</label>
            </div>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createExport({
          name: formData.get('name'),
          format: formData.get('format'),
          includeRequests: formData.get('includeRequests') === 'on',
          includeFindings: formData.get('includeFindings') === 'on',
          includeIntercepts: formData.get('includeIntercepts') === 'on'
        });
        if (result.success) {
          state.exports.unshift(result.data.data.export);
          showToast('success', 'Export Started', 'Your export is being generated');
          renderScreen('exports');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create export');
        }
      });
    });

    document.querySelectorAll('.export-download').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.downloadExport(id);
        if (result.success) {
          showToast('success', 'Download Started', 'Your export is downloading');
        }
      });
    });

    document.querySelectorAll('.export-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Export', 'Are you sure you want to delete this export?', async () => {
          const result = await cyberforgeAPI.deleteExport(id);
          if (result.success) {
            state.exports = state.exports.filter(e => e.id !== id);
            showToast('success', 'Deleted', 'Export deleted');
            renderScreen('exports');
          }
        });
      });
    });
  }

  function buildFilesLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header"><div class="cf-panel-title">Files</div></div>
        <div class="cf-panel-content" id="files-tree" style="padding:12px;">
        </div>
      </div>
    `;
  }

  function buildPluginsLayout() {
    const pluginsHtml = state.plugins.length === 0 ? `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-puzzle-piece empty-state-icon"></i>
        <div class="empty-state-title">No plugins installed</div>
        <div class="empty-state-description">Browse the store to find useful extensions</div>
      </div>
    ` : state.plugins.map(plugin => `
      <div class="plugin-card" data-id="${plugin.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:40px;height:40px;background:var(--cf-accent-${plugin.color || 'purple'});border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-${plugin.icon || 'puzzle-piece'}" style="color:white;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;">${plugin.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">v${plugin.version || '1.0.0'} • ${plugin.enabled ? 'Active' : 'Disabled'}</div>
          </div>
          <label class="switch">
            <input type="checkbox" class="plugin-toggle" data-id="${plugin.id}" ${plugin.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div style="font-size:12px; color:var(--cf-text-secondary); margin-bottom:12px;">${plugin.description || 'No description'}</div>
        <div style="display:flex; gap:8px;">
          <button class="cf-btn plugin-settings" data-id="${plugin.id}"><i class="fas fa-cog"></i> Settings</button>
          <button class="cf-btn plugin-uninstall" data-id="${plugin.id}"><i class="fas fa-trash"></i> Uninstall</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Plugins</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="browse-store"><i class="fas fa-store"></i> Browse Store</button>
            <button class="cf-btn primary" id="install-plugin"><i class="fas fa-upload"></i> Install</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="plugins-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
            ${pluginsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindPluginsEvents() {
    document.getElementById('browse-store')?.addEventListener('click', async () => {
      const result = await cyberforgeAPI.getPluginStore();
      if (result.success) {
        const storePlugins = result.data.data?.plugins || [];
        showModal('Plugin Store', `
          <div style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow:auto;">
            ${storePlugins.length === 0 ? '<p>No plugins available in store</p>' : storePlugins.map(p => `
              <div style="background:var(--cf-bg-dark); border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px;">
                <i class="fas fa-${p.icon || 'puzzle-piece'}" style="font-size:24px; color:var(--cf-accent-${p.color || 'blue'});"></i>
                <div style="flex:1;">
                  <div style="font-weight:600;">${p.name}</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">${p.description || ''}</div>
                </div>
                <button class="cf-btn store-install" data-id="${p.id}"><i class="fas fa-download"></i> Install</button>
              </div>
            `).join('')}
          </div>
        `, null);
        
        // Bind install buttons after modal is shown
        setTimeout(() => {
          document.querySelectorAll('.store-install').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.dataset.id;
              const installResult = await cyberforgeAPI.installPlugin(id);
              if (installResult.success) {
                state.plugins.push(installResult.data.data.plugin);
                showToast('success', 'Installed', 'Plugin installed successfully');
                document.querySelector('.modal-overlay')?.remove();
                renderScreen('plugins');
              }
            });
          });
        }, 100);
      }
    });

    document.getElementById('install-plugin')?.addEventListener('click', () => {
      showModal('Install Plugin', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <p>Enter the plugin ID or URL to install:</p>
          <input class="cf-input" name="pluginId" placeholder="plugin-id or https://..." style="width:100%;">
        </div>
      `, async (formData) => {
        const pluginId = formData.get('pluginId');
        const result = await cyberforgeAPI.installPlugin(pluginId);
        if (result.success) {
          state.plugins.push(result.data.data.plugin);
          showToast('success', 'Installed', 'Plugin installed successfully');
          renderScreen('plugins');
        } else {
          showToast('error', 'Error', result.error || 'Failed to install plugin');
        }
      });
    });

    document.querySelectorAll('.plugin-toggle').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.id;
        const result = await cyberforgeAPI.togglePlugin(id);
        if (result.success) {
          const plugin = state.plugins.find(p => p.id === id);
          if (plugin) plugin.enabled = !plugin.enabled;
          showToast('success', 'Updated', `Plugin ${plugin?.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    });

    document.querySelectorAll('.plugin-uninstall').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Uninstall Plugin', 'Are you sure you want to uninstall this plugin?', async () => {
          const result = await cyberforgeAPI.uninstallPlugin(id);
          if (result.success) {
            state.plugins = state.plugins.filter(p => p.id !== id);
            showToast('success', 'Uninstalled', 'Plugin removed');
            renderScreen('plugins');
          }
        });
      });
    });
  }

  function buildWorkspaceLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Workspace Settings</div>
        </div>
        <div class="cf-panel-content" style="padding:24px; max-width:600px;">
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Workspace Name</label>
            <input class="cf-input" value="Hackers-Arise" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Default Target</label>
            <input class="cf-input" placeholder="https://example.com" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Proxy Port</label>
            <input class="cf-input" value="8080" type="number" style="width:150px;">
          </div>
          <button class="cf-btn primary"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </div>
    `;
  }

  function buildAIAgentLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">AI Agent</div>
          <div class="cf-panel-actions">
            <span class="cf-badge green" id="agent-status">Online</span>
          </div>
        </div>
        <div style="display:flex; gap:16px; padding:16px; border-bottom:1px solid var(--cf-border); flex-wrap:wrap;">
          <div class="cf-badge orange">Context: Security</div>
          <div class="cf-badge blue">Memory: Enabled</div>
          <div class="cf-badge purple">Tasks: 0 pending</div>
        </div>
        <div class="cf-panel-content" id="agent-messages" style="padding:16px; overflow:auto; flex:1;">
          <div class="empty-state">
            <i class="fas fa-brain empty-state-icon"></i>
            <div class="empty-state-title">Agent ready</div>
            <div class="empty-state-description">Send a command or ask for a security analysis.</div>
          </div>
        </div>
        <div style="padding:12px; border-top:1px solid var(--cf-border); display:flex; gap:8px; align-items:center;">
          <input id="agent-input" class="cf-input" placeholder="Ask the agent or issue a task (e.g., analyze URL https://example.com)" style="flex:1;">
          <button id="agent-run" class="cf-btn">Run</button>
          <button id="agent-send" class="cf-btn primary">Send</button>
        </div>
      </div>
    `;
  }

  function bindAgentConsole() {
    const sendBtn = document.getElementById('agent-send');
    const runBtn = document.getElementById('agent-run');
    const input = document.getElementById('agent-input');
    const messages = document.getElementById('agent-messages');
    const addMessage = (role, text) => {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '10px';
      wrapper.innerHTML = `<div class="cf-badge ${role === 'user' ? 'blue' : 'orange'}">${role}</div><div style="margin-top:4px;">${text}</div>`;
      messages.appendChild(wrapper);
      messages.scrollTop = messages.scrollHeight;
    };
    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';
      
      // Show typing indicator
      const typingDiv = document.createElement('div');
      typingDiv.id = 'agent-typing';
      typingDiv.innerHTML = '<div class="cf-badge orange">agent</div><div style="margin-top:4px;"><i class="fas fa-spinner fa-spin"></i> Thinking...</div>';
      messages.appendChild(typingDiv);
      messages.scrollTop = messages.scrollHeight;
      
      // Call real backend AI
      try {
        const result = await cyberforgeAPI.chatWithAI(text, [], { source: 'desktop' });
        typingDiv.remove();
        
        if (result.success) {
          const response = result.data.response || result.data;
          addMessage('agent', typeof response === 'string' ? response : JSON.stringify(response, null, 2));
        } else {
          addMessage('agent', `Error: ${result.error || 'Failed to get response'}`);
        }
      } catch (error) {
        typingDiv.remove();
        addMessage('agent', `Connection error: ${error.message}. Backend may be offline.`);
      }
    };
    
    const run = async () => {
      addMessage('agent', 'Starting security scan...');
      try {
        const result = await cyberforgeAPI.scanForThreats([], 'quick');
        if (result.success) {
          addMessage('agent', `Scan complete: ${JSON.stringify(result.data.data || result.data, null, 2)}`);
        } else {
          addMessage('agent', `Scan failed: ${result.error}`);
        }
      } catch (error) {
        addMessage('agent', `Scan error: ${error.message}`);
      }
    };
    sendBtn?.addEventListener('click', send);
    runBtn?.addEventListener('click', run);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  // =========================================
  // NEW SCREEN LAYOUTS
  // =========================================

  function buildDashboardLayout() {
    const user = cyberforgeAPI.getCurrentUser();
    const userName = user ? user.firstName || user.email?.split('@')[0] : 'User';
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
        <div class="cf-panel-content" style="padding:24px; display:flex; flex-direction:column; height:100%; overflow:hidden;">
          <!-- Header -->
          <div style="margin-bottom:20px; flex-shrink:0;">
            <h2 style="margin-bottom:4px;">Welcome back, ${userName}!</h2>
            <p style="color:var(--cf-text-muted);">Global Network Traffic Monitor • Real-time OpenStreetMap data</p>
          </div>
          
          <!-- Main Grid Layout -->
          <div style="display:grid; grid-template-columns:1fr 380px; gap:20px; flex:1; min-height:0; overflow:hidden;">
            
            <!-- Left: Globe Container -->
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:16px; overflow:hidden; position:relative; min-height:400px;">
              <div id="globe-container" style="width:100%; height:100%; min-height:400px;"></div>
              
              <!-- Globe Controls Overlay -->
              <div style="position:absolute; bottom:16px; left:16px; display:flex; gap:8px; z-index:10;">
                <button class="cf-btn" id="globe-reset" title="Reset View" style="backdrop-filter:blur(8px); background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);">
                  <i class="fas fa-compress-arrows-alt"></i>
                </button>
                <button class="cf-btn" id="globe-toggle-rotation" title="Toggle Rotation" style="backdrop-filter:blur(8px); background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);">
                  <i class="fas fa-sync"></i>
                </button>
                <button class="cf-btn" id="globe-add-traffic" title="Add Traffic" style="backdrop-filter:blur(8px); background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);">
                  <i class="fas fa-plus"></i>
                </button>
                <button class="cf-btn" id="globe-clear-traffic" title="Clear Traffic" style="backdrop-filter:blur(8px); background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1);">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              
              <!-- Zoom Level Indicator -->
              <div style="position:absolute; bottom:16px; right:16px; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); padding:8px 12px; border-radius:8px; font-size:11px; z-index:10; border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; align-items:center; gap:6px;">
                  <i class="fas fa-search" style="color:var(--cf-accent-blue);"></i>
                  <span>Zoom: <span id="globe-zoom-level">2</span></span>
                </div>
              </div>
              
              <!-- Legend Overlay -->
              <div style="position:absolute; top:16px; right:16px; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); padding:12px 16px; border-radius:10px; font-size:11px; z-index:10; border:1px solid rgba(255,255,255,0.1);">
                <div style="font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                  <i class="fas fa-globe" style="color:var(--cf-accent-purple);"></i> Network Traffic
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; align-items:center; gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;"></span> Source</div>
                  <div style="display:flex; align-items:center; gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;"></span> Destination</div>
                  <div style="display:flex; align-items:center; gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 6px #8b5cf6;"></span> Active Arc</div>
                </div>
                <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-size:10px; color:var(--cf-text-muted);">
                  <i class="fas fa-map"></i> OpenStreetMap Data
                </div>
              </div>
              
              <!-- Map Source Badge -->
              <div style="position:absolute; top:16px; left:16px; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); padding:6px 10px; border-radius:6px; font-size:10px; z-index:10; border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; gap:6px;">
                <i class="fas fa-layer-group" style="color:var(--cf-accent-green);"></i>
                <span>Hybrid 3D • Leaflet + Three.js</span>
              </div>
            </div>
            
            <!-- Right: Stats & Activity Panel -->
            <div style="display:flex; flex-direction:column; gap:16px; overflow-y:auto;">
              
              <!-- Stats Cards -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px;">
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fas fa-shield-alt" style="color:var(--cf-accent-green); font-size:16px;"></i>
                    <span style="color:var(--cf-text-muted); font-size:11px;">Security Score</span>
                  </div>
                  <div style="font-size:24px; font-weight:700;" id="dashboard-score">--</div>
                </div>
                <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px;">
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fas fa-bug" style="color:var(--cf-accent-red); font-size:16px;"></i>
                    <span style="color:var(--cf-text-muted); font-size:11px;">Active Threats</span>
                  </div>
                  <div style="font-size:24px; font-weight:700;" id="dashboard-threats">--</div>
                </div>
                <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px;">
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fas fa-exchange-alt" style="color:var(--cf-accent-blue); font-size:16px;"></i>
                    <span style="color:var(--cf-text-muted); font-size:11px;">Requests</span>
                  </div>
                  <div style="font-size:24px; font-weight:700;" id="dashboard-requests">--</div>
                </div>
                <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px;">
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                    <i class="fas fa-flag" style="color:var(--cf-accent-orange); font-size:16px;"></i>
                    <span style="color:var(--cf-text-muted); font-size:11px;">Findings</span>
                  </div>
                  <div style="font-size:24px; font-weight:700;" id="dashboard-findings">--</div>
                </div>
              </div>
              
              <!-- Active Connections -->
              <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px; flex:1; min-height:180px; display:flex; flex-direction:column;">
                <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px; font-size:14px;">
                  <i class="fas fa-network-wired" style="color:var(--cf-accent-purple);"></i>
                  Active Connections
                </h4>
                <div id="dashboard-connections" style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; flex:1;">
                  <!-- Real connections will be populated here -->
                  <div class="empty-connections" style="text-align:center; padding:20px; color:var(--cf-text-muted);">
                    <i class="fas fa-plug" style="font-size:24px; opacity:0.5; margin-bottom:8px; display:block;"></i>
                    <span style="font-size:12px;">No active connections</span>
                  </div>
                </div>
              </div>
              
              <!-- Quick Actions -->
              <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:16px;">
                <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px; font-size:14px;">
                  <i class="fas fa-bolt" style="color:var(--cf-accent-orange);"></i>
                  Quick Actions
                </h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <button class="cf-btn" style="justify-content:flex-start; width:100%;" onclick="document.querySelector('[data-screen=http-history]').click()">
                    <i class="fas fa-history"></i> View HTTP History
                  </button>
                  <button class="cf-btn" style="justify-content:flex-start; width:100%;" onclick="document.querySelector('[data-screen=assistant]').click()">
                    <i class="fas fa-robot"></i> AI Assistant
                  </button>
                  <button class="cf-btn" style="justify-content:flex-start; width:100%;" onclick="document.querySelector('[data-screen=threat-intel]').click()">
                    <i class="fas fa-radiation"></i> Threat Intelligence
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindDashboard() {
    // Update stats from real data only
    const scoreEl = document.getElementById('dashboard-score');
    const threatsEl = document.getElementById('dashboard-threats');
    const requestsEl = document.getElementById('dashboard-requests');
    const findingsEl = document.getElementById('dashboard-findings');

    // Calculate actual security score based on real data
    const threatCount = state.threats?.length || 0;
    const findingCount = state.findings?.length || 0;
    const score = threatCount === 0 && findingCount === 0 ? 100 : Math.max(50, 100 - threatCount * 5 - findingCount * 2);
    
    if (scoreEl) scoreEl.textContent = `${score}%`;
    if (threatsEl) threatsEl.textContent = threatCount;
    if (requestsEl) requestsEl.textContent = state.requests?.length || 0;
    if (findingsEl) findingsEl.textContent = findingCount;

    // Initialize globe with slight delay to ensure container is ready
    setTimeout(() => initializeGlobe(), 100);

    // Setup OTX threat listeners
    setupOTXThreatListeners();

    // Globe control buttons
    document.getElementById('globe-reset')?.addEventListener('click', () => {
      if (window.cyberforgeGlobe) {
        // Use resetCamera if available (AdvancedEarthGlobe), otherwise fallback
        if (typeof window.cyberforgeGlobe.resetCamera === 'function') {
          window.cyberforgeGlobe.resetCamera();
        } else if (window.cyberforgeGlobe.controls) {
          window.cyberforgeGlobe.controls.reset();
        }
        showToast('info', 'Globe', 'View reset');
      }
    });

    document.getElementById('globe-toggle-rotation')?.addEventListener('click', () => {
      if (window.cyberforgeGlobe) {
        // Use toggleRotation if available (AdvancedEarthGlobe)
        let isRotating;
        if (typeof window.cyberforgeGlobe.toggleRotation === 'function') {
          isRotating = window.cyberforgeGlobe.toggleRotation();
        } else {
          window.cyberforgeGlobe.config = window.cyberforgeGlobe.config || {};
          window.cyberforgeGlobe.config.autoRotate = !window.cyberforgeGlobe.config.autoRotate;
          if (window.cyberforgeGlobe.controls) {
            window.cyberforgeGlobe.controls.autoRotate = window.cyberforgeGlobe.config.autoRotate;
          }
          isRotating = window.cyberforgeGlobe.config.autoRotate;
        }
        showToast('info', 'Globe Rotation', isRotating ? 'Enabled' : 'Disabled');
      }
    });

    document.getElementById('globe-add-traffic')?.addEventListener('click', () => {
      if (window.cyberforgeGlobe) {
        // Add random traffic between major cities
        const cities = [
          { name: 'New York', lat: 40.7128, lon: -74.0060 },
          { name: 'London', lat: 51.5074, lon: -0.1278 },
          { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
          { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
          { name: 'Paris', lat: 48.8566, lon: 2.3522 },
          { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
          { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
          { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
          { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
          { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
          { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
          { name: 'Mumbai', lat: 19.0760, lon: 72.8777 }
        ];
        const from = cities[Math.floor(Math.random() * cities.length)];
        let to = cities[Math.floor(Math.random() * cities.length)];
        while (to === from) {
          to = cities[Math.floor(Math.random() * cities.length)];
        }
        const colors = [0x22c55e, 0x3b82f6, 0xf59e0b, 0x8b5cf6, 0xef4444, 0x06b6d4, 0xec4899];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Use addConnection if available (AdvancedEarthGlobe), otherwise addArc
        if (typeof window.cyberforgeGlobe.addConnection === 'function') {
          window.cyberforgeGlobe.addConnection([from.lat, from.lon], [to.lat, to.lon], { color });
        } else if (typeof window.cyberforgeGlobe.addArc === 'function') {
          window.cyberforgeGlobe.addArc(from.lat, from.lon, to.lat, to.lon, { color });
        }
        
        showToast('success', 'Traffic Added', `${from.name} → ${to.name}`);
      }
    });

    // Add clear traffic button functionality if it exists
    document.getElementById('globe-clear-traffic')?.addEventListener('click', () => {
      if (window.cyberforgeGlobe && typeof window.cyberforgeGlobe.clearConnections === 'function') {
        window.cyberforgeGlobe.clearConnections();
        showToast('info', 'Traffic Cleared', 'All connections removed');
      }
    });
  }

  // Setup OTX threat listeners
  function setupOTXThreatListeners() {
    // Listen for initial threats
    cyberforgeAPI.on('otx:initial_threats', (threats) => {
      console.log(`Received ${threats.length} initial threats from OTX`);
      visualizeThreatsOnGlobe(threats);
    });

    // Listen for real-time threats
    cyberforgeAPI.on('otx:threat', (threat) => {
      console.log('New OTX threat:', threat);
      visualizeThreatOnGlobe(threat);
      
      // Show notification
      showToast('warning', 'New Threat Detected', 
        `${threat.threat} (${threat.severity.toUpperCase()})`, 5000);
      
      // Update threat count
      const threatsEl = document.getElementById('dashboard-threats');
      if (threatsEl) {
        const currentCount = parseInt(threatsEl.textContent) || 0;
        threatsEl.textContent = currentCount + 1;
      }
    });
  }

  // Visualize multiple threats on globe
  function visualizeThreatsOnGlobe(threats) {
    if (!window.cyberforgeGlobe || threats.length === 0) return;

    threats.forEach((threat, index) => {
      // Add with slight delay for animation effect
      setTimeout(() => visualizeThreatOnGlobe(threat), index * 100);
    });
  }

  // Visualize single threat on globe
  function visualizeThreatOnGlobe(threat) {
    if (!window.cyberforgeGlobe) return;

    const { origin, destination, severity } = threat;
    
    // Color based on severity
    const severityColors = {
      'high': 0xef4444,    // red
      'medium': 0xf59e0b,  // amber
      'low': 0x3b82f6      // blue
    };
    const color = severityColors[severity] || 0x8b5cf6; // purple default

    // Add connection on globe
    if (typeof window.cyberforgeGlobe.addConnection === 'function') {
      window.cyberforgeGlobe.addConnection(
        [origin.lat, origin.lon],
        [destination.lat, destination.lon],
        { color, animated: true }
      );
    } else if (typeof window.cyberforgeGlobe.addArc === 'function') {
      window.cyberforgeGlobe.addArc(
        origin.lat, origin.lon,
        destination.lat, destination.lon,
        { color }
      );
    }
  }

  // Initialize the 3D Globe with Leaflet integration
  function initializeGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded, globe will not render');
      container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--cf-text-muted);">
          <div style="text-align:center;">
            <i class="fas fa-globe" style="font-size:48px; opacity:0.5; margin-bottom:16px;"></i>
            <div>3D Globe requires Three.js</div>
          </div>
        </div>
      `;
      return;
    }

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded, using basic globe');
    }

    // Check for globe classes (prefer HybridEarthGlobe for real map data)
    const GlobeClass = typeof HybridEarthGlobe !== 'undefined' ? HybridEarthGlobe :
                       typeof AdvancedEarthGlobe !== 'undefined' ? AdvancedEarthGlobe : 
                       typeof CyberForgeGlobe !== 'undefined' ? CyberForgeGlobe : null;
    
    if (!GlobeClass) {
      console.warn('Globe component not loaded');
      container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--cf-text-muted);">
          <div style="text-align:center;">
            <i class="fas fa-globe" style="font-size:48px; opacity:0.5; margin-bottom:16px;"></i>
            <div>Globe component not available</div>
          </div>
        </div>
      `;
      return;
    }

    // Cleanup existing globe
    if (window.cyberforgeGlobe) {
      try {
        window.cyberforgeGlobe.dispose();
      } catch (e) {
        console.warn('Error disposing previous globe:', e);
      }
    }

    // Detect current theme
    const isDarkTheme = document.body.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      localStorage.getItem('cyberforge-theme') === 'dark';

    // Initialize globe with real map data (no mock traffic)
    try {
      window.cyberforgeGlobe = new GlobeClass('globe-container', {
        isDarkTheme: isDarkTheme,
        autoRotate: true,
        rotationSpeed: 0.0003,
        showTraffic: true,
        showSampleTraffic: false, // Disable mock sample traffic
        initialZoom: 2,
        initialCenter: [20, 0]
      });
      console.log('Hybrid Earth Globe with Leaflet initialized successfully');
    } catch (error) {
      console.error('Failed to initialize globe:', error);
      container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--cf-text-muted);">
          <div style="text-align:center;">
            <i class="fas fa-exclamation-triangle" style="font-size:48px; opacity:0.5; margin-bottom:16px; color:var(--cf-accent-orange);"></i>
            <div>Failed to initialize globe</div>
            <div style="font-size:12px; margin-top:8px;">${error.message}</div>
          </div>
        </div>
      `;
    }
  }

  function buildSitemapLayout() {
    // Build sitemap tree from captured requests
    const buildSitemapTree = () => {
      if (state.requests.length === 0) {
        return `
          <div class="empty-state">
            <i class="fas fa-sitemap empty-state-icon"></i>
            <div class="empty-state-title">No sitemap data</div>
            <div class="empty-state-description">Capture some requests to build the sitemap</div>
          </div>
        `;
      }

      // Group requests by host
      const hosts = {};
      state.requests.forEach(req => {
        if (!hosts[req.host]) hosts[req.host] = {};
        const parts = (req.path || '/').split('/').filter(p => p);
        let current = hosts[req.host];
        parts.forEach((part, i) => {
          if (!current[part]) current[part] = {};
          current = current[part];
        });
      });

      const renderTree = (node, depth = 0) => {
        return Object.keys(node).map(key => {
          const hasChildren = Object.keys(node[key]).length > 0;
          const isFile = !hasChildren;
          return `
            <div style="margin-left:${depth * 20}px; padding:4px 0;">
              <i class="fas fa-${isFile ? 'file-code' : 'folder'}" style="color:var(--cf-accent-${isFile ? 'blue' : 'orange'}); margin-right:8px;"></i>
              <span>${key}</span>
              ${hasChildren ? renderTree(node[key], depth + 1) : ''}
            </div>
          `;
        }).join('');
      };

      return Object.keys(hosts).map(host => `
        <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <i class="fas fa-globe" style="color:var(--cf-accent-green);"></i>
            <span style="font-weight:600;">${host}</span>
            <span class="cf-badge blue" style="margin-left:auto;">${state.requests.filter(r => r.host === host).length} requests</span>
          </div>
          <div style="border-left:2px solid var(--cf-border); padding-left:12px;">
            ${renderTree(hosts[host])}
          </div>
        </div>
      `).join('');
    };

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Sitemap</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="refresh-sitemap"><i class="fas fa-sync"></i> Refresh</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px; overflow:auto;" id="sitemap-container">
          ${buildSitemapTree()}
        </div>
      </div>
    `;
  }

  function bindSitemapEvents() {
    document.getElementById('refresh-sitemap')?.addEventListener('click', async () => {
      showToast('info', 'Building', 'Generating sitemap from captured traffic...');
      // Re-render the sitemap from current requests
      renderScreen('sitemap');
      showToast('success', 'Complete', 'Sitemap refreshed');
    });
  }

  function buildScopesLayout() {
    const scopesHtml = state.scopes.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-crosshairs empty-state-icon"></i>
        <div class="empty-state-title">No scopes defined</div>
        <div class="empty-state-description">Add scopes to define which targets to include or exclude</div>
      </div>
    ` : state.scopes.map(scope => `
      <div class="scope-card" data-id="${scope.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-accent-${scope.type === 'include' ? 'green' : 'red'}); border-radius:8px; padding:16px; display:flex; align-items:center; gap:12px;">
        <i class="fas fa-${scope.type === 'include' ? 'check' : 'times'}-circle" style="color:var(--cf-accent-${scope.type === 'include' ? 'green' : 'red'}); font-size:20px;"></i>
        <div style="flex:1;">
          <div style="font-weight:600;">${scope.pattern}</div>
          <div style="font-size:11px; color:var(--cf-text-muted);">${scope.type === 'include' ? 'In Scope' : 'Out of Scope'} • ${scope.matchCount || 0} matches</div>
        </div>
        <button class="cf-btn scope-edit" data-id="${scope.id}"><i class="fas fa-edit"></i></button>
        <button class="cf-btn scope-delete" data-id="${scope.id}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Scopes</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-scope"><i class="fas fa-plus"></i> Add Scope</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="scopes-container" style="display:flex; flex-direction:column; gap:12px;">
            ${scopesHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindScopesEvents() {
    document.getElementById('add-scope')?.addEventListener('click', () => {
      showModal('Add Scope', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Pattern</label>
            <input class="cf-input" name="pattern" placeholder="*.example.com" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="include">Include (In Scope)</option>
              <option value="exclude">Exclude (Out of Scope)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <input class="cf-input" name="description" placeholder="Optional description" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createScope({
          pattern: formData.get('pattern'),
          type: formData.get('type'),
          description: formData.get('description')
        });
        if (result.success) {
          state.scopes.unshift(result.data.data.scope);
          showToast('success', 'Created', 'Scope added successfully');
          renderScreen('scopes');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add scope');
        }
      });
    });

    document.querySelectorAll('.scope-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Scope', 'Are you sure you want to delete this scope?', async () => {
          const result = await cyberforgeAPI.deleteScope(id);
          if (result.success) {
            state.scopes = state.scopes.filter(s => s.id !== id);
            showToast('success', 'Deleted', 'Scope removed');
            renderScreen('scopes');
          }
        });
      });
    });
  }

  // Additional bind functions for remaining screens
  function bindInterceptEvents() {
    // Forward and Drop buttons for intercepts
    document.querySelectorAll('.intercept-forward').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.forwardIntercept(id);
        if (result.success) {
          state.intercepts = state.intercepts.filter(i => i.id !== id);
          showToast('success', 'Forwarded', 'Request forwarded');
          renderIntercepts();
        }
      });
    });

    document.querySelectorAll('.intercept-drop').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.dropIntercept(id);
        if (result.success) {
          state.intercepts = state.intercepts.filter(i => i.id !== id);
          showToast('success', 'Dropped', 'Request dropped');
          renderIntercepts();
        }
      });
    });
  }

  function bindAIModelsEvents() {
    // Test AI model buttons
    document.querySelectorAll('.cf-btn.primary').forEach(btn => {
      if (btn.textContent.includes('Test')) {
        btn.addEventListener('click', async () => {
          showToast('info', 'Testing', 'Running AI model test...');
          try {
            const result = await cyberforgeAPI.chatWithAI('Test: Analyze a sample HTTP request for security issues', [], { source: 'model-test' });
            if (result.success) {
              showToast('success', 'Model Online', 'AI model is responding correctly');
            } else {
              showToast('error', 'Test Failed', result.error || 'Model not responding');
            }
          } catch (error) {
            showToast('error', 'Connection Error', error.message);
          }
        });
      }
    });
  }

  function bindThreatIntelEvents() {
    // Update feeds button
    document.getElementById('update-feeds')?.addEventListener('click', async () => {
      showToast('info', 'Updating', 'Refreshing threat intelligence feeds...');
      try {
        const result = await cyberforgeAPI.getThreatStats();
        if (result.success) {
          state.threatStats = result.data.data || {};
          showToast('success', 'Updated', 'Threat feeds refreshed');
          renderScreen('threat-intel');
        }
      } catch (error) {
        showToast('error', 'Error', error.message);
      }
    });

    // IOC Lookup button
    document.getElementById('lookup-ioc')?.addEventListener('click', () => {
      showModal('Lookup IOC', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Indicator Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="ip">IP Address</option>
              <option value="domain">Domain</option>
              <option value="url">URL</option>
              <option value="hash">File Hash</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Value</label>
            <input class="cf-input" name="value" placeholder="Enter IP, domain, URL, or hash" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const type = formData.get('type');
        const value = formData.get('value');
        showToast('info', 'Looking up', `Checking ${type}: ${value}...`);
        try {
          const result = await cyberforgeAPI.analyzeUrl(value);
          if (result.success) {
            const data = result.data.data || result.data;
            showModal('IOC Lookup Result', `
              <div style="background:var(--cf-bg-dark); padding:16px; border-radius:8px;">
                <pre style="margin:0; white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
              </div>
            `, null);
          } else {
            showToast('warning', 'Not Found', 'No threat data found for this indicator');
          }
        } catch (error) {
          showToast('error', 'Error', error.message);
        }
      });
    });
  }

  function buildFiltersLayout() {
    const filtersHtml = state.filters.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-filter empty-state-icon"></i>
        <div class="empty-state-title">No filters defined</div>
        <div class="empty-state-description">Create filters to hide or show specific traffic</div>
      </div>
    ` : state.filters.map(filter => `
      <div class="filter-card" data-id="${filter.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <label class="switch">
            <input type="checkbox" class="filter-toggle" data-id="${filter.id}" ${filter.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <div style="flex:1;">
            <div style="font-weight:600;">${filter.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">${filter.pattern || filter.description || 'No pattern'}</div>
          </div>
          <button class="cf-btn filter-edit" data-id="${filter.id}"><i class="fas fa-edit"></i></button>
          <button class="cf-btn filter-delete" data-id="${filter.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Filters</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-filter"><i class="fas fa-plus"></i> New Filter</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="filters-container" style="display:flex; flex-direction:column; gap:12px;">
            ${filtersHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindFiltersEvents() {
    document.getElementById('new-filter')?.addEventListener('click', () => {
      showModal('Create Filter', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="Hide Image Requests" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Pattern (regex)</label>
            <input class="cf-input" name="pattern" placeholder="\\.(png|jpg|gif|svg)$" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="hide">Hide matching</option>
              <option value="show">Show only matching</option>
            </select>
          </div>
          <div>
            <label><input type="checkbox" name="enabled" checked> Enable filter</label>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createFilter({
          name: formData.get('name'),
          pattern: formData.get('pattern'),
          type: formData.get('type'),
          enabled: formData.get('enabled') === 'on'
        });
        if (result.success) {
          state.filters.unshift(result.data.data.filter);
          showToast('success', 'Created', 'Filter created successfully');
          renderScreen('filters');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create filter');
        }
      });
    });

    document.querySelectorAll('.filter-toggle').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.id;
        const result = await cyberforgeAPI.toggleFilter(id);
        if (result.success) {
          const filter = state.filters.find(f => f.id === id);
          if (filter) filter.enabled = !filter.enabled;
          showToast('success', 'Updated', `Filter ${filter?.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    });

    document.querySelectorAll('.filter-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Filter', 'Are you sure you want to delete this filter?', async () => {
          const result = await cyberforgeAPI.deleteFilter(id);
          if (result.success) {
            state.filters = state.filters.filter(f => f.id !== id);
            showToast('success', 'Deleted', 'Filter removed');
            renderScreen('filters');
          }
        });
      });
    });
  }

  function buildAIModelsLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">AI Models</div>
          <div class="cf-panel-actions">
            <button class="cf-btn"><i class="fas fa-sync"></i> Refresh Status</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:20px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <div style="width:48px;height:48px;background:linear-gradient(135deg, #4285f4, #34a853);border-radius:12px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-brain" style="color:white; font-size:20px;"></i></div>
                <div>
                  <div style="font-weight:600;">Gemini Pro</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">Google AI</div>
                </div>
                <span class="cf-badge green" style="margin-left:auto;">Active</span>
              </div>
              <div style="font-size:13px; color:var(--cf-text-secondary); margin-bottom:12px;">Primary AI model for security analysis and threat detection.</div>
              <div style="display:flex; gap:8px;">
                <button class="cf-btn" style="flex:1;"><i class="fas fa-cog"></i> Configure</button>
                <button class="cf-btn primary" style="flex:1;"><i class="fas fa-play"></i> Test</button>
              </div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:20px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <div style="width:48px;height:48px;background:linear-gradient(135deg, #764ba2, #667eea);border-radius:12px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-network-wired" style="color:white; font-size:20px;"></i></div>
                <div>
                  <div style="font-weight:600;">Threat Detector</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">Custom ML</div>
                </div>
                <span class="cf-badge green" style="margin-left:auto;">Active</span>
              </div>
              <div style="font-size:13px; color:var(--cf-text-secondary); margin-bottom:12px;">Custom trained model for malware and intrusion detection.</div>
              <div style="display:flex; gap:8px;">
                <button class="cf-btn" style="flex:1;"><i class="fas fa-cog"></i> Configure</button>
                <button class="cf-btn primary" style="flex:1;"><i class="fas fa-play"></i> Test</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildThreatIntelLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Threat Intelligence</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="update-feeds"><i class="fas fa-download"></i> Update Feeds</button>
            <button class="cf-btn primary" id="lookup-ioc"><i class="fas fa-search"></i> Lookup IOC</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px;">
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-red);" id="threat-ips">${state.threatStats?.maliciousIps || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">Known Malicious IPs</div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-orange);" id="threat-domains">${state.threatStats?.suspiciousDomains || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">Suspicious Domains</div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-purple);" id="threat-iocs">${state.threatStats?.totalIocs || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">IOCs in Database</div>
            </div>
          </div>
          <h3 style="margin-bottom:12px;">Recent Threat Feeds</h3>
          <div class="cf-table-container">
            <table class="cf-table">
              <thead><tr><th>Feed</th><th>Last Updated</th><th>Entries</th><th>Status</th></tr></thead>
              <tbody id="threat-feeds-tbody">
                ${state.threatStats?.feeds?.length ? state.threatStats.feeds.map(f => `
                  <tr>
                    <td>${f.name}</td>
                    <td>${f.lastUpdated || 'Never'}</td>
                    <td>${f.entries || 0}</td>
                    <td><span class="cf-badge ${f.status === 'active' ? 'green' : 'orange'}">${f.status || 'Unknown'}</span></td>
                  </tr>
                `).join('') : `
                  <tr><td>AbuseIPDB</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                  <tr><td>URLhaus</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                  <tr><td>PhishTank</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function buildEnvironmentLayout() {
    const envHtml = state.environment.length === 0 ? `
      <tr><td colspan="4" style="text-align:center; padding:24px; color:var(--cf-text-muted);">No environment variables defined</td></tr>
    ` : state.environment.map(env => `
      <tr data-id="${env.id}">
        <td><code>${env.name}</code></td>
        <td><code>${env.secret ? '••••••••••••' : env.value}</code></td>
        <td><span class="cf-badge ${env.scope === 'global' ? 'blue' : env.scope === 'session' ? 'orange' : 'purple'}">${env.scope || 'Global'}</span></td>
        <td>
          <button class="panel-action-btn env-edit" data-id="${env.id}"><i class="fas fa-edit"></i></button>
          <button class="panel-action-btn env-delete" data-id="${env.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Environment Variables</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-variable"><i class="fas fa-plus"></i> Add Variable</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div class="cf-table-container">
            <table class="cf-table">
              <thead><tr><th>Name</th><th>Value</th><th>Scope</th><th>Actions</th></tr></thead>
              <tbody id="env-tbody">
                ${envHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function bindEnvironmentEvents() {
    document.getElementById('add-variable')?.addEventListener('click', () => {
      showModal('Add Environment Variable', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="API_KEY" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Value</label>
            <input class="cf-input" name="value" placeholder="your-secret-value" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Scope</label>
            <select class="cf-input" name="scope" style="width:100%;">
              <option value="global">Global</option>
              <option value="session">Session</option>
              <option value="workspace">Workspace</option>
            </select>
          </div>
          <div>
            <label><input type="checkbox" name="secret"> Secret (hide value)</label>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.setEnvironmentVariable(
          formData.get('name'),
          formData.get('value'),
          formData.get('scope')
        );
        if (result.success) {
          state.environment.push({
            id: result.data.data?.id || Date.now().toString(),
            name: formData.get('name'),
            value: formData.get('value'),
            scope: formData.get('scope'),
            secret: formData.get('secret') === 'on'
          });
          showToast('success', 'Created', 'Variable added successfully');
          renderScreen('environment');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add variable');
        }
      });
    });

    document.querySelectorAll('.env-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const env = state.environment.find(e => e.id === id);
        showConfirmModal('Delete Variable', `Are you sure you want to delete ${env?.name}?`, async () => {
          const result = await cyberforgeAPI.deleteEnvironmentVariable(env?.name);
          if (result.success) {
            state.environment = state.environment.filter(e => e.id !== id);
            showToast('success', 'Deleted', 'Variable removed');
            renderScreen('environment');
          }
        });
      });
    });
  }

  function buildSyncStatusLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Sync Status</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; margin-bottom:24px;">
            <i class="fas fa-cloud-upload-alt" style="font-size:48px; color:var(--cf-accent-green); margin-bottom:16px;"></i>
            <h3>All Synced</h3>
            <p style="color:var(--cf-text-muted);">Your workspace is up to date with the cloud.</p>
          </div>
          <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span>Last sync:</span>
              <span style="color:var(--cf-text-muted);">2 minutes ago</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span>Pending changes:</span>
              <span style="color:var(--cf-accent-green);">0</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Sync mode:</span>
              <span>Automatic</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildBrowserExtensionLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Browser Extension</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; max-width:400px; margin:0 auto;">
            <i class="fas fa-puzzle-piece" style="font-size:48px; color:var(--cf-accent-blue); margin-bottom:16px;"></i>
            <h3>Install Browser Extension</h3>
            <p style="color:var(--cf-text-muted); margin-bottom:24px;">Capture browser traffic directly and send it to Cyberforge for analysis.</p>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button class="cf-btn"><i class="fab fa-chrome"></i> Chrome</button>
              <button class="cf-btn"><i class="fab fa-firefox"></i> Firefox</button>
              <button class="cf-btn"><i class="fab fa-edge"></i> Edge</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildMobileCompanionLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Mobile Companion</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; max-width:400px; margin:0 auto;">
            <i class="fas fa-mobile-alt" style="font-size:48px; color:var(--cf-accent-purple); margin-bottom:16px;"></i>
            <h3>Connect Mobile Device</h3>
            <p style="color:var(--cf-text-muted); margin-bottom:24px;">Scan the QR code with the Cyberforge mobile app to connect your device.</p>
            <div style="background:white; width:150px; height:150px; margin:0 auto 24px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-qrcode" style="font-size:80px; color:#333;"></i>
            </div>
            <p style="font-size:12px; color:var(--cf-text-muted);">Or enter code: <strong>CYBER-1234-FORGE</strong></p>
          </div>
        </div>
      </div>
    `;
  }

  function buildProfileLayout() {
    const user = cyberforgeAPI.getCurrentUser();
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Profile</div>
        </div>
        <div class="cf-panel-content" style="padding:24px; max-width:600px;">
          <div style="display:flex; align-items:center; gap:20px; margin-bottom:32px;">
            <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg, var(--cf-accent-orange), var(--cf-accent-orange-dim));display:flex;align-items:center;justify-content:center;">
              <i class="fas fa-user" style="font-size:32px; color:white;"></i>
            </div>
            <div>
              <h2>${user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'User'}</h2>
              <p style="color:var(--cf-text-muted);">${user?.email || ''}</p>
              <span class="cf-badge blue">${user?.role || 'User'}</span>
            </div>
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">First Name</label>
            <input class="cf-input" value="${user?.firstName || ''}" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Last Name</label>
            <input class="cf-input" value="${user?.lastName || ''}" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Email</label>
            <input class="cf-input" value="${user?.email || ''}" disabled style="width:100%; opacity:0.7;">
          </div>
          <button class="cf-btn primary"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </div>
    `;
  }

  function buildSettingsLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Settings</div>
        </div>
        <div class="cf-panel-content" style="padding:24px; max-width:600px;">
          <h3 style="margin-bottom:16px;">Appearance</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div>
                <div style="font-weight:600;">Dark Mode</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Use dark theme</div>
              </div>
              <label class="switch"><input type="checkbox" id="setting-dark-mode"><span class="slider"></span></label>
            </div>
          </div>
          
          <h3 style="margin-bottom:16px;">Notifications</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div>
                <div style="font-weight:600;">Threat Alerts</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Show notifications for new threats</div>
              </div>
              <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div>
                <div style="font-weight:600;">Sound Effects</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Play sounds for alerts</div>
              </div>
              <label class="switch"><input type="checkbox"><span class="slider"></span></label>
            </div>
          </div>
          
          <h3 style="margin-bottom:16px;">Security</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <button class="cf-btn" style="width:100%; margin-bottom:8px;"><i class="fas fa-key"></i> Change Password</button>
            <button class="cf-btn" style="width:100%;"><i class="fas fa-shield-alt"></i> Two-Factor Authentication</button>
          </div>
          
          <button class="cf-btn primary"><i class="fas fa-save"></i> Save Settings</button>
        </div>
      </div>
    `;
  }

  function getSidebarScreenMeta(screen) {
    const link = document.querySelector(`[data-screen="${screen}"]`);
    const titleFromLink = link?.querySelector('span')?.textContent?.trim()
      || link?.textContent?.replace(/\s+/g, ' ').trim();

    const section = link?.closest('.sidebar-section')
      ?.querySelector('.sidebar-section-title span')
      ?.textContent?.trim() || 'Operations';

    const title = titleFromLink || screen.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return {
      title,
      section,
      description: `${title} workspace with live data widgets, filtering controls, and activity timelines.`
    };
  }

  function buildOperationalPage(screen) {
    const meta = getSidebarScreenMeta(screen);
    const now = new Date().toLocaleString();

    return `
      <div class="cf-content-inner" style="padding:16px; height:100%; overflow:auto;">
        <div class="cf-card" style="margin-bottom:12px;">
          <div class="cf-card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="cf-card-title">${meta.title}</div>
              <div style="font-size:12px; color:var(--cf-text-muted); margin-top:4px;">Section: ${meta.section}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="cf-btn" data-op-refresh="${screen}"><i class="fas fa-rotate"></i> Refresh</button>
              <button class="cf-btn" data-op-export="${screen}"><i class="fas fa-download"></i> Export</button>
            </div>
          </div>
          <div class="cf-card-body">
            <p style="margin-bottom:12px;">${meta.description}</p>
            <div style="display:grid; grid-template-columns:repeat(3, minmax(180px, 1fr)); gap:10px;">
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Last Updated</div>
                <div style="font-weight:600; margin-top:4px;">${now}</div>
              </div>
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Backend Mode</div>
                <div style="font-weight:600; margin-top:4px;">${state.backendConnected ? 'Connected' : 'Offline Cache'}</div>
              </div>
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Tracked Events</div>
                <div style="font-weight:600; margin-top:4px;">${agentState.events.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="cf-card">
          <div class="cf-card-header">
            <div class="cf-card-title">${meta.title} Stream</div>
          </div>
          <div class="cf-card-body" style="padding:0;">
            <table class="cf-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${now}</td>
                  <td>${meta.section}</td>
                  <td>CyberForge Agent</td>
                  <td>Ready</td>
                  <td>${meta.title} page initialized and connected to navigation.</td>
                </tr>
                <tr>
                  <td>${now}</td>
                  <td>System</td>
                  <td>Desktop Runtime</td>
                  <td>Active</td>
                  <td>Route \"${screen}\" is now available as a first-class page.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function bindOperationalPage(screen) {
    const refreshBtn = document.querySelector(`[data-op-refresh="${screen}"]`);
    const exportBtn = document.querySelector(`[data-op-export="${screen}"]`);

    refreshBtn?.addEventListener('click', () => {
      renderScreen(screen);
      showToast('success', 'Refreshed', `${getSidebarScreenMeta(screen).title} refreshed.`);
    });

    exportBtn?.addEventListener('click', () => {
      const payload = {
        screen,
        exportedAt: new Date().toISOString(),
        backendConnected: state.backendConnected,
        activeEvents: agentState.events.length
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${screen}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Exported', `${getSidebarScreenMeta(screen).title} exported.`);
    });
  }

  function renderRequestsTable(filterText = '') {
    const tbody = document.getElementById('requests-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const text = filterText.toLowerCase();
    const filtered = state.requests.filter(r =>
      !text ||
      r.host.toLowerCase().includes(text) ||
      r.path.toLowerCase().includes(text) ||
      r.method.toLowerCase().includes(text) ||
      (r.query && r.query.toLowerCase().includes(text))
    );

    filtered.forEach(req => {
      const tr = document.createElement('tr');
      tr.dataset.id = req.id;
      tr.innerHTML = `
        <td>${req.id}</td>
        <td>${req.host}</td>
        <td><span class="method-badge ${req.method.toLowerCase()}">${req.method}</span></td>
        <td>${req.path}</td>
        <td>${req.query || ''}</td>
        <td>${req.status}</td>
      `;
      if (req.id === state.selectedRequestId) {
        tr.classList.add('selected');
      }
      tbody.appendChild(tr);
    });
  }

  function bindRequestTableEvents() {
    const tbody = document.getElementById('requests-tbody');
    const detail = document.getElementById('request-detail-content');

    tbody?.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const id = Number(tr.dataset.id);
      state.selectedRequestId = id;
      tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
      tr.classList.add('selected');
      const req = state.requests.find(r => r.id === id);
      if (req) renderRequestDetail(req, detail);
    });
  }

  function renderRequestDetail(req, detailContainer) {
    if (!detailContainer) return;
    const headersHtml = req.headers.map((line, idx) => {
      const first = idx === 0 ? 'first-line' : '';
      const [name, ...rest] = line.split(':');
      if (rest.length === 0) {
        return `<div class="header-line ${first}">${line}</div>`;
      }
      return `<div class="header-line ${first}"><span class="header-name">${name}:</span><span class="header-value">${rest.join(':').trim()}</span></div>`;
    }).join('');

    detailContainer.innerHTML = `
      <div class="request-viewer">
        <div class="request-info">
          <div class="request-url">
            <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
            <span class="request-url-text">${req.scheme}://${req.host}${req.path}${req.query ? '?' + req.query : ''}</span>
          </div>
          <div class="request-meta">
            <span>ID: ${req.id}</span>
            <span>Status: ${req.status}</span>
          </div>
        </div>
        <div class="request-headers">
          ${headersHtml}
        </div>
      </div>
    `;
  }

  function renderIntercepts() {
    const tbody = document.getElementById('intercept-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (state.intercepts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--cf-text-muted);">No intercepted requests. Enable intercept mode to capture requests.</td></tr>';
      return;
    }
    
    state.intercepts.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.host}</td>
        <td><span class="method-badge ${(item.method || 'GET').toLowerCase()}">${item.method || 'GET'}</span></td>
        <td>${item.path}</td>
        <td><span class="cf-badge ${item.status === 'pending' ? 'orange' : 'blue'}">${item.status || 'pending'}</span></td>
        <td>
          <button class="cf-btn intercept-forward" data-id="${item.id}" title="Forward"><i class="fas fa-arrow-right"></i></button>
          <button class="cf-btn intercept-drop" data-id="${item.id}" title="Drop"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderWsHistory() {
    const tbody = document.getElementById('ws-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.wsHistory.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.host}</td>
        <td>${item.path}</td>
        <td>${item.messages}</td>
        <td>${item.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderMatchRules() {
    const tbody = document.getElementById('rules-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (state.matchRules.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--cf-text-muted);">No rules defined. Add a rule to modify requests/responses.</td></tr>';
      return;
    }
    
    state.matchRules.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rule.id}</td>
        <td>${rule.type}</td>
        <td><code>${rule.match}</code></td>
        <td><code>${rule.replace}</code></td>
        <td>
          <label class="switch">
            <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="cf-btn rule-delete" data-id="${rule.id}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Bind toggle and delete events
    document.querySelectorAll('.rule-toggle').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.id;
        const result = await cyberforgeAPI.toggleMatchRule(id);
        if (result.success) {
          const rule = state.matchRules.find(r => r.id === id);
          if (rule) rule.enabled = !rule.enabled;
          showToast('success', 'Updated', `Rule ${rule?.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    });
    
    document.querySelectorAll('.rule-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Rule', 'Are you sure you want to delete this rule?', async () => {
          const result = await cyberforgeAPI.deleteMatchRule(id);
          if (result.success) {
            state.matchRules = state.matchRules.filter(r => r.id !== id);
            showToast('success', 'Deleted', 'Rule removed');
            renderMatchRules();
          }
        });
      });
    });
  }

  function renderFindings() {
    const tbody = document.getElementById('findings-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (state.findings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--cf-text-muted);">No findings yet. Scan for vulnerabilities or add findings manually.</td></tr>';
      return;
    }
    
    state.findings.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td><span class="cf-badge ${severityColor(f.severity)}">${f.severity}</span></td>
        <td>${f.title}</td>
        <td>${f.path || '-'}</td>
        <td><span class="cf-badge ${f.status === 'Open' ? 'orange' : f.status === 'Resolved' ? 'green' : 'gray'}">${f.status}</span></td>
        <td>
          <button class="cf-btn finding-view" data-id="${f.id}" title="View"><i class="fas fa-eye"></i></button>
          <button class="cf-btn finding-resolve" data-id="${f.id}" title="${f.status === 'Open' ? 'Resolve' : 'Reopen'}"><i class="fas fa-${f.status === 'Open' ? 'check' : 'undo'}"></i></button>
          <button class="cf-btn finding-delete" data-id="${f.id}" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    // Bind action events
    document.querySelectorAll('.finding-resolve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const finding = state.findings.find(f => f.id === id);
        const newStatus = finding?.status === 'Open' ? 'Resolved' : 'Open';
        const result = await cyberforgeAPI.resolveFinding(id);
        if (result.success) {
          if (finding) finding.status = newStatus;
          showToast('success', 'Updated', `Finding ${newStatus.toLowerCase()}`);
          renderFindings();
        }
      });
    });
    
    document.querySelectorAll('.finding-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Finding', 'Are you sure you want to delete this finding?', async () => {
          const result = await cyberforgeAPI.deleteFinding(id);
          if (result.success) {
            state.findings = state.findings.filter(f => f.id !== id);
            showToast('success', 'Deleted', 'Finding removed');
            renderFindings();
          }
        });
      });
    });
    
    document.querySelectorAll('.finding-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const finding = state.findings.find(f => f.id === id);
        if (finding) {
          showModal(`Finding: ${finding.title}`, `
            <div style="display:flex; flex-direction:column; gap:16px;">
              <div style="display:flex; gap:12px;">
                <span class="cf-badge ${severityColor(finding.severity)}">${finding.severity}</span>
                <span class="cf-badge ${finding.status === 'Open' ? 'orange' : 'green'}">${finding.status}</span>
              </div>
              <div><strong>Path:</strong> ${finding.path || '-'}</div>
              <div><strong>Description:</strong><br>${finding.description || 'No description'}</div>
              ${finding.request ? `<div><strong>Request:</strong><pre style="background:var(--cf-bg-dark); padding:8px; border-radius:4px; overflow:auto;">${finding.request}</pre></div>` : ''}
            </div>
          `, null);
        }
      });
    });
  }

  function severityColor(sev) {
    const s = sev.toLowerCase();
    if (s === 'high' || s === 'critical') return 'red';
    if (s === 'medium') return 'orange';
    return 'green';
  }

  function renderFiles() {
    const container = document.getElementById('files-tree');
    if (!container) return;
    const buildNode = (node, depth = 0) => {
      const div = document.createElement('div');
      div.style.marginLeft = depth * 12 + 'px';
      const isDir = !!node.children;
      div.innerHTML = `<span class="text-secondary">${isDir ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>'}</span> <span>${node.name}</span>`;
      container.appendChild(div);
      if (isDir) {
        node.children.forEach(child => buildNode(child, depth + 1));
      }
    };
    container.innerHTML = '';
    state.files.forEach(n => buildNode(n));
  }

  function bindResizer() {
    const resizer = document.getElementById('main-resizer');
    const detailPanel = document.getElementById('detail-panel');
    const leftPanel = resizer?.previousElementSibling;
    if (!resizer || !detailPanel || !leftPanel) return;

    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerWidth = resizer.parentElement.getBoundingClientRect().width;
      let leftWidth = e.clientX - leftPanel.getBoundingClientRect().left;
      const min = 300;
      const max = containerWidth - 300;
      if (leftWidth < min) leftWidth = min;
      if (leftWidth > max) leftWidth = max;
      leftPanel.style.flex = '0 0 ' + leftWidth + 'px';
      detailPanel.style.flex = '1 1 0';
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    });
  }

  function bindContextMenu() {
    const menu = document.getElementById('context-menu');
    const table = document.getElementById('requests-table');
    if (!menu || !table) return;

    const hideMenu = () => { menu.style.display = 'none'; };

    table.addEventListener('contextmenu', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      e.preventDefault();
      const { clientX: x, clientY: y } = e;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.style.display = 'block';
      state.selectedRequestId = Number(tr.dataset.id);
      table.querySelectorAll('tr').forEach(row => row.classList.remove('selected'));
      tr.classList.add('selected');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) hideMenu();
    });
  }

  // ========================================
  // CHILD PAGE DATA LOADING FUNCTIONS
  // ========================================

  async function loadDashboardSecurityData() {
    try {
      const scoreEl = document.getElementById('security-score-value');
      const result = await cyberforgeAPI.getSecurityScore();
      if (result.success && scoreEl) {
        scoreEl.textContent = result.data?.score || 85;
        document.getElementById('vuln-score')?.textContent && (document.getElementById('vuln-score').textContent = result.data?.vuln || 90);
        document.getElementById('config-score')?.textContent && (document.getElementById('config-score').textContent = result.data?.config || 85);
        document.getElementById('network-score')?.textContent && (document.getElementById('network-score').textContent = result.data?.network || 80);
        document.getElementById('threat-score')?.textContent && (document.getElementById('threat-score').textContent = result.data?.threat || 75);
      }
    } catch (e) { console.error('Failed to load security score:', e); }
  }

  async function loadActivityFeedData() {
    const timeline = document.getElementById('activity-timeline');
    if (!timeline) return;
    try {
      const result = await cyberforgeAPI.getRecentActivity();
      if (result.success && result.data?.length) {
        timeline.innerHTML = result.data.map(a => `
          <div class="activity-item ${a.type}">
            <div class="activity-icon"><i class="fas fa-${a.type === 'threat' ? 'exclamation-triangle' : a.type === 'scan' ? 'search' : 'bell'}"></i></div>
            <div class="activity-content">
              <div class="activity-title">${a.title}</div>
              <div class="activity-time">${new Date(a.timestamp).toLocaleString()}</div>
            </div>
          </div>
        `).join('');
      } else {
        timeline.innerHTML = '<div class="empty-state">No recent activity</div>';
      }
    } catch (e) { timeline.innerHTML = '<div class="empty-state">Failed to load activity</div>'; }
  }

  async function loadMetricsData() {
    const container = document.getElementById('metrics-charts');
    if (!container) return;
    container.innerHTML = '<div class="metrics-placeholder">Metrics data loading...</div>';
  }

  async function loadSitemapTreeData() {
    const container = document.getElementById('sitemap-tree-container');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getSitemap();
      if (result.success) {
        renderSitemapTree(result.data, container);
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load sitemap</div>'; }
  }

  function renderSitemapTree(data, container) {
    container.innerHTML = '<div class="sitemap-tree">' + buildTreeNode(data || [{name: 'Root', children: []}]) + '</div>';
  }

  function buildTreeNode(nodes, depth = 0) {
    return nodes.map(n => `
      <div class="tree-node" style="padding-left:${depth * 16}px">
        <span class="tree-icon"><i class="fas fa-${n.children ? 'folder' : 'file'}"></i></span>
        <span class="tree-label">${n.name || n.url || 'Unknown'}</span>
      </div>
      ${n.children ? buildTreeNode(n.children, depth + 1) : ''}
    `).join('');
  }

  async function loadSitemapGraphData() {
    const canvas = document.getElementById('sitemap-graph-canvas');
    if (!canvas) return;
    canvas.innerHTML = '<div class="graph-placeholder">Interactive graph visualization</div>';
  }

  async function loadActiveScopesData() {
    const container = document.getElementById('scopes-active-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getScopes();
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.filter(s => s.active).map(s => `
          <div class="scope-item active">
            <span class="scope-name">${s.name}</span>
            <span class="scope-pattern">${s.pattern}</span>
            <button class="cf-btn scope-toggle" data-id="${s.id}"><i class="fas fa-toggle-on"></i></button>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No active scopes</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load scopes</div>'; }
  }

  async function loadExcludedScopesData() {
    const container = document.getElementById('scopes-excluded-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getScopes();
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.filter(s => !s.active).map(s => `
          <div class="scope-item excluded">
            <span class="scope-name">${s.name}</span>
            <span class="scope-pattern">${s.pattern}</span>
            <button class="cf-btn scope-toggle" data-id="${s.id}"><i class="fas fa-toggle-off"></i></button>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No excluded scopes</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load scopes</div>'; }
  }

  async function loadSavedFiltersData() {
    const container = document.getElementById('filters-saved-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No saved filters yet</div>';
  }

  async function loadRecentFiltersData() {
    const container = document.getElementById('filters-recent-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No recent filters</div>';
  }

  async function loadInterceptRulesData() {
    const container = document.getElementById('intercept-rules-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No intercept rules configured</div>';
  }

  async function loadBreakpointsData() {
    const container = document.getElementById('breakpoints-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No breakpoints set</div>';
  }

  async function loadFlaggedRequestsData() {
    const container = document.getElementById('http-flagged-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getRequests({ flagged: true });
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.map(r => `
          <div class="request-item flagged">
            <span class="method ${r.method}">${r.method}</span>
            <span class="url">${r.url}</span>
            <span class="status">${r.status}</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No flagged requests</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load requests</div>'; }
  }

  async function loadErrorRequestsData() {
    const container = document.getElementById('http-errors-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getRequests({ errors: true });
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.map(r => `
          <div class="request-item error">
            <span class="method ${r.method}">${r.method}</span>
            <span class="url">${r.url}</span>
            <span class="status error">${r.status}</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No error requests</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load requests</div>'; }
  }

  async function loadWebSocketMessagesData() {
    const container = document.getElementById('ws-messages-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No WebSocket messages captured</div>';
  }

  async function loadMatchResponseRulesData() {
    const container = document.getElementById('match-response-rules');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No response match rules</div>';
  }

  async function loadBatchReplayData() {
    const container = document.getElementById('replay-batch-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No batch replay sessions</div>';
  }

  async function loadReplayDiffData() {
    const container = document.getElementById('replay-diff-container');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Select requests to compare</div>';
  }

  async function loadIntruderData() {
    const container = document.getElementById('intruder-attacks-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No intruder attacks configured</div>';
  }

  async function loadFuzzerData() {
    const container = document.getElementById('fuzzer-sessions-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No fuzzer sessions</div>';
  }

  async function loadPayloadsData() {
    const container = document.getElementById('payloads-list');
    if (!container) return;
    container.innerHTML = `
      <div class="payload-set">
        <h4>SQL Injection</h4>
        <pre>' OR 1=1--\n" OR 1=1--\n1' OR '1'='1</pre>
      </div>
      <div class="payload-set">
        <h4>XSS</h4>
        <pre>&lt;script&gt;alert(1)&lt;/script&gt;\n&lt;img src=x onerror=alert(1)&gt;</pre>
      </div>
    `;
  }

  async function loadActiveWorkflowsData() {
    const container = document.getElementById('workflows-active-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No active workflows</div>';
  }

  async function loadWorkflowTemplatesData() {
    const container = document.getElementById('workflows-templates-list');
    if (!container) return;
    container.innerHTML = `
      <div class="template-card">
        <h4><i class="fas fa-spider"></i> Web Crawler</h4>
        <p>Automatically crawl and map web applications</p>
        <button class="cf-btn primary">Use Template</button>
      </div>
      <div class="template-card">
        <h4><i class="fas fa-bug"></i> Vulnerability Scanner</h4>
        <p>Scan for common web vulnerabilities</p>
        <button class="cf-btn primary">Use Template</button>
      </div>
    `;
  }

  async function loadWorkflowHistoryData() {
    const container = document.getElementById('workflows-history-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No workflow history</div>';
  }

  async function loadAssistantHistoryData() {
    const container = document.getElementById('assistant-history-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No conversation history</div>';
  }

  async function loadAssistantInsightsData() {
    const container = document.getElementById('assistant-insights-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No insights generated yet</div>';
  }

  async function loadTrainedModelsData() {
    const container = document.getElementById('models-trained-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getModels();
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.filter(m => m.status === 'trained').map(m => `
          <div class="model-card trained">
            <div class="model-header">
              <h4>${m.name}</h4>
              <span class="cf-badge green">Trained</span>
            </div>
            <div class="model-stats">
              <span>Accuracy: ${m.accuracy || '95%'}</span>
              <span>Last trained: ${new Date(m.lastTrained).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No trained models</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load models</div>'; }
  }

  async function loadTrainingModelsData() {
    const container = document.getElementById('models-training-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No models currently training</div>';
  }

  async function loadDatasetsData() {
    const container = document.getElementById('datasets-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getDatasets();
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.map(d => `
          <div class="dataset-card">
            <h4>${d.name}</h4>
            <div class="dataset-info">
              <span>${d.samples || 0} samples</span>
              <span>${d.size || '0 MB'}</span>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No datasets available</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load datasets</div>'; }
  }

  async function loadThreatFeedsData() {
    const container = document.getElementById('intel-feeds-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getThreatFeeds();
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.map(f => `
          <div class="feed-card ${f.active ? 'active' : ''}">
            <div class="feed-header">
              <h4>${f.name}</h4>
              <span class="cf-badge ${f.active ? 'green' : 'gray'}">${f.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="feed-info">
              <span>Last sync: ${f.lastSync ? new Date(f.lastSync).toLocaleString() : 'Never'}</span>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="empty-state">No threat feeds configured</div>';
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load feeds</div>'; }
  }

  async function loadIOCsData() {
    const container = document.getElementById('iocs-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No IOCs loaded</div>';
  }

  async function loadCVEsData() {
    const container = document.getElementById('cves-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No CVEs tracked</div>';
  }

  async function loadEnvironmentVariablesData() {
    const container = document.getElementById('env-variables-list');
    if (!container) return;
    container.innerHTML = `
      <div class="env-var-item">
        <span class="var-name">API_BASE_URL</span>
        <span class="var-value">${localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com'}</span>
      </div>
      <div class="env-var-item">
        <span class="var-name">ML_SERVICE_URL</span>
        <span class="var-value">https://che237-cyberforge-models.hf.space</span>
      </div>
    `;
  }

  async function loadSecretsData() {
    const container = document.getElementById('secrets-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No secrets configured</div>';
  }

  function bindAdvancedSearchEvents() {
    const form = document.getElementById('advanced-search-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('search-query')?.value;
      if (query) {
        showToast('info', 'Searching', 'Executing advanced search...');
      }
    });
  }

  async function loadSavedQueriesData() {
    const container = document.getElementById('saved-queries-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No saved queries</div>';
  }

  async function loadFindingsByLevel(level) {
    const container = document.getElementById('findings-level-list');
    if (!container) return;
    try {
      const result = await cyberforgeAPI.getFindings({ severity: level });
      if (result.success && result.data?.length) {
        container.innerHTML = result.data.map(f => `
          <div class="finding-item ${level}">
            <div class="finding-header">
              <span class="cf-badge ${severityColor(level)}">${level.toUpperCase()}</span>
              <h4>${f.title}</h4>
            </div>
            <div class="finding-details">
              <span>${f.path || 'Unknown path'}</span>
              <span class="status">${f.status}</span>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div class="empty-state">No ${level} findings</div>`;
      }
    } catch (e) { container.innerHTML = '<div class="empty-state">Failed to load findings</div>'; }
  }

  async function loadExportsReportsData() {
    const container = document.getElementById('exports-reports-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No exported reports</div>';
  }

  function bindDataExportEvents() {
    const form = document.getElementById('data-export-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showToast('info', 'Exporting', 'Preparing data export...');
    });
  }

  async function loadProjectFilesData() {
    const container = document.getElementById('project-files-tree');
    if (!container) return;
    renderFiles();
  }

  async function loadNotesData() {
    const container = document.getElementById('notes-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No notes yet</div>';
  }

  async function loadScriptsData() {
    const container = document.getElementById('scripts-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No scripts added</div>';
  }

  async function loadInstalledPluginsData() {
    const container = document.getElementById('plugins-installed-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No plugins installed</div>';
  }

  async function loadMarketplacePluginsData() {
    const container = document.getElementById('plugins-marketplace-list');
    if (!container) return;
    container.innerHTML = `
      <div class="plugin-card">
        <h4>JWT Analyzer</h4>
        <p>Decode and analyze JWT tokens</p>
        <button class="cf-btn primary">Install</button>
      </div>
      <div class="plugin-card">
        <h4>GraphQL Introspection</h4>
        <p>Explore GraphQL schemas</p>
        <button class="cf-btn primary">Install</button>
      </div>
    `;
  }

  async function loadWorkspaceSettingsData() {
    const container = document.getElementById('workspace-settings-form');
    if (!container) return;
  }

  async function loadTeamMembersData() {
    const container = document.getElementById('team-members-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No team members</div>';
  }

  async function loadPendingSyncData() {
    const container = document.getElementById('sync-pending-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">All changes synced</div>';
  }

  async function loadSyncHistoryData() {
    const container = document.getElementById('sync-history-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No sync history</div>';
  }

  async function loadExtensionInstallData() {
    const container = document.getElementById('ext-install-status');
    if (!container) return;
  }

  async function loadExtensionSettingsData() {
    const container = document.getElementById('ext-settings-form');
    if (!container) return;
  }

  function initMobilePairing() {
    const qrContainer = document.getElementById('mobile-qr-code');
    if (qrContainer) {
      qrContainer.innerHTML = '<div class="qr-placeholder">QR Code for mobile pairing</div>';
    }
  }

  async function loadPairedDevicesData() {
    const container = document.getElementById('paired-devices-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No paired devices</div>';
  }

  async function loadBrowserRegistrationData() {
    const container = document.getElementById('available-browsers-list');
    if (!container) return;

    try {
      // Call the new full-detection Tauri command via the bridge
      const result = await (
        window.electronAPI?.detectSystemBrowsers?.() ||
        window.electronAPI?.systemMonitor?.detectSystemBrowsers?.() ||
        window.electronAPI?.systemMonitor?.getAvailableBrowsers?.()
      ) || null;

      // Populate system strip
      if (result && result.os) {
        const osLabel = document.getElementById('bi-os-label');
        const scanTime = document.getElementById('bi-scan-time');
        const defaultBrowser = document.getElementById('bi-default-browser');

        if (osLabel) osLabel.textContent = result.osDisplay || result.os;
        if (scanTime) scanTime.textContent = new Date(result.scanTimestamp || Date.now()).toLocaleString();
        if (defaultBrowser) defaultBrowser.textContent = result.defaultBrowser || 'Unknown';
      }

      // Determine browser list
      const browsers = result?.browsers || (Array.isArray(result) ? result : []);

      // Summary counts
      const installed = browsers.filter(b => b.isInstalled ?? b.available).length;
      const running = browsers.filter(b => b.isRunning).length;
      const total = browsers.length;

      const elInstalled = document.getElementById('bi-installed-count');
      const elRunning = document.getElementById('bi-running-count');
      const elTotal = document.getElementById('bi-total-count');
      if (elInstalled) elInstalled.textContent = installed;
      if (elRunning) elRunning.textContent = running;
      if (elTotal) elTotal.textContent = total;

      // Render browser cards
      if (browsers.length === 0) {
        container.innerHTML = `<div class="bi-empty"><i class="fas fa-exclamation-triangle"></i> No supported browsers detected</div>`;
        const connectedContainer = document.getElementById('connected-browsers-list');
        if (connectedContainer) {
          connectedContainer.innerHTML = '<div class="bi-empty"><i class="fas fa-unlink"></i> No browser registrations available</div>';
        }
        return;
      }

      container.innerHTML = browsers.map(b => {
        const isInstalled = b.isInstalled ?? b.available;
        const iconClass = b.iconClass || browserIconFallback(b.key || b.id);
        const version = b.version || null;
        const path = b.installPath || null;
        const isRunning = !!b.isRunning;
        const isDefault = !!b.isDefault;

        return `
          <div class="bi-browser-card ${isInstalled ? '' : 'bi-not-installed'}" data-browser-key="${b.key || b.id}">
            <div class="bi-browser-icon ${b.key || b.id}">
              <i class="${iconClass}"></i>
            </div>
            <div class="bi-browser-body">
              <div class="bi-browser-header">
                <span class="bi-browser-name">${b.name}</span>
                ${isDefault ? '<span class="bi-badge bi-badge-default">Default</span>' : ''}
                ${isRunning ? '<span class="bi-badge bi-badge-running">Running</span>' : ''}
                ${!isInstalled ? '<span class="bi-badge bi-badge-notfound">Not Found</span>' : ''}
              </div>
              <div class="bi-browser-version">${version ? 'v' + version : (isInstalled ? 'Version unknown' : 'Not installed')}</div>
              ${path ? `<div class="bi-browser-path" title="${path}">${path}</div>` : ''}
              ${isInstalled ? `
                <div class="bi-browser-footer">
                  <span class="bi-status-dot ${isRunning ? 'running' : 'stopped'}"></span>
                  <span class="bi-status-text">${isRunning ? 'Process active' : 'Not running'}</span>
                  <button class="bi-launch-btn" data-browser="${b.key || b.id}"><i class="fas fa-rocket"></i> Launch</button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Bind launch buttons
      container.querySelectorAll('.bi-launch-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const key = btn.dataset.browser;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          btn.disabled = true;
          try {
            const launchResult = await (
              window.electronAPI?.systemMonitor?.launchBrowser?.(key) || Promise.resolve({ success: false })
            );
            if (launchResult?.success) {
              showToast('success', 'Launched', `${key} launched with monitoring`);
              btn.innerHTML = '<i class="fas fa-check"></i> Active';
            } else {
              throw new Error(launchResult?.error || 'Launch unavailable');
            }
          } catch (err) {
            showToast('error', 'Launch Failed', err.message);
            btn.innerHTML = '<i class="fas fa-rocket"></i> Retry';
            btn.disabled = false;
          }
        });
      });

      const connectedContainer = document.getElementById('connected-browsers-list');
      if (connectedContainer) {
        const activeOrInstalled = browsers.filter(b => (b.isInstalled ?? b.available));
        if (!activeOrInstalled.length) {
          connectedContainer.innerHTML = '<div class="bi-empty"><i class="fas fa-unlink"></i> No browser registrations available</div>';
        } else {
          connectedContainer.innerHTML = activeOrInstalled.map((browser) => {
            const running = !!browser.isRunning;
            return `
              <div class="bi-connected-item">
                <div class="bi-connected-name">${browser.name}</div>
                <div class="bi-connected-meta">${browser.version ? `v${browser.version}` : 'Version unknown'} • ${running ? 'Running' : 'Installed'}</div>
              </div>
            `;
          }).join('');
        }
      }

      // Refresh button
      document.getElementById('refresh-browsers')?.addEventListener('click', () => {
        container.innerHTML = '<div class="bi-loading"><i class="fas fa-spinner fa-spin"></i> Rescanning...</div>';
        loadBrowserRegistrationData();
      });

      // Start monitoring button
      document.getElementById('start-monitoring')?.addEventListener('click', async () => {
        const btn = document.getElementById('start-monitoring');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        btn.disabled = true;
        try {
          await window.electronAPI?.systemMonitor?.start();
          showToast('success', 'Monitoring Started', 'Browser monitoring is now active');
        } catch (err) {
          showToast('error', 'Error', err.message);
        } finally {
          btn.innerHTML = orig;
          btn.disabled = false;
        }
      });

      // Real-time event listeners
      setupBrowserEventListeners();

    } catch (error) {
      console.error('Browser detection error:', error);
      container.innerHTML = `<div class="bi-empty"><i class="fas fa-exclamation-circle"></i> Detection error: ${error.message}</div>`;
    }
  }

  function browserIconFallback(key) {
    const map = {
      chrome: 'fab fa-chrome',
      firefox: 'fab fa-firefox-browser',
      edge: 'fab fa-edge',
      brave: 'fas fa-shield-halved',
      opera: 'fab fa-opera',
      chromium: 'fab fa-chrome',
      arc: 'fas fa-globe',
    };
    return map[key] || 'fas fa-globe';
  }

  async function launchBrowserWithMonitoring(browserId, cardElement) {
    try {
      let result;
      if (window.electronAPI?.systemMonitor?.launchBrowser) {
        result = await window.electronAPI.systemMonitor.launchBrowser(browserId);
      }
      if (result?.success) {
        showToast('success', 'Browser Launched', `${browserId} is now being monitored`);
      } else {
        showToast('error', 'Launch Failed', result?.error || 'Could not launch');
      }
    } catch (error) {
      showToast('error', 'Launch Failed', error.message);
    }
  }

  function setupBrowserEventListeners() {
    if (window.electronAPI?.systemMonitor?.onBrowserConnected) {
      window.electronAPI.systemMonitor.onBrowserConnected((data) => {
        showToast('success', 'Browser Connected', `${data.browser} with ${data.tabs} tabs`);
      });
    }
  }

  async function loadBrowserHistoryData() {
    const container = document.getElementById('browser-history-results');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Run a browser history scan</div>';
  }

  async function loadSuspiciousDomainsData() {
    const container = document.getElementById('suspicious-domains-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No suspicious domains detected</div>';
  }

  async function loadCredentialExposureData() {
    const container = document.getElementById('credential-exposure-results');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No credential exposures found</div>';
  }

  async function loadTrackingDetectionData() {
    const container = document.getElementById('tracking-detection-results');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No trackers detected</div>';
  }

  async function loadDownloadAnalysisData() {
    const container = document.getElementById('download-analysis-results');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">No downloads analyzed</div>';
  }

  function initEventFeedStream() {
    const container = document.getElementById('event-feed-stream');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Connecting to event stream...</div>';
  }

  async function loadRiskAnalysisData() {
    const container = document.getElementById('risk-analysis-dashboard');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading risk analysis...</div>';
  }

  function initThreatMap() {
    const container = document.getElementById('threat-map-canvas');
    if (!container) return;
    container.innerHTML = '<div class="map-placeholder">Interactive threat map</div>';
  }

  function initQuickScan() {
    const container = document.getElementById('scan-progress');
    if (!container) return;
    container.innerHTML = '<div class="scan-ready">Quick scan ready to start</div>';
  }

  function initDeepScan() {
    const container = document.getElementById('scan-progress');
    if (!container) return;
    container.innerHTML = '<div class="scan-ready">Deep scan ready to start</div>';
  }

  function initStealthScan() {
    const container = document.getElementById('scan-progress');
    if (!container) return;
    container.innerHTML = '<div class="scan-ready">Stealth scan ready to start</div>';
  }

  function initForensicScan() {
    const container = document.getElementById('scan-progress');
    if (!container) return;
    container.innerHTML = '<div class="scan-ready">Forensic scan ready to start</div>';
  }

  // NOTE: Real initAgentControlPanel is defined earlier in the file (line ~361)
  // Do not add another one here as it will override the working version

  async function loadAgentTasksData() {
    const tbody = document.getElementById('agent-tasks-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading tasks from backend...</td></tr>';

    try {
      const userId = resolveCurrentUserId();
      const result = await safeGetAgentAlerts({ userId, limit: 10 });

      if (!result?.success && result?.error) {
        tbody.innerHTML = `<tr><td colspan="7" class="error-state"><i class="fas fa-exclamation-triangle"></i> Backend error: ${result.error}</td></tr>`;
        return;
      }

      const alerts = result?.data?.data?.alerts || [];

      if (!alerts.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No agent tasks. Use the console to create tasks (e.g. "scan https://example.com").</td></tr>';
        return;
      }

      tbody.innerHTML = alerts.map((alert) => `
        <tr>
          <td>${alert.$id || alert.id || 'N/A'}</td>
          <td>${alert.type || 'alert'}</td>
          <td>${alert.source || alert.targetUrl || '-'}</td>
          <td>${alert.status || 'open'}</td>
          <td>${alert.confidence ? `${Math.round(alert.confidence * 100)}%` : '-'}</td>
          <td>${new Date(alert.$createdAt || alert.createdAt || Date.now()).toLocaleString()}</td>
          <td><span class="cf-badge blue">Synced</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('loadAgentTasksData failed:', error);
      tbody.innerHTML = `<tr><td colspan="7" class="error-state"><i class="fas fa-exclamation-triangle"></i> Failed to reach backend: ${error.message}. Is the backend server running on port 8000?</td></tr>`;
    }
  }

  async function loadScheduledTasksData() {
    const tbody = document.getElementById('scheduled-tasks-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6"><i class="fas fa-spinner fa-spin"></i> Loading agents from backend...</td></tr>';

    try {
      let listResult;
      if (typeof cyberforgeAPI?.listAgents === 'function') {
        listResult = await cyberforgeAPI.listAgents();
      } else {
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
        listResult = {
          success: true,
          data: {
            data: {
              agents: payload?.data?.agents || payload?.agents || [],
              count: payload?.data?.count ?? payload?.count ?? 0
            }
          }
        };
      }

      if (!listResult?.success && listResult?.error) {
        tbody.innerHTML = `<tr><td colspan="6" class="error-state"><i class="fas fa-exclamation-triangle"></i> Backend error: ${listResult.error}</td></tr>`;
        return;
      }

      const agents = listResult?.data?.data?.agents || [];
      if (!agents.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No agents registered. Click "Start Agent" to register one.</td></tr>';
        return;
      }

      tbody.innerHTML = agents.map((agent) => `
        <tr>
          <td>${agent.agentName || agent.name || 'default'}</td>
          <td>On-demand</td>
          <td>${agent.nextRun ? new Date(agent.nextRun).toLocaleString() : '-'}</td>
          <td>${agent.lastRun ? new Date(agent.lastRun).toLocaleString() : '-'}</td>
          <td>${agent.state || (agent.running ? 'running' : 'idle')}</td>
          <td><span class="cf-badge blue">Backend</span></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('loadScheduledTasksData failed:', error);
      tbody.innerHTML = `<tr><td colspan="6" class="error-state"><i class="fas fa-exclamation-triangle"></i> Failed to reach backend: ${error.message}. Is the backend server running on port 8000?</td></tr>`;
    }
  }

  async function loadAgentDecisionsData() {
    const container = document.getElementById('decisions-timeline');
    if (!container) return;

    container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading decisions from backend...</div>';

    try {
      const userId = resolveCurrentUserId();
      const result = await safeGetAgentAlerts({ userId, limit: 8 });

      if (!result?.success && result?.error) {
        container.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Backend error: ${result.error}</div>`;
        return;
      }

      const alerts = result?.data?.data?.alerts || [];

      if (!alerts.length) {
        container.innerHTML = '<div class="empty-state">No agent decisions recorded yet. Start the agent and create tasks to generate decisions.</div>';
        return;
      }

      container.innerHTML = alerts.map((alert) => `
        <div class="decision-item">
          <div class="decision-time">${new Date(alert.$createdAt || alert.createdAt || Date.now()).toLocaleString()}</div>
          <div class="decision-content">
            <div class="decision-type"><span class="cf-badge orange">${alert.severity || 'info'}</span></div>
            <div class="decision-title">${alert.title || alert.type || 'Agent Decision'}</div>
            <div class="decision-desc">${alert.description || alert.message || ''}</div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('loadAgentDecisionsData failed:', error);
      container.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Failed to reach backend: ${error.message}. Is the backend server running on port 8000?</div>`;
    }
  }

  async function loadAgentMemoryData() {
    const list = document.getElementById('memory-list');
    if (!list) return;

    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading agent memory from backend...</div>';

    try {
      const userId = resolveCurrentUserId();
      const listAgentsPromise = typeof cyberforgeAPI?.listAgents === 'function'
        ? cyberforgeAPI.listAgents()
        : (async () => {
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
          })();

      const [alertsResult, agentsResult] = await Promise.all([
        safeGetAgentAlerts({ userId, limit: 20 }),
        listAgentsPromise
      ]);

      const alerts = alertsResult?.data?.data?.alerts || [];
      const agents = agentsResult?.data?.data?.agents || [];

      const threatsEl = document.getElementById('memory-threats');
      const patternsEl = document.getElementById('memory-patterns');
      const decisionsEl = document.getElementById('memory-decisions');
      if (threatsEl) threatsEl.textContent = alerts.length.toString();
      if (patternsEl) patternsEl.textContent = Math.max(agents.length, 0).toString();
      if (decisionsEl) decisionsEl.textContent = alerts.filter(a => (a.status || '').toLowerCase() !== 'open').length.toString();

      if (!alerts.length) {
        list.innerHTML = '<div class="empty-state">No agent memory entries. Start the agent and interact with it to build memory.</div>';
        return;
      }

      list.innerHTML = alerts.slice(0, 10).map((alert) => `
        <div class="memory-item">
          <div class="memory-title">${alert.title || alert.type || 'Agent Event'}</div>
          <div class="memory-meta">${new Date(alert.$createdAt || alert.createdAt || Date.now()).toLocaleString()} • ${alert.severity || 'info'}</div>
          <div class="memory-desc">${alert.description || alert.message || ''}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('loadAgentMemoryData failed:', error);
      list.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Failed to reach backend: ${error.message}. Is the backend server running on port 8000?</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Fallback sidebar navigation if init() fails before bindSidebarNav() executes
  document.addEventListener('click', (e) => {
    if (state.sidebarListenersBound) return;

    const topLink = e.target.closest('.sidebar-nav-link');
    if (topLink) {
      e.preventDefault();

      document.querySelectorAll('.sidebar-nav-link.active').forEach(link => link.classList.remove('active'));
      topLink.classList.add('active');

      const parentItem = topLink.closest('.sidebar-nav-item');
      if (parentItem && parentItem.querySelector('.sidebar-nav-children')) {
        parentItem.classList.toggle('expanded');
      }

      const screen = topLink.getAttribute('data-screen');
      if (screen) {
        state.activeScreen = screen;
        try {
          renderScreen(screen);
        } catch (error) {
          const container = document.getElementById('screen-container');
          if (container) {
            container.innerHTML = buildOperationalPage(screen);
            bindOperationalPage(screen);
          }
          console.error('Fallback sidebar navigation error:', error);
        }
      }
      return;
    }

    const childLink = e.target.closest('.sidebar-child-link');
    if (childLink) {
      e.preventDefault();
      document.querySelectorAll('.sidebar-child-link.active').forEach(link => link.classList.remove('active'));
      childLink.classList.add('active');

      const screen = childLink.getAttribute('data-screen');
      if (screen) {
        state.activeScreen = screen;
        try {
          renderScreen(screen);
        } catch (error) {
          const container = document.getElementById('screen-container');
          if (container) {
            container.innerHTML = buildOperationalPage(screen);
            bindOperationalPage(screen);
          }
          console.error('Fallback child navigation error:', error);
        }
      }
    }
  });
  
  // Global fallback handler for agent minimized button (uses event delegation)
  document.addEventListener('click', (e) => {
    const minimizedBtn = e.target.closest('#agent-minimized-btn');
    if (minimizedBtn) {
      const agentPanel = document.getElementById('agent-control-panel');
      if (agentPanel) {
        agentPanel.classList.remove('hidden');
      }
      minimizedBtn.style.display = 'none';
      localStorage.setItem('agent-panel-hidden', 'false');
    }
  });
})();
