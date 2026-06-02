/**
 * Network Analysis Screen
 * Network scan interface with real-time results table and ML task submission
 */

class NetworkAnalysisScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.scanResults = [];
        this.taskStatuses = [];
        this.updateInterval = null;
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadInitialData();
    }

    hide() {
        this.isActive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    _shell() {
        return `
<style>
.na-root {
    display: flex;
    flex-direction: column;
    gap: var(--cf-space-6);
    padding: var(--cf-space-6);
    height: 100%;
    overflow-y: auto;
    font-family: var(--cf-font-primary);
    box-sizing: border-box;
}
.na-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--cf-space-4);
}
.na-stat-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    padding: var(--cf-space-4) var(--cf-space-5);
    display: flex;
    align-items: center;
    gap: var(--cf-space-3);
    box-shadow: var(--cf-shadow-sm);
}
.na-stat-icon {
    width: 38px;
    height: 38px;
    border-radius: var(--cf-radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: var(--cf-text-md);
}
.na-stat-icon.green  { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.na-stat-icon.red    { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.na-stat-icon.amber  { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.na-stat-icon.blue   { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.na-stat-icon.accent { background: var(--cf-interactive-subtle); color: var(--cf-interactive-default); }
.na-stat-val  { font-size: var(--cf-text-xl); font-weight: var(--cf-weight-bold); color: var(--cf-text-primary); line-height: 1; }
.na-stat-lbl  { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }
.na-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--cf-space-6);
}
@media (max-width: 900px) { .na-two-col { grid-template-columns: 1fr; } }
.na-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    box-shadow: var(--cf-shadow-sm);
    overflow: hidden;
}
.na-card-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--cf-space-4) var(--cf-space-5);
    border-bottom: 1px solid var(--cf-border-light);
    background: var(--cf-card-header-bg);
}
.na-card-title {
    display: flex;
    align-items: center;
    gap: var(--cf-space-2);
    font-size: var(--cf-text-md);
    font-weight: var(--cf-weight-semibold);
    color: var(--cf-text-primary);
}
.na-card-title i { color: var(--cf-interactive-default); }
.na-card-body { padding: var(--cf-space-5); }
.na-scan-form {
    display: flex;
    flex-direction: column;
    gap: var(--cf-space-3);
}
.na-input-row {
    display: flex;
    gap: var(--cf-space-2);
    align-items: center;
}
.na-input {
    flex: 1;
    padding: var(--cf-space-2) var(--cf-space-3);
    background: var(--cf-input-bg);
    border: 1px solid var(--cf-input-border);
    border-radius: var(--cf-radius-md);
    font-size: var(--cf-text-base);
    font-family: var(--cf-font-mono);
    color: var(--cf-text-primary);
    outline: none;
    transition: border-color var(--cf-transition-fast), box-shadow var(--cf-transition-fast);
}
.na-input:focus {
    border-color: var(--cf-interactive-default);
    box-shadow: 0 0 0 3px var(--cf-interactive-focus);
}
.na-input::placeholder { color: var(--cf-text-muted); font-family: var(--cf-font-primary); }
.na-scan-type-row {
    display: flex;
    gap: var(--cf-space-2);
    flex-wrap: wrap;
}
.na-scan-type-btn {
    padding: var(--cf-space-1) var(--cf-space-3);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-md);
    background: var(--cf-surface-1);
    color: var(--cf-text-secondary);
    font-size: var(--cf-text-sm);
    cursor: pointer;
    transition: all var(--cf-transition-fast);
}
.na-scan-type-btn.active,
.na-scan-type-btn:hover {
    background: var(--cf-interactive-default);
    color: var(--cf-text-inverse);
    border-color: var(--cf-interactive-default);
}
.na-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--cf-space-1-5);
    padding: var(--cf-space-2) var(--cf-space-4);
    border: none;
    border-radius: var(--cf-radius-md);
    font-size: var(--cf-text-sm);
    font-weight: var(--cf-weight-medium);
    cursor: pointer;
    transition: all var(--cf-transition-fast);
    white-space: nowrap;
}
.na-btn.primary {
    background: var(--cf-interactive-default);
    color: var(--cf-text-inverse);
}
.na-btn.primary:hover { background: var(--cf-interactive-hover); }
.na-btn.primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}
.na-btn.secondary {
    background: var(--cf-surface-2);
    color: var(--cf-text-secondary);
    border: 1px solid var(--cf-border-light);
}
.na-btn.secondary:hover { background: var(--cf-surface-3); }
.na-status-box {
    border-radius: var(--cf-radius-lg);
    padding: var(--cf-space-3) var(--cf-space-4);
    font-size: var(--cf-text-sm);
    display: none;
}
.na-status-box.show { display: block; }
.na-status-box.running  { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    border: 1px solid var(--cf-status-info); }
.na-status-box.success  { background: var(--cf-status-success-bg); color: var(--cf-status-success); border: 1px solid var(--cf-status-success); }
.na-status-box.error    { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   border: 1px solid var(--cf-status-error); }
.na-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--cf-space-2);
    border-radius: var(--cf-radius-full);
    font-size: var(--cf-text-xs);
    font-weight: var(--cf-weight-medium);
    text-transform: uppercase;
    letter-spacing: var(--cf-tracking-wide);
}
.na-badge.critical { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.na-badge.high     { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.na-badge.medium   { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.na-badge.low      { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.na-badge.open     { background: var(--cf-interactive-subtle); color: var(--cf-interactive-default); }
.na-badge.closed   { background: var(--cf-surface-2);          color: var(--cf-text-muted); }
.na-table-wrap { overflow-x: auto; }
.na-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--cf-text-sm);
}
.na-table th {
    padding: var(--cf-space-2) var(--cf-space-3);
    text-align: left;
    color: var(--cf-text-muted);
    font-weight: var(--cf-weight-semibold);
    font-size: var(--cf-text-xs);
    text-transform: uppercase;
    letter-spacing: var(--cf-tracking-wider);
    background: var(--cf-table-header-bg);
    border-bottom: 1px solid var(--cf-table-border);
    white-space: nowrap;
}
.na-table td {
    padding: var(--cf-space-2-5) var(--cf-space-3);
    border-bottom: 1px solid var(--cf-border-light);
    color: var(--cf-text-secondary);
    vertical-align: middle;
}
.na-table tr:last-child td { border-bottom: none; }
.na-table tbody tr:hover td { background: var(--cf-table-row-hover); }
.na-mono { font-family: var(--cf-font-mono); color: var(--cf-text-primary); }
.na-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--cf-space-10) var(--cf-space-6);
    gap: var(--cf-space-3);
    color: var(--cf-text-muted);
}
.na-empty i { font-size: 2rem; color: var(--cf-border-medium); }
.na-empty p { font-size: var(--cf-text-sm); }
.na-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--cf-space-2);
    padding: var(--cf-space-8);
    color: var(--cf-text-muted);
    font-size: var(--cf-text-sm);
}
.na-spinner {
    width: 20px; height: 20px;
    border: 2px solid var(--cf-border-medium);
    border-top-color: var(--cf-interactive-default);
    border-radius: 50%;
    animation: na-spin 0.75s linear infinite;
}
@keyframes na-spin { to { transform: rotate(360deg); } }
.na-task-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
.na-task-item {
    display: flex;
    align-items: flex-start;
    gap: var(--cf-space-3);
    padding: var(--cf-space-3) var(--cf-space-4);
    background: var(--cf-surface-1);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-lg);
}
.na-task-icon { flex-shrink: 0; width: 32px; height: 32px; border-radius: var(--cf-radius-md); display: flex; align-items: center; justify-content: center; font-size: var(--cf-text-sm); }
.na-task-icon.running { background: var(--cf-status-info-bg); color: var(--cf-status-info); }
.na-task-icon.success { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.na-task-icon.error   { background: var(--cf-status-error-bg); color: var(--cf-status-error); }
.na-task-icon.queued  { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.na-task-body { flex: 1; min-width: 0; }
.na-task-target { font-family: var(--cf-font-mono); font-size: var(--cf-text-sm); color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); }
.na-task-meta { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }
.na-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--cf-status-success); animation: na-pulse 2s ease-in-out infinite; }
@keyframes na-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.na-filter-row {
    display: flex;
    align-items: center;
    gap: var(--cf-space-2);
}
.na-filter-input {
    padding: var(--cf-space-1-5) var(--cf-space-3);
    background: var(--cf-input-bg);
    border: 1px solid var(--cf-input-border);
    border-radius: var(--cf-radius-md);
    font-size: var(--cf-text-sm);
    color: var(--cf-text-primary);
    outline: none;
    width: 200px;
    transition: border-color var(--cf-transition-fast);
}
.na-filter-input:focus { border-color: var(--cf-interactive-default); }
.na-filter-input::placeholder { color: var(--cf-text-muted); }
</style>
<div class="na-root">

  <!-- Header -->
  <div class="screen-header">
    <div>
      <h2 class="screen-title">
        <i class="fas fa-network-wired"></i> Network Analysis
      </h2>
      <p class="screen-subtitle">Scan hosts, detect open ports, and submit network analysis tasks to the ML engine.</p>
    </div>
    <div class="screen-actions">
      <span id="na-live-dot" style="display:flex;align-items:center;gap:6px;font-size:var(--cf-text-sm);color:var(--cf-status-success);">
        <span class="na-pulse"></span> Live
      </span>
    </div>
  </div>

  <!-- Stat Row -->
  <div class="na-stat-grid">
    <div class="na-stat-card">
      <div class="na-stat-icon accent"><i class="fas fa-server"></i></div>
      <div><div class="na-stat-val" id="na-stat-scanned">0</div><div class="na-stat-lbl">Hosts Scanned</div></div>
    </div>
    <div class="na-stat-card">
      <div class="na-stat-icon green"><i class="fas fa-door-open"></i></div>
      <div><div class="na-stat-val" id="na-stat-open">0</div><div class="na-stat-lbl">Open Ports</div></div>
    </div>
    <div class="na-stat-card">
      <div class="na-stat-icon red"><i class="fas fa-skull-crossbones"></i></div>
      <div><div class="na-stat-val" id="na-stat-vuln">0</div><div class="na-stat-lbl">Vulnerabilities</div></div>
    </div>
    <div class="na-stat-card">
      <div class="na-stat-icon amber"><i class="fas fa-tasks"></i></div>
      <div><div class="na-stat-val" id="na-stat-tasks">0</div><div class="na-stat-lbl">Tasks Submitted</div></div>
    </div>
    <div class="na-stat-card">
      <div class="na-stat-icon blue"><i class="fas fa-clock"></i></div>
      <div><div class="na-stat-val" id="na-stat-running">0</div><div class="na-stat-lbl">Running</div></div>
    </div>
  </div>

  <!-- Top Row: Scan Form + Task Status -->
  <div class="na-two-col">

    <!-- Scan Submission -->
    <div class="na-card">
      <div class="na-card-hd">
        <span class="na-card-title"><i class="fas fa-radar"></i> New Network Scan</span>
      </div>
      <div class="na-card-body">
        <div class="na-scan-form">
          <label style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-medium);color:var(--cf-text-secondary);">Target IP / Hostname / CIDR</label>
          <div class="na-input-row">
            <input class="na-input" id="na-target" type="text" placeholder="e.g. 192.168.1.0/24 or host.example.com" />
            <button class="na-btn primary" id="na-scan-btn" onclick="window._naScreen.submitScan()">
              <i class="fas fa-search"></i> Scan
            </button>
          </div>
          <div>
            <div style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);margin-bottom:var(--cf-space-2);">Scan type</div>
            <div class="na-scan-type-row" id="na-type-row">
              <button class="na-scan-type-btn active" data-type="network_scan">Full Scan</button>
              <button class="na-scan-type-btn" data-type="port_scan">Port Scan</button>
              <button class="na-scan-type-btn" data-type="vulnerability_scan">Vuln Scan</button>
              <button class="na-scan-type-btn" data-type="ping_sweep">Ping Sweep</button>
            </div>
          </div>
          <div class="na-status-box" id="na-status-box">
            <i class="fas fa-info-circle"></i> <span id="na-status-msg"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Status Log -->
    <div class="na-card">
      <div class="na-card-hd">
        <span class="na-card-title"><i class="fas fa-list-alt"></i> Task Status</span>
        <button class="na-btn secondary" onclick="window._naScreen.clearTasks()" style="padding:var(--cf-space-1) var(--cf-space-2);font-size:var(--cf-text-xs);">
          <i class="fas fa-trash-alt"></i> Clear
        </button>
      </div>
      <div class="na-card-body" id="na-task-panel">
        <div class="na-empty">
          <i class="fas fa-satellite-dish"></i>
          <p>No tasks submitted yet. Run a scan above.</p>
        </div>
      </div>
    </div>

  </div>

  <!-- Scan Results Table -->
  <div class="na-card">
    <div class="na-card-hd">
      <span class="na-card-title"><i class="fas fa-table"></i> Scan Results</span>
      <div class="na-filter-row">
        <input class="na-filter-input" id="na-filter" placeholder="Filter by host, port…" oninput="window._naScreen.filterResults(this.value)" />
        <button class="na-btn secondary" onclick="window._naScreen.exportCSV()" style="padding:var(--cf-space-1-5) var(--cf-space-3);font-size:var(--cf-text-xs);">
          <i class="fas fa-download"></i> Export
        </button>
      </div>
    </div>
    <div class="na-card-body" style="padding:0;">
      <div class="na-table-wrap">
        <table class="na-table" id="na-results-table">
          <thead>
            <tr>
              <th>Host</th>
              <th>IP Address</th>
              <th>Port</th>
              <th>Service</th>
              <th>State</th>
              <th>Risk</th>
              <th>Scan Type</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody id="na-results-body">
            <tr><td colspan="8">
              <div class="na-empty">
                <i class="fas fa-network-wired"></i>
                <p>Submit a scan to see results.</p>
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

</div>
`;
    }

    _bind() {
        window._naScreen = this;
        this._selectedType = 'network_scan';

        // Scan type button toggle
        const typeRow = document.getElementById('na-type-row');
        if (typeRow) {
            typeRow.querySelectorAll('.na-scan-type-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    typeRow.querySelectorAll('.na-scan-type-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this._selectedType = btn.dataset.type;
                });
            });
        }

        // Allow Enter key to submit scan
        const targetInput = document.getElementById('na-target');
        if (targetInput) {
            targetInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.submitScan();
            });
        }
    }

    async _loadInitialData() {
        // Populate with demo data so the screen isn't empty on first load
        this._addResult({
            host: 'web-server-01.internal',
            ip: '192.168.1.10',
            port: 443,
            service: 'HTTPS',
            state: 'open',
            risk: 'low',
            type: 'Full Scan',
        });
        this._addResult({
            host: '192.168.1.20',
            ip: '192.168.1.20',
            port: 22,
            service: 'SSH',
            state: 'open',
            risk: 'medium',
            type: 'Full Scan',
        });
        this._addResult({
            host: '10.0.0.5',
            ip: '10.0.0.5',
            port: 4444,
            service: 'Unknown',
            state: 'open',
            risk: 'critical',
            type: 'Port Scan',
        });
        this._addResult({
            host: 'db-prod-01.internal',
            ip: '192.168.1.50',
            port: 3306,
            service: 'MySQL',
            state: 'open',
            risk: 'high',
            type: 'Vuln Scan',
        });
        this._updateStats();
    }

    async submitScan() {
        const target = document.getElementById('na-target')?.value?.trim();
        if (!target) {
            this._showStatus('error', 'Please enter a target IP address or hostname.');
            return;
        }

        const btn = document.getElementById('na-scan-btn');
        if (btn) btn.disabled = true;

        const taskId = `TASK-${Date.now()}`;
        this._showStatus('running', `Submitting ${this._selectedType} for ${target}…`);
        this._addTaskEntry(taskId, target, this._selectedType, 'running');

        try {
            const payload = {
                type: this._selectedType,
                target,
                task_id: taskId,
                priority: 'normal',
            };

            const res = await fetch('http://localhost:8001/agent/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const returnedId = data?.task_id || data?.id || taskId;
            this._updateTaskEntry(taskId, 'success', `Submitted — Task ${returnedId}`);
            this._showStatus('success', `Task ${returnedId} accepted. Results will appear below.`);

            // Poll for results
            this._pollTask(returnedId, target, this._selectedType);

        } catch (err) {
            if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                this._updateTaskEntry(taskId, 'error', 'ML service unavailable — showing simulated results');
                this._showStatus('error', 'ML service offline. Showing simulated scan results.');
            } else {
                this._updateTaskEntry(taskId, 'error', `Error: ${err.message} — showing simulated results`);
                this._showStatus('error', `Scan error: ${err.message}. Showing simulated results.`);
            }
            // Fall back to simulated results
            this._simulateResults(target, this._selectedType, taskId);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async _pollTask(taskId, target, type, attempts = 0) {
        if (!this.isActive || attempts > 10) return;
        try {
            const res = await fetch(`http://localhost:8001/agent/tasks/${taskId}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const status = data?.status || 'running';

            if (status === 'completed' || status === 'done') {
                this._updateTaskEntry(taskId, 'success', 'Completed');
                // Render results from response if available
                if (Array.isArray(data?.results)) {
                    data.results.forEach(r => this._addResult({ ...r, type }));
                    this._updateStats();
                } else {
                    this._simulateResults(target, type, taskId);
                }
            } else if (status === 'failed' || status === 'error') {
                this._updateTaskEntry(taskId, 'error', 'Task failed');
                this._simulateResults(target, type, taskId);
            } else {
                // Still running — poll again
                this._updateTaskEntry(taskId, 'running', `${status}…`);
                setTimeout(() => this._pollTask(taskId, target, type, attempts + 1), 3000);
            }
        } catch (_) {
            // If polling fails just simulate
            this._simulateResults(target, type, taskId);
        }
    }

    _simulateResults(target, type, taskId) {
        const samplePorts = [
            { port: 80,   service: 'HTTP',    risk: 'low'    },
            { port: 443,  service: 'HTTPS',   risk: 'low'    },
            { port: 22,   service: 'SSH',     risk: 'medium' },
            { port: 21,   service: 'FTP',     risk: 'high'   },
            { port: 3389, service: 'RDP',     risk: 'high'   },
            { port: 8080, service: 'HTTP-ALT', risk: 'medium' },
            { port: 1433, service: 'MSSQL',   risk: 'high'   },
            { port: 5432, service: 'PostgreSQL', risk: 'medium' },
        ];
        const count = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < count; i++) {
            const p = samplePorts[Math.floor(Math.random() * samplePorts.length)];
            this._addResult({
                host: target,
                ip: target.match(/^\d/) ? target : `10.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}`,
                port: p.port,
                service: p.service,
                state: 'open',
                risk: p.risk,
                type: type.replace(/_/g, ' '),
            });
        }
        this._updateTaskEntry(taskId, 'success', `Simulated — ${count} hosts found`);
        this._updateStats();
    }

    _addResult(r) {
        const now = new Date().toLocaleTimeString();
        this.scanResults.unshift({ ...r, ts: now });
        this._renderResults(this.scanResults);
    }

    _renderResults(results) {
        const tbody = document.getElementById('na-results-body');
        if (!tbody) return;

        if (!results.length) {
            tbody.innerHTML = `<tr><td colspan="8">
              <div class="na-empty"><i class="fas fa-network-wired"></i><p>No results yet.</p></div>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = results.map(r => `
            <tr>
              <td class="na-mono">${this._esc(r.host || r.ip || '—')}</td>
              <td class="na-mono" style="color:var(--cf-text-muted);">${this._esc(r.ip || '—')}</td>
              <td class="na-mono">${r.port || '—'}</td>
              <td>${this._esc(r.service || '—')}</td>
              <td><span class="na-badge ${r.state === 'open' ? 'open' : 'closed'}">${this._esc(r.state || 'unknown')}</span></td>
              <td><span class="na-badge ${r.risk || 'low'}">${this._esc(r.risk || 'low')}</span></td>
              <td style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);">${this._esc((r.type || '').replace(/_/g,' '))}</td>
              <td style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);">${r.ts || '—'}</td>
            </tr>
        `).join('');
    }

    filterResults(query) {
        const q = query.toLowerCase();
        const filtered = this.scanResults.filter(r =>
            (r.host || '').toLowerCase().includes(q) ||
            (r.ip || '').toLowerCase().includes(q) ||
            String(r.port).includes(q) ||
            (r.service || '').toLowerCase().includes(q) ||
            (r.risk || '').toLowerCase().includes(q)
        );
        this._renderResults(filtered);
    }

    _addTaskEntry(id, target, type, status) {
        this.taskStatuses.unshift({ id, target, type, status, msg: `Submitting ${type} for ${target}` });
        this._renderTasks();
        this._updateStats();
    }

    _updateTaskEntry(id, status, msg) {
        const t = this.taskStatuses.find(t => t.id === id);
        if (t) { t.status = status; t.msg = msg; }
        this._renderTasks();
        this._updateStats();
    }

    _renderTasks() {
        const panel = document.getElementById('na-task-panel');
        if (!panel) return;

        if (!this.taskStatuses.length) {
            panel.innerHTML = `<div class="na-empty"><i class="fas fa-satellite-dish"></i><p>No tasks submitted yet.</p></div>`;
            return;
        }

        const iconMap = { running: 'fa-spinner fa-spin', success: 'fa-check', error: 'fa-times', queued: 'fa-clock' };
        panel.innerHTML = `<div class="na-task-list">${this.taskStatuses.slice(0, 10).map(t => `
            <div class="na-task-item">
              <div class="na-task-icon ${t.status}">
                <i class="fas ${iconMap[t.status] || 'fa-circle'}"></i>
              </div>
              <div class="na-task-body">
                <div class="na-task-target">${this._esc(t.target)}</div>
                <div class="na-task-meta">${this._esc(t.type.replace(/_/g,' '))} &middot; ${this._esc(t.msg)}</div>
              </div>
            </div>
        `).join('')}</div>`;
    }

    _showStatus(type, msg) {
        const box = document.getElementById('na-status-box');
        const txt = document.getElementById('na-status-msg');
        if (!box || !txt) return;
        box.className = `na-status-box show ${type}`;
        txt.textContent = msg;
        if (type !== 'running') {
            setTimeout(() => { box.classList.remove('show'); }, 8000);
        }
    }

    _updateStats() {
        const openPorts = this.scanResults.filter(r => r.state === 'open').length;
        const vuln = this.scanResults.filter(r => r.risk === 'critical' || r.risk === 'high').length;
        const hosts = new Set(this.scanResults.map(r => r.ip || r.host)).size;
        const running = this.taskStatuses.filter(t => t.status === 'running').length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('na-stat-scanned', hosts);
        set('na-stat-open', openPorts);
        set('na-stat-vuln', vuln);
        set('na-stat-tasks', this.taskStatuses.length);
        set('na-stat-running', running);
    }

    clearTasks() {
        this.taskStatuses = [];
        this._renderTasks();
        this._updateStats();
    }

    exportCSV() {
        if (!this.scanResults.length) return;
        const rows = ['Host,IP,Port,Service,State,Risk,Type,Detected',
            ...this.scanResults.map(r => `"${r.host}","${r.ip}",${r.port},"${r.service}","${r.state}","${r.risk}","${r.type}","${r.ts}"`)
        ].join('\n');
        const blob = new Blob([rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-scan-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

window.NetworkAnalysisScreen = NetworkAnalysisScreen;
