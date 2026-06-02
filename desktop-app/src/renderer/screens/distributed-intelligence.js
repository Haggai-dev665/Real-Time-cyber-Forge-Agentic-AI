/**
 * Distributed Intelligence Screen — CyberForge
 * Multi-node cloud sync, threat correlation, and global metrics.
 * Fetches directly from Heroku backend — no Tauri dependency.
 */

class DistributedIntelligenceScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.refreshTimer = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.data = { nodes: [], metrics: null, correlations: [], weights: null };
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadAll();
        this.refreshTimer = setInterval(() => { if (this.isActive) this._loadAll(); }, 30000);
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
    }

    async _loadAll() {
        await Promise.allSettled([
            this._loadNodes(),
            this._loadMetrics(),
            this._loadCorrelations(),
            this._loadWeights(),
        ]);
    }

    async _loadNodes() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/nodes`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.data.nodes = json.data ?? json.nodes ?? json ?? [];
            this._renderNodes();
            this._updateStatusCards();
        } catch { /* backend may not have distributed routes yet */ }
    }

    async _loadMetrics() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/metrics/global`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.data.metrics = json.data ?? json;
            this._renderMetrics();
            this._renderHeatmap();
        } catch { this._renderMetricsFallback(); }
    }

    async _loadCorrelations() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/correlations`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.data.correlations = json.data ?? json.correlations ?? json ?? [];
            this._renderCorrelations();
        } catch { /* silent */ }
    }

    async _loadWeights() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/weights`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.data.weights = json.data ?? json;
            this._renderWeights();
        } catch { /* silent */ }
    }

    async _syncTelemetry() {
        const btn = document.getElementById('dist-sync-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...'; }
        try {
            const res = await fetch(`${this.BACKEND}/distributed/telemetry/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: this._localNodeId(), timestamp: Date.now() }),
                signal: AbortSignal.timeout(8000),
            });
            const json = await res.json();
            this._showToast(res.ok ? 'Telemetry synced successfully' : `Sync failed: ${json.message || res.status}`, res.ok ? 'success' : 'error');
            if (res.ok) await this._loadAll();
        } catch {
            this._showToast('Sync failed — backend unreachable', 'error');
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sync Now'; }
    }

    async _registerNode() {
        const btn = document.getElementById('dist-register-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        try {
            const res = await fetch(`${this.BACKEND}/distributed/nodes/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: this._localNodeId(), platform: navigator.platform, hostname: location.hostname }),
                signal: AbortSignal.timeout(8000),
            });
            this._showToast(res.ok ? 'Node registered' : 'Registration failed', res.ok ? 'success' : 'error');
            if (res.ok) await this._loadNodes();
        } catch {
            this._showToast('Registration failed — backend unreachable', 'error');
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus-circle"></i> Register Node'; }
    }

    _localNodeId() {
        let id = localStorage.getItem('cf_node_id');
        if (!id) { id = 'node_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('cf_node_id', id); }
        return id;
    }

    _updateStatusCards() {
        const online = this.data.nodes.filter(n => n.isOnline || n.status === 'online').length;
        this._setText('dist-active-nodes', online);
        this._setText('dist-total-nodes', this.data.nodes.length);
        this._setText('dist-sync-count', this.data.metrics?.totalSyncs ?? '—');
        this._setText('dist-node-id', this._localNodeId().slice(0, 10) + '...');
    }

    _renderNodes() {
        const tbody = document.getElementById('dist-nodes-tbody');
        const badge = document.getElementById('nodes-count-badge');
        if (!tbody) return;
        if (badge) badge.textContent = this.data.nodes.length;
        if (!this.data.nodes.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--cf-text-muted)">No nodes registered yet</td></tr>`;
            return;
        }
        tbody.innerHTML = this.data.nodes.map(n => {
            const online = n.isOnline || n.status === 'online';
            return `<tr>
                <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${online ? 'var(--cf-status-success)' : 'var(--cf-status-error)'}"></span></td>
                <td style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted)">${this._esc((n.nodeId || '').slice(0, 12))}...</td>
                <td>${this._esc(n.hostname || '—')}</td>
                <td>${this._esc(n.platform || '—')}</td>
                <td>${n.alertCount ?? 0}</td>
                <td>${(n.avgRiskScore ?? 0).toFixed(1)}</td>
                <td style="font-size:11px;color:var(--cf-text-muted)">${n.lastSeen ? new Date(n.lastSeen).toLocaleTimeString() : '—'}</td>
            </tr>`;
        }).join('');
    }

    _renderMetrics() {
        const m = this.data.metrics;
        if (!m) return;
        this._setText('gm-total-nodes', m.totalNodes ?? 0);
        this._setText('gm-active-nodes', m.activeNodes ?? 0);
        this._setText('gm-alerts-24h', m.totalAlerts24h ?? m.alerts24h ?? 0);
        this._setText('gm-avg-risk', (m.avgRiskScore ?? 0).toFixed(1));
        this._setText('gm-corr-24h', m.correlationCount24h ?? 0);
        this._setText('gm-global-mult', `${(m.globalMultiplier ?? 1.0).toFixed(1)}x`);
        this._setText('gm-last-updated', m.timestamp ? new Date(m.timestamp).toLocaleString() : '—');

        if (m.topThreatDomains?.length) {
            this._renderHeatmapDomains(m.topThreatDomains);
            this._renderThreatDomainsTable(m.topThreatDomains);
        }
    }

    _renderMetricsFallback() {
        const el = document.getElementById('dist-metrics-panel');
        if (el) el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--cf-text-muted)"><i class="fas fa-plug" style="font-size:24px;display:block;margin-bottom:8px"></i>Backend offline — metrics unavailable</div>`;
    }

    _renderHeatmap() {
        const domains = this.data.metrics?.topThreatDomains ?? [];
        this._renderHeatmapDomains(domains);
    }

    _renderHeatmapDomains(domains) {
        const grid = document.getElementById('dist-heatmap-grid');
        if (!grid) return;
        if (!domains.length) {
            grid.innerHTML = `<div style="color:var(--cf-text-muted);text-align:center;padding:40px;grid-column:1/-1">No threat heatmap data</div>`;
            return;
        }
        grid.innerHTML = domains.map(d => {
            const s = d.riskScore ?? 0;
            const col = s >= 80 ? 'var(--cf-status-error)' : s >= 60 ? 'var(--cf-status-warning)' : s >= 40 ? 'var(--cf-interactive-default)' : 'var(--cf-status-success)';
            return `<div style="background:${col};opacity:0.85;border-radius:var(--cf-radius-md);padding:var(--cf-space-2) var(--cf-space-3);cursor:default" title="${this._esc(d.domain)}: ${s.toFixed(0)} risk">
                <div style="font-size:10px;font-weight:var(--cf-weight-semibold);color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${this._esc(d.domain)}</div>
                <div style="font-size:13px;font-weight:var(--cf-weight-bold);color:#fff">${s.toFixed(0)}</div>
            </div>`;
        }).join('');
    }

    _renderThreatDomainsTable(domains) {
        const tbody = document.getElementById('dist-threat-domains-tbody');
        if (!tbody) return;
        tbody.innerHTML = domains.map(d => {
            const s = d.riskScore ?? 0;
            const cls = s >= 80 ? 'error' : s >= 60 ? 'warning' : 'info';
            return `<tr>
                <td style="font-family:var(--cf-font-mono);font-size:11px">${this._esc(d.domain)}</td>
                <td><span class="cf-badge ${cls}">${s.toFixed(0)}</span></td>
                <td>${d.seenByNodes ?? 1}</td>
                <td style="color:var(--cf-text-muted);font-size:11px">${this._esc(d.category || 'unknown')}</td>
            </tr>`;
        }).join('');
    }

    _renderCorrelations() {
        const list = document.getElementById('dist-correlations-list');
        const badge = document.getElementById('corr-count-badge');
        if (!list) return;
        if (badge) badge.textContent = this.data.correlations.length;
        if (!this.data.correlations.length) {
            list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--cf-text-muted)"><i class="fas fa-project-diagram" style="font-size:24px;display:block;margin-bottom:8px"></i>No cross-node correlations detected</div>`;
            return;
        }
        list.innerHTML = this.data.correlations.map(c => {
            const sev = (c.severity || 'low').toLowerCase();
            const cls = sev === 'critical' || sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'info';
            return `<div style="display:flex;align-items:flex-start;gap:var(--cf-space-3);padding:var(--cf-space-3);border-bottom:1px solid var(--cf-border-light)">
                <span class="cf-badge ${cls}" style="flex-shrink:0;margin-top:2px">${this._esc(sev)}</span>
                <div style="flex:1;min-width:0">
                    <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)">${this._esc(c.pattern || c.type || 'Correlation')}</div>
                    <div style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">${this._esc(c.description || '')} · ${c.nodeCount ?? 0} nodes · ${c.matchCount ?? 0} matches</div>
                </div>
                <span style="font-size:10px;color:var(--cf-text-muted);white-space:nowrap">${c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}</span>
            </div>`;
        }).join('');
    }

    _renderWeights() {
        const w = this.data.weights;
        if (!w) return;
        const gm = (w.globalMultiplier ?? 1.0).toFixed(1);
        this._setText('wt-global-multiplier', `${gm}x`);

        const domainMults = w.domainMultipliers ?? {};
        const entries = Object.entries(domainMults);
        this._setText('wt-domain-count', entries.length);
        const tbody = document.getElementById('dist-domain-weights-tbody');
        if (!tbody) return;
        if (!entries.length) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:24px;color:var(--cf-text-muted)">No domain-specific weights</td></tr>`;
            return;
        }
        tbody.innerHTML = entries.sort((a, b) => b[1] - a[1]).map(([domain, mult]) =>
            `<tr>
                <td style="font-family:var(--cf-font-mono);font-size:11px">${this._esc(domain)}</td>
                <td style="font-weight:var(--cf-weight-semibold)">${mult.toFixed(2)}x</td>
            </tr>`
        ).join('');
    }

    _showToast(msg, type = 'info') {
        const t = document.createElement('div');
        const col = type === 'success' ? 'var(--cf-status-success)' : type === 'error' ? 'var(--cf-status-error)' : 'var(--cf-interactive-default)';
        t.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--cf-card-bg);border:1px solid ${col};border-radius:var(--cf-radius-lg);padding:var(--cf-space-3) var(--cf-space-4);color:var(--cf-text-primary);font-size:var(--cf-text-sm);z-index:9999;box-shadow:var(--cf-shadow-lg)`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    _bind() {
        document.getElementById('dist-refresh-btn')?.addEventListener('click', () => this._loadAll());
        document.getElementById('dist-sync-btn')?.addEventListener('click', () => this._syncTelemetry());
        document.getElementById('dist-register-btn')?.addEventListener('click', () => this._registerNode());

        const tabs = this.container?.querySelectorAll('.dist-tab-btn');
        tabs?.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => { t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = 'var(--cf-text-muted)'; });
                btn.classList.add('active');
                btn.style.borderBottomColor = 'var(--cf-interactive-default)';
                btn.style.color = 'var(--cf-text-primary)';
                const id = btn.dataset.tab;
                this.container.querySelectorAll('.dist-tab-pane').forEach(p => {
                    p.style.display = p.id === id ? 'block' : 'none';
                });
            });
        });
    }

    _setText(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _shell() {
        return `
