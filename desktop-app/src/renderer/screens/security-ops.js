/**
 * Security Operations Screens
 * Three views over the same alert/threat data:
 *   - AlertsScreen          — severity-filtered alert list + detail
 *   - InvestigationsScreen  — workflow view (active vs closed) over alerts
 *   - IncidentTimelineScreen — chronological event timeline
 *
 * Backend: /api/agent/alerts?userId=...&limit=...
 * No auth required for alerts.
 */

(() => {
  const BACKEND = (window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api').replace(/\/$/, '');

  function _userId() {
    return window.cyberforgeAPI?.getCurrentUser?.()?.id || localStorage.getItem('cyberforge_user_id') || 'desktop-user';
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  async function fetchAlerts({ limit = 100 } = {}) {
    const url = `${BACKEND}/agent/alerts?userId=${encodeURIComponent(_userId())}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data.data?.alerts || data.alerts || [];
  }

  // ────────────────────────────────────────────────────────────
  // SHARED CSS (injected once)
  // ────────────────────────────────────────────────────────────

  function injectCSS() {
    if (document.getElementById('cf-secops-css')) return;
    const css = `
      .secops-shell { display:flex;flex-direction:column;gap:18px; }
      .secops-toolbar { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
      .secops-chip { padding:5px 12px;border-radius:99px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid var(--cf-border-light);background:var(--cf-surface-1);color:var(--cf-text-secondary);transition:all 0.12s; }
      .secops-chip:hover { border-color:var(--cf-interactive-default); }
      .secops-chip.active { background:var(--cf-interactive-default);color:var(--cf-text-inverse);border-color:var(--cf-interactive-default); }
      .secops-chip.sev-critical.active { background:#C8452F;border-color:#C8452F; }
      .secops-chip.sev-high.active     { background:#E5573E;border-color:#E5573E; }
      .secops-chip.sev-medium.active   { background:#D8B65A;border-color:#D8B65A; }
      .secops-chip.sev-low.active      { background:#5E7A88;border-color:#5E7A88; }
      .secops-stats { display:grid;grid-template-columns:repeat(4,1fr);gap:10px; }
      @media (max-width:700px) { .secops-stats { grid-template-columns:repeat(2,1fr); } }
      .secops-stat { padding:14px;border-radius:12px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);display:flex;align-items:center;gap:12px; }
      .secops-stat i { font-size:20px;flex-shrink:0; }
      .secops-stat-val { font-size:20px;font-weight:800;color:var(--cf-text-primary);line-height:1; }
      .secops-stat-lbl { font-size:10px;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px; }
      .secops-grid { display:grid;grid-template-columns:1fr 380px;gap:16px;align-items:start; }
      @media (max-width:1100px) { .secops-grid { grid-template-columns:1fr; } }
      .secops-list { display:flex;flex-direction:column;gap:6px;max-height:680px;overflow-y:auto; }
      .secops-row { display:flex;align-items:flex-start;gap:10px;padding:11px 14px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-left:3px solid var(--cf-text-muted);border-radius:9px;cursor:pointer;transition:all 0.15s; }
      .secops-row:hover { background:var(--cf-interactive-subtle);border-color:var(--cf-interactive-default);transform:translateX(2px); }
      .secops-row.selected { background:var(--cf-interactive-subtle);border-left-color:var(--cf-interactive-default); }
      .secops-row.sev-critical { border-left-color:#C8452F; }
      .secops-row.sev-high     { border-left-color:#E5573E; }
      .secops-row.sev-medium   { border-left-color:#D8B65A; }
      .secops-row.sev-low      { border-left-color:#5E7A88; }
      .secops-row-icon { font-size:14px;margin-top:2px;flex-shrink:0; }
      .secops-row-body { flex:1;min-width:0; }
      .secops-row-title { font-size:13px;font-weight:600;color:var(--cf-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .secops-row-meta { font-size:10.5px;color:var(--cf-text-muted);margin-top:3px;display:flex;gap:6px;flex-wrap:wrap; }
      .secops-row-meta span { display:inline-flex;align-items:center;gap:3px; }
      .secops-sev-badge { font-size:9px;font-weight:800;text-transform:uppercase;padding:2px 7px;border-radius:99px;letter-spacing:0.04em; }
      .secops-sev-badge.critical { background:rgba(200,69,47,0.15);color:#C8452F; }
      .secops-sev-badge.high     { background:rgba(229,87,62,0.12);color:#E5573E; }
      .secops-sev-badge.medium   { background:rgba(216,182,90,0.12);color:#B8862A; }
      .secops-sev-badge.low      { background:rgba(94,122,136,0.12);color:#4C6470; }
      .secops-detail { padding:18px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:12px;display:flex;flex-direction:column;gap:14px;position:sticky;top:0; }
      .secops-detail-empty { color:var(--cf-text-muted);font-size:13px;text-align:center;padding:32px 16px; }
      .secops-detail h4 { margin:0;font-size:14px;color:var(--cf-text-primary); }
      .secops-detail-section { font-size:12.5px;color:var(--cf-text-secondary);line-height:1.55; }
      .secops-detail-meta { display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:11px; }
      .secops-detail-meta dt { color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:700; }
      .secops-detail-meta dd { color:var(--cf-text-primary);margin:0;font-family:var(--cf-font-mono);overflow:hidden;text-overflow:ellipsis; }
      .secops-evidence-list { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px; }
      .secops-evidence-list li { padding:7px 10px;background:var(--cf-bg-primary);border-radius:6px;font-size:11.5px;color:var(--cf-text-secondary);font-family:var(--cf-font-mono);line-height:1.5;border-left:2px solid var(--cf-interactive-default); }
      .secops-empty-state { text-align:center;padding:48px 16px;color:var(--cf-text-muted); }
      .secops-empty-state i { font-size:32px;color:var(--cf-status-success);margin-bottom:10px;display:block; }
      /* Timeline */
      .secops-timeline { position:relative;padding-left:24px; }
      .secops-timeline::before { content:'';position:absolute;left:8px;top:8px;bottom:8px;width:2px;background:linear-gradient(180deg,var(--cf-interactive-default),var(--cf-border-light)); }
      .secops-tl-item { position:relative;padding:10px 14px;margin-bottom:8px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:9px;cursor:pointer;transition:all 0.15s; }
      .secops-tl-item:hover { border-color:var(--cf-interactive-default);transform:translateX(2px); }
      .secops-tl-item::before { content:'';position:absolute;left:-19px;top:14px;width:10px;height:10px;border-radius:50%;background:var(--cf-interactive-default);border:2px solid var(--cf-bg-primary); }
      .secops-tl-item.sev-critical::before { background:#C8452F; }
      .secops-tl-item.sev-high::before     { background:#E5573E; }
      .secops-tl-item.sev-medium::before   { background:#D8B65A; }
      .secops-tl-time { font-size:10px;font-family:var(--cf-font-mono);color:var(--cf-text-muted);margin-bottom:4px; }
      .secops-tl-title { font-size:12.5px;font-weight:600;color:var(--cf-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .secops-tl-meta { font-size:10px;color:var(--cf-text-muted);margin-top:3px; }
      .secops-tl-day { font-size:11px;font-weight:700;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px;padding-left:0; }
      /* Investigations workflow */
      .secops-tabs { display:flex;gap:4px;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:4px;margin-bottom:14px;width:fit-content; }
      .secops-tab { padding:8px 16px;border:none;border-radius:var(--cf-radius-md);font-size:13px;font-weight:500;cursor:pointer;background:transparent;color:var(--cf-text-secondary);transition:all 0.15s; }
      .secops-tab.active { background:var(--cf-interactive-default);color:var(--cf-text-inverse); }
    `;
    const style = document.createElement('style');
    style.id = 'cf-secops-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ────────────────────────────────────────────────────────────
  // SHARED RENDERERS
  // ────────────────────────────────────────────────────────────

  function renderStats(alerts) {
    const total = alerts.length;
    const crit = alerts.filter(a => a.severity === 'critical').length;
    const high = alerts.filter(a => a.severity === 'high').length;
    const med  = alerts.filter(a => a.severity === 'medium').length;
    return `
      <div class="secops-stats">
        <div class="secops-stat"><i class="fas fa-bell" style="color:var(--cf-interactive-default)"></i><div><div class="secops-stat-val">${total}</div><div class="secops-stat-lbl">Total Alerts</div></div></div>
        <div class="secops-stat"><i class="fas fa-skull-crossbones" style="color:#C8452F"></i><div><div class="secops-stat-val">${crit}</div><div class="secops-stat-lbl">Critical</div></div></div>
        <div class="secops-stat"><i class="fas fa-triangle-exclamation" style="color:#E5573E"></i><div><div class="secops-stat-val">${high}</div><div class="secops-stat-lbl">High</div></div></div>
        <div class="secops-stat"><i class="fas fa-circle-exclamation" style="color:#D8B65A"></i><div><div class="secops-stat-val">${med}</div><div class="secops-stat-lbl">Medium</div></div></div>
      </div>`;
  }

  function renderAlertRow(alert) {
    const sev = alert.severity || 'low';
    const title = (alert.description || alert.title || alert.alert_id || '').split('\n')[0].slice(0, 120);
    return `
      <div class="secops-row sev-${_esc(sev)}" data-id="${_esc(alert.alert_id || alert.$id)}">
        <i class="fas fa-${sev === 'critical' ? 'skull-crossbones' : sev === 'high' ? 'triangle-exclamation' : 'circle-exclamation'} secops-row-icon" style="color:${sev === 'critical' ? '#C8452F' : sev === 'high' ? '#E5573E' : sev === 'medium' ? '#D8B65A' : '#5E7A88'}"></i>
        <div class="secops-row-body">
          <div class="secops-row-title">${_esc(title)}</div>
          <div class="secops-row-meta">
            <span class="secops-sev-badge ${_esc(sev)}">${_esc(sev)}</span>
            <span><i class="fas fa-globe"></i> ${_esc(alert.source || 'unknown')}</span>
            <span><i class="fas fa-clock"></i> ${_timeAgo(alert.created_at || alert.$createdAt)}</span>
            ${alert.confidence != null ? `<span><i class="fas fa-gauge"></i> ${(alert.confidence * 100).toFixed(0)}%</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderAlertDetail(alert) {
    if (!alert) return '<div class="secops-detail-empty">Select an alert to view details</div>';
    const desc = alert.description || '';
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
    const sev = alert.severity || 'low';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="secops-sev-badge ${_esc(sev)}">${_esc(sev)}</span>
        <span style="font-size:10px;color:var(--cf-text-muted);font-family:var(--cf-font-mono)">${_esc(alert.alert_id || alert.$id || '')}</span>
      </div>
      <h4>Alert Details</h4>
      <div class="secops-detail-section" style="white-space:pre-wrap;max-height:280px;overflow-y:auto;background:var(--cf-bg-primary);padding:10px;border-radius:8px;font-family:var(--cf-font-mono);font-size:11.5px">${_esc(desc.slice(0, 2500))}${desc.length > 2500 ? '\n[…truncated]' : ''}</div>
      ${evidence.length ? `
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);margin-bottom:6px">Evidence (${evidence.length})</div>
          <ul class="secops-evidence-list">${evidence.map(e => `<li>${_esc(e)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <dl class="secops-detail-meta">
        <dt>Source</dt><dd>${_esc(alert.source || '—')}</dd>
        <dt>User</dt><dd>${_esc(alert.user_id || '—')}</dd>
        <dt>Device</dt><dd>${_esc(alert.device_id || '—')}</dd>
        <dt>Created</dt><dd>${_esc(alert.created_at || alert.$createdAt || '—')}</dd>
        ${alert.confidence != null ? `<dt>Confidence</dt><dd>${(alert.confidence * 100).toFixed(1)}%</dd>` : ''}
      </dl>`;
  }

  function selectRow(container, alertId) {
    container.querySelectorAll('.secops-row, .secops-tl-item').forEach(r => r.classList.toggle('selected', r.dataset.id === alertId));
  }

  // ────────────────────────────────────────────────────────────
  // ALERTS SCREEN
  // ────────────────────────────────────────────────────────────

  class AlertsScreen {
    constructor(filter = 'all') {
      this.filter = filter;     // 'all' | 'critical' | 'high' | 'evidence'
      this.alerts = [];
      this.selected = null;
      this.poll = null;
    }

    async show(container, screenKey) {
      injectCSS();
      this.container = container;
      // sub-route → filter mapping
      const map = { 'alerts-critical': 'critical', 'alerts-high': 'high', 'alerts-evidence': 'evidence' };
      this.filter = map[screenKey] || 'all';
      container.innerHTML = this._shell();
      this._bind();
      await this._load();
      // poll every 30s
      this.poll = setInterval(() => this._load(), 30000);
    }

    hide() { if (this.poll) { clearInterval(this.poll); this.poll = null; } }

    async _load() {
      const list = this.container.querySelector('#alerts-list');
      try {
        this.alerts = await fetchAlerts({ limit: 100 });
        this._render();
      } catch (e) {
        list.innerHTML = `<div class="secops-empty-state"><i class="fas fa-circle-exclamation" style="color:var(--cf-status-error)"></i><div>Failed to load alerts: ${_esc(e.message)}</div></div>`;
      }
    }

    _filtered() {
      let a = this.alerts;
      if (this.filter === 'critical') a = a.filter(x => x.severity === 'critical');
      else if (this.filter === 'high') a = a.filter(x => x.severity === 'high' || x.severity === 'critical');
      else if (this.filter === 'evidence') a = a.filter(x => Array.isArray(x.evidence) && x.evidence.length > 0);
      return a;
    }

    _render() {
      this.container.querySelector('#alerts-stats').outerHTML = `<div id="alerts-stats">${renderStats(this.alerts)}</div>`;
      const filtered = this._filtered();
      const list = this.container.querySelector('#alerts-list');
      list.innerHTML = filtered.length
        ? filtered.map(renderAlertRow).join('')
        : `<div class="secops-empty-state"><i class="fas fa-shield-check"></i><div>No alerts match the current filter</div></div>`;
      list.querySelectorAll('.secops-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.id;
          this.selected = this.alerts.find(a => (a.alert_id || a.$id) === id);
          this.container.querySelector('#alerts-detail').innerHTML = renderAlertDetail(this.selected);
          selectRow(list, id);
        });
      });
    }

    _bind() {
      this.container.querySelectorAll('.secops-chip[data-filter]').forEach(c => {
        c.addEventListener('click', () => {
          this.filter = c.dataset.filter;
          this.container.querySelectorAll('.secops-chip[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === this.filter));
          this._render();
        });
      });
      this.container.querySelector('#alerts-refresh')?.addEventListener('click', () => this._load());
    }

    _shell() {
      const filters = [
        ['all', 'All', ''],
        ['critical', 'Critical', 'sev-critical'],
        ['high', 'High', 'sev-high'],
        ['medium', 'Medium', 'sev-medium'],
        ['evidence', 'With Evidence', ''],
      ];
      return `
        <div class="secops-shell">
          <div class="screen-header">
            <div>
              <h1 class="screen-title">Alerts &amp; Evidence</h1>
              <p class="screen-subtitle">Real-time alert feed from agent &amp; ML pipeline · auto-refresh every 30s</p>
            </div>
          </div>
          <div id="alerts-stats">${renderStats([])}</div>
          <div class="secops-toolbar">
            ${filters.map(([k, l, c]) => `<button class="secops-chip ${c} ${k === this.filter ? 'active' : ''}" data-filter="${k}">${l}</button>`).join('')}
            <button class="secops-chip" id="alerts-refresh" style="margin-left:auto"><i class="fas fa-rotate"></i> Refresh</button>
          </div>
          <div class="secops-grid">
            <div id="alerts-list" class="secops-list">
              <div class="secops-empty-state"><div class="cf-spinner" style="width:24px;height:24px;margin:0 auto 8px"></div><div>Loading alerts...</div></div>
            </div>
            <div id="alerts-detail" class="secops-detail">${renderAlertDetail(null)}</div>
          </div>
        </div>`;
    }
  }

  // ────────────────────────────────────────────────────────────
  // INVESTIGATIONS SCREEN — workflow view (active vs closed)
  //   "active"  = recent alerts (last 24h, severity ≥ medium, no resolution)
  //   "closed"  = older alerts treated as resolved
  // ────────────────────────────────────────────────────────────

  class InvestigationsScreen {
    constructor(tab = 'active') {
      this.tab = tab;
      this.alerts = [];
      this.selected = null;
      this.poll = null;
    }

    async show(container, screenKey) {
      injectCSS();
      this.container = container;
      const map = { 'investigations-active': 'active', 'investigations-closed': 'closed' };
      this.tab = map[screenKey] || 'active';
      container.innerHTML = this._shell();
      this._bind();
      await this._load();
      this.poll = setInterval(() => this._load(), 60000);
    }

    hide() { if (this.poll) { clearInterval(this.poll); this.poll = null; } }

    async _load() {
      try {
        this.alerts = await fetchAlerts({ limit: 200 });
        this._render();
      } catch (e) {
        this.container.querySelector('#inv-list').innerHTML = `<div class="secops-empty-state"><i class="fas fa-circle-exclamation" style="color:var(--cf-status-error)"></i><div>Failed: ${_esc(e.message)}</div></div>`;
      }
    }

    _bucketed() {
      const now = Date.now();
      const dayAgo = now - 86400000;
      const active = [];
      const closed = [];
      for (const a of this.alerts) {
        const ts = new Date(a.created_at || a.$createdAt).getTime();
        const isActive = ts > dayAgo && (a.severity === 'critical' || a.severity === 'high' || a.severity === 'medium');
        (isActive ? active : closed).push(a);
      }
      return { active, closed };
    }

    _render() {
      const { active, closed } = this._bucketed();
      const list = this.tab === 'active' ? active : closed;
      this.container.querySelector('#inv-tab-active').textContent = `Active (${active.length})`;
      this.container.querySelector('#inv-tab-closed').textContent = `Closed (${closed.length})`;
      const listEl = this.container.querySelector('#inv-list');
      listEl.innerHTML = list.length
        ? list.map(renderAlertRow).join('')
        : `<div class="secops-empty-state"><i class="fas fa-folder-open"></i><div>No ${this.tab} investigations</div></div>`;
      listEl.querySelectorAll('.secops-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.id;
          this.selected = list.find(a => (a.alert_id || a.$id) === id);
          this.container.querySelector('#inv-detail').innerHTML = renderAlertDetail(this.selected);
          selectRow(listEl, id);
        });
      });
    }

    _bind() {
      this.container.querySelectorAll('.secops-tab[data-tab]').forEach(t => {
        t.addEventListener('click', () => {
          this.tab = t.dataset.tab;
          this.container.querySelectorAll('.secops-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
          this._render();
        });
      });
      this.container.querySelector('#inv-refresh')?.addEventListener('click', () => this._load());
    }

    _shell() {
      return `
        <div class="secops-shell">
          <div class="screen-header">
            <div>
              <h1 class="screen-title">Investigations</h1>
              <p class="screen-subtitle">Active triage vs closed cases. Active = last 24h, severity ≥ medium.</p>
            </div>
          </div>
          <div class="secops-tabs">
            <button class="secops-tab ${this.tab === 'active' ? 'active' : ''}" id="inv-tab-active" data-tab="active">Active (—)</button>
            <button class="secops-tab ${this.tab === 'closed' ? 'active' : ''}" id="inv-tab-closed" data-tab="closed">Closed (—)</button>
            <button class="secops-chip" id="inv-refresh" style="margin-left:12px"><i class="fas fa-rotate"></i></button>
          </div>
          <div class="secops-grid">
            <div id="inv-list" class="secops-list">
              <div class="secops-empty-state"><div class="cf-spinner" style="width:24px;height:24px;margin:0 auto 8px"></div><div>Loading...</div></div>
            </div>
            <div id="inv-detail" class="secops-detail">${renderAlertDetail(null)}</div>
          </div>
        </div>`;
    }
  }

  // ────────────────────────────────────────────────────────────
  // INCIDENT TIMELINE — chronological day-grouped view
  // ────────────────────────────────────────────────────────────

  class IncidentTimelineScreen {
    constructor(scope = 'all') {
      this.scope = scope;       // 'today' | 'week' | 'all'
      this.alerts = [];
      this.poll = null;
    }

    async show(container, screenKey) {
      injectCSS();
      this.container = container;
      const map = { 'timeline-today': 'today', 'timeline-week': 'week', 'timeline-all': 'all' };
      this.scope = map[screenKey] || 'all';
      container.innerHTML = this._shell();
      this._bind();
      await this._load();
      this.poll = setInterval(() => this._load(), 60000);
    }

    hide() { if (this.poll) { clearInterval(this.poll); this.poll = null; } }

    async _load() {
      try {
        this.alerts = await fetchAlerts({ limit: 200 });
        this._render();
      } catch (e) {
        this.container.querySelector('#tl-content').innerHTML = `<div class="secops-empty-state"><i class="fas fa-circle-exclamation" style="color:var(--cf-status-error)"></i><div>Failed: ${_esc(e.message)}</div></div>`;
      }
    }

    _scoped() {
      const now = Date.now();
      const cutoff = this.scope === 'today' ? now - 86400000
                  : this.scope === 'week'  ? now - 604800000
                  : 0;
      return this.alerts.filter(a => new Date(a.created_at || a.$createdAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.created_at || b.$createdAt) - new Date(a.created_at || a.$createdAt));
    }

    _render() {
      const items = this._scoped();
      const content = this.container.querySelector('#tl-content');
      if (!items.length) {
        content.innerHTML = `<div class="secops-empty-state"><i class="fas fa-shield-check"></i><div>No incidents in scope</div></div>`;
        return;
      }
      // Group by day
      const groups = new Map();
      for (const a of items) {
        const d = new Date(a.created_at || a.$createdAt);
        const key = d.toISOString().split('T')[0];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
      }
      let html = '<div class="secops-timeline">';
      for (const [day, list] of groups) {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : new Date(day).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
        html += `<div class="secops-tl-day">${label}</div>`;
        for (const a of list) {
          const sev = a.severity || 'low';
          const title = (a.description || a.title || '').split('\n')[0].slice(0, 100);
          html += `
            <div class="secops-tl-item sev-${_esc(sev)}" data-id="${_esc(a.alert_id || a.$id)}">
              <div class="secops-tl-time">${new Date(a.created_at || a.$createdAt).toLocaleTimeString('en', { hour12: false })}</div>
              <div class="secops-tl-title">${_esc(title)}</div>
              <div class="secops-tl-meta"><span class="secops-sev-badge ${_esc(sev)}">${_esc(sev)}</span> · ${_esc(a.source || 'unknown')}</div>
            </div>`;
        }
      }
      html += '</div>';
      content.innerHTML = html;
      content.querySelectorAll('.secops-tl-item').forEach(it => {
        it.addEventListener('click', () => {
          const a = items.find(x => (x.alert_id || x.$id) === it.dataset.id);
          this.container.querySelector('#tl-detail').innerHTML = renderAlertDetail(a);
          selectRow(content, it.dataset.id);
        });
      });
    }

    _bind() {
      this.container.querySelectorAll('.secops-chip[data-scope]').forEach(c => {
        c.addEventListener('click', () => {
          this.scope = c.dataset.scope;
          this.container.querySelectorAll('.secops-chip[data-scope]').forEach(b => b.classList.toggle('active', b.dataset.scope === this.scope));
          this._render();
        });
      });
      this.container.querySelector('#tl-refresh')?.addEventListener('click', () => this._load());
    }

    _shell() {
      const scopes = [['today', 'Today'], ['week', 'Last 7 Days'], ['all', 'All Time']];
      return `
        <div class="secops-shell">
          <div class="screen-header">
            <div>
              <h1 class="screen-title">Incident Timeline</h1>
              <p class="screen-subtitle">Chronological view of security incidents · grouped by day</p>
            </div>
          </div>
          <div class="secops-toolbar">
            ${scopes.map(([k, l]) => `<button class="secops-chip ${k === this.scope ? 'active' : ''}" data-scope="${k}">${l}</button>`).join('')}
            <button class="secops-chip" id="tl-refresh" style="margin-left:auto"><i class="fas fa-rotate"></i> Refresh</button>
          </div>
          <div class="secops-grid">
            <div id="tl-content">
              <div class="secops-empty-state"><div class="cf-spinner" style="width:24px;height:24px;margin:0 auto 8px"></div><div>Loading timeline...</div></div>
            </div>
            <div id="tl-detail" class="secops-detail">${renderAlertDetail(null)}</div>
          </div>
        </div>`;
    }
  }

  window.CyberForgeSecOps = { AlertsScreen, InvestigationsScreen, IncidentTimelineScreen };
})();
