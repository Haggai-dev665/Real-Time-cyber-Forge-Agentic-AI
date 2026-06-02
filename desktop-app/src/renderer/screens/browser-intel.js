/**
 * Browser Intelligence Screen — CyberForge
 * Live browser session tracking, domain intelligence, and security alerts.
 */

class BrowserIntelScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.refreshTimer = null;
        this.alerts = [];
        this.domains = [];
        this.session = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadAll();
        this.refreshTimer = setInterval(() => { if (this.isActive) this._loadAll(); }, 20000);
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
    }

    async _loadAll() {
        await Promise.allSettled([this._loadSnapshot(), this._loadSession()]);
    }

    async _loadSnapshot() {
        try {
            const res = await fetch(`${this.BACKEND}/browser-intelligence/snapshot`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = json.data ?? json;
            this.alerts = data.alerts ?? data.securityAlerts ?? [];
            this.domains = data.domains ?? data.trackedDomains ?? [];
            this._updateStats(data);
            this._renderAlerts();
            this._renderDomains();
            this._setStatus(true);
        } catch {
            this._setStatus(false);
            this._renderAlertsFallback();
        }
    }

    async _loadSession() {
        try {
            const res = await fetch(`${this.BACKEND}/browser-intelligence/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodeId: this._nodeId(), timestamp: Date.now(), platform: navigator.platform }),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.session = json.data ?? json;
            this._renderSessionInfo();
        } catch { /* session post may not be available */ }
    }

    async _analyzeUrl() {
        const input = document.getElementById('bi-url-input');
        const val = input?.value?.trim();
        if (!val) return;
        const btn = document.getElementById('bi-analyze-btn');
        const panel = document.getElementById('bi-analysis-panel');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        if (panel) { panel.style.display = 'block'; panel.innerHTML = `<div class="cf-loading"><div class="cf-spinner"></div><span>Analyzing domain...</span></div>`; }

        try {
            const res = await fetch(`${this.BACKEND}/analysis/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: val }),
                signal: AbortSignal.timeout(10000),
            });
            const json = await res.json();
            const d = json.data ?? json;
            const score = d.riskScore ?? d.threat_score ?? d.score ?? 0;
            const cls = score >= 70 ? 'error' : score >= 40 ? 'warning' : 'success';
            const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';

            if (panel) panel.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--cf-space-3)">
                    <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">
                        <i class="fas fa-globe" style="color:var(--cf-interactive-default)"></i> Domain Analysis
                    </span>
                    <span class="cf-badge ${cls}">${label} — ${score}</span>
                </div>
                <div style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted);background:var(--cf-surface-2);padding:var(--cf-space-2) var(--cf-space-3);border-radius:var(--cf-radius-md);margin-bottom:var(--cf-space-3)">${this._esc(val)}</div>
                ${d.categories?.length ? `<div style="display:flex;gap:var(--cf-space-2);flex-wrap:wrap;margin-bottom:var(--cf-space-3)">${d.categories.map(c => `<span class="cf-badge info">${this._esc(c)}</span>`).join('')}</div>` : ''}
                ${d.analysis || d.message ? `<div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.6">${this._esc(d.analysis || d.message).replace(/\n/g, '<br>')}</div>` : ''}
            `;

            if (res.ok) this._addToHistory(val, score, label);
        } catch {
            await this._mlFallbackAnalysis(val, panel);
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Analyze'; }
    }

    async _mlFallbackAnalysis(url, panel) {
        try {
            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `Analyze this URL for security threats and browser intelligence: ${url}`, context: 'browser_intelligence' }),
                signal: AbortSignal.timeout(12000),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const reply = data.response || data.message || 'No analysis available.';
            if (panel) panel.innerHTML = `
                <div style="margin-bottom:var(--cf-space-2)">
                    <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)"><i class="fas fa-robot" style="color:var(--cf-interactive-default)"></i> ML Analysis</span>
                </div>
                <div style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted);background:var(--cf-surface-2);padding:var(--cf-space-2) var(--cf-space-3);border-radius:var(--cf-radius-md);margin-bottom:var(--cf-space-3)">${this._esc(url)}</div>
                <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.6">${this._esc(reply).replace(/\n/g, '<br>')}</div>
            `;
        } catch {
            if (panel) panel.innerHTML = `<div style="font-size:var(--cf-text-sm);color:var(--cf-status-error)"><i class="fas fa-exclamation-triangle"></i> Analysis services unavailable.</div>`;
        }
    }

    _addToHistory(url, score, label) {
        const list = document.getElementById('bi-history-list');
        if (!list) return;
        const cls = score >= 70 ? 'error' : score >= 40 ? 'warning' : 'success';
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light);font-size:11px';
        item.innerHTML = `
            <span style="color:var(--cf-text-secondary);font-family:var(--cf-font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px" title="${this._esc(url)}">${this._esc(url)}</span>
            <span class="cf-badge ${cls}" style="flex-shrink:0">${score}</span>
        `;
        const placeholder = list.querySelector('.bi-history-placeholder');
        if (placeholder) placeholder.remove();
        list.prepend(item);
        if (list.children.length > 10) list.lastChild?.remove();
    }

    _updateStats(data) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('bi-total-domains', data.totalDomains ?? this.domains.length);
        set('bi-alert-count', data.totalAlerts ?? this.alerts.length);
        set('bi-high-risk', this.alerts.filter(a => (a.severity || '').match(/high|critical/i)).length);
        set('bi-session-count', data.activeSessions ?? data.sessionCount ?? 1);
    }

    _renderAlerts() {
        const tbody = document.getElementById('bi-alerts-tbody');
        if (!tbody) return;
        if (!this.alerts.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--cf-text-muted)">
                <i class="fas fa-shield-check" style="font-size:24px;display:block;margin-bottom:8px;color:var(--cf-status-success)"></i>No security alerts
            </td></tr>`;
            return;
        }
        tbody.innerHTML = this.alerts.slice(0, 50).map(a => {
            const sev = (a.severity || 'low').toLowerCase();
            const cls = sev === 'critical' || sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'info';
            const ts = a.timestamp || a.createdAt;
            const time = ts ? new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            return `<tr>
                <td><span class="cf-badge ${cls}">${this._esc(sev)}</span></td>
                <td style="font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)">${this._esc(a.type || a.alertType || 'Alert')}</td>
                <td style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(a.domain || a.url || '—')}</td>
                <td style="font-size:11px;color:var(--cf-text-muted)">${time}</td>
                <td><span class="cf-badge ${a.status === 'resolved' ? 'success' : 'error'}">${this._esc(a.status || 'active')}</span></td>
            </tr>`;
        }).join('');
    }

    _renderAlertsFallback() {
        const tbody = document.getElementById('bi-alerts-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--cf-text-muted)">
            <i class="fas fa-plug" style="font-size:24px;display:block;margin-bottom:8px"></i>Backend offline — alerts unavailable
        </td></tr>`;
    }

    _renderDomains() {
        const list = document.getElementById('bi-domains-list');
        if (!list) return;
        if (!this.domains.length) {
            list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--cf-text-muted)">No tracked domains</div>`;
            return;
        }
        list.innerHTML = this.domains.slice(0, 30).map(d => {
            const score = d.riskScore ?? d.score ?? 0;
            const col = score >= 70 ? 'var(--cf-status-error)' : score >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
            const cls = score >= 70 ? 'error' : score >= 40 ? 'warning' : 'success';
            return `<div style="display:flex;align-items:center;gap:var(--cf-space-3);padding:var(--cf-space-2) var(--cf-space-3);border-bottom:1px solid var(--cf-border-light)">
                <div style="width:32px;height:32px;border-radius:var(--cf-radius-lg);background:var(--cf-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <i class="fas fa-globe" style="font-size:12px;color:${col}"></i>
                </div>
                <div style="flex:1;min-width:0">
                    <div style="font-family:var(--cf-font-mono);font-size:12px;font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this._esc(d.domain || d.hostname || '—')}</div>
                    <div style="font-size:10px;color:var(--cf-text-muted)">${this._esc(d.category || 'unknown')} · ${d.visits ?? 0} visits</div>
                </div>
                <span class="cf-badge ${cls}" style="flex-shrink:0">${score}</span>
            </div>`;
        }).join('');
    }

    _renderSessionInfo() {
        const el = document.getElementById('bi-session-info');
        if (!el || !this.session) return;
        const s = this.session;
        el.innerHTML = [
            ['Session ID', s.sessionId || s.id || this._nodeId()],
            ['Started', s.startedAt ? new Date(s.startedAt).toLocaleString() : 'Now'],
            ['Requests', s.requestCount ?? 0],
            ['Blocked', s.blockedCount ?? 0],
            ['Node', s.nodeId || this._nodeId()],
        ].map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light)">
                <span style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)">${k}</span>
                <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);font-family:var(--cf-font-mono)">${this._esc(String(v))}</span>
            </div>
        `).join('');
    }

    _setStatus(ok) {
        const el = document.getElementById('bi-status');
        if (el) {
            el.textContent = ok ? 'Connected' : 'Offline';
            el.style.color = ok ? 'var(--cf-status-success)' : 'var(--cf-status-error)';
        }
    }

    _nodeId() {
        let id = localStorage.getItem('cf_node_id');
        if (!id) { id = 'node_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('cf_node_id', id); }
        return id;
    }

    _bind() {
        document.getElementById('bi-analyze-btn')?.addEventListener('click', () => this._analyzeUrl());
        document.getElementById('bi-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._analyzeUrl(); });
        document.getElementById('bi-refresh-btn')?.addEventListener('click', () => this._loadAll());

        const tabs = this.container?.querySelectorAll('.bi-tab-btn');
        tabs?.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => { t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = 'var(--cf-text-muted)'; });
                btn.classList.add('active');
                btn.style.borderBottomColor = 'var(--cf-interactive-default)';
                btn.style.color = 'var(--cf-text-primary)';
                const id = btn.dataset.tab;
                this.container.querySelectorAll('.bi-tab-pane').forEach(p => {
                    p.style.display = p.id === id ? 'block' : 'none';
                });
            });
        });
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _shell() {
        return `
