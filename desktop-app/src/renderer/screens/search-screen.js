// CyberForge Search Screen
// Extracted from cyberforge-app.js — search layout builder.

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
      console.warn('[CyberForge:Search] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  function injectSearchStyles() {
    if (document.getElementById('cf-search-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-search-styles';
    style.textContent = `/* Search screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT
  // =========================================

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

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgeSearch = {
    injectSearchStyles,
    buildSearchLayout
  };
})();
