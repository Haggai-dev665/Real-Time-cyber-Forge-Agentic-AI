/**
 * Risk Assessment Screen — CyberForge
 * Security risk scoring with SVG gauge, category breakdown, and AI-powered assessment.
 */

class RiskAssessmentScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.riskScore = 0;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadData();
    }

    hide() { this.isActive = false; }

    async _loadData() {
        try {
            const res = await fetch(`${this.BACKEND}/threats/stats`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const data = json.data || json;
            const total = data.total ?? data.totalThreats ?? 0;
            const critical = data.critical ?? data.bySeverity?.critical ?? 0;
            this.riskScore = Math.min(100, Math.round(Math.min(total * 2, 60) + Math.min(critical * 5, 40)));
        } catch {
            this.riskScore = 42;
        }
        this._renderGauge(this.riskScore);
        this._renderCategories(this.riskScore);
    }

    _renderGauge(score) {
        const el = document.getElementById('ra-gauge-score');
        const ring = document.getElementById('ra-gauge-ring');
        const label = document.getElementById('ra-gauge-label');
        if (!el || !ring) return;

        el.textContent = score;
        const r = 54, circ = 2 * Math.PI * r;
        const fill = circ - (score / 100) * circ;
        ring.style.strokeDasharray = `${circ}`;
        ring.style.strokeDashoffset = `${fill}`;

        const color = score >= 70 ? 'var(--cf-status-error)' : score >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
        ring.style.stroke = color;
        el.style.color = color;

        if (label) label.textContent = score >= 70 ? 'High Risk' : score >= 40 ? 'Moderate Risk' : 'Low Risk';
    }

    _renderCategories(base) {
        const cats = [
            { id: 'ra-network', score: Math.min(100, base + 8), label: 'Network Risk', icon: 'fa-network-wired', desc: 'Perimeter exposure and traffic anomalies' },
            { id: 'ra-data', score: Math.min(100, base - 5), label: 'Data Risk', icon: 'fa-database', desc: 'Data exfiltration and integrity threats' },
            { id: 'ra-access', score: Math.min(100, base + 12), label: 'Access Risk', icon: 'fa-user-lock', desc: 'Privilege escalation and auth failures' },
            { id: 'ra-compliance', score: Math.min(100, base - 10), label: 'Compliance Risk', icon: 'fa-clipboard-check', desc: 'Regulatory gaps and policy violations' },
        ];
        cats.forEach(c => {
            const el = document.getElementById(c.id);
            if (!el) return;
            const s = Math.max(0, c.score);
            const col = s >= 70 ? 'var(--cf-status-error)' : s >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
            el.innerHTML = `
                <div style="display:flex;align-items:flex-start;gap:var(--cf-space-3)">
                    <div style="width:36px;height:36px;border-radius:var(--cf-radius-lg);background:var(--cf-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fas ${c.icon}" style="color:${col};font-size:14px"></i>
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                            <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">${c.label}</span>
                            <span style="font-size:var(--cf-text-lg);font-weight:var(--cf-weight-bold);color:${col}">${s}</span>
                        </div>
                        <div style="background:var(--cf-surface-2);border-radius:var(--cf-radius-full);height:4px;margin-bottom:6px;overflow:hidden">
                            <div style="width:${s}%;height:100%;background:${col};border-radius:var(--cf-radius-full);transition:width 0.6s ease"></div>
                        </div>
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">${c.desc}</div>
                    </div>
                </div>`;
        });
    }

    async _runAssessment() {
        const btn = document.getElementById('ra-run-btn');
        const panel = document.getElementById('ra-ai-panel');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Assessing...'; }
        if (panel) panel.innerHTML = `<div class="cf-loading"><div class="cf-spinner"></div><span>Running AI risk assessment...</span></div>`;

        try {
            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `Provide a detailed risk assessment for a cybersecurity environment with a current risk score of ${this.riskScore}/100. Include top vulnerabilities and mitigation priorities.`, context: 'risk_assessment' }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const reply = data.response || data.message || '';
            const recs = data.recommendations || [];

            if (panel) panel.innerHTML = `
                <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.7;margin-bottom:var(--cf-space-3)">
                    ${this._esc(reply).replace(/\n/g, '<br>')}
                </div>
                ${recs.length ? `
                <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Recommended Actions</div>
                <ol style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-1)">
                    ${recs.map(r => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(r)}</li>`).join('')}
                </ol>` : ''}`;
        } catch {
            if (panel) panel.innerHTML = `
                <div style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)"><i class="fas fa-info-circle"></i> ML service offline. Showing standard mitigation recommendations:</div>
                <ol style="margin:var(--cf-space-3) 0 0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:var(--cf-space-2)">
                    ${['Implement MFA across all privileged accounts','Patch critical CVEs within 24 hours of disclosure','Segment network to limit lateral movement','Enable SIEM alerting for anomalous authentication','Conduct quarterly penetration testing','Review and rotate API keys and secrets'].map(r =>
                        `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${r}</li>`
                    ).join('')}
                </ol>`;
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Run Assessment'; }
    }

    _bind() {
        window._raScreen = this;
        document.getElementById('ra-run-btn')?.addEventListener('click', () => this._runAssessment());
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _shell() {
        const r = 54, circ = 2 * Math.PI * r;
        return `
