// CyberForge Sync Status Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:SyncStatus] Could not require api-client.js:', error?.message || error);
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

  function buildSyncStatusLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Sync Status</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; margin-bottom:24px;">
            <i class="fas fa-cloud-upload-alt" style="font-size:48px; color:var(--cf-accent-green); margin-bottom:16px;"></i>
            <h3>All Synced</h3>
            <p style="color:var(--cf-text-muted);">Your workspace is up to date with the cloud.</p>
          </div>
          <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span>Last sync:</span>
              <span style="color:var(--cf-text-muted);">2 minutes ago</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <span>Pending changes:</span>
              <span style="color:var(--cf-accent-green);">0</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Sync mode:</span>
              <span>Automatic</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.CyberForgeSyncStatus = { buildSyncStatusLayout };
})();
