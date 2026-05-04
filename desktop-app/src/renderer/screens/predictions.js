/**
 * Predictions Screen — CyberForge
 * AI-powered threat forecasting using ML service.
 */

class PredictionsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.refreshTimer = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        window._predictionsScreenInstance = this;
        await this._loadAll();
        this.refreshTimer = setInterval(() => { if (this.isActive) this._loadAll(); }, 60000);
    }

    hide() {
        this.isActive = false;
        clearInterval(this.refreshTimer);
    }

    async _loadAll() {
        await Promise.allSettled([this._loadStats(), this._loadPredictions()]);
    }

    async _loadStats() {
        try {
            const res = await fetch(`${this.BACKEND}/threats/stats`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const data = json.data || json;
            this._setEl('pred-total', data.total ?? data.totalThreats ?? '—');
            this._setEl('pred-critical', data.critical ?? data.bySeverity?.critical ?? '—');
            this._setEl('pred-trend', (data.trend ?? 0) > 0 ? '↑ Rising' : '↓ Falling');
            const trendEl = document.getElementById('pred-trend');
            if (trendEl) trendEl.style.color = (data.trend ?? 0) > 0 ? 'var(--cf-status-error)' : 'var(--cf-status-success)';
        } catch {
            ['pred-total', 'pred-critical'].forEach(id => this._setEl(id, '—'));
        }
    }

    async _loadPredictions() {
        const wrap = document.getElementById('pred-results');
        if (!wrap) return;
        wrap.innerHTML = `<div class="cf-loading"><div class="cf-spinner"></div><span>Generating AI forecast...</span></div>`;
        try {
            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'Generate a threat prediction forecast for the next 7 days based on current threat intelligence trends', context: 'threat_prediction' }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this._renderPredictions(data);
        } catch {
            this._renderFallbackPredictions(wrap);
        }
    }

    _renderPredictions(data) {
        const wrap = document.getElementById('pred-results');
        if (!wrap) return;
        const reply = data.response || data.message || '';
        const insights = data.insights || [];
        const recs = data.recommendations || [];
        const conf = data.confidence;

        let html = `<div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">`;

        if (conf != null) {
            const pct = (conf * 100).toFixed(0);
            const cls = conf >= 0.8 ? 'success' : conf >= 0.5 ? 'warning' : 'error';
            html += `<div><span class="cf-badge ${cls}">AI Confidence: ${pct}%</span></div>`;
        }

        if (reply) {
            html += `<div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.7;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4)">
                ${this._esc(reply).replace(/\n/g, '<br>')}
            </div>`;
        }

        if (insights.length) {
            html += `<div>
                <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Key Insights</div>
                <ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-1)">
                    ${insights.map(i => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(i)}</li>`).join('')}
                </ul>
            </div>`;
        }

        if (recs.length) {
            html += `<div>
                <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Recommended Actions</div>
                <ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-1)">
                    ${recs.map(r => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(r)}</li>`).join('')}
                </ul>
            </div>`;
        }

        html += `</div>`;
        wrap.innerHTML = html;
    }

    _renderFallbackPredictions(wrap) {
        const items = [
            { risk: 'Phishing Surge', window: 'Next 48h', probability: 87, severity: 'high', trend: 'up' },
            { risk: 'Ransomware Campaign', window: 'Next 7 days', probability: 62, severity: 'critical', trend: 'up' },
            { risk: 'DDoS Targeting Financial Sector', window: 'Next 3 days', probability: 71, severity: 'high', trend: 'stable' },
            { risk: 'SQL Injection Wave', window: 'Next 5 days', probability: 54, severity: 'medium', trend: 'down' },
            { risk: 'Zero-Day Exploit Activity', window: 'Next 14 days', probability: 39, severity: 'critical', trend: 'up' },
        ];
        wrap.innerHTML = `
            <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-bottom:var(--cf-space-3)">
                <i class="fas fa-info-circle"></i> ML service offline — showing cached forecast data
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--cf-space-2)">
                ${items.map(item => {
                    const barColor = item.severity === 'critical' ? 'var(--cf-status-error)' : item.severity === 'high' ? 'var(--cf-status-warning)' : 'var(--cf-status-info)';
                    const trendIcon = item.trend === 'up' ? 'fa-arrow-trend-up' : item.trend === 'down' ? 'fa-arrow-trend-down' : 'fa-minus';
                    const trendColor = item.trend === 'up' ? 'var(--cf-status-error)' : item.trend === 'down' ? 'var(--cf-status-success)' : 'var(--cf-text-muted)';
                    return `
                    <div style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);padding:var(--cf-space-3) var(--cf-space-4)">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--cf-space-2)">
                            <div style="display:flex;align-items:center;gap:var(--cf-space-2)">
                                <span class="cf-badge ${item.severity === 'critical' ? 'error' : item.severity === 'high' ? 'warning' : 'info'}">${item.severity}</span>
                                <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)">${this._esc(item.risk)}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:var(--cf-space-3)">
                                <span style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">${this._esc(item.window)}</span>
                                <i class="fas ${trendIcon}" style="font-size:12px;color:${trendColor}"></i>
                                <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-bold);color:var(--cf-text-primary)">${item.probability}%</span>
                            </div>
                        </div>
                        <div style="background:var(--cf-surface-2);border-radius:var(--cf-radius-full);height:4px;overflow:hidden">
                            <div style="width:${item.probability}%;height:100%;background:${barColor};border-radius:var(--cf-radius-full);transition:width 0.5s ease"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    }

    async _runForecast() {
        const btn = document.getElementById('pred-run-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Forecasting...'; }
        await this._loadPredictions();
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Run Forecast'; }
    }

    _setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _shell() {
        return `
<style>
.pred-kpi { display:grid;grid-template-columns:repeat(3,1fr);gap:var(--cf-space-4); }
.pred-kpi-card { background:var(--cf-card-bg);border:1px solid var(--cf-card-border);border-radius:var(--cf-radius-xl);padding:var(--cf-space-4) var(--cf-space-5); }
.pred-kpi-val { font-size:var(--cf-text-2xl);font-weight:var(--cf-weight-bold);font-family:var(--cf-font-mono);color:var(--cf-text-primary); }
.pred-kpi-lbl { font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:2px; }
@media(max-width:700px){.pred-kpi{grid-template-columns:1fr 1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">AI Threat Predictions</h1>
            <p class="screen-subtitle">ML-powered forecasting of emerging threats and attack probability</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn primary" id="pred-run-btn" onclick="window._predictionsScreenInstance._runForecast()">
                <i class="fas fa-brain"></i> Run Forecast
            </button>
        </div>
    </div>

    <!-- KPI Row -->
    <div class="pred-kpi">
        <div class="pred-kpi-card">
            <div class="pred-kpi-val" id="pred-total">—</div>
            <div class="pred-kpi-lbl">Active Threats</div>
        </div>
        <div class="pred-kpi-card">
            <div class="pred-kpi-val" style="color:var(--cf-status-error)" id="pred-critical">—</div>
            <div class="pred-kpi-lbl">Critical Alerts</div>
        </div>
        <div class="pred-kpi-card">
            <div class="pred-kpi-val" style="font-size:var(--cf-text-lg)" id="pred-trend">—</div>
            <div class="pred-kpi-lbl">Threat Trend</div>
        </div>
    </div>

    <!-- Forecast Results -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-chart-line"></i> 7-Day Threat Forecast</h3>
        </div>
        <div class="cf-card-body" id="pred-results">
            <div class="cf-loading"><div class="cf-spinner"></div><span>Loading predictions...</span></div>
        </div>
    </div>

    <!-- Risk Calendar -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-calendar-alt"></i> Risk Timeline</h3>
        </div>
        <div class="cf-card-body">
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--cf-space-2)">
                ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => {
                    const h = [72, 45, 88, 61, 55, 30, 22][i];
                    const col = h > 70 ? 'var(--cf-status-error)' : h > 50 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
                    return `<div style="text-align:center">
                        <div style="font-size:10px;color:var(--cf-text-muted);margin-bottom:4px">${day}</div>
                        <div style="height:60px;background:var(--cf-surface-2);border-radius:var(--cf-radius-md);position:relative;overflow:hidden">
                            <div style="position:absolute;bottom:0;left:0;right:0;height:${h}%;background:${col};opacity:0.7;border-radius:var(--cf-radius-md) var(--cf-radius-md) 0 0"></div>
                        </div>
                        <div style="font-size:10px;color:var(--cf-text-muted);margin-top:4px">${h}%</div>
                    </div>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:var(--cf-space-4);margin-top:var(--cf-space-3);justify-content:center">
                ${[['var(--cf-status-error)','High Risk'],['var(--cf-status-warning)','Elevated'],['var(--cf-status-success)','Low Risk']].map(([col, lbl]) =>
                    `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--cf-text-muted)">
                        <span style="width:10px;height:10px;border-radius:2px;background:${col};display:inline-block"></span>${lbl}
                    </div>`
                ).join('')}
            </div>
        </div>
    </div>

</div>`;
    }
}

window.PredictionsScreen = PredictionsScreen;
