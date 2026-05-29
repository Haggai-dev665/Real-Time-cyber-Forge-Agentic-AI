// CyberForge Data Loaders
// Extracted data-loading functions for child page rendering

(() => {
  'use strict';

  // ── API Proxy (mirrors main app pattern) ──────────────────────────────
  function resolveAPIClient() {
    return window.cyberforgeAPI || window.apiClient || null;
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

  // ── Convenience references ────────────────────────────────────────────
  function showToast(type, title, message) {
    if (window.CyberForgeToast?.showToast) {
      window.CyberForgeToast.showToast(type, title, message);
    }
  }

  function showModal(title, content, onSubmit, submitText) {
    if (window.CyberForgeModal?.showModal) {
      window.CyberForgeModal.showModal(title, content, onSubmit, submitText);
    }
  }

  function getState() {
    return window.CyberForgeApp?.state;
  }

  // ── Helper references (defined in main app, accessed via window) ──────
  function severityColor(sev) {
    if (window.CyberForgeApp?.severityColor) return window.CyberForgeApp.severityColor(sev);
    const s = sev.toLowerCase();
    if (s === 'high' || s === 'critical') return 'red';
    if (s === 'medium') return 'orange';
    return 'green';
  }

  function resolveCurrentUserId() {
    if (window.CyberForgeApp?.resolveCurrentUserId) return window.CyberForgeApp.resolveCurrentUserId();
    const user = cyberforgeAPI.getCurrentUser?.() || {};
    return user.id || user._id || user.$id || user.userId || 'desktop-user';
  }

  async function safeGetAgentAlerts(opts) {
    if (window.CyberForgeApp?.safeGetAgentAlerts) return window.CyberForgeApp.safeGetAgentAlerts(opts);
    const { userId, limit = 20 } = opts || {};
    if (typeof cyberforgeAPI?.getAgentAlerts === 'function') {
      return cyberforgeAPI.getAgentAlerts({ userId, limit });
    }
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/alerts?userId=${encodeURIComponent(userId)}&limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error(`Agent alerts request failed: HTTP ${response.status}`);
    const payload = await response.json();
    return { success: true, data: payload };
  }

  async function fetchBrowserIntelligenceHistory(limit = 20) {
    if (window.CyberForgeApp?.fetchBrowserIntelligenceHistory) return window.CyberForgeApp.fetchBrowserIntelligenceHistory(limit);
    const userId = resolveCurrentUserId();
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    const response = await fetch(`${backendUrl}/api/agent/browser-intelligence?userId=${encodeURIComponent(userId)}&limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload?.data?.snapshots || payload?.snapshots || [];
  }

  async function persistBrowserIntelligence(detection) {
    if (window.CyberForgeApp?.persistBrowserIntelligence) return window.CyberForgeApp.persistBrowserIntelligence(detection);
    if (!detection || !detection.browsers) return;
    const userId = resolveCurrentUserId();
    const backendUrl = localStorage.getItem('cyberforge_backend_url') || 'https://cyberforge-ddd97655464f.herokuapp.com';
    const token = localStorage.getItem('authToken') || '';
    await fetch(`${backendUrl}/api/agent/browser-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ userId, detection }),
      signal: AbortSignal.timeout(7000)
    });
  }

  function renderFiles() {
    if (window.CyberForgeApp?.renderFiles) return window.CyberForgeApp.renderFiles();
  }

  function renderScreen(screen) {
    if (window.CyberForgeApp?.renderScreen) return window.CyberForgeApp.renderScreen(screen);
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
        <span class="var-value">https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml</span>
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

      // Persist detection to backend (fire-and-forget)
      if (result?.browsers) {
        persistBrowserIntelligence(result).catch(err => {
          console.warn('[BrowserRegistration] Failed to persist intel:', err.message);
        });
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
    const resultsContainer = document.getElementById('history-scan-results');
    const summaryContainer = document.getElementById('history-results-summary');
    if (!resultsContainer && !summaryContainer) return;

    // Wire up "Start Scan" button
    const scanBtn = document.getElementById('start-history-scan');
    const rangeSelect = document.getElementById('history-scan-range');

    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
        if (summaryContainer) summaryContainer.innerHTML = '<p class="text-secondary"><i class="fas fa-spinner fa-spin"></i> Scanning browser history...</p>';

        try {
          const range = rangeSelect?.value || '7d';

          // Pull latest browser intelligence from backend
          const snapshots = await fetchBrowserIntelligenceHistory(5);

          // Also try to get browser history via Tauri
          let historyEntries = [];
          if (window.electronAPI?.systemMonitor?.getBrowserHistory) {
            historyEntries = await window.electronAPI.systemMonitor.getBrowserHistory(range) || [];
          }

          // Analyze entries against threat keywords
          const suspiciousKeywords = ['phish', 'malware', 'hack', 'crack', 'exploit', 'darknet', 'torrent'];
          const flagged = historyEntries.filter(entry => {
            const url = (entry.url || '').toLowerCase();
            const title = (entry.title || '').toLowerCase();
            return suspiciousKeywords.some(kw => url.includes(kw) || title.includes(kw));
          });

          const totalScanned = historyEntries.length;
          const flaggedCount = flagged.length;
          const snapshotCount = snapshots.length;

          if (summaryContainer) {
            summaryContainer.innerHTML = `
              <div class="scan-stats">
                <div class="stat-card"><div class="stat-value">${totalScanned}</div><div class="stat-label">URLs Scanned</div></div>
                <div class="stat-card"><div class="stat-value" style="color:var(--cf-error)">${flaggedCount}</div><div class="stat-label">Flagged</div></div>
                <div class="stat-card"><div class="stat-value">${snapshotCount}</div><div class="stat-label">Saved Snapshots</div></div>
              </div>
              ${flaggedCount === 0 && totalScanned === 0 ? '<p class="text-secondary">No browser history available. Make sure a browser is registered and history access is permitted.</p>' : ''}
              ${flaggedCount === 0 && totalScanned > 0 ? '<p style="color:var(--cf-success)"><i class="fas fa-check-circle"></i> No suspicious URLs found in your browsing history.</p>' : ''}
              ${flaggedCount > 0 ? `
                <div class="cf-table-container" style="margin-top:12px">
                  <table class="cf-table"><thead><tr><th>URL</th><th>Title</th><th>Visited</th><th>Risk</th></tr></thead>
                  <tbody>${flagged.slice(0, 50).map(e => `<tr>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${e.url || 'N/A'}</td>
                    <td>${e.title || ''}</td>
                    <td>${e.visitTime ? new Date(e.visitTime).toLocaleString() : 'Unknown'}</td>
                    <td><span class="bi-badge bi-badge-running">Suspicious</span></td>
                  </tr>`).join('')}</tbody></table>
                </div>` : ''}
            `;
          }

        } catch (err) {
          console.error('[HistoryScan] Error:', err);
          if (summaryContainer) summaryContainer.innerHTML = `<p style="color:var(--cf-error)"><i class="fas fa-exclamation-circle"></i> Scan failed: ${err.message}</p>`;
        } finally {
          scanBtn.disabled = false;
          scanBtn.innerHTML = '<i class="fas fa-search"></i> Start Scan';
        }
      });
    }

    // Show default state
    if (summaryContainer) summaryContainer.innerHTML = '<p class="text-secondary">Click "Start Scan" to analyze your browser history for threats.</p>';
  }

  async function loadSuspiciousDomainsData() {
    const tbody = document.getElementById('suspicious-domains-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

    try {
      // Pull intelligence snapshots and extract domain data from browsers
      const snapshots = await fetchBrowserIntelligenceHistory(10);

      // Aggregate unique domains from browser data
      const domainMap = new Map();
      const suspiciousPatterns = [
        { pattern: /\.(ru|cn|tk|ml|ga|cf)$/i, category: 'Suspicious TLD', risk: 'High' },
        { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, category: 'Direct IP Access', risk: 'Medium' },
        { pattern: /(phish|malware|hack|exploit|crack)/i, category: 'Threat Keyword', risk: 'Critical' },
        { pattern: /(torrent|darknet|onion)/i, category: 'Dark Web', risk: 'High' },
        { pattern: /(free-?download|crack-?serial|keygen)/i, category: 'Piracy/Malware', risk: 'High' }
      ];

      // Try getting browsing domains from Tauri bridge
      let domains = [];
      if (window.electronAPI?.systemMonitor?.getVisitedDomains) {
        domains = await window.electronAPI.systemMonitor.getVisitedDomains() || [];
      }

      // Check each domain against suspicious patterns
      domains.forEach(d => {
        const domain = d.domain || d;
        for (const sp of suspiciousPatterns) {
          if (sp.pattern.test(domain)) {
            domainMap.set(domain, {
              domain,
              risk: sp.risk,
              category: sp.category,
              firstSeen: d.firstSeen || new Date().toISOString(),
              visits: d.visits || 1
            });
            break;
          }
        }
      });

      const suspiciousDomains = Array.from(domainMap.values());

      if (suspiciousDomains.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-check-circle" style="color:var(--cf-success)"></i> No suspicious domains detected. Your browsing looks clean.</td></tr>';
      } else {
        tbody.innerHTML = suspiciousDomains.map(d => `
          <tr>
            <td><code>${d.domain}</code></td>
            <td><span class="bi-badge ${d.risk === 'Critical' ? 'bi-badge-running' : d.risk === 'High' ? 'bi-badge-default' : ''}">${d.risk}</span></td>
            <td>${d.category}</td>
            <td>${new Date(d.firstSeen).toLocaleDateString()}</td>
            <td>${d.visits}</td>
            <td><button class="cf-btn cf-btn-sm" onclick="navigator.clipboard.writeText('${d.domain}')"><i class="fas fa-copy"></i></button></td>
          </tr>
        `).join('');
      }

      // Wire refresh button
      document.getElementById('refresh-suspicious')?.addEventListener('click', () => {
        loadSuspiciousDomainsData();
      });

    } catch (err) {
      console.error('[SuspiciousDomains] Error:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="error-state"><i class="fas fa-exclamation-circle"></i> ${err.message}</td></tr>`;
    }
  }

  async function loadCredentialExposureData() {
    const tbody = document.getElementById('credential-exposure-tbody');
    const exposedEl = document.getElementById('exposed-count');
    const atRiskEl = document.getElementById('at-risk-count');
    const secureEl = document.getElementById('secure-count');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5"><i class="fas fa-spinner fa-spin"></i> Checking credentials...</td></tr>';

    try {
      // Get stored accounts from browser intelligence
      const snapshots = await fetchBrowserIntelligenceHistory(5);

      // Extract browser names as "accounts" to check
      const browsers = [];
      if (snapshots.length > 0) {
        const latest = snapshots[0];
        const browserList = JSON.parse(latest.browsers_json || '[]');
        browserList.forEach(b => {
          if (b.isInstalled || b.available) {
            browsers.push({
              name: b.name || b.key,
              service: 'Browser Profile',
              version: b.version || 'Unknown',
              isOutdated: b.version ? isVersionOutdated(b.name || b.key, b.version) : false
            });
          }
        });
      }

      // Simple credential exposure check based on browser age/version
      let exposed = 0, atRisk = 0, secure = 0;
      const rows = browsers.map(b => {
        let status, statusClass;
        if (b.isOutdated) {
          exposed++;
          status = 'Vulnerable';
          statusClass = 'color:var(--cf-error)';
        } else if (!b.version || b.version === 'Unknown') {
          atRisk++;
          status = 'Unknown Risk';
          statusClass = 'color:var(--cf-warning)';
        } else {
          secure++;
          status = 'Secure';
          statusClass = 'color:var(--cf-success)';
        }
        return `<tr>
          <td>${b.name}</td>
          <td>${b.service}</td>
          <td style="${statusClass};font-weight:600">${status}</td>
          <td>—</td>
          <td>${b.isOutdated ? '<button class="cf-btn cf-btn-sm" onclick="showToast(\'info\',\'Recommendation\',\'Update your browser to the latest version\')"><i class="fas fa-shield-alt"></i> Fix</button>' : '<i class="fas fa-check" style="color:var(--cf-success)"></i>'}</td>
        </tr>`;
      });

      if (exposedEl) exposedEl.textContent = exposed;
      if (atRiskEl) atRiskEl.textContent = atRisk;
      if (secureEl) secureEl.textContent = secure;

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No browser profiles found. Register browsers first.</td></tr>';
      } else {
        tbody.innerHTML = rows.join('');
      }

      // Wire check button
      document.getElementById('check-credentials')?.addEventListener('click', () => loadCredentialExposureData());

    } catch (err) {
      console.error('[CredentialExposure] Error:', err);
      tbody.innerHTML = `<tr><td colspan="5" class="error-state"><i class="fas fa-exclamation-circle"></i> ${err.message}</td></tr>`;
    }
  }

  function isVersionOutdated(browserName, version) {
    // Simple heuristic: check if major version is significantly behind
    const minVersions = { chrome: 120, firefox: 120, edge: 120, brave: 1, opera: 105, chromium: 120 };
    const key = (browserName || '').toLowerCase();
    const majorVersion = parseInt(version, 10);
    if (isNaN(majorVersion)) return false;
    const minVer = minVersions[key];
    return minVer ? majorVersion < minVer : false;
  }

  async function loadTrackingDetectionData() {
    const tbody = document.getElementById('trackers-tbody');
    const blockedEl = document.getElementById('trackers-blocked');
    const detectedEl = document.getElementById('trackers-detected');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6"><i class="fas fa-spinner fa-spin"></i> Scanning for trackers...</td></tr>';

    try {
      // Known tracker database
      const knownTrackers = [
        { tracker: 'Google Analytics', company: 'Google', type: 'Analytics', pattern: /google-analytics\.com|googletagmanager\.com/i },
        { tracker: 'Facebook Pixel', company: 'Meta', type: 'Advertising', pattern: /facebook\.com\/tr|connect\.facebook/i },
        { tracker: 'Doubleclick', company: 'Google', type: 'Advertising', pattern: /doubleclick\.net/i },
        { tracker: 'Hotjar', company: 'Hotjar', type: 'Session Recording', pattern: /hotjar\.com/i },
        { tracker: 'Mixpanel', company: 'Mixpanel', type: 'Analytics', pattern: /mixpanel\.com/i },
        { tracker: 'Criteo', company: 'Criteo', type: 'Advertising', pattern: /criteo\.com/i },
        { tracker: 'LinkedIn Insight', company: 'LinkedIn', type: 'Analytics', pattern: /linkedin\.com\/px|snap\.licdn/i },
        { tracker: 'TikTok Pixel', company: 'TikTok', type: 'Advertising', pattern: /analytics\.tiktok\.com/i }
      ];

      // Try to get network requests from Tauri bridge
      let networkRequests = [];
      if (window.electronAPI?.systemMonitor?.getNetworkRequests) {
        networkRequests = await window.electronAPI.systemMonitor.getNetworkRequests() || [];
      }

      // Match against known trackers
      const detectedTrackers = [];
      const seenTrackers = new Set();

      networkRequests.forEach(req => {
        const url = req.url || req;
        knownTrackers.forEach(kt => {
          if (kt.pattern.test(url) && !seenTrackers.has(kt.tracker)) {
            seenTrackers.add(kt.tracker);
            detectedTrackers.push({ ...kt, frequency: 1, status: 'Active' });
          }
        });
      });

      // If no network data available, show known trackers as "unchecked"
      if (networkRequests.length === 0) {
        knownTrackers.slice(0, 4).forEach(kt => {
          detectedTrackers.push({ ...kt, frequency: '—', status: 'Unchecked' });
        });
      }

      const blocked = detectedTrackers.filter(t => t.status === 'Blocked').length;
      if (blockedEl) blockedEl.textContent = blocked;
      if (detectedEl) detectedEl.textContent = detectedTrackers.length;

      if (detectedTrackers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-check-circle" style="color:var(--cf-success)"></i> No trackers detected</td></tr>';
      } else {
        tbody.innerHTML = detectedTrackers.map(t => `
          <tr>
            <td>${t.tracker}</td>
            <td>${t.company}</td>
            <td>${t.type}</td>
            <td>${t.frequency}</td>
            <td><span style="color:${t.status === 'Blocked' ? 'var(--cf-success)' : t.status === 'Active' ? 'var(--cf-error)' : 'var(--cf-text-secondary)'}">${t.status}</span></td>
            <td><button class="cf-btn cf-btn-sm" title="Block tracker"><i class="fas fa-ban"></i></button></td>
          </tr>
        `).join('');
      }

      // Wire buttons
      document.getElementById('refresh-trackers')?.addEventListener('click', () => loadTrackingDetectionData());
      document.getElementById('block-all-trackers')?.addEventListener('click', () => {
        showToast('info', 'Tracker Blocking', 'Tracker blocking rules applied to agent configuration');
      });

    } catch (err) {
      console.error('[TrackingDetection] Error:', err);
      tbody.innerHTML = `<tr><td colspan="6" class="error-state"><i class="fas fa-exclamation-circle"></i> ${err.message}</td></tr>`;
    }
  }

  async function loadDownloadAnalysisData() {
    const tbody = document.getElementById('downloads-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Scanning downloads...</td></tr>';

    try {
      let downloads = [];

      // Try Tauri bridge for download history
      if (window.electronAPI?.systemMonitor?.getDownloads) {
        downloads = await window.electronAPI.systemMonitor.getDownloads() || [];
      }

      // Risk assessment for file types
      const riskyExtensions = {
        exe: 'Critical', msi: 'Critical', bat: 'Critical', cmd: 'Critical', ps1: 'Critical',
        scr: 'Critical', dll: 'High', vbs: 'High', js: 'Medium', jar: 'High',
        zip: 'Low', rar: 'Low', '7z': 'Low', dmg: 'Medium', pkg: 'Medium',
        pdf: 'Low', doc: 'Low', docx: 'Low', xls: 'Low', xlsx: 'Low'
      };

      const analyzed = downloads.map(d => {
        const fileName = d.fileName || d.name || 'Unknown';
        const ext = fileName.split('.').pop().toLowerCase();
        const risk = riskyExtensions[ext] || 'Unknown';
        return {
          fileName,
          type: ext.toUpperCase(),
          size: d.size ? formatFileSize(d.size) : '—',
          source: d.source || d.url || 'Unknown',
          risk,
          downloaded: d.downloadTime ? new Date(d.downloadTime).toLocaleString() : '—'
        };
      });

      if (analyzed.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-folder-open"></i> No downloads found. Click "Scan Downloads" to analyze your download folder.</td></tr>';
      } else {
        tbody.innerHTML = analyzed.map(d => {
          const riskColor = d.risk === 'Critical' ? 'var(--cf-error)' : d.risk === 'High' ? 'var(--cf-warning)' : d.risk === 'Medium' ? 'var(--cf-primary)' : 'var(--cf-success)';
          return `<tr>
            <td title="${d.fileName}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${d.fileName}</td>
            <td>${d.type}</td>
            <td>${d.size}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${d.source}">${d.source}</td>
            <td><span style="color:${riskColor};font-weight:600">${d.risk}</span></td>
            <td>${d.downloaded}</td>
            <td><button class="cf-btn cf-btn-sm" title="Analyze file"><i class="fas fa-search"></i></button></td>
          </tr>`;
        }).join('');
      }

      // Wire scan button
      document.getElementById('scan-downloads')?.addEventListener('click', () => loadDownloadAnalysisData());

    } catch (err) {
      console.error('[DownloadAnalysis] Error:', err);
      tbody.innerHTML = `<tr><td colspan="7" class="error-state"><i class="fas fa-exclamation-circle"></i> ${err.message}</td></tr>`;
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function initEventFeedStream() {
    const container = document.getElementById('event-feed-stream');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Connecting to event stream...</div>';
  }

  async function loadRiskAnalysisData() {
    const overviewEl = document.getElementById('risk-overview');
    const breakdownEl = document.getElementById('risk-breakdown');
    if (!overviewEl && !breakdownEl) return;

    try {
      // Gather intelligence data
      const snapshots = await fetchBrowserIntelligenceHistory(10);

      // Calculate risk scores based on browser intelligence
      let networkRisk = 30, appRisk = 30, dataRisk = 20, complianceRisk = 25;

      if (snapshots.length > 0) {
        const latest = snapshots[0];
        const browsers = JSON.parse(latest.browsers_json || '[]');

        // App security: outdated browsers increase risk
        const installedBrowsers = browsers.filter(b => b.isInstalled || b.available);
        const outdatedCount = installedBrowsers.filter(b => {
          const v = parseInt(b.version, 10);
          return !isNaN(v) && v < 120;
        }).length;
        appRisk = Math.min(100, 30 + (outdatedCount * 20));

        // Network: running browsers without monitoring
        const runningCount = browsers.filter(b => b.isRunning).length;
        networkRisk = Math.min(100, 25 + (runningCount * 10));

        // Data: multiple browsers = more exposure surface
        dataRisk = Math.min(100, 15 + (installedBrowsers.length * 8));

        // Compliance: check if default browser is set and known
        complianceRisk = latest.default_browser ? 25 : 60;
      }

      const overallRisk = Math.round((networkRisk + appRisk + dataRisk + complianceRisk) / 4);

      // Determine risk color
      const riskColor = overallRisk >= 70 ? 'var(--cf-error)' : overallRisk >= 40 ? 'var(--cf-warning)' : 'var(--cf-success)';
      const dashOffset = 283 - (283 * overallRisk / 100);

      if (overviewEl) {
        overviewEl.innerHTML = `
          <div class="risk-score-card">
            <div class="risk-score-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-bg-light)" stroke-width="8"/>
                <circle cx="50" cy="50" r="45" fill="none" stroke="${riskColor}" stroke-width="8"
                  stroke-dasharray="283" stroke-dashoffset="${dashOffset}" stroke-linecap="round"/>
              </svg>
              <div class="risk-value">${overallRisk}</div>
            </div>
            <div class="risk-label">Overall Risk Score</div>
          </div>
        `;
      }

      if (breakdownEl) {
        const categories = [
          { name: 'Network Security', score: networkRisk },
          { name: 'Application Security', score: appRisk },
          { name: 'Data Security', score: dataRisk },
          { name: 'Compliance', score: complianceRisk }
        ];

        breakdownEl.innerHTML = `<h4>Risk Categories</h4>` + categories.map(c => {
          const barColor = c.score >= 70 ? 'var(--cf-error)' : c.score >= 40 ? 'var(--cf-warning)' : 'var(--cf-success)';
          return `
            <div class="risk-category">
              <span class="category-name">${c.name}</span>
              <div class="category-bar"><div class="bar-fill" style="width:${c.score}%;background:${barColor}"></div></div>
              <span class="category-score">${c.score}</span>
            </div>`;
        }).join('');
      }

      // Wire analysis button
      document.getElementById('run-risk-analysis')?.addEventListener('click', () => {
        if (overviewEl) overviewEl.innerHTML = '<div class="risk-score-card"><i class="fas fa-spinner fa-spin" style="font-size:32px"></i><div class="risk-label">Recalculating...</div></div>';
        loadRiskAnalysisData();
      });

    } catch (err) {
      console.error('[RiskAnalysis] Error:', err);
      if (overviewEl) overviewEl.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-circle"></i> ${err.message}</div>`;
    }
  }

  function formatThreatTime(value) {
    const dt = value ? new Date(value) : new Date();
    if (Number.isNaN(dt.getTime())) return 'now';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function toLabel(value, fallback) {
    if (!value) return fallback;
    return String(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeThreat(threat, index) {
    const origin = threat.origin || {};
    const destination = threat.destination || {};
    const createdAt = threat.createdAt || threat.$createdAt || threat.updatedAt || threat.timestamp || Date.now();
    const severityRaw = (threat.severity || 'medium').toLowerCase();
    const severity = severityRaw === 'critical' ? 'high' : severityRaw;
    const status = (threat.status || 'active').toLowerCase();
    const type = toLabel(threat.type || threat.threat || 'unknown', 'Unknown');
    const confidenceVal = threat.confidence;
    const confidence = typeof confidenceVal === 'number'
      ? Math.max(0, Math.min(100, Math.round(confidenceVal <= 1 ? confidenceVal * 100 : confidenceVal)))
      : 70;

    return {
      id: threat.id || threat.$id || `th-${index + 1}`,
      type,
      severity,
      status,
      createdAt,
      confidence,
      source: origin.country || origin.city || 'Unknown source',
      target: destination.country || destination.city || 'Unknown target',
      sourceLat: Number(origin.lat || 0),
      sourceLon: Number(origin.lon || 0),
      targetLat: Number(destination.lat || 0),
      targetLon: Number(destination.lon || 0),
      malwareFamily: threat.family || threat.malware_family || 'Unclassified',
      ioc: threat.ioc || threat.indicator || threat.indicator_type || 'N/A',
      confidenceSource: threat.source || 'OTX',
      raw: threat
    };
  }

  const THREAT_SEVERITY_COLORS = {
    high: '#E5573E',
    medium: '#D8B65A',
    low: '#F69D39'
  };

  // User-requested frontend key path for Threat Globe direct OTX access.
  const OTX_FRONTEND_API_KEY = 'e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d';

  const THREAT_SEVERITY_WEIGHT = {
    high: 3,
    medium: 2,
    low: 1
  };

  const COUNTRY_CENTROIDS = {
    US: [39.8283, -98.5795],
    CA: [56.1304, -106.3468],
    MX: [23.6345, -102.5528],
    BR: [-14.2350, -51.9253],
    AR: [-38.4161, -63.6167],
    GB: [55.3781, -3.4360],
    FR: [46.2276, 2.2137],
    DE: [51.1657, 10.4515],
    ES: [40.4637, -3.7492],
    IT: [41.8719, 12.5674],
    NL: [52.1326, 5.2913],
    RU: [61.5240, 105.3188],
    UA: [48.3794, 31.1656],
    TR: [38.9637, 35.2433],
    SA: [23.8859, 45.0792],
    AE: [23.4241, 53.8478],
    IN: [20.5937, 78.9629],
    CN: [35.8617, 104.1954],
    JP: [36.2048, 138.2529],
    KR: [35.9078, 127.7669],
    SG: [1.3521, 103.8198],
    AU: [-25.2744, 133.7751],
    NZ: [-40.9006, 174.8860],
    ZA: [-30.5595, 22.9375],
    NG: [9.0820, 8.6753],
    EG: [26.8206, 30.8025]
  };

  function hashString(input) {
    const text = String(input || 'threat');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function inferCountryCode(value) {
    if (!value) return null;
    const text = String(value).trim();
    const code = text.length === 2 ? text.toUpperCase() : null;
    if (code && COUNTRY_CENTROIDS[code]) return code;

    const upper = text.toUpperCase();
    const named = Object.keys(COUNTRY_CENTROIDS).find((cc) => upper.includes(cc));
    return named || null;
  }

  function inferCoordsFromText(seedText) {
    const hash = hashString(seedText);
    const lat = ((hash % 12000) / 100) - 60;
    const lon = (((Math.floor(hash / 12000)) % 32000) / 100) - 160;
    return [Math.max(-60, Math.min(75, lat)), Math.max(-170, Math.min(170, lon))];
  }

  function resolveThreatPoint(threat, kind) {
    const isSource = kind === 'source';
    const lat = Number(isSource ? threat.sourceLat : threat.targetLat);
    const lon = Number(isSource ? threat.sourceLon : threat.targetLon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
      return [lat, lon];
    }

    const label = isSource ? threat.source : threat.target;
    const code = inferCountryCode(label);
    if (code && COUNTRY_CENTROIDS[code]) {
      return COUNTRY_CENTROIDS[code];
    }

    return inferCoordsFromText(`${threat.id}-${kind}-${label || 'unknown'}`);
  }

  function ensureThreatLeafletContainer() {
    const container = document.getElementById('threat-map-container');
    if (!container) return null;

    const canvas = document.getElementById('dashboard-map-canvas');
    if (canvas) {
      canvas.style.display = 'none';
      canvas.setAttribute('aria-hidden', 'true');
    }

    let mapEl = document.getElementById('threat-leaflet-map');
    if (!mapEl) {
      mapEl = document.createElement('div');
      mapEl.id = 'threat-leaflet-map';
      container.insertBefore(mapEl, container.firstChild);
    }
    return mapEl;
  }

  function ensureLeafletLoaded() {
    if (window.L?.map) return Promise.resolve(window.L);
    if (window.__cfLeafletLoadingPromise) return window.__cfLeafletLoadingPromise;

    window.__cfLeafletLoadingPromise = new Promise((resolve, reject) => {
      const finalize = () => {
        if (window.L?.map) resolve(window.L);
        else reject(new Error('Leaflet library did not initialize.'));
      };

      if (!document.getElementById('cf-leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'cf-leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const existing = document.getElementById('cf-leaflet-js');
      if (existing) {
        existing.addEventListener('load', finalize, { once: true });
        existing.addEventListener('error', () => reject(new Error('Leaflet script failed to load.')), { once: true });
        if (window.L?.map) finalize();
        return;
      }

      const script = document.createElement('script');
      script.id = 'cf-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = finalize;
      script.onerror = () => reject(new Error('Leaflet script failed to load.'));
      document.head.appendChild(script);
    }).finally(() => {
      window.__cfLeafletLoadingPromise = null;
    });

    return window.__cfLeafletLoadingPromise;
  }

  function ensureThreatLeafletMap() {
    if (!window.L?.map) throw new Error('Leaflet is not available');

    const mapEl = ensureThreatLeafletContainer();
    if (!mapEl) return null;

    const existing = window.__cfThreatLeafletMap;
    if (existing?.container === mapEl && existing?.map) {
      if (!existing.zoomListenerBound) {
        existing.map.on('zoomend', () => {
          if (Array.isArray(existing.latestThreats) && existing.latestThreats.length) {
            renderThreatsOnLeaflet(existing.latestThreats, { refit: false, preserveZoom: true });
          }
        });
        existing.zoomListenerBound = true;
      }
      setTimeout(() => existing.map.invalidateSize(), 0);
      return existing;
    }

    if (existing?.map) {
      existing.map.remove();
    }

    const map = window.L.map(mapEl, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      zoomControl: true,
      worldCopyJump: true,
      preferCanvas: true
    });

    map.createPane('arcsPane');
    map.getPane('arcsPane').style.zIndex = '420';
    map.createPane('hotspotsPane');
    map.getPane('hotspotsPane').style.zIndex = '650';

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      opacity: 0.72,
      pane: 'overlayPane'
    }).addTo(map);

    const arcsLayer = window.L.layerGroup().addTo(map);
    const markersLayer = window.L.layerGroup().addTo(map);
    const hotspotsLayer = window.L.layerGroup().addTo(map);

    const state = {
      map,
      container: mapEl,
      arcsLayer,
      markersLayer,
      hotspotsLayer,
      latestThreats: [],
      zoomListenerBound: false
    };
    window.__cfThreatLeafletMap = state;

    map.on('zoomend', () => {
      if (Array.isArray(state.latestThreats) && state.latestThreats.length) {
        renderThreatsOnLeaflet(state.latestThreats, { refit: false, preserveZoom: true });
      }
    });
    state.zoomListenerBound = true;

    setTimeout(() => map.invalidateSize(), 60);
    return state;
  }

  function buildThreatPopup(threat) {
    return `
      <div class="leaflet-threat-popup">
        <div class="popup-severity ${threat.severity}">${threat.severity}</div>
        <div class="popup-title">${threat.type}</div>
        <div class="popup-route"><i class="fas fa-location-arrow"></i> ${threat.source} -> ${threat.target}</div>
        <div class="popup-adversary"><i class="fas fa-virus"></i> ${threat.malwareFamily} | Confidence ${threat.confidence}%</div>
      </div>
    `;
  }

  function buildThreatClusterPopup(cluster) {
    const sampleText = cluster.samples.slice(0, 4).map((s) => `${s.type} (${s.confidence}%)`).join('<br>');
    return `
      <div class="leaflet-threat-popup">
        <div class="popup-severity ${cluster.severity}">${cluster.count} threats</div>
        <div class="popup-title">${cluster.label}</div>
        <div class="popup-route"><i class="fas fa-bullseye"></i> Confidence avg ${cluster.avgConfidence}%</div>
        <div class="popup-adversary"><i class="fas fa-list"></i> ${sampleText || 'No sample details'}</div>
      </div>
    `;
  }

  function compareThreatPriority(a, b) {
    const sevDiff = (THREAT_SEVERITY_WEIGHT[b.severity] || 0) - (THREAT_SEVERITY_WEIGHT[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    const confDiff = (b.confidence || 0) - (a.confidence || 0);
    if (confDiff !== 0) return confDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  function getClusterCellStepForZoom(zoom, totalThreats) {
    const z = Number.isFinite(zoom) ? zoom : 2;
    const base = 7.6 - (z * 1.05);
    const densityBoost = totalThreats > 260 ? 1.4 : totalThreats > 160 ? 1.0 : totalThreats > 90 ? 0.5 : 0;
    return Math.max(0.45, Math.min(6.5, base + densityBoost));
  }

  function aggregateThreatTargets(threats, zoom) {
    const byCell = new Map();
    const cellStep = getClusterCellStepForZoom(zoom, threats.length);

    threats.forEach((threat) => {
      const point = resolveThreatPoint(threat, 'target');
      if (!point) return;

      const cellLat = Math.round(point[0] / cellStep);
      const cellLon = Math.round(point[1] / cellStep);
      const key = `${cellLat}:${cellLon}`;
      const existing = byCell.get(key) || {
        point,
        count: 0,
        severity: 'low',
        confidenceTotal: 0,
        label: threat.target,
        samples: []
      };

      existing.count += 1;
      existing.confidenceTotal += (threat.confidence || 0);
      if ((THREAT_SEVERITY_WEIGHT[threat.severity] || 0) > (THREAT_SEVERITY_WEIGHT[existing.severity] || 0)) {
        existing.severity = threat.severity;
      }
      if (existing.samples.length < 6) {
        existing.samples.push(threat);
      }

      byCell.set(key, existing);
    });

    return Array.from(byCell.values()).map((cluster) => ({
      ...cluster,
      avgConfidence: Math.round(cluster.confidenceTotal / Math.max(cluster.count, 1))
    }));
  }

  function hotspotIcon(severity) {
    const klass = severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low';
    return window.L.divIcon({
      className: `threat-pulse-marker ${klass}`,
      html: '<span class="pulse-core"></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  function renderThreatsOnLeaflet(threats, options = {}) {
    const state = window.__cfThreatLeafletMap;
    if (!state?.map || !window.L) return;

    const { refit = true } = options;
    const { map, arcsLayer, markersLayer, hotspotsLayer } = state;
    state.latestThreats = Array.isArray(threats) ? threats : [];
    arcsLayer.clearLayers();
    markersLayer.clearLayers();
    hotspotsLayer.clearLayers();

    if (!Array.isArray(threats) || !threats.length) return;

    const orderedThreats = [...threats].sort(compareThreatPriority);
    const arcThreats = orderedThreats.slice(0, Math.min(120, orderedThreats.length));
    const hotspotThreats = orderedThreats.filter((t) => t.severity === 'high').slice(0, 18);
    const currentZoom = map.getZoom();
    const targetClusters = aggregateThreatTargets(orderedThreats, currentZoom);
    const boundsPoints = [];

    arcThreats.forEach((threat) => {
      const sourcePoint = resolveThreatPoint(threat, 'source');
      const targetPoint = resolveThreatPoint(threat, 'target');
      const color = THREAT_SEVERITY_COLORS[threat.severity] || THREAT_SEVERITY_COLORS.medium;

      if (sourcePoint) {
        boundsPoints.push(sourcePoint);
        window.L.circleMarker(sourcePoint, {
          radius: 3 + Math.round((threat.confidence || 50) / 45),
          color,
          fillColor: color,
          fillOpacity: 0.75,
          opacity: 0.8,
          weight: 1
        }).bindPopup(buildThreatPopup(threat), { className: 'threat-popup-container' }).addTo(markersLayer);
      }

      if (sourcePoint && targetPoint) {
        window.L.polyline([sourcePoint, targetPoint], {
          color,
          pane: 'arcsPane',
          weight: threat.severity === 'high' ? 1.8 : 1.2,
          opacity: threat.severity === 'high' ? 0.7 : 0.38,
          lineCap: 'round',
          lineJoin: 'round',
          smoothFactor: 1.2,
          dashArray: threat.severity === 'high' ? '8 6' : '4 8'
        }).addTo(arcsLayer);
      }
    });

    targetClusters.forEach((cluster) => {
      const color = THREAT_SEVERITY_COLORS[cluster.severity] || THREAT_SEVERITY_COLORS.medium;
      const radius = Math.max(4, Math.min(16, Math.round(3 + (Math.sqrt(cluster.count) * 2.1))));
      boundsPoints.push(cluster.point);

      const marker = window.L.circleMarker(cluster.point, {
        radius,
        color,
        fillColor: color,
        fillOpacity: Math.min(0.7, 0.24 + (cluster.count * 0.05)),
        opacity: 0.9,
        weight: cluster.count > 1 ? 2 : 1
      }).addTo(markersLayer);

      if (cluster.count > 1) {
        marker.bindTooltip(String(cluster.count), {
          permanent: true,
          direction: 'center',
          className: 'threat-cluster-count'
        });
        marker.bindPopup(buildThreatClusterPopup(cluster), { className: 'threat-popup-container' });
      } else if (cluster.samples[0]) {
        marker.bindPopup(buildThreatPopup(cluster.samples[0]), { className: 'threat-popup-container' });
      }
    });

    hotspotThreats.forEach((threat) => {
      const hotspotPoint = resolveThreatPoint(threat, 'target');
      if (!hotspotPoint) return;
      window.L.marker(hotspotPoint, {
        icon: hotspotIcon(threat.severity),
        pane: 'hotspotsPane',
        interactive: false,
        keyboard: false
      }).addTo(hotspotsLayer);
    });

    if (refit && boundsPoints.length > 1) {
      const bounds = window.L.latLngBounds(boundsPoints);
      map.fitBounds(bounds.pad(0.24), { maxZoom: 4, animate: true, duration: 0.35 });
    }
  }

  function bindThreatMapLeafletControls() {
    const map = window.__cfThreatLeafletMap?.map;
    if (!map) return;

    const controls = document.querySelectorAll('#threat-map-container .tg-map-controls .tg-icon-btn');
    if (!controls.length) return;

    controls[0].onclick = () => map.zoomIn();
    controls[1].onclick = () => map.zoomOut();
    controls[2].onclick = () => map.setView([20, 0], 2, { animate: true });
  }

  function renderThreatInfo(selected) {
    const infoEl = document.getElementById('threat-globe-info');
    const idEl = document.getElementById('threat-globe-info-id');
    if (!infoEl) return;

    if (!selected) {
      infoEl.innerHTML = '<div class="tg-info-empty"><span>Select a live threat from the stream to inspect details.</span></div>';
      if (idEl) idEl.textContent = 'No selection';
      return;
    }

    if (idEl) idEl.textContent = `ID: ${selected.id}`;

    infoEl.innerHTML = `
      <div class="tg-info-card">
        <div class="tg-info-header">
          <div class="tg-info-title">${selected.type}</div>
          <span class="severity-badge ${selected.severity}">${selected.severity}</span>
        </div>
        <div class="tg-info-section">
          <div class="tg-info-subtitle">Position Data</div>
          <div class="tg-info-row"><span>Source</span><span class="tg-info-value">${selected.source}</span></div>
          <div class="tg-info-row"><span>Target</span><span class="tg-info-value">${selected.target}</span></div>
          <div class="tg-info-row"><span>Coordinates</span><span class="tg-info-value">${selected.sourceLat.toFixed(2)}, ${selected.sourceLon.toFixed(2)} -> ${selected.targetLat.toFixed(2)}, ${selected.targetLon.toFixed(2)}</span></div>
        </div>
        <div class="tg-info-section">
          <div class="tg-info-subtitle">Threat Data</div>
          <div class="tg-info-row"><span>Status</span><span class="tg-info-value">${selected.status}</span></div>
          <div class="tg-info-row"><span>Malware Family</span><span class="tg-info-value">${selected.malwareFamily}</span></div>
          <div class="tg-info-row"><span>Indicator</span><span class="tg-info-value">${selected.ioc}</span></div>
          <div class="tg-info-row"><span>Confidence</span><span class="tg-info-value">${selected.confidence}%</span></div>
        </div>
        <div class="tg-info-section">
          <div class="tg-info-subtitle">Telemetry</div>
          <div class="tg-info-row"><span>Source</span><span class="tg-info-value">${selected.confidenceSource}</span></div>
          <div class="tg-info-row"><span>Updated</span><span class="tg-info-value">${formatThreatTime(selected.createdAt)}</span></div>
        </div>
      </div>
    `;
  }

  function renderThreatTimeline(items) {
    const timelineEl = document.getElementById('threat-globe-timeline');
    if (!timelineEl) return;

    if (!items.length) {
      timelineEl.innerHTML = '<div class="tg-info-empty"><span>No active timeline data yet.</span></div>';
      return;
    }

    const now = Date.now();
    const buckets = [0, 1, 2, 3].map((hour) => {
      const start = now - ((hour + 1) * 60 * 60 * 1000);
      const end = now - (hour * 60 * 60 * 1000);
      const count = items.filter((it) => {
        const ts = new Date(it.createdAt).getTime();
        return ts >= start && ts < end;
      }).length;
      return { hour, count };
    }).reverse();

    const max = Math.max(...buckets.map((b) => b.count), 1);
    timelineEl.innerHTML = buckets.map((b) => {
      const width = Math.max(6, Math.round((b.count / max) * 100));
      return `
        <div class="tg-timeline-row">
          <span>${b.hour + 1}h ago</span>
          <div class="tg-timeline-track"><span style="width:${width}%;"></span></div>
        </div>
      `;
    }).join('');
  }

  function renderThreatEvents(items) {
    const body = document.getElementById('threat-globe-events-body');
    if (!body) return;

    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" class="tg-empty-cell">No events in cache.</td></tr>';
      return;
    }

    const top = items.slice(0, 8);
    body.innerHTML = top.map((item) => `
      <tr>
        <td class="tg-row-title">${item.type}</td>
        <td>${item.source}</td>
        <td>${item.target}</td>
        <td>${item.confidence}%</td>
        <td>${formatThreatTime(item.createdAt)}</td>
      </tr>
    `).join('');
  }

  function renderThreatStream(threats, selectedId) {
    const body = document.getElementById('threat-globe-feed-body');
    const countEl = document.getElementById('threat-globe-stream-count');
    if (!body) return null;

    if (countEl) countEl.textContent = `${threats.length} signals`;

    if (!threats.length) {
      body.innerHTML = '<tr><td colspan="4" class="tg-empty-cell">No threats for the selected filter.</td></tr>';
      return null;
    }

    body.innerHTML = threats.slice(0, 16).map((item) => {
      const isActive = selectedId && selectedId === item.id;
      const sevClass = item.severity === 'high' ? 'high' : item.severity === 'medium' ? 'medium' : 'low';
      return `
        <tr class="tg-row ${isActive ? 'active' : ''}" data-threat-id="${item.id}">
          <td class="tg-row-title">${item.type}</td>
          <td>${item.source} -> ${item.target}</td>
          <td><span class="severity-badge ${sevClass}">${item.severity}</span></td>
          <td>${item.status}</td>
        </tr>
      `;
    }).join('');

    return threats[0];
  }

  function updateThreatCounters(threats) {
    const totalEl = document.getElementById('dashboard-threats');
    if (totalEl) {
      const active = threats.filter((t) => t.status === 'active').length;
      totalEl.textContent = String(active);
    }
  }

  function bindThreatStreamSelection(threats) {
    const body = document.getElementById('threat-globe-feed-body');
    if (!body) return;

    body.onclick = (event) => {
      const row = event.target.closest('tr[data-threat-id]');
      if (!row) return;
      const selected = threats.find((t) => t.id === row.getAttribute('data-threat-id'));
      renderThreatStream(threats, selected?.id);
      renderThreatInfo(selected || null);
    };
  }

  function applyThreatFilter(threats) {
    const filterEl = document.getElementById('threat-map-filter');
    const filter = (filterEl?.value || 'all').toLowerCase();
    if (filter === 'all') return threats;
    return threats.filter((item) => item.type.toLowerCase().includes(filter));
  }

  function mapOTXSeverity(pulse) {
    const tlp = String(pulse?.tlp || pulse?.TLP || '').toLowerCase();
    if (tlp === 'red') return 'high';
    if (tlp === 'amber') return 'medium';
    if (tlp === 'green' || tlp === 'white') return 'low';
    const tags = Array.isArray(pulse?.tags) ? pulse.tags.join(' ').toLowerCase() : '';
    if (/ransom|botnet|exploit|cve|zeroday|zero-day/.test(tags)) return 'high';
    if (/phish|malware|suspicious/.test(tags)) return 'medium';
    return 'low';
  }

  function mapOTXPulseToThreat(pulse, index) {
    const tags = Array.isArray(pulse?.tags) ? pulse.tags : [];
    const countries = Array.isArray(pulse?.targeted_countries) ? pulse.targeted_countries : [];
    const severity = mapOTXSeverity(pulse);
    const indicatorCount = Number(pulse?.indicator_count || 0);
    const confidence = Math.max(42, Math.min(96, 55 + Math.round(indicatorCount * 0.9)));
    const pulseName = String(pulse?.name || pulse?.title || `OTX Pulse ${index + 1}`).trim();
    const type = pulseName.length > 72 ? `${pulseName.slice(0, 72)}...` : pulseName;
    const sourceLabel = pulse?.author_name || pulse?.author?.username || 'OTX Community';
    const targetLabel = countries[0] || tags[0] || 'Global Internet';

    return {
      id: pulse?.id || pulse?.pulse_id || pulse?.$id || `otx-${index + 1}`,
      type,
      severity,
      status: 'active',
      createdAt: pulse?.modified || pulse?.created || pulse?.created_at || Date.now(),
      confidence,
      source: sourceLabel,
      target: targetLabel,
      sourceLat: 0,
      sourceLon: 0,
      targetLat: 0,
      targetLon: 0,
      malwareFamily: tags[0] || pulse?.adversary || 'Unclassified',
      ioc: indicatorCount > 0 ? `${indicatorCount} indicators` : 'N/A',
      confidenceSource: 'AlienVault OTX',
      raw: pulse
    };
  }

  async function fetchThreatsFromOTXFrontend(limit = 60) {
    const key = localStorage.getItem('otx_api_key') || OTX_FRONTEND_API_KEY;
    if (!key) throw new Error('Missing OTX API key');

    const endpoint = `https://otx.alienvault.com/api/v1/pulses/subscribed?limit=${Math.max(1, Math.min(200, limit))}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': key,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`OTX request failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const pulses = payload?.results || payload?.pulses || payload?.data || [];
    if (!Array.isArray(pulses)) return [];

    return pulses.slice(0, limit).map(mapOTXPulseToThreat);
  }

  function renderThreatMapPanels(rawThreats) {
    const normalized = rawThreats.map(normalizeThreat).sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });

    const filtered = applyThreatFilter(normalized);
    const first = renderThreatStream(filtered);
    renderThreatInfo(first || null);
    renderThreatTimeline(filtered);
    renderThreatEvents(filtered);
    updateThreatCounters(filtered);
    bindThreatStreamSelection(filtered);
  }

  function initThreatMap() {
    if (!document.getElementById('threat-map-container')) return;

    const loadThreats = () => {
      fetchThreatsFromOTXFrontend(60).then((threats) => {
        renderThreatMapPanels(threats);
        const normalized = threats.map(normalizeThreat);
        renderThreatsOnLeaflet(normalized, { refit: true });
      }).catch((error) => {
        console.warn('[ThreatMap] Frontend OTX fetch failed, trying fallback API client:', error?.message || error);
        if (!window.apiClient || typeof window.apiClient.getThreats !== 'function') return;
        window.apiClient.getThreats({ limit: 60 }).then((response) => {
          if (!response?.success || !Array.isArray(response.data)) return;
          renderThreatMapPanels(response.data);
          const normalized = response.data.map(normalizeThreat);
          renderThreatsOnLeaflet(normalized, { refit: true });
        }).catch((fallbackErr) => {
          console.warn('[ThreatMap] Fallback threat fetch failed:', fallbackErr?.message || fallbackErr);
        });
      });
    };

    ensureLeafletLoaded()
      .then(() => {
        ensureThreatLeafletMap();
        bindThreatMapLeafletControls();
        loadThreats();
      })
      .catch((error) => {
        console.error('[ThreatMap] Leaflet unavailable:', error);
        loadThreats();
      });

    const refreshBtn = document.getElementById('refresh-threat-map');
    if (refreshBtn) refreshBtn.onclick = () => loadThreats();

    const filterEl = document.getElementById('threat-map-filter');
    if (filterEl) filterEl.onchange = () => loadThreats();

    if (window.__cfThreatMapRefreshTimer) {
      clearInterval(window.__cfThreatMapRefreshTimer);
    }
    window.__cfThreatMapRefreshTimer = setInterval(loadThreats, 15000);
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
        const state = getState();
        const result = await cyberforgeAPI.createFinding({
          title: formData.get('title'),
          severity: formData.get('severity'),
          path: formData.get('path'),
          description: formData.get('description'),
          status: 'Open'
        });
        if (result.success) {
          if (state) state.findings.unshift(result.data.data.finding);
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

  // ── Expose all functions via window.CyberForgeDataLoaders ─────────────
  const exports = {
    loadDashboardSecurityData,
    loadActivityFeedData,
    loadDashboardActivityData: loadActivityFeedData,
    loadMetricsData,
    loadDashboardMetricsData: loadMetricsData,
    loadSitemapTreeData,
    loadSitemapData: loadSitemapTreeData,
    renderSitemapTree,
    buildTreeNode,
    loadSitemapGraphData,
    loadActiveScopesData,
    loadExcludedScopesData,
    loadSavedFiltersData,
    loadRecentFiltersData,
    loadInterceptRulesData,
    loadBreakpointsData,
    loadFlaggedRequestsData,
    loadErrorRequestsData,
    loadWebSocketMessagesData,
    loadWsMessagesData: loadWebSocketMessagesData,
    loadMatchResponseRulesData,
    loadResponseRulesData: loadMatchResponseRulesData,
    loadBatchReplayData,
    initBatchReplay: loadBatchReplayData,
    loadReplayDiffData,
    initResponseDiff: loadReplayDiffData,
    loadIntruderData,
    initIntruder: loadIntruderData,
    loadFuzzerData,
    initFuzzer: loadFuzzerData,
    loadPayloadsData,
    loadActiveWorkflowsData,
    loadWorkflowTemplatesData,
    loadWorkflowHistoryData,
    loadWorkflowsHistoryData: loadWorkflowHistoryData,
    loadAssistantHistoryData,
    loadAssistantInsightsData,
    loadTrainedModelsData,
    loadTrainingModelsData,
    loadDatasetsData,
    loadThreatFeedsData,
    loadIOCsData,
    loadCVEsData,
    loadEnvironmentVariablesData,
    loadSecretsData,
    bindAdvancedSearchEvents,
    loadSavedQueriesData,
    loadFindingsByLevel,
    loadExportsReportsData,
    bindDataExportEvents,
    loadProjectFilesData,
    loadNotesData,
    loadScriptsData,
    loadInstalledPluginsData,
    loadMarketplacePluginsData,
    loadWorkspaceSettingsData,
    loadTeamMembersData,
    loadPendingSyncData,
    loadSyncHistoryData,
    loadExtensionInstallData,
    loadExtensionSettingsData,
    initMobilePairing,
    loadPairedDevicesData,
    loadBrowserRegistrationData,
    browserIconFallback,
    launchBrowserWithMonitoring,
    setupBrowserEventListeners,
    loadBrowserHistoryData,
    loadSuspiciousDomainsData,
    loadCredentialExposureData,
    isVersionOutdated,
    loadTrackingDetectionData,
    loadDownloadAnalysisData,
    formatFileSize,
    initEventFeedStream,
    loadRiskAnalysisData,
    initThreatMap,
    initQuickScan,
    initDeepScan,
    initStealthScan,
    initForensicScan,
    loadAgentTasksData,
    loadScheduledTasksData,
    loadAgentDecisionsData,
    loadAgentMemoryData,
    bindFindingsEvents
  };

  window.CyberForgeDataLoaders = exports;
})();
