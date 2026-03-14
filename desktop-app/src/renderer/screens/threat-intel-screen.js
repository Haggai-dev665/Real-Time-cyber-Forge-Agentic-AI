// CyberForge Threat Intel Screen
// Extracted from cyberforge-app.js

(() => {
  // API PROXY
  let importedAPI = null;
  if (typeof require !== 'undefined') {
    try {
      const apiModule = require('../api-client.js');
      importedAPI = apiModule?.cyberforgeAPI || apiModule?.default?.cyberforgeAPI || null;
    } catch (error) {
      console.warn('[CyberForge:ThreatIntel] Could not require api-client.js:', error?.message || error);
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

  function bindThreatIntelEvents() {
    // Update feeds button
    document.getElementById('update-feeds')?.addEventListener('click', async () => {
      showToast('info', 'Updating', 'Refreshing threat intelligence feeds...');
      try {
        const result = await cyberforgeAPI.getThreatStats();
        if (result.success) {
          state.threatStats = result.data.data || {};
          showToast('success', 'Updated', 'Threat feeds refreshed');
          renderScreen('threat-intel');
        }
      } catch (error) {
        showToast('error', 'Error', error.message);
      }
    });

    // IOC Lookup button
    document.getElementById('lookup-ioc')?.addEventListener('click', () => {
      showModal('Lookup IOC', `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Indicator Type</label>
            <select class="cf-input" name="type" style="width:100%;">
              <option value="ip">IP Address</option>
              <option value="domain">Domain</option>
              <option value="url">URL</option>
              <option value="hash">File Hash</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Value</label>
            <input class="cf-input" name="value" placeholder="Enter IP, domain, URL, or hash" style="width:100%;">
          </div>
        </div>
      `, async (formData) => {
        const type = formData.get('type');
        const value = formData.get('value');
        showToast('info', 'Looking up', `Checking ${type}: ${value}...`);
        try {
          const result = await cyberforgeAPI.analyzeUrl(value);
          if (result.success) {
            const data = result.data.data || result.data;
            showModal('IOC Lookup Result', `
              <div style="background:var(--cf-bg-dark); padding:16px; border-radius:8px;">
                <pre style="margin:0; white-space:pre-wrap;">${JSON.stringify(data, null, 2)}</pre>
              </div>
            `, null);
          } else {
            showToast('warning', 'Not Found', 'No threat data found for this indicator');
          }
        } catch (error) {
          showToast('error', 'Error', error.message);
        }
      });
    });
  }

  function buildThreatIntelLayout() {
    return `
      <div class="cf-panel" style="flex:1; display:flex; flex-direction:column;">
        <div class="cf-panel-header">
          <div class="cf-panel-title">Threat Intelligence</div>
          <div class="cf-panel-actions">
            <button class="cf-btn" id="update-feeds"><i class="fas fa-download"></i> Update Feeds</button>
            <button class="cf-btn primary" id="lookup-ioc"><i class="fas fa-search"></i> Lookup IOC</button>
          </div>
        </div>
        <div class="cf-panel-content" style="padding:16px;">
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px;">
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-red);" id="threat-ips">${state.threatStats?.maliciousIps || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">Known Malicious IPs</div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-orange);" id="threat-domains">${state.threatStats?.suspiciousDomains || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">Suspicious Domains</div>
            </div>
            <div style="background:var(--cf-bg-medium); border:1px solid var(--cf-border); border-radius:8px; padding:16px; text-align:center;">
              <div style="font-size:32px; font-weight:700; color:var(--cf-accent-purple);" id="threat-iocs">${state.threatStats?.totalIocs || 0}</div>
              <div style="font-size:12px; color:var(--cf-text-muted);">IOCs in Database</div>
            </div>
          </div>
          <h3 style="margin-bottom:12px;">Recent Threat Feeds</h3>
          <div class="cf-table-container">
            <table class="cf-table">
              <thead><tr><th>Feed</th><th>Last Updated</th><th>Entries</th><th>Status</th></tr></thead>
              <tbody id="threat-feeds-tbody">
                ${state.threatStats?.feeds?.length ? state.threatStats.feeds.map(f => `
                  <tr>
                    <td>${f.name}</td>
                    <td>${f.lastUpdated || 'Never'}</td>
                    <td>${f.entries || 0}</td>
                    <td><span class="cf-badge ${f.status === 'active' ? 'green' : 'orange'}">${f.status || 'Unknown'}</span></td>
                  </tr>
                `).join('') : `
                  <tr><td>AbuseIPDB</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                  <tr><td>URLhaus</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                  <tr><td>PhishTank</td><td>Ready to update</td><td>-</td><td><span class="cf-badge blue">Available</span></td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  window.CyberForgeThreatIntel = { buildThreatIntelLayout, bindThreatIntelEvents };
})();
