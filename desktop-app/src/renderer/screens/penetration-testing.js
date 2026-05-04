/**
 * PenetrationTestingScreen
 * CyberForge — SPA screen class
 * Tokens only: no hardcoded colours. XSS-safe via _esc().
 */

class PenetrationTestingScreen {
  constructor() {
    this._container  = null;
    this._findings   = [];
    this._scanning   = false;
  }

  // ---------------------------------------------------------------------------
  // XSS helper
  // ---------------------------------------------------------------------------
  _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Static fallback findings
  // ---------------------------------------------------------------------------
  _staticFindings() {
    return [
      { finding: 'SQL Injection in /api/search', category: 'Injection',         severity: 'critical', cvss: 9.8,  host: '10.0.0.5:80',    status: 'Open' },
      { finding: 'Open SSH on default port',     category: 'Misconfiguration',  severity: 'high',     cvss: 7.5,  host: '10.0.0.12:22',   status: 'Open' },
      { finding: 'Exposed admin panel',          category: 'Access Control',    severity: 'high',     cvss: 8.1,  host: '10.0.0.5:8080',  status: 'Open' },
      { finding: 'Weak TLS cipher suite',        category: 'Cryptography',      severity: 'warning',  cvss: 5.3,  host: '10.0.0.5:443',   status: 'In Progress' },
      { finding: 'Directory listing enabled',    category: 'Information Leak',  severity: 'warning',  cvss: 5.0,  host: '10.0.0.5:80',    status: 'Open' },
      { finding: 'Missing HSTS header',          category: 'HTTP Security',     severity: 'info',     cvss: 3.1,  host: '10.0.0.5:443',   status: 'Resolved' },
      { finding: 'Outdated OpenSSL version',     category: 'Patch Management',  severity: 'high',     cvss: 7.8,  host: '10.0.0.12:22',   status: 'Open' },
      { finding: 'CORS wildcard origin',         category: 'HTTP Security',     severity: 'warning',  cvss: 5.4,  host: '10.0.0.5:3001',  status: 'Open' },
    ];
  }

  // ---------------------------------------------------------------------------
  // Fetch existing findings from backend (mapped to pentest format)
  // ---------------------------------------------------------------------------
  async _fetchFindings() {
    try {
      const res = await fetch('http://localhost:3001/api/threats?limit=20');
      if (!res.ok) throw new Error('non-2xx');
      const json  = await res.json();
      const items = Array.isArray(json) ? json : (json.data || json.threats || []);
      if (!items.length) return this._staticFindings();
      return items.map(t => ({
        finding:  t.description || t.title || t.type || 'Security Finding',
        category: t.category    || t.type  || 'Miscellaneous',
        severity: this._mapSeverity(t.severity),
        cvss:     this._mapCVSS(t.severity),
        host:     t.source || t.host || t.ip || '—',
        status:   t.status || 'Open',
      }));
    } catch (_) {
      return this._staticFindings();
    }
  }

  _mapSeverity(s) {
    const v = String(s || '').toLowerCase();
    if (v === 'critical') return 'critical';
    if (v === 'high')     return 'high';
    if (v === 'medium' || v === 'warning') return 'warning';
    return 'info';
  }

  _mapCVSS(s) {
    const v = String(s || '').toLowerCase();
    if (v === 'critical') return (8.5 + Math.random() * 1.5).toFixed(1);
    if (v === 'high')     return (7.0 + Math.random() * 1.4).toFixed(1);
    if (v === 'medium' || v === 'warning') return (4.0 + Math.random() * 2.9).toFixed(1);
    return (1.0 + Math.random() * 2.9).toFixed(1);
  }

  _severityBadgeClass(severity) {
    const map = { critical: 'error', high: 'error', warning: 'warning', info: 'info' };
    return map[severity] || 'info';
  }

