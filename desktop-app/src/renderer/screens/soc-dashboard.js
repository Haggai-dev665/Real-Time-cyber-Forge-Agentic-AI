/**
 * SOC Command Dashboard — CyberForge
 * TODO 6: Enterprise Multi-Tenancy — SOC Command Center
 *
 * Connects to:
 *   GET /api/threats               — live alert feed
 *   GET /api/threats/stats         — threat statistics
 *   GET /api/distributed/nodes/all — node health grid
 *   GET /api/distributed/correlations — correlation events
 *   GET /api/distributed/metrics/global — global metrics
 *   GET /api/audit/logs            — audit trail feed
 *   GET /api/policy/stats          — policy engine stats
 *   GET /api/agent/alerts          — agent alerts
 */

class SOCDashboardScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this._refreshTimer = null;
        this._countTimer = null;
        this._elapsedSeconds = 0;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadAll();
        this._startAutoRefresh();
    }

    hide() {
        this.isActive = false;
        clearInterval(this._refreshTimer);
        clearInterval(this._countTimer);
    }

    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _headers() {
        if (window.CF_API?.headers) return window.CF_API.headers();
        const token = localStorage.getItem('cf_token') || localStorage.getItem('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    _timeSince(isoStr) {
        if (!isoStr) return 'Unknown';
        const ms = Date.now() - new Date(isoStr).getTime();
        if (ms < 60000)  return `${Math.floor(ms/1000)}s ago`;
        if (ms < 3600000) return `${Math.floor(ms/60000)}m ago`;
        if (ms < 86400000)return `${Math.floor(ms/3600000)}h ago`;
        return `${Math.floor(ms/86400000)}d ago`;
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    _shell() {
        return `
<style>
.soc-root { display:flex; flex-direction:column; gap:18px; padding:20px; min-height:100%; overflow-y:auto; }

/* Header */
.soc-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.soc-title-area h2 { margin:0; font-size:1.35rem; font-weight:700; color:var(--cf-text-primary); }
.soc-title-area p  { margin:4px 0 0; font-size:12px; color:var(--cf-text-muted); }
.soc-live-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
                  background:rgba(246,157,57,.12); border:1px solid var(--cf-status-success);
                  border-radius:99px; font-size:11.5px; font-weight:600; color:var(--cf-status-success); }
.soc-live-dot  { width:7px; height:7px; border-radius:50%; background:var(--cf-status-success);
                 animation:socPulse 1.4s ease-in-out infinite; }
@keyframes socPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.soc-refresh-info { font-size:11px; color:var(--cf-text-muted); display:flex; align-items:center; gap:6px; }

/* Stats Grid */
.soc-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:12px; }
.soc-kpi { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:10px;
           padding:14px 16px; position:relative; overflow:hidden; }
.soc-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
.soc-kpi.red::before    { background:var(--cf-status-error); }
.soc-kpi.amber::before  { background:var(--cf-status-warning); }
.soc-kpi.green::before  { background:var(--cf-status-success); }
.soc-kpi.blue::before   { background:var(--cf-status-info); }
.soc-kpi .kpi-label { font-size:10.5px; font-weight:600; color:var(--cf-text-muted);
                       text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
.soc-kpi .kpi-val   { font-size:1.75rem; font-weight:700; font-family:'Roboto Mono',monospace;
                       color:var(--cf-text-primary); line-height:1; }
.soc-kpi .kpi-sub   { font-size:10.5px; color:var(--cf-text-muted); margin-top:4px; }
.soc-kpi .kpi-icon  { position:absolute; right:14px; top:14px; font-size:1.3rem; opacity:.18;
                       color:var(--cf-text-primary); }

/* Layout panels */
.soc-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.soc-grid-3 { display:grid; grid-template-columns:2fr 1fr; gap:16px; }

.soc-panel { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:12px; overflow:hidden; }
.soc-panel-head { display:flex; align-items:center; justify-content:space-between;
                  padding:12px 16px; border-bottom:1px solid var(--cf-border-subtle);
                  background:var(--cf-bg-elevated); }
.soc-panel-head h3 { margin:0; font-size:13px; font-weight:700; color:var(--cf-text-primary); }
.soc-panel-head .count-badge { font-size:10.5px; background:rgba(154,145,130,.12);
                                 color:var(--cf-text-muted); padding:2px 8px; border-radius:99px; }
.soc-panel-body { padding:12px; max-height:320px; overflow-y:auto; }

/* Alert Feed */
.soc-alert-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px;
                 margin-bottom:4px; cursor:pointer; transition:background .15s; }
.soc-alert-row:hover { background:var(--cf-bg-elevated); }
.soc-alert-row .sev-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.sev-dot.critical { background:var(--cf-status-error); box-shadow:0 0 6px var(--cf-status-error); }
.sev-dot.high     { background:#F69D39; }
.sev-dot.medium   { background:var(--cf-status-warning); }
.sev-dot.low      { background:var(--cf-status-success); }
.soc-alert-body   { flex:1; min-width:0; }
.soc-alert-name   { font-size:12.5px; font-weight:500; color:var(--cf-text-primary);
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.soc-alert-meta   { font-size:10.5px; color:var(--cf-text-muted); margin-top:2px; }
.soc-alert-time   { font-size:10px; color:var(--cf-text-muted); white-space:nowrap; flex-shrink:0; }

/* Node Grid */
.soc-node-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; padding:12px; }
.soc-node-card { background:var(--cf-bg-elevated); border:1px solid var(--cf-border-subtle);
                 border-radius:8px; padding:10px; text-align:center; position:relative; }
.soc-node-card.online  { border-color:rgba(246,157,57,.3); }
.soc-node-card.offline { border-color:rgba(229,87,62,.2); opacity:.65; }
.soc-node-icon { font-size:1.3rem; margin-bottom:6px; }
.soc-node-card.online  .soc-node-icon { color:var(--cf-status-success); }
.soc-node-card.offline .soc-node-icon { color:var(--cf-status-error); }
.soc-node-name  { font-size:11px; font-weight:600; color:var(--cf-text-primary);
                  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.soc-node-plat  { font-size:10px; color:var(--cf-text-muted); margin-top:2px; }
.soc-node-risk  { margin-top:6px; font-size:10px; font-family:'Roboto Mono',monospace; }
.soc-node-risk .r-val { font-weight:700; }
.r-val.high   { color:var(--cf-status-error); }
.r-val.medium { color:var(--cf-status-warning); }
.r-val.low    { color:var(--cf-status-success); }
.soc-node-online-dot { position:absolute; top:8px; right:8px; width:6px; height:6px;
                        border-radius:50%; }
.soc-node-card.online  .soc-node-online-dot { background:var(--cf-status-success); }
.soc-node-card.offline .soc-node-online-dot { background:var(--cf-status-error); }

/* Correlation Feed */
.soc-corr-row { padding:10px 12px; border-bottom:1px solid var(--cf-border-subtle); }
.soc-corr-row:last-child { border-bottom:none; }
.soc-corr-head { display:flex; justify-content:space-between; align-items:flex-start; }
.soc-corr-domain { font-size:12.5px; font-weight:600; color:var(--cf-status-warning); }
.soc-corr-time   { font-size:10px; color:var(--cf-text-muted); white-space:nowrap; margin-left:8px; }
.soc-corr-desc   { font-size:11px; color:var(--cf-text-secondary); margin-top:3px; }
.soc-corr-sev    { margin-top:4px; }

/* Audit Trail */
.soc-audit-row { display:flex; align-items:flex-start; gap:10px; padding:8px 12px;
                 border-bottom:1px solid var(--cf-border-subtle); }
.soc-audit-row:last-child { border-bottom:none; }
.soc-audit-icon { width:26px; height:26px; border-radius:50%; display:flex; align-items:center;
                  justify-content:center; flex-shrink:0; font-size:11px; }
.soc-audit-icon.success { background:rgba(246,157,57,.12); color:var(--cf-status-success); }
.soc-audit-icon.failure { background:rgba(229,87,62,.12); color:var(--cf-status-error); }
.soc-audit-icon.warning { background:rgba(216,182,90,.12); color:var(--cf-status-warning); }
.soc-audit-body { flex:1; min-width:0; }
.soc-audit-action { font-size:12px; font-weight:600; color:var(--cf-text-primary); }
.soc-audit-user  { font-size:10.5px; color:var(--cf-text-muted); }

/* Policy Stats */
.soc-policy-stat { display:flex; justify-content:space-between; align-items:center;
                   padding:8px 12px; border-bottom:1px solid var(--cf-border-subtle); }
.soc-policy-stat:last-child { border-bottom:none; }
.soc-policy-name { font-size:12.5px; color:var(--cf-text-primary); }
.soc-policy-cnt  { font-family:'Roboto Mono',monospace; font-size:12px;
                   font-weight:600; color:var(--cf-interactive-default); }

/* Sev badge */
.sev-badge { display:inline-block; padding:1px 7px; border-radius:99px; font-size:10.5px; font-weight:600; }
.sev-critical { background:rgba(229,87,62,.15); color:var(--cf-status-error); }
.sev-high     { background:rgba(249,115,22,.15); color:#F69D39; }
.sev-medium   { background:rgba(216,182,90,.15); color:var(--cf-status-warning); }
.sev-low      { background:rgba(246,157,57,.15); color:var(--cf-status-success); }

.soc-empty { text-align:center; padding:32px 12px; color:var(--cf-text-muted); font-size:12px; }
.soc-empty i { display:block; font-size:1.5rem; margin-bottom:8px; opacity:.3; }

.soc-btn-sm { padding:5px 10px; font-size:11px; font-weight:600; border-radius:6px; cursor:pointer;
              border:1px solid var(--cf-border-default); background:transparent;
              color:var(--cf-text-secondary); transition:all .15s; }
.soc-btn-sm:hover { background:var(--cf-bg-elevated); color:var(--cf-text-primary); }

/* Scrollbar */
.soc-panel-body::-webkit-scrollbar { width:4px; }
.soc-panel-body::-webkit-scrollbar-track { background:transparent; }
.soc-panel-body::-webkit-scrollbar-thumb { background:var(--cf-border-default); border-radius:2px; }
</style>

<div class="soc-root">

  <!-- Header -->
  <div class="soc-header">
    <div class="soc-title-area">
      <h2><i class="fas fa-tower-observation" style="color:var(--cf-interactive-default);margin-right:8px"></i>SOC Command Dashboard</h2>
      <p>Security Operations Center — live intelligence, node grid, correlations &amp; audit trail</p>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="soc-live-badge"><div class="soc-live-dot"></div>LIVE</div>
      <div class="soc-refresh-info">
        <i class="fas fa-rotate" id="soc-spin"></i>
        Refreshing every 30s &bull; <span id="soc-next">30s</span>
      </div>
      <button class="soc-btn-sm" id="soc-refresh-now">
        <i class="fas fa-arrows-rotate"></i> Refresh Now
      </button>
    </div>
  </div>

  <!-- KPI Row -->
  <div class="soc-stats">
    <div class="soc-kpi red">
      <i class="fas fa-triangle-exclamation kpi-icon"></i>
      <div class="kpi-label">Critical Threats</div>
      <div class="kpi-val" id="soc-k-critical">—</div>
      <div class="kpi-sub">last 24h</div>
    </div>
    <div class="soc-kpi amber">
      <i class="fas fa-circle-exclamation kpi-icon"></i>
      <div class="kpi-label">Total Alerts</div>
      <div class="kpi-val" id="soc-k-alerts">—</div>
      <div class="kpi-sub">all severity</div>
    </div>
    <div class="soc-kpi green">
      <i class="fas fa-server kpi-icon"></i>
      <div class="kpi-label">Active Nodes</div>
      <div class="kpi-val" id="soc-k-nodes">—</div>
      <div class="kpi-sub" id="soc-k-nodes-sub">— total</div>
    </div>
    <div class="soc-kpi blue">
      <i class="fas fa-diagram-project kpi-icon"></i>
      <div class="kpi-label">Correlations 24h</div>
      <div class="kpi-val" id="soc-k-corr">—</div>
      <div class="kpi-sub">cross-node</div>
    </div>
    <div class="soc-kpi blue">
      <i class="fas fa-shield-check kpi-icon"></i>
      <div class="kpi-label">Active Policies</div>
      <div class="kpi-val" id="soc-k-policies">—</div>
      <div class="kpi-sub" id="soc-k-policy-actions">— triggers total</div>
    </div>
    <div class="soc-kpi green">
      <i class="fas fa-gauge-high kpi-icon"></i>
      <div class="kpi-label">Avg Risk Score</div>
      <div class="kpi-val" id="soc-k-risk">—</div>
      <div class="kpi-sub">across all nodes</div>
    </div>
  </div>

  <!-- Row 1: Alert Feed + Node Grid -->
  <div class="soc-grid-3">
    <div class="soc-panel">
      <div class="soc-panel-head">
        <h3><i class="fas fa-bell" style="color:var(--cf-status-error);margin-right:6px"></i>Live Alert Feed</h3>
        <span class="count-badge" id="soc-alert-count">0 alerts</span>
      </div>
      <div class="soc-panel-body" id="soc-alert-feed">
        <div class="soc-empty"><i class="fas fa-circle-notch fa-spin"></i>Loading...</div>
      </div>
    </div>

    <div class="soc-panel">
      <div class="soc-panel-head">
        <h3><i class="fas fa-server" style="color:var(--cf-status-success);margin-right:6px"></i>Node Grid</h3>
        <span class="count-badge" id="soc-node-count">0 nodes</span>
      </div>
      <div class="soc-node-grid" id="soc-node-grid">
        <div class="soc-empty" style="grid-column:1/-1"><i class="fas fa-circle-notch fa-spin"></i></div>
      </div>
    </div>
  </div>

  <!-- Row 2: Correlations + Policy Stats + Audit Trail -->
  <div class="soc-grid-2">
    <div class="soc-panel">
      <div class="soc-panel-head">
        <h3><i class="fas fa-arrows-split-up-and-left" style="color:var(--cf-status-warning);margin-right:6px"></i>Cross-Node Correlations</h3>
        <span class="count-badge" id="soc-corr-count">0</span>
      </div>
      <div class="soc-panel-body" id="soc-corr-feed">
        <div class="soc-empty"><i class="fas fa-circle-notch fa-spin"></i>Loading...</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px">
      <!-- Policy Stats -->
      <div class="soc-panel">
        <div class="soc-panel-head">
          <h3><i class="fas fa-shield-check" style="color:var(--cf-interactive-default);margin-right:6px"></i>Policy Activity</h3>
        </div>
        <div id="soc-policy-stats">
          <div class="soc-empty" style="padding:20px"><i class="fas fa-circle-notch fa-spin"></i></div>
        </div>
      </div>

      <!-- Audit Trail -->
      <div class="soc-panel" style="flex:1">
        <div class="soc-panel-head">
          <h3><i class="fas fa-scroll" style="color:var(--cf-status-info);margin-right:6px"></i>Audit Trail</h3>
          <span class="count-badge" id="soc-audit-count">0 entries</span>
        </div>
        <div class="soc-panel-body" id="soc-audit-feed">
          <div class="soc-empty"><i class="fas fa-circle-notch fa-spin"></i>Loading...</div>
        </div>
      </div>
    </div>
  </div>

</div>
`;
    }

    // ── Bind ──────────────────────────────────────────────────────────────────

    _bind() {
        this.container.querySelector('#soc-refresh-now')?.addEventListener('click', () => {
            this._loadAll();
        });
    }

    // ── Load All ──────────────────────────────────────────────────────────────

    async _loadAll() {
        const spin = this.container?.querySelector('#soc-spin');
        if (spin) spin.classList.add('fa-spin');
        await Promise.allSettled([
            this._loadThreatStats(),
            this._loadAlerts(),
            this._loadNodes(),
            this._loadCorrelations(),
            this._loadGlobalMetrics(),
            this._loadPolicyStats(),
            this._loadAuditLog(),
        ]);
        if (spin) spin.classList.remove('fa-spin');
    }

    async _loadThreatStats() {
        try {
            const res = await fetch(`${this.BACKEND}/threats/stats`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) return;
            const json = await res.json();
            const d = json.data || json;
            this._setText('soc-k-critical', d.bySeverity?.critical ?? d.critical ?? 0);
            this._setText('soc-k-alerts', d.total ?? d.totalThreats ?? 0);
        } catch { /* graceful */ }
    }

    async _loadAlerts() {
        try {
            const res = await fetch(`${this.BACKEND}/threats?limit=40`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const alerts = json.data || json.threats || json || [];
            this._renderAlerts(Array.isArray(alerts) ? alerts : []);
        } catch {
            this._renderAlerts([]);
        }
    }

    async _loadNodes() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/nodes/all`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const nodes = json.data?.nodes || json.nodes || [];
            this._renderNodes(nodes);
        } catch {
            this._renderNodes([]);
        }
    }

    async _loadCorrelations() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/correlations?limit=30`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const corrs = json.data?.correlations || json.correlations || [];
            this._renderCorrelations(corrs);
        } catch {
            this._renderCorrelations([]);
        }
    }

    async _loadGlobalMetrics() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/metrics/global`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return;
            const json = await res.json();
            const m = json.data || {};
            this._setText('soc-k-nodes', m.activeNodes ?? '—');
            const el = this.container?.querySelector('#soc-k-nodes-sub');
            if (el) el.textContent = `${m.totalNodes ?? 0} total`;
            this._setText('soc-k-corr', m.correlationCount24h ?? '—');
            this._setText('soc-k-risk', m.avgRiskScore !== undefined ? m.avgRiskScore.toFixed(1) : '—');
        } catch { /* graceful */ }
    }

    async _loadPolicyStats() {
        try {
            const res = await fetch(`${this.BACKEND}/policy/stats`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const s = json.data || {};
            this._setText('soc-k-policies', s.enabledPolicies ?? '—');
            const sub = this.container?.querySelector('#soc-k-policy-actions');
            if (sub) sub.textContent = `${s.totalResponseActions ?? 0} triggers total`;
            this._renderPolicyStats(s.mostTriggered || []);
        } catch {
            this._renderPolicyStats([]);
        }
    }

    async _loadAuditLog() {
        try {
            const res = await fetch(`${this.BACKEND}/audit/logs?limit=30`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const entries = json.entries || [];
            this._renderAuditLog(entries);
        } catch {
            // Show last known entries or empty
            this._renderAuditLog([]);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _renderAlerts(alerts) {
        const feed = this.container?.querySelector('#soc-alert-feed');
        const cnt  = this.container?.querySelector('#soc-alert-count');
        if (!feed) return;
        if (cnt) cnt.textContent = `${alerts.length} alerts`;

        if (!alerts.length) {
            feed.innerHTML = `<div class="soc-empty"><i class="fas fa-check-circle"></i>No active alerts</div>`;
            return;
        }

        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...alerts].sort((a, b) =>
            (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9)
        );

        feed.innerHTML = sorted.map(a => {
            const sev = (a.severity || 'low').toLowerCase();
            const name = this._esc(a.title || a.name || a.type || 'Threat Alert');
            const source = this._esc(a.source || a.domain || a.indicator || '');
            return `<div class="soc-alert-row">
              <div class="sev-dot ${sev}"></div>
              <div class="soc-alert-body">
                <div class="soc-alert-name">${name}</div>
                <div class="soc-alert-meta">
                  <span class="sev-badge sev-${sev}">${sev}</span>
                  ${source ? `&nbsp;<code style="font-size:10px">${source}</code>` : ''}
                </div>
              </div>
              <div class="soc-alert-time">${this._timeSince(a.createdAt || a.timestamp || a.detectedAt)}</div>
            </div>`;
        }).join('');
    }

    _renderNodes(nodes) {
        const grid = this.container?.querySelector('#soc-node-grid');
        const cnt  = this.container?.querySelector('#soc-node-count');
        if (!grid) return;
        if (cnt) cnt.textContent = `${nodes.length} nodes`;

        if (!nodes.length) {
            grid.innerHTML = `<div class="soc-empty" style="grid-column:1/-1"><i class="fas fa-server"></i>No nodes registered</div>`;
            return;
        }

        grid.innerHTML = nodes.map(n => {
            const isOnline = n.isOnline;
            const risk = parseFloat(n.avgRiskScore || 0);
            const riskClass = risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
            const hostname = this._esc(n.hostname || n.nodeId?.slice(0, 8) || 'unknown');
            return `<div class="soc-node-card ${isOnline ? 'online' : 'offline'}">
              <div class="soc-node-online-dot" title="${isOnline ? 'Online' : 'Offline'}"></div>
              <div class="soc-node-icon"><i class="fas fa-${isOnline ? 'circle-check' : 'circle-xmark'}"></i></div>
              <div class="soc-node-name" title="${hostname}">${hostname}</div>
              <div class="soc-node-plat">${this._esc(n.platform || '—')}</div>
              <div class="soc-node-risk">Risk: <span class="r-val ${riskClass}">${risk.toFixed(0)}</span></div>
            </div>`;
        }).join('');
    }

    _renderCorrelations(corrs) {
        const feed = this.container?.querySelector('#soc-corr-feed');
        const cnt  = this.container?.querySelector('#soc-corr-count');
        if (!feed) return;
        if (cnt) cnt.textContent = corrs.length;

        if (!corrs.length) {
            feed.innerHTML = `<div class="soc-empty"><i class="fas fa-network-wired"></i>No cross-node correlations</div>`;
            return;
        }

        const sorted = [...corrs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        feed.innerHTML = sorted.map(c => {
            const sev = parseFloat(c.severity || 0);
            const sevClass = sev >= 80 ? 'critical' : sev >= 50 ? 'high' : sev >= 30 ? 'medium' : 'low';
            return `<div class="soc-corr-row">
              <div class="soc-corr-head">
                <span class="soc-corr-domain">${this._esc(c.affectedDomains?.[0] || 'Unknown domain')}</span>
                <span class="soc-corr-time">${this._timeSince(c.timestamp)}</span>
              </div>
              <div class="soc-corr-desc">${this._esc(c.description || c.patternType || '')}</div>
              <div class="soc-corr-sev">
                <span class="sev-badge sev-${sevClass}">severity: ${sev.toFixed(0)}</span>
                &nbsp;
                <span style="font-size:10.5px;color:var(--cf-text-muted)">${c.affectedNodes?.length ?? 0} nodes</span>
              </div>
            </div>`;
        }).join('');
    }

    _renderPolicyStats(topPolicies) {
        const el = this.container?.querySelector('#soc-policy-stats');
        if (!el) return;

        if (!topPolicies.length) {
            el.innerHTML = `<div class="soc-empty" style="padding:16px"><i class="fas fa-shield-check"></i>No trigger data yet</div>`;
            return;
        }

        el.innerHTML = topPolicies.map(p => `
          <div class="soc-policy-stat">
            <span class="soc-policy-name">${this._esc(p.name)}</span>
            <span class="soc-policy-cnt">${p.triggerCount ?? 0} ×</span>
          </div>
        `).join('');
    }

    _renderAuditLog(entries) {
        const feed = this.container?.querySelector('#soc-audit-feed');
        const cnt  = this.container?.querySelector('#soc-audit-count');
        if (!feed) return;
        if (cnt) cnt.textContent = `${entries.length} entries`;

        if (!entries.length) {
            feed.innerHTML = `<div class="soc-empty"><i class="fas fa-scroll"></i>No audit events recorded</div>`;
            return;
        }

        feed.innerHTML = entries.slice(0, 30).map(e => {
            const outcomeClass = e.outcome === 'failure' ? 'failure' : e.outcome === 'warning' ? 'warning' : 'success';
            const outcomeIcon  = e.outcome === 'failure' ? 'fa-xmark' : e.outcome === 'warning' ? 'fa-triangle-exclamation' : 'fa-check';
            return `<div class="soc-audit-row">
              <div class="soc-audit-icon ${outcomeClass}"><i class="fas ${outcomeIcon}"></i></div>
              <div class="soc-audit-body">
                <div class="soc-audit-action">${this._esc(e.actionLabel || e.action)}</div>
                <div class="soc-audit-user">${this._esc(e.userId)} &bull; ${new Date(e.timestamp).toLocaleString()}</div>
              </div>
            </div>`;
        }).join('');
    }

    // ── Auto Refresh ──────────────────────────────────────────────────────────

    _startAutoRefresh() {
        const INTERVAL = 30;
        this._elapsedSeconds = 0;

        this._countTimer = setInterval(() => {
            if (!this.isActive) return;
            this._elapsedSeconds++;
            const remaining = INTERVAL - (this._elapsedSeconds % INTERVAL);
            this._setText('soc-next', `${remaining}s`);
        }, 1000);

        this._refreshTimer = setInterval(async () => {
            if (!this.isActive) return;
            await this._loadAll();
        }, INTERVAL * 1000);
    }

    _setText(id, val) {
        const el = this.container?.querySelector(`#${id}`);
        if (el) el.textContent = val;
    }
}

window.SOCDashboardScreen = SOCDashboardScreen;
