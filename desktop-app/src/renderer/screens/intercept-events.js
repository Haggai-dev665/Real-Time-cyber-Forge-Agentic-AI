// CyberForge Intercept Events
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:InterceptEvents] Could not require api-client.js:', error?.message || error);
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

  // Additional bind functions for remaining screens
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

  window.CyberForgeInterceptEvents = { bindInterceptEvents };
})();
