// CyberForge Scopes Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Scopes] Could not require api-client.js:', error?.message || error);
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

  function buildScopesLayout() {
    const scopesHtml = state.scopes.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-crosshairs empty-state-icon"></i>
        <div class="empty-state-title">No scopes defined</div>
        <div class="empty-state-description">Add scopes to define which targets to include or exclude</div>
      </div>
    ` : state.scopes.map(scope => `
      <div class="scope-card" data-id="${scope.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-accent-${scope.type === 'include' ? 'green' : 'red'}); border-radius:8px; padding:16px; display:flex; align-items:center; gap:12px;">
        <i class="fas fa-${scope.type === 'include' ? 'check' : 'times'}-circle" style="color:var(--cf-accent-${scope.type === 'include' ? 'green' : 'red'}); font-size:20px;"></i>
        <div style="flex:1;">
          <div style="font-weight:600;">${scope.pattern}</div>
          <div style="font-size:11px; color:var(--cf-text-muted);">${scope.type === 'include' ? 'In Scope' : 'Out of Scope'} • ${scope.matchCount || 0} matches</div>
        </div>
        <button class="cf-btn scope-edit" data-id="${scope.id}"><i class="fas fa-edit"></i></button>
        <button class="cf-btn scope-delete" data-id="${scope.id}"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Scopes</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="add-scope"><i class="fas fa-plus"></i> Add Scope</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="scopes-container" style="display:flex; flex-direction:column; gap:12px;">
            ${scopesHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindScopesEvents() {
    document.getElementById('add-scope')?.addEventListener('click', () => {
      showModal('Add Scope', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Pattern</label>
            <input class="cf-input" name="pattern" placeholder="*.example.com" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="include">Include (In Scope)</option>
              <option value="exclude">Exclude (Out of Scope)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <input class="cf-input" name="description" placeholder="Optional description" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createScope({
          pattern: formData.get('pattern'),
          type: formData.get('type'),
          description: formData.get('description')
        });
        if (result.success) {
          state.scopes.unshift(result.data.data.scope);
          showToast('success', 'Created', 'Scope added successfully');
          renderScreen('scopes');
        } else {
          showToast('error', 'Error', result.error || 'Failed to add scope');
        }
      });
    });

    document.querySelectorAll('.scope-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Scope', 'Are you sure you want to delete this scope?', async () => {
          const result = await cyberforgeAPI.deleteScope(id);
          if (result.success) {
            state.scopes = state.scopes.filter(s => s.id !== id);
            showToast('success', 'Deleted', 'Scope removed');
            renderScreen('scopes');
          }
        });
      });
    });
  }

  window.CyberForgeScopes = { buildScopesLayout, bindScopesEvents };
})();
