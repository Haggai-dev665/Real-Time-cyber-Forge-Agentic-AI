/**
 * System Logs Viewer
 * Client-side console capture + agent activity log + backend health summary.
 * No backend log endpoint exists (Heroku Papertrail/Logentries would be needed).
 * Captures window.console.* in a ring buffer + pulls /api/agent/alerts as system events.
 */

(() => {
  const BACKEND = (window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api').replace(/\/$/, '');
  const RING_SIZE = 500;

  // Console ring buffer — installed once at module load, captures all logs forever
  const _ring = [];
  function _push(level, args) {
    _ring.push({ level, ts: new Date().toISOString(), msg: Array.from(args).map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ').slice(0, 1000) });
    if (_ring.length > RING_SIZE) _ring.shift();
  }
  if (!window.__cfLogsInstalled) {
    window.__cfLogsInstalled = true;
    ['log', 'info', 'warn', 'error', 'debug'].forEach(lvl => {
      const orig = console[lvl].bind(console);
      console[lvl] = (...args) => { _push(lvl, args); orig(...args); };
    });
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _userId() {
    return window.cyberforgeAPI?.getCurrentUser?.()?.id || localStorage.getItem('cyberforge_user_id') || 'desktop-user';
  }

  function injectCSS() {
    if (document.getElementById('cf-syslogs-css')) return;
    const css = `
      .syslogs-shell { display:flex;flex-direction:column;gap:16px; }
      .syslogs-tabs { display:flex;gap:4px;background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);padding:4px;width:fit-content; }
      .syslogs-tab { padding:8px 16px;border:none;border-radius:var(--cf-radius-md);font-size:13px;cursor:pointer;background:transparent;color:var(--cf-text-secondary); }
      .syslogs-tab.active { background:var(--cf-interactive-default);color:var(--cf-text-inverse); }
      .syslogs-toolbar { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
      .syslogs-chip { padding:5px 12px;border-radius:99px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid var(--cf-border-light);background:var(--cf-surface-1);color:var(--cf-text-secondary); }
      .syslogs-chip.active { background:var(--cf-interactive-default);color:var(--cf-text-inverse);border-color:var(--cf-interactive-default); }
      .syslogs-chip.lvl-error.active { background:#dc2626;border-color:#dc2626; }
      .syslogs-chip.lvl-warn.active  { background:#f59e0b;border-color:#f59e0b; }
      .syslogs-chip.lvl-info.active  { background:#3b82f6;border-color:#3b82f6; }
      .syslogs-input { padding:6px 12px;background:var(--cf-input-bg);border:1px solid var(--cf-input-border);border-radius:8px;font-size:12px;color:var(--cf-text-primary);font-family:var(--cf-font-mono);min-width:240px; }
      .syslogs-stream { background:#0d1117;color:#c9d1d9;border-radius:10px;padding:14px;font-family:'JetBrains Mono','Consolas',monospace;font-size:11.5px;max-height:560px;overflow-y:auto;border:1px solid #30363d;line-height:1.7; }
      .syslogs-row { display:flex;gap:8px;padding:1px 0; }
      .syslogs-row .ts { color:#7d8590;flex-shrink:0;width:78px; }
      .syslogs-row .lvl { font-weight:700;flex-shrink:0;width:48px;text-transform:uppercase;font-size:9.5px;text-align:center;border-radius:3px;padding:1px 0; }
      .syslogs-row.error .lvl { background:rgba(239,68,68,0.18);color:#f85149; }
      .syslogs-row.warn  .lvl { background:rgba(245,158,11,0.18);color:#d29922; }
      .syslogs-row.info  .lvl { background:rgba(59,130,246,0.18);color:#58a6ff; }
      .syslogs-row.log   .lvl { color:#7ee787; }
      .syslogs-row.debug .lvl { color:#9ca3af; }
      .syslogs-row .msg { flex:1;word-break:break-word;color:#c9d1d9; }
      .syslogs-row.error .msg { color:#f85149; }
      .syslogs-row.warn  .msg { color:#d29922; }
      .syslogs-empty { text-align:center;color:var(--cf-text-muted);padding:32px 16px;font-size:13px; }
    `;
    const style = document.createElement('style');
    style.id = 'cf-syslogs-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  class SystemLogsScreen {
    constructor() {
      this.tab = 'console';   // 'console' | 'agent' | 'backend'
      this.levelFilter = 'all';
      this.searchTerm = '';
      this.poll = null;
    }

    async show(container, screenKey) {
      injectCSS();
      this.container = container;
      const map = { 'logs-agent': 'agent', 'logs-system': 'console', 'logs-export': 'console' };
      this.tab = map[screenKey] || 'console';
      container.innerHTML = this._shell();
      this._bind();
      this._render();
      this.poll = setInterval(() => this._render(), 2000);
    }

    hide() { if (this.poll) { clearInterval(this.poll); this.poll = null; } }

    async _fetchAgentLog() {
      try {
        const res = await fetch(`${BACKEND}/agent/alerts?userId=${encodeURIComponent(_userId())}&limit=80`);
        const d = await res.json();
        const alerts = d.data?.alerts || d.alerts || [];
        return alerts.map(a => ({
          level: a.severity === 'critical' || a.severity === 'high' ? 'error' : a.severity === 'medium' ? 'warn' : 'info',
          ts: a.created_at || a.$createdAt,
          msg: `[${a.source || 'agent'}] ${(a.description || a.title || '').split('\n')[0].slice(0, 200)}`,
        }));
      } catch (e) {
        return [{ level: 'error', ts: new Date().toISOString(), msg: `agent log fetch failed: ${e.message}` }];
      }
    }

    async _fetchBackendHealth() {
      const out = [];
      const ts = new Date().toISOString();
      const probes = [
        ['backend',  `${BACKEND.replace(/\/api$/, '')}/health`],
        ['ml',       `${BACKEND}/cyberforge-ml/health`],
        ['sandbox',  `${BACKEND}/sandbox/health`],
        ['v2-tx',    `${BACKEND}/cyberforge-ml/v2/status`],
      ];
      for (const [name, url] of probes) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          const d = await r.json().catch(() => ({}));
          const summary = d.error ? `error: ${d.error}` : JSON.stringify(d).slice(0, 180);
          out.push({ level: r.ok && !d.error ? 'info' : 'warn', ts, msg: `${name} → ${r.status} ${summary}` });
        } catch (e) {
          out.push({ level: 'error', ts, msg: `${name} unreachable: ${e.message}` });
        }
      }
      return out;
    }

    async _getRows() {
      if (this.tab === 'console') return _ring.slice().reverse();
      if (this.tab === 'agent')   return await this._fetchAgentLog();
      if (this.tab === 'backend') return await this._fetchBackendHealth();
      return [];
    }

    _filtered(rows) {
      let r = rows;
      if (this.levelFilter !== 'all') r = r.filter(x => x.level === this.levelFilter);
      if (this.searchTerm) {
        const t = this.searchTerm.toLowerCase();
        r = r.filter(x => (x.msg || '').toLowerCase().includes(t));
      }
      return r;
    }

    async _render() {
      const stream = this.container?.querySelector('#syslogs-stream');
      if (!stream) return;
      const rows = await this._getRows();
      const filtered = this._filtered(rows);
      const counter = this.container.querySelector('#syslogs-count');
      if (counter) counter.textContent = `${filtered.length} of ${rows.length} entries`;
      if (!filtered.length) {
        stream.innerHTML = `<div class="syslogs-empty">No log entries match the filter</div>`;
        return;
      }
      stream.innerHTML = filtered.map(r => `
        <div class="syslogs-row ${_esc(r.level)}">
          <span class="ts">${_esc(new Date(r.ts).toLocaleTimeString('en', { hour12: false }))}</span>
          <span class="lvl">${_esc(r.level)}</span>
          <span class="msg">${_esc(r.msg)}</span>
        </div>`).join('');
    }

    _exportLogs() {
      this._getRows().then(rows => {
        const txt = rows.map(r => `[${r.ts}] [${r.level.toUpperCase()}] ${r.msg}`).join('\n');
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberforge-${this.tab}-logs-${Date.now()}.log`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    _bind() {
      this.container.querySelectorAll('.syslogs-tab[data-tab]').forEach(t => {
        t.addEventListener('click', () => {
          this.tab = t.dataset.tab;
          this.container.querySelectorAll('.syslogs-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
          this._render();
        });
      });
      this.container.querySelectorAll('.syslogs-chip[data-level]').forEach(c => {
        c.addEventListener('click', () => {
          this.levelFilter = c.dataset.level;
          this.container.querySelectorAll('.syslogs-chip[data-level]').forEach(b => b.classList.toggle('active', b.dataset.level === this.levelFilter));
          this._render();
        });
      });
      const search = this.container.querySelector('#syslogs-search');
      search?.addEventListener('input', () => { this.searchTerm = search.value; this._render(); });
      this.container.querySelector('#syslogs-export')?.addEventListener('click', () => this._exportLogs());
      this.container.querySelector('#syslogs-clear')?.addEventListener('click', () => {
        if (this.tab === 'console') { _ring.length = 0; this._render(); }
      });
    }

    _shell() {
      const tabs = [
        ['console', 'Console (this session)', 'fa-terminal'],
        ['agent',   'Agent Activity',          'fa-robot'],
        ['backend', 'Backend Health',          'fa-heart-pulse'],
      ];
      const levels = ['all', 'error', 'warn', 'info', 'log', 'debug'];
      return `
        <div class="syslogs-shell">
          <div class="screen-header">
            <div>
              <h1 class="screen-title">System Logs</h1>
              <p class="screen-subtitle">Console capture · agent alerts · live backend health probes · export to .log</p>
            </div>
          </div>
          <div class="syslogs-tabs">
            ${tabs.map(([k, l, i]) => `<button class="syslogs-tab ${k === this.tab ? 'active' : ''}" data-tab="${k}"><i class="fas ${i}"></i> ${l}</button>`).join('')}
          </div>
          <div class="syslogs-toolbar">
            ${levels.map(l => `<button class="syslogs-chip lvl-${l} ${l === this.levelFilter ? 'active' : ''}" data-level="${l}">${l}</button>`).join('')}
            <input class="syslogs-input" id="syslogs-search" placeholder="filter by text..." style="margin-left:8px">
            <span style="font-size:11px;color:var(--cf-text-muted);margin-left:auto" id="syslogs-count">— entries</span>
            <button class="syslogs-chip" id="syslogs-export"><i class="fas fa-download"></i> Export</button>
            <button class="syslogs-chip" id="syslogs-clear"><i class="fas fa-trash"></i> Clear</button>
          </div>
          <div id="syslogs-stream" class="syslogs-stream">
            <div class="syslogs-empty">Loading logs...</div>
          </div>
        </div>`;
    }
  }

  window.CyberForgeSystemLogs = SystemLogsScreen;
})();
