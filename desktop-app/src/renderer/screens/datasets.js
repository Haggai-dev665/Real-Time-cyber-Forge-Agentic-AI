/**
 * Datasets Screen
 * Dataset catalog management, sync, import/export for ML training data.
 */

class DatasetsScreen {
  constructor() {
    this.container = null;
    this.syncingRows = new Set();

    this.datasets = [
      { id: 'threat-feeds',         name: 'Threat Feeds',         type: 'Threat',  records: 125400, size: '48 MB',  status: 'Active',   lastSync: '2026-05-01 04:00' },
      { id: 'malware-signatures',   name: 'Malware Signatures',   type: 'IOC',     records: 89200,  size: '112 MB', status: 'Active',   lastSync: '2026-05-01 03:30' },
      { id: 'cve-database',         name: 'CVE Database',         type: 'CVE',     records: 234100, size: '201 MB', status: 'Active',   lastSync: '2026-04-30 22:00' },
      { id: 'phishing-urls',        name: 'Phishing URLs',        type: 'IOC',     records: 412800, size: '88 MB',  status: 'Active',   lastSync: '2026-05-01 04:15' },
      { id: 'ip-reputation',        name: 'IP Reputation',        type: 'Threat',  records: 1820000, size: '340 MB', status: 'Active',  lastSync: '2026-05-01 01:00' },
      { id: 'yara-rules',           name: 'YARA Rules',           type: 'IOC',     records: 9800,   size: '5 MB',   status: 'Active',   lastSync: '2026-04-29 12:00' },
      { id: 'network-baselines',    name: 'Network Baselines',    type: 'Network', records: 55000,  size: '72 MB',  status: 'Archived', lastSync: '2026-04-15 08:00' },
      { id: 'user-behaviors',       name: 'User Behaviors',       type: 'Network', records: 317500, size: '155 MB', status: 'Active',   lastSync: '2026-05-01 02:45' },
    ];
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
        .ds-layout { display: flex; flex-direction: column; gap: var(--cf-space-5); }
        .ds-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--cf-space-4); }
        .ds-stat-card {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          padding: var(--cf-space-4) var(--cf-space-5);
          text-align: center;
          box-shadow: var(--cf-shadow-sm);
        }
        .ds-stat-value {
          font-size: var(--cf-text-2xl);
          font-weight: var(--cf-weight-bold);
          color: var(--cf-interactive-default);
          font-family: var(--cf-font-mono);
          line-height: 1.2;
        }
        .ds-stat-label {
          font-size: var(--cf-text-xs);
          color: var(--cf-text-muted);
          margin-top: var(--cf-space-1);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ds-card {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .ds-card-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--cf-space-3);
          flex-wrap: wrap;
        }
        .ds-card-body { padding: 0; }
        .ds-table-wrap { overflow-x: auto; }
        .ds-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--cf-text-sm);
        }
        .ds-table th {
          background: var(--cf-table-header-bg);
          color: var(--cf-text-muted);
          font-size: var(--cf-text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: var(--cf-weight-semibold);
          padding: var(--cf-space-3) var(--cf-space-4);
          text-align: left;
          border-bottom: 1px solid var(--cf-table-border);
          white-space: nowrap;
        }
        .ds-table td {
          padding: var(--cf-space-3) var(--cf-space-4);
          border-bottom: 1px solid var(--cf-table-border);
          color: var(--cf-text-secondary);
          vertical-align: middle;
          white-space: nowrap;
        }
        .ds-table tr:last-child td { border-bottom: none; }
        .ds-table tr:hover td { background: var(--cf-table-row-hover); }
        .ds-name-cell { color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); }
        .ds-type-badge {
          display: inline-block;
          background: var(--cf-surface-2);
          border: 1px solid var(--cf-border-light);
          border-radius: var(--cf-radius-sm);
          color: var(--cf-text-secondary);
          font-size: var(--cf-text-xs);
          padding: 1px var(--cf-space-2);
          font-family: var(--cf-font-mono);
        }
        .ds-records { font-family: var(--cf-font-mono); color: var(--cf-text-primary); }
        .ds-size { font-family: var(--cf-font-mono); font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
        .ds-sync-time { font-family: var(--cf-font-mono); font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
        @keyframes ds-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .ds-badge-syncing { animation: ds-pulse 1.4s ease-in-out infinite; }
        .ds-btn-row { display: flex; gap: var(--cf-space-2); }
        .ds-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--cf-space-5); }
        @media (max-width: 680px) { .ds-two-col { grid-template-columns: 1fr; } }
        .ds-io-panel {
          background: var(--cf-card-bg);
          border: 1px solid var(--cf-card-border);
          border-radius: var(--cf-radius-lg);
          overflow: hidden;
          box-shadow: var(--cf-shadow-sm);
        }
        .ds-io-header {
          background: var(--cf-card-header-bg);
          border-bottom: 1px solid var(--cf-card-border);
          padding: var(--cf-space-3) var(--cf-space-5);
        }
        .ds-io-body { padding: var(--cf-space-4); display: flex; flex-direction: column; gap: var(--cf-space-3); }
        .ds-file-label {
          font-size: var(--cf-text-xs);
          color: var(--cf-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--cf-space-1);
        }
        .ds-file-input {
          display: block;
          background: var(--cf-input-bg);
          border: 1px dashed var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-secondary);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-4);
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .ds-file-input:hover { border-color: var(--cf-interactive-default); }
        .ds-format-select {
          background: var(--cf-input-bg);
          border: 1px solid var(--cf-input-border);
          border-radius: var(--cf-radius-md);
          color: var(--cf-text-primary);
          font-size: var(--cf-text-sm);
          padding: var(--cf-space-2) var(--cf-space-3);
          cursor: pointer;
          outline: none;
          margin-right: var(--cf-space-2);
        }
        .ds-format-select:focus { border-color: var(--cf-interactive-default); }
        .ds-io-row { display: flex; align-items: center; gap: var(--cf-space-2); flex-wrap: wrap; }
        .ds-feedback {
          font-size: var(--cf-text-xs);
          margin-top: var(--cf-space-2);
          min-height: 20px;
          color: var(--cf-status-success);
        }
        .ds-feedback.error { color: var(--cf-status-error); }
      </style>

      <div class="ds-layout">
        <!-- Header -->
        <div class="screen-header">
          <div>
            <div class="screen-title">Datasets</div>
            <div class="screen-subtitle">Manage training data, threat feeds, and intelligence sources</div>
          </div>
          <div class="screen-actions">
            <button class="cf-btn primary" id="ds-sync-all-btn">Sync All</button>
          </div>
        </div>

        <!-- Stats -->
        <div class="ds-stats-grid">
          <div class="ds-stat-card">
            <div class="ds-stat-value" id="ds-stat-total">${this._esc(String(this.datasets.length))}</div>
            <div class="ds-stat-label">Total Datasets</div>
          </div>
          <div class="ds-stat-card">
            <div class="ds-stat-value" id="ds-stat-records">—</div>
            <div class="ds-stat-label">Total Records</div>
          </div>
          <div class="ds-stat-card">
            <div class="ds-stat-value" id="ds-stat-updated">—</div>
            <div class="ds-stat-label">Last Updated</div>
          </div>
          <div class="ds-stat-card">
            <div class="ds-stat-value" id="ds-stat-coverage">—</div>
            <div class="ds-stat-label">Coverage %</div>
          </div>
        </div>

        <!-- Dataset Catalog -->
        <div class="ds-card">
          <div class="ds-card-header">
            <div class="cf-card-title">Dataset Catalog</div>
          </div>
          <div class="ds-card-body">
            <div class="ds-table-wrap">
              <table class="ds-table" id="ds-catalog-table">
                <thead>
                  <tr>
                    <th>Dataset Name</th>
                    <th>Type</th>
                    <th>Records</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="ds-catalog-body">
                  ${this._renderTableRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Import / Export -->
        <div class="ds-two-col">
          <div class="ds-io-panel">
            <div class="ds-io-header">
              <div class="cf-card-title">Import Dataset</div>
            </div>
            <div class="ds-io-body">
              <div>
                <div class="ds-file-label">Upload File</div>
                <input type="file" class="ds-file-input" id="ds-import-file" accept=".json,.csv,.stix,.xml,.txt"/>
              </div>
              <button class="cf-btn primary" id="ds-import-btn">Import</button>
              <div class="ds-feedback" id="ds-import-feedback"></div>
            </div>
          </div>
          <div class="ds-io-panel">
            <div class="ds-io-header">
              <div class="cf-card-title">Export Dataset</div>
            </div>
            <div class="ds-io-body">
              <div>
                <div class="ds-file-label">Export Format</div>
                <div class="ds-io-row">
                  <select class="ds-format-select" id="ds-export-format">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="stix">STIX</option>
                  </select>
                  <button class="cf-btn" id="ds-export-btn">Export</button>
                </div>
              </div>
              <div class="ds-feedback" id="ds-export-feedback"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _statusBadge(status, id) {
    if (status === 'Active') return `<span class="cf-badge success" id="ds-badge-${this._esc(id)}">${this._esc(status)}</span>`;
    if (status === 'Syncing') return `<span class="cf-badge info ds-badge-syncing" id="ds-badge-${this._esc(id)}">${this._esc(status)}</span>`;
    return `<span class="cf-badge" id="ds-badge-${this._esc(id)}">${this._esc(status)}</span>`;
  }

  _renderTableRows() {
    return this.datasets.map(d => `
      <tr id="ds-row-${this._esc(d.id)}">
        <td class="ds-name-cell">${this._esc(d.name)}</td>
        <td><span class="ds-type-badge">${this._esc(d.type)}</span></td>
        <td class="ds-records" id="ds-records-${this._esc(d.id)}">${this._esc(this._fmtNum(d.records))}</td>
        <td class="ds-size">${this._esc(d.size)}</td>
        <td id="ds-status-${this._esc(d.id)}">${this._statusBadge(d.status, d.id)}</td>
        <td class="ds-sync-time" id="ds-sync-time-${this._esc(d.id)}">${this._esc(d.lastSync)}</td>
        <td>
          <div class="ds-btn-row">
            <button class="cf-btn sm" data-sync-id="${this._esc(d.id)}" id="ds-sync-btn-${this._esc(d.id)}">Sync</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  _fmtNum(n) {
    return Number(n).toLocaleString();
  }

  _bindEvents() {
    const syncAllBtn = this._el('ds-sync-all-btn');
    const importBtn = this._el('ds-import-btn');
    const exportBtn = this._el('ds-export-btn');

    if (syncAllBtn) syncAllBtn.addEventListener('click', () => this._syncAll());
    if (importBtn) importBtn.addEventListener('click', () => this._handleImport());
    if (exportBtn) exportBtn.addEventListener('click', () => this._handleExport());

    this.datasets.forEach(d => {
      const btn = this._el(`ds-sync-btn-${d.id}`);
      if (btn) btn.addEventListener('click', () => this._syncDataset(d.id));
    });
  }

  async _loadStats() {
    let totalRecords = this.datasets.reduce((acc, d) => acc + d.records, 0);
    let coverage = 94;
    let lastUpdated = '2026-05-01';

    try {
      const resp = await fetch('http://localhost:3001/api/threats/stats');
      if (resp.ok) {
        const data = await resp.json();
        if (data.total_records) totalRecords = data.total_records;
        if (data.coverage_percent) coverage = data.coverage_percent;
        if (data.last_updated) lastUpdated = data.last_updated;
      }
    } catch (_) {
      // use defaults
    }

    this._setStatEl('ds-stat-records', this._fmtNum(totalRecords));
    this._setStatEl('ds-stat-updated', this._esc(String(lastUpdated)));
    this._setStatEl('ds-stat-coverage', this._esc(String(coverage)) + '%');
  }

  _setStatEl(id, val) {
    const el = this._el(id);
    if (el) el.innerHTML = val;
  }

  async _syncDataset(datasetId) {
    if (this.syncingRows.has(datasetId)) return;
    this.syncingRows.add(datasetId);

    const btn = this._el(`ds-sync-btn-${datasetId}`);
    const statusCell = this._el(`ds-status-${datasetId}`);

    if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
    if (statusCell) statusCell.innerHTML = this._statusBadge('Syncing', datasetId);

    await new Promise(resolve => setTimeout(resolve, 1800 + Math.random() * 1200));

    const ds = this.datasets.find(d => d.id === datasetId);
    if (ds) {
      const now = new Date();
      ds.lastSync = now.toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
      ds.status = 'Active';
      const growth = Math.floor(Math.random() * 500);
      ds.records += growth;

      const syncTimeEl = this._el(`ds-sync-time-${datasetId}`);
      const recordsEl = this._el(`ds-records-${datasetId}`);
      if (syncTimeEl) syncTimeEl.textContent = ds.lastSync;
      if (recordsEl) recordsEl.textContent = this._fmtNum(ds.records);
      if (statusCell) statusCell.innerHTML = this._statusBadge('Active', datasetId);
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Sync'; }
    this.syncingRows.delete(datasetId);

    this._loadStats();
  }

  async _syncAll() {
    const syncAllBtn = this._el('ds-sync-all-btn');
    if (syncAllBtn) { syncAllBtn.disabled = true; syncAllBtn.textContent = 'Syncing All…'; }
    await Promise.all(this.datasets.map(d => this._syncDataset(d.id)));
    if (syncAllBtn) { syncAllBtn.disabled = false; syncAllBtn.textContent = 'Sync All'; }
  }

  _handleImport() {
    const fileInput = this._el('ds-import-file');
    const feedback = this._el('ds-import-feedback');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      if (feedback) { feedback.textContent = 'Please select a file to import.'; feedback.className = 'ds-feedback error'; }
      return;
    }
    const file = fileInput.files[0];
    if (feedback) { feedback.textContent = 'Importing ' + this._esc(file.name) + '…'; feedback.className = 'ds-feedback'; }
    setTimeout(() => {
      if (feedback) { feedback.textContent = 'Import complete: ' + this._esc(file.name); feedback.className = 'ds-feedback'; }
      if (fileInput) fileInput.value = '';
    }, 1200);
  }

  _handleExport() {
    const formatSelect = this._el('ds-export-format');
    const feedback = this._el('ds-export-feedback');
    const fmt = formatSelect ? formatSelect.value : 'json';
    if (feedback) { feedback.textContent = 'Preparing ' + this._esc(fmt.toUpperCase()) + ' export…'; feedback.className = 'ds-feedback'; }
    setTimeout(() => {
      if (feedback) { feedback.textContent = 'Export ready: datasets.' + this._esc(fmt); feedback.className = 'ds-feedback'; }
    }, 900);
  }
}

window.DatasetsScreen = DatasetsScreen;
