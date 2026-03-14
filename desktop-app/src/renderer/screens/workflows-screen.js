// CyberForge Workflows Screen
// Extracted from cyberforge-app.js — layout builder and event binder
// for the Workflows screen.

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
      console.warn('[CyberForge:Workflows] Could not require api-client.js, falling back to window API:', error?.message || error);
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

  // =========================================
  // STYLE INJECTION
  // =========================================

  function injectWorkflowsStyles() {
    if (document.getElementById('cf-workflows-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-workflows-styles';
    style.textContent = `
      .workflow-card {
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .workflow-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      }
    `;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT BUILDER
  // =========================================

  function buildWorkflowsLayout() {
    const workflowsHtml = state.workflows.length === 0 ? `
      <div class="empty-state">
        <i class="fas fa-project-diagram empty-state-icon"></i>
        <div class="empty-state-title">No workflows yet</div>
        <div class="empty-state-description">Create your first workflow to automate security testing</div>
      </div>
    ` : state.workflows.map(wf => `
      <div class="workflow-card" data-id="${wf.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <i class="fas fa-project-diagram" style="color:var(--cf-accent-${wf.status === 'active' ? 'cyan' : 'gray'}); font-size:20px;"></i>
          <div style="flex:1;">
            <div style="font-weight:600;">${wf.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">${wf.steps?.length || 0} steps • ${wf.lastRun ? 'Last run: ' + new Date(wf.lastRun).toLocaleString() : 'Never run'}</div>
          </div>
          <span class="cf-badge ${wf.status === 'active' ? 'green' : 'orange'}">${wf.status}</span>
          <button class="cf-btn workflow-run" data-id="${wf.id}"><i class="fas fa-play"></i> Run</button>
          <button class="cf-btn workflow-edit" data-id="${wf.id}"><i class="fas fa-edit"></i></button>
          <button class="cf-btn workflow-delete" data-id="${wf.id}"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size:12px; color:var(--cf-text-secondary); margin-top:8px;">${wf.description || 'No description'}</div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Workflows</div>
          <div class="cf-panel-actions">
            <button class="cf-btn primary" id="new-workflow"><i class="fas fa-plus"></i> New Workflow</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="workflows-container" style="display:flex; flex-direction:column; gap:12px;">
            ${workflowsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // EVENT BINDER
  // =========================================

  function bindWorkflowsEvents() {
    // New workflow button
    document.getElementById('new-workflow')?.addEventListener('click', () => {
      showModal('Create Workflow', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Name</label>
            <input class="cf-input" name="name" placeholder="My Security Workflow" style="width:100%;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
            <textarea class="cf-input" name="description" rows="3" placeholder="What does this workflow do?" style="width:100%;"></textarea>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Steps (one per line)</label>
            <textarea class="cf-input" name="steps" rows="5" placeholder="Step 1: Check authentication\nStep 2: Test SQL injection\nStep 3: Verify CSRF protection" style="width:100%;"></textarea>
          </div>
        </div>
      `, async (formData) => {
        const steps = formData.get('steps')?.split('\n').filter(s => s.trim()) || [];
        const result = await cyberforgeAPI.createWorkflow({
          name: formData.get('name'),
          description: formData.get('description'),
          steps: steps.map((s, i) => ({ id: i + 1, name: s.trim() })),
          status: 'active'
        });
        if (result.success) {
          state.workflows.unshift(result.data.data.workflow);
          showToast('success', 'Created', 'Workflow created successfully');
          renderScreen('workflows');
        } else {
          showToast('error', 'Error', result.error || 'Failed to create workflow');
        }
      });
    });

    // Run, edit, delete handlers
    document.querySelectorAll('.workflow-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await cyberforgeAPI.runWorkflow(id);
        if (result.success) {
          showToast('success', 'Running', 'Workflow started');
        } else {
          showToast('error', 'Error', result.error || 'Failed to run workflow');
        }
      });
    });

    document.querySelectorAll('.workflow-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Delete Workflow', 'Are you sure you want to delete this workflow?', async () => {
          const result = await cyberforgeAPI.deleteWorkflow(id);
          if (result.success) {
            state.workflows = state.workflows.filter(w => w.id !== id);
            showToast('success', 'Deleted', 'Workflow deleted');
            renderScreen('workflows');
          }
        });
      });
    });
  }

  // =========================================
  // EXPOSE
  // =========================================

  window.CyberForgeWorkflows = {
    injectWorkflowsStyles,
    buildWorkflowsLayout,
    bindWorkflowsEvents
  };
})();
