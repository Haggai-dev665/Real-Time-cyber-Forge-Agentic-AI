// CyberForge Plugins Screen
// Extracted from cyberforge-app.js — plugins layout builder and event binders.

(() => {
  // =========================================
  // API PROXY
  // =========================================

  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:Plugins] Could not require api-client.js, falling back to window API:', error?.message || error);
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
  // STYLES
  // =========================================

  function injectPluginsStyles() {
    if (document.getElementById('cf-plugins-styles')) return;
    const style = document.createElement('style');
    style.id = 'cf-plugins-styles';
    style.textContent = `/* Plugins screen — no extra styles needed */`;
    document.head.appendChild(style);
  }

  // =========================================
  // LAYOUT
  // =========================================

  function buildPluginsLayout() {
    const pluginsHtml = state.plugins.length === 0 ? `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-puzzle-piece empty-state-icon"></i>
        <div class="empty-state-title">No plugins installed</div>
        <div class="empty-state-description">Browse the store to find useful extensions</div>
      </div>
    ` : state.plugins.map(plugin => `
      <div class="plugin-card" data-id="${plugin.id}" style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:40px;height:40px;background:var(--cf-accent-${plugin.color || 'purple'});border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-${plugin.icon || 'puzzle-piece'}" style="color:white;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;">${plugin.name}</div>
            <div style="font-size:11px; color:var(--cf-text-muted);">v${plugin.version || '1.0.0'} • ${plugin.enabled ? 'Active' : 'Disabled'}</div>
          </div>
          <label class="switch">
            <input type="checkbox" class="plugin-toggle" data-id="${plugin.id}" ${plugin.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div style="font-size:12px; color:var(--cf-text-secondary); margin-bottom:12px;">${plugin.description || 'No description'}</div>
        <div style="display:flex; gap:8px;">
          <button class="cf-btn plugin-settings" data-id="${plugin.id}"><i class="fas fa-cog"></i> Settings</button>
          <button class="cf-btn plugin-uninstall" data-id="${plugin.id}"><i class="fas fa-trash"></i> Uninstall</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Plugins</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="browse-store"><i class="fas fa-store"></i> Browse Store</button>
            <button class="cf-btn primary" id="install-plugin"><i class="fas fa-upload"></i> Install</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div id="plugins-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
            ${pluginsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================
  // EVENT BINDERS
  // =========================================

  function bindPluginsEvents() {
    document.getElementById('browse-store')?.addEventListener('click', async () => {
      const result = await cyberforgeAPI.getPluginStore();
      if (result.success) {
        const storePlugins = result.data.data?.plugins || [];
        showModal('Plugin Store', `
          <div style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow:auto;">
            ${storePlugins.length === 0 ? '<p>No plugins available in store</p>' : storePlugins.map(p => `
              <div style="background:var(--cf-bg-dark); border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px;">
                <i class="fas fa-${p.icon || 'puzzle-piece'}" style="font-size:24px; color:var(--cf-accent-${p.color || 'blue'});"></i>
                <div style="flex:1;">
                  <div style="font-weight:600;">${p.name}</div>
                  <div style="font-size:11px; color:var(--cf-text-muted);">${p.description || ''}</div>
                </div>
                <button class="cf-btn store-install" data-id="${p.id}"><i class="fas fa-download"></i> Install</button>
              </div>
            `).join('')}
          </div>
        `, null);
        
        // Bind install buttons after modal is shown
        setTimeout(() => {
          document.querySelectorAll('.store-install').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.dataset.id;
              const installResult = await cyberforgeAPI.installPlugin(id);
              if (installResult.success) {
                state.plugins.push(installResult.data.data.plugin);
                showToast('success', 'Installed', 'Plugin installed successfully');
                document.querySelector('.modal-overlay')?.remove();
                renderScreen('plugins');
              }
            });
          });
        }, 100);
      }
    });

    document.getElementById('install-plugin')?.addEventListener('click', () => {
      showModal('Install Plugin', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <p>Enter the plugin ID or URL to install:</p>
          <input class="cf-input" name="pluginId" placeholder="plugin-id or https://..." style="width:100%;">
        </div>
      `, async (formData) => {
        const pluginId = formData.get('pluginId');
        const result = await cyberforgeAPI.installPlugin(pluginId);
        if (result.success) {
          state.plugins.push(result.data.data.plugin);
          showToast('success', 'Installed', 'Plugin installed successfully');
          renderScreen('plugins');
        } else {
          showToast('error', 'Error', result.error || 'Failed to install plugin');
        }
      });
    });

    document.querySelectorAll('.plugin-toggle').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.id;
        const result = await cyberforgeAPI.togglePlugin(id);
        if (result.success) {
          const plugin = state.plugins.find(p => p.id === id);
          if (plugin) plugin.enabled = !plugin.enabled;
          showToast('success', 'Updated', `Plugin ${plugin?.enabled ? 'enabled' : 'disabled'}`);
        }
      });
    });

    document.querySelectorAll('.plugin-uninstall').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        showConfirmModal('Uninstall Plugin', 'Are you sure you want to uninstall this plugin?', async () => {
          const result = await cyberforgeAPI.uninstallPlugin(id);
          if (result.success) {
            state.plugins = state.plugins.filter(p => p.id !== id);
            showToast('success', 'Uninstalled', 'Plugin removed');
            renderScreen('plugins');
          }
        });
      });
    });
  }

  // =========================================
  // EXPOSE PUBLIC API
  // =========================================

  window.CyberForgePlugins = {
    injectPluginsStyles,
    buildPluginsLayout,
    bindPluginsEvents
  };
})();
