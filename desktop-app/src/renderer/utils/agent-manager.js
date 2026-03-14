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
    bindAgentControlActions,
    syncAgentCenterWithBackend
  };
})();
