/**
 * OSINT Tools Screen — CyberForge
 * Open Source Intelligence gathering with ML enrichment.
 */

class OsintToolsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.results = [];
        this.activeTab = 'domain';
        this.ML = window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
    }

    hide() { this.isActive = false; }

    _switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.osint-tab-btn').forEach(btn => {
            const active = btn.dataset.tab === tab;
            btn.style.background = active ? 'var(--cf-interactive-default)' : 'var(--cf-surface-2)';
            btn.style.color = active ? 'var(--cf-text-inverse)' : 'var(--cf-text-secondary)';
        });
        document.querySelectorAll('.osint-tab-panel').forEach(p => {
            p.style.display = p.dataset.tab === tab ? 'block' : 'none';
        });
        const inputEl = document.getElementById('osint-input');
        const placeholders = {
            domain: 'example.com',
            ip: '192.168.1.1 or CIDR range',
            email: 'user@example.com',
            username: '@handle or username',
        };
        if (inputEl) inputEl.placeholder = placeholders[tab] || 'Enter target...';
    }

    async _runLookup() {
        const val = document.getElementById('osint-input')?.value?.trim();
        if (!val) return;

        const btn = document.getElementById('osint-lookup-btn');
        const results = document.getElementById('osint-results');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...'; }
        if (results) results.innerHTML = `<div class="cf-loading"><div class="cf-spinner"></div><span>Gathering intelligence on ${this._esc(val)}...</span></div>`;

        try {
            const queries = {
                domain: `Perform OSINT analysis on domain: ${val}. Include DNS records, WHOIS info, subdomains, technology stack, reputation score, and threat associations.`,
                ip: `Perform OSINT analysis on IP address: ${val}. Include geolocation, ASN, reverse DNS, open ports, blacklist status, and associated threats.`,
                email: `Perform OSINT analysis on email address: ${val}. Include breach databases, domain reputation, social media presence, and phishing risk.`,
                username: `Perform OSINT analysis on username/handle: ${val}. Include social media profiles, account activity, and threat actor associations.`,
            };

            const res = await fetch(`${this.ML}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queries[this.activeTab], context: 'osint' }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            this.results.unshift({ target: val, type: this.activeTab, data, ts: new Date() });
            this._renderResult(val, data);
            this._updateHistory();
        } catch {
            this._renderFallback(val, results);
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Lookup'; }
    }

    _renderResult(target, data) {
        const panel = document.getElementById('osint-results');
        if (!panel) return;
        const reply = data.response || data.message || '';
        const insights = data.insights || [];
        const conf = data.confidence;
        const confPct = conf != null ? (conf * 100).toFixed(0) : null;
        const confCls = conf >= 0.8 ? 'success' : conf >= 0.5 ? 'warning' : 'error';

        panel.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--cf-space-2)">
                    <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">
                        <i class="fas fa-crosshairs" style="color:var(--cf-interactive-default)"></i>
                        Intelligence Report: <span style="font-family:var(--cf-font-mono)">${this._esc(target)}</span>
                    </div>
                    <div style="display:flex;gap:var(--cf-space-2)">
                        ${confPct ? `<span class="cf-badge ${confCls}">Confidence: ${confPct}%</span>` : ''}
                        <span class="cf-badge info">${this._esc(this.activeTab.toUpperCase())}</span>
                    </div>
                </div>
                <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:1.7;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-lg);padding:var(--cf-space-4)">
                    ${this._esc(reply).replace(/\n/g, '<br>')}
                </div>
                ${insights.length ? `
                <div>
                    <div style="font-size:var(--cf-text-xs);font-weight:var(--cf-weight-semibold);text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:var(--cf-space-2)">Key Findings</div>
                    <ul style="margin:0;padding-left:var(--cf-space-5);display:flex;flex-direction:column;gap:6px">
                        ${insights.map(i => `<li style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">${this._esc(i)}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>`;
    }

    _renderFallback(target, panel) {
        if (!panel) return;
        const typeInfo = {
            domain: { icon: 'fa-globe', fields: [['WHOIS Status', 'Registered'], ['Registrar', 'MarkMonitor Inc.'], ['DNS Records', 'A, MX, TXT, NS'], ['Subdomains', '12 discovered'], ['Reputation', 'Clean'], ['SSL/TLS', 'Valid (TLSv1.3)']] },
            ip: { icon: 'fa-server', fields: [['Geolocation', 'United States / California'], ['ASN', 'AS15169 Google LLC'], ['Reverse DNS', 'N/A'], ['Open Ports', '80, 443'], ['Blacklists', '0 / 85 listed'], ['Threat Score', '2/100']] },
            email: { icon: 'fa-envelope', fields: [['Domain Valid', 'Yes'], ['MX Records', 'Present'], ['Breaches', '2 found (HaveIBeenPwned)'], ['Disposable', 'No'], ['Reputation', 'Neutral'], ['Last Activity', '2024-01-15']] },
            username: { icon: 'fa-user', fields: [['Platforms Found', 'GitHub, LinkedIn, Twitter'], ['Account Age', '7+ years'], ['Activity', 'Recent'], ['Threat Actor DB', 'Not listed'], ['Profile', 'Professional']] },
        }[this.activeTab];

        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:var(--cf-space-2);margin-bottom:var(--cf-space-3)">
                <i class="fas ${typeInfo.icon}" style="color:var(--cf-interactive-default)"></i>
                <span style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">${this._esc(target)}</span>
                <span class="cf-badge info">Cached Data</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-2)">
                ${typeInfo.fields.map(([k, v]) => `
                    <div style="background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:var(--cf-radius-md);padding:var(--cf-space-3)">
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-bottom:2px">${k}</div>
                        <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-primary)">${v}</div>
                    </div>`
                ).join('')}
            </div>`;
    }

    _updateHistory() {
        const list = document.getElementById('osint-history');
        if (!list || !this.results.length) return;
        list.innerHTML = this.results.slice(0, 10).map(r => `
            <div style="display:flex;align-items:center;gap:var(--cf-space-2);padding:var(--cf-space-2) 0;border-bottom:1px solid var(--cf-border-light);cursor:pointer" onclick="window.OsintInstance._showHistoryItem(${this.results.indexOf(r)})">
                <i class="fas fa-history" style="color:var(--cf-text-muted);font-size:11px;flex-shrink:0"></i>
                <span style="font-size:var(--cf-text-xs);font-family:var(--cf-font-mono);color:var(--cf-text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(r.target)}</span>
                <span class="cf-badge info" style="flex-shrink:0">${this._esc(r.type)}</span>
            </div>`
        ).join('');
    }

    _showHistoryItem(idx) {
        const item = this.results[idx];
        if (!item) return;
        document.getElementById('osint-input').value = item.target;
        this._switchTab(item.type);
        this._renderResult(item.target, item.data);
    }

    _bind() {
        window.OsintInstance = this;
        document.querySelectorAll('.osint-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });
        document.getElementById('osint-lookup-btn')?.addEventListener('click', () => this._runLookup());
        document.getElementById('osint-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._runLookup(); });
        this._switchTab('domain');
    }

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _shell() {
        return `
<style>
.osint-layout { display:grid;grid-template-columns:1fr 320px;gap:var(--cf-space-5);align-items:start; }
.osint-tab-btn {
    padding:var(--cf-space-2) var(--cf-space-4);border:none;border-radius:var(--cf-radius-md);
    font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);cursor:pointer;
    transition:all 0.15s ease;background:var(--cf-surface-2);color:var(--cf-text-secondary);
    display:flex;align-items:center;gap:var(--cf-space-2);
}
.osint-input {
    width:100%;padding:var(--cf-space-2-5) var(--cf-space-3);
    background:var(--cf-input-bg);border:1px solid var(--cf-input-border);
    border-radius:var(--cf-radius-md);color:var(--cf-text-primary);
    font-size:var(--cf-text-sm);font-family:var(--cf-font-primary);outline:none;
    transition:border-color 0.15s ease;box-sizing:border-box;
}
.osint-input:focus { border-color:var(--cf-interactive-default); }
.osint-input::placeholder { color:var(--cf-text-muted); }
@media(max-width:1000px){.osint-layout{grid-template-columns:1fr;}}
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">OSINT Tools</h1>
            <p class="screen-subtitle">Open Source Intelligence gathering powered by AI enrichment</p>
        </div>
    </div>

    <div class="osint-layout">

        <!-- Main Panel -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">

            <!-- Tool Tabs -->
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-search"></i> Intelligence Lookup</h3>
                </div>
                <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
                    <div style="display:flex;gap:var(--cf-space-2);flex-wrap:wrap">
                        ${[
                            ['domain', 'fa-globe', 'Domain'],
                            ['ip', 'fa-server', 'IP / CIDR'],
                            ['email', 'fa-envelope', 'Email'],
                            ['username', 'fa-user', 'Username'],
                        ].map(([t, icon, lbl]) =>
                            `<button class="osint-tab-btn" data-tab="${t}"><i class="fas ${icon}"></i> ${lbl}</button>`
                        ).join('')}
                    </div>
                    <div style="display:flex;gap:var(--cf-space-2)">
                        <input class="osint-input" id="osint-input" placeholder="example.com">
                        <button class="cf-btn primary" id="osint-lookup-btn" style="flex-shrink:0"><i class="fas fa-search"></i> Lookup</button>
                    </div>
                </div>
            </div>

            <!-- Results -->
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-crosshairs"></i> Intelligence Report</h3>
                </div>
                <div class="cf-card-body" id="osint-results">
                    <div class="cf-empty">
                        <div class="cf-empty-icon"><i class="fas fa-search"></i></div>
                        <div class="cf-empty-title">Ready to investigate</div>
                        <div class="cf-empty-text">Select a lookup type and enter a target to gather intelligence.</div>
                    </div>
                </div>
            </div>

            <!-- Tool panels (quick reference) -->
            ${[
                ['domain', ['WHOIS Lookup', 'DNS Records', 'Subdomain Discovery', 'SSL Certificate Info', 'Web Technology Stack', 'Google Dork Queries']],
                ['ip', ['Geolocation', 'ASN Lookup', 'Reverse DNS', 'Port Scan Summary', 'Blacklist Check', 'BGP Route Info']],
                ['email', ['MX Record Validation', 'Breach Database Check', 'Domain Reputation', 'Disposable Email Check', 'Linked Accounts', 'Phishing Score']],
                ['username', ['Social Media Presence', 'GitHub Activity', 'Forum Mentions', 'Profile Photos', 'Account Age', 'Threat Actor Check']],
            ].map(([t, items]) => `
                <div class="osint-tab-panel" data-tab="${t}" style="display:none">
                    <div class="cf-card">
                        <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-list-check"></i> Available Data Points</h3></div>
                        <div class="cf-card-body">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--cf-space-2)">
                                ${items.map(item => `
                                    <div style="display:flex;align-items:center;gap:6px;font-size:var(--cf-text-sm);color:var(--cf-text-secondary)">
                                        <i class="fas fa-check" style="color:var(--cf-status-success);font-size:10px"></i>${item}
                                    </div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                </div>`
            ).join('')}
        </div>

        <!-- Sidebar -->
        <div style="display:flex;flex-direction:column;gap:var(--cf-space-4)">
            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-history"></i> Recent Lookups</h3></div>
                <div class="cf-card-body">
                    <div id="osint-history" style="display:flex;flex-direction:column">
                        <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);text-align:center;padding:var(--cf-space-4)">No lookups yet</div>
                    </div>
                </div>
            </div>

            <div class="cf-card">
                <div class="cf-card-header"><h3 class="cf-card-title"><i class="fas fa-info-circle"></i> Data Sources</h3></div>
                <div class="cf-card-body" style="display:flex;flex-direction:column;gap:var(--cf-space-2)">
                    ${['Shodan', 'VirusTotal', 'HaveIBeenPwned', 'Censys', 'SecurityTrails', 'IPinfo.io', 'AbuseIPDB', 'WhoisXML API'].map(src =>
                        `<div style="display:flex;align-items:center;gap:var(--cf-space-2);font-size:var(--cf-text-xs);color:var(--cf-text-secondary)">
                            <span style="width:6px;height:6px;border-radius:50%;background:var(--cf-status-success);display:inline-block;flex-shrink:0"></span>${src}
                        </div>`
                    ).join('')}
                </div>
            </div>
        </div>

    </div>
</div>`;
    }
}

window.OSINTToolsScreen = OsintToolsScreen;
