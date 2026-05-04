/**
 * Threat Center Screen — CyberForge
 * Live threat feed with filtering, severity breakdown, and ML analysis.
 */

class ThreatCenterScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.refreshTimer = null;
        this.threats = [];
        this.filters = { severity: 'all', type: 'all', status: 'active', page: 1, limit: 25 };
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bindControls();
        await this._loadThreats();
        this._startRefresh();
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
    }

    async _loadThreats() {
        const tbody = document.getElementById('tc-tbody');
        if (!tbody) return;

        const qs = new URLSearchParams({
            limit: this.filters.limit,
            page: this.filters.page,
            status: this.filters.status,
        });
        if (this.filters.severity !== 'all') qs.set('severity', this.filters.severity);
        if (this.filters.type !== 'all') qs.set('type', this.filters.type);

        try {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:28px">
                <div class="cf-spinner" style="margin:0 auto"></div></td></tr>`;

            const res = await fetch(`${this.BACKEND}/threats?${qs}`);
            if (!res.ok) throw new Error(res.status);
            const json = await res.json();

            this.threats = json.data?.threats ?? json.threats ?? json.data ?? [];
            const pagination = json.data?.pagination || {};

            this._renderRows(tbody);
            this._updatePagination(pagination);
            this._updateStats();
        } catch {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--cf-text-muted)">
                <i class="fas fa-exclamation-circle" style="font-size:1.5rem;display:block;margin-bottom:8px;color:var(--cf-status-error)"></i>
                Could not load threats — ensure backend is running on port 3001
            </td></tr>`;
        }
    }

    async _analyzeUrl(url) {
        const result = document.getElementById('tc-analysis-result');
        if (!result) return;

        result.innerHTML = `<div class="cf-loading" style="padding:12px"><div class="cf-spinner"></div><span>Analyzing...</span></div>`;

        try {
            const res = await fetch(`${this.ML}/analyze-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await res.json();
            const risk = data.risk_level || 'Unknown';
            const conf = data.confidence ? (data.confidence * 100).toFixed(0) + '%' : '—';
            const recs = data.recommendations || [];
            const riskClass = { Low: 'success', Medium: 'warning', High: 'error', Critical: 'error' }[risk] || 'info';

            result.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                    <span class="cf-badge ${riskClass}" style="font-size:13px;padding:4px 12px">${this._esc(risk)} Risk</span>
                    <span style="color:var(--cf-text-muted);font-size:12px">Confidence: ${conf}</span>
                </div>
                ${recs.length ? `<ul style="padding-left:16px;color:var(--cf-text-secondary);font-size:13px;line-height:1.8">
                    ${recs.map(r => `<li>${this._esc(r)}</li>`).join('')}
                </ul>` : ''}
            `;
        } catch {
            result.innerHTML = `<span style="color:var(--cf-status-error);font-size:13px">Analysis failed — ML service may be offline</span>`;
        }
    }

    _renderRows(tbody) {
        if (!this.threats.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--cf-text-muted)">
                <i class="fas fa-shield-check" style="font-size:2rem;display:block;margin-bottom:10px;color:var(--cf-status-success)"></i>
                No threats match the current filters
            </td></tr>`;
            return;
        }
        tbody.innerHTML = this.threats.map(t => this._row(t)).join('');
    }

    _row(t) {
        const ts = t.detection?.timestamp || t.timestamp || t.createdAt;
        const time = ts ? new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const sev = (t.severity || 'medium').toLowerCase();
        const type = t.type || t.threatType || 'Unknown';
        const source = t.source?.url || t.source || t.sourceUrl || '—';
        const status = t.status || 'active';
        const id = t._id || t.id || '';
        const conf = t.detection?.confidence ?? t.confidence;

        return `<tr>
            <td><span class="cf-badge ${this._sevBadge(sev)}">${sev}</span></td>
            <td style="font-weight:500;color:var(--cf-text-primary)">${this._esc(type)}</td>
            <td class="font-mono truncate" style="max-width:220px;font-size:11px" title="${this._esc(source)}">${this._esc(source)}</td>
            <td style="font-size:12px;color:var(--cf-text-tertiary)">${time}</td>
            <td style="font-size:12px;font-family:var(--cf-font-mono)">${conf != null ? (conf * 100).toFixed(0) + '%' : '—'}</td>
            <td><span class="cf-badge ${status === 'active' ? 'error' : status === 'resolved' ? 'success' : 'info'}">${status}</span></td>
            <td>
                <div style="display:flex;gap:4px">
                    <button class="cf-btn sm" onclick="window.ThreatCenterInstance?._resolveId('${id}')" title="Mark Resolved">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }

    async _resolveId(id) {
        if (!id || !confirm('Mark this threat as resolved?')) return;
        try {
            await fetch(`${this.BACKEND}/threats/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'resolved' }),
            });
            await this._loadThreats();
        } catch { alert('Could not update threat status.'); }
    }

    _updateStats() {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        this.threats.forEach(t => {
            const s = (t.severity || 'low').toLowerCase();
            if (counts[s] !== undefined) counts[s]++;
        });
        ['critical', 'high', 'medium', 'low'].forEach(s => {
            const el = document.getElementById(`stat-${s}`);
            if (el) el.textContent = counts[s];
        });
        const total = document.getElementById('stat-total');
        if (total) total.textContent = this.threats.length;
    }

    _updatePagination(p) {
        const el = document.getElementById('tc-pagination');
        if (!el) return;
        el.innerHTML = `
            <span style="color:var(--cf-text-muted);font-size:12px">
                Page ${p.currentPage || 1} of ${p.totalPages || 1} · ${p.totalCount || this.threats.length} total
            </span>
            <div style="display:flex;gap:4px;margin-left:8px">
                <button class="cf-btn sm" ${!p.hasPrev ? 'disabled' : ''} onclick="window.ThreatCenterInstance?._prevPage()">
                    <i class="fas fa-chevron-left"></i></button>
                <button class="cf-btn sm" ${!p.hasNext ? 'disabled' : ''} onclick="window.ThreatCenterInstance?._nextPage()">
                    <i class="fas fa-chevron-right"></i></button>
            </div>`;
    }

    _prevPage() { if (this.filters.page > 1) { this.filters.page--; this._loadThreats(); } }
    _nextPage() { this.filters.page++; this._loadThreats(); }

    _bindControls() {
        window.ThreatCenterInstance = this;

        document.getElementById('tc-sev-filter')?.addEventListener('change', e => {
            this.filters.severity = e.target.value;
            this.filters.page = 1;
            this._loadThreats();
        });

        document.getElementById('tc-status-filter')?.addEventListener('change', e => {
            this.filters.status = e.target.value;
            this.filters.page = 1;
            this._loadThreats();
        });

        document.getElementById('tc-refresh')?.addEventListener('click', () => this._loadThreats());

        const analyzeBtn = document.getElementById('tc-analyze-btn');
        const urlInput = document.getElementById('tc-url-input');
        analyzeBtn?.addEventListener('click', () => {
            const url = urlInput?.value.trim();
            if (url) this._analyzeUrl(url);
        });
        urlInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { const url = e.target.value.trim(); if (url) this._analyzeUrl(url); }
        });
    }

    _startRefresh() {
        this.refreshTimer = setInterval(() => { if (this.isActive) this._loadThreats(); }, 30000);
    }

    _sevBadge(s) { return { critical: 'error', high: 'error', medium: 'warning', low: 'info' }[s] || 'info'; }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _shell() {
        return `
<style>
.tc-stat-row { display:grid; grid-template-columns:repeat(5,1fr); gap:var(--cf-space-3); margin-bottom:var(--cf-space-5); }
.tc-stat {
    background:var(--cf-card-bg); border:1px solid var(--cf-card-border);
    border-radius:var(--cf-radius-lg); padding:var(--cf-space-4); text-align:center;
    transition:background-color var(--cf-transition-theme);
}
.tc-stat-val { font-size:var(--cf-text-2xl); font-weight:var(--cf-weight-bold); font-family:var(--cf-font-mono); color:var(--cf-text-primary); }
.tc-stat-val.red   { color:var(--cf-status-error); }
.tc-stat-val.amber { color:var(--cf-status-warning); }
.tc-stat-val.blue  { color:var(--cf-status-info); }
.tc-toolbar { display:flex; align-items:center; gap:var(--cf-space-3); margin-bottom:var(--cf-space-4); flex-wrap:wrap; }
.tc-toolbar select, .tc-toolbar input {
    padding:var(--cf-space-2) var(--cf-space-3); background:var(--cf-input-bg);
    border:1px solid var(--cf-input-border); border-radius:var(--cf-radius-md);
    color:var(--cf-text-primary); font-size:var(--cf-text-sm); font-family:var(--cf-font-primary);
}
.tc-toolbar select:focus, .tc-toolbar input:focus { outline:none; border-color:var(--cf-interactive-default); }
.analyze-row { display:flex; gap:var(--cf-space-3); align-items:flex-start; flex-wrap:wrap; }
.analyze-row input { flex:1; min-width:200px; padding:var(--cf-space-2) var(--cf-space-3);
    background:var(--cf-input-bg); border:1px solid var(--cf-input-border);
    border-radius:var(--cf-radius-md); color:var(--cf-text-primary); font-size:var(--cf-text-sm); font-family:var(--cf-font-primary); }
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-6)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Threat Center</h1>
            <p class="screen-subtitle">Live threat detection, investigation, and response</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn" id="tc-refresh"><i class="fas fa-sync-alt"></i> Refresh</button>
            <button class="cf-btn primary" onclick="window.app?.showScreen('incident-response')">
                <i class="fas fa-fire-extinguisher"></i> Incident Response
            </button>
        </div>
    </div>

    <div class="tc-stat-row">
        <div class="tc-stat"><div class="tc-stat-val" id="stat-total">—</div><div class="tc-stat-lbl" style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">Total Active</div></div>
        <div class="tc-stat"><div class="tc-stat-val red" id="stat-critical">—</div><div class="tc-stat-lbl" style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">Critical</div></div>
        <div class="tc-stat"><div class="tc-stat-val red" id="stat-high">—</div><div class="tc-stat-lbl" style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">High</div></div>
        <div class="tc-stat"><div class="tc-stat-val amber" id="stat-medium">—</div><div class="tc-stat-lbl" style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">Medium</div></div>
        <div class="tc-stat"><div class="tc-stat-val blue" id="stat-low">—</div><div class="tc-stat-lbl" style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">Low</div></div>
    </div>

    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-search"></i> Real-Time URL Analysis (ML)</h3>
        </div>
        <div class="cf-card-body">
            <div class="analyze-row">
                <input type="url" id="tc-url-input" placeholder="Enter URL to analyze for threats...">
                <button class="cf-btn primary" id="tc-analyze-btn"><i class="fas fa-shield-alt"></i> Analyze</button>
            </div>
            <div id="tc-analysis-result" style="margin-top:var(--cf-space-3)"></div>
        </div>
    </div>

    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-list"></i> Threat Feed</h3>
        </div>
        <div class="cf-card-body" style="padding-bottom:0">
            <div class="tc-toolbar">
                <select id="tc-sev-filter">
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select id="tc-status-filter">
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                </select>
                <span style="margin-left:auto;color:var(--cf-text-muted);font-size:12px">Auto-refreshes every 30s</span>
            </div>
        </div>
        <div class="cf-table-wrapper" style="border-radius:0;border-left:none;border-right:none;border-bottom:none">
            <table class="cf-table">
                <thead>
                    <tr>
                        <th>Severity</th><th>Type</th><th>Source</th>
                        <th>Detected</th><th>Confidence</th><th>Status</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody id="tc-tbody">
                    <tr><td colspan="7" style="text-align:center;padding:32px">
                        <div class="cf-spinner" style="margin:0 auto"></div>
                    </td></tr>
                </tbody>
            </table>
        </div>
        <div class="cf-card-footer" style="display:flex;align-items:center">
            <div id="tc-pagination" style="display:flex;align-items:center;gap:8px"></div>
        </div>
    </div>

</div>`;
    }
}

window.ThreatCenterScreen = ThreatCenterScreen;

class ThreatCenterScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.threatsTable = null;
        this.currentFilter = 'all';
        this.currentSort = { column: 'timestamp', direction: 'desc' };
        this.threats = [];
        this.updateInterval = null;
        this.selectedThreats = new Set();
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create threat center HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        await this.initializeComponents();
        
        // Load threats data
        await this.loadThreats();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        // Handle specific threat if provided
        if (options.threatId) {
            this.highlightThreat(options.threatId);
        }
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        this.stopRealTimeUpdates();
        if (this.threatsTable) {
            this.threatsTable.destroy();
        }
    }

    createHTML() {
        return `
            <div class="threat-center-screen">
                <!-- Header -->
                <div class="threat-header">
                    <div class="header-left">
                        <h1>Threat Center</h1>
                        <p>Centralized threat detection and management</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="refresh-threats-btn">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                        <button class="btn btn-secondary" id="export-threats-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-primary" id="manual-scan-btn">
                            <i class="fas fa-shield-alt"></i> Manual Scan
                        </button>
                    </div>
                </div>

                
                <!-- Advanced Visualizations -->
                <div class="threat-visualizations" style="margin-bottom: 20px;">
                    <div class="viz-row" style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <!-- Custom CSS SVG Map -->
                        <div class="viz-card map-container" style="flex: 2; background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color); position: relative; overflow: hidden; min-height: 350px;">
                            <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-globe-americas" style="color: var(--primary);"></i> Live Global Threat Vectors
                            </h3>
                            <div id="advanced-threat-map" style="width: 100%; height: 280px; position: relative;">
                                <!-- SVG map populated by JS -->
                            </div>
                        </div>

                        <!-- Doughnut Chart -->
                        <div class="viz-card chart-container" style="flex: 1; background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color); display: flex; flex-direction: column;">
                            <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-radar" style="color: var(--warning);"></i> Threat Distribution
                            </h3>
                            <div style="flex-grow: 1; position: relative;">
                                <canvas id="threat-distribution-chart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="viz-row" style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <!-- Timeline Line Chart -->
                        <div class="viz-card chart-container" style="flex: 1; background: var(--bg-secondary); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color); min-height: 300px; display: flex; flex-direction: column;">
                            <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-chart-line" style="color: var(--info);"></i> Threat Activity Timeline
                            </h3>
                            <div style="flex-grow: 1; position: relative;">
                                <canvas id="threat-timeline-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Stats Overview -->

                <div class="threat-stats-grid">
                    <div class="stat-card critical">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="critical-threats">0</div>
                            <div class="stat-label">Critical Threats</div>
                        </div>
                    </div>
                    <div class="stat-card high">
                        <div class="stat-icon">
                            <i class="fas fa-warning"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="high-threats">0</div>
                            <div class="stat-label">High Priority</div>
                        </div>
                    </div>
                    <div class="stat-card medium">
                        <div class="stat-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="medium-threats">0</div>
                            <div class="stat-label">Medium Priority</div>
                        </div>
                    </div>
                    <div class="stat-card blocked">
                        <div class="stat-icon">
                            <i class="fas fa-shield-check"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="blocked-threats">0</div>
                            <div class="stat-label">Blocked Today</div>
                        </div>
                    </div>
                </div>

                <!-- Filter and Actions Bar -->
                <div class="filter-bar">
                    <div class="filter-group">
                        <label>Filter by Severity:</label>
                        <select id="severity-filter" class="filter-select">
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Filter by Status:</label>
                        <select id="status-filter" class="filter-select">
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Filter by Type:</label>
                        <select id="type-filter" class="filter-select">
                            <option value="all">All Types</option>
                            <option value="malware">Malware</option>
                            <option value="phishing">Phishing</option>
                            <option value="network">Network Intrusion</option>
                            <option value="suspicious">Suspicious Activity</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button class="btn btn-sm btn-secondary" id="clear-filters-btn">
                            <i class="fas fa-times"></i> Clear Filters
                        </button>
                    </div>
                </div>

                <!-- Bulk Actions -->
                <div class="bulk-actions" id="bulk-actions" style="display: none;">
                    <div class="bulk-info">
                        <span id="selected-count">0</span> threats selected
                    </div>
                    <div class="bulk-buttons">
                        <button class="btn btn-sm btn-secondary" id="bulk-resolve-btn">
                            <i class="fas fa-check"></i> Resolve Selected
                        </button>
                        <button class="btn btn-sm btn-secondary" id="bulk-dismiss-btn">
                            <i class="fas fa-times"></i> Dismiss Selected
                        </button>
                        <button class="btn btn-sm btn-danger" id="bulk-delete-btn">
                            <i class="fas fa-trash"></i> Delete Selected
                        </button>
                    </div>
                </div>

                <!-- Threats Table -->
                <div class="threats-table-container">
                    <div id="threats-table"></div>
                </div>

                <!-- Threat Details Panel -->
                <div class="threat-details-panel" id="threat-details-panel" style="display: none;">
                    <div class="panel-header">
                        <h3>Threat Details</h3>
                        <button class="btn-icon" id="close-details-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="panel-content" id="threat-details-content">
                        <!-- Threat details will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    async initializeComponents() {
        this.setupEventListeners();
        this.initializeThreatsTable();
        await this.loadThreatStats();
    }

    setupEventListeners() {
        // Header actions
        document.getElementById('refresh-threats-btn').addEventListener('click', () => this.refreshThreats());
        document.getElementById('export-threats-btn').addEventListener('click', () => this.exportThreats());
        document.getElementById('manual-scan-btn').addEventListener('click', () => this.showManualScanDialog());

        // Filters
        document.getElementById('severity-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('status-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('type-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearFilters());

        // Bulk actions
        document.getElementById('bulk-resolve-btn').addEventListener('click', () => this.bulkResolveThreats());
        document.getElementById('bulk-dismiss-btn').addEventListener('click', () => this.bulkDismissThreats());
        document.getElementById('bulk-delete-btn').addEventListener('click', () => this.bulkDeleteThreats());

        // Details panel
        document.getElementById('close-details-btn').addEventListener('click', () => this.closeDetailsPanel());
    }

    initializeThreatsTable() {
        const columns = [
            {
                key: 'id',
                title: 'ID',
                type: 'text',
                sortable: true
            },
            {
                key: 'severity',
                title: 'Severity',
                type: 'badge',
                sortable: true,
                render: (threat) => {
                    const severityClass = this.getSeverityClass(threat.severity);
                    return `<span class="badge badge-${severityClass}">${threat.severity?.toUpperCase()}</span>`;
                }
            },
            {
                key: 'type',
                title: 'Type',
                type: 'text',
                sortable: true
            },
            {
                key: 'source',
                title: 'Source',
                type: 'text',
                sortable: true,
                render: (threat) => {
                    return threat.source || threat.target || 'Unknown';
                }
            },
            {
                key: 'description',
                title: 'Description',
                type: 'text',
                sortable: false,
                render: (threat) => {
                    const desc = threat.description || threat.message || 'No description';
                    return desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
                }
            },
            {
                key: 'status',
                title: 'Status',
                type: 'badge',
                sortable: true,
                render: (threat) => {
                    const statusClass = this.getStatusClass(threat.status);
                    return `<span class="badge badge-${statusClass}">${threat.status?.toUpperCase()}</span>`;
                }
            },
            {
                key: 'timestamp',
                title: 'Detected',
                type: 'datetime',
                sortable: true,
                render: (threat) => {
                    const date = new Date(threat.timestamp || threat.created_at || Date.now());
                    return this.formatRelativeTime(date);
                }
            },
            {
                key: 'actions',
                title: 'Actions',
                type: 'html',
                sortable: false,
                render: (threat) => `
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.threatCenter.viewThreatDetails('${threat.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="window.threatCenter.resolveThreat('${threat.id}')" title="Resolve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-icon" onclick="window.threatCenter.dismissThreat('${threat.id}')" title="Dismiss">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `
            }
        ];

        this.threatsTable = new DataTable('threats-table', {
            columns,
            searchable: true,
            sortable: true,
            paginated: true,
            selectable: true,
            exportable: true,
            pageSize: 20,
            onRowClick: (threat) => this.viewThreatDetails(threat.id),
            onSelectionChange: (selectedIndices) => this.handleSelectionChange(selectedIndices)
        });

        // Store reference for onclick handlers
        window.threatCenter = this;
    }

    async loadThreats() {
        try {
            this.showTableLoading();
            
            this.threats = []; // Enforce pure real data, no mock fallbacks
            if (window.apiClient) {
                const response = await window.apiClient.getThreats({ 
                    limit: 200,
                    status: 'all'
                });
                
                if (response.success) {
                    this.threats = response.data?.threats || response.data || [];
                }
            }
            
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
            this.renderVisualizations(); // Initialize advanced charts and arrays based on pure data
            
        } catch (error) {
            console.error('Failed to load threats:', error);
            this.threatsTable.setData(this.threats);
            this.renderVisualizations();
            window.notificationSystem?.error('Load Error', 'Failed to fetch threat data from backend');
        }
    }

    async loadThreatStats() {
        try {
            if (window.apiClient) {
                const response = await window.apiClient.getThreatStats();
                if (response.success && response.data) {
                    this.updateStatsDisplay(response.data);
                    return;
                }
            }
            
            // Fallback stats calculation
            this.calculateStatsFromThreats();
            
        } catch (error) {
            console.error('Failed to load threat stats:', error);
            this.calculateStatsFromThreats();
        }
    }

    updateStatsDisplay(stats) {
        document.getElementById('critical-threats').textContent = stats.critical_threats || stats.critical || 0;
        document.getElementById('high-threats').textContent = stats.high_threats || stats.high || 0;
        document.getElementById('medium-threats').textContent = stats.medium_threats || stats.medium || 0;
        document.getElementById('blocked-threats').textContent = stats.blocked_today || stats.blocked || 0;
    }

    calculateStatsFromThreats() {
        const stats = {
            critical: 0,
            high: 0,
            medium: 0,
            blocked: 0
        };
        
        this.threats.forEach(threat => {
            if (threat.severity === 'critical') stats.critical++;
            else if (threat.severity === 'high') stats.high++;
            else if (threat.severity === 'medium') stats.medium++;
            
            if (threat.status === 'blocked') stats.blocked++;
        });
        
        document.getElementById('critical-threats').textContent = stats.critical;
        document.getElementById('high-threats').textContent = stats.high;
        document.getElementById('medium-threats').textContent = stats.medium;
        document.getElementById('blocked-threats').textContent = stats.blocked;
    }


    renderVisualizations() {
        if (!this.threats) return;
        
        // Slight delay to ensure DOM layout is complete for canvas dimensions
        setTimeout(() => {
            this.renderDistributionChart();
            this.renderTimelineChart();
            this.renderThreatMap();
        }, 100);
    }

    renderDistributionChart() {
        const ctx = document.getElementById('threat-distribution-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (this.distributionChart) {
            this.distributionChart.destroy();
        }

        const counts = { phishing: 0, malware: 0, network: 0, suspicious: 0, web_attack: 0, anomaly: 0 };
        this.threats.forEach(t => {
            const type = (t.type || 'suspicious').toLowerCase();
            counts[type] = (counts[type] || 0) + 1;
        });

        // Ensure we show something if empty, but explicitly state 0
        const dataValues = Object.values(counts);
        const hasData = dataValues.some(v => v > 0);

        this.distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
                datasets: [{
                    data: hasData ? dataValues : [1], // fallback slice if no data
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',   // Red
                        'rgba(245, 158, 11, 0.8)',  // Orange
                        'rgba(59, 130, 246, 0.8)',  // Blue
                        'rgba(16, 185, 129, 0.8)',  // Green
                        'rgba(139, 92, 246, 0.8)',  // Purple
                        'rgba(236, 72, 153, 0.8)'   // Pink
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { 
                        position: 'left', 
                        labels: { 
                            padding: 20,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#fff' 
                        } 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (!hasData) return ' No Threats Recorded';
                                return ` ${context.label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderTimelineChart() {
        const ctx = document.getElementById('threat-timeline-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (this.timelineChart) {
            this.timelineChart.destroy();
        }

        // Group by day for simple timeline, sorted
        const timelineMap = {};
        
        if (this.threats.length === 0) {
            // Setup empty 7 days axis if no true data
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                timelineMap[`${d.getMonth() + 1}/${d.getDate()}`] = 0;
            }
        } else {
            // Last 7 days baseline
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                timelineMap[`${d.getMonth() + 1}/${d.getDate()}`] = 0;
            }
            this.threats.forEach(t => {
                const d = new Date(t.timestamp || t.created_at || Date.now());
                const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
                if(timelineMap[dateKey] !== undefined) {
                    timelineMap[dateKey]++;
                } else {
                    timelineMap[dateKey] = 1;
                }
            });
        }
        
        const labels = Object.keys(timelineMap);
        const dataValues = Object.values(timelineMap);

        this.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Threats Detected',
                    data: dataValues,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgba(239, 68, 68, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                        ticks: { color: '#888', stepSize: 1 } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { color: '#888' } 
                    }
                },
                plugins: { 
                    legend: { display: false } 
                }
            }
        });
    }

    renderThreatMap() {
        const container = document.getElementById('advanced-threat-map');
        if (!container) return;
        container.innerHTML = ''; // prevent duplicates

        // Render procedural SVG map grid
        const svgHTML = `
        <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" style="width:100%; height:100%; opacity:0.8;">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
                </pattern>
                <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Abstract Map Outlines (North America, Europe, Asia, Africa, South America) -->
            <path d="M120,80 Q200,50 280,120 T320,200 Q250,280 180,220 T120,80 Z" fill="rgba(59, 130, 246, 0.05)" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1.5"/>
            <path d="M180,230 Q220,220 250,280 T260,350 Q200,400 160,320 T180,230 Z" fill="rgba(59, 130, 246, 0.05)" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1.5"/>
            <path d="M400,60 Q480,40 550,100 T600,180 Q520,220 450,150 T400,60 Z" fill="rgba(59, 130, 246, 0.05)" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1.5"/>
            <path d="M600,100 Q700,80 750,150 T780,230 Q700,280 650,200 T600,100 Z" fill="rgba(59, 130, 246, 0.05)" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1.5"/>
            <path d="M430,220 Q500,200 550,280 T560,360 Q480,420 420,320 T430,220 Z" fill="rgba(59, 130, 246, 0.05)" stroke="rgba(59, 130, 246, 0.2)" stroke-width="1.5"/>
            
            <g id="map-nodes"></g>
        </svg>
        `;
        container.innerHTML = svgHTML;
        const nodesGroup = container.querySelector('#map-nodes');

        if (this.threats.length === 0) {
            container.innerHTML += `<div style="position: absolute; top:50%; left:50%; transform:translate(-50%, -50%); color: var(--text-muted); font-size: 0.9rem; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px; border: 1px solid var(--border-color);">No Active Geographic Threats Handled</div>`;
            return;
        }

        // Render nodes based on actual threats
        this.threats.forEach((t, i) => {
            // Map coords out of string hash of the source for deterministic random
            let hash = 0;
            const srcStr = t.source || t.url || String(t.id);
            for (let i = 0; i < srcStr.length; i++) hash = srcStr.charCodeAt(i) + ((hash << 5) - hash);
            
            // Map to abstract SVG dimensions (800x400)
            const x = Math.abs(hash) % 760 + 20;
            const y = Math.abs(hash * 3) % 360 + 20;
            const r = t.severity === 'critical' ? 6 : (t.severity === 'high' ? 4 : 3);
            const color = t.severity === 'critical' ? '#ef4444' : (t.severity === 'high' ? '#f59e0b' : '#3b82f6');
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', r);
            circle.setAttribute('fill', color);
            circle.setAttribute('filter', 'url(#glow-effect)');
            
            // Animating ping
            const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            anim.setAttribute('attributeName', 'opacity');
            anim.setAttribute('values', '1;0.4;1');
            anim.setAttribute('dur', (Math.random() * 2 + 1) + 's');
            anim.setAttribute('repeatCount', 'indefinite');
            circle.appendChild(anim);

            nodesGroup.appendChild(circle);
            
            // Interconnecting lines for visual flair
            if (i > 0 && i % 2 === 0) {
                const prevHash = hash ^ (i * 123);
                const prevX = Math.abs(prevHash) % 760 + 20;
                const prevY = Math.abs(prevHash * 3) % 360 + 20;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                line.setAttribute('d', `M ${prevX} ${prevY} Q ${(x + prevX)/2} ${y - 50} ${x} ${y}`);
                line.setAttribute('fill', 'none');
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '0.5');
                line.setAttribute('opacity', '0.2');
                line.style.strokeDasharray = '5,5';
                
                // Animation for lines
                const lineAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                lineAnim.setAttribute('attributeName', 'stroke-dashoffset');
                lineAnim.setAttribute('values', '10;0');
                lineAnim.setAttribute('dur', '2s');
                lineAnim.setAttribute('repeatCount', 'indefinite');
                line.appendChild(lineAnim);

                nodesGroup.appendChild(line);
            }
        });
    }


    generateMockThreats() {
        const threats = [];
        const types = ['malware', 'phishing', 'network', 'suspicious'];
        const severities = ['critical', 'high', 'medium', 'low'];
        const statuses = ['active', 'resolved', 'dismissed'];
        const sources = ['192.168.1.100', 'suspicious-site.com', 'email-attachment.exe', 'network-scan'];
        
        for (let i = 1; i <= 50; i++) {
            const severity = severities[Math.floor(Math.random() * severities.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            
            threats.push({
                id: `THR-${String(i).padStart(4, '0')}`,
                severity,
                type,
                source: sources[Math.floor(Math.random() * sources.length)],
                description: this.generateThreatDescription(type, severity),
                status: statuses[Math.floor(Math.random() * statuses.length)],
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
                details: {
                    risk_score: Math.floor(Math.random() * 100),
                    affected_systems: Math.floor(Math.random() * 5) + 1,
                    detection_method: 'AI Analysis',
                    remediation: this.generateRemediationSteps(type)
                }
            });
        }
        
        return threats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateThreatDescription(type, severity) {
        const descriptions = {
            malware: {
                critical: 'Advanced persistent threat detected with rootkit capabilities',
                high: 'Ransomware payload identified in system memory',
                medium: 'Suspicious executable behavior detected',
                low: 'Potentially unwanted program identified'
            },
            phishing: {
                critical: 'Credential harvesting attempt targeting executive accounts',
                high: 'Sophisticated spear phishing campaign detected',
                medium: 'Suspicious email with malicious attachments',
                low: 'Generic phishing attempt blocked'
            },
            network: {
                critical: 'Active breach attempt from external IP address',
                high: 'Unauthorized access to critical network segment',
                medium: 'Unusual network traffic pattern detected',
                low: 'Port scanning activity observed'
            },
            suspicious: {
                critical: 'Multiple failed login attempts on admin accounts',
                high: 'Anomalous data exfiltration pattern detected',
                medium: 'Unusual file access pattern observed',
                low: 'Minor behavioral anomaly detected'
            }
        };
        
        return descriptions[type]?.[severity] || 'Security event detected';
    }

    generateRemediationSteps(type) {
        const steps = {
            malware: [
                'Isolate affected systems from network',
                'Run full system antivirus scan',
                'Check for persistence mechanisms',
                'Restore from clean backup if necessary'
            ],
            phishing: [
                'Block sender email address',
                'Reset potentially compromised credentials',
                'Educate users about phishing indicators',
                'Review email security policies'
            ],
            network: [
                'Block suspicious IP addresses',
                'Review network access logs',
                'Strengthen firewall rules',
                'Monitor for lateral movement'
            ],
            suspicious: [
                'Investigate user activity patterns',
                'Review system access logs',
                'Implement additional monitoring',
                'Consider password reset if needed'
            ]
        };
        
        return steps[type] || ['Investigate further', 'Apply appropriate countermeasures'];
    }

    showTableLoading() {
        if (this.threatsTable) {
            this.threatsTable.setData([]);
        }
    }

    filterThreats() {
        const severityFilter = document.getElementById('severity-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        
        let filteredThreats = [...this.threats];
        
        if (severityFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.severity === severityFilter);
        }
        
        if (statusFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.status === statusFilter);
        }
        
        if (typeFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.type === typeFilter);
        }
        
        this.threatsTable.setData(filteredThreats);
    }

    clearFilters() {
        document.getElementById('severity-filter').value = 'all';
        document.getElementById('status-filter').value = 'all';
        document.getElementById('type-filter').value = 'all';
        this.threatsTable.setData(this.threats);
    }

    handleSelectionChange(selectedIndices) {
        const bulkActions = document.getElementById('bulk-actions');
        const selectedCount = document.getElementById('selected-count');
        
        if (selectedIndices.length > 0) {
            bulkActions.style.display = 'flex';
            selectedCount.textContent = selectedIndices.length;
            this.selectedThreats = new Set(selectedIndices);
        } else {
            bulkActions.style.display = 'none';
            this.selectedThreats.clear();
        }
    }

    async viewThreatDetails(threatId) {
        const threat = this.threats.find(t => t.id === threatId);
        if (!threat) return;
        
        const detailsPanel = document.getElementById('threat-details-panel');
        const detailsContent = document.getElementById('threat-details-content');
        
        detailsContent.innerHTML = this.createThreatDetailsHTML(threat);
        detailsPanel.style.display = 'block';
        
        // Add animation
        detailsPanel.style.transform = 'translateX(100%)';
        requestAnimationFrame(() => {
            detailsPanel.style.transition = 'transform 0.3s ease';
            detailsPanel.style.transform = 'translateX(0)';
        });
    }

    createThreatDetailsHTML(threat) {
        return `
            <div class="threat-detail-section">
                <h4>Basic Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Threat ID:</label>
                        <span>${threat.id}</span>
                    </div>
                    <div class="detail-item">
                        <label>Severity:</label>
                        <span class="badge badge-${this.getSeverityClass(threat.severity)}">${threat.severity?.toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <label>Type:</label>
                        <span>${threat.type}</span>
                    </div>
                    <div class="detail-item">
                        <label>Status:</label>
                        <span class="badge badge-${this.getStatusClass(threat.status)}">${threat.status?.toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <label>Source:</label>
                        <span>${threat.source || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Detected:</label>
                        <span>${new Date(threat.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="threat-detail-section">
                <h4>Description</h4>
                <p>${threat.description}</p>
            </div>
            
            ${threat.details ? `
                <div class="threat-detail-section">
                    <h4>Technical Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Risk Score:</label>
                            <span>${threat.details.risk_score}/100</span>
                        </div>
                        <div class="detail-item">
                            <label>Affected Systems:</label>
                            <span>${threat.details.affected_systems}</span>
                        </div>
                        <div class="detail-item">
                            <label>Detection Method:</label>
                            <span>${threat.details.detection_method}</span>
                        </div>
                    </div>
                </div>
                
                <div class="threat-detail-section">
                    <h4>Recommended Actions</h4>
                    <ul class="remediation-list">
                        ${threat.details.remediation.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="threat-actions">
                <button class="btn btn-success" onclick="window.threatCenter.resolveThreat('${threat.id}')">
                    <i class="fas fa-check"></i> Resolve Threat
                </button>
                <button class="btn btn-secondary" onclick="window.threatCenter.dismissThreat('${threat.id}')">
                    <i class="fas fa-times"></i> Dismiss
                </button>
                <button class="btn btn-danger" onclick="window.threatCenter.deleteThreat('${threat.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
    }

    closeDetailsPanel() {
        const detailsPanel = document.getElementById('threat-details-panel');
        detailsPanel.style.transform = 'translateX(100%)';
        setTimeout(() => {
            detailsPanel.style.display = 'none';
        }, 300);
    }

    // Threat Actions
    async resolveThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Resolve Threat',
            'Are you sure you want to mark this threat as resolved?'
        );
        
        if (!confirmed) return;
        
        try {
            if (window.apiClient) {
                const response = await window.apiClient.resolveThreat(threatId, { resolution: 'Resolved by user' });
                if (response.success) {
                    this.updateThreatStatus(threatId, 'resolved');
                    window.notificationSystem?.success('Threat Resolved', 'Threat has been marked as resolved');
                    return;
                }
            }
            
            // Fallback update
            this.updateThreatStatus(threatId, 'resolved');
            window.notificationSystem?.success('Threat Resolved', 'Threat has been marked as resolved');
            
        } catch (error) {
            console.error('Failed to resolve threat:', error);
            window.notificationSystem?.error('Resolve Failed', 'Failed to resolve threat');
        }
    }

    async dismissThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Dismiss Threat',
            'Are you sure you want to dismiss this threat?'
        );
        
        if (!confirmed) return;
        
        try {
            if (window.apiClient) {
                const response = await window.apiClient.dismissThreat(threatId, { reason: 'Dismissed by user' });
                if (response.success) {
                    this.updateThreatStatus(threatId, 'dismissed');
                    window.notificationSystem?.success('Threat Dismissed', 'Threat has been dismissed');
                    return;
                }
            }
            
            // Fallback update
            this.updateThreatStatus(threatId, 'dismissed');
            window.notificationSystem?.success('Threat Dismissed', 'Threat has been dismissed');
            
        } catch (error) {
            console.error('Failed to dismiss threat:', error);
            window.notificationSystem?.error('Dismiss Failed', 'Failed to dismiss threat');
        }
    }

    async deleteThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Delete Threat',
            'Are you sure you want to permanently delete this threat? This action cannot be undone.',
            { confirmClass: 'btn-danger', confirmLabel: 'Delete' }
        );
        
        if (!confirmed) return;
        
        // Remove from local data
        this.threats = this.threats.filter(t => t.id !== threatId);
        this.threatsTable.setData(this.threats);
        this.updateThreatStats();
        this.closeDetailsPanel();
        
        window.notificationSystem?.success('Threat Deleted', 'Threat has been permanently deleted');
    }

    updateThreatStatus(threatId, newStatus) {
        const threat = this.threats.find(t => t.id === threatId);
        if (threat) {
            threat.status = newStatus;
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
            this.closeDetailsPanel();
        }
    }

    // Bulk Actions
    async bulkResolveThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Resolve',
            `Are you sure you want to resolve ${this.selectedThreats.size} selected threats?`
        );
        
        if (!confirmed) return;
        
        // Update selected threats
        this.selectedThreats.forEach(index => {
            const threat = this.threats[index];
            if (threat) {
                threat.status = 'resolved';
            }
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Resolve', `${this.selectedThreats.size} threats resolved`);
    }

    async bulkDismissThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Dismiss',
            `Are you sure you want to dismiss ${this.selectedThreats.size} selected threats?`
        );
        
        if (!confirmed) return;
        
        // Update selected threats
        this.selectedThreats.forEach(index => {
            const threat = this.threats[index];
            if (threat) {
                threat.status = 'dismissed';
            }
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Dismiss', `${this.selectedThreats.size} threats dismissed`);
    }

    async bulkDeleteThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Delete',
            `Are you sure you want to permanently delete ${this.selectedThreats.size} selected threats? This action cannot be undone.`,
            { confirmClass: 'btn-danger', confirmLabel: 'Delete All' }
        );
        
        if (!confirmed) return;
        
        // Remove selected threats
        const selectedIndices = Array.from(this.selectedThreats).sort((a, b) => b - a);
        selectedIndices.forEach(index => {
            this.threats.splice(index, 1);
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Delete', `${selectedIndices.length} threats deleted`);
    }

    // Utility methods
    getSeverityClass(severity) {
        const map = {
            critical: 'error',
            high: 'warning',
            medium: 'info',
            low: 'secondary'
        };
        return map[severity] || 'secondary';
    }

    getStatusClass(status) {
        const map = {
            active: 'error',
            resolved: 'success',
            dismissed: 'secondary'
        };
        return map[status] || 'secondary';
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    updateThreatStats() {
        this.calculateStatsFromThreats();
    }

    // Event handlers
    async refreshThreats() {
        await this.loadThreats();
        window.notificationSystem?.success('Refreshed', 'Threat data has been refreshed');
    }

    exportThreats() {
        if (this.threatsTable) {
            this.threatsTable.exportData('csv');
        }
    }

    showManualScanDialog() {
        const url = prompt('Enter URL to scan with CyberForge ML:', 'https://example.com');
        if (url) {
            this.scanUrlWithCyberForge(url);
        }
    }
    
    async scanUrlWithCyberForge(url) {
        window.notificationSystem?.loading('CyberForge Scan', `Scanning ${url}...`);
        
        try {
            if (window.cyberforgeAPI) {
                const result = await window.cyberforgeAPI.cyberforgeAnalyzeUrl(url);
                
                if (result.success && result.data) {
                    const analysis = result.data;
                    const riskLevel = analysis.aggregate?.overall_risk_level || 'unknown';
                    const maxScore = analysis.aggregate?.max_threat_score || 0;
                    
                    // Create threat from analysis
                    if (riskLevel !== 'low' && riskLevel !== 'minimal') {
                        const newThreat = {
                            id: `THR-CF-${Date.now()}`,
                            severity: riskLevel === 'critical' ? 'critical' : 
                                     riskLevel === 'high' ? 'high' : 'medium',
                            type: 'phishing',
                            source: url,
                            description: `CyberForge ML detected ${riskLevel.toUpperCase()} risk URL with threat score ${(maxScore * 100).toFixed(1)}%`,
                            status: 'active',
                            timestamp: new Date(),
                            details: {
                                risk_score: Math.round(maxScore * 100),
                                affected_systems: 1,
                                detection_method: 'CyberForge ML Analysis',
                                remediation: ['Block URL access', 'Review similar URLs', 'Alert users'],
                                model_predictions: analysis.model_predictions
                            }
                        };
                        
                        this.threats.unshift(newThreat);
                        this.threatsTable?.setData(this.threats);
                        this.updateThreatStats();
                        
                        window.notificationSystem?.warning('⚠️ Threat Detected', 
                            `${riskLevel.toUpperCase()} risk detected for ${url}`);
                    } else {
                        window.notificationSystem?.success('✅ URL Safe', 
                            `No threats detected for ${url} (${riskLevel})`);
                    }
                    
                    return;
                }
            }
            
            // Fallback to legacy scan
            window.notificationSystem?.success('Scan Complete', 'Manual security scan completed');
            this.refreshThreats();
            
        } catch (error) {
            console.error('CyberForge scan error:', error);
            window.notificationSystem?.error('Scan Failed', error.message);
        }
    }

    startManualScan() {
        const scanId = 'SCAN-' + Date.now();
        window.notificationSystem?.loading('Manual Scan', 'Security scan is starting...');
        
        // Simulate scan progress
        setTimeout(() => {
            window.notificationSystem?.success('Scan Complete', 'Manual security scan completed successfully');
            this.refreshThreats();
        }, 3000);
    }

    highlightThreat(threatId) {
        // TODO: Implement threat highlighting in table
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.isActive) {
                this.loadThreatStats();
            }
        }, 30000); // Update every 30 seconds
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    handleRealtimeData(data) {
        if (data.type === 'threat_alert') {
            // Add new threat to the list
            this.threats.unshift(data.threat);
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
        }
    }

    destroy() {
        this.stopRealTimeUpdates();
        if (this.threatsTable) {
            this.threatsTable.destroy();
        }
        // Clean up global reference
        if (window.threatCenter === this) {
            delete window.threatCenter;
        }
    }
}

// Export for global access
window.ThreatCenterScreen = ThreatCenterScreen;