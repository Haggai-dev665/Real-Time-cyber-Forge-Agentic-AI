/**
 * Orchestrator Dashboard
 * Live view of the 8-agent pipeline: recent reports, agent stats,
 * verdict breakdown, memory status, agent roster.
 *
 * Backend: /api/orchestrator/{stats,recent,agents,health,memory/...}
 */

(() => {
  const BACKEND = (window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api').replace(/\/$/, '');

  function _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function injectCSS() {
    if (document.getElementById('cf-orch-dash-css')) return;
    const css = `
      .od-shell { display:flex;flex-direction:column;gap:18px; }
      .od-stats { display:grid;grid-template-columns:repeat(4,1fr);gap:10px; }
      @media(max-width:800px){.od-stats{grid-template-columns:repeat(2,1fr);}}
      .od-stat { padding:14px;background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:12px;display:flex;align-items:center;gap:12px; }
      .od-stat i { font-size:22px; }
      .od-stat-val { font-size:22px;font-weight:800;color:var(--cf-text-primary);line-height:1; }
      .od-stat-lbl { font-size:10px;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:3px; }
      .od-grid { display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start; }
      @media(max-width:1100px){.od-grid{grid-template-columns:1fr;}}
      .od-card { background:var(--cf-surface-1);border:1px solid var(--cf-border-light);border-radius:12px;overflow:hidden; }
      .od-card-header { padding:11px 14px;border-bottom:1px solid var(--cf-border-light);background:var(--cf-bg-primary);display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:12.5px; }
      .od-card-body { padding:12px 14px; }
      .od-agents { display:grid;grid-template-columns:repeat(2,1fr);gap:8px; }
      .od-agent { padding:10px 12px;background:var(--cf-bg-primary);border:1px solid var(--cf-border-light);border-radius:10px;display:flex;align-items:center;gap:10px; }
      .od-agent i { font-size:16px;color:var(--cf-interactive-default); }
      .od-agent-name { font-size:12.5px;font-weight:700;color:var(--cf-text-primary);text-transform:capitalize; }
      .od-agent-role { font-size:10.5px;color:var(--cf-text-muted);margin-top:2px;line-height:1.4; }
      .od-recent { display:flex;flex-direction:column;gap:6px;max-height:560px;overflow-y:auto; }
      .od-row { display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--cf-bg-primary);border:1px solid var(--cf-border-light);border-left:3px solid var(--cf-text-muted);border-radius:9px;cursor:pointer;transition:all 0.15s; }
      .od-row:hover { transform:translateX(2px);border-color:var(--cf-interactive-default); }
      .od-row.v-malicious  { border-left-color:#E5573E; }
      .od-row.v-suspicious { border-left-color:#D8B65A; }
      .od-row.v-low-risk   { border-left-color:#5E7A88; }
      .od-row.v-clean      { border-left-color:#F69D39; }
      .od-row-target { flex:1;min-width:0;font-family:var(--cf-font-mono);font-size:11.5px;color:var(--cf-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
      .od-row-meta { display:flex;gap:8px;font-size:10px;color:var(--cf-text-muted);flex-shrink:0; }
      .od-vbadge { font-size:9px;font-weight:800;text-transform:uppercase;padding:2px 7px;border-radius:99px;letter-spacing:0.04em; }
      .od-vbadge.malicious  { background:rgba(229,87,62,0.12);color:#E5573E; }
      .od-vbadge.suspicious { background:rgba(216,182,90,0.12);color:#B8862A; }
      .od-vbadge.low-risk   { background:rgba(94,122,136,0.12);color:#4C6470; }
      .od-vbadge.clean      { background:rgba(246,157,57,0.12);color:#F69D39; }
      .od-empty { text-align:center;padding:32px 16px;color:var(--cf-text-muted);font-size:13px; }
      .od-mem-stat { display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--cf-border-light);font-size:12px; }
      .od-mem-stat:last-child { border-bottom:none; }
      .od-mem-stat span:first-child { color:var(--cf-text-muted); }
      .od-mem-stat span:last-child { color:var(--cf-text-primary);font-weight:600;font-family:var(--cf-font-mono); }
      .od-vbreak { display:flex;flex-direction:column;gap:8px; }
      .od-vbreak-row { display:flex;align-items:center;gap:8px;font-size:12px; }
      .od-vbreak-bar { flex:1;height:7px;border-radius:99px;background:var(--cf-border-light);overflow:hidden; }
      .od-vbreak-fill { height:100%;border-radius:99px; }
      .od-toolbar { display:flex;align-items:center;gap:10px; }
      .od-chip { padding:6px 12px;border-radius:99px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid var(--cf-border-light);background:var(--cf-surface-1);color:var(--cf-text-secondary); }
      .od-chip:hover { border-color:var(--cf-interactive-default); }
    `;
    const style = document.createElement('style');
    style.id = 'cf-orch-dash-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  class OrchestratorDashboardScreen {
    constructor() { this.poll = null; }

    async show(container) {
      injectCSS();
      this.container = container;
      container.innerHTML = this._shell();
      this._bind();
      await this._refresh();
      this.poll = setInterval(() => this._refresh(), 5000);
    }

    hide() { if (this.poll) { clearInterval(this.poll); this.poll = null; } }

    async _refresh() {
      try {
        const [statsR, recentR, agentsR] = await Promise.all([
          fetch(`${BACKEND}/orchestrator/stats`).then(r => r.json()),
          fetch(`${BACKEND}/orchestrator/recent?limit=20`).then(r => r.json()),
          fetch(`${BACKEND}/orchestrator/agents`).then(r => r.json()),
        ]);
        this._renderStats(statsR.stats || {});
        this._renderRecent(recentR.reports || []);
        this._renderAgents(agentsR.agents || []);
      } catch (e) {
        console.warn('[OrchDashboard] refresh failed:', e.message);
      }
    }

    _renderStats(stats) {
      const total = stats.totalReports || 0;
      const avg = stats.avgDurationMs || 0;
      const memDomains = stats.memory?.domains || 0;
      const agentCount = (stats.agents || []).length;
      this.container.querySelector('#od-stats').innerHTML = `
        <div class="od-stat"><i class="fas fa-radar" style="color:var(--cf-interactive-default)"></i><div><div class="od-stat-val">${total}</div><div class="od-stat-lbl">Reports (session)</div></div></div>
        <div class="od-stat"><i class="fas fa-bolt" style="color:#D8B65A"></i><div><div class="od-stat-val">${avg}<span style="font-size:13px">ms</span></div><div class="od-stat-lbl">Avg Pipeline</div></div></div>
        <div class="od-stat"><i class="fas fa-brain" style="color:#5E7A88"></i><div><div class="od-stat-val">${memDomains}</div><div class="od-stat-lbl">Domains in Memory</div></div></div>
        <div class="od-stat"><i class="fas fa-network-wired" style="color:#F69D39"></i><div><div class="od-stat-val">${agentCount}</div><div class="od-stat-lbl">Agents Online</div></div></div>
      `;
      // Verdict breakdown bars
      const breakdown = stats.verdictBreakdown || {};
      const sum = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
      const colors = { malicious: '#E5573E', suspicious: '#D8B65A', 'low-risk': '#5E7A88', clean: '#F69D39', unknown: '#756E66' };
      this.container.querySelector('#od-verdicts').innerHTML = ['malicious', 'suspicious', 'low-risk', 'clean'].map(k => {
        const n = breakdown[k] || 0;
        const pct = ((n / sum) * 100).toFixed(0);
        return `<div class="od-vbreak-row"><span style="width:80px;text-transform:capitalize;color:${colors[k]};font-weight:700">${k}</span><div class="od-vbreak-bar"><div class="od-vbreak-fill" style="width:${pct}%;background:${colors[k]}"></div></div><span style="width:30px;text-align:right;font-family:var(--cf-font-mono);font-size:11px">${n}</span></div>`;
      }).join('');
      // Memory stats
      const mem = stats.memory || {};
      this.container.querySelector('#od-mem').innerHTML = `
        <div class="od-mem-stat"><span>Domain history</span><span>${mem.domains || 0}</span></div>
        <div class="od-mem-stat"><span>Active sessions</span><span>${mem.sessions || 0}</span></div>
        <div class="od-mem-stat"><span>LLM contexts</span><span>${mem.llmContexts || 0}</span></div>
        <div class="od-mem-stat"><span>Redis</span><span style="color:${mem.redisReady ? '#F69D39' : '#E5573E'}">${mem.redisReady ? 'connected' : 'offline'}</span></div>
      `;
    }

    _renderRecent(reports) {
      const c = this.container.querySelector('#od-recent');
      if (!reports.length) {
        c.innerHTML = `<div class="od-empty"><i class="fas fa-shield-check" style="font-size:32px;color:#F69D39;display:block;margin-bottom:8px"></i>No reports yet — the orchestrator will populate as you browse</div>`;
        return;
      }
      c.innerHTML = reports.map(r => `
        <div class="od-row v-${_esc(r.verdict || 'unknown')}" data-id="${_esc(r.id)}">
          <span class="od-vbadge ${_esc(r.verdict || 'unknown')}">${_esc(r.verdict || '?')}</span>
          <span class="od-row-target" title="${_esc(r.url)}">${_esc(r.url)}</span>
          <span class="od-row-meta">
            <span>${r.riskScore ?? '—'}/100</span>
            <span>·</span>
            <span>${r.durationMs}ms</span>
            <span>·</span>
            <span>${_timeAgo(r.createdAt)}</span>
          </span>
        </div>
      `).join('');
    }

    _renderAgents(agents) {
      const iconMap = {
        url_classifier: 'fa-shield-virus',
        dga_detector:   'fa-fingerprint',
        web_scraper:    'fa-spider',
        memory:         'fa-brain',
        ioc_extractor:  'fa-magnifying-glass',
        behavioral:     'fa-eye',
        mitre_mapper:   'fa-crosshairs',
        threat_intel:   'fa-globe',
        reporter:       'fa-clipboard-check',
      };
      this.container.querySelector('#od-agents').innerHTML = agents.map(a => `
        <div class="od-agent">
          <i class="fas ${iconMap[a.name] || 'fa-circle'}"></i>
          <div>
            <div class="od-agent-name">${_esc(a.name.replace(/_/g, ' '))}</div>
            <div class="od-agent-role">${_esc(a.role)}</div>
          </div>
        </div>
      `).join('');
    }

    _bind() {
      this.container.querySelector('#od-refresh')?.addEventListener('click', () => this._refresh());
      this.container.querySelector('#od-test')?.addEventListener('click', async () => {
        const url = prompt('URL to send through the 8-agent pipeline:', 'https://example.com');
        if (!url) return;
        try {
          await fetch(`${BACKEND}/orchestrator/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, sessionId: window.__cfSessionId || 'dashboard', userId: 'desktop-user' }),
          });
          this._refresh();
        } catch (e) { alert('Failed: ' + e.message); }
      });
    }

    _shell() {
      return `
        <div class="od-shell">
          <div class="screen-header">
            <div>
              <h1 class="screen-title">Orchestrator Dashboard</h1>
              <p class="screen-subtitle">8-agent pipeline · live verdicts · memory state · auto-refresh every 5s</p>
            </div>
          </div>
          <div id="od-stats" class="od-stats"></div>
          <div class="od-toolbar">
            <button class="od-chip" id="od-refresh"><i class="fas fa-rotate"></i> Refresh</button>
            <button class="od-chip" id="od-test"><i class="fas fa-vial"></i> Test URL</button>
          </div>
          <div class="od-grid">
            <div class="od-card">
              <div class="od-card-header"><span><i class="fas fa-clock-rotate-left"></i> Recent Pipeline Runs</span></div>
              <div class="od-card-body" style="padding:8px"><div id="od-recent" class="od-recent"></div></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:14px">
              <div class="od-card">
                <div class="od-card-header"><span><i class="fas fa-chart-pie"></i> Verdict Breakdown</span></div>
                <div class="od-card-body"><div id="od-verdicts" class="od-vbreak"></div></div>
              </div>
              <div class="od-card">
                <div class="od-card-header"><span><i class="fas fa-brain"></i> Memory Layer</span></div>
                <div class="od-card-body"><div id="od-mem"></div></div>
              </div>
              <div class="od-card">
                <div class="od-card-header"><span><i class="fas fa-network-wired"></i> Agent Roster</span></div>
                <div class="od-card-body"><div id="od-agents" class="od-agents"></div></div>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  window.CyberForgeOrchestratorDashboard = OrchestratorDashboardScreen;
})();
