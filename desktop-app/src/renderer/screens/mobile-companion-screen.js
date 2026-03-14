// CyberForge Mobile Companion Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:MobileCompanion] Could not require api-client.js:', error?.message || error);
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

  function buildMobileCompanionLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Mobile Companion</div>
        </div>
        <div class="cf-panel-content" style="padding:24px;">
          <div style="text-align:center; max-width:400px; margin:0 auto;">
            <i class="fas fa-mobile-alt" style="font-size:48px; color:var(--cf-accent-purple); margin-bottom:16px;"></i>
            <h3>Connect Mobile Device</h3>
            <p style="color:var(--cf-text-muted); margin-bottom:24px;">Scan the QR code with the Cyberforge mobile app to connect your device.</p>
            <div style="background:white; width:150px; height:150px; margin:0 auto 24px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-qrcode" style="font-size:80px; color:#333;"></i>
            </div>
            <p style="font-size:12px; color:var(--cf-text-muted);">Or enter code: <strong>CYBER-1234-FORGE</strong></p>
          </div>
        </div>
      </div>
    `;
  }

  window.CyberForgeMobileCompanion = { buildMobileCompanionLayout };
})();
