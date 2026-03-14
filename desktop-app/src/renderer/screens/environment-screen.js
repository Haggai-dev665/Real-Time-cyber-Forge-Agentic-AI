// CyberForge Environment Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Environment] Could not require api-client.js:', error?.message || error);
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

  function buildEnvironmentLayout() {
    const envHtml = state.environment.length === 0 ? `
      <tr><td colspan="4" style="text-align:center; padding:24px; color:var(--cf-text-muted);">No environment variables defined</td></tr>
    ` : state.environment.map(env => `
      <tr data-id="${env.id}">
        <td><code>${env.name}</code></td>
        <td><code>${env.secret ? '••••••••••••' : env.value}</code></td>
        <td><span class="cf-badge ${env.scope === 'global' ? 'blue' : env.scope === 'session' ? 'orange' : 'purple'}">${env.scope || 'Global'}</span></td>
        <td>
          <button class="panel-action-btn env-edit" data-id="${env.id}"><i class="fas fa-edit"></i></button>
          <button class="panel-action-btn env-delete" data-id="${env.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Environment Variables</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-variable"><i class="fas fa-plus"></i> Add Variable</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div class="cf-table-container">
            <table class="cf-table">
              <thead><tr><th>Name</th><th>Value</th><th>Scope</th><th>Actions</th></tr></thead>
              <tbody id="env-tbody">
                ${envHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function bindEnvironmentEvents() {
    document.getElementById('add-variable')?.addEventListener('click', () => {
      showModal('Add Environment Variable', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="API_KEY" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Value</label>
            <input class="cf-input" name="value" placeholder="your-secret-value" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Scope</label>
            <select class="cf-input" name="scope" style="width:100%;">
              <option value="global">Global</option>
              <option value="session">Session</option>
              <option value="workspace">Workspace</option>
            </select>
          </div>
          <div>
            <label><input type="checkbox" name="secret"> Secret (hide value)</label>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.setEnvironmentVariable(
          formData.get('name'),
          formData.get('value'),
          formData.get('scope')
        );
        if (result.success) {
          state.environment.push({
            id: result.data.data?.id || Date.now().toString(),
            name: formData.get('name'),
            value: formData.get('value'),
            scope: formData.get('scope'),
            secret: formData.get('secret') === 'on'
          });
          showToast('success', 'Created', 'Variable added successfully');
          renderScreen('environment');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add variable');
        }
      });
    });

    document.querySelectorAll('.env-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const env = state.environment.find(e => e.id === id);
        showConfirmModal('Delete Variable', `Are you sure you want to delete ${env?.name}?`, async () => {
          const result = await cyberforgeAPI.deleteEnvironmentVariable(env?.name);
          if (result.success) {
            state.environment = state.environment.filter(e => e.id !== id);
            showToast('success', 'Deleted', 'Variable removed');
            renderScreen('environment');
          }
        });
      });
    });
  }

  window.CyberForgeEnvironment = { buildEnvironmentLayout, bindEnvironmentEvents };
})();
