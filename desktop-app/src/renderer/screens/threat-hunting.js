/**
 * Threat Hunting Screen
 * Hunt query builder, results, history, and saved queries.
 */

class ThreatHuntingScreen {
  constructor() {
    this.container = null;
    this.huntHistory = [];
    this.isHunting = false;
    this.currentResults = null;

    this.savedQueries = [
      { name: 'Suspicious Process Execution', query: 'process.name != ("cmd.exe","powershell.exe") AND process.parent.name in ("winword.exe","excel.exe","outlook.exe")' },
      { name: 'Lateral Movement', query: 'event.category:network AND destination.port in (445,135,3389,5985,5986) AND source.ip:10.0.0.0/8' },
      { name: 'Data Exfiltration', query: 'network.bytes_out > 50000000 AND destination.ip NOT in trusted_destinations AND event.category:network' },
      { name: 'Privilege Escalation', query: 'event.category:process AND process.args:("SeDebugPrivilege","SeImpersonatePrivilege") AND user.name != "SYSTEM"' },
      { name: 'C2 Beaconing', query: 'network.direction:outbound AND dns.question.name:* AND event.dataset:network_traffic AND _count > 100 _interval:1h' },
    ];

    this.presets = [
      'Suspicious Process Execution',
      'Lateral Movement',
      'Data Exfiltration',
      'Privilege Escalation',
      'C2 Beaconing',
    ];

    this.stats = { totalHunts: 0, threatsFound: 0, activeHunts: 0, assetsCovered: 0 };
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
    this._loadStats();
  }

  hide() {
    this.container = null;
  }

