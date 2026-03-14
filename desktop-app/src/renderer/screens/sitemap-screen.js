// CyberForge Sitemap Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Sitemap] Could not require api-client.js:', error?.message || error);
    }
  }

  function resolveAPIClient() {
    return importedAPI || window.cyberforgeAPI || window.apiClient || null;
  }

  const cyberforgeAPI = new Proxy({}, {
    get(_target, prop) {
      const api = resolveAPIClient();
      const value = api?.[prop];
      if (typeof value === 'function') return value.bind(api);
      return value;
    }
  });

  const state = new Proxy({}, {
    get(_, p) { return window.CyberForgeApp?.state?.[p]; },
    set(_, p, v) { if (window.CyberForgeApp?.state) window.CyberForgeApp.state[p] = v; return true; }
  });
  const agentState = new Proxy({}, {
    get(_, p) { return window.CyberForgeApp?.agentState?.[p]; },
    set(_, p, v) { if (window.CyberForgeApp?.agentState) window.CyberForgeApp.agentState[p] = v; return true; }
  });
  function showToast(...a) { return window.CyberForgeToast?.showToast?.(...a); }
  function showModal(...a) { return window.CyberForgeModal?.showModal?.(...a); }
  function showConfirmModal(...a) { return window.CyberForgeModal?.showConfirmModal?.(...a); }
  function renderScreen(s) { return window.CyberForgeApp?.renderScreen?.(s); }
  function renderIntercepts() { return window.CyberForgeHttpHistory?.renderIntercepts?.(); }
  function appendAgentConsole(...a) { return window.CyberForgeApp?.appendAgentConsole?.(...a); }
  function resolveCurrentUserId() { return window.CyberForgeApp?.resolveCurrentUserId?.(); }

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

  window.CyberForgeSitemap = { buildSitemapLayout, bindSitemapEvents };
})();
