/**
 * Sandbox Scanner — CyberForge
 * Static analysis workbench: URL/file → ML scan + IOC extraction + MITRE chain + evidence locker.
 * Backend: POST /api/sandbox/analyze/url, POST /api/sandbox/analyze/file, GET /api/sandbox/history.
 */

class SandboxScannerScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.activeTab = 'url';
        this.currentScan = null;
        this.BACKEND = (window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api').replace(/\/$/, '');
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        window.SandboxInstance = this;
        this.container.innerHTML = this._shell();
        this._bind();
        this._loadHistory();
    }

    hide() { this.isActive = false; }

    /* ──────────────────────────────────────────────────────────
       SCAN ACTIONS
       ────────────────────────────────────────────────────────── */

    async _scanURL() {
        const input = document.getElementById('sb-url-input');
        const url = input?.value?.trim();
        if (!url) return;

        const btn = document.getElementById('sb-url-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        this._setTab('results');
        document.getElementById('sb-results').innerHTML = this._loadingHTML('Sending URL through sandbox pipeline...');

        try {
            const res = await fetch(`${this.BACKEND}/sandbox/analyze/url`, {
                method: 'POST',
                headers: window.CF_API?.headers() || { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, metadata: { source: 'sandbox-ui' } }),
                signal: AbortSignal.timeout(30000),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            this.currentScan = data.scan;
            this._renderScan(data.scan);
            this._loadHistory();
        } catch (e) {
            this._renderError('URL scan failed', url, e.message);
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Scan URL';
    }

    async _scanFile(file) {
        if (!file) return;
        this._setTab('results');
        document.getElementById('sb-results').innerHTML = this._loadingHTML(`Analyzing ${this._esc(file.name)}...`);

        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('metadata', JSON.stringify({ source: 'sandbox-ui' }));

            const res = await fetch(`${this.BACKEND}/sandbox/analyze/file`, {
                method: 'POST',
                body: fd,
                signal: AbortSignal.timeout(60000),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            this.currentScan = data.scan;
            this._renderScan(data.scan);
            this._loadHistory();
        } catch (e) {
            this._renderError('File scan failed', file.name, e.message);
        }
    }

    /* ──────────────────────────────────────────────────────────
       EVIDENCE LOCKER (history)
       ────────────────────────────────────────────────────────── */

    async _loadHistory() {
        const list = document.getElementById('sb-history-list');
        if (!list) return;
        try {
            const res = await fetch(`${this.BACKEND}/sandbox/history?limit=20`);
            const data = await res.json();
            this._renderHistory(data.scans || []);
        } catch (e) {
            list.innerHTML = `<div style="font-size:11px;color:var(--cf-status-error);padding:12px">Locker unavailable: ${this._esc(e.message)}</div>`;
        }
    }

    _renderHistory(items) {
        const list = document.getElementById('sb-history-list');
        if (!list) return;
        if (!items.length) {
            list.innerHTML = `<div style="font-size:11px;color:var(--cf-text-muted);padding:14px;text-align:center">No scans in locker yet</div>`;
            return;
        }
        const verdictColor = { clean: 'var(--cf-status-success)', suspicious: 'var(--cf-status-warning)', malicious: 'var(--cf-status-error)' };
        const verdictIcon  = { clean: 'fa-check-circle', suspicious: 'fa-exclamation-circle', malicious: 'fa-skull-crossbones' };
        list.innerHTML = items.map(it => `
            <div class="sb-history-item" onclick="window.SandboxInstance._loadFromLocker('${it.id}')">
                <i class="fas ${verdictIcon[it.verdict] || 'fa-circle'}" style="color:${verdictColor[it.verdict] || 'var(--cf-text-muted)'};font-size:11px;flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                    <div class="sb-history-target">${this._esc(it.target)}</div>
                    <div class="sb-history-meta">
                        <span>${it.iocCount} IOC${it.iocCount === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>${it.mitreCount} MITRE</span>
                        <span>·</span>
                        <span>${this._timeAgo(it.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async _loadFromLocker(id) {
        try {
            const res = await fetch(`${this.BACKEND}/sandbox/scan/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            this.currentScan = data.scan;
            this._setTab('results');
            this._renderScan(data.scan);
        } catch (e) {
            this._renderError('Failed to load scan', id, e.message);
        }
    }

    /* ──────────────────────────────────────────────────────────
       RENDERING
       ────────────────────────────────────────────────────────── */

    _renderScan(scan) {
        const panel = document.getElementById('sb-results');
        if (!panel) return;
        panel.innerHTML = `
            <div class="sb-scan-grid">
                ${this._renderVerdict(scan)}
                ${this._renderTimeline(scan)}
                ${this._renderKPIs(scan)}
                ${this._renderMitreChain(scan)}
                ${this._renderIOCs(scan)}
                ${this._renderFindings(scan)}
                ${this._renderML(scan)}
            </div>`;
    }

    _renderVerdict(scan) {
        const v = scan.verdict || 'unknown';
        const meta = {
            clean:      { color: 'var(--cf-status-success)', bg: 'var(--cf-status-success-bg)', icon: 'fa-shield-check',     label: 'CLEAN' },
            suspicious: { color: 'var(--cf-status-warning)', bg: 'var(--cf-status-warning-bg)', icon: 'fa-triangle-exclamation', label: 'SUSPICIOUS' },
            malicious:  { color: 'var(--cf-status-error)',   bg: 'var(--cf-status-error-bg)',   icon: 'fa-skull-crossbones', label: 'MALICIOUS' },
            unknown:    { color: 'var(--cf-text-muted)',     bg: 'var(--cf-surface-1)',         icon: 'fa-question-circle',  label: 'UNKNOWN' },
        }[v];
        const risk = scan.mlReport?.aggregate?.overall_risk_level || '—';
        const consensus = scan.mlReport?.aggregate?.model_consensus || null;
        const target = scan.target || '';
        return `
        <div class="sb-verdict-banner" style="background:${meta.bg};border-color:${meta.color}">
            <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
                <i class="fas ${meta.icon}" style="font-size:1.8rem;color:${meta.color};flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:800;color:${meta.color};font-size:18px;letter-spacing:0.04em">${meta.label}</div>
                    <div style="font-family:var(--cf-font-mono);font-size:12px;color:var(--cf-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px" title="${this._esc(target)}">${this._esc(target)}</div>
                </div>
            </div>
            <div style="display:flex;gap:18px;flex-shrink:0">
                <div class="sb-verdict-stat"><div class="sb-vs-val" style="color:${meta.color}">${risk.toUpperCase()}</div><div class="sb-vs-lbl">Risk Level</div></div>
                ${consensus ? `<div class="sb-verdict-stat"><div class="sb-vs-val">${consensus}</div><div class="sb-vs-lbl">Model Consensus</div></div>` : ''}
                <div class="sb-verdict-stat"><div class="sb-vs-val">${scan.durationMs}ms</div><div class="sb-vs-lbl">Scan Time</div></div>
            </div>
        </div>`;
    }

    _renderTimeline(scan) {
        const steps = scan.timeline || [];
        if (!steps.length) return '';
        return `
        <div class="cf-card sb-timeline-card">
            <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-stream"></i> Behavioral Timeline</h3></div>
            <div class="cf-card-body">
                <div class="sb-timeline">
                    ${steps.map((s, i) => `
                        <div class="sb-timeline-step ${i === steps.length - 1 ? 'last' : ''}">
                            <div class="sb-timeline-dot"><i class="fas fa-circle-check"></i></div>
                            <div class="sb-timeline-content">
                                <div class="sb-timeline-label">${this._esc(s.label)}</div>
                                <div class="sb-timeline-time">+${s.at}ms</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    _renderKPIs(scan) {
        const blended = scan.mlReport?.aggregate?.blended_threat_score;
        const tactics = scan.mitre?.tacticsCovered?.length || 0;
        return `
        <div class="sb-kpi-grid">
            <div class="sb-kpi"><i class="fas fa-fingerprint" style="color:var(--cf-interactive-default)"></i><div><div class="sb-kpi-val">${scan.iocs?.length || 0}</div><div class="sb-kpi-lbl">IOCs Extracted</div></div></div>
            <div class="sb-kpi"><i class="fas fa-crosshairs" style="color:#dc2626"></i><div><div class="sb-kpi-val">${scan.mitre?.techniques?.length || 0}</div><div class="sb-kpi-lbl">MITRE Techniques</div></div></div>
            <div class="sb-kpi"><i class="fas fa-layer-group" style="color:#f59e0b"></i><div><div class="sb-kpi-val">${tactics}</div><div class="sb-kpi-lbl">ATT&amp;CK Tactics</div></div></div>
            <div class="sb-kpi"><i class="fas fa-gauge-high" style="color:#8b5cf6"></i><div><div class="sb-kpi-val">${blended != null ? (blended * 100).toFixed(0) : '—'}</div><div class="sb-kpi-lbl">Threat Score</div></div></div>
        </div>`;
    }

    _renderMitreChain(scan) {
        const chain = scan.mitre?.attackChain || [];
        if (!chain.length) {
            return `
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-crosshairs"></i> MITRE ATT&amp;CK Chain</h3></div>
                <div class="cf-card-body" style="color:var(--cf-text-muted);font-size:13px;text-align:center;padding:24px">
                    <i class="fas fa-shield-halved" style="display:block;font-size:24px;margin-bottom:8px;color:var(--cf-status-success)"></i>
                    No MITRE techniques detected — target appears benign by behavioral signal.
                </div>
            </div>`;
        }
        const tacticColor = {
            'Initial Access': '#3b82f6', 'Execution': '#f59e0b', 'Persistence': '#8b5cf6',
            'Defense Evasion': '#06b6d4', 'Credential Access': '#dc2626', 'Discovery': '#10b981',
            'Command and Control': '#ef4444', 'Exfiltration': '#a855f7', 'Impact': '#b91c1c',
        };
        return `
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-crosshairs"></i> MITRE ATT&amp;CK Chain</h3>
                <span class="cf-badge">${chain.length} technique${chain.length === 1 ? '' : 's'}</span>
            </div>
            <div class="cf-card-body">
                <div class="sb-mitre-chain">
                    ${chain.map((t, i) => {
                        const color = tacticColor[t.tactic] || '#6b7280';
                        return `
                        <div class="sb-mitre-node" style="border-color:${color}">
                            <div class="sb-mitre-tactic" style="color:${color}">${this._esc(t.tactic)}</div>
                            <div class="sb-mitre-tech-id">${this._esc(t.techniqueId)}</div>
                            <div class="sb-mitre-tech-name">${this._esc(t.name)}</div>
                            <div class="sb-mitre-conf">
                                <div class="sb-mitre-conf-bar" style="width:${(t.confidence * 100).toFixed(0)}%;background:${color}"></div>
                                <span>${(t.confidence * 100).toFixed(0)}%</span>
                            </div>
                            ${t.evidence ? `<div class="sb-mitre-evidence" title="${this._esc(t.evidence)}">"${this._esc(t.evidence.slice(0, 60))}${t.evidence.length > 60 ? '…' : ''}"</div>` : ''}
                        </div>
                        ${i < chain.length - 1 ? '<i class="fas fa-arrow-right sb-mitre-arrow"></i>' : ''}`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    }

    _renderIOCs(scan) {
        const iocs = scan.iocs || [];
        if (!iocs.length) return '';
        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...iocs].sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));
        const sevColor = { critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
        const typeIcon = { ip: 'fa-network-wired', domain: 'fa-globe', url: 'fa-link', email: 'fa-envelope', hash: 'fa-fingerprint', cve: 'fa-bug', 'crypto-address': 'fa-coins' };
        return `
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-fingerprint"></i> Extracted IOCs</h3>
                <span class="cf-badge">${iocs.length}</span>
            </div>
            <div class="cf-card-body" style="padding:0">
                <div class="sb-ioc-table">
                    ${sorted.map(ioc => `
                        <div class="sb-ioc-row" style="border-left:3px solid ${sevColor[ioc.severity] || '#6b7280'}">
                            <i class="fas ${typeIcon[ioc.type] || 'fa-circle-dot'}" style="color:${sevColor[ioc.severity] || '#6b7280'};width:16px;text-align:center"></i>
                            <span class="sb-ioc-type">${this._esc(ioc.type)}</span>
                            <span class="sb-ioc-value" title="${this._esc(ioc.value)}">${this._esc(ioc.value.length > 64 ? ioc.value.slice(0, 62) + '…' : ioc.value)}</span>
                            <span class="sb-ioc-sev sev-${ioc.severity}">${this._esc(ioc.severity || 'unknown')}</span>
                            <span class="sb-ioc-source">${this._esc(ioc.source || '')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    _renderFindings(scan) {
        const findings = scan.findings || [];
        if (!findings.length) return '';
        return `
        <div class="cf-card">
            <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-magnifying-glass"></i> Security Findings</h3><span class="cf-badge">${findings.length}</span></div>
            <div class="cf-card-body">
                <ul class="sb-findings">
                    ${findings.map(f => `<li><i class="fas fa-circle-exclamation" style="color:var(--cf-status-warning);margin-right:8px;flex-shrink:0;margin-top:3px"></i><span>${this._esc(f)}</span></li>`).join('')}
                </ul>
            </div>
        </div>`;
    }

    _renderML(scan) {
        const ml = scan.mlReport;
        if (!ml) return '';
        const agg = ml.aggregate || {};
        const preds = ml.model_predictions || {};
        return `
        <div class="cf-card">
            <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-brain"></i> ML Model Breakdown</h3></div>
            <div class="cf-card-body">
                <div class="sb-ml-grid">
                    ${Object.entries(preds).map(([name, p]) => {
                        const pct = (p.threat_score * 100).toFixed(0);
                        const color = p.is_threat ? 'var(--cf-status-error)' : pct > 30 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
                        return `
                        <div class="sb-ml-cell">
                            <div class="sb-ml-name">${this._esc(name.replace(/_/g, ' '))}</div>
                            <div class="sb-ml-bar"><div class="sb-ml-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                            <div class="sb-ml-meta"><span style="color:${color};font-weight:700">${pct}/100</span><span>${this._esc(p.risk_level || '—')}</span><span>${(p.confidence || 0).toFixed(0)}% conf</span></div>
                        </div>`;
                    }).join('')}
                </div>
                ${agg.blended_threat_score != null ? `
                <div class="sb-ml-aggregate">
                    Blended threat score: <strong>${(agg.blended_threat_score * 100).toFixed(0)}/100</strong>
                    · Recommended action: <strong style="text-transform:uppercase">${this._esc(agg.recommended_action || '—')}</strong>
                    · Inference: <strong>${this._esc(Object.values(preds)[0]?.inference_source || 'unknown')}</strong>
                </div>` : ''}
            </div>
        </div>`;
    }

    _renderError(title, target, msg) {
        const panel = document.getElementById('sb-results');
        if (!panel) return;
        panel.innerHTML = `
        <div class="cf-card" style="border-color:var(--cf-status-error)">
            <div class="cf-card-body" style="background:var(--cf-status-error-bg);border-radius:var(--cf-radius-lg)">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <i class="fas fa-exclamation-triangle" style="color:var(--cf-status-error);font-size:20px"></i>
                    <span style="font-weight:700;color:var(--cf-text-primary)">${this._esc(title)}</span>
                </div>
                <div style="font-family:var(--cf-font-mono);font-size:11px;color:var(--cf-text-muted)">${this._esc(target)}</div>
                <div style="font-size:13px;color:var(--cf-status-error);margin-top:4px">${this._esc(msg)}</div>
            </div>
        </div>`;
    }

    /* ──────────────────────────────────────────────────────────
       BINDINGS / HELPERS
       ────────────────────────────────────────────────────────── */

    _bind() {
        document.getElementById('sb-url-btn')?.addEventListener('click', () => this._scanURL());
        document.getElementById('sb-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._scanURL(); });

        const fileInput = document.getElementById('sb-file-input');
        const dropZone  = document.getElementById('sb-drop-zone');
        fileInput?.addEventListener('change', () => { if (fileInput.files?.[0]) this._scanFile(fileInput.files[0]); });
        dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files?.[0]) this._scanFile(e.dataTransfer.files[0]);
        });
        dropZone?.addEventListener('click', () => fileInput?.click());

        document.querySelectorAll('.sb-tab-btn').forEach(b => b.addEventListener('click', () => this._setTab(b.dataset.tab)));
        document.getElementById('sb-refresh-history')?.addEventListener('click', () => this._loadHistory());
        this._setTab('url');
    }

    _setTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.sb-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.sb-tab-panel').forEach(p => p.style.display = p.dataset.tab === tab ? 'flex' : 'none');
    }

    _loadingHTML(msg) {
        return `
        <div class="cf-loading" style="flex-direction:column;gap:12px;padding:48px">
            <div class="cf-spinner" style="width:32px;height:32px"></div>
            <div style="font-size:13px;color:var(--cf-text-muted)">${this._esc(msg)}</div>
            <div style="font-size:11px;color:var(--cf-text-muted)">Pipeline: features → ML → IOCs → MITRE → locker</div>
        </div>`;
    }

    _timeAgo(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return Math.floor(diff / 86400000) + 'd ago';
    }

    _esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ──────────────────────────────────────────────────────────
       SHELL (HTML + scoped CSS)
       ────────────────────────────────────────────────────────── */

    _shell() {
        return `
<style>
.sb-layout { display:grid;grid-template-columns:1fr 300px;gap:var(--cf-space-5);align-items:start; }
@media (max-width: 1100px) { .sb-layout { grid-template-columns:1fr; } }

.sb-tab-bar { display:flex;gap:4px;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:4px; }
.sb-tab-btn { padding:8px 16px;border:none;border-radius:var(--cf-radius-md);font-size:13px;font-weight:500;cursor:pointer;background:transparent;color:var(--cf-text-secondary);transition:all 0.15s; }
.sb-tab-btn.active { background:var(--cf-interactive-default);color:var(--cf-text-inverse); }

.sb-url-input { width:100%;padding:10px 14px;background:var(--cf-input-bg);border:1px solid var(--cf-input-border);border-radius:var(--cf-radius-lg);color:var(--cf-text-primary);font-size:13px;font-family:var(--cf-font-mono);outline:none;transition:border-color 0.15s;box-sizing:border-box; }
.sb-url-input:focus { border-color:var(--cf-interactive-default);box-shadow:0 0 0 3px var(--cf-interactive-focus); }

.sb-drop-zone { border:2px dashed var(--cf-border-medium);border-radius:var(--cf-radius-xl);padding:40px 24px;text-align:center;cursor:pointer;transition:all 0.15s; }
.sb-drop-zone:hover, .sb-drop-zone.dragover { border-color:var(--cf-interactive-default);background:var(--cf-interactive-subtle); }
.sb-panel-wrap { display:flex;flex-direction:column;gap:var(--cf-space-4);flex:1; }

/* Verdict banner */
.sb-verdict-banner { display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border:1.5px solid;border-radius:14px;flex-wrap:wrap;gap:16px; }
.sb-verdict-stat { text-align:center;min-width:64px; }
.sb-vs-val { font-size:18px;font-weight:800;color:var(--cf-text-primary); }
.sb-vs-lbl { font-size:9px;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-top:2px; }

/* Scan result grid */
.sb-scan-grid { display:flex;flex-direction:column;gap:16px; }

/* Timeline */
.sb-timeline-card .cf-card-body { padding:18px 20px; }
.sb-timeline { display:flex;align-items:flex-start;justify-content:space-between;gap:6px;flex-wrap:wrap; }
.sb-timeline-step { flex:1;min-width:100px;display:flex;flex-direction:column;align-items:center;position:relative;text-align:center; }
.sb-timeline-step:not(.last)::after { content:'';position:absolute;top:11px;left:55%;width:90%;height:2px;background:linear-gradient(90deg,var(--cf-status-success),rgba(16,185,129,0.2)); }
.sb-timeline-dot { width:24px;height:24px;border-radius:50%;background:var(--cf-status-success);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;position:relative;z-index:1; }
.sb-timeline-content { margin-top:6px; }
.sb-timeline-label { font-size:11px;font-weight:600;color:var(--cf-text-primary);line-height:1.3; }
.sb-timeline-time { font-size:9.5px;color:var(--cf-text-muted);font-family:var(--cf-font-mono);margin-top:2px; }

/* KPI grid */
.sb-kpi-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:10px; }
@media (max-width: 700px) { .sb-kpi-grid { grid-template-columns:repeat(2,1fr); } }
.sb-kpi { display:flex;align-items:center;gap:12px;padding:14px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:12px; }
.sb-kpi i { font-size:20px; }
.sb-kpi-val { font-size:20px;font-weight:800;color:var(--cf-text-primary);line-height:1; }
.sb-kpi-lbl { font-size:10px;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px; }

/* MITRE chain */
.sb-mitre-chain { display:flex;align-items:stretch;gap:8px;overflow-x:auto;padding-bottom:4px; }
.sb-mitre-node { flex-shrink:0;min-width:160px;max-width:200px;padding:10px 12px;background:var(--cf-surface-1);border-left:3px solid;border-radius:8px;display:flex;flex-direction:column;gap:4px; }
.sb-mitre-tactic { font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em; }
.sb-mitre-tech-id { font-size:10px;color:var(--cf-text-muted);font-family:var(--cf-font-mono); }
.sb-mitre-tech-name { font-size:13px;font-weight:600;color:var(--cf-text-primary); }
.sb-mitre-conf { display:flex;align-items:center;gap:6px;margin-top:4px;font-size:10px;color:var(--cf-text-muted); }
.sb-mitre-conf-bar { height:4px;border-radius:99px;flex:1;background:var(--cf-border-light);position:relative;overflow:hidden; }
.sb-mitre-evidence { font-size:10px;color:var(--cf-text-muted);font-style:italic;line-height:1.4;border-top:1px solid var(--cf-border-light);padding-top:6px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.sb-mitre-arrow { color:var(--cf-text-muted);align-self:center;font-size:14px;flex-shrink:0; }

/* IOC table */
.sb-ioc-table { display:flex;flex-direction:column;max-height:340px;overflow-y:auto; }
.sb-ioc-row { display:grid;grid-template-columns:24px 80px 1fr 80px 120px;align-items:center;gap:10px;padding:8px 14px;font-size:12px;border-bottom:1px solid var(--cf-border-light);border-left:3px solid; }
.sb-ioc-row:last-child { border-bottom:none; }
.sb-ioc-row:hover { background:var(--cf-surface-1); }
.sb-ioc-type { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--cf-text-muted); }
.sb-ioc-value { font-family:var(--cf-font-mono);color:var(--cf-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.sb-ioc-sev { font-size:9.5px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:99px;text-align:center; }
.sb-ioc-sev.sev-critical { background:rgba(220,38,38,0.15);color:#dc2626; }
.sb-ioc-sev.sev-high     { background:rgba(239,68,68,0.12);color:#ef4444; }
.sb-ioc-sev.sev-medium   { background:rgba(245,158,11,0.12);color:#d97706; }
.sb-ioc-sev.sev-low      { background:rgba(107,114,128,0.12);color:#6b7280; }
.sb-ioc-source { font-size:10px;color:var(--cf-text-muted);font-family:var(--cf-font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
@media (max-width: 800px) { .sb-ioc-row { grid-template-columns:24px 60px 1fr 60px;} .sb-ioc-source { display:none; } }

/* Findings */
.sb-findings { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px; }
.sb-findings li { display:flex;align-items:flex-start;font-size:13px;color:var(--cf-text-secondary);line-height:1.5; }

/* ML breakdown */
.sb-ml-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px; }
.sb-ml-cell { padding:10px 12px;background:var(--cf-surface-1);border-radius:8px; }
.sb-ml-name { font-size:11px;font-weight:700;text-transform:capitalize;color:var(--cf-text-primary);margin-bottom:6px; }
.sb-ml-bar { height:6px;border-radius:99px;background:var(--cf-border-light);overflow:hidden;margin-bottom:6px; }
.sb-ml-bar-fill { height:100%;border-radius:99px;transition:width 0.4s; }
.sb-ml-meta { display:flex;justify-content:space-between;font-size:10px;color:var(--cf-text-muted); }
.sb-ml-aggregate { font-size:11px;color:var(--cf-text-secondary);margin-top:12px;padding-top:10px;border-top:1px solid var(--cf-border-light); }

/* History (locker) */
.sb-history-item { display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--cf-border-light);cursor:pointer;transition:background 0.12s; }
.sb-history-item:hover { background:var(--cf-surface-1); }
.sb-history-item:last-child { border-bottom:none; }
.sb-history-target { font-size:11.5px;color:var(--cf-text-primary);font-family:var(--cf-font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500; }
.sb-history-meta { font-size:9.5px;color:var(--cf-text-muted);display:flex;gap:5px;margin-top:2px; }
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">
    <div class="screen-header">
        <div>
            <h1 class="screen-title">Sandbox</h1>
            <p class="screen-subtitle">Static analysis pipeline · ML scoring + IOC extraction + MITRE ATT&amp;CK mapping + persistent evidence locker</p>
        </div>
    </div>

    <div class="sb-layout">
        <div class="sb-panel-wrap" style="display:flex">

            <div class="sb-tab-bar">
                <button class="sb-tab-btn" data-tab="url"><i class="fas fa-globe"></i> URL Scan</button>
                <button class="sb-tab-btn" data-tab="file"><i class="fas fa-file-upload"></i> File Scan</button>
                <button class="sb-tab-btn" data-tab="results"><i class="fas fa-chart-bar"></i> Results</button>
            </div>

            <div class="sb-tab-panel sb-panel-wrap" data-tab="url">
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-flask"></i> URL Sandbox Analysis</h3></div>
                    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:12px">
                        <div style="font-size:12px;color:var(--cf-text-muted)">Submit a URL for full pipeline analysis: ML threat scoring across 4 models, IOC extraction (IPs, domains, hashes, CVEs), and MITRE ATT&amp;CK technique mapping. All results persist in the evidence locker.</div>
                        <div style="display:flex;gap:8px">
                            <input class="sb-url-input" id="sb-url-input" placeholder="https://example.com/page?param=value">
                            <button class="cf-btn primary" id="sb-url-btn" style="flex-shrink:0"><i class="fas fa-paper-plane"></i> Scan URL</button>
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap">
                            ${['https://github.com/torvalds/linux','http://192.168.1.1/admin/login.php','https://evil.tk/login?u=x@y'].map(u =>
                                `<button class="cf-btn sm" onclick="document.getElementById('sb-url-input').value='${u}'" style="font-size:11px;font-family:var(--cf-font-mono)">${this._esc(u)}</button>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="sb-tab-panel sb-panel-wrap" data-tab="file" style="display:none">
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-file-upload"></i> File Scan</h3></div>
                    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:14px">
                        <div style="font-size:12px;color:var(--cf-text-muted)">Upload a file to extract hashes, scan for embedded IOCs (URLs, IPs, hashes, CVEs in textual content), detect file type, and map suspicious patterns to MITRE techniques. Files are processed in-memory only — never written to disk.</div>
                        <div id="sb-drop-zone" class="sb-drop-zone">
                            <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:var(--cf-interactive-default);display:block;margin-bottom:10px"></i>
                            <div style="font-size:14px;font-weight:500;color:var(--cf-text-primary);margin-bottom:4px">Drop file here or click to browse</div>
                            <div style="font-size:12px;color:var(--cf-text-muted)">PE, ELF, PDF, Office, ZIP, JS, scripts — up to 50 MB</div>
                        </div>
                        <input type="file" id="sb-file-input" style="display:none">
                    </div>
                </div>
            </div>

            <div class="sb-tab-panel sb-panel-wrap" data-tab="results" style="display:none">
                <div id="sb-results">
                    <div class="cf-empty">
                        <div class="cf-empty-icon"><i class="fas fa-flask"></i></div>
                        <div class="cf-empty-title">No scan results yet</div>
                        <div class="cf-empty-text">Run a URL or file scan above to see verdict, behavioral timeline, MITRE ATT&amp;CK chain, extracted IOCs, and ML model breakdown.</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px">
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-vault"></i> Evidence Locker</h3>
                    <button class="cf-btn sm" id="sb-refresh-history" style="font-size:11px"><i class="fas fa-rotate"></i></button>
                </div>
                <div class="cf-card-body" style="padding:0;max-height:480px;overflow-y:auto">
                    <div id="sb-history-list">
                        <div style="font-size:11px;color:var(--cf-text-muted);padding:14px;text-align:center">Loading...</div>
                    </div>
                </div>
            </div>
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-circle-info"></i> Pipeline</h3></div>
                <div class="cf-card-body" style="display:flex;flex-direction:column;gap:6px">
                    ${[
                        ['ML Engine', 'cyberforge-ml v2'],
                        ['IOC Patterns', '10 types'],
                        ['MITRE Signals', '20+ techniques'],
                        ['Locker Capacity', '200 scans'],
                        ['Max File', '50 MB'],
                    ].map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px dashed var(--cf-border-light)"><span style="color:var(--cf-text-muted)">${k}</span><span style="color:var(--cf-text-secondary);font-weight:500">${v}</span></div>`).join('')}
                </div>
            </div>
        </div>
    </div>
</div>`;
    }
}

window.SandboxScannerScreen = SandboxScannerScreen;