<style>
.ra-layout { display:grid;grid-template-columns:280px 1fr;gap:var(--cf-space-5);align-items:start; }
.ra-cat-grid { display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-3); }
.ra-factor-row { display:flex;align-items:center;justify-content:space-between;padding:var(--cf-space-3) 0;border-bottom:1px solid var(--cf-border-light);font-size:var(--cf-text-sm); }
.ra-factor-row:last-child { border-bottom:none; }
@media(max-width:900px){.ra-layout{grid-template-columns:1fr;}.ra-cat-grid{grid-template-columns:1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Risk Assessment</h1>
            <p class="screen-subtitle">Quantified security risk scoring with AI-powered mitigation guidance</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn primary" id="ra-run-btn"><i class="fas fa-brain"></i> Run Assessment</button>
        </div>
    </div>

    <div class="ra-layout">

        <!-- Gauge -->
        <div class="cf-card" style="text-align:center">
            <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-tachometer-alt"></i> Risk Score</h3></div>
            <div class="cf-card-body">
                <svg width="140" height="140" viewBox="0 0 140 140" style="margin:auto;display:block">
                    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--cf-surface-2)" stroke-width="10"/>
                    <circle id="ra-gauge-ring" cx="70" cy="70" r="${r}" fill="none"
                        stroke="var(--cf-status-warning)" stroke-width="10" stroke-linecap="round"
                        stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
                        transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 0.8s ease,stroke 0.3s ease"/>
                    <text id="ra-gauge-score" x="70" y="67" text-anchor="middle" dominant-baseline="middle"
                        style="font-size:32px;font-weight:700;font-family:var(--cf-font-mono);fill:var(--cf-text-primary)">0</text>
                    <text x="70" y="90" text-anchor="middle" style="font-size:11px;fill:var(--cf-text-muted);font-family:var(--cf-font-primary)">/ 100</text>
                </svg>
                <div id="ra-gauge-label" style="font-size:var(--cf-text-md);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary);margin-top:var(--cf-space-2)">Calculating...</div>
                <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:4px">Overall Risk Level</div>
            </div>
        </div>

        <!-- Categories -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <div class="ra-cat-grid">
                <div class="cf-card cf-card-body" id="ra-network" style="padding:var(--cf-space-4)"><div class="cf-loading" style="padding:8px"><div class="cf-spinner"></div></div></div>
                <div class="cf-card cf-card-body" id="ra-data" style="padding:var(--cf-space-4)"><div class="cf-loading" style="padding:8px"><div class="cf-spinner"></div></div></div>
                <div class="cf-card cf-card-body" id="ra-access" style="padding:var(--cf-space-4)"><div class="cf-loading" style="padding:8px"><div class="cf-spinner"></div></div></div>
                <div class="cf-card cf-card-body" id="ra-compliance" style="padding:var(--cf-space-4)"><div class="cf-loading" style="padding:8px"><div class="cf-spinner"></div></div></div>
            </div>
        </div>
    </div>

    <!-- Risk Factors Table -->
    <div class="cf-card">
        <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-list-ul"></i> Risk Factor Matrix</h3></div>
        <div class="cf-card-body">
            ${[
                { factor: 'Unpatched Critical CVEs', impact: 'High', likelihood: 'High', score: 85, mit: 'Automated patch management' },
                { factor: 'Weak Authentication', impact: 'High', likelihood: 'Medium', score: 70, mit: 'Enforce MFA everywhere' },
                { factor: 'Exposed Admin Interfaces', impact: 'High', likelihood: 'Medium', score: 65, mit: 'VPN + IP allowlisting' },
                { factor: 'Insufficient Logging', impact: 'Medium', likelihood: 'High', score: 55, mit: 'Centralize SIEM logging' },
                { factor: 'Outdated SSL/TLS Config', impact: 'Medium', likelihood: 'Medium', score: 40, mit: 'Enforce TLS 1.3 minimum' },
                { factor: 'Social Engineering Exposure', impact: 'High', likelihood: 'Low', score: 35, mit: 'Security awareness training' },
            ].map(f => {
                const impCls = f.impact === 'High' ? 'error' : f.impact === 'Medium' ? 'warning' : 'info';
                const liCls = f.likelihood === 'High' ? 'error' : f.likelihood === 'Medium' ? 'warning' : 'info';
                const barCol = f.score >= 70 ? 'var(--cf-status-error)' : f.score >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
                return `<div class="ra-factor-row">
                    <div style="flex:2;font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)">${f.factor}</div>
                    <div style="flex:0.8;text-align:center"><span class="cf-badge ${impCls}">${f.impact}</span></div>
                    <div style="flex:0.8;text-align:center"><span class="cf-badge ${liCls}">${f.likelihood}</span></div>
                    <div style="flex:1;display:flex;align-items:center;gap:var(--cf-space-2)">
                        <div style="flex:1;background:var(--cf-surface-2);border-radius:var(--cf-radius-full);height:4px;overflow:hidden">
                            <div style="width:${f.score}%;height:100%;background:${barCol};border-radius:var(--cf-radius-full)"></div>
                        </div>
                        <span style="font-size:var(--cf-text-xs);font-family:var(--cf-font-mono);color:var(--cf-text-muted);width:24px">${f.score}</span>
                    </div>
                    <div style="flex:2;font-size:var(--cf-text-xs);color:var(--cf-text-muted);text-align:right">${f.mit}</div>
                </div>`;
            }).join('')}
        </div>
    </div>

    <!-- AI Assessment Panel -->
    <div class="cf-card">
        <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-robot"></i> AI Risk Analysis</h3></div>
        <div class="cf-card-body" id="ra-ai-panel">
            <div class="cf-empty">
                <div class="cf-empty-icon"><i class="fas fa-brain"></i></div>
                <div class="cf-empty-title">No assessment yet</div>
                <div class="cf-empty-text">Click "Run Assessment" to generate an AI-powered risk report with tailored recommendations.</div>
            </div>
        </div>
    </div>

</div>`;
    }
}

window.RiskAssessmentScreen = RiskAssessmentScreen;
