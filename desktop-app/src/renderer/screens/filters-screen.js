// CyberForge Filters Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Filters] Could not require api-client.js:', error?.message || error);
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

  function buildFiltersLayout() {
    const filtersHtml = state.filters.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-filter empty-state-icon"></i>
        <div class="empty-state-title">No filters defined</div>
        <div class="empty-state-description">Create filters to hide or show specific traffic</div>
      </div>
    ` : state.filters.map(filter => `
      <div class="filter-card" data-id="${filter.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <label class="switch">
            <input type="checkbox" class="filter-toggle" data-id="${filter.id}" ${filter.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <div style="flex:1;">
            <div style="font-weight:600;">${filter.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">${filter.pattern || filter.description || 'No pattern'}</div>
          </div>
          <button class="cf-btn filter-edit" data-id="${filter.id}"><i class="fas fa-edit"></i></button>
          <button class="cf-btn filter-delete" data-id="${filter.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Filters</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-filter"><i class="fas fa-plus"></i> New Filter</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="filters-container" style="display:flex; flex-direction:column; gap:12px;">
            ${filtersHtml}
          </div>
        </div>
      </div>
    `;
  }

  function bindFiltersEvents() {
    document.getElementById('new-filter')?.addEventListener('click', () => {
      showModal('Create Filter', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="Hide Image Requests" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Pattern (regex)</label>
            <input class="cf-input" name="pattern" placeholder="\\.(png|jpg|gif|svg)$" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="hide">Hide matching</option>
              <option value="show">Show only matching</option>
            </select>
          </div>
          <div>
            <label><input type="checkbox" name="enabled" checked> Enable filter</label>
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createFilter({
          name: formData.get('name'),
          pattern: formData.get('pattern'),
          type: formData.get('type'),
          enabled: formData.get('enabled') === 'on'
        });
        if (result.success) {
          state.filters.unshift(result.data.data.filter);
          showToast('success', 'Created', 'Filter created successfully');
          renderScreen('filters');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create filter');
        }
      });
    });

    document.querySelectorAll('.filter-toggle').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.id;
        const result = await cyberforgeAPI.toggleFilter(id);
        if (result.success) {
          const filter = state.filters.find(f => f.id === id);
          if (filter) filter.enabled = !filter.enabled;
          showToast('success', 'Updated', `Filter ${filter?.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    });

    document.querySelectorAll('.filter-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Filter', 'Are you sure you want to delete this filter?', async () => {
          const result = await cyberforgeAPI.deleteFilter(id);
          if (result.success) {
            state.filters = state.filters.filter(f => f.id !== id);
            showToast('success', 'Deleted', 'Filter removed');
            renderScreen('filters');
          }
        });
      });
    });
  }

  window.CyberForgeFilters = { buildFiltersLayout, bindFiltersEvents };
})();
