// CyberForge Profile Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Profile] Could not require api-client.js:', error?.message || error);
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

  function buildProfileLayout() {
    const user = cyberforgeAPI.getCurrentUser();
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Profile</div>
        </div>
        <div class="cf-panel-content" style="padding:24px; max-width:600px;">
          <div style="display:flex; align-items:center; gap:20px; margin-bottom:32px;">
            <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg, var(--cf-accent-orange), var(--cf-accent-orange-dim));display:flex;align-items:center;justify-content:center;">
              <i class="fas fa-user" style="font-size:32px; color:white;"></i>
            </div>
            <div>
              <h2>${user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'User'}</h2>
              <p style="color:var(--cf-text-muted);">${user?.email || ''}</p>
              <span class="cf-badge blue">${user?.role || 'User'}</span>
            </div>
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">First Name</label>
            <input class="cf-input" value="${user?.firstName || ''}" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Last Name</label>
            <input class="cf-input" value="${user?.lastName || ''}" style="width:100%;">
          </div>
          <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:600; margin-bottom:8px;">Email</label>
            <input class="cf-input" value="${user?.email || ''}" disabled style="width:100%; opacity:0.7;">
          </div>
          <button class="cf-btn primary"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </div>
    `;
  }

  window.CyberForgeProfile = { buildProfileLayout };
})();
