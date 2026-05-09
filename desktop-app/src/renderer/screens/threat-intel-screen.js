/**
 * Threat Intelligence Screen — CyberForge
 * Live threat feed with IOC lookup and intelligence enrichment.
 */

class ThreatIntelScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.threats = [];
        this.filtered = [];
        this.page = 1;
        this.perPage = 15;
        this.refreshTimer = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadData();
        this.refreshTimer = setInterval(() => { if (this.isActive) this._loadData(); }, 30000);
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
    }

    async _loadData() {
        try {
            const res = await fetch(`${this.BACKEND}/threats?limit=100`, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.threats = json.data?.threats ?? json.threats ?? json.data ?? [];
            this.filtered = [...this.threats];
            this._updateStats();
            this._renderTable();
        } catch {
            this._setStatus(false);
        }
    }

    _updateStats() {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        this.threats.forEach(t => {
            const s = (t.severity || 'low').toLowerCase();
            if (counts[s] !== undefined) counts[s]++;
        });
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('ti-total', this.threats.length);
        set('ti-critical', counts.critical);
        set('ti-high', counts.high);
        set('ti-ioc-count', this.threats.filter(t => t.source?.url || t.sourceUrl).length);
    }

    _renderTable() {
        const tbody = document.getElementById('ti-tbody');
        if (!tbody) return;

        const start = (this.page - 1) * this.perPage;
        const slice = this.filtered.slice(start, start + this.perPage);

        if (!slice.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--cf-text-muted)">
                <i class="fas fa-shield-check" style="font-size:24px;display:block;margin-bottom:8px;color:var(--cf-border-medium)"></i>
                No threat intelligence records found
            </td></tr>`;
            return;
        }

        tbody.innerHTML = slice.map(t => {
            const sev = (t.severity || 'low').toLowerCase();
            const badgeCls = sev === 'critical' || sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'info';
            const source = t.source?.url || t.sourceUrl || t.source || '—';
            const ts = t.detection?.timestamp || t.timestamp || t.createdAt;
            const time = ts ? new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            const status = t.status || 'active';
            const statusCls = status === 'resolved' ? 'success' : status === 'blocked' ? 'info' : 'error';

            return `<tr>
                <td style="font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this._esc(t.type || t.threatType || 'Unknown')}">${this._esc(t.type || t.threatType || 'Unknown')}</td>
                <td><span class="cf-badge ${badgeCls}">${this._esc(sev)}</span></td>
                <td style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this._esc(String(source))}">${this._esc(String(source))}</td>
                <td><span class="cf-badge ${statusCls}">${this._esc(status)}</span></td>
                <td style="font-size:11px;color:var(--cf-text-muted);white-space:nowrap">${time}</td>
                <td>
                    <button class="cf-btn sm" onclick="window.ThreatIntelInstance._enrichIOC('${this._esc(t._id || t.id || '')}','${this._esc(String(source))}')" style="font-size:11px">
                        <i class="fas fa-search"></i> Enrich
                    </button>
                </td>
            </tr>`;
        }).join('');

        const total = document.getElementById('ti-page-info');
        if (total) total.textContent = `Page ${this.page} of ${Math.max(1, Math.ceil(this.filtered.length / this.perPage))}`;
    }

    async _enrichIOC(id, ioc) {
        if (!ioc || ioc === '—') return;
        const panel = document.getElementById('ti-enrich-panel');
        if (!panel) return;
        panel.innerHTML = `<div class="cf-loading"><div class="cf-spinner"></div><span>Enriching IOC...</span></div>`;
        panel.style.display = 'block';

        try {
            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `Analyze this indicator of compromise: ${ioc}`, context: 'ioc_enrichment' }),
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const reply = data.response || data.message || 'No enrichment data available.';
            panel.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--cf-space-3)">
                    <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">
                        <i class="fas fa-microscope" style="color:var(--cf-interactive-default)"></i> IOC Enrichment
                    </span>
                    <button class="cf-btn sm" onclick="document.getElementById('ti-enrich-panel').style.display='none'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted);background:var(--cf-surface-2);padding:var(--cf-space-2) var(--cf-space-3);border-radius:var(--cf-radius-md);margin-bottom:var(--cf-space-3)">${this._esc(ioc)}</div>
                <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.6">${this._esc(reply).replace(/\n/g, '<br>')}</div>
            `;
        } catch {
            panel.innerHTML = `<div style="font-size:var(--cf-text-sm);color:var(--cf-status-error)">
                <i class="fas fa-exclamation-triangle"></i> ML service unavailable — enrichment failed.
                <button class="cf-btn sm" onclick="document.getElementById('ti-enrich-panel').style.display='none'" style="margin-left:var(--cf-space-2)"><i class="fas fa-times"></i></button>
            </div>`;
        }
    }

    async _lookupIOC() {
        const val = document.getElementById('ti-ioc-input')?.value?.trim();
        if (!val) return;
        const btn = document.getElementById('ti-lookup-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
        await this._enrichIOC('manual', val);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Lookup'; }
    }

    _filter() {
        const sev = document.getElementById('ti-filter-sev')?.value || '';
        const search = (document.getElementById('ti-search')?.value || '').toLowerCase();
        this.filtered = this.threats.filter(t => {
            const s = (t.severity || '').toLowerCase();
            const type = (t.type || t.threatType || '').toLowerCase();
            const src = String(t.source?.url || t.sourceUrl || t.source || '').toLowerCase();
            return (!sev || s === sev) && (!search || type.includes(search) || src.includes(search));
        });
        this.page = 1;
        this._renderTable();
    }

    _setStatus(ok) {
        const el = document.getElementById('ti-status');
        if (el) {
            el.textContent = ok ? 'Connected' : 'Offline';
            el.style.color = ok ? 'var(--cf-status-success)' : 'var(--cf-status-error)';
        }
    }

    _bind() {
        window.ThreatIntelInstance = this;
        document.getElementById('ti-search')?.addEventListener('input', () => this._filter());
        document.getElementById('ti-filter-sev')?.addEventListener('change', () => this._filter());
        document.getElementById('ti-lookup-btn')?.addEventListener('click', () => this._lookupIOC());
        document.getElementById('ti-ioc-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._lookupIOC(); });
        document.getElementById('ti-prev')?.addEventListener('click', () => { if (this.page > 1) { this.page--; this._renderTable(); } });
        document.getElementById('ti-next')?.addEventListener('click', () => {
            if (this.page < Math.ceil(this.filtered.length / this.perPage)) { this.page++; this._renderTable(); }
        });
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _shell() {
        return `
<style>
.ti-stat-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:var(--cf-space-4); }
.ti-stat { background:var(--cf-card-bg);border:1px solid var(--cf-card-border);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4) var(--cf-space-5);text-align:center; }
.ti-stat-val { font-size:var(--cf-text-2xl);font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-text-primary); }
.ti-stat-lbl { font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:2px; }
.ti-toolbar { display:flex;gap:var(--cf-space-3);align-items:center;flex-wrap:wrap; }
.ti-input {
    padding:var(--cf-space-2) var(--cf-space-3);background:var(--cf-input-bg);
    border:1px solid var(--cf-input-border);border-radius:var(--cf-radius-md);
    color:var(--cf-text-primary);font-size:var(--cf-text-sm);font-family:var(--cf-font-primary);
    outline:none; transition:border-color 0.15s ease;
}
.ti-input:focus { border-color:var(--cf-interactive-default); }
.ti-input::placeholder { color:var(--cf-text-muted); }
.ti-enrich-panel {
    display:none; background:var(--cf-surface-1);border:1px solid var(--cf-border-light);
    border-radius:var(--cf-radius-lg);padding:var(--cf-space-4);margin-top:var(--cf-space-4);
}
@media(max-width:900px){.ti-stat-grid{grid-template-columns:1fr 1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Threat Intelligence</h1>
            <p class="screen-subtitle">Live IOC feed with AI-powered enrichment — <span id="ti-status" style="color:var(--cf-status-warning)">Connecting...</span></p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn primary" onclick="window.ThreatIntelInstance._loadData()">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        </div>
    </div>

    <!-- Stats -->
    <div class="ti-stat-grid">
        <div class="ti-stat"><div class="ti-stat-val" id="ti-total">—</div><div class="ti-stat-lbl">Total Threats</div></div>
        <div class="ti-stat"><div class="ti-stat-val" style="color:var(--cf-status-error)" id="ti-critical">—</div><div class="ti-stat-lbl">Critical</div></div>
        <div class="ti-stat"><div class="ti-stat-val" style="color:var(--cf-status-warning)" id="ti-high">—</div><div class="ti-stat-lbl">High Severity</div></div>
        <div class="ti-stat"><div class="ti-stat-val" style="color:var(--cf-interactive-default)" id="ti-ioc-count">—</div><div class="ti-stat-lbl">IOCs Tracked</div></div>
    </div>

    <!-- IOC Lookup -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-microscope"></i> IOC Lookup & Enrichment</h3>
        </div>
        <div class="cf-card-body">
            <div class="ti-toolbar">
                <input class="ti-input" id="ti-ioc-input" style="flex:1;min-width:200px" placeholder="IP address, domain, URL, file hash...">
                <button class="cf-btn primary" id="ti-lookup-btn"><i class="fas fa-search"></i> Lookup</button>
            </div>
            <div class="ti-enrich-panel" id="ti-enrich-panel"></div>
        </div>
    </div>

    <!-- Threat Table -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-database"></i> Intelligence Feed</h3>
            <div style="display:flex;gap:var(--cf-space-2);align-items:center">
                <input class="ti-input" id="ti-search" placeholder="Search..." style="width:160px">
                <select class="ti-input" id="ti-filter-sev" style="width:130px">
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
        </div>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:var(--cf-text-sm)">
                <thead>
                    <tr>
                        ${['Threat Type','Severity','IOC / Source','Status','Detected','Actions'].map(h =>
                            `<th style="padding:var(--cf-space-2) var(--cf-space-3);text-align:left;font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);background:var(--cf-table-header-bg);border-bottom:1px solid var(--cf-table-border);white-space:nowrap">${h}</th>`
                        ).join('')}
                    </tr>
                </thead>
                <tbody id="ti-tbody">
                    <tr><td colspan="6" style="text-align:center;padding:40px">
                        <div class="cf-loading"><div class="cf-spinner"></div><span>Loading intelligence feed...</span></div>
                    </td></tr>
                </tbody>
            </table>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--cf-space-3) var(--cf-space-4);border-top:1px solid var(--cf-border-light)">
            <span id="ti-page-info" style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Page 1</span>
            <div style="display:flex;gap:var(--cf-space-2)">
                <button class="cf-btn sm" id="ti-prev"><i class="fas fa-chevron-left"></i></button>
                <button class="cf-btn sm" id="ti-next"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    </div>

</div>`;
    }
}

window.ThreatIntelScreen = ThreatIntelScreen;
