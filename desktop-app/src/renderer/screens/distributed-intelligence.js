/**
 * CyberForge Distributed Intelligence — Dashboard Screen
 * TODO 4: Main entry screen for distributed intelligence features.
 * 
 * ISOLATION: New screen file. Does NOT modify any existing screen.
 * Renders inside the existing content area when its data-screen is activated.
 */

class DistributedIntelligenceScreen {
  constructor() {
    this.container = null;
    this.refreshInterval = null;
    this.data = {
      nodeIdentity: null,
      syncState: null,
      distributedStatus: null,
      globalMetrics: null,
      nodeStatuses: [],
      correlations: [],
      weightTable: null,
    };
  }

  /**
   * Render the distributed intelligence dashboard into a container element.
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = this._buildHTML();
    this._bindEvents();
    this._startAutoRefresh();
    this._loadData();
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  _buildHTML() {
    return `
      <div class="distributed-intelligence-screen">
        <!-- Header -->
        <div class="screen-header">
          <div class="screen-header-left">
            <h1 class="screen-title">
              <i class="fas fa-network-wired"></i>
              Distributed Intelligence
            </h1>
            <span class="screen-subtitle">Multi-Node Cloud Sync & Threat Correlation</span>
          </div>
          <div class="screen-header-right">
            <button class="btn btn-sm btn-outline" id="dist-refresh-btn" title="Refresh">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button class="btn btn-sm btn-primary" id="dist-sync-btn" title="Sync Now">
              <i class="fas fa-cloud-upload-alt"></i> Sync Now
            </button>
            <button class="btn btn-sm btn-outline" id="dist-register-btn" title="Register Node">
              <i class="fas fa-plus-circle"></i> Register Node
            </button>
          </div>
        </div>

        <!-- Status Cards Row -->
        <div class="metrics-grid metrics-grid-4" id="dist-status-cards">
          <div class="metric-card">
            <div class="metric-icon"><i class="fas fa-fingerprint"></i></div>
            <div class="metric-content">
              <div class="metric-value" id="dist-node-id">—</div>
              <div class="metric-label">Node ID</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon"><i class="fas fa-server"></i></div>
            <div class="metric-content">
              <div class="metric-value" id="dist-active-nodes">0</div>
              <div class="metric-label">Active Nodes</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon"><i class="fas fa-cloud-download-alt"></i></div>
            <div class="metric-content">
              <div class="metric-value" id="dist-sync-count">0</div>
              <div class="metric-label">Total Syncs</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon"><i class="fas fa-project-diagram"></i></div>
            <div class="metric-content">
              <div class="metric-value" id="dist-correlation-count">0</div>
              <div class="metric-label">Correlations</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="content-tabs" id="dist-tabs">
          <button class="tab-btn active" data-tab="dist-overview">Overview</button>
          <button class="tab-btn" data-tab="dist-nodes">Node Management</button>
          <button class="tab-btn" data-tab="dist-correlations">Correlations</button>
          <button class="tab-btn" data-tab="dist-heatmap">Threat Heatmap</button>
          <button class="tab-btn" data-tab="dist-metrics">Global Metrics</button>
          <button class="tab-btn" data-tab="dist-weights">Risk Weights</button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content" id="dist-tab-content">
          <!-- Overview Tab -->
          <div class="tab-pane active" id="dist-overview">
            ${this._buildOverviewTab()}
          </div>
          <!-- Node Management Tab -->
          <div class="tab-pane" id="dist-nodes" style="display:none">
            ${this._buildNodesTab()}
          </div>
          <!-- Correlations Tab -->
          <div class="tab-pane" id="dist-correlations" style="display:none">
            ${this._buildCorrelationsTab()}
          </div>
          <!-- Heatmap Tab -->
          <div class="tab-pane" id="dist-heatmap" style="display:none">
            ${this._buildHeatmapTab()}
          </div>
          <!-- Global Metrics Tab -->
          <div class="tab-pane" id="dist-metrics" style="display:none">
            ${this._buildGlobalMetricsTab()}
          </div>
          <!-- Risk Weights Tab -->
          <div class="tab-pane" id="dist-weights" style="display:none">
            ${this._buildWeightsTab()}
          </div>
        </div>
      </div>
    `;
  }

  _buildOverviewTab() {
    return `
      <div class="panel-grid panel-grid-2">
        <!-- Node Identity Panel -->
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-id-card"></i> This Node</h3>
          </div>
          <div class="panel-body" id="dist-node-identity-panel">
            <div class="info-row"><span class="info-label">Node ID</span><span class="info-value mono" id="ov-node-id">Loading...</span></div>
            <div class="info-row"><span class="info-label">Fingerprint</span><span class="info-value mono" id="ov-fingerprint">—</span></div>
            <div class="info-row"><span class="info-label">Hostname</span><span class="info-value" id="ov-hostname">—</span></div>
            <div class="info-row"><span class="info-label">Platform</span><span class="info-value" id="ov-platform">—</span></div>
            <div class="info-row"><span class="info-label">Version</span><span class="info-value" id="ov-version">—</span></div>
          </div>
        </div>

        <!-- Sync Status Panel -->
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-sync"></i> Sync Status</h3>
          </div>
          <div class="panel-body" id="dist-sync-status-panel">
            <div class="info-row"><span class="info-label">Last Sync</span><span class="info-value" id="ov-last-sync">Never</span></div>
            <div class="info-row"><span class="info-label">Sequence</span><span class="info-value mono" id="ov-sequence">0</span></div>
            <div class="info-row"><span class="info-label">Total Syncs</span><span class="info-value" id="ov-total-syncs">0</span></div>
            <div class="info-row"><span class="info-label">Failed Syncs</span><span class="info-value" id="ov-failed-syncs">0</span></div>
            <div class="info-row"><span class="info-label">Retry Queue</span><span class="info-value" id="ov-retry-queue">0</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="info-value" id="ov-sync-status"><span class="status-badge idle">Idle</span></span></div>
          </div>
        </div>

        <!-- Recent Correlations -->
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-project-diagram"></i> Recent Correlations</h3>
          </div>
          <div class="panel-body" id="dist-recent-correlations">
            <div class="empty-state">
              <i class="fas fa-search"></i>
              <p>No cross-node correlations detected yet</p>
            </div>
          </div>
        </div>

        <!-- Global Risk Multiplier -->
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-balance-scale"></i> Risk Multiplier</h3>
          </div>
          <div class="panel-body" id="dist-risk-multiplier-panel">
            <div class="risk-multiplier-display">
              <div class="risk-multiplier-value" id="ov-global-multiplier">1.0x</div>
              <div class="risk-multiplier-label">Global Multiplier</div>
            </div>
            <div class="info-row"><span class="info-label">Domain Overrides</span><span class="info-value" id="ov-domain-overrides">0</span></div>
            <div class="info-row"><span class="info-label">TLD Overrides</span><span class="info-value" id="ov-tld-overrides">0</span></div>
            <div class="info-row"><span class="info-label">Last Updated</span><span class="info-value" id="ov-weights-updated">—</span></div>
          </div>
        </div>
      </div>
    `;
  }

  _buildNodesTab() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-server"></i> Registered Nodes</h3>
          <span class="badge" id="nodes-count-badge">0</span>
        </div>
        <div class="panel-body">
          <table class="data-table" id="dist-nodes-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Node ID</th>
                <th>Hostname</th>
                <th>Platform</th>
                <th>Alerts</th>
                <th>Avg Risk</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody id="dist-nodes-tbody">
              <tr><td colspan="7" class="empty-state">No nodes registered yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _buildCorrelationsTab() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-project-diagram"></i> Cross-Node Correlations</h3>
          <span class="badge" id="corr-count-badge">0</span>
        </div>
        <div class="panel-body">
          <div id="dist-correlations-list" class="correlation-list">
            <div class="empty-state">
              <i class="fas fa-search"></i>
              <p>No correlations detected yet. Correlations appear when multiple nodes flag the same domain.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _buildHeatmapTab() {
    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-fire"></i> Global Threat Heatmap</h3>
        </div>
        <div class="panel-body">
          <div id="dist-heatmap-container" class="heatmap-container">
            <div class="heatmap-grid" id="dist-heatmap-grid">
              <!-- Heatmap cells generated dynamically -->
            </div>
            <div class="heatmap-legend">
              <span class="legend-item"><span class="legend-color" style="background:#10b981"></span> Low</span>
              <span class="legend-item"><span class="legend-color" style="background:#f59e0b"></span> Medium</span>
              <span class="legend-item"><span class="legend-color" style="background:#ef4444"></span> High</span>
              <span class="legend-item"><span class="legend-color" style="background:#7c3aed"></span> Critical</span>
            </div>
          </div>
          <div class="panel" style="margin-top:16px">
            <div class="panel-header"><h4>Top Threat Domains</h4></div>
            <div class="panel-body">
              <table class="data-table" id="dist-threat-domains-table">
                <thead>
                  <tr><th>Domain</th><th>Risk Score</th><th>Seen By Nodes</th><th>Category</th></tr>
                </thead>
                <tbody id="dist-threat-domains-tbody">
                  <tr><td colspan="4" class="empty-state">No threat data available</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _buildGlobalMetricsTab() {
    return `
      <div class="metrics-grid metrics-grid-3" id="dist-global-metrics-cards">
        <div class="metric-card">
          <div class="metric-icon"><i class="fas fa-server"></i></div>
          <div class="metric-content">
            <div class="metric-value" id="gm-total-nodes">0</div>
            <div class="metric-label">Total Nodes</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="metric-content">
            <div class="metric-value" id="gm-alerts-24h">0</div>
            <div class="metric-label">Alerts (24h)</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-icon"><i class="fas fa-chart-line"></i></div>
          <div class="metric-content">
            <div class="metric-value" id="gm-avg-risk">0</div>
            <div class="metric-label">Avg Risk Score</div>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <h3><i class="fas fa-chart-bar"></i> Distributed System Metrics</h3>
        </div>
        <div class="panel-body">
          <div class="info-row"><span class="info-label">Active Nodes</span><span class="info-value" id="gm-active-nodes">0</span></div>
          <div class="info-row"><span class="info-label">Correlation Count (24h)</span><span class="info-value" id="gm-corr-24h">0</span></div>
          <div class="info-row"><span class="info-label">Global Multiplier</span><span class="info-value" id="gm-global-mult">1.0x</span></div>
          <div class="info-row"><span class="info-label">Broadcast Count</span><span class="info-value" id="gm-broadcast-count">0</span></div>
          <div class="info-row"><span class="info-label">Last Updated</span><span class="info-value" id="gm-last-updated">—</span></div>
        </div>
      </div>
    `;
  }

  _buildWeightsTab() {
    return `
      <div class="panel-grid panel-grid-2">
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-balance-scale"></i> Global Multiplier</h3>
          </div>
          <div class="panel-body">
            <div class="risk-multiplier-display large">
              <div class="risk-multiplier-value" id="wt-global-multiplier">1.0x</div>
              <div class="risk-multiplier-label">Applied to all scores before final output</div>
              <div class="info-text">Formula: adjusted_score = base_score × global_multiplier</div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <h3><i class="fas fa-globe"></i> Domain Multipliers</h3>
            <span class="badge" id="wt-domain-count">0</span>
          </div>
          <div class="panel-body">
            <table class="data-table" id="dist-domain-weights-table">
              <thead><tr><th>Domain</th><th>Multiplier</th></tr></thead>
              <tbody id="dist-domain-weights-tbody">
                <tr><td colspan="2" class="empty-state">No domain-specific weights</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ──────────────────────────────────────────────
  // Data Loading
  // ──────────────────────────────────────────────

  async _loadData() {
    try {
      // Use Tauri invoke for desktop, API for web
      if (window.__TAURI__) {
        const [identity, syncState, status] = await Promise.all([
          window.__TAURI__.core.invoke('get_node_identity'),
          window.__TAURI__.core.invoke('get_sync_state'),
          window.__TAURI__.core.invoke('get_distributed_status'),
        ]);
        this.data.nodeIdentity = identity;
        this.data.syncState = syncState;
        this.data.distributedStatus = status;
        this.data.globalMetrics = status?.globalMetrics || null;
        this.data.nodeStatuses = status?.nodeStatuses || [];
        this.data.weightTable = status?.weightTable || null;
      }
      this._updateUI();
    } catch (err) {
      console.error('[Distributed] Failed to load data:', err);
    }
  }

  _updateUI() {
    const { nodeIdentity, syncState, distributedStatus, globalMetrics, nodeStatuses, weightTable } = this.data;

    // Status cards
    if (nodeIdentity) {
      const shortId = nodeIdentity.nodeId?.substring(0, 8) || '—';
      this._setText('dist-node-id', shortId + '...');
      this._setText('ov-node-id', nodeIdentity.nodeId || '—');
      this._setText('ov-fingerprint', nodeIdentity.deviceFingerprint || '—');
      this._setText('ov-hostname', nodeIdentity.hostname || '—');
      this._setText('ov-platform', `${nodeIdentity.platform || '—'} / ${nodeIdentity.arch || '—'}`);
      this._setText('ov-version', nodeIdentity.version || '—');
    }

    if (distributedStatus) {
      this._setText('dist-active-nodes', distributedStatus.connectedNodes || 0);
      this._setText('dist-correlation-count', distributedStatus.broadcastCount || 0);
    }

    if (syncState) {
      this._setText('dist-sync-count', syncState.totalSyncs || 0);
      this._setText('ov-last-sync', syncState.lastSyncAt ? new Date(syncState.lastSyncAt).toLocaleString() : 'Never');
      this._setText('ov-sequence', syncState.lastSyncSequence || 0);
      this._setText('ov-total-syncs', syncState.totalSyncs || 0);
      this._setText('ov-failed-syncs', syncState.failedSyncs || 0);
      this._setText('ov-retry-queue', syncState.retryQueueSize || 0);
      const statusEl = document.getElementById('ov-sync-status');
      if (statusEl) {
        statusEl.innerHTML = syncState.isSyncing
          ? '<span class="status-badge syncing">Syncing...</span>'
          : '<span class="status-badge idle">Idle</span>';
      }
    }

    if (weightTable) {
      this._setText('ov-global-multiplier', `${(weightTable.globalMultiplier || 1.0).toFixed(1)}x`);
      this._setText('ov-domain-overrides', Object.keys(weightTable.domainMultipliers || {}).length);
      this._setText('ov-tld-overrides', Object.keys(weightTable.tldMultipliers || {}).length);
      this._setText('ov-weights-updated', weightTable.lastUpdated ? new Date(weightTable.lastUpdated).toLocaleString() : '—');
      this._setText('wt-global-multiplier', `${(weightTable.globalMultiplier || 1.0).toFixed(1)}x`);
      this._setText('wt-domain-count', Object.keys(weightTable.domainMultipliers || {}).length);
      this._updateDomainWeightsTable(weightTable.domainMultipliers || {});
    }

    if (nodeStatuses && nodeStatuses.length > 0) {
      this._updateNodesTable(nodeStatuses);
    }

    if (globalMetrics) {
      this._updateGlobalMetrics(globalMetrics);
    }
  }

  _updateNodesTable(nodes) {
    const tbody = document.getElementById('dist-nodes-tbody');
    if (!tbody) return;

    const countBadge = document.getElementById('nodes-count-badge');
    if (countBadge) countBadge.textContent = nodes.length;

    if (nodes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No nodes registered</td></tr>';
      return;
    }

    tbody.innerHTML = nodes.map(n => `
      <tr>
        <td><span class="status-dot ${n.isOnline ? 'online' : 'offline'}"></span></td>
        <td class="mono">${(n.nodeId || '').substring(0, 12)}...</td>
        <td>${n.hostname || '—'}</td>
        <td>${n.platform || '—'}</td>
        <td>${n.alertCount || 0}</td>
        <td>${(n.avgRiskScore || 0).toFixed(1)}</td>
        <td>${n.lastSeen ? new Date(n.lastSeen).toLocaleTimeString() : '—'}</td>
      </tr>
    `).join('');
  }

  _updateGlobalMetrics(metrics) {
    this._setText('gm-total-nodes', metrics.totalNodes || 0);
    this._setText('gm-active-nodes', metrics.activeNodes || 0);
    this._setText('gm-alerts-24h', metrics.totalAlerts24h || 0);
    this._setText('gm-avg-risk', (metrics.avgRiskScore || 0).toFixed(1));
    this._setText('gm-corr-24h', metrics.correlationCount24h || 0);
    this._setText('gm-broadcast-count', this.data.distributedStatus?.broadcastCount || 0);
    this._setText('gm-global-mult', `${(this.data.weightTable?.globalMultiplier || 1.0).toFixed(1)}x`);
    this._setText('gm-last-updated', metrics.timestamp ? new Date(metrics.timestamp).toLocaleString() : '—');

    // Update heatmap
    if (metrics.topThreatDomains) {
      this._updateHeatmap(metrics.topThreatDomains);
      this._updateThreatDomainsTable(metrics.topThreatDomains);
    }
  }

  _updateHeatmap(domains) {
    const grid = document.getElementById('dist-heatmap-grid');
    if (!grid) return;

    if (domains.length === 0) {
      grid.innerHTML = '<div class="empty-state">No threat data for heatmap</div>';
      return;
    }

    grid.innerHTML = domains.map(d => {
      const color = d.riskScore >= 80 ? '#7c3aed' : d.riskScore >= 60 ? '#ef4444' : d.riskScore >= 40 ? '#f59e0b' : '#10b981';
      return `
        <div class="heatmap-cell" style="background:${color}" title="${d.domain}: ${d.riskScore.toFixed(0)} risk">
          <span class="heatmap-domain">${d.domain}</span>
          <span class="heatmap-score">${d.riskScore.toFixed(0)}</span>
        </div>
      `;
    }).join('');
  }

  _updateThreatDomainsTable(domains) {
    const tbody = document.getElementById('dist-threat-domains-tbody');
    if (!tbody) return;

    if (domains.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No threat data</td></tr>';
      return;
    }

    tbody.innerHTML = domains.map(d => `
      <tr>
        <td class="mono">${d.domain}</td>
        <td><span class="risk-badge risk-${d.riskScore >= 80 ? 'critical' : d.riskScore >= 60 ? 'high' : d.riskScore >= 40 ? 'medium' : 'low'}">${d.riskScore.toFixed(0)}</span></td>
        <td>${d.seenByNodes || 0}</td>
        <td>${d.category || 'unknown'}</td>
      </tr>
    `).join('');
  }

  _updateDomainWeightsTable(domainMultipliers) {
    const tbody = document.getElementById('dist-domain-weights-tbody');
    if (!tbody) return;

    const entries = Object.entries(domainMultipliers);
    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-state">No domain weights</td></tr>';
      return;
    }

    tbody.innerHTML = entries
      .sort((a, b) => b[1] - a[1])
      .map(([domain, mult]) => `
        <tr>
          <td class="mono">${domain}</td>
          <td>${mult.toFixed(2)}x</td>
        </tr>
      `).join('');
  }

  // ──────────────────────────────────────────────
  // Events
  // ──────────────────────────────────────────────

  _bindEvents() {
    // Tab switching
    const tabs = this.container?.querySelectorAll('#dist-tabs .tab-btn');
    if (tabs) {
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          btn.classList.add('active');
          const tabId = btn.dataset.tab;
          const panes = this.container.querySelectorAll('.tab-pane');
          panes.forEach(p => {
            p.style.display = p.id === tabId ? 'block' : 'none';
            if (p.id === tabId) p.classList.add('active');
            else p.classList.remove('active');
          });
        });
      });
    }

    // Sync button
    const syncBtn = document.getElementById('dist-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
        try {
          if (window.__TAURI__) {
            await window.__TAURI__.core.invoke('sync_telemetry');
          }
          await this._loadData();
        } catch (err) {
          console.error('[Distributed] Sync failed:', err);
        }
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sync Now';
      });
    }

    // Register button
    const regBtn = document.getElementById('dist-register-btn');
    if (regBtn) {
      regBtn.addEventListener('click', async () => {
        regBtn.disabled = true;
        try {
          if (window.__TAURI__) {
            await window.__TAURI__.core.invoke('register_node');
          }
          await this._loadData();
        } catch (err) {
          console.error('[Distributed] Registration failed:', err);
        }
        regBtn.disabled = false;
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('dist-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._loadData());
    }

    // Listen for real-time events from Tauri
    if (window.__TAURI__) {
      window.__TAURI__.event.listen('intelligence-broadcast', (event) => {
        console.log('[Distributed] Intelligence broadcast received:', event.payload);
        this._loadData();
      });
      window.__TAURI__.event.listen('node-status-update', () => this._loadData());
      window.__TAURI__.event.listen('global-metrics-update', () => this._loadData());
      window.__TAURI__.event.listen('correlation-alert', () => this._loadData());
      window.__TAURI__.event.listen('weight-table-update', () => this._loadData());
    }
  }

  _startAutoRefresh() {
    this.refreshInterval = setInterval(() => this._loadData(), 30000);
  }

  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}

// Export for use by the page controller
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DistributedIntelligenceScreen;
} else {
  window.DistributedIntelligenceScreen = DistributedIntelligenceScreen;
}