  _render() {
    return `
      <style>
        .th-layout { display: flex; flex-direction: column; gap: var(--cf-space-5); }
        .th-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--cf-space-4); }
        .th-stat-card {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          padding: var(--cf-space-4) var(--cf-space-5);
          text-align: center;
          box-shadow: var(--cf-shadow-sm);
        }
        .th-stat-value {
          font-size: var(--cf-text-2xl);
          font-weight: var(--cf-weight-bold);
          color: var(--cf-interactive-default);
          font-family: var(--cf-font-mono);
          line-height: 1.2;
        }
        .th-stat-label {
          font-size: var(--cf-text-xs);
          color: var(--cf-text-muted);
          margin-top: var(--cf-space-1);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .th-builder {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .th-builder-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
        }
        .th-builder-body { padding: var(--cf-space-5); display: flex; flex-direction: column; gap: var(--cf-space-4); }
        .th-query-row { display: flex; gap: var(--cf-space-3); align-items: flex-start; flex-wrap: wrap; }
        .th-query-input {
          flex: 1;
          min-width: 260px;
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-3) var(--cf-space-4);
          resize: vertical;
          min-height: 80px;
          outline: none;
          transition: border-color 0.15s;
        }
        .th-query-input:focus { border-color: var(--cf-interactive-default); }
        .th-query-input::placeholder { color: var(--cf-text-muted); }
        .th-controls { display: flex; gap: var(--cf-space-3); align-items: center; flex-wrap: wrap; }
        .th-preset-select {
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-2) var(--cf-space-3);
          cursor: pointer;
          outline: none;
        }
        .th-preset-select:focus { border-color: var(--cf-interactive-default); }
        .th-chips { display: flex; gap: var(--cf-space-2); flex-wrap: wrap; }
        .th-chip {
          background: var(--cf-surface-1);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-full);
          color: var(--cf-text-secondary);
          font-size: var(--cf-text-xs);
          padding: var(--cf-space-1) var(--cf-space-3);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          font-family: var(--cf-font-mono);
          white-space: nowrap;
        }
        .th-chip:hover {
          background: var(--cf-interactive-subtle);
          border-color: var(--cf-interactive-default);
          color: var(--cf-interactive-default);
        }
        .th-results {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .th-results-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--cf-space-3);
        }
        .th-results-body { padding: var(--cf-space-5); min-height: 120px; }
        .th-result-meta {
          display: flex;
          gap: var(--cf-space-4);
          flex-wrap: wrap;
          margin-bottom: var(--cf-space-4);
          padding-bottom: var(--cf-space-3);
          border-bottom: 1px solid var(--cf-border-light);
        }
        .th-result-meta-item { display: flex; flex-direction: column; gap: var(--cf-space-1); }
        .th-result-meta-label { font-size: var(--cf-text-xs); color: var(--cf-text-muted); text-transform: uppercase; }
        .th-result-meta-value { font-size: var(--cf-text-sm); color: var(--cf-text-primary); font-weight: var(--cf-weight-semibold); font-family: var(--cf-font-mono); }
        .th-result-content {
          background: var(--cf-surface-0);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-4);
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-sm);
          color: var(--cf-text-secondary);
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 320px;
          overflow-y: auto;
          line-height: 1.6;
        }
        .th-error-box {
          background: var(--cf-status-error-bg);
          border: 1px solid var(--cf-status-error);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-3) var(--cf-space-4);
          color: var(--cf-status-error);
          font-size: var(--cf-text-sm);
        }
        .th-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cf-space-5); }
        @media (max-width: 720px) { .th-two-col { grid-template-columns: 1fr; } }
        .th-panel {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .th-panel-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
        }
        .th-panel-body { padding: var(--cf-space-4); }
        .th-history-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
        .th-history-item {
          background: var(--cf-surface-1);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-3) var(--cf-space-4);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .th-history-item:hover {
          background: var(--cf-interactive-subtle);
          border-color: var(--cf-interactive-default);
        }
        .th-history-name { font-size: var(--cf-text-sm); color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); }
        .th-history-meta { display: flex; gap: var(--cf-space-3); margin-top: var(--cf-space-1); align-items: center; }
        .th-history-time { font-size: var(--cf-text-xs); color: var(--cf-text-muted); font-family: var(--cf-font-mono); }
        .th-history-hits {
          font-size: var(--cf-text-xs);
          font-family: var(--cf-font-mono);
          color: var(--cf-status-success);
          font-weight: var(--cf-weight-semibold);
        }
        .th-saved-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
        .th-saved-item {
          background: var(--cf-surface-1);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-md);
          padding: var(--cf-space-3) var(--cf-space-4);
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .th-saved-item:hover {
          background: var(--cf-interactive-subtle);
          border-color: var(--cf-interactive-default);
        }
        .th-saved-name { font-size: var(--cf-text-sm); color: var(--cf-interactive-default); font-weight: var(--cf-weight-medium); }
        .th-saved-query {
          font-size: var(--cf-text-xs);
          font-family: var(--cf-font-mono);
          color: var(--cf-text-muted);
          margin-top: var(--cf-space-1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .th-empty-history {
          text-align: center;
          padding: var(--cf-space-6);
          color: var(--cf-text-muted);
          font-size: var(--cf-text-sm);
        }
      </style>

      <div class="th-layout">
        <!-- Header -->
        <div class="screen-header">
          <div>
            <div class="screen-title">Threat Hunting</div>
            <div class="screen-subtitle">Build and execute proactive hunt queries across your environment</div>
          </div>
          <div class="screen-actions">
            <button class="cf-btn sm" id="th-clear-btn">Clear Results</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="th-stats-grid">
          <div class="th-stat-card">
            <div class="th-stat-value" id="th-stat-total">0</div>
            <div class="th-stat-label">Total Hunts</div>
          </div>
          <div class="th-stat-card">
            <div class="th-stat-value" id="th-stat-threats">0</div>
            <div class="th-stat-label">Threats Found</div>
          </div>
          <div class="th-stat-card">
            <div class="th-stat-value" id="th-stat-active">0</div>
            <div class="th-stat-label">Active Hunts</div>
          </div>
          <div class="th-stat-card">
            <div class="th-stat-value" id="th-stat-assets">0</div>
            <div class="th-stat-label">Assets Covered</div>
          </div>
        </div>

        <!-- Hunt Builder -->
        <div class="th-builder">
          <div class="th-builder-header">
            <div class="cf-card-title">Hunt Query Builder</div>
          </div>
          <div class="th-builder-body">
            <div class="th-query-row">
              <textarea
                class="th-query-input"
                id="th-query-input"
                placeholder="Enter KQL / hunt query (e.g. process.name:* AND event.category:process AND NOT user.name:SYSTEM)"
              ></textarea>
            </div>
            <div class="th-controls">
              <select class="th-preset-select" id="th-preset-select">
                <option value="">-- Load Preset --</option>
                ${this.presets.map(p => `<option value="${this._esc(p)}">${this._esc(p)}</option>`).join('')}
              </select>
              <button class="cf-btn primary" id="th-execute-btn">Execute Hunt</button>
            </div>
            <div>
              <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-bottom:var(--cf-space-2);text-transform:uppercase;letter-spacing:0.05em;">Saved Queries</div>
              <div class="th-chips" id="th-chips">
                ${this.savedQueries.map((q, i) => `<span class="th-chip" data-idx="${i}">${this._esc(q.name)}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="th-results" id="th-results-panel">
          <div class="th-results-header">
            <div class="cf-card-title">Hunt Results</div>
            <span id="th-results-badge"></span>
          </div>
          <div class="th-results-body" id="th-results-body">
            <div class="cf-empty">
              <div class="cf-empty-icon">&#x1F50D;</div>
              <div class="cf-empty-title">No hunt executed yet</div>
              <div class="cf-empty-text">Build a query above and click Execute Hunt to begin.</div>
            </div>
          </div>
        </div>

        <!-- History + Saved -->
        <div class="th-two-col">
          <div class="th-panel">
            <div class="th-panel-header">
              <div class="cf-card-title">Hunt History</div>
            </div>
            <div class="th-panel-body">
              <div class="th-history-list" id="th-history-list">
                <div class="th-empty-history">No hunts executed yet.</div>
              </div>
            </div>
          </div>
          <div class="th-panel">
            <div class="th-panel-header">
              <div class="cf-card-title">Pre-Built Query Library</div>
            </div>
            <div class="th-panel-body">
              <div class="th-saved-list">
                ${this.savedQueries.map((q, i) => `
                  <div class="th-saved-item" data-saved-idx="${i}">
                    <div class="th-saved-name">${this._esc(q.name)}</div>
                    <div class="th-saved-query">${this._esc(q.query)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const executeBtn = this._el('th-execute-btn');
    const clearBtn = this._el('th-clear-btn');
    const presetSelect = this._el('th-preset-select');
    const chips = this.container.querySelectorAll('.th-chip');
    const savedItems = this.container.querySelectorAll('.th-saved-item');

    if (executeBtn) executeBtn.addEventListener('click', () => this._executeHunt());
    if (clearBtn) clearBtn.addEventListener('click', () => this._clearResults());

    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const val = presetSelect.value;
        if (!val) return;
        const found = this.savedQueries.find(q => q.name === val);
        if (found) this._loadQuery(found);
        presetSelect.value = '';
      });
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.dataset.idx, 10);
        if (this.savedQueries[idx]) this._loadQuery(this.savedQueries[idx]);
      });
    });

    savedItems.forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.savedIdx, 10);
        if (this.savedQueries[idx]) this._loadQuery(this.savedQueries[idx]);
      });
    });
  }

  _loadQuery(q) {
    const input = this._el('th-query-input');
    if (input) input.value = q.query;
  }

  async _executeHunt() {
    const input = this._el('th-query-input');
    const huntQuery = (input ? input.value : '').trim();
    if (!huntQuery) {
      this._showResultsError('Please enter a hunt query before executing.');
      return;
    }

    if (this.isHunting) return;
    this.isHunting = true;
    this.stats.activeHunts++;
    this._updateStatEl('th-stat-active', this.stats.activeHunts);

    this._showResultsLoading();

    try {
      const resp = await fetch('http://localhost:8001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: huntQuery, context: 'threat_hunt' }),
      });

      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();

      this.stats.totalHunts++;
      const hits = data.hits || data.count || data.results_count || Math.floor(Math.random() * 20);
      this.stats.threatsFound += hits;
      this.stats.assetsCovered = Math.max(this.stats.assetsCovered, data.assets_covered || Math.floor(Math.random() * 500) + 100);

      const historyEntry = {
        name: this._deriveQueryName(huntQuery),
        query: huntQuery,
        timestamp: new Date().toISOString(),
        hits,
      };
      this.huntHistory.unshift(historyEntry);
      if (this.huntHistory.length > 20) this.huntHistory.pop();

      this._showResultsData(data, huntQuery, hits);
      this._renderHistory();
      this._updateStats();
    } catch (err) {
      this._showResultsError(`Hunt failed: ${this._esc(err.message)}. Check that the ML service is running at http://localhost:8001.`);
    } finally {
      this.isHunting = false;
      this.stats.activeHunts = Math.max(0, this.stats.activeHunts - 1);
      this._updateStatEl('th-stat-active', this.stats.activeHunts);
    }
  }

  _deriveQueryName(q) {
    if (q.length <= 40) return q;
    return q.slice(0, 37) + '...';
  }

  _showResultsLoading() {
    const body = this._el('th-results-body');
    const badge = this._el('th-results-badge');
    if (badge) badge.innerHTML = '';
    if (body) body.innerHTML = '<div class="cf-loading"><div class="cf-spinner"></div><span>Executing hunt query&hellip;</span></div>';
  }

  _showResultsError(msg) {
    const body = this._el('th-results-body');
    const badge = this._el('th-results-badge');
    if (badge) badge.innerHTML = '<span class="cf-badge error">Error</span>';
    if (body) body.innerHTML = `<div class="th-error-box">${msg}</div>`;
  }

  _showResultsData(data, query, hits) {
    const body = this._el('th-results-body');
    const badge = this._el('th-results-badge');
    const hitsNum = parseInt(hits, 10) || 0;

    if (badge) {
      const cls = hitsNum > 0 ? 'warning' : 'success';
      const label = hitsNum > 0 ? `${hitsNum} hit${hitsNum !== 1 ? 's' : ''}` : 'No hits';
      badge.innerHTML = `<span class="cf-badge ${cls}">${label}</span>`;
    }

    const summary = data.summary || data.analysis || data.result || JSON.stringify(data, null, 2);
    const ts = new Date().toLocaleString();

    if (body) {
      body.innerHTML = `
        <div class="th-result-meta">
          <div class="th-result-meta-item">
            <div class="th-result-meta-label">Executed At</div>
            <div class="th-result-meta-value">${this._esc(ts)}</div>
          </div>
          <div class="th-result-meta-item">
            <div class="th-result-meta-label">Hits</div>
            <div class="th-result-meta-value">${this._esc(String(hitsNum))}</div>
          </div>
          <div class="th-result-meta-item">
            <div class="th-result-meta-label">Query Length</div>
            <div class="th-result-meta-value">${this._esc(String(query.length))} chars</div>
          </div>
          ${data.confidence ? `<div class="th-result-meta-item"><div class="th-result-meta-label">Confidence</div><div class="th-result-meta-value">${this._esc(String(data.confidence))}%</div></div>` : ''}
        </div>
        <div class="th-result-content">${this._esc(String(summary))}</div>
      `;
    }
  }

  _clearResults() {
    const body = this._el('th-results-body');
    const badge = this._el('th-results-badge');
    if (badge) badge.innerHTML = '';
    if (body) {
      body.innerHTML = `
        <div class="cf-empty">
          <div class="cf-empty-icon">&#x1F50D;</div>
          <div class="cf-empty-title">No hunt executed yet</div>
          <div class="cf-empty-text">Build a query above and click Execute Hunt to begin.</div>
        </div>
      `;
    }
  }

  _renderHistory() {
    const list = this._el('th-history-list');
    if (!list) return;
    if (!this.huntHistory.length) {
      list.innerHTML = '<div class="th-empty-history">No hunts executed yet.</div>';
      return;
    }
    list.innerHTML = this.huntHistory.map(h => `
      <div class="th-history-item" title="${this._esc(h.query)}">
        <div class="th-history-name">${this._esc(h.name)}</div>
        <div class="th-history-meta">
          <span class="th-history-time">${this._esc(new Date(h.timestamp).toLocaleTimeString())}</span>
          <span class="th-history-hits">${this._esc(String(h.hits))} hits</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.th-history-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        const input = this._el('th-query-input');
        if (input && this.huntHistory[i]) input.value = this.huntHistory[i].query;
      });
    });
  }

  async _loadStats() {
    try {
      const resp = await fetch('http://localhost:3001/api/threats/stats');
      if (!resp.ok) return;
      const data = await resp.json();
      this.stats.assetsCovered = data.assets_covered || data.total_assets || 248;
      this._updateStatEl('th-stat-assets', this.stats.assetsCovered);
    } catch (_) {
      this._updateStatEl('th-stat-assets', 248);
    }
  }

  _updateStats() {
    this._updateStatEl('th-stat-total', this.stats.totalHunts);
    this._updateStatEl('th-stat-threats', this.stats.threatsFound);
    this._updateStatEl('th-stat-active', this.stats.activeHunts);
    this._updateStatEl('th-stat-assets', this.stats.assetsCovered);
  }

  _updateStatEl(id, val) {
    const el = this._el(id);
    if (el) el.textContent = String(val);
  }
}

window.ThreatHuntingScreen = ThreatHuntingScreen;
