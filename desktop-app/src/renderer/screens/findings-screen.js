// CyberForge Findings Screen
// Extracted from cyberforge-app.js — findings layout, renderer, and event binders.

(() => {
  // =========================================
  // API PROXY
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Findings] Could not require api-client.js, falling back to window API:', error?.message || error);
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
  // STYLES
  // =========================================

  function injectFindingsStyles() {
    if (document.getElementById('cf-findings-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-findings-styles';
    style.textContent = `/* Findings screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // UTILITIES
  // =========================================

  function severityColor(sev) {
    const s = sev.toLowerCase();
    if (s === 'high' || s === 'critical') return 'red';
    if (s === 'medium') return 'orange';
    return 'green';
  }

  // =========================================
  // LAYOUT
  // =========================================

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

  // =========================================
  // EVENT BINDERS
  // =========================================

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

  // =========================================
  // RENDERER
  // =========================================

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

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeFindings = {
    injectFindingsStyles,
    buildFindingsLayout,
    bindFindingsEvents,
    renderFindings,
    severityColor
  };
})();
