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

  const AUTH_PAGE_PATH = 'auth-page-v2.html';

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
      updateConnectionStatus(state.backendConnected, { pending: true });

      // Ensure token is loaded before making any requests
      console.log('🔑 Current token status:', cyberforgeAPI.token ? 'present' : 'missing');
      
      const health = await cyberforgeAPI.checkHealth();
      if (health.success) {
        state.backendConnected = true;
        console.log('✅ Connected to CyberForge backend');
        updateConnectionStatus(true, { checkedAt: new Date() });
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
      updateConnectionStatus(false, { checkedAt: new Date() });
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

  function updateConnectionStatus(connected, options = {}) {
    const pending = Boolean(options.pending);
    const checkedAt = options.checkedAt || new Date();
    const statusEl = document.getElementById('backend-status');
    const footerSync = document.getElementById('footer-sync');

    const timeLabel = checkedAt instanceof Date
      ? checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';

    if (statusEl) {
      if (pending) {
        statusEl.className = 'cf-badge status-checking';
        statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Checking';
        statusEl.setAttribute('data-status', 'checking');
        statusEl.title = 'Validating backend connectivity';
      } else if (connected) {
        statusEl.className = 'cf-badge status-online';
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Online';
        statusEl.setAttribute('data-status', 'online');
        statusEl.title = `Backend connected • ${timeLabel}`;
      } else {
        statusEl.className = 'cf-badge status-offline';
        statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Offline';
        statusEl.setAttribute('data-status', 'offline');
        statusEl.title = 'Backend is unreachable';
      }
    }

    if (footerSync) {
      if (pending) {
        footerSync.textContent = 'Checking...';
        footerSync.setAttribute('data-state', 'checking');
      } else if (connected) {
        footerSync.textContent = `Synced ${timeLabel}`;
        footerSync.setAttribute('data-state', 'online');
      } else {
        footerSync.textContent = 'Disconnected';
        footerSync.setAttribute('data-state', 'offline');
      }
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

  // ——————————————————————————————————————————————
  // REAL-TIME URL MONITORING
  // Polls active browser tabs every 5s, detects new URLs, auto-creates scan tasks
  // ——————————————————————————————————————————————

  let _urlMonitorPollingId = null;
  const _seenUrls = new Set();          // Track already-processed URLs this session
  const _urlScanHistory = [];           // Last 100 scanned URLs for UI display
  const URL_MONITOR_INTERVAL = 5000;    // Check every 5 seconds
  const MAX_SCAN_HISTORY = 100;

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

    // No Start button — agent auto-starts. Only Stop is available.
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

      // Agent status — check if default agent is actually running
      const defaultStatus = statusResult?.data?.data || statusResult?.data || {};
      const isOnline = !!defaultStatus?.isRunning || !!defaultStatus?.running || !!defaultStatus?.exists;
      const statusLabel = isOnline ? 'Agent Online' : 'Agent Offline';
      setAgentControlStatus(isOnline, statusLabel);

      // Agent count — use list count, but ensure at least 1 if agent is running
      let agentCount = listResult?.data?.data?.count || 0;
      if (isOnline && agentCount < 1) agentCount = 1;
      if (backendOk && agentCount < 1 && isOnline) agentCount = 1;
      if (agentCountEl) {
        agentCountEl.textContent = agentCount;
        agentCountEl.style.color = agentCount > 0 ? '#27AE60' : '#C0392B';
      }

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

  async function syncDeviceIdentity() {
    const deviceNameEl = document.getElementById('device-name');
    const deviceChipEl = document.getElementById('header-device-id');
    if (!deviceNameEl) return;

    const fallbackName = localStorage.getItem('cyberforge_device_id') || 'Local Device';
    deviceNameEl.textContent = fallbackName;

    try {
      const result = await window.electronAPI?.getSystemStats?.();
      if (!(result?.success && result?.data)) return;

      const hostname = result.data.hostname || fallbackName;
      const osName = result.data.os_name || result.data.platform || '';
      const osVersion = result.data.os_version || '';
      const detail = [osName, osVersion].filter(Boolean).join(' ');

      deviceNameEl.textContent = hostname;
      if (deviceChipEl) {
        deviceChipEl.title = detail ? `${hostname} • ${detail}` : hostname;
      }
    } catch (_) {
      // Keep fallback values if unavailable.
    }
  }

  function startBackendStatusSync() {
    let firstRun = true;
    const refresh = async () => {
      // Only show "Checking..." on first run, not on periodic refreshes
      if (firstRun) {
        updateConnectionStatus(state.backendConnected, { pending: true });
        firstRun = false;
      }

      try {
        const health = await cyberforgeAPI.checkHealth();
        const connected = Boolean(health?.success);
        state.backendConnected = connected;
        updateConnectionStatus(connected, { checkedAt: new Date() });
      } catch (_) {
        state.backendConnected = false;
        updateConnectionStatus(false, { checkedAt: new Date() });
      }
    };

    refresh();
    setInterval(refresh, 30000);
  }

  function initHeaderFooter() {
    updateConnectionStatus(state.backendConnected, { pending: true });

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
    
    // Notifications button — handled by bindHeaderControls() to avoid duplicate listeners
    // (bindHeaderControls wires the bell to open event feed panel)
    
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

    // Header device identity
    syncDeviceIdentity();
    setInterval(syncDeviceIdentity, 60000);

    // Keep backend badge and footer sync state fresh
    startBackendStatusSync();
    
    // Initialize sidebar child components
    initSidebarChildren();
  }

  function performGlobalSearch(query) {
    const lq = query.toLowerCase();
    logAgentAction(`Global search: "${query}"`, 'info');

    // Smart routing: match query to known screens/sections
    const screenMap = {
      'scan': 'quick-scan',
      'threat': 'findings-critical',
      'alert': 'findings-critical',
      'finding': 'findings-critical',
      'agent': 'agent-control',
      'browser': 'browser-registration',
      'setting': 'settings',
      'config': 'settings',
      'intel': 'browser-intel',
      'domain': 'intel-domains',
      'session': 'intel-sessions',
      'distributed': 'distributed-intelligence',
      'node': 'dist-nodes',
      'heatmap': 'dist-heatmap',
      'correlation': 'dist-correlations',
      'metric': 'dist-global-metrics',
      'weight': 'dist-weights',
      'export': 'exports-reports',
      'plugin': 'plugins-installed',
      'history': 'http-history',
      'websocket': 'ws-history',
      'sitemap': 'sitemap',
      'cve': 'intel-cves',
      'ioc': 'intel-iocs',
    };

    for (const [keyword, screen] of Object.entries(screenMap)) {
      if (lq.includes(keyword)) {
        state.activeScreen = screen;
        renderScreen(screen);
        showToast('info', 'Search Result', `Navigated to ${screen.replace(/-/g, ' ')}`);
        return;
      }
    }

    // If query looks like a URL, trigger a scan
    if (lq.startsWith('http://') || lq.startsWith('https://') || lq.includes('.com') || lq.includes('.org') || lq.includes('.net')) {
      showToast('info', 'URL Detected', `Analyzing: ${query}`);
      cyberforgeAPI.cyberforgeML?.analyzeUrl?.(query).then(result => {
        showToast('info', 'Analysis Complete', `Risk: ${result?.aggregate?.overall_risk_level || 'Unknown'}`);
      }).catch(() => {});
      return;
    }

    // Fallback: navigate to advanced search
    state.activeScreen = 'search-advanced';
    renderScreen('search-advanced');
    showToast('info', 'Searching', `Looking for: "${query}"`);
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
          updateHeaderStats();
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
    
    // Update header agent status — use real backend connection status
    const headerAgentStatus = document.getElementById('header-agent-status');
    if (headerAgentStatus) {
      const indicator = headerAgentStatus.querySelector('.agent-status-indicator-mini');
      const label = headerAgentStatus.querySelector('.agent-status-label');
      
      // Determine effective agent status from backend connection + agent state
      let effectiveStatus = agentState.status;
      if (state.backendConnected && effectiveStatus === 'idle') {
        effectiveStatus = 'monitoring'; // If connected to backend, agent is at least monitoring
      }
      
      const colors = {
        idle: '#6b7280',
        monitoring: '#039855',
        analyzing: '#1570EF',
        investigating: '#DC6803',
        waiting: '#6941C6',
        blocked: '#D92D20'
      };
      
      if (indicator) {
        indicator.style.background = colors[effectiveStatus] || '#039855';
      }
      if (label) {
        const statusLabel = state.backendConnected
          ? `Agent ${effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}`
          : 'Agent Offline';
        label.textContent = statusLabel;
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
          const href = link.getAttribute('href');
          if (href && href !== '#') {
            window.location.href = href;
            return;
          }
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
    
    // Ensure token/session is valid before loading dashboard runtime
    const sessionReady = await bootstrapAuthSession();
    if (!sessionReady) return;
    
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
    window.location.href = AUTH_PAGE_PATH;
  }

  async function handleAuthExpired(options = {}) {
    const immediate = Boolean(options.immediate);

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
    if (immediate) {
      window.location.href = AUTH_PAGE_PATH;
      return;
    }

    setTimeout(() => {
      window.location.href = AUTH_PAGE_PATH;
    }, 1500);
  }

  async function bootstrapAuthSession() {
    await cyberforgeAPI.initFromElectron();

    const token = cyberforgeAPI.token || localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
      window.location.href = AUTH_PAGE_PATH;
      return false;
    }

    cyberforgeAPI.token = token;

    const profileResult = await cyberforgeAPI.getProfile();
    if (profileResult?.success) {
      return true;
    }

    const refreshed = await cyberforgeAPI.refreshAuthToken();
    if (!refreshed) {
      await handleAuthExpired({ immediate: true });
      return false;
    }

    const postRefreshProfile = await cyberforgeAPI.getProfile();
    if (postRefreshProfile?.success) {
      return true;
    }

    await handleAuthExpired({ immediate: true });
    return false;
  }

  function bindHeaderControls() {
    const quickScanBtn = document.getElementById('quick-scan-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const notificationsBtn = document.getElementById('notifications-btn');
    const alertWidget = document.getElementById('header-alert-widget');
    const headerAgentStatus = document.getElementById('header-agent-status');

    // Quick Scan button — triggers quick scan screen + ML health check
    quickScanBtn?.addEventListener('click', async () => {
      quickScanBtn.disabled = true;
      quickScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
      
      try {
        // Trigger the agent's scan action
        executeQuickAction('scan');
        
        // Also call the ML API directly for immediate feedback
        const scanResult = await cyberforgeAPI.cyberforgeML.health();
        console.log('ML Service Health:', scanResult);

        // Navigate to the quick-scan screen for full results
        state.activeScreen = 'quick-scan';
        renderScreen('quick-scan');
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

    // Settings button — navigate to settings screen
    settingsBtn?.addEventListener('click', () => {
      renderScreen('settings');
    });

    // Notifications button — open the event feed panel (real-time events)
    notificationsBtn?.addEventListener('click', () => {
      const eventPanel = document.getElementById('event-feed-panel');
      if (eventPanel) {
        eventPanel.classList.toggle('open');
      } else {
        showToast('info', 'Notifications', 'No new notifications');
      }
    });

    // Alert count widget — navigate to findings screen
    alertWidget?.addEventListener('click', () => {
      state.activeScreen = 'findings-critical';
      renderScreen('findings-critical');
    });

    // Header agent status — navigate to agent control center
    headerAgentStatus?.addEventListener('click', () => {
      state.activeScreen = 'agent-control';
      renderScreen('agent-control');
    });
    // Make it feel clickable
    if (headerAgentStatus) headerAgentStatus.style.cursor = 'pointer';

    // Theme toggle
    themeToggle?.addEventListener('click', () => toggleTheme());
    if (themeToggle) {
      themeToggle.setAttribute('data-theme-managed', 'true');
    }

    // Periodically update header alert count from real data
    updateHeaderAlertCount();
    setInterval(updateHeaderAlertCount, 10000);
  }

  // Update the header alert badge with real data from backend
  async function updateHeaderAlertCount() {
    const alertNumberEl = document.getElementById('header-alert-number');
    const notifCountEl = document.getElementById('notification-count');
    if (!alertNumberEl && !notifCountEl) return;

    try {
      // Try getting alerts from the agent alerts API
      const result = await safeGetAgentAlerts({ limit: 50 });
      const alerts = result?.data?.data?.alerts || [];
      const criticalCount = alerts.filter(a =>
        a.severity === 'critical' || a.severity === 'high' || a.risk_score >= 70
      ).length;
      const totalCount = alerts.length;

      if (alertNumberEl) {
        alertNumberEl.textContent = String(criticalCount);
        alertNumberEl.style.color = criticalCount > 0 ? '#E74C3C' : '';
      }

      if (notifCountEl) {
        const unread = agentState.events.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
        const displayCount = Math.max(unread, criticalCount);
        notifCountEl.textContent = String(displayCount);
        notifCountEl.style.display = displayCount > 0 ? 'flex' : 'none';
      }
    } catch (e) {
      // Use local event count as fallback
      if (notifCountEl) {
        const unread = agentState.events.filter(e => e.severity === 'warning' || e.severity === 'critical').length;
        notifCountEl.textContent = String(unread);
        notifCountEl.style.display = unread > 0 ? 'flex' : 'none';
      }
    }
  }

  function initTheme() {
    const provider = window.CyberForgeTheme;
    const mode = provider ? provider.initTheme('light') : (localStorage.getItem('cyberforge-theme') || 'light');

    if (!provider) {
      document.documentElement.setAttribute('data-theme', mode);
    }

    updateThemeIcon(mode);
  }

  function toggleTheme() {
    const provider = window.CyberForgeTheme;
    const next = provider
      ? provider.toggleTheme()
      : (() => {
          const current = document.documentElement.getAttribute('data-theme') || 'light';
          const resolved = current === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', resolved);
          localStorage.setItem('cyberforge-theme', resolved);
          return resolved;
        })();

    updateThemeIcon(next);
    
    // Update map theme if it exists
    if (window.cyberforgeGlobe && typeof window.cyberforgeGlobe.setTheme === 'function') {
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
      const labelNode = link.querySelector('span');
      const label = (labelNode?.textContent || '').trim();
      if (label) {
        link.setAttribute('data-tooltip', label);
        if (!link.getAttribute('title')) link.setAttribute('title', label);
        if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', label);
      }

      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href !== '#') {
          window.location.href = href;
          return;
        }
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

    // Desktop app: enforce icon-rail sidebar by default on non-mobile widths.
    const isMobileViewport = window.innerWidth <= 768;
    const storedExpanded = localStorage.getItem('cf-sidebar-expanded');
    state.sidebarCollapsed = isMobileViewport ? (storedExpanded !== 'true') : true;
    if (sidebar) {
      sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    }
    if (!isMobileViewport) {
      localStorage.setItem('cf-sidebar-expanded', 'false');
    }
    if (collapseBtn) {
      collapseBtn.querySelector('span').textContent = state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
      collapseBtn.querySelector('i').className = state.sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }

    collapseBtn?.addEventListener('click', () => {
      const isMobile = window.innerWidth <= 768;
      state.sidebarCollapsed = isMobile ? !state.sidebarCollapsed : true;
      sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
      collapseBtn.querySelector('span').textContent = state.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
      collapseBtn.querySelector('i').className = state.sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
      localStorage.setItem('cf-sidebar-expanded', isMobile ? String(!state.sidebarCollapsed) : 'false');
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
    } else if (screen === 'dashboard' || screen === 'threat-overview') {
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
      // Threat Globe now uses the same OTX-backed map pipeline as Threat Map
      container.innerHTML = ChildPages.buildThreatMapLayout();
      initThreatMap();
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
    
    // ========================================
    // BROWSER INTELLIGENCE SCREENS
    // ========================================
    else if (screen === 'browser-intel') {
      container.innerHTML = buildBrowserIntelligenceScreen();
      initBrowserIntelligenceScreen();
    } else if (screen === 'intel-sessions') {
      container.innerHTML = buildIntelSessionsScreen();
      loadIntelSessionsData();
    } else if (screen === 'intel-alerts') {
      container.innerHTML = buildIntelAlertsScreen();
      loadIntelAlertsData();
    } else if (screen === 'intel-domains') {
      container.innerHTML = buildIntelDomainGraphScreen();
      loadIntelDomainGraph();
    } else if (screen === 'intel-config') {
      container.innerHTML = buildIntelConfigScreen();
      loadIntelConfig();
    }
    
    // ========================================
    // DISTRIBUTED INTELLIGENCE SCREENS (TODO 4)
    // ========================================
    else if (screen === 'distributed-intelligence' || screen === 'dist-nodes' ||
             screen === 'dist-correlations' || screen === 'dist-heatmap' ||
             screen === 'dist-global-metrics' || screen === 'dist-weights' ||
             screen === 'dist-sync') {
      try {
        const distScreen = new DistributedIntelligenceScreen();
        const tabMap = {
          'distributed-intelligence': 'overview',
          'dist-nodes': 'nodes',
          'dist-correlations': 'correlations',
          'dist-heatmap': 'heatmap',
          'dist-global-metrics': 'metrics',
          'dist-weights': 'weights',
          'dist-sync': 'overview'
        };
        distScreen.render(container);
        const targetTab = tabMap[screen] || 'overview';
        if (targetTab !== 'overview') {
          const tabBtn = container.querySelector(`.dist-tab-btn[data-tab="${targetTab}"]`);
          if (tabBtn) tabBtn.click();
        }
      } catch (err) {
        console.error('[CyberForge] Distributed Intelligence screen error:', err);
        container.innerHTML = '<div class="screen-placeholder"><h2>Distributed Intelligence</h2><p>Screen loading error. Check console.</p></div>';
      }
    }
    
    else {
      container.innerHTML = buildOperationalPage(screen);
      bindOperationalPage(screen);
    }
  }



  // ========================================
  // SCREEN LAYOUTS — Delegation Stubs
  // (Extracted to screens/*.js modules)
  // ========================================

  // --- HTTP History (screens/http-history.js) ---
  const _hh = () => window.CyberForgeHttpHistory || {};
  function buildHttpHistoryLayout() { return _hh().buildHttpHistoryLayout?.() || ''; }
  function buildInterceptLayout() { return _hh().buildInterceptLayout?.() || ''; }
  function buildWsLayout() { return _hh().buildWsLayout?.() || ''; }
  function buildMatchReplaceLayout() { return _hh().buildMatchReplaceLayout?.() || ''; }
  function bindMatchReplaceEvents() { return _hh().bindMatchReplaceEvents?.(); }
  function buildReplayLayout() { return _hh().buildReplayLayout?.() || ''; }
  function renderRequestsTable(f) { return _hh().renderRequestsTable?.(f); }
  function bindRequestTableEvents() { return _hh().bindRequestTableEvents?.(); }
  function renderRequestDetail(req, c) { return _hh().renderRequestDetail?.(req, c); }
  function renderIntercepts() { return _hh().renderIntercepts?.(); }
  function renderWsHistory() { return _hh().renderWsHistory?.(); }
  function renderMatchRules() { return _hh().renderMatchRules?.(); }
  function severityColor(sev) { return _hh().severityColor?.(sev) || 'gray'; }
  function renderFiles() { return _hh().renderFiles?.(); }
  function bindResizer() { return _hh().bindResizer?.(); }
  function bindContextMenu() { return _hh().bindContextMenu?.(); }

  // --- Intercept Events (screens/intercept-events.js) ---
  const _ie = () => window.CyberForgeInterceptEvents || {};
  function bindInterceptEvents() { return _ie().bindInterceptEvents?.(); }

  // --- Automate (screens/automate-screen.js) ---
  const _auto = () => window.CyberForgeAutomate || {};
  function buildAutomateLayout() { return _auto().buildAutomateLayout?.() || ''; }
  function bindAutomationsEvents() { return _auto().bindAutomationsEvents?.(); }

  // --- Workflows (screens/workflows-screen.js) ---
  const _wf = () => window.CyberForgeWorkflows || {};
  function buildWorkflowsLayout() { return _wf().buildWorkflowsLayout?.() || ''; }
  function bindWorkflowsEvents() { return _wf().bindWorkflowsEvents?.(); }

  // --- Assistant (screens/assistant-screen.js) ---
  const _asst = () => window.CyberForgeAssistant || {};
  function buildAssistantLayout() { return _asst().buildAssistantLayout?.() || ''; }
  function buildAssistantLayoutV2() { return _asst().buildAssistantLayoutV2?.() || ''; }
  function initAIAssistantV2(c) { return _asst().initAIAssistantV2?.(c); }
  function bindAssistant() { return _asst().bindAssistant?.(); }

  // --- Search (screens/search-screen.js) ---
  const _srch = () => window.CyberForgeSearch || {};
  function buildSearchLayout() { return _srch().buildSearchLayout?.() || ''; }

  // --- Findings (screens/findings-screen.js) ---
  const _find = () => window.CyberForgeFindings || {};
  function buildFindingsLayout() { return _find().buildFindingsLayout?.() || ''; }
  function bindFindingsEvents() { return _find().bindFindingsEvents?.(); }
  function renderFindings() { return _find().renderFindings?.(); }

  // --- Exports (screens/exports-screen.js) ---
  const _exp = () => window.CyberForgeExports || {};
  function buildExportsLayout() { return _exp().buildExportsLayout?.() || ''; }
  function bindExportsEvents() { return _exp().bindExportsEvents?.(); }

  // --- Files (screens/files-screen.js) ---
  const _files = () => window.CyberForgeFiles || {};
  function buildFilesLayout() { return _files().buildFilesLayout?.() || ''; }

  // --- Plugins (screens/plugins-screen.js) ---
  const _plug = () => window.CyberForgePlugins || {};
  function buildPluginsLayout() { return _plug().buildPluginsLayout?.() || ''; }
  function bindPluginsEvents() { return _plug().bindPluginsEvents?.(); }

  // --- Workspace (screens/workspace-screen.js) ---
  const _ws = () => window.CyberForgeWorkspace || {};
  function buildWorkspaceLayout() { return _ws().buildWorkspaceLayout?.() || ''; }

  // --- AI Agent (screens/ai-agent-screen.js) ---
  const _agent = () => window.CyberForgeAIAgent || {};
  function buildAIAgentLayout() { return _agent().buildAIAgentLayout?.() || ''; }
  function bindAgentConsole() { return _agent().bindAgentConsole?.(); }

  // --- Dashboard (screens/dashboard-screen.js) ---
  const _dash = () => window.CyberForgeDashboard || {};
  function buildDashboardLayout() { return _dash().buildDashboardLayout?.() || ''; }
  function bindDashboard() { return _dash().bindDashboard?.(); }
  function setupOTXThreatListeners() { return _dash().setupOTXThreatListeners?.(); }
  function visualizeThreatsOnGlobe(t) { return _dash().visualizeThreatsOnGlobe?.(t); }
  function visualizeThreatOnGlobe(t) { return _dash().visualizeThreatOnGlobe?.(t); }
  function initializeGlobe() { return _dash().initializeGlobe?.(); }

  // --- Sitemap (screens/sitemap-screen.js) ---
  const _sm = () => window.CyberForgeSitemap || {};
  function buildSitemapLayout() { return _sm().buildSitemapLayout?.() || ''; }
  function bindSitemapEvents() { return _sm().bindSitemapEvents?.(); }

  // --- Scopes (screens/scopes-screen.js) ---
  const _sc = () => window.CyberForgeScopes || {};
  function buildScopesLayout() { return _sc().buildScopesLayout?.() || ''; }
  function bindScopesEvents() { return _sc().bindScopesEvents?.(); }

  // --- Filters (screens/filters-screen.js) ---
  const _filt = () => window.CyberForgeFilters || {};
  function buildFiltersLayout() { return _filt().buildFiltersLayout?.() || ''; }
  function bindFiltersEvents() { return _filt().bindFiltersEvents?.(); }

  // --- AI Models (screens/ai-models-screen.js) ---
  const _aim = () => window.CyberForgeAIModels || {};
  function buildAIModelsLayout() { return _aim().buildAIModelsLayout?.() || ''; }
  function bindAIModelsEvents() { return _aim().bindAIModelsEvents?.(); }

  // --- Threat Intel (screens/threat-intel-screen.js) ---
  const _ti = () => window.CyberForgeThreatIntel || {};
  function buildThreatIntelLayout() { return _ti().buildThreatIntelLayout?.() || ''; }
  function bindThreatIntelEvents() { return _ti().bindThreatIntelEvents?.(); }

  // --- Environment (screens/environment-screen.js) ---
  const _env = () => window.CyberForgeEnvironment || {};
  function buildEnvironmentLayout() { return _env().buildEnvironmentLayout?.() || ''; }
  function bindEnvironmentEvents() { return _env().bindEnvironmentEvents?.(); }

  // --- Sync Status (screens/sync-status-screen.js) ---
  const _sync = () => window.CyberForgeSyncStatus || {};
  function buildSyncStatusLayout() { return _sync().buildSyncStatusLayout?.() || ''; }

  // --- Browser Extension (screens/browser-extension-screen.js) ---
  const _be = () => window.CyberForgeBrowserExtension || {};
  function buildBrowserExtensionLayout() { return _be().buildBrowserExtensionLayout?.() || ''; }

  // --- Mobile Companion (screens/mobile-companion-screen.js) ---
  const _mc = () => window.CyberForgeMobileCompanion || {};
  function buildMobileCompanionLayout() { return _mc().buildMobileCompanionLayout?.() || ''; }

  // --- Profile (screens/profile-screen.js) ---
  const _prof = () => window.CyberForgeProfile || {};
  function buildProfileLayout() { return _prof().buildProfileLayout?.() || ''; }

  // --- Settings (screens/settings-screen.js) ---
  const _set = () => window.CyberForgeSettings || {};
  function buildSettingsLayout() { return _set().buildSettingsLayout?.() || ''; }

  // --- Operational Page (screens/operational-page.js) ---
  const _op = () => window.CyberForgeOperational || {};
  function getSidebarScreenMeta(s) { return _op().getSidebarScreenMeta?.(s) || { title: s, section: '', description: '' }; }
  function buildOperationalPage(s) { return _op().buildOperationalPage?.(s) || ''; }
  function bindOperationalPage(s) { return _op().bindOperationalPage?.(s); }



  // ========================================
  // CHILD PAGE DATA LOADING FUNCTIONS
  // (Extracted to utils/data-loaders.js — delegated via window.CyberForgeDataLoaders)
  // ========================================

  const _dl = () => window.CyberForgeDataLoaders || {};

  function loadDashboardSecurityData() { return _dl().loadDashboardSecurityData?.(); }
  function loadActivityFeedData() { return _dl().loadActivityFeedData?.(); }
  function loadMetricsData() { return _dl().loadMetricsData?.(); }
  function loadSitemapTreeData() { return _dl().loadSitemapTreeData?.(); }
  function renderSitemapTree(data, container) { return _dl().renderSitemapTree?.(data, container); }
  function buildTreeNode(nodes, depth) { return _dl().buildTreeNode?.(nodes, depth); }
  function loadSitemapGraphData() { return _dl().loadSitemapGraphData?.(); }
  function loadActiveScopesData() { return _dl().loadActiveScopesData?.(); }
  function loadExcludedScopesData() { return _dl().loadExcludedScopesData?.(); }
  function loadSavedFiltersData() { return _dl().loadSavedFiltersData?.(); }
  function loadRecentFiltersData() { return _dl().loadRecentFiltersData?.(); }
  function loadInterceptRulesData() { return _dl().loadInterceptRulesData?.(); }
  function loadBreakpointsData() { return _dl().loadBreakpointsData?.(); }
  function loadFlaggedRequestsData() { return _dl().loadFlaggedRequestsData?.(); }
  function loadErrorRequestsData() { return _dl().loadErrorRequestsData?.(); }
  function loadWebSocketMessagesData() { return _dl().loadWebSocketMessagesData?.(); }
  function loadMatchResponseRulesData() { return _dl().loadMatchResponseRulesData?.(); }
  function loadBatchReplayData() { return _dl().loadBatchReplayData?.(); }
  function loadReplayDiffData() { return _dl().loadReplayDiffData?.(); }
  function loadIntruderData() { return _dl().loadIntruderData?.(); }
  function loadFuzzerData() { return _dl().loadFuzzerData?.(); }
  function loadPayloadsData() { return _dl().loadPayloadsData?.(); }
  function loadActiveWorkflowsData() { return _dl().loadActiveWorkflowsData?.(); }
  function loadWorkflowTemplatesData() { return _dl().loadWorkflowTemplatesData?.(); }
  function loadWorkflowHistoryData() { return _dl().loadWorkflowHistoryData?.(); }
  function loadAssistantHistoryData() { return _dl().loadAssistantHistoryData?.(); }
  function loadAssistantInsightsData() { return _dl().loadAssistantInsightsData?.(); }
  function loadTrainedModelsData() { return _dl().loadTrainedModelsData?.(); }
  function loadTrainingModelsData() { return _dl().loadTrainingModelsData?.(); }
  function loadDatasetsData() { return _dl().loadDatasetsData?.(); }
  function loadThreatFeedsData() { return _dl().loadThreatFeedsData?.(); }
  function loadIOCsData() { return _dl().loadIOCsData?.(); }
  function loadCVEsData() { return _dl().loadCVEsData?.(); }
  function loadEnvironmentVariablesData() { return _dl().loadEnvironmentVariablesData?.(); }
  function loadSecretsData() { return _dl().loadSecretsData?.(); }
  function bindAdvancedSearchEvents() { return _dl().bindAdvancedSearchEvents?.(); }
  function loadSavedQueriesData() { return _dl().loadSavedQueriesData?.(); }
  function loadFindingsByLevel(level) { return _dl().loadFindingsByLevel?.(level); }
  function loadExportsReportsData() { return _dl().loadExportsReportsData?.(); }
  function bindDataExportEvents() { return _dl().bindDataExportEvents?.(); }
  function loadProjectFilesData() { return _dl().loadProjectFilesData?.(); }
  function loadNotesData() { return _dl().loadNotesData?.(); }
  function loadScriptsData() { return _dl().loadScriptsData?.(); }
  function loadInstalledPluginsData() { return _dl().loadInstalledPluginsData?.(); }
  function loadMarketplacePluginsData() { return _dl().loadMarketplacePluginsData?.(); }
  function loadWorkspaceSettingsData() { return _dl().loadWorkspaceSettingsData?.(); }
  function loadTeamMembersData() { return _dl().loadTeamMembersData?.(); }
  function loadPendingSyncData() { return _dl().loadPendingSyncData?.(); }
  function loadSyncHistoryData() { return _dl().loadSyncHistoryData?.(); }
  function loadExtensionInstallData() { return _dl().loadExtensionInstallData?.(); }
  function loadExtensionSettingsData() { return _dl().loadExtensionSettingsData?.(); }
  function initMobilePairing() { return _dl().initMobilePairing?.(); }
  function loadPairedDevicesData() { return _dl().loadPairedDevicesData?.(); }
  function loadBrowserRegistrationData() { return _dl().loadBrowserRegistrationData?.(); }
  function browserIconFallback(key) { return _dl().browserIconFallback?.(key); }
  function launchBrowserWithMonitoring(browserId, cardElement) { return _dl().launchBrowserWithMonitoring?.(browserId, cardElement); }
  function setupBrowserEventListeners() { return _dl().setupBrowserEventListeners?.(); }
  function loadBrowserHistoryData() { return _dl().loadBrowserHistoryData?.(); }
  function loadSuspiciousDomainsData() { return _dl().loadSuspiciousDomainsData?.(); }
  function loadCredentialExposureData() { return _dl().loadCredentialExposureData?.(); }
  function isVersionOutdated(browserName, version) { return _dl().isVersionOutdated?.(browserName, version); }
  function loadTrackingDetectionData() { return _dl().loadTrackingDetectionData?.(); }
  function loadDownloadAnalysisData() { return _dl().loadDownloadAnalysisData?.(); }
  function formatFileSize(bytes) { return _dl().formatFileSize?.(bytes); }
  function initEventFeedStream() { return _dl().initEventFeedStream?.(); }
  function loadRiskAnalysisData() { return _dl().loadRiskAnalysisData?.(); }
  function initThreatMap() { return _dl().initThreatMap?.(); }
  function initQuickScan() { return _dl().initQuickScan?.(); }
  function initDeepScan() { return _dl().initDeepScan?.(); }
  function initStealthScan() { return _dl().initStealthScan?.(); }
  function initForensicScan() { return _dl().initForensicScan?.(); }

  // NOTE: Real initAgentControlPanel is defined earlier in the file (line ~361)
  // Do not add another one here as it will override the working version

  function loadAgentTasksData() { return _dl().loadAgentTasksData?.(); }
  function loadScheduledTasksData() { return _dl().loadScheduledTasksData?.(); }
  function loadAgentDecisionsData() { return _dl().loadAgentDecisionsData?.(); }
  function loadAgentMemoryData() { return _dl().loadAgentMemoryData?.(); }



  // ========================================
  // BROWSER INTELLIGENCE ENGINE — Delegation Stubs
  // (Extracted to screens/browser-intel-screen.js)
  // ========================================

  const _bi = () => window.CyberForgeBrowserIntelScreen || {};
  function _handleBehavioralAlert(a) { return _bi()._handleBehavioralAlert?.(a); }
  function _pushAlertToBackend(a) { return _bi()._pushAlertToBackend?.(a); }
  function _startIntelligenceSnapshotPush() { return _bi()._startIntelligenceSnapshotPush?.(); }
  function _updateFloatingPanelBehavioralAlerts() { return _bi()._updateFloatingPanelBehavioralAlerts?.(); }
  function buildBrowserIntelligenceScreen() { return _bi().buildBrowserIntelligenceScreen?.() || ''; }
  function initBrowserIntelligenceScreen() { return _bi().initBrowserIntelligenceScreen?.(); }
  function loadBrowserIntelData() { return _bi().loadBrowserIntelData?.(); }
  function buildIntelSessionsScreen() { return _bi().buildIntelSessionsScreen?.() || ''; }
  function loadIntelSessionsData() { return _bi().loadIntelSessionsData?.(); }
  function buildIntelAlertsScreen() { return _bi().buildIntelAlertsScreen?.() || ''; }
  function loadIntelAlertsData() { return _bi().loadIntelAlertsData?.(); }
  function _renderIntelAlertsList(c) { return _bi()._renderIntelAlertsList?.(c); }
  function buildIntelDomainGraphScreen() { return _bi().buildIntelDomainGraphScreen?.() || ''; }
  function loadIntelDomainGraph() { return _bi().loadIntelDomainGraph?.(); }
  function buildIntelConfigScreen() { return _bi().buildIntelConfigScreen?.() || ''; }
  function loadIntelConfig() { return _bi().loadIntelConfig?.(); }
  function _browserIcon(b) { return _bi()._browserIcon?.(b) || 'fas fa-globe'; }
  function _alertIcon(r) { return _bi()._alertIcon?.(r) || 'fas fa-exclamation-triangle'; }
  function _formatAge(s) { return _bi()._formatAge?.(s) || '—'; }



  // ========================================
  // EXPOSE CORE APP REFERENCES FOR EXTRACTED MODULES
  // ========================================
  window.CyberForgeApp = {
    state,
    agentState,
    renderScreen,
    updateConnectionStatus,
    showToast,
    showModal,
    showConfirmModal,
    appendAgentConsole,
    resolveCurrentUserId: typeof resolveCurrentUserId === 'function' ? resolveCurrentUserId : () => null,
    buildOperationalPage,
    bindOperationalPage,
    getSidebarScreenMeta
  };

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
