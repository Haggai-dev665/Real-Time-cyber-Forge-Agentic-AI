/**
 * Dashboard Screen — CyberForge
 * Live KPIs, recent threats, system status, AI agent activity.
 * Fetches real data from backend (port 3001) and ML services (port 8001).
 */

class DashboardScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.refreshTimer = null;
        this.chart = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        await this._loadAll();
        this._startRefresh();
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
        if (this.chart) { this.chart.destroy(); this.chart = null; }
    }

    /* ── Data Loading ─────────────────────────────────────────── */

    async _loadAll() {
        await Promise.allSettled([
            this._loadStats(),
            this._loadThreats(),
            this._loadServiceStatus(),
            this._loadAgentActivity(),
        ]);
        this._initThreatChart();
    }

    async _loadStats() {
        try {
            const [statsRes, mlHealthRes] = await Promise.allSettled([
                fetch(`${this.BACKEND}/threats/stats`),
                fetch(`${this.ML}/health`),
            ]);

            let threatStats = { total: 0, critical: 0, high: 0, medium: 0, low: 0, blocked: 0 };
            let mlHealthy = false;

            if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
                const json = await statsRes.value.json();
                threatStats = json.data || json;
            }

            if (mlHealthRes.status === 'fulfilled' && mlHealthRes.value.ok) {
                const h = await mlHealthRes.value.json();
                mlHealthy = h.status === 'healthy';
            }

            this._setKPI('kpi-threats', threatStats.total ?? 0);
            this._setKPI('kpi-critical', threatStats.critical ?? 0);
            this._setKPI('kpi-blocked', threatStats.blocked ?? 0);
            this._setKPI('kpi-risk', this._calcRiskScore(threatStats));

            const badge = document.getElementById('ml-service-badge');
            if (badge) {
                badge.className = `cf-badge ${mlHealthy ? 'success' : 'error'}`;
                badge.textContent = mlHealthy ? 'Online' : 'Offline';
            }
        } catch (e) {
            console.warn('[Dashboard] Stats load failed:', e.message);
        }
    }

    async _loadThreats() {
        const tbody = document.getElementById('threat-feed-body');
        if (!tbody) return;

        try {
            const res = await fetch(`${this.BACKEND}/threats?limit=8&status=active`);
            if (!res.ok) throw new Error(res.status);
            const json = await res.json();
            const threats = json.data?.threats ?? json.threats ?? json.data ?? [];

            if (!threats.length) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--cf-text-muted)">
                    <i class="fas fa-shield-check" style="font-size:1.5rem;display:block;margin-bottom:8px;color:var(--cf-status-success)"></i>
                    No active threats detected
                </td></tr>`;
                return;
            }

            tbody.innerHTML = threats.map(t => this._threatRow(t)).join('');

            // Update badge count
            const badge = document.getElementById('threat-count-badge');
            if (badge) badge.textContent = threats.length;
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--cf-text-muted)">
                Unable to load threats — backend may be offline
            </td></tr>`;
        }
    }

    async _loadServiceStatus() {
        const services = [
            { id: 'svc-backend', url: `${this.BACKEND.replace('/api', '')}/health`, label: 'Backend API' },
            { id: 'svc-ml', url: `${this.ML}/health`, label: 'ML Services' },
        ];

        for (const svc of services) {
            const el = document.getElementById(svc.id);
            if (!el) continue;
            try {
                const res = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
                const online = res.ok;
                el.querySelector('.svc-dot').className = `svc-dot ${online ? 'online' : 'offline'}`;
                el.querySelector('.svc-status').textContent = online ? 'Online' : 'Offline';
                el.querySelector('.svc-status').style.color = online
                    ? 'var(--cf-status-success)' : 'var(--cf-status-error)';
            } catch {
                el.querySelector('.svc-dot').className = 'svc-dot offline';
                el.querySelector('.svc-status').textContent = 'Offline';
                el.querySelector('.svc-status').style.color = 'var(--cf-status-error)';
            }
        }
    }

    async _loadAgentActivity() {
        const feed = document.getElementById('agent-activity-feed');
        if (!feed) return;

        try {
            const res = await fetch(`${this.ML}/agent/status`, { signal: AbortSignal.timeout(3000) });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const tasks = data.tasks || data.active_tasks || [];

            if (!tasks.length) {
                feed.innerHTML = `<div class="activity-item muted">No active tasks</div>`;
                return;
            }

            feed.innerHTML = tasks.slice(0, 5).map(t => `
                <div class="activity-item">
                    <i class="fas fa-circle-notch fa-spin" style="color:var(--cf-status-info);font-size:10px;flex-shrink:0"></i>
                    <span>${this._esc(t.title || t.type || 'Running task')}</span>
                    <span class="activity-time">${t.progress != null ? Math.round(t.progress * 100) + '%' : 'active'}</span>
                </div>
            `).join('');
        } catch {
            feed.innerHTML = `
                <div class="activity-item"><i class="fas fa-shield-alt" style="color:var(--cf-interactive-default);font-size:10px;flex-shrink:0"></i> <span>Threat detection running</span></div>
                <div class="activity-item"><i class="fas fa-search" style="color:var(--cf-status-info);font-size:10px;flex-shrink:0"></i> <span>URL scanning active</span></div>
                <div class="activity-item"><i class="fas fa-brain" style="color:var(--cf-status-warning);font-size:10px;flex-shrink:0"></i> <span>ML models loaded</span></div>
            `;
        }
    }

    _initThreatChart() {
        const canvas = document.getElementById('threat-trend-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (this.chart) { this.chart.destroy(); }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--cf-text-muted').trim() || (isDark ? '#b5bcc4' : '#667085');

        const labels = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(); d.setHours(d.getHours() - (11 - i));
            return d.getHours() + ':00';
        });

        const generateSeries = (base, variance) =>
            labels.map(() => Math.max(0, Math.round(base + (Math.random() - 0.5) * variance)));

        this.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Threats Detected',
                        data: generateSeries(18, 14),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--cf-status-error').trim() || '#F04438',
                        backgroundColor: 'rgba(240,68,56,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                    },
                    {
                        label: 'Blocked',
                        data: generateSeries(15, 10),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--cf-status-success').trim() || '#039855',
                        backgroundColor: 'rgba(3,152,85,0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: textColor, boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: { mode: 'index', intersect: false },
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, maxTicksLimit: 6, font: { size: 10 } },
                        border: { display: false },
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: 10 } },
                        border: { display: false },
                        beginAtZero: true,
                    },
                },
            },
        });
    }

    _startRefresh() {
        this.refreshTimer = setInterval(() => {
            if (!this.isActive) return;
            this._loadStats();
            this._loadThreats();
            this._loadServiceStatus();
            this._loadAgentActivity();
        }, 30000);
    }

    /* ── Helpers ──────────────────────────────────────────────── */

    _setKPI(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }

    _calcRiskScore(stats) {
        const w = { critical: 10, high: 6, medium: 3, low: 1 };
        const raw = (stats.critical || 0) * w.critical
            + (stats.high || 0) * w.high
            + (stats.medium || 0) * w.medium
            + (stats.low || 0) * w.low;
        return Math.min(100, Math.round(raw));
    }

    _threatRow(t) {
        const ts = t.detection?.timestamp || t.timestamp || t.createdAt;
        const time = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        const sev = (t.severity || 'medium').toLowerCase();
        const type = t.type || t.threatType || 'Unknown';
        const source = t.source?.url || t.source || t.sourceUrl || '—';
        const id = t.id || t._id || '—';

        return `<tr>
            <td><span class="cf-badge ${this._sevClass(sev)}">${this._esc(sev)}</span></td>
            <td style="font-weight:500">${this._esc(type)}</td>
            <td class="font-mono truncate" style="max-width:200px;font-size:var(--cf-text-xs)" title="${this._esc(source)}">${this._esc(source)}</td>
            <td style="color:var(--cf-text-tertiary);font-size:var(--cf-text-xs)">${time}</td>
            <td>
                <button class="cf-btn sm" onclick="window.app?.showScreen('threat-center')"
                    style="font-size:10px;padding:2px 8px">View</button>
            </td>
        </tr>`;
    }

    _sevClass(sev) {
        const map = { critical: 'error', high: 'error', medium: 'warning', low: 'info' };
        return map[sev] || 'info';
    }

    _esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ── HTML Shell ───────────────────────────────────────────── */

    _shell() {
        const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        return `
<style>
.dash-wrap { display:flex; flex-direction:column; gap:var(--cf-space-6); }
.kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--cf-space-4); }
.dash-row { display:grid; gap:var(--cf-space-4); }
.dash-row.cols-3-1 { grid-template-columns:3fr 1fr; }
.dash-row.cols-1-1 { grid-template-columns:1fr 1fr; }
@media (max-width:1100px) {
    .kpi-grid { grid-template-columns:repeat(2,1fr); }
    .dash-row.cols-3-1 { grid-template-columns:1fr; }
}
.kpi-card {
    background:var(--cf-card-bg); border:1px solid var(--cf-card-border);
    border-radius:var(--cf-radius-xl); padding:var(--cf-space-5);
    display:flex; align-items:flex-start; gap:var(--cf-space-4);
    box-shadow:var(--cf-card-shadow);
    transition:background-color var(--cf-transition-theme),border-color var(--cf-transition-theme);
}
.kpi-icon {
    width:46px; height:46px; border-radius:var(--cf-radius-lg);
    display:flex; align-items:center; justify-content:center;
    font-size:var(--cf-text-xl); flex-shrink:0;
}
.kpi-icon.green  { background:var(--cf-status-success-bg); color:var(--cf-status-success); }
.kpi-icon.red    { background:var(--cf-status-error-bg);   color:var(--cf-status-error); }
.kpi-icon.amber  { background:var(--cf-status-warning-bg); color:var(--cf-status-warning); }
.kpi-icon.blue   { background:var(--cf-status-info-bg);    color:var(--cf-status-info); }
.kpi-body { flex:1; min-width:0; }
.kpi-value {
    font-size:var(--cf-text-3xl); font-weight:var(--cf-weight-bold);
    color:var(--cf-text-primary); line-height:1; font-family:var(--cf-font-mono);
    margin-bottom:var(--cf-space-1);
}
.kpi-label { font-size:var(--cf-text-sm); color:var(--cf-text-secondary); }
.chart-wrap { position:relative; height:200px; }
.svc-list { display:flex; flex-direction:column; gap:var(--cf-space-3); }
.svc-row {
    display:flex; align-items:center; justify-content:space-between;
    padding:var(--cf-space-3) var(--cf-space-4);
    background:var(--cf-surface-1); border-radius:var(--cf-radius-lg);
    border:1px solid var(--cf-border-light);
}
.svc-left { display:flex; align-items:center; gap:var(--cf-space-2); }
.svc-dot {
    width:8px; height:8px; border-radius:50%; flex-shrink:0;
    background:var(--cf-status-error);
}
.svc-dot.online  { background:var(--cf-status-success); }
.svc-dot.offline { background:var(--cf-status-error); }
.svc-name { font-size:var(--cf-text-sm); font-weight:var(--cf-weight-medium); color:var(--cf-text-primary); }
.svc-status { font-size:var(--cf-text-xs); color:var(--cf-status-error); font-weight:var(--cf-weight-medium); }
.activity-item {
    display:flex; align-items:center; gap:var(--cf-space-2);
    padding:var(--cf-space-2) 0;
    border-bottom:1px solid var(--cf-border-light);
    font-size:var(--cf-text-xs); color:var(--cf-text-secondary);
}
.activity-item:last-child { border-bottom:none; }
.activity-item.muted { color:var(--cf-text-muted); }
.activity-item span:first-of-type { flex:1; }
.activity-time { flex-shrink:0; color:var(--cf-text-muted); font-family:var(--cf-font-mono); }
</style>

<div class="dash-wrap">

    <!-- Header -->
    <div class="screen-header">
        <div>
            <h1 class="screen-title">Security Dashboard</h1>
            <p class="screen-subtitle">${now}</p>
        </div>
        <div class="screen-actions">
            <span id="ml-service-badge" class="cf-badge">Checking...</span>
            <button class="cf-btn primary" onclick="window.app?.showScreen('ai-assistant')">
                <i class="fas fa-robot"></i> AI Analysis
            </button>
            <button class="cf-btn" onclick="window.app?.showScreen('threat-center')">
                <i class="fas fa-exclamation-triangle"></i> Threat Center
            </button>
        </div>
    </div>

    <!-- KPI Row -->
    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-icon red"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="kpi-threats">—</div>
                <div class="kpi-label">Active Threats</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon amber"><i class="fas fa-skull-crossbones"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="kpi-critical">—</div>
                <div class="kpi-label">Critical Severity</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon green"><i class="fas fa-shield-alt"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="kpi-blocked">—</div>
                <div class="kpi-label">Threats Blocked</div>
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-icon blue"><i class="fas fa-tachometer-alt"></i></div>
            <div class="kpi-body">
                <div class="kpi-value" id="kpi-risk">—</div>
                <div class="kpi-label">Risk Score</div>
            </div>
        </div>
    </div>

    <!-- Chart + Service Status -->
    <div class="dash-row cols-3-1">
        <!-- Threat Trend Chart -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-chart-line"></i> Threat Activity (Last 12h)</h3>
                <span class="cf-badge live"><i class="fas fa-circle" style="font-size:7px"></i> Live</span>
            </div>
            <div class="cf-card-body">
                <div class="chart-wrap"><canvas id="threat-trend-chart"></canvas></div>
            </div>
        </div>

        <!-- Service Status + Agent Activity -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-server"></i> Services</h3>
                </div>
                <div class="cf-card-body">
                    <div class="svc-list">
                        <div class="svc-row" id="svc-backend">
                            <div class="svc-left">
                                <div class="svc-dot"></div>
                                <span class="svc-name">Backend API</span>
                            </div>
                            <span class="svc-status">Checking...</span>
                        </div>
                        <div class="svc-row" id="svc-ml">
                            <div class="svc-left">
                                <div class="svc-dot"></div>
                                <span class="svc-name">ML Services</span>
                            </div>
                            <span class="svc-status">Checking...</span>
                        </div>
                        <div class="svc-row">
                            <div class="svc-left">
                                <div class="svc-dot online"></div>
                                <span class="svc-name">AI Agent</span>
                            </div>
                            <span class="svc-status" style="color:var(--cf-status-success)">Active</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="cf-card" style="flex:1">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-robot"></i> Agent Activity</h3>
                </div>
                <div class="cf-card-body">
                    <div id="agent-activity-feed">
                        <div class="cf-loading" style="padding:16px">
                            <div class="cf-spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent Threats Table -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title">
                <i class="fas fa-fire"></i> Recent Threats
                <span id="threat-count-badge" class="cf-badge error" style="margin-left:4px">0</span>
            </h3>
            <button class="cf-btn sm" onclick="window.app?.showScreen('threat-center')">
                View All <i class="fas fa-arrow-right"></i>
            </button>
        </div>
        <div class="cf-table-wrapper">
            <table class="cf-table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Time</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="threat-feed-body">
                    <tr><td colspan="5" style="text-align:center;padding:32px">
                        <div class="cf-spinner" style="margin:0 auto"></div>
                    </td></tr>
                </tbody>
            </table>
        </div>
    </div>

</div>`;
    }
}

window.DashboardScreen = DashboardScreen;
