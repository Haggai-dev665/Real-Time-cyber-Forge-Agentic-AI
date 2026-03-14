// CyberForge AI Models Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:AIModels] Could not require api-client.js:', error?.message || error);
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

  function bindAIModelsEvents() {
    // Test AI model buttons
    document.querySelectorAll('.cf-btn.primary').forEach(btn => {
      if (btn.textContent.includes('Test')) {
        btn.addEventListener('click', async () => {
          showToast('info', 'Testing', 'Running AI model test...');
          try {
            const result = await cyberforgeAPI.chatWithAI('Test: Analyze a sample HTTP request for security issues', [], { source: 'model-test' });
            if (result.success) {
              showToast('success', 'Model Online', 'AI model is responding correctly');
            } else {
              showToast('error', 'Test Failed', result.error || 'Model not responding');
            }
          } catch (error) {
            showToast('error', 'Connection Error', error.message);
          }
        });
      }
    });
  }

  function buildAIModelsLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">AI Models</div>
          <div class="cf-panel-actions">
            <button class="cf-btn"><i class="fas fa-sync"></i> Refresh Status</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:20px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <div style="width:48px;height:48px;background:linear-gradient(135deg, #4285f4, #34a853);border-radius:12px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-brain" style="color:white; font-size:20px;"></i></div>
                <div>
                  <div style="font-weight:600;">Gemini Pro</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">Google AI</div>
                </div>
                <span class="cf-badge green" style="margin-left:auto;">Active</span>
              </div>
              <div style="font-size:13px; color:var(--cf-text-secondary); margin-bottom:12px;">Primary AI model for security analysis and threat detection.</div>
              <div style="display:flex; gap:8px;">
                <button class="cf-btn" style="flex:1;"><i class="fas fa-cog"></i> Configure</button>
                <button class="cf-btn primary" style="flex:1;"><i class="fas fa-play"></i> Test</button>
              </div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:12px; padding:20px;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <div style="width:48px;height:48px;background:linear-gradient(135deg, #764ba2, #667eea);border-radius:12px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-network-wired" style="color:white; font-size:20px;"></i></div>
                <div>
                  <div style="font-weight:600;">Threat Detector</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">Custom ML</div>
                </div>
                <span class="cf-badge green" style="margin-left:auto;">Active</span>
              </div>
              <div style="font-size:13px; color:var(--cf-text-secondary); margin-bottom:12px;">Custom trained model for malware and intrusion detection.</div>
              <div style="display:flex; gap:8px;">
                <button class="cf-btn" style="flex:1;"><i class="fas fa-cog"></i> Configure</button>
                <button class="cf-btn primary" style="flex:1;"><i class="fas fa-play"></i> Test</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.CyberForgeAIModels = { buildAIModelsLayout, bindAIModelsEvents };
})();
