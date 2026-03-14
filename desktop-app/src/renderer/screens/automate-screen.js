// CyberForge Automate Screen
// Extracted from cyberforge-app.js — layout builder and event binder
// for the Automate screen.

(() => {
  // =========================================
  // API PROXY (same resilient pattern)
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Automate] Could not require api-client.js, falling back to window API:', error?.message || error);
    }
  }

  function resolveAPIClient() {
    return importedAPI || window.cyberforgeAPI || window.apiClient || null;
  }

  const cyberforgeAPI = new Proxy({}, {
    get(_target, prop) {
      const api = resolveAPIClient();
      const value = api?.[prop];
      if (typeof value === 'function') {
        return value.bind(api);
      }
      return value;
    }
  });

  // =========================================
  // SHARED REFERENCE HELPERS
  // =========================================

  const state = new Proxy({}, {
    get(_, prop) {
      const s = window.CyberForgeApp?.state;
      return s ? s[prop] : undefined;
    },
    set(_, prop, value) {
      const s = window.CyberForgeApp?.state;
      if (s) s[prop] = value;
      return true;
    }
  });

  const showToast = (...args) => window.CyberForgeToast?.showToast?.(...args);
  const showModal = (...args) => window.CyberForgeModal?.showModal?.(...args);
  const showConfirmModal = (...args) => window.CyberForgeModal?.showConfirmModal?.(...args);
  const renderScreen = (...args) => window.CyberForgeApp?.renderScreen?.(...args);
  const switchScreen = renderScreen;

  // =========================================
  // STYLE INJECTION
  // =========================================

  function injectAutomateStyles() {
    if (document.getElementById('cf-automate-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-automate-styles';
    style.textContent = `
      .automation-card {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .automation-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      }
    `;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT BUILDER
  // =========================================

  function buildAutomateLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Automate</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-automation"><i class="fas fa-plus"></i> New Job</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div class="automation-grid" id="automations-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            ${state.automations.length === 0 ? `
              <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-robot empty-state-icon"></i>
                <div class="empty-state-title">No automations yet</div>
                <div class="empty-state-description">Create your first automation to run scheduled tasks</div>
              </div>
            ` : state.automations.map(auto => `
              <div class="automation-card" data-id="${auto.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                  <i class="fas fa-${auto.type === 'scheduled' ? 'clock' : 'robot'}" style="color:var(--cf-accent-${auto.status === 'active' ? 'blue' : 'orange'});"></i>
                  <div>
                    <div style="font-weight:600;">${auto.name}</div>
                    <div style="font-size:11px; color:var(--cf-text-muted);">${auto.schedule || auto.trigger || 'Manual'}</div>
                  </div>
                  <span class="cf-badge ${auto.status === 'active' ? 'green' : 'orange'}" style="margin-left:auto;">${auto.status}</span>
                </div>
                <div style="font-size:12px; color:var(--cf-text-secondary); margin-bottom:12px;">${auto.description || 'No description'}</div>
                <div style="display:flex; gap:8px;">
                  <button class="cf-btn automation-run" data-id="${auto.id}"><i class="fas fa-play"></i> Run</button>
                  <button class="cf-btn automation-pause" data-id="${auto.id}"><i class="fas fa-${auto.status === 'active' ? 'pause' : 'play'}"></i></button>
                  <button class="cf-btn automation-delete" data-id="${auto.id}"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // EVENT BINDER
  // =========================================

  function bindAutomationsEvents() {
    // New automation button
    document.getElementById('new-automation')?.addEventListener('click', () => {
      showModal('Create Automation', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="My Automation" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="scheduled">Scheduled</option>
              <option value="triggered">Triggered</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Schedule/Trigger</label>
            <input class="cf-input" name="schedule" placeholder="Every 6 hours / On new endpoint" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <textarea class="cf-input" name="description" rows="3" placeholder="What does this automation do?" style="width:100%;"></textarea>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Target URL (optional)</label>
            <input class="cf-input" name="target" placeholder="https://example.com" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const result = await cyberforgeAPI.createAutomation({
          name: formData.get('name'),
          type: formData.get('type'),
          schedule: formData.get('schedule'),
          description: formData.get('description'),
          target: formData.get('target'),
          status: 'active'
        });
        if (result.success) {
          state.automations.unshift(result.data.data.automation);
          showToast('success', 'Created', 'Automation created successfully');
          switchScreen('automate');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create automation');
        }
      });
    });

    // Run, pause, delete handlers
    document.querySelectorAll('.automation-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.runAutomation(id);
        if (result.success) {
          showToast('success', 'Running', 'Automation started');
        } else {
          showToast('error', 'Error', result.error || 'Failed to run automation');
        }
      });
    });

    document.querySelectorAll('.automation-pause').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const auto = state.automations.find(a => a.id === id);
        const newStatus = auto?.status === 'active' ? 'paused' : 'active';
        const result = await cyberforgeAPI.updateAutomation(id, { status: newStatus });
        if (result.success) {
          auto.status = newStatus;
          showToast('success', 'Updated', `Automation ${newStatus}`);
          switchScreen('automate');
        }
      });
    });

    document.querySelectorAll('.automation-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Automation', 'Are you sure you want to delete this automation?', async () => {
          const result = await cyberforgeAPI.deleteAutomation(id);
          if (result.success) {
            state.automations = state.automations.filter(a => a.id !== id);
            showToast('success', 'Deleted', 'Automation deleted');
            switchScreen('automate');
          }
        });
      });
    });
  }

  // =========================================
  // EXPOSE
  // =========================================

  window.CyberForgeAutomate = {
    injectAutomateStyles,
    buildAutomateLayout,
    bindAutomationsEvents
  };
})();