<style>
.bi-stat-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:var(--cf-space-4); }
.bi-stat { background:var(--cf-card-bg);border:1px solid var(--cf-card-border);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4) var(--cf-space-5);text-align:center; }
.bi-stat-val { font-size:var(--cf-text-2xl);font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-text-primary); }
.bi-stat-lbl { font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:2px; }
.bi-tab-bar { display:flex;gap:0;border-bottom:2px solid var(--cf-border-light);margin-bottom:var(--cf-space-4); }
.bi-tab-btn { padding:var(--cf-space-2) var(--cf-space-4);font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);background:none;border:none;border-bottom:2px solid transparent;color:var(--cf-text-muted);cursor:pointer;transition:color 0.15s,border-color 0.15s;margin-bottom:-2px; }
.bi-tab-btn.active { border-bottom-color:var(--cf-interactive-default);color:var(--cf-text-primary); }
.bi-tab-btn:hover:not(.active) { color:var(--cf-text-secondary); }
.bi-url-input {
    flex:1;min-width:200px;padding:var(--cf-space-2) var(--cf-space-3);
    background:var(--cf-input-bg);border:1px solid var(--cf-input-border);border-radius:var(--cf-radius-md);
    color:var(--cf-text-primary);font-size:var(--cf-text-sm);font-family:var(--cf-font-primary);outline:none;transition:border-color 0.15s;
}
.bi-url-input:focus { border-color:var(--cf-interactive-default); }
.bi-url-input::placeholder { color:var(--cf-text-muted); }
.bi-analysis-panel { display:none;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4);margin-top:var(--cf-space-3); }
@media(max-width:900px){.bi-stat-grid{grid-template-columns:1fr 1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Browser Intelligence</h1>
            <p class="screen-subtitle">Session tracking, domain intelligence &amp; security alerts — <span id="bi-status" style="color:var(--cf-status-warning)">Connecting...</span></p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn primary" id="bi-refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
    </div>

    <!-- Stats -->
    <div class="bi-stat-grid">
        <div class="bi-stat"><div class="bi-stat-val" id="bi-total-domains">—</div><div class="bi-stat-lbl">Tracked Domains</div></div>
        <div class="bi-stat"><div class="bi-stat-val" style="color:var(--cf-status-error)" id="bi-alert-count">—</div><div class="bi-stat-lbl">Security Alerts</div></div>
        <div class="bi-stat"><div class="bi-stat-val" style="color:var(--cf-status-warning)" id="bi-high-risk">—</div><div class="bi-stat-lbl">High Risk Alerts</div></div>
        <div class="bi-stat"><div class="bi-stat-val" style="color:var(--cf-interactive-default)" id="bi-session-count">—</div><div class="bi-stat-lbl">Active Sessions</div></div>
    </div>

    <!-- URL Analysis -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-search"></i> Domain / URL Analysis</h3>
        </div>
        <div class="cf-card-body">
            <div style="display:flex;gap:var(--cf-space-3);align-items:center;flex-wrap:wrap">
                <input class="bi-url-input" id="bi-url-input" placeholder="Enter domain or URL to analyze...">
                <button class="cf-btn primary" id="bi-analyze-btn"><i class="fas fa-search"></i> Analyze</button>
            </div>
            <div class="bi-analysis-panel" id="bi-analysis-panel" style="display:none"></div>
        </div>
    </div>

    <!-- Main Panel -->
    <div style="display:grid;grid-template-columns:1fr 280px;gap:var(--cf-space-4);align-items:start">

        <!-- Tabs -->
        <div class="cf-card">
            <div class="cf-card-body">
                <div class="bi-tab-bar">
                    <button class="bi-tab-btn active" data-tab="bi-tab-alerts"><i class="fas fa-exclamation-triangle"></i> Alerts</button>
                    <button class="bi-tab-btn" data-tab="bi-tab-domains"><i class="fas fa-globe"></i> Domains</button>
                    <button class="bi-tab-btn" data-tab="bi-tab-session"><i class="fas fa-id-badge"></i> Session</button>
                </div>

                <!-- Alerts Tab -->
                <div id="bi-tab-alerts" class="bi-tab-pane">
                    <div style="overflow-x:auto">
                        <table style="width:100%;border-collapse:collapse;font-size:var(--cf-text-sm)">
                            <thead><tr>
                                ${['Severity','Type','Domain / URL','Detected','Status'].map(h =>
                                    `<th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border);white-space:nowrap">${h}</th>`
                                ).join('')}
                            </tr></thead>
                            <tbody id="bi-alerts-tbody">
                                <tr><td colspan="5" style="text-align:center;padding:40px">
                                    <div class="cf-loading"><div class="cf-spinner"></div><span>Loading alerts...</span></div>
                                </td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Domains Tab -->
                <div id="bi-tab-domains" class="bi-tab-pane" style="display:none">
                    <div id="bi-domains-list" style="border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);overflow:hidden">
                        <div class="cf-loading" style="padding:40px"><div class="cf-spinner"></div><span>Loading domains...</span></div>
                    </div>
                </div>

                <!-- Session Tab -->
                <div id="bi-tab-session" class="bi-tab-pane" style="display:none">
                    <div id="bi-session-info" style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4)">
                        <div style="display:flex;justify-content:space-between;padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light)">
                            <span style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)">Session ID</span>
                            <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);font-family:var(--cf-font-mono)">${localStorage.getItem('cf_node_id') || 'pending...'}</span>
                        </div>
                        <div style="text-align:center;padding:var(--cf-space-4);color:var(--cf-text-muted);font-size:var(--cf-text-sm)">
                            <div class="cf-loading"><div class="cf-spinner"></div><span>Establishing session...</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sidebar: History -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title" style="font-size:var(--cf-text-sm)"><i class="fas fa-history"></i> Analysis History</h3>
            </div>
            <div class="cf-card-body" style="padding:var(--cf-space-2)">
                <div id="bi-history-list">
                    <div class="bi-history-placeholder" style="text-align:center;padding:24px;color:var(--cf-text-muted);font-size:var(--cf-text-xs)">
                        <i class="fas fa-clock" style="display:block;font-size:20px;margin-bottom:8px;color:var(--cf-border-medium)"></i>
                        No analyses yet
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>`;
    }
}

window.BrowserIntelScreen = BrowserIntelScreen;
