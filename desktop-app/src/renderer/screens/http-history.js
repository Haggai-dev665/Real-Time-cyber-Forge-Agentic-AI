// CyberForge HTTP History Screen
// Extracted from cyberforge-app.js — layout builders, renderers, and event binders
// for the HTTP History, Intercept, WebSocket, Match & Replace, and Replay screens.

(() => {
  // =========================================
  // API PROXY (same resilient pattern)
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:HttpHistory] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  // =========================================
  // SHARED REFERENCE HELPERS
  // =========================================

  // Proxy to the main app state so mutations propagate
  const state = new Proxy({}, {
    get(_, prop) {
      const s = window.CyberForgeApp?.state;
      return s ? s[prop] : undefined;
    },
    set(_, prop, value) {
      const s = window.CyberForgeApp?.state;
      if (s) s[prop] = value;
      return true;
    }
  });

  const showToast = (...args) => window.CyberForgeToast?.showToast?.(...args);
  const showModal = (...args) => window.CyberForgeModal?.showModal?.(...args);
  const showConfirmModal = (...args) => window.CyberForgeModal?.showConfirmModal?.(...args);
  const renderScreen = (...args) => window.CyberForgeApp?.renderScreen?.(...args);

  // =========================================
  // STYLE INJECTION
  // =========================================

  function injectHttpHistoryStyles() {
    if (document.getElementById('cf-http-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-http-history-styles';
    style.textContent = `
      /* Split-pane layout */
      .cf-split-horizontal {
        display: flex;
        flex-direction: row;
        height: 100%;
        overflow: hidden;
      }

      /* Resizer handle */
      .cf-resizer {
        width: 4px;
        cursor: col-resize;
        background: var(--cf-border, #2a2a3a);
        flex-shrink: 0;
        transition: background 0.15s;
      }
      .cf-resizer:hover,
      .cf-resizer:active {
        background: var(--cf-accent, #00d4ff);
      }

      /* Table container */
      .cf-table-container {
        overflow: auto;
        flex: 1;
      }

      /* Table base */
      .cf-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .cf-table thead th {
        position: sticky;
        top: 0;
        background: var(--cf-bg-secondary, #1a1a2e);
        padding: 8px 12px;
        text-align: left;
        font-weight: 600;
        border-bottom: 1px solid var(--cf-border, #2a2a3a);
        white-space: nowrap;
        z-index: 1;
      }
      .cf-table tbody tr {
        cursor: pointer;
        transition: background 0.12s;
      }
      .cf-table tbody tr:hover {
        background: var(--cf-bg-hover, rgba(255,255,255,0.04));
      }
      .cf-table tbody tr.selected {
        background: var(--cf-accent-bg, rgba(0,212,255,0.08));
      }
      .cf-table td {
        padding: 6px 12px;
        border-bottom: 1px solid var(--cf-border, #2a2a3a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 260px;
      }

      /* Method badges */
      .method-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .method-badge.get    { background: rgba(0,200,83,0.15); color: #00c853; }
      .method-badge.post   { background: rgba(33,150,243,0.15); color: #2196f3; }
      .method-badge.put    { background: rgba(255,152,0,0.15); color: #ff9800; }
      .method-badge.delete { background: rgba(244,67,54,0.15); color: #f44336; }
      .method-badge.patch  { background: rgba(156,39,176,0.15); color: #9c27b0; }

      /* Panel chrome */
      .cf-panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .cf-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid var(--cf-border, #2a2a3a);
        flex-shrink: 0;
      }
      .cf-panel-title {
        font-weight: 600;
        font-size: 14px;
      }
      .cf-panel-actions {
        display: flex;
        gap: 8px;
      }
      .cf-panel-content {
        flex: 1;
        overflow: auto;
      }

      /* Empty state */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        color: var(--cf-text-muted, #888);
        text-align: center;
      }
      .empty-state-icon {
        font-size: 36px;
        margin-bottom: 16px;
        opacity: 0.4;
      }
      .empty-state-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .empty-state-description {
        font-size: 13px;
      }

      /* Request detail viewer */
      .request-viewer {
        padding: 12px;
      }
      .request-info {
        margin-bottom: 16px;
      }
      .request-url {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
      }
      .request-url-text {
        word-break: break-all;
        color: var(--cf-text-secondary, #aaa);
      }
      .request-meta {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--cf-text-muted, #888);
      }
      .request-headers {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 12px;
        line-height: 1.6;
      }
      .header-line {
        padding: 1px 0;
      }
      .header-line.first-line {
        font-weight: 600;
        color: var(--cf-accent, #00d4ff);
      }
      .header-name {
        color: var(--cf-text-secondary, #aaa);
      }
      .header-value {
        color: var(--cf-text, #eee);
        margin-left: 4px;
      }

      /* Toggle switch for match-replace rules */
      .switch {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 18px;
      }
      .switch input { opacity: 0; width: 0; height: 0; }
      .switch .slider {
        position: absolute;
        inset: 0;
        background: var(--cf-bg-tertiary, #333);
        border-radius: 18px;
        transition: background 0.2s;
        cursor: pointer;
      }
      .switch .slider::before {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        left: 2px;
        bottom: 2px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      .switch input:checked + .slider {
        background: var(--cf-accent, #00d4ff);
      }
      .switch input:checked + .slider::before {
        transform: translateX(16px);
      }
    `;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT BUILDERS
  // =========================================

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

  // =========================================
  // RENDERERS
  // =========================================

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

  // =========================================
  // EVENT BINDERS
  // =========================================

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

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeHttpHistory = {
    injectHttpHistoryStyles,
    // Layout builders
    buildHttpHistoryLayout,
    buildInterceptLayout,
    buildWsLayout,
    buildMatchReplaceLayout,
    buildReplayLayout,
    // Event binders
    bindMatchReplaceEvents,
    bindRequestTableEvents,
    bindResizer,
    bindContextMenu,
    bindInterceptEvents,
    // Renderers
    renderRequestsTable,
    renderRequestDetail,
    renderIntercepts,
    renderWsHistory,
    renderMatchRules,
    renderFiles,
    // Utilities
    severityColor
  };
})();
