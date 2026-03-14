// CyberForge Settings Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Settings] Could not require api-client.js:', error?.message || error);
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

  function buildSettingsLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Settings</div>
        </div>
        <div class="cf-panel-content" style="padding:24px; max-width:600px;">
          <h3 style="margin-bottom:16px;">Appearance</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div>
                <div style="font-weight:600;">Dark Mode</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Use dark theme</div>
              </div>
              <label class="switch"><input type="checkbox" id="setting-dark-mode"><span class="slider"></span></label>
            </div>
          </div>
          
          <h3 style="margin-bottom:16px;">Notifications</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div>
                <div style="font-weight:600;">Threat Alerts</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Show notifications for new threats</div>
              </div>
              <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div>
                <div style="font-weight:600;">Sound Effects</div>
                <div style="font-size:12px; color:var(--cf-text-muted);">Play sounds for alerts</div>
              </div>
              <label class="switch"><input type="checkbox"><span class="slider"></span></label>
            </div>
          </div>
          
          <h3 style="margin-bottom:16px;">Security</h3>
          <div style="margin-bottom:24px; background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
            <button class="cf-btn" style="width:100%; margin-bottom:8px;"><i class="fas fa-key"></i> Change Password</button>
            <button class="cf-btn" style="width:100%;"><i class="fas fa-shield-alt"></i> Two-Factor Authentication</button>
          </div>
          
          <button class="cf-btn primary"><i class="fas fa-save"></i> Save Settings</button>
        </div>
      </div>
    `;
  }

  window.CyberForgeSettings = { buildSettingsLayout };
})();
