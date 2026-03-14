// CyberForge Exports Screen
// Extracted from cyberforge-app.js — exports layout builder and event binders.

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
      console.warn('[CyberForge:Exports] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  function injectExportsStyles() {
    if (document.getElementById('cf-exports-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-exports-styles';
    style.textContent = `/* Exports screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT
  // =========================================

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

  // =========================================
  // EVENT BINDERS
  // =========================================

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

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeExports = {
    injectExportsStyles,
    buildExportsLayout,
    bindExportsEvents
  };
})();
