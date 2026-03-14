// CyberForge Browser Extension Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:BrowserExtension] Could not require api-client.js:', error?.message || error);
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

  function buildBrowserExtensionLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Browser Extension</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; max-width:400px; margin:0 auto;">
            <i class="fas fa-puzzle-piece" style="font-size:48px; color:var(--cf-accent-blue); margin-bottom:16px;"></i>
            <h3>Install Browser Extension</h3>
            <p style="color:var(--cf-text-muted); margin-bottom:24px;">Capture browser traffic directly and send it to Cyberforge for analysis.</p>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button class="cf-btn"><i class="fab fa-chrome"></i> Chrome</button>
              <button class="cf-btn"><i class="fab fa-firefox"></i> Firefox</button>
              <button class="cf-btn"><i class="fab fa-edge"></i> Edge</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.CyberForgeBrowserExtension = { buildBrowserExtensionLayout };
})();
