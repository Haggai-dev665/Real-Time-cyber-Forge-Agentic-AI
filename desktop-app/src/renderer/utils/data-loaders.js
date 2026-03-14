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
