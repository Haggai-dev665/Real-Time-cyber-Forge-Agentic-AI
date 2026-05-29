/**
 * Policy Control Center — CyberForge
 * TODO 5: Autonomous Defensive Response Engine
 *
 * Connects to:
 *   GET/POST/PUT/DELETE  /api/policy
 *   POST                 /api/policy/evaluate
 *   GET                  /api/policy/response-log
 *   GET                  /api/policy/stats
 *   GET                  /api/policy/meta
 *   GET/PUT              /api/distributed/weights  (risk weight tuning — completes TODO 4)
 */

class PolicyControlScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.policies = [];
        this.responseLogs = [];
        this.meta = { triggerMetrics: [], operators: [], actionTypes: {} };
        this.stats = null;
        this.weights = null;
        this.activeTab = 'policies';
        this._refreshTimer = null;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadAll();
        this._startRefresh();
    }

    hide() {
        this.isActive = false;
        clearInterval(this._refreshTimer);
    }

    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _headers() {
        if (window.CF_API?.headers) return window.CF_API.headers();
        const token = localStorage.getItem('cf_token') || localStorage.getItem('authToken');
        return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    _shell() {
        return `
<style>
.pc-root { display:flex; flex-direction:column; gap:20px; padding:24px; height:100%; overflow-y:auto; }
.pc-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.pc-title { display:flex; align-items:center; gap:10px; }
.pc-title h2 { margin:0; font-size:1.35rem; font-weight:700; color:var(--cf-text-primary); }
.pc-title i { color:var(--cf-interactive-default); font-size:1.3rem; }
.pc-subtitle { font-size:12px; color:var(--cf-text-muted); margin-top:2px; }

.pc-stats-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
.pc-stat-card { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:10px; padding:16px; }
.pc-stat-card .label { font-size:11px; color:var(--cf-text-muted); letter-spacing:.04em; text-transform:uppercase; margin-bottom:6px; }
.pc-stat-card .value { font-size:1.5rem; font-weight:700; color:var(--cf-text-primary); font-family:'Roboto Mono',monospace; }
.pc-stat-card .value.green { color:var(--cf-status-success); }
.pc-stat-card .value.amber { color:var(--cf-status-warning); }
.pc-stat-card .value.red   { color:var(--cf-status-error); }

.pc-tabs { display:flex; gap:4px; border-bottom:1px solid var(--cf-border-subtle); }
.pc-tab { padding:8px 18px; font-size:13px; font-weight:500; color:var(--cf-text-secondary); cursor:pointer;
          border:none; background:none; border-bottom:2px solid transparent; transition:all .2s; }
.pc-tab.active { color:var(--cf-interactive-default); border-bottom-color:var(--cf-interactive-default); }
.pc-tab:hover:not(.active) { color:var(--cf-text-primary); }

.pc-tab-panel { display:none; }
.pc-tab-panel.visible { display:block; }

/* Policies Table */
.pc-toolbar { display:flex; justify-content:flex-end; margin-bottom:12px; }
.pc-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:7px; font-size:12px;
          font-weight:600; cursor:pointer; border:none; transition:all .2s; }
.pc-btn-primary { background:var(--cf-interactive-default); color:#fff; }
.pc-btn-primary:hover { opacity:.85; }
.pc-btn-danger  { background:var(--cf-status-error); color:#fff; }
.pc-btn-danger:hover { opacity:.85; }
.pc-btn-ghost   { background:transparent; border:1px solid var(--cf-border-default); color:var(--cf-text-secondary); }
.pc-btn-ghost:hover { background:var(--cf-bg-elevated); }
.pc-btn-sm { padding:4px 10px; font-size:11px; border-radius:5px; }

.pc-table-wrap { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:10px; overflow:hidden; }
.pc-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.pc-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:600; color:var(--cf-text-muted);
               text-transform:uppercase; letter-spacing:.06em; background:var(--cf-bg-elevated);
               border-bottom:1px solid var(--cf-border-subtle); }
.pc-table td { padding:10px 14px; border-bottom:1px solid var(--cf-border-subtle); color:var(--cf-text-primary); vertical-align:middle; }
.pc-table tr:last-child td { border-bottom:none; }
.pc-table tr:hover td { background:var(--cf-bg-elevated); }

.pc-badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:600; }
.pc-badge-green { background:rgba(246,157,57,.15); color:var(--cf-status-success); }
.pc-badge-gray  { background:rgba(154,145,130,.12); color:var(--cf-text-muted); }
.pc-badge-amber { background:rgba(216,182,90,.15); color:var(--cf-status-warning); }
.pc-badge-red   { background:rgba(229,87,62,.15); color:var(--cf-status-error); }
.pc-badge-blue  { background:rgba(94,122,136,.15); color:var(--cf-status-info); }

.pc-toggle { position:relative; display:inline-block; width:34px; height:18px; }
.pc-toggle input { opacity:0; width:0; height:0; }
.pc-toggle-slider { position:absolute; inset:0; border-radius:99px; background:var(--cf-border-default);
                    cursor:pointer; transition:.2s; }
.pc-toggle-slider:before { content:''; position:absolute; width:12px; height:12px; border-radius:50%;
                             background:#fff; top:3px; left:3px; transition:.2s; }
.pc-toggle input:checked + .pc-toggle-slider { background:var(--cf-interactive-default); }
.pc-toggle input:checked + .pc-toggle-slider:before { transform:translateX(16px); }

.pc-empty { text-align:center; padding:48px 24px; color:var(--cf-text-muted); }
.pc-empty i { font-size:2rem; margin-bottom:12px; opacity:.4; display:block; }

/* Create Policy Modal */
.pc-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9990;
                    align-items:center; justify-content:center; }
.pc-modal-overlay.open { display:flex; }
.pc-modal { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:14px;
            width:min(540px,92vw); max-height:85vh; overflow-y:auto; padding:28px; box-shadow:0 24px 64px rgba(0,0,0,.4); }
.pc-modal h3 { margin:0 0 20px; font-size:1.1rem; font-weight:700; color:var(--cf-text-primary); }
.pc-form-group { margin-bottom:16px; }
.pc-form-group label { display:block; font-size:11.5px; font-weight:600; color:var(--cf-text-muted);
                        text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px; }
.pc-form-group input,
.pc-form-group select,
.pc-form-group textarea { width:100%; box-sizing:border-box; padding:9px 12px; font-size:13px;
                            background:var(--cf-bg-elevated); border:1px solid var(--cf-border-default);
                            border-radius:7px; color:var(--cf-text-primary); outline:none; transition:border .2s; }
.pc-form-group input:focus,
.pc-form-group select:focus,
.pc-form-group textarea:focus { border-color:var(--cf-interactive-default); }
.pc-trigger-row { display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:end; }
.pc-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:24px; }
.pc-form-err { font-size:11.5px; color:var(--cf-status-error); margin-top:4px; display:none; }

/* Response Log */
.pc-log-entry { display:flex; align-items:flex-start; gap:12px; padding:12px 16px;
                border-bottom:1px solid var(--cf-border-subtle); }
.pc-log-entry:last-child { border-bottom:none; }
.pc-log-icon { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pc-log-icon.escalate { background:rgba(229,87,62,.15); color:var(--cf-status-error); }
.pc-log-icon.notify   { background:rgba(94,122,136,.15); color:var(--cf-status-info); }
.pc-log-icon.block    { background:rgba(216,182,90,.15); color:var(--cf-status-warning); }
.pc-log-icon.agent    { background:rgba(246,157,57,.15); color:var(--cf-status-success); }
.pc-log-icon.default  { background:rgba(154,145,130,.1); color:var(--cf-text-muted); }
.pc-log-body { flex:1; min-width:0; }
.pc-log-name { font-weight:600; font-size:13px; color:var(--cf-text-primary); }
.pc-log-meta { font-size:11px; color:var(--cf-text-muted); margin-top:3px; }

/* Weights Panel */
.pc-weights-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.pc-weight-card { background:var(--cf-bg-card); border:1px solid var(--cf-border-subtle); border-radius:10px; padding:16px; }
.pc-weight-card h4 { margin:0 0 12px; font-size:13px; font-weight:700; color:var(--cf-text-primary); }
.pc-weight-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:12.5px; }
.pc-weight-row span { color:var(--cf-text-secondary); }
.pc-weight-val { font-family:'Roboto Mono',monospace; font-weight:600; color:var(--cf-interactive-default); }
.pc-weight-input { width:80px; padding:4px 8px; background:var(--cf-bg-elevated);
                   border:1px solid var(--cf-border-default); border-radius:5px;
                   color:var(--cf-text-primary); font-size:12px; text-align:right; }
.pc-global-mult { font-size:2rem; font-weight:700; color:var(--cf-interactive-default);
                  font-family:'Roboto Mono',monospace; text-align:center; padding:16px 0; }
</style>

<div class="pc-root">

  <!-- Header -->
  <div class="pc-header">
    <div class="pc-title">
      <i class="fas fa-shield-check"></i>
      <div>
        <h2>Policy Control Center</h2>
        <div class="pc-subtitle">Autonomous response rules, risk weight tuning, and response log</div>
      </div>
    </div>
    <button class="pc-btn pc-btn-primary" id="pc-create-btn">
      <i class="fas fa-plus"></i> New Policy
    </button>
  </div>

  <!-- Stats Row -->
  <div class="pc-stats-row" id="pc-stats-row">
    <div class="pc-stat-card"><div class="label">Total Policies</div><div class="value" id="pc-s-total">—</div></div>
    <div class="pc-stat-card"><div class="label">Enabled</div><div class="value green" id="pc-s-enabled">—</div></div>
    <div class="pc-stat-card"><div class="label">Response Actions</div><div class="value amber" id="pc-s-actions">—</div></div>
    <div class="pc-stat-card"><div class="label">Most Triggered</div><div class="value" id="pc-s-top" style="font-size:13px;padding-top:4px">—</div></div>
  </div>

  <!-- Tabs -->
  <div class="pc-tabs">
    <button class="pc-tab active" data-tab="policies">Policies</button>
    <button class="pc-tab" data-tab="response-log">Response Log</button>
    <button class="pc-tab" data-tab="weights">Risk Weights</button>
  </div>

  <!-- Policies Tab -->
  <div class="pc-tab-panel visible" id="tab-policies">
    <div class="pc-toolbar">
      <span style="font-size:12px;color:var(--cf-text-muted)" id="pc-policy-count">Loading...</span>
    </div>
    <div class="pc-table-wrap">
      <table class="pc-table">
        <thead>
          <tr>
            <th>Name</th><th>Trigger</th><th>Action</th><th>Scope</th>
            <th>Triggers</th><th>Last Fired</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody id="pc-policy-tbody">
          <tr><td colspan="8"><div class="pc-empty"><i class="fas fa-shield-check"></i>Loading policies...</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Response Log Tab -->
  <div class="pc-tab-panel" id="tab-response-log">
    <div class="pc-toolbar" style="justify-content:space-between">
      <span style="font-size:12px;color:var(--cf-text-muted)" id="pc-log-count">Loading...</span>
      <button class="pc-btn pc-btn-ghost pc-btn-sm" id="pc-log-refresh">
        <i class="fas fa-rotate-right"></i> Refresh
      </button>
    </div>
    <div class="pc-table-wrap" id="pc-log-wrap" style="max-height:460px;overflow-y:auto;">
      <div class="pc-empty"><i class="fas fa-clock-rotate-left"></i>Loading response log...</div>
    </div>
  </div>

  <!-- Risk Weights Tab -->
  <div class="pc-tab-panel" id="tab-weights">
    <div class="pc-weights-grid">
      <div class="pc-weight-card" style="grid-column:1/-1">
        <h4><i class="fas fa-sliders"></i> Global Risk Multiplier</h4>
        <div class="pc-global-mult" id="pw-global-val">1.0×</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:8px">
          <input type="range" id="pw-global-range" min="0.1" max="5" step="0.1" value="1.0"
                 style="width:260px;accent-color:var(--cf-interactive-default)">
          <input class="pc-weight-input" id="pw-global-input" type="number" min="0.1" max="5" step="0.1" value="1.0">
          <button class="pc-btn pc-btn-primary pc-btn-sm" id="pw-save-global">Save</button>
        </div>
      </div>
      <div class="pc-weight-card">
        <h4><i class="fas fa-globe"></i> Domain Multipliers</h4>
        <div id="pw-domain-list" style="max-height:240px;overflow-y:auto">
          <div class="pc-empty" style="padding:24px"><i class="fas fa-circle-notch fa-spin"></i></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <input class="pc-weight-input" style="flex:1;width:auto" id="pw-domain-key" placeholder="domain.com" type="text">
          <input class="pc-weight-input" id="pw-domain-val" type="number" min="0.1" max="10" step="0.1" value="1.5">
          <button class="pc-btn pc-btn-primary pc-btn-sm" id="pw-add-domain"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div class="pc-weight-card">
        <h4><i class="fas fa-at"></i> TLD Multipliers</h4>
        <div id="pw-tld-list" style="max-height:240px;overflow-y:auto">
          <div class="pc-empty" style="padding:24px"><i class="fas fa-circle-notch fa-spin"></i></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <input class="pc-weight-input" style="flex:1;width:auto" id="pw-tld-key" placeholder=".xyz" type="text">
          <input class="pc-weight-input" id="pw-tld-val" type="number" min="0.1" max="10" step="0.1" value="1.5">
          <button class="pc-btn pc-btn-primary pc-btn-sm" id="pw-add-tld"><i class="fas fa-plus"></i></button>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- Create Policy Modal -->
<div class="pc-modal-overlay" id="pc-modal">
  <div class="pc-modal">
    <h3 id="pc-modal-title"><i class="fas fa-plus-circle" style="color:var(--cf-interactive-default);margin-right:8px"></i>New Policy</h3>
    <div class="pc-form-group">
      <label>Policy Name</label>
      <input type="text" id="pf-name" placeholder="e.g. High Risk Escalation">
    </div>
    <div class="pc-form-group">
      <label>Description</label>
      <textarea id="pf-desc" rows="2" placeholder="What does this policy do?"></textarea>
    </div>
    <div class="pc-form-group">
      <label>Trigger Condition</label>
      <div class="pc-trigger-row">
        <select id="pf-metric"></select>
        <select id="pf-op"></select>
        <input type="number" id="pf-threshold" placeholder="threshold" min="0" step="1" value="75">
      </div>
    </div>
    <div class="pc-form-group">
      <label>Response Action</label>
      <select id="pf-action-type"></select>
    </div>
    <div class="pc-form-group">
      <label>Scope</label>
      <select id="pf-scope">
        <option value="global">Global</option>
        <option value="org">Organization</option>
        <option value="node">Node</option>
      </select>
    </div>
    <div class="pc-form-group" style="display:flex;align-items:center;gap:10px">
      <label style="margin:0">Enabled</label>
      <label class="pc-toggle">
        <input type="checkbox" id="pf-enabled" checked>
        <span class="pc-toggle-slider"></span>
      </label>
    </div>
    <div class="pc-form-err" id="pf-err">Error message</div>
    <div class="pc-modal-actions">
      <button class="pc-btn pc-btn-ghost" id="pc-modal-cancel">Cancel</button>
      <button class="pc-btn pc-btn-primary" id="pc-modal-save">Create Policy</button>
    </div>
  </div>
</div>
`;
    }

    // ── Bind ────────────────────────────────────────────────────────────────────

    _bind() {
        // Tabs
        this.container.querySelectorAll('.pc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this.container.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
                this.container.querySelectorAll('.pc-tab-panel').forEach(p => p.classList.remove('visible'));
                tab.classList.add('active');
                const panel = this.container.querySelector(`#tab-${tab.dataset.tab}`);
                if (panel) panel.classList.add('visible');
            });
        });

        // Create policy
        this.container.querySelector('#pc-create-btn')?.addEventListener('click', () => this._openModal());
        this.container.querySelector('#pc-modal-cancel')?.addEventListener('click', () => this._closeModal());
        this.container.querySelector('#pc-modal-save')?.addEventListener('click', () => this._submitPolicy());

        // Log refresh
        this.container.querySelector('#pc-log-refresh')?.addEventListener('click', () => this._loadResponseLog());

        // Global weight range ↔ input sync
        const gRange = this.container.querySelector('#pw-global-range');
        const gInput = this.container.querySelector('#pw-global-input');
        if (gRange && gInput) {
            gRange.addEventListener('input', () => {
                gInput.value = gRange.value;
                this.container.querySelector('#pw-global-val').textContent = `${parseFloat(gRange.value).toFixed(1)}×`;
            });
            gInput.addEventListener('input', () => {
                gRange.value = gInput.value;
                this.container.querySelector('#pw-global-val').textContent = `${parseFloat(gInput.value).toFixed(1)}×`;
            });
        }
        this.container.querySelector('#pw-save-global')?.addEventListener('click', () => this._saveGlobalWeight());
        this.container.querySelector('#pw-add-domain')?.addEventListener('click', () => this._addWeightEntry('domain'));
        this.container.querySelector('#pw-add-tld')?.addEventListener('click', () => this._addWeightEntry('tld'));
    }

    // ── Load All ──────────────────────────────────────────────────────────────

    async _loadAll() {
        await Promise.all([
            this._loadMeta(),
            this._loadPolicies(),
            this._loadStats(),
            this._loadResponseLog(),
            this._loadWeights(),
        ]);
    }

    async _loadMeta() {
        try {
            const res = await fetch(`${this.BACKEND}/policy/meta`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) return;
            const json = await res.json();
            this.meta = json.data || this.meta;
            this._populateFormSelects();
        } catch { /* use defaults */ }
    }

    _populateFormSelects() {
        const metricSel = this.container.querySelector('#pf-metric');
        const opSel = this.container.querySelector('#pf-op');
        const actionSel = this.container.querySelector('#pf-action-type');
        if (!metricSel) return;

        metricSel.innerHTML = this.meta.triggerMetrics.map(m =>
            `<option value="${this._esc(m)}">${this._esc(m.replace(/_/g,' '))}</option>`
        ).join('');

        opSel.innerHTML = this.meta.operators.map(o =>
            `<option value="${this._esc(o)}">${this._esc(o)}</option>`
        ).join('');

        const at = this.meta.actionTypes || {};
        actionSel.innerHTML = Object.entries(at).map(([k, v]) =>
            `<option value="${this._esc(k)}">${this._esc(v.label || k)}</option>`
        ).join('');
    }

    async _loadPolicies() {
        try {
            const res = await fetch(`${this.BACKEND}/policy`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.policies = json.policies || [];
        } catch {
            this.policies = [];
        }
        this._renderPolicies();
    }

    async _loadStats() {
        try {
            const res = await fetch(`${this.BACKEND}/policy/stats`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) return;
            const json = await res.json();
            this.stats = json.data || null;
        } catch { /* skip */ }
        this._renderStats();
    }

    async _loadResponseLog() {
        try {
            const res = await fetch(`${this.BACKEND}/policy/response-log?limit=80`, {
                headers: this._headers(),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.responseLogs = json.log || [];
        } catch {
            this.responseLogs = [];
        }
        this._renderResponseLog();
    }

    async _loadWeights() {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/weights`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            this.weights = json.data || {};
        } catch {
            this.weights = { global: 1.0, domainMultipliers: {}, tldMultipliers: {} };
        }
        this._renderWeights();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _renderStats() {
        if (!this.stats) return;
        const s = this.stats;
        this._setText('pc-s-total', s.totalPolicies ?? '—');
        this._setText('pc-s-enabled', s.enabledPolicies ?? '—');
        this._setText('pc-s-actions', s.totalResponseActions ?? '—');
        const top = s.mostTriggered?.[0];
        this._setText('pc-s-top', top ? `${this._esc(top.name)} (${top.triggerCount})` : '—');
    }

    _renderPolicies() {
        const tbody = this.container.querySelector('#pc-policy-tbody');
        const count = this.container.querySelector('#pc-policy-count');
        if (!tbody) return;
        if (count) count.textContent = `${this.policies.length} policies`;

        if (!this.policies.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="pc-empty"><i class="fas fa-shield-check"></i>No policies defined</div></td></tr>`;
            return;
        }

        tbody.innerHTML = this.policies.map(p => {
            const triggerStr = `${this._esc(p.trigger?.metric?.replace(/_/g,' '))} ${this._esc(p.trigger?.operator)} ${this._esc(p.trigger?.threshold)}`;
            const actionLabel = this.meta.actionTypes?.[p.action?.type]?.label || this._esc(p.action?.type || '—');
            const scopeClass = p.scope === 'global' ? 'blue' : 'amber';
            const statusClass = p.enabled ? 'green' : 'gray';
            const lastFired = p.lastTriggered ? new Date(p.lastTriggered).toLocaleString() : 'Never';
            const isDefault = p.isDefault;

            return `<tr>
              <td><span style="font-weight:600">${this._esc(p.name)}</span>${isDefault ? ' <span class="pc-badge pc-badge-gray" style="font-size:9px">default</span>' : ''}</td>
              <td><code style="font-size:11px;color:var(--cf-text-secondary)">${triggerStr}</code></td>
              <td><span class="pc-badge pc-badge-amber">${actionLabel}</span></td>
              <td><span class="pc-badge pc-badge-${scopeClass}">${this._esc(p.scope)}</span></td>
              <td style="font-family:'Roboto Mono',monospace">${p.triggerCount ?? 0}</td>
              <td style="font-size:11px;color:var(--cf-text-muted)">${lastFired}</td>
              <td>
                <label class="pc-toggle">
                  <input type="checkbox" ${p.enabled ? 'checked' : ''} data-policy-id="${this._esc(p.id)}" class="pc-toggle-chk">
                  <span class="pc-toggle-slider"></span>
                </label>
              </td>
              <td style="white-space:nowrap">
                ${!isDefault ? `<button class="pc-btn pc-btn-danger pc-btn-sm" data-del="${this._esc(p.id)}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
              </td>
            </tr>`;
        }).join('');

        // Toggle enable/disable
        tbody.querySelectorAll('.pc-toggle-chk').forEach(chk => {
            chk.addEventListener('change', () => this._togglePolicy(chk.dataset.policyId, chk.checked));
        });

        // Delete
        tbody.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => this._deletePolicy(btn.dataset.del));
        });
    }

    _renderResponseLog() {
        const wrap = this.container.querySelector('#pc-log-wrap');
        const count = this.container.querySelector('#pc-log-count');
        if (!wrap) return;
        if (count) count.textContent = `${this.responseLogs.length} response actions`;

        if (!this.responseLogs.length) {
            wrap.innerHTML = `<div class="pc-empty"><i class="fas fa-clock-rotate-left"></i>No response actions recorded yet.</div>`;
            return;
        }

        const iconMap = {
            alert_escalate: { cls: 'escalate', icon: 'fa-arrow-up-right-dots' },
            notify_soc:     { cls: 'notify',   icon: 'fa-bell' },
            soft_block:     { cls: 'block',    icon: 'fa-ban' },
            session_restrict:{ cls:'block',    icon: 'fa-lock' },
            weight_boost:   { cls: 'notify',   icon: 'fa-sliders' },
            agent_task:     { cls: 'agent',    icon: 'fa-robot' },
            log_response:   { cls: 'default',  icon: 'fa-file-lines' },
        };

        wrap.innerHTML = this.responseLogs.map(e => {
            const ic = iconMap[e.actionType] || { cls: 'default', icon: 'fa-bolt' };
            return `<div class="pc-log-entry">
              <div class="pc-log-icon ${ic.cls}"><i class="fas ${ic.icon}" style="font-size:12px"></i></div>
              <div class="pc-log-body">
                <div class="pc-log-name">${this._esc(e.policyName)}</div>
                <div class="pc-log-meta">
                  Action: <strong>${this._esc(e.actionType)}</strong> &bull;
                  Node: <code>${this._esc(e.nodeId)}</code> &bull;
                  Trigger: ${this._esc(e.trigger?.metric)} ${this._esc(e.trigger?.operator)} ${this._esc(e.trigger?.threshold)} (actual: <strong>${this._esc(e.trigger?.actualValue)}</strong>)
                </div>
                <div class="pc-log-meta" style="font-size:10.5px;margin-top:2px">${new Date(e.timestamp).toLocaleString()}</div>
              </div>
            </div>`;
        }).join('');
    }

    _renderWeights() {
        const w = this.weights;
        if (!w) return;

        const gVal = parseFloat(w.global ?? 1.0).toFixed(1);
        this._setText('pw-global-val', `${gVal}×`);
        const gRange = this.container.querySelector('#pw-global-range');
        const gInput = this.container.querySelector('#pw-global-input');
        if (gRange) gRange.value = gVal;
        if (gInput) gInput.value = gVal;

        this._renderWeightList('pw-domain-list', w.domainMultipliers || {}, 'domain');
        this._renderWeightList('pw-tld-list', w.tldMultipliers || {}, 'tld');
    }

    _renderWeightList(elId, map, type) {
        const el = this.container.querySelector(`#${elId}`);
        if (!el) return;
        const entries = Object.entries(map);
        if (!entries.length) {
            el.innerHTML = `<div style="font-size:12px;color:var(--cf-text-muted);padding:8px 0">No entries yet.</div>`;
            return;
        }
        el.innerHTML = entries.map(([key, val]) => `
          <div class="pc-weight-row">
            <span><code style="font-size:11px">${this._esc(key)}</code></span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="pc-weight-val">${parseFloat(val).toFixed(2)}×</span>
              <button class="pc-btn pc-btn-ghost pc-btn-sm"
                      data-rm-key="${this._esc(key)}" data-rm-type="${type}"
                      title="Remove"><i class="fas fa-xmark" style="font-size:10px"></i></button>
            </div>
          </div>`).join('');

        el.querySelectorAll('[data-rm-key]').forEach(btn => {
            btn.addEventListener('click', () => this._removeWeightEntry(btn.dataset.rmKey, btn.dataset.rmType));
        });
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    async _togglePolicy(policyId, enabled) {
        try {
            await fetch(`${this.BACKEND}/policy/${encodeURIComponent(policyId)}`, {
                method: 'PUT',
                headers: this._headers(),
                body: JSON.stringify({ enabled }),
                signal: AbortSignal.timeout(5000),
            });
            const p = this.policies.find(x => x.id === policyId);
            if (p) p.enabled = enabled;
        } catch {
            window.notificationSystem?.error('Policy', 'Failed to update policy status.');
        }
    }

    async _deletePolicy(policyId) {
        if (!confirm('Delete this policy?')) return;
        try {
            const res = await fetch(`${this.BACKEND}/policy/${encodeURIComponent(policyId)}`, {
                method: 'DELETE',
                headers: this._headers(),
                signal: AbortSignal.timeout(5000),
            });
            const json = await res.json();
            if (!json.success) { window.notificationSystem?.error('Policy', json.error || 'Cannot delete'); return; }
            this.policies = this.policies.filter(p => p.id !== policyId);
            this._renderPolicies();
            window.notificationSystem?.success('Policy', 'Policy deleted.');
        } catch {
            window.notificationSystem?.error('Policy', 'Delete failed.');
        }
    }

    _openModal() {
        this._populateFormSelects();
        this.container.querySelector('#pc-modal').classList.add('open');
        this.container.querySelector('#pf-err').style.display = 'none';
    }

    _closeModal() {
        this.container.querySelector('#pc-modal').classList.remove('open');
    }

    async _submitPolicy() {
        const name      = this.container.querySelector('#pf-name')?.value.trim();
        const desc      = this.container.querySelector('#pf-desc')?.value.trim();
        const metric    = this.container.querySelector('#pf-metric')?.value;
        const op        = this.container.querySelector('#pf-op')?.value;
        const threshold = parseFloat(this.container.querySelector('#pf-threshold')?.value);
        const actionType= this.container.querySelector('#pf-action-type')?.value;
        const scope     = this.container.querySelector('#pf-scope')?.value;
        const enabled   = this.container.querySelector('#pf-enabled')?.checked;
        const errEl     = this.container.querySelector('#pf-err');

        if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
        if (isNaN(threshold)) { errEl.textContent = 'Threshold must be a number.'; errEl.style.display = 'block'; return; }
        errEl.style.display = 'none';

        try {
            const res = await fetch(`${this.BACKEND}/policy`, {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify({ name, description: desc, trigger: { metric, operator: op, threshold }, action: { type: actionType }, scope, enabled }),
                signal: AbortSignal.timeout(8000),
            });
            const json = await res.json();
            if (!json.success) { errEl.textContent = json.error || 'Failed to create policy.'; errEl.style.display = 'block'; return; }
            this.policies.unshift(json.policy);
            this._renderPolicies();
            this._closeModal();
            window.notificationSystem?.success('Policy', `Policy "${name}" created.`);
        } catch {
            errEl.textContent = 'Network error. Try again.';
            errEl.style.display = 'block';
        }
    }

    async _saveGlobalWeight() {
        const val = parseFloat(this.container.querySelector('#pw-global-input')?.value);
        if (isNaN(val) || val < 0.1 || val > 5) {
            window.notificationSystem?.error('Weights', 'Global multiplier must be 0.1–5.0');
            return;
        }
        await this._patchWeights({ global: val });
    }

    async _addWeightEntry(type) {
        const keyEl = this.container.querySelector(type === 'domain' ? '#pw-domain-key' : '#pw-tld-key');
        const valEl = this.container.querySelector(type === 'domain' ? '#pw-domain-val' : '#pw-tld-val');
        const key = keyEl?.value.trim();
        const val = parseFloat(valEl?.value);
        if (!key || isNaN(val)) { window.notificationSystem?.error('Weights', 'Enter a valid key and value.'); return; }

        const update = type === 'domain'
            ? { domainMultipliers: { [key]: val } }
            : { tldMultipliers: { [key]: val } };
        await this._patchWeights(update);
        if (keyEl) keyEl.value = '';
    }

    async _removeWeightEntry(key, type) {
        const update = type === 'domain'
            ? { domainMultipliers: { [key]: undefined } }
            : { tldMultipliers: { [key]: undefined } };
        // Send 0 to signal removal (backend clamps to 0.1 min, UI filters out)
        const patch = type === 'domain'
            ? { domainMultipliers: {} }
            : { tldMultipliers: {} };
        // Remove from local weights cache and re-render
        if (type === 'domain') delete this.weights.domainMultipliers[key];
        else delete this.weights.tldMultipliers[key];
        this._renderWeights();
        // Persist deletion via null/0 flag not supported in current backend — just re-render
        window.notificationSystem?.info('Weights', 'Entry removed locally. Reload after backend sync.');
    }

    async _patchWeights(updates) {
        try {
            const res = await fetch(`${this.BACKEND}/distributed/weights`, {
                method: 'PUT',
                headers: this._headers(),
                body: JSON.stringify(updates),
                signal: AbortSignal.timeout(6000),
            });
            const json = await res.json();
            if (!json.success) { window.notificationSystem?.error('Weights', json.error || 'Failed to update weights'); return; }
            this.weights = json.data || this.weights;
            this._renderWeights();
            window.notificationSystem?.success('Weights', 'Risk weights updated.');
        } catch {
            window.notificationSystem?.error('Weights', 'Network error updating weights.');
        }
    }

    _startRefresh() {
        this._refreshTimer = setInterval(async () => {
            if (!this.isActive) return;
            await this._loadStats();
            if (this.activeTab === 'response-log') await this._loadResponseLog();
        }, 30000);
    }

    _setText(id, val) {
        const el = this.container?.querySelector(`#${id}`);
        if (el) el.textContent = val;
    }
}

window.PolicyControlScreen = PolicyControlScreen;
