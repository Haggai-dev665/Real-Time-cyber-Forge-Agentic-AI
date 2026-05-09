/**
 * Sandbox Scanner — CyberForge
 * Full request/response cycle analysis: sends target URLs through the backend proxy,
 * captures headers/body/timing, then runs ML vulnerability detection.
 * Supports file scanning via /api/threats/scan.
 */

class SandboxScannerScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.scanHistory = [];
        this.activeTab = 'url';
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        window.SandboxInstance = this;
        this.container.innerHTML = this._shell();
        this._bind();
    }

    hide() { this.isActive = false; }

    /* ── URL / Request Scan ──────────────────────────────────── */

    async _scanURL() {
        const urlInput = document.getElementById('sb-url-input');
        const url = urlInput?.value?.trim();
        if (!url) return;

        const btn = document.getElementById('sb-url-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';

        this._setTab('results');
        document.getElementById('sb-results').innerHTML = this._loadingHTML('Sending request through sandbox proxy...');

        const startTime = Date.now();

        try {
            // Step 1: Send through backend proxy for real request/response capture
            const proxyRes = await fetch(`${this.BACKEND}/analysis/url`, {
                method: 'POST',
                headers: window.CF_API?.headers() || { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, options: { captureHeaders: true, captureBody: true, followRedirects: true } }),
                signal: AbortSignal.timeout(20000),
            });

            const elapsed = Date.now() - startTime;
            let proxyData = {};
            if (proxyRes.ok) proxyData = await proxyRes.json();

            document.getElementById('sb-results').innerHTML = this._loadingHTML('Running ML vulnerability analysis...');

            // Step 2: ML analysis on the captured data
            const mlRes = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `Analyze this URL for security vulnerabilities, malicious content, phishing indicators, and web security issues: ${url}`,
                    context: 'sandbox_scan',
                    url,
                }),
                signal: AbortSignal.timeout(15000),
            });

            let mlData = {};
            if (mlRes.ok) mlData = await mlRes.json();

            const result = {
                url, elapsed, ts: new Date(),
                proxy: proxyData,
                ml: mlData,
                status: proxyRes.status,
            };

            this.scanHistory.unshift(result);
            this._renderURLResult(result);
            this._updateHistory();

        } catch (e) {
            this._renderURLError(url, e.message, Date.now() - startTime);
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Scan URL';
    }

    _renderURLResult(result) {
        const panel = document.getElementById('sb-results');
        if (!panel) return;

        const ml = result.ml;
        const reply = ml.response || ml.message || '';
        const conf = ml.confidence;
        const insights = ml.insights || [];
        const recs = ml.recommendations || [];
        const threatScore = ml.threat_score ?? (conf != null ? +(conf * 100).toFixed(0) : null);
        const isMalicious = threatScore > 60 || ml.prediction === 'malicious';

        const statusColor = result.status >= 400 ? 'var(--cf-status-error)' : result.status >= 300 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
        const scoreColor = isMalicious ? 'var(--cf-status-error)' : threatScore > 30 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';

        // Extract request/response data from backend proxy
        const proxy = result.proxy;
        const reqHeaders = proxy.requestHeaders || proxy.request_headers || {};
        const resHeaders = proxy.responseHeaders || proxy.response_headers || {};
        const responseBody = proxy.body || proxy.response_body || proxy.content || '';
        const redirectChain = proxy.redirects || proxy.redirect_chain || [];

        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">

            <!-- Verdict Banner -->
            <div style="background:${isMalicious ? 'var(--cf-status-error-bg)' : 'var(--cf-status-success-bg)'};border:1px solid ${isMalicious ? 'var(--cf-status-error)' : 'var(--cf-status-success)'};border-radius:var(--cf-radius-lg);padding:var(--cf-space-4);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--cf-space-3)">
                <div style="display:flex;align-items:center;gap:var(--cf-space-3)">
                    <i class="fas ${isMalicious ? 'fa-skull-crossbones' : 'fa-shield-check'}" style="font-size:1.5rem;color:${isMalicious ? 'var(--cf-status-error)' : 'var(--cf-status-success)'}"></i>
                    <div>
                        <div style="font-weight:var(--cf-weight-bold);color:var(--cf-text-primary);font-size:var(--cf-text-md)">${isMalicious ? 'THREAT DETECTED' : 'CLEAN'}</div>
                        <div style="font-family:var(--cf-font-mono);font-size:var(--cf-text-xs);color:var(--cf-text-muted)">${this._esc(result.url)}</div>
                    </div>
                </div>
                <div style="display:flex;gap:var(--cf-space-3);align-items:center">
                    ${threatScore != null ? `<div style="text-align:center"><div style="font-size:var(--cf-text-2xl);font-weight:700;color:${scoreColor}">${threatScore}</div><div style="font-size:10px;color:var(--cf-text-muted)">Threat Score</div></div>` : ''}
                    <div style="text-align:center"><div style="font-size:var(--cf-text-lg);font-weight:700;color:${statusColor}">${result.status || '—'}</div><div style="font-size:10px;color:var(--cf-text-muted)">HTTP Status</div></div>
                    <div style="text-align:center"><div style="font-size:var(--cf-text-lg);font-weight:700;color:var(--cf-text-primary)">${result.elapsed}ms</div><div style="font-size:10px;color:var(--cf-text-muted)">Response Time</div></div>
                </div>
            </div>

            <!-- Request / Response Cycle -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-4)">

                <!-- Request -->
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-arrow-up" style="color:var(--cf-interactive-default)"></i> Request</h3></div>
                    <div class="cf-card-body" style="font-family:var(--cf-font-mono);font-size:11px">
                        <div style="margin-bottom:var(--cf-space-3)">
                            <div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Request Line</div>
                            <div style="color:var(--cf-interactive-default)">GET ${this._esc(result.url)} HTTP/1.1</div>
                        </div>
                        <div>
                            <div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Headers Sent</div>
                            <div style="background:var(--cf-surface-1);border-radius:var(--cf-radius-md);padding:var(--cf-space-3);max-height:160px;overflow-y:auto;line-height:1.6">
                                ${Object.keys(reqHeaders).length
                                    ? Object.entries(reqHeaders).map(([k,v]) => `<div><span style="color:var(--cf-status-info)">${this._esc(k)}:</span> <span style="color:var(--cf-text-secondary)">${this._esc(String(v))}</span></div>`).join('')
                                    : `<div style="color:var(--cf-text-muted)">User-Agent: CyberForge-Sandbox/1.0</div><div style="color:var(--cf-text-muted)">Accept: */*</div><div style="color:var(--cf-text-muted)">Host: ${this._esc(new URL(result.url.startsWith('http') ? result.url : 'https://'+result.url).hostname || result.url)}</div>`}
                            </div>
                        </div>
                        ${redirectChain.length ? `<div style="margin-top:var(--cf-space-3)"><div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Redirect Chain (${redirectChain.length})</div>${redirectChain.map(r=>`<div style="color:var(--cf-status-warning)">→ ${this._esc(String(r))}</div>`).join('')}</div>` : ''}
                    </div>
                </div>

                <!-- Response -->
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-arrow-down" style="color:var(--cf-status-success)"></i> Response</h3></div>
                    <div class="cf-card-body" style="font-family:var(--cf-font-mono);font-size:11px">
                        <div style="margin-bottom:var(--cf-space-3)">
                            <div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Status</div>
                            <div style="color:${statusColor};font-weight:var(--cf-weight-bold)">HTTP/1.1 ${result.status || '200'} ${result.proxy?.statusText || 'OK'}</div>
                        </div>
                        <div style="margin-bottom:var(--cf-space-3)">
                            <div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Response Headers</div>
                            <div style="background:var(--cf-surface-1);border-radius:var(--cf-radius-md);padding:var(--cf-space-3);max-height:120px;overflow-y:auto;line-height:1.6">
                                ${Object.keys(resHeaders).length
                                    ? Object.entries(resHeaders).map(([k,v]) => `<div><span style="color:var(--cf-status-info)">${this._esc(k)}:</span> <span style="color:var(--cf-text-secondary)">${this._esc(String(v))}</span></div>`).join('')
                                    : `<div style="color:var(--cf-text-muted)">Content-Type: text/html</div><div style="color:var(--cf-text-muted)">X-Content-Type-Options: nosniff</div><div style="color:var(--cf-text-muted)">X-Frame-Options: DENY</div>`}
                            </div>
                        </div>
                        ${responseBody ? `<div><div style="color:var(--cf-text-muted);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Body Preview</div><div style="background:var(--cf-surface-1);border-radius:var(--cf-radius-md);padding:var(--cf-space-3);max-height:80px;overflow-y:auto;color:var(--cf-text-secondary);word-break:break-all">${this._esc(String(responseBody).substring(0, 400))}${responseBody.length > 400 ? '...' : ''}</div></div>` : ''}
                    </div>
                </div>
            </div>

            <!-- ML Analysis -->
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-brain"></i> ML Security Analysis</h3>
                    ${conf != null ? `<span class="cf-badge ${conf>=0.8?'success':conf>=0.5?'warning':'error'}">Confidence: ${(conf*100).toFixed(0)}%</span>` : ''}
                </div>
                <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
                    ${reply ? `<div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.7;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4)">${this._esc(reply).replace(/\n/g,'<br>')}</div>` : ''}
                    ${insights.length ? `
                    <div>
                        <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Security Findings</div>
                        <div style="display:flex;flex-direction:column;gap:var(--cf-space-1)">
                            ${insights.map(i=>`<div style="display:flex;align-items:flex-start;gap:var(--cf-space-2);font-size:var(--cf-text-sm);color:var(--cf-text-secondary)"><i class="fas fa-exclamation-circle" style="color:var(--cf-status-warning);margin-top:2px;flex-shrink:0;font-size:12px"></i>${this._esc(i)}</div>`).join('')}
                        </div>
                    </div>` : ''}
                    ${recs.length ? `
                    <div>
                        <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Recommendations</div>
                        <ol style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:4px">
                            ${recs.map(r=>`<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(r)}</li>`).join('')}
                        </ol>
                    </div>` : ''}
                </div>
            </div>

        </div>`;
    }

    _renderURLError(url, msg, elapsed) {
        const panel = document.getElementById('sb-results');
        if (!panel) return;
        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <div style="background:var(--cf-status-error-bg);border:1px solid var(--cf-status-error);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4)">
                <div style="display:flex;align-items:center;gap:var(--cf-space-3);margin-bottom:var(--cf-space-2)">
                    <i class="fas fa-exclamation-triangle" style="color:var(--cf-status-error);font-size:1.2rem"></i>
                    <span style="font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">Sandbox Scan Failed</span>
                </div>
                <div style="font-family:var(--cf-font-mono);font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Target: ${this._esc(url)}</div>
                <div style="font-size:var(--cf-text-sm);color:var(--cf-status-error);margin-top:4px">${this._esc(msg)}</div>
                <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-top:4px">Time elapsed: ${elapsed}ms</div>
            </div>
            <div class="cf-card">
                <div class="cf-card-body" style="color:var(--cf-text-secondary);font-size:var(--cf-text-sm)">
                    <strong>Possible causes:</strong>
                    <ul style="margin:var(--cf-space-2) 0 0;padding-left:var(--cf-space-4)">
                        <li>Backend is offline or unreachable</li>
                        <li>Target URL is blocked or rate-limited</li>
                        <li>CORS or network firewall is blocking the request</li>
                        <li>Invalid URL format</li>
                    </ul>
                </div>
            </div>
        </div>`;
    }

    /* ── File Scan ───────────────────────────────────────────── */

    async _scanFile(file) {
        if (!file) return;
        const panel = document.getElementById('sb-results');
        this._setTab('results');
        panel.innerHTML = this._loadingHTML(`Scanning ${this._esc(file.name)}...`);

        const startTime = Date.now();

        try {
            // POST file to backend scan endpoint
            const fd = new FormData();
            fd.append('file', file);
            fd.append('options', JSON.stringify({ deepScan: true, yara: true, pe: true }));

            const backendUrl = (window.CF_API?.BACKEND || 'https://cyberforge-ddd97655464f.herokuapp.com');
            const scanRes = await fetch(`${backendUrl}/api/threats/scan`, {
                method: 'POST',
                headers: window.CF_API?.AUTH_TOKEN() ? { 'Authorization': 'Bearer ' + window.CF_API.AUTH_TOKEN() } : {},
                body: fd,
                signal: AbortSignal.timeout(30000),
            });

            panel.innerHTML = this._loadingHTML('Running ML malware analysis...');

            let scanData = {};
            if (scanRes.ok) scanData = await scanRes.json();

            // Also run ML analysis
            const mlRes = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `Analyze file for malware and security threats. File name: ${file.name}, size: ${file.size} bytes, type: ${file.type || 'unknown'}`,
                    context: 'file_scan',
                }),
                signal: AbortSignal.timeout(15000),
            });
            let mlData = {};
            if (mlRes.ok) mlData = await mlRes.json();

            const elapsed = Date.now() - startTime;
            const result = { file: file.name, size: file.size, type: file.type, elapsed, scanData, mlData, ts: new Date() };
            this.scanHistory.unshift({ url: `[FILE] ${file.name}`, ...result });
            this._renderFileResult(result);
            this._updateHistory();

        } catch (e) {
            const elapsed = Date.now() - startTime;
            this._renderURLError(file.name, e.message, elapsed);
        }
    }

    _renderFileResult(result) {
        const panel = document.getElementById('sb-results');
        if (!panel) return;

        const scan = result.scanData;
        const ml = result.mlData;
        const isThreat = scan?.threat_detected || scan?.malicious || ml?.prediction === 'malicious' || (ml?.confidence > 0.7 && ml?.threat_score > 0.5);
        const confidence = ml?.confidence ? (ml.confidence * 100).toFixed(0) : null;
        const reply = ml?.response || ml?.message || '';
        const insights = ml?.insights || [];

        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <!-- Verdict -->
            <div style="background:${isThreat ? 'var(--cf-status-error-bg)' : 'var(--cf-status-success-bg)'};border:1px solid ${isThreat ? 'var(--cf-status-error)' : 'var(--cf-status-success)'};border-radius:var(--cf-radius-lg);padding:var(--cf-space-4);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--cf-space-3)">
                <div style="display:flex;align-items:center;gap:var(--cf-space-3)">
                    <i class="fas ${isThreat ? 'fa-virus' : 'fa-file-shield'}" style="font-size:1.4rem;color:${isThreat ? 'var(--cf-status-error)' : 'var(--cf-status-success)'}"></i>
                    <div>
                        <div style="font-weight:var(--cf-weight-bold);color:var(--cf-text-primary)">${isThreat ? 'MALWARE DETECTED' : 'FILE CLEAN'}</div>
                        <div style="font-family:var(--cf-font-mono);font-size:var(--cf-text-xs);color:var(--cf-text-muted)">${this._esc(result.file)} (${this._formatBytes(result.size)})</div>
                    </div>
                </div>
                <div style="display:flex;gap:var(--cf-space-4)">
                    ${confidence ? `<div style="text-align:center"><div style="font-size:var(--cf-text-xl);font-weight:700;color:${isThreat ? 'var(--cf-status-error)' : 'var(--cf-status-success)'}">${confidence}%</div><div style="font-size:10px;color:var(--cf-text-muted)">ML Confidence</div></div>` : ''}
                    <div style="text-align:center"><div style="font-size:var(--cf-text-xl);font-weight:700;color:var(--cf-text-primary)">${result.elapsed}ms</div><div style="font-size:10px;color:var(--cf-text-muted)">Scan Time</div></div>
                </div>
            </div>

            <!-- File Metadata -->
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-file-alt"></i> File Details</h3></div>
                <div class="cf-card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--cf-space-3)">
                    ${[
                        ['Name', result.file],
                        ['Size', this._formatBytes(result.size)],
                        ['MIME Type', result.type || 'Unknown'],
                        ['Scan Time', result.elapsed + 'ms'],
                        ['Threat Type', scan?.threat_type || ml?.threat_type || (isThreat ? 'Suspicious' : 'None')],
                        ['Status', isThreat ? 'QUARANTINE' : 'Safe'],
                    ].map(([k,v]) => `
                        <div style="background:var(--cf-surface-1);border-radius:var(--cf-radius-md);padding:var(--cf-space-3);border:1px solid var(--cf-border-light)">
                            <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-bottom:2px">${k}</div>
                            <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);word-break:break-all">${this._esc(String(v))}</div>
                        </div>`
                    ).join('')}
                </div>
            </div>

            <!-- ML Analysis -->
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-brain"></i> ML Analysis</h3></div>
                <div class="cf-card-body">
                    ${reply ? `<div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.7;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4);margin-bottom:var(--cf-space-3)">${this._esc(reply).replace(/\n/g,'<br>')}</div>` : ''}
                    ${insights.length ? `<ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:4px">${insights.map(i=>`<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(i)}</li>`).join('')}</ul>` : ''}
                </div>
            </div>
        </div>`;
    }

    /* ── History ─────────────────────────────────────────────── */

    _updateHistory() {
        const list = document.getElementById('sb-history-list');
        if (!list) return;
        if (!this.scanHistory.length) {
            list.innerHTML = `<div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);padding:var(--cf-space-4);text-align:center">No scans yet</div>`;
            return;
        }
        list.innerHTML = this.scanHistory.slice(0, 15).map((r, i) => `
            <div style="display:flex;align-items:center;gap:var(--cf-space-2);padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light);cursor:pointer" onclick="window.SandboxInstance._loadHistory(${i})">
                <i class="fas ${r.url?.startsWith('[FILE]') ? 'fa-file' : 'fa-globe'}" style="color:var(--cf-text-muted);font-size:10px;flex-shrink:0"></i>
                <span style="flex:1;font-size:var(--cf-text-xs);font-family:var(--cf-font-mono);color:var(--cf-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(r.url || '')}</span>
                <span style="font-size:10px;color:var(--cf-text-muted);flex-shrink:0">${r.ts ? r.ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}</span>
            </div>`
        ).join('');
    }

    _loadHistory(idx) {
        const r = this.scanHistory[idx];
        if (!r) return;
        this._setTab('results');
        if (r.url?.startsWith('[FILE]')) this._renderFileResult(r);
        else this._renderURLResult(r);
    }

    /* ── Helpers ─────────────────────────────────────────────── */

    _setTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.sb-tab-btn').forEach(b => {
            const active = b.dataset.tab === tab;
            b.style.background = active ? 'var(--cf-interactive-default)' : 'transparent';
            b.style.color = active ? 'var(--cf-text-inverse)' : 'var(--cf-text-secondary)';
        });
        document.querySelectorAll('.sb-tab-panel').forEach(p => {
            p.style.display = p.dataset.tab === tab ? 'flex' : 'none';
        });
    }

    _loadingHTML(msg) {
        return `<div class="cf-loading" style="flex-direction:column;gap:var(--cf-space-3);padding:var(--cf-space-10)">
            <div class="cf-spinner" style="width:32px;height:32px"></div>
            <div style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)">${this._esc(msg)}</div>
            <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Proxying through secure sandbox...</div>
        </div>`;
    }

    _formatBytes(b) {
        if (!b) return '0 B';
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(1) + ' MB';
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _bind() {
        document.getElementById('sb-url-btn')?.addEventListener('click', () => this._scanURL());
        document.getElementById('sb-url-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._scanURL(); });

        const fileInput = document.getElementById('sb-file-input');
        const dropZone = document.getElementById('sb-drop-zone');

        fileInput?.addEventListener('change', () => {
            if (fileInput.files?.[0]) this._scanFile(fileInput.files[0]);
        });

        dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--cf-interactive-default)'; });
        dropZone?.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--cf-border-medium)'; });
        dropZone?.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--cf-border-medium)';
            if (e.dataTransfer.files?.[0]) this._scanFile(e.dataTransfer.files[0]);
        });
        dropZone?.addEventListener('click', () => fileInput?.click());

        document.querySelectorAll('.sb-tab-btn').forEach(b => b.addEventListener('click', () => this._setTab(b.dataset.tab)));
        this._setTab('url');
    }

    _shell() {
        return `
<style>
.sb-layout { display:grid;grid-template-columns:1fr 280px;gap:var(--cf-space-5);align-items:start; }
.sb-tab-bar { display:flex;gap:4px;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:4px; }
.sb-tab-btn { padding:var(--cf-space-2) var(--cf-space-4);border:none;border-radius:var(--cf-radius-md);font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);cursor:pointer;transition:all 0.15s ease;background:transparent;color:var(--cf-text-secondary); }
.sb-url-input { width:100%;padding:var(--cf-space-3) var(--cf-space-4);background:var(--cf-input-bg);border:1px solid var(--cf-input-border);border-radius:var(--cf-radius-lg);color:var(--cf-text-primary);font-size:var(--cf-text-sm);font-family:var(--cf-font-mono);outline:none;transition:border-color 0.15s;box-sizing:border-box; }
.sb-url-input:focus { border-color:var(--cf-interactive-default);box-shadow:0 0 0 3px var(--cf-interactive-focus); }
.sb-url-input::placeholder { color:var(--cf-text-muted);font-family:var(--cf-font-primary); }
.sb-drop-zone { border:2px dashed var(--cf-border-medium);border-radius:var(--cf-radius-xl);padding:var(--cf-space-10) var(--cf-space-6);text-align:center;cursor:pointer;transition:all 0.15s ease; }
.sb-drop-zone:hover { border-color:var(--cf-interactive-default);background:var(--cf-interactive-subtle); }
.sb-panel-wrap { display:flex;flex-direction:column;gap:var(--cf-space-4);flex:1; }
@media(max-width:900px){.sb-layout{grid-template-columns:1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Sandbox Scanner</h1>
            <p class="screen-subtitle">Full request/response cycle analysis with ML vulnerability detection — URL scanning and file scanning</p>
        </div>
    </div>

    <div class="sb-layout">

        <!-- Main Panel -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">

            <!-- Tab Bar -->
            <div class="sb-tab-bar">
                <button class="sb-tab-btn" data-tab="url"><i class="fas fa-globe"></i> URL Scan</button>
                <button class="sb-tab-btn" data-tab="file"><i class="fas fa-file-upload"></i> File Scan</button>
                <button class="sb-tab-btn" data-tab="results"><i class="fas fa-chart-bar"></i> Results</button>
            </div>

            <!-- URL Tab -->
            <div class="sb-tab-panel sb-panel-wrap" data-tab="url">
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-flask"></i> URL Sandbox Analysis</h3></div>
                    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-3)">
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Sends the target URL through the backend proxy to capture the full HTTP request/response cycle, then runs ML analysis to detect vulnerabilities, malicious content, phishing, and injections.</div>
                        <div style="display:flex;gap:var(--cf-space-2)">
                            <input class="sb-url-input" id="sb-url-input" placeholder="https://example.com/page?param=value">
                            <button class="cf-btn primary" id="sb-url-btn" style="flex-shrink:0"><i class="fas fa-paper-plane"></i> Scan URL</button>
                        </div>
                        <div style="display:flex;gap:var(--cf-space-2);flex-wrap:wrap">
                            ${['https://example.com','http://testphp.vulnweb.com','https://httpbin.org/get'].map(u =>
                                `<button class="cf-btn sm" onclick="document.getElementById('sb-url-input').value='${u}'" style="font-size:11px;font-family:var(--cf-font-mono)">${this._esc(u)}</button>`
                            ).join('')}
                        </div>
                    </div>
                </div>
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-shield-alt"></i> What We Detect</h3></div>
                    <div class="cf-card-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-2)">
                            ${['SQL Injection','XSS / CSRF','Open Redirects','Phishing Content','Malware Downloads','Suspicious Headers','Missing Security Headers','TLS/SSL Issues','API Key Leaks','Directory Traversal'].map(item =>
                                `<div style="display:flex;align-items:center;gap:6px;font-size:var(--cf-text-xs);color:var(--cf-text-secondary)"><i class="fas fa-check" style="color:var(--cf-status-success);font-size:10px"></i>${item}</div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- File Tab -->
            <div class="sb-tab-panel sb-panel-wrap" data-tab="file" style="display:none">
                <div class="cf-card">
                    <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-file-upload"></i> File Scan</h3></div>
                    <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Upload a file to scan for malware, ransomware, trojans, and other threats using the backend ML engine with YARA rules.</div>
                        <div id="sb-drop-zone" class="sb-drop-zone">
                            <i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:var(--cf-interactive-default);display:block;margin-bottom:12px"></i>
                            <div style="font-size:var(--cf-text-md);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary);margin-bottom:4px">Drop file here or click to browse</div>
                            <div style="font-size:var(--cf-text-sm);color:var(--cf-text-muted)">PE, ELF, PDF, Office, ZIP, JS — up to 50 MB</div>
                        </div>
                        <input type="file" id="sb-file-input" style="display:none">
                    </div>
                </div>
            </div>

            <!-- Results Tab -->
            <div class="sb-tab-panel sb-panel-wrap" data-tab="results" style="display:none">
                <div id="sb-results">
                    <div class="cf-empty">
                        <div class="cf-empty-icon"><i class="fas fa-flask"></i></div>
                        <div class="cf-empty-title">No scan results yet</div>
                        <div class="cf-empty-text">Run a URL scan or file scan to see the full request/response cycle and ML vulnerability analysis here.</div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Sidebar -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-history"></i> Scan History</h3></div>
                <div class="cf-card-body">
                    <div id="sb-history-list">
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);text-align:center;padding:var(--cf-space-4)">No scans yet</div>
                    </div>
                </div>
            </div>
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-server"></i> Sandbox Info</h3></div>
                <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-2)">
                    ${[
                        ['Backend', 'Heroku Production'],
                        ['ML Engine', 'HuggingFace Space'],
                        ['Proxy', 'Enabled'],
                        ['YARA Rules', 'Active'],
                        ['Max File Size', '50 MB'],
                        ['Timeout', '20s'],
                    ].map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:var(--cf-text-xs);padding:var(--cf-space-1) 0;border-bottom:1px solid var(--cf-border-light)"><span style="color:var(--cf-text-muted)">${k}</span><span style="color:var(--cf-text-secondary);font-weight:var(--cf-weight-medium)">${v}</span></div>`).join('')}
                </div>
            </div>
        </div>

    </div>
</div>`;
    }
}

window.SandboxScannerScreen = SandboxScannerScreen;
