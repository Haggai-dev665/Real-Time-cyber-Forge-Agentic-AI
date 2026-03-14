// CyberForge Workspace Screen
// Extracted from cyberforge-app.js — workspace settings layout builder.

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
      console.warn('[CyberForge:Workspace] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  function injectWorkspaceStyles() {
    if (document.getElementById('cf-workspace-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-workspace-styles';
    style.textContent = `/* Workspace screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT
  // =========================================

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

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeWorkspace = {
    injectWorkspaceStyles,
    buildWorkspaceLayout
  };
})();