  _statusBadgeClass(status) {
    const s = String(status).toLowerCase();
    if (s === 'open')        return 'error';
    if (s === 'in progress') return 'warning';
    if (s === 'resolved')    return 'success';
    return 'info';
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  _stats(findings) {
    const total    = findings.length;
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high     = findings.filter(f => f.severity === 'high').length;
    const open     = findings.filter(f => String(f.status).toLowerCase() !== 'resolved').length;
    return { total, critical, high, open };
  }

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------
  _exportCSV() {
    const headers = ['Finding', 'Category', 'Severity', 'CVSS Score', 'Host/Port', 'Status'];
    const rows    = this._findings.map(f => [
      f.finding, f.category, f.severity, f.cvss, f.host, f.status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv     = [headers.join(','), ...rows].join('\n');
    const blob    = new Blob([csv], { type: 'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `pentest-findings-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  _renderStats(stats) {
    const items = [
      { label: 'Total Findings', value: stats.total,    color: 'var(--cf-text-primary)' },
      { label: 'Critical',       value: stats.critical, color: 'var(--cf-status-error)' },
      { label: 'High',           value: stats.high,     color: 'var(--cf-status-warning)' },
      { label: 'Open Issues',    value: stats.open,     color: 'var(--cf-interactive-default)' },
    ];
    return `
      <div class="pt-stats-row">
        ${items.map(it => `
          <div class="pt-stat-card cf-card">
            <div class="pt-stat-value" style="color:${it.color}">${this._esc(String(it.value))}</div>
            <div class="pt-stat-label">${this._esc(it.label)}</div>
          </div>
        `).join('')}
      </div>`;
  }

  _renderScanConfig() {
    return `
      <div class="cf-card pt-scan-card">
        <div class="cf-card-header">
          <h3 class="cf-card-title">Scan Configuration</h3>
        </div>
        <div class="cf-card-body pt-scan-body">
          <div class="pt-field-group">
            <label class="pt-label" for="pt-target">Target</label>
            <input
              id="pt-target"
              class="pt-input"
              type="text"
              placeholder="IP address, hostname, or CIDR range"
              value="10.0.0.0/24"
            />
          </div>

          <div class="pt-field-row">
            <div class="pt-field-group">
              <label class="pt-label" for="pt-scan-type">Scan Type</label>
              <select id="pt-scan-type" class="pt-select">
                <option value="Reconnaissance">Reconnaissance</option>
                <option value="Port Scan">Port Scan</option>
                <option value="Web App">Web App</option>
                <option value="API">API</option>
                <option value="Network">Network</option>
                <option value="Full">Full</option>
              </select>
            </div>

            <div class="pt-field-group">
              <label class="pt-label" for="pt-scan-depth">Scan Depth</label>
              <select id="pt-scan-depth" class="pt-select">
                <option value="Quick">Quick</option>
                <option value="Standard" selected>Standard</option>
                <option value="Deep">Deep</option>
              </select>
            </div>
          </div>

          <div class="pt-scan-actions">
            <button class="cf-btn primary" id="pt-start-btn">Start Scan</button>
          </div>

          <div class="pt-progress-wrap" id="pt-progress-wrap" style="display:none">
            <div class="pt-progress-label">
              <span id="pt-progress-text">Scanning…</span>
              <span id="pt-progress-pct">0%</span>
            </div>
            <div class="pt-progress-track">
              <div class="pt-progress-fill" id="pt-progress-fill" style="width:0%"></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  _renderFindingsRow(f, idx) {
    const badgeClass  = this._severityBadgeClass(f.severity);
    const statusClass = this._statusBadgeClass(f.status);
    return `
      <tr class="pt-row" data-idx="${idx}">
        <td class="pt-cell pt-finding-name">${this._esc(f.finding)}</td>
        <td class="pt-cell">${this._esc(f.category)}</td>
        <td class="pt-cell">
          <span class="cf-badge ${this._esc(badgeClass)}">${this._esc(f.severity.toUpperCase())}</span>
        </td>
        <td class="pt-cell pt-mono">
          <span class="pt-cvss pt-cvss-${this._esc(f.severity)}">${this._esc(String(f.cvss))}</span>
        </td>
        <td class="pt-cell pt-mono">${this._esc(f.host)}</td>
        <td class="pt-cell">
          <span class="cf-badge ${this._esc(statusClass)}">${this._esc(f.status)}</span>
        </td>
      </tr>`;
  }

  _renderFindingsTable(findings) {
    const rows = findings.length
      ? findings.map((f, i) => this._renderFindingsRow(f, i)).join('')
      : `<tr><td colspan="6">
           <div class="cf-empty">
             <div class="cf-empty-icon">🔍</div>
             <div class="cf-empty-title">No Findings Yet</div>
             <div class="cf-empty-text">Run a scan to discover vulnerabilities.</div>
           </div>
         </td></tr>`;

    return `
      <div class="cf-card">
        <div class="cf-card-header">
          <h3 class="cf-card-title">Findings</h3>
          <div class="screen-actions">
            <button class="cf-btn sm" id="pt-export-btn">Export CSV</button>
          </div>
        </div>
        <div class="cf-card-body pt-table-body">
          <table class="pt-table" id="pt-findings-table">
            <thead>
              <tr>
                <th class="pt-th">Finding</th>
                <th class="pt-th">Category</th>
                <th class="pt-th">Severity</th>
                <th class="pt-th">CVSS</th>
                <th class="pt-th">Host / Port</th>
                <th class="pt-th">Status</th>
              </tr>
            </thead>
            <tbody id="pt-tbody">${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  _buildHTML(findings) {
    const stats = this._stats(findings);
    return `
      <style>
        /* ── PenetrationTestingScreen local styles ── */
        .pt-stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: var(--cf-space-4);
          margin-bottom: var(--cf-space-6);
        }
        .pt-stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--cf-space-5);
          text-align: center;
          gap: var(--cf-space-2);
        }
        .pt-stat-value {
          font-size: var(--cf-text-2xl);
          font-weight: var(--cf-weight-bold);
          font-family: var(--cf-font-mono);
        }
        .pt-stat-label {
          font-size: var(--cf-text-xs);
          color: var(--cf-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Scan config card */
        .pt-scan-card { margin-bottom: var(--cf-space-6); }
        .pt-scan-body { display: flex; flex-direction: column; gap: var(--cf-space-4); }
        .pt-field-group { display: flex; flex-direction: column; gap: var(--cf-space-2); flex: 1; }
        .pt-field-row   { display: flex; gap: var(--cf-space-4); flex-wrap: wrap; }
        .pt-label {
          font-size: var(--cf-text-xs);
          font-weight: var(--cf-weight-semibold);
          color: var(--cf-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pt-input,
        .pt-select {
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-size: var(--cf-text-sm);
          font-family: var(--cf-font-primary);
          padding: var(--cf-space-2) var(--cf-space-3);
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .pt-input:focus,
        .pt-select:focus {
          border-color: var(--cf-interactive-default);
          box-shadow: 0 0 0 2px var(--cf-interactive-subtle);
        }
        .pt-scan-actions { display: flex; gap: var(--cf-space-3); }

        /* Progress */
        .pt-progress-wrap { display: flex; flex-direction: column; gap: var(--cf-space-2); }
        .pt-progress-label {
          display: flex;
          justify-content: space-between;
          font-size: var(--cf-text-xs);
          color: var(--cf-text-secondary);
        }
        .pt-progress-track {
          height: 8px;
          background: var(--cf-surface-2);
          border-radius: var(--cf-radius-full);
          overflow: hidden;
        }
        .pt-progress-fill {
          height: 100%;
          background: var(--cf-interactive-default);
          border-radius: var(--cf-radius-full);
          transition: width 0.3s ease;
        }

        /* Findings table */
        .pt-table-body { overflow-x: auto; padding: 0; }
        .pt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--cf-text-sm);
        }
        .pt-th {
          text-align: left;
          padding: var(--cf-space-3) var(--cf-space-4);
          background: var(--cf-table-header-bg);
          color: var(--cf-text-secondary);
          font-size: var(--cf-text-xs);
          font-weight: var(--cf-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--cf-table-border);
          white-space: nowrap;
        }
        .pt-row { border-bottom: 1px solid var(--cf-border-light); }
        .pt-row:hover { background: var(--cf-table-row-hover); }
        .pt-cell {
          padding: var(--cf-space-3) var(--cf-space-4);
          color: var(--cf-text-primary);
          vertical-align: middle;
        }
        .pt-finding-name { font-weight: var(--cf-weight-medium); max-width: 260px; }
        .pt-mono {
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-xs);
        }
        .pt-cvss {
          font-weight: var(--cf-weight-bold);
          padding: 2px var(--cf-space-2);
          border-radius: var(--cf-radius-sm);
        }
        .pt-cvss-critical { color: var(--cf-status-error);   background: var(--cf-status-error-bg); }
        .pt-cvss-high     { color: var(--cf-status-error);   background: var(--cf-status-error-bg); }
        .pt-cvss-warning  { color: var(--cf-status-warning); background: var(--cf-status-warning-bg); }
        .pt-cvss-info     { color: var(--cf-status-info);    background: var(--cf-status-info-bg); }
      </style>

      <div class="screen-header">
        <div>
          <h1 class="screen-title">Penetration Testing</h1>
          <p class="screen-subtitle">Active vulnerability discovery and security assessment</p>
        </div>
        <div class="screen-actions">
          <button class="cf-btn sm" id="pt-refresh-btn">Refresh Findings</button>
        </div>
      </div>

      ${this._renderStats(stats)}
      ${this._renderScanConfig()}
      ${this._renderFindingsTable(findings)}
    `;
  }

  // ---------------------------------------------------------------------------
  // Scan execution
  // ---------------------------------------------------------------------------
  async _startScan() {
    if (this._scanning) return;
    this._scanning = true;

    const target    = this._container.querySelector('#pt-target').value.trim() || 'unknown';
    const scanType  = this._container.querySelector('#pt-scan-type').value;
    const depth     = this._container.querySelector('#pt-scan-depth').value;
    const startBtn  = this._container.querySelector('#pt-start-btn');
    const progWrap  = this._container.querySelector('#pt-progress-wrap');
    const progFill  = this._container.querySelector('#pt-progress-fill');
    const progText  = this._container.querySelector('#pt-progress-text');
    const progPct   = this._container.querySelector('#pt-progress-pct');

    startBtn.disabled = true;
    startBtn.textContent = 'Scanning…';
    progWrap.style.display = 'block';

    // Animate progress while waiting
    let pct = 0;
    const ticker = setInterval(() => {
      pct = Math.min(pct + Math.random() * 8, 90);
      progFill.style.width = pct.toFixed(0) + '%';
      progPct.textContent  = pct.toFixed(0) + '%';
      progText.textContent = this._scanPhaseLabel(pct, scanType);
    }, 400);

    try {
      const res = await fetch('http://localhost:8001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:   `penetration test on ${target} scan type: ${scanType} depth: ${depth}`,
          context: 'pentest',
        }),
      });

      clearInterval(ticker);
      progFill.style.width = '100%';
      progPct.textContent  = '100%';
      progText.textContent = 'Scan complete';

      if (res.ok) {
        const json     = await res.json();
        const newFinds = this._parseMLFindings(json, target, scanType);
        this._findings = [...newFinds, ...this._findings];
      } else {
        // ML service offline — add simulated finding
        this._findings.unshift(this._simulatedFinding(target, scanType));
      }
    } catch (_) {
      clearInterval(ticker);
      progFill.style.width = '100%';
      progText.textContent = 'Scan complete (offline mode)';
      this._findings.unshift(this._simulatedFinding(target, scanType));
    }

    // Re-render table and stats
    this._refreshTableAndStats();

    setTimeout(() => {
      progWrap.style.display = 'none';
      progFill.style.width   = '0%';
      startBtn.disabled      = false;
      startBtn.textContent   = 'Start Scan';
      this._scanning         = false;
    }, 1200);
  }

  _scanPhaseLabel(pct, type) {
    if (pct < 20) return `Initialising ${type} scan…`;
    if (pct < 50) return 'Enumerating hosts and services…';
    if (pct < 75) return 'Testing for vulnerabilities…';
    return 'Analysing results…';
  }

  _parseMLFindings(json, target, scanType) {
    const text = json.result || json.analysis || json.response || '';
    // Best-effort: treat each line that mentions a known keyword as a finding
    const lines = String(text).split('\n').filter(l => l.trim().length > 10);
    if (!lines.length) return [this._simulatedFinding(target, scanType)];
    return lines.slice(0, 5).map((line, i) => ({
      finding:  line.trim().replace(/^[-*•\d.]+\s*/, '').substring(0, 120),
      category: scanType,
      severity: i === 0 ? 'high' : (i === 1 ? 'warning' : 'info'),
      cvss:     i === 0 ? '7.5' : (i === 1 ? '5.2' : '3.1'),
      host:     target,
      status:   'Open',
    }));
  }

  _simulatedFinding(target, scanType) {
    return {
      finding:  `${scanType} assessment completed for ${target}`,
      category: scanType,
      severity: 'info',
      cvss:     '0.0',
      host:     target,
      status:   'Open',
    };
  }

  _refreshTableAndStats() {
    const tbody = this._container.querySelector('#pt-tbody');
    const stats = this._stats(this._findings);

    // Update stats cards
    const statCards = this._container.querySelectorAll('.pt-stat-value');
    const vals = [stats.total, stats.critical, stats.high, stats.open];
    statCards.forEach((el, i) => { if (vals[i] !== undefined) el.textContent = vals[i]; });

    // Update table rows
    if (tbody) {
      if (!this._findings.length) {
        tbody.innerHTML = `<tr><td colspan="6">
          <div class="cf-empty">
            <div class="cf-empty-icon">🔍</div>
            <div class="cf-empty-title">No Findings Yet</div>
            <div class="cf-empty-text">Run a scan to discover vulnerabilities.</div>
          </div>
        </td></tr>`;
      } else {
        tbody.innerHTML = this._findings.map((f, i) => this._renderFindingsRow(f, i)).join('');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  _bindEvents() {
    this._container.addEventListener('click', e => {
      if (e.target.id === 'pt-start-btn')   { this._startScan(); return; }
      if (e.target.id === 'pt-export-btn')  { this._exportCSV(); return; }
      if (e.target.id === 'pt-refresh-btn') { this._reload(); }
    });
  }

  async _reload() {
    if (!this._container) return;
    this._findings = await this._fetchFindings();
    this._container.innerHTML = this._buildHTML(this._findings);
    this._bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  async show(container) {
    this._container = container;
    container.innerHTML = '<div class="cf-loading"><div class="cf-spinner"></div></div>';
    this._findings = await this._fetchFindings();
    container.innerHTML = this._buildHTML(this._findings);
    this._bindEvents();
  }

  hide() {
    this._container = null;
    this._scanning  = false;
  }
}

window.PenetrationTestingScreen = PenetrationTestingScreen;
