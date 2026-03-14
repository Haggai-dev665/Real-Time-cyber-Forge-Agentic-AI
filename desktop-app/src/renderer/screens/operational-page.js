// CyberForge Operational Page
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Operational] Could not require api-client.js:', error?.message || error);
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

  function getSidebarScreenMeta(screen) {
    const link = document.querySelector(`[data-screen="${screen}"]`);
    const titleFromLink = link?.querySelector('span')?.textContent?.trim()
      || link?.textContent?.replace(/\s+/g, ' ').trim();

    const section = link?.closest('.sidebar-section')
      ?.querySelector('.sidebar-section-title span')
      ?.textContent?.trim() || 'Operations';

    const title = titleFromLink || screen.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return {
      title,
      section,
      description: `${title} workspace with live data widgets, filtering controls, and activity timelines.`
    };
  }

  function buildOperationalPage(screen) {
    const meta = getSidebarScreenMeta(screen);
    const now = new Date().toLocaleString();

    return `
      <div class="cf-content-inner" style="padding:16px; height:100%; overflow:auto;">
        <div class="cf-card" style="margin-bottom:12px;">
          <div class="cf-card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div class="cf-card-title">${meta.title}</div>
              <div style="font-size:12px; color:var(--cf-text-muted); margin-top:4px;">Section: ${meta.section}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="cf-btn" data-op-refresh="${screen}"><i class="fas fa-rotate"></i> Refresh</button>
              <button class="cf-btn" data-op-export="${screen}"><i class="fas fa-download"></i> Export</button>
            </div>
          </div>
          <div class="cf-card-body">
            <p style="margin-bottom:12px;">${meta.description}</p>
            <div style="display:grid; grid-template-columns:repeat(3, minmax(180px, 1fr)); gap:10px;">
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Last Updated</div>
                <div style="font-weight:600; margin-top:4px;">${now}</div>
              </div>
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Backend Mode</div>
                <div style="font-weight:600; margin-top:4px;">${state.backendConnected ? 'Connected' : 'Offline Cache'}</div>
              </div>
              <div class="cf-card" style="padding:10px;">
                <div style="font-size:11px; color:var(--cf-text-muted);">Tracked Events</div>
                <div style="font-weight:600; margin-top:4px;">${agentState.events.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="cf-card">
          <div class="cf-card-header">
            <div class="cf-card-title">${meta.title} Stream</div>
          </div>
          <div class="cf-card-body" style="padding:0;">
            <table class="cf-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${now}</td>
                  <td>${meta.section}</td>
                  <td>CyberForge Agent</td>
                  <td>Ready</td>
                  <td>${meta.title} page initialized and connected to navigation.</td>
                </tr>
                <tr>
                  <td>${now}</td>
                  <td>System</td>
                  <td>Desktop Runtime</td>
                  <td>Active</td>
                  <td>Route \"${screen}\" is now available as a first-class page.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function bindOperationalPage(screen) {
    const refreshBtn = document.querySelector(`[data-op-refresh="${screen}"]`);
    const exportBtn = document.querySelector(`[data-op-export="${screen}"]`);

    refreshBtn?.addEventListener('click', () => {
      renderScreen(screen);
      showToast('success', 'Refreshed', `${getSidebarScreenMeta(screen).title} refreshed.`);
    });

    exportBtn?.addEventListener('click', () => {
      const payload = {
        screen,
        exportedAt: new Date().toISOString(),
        backendConnected: state.backendConnected,
        activeEvents: agentState.events.length
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${screen}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Exported', `${getSidebarScreenMeta(screen).title} exported.`);
    });
  }

  window.CyberForgeOperational = { getSidebarScreenMeta, buildOperationalPage, bindOperationalPage };
})();