<style>
.dist-stat-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:var(--cf-space-4); }
.dist-stat { background:var(--cf-card-bg);border:1px solid var(--cf-card-border);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4) var(--cf-space-5);text-align:center; }
.dist-stat-val { font-size:var(--cf-text-2xl);font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-text-primary); }
.dist-stat-lbl { font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:2px; }
.dist-tab-bar { display:flex;gap:0;border-bottom:2px solid var(--cf-border-light);margin-bottom:var(--cf-space-4); }
.dist-tab-btn { padding:var(--cf-space-2) var(--cf-space-4);font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);background:none;border:none;border-bottom:2px solid transparent;color:var(--cf-text-muted);cursor:pointer;transition:color 0.15s,border-color 0.15s;margin-bottom:-2px; }
.dist-tab-btn.active { border-bottom-color:var(--cf-interactive-default);color:var(--cf-text-primary); }
.dist-tab-btn:hover:not(.active) { color:var(--cf-text-secondary); }
.dist-heatmap-grid { display:flex;flex-wrap:wrap;gap:var(--cf-space-2); }
@media(max-width:900px){.dist-stat-grid{grid-template-columns:1fr 1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Distributed Intelligence</h1>
            <p class="screen-subtitle">Multi-node cloud sync, threat correlation &amp; global metrics</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn" id="dist-register-btn"><i class="fas fa-plus-circle"></i> Register Node</button>
            <button class="cf-btn" id="dist-refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
            <button class="cf-btn primary" id="dist-sync-btn"><i class="fas fa-cloud-upload-alt"></i> Sync Now</button>
        </div>
    </div>

    <!-- Status Cards -->
    <div class="dist-stat-grid">
        <div class="dist-stat">
            <div class="dist-stat-val" style="font-size:13px;word-break:break-all" id="dist-node-id">—</div>
            <div class="dist-stat-lbl">Local Node ID</div>
        </div>
        <div class="dist-stat">
            <div class="dist-stat-val" id="dist-active-nodes">—</div>
            <div class="dist-stat-lbl">Online Nodes</div>
        </div>
        <div class="dist-stat">
            <div class="dist-stat-val" id="dist-total-nodes">—</div>
            <div class="dist-stat-lbl">Total Nodes</div>
        </div>
        <div class="dist-stat">
            <div class="dist-stat-val" id="dist-sync-count">—</div>
            <div class="dist-stat-lbl">Total Syncs</div>
        </div>
    </div>

    <!-- Tabs -->
    <div class="cf-card">
        <div class="cf-card-body">
            <div class="dist-tab-bar">
                <button class="dist-tab-btn active" data-tab="dist-tab-nodes"><i class="fas fa-server"></i> Nodes</button>
                <button class="dist-tab-btn" data-tab="dist-tab-correlations"><i class="fas fa-project-diagram"></i> Correlations</button>
                <button class="dist-tab-btn" data-tab="dist-tab-heatmap"><i class="fas fa-fire"></i> Heatmap</button>
                <button class="dist-tab-btn" data-tab="dist-tab-metrics"><i class="fas fa-chart-bar"></i> Global Metrics</button>
                <button class="dist-tab-btn" data-tab="dist-tab-weights"><i class="fas fa-balance-scale"></i> Weights</button>
            </div>

            <!-- Nodes Tab -->
            <div id="dist-tab-nodes" class="dist-tab-pane">
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:var(--cf-text-sm)">
                        <thead><tr>
                            ${['','Node ID','Hostname','Platform','Alerts','Avg Risk','Last Seen'].map(h =>
                                `<th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border)">${h}</th>`
                            ).join('')}
                        </tr></thead>
                        <tbody id="dist-nodes-tbody">
                            <tr><td colspan="7" style="text-align:center;padding:40px">
                                <div class="cf-loading"><div class="cf-spinner"></div><span>Loading nodes...</span></div>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);padding:var(--cf-space-2) 0;display:flex;align-items:center;gap:var(--cf-space-2)">
                    <span id="nodes-count-badge" class="cf-badge info">0</span> registered nodes
                </div>
            </div>

            <!-- Correlations Tab -->
            <div id="dist-tab-correlations" class="dist-tab-pane" style="display:none">
                <div style="display:flex;align-items:center;gap:var(--cf-space-2);margin-bottom:var(--cf-space-3)">
                    <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">Cross-Node Correlations</span>
                    <span id="corr-count-badge" class="cf-badge info">0</span>
                </div>
                <div id="dist-correlations-list" style="border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);overflow:hidden">
                    <div class="cf-loading" style="padding:40px"><div class="cf-spinner"></div><span>Loading correlations...</span></div>
                </div>
            </div>

            <!-- Heatmap Tab -->
            <div id="dist-tab-heatmap" class="dist-tab-pane" style="display:none">
                <div style="margin-bottom:var(--cf-space-3)">
                    <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary);margin-bottom:var(--cf-space-2)">Global Threat Heatmap</div>
                    <div class="dist-heatmap-grid" id="dist-heatmap-grid">
                        <div class="cf-loading"><div class="cf-spinner"></div><span>Loading heatmap...</span></div>
                    </div>
                    <div style="display:flex;gap:var(--cf-space-3);margin-top:var(--cf-space-2);flex-wrap:wrap">
                        ${[['Low','var(--cf-status-success)'],['Medium','var(--cf-interactive-default)'],['High','var(--cf-status-warning)'],['Critical','var(--cf-status-error)']].map(([l,c]) =>
                            `<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--cf-text-muted)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c}"></span>${l}</span>`
                        ).join('')}
                    </div>
                </div>
                <div style="overflow-x:auto;margin-top:var(--cf-space-4)">
                    <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Top Threat Domains</div>
                    <table style="width:100%;border-collapse:collapse;font-size:var(--cf-text-sm)">
                        <thead><tr>
                            ${['Domain','Risk Score','Seen By','Category'].map(h =>
                                `<th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border)">${h}</th>`
                            ).join('')}
                        </tr></thead>
                        <tbody id="dist-threat-domains-tbody">
                            <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--cf-text-muted)">No threat domains found</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Global Metrics Tab -->
            <div id="dist-tab-metrics" class="dist-tab-pane" style="display:none" id="dist-metrics-panel">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--cf-space-4);margin-bottom:var(--cf-space-4)">
                    ${[['gm-total-nodes','Total Nodes','fa-server'],['gm-alerts-24h','Alerts (24h)','fa-exclamation-triangle'],['gm-avg-risk','Avg Risk Score','fa-chart-line']].map(([id,lbl,icon]) =>
                        `<div style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4);text-align:center">
                            <i class="fas ${icon}" style="font-size:20px;color:var(--cf-interactive-default);margin-bottom:var(--cf-space-2);display:block"></i>
                            <div style="font-size:var(--cf-text-2xl);font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-text-primary)" id="${id}">—</div>
                            <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:2px">${lbl}</div>
                        </div>`
                    ).join('')}
                </div>
                <div style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4)">
                    ${[['gm-active-nodes','Active Nodes'],['gm-corr-24h','Correlations (24h)'],['gm-global-mult','Global Multiplier'],['gm-last-updated','Last Updated']].map(([id,lbl]) =>
                        `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light)">
                            <span style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)">${lbl}</span>
                            <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)" id="${id}">—</span>
                        </div>`
                    ).join('')}
                </div>
            </div>

            <!-- Weights Tab -->
            <div id="dist-tab-weights" class="dist-tab-pane" style="display:none">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-4)">
                    <div style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-xl);padding:var(--cf-space-5);text-align:center">
                        <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-3)">Global Multiplier</div>
                        <div style="font-size:48px;font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-interactive-default)" id="wt-global-multiplier">1.0x</div>
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:var(--cf-space-2)">Applied to all scores before final output</div>
                    </div>
                    <div>
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--cf-space-3)">
                            <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">Domain Multipliers</span>
                            <span id="wt-domain-count" class="cf-badge info">0</span>
                        </div>
                        <div style="overflow-x:auto">
                            <table style="width:100%;border-collapse:collapse;font-size:var(--cf-text-sm)">
                                <thead><tr>
                                    <th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border)">Domain</th>
                                    <th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border)">Multiplier</th>
                                </tr></thead>
                                <tbody id="dist-domain-weights-tbody">
                                    <tr><td colspan="2" style="text-align:center;padding:24px;color:var(--cf-text-muted)">No domain weights</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>`;
    }
}

window.DistributedIntelligenceScreen = DistributedIntelligenceScreen;
