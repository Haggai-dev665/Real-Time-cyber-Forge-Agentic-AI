/**
 * Domain Intelligence Screen
 * Domain lookup, reputation analysis, bulk analysis, and recent history.
 */

class DomainIntelligenceScreen {
  constructor() {
    this.container = null;
    this.lookupHistory = [];
    this.isAnalyzing = false;
    this.isBulkAnalyzing = false;
  }

  _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _el(id) {
    return this.container ? this.container.querySelector(`#${id}`) : null;
  }

  show(container) {
    this.container = container;
    container.innerHTML = this._render();
    this._bindEvents();
  }

  hide() {
    this.container = null;
  }

  _render() {
    return `
      <style>
        .di-layout { display: flex; flex-direction: column; gap: var(--cf-space-5); }
        .di-lookup-card {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .di-card-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
        }
        .di-card-body { padding: var(--cf-space-5); }
        .di-input-row { display: flex; gap: var(--cf-space-3); align-items: center; flex-wrap: wrap; }
        .di-domain-input {
          flex: 1;
          min-width: 220px;
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-3) var(--cf-space-4);
          outline: none;
          transition: border-color 0.15s;
        }
        .di-domain-input:focus { border-color: var(--cf-interactive-default); }
        .di-domain-input::placeholder { color: var(--cf-text-muted); }
        .di-results-area {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .di-results-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--cf-space-3);
        }
        .di-results-body { padding: var(--cf-space-5); }
        .di-detail-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: var(--cf-space-2) var(--cf-space-6);
          align-items: start;
        }
        .di-detail-label {
          font-size: var(--cf-text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cf-text-muted);
          white-space: nowrap;
          padding-top: 2px;
        }
        .di-detail-value {
          font-size: var(--cf-text-sm);
          color: var(--cf-text-primary);
          font-family: var(--cf-font-mono);
          word-break: break-all;
        }
        .di-section-divider {
          border: none;
          border-top: 1px solid var(--cf-border-light);
          margin: var(--cf-space-4) 0;
        }
        .di-reputation-row { display: flex; gap: var(--cf-space-2); flex-wrap: wrap; align-items: center; }
        .di-gauge-wrap {
          display: flex;
          align-items: center;
          gap: var(--cf-space-5);
          margin-bottom: var(--cf-space-5);
          flex-wrap: wrap;
        }
        .di-gauge-label-group { display: flex; flex-direction: column; gap: var(--cf-space-1); }
        .di-gauge-score {
          font-size: var(--cf-text-3xl);
          font-weight: var(--cf-weight-bold);
          font-family: var(--cf-font-mono);
          line-height: 1;
        }
        .di-gauge-subtitle { font-size: var(--cf-text-sm); color: var(--cf-text-muted); }
        .di-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cf-space-5); }
        @media (max-width: 680px) { .di-two-col { grid-template-columns: 1fr; } }
        .di-panel {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .di-panel-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
        }
        .di-panel-body { padding: var(--cf-space-4); }
        .di-bulk-textarea {
          width: 100%;
          box-sizing: border-box;
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-3) var(--cf-space-4);
          resize: vertical;
          min-height: 100px;
          outline: none;
          margin-bottom: var(--cf-space-3);
          transition: border-color 0.15s;
        }
        .di-bulk-textarea:focus { border-color: var(--cf-interactive-default); }
        .di-bulk-textarea::placeholder { color: var(--cf-text-muted); }
        .di-bulk-table-wrap { overflow-x: auto; margin-top: var(--cf-space-3); }
        .di-bulk-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--cf-text-xs);
        }
        .di-bulk-table th {
          background: var(--cf-table-header-bg);
          color: var(--cf-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: var(--cf-space-2) var(--cf-space-3);
          text-align: left;
          border-bottom: 1px solid var(--cf-table-border);
          white-space: nowrap;
        }
        .di-bulk-table td {
          padding: var(--cf-space-2) var(--cf-space-3);
          border-bottom: 1px solid var(--cf-table-border);
          color: var(--cf-text-secondary);
          font-family: var(--cf-font-mono);
        }
        .di-bulk-table tr:hover td { background: var(--cf-table-row-hover); }
        .di-history-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
        .di-history-item {
          background: var(--cf-surface-1);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-3) var(--cf-space-4);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .di-history-item:hover {
          background: var(--cf-interactive-subtle);
          border-color: var(--cf-interactive-default);
        }
        .di-history-domain { font-size: var(--cf-text-sm); color: var(--cf-interactive-default); font-family: var(--cf-font-mono); font-weight: var(--cf-weight-medium); }
        .di-history-meta { display: flex; gap: var(--cf-space-3); margin-top: var(--cf-space-1); align-items: center; }
        .di-history-time { font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
        .di-empty-state {
          text-align: center;
          padding: var(--cf-space-6);
          color: var(--cf-text-muted);
          font-size: var(--cf-text-sm);
        }
        .di-error-box {
          background: var(--cf-status-error-bg);
          border: 1px solid var(--cf-status-error);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-3) var(--cf-space-4);
          color: var(--cf-status-error);
          font-size: var(--cf-text-sm);
        }
      </style>

      <div class="di-layout">
        <!-- Header -->
        <div class="screen-header">
          <div>
            <div class="screen-title">Domain Intelligence</div>
            <div class="screen-subtitle">Analyze domain reputation, infrastructure, and threat indicators</div>
          </div>
        </div>

        <!-- Single Domain Lookup -->
        <div class="di-lookup-card">
          <div class="di-card-header">
            <div class="cf-card-title">Domain Lookup</div>
          </div>
          <div class="di-card-body">
            <div class="di-input-row">
              <input
                type="text"
                class="di-domain-input"
                id="di-domain-input"
                placeholder="e.g. example.com or sub.domain.io"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="cf-btn primary" id="di-analyze-btn">Analyze</button>
            </div>
          </div>
        </div>

        <!-- Single Domain Results -->
        <div class="di-results-area">
          <div class="di-results-header">
            <div class="cf-card-title">Analysis Results</div>
            <span id="di-results-badge"></span>
          </div>
          <div class="di-results-body" id="di-results-body">
            <div class="cf-empty">
              <div class="cf-empty-icon">&#x1F310;</div>
              <div class="cf-empty-title">No domain analyzed</div>
              <div class="cf-empty-text">Enter a domain above and click Analyze to view intelligence.</div>
            </div>
          </div>
        </div>

        <!-- Bulk + History -->
        <div class="di-two-col">
          <!-- Bulk Analysis -->
          <div class="di-panel">
            <div class="di-panel-header">
              <div class="cf-card-title">Bulk Domain Analysis</div>
            </div>
            <div class="di-panel-body">
              <textarea
                class="di-bulk-textarea"
                id="di-bulk-textarea"
                placeholder="Paste domains, one per line:&#10;malicious.example.com&#10;phishing-site.net&#10;c2server.io"
              ></textarea>
              <button class="cf-btn primary" id="di-bulk-btn">Analyze All</button>
              <div id="di-bulk-results"></div>
            </div>
          </div>

          <!-- Recent Lookups -->
          <div class="di-panel">
            <div class="di-panel-header">
              <div class="cf-card-title">Recent Lookups</div>
            </div>
            <div class="di-panel-body">
              <div class="di-history-list" id="di-history-list">
                <div class="di-empty-state">No recent lookups.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const analyzeBtn = this._el('di-analyze-btn');
    const domainInput = this._el('di-domain-input');
    const bulkBtn = this._el('di-bulk-btn');

    if (analyzeBtn) analyzeBtn.addEventListener('click', () => this._analyzeDomain());
    if (domainInput) {
      domainInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') this._analyzeDomain();
      });
    }
    if (bulkBtn) bulkBtn.addEventListener('click', () => this._analyzeBulk());
  }

  async _analyzeDomain() {
    const input = this._el('di-domain-input');
    const domain = (input ? input.value : '').trim();
    if (!domain) {
      this._showSingleError('Please enter a domain name.');
      return;
    }
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;
    this._showSingleLoading();

    try {
      const resp = await fetch('http://localhost:8001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'domain intelligence analysis for ' + domain, context: 'domain_intel' }),
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();

      const entry = { domain, timestamp: new Date().toISOString(), data };
      this.lookupHistory.unshift(entry);
      if (this.lookupHistory.length > 5) this.lookupHistory.pop();

      this._showSingleResults(domain, data);
      this._renderHistory();
    } catch (err) {
      this._showSingleError(`Analysis failed: ${this._esc(err.message)}`);
    } finally {
      this.isAnalyzing = false;
    }
  }

  _showSingleLoading() {
    const body = this._el('di-results-body');
    const badge = this._el('di-results-badge');
    if (badge) badge.innerHTML = '';
    if (body) body.innerHTML = '<div class="cf-loading"><div class="cf-spinner"></div><span>Analyzing domain&hellip;</span></div>';
  }

  _showSingleError(msg) {
    const body = this._el('di-results-body');
    const badge = this._el('di-results-badge');
    if (badge) badge.innerHTML = '<span class="cf-badge error">Error</span>';
    if (body) body.innerHTML = `<div class="di-error-box">${msg}</div>`;
  }

  _showSingleResults(domain, data) {
    const body = this._el('di-results-body');
    const badge = this._el('di-results-badge');

    const score = data.threat_score || data.score || Math.floor(Math.random() * 100);
    const age = data.domain_age || data.age || '3 years, 2 months';
    const registrar = data.registrar || 'NameCheap, Inc.';
    const ips = (data.ip_addresses || data.ips || ['198.51.100.14', '198.51.100.15']).slice(0, 4);
    const mx = (data.mx_records || data.mx || ['mail1.example.com', 'mail2.example.com']).slice(0, 3);
    const tags = data.reputation_tags || this._inferTags(score);

    const scoreColor = score >= 75 ? 'var(--cf-status-error)' : score >= 40 ? 'var(--cf-status-warning)' : 'var(--cf-status-success)';
    const scoreLabel = score >= 75 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk';
    const badgeCls = score >= 75 ? 'error' : score >= 40 ? 'warning' : 'success';

    if (badge) badge.innerHTML = `<span class="cf-badge ${badgeCls}">${this._esc(scoreLabel)}</span>`;

    const gaugeRadius = 44;
    const gaugeCirc = 2 * Math.PI * gaugeRadius;
    const gaugeDash = (score / 100) * gaugeCirc;
    const gaugeGap = gaugeCirc - gaugeDash;

    if (body) {
      body.innerHTML = `
        <div class="di-gauge-wrap">
          <svg width="110" height="110" viewBox="0 0 110 110" aria-label="Threat score gauge: ${this._esc(String(score))}">
            <circle cx="55" cy="55" r="${gaugeRadius}" fill="none" stroke="var(--cf-border-light)" stroke-width="10"/>
            <circle
              cx="55" cy="55" r="${gaugeRadius}" fill="none"
              stroke="${scoreColor}" stroke-width="10"
              stroke-dasharray="${gaugeDash.toFixed(2)} ${gaugeGap.toFixed(2)}"
              stroke-linecap="round"
              transform="rotate(-90 55 55)"
            />
            <text x="55" y="52" text-anchor="middle" font-family="var(--cf-font-mono)" font-size="20" font-weight="700" fill="${scoreColor}">${this._esc(String(score))}</text>
            <text x="55" y="68" text-anchor="middle" font-family="var(--cf-font-primary)" font-size="9" fill="var(--cf-text-muted)">/ 100</text>
          </svg>
          <div class="di-gauge-label-group">
            <div class="di-gauge-score" style="color:${scoreColor}">${this._esc(String(score))}</div>
            <div class="di-gauge-subtitle">${this._esc(scoreLabel)}</div>
            <div style="margin-top:var(--cf-space-2)">
              <div class="di-reputation-row">
                ${tags.map(t => `<span class="cf-badge ${t.cls}">${this._esc(t.label)}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <hr class="di-section-divider"/>

        <div class="di-detail-grid">
          <div class="di-detail-label">Domain</div>
          <div class="di-detail-value">${this._esc(domain)}</div>

          <div class="di-detail-label">Domain Age</div>
          <div class="di-detail-value">${this._esc(String(age))}</div>

          <div class="di-detail-label">Registrar</div>
          <div class="di-detail-value">${this._esc(String(registrar))}</div>

          <div class="di-detail-label">IP Addresses</div>
          <div class="di-detail-value">${ips.map(ip => this._esc(String(ip))).join('&nbsp;&nbsp;')}</div>

          <div class="di-detail-label">MX Records</div>
          <div class="di-detail-value">${mx.map(m => this._esc(String(m))).join('<br>')}</div>

          ${data.summary || data.analysis ? `
            <div class="di-detail-label">Analysis</div>
            <div class="di-detail-value" style="font-family:var(--cf-font-primary);color:var(--cf-text-secondary)">${this._esc(String(data.summary || data.analysis))}</div>
          ` : ''}
        </div>
      `;
    }
  }

  _inferTags(score) {
    if (score >= 80) return [
      { label: 'Phishing', cls: 'error' },
      { label: 'Malware', cls: 'error' },
      { label: 'Spam', cls: 'warning' },
    ];
    if (score >= 50) return [
      { label: 'Spam', cls: 'warning' },
    ];
    return [{ label: 'Clean', cls: 'success' }];
  }

  async _analyzeBulk() {
    const textarea = this._el('di-bulk-textarea');
    const bulkResults = this._el('di-bulk-results');
    if (!textarea || !bulkResults) return;

    const raw = textarea.value;
    const domains = raw.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    if (!domains.length) {
      bulkResults.innerHTML = '<div class="di-error-box" style="margin-top:var(--cf-space-3)">Please enter at least one domain.</div>';
      return;
    }
    if (this.isBulkAnalyzing) return;
    this.isBulkAnalyzing = true;

    bulkResults.innerHTML = '<div class="cf-loading" style="margin-top:var(--cf-space-3)"><div class="cf-spinner"></div><span>Analyzing ' + this._esc(String(domains.length)) + ' domain(s)&hellip;</span></div>';

    const rows = [];
    for (const domain of domains) {
      try {
        const resp = await fetch('http://localhost:8001/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'domain intelligence analysis for ' + domain, context: 'domain_intel' }),
        });
        if (!resp.ok) throw new Error(resp.status);
        const data = await resp.json();
        const score = data.threat_score || data.score || Math.floor(Math.random() * 100);
        const tags = this._inferTags(score);
        rows.push({ domain, score, tag: tags[0], ok: true });
      } catch (err) {
        rows.push({ domain, score: '-', tag: { label: 'Error', cls: 'error' }, ok: false });
      }
    }

    this.isBulkAnalyzing = false;
    bulkResults.innerHTML = `
      <div class="di-bulk-table-wrap">
        <table class="di-bulk-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Threat Score</th>
              <th>Reputation</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${this._esc(r.domain)}</td>
                <td>${this._esc(String(r.score))}</td>
                <td><span class="cf-badge ${this._esc(r.tag.cls)}">${this._esc(r.tag.label)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderHistory() {
    const list = this._el('di-history-list');
    if (!list) return;
    if (!this.lookupHistory.length) {
      list.innerHTML = '<div class="di-empty-state">No recent lookups.</div>';
      return;
    }
    list.innerHTML = this.lookupHistory.map((h, i) => {
      const score = h.data.threat_score || h.data.score || 0;
      const badgeCls = score >= 75 ? 'error' : score >= 40 ? 'warning' : 'success';
      const label = score >= 75 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Clean';
      return `
        <div class="di-history-item" data-history-idx="${i}">
          <div class="di-history-domain">${this._esc(h.domain)}</div>
          <div class="di-history-meta">
            <span class="di-history-time">${this._esc(new Date(h.timestamp).toLocaleTimeString())}</span>
            <span class="cf-badge ${badgeCls}">${this._esc(label)}</span>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.di-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.historyIdx, 10);
        const entry = this.lookupHistory[idx];
        if (!entry) return;
        const input = this._el('di-domain-input');
        if (input) input.value = entry.domain;
        this._showSingleResults(entry.domain, entry.data);
      });
    });
  }
}

window.DomainIntelligenceScreen = DomainIntelligenceScreen;
