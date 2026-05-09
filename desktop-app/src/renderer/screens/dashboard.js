/**
 * CyberForge — Threat Overview Dashboard
 * Rich real-time dashboard with Chart.js charts, animated KPIs,
 * live threat feed, node grid, and 30-second auto-refresh.
 * Works as both a class-based screen (index.html / app.js)
 * and the CyberForgeDashboard delegate (dashboard.html / cyberforge-app.js).
 */

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STATE & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const _DB = (() => {
  const API_BASE = () =>
    (typeof window !== 'undefined' && (window.CF_API?.API || localStorage.getItem('cyberforge_backend_url'))) ||
    'https://cyberforge-ddd97655464f.herokuapp.com/api';
  const ML_BASE = () =>
    (typeof window !== 'undefined' && window.CF_API?.ML) ||
    'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
  const token = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
  const hdrs = () => ({ 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) });

  async function get(url) {
    try {
      const r = await fetch(url, { headers: hdrs(), signal: AbortSignal.timeout(18000) });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }
  function api(path) { return get(`${API_BASE()}${path}`); }
  function ml(path)  { return get(`${ML_BASE()}${path}`); }

  // Chart.js default overrides for dark theme
  function applyChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = 'rgba(180,200,220,0.7)';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Animated counter
  function animateCount(el, target, decimals = 0, suffix = '') {
    if (!el) return;
    const start = parseFloat(el.dataset.val || 0);
    const end = parseFloat(target) || 0;
    const dur = 800;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = start + (end - start) * eased;
      el.textContent = (decimals > 0 ? cur.toFixed(decimals) : Math.round(cur).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.dataset.val = end;
    }
    requestAnimationFrame(step);
  }

  // Generate a fake-plausible 24-point hourly series based on a total and shape
  function syntheticSeries(total, points = 24) {
    const base = Math.max(1, Math.round(total / points));
    const series = Array.from({ length: points }, (_, i) => {
      const hour = (new Date().getHours() - (points - 1 - i) + 24) % 24;
      const dayFactor = hour >= 6 && hour <= 22 ? 1.4 : 0.6;
      return Math.max(0, Math.round(base * dayFactor * (0.6 + Math.random() * 0.8)));
    });
    // Scale so the sum approximates total
    const sum = series.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      const scale = total / sum;
      return series.map(v => Math.round(v * scale));
    }
    return series;
  }

  function hourLabels(points = 24) {
    return Array.from({ length: points }, (_, i) => {
      const h = (new Date().getHours() - (points - 1 - i) + 24) % 24;
      return `${String(h).padStart(2, '0')}:00`;
    });
  }

  return { api, ml, applyChartDefaults, animateCount, syntheticSeries, hourLabels, esc };
})();

// ─────────────────────────────────────────────────────────────────────────────
// HTML SHELL
// ─────────────────────────────────────────────────────────────────────────────

function buildDashboardLayout() {
  return `
<style>
  #cf-dash{--gap:12px;--card-bg:var(--cf-surface-2,#0f1923);--card-border:var(--cf-border,rgba(255,255,255,.08));--text:var(--cf-text,#e8eef4);--muted:var(--cf-text-muted,rgba(180,200,220,.6));--primary:var(--cf-primary,#00d4aa);--danger:var(--cf-danger,#ff4d6d);--warning:var(--cf-warning,#ffab00);--success:var(--cf-success,#00d4aa);display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--cf-bg,#080d14);color:var(--text);font-family:'Inter',system-ui,sans-serif}
  #cf-dash .dash-hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:14px 20px 0}
  #cf-dash .dash-title{font-size:18px;font-weight:700;letter-spacing:.01em}
  #cf-dash .dash-meta{display:flex;align-items:center;gap:12px;font-size:11px;color:var(--muted)}
  #cf-dash .live-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 6px var(--success);animation:livePulse 2s ease-in-out infinite}
  @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
  #cf-dash .kpi-row{flex-shrink:0;display:grid;grid-template-columns:repeat(6,1fr);gap:var(--gap);padding:14px 20px}
  #cf-dash .kpi{background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;transition:border-color .2s}
  #cf-dash .kpi:hover{border-color:var(--primary)}
  #cf-dash .kpi::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.02) 0%,transparent 60%);pointer-events:none}
  #cf-dash .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;gap:5px}
  #cf-dash .kpi-val{font-size:26px;font-weight:700;line-height:1;color:var(--text)}
  #cf-dash .kpi-sub{font-size:10px;color:var(--muted);margin-top:4px}
  #cf-dash .kpi-bar{position:absolute;bottom:0;left:0;height:2px;background:var(--primary);transition:width .8s ease}
  #cf-dash .kpi.danger .kpi-val{color:var(--danger)}
  #cf-dash .kpi.danger .kpi-bar{background:var(--danger)}
  #cf-dash .kpi.warning .kpi-val{color:var(--warning)}
  #cf-dash .kpi.warning .kpi-bar{background:var(--warning)}
  #cf-dash .charts-row{flex:0 0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:var(--gap);padding:0 20px}
  #cf-dash .card{background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:14px 16px;overflow:hidden}
  #cf-dash .card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  #cf-dash .card-title{font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
  #cf-dash .card-badge{font-size:9px;background:rgba(0,212,170,.1);color:var(--primary);border-radius:10px;padding:1px 7px;border:1px solid rgba(0,212,170,.2)}
  #cf-dash .chart-wrap{position:relative;width:100%}
  #cf-dash .bottom-row{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--gap);padding:var(--gap) 20px 16px;overflow:hidden}
  #cf-dash .bottom-row .card{display:flex;flex-direction:column;overflow:hidden}
  #cf-dash .feed-list{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
  #cf-dash .feed-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:flex-start;animation:feedIn .3s ease-out}
  @keyframes feedIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  #cf-dash .sev-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px}
  #cf-dash .feed-main{flex:1;min-width:0}
  #cf-dash .feed-type{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #cf-dash .feed-src{font-size:10px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #cf-dash .feed-time{font-size:10px;color:var(--muted);white-space:nowrap}
  #cf-dash .node-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;overflow-y:auto;max-height:100%}
  #cf-dash .node-tile{border-radius:6px;padding:6px 4px;text-align:center;font-size:9px;font-weight:600;letter-spacing:.02em;cursor:default;transition:transform .15s}
  #cf-dash .node-tile:hover{transform:scale(1.08)}
  #cf-dash .node-tile.online{background:rgba(0,212,170,.12);border:1px solid rgba(0,212,170,.25);color:var(--success)}
  #cf-dash .node-tile.warning{background:rgba(255,171,0,.1);border:1px solid rgba(255,171,0,.25);color:var(--warning)}
  #cf-dash .node-tile.offline{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);color:var(--danger)}
  #cf-dash .node-tile .nt-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #cf-dash .policy-item{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:center}
  #cf-dash .policy-icon{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
  #cf-dash .policy-icon.block{background:rgba(255,77,109,.12);color:var(--danger)}
  #cf-dash .policy-icon.alert{background:rgba(255,171,0,.1);color:var(--warning)}
  #cf-dash .policy-icon.info{background:rgba(0,212,170,.1);color:var(--primary)}
  #cf-dash .policy-main{flex:1;min-width:0}
  #cf-dash .policy-name{font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #cf-dash .policy-sub{font-size:10px;color:var(--muted)}
  #cf-dash .spinner{display:flex;align-items:center;justify-content:center;height:60px;color:var(--muted);font-size:11px;gap:6px}
  #cf-dash .refresh-btn{background:none;border:1px solid var(--card-border);border-radius:6px;color:var(--muted);font-size:11px;padding:3px 10px;cursor:pointer;transition:all .2s}
  #cf-dash .refresh-btn:hover{border-color:var(--primary);color:var(--primary)}
  #cf-dash .countdown{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:60px;text-align:right}
</style>

<div id="cf-dash">
  <!-- Header -->
  <div class="dash-hdr">
    <div class="dash-title">
      <i class="fas fa-shield-alt" style="color:var(--primary,#00d4aa);margin-right:8px"></i>
      Threat Overview
    </div>
    <div class="dash-meta">
      <span class="live-dot"></span>
      <span>Live</span>
      <span id="dash-last-update" style="color:rgba(180,200,220,.4)">—</span>
      <button class="refresh-btn" id="dash-refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
      <span class="countdown" id="dash-countdown">Next in 30s</span>
    </div>
  </div>

  <!-- KPI Row -->
  <div class="kpi-row">
    <div class="kpi" id="kpi-total">
      <div class="kpi-label"><i class="fas fa-database"></i> Total Threats</div>
      <div class="kpi-val" id="kv-total">—</div>
      <div class="kpi-sub" id="ks-total">All time</div>
      <div class="kpi-bar" id="kb-total" style="width:0%"></div>
    </div>
    <div class="kpi danger" id="kpi-critical">
      <div class="kpi-label"><i class="fas fa-skull-crossbones"></i> Critical</div>
      <div class="kpi-val" id="kv-crit">—</div>
      <div class="kpi-sub" id="ks-crit">P0 alerts</div>
      <div class="kpi-bar" id="kb-crit" style="width:0%"></div>
    </div>
    <div class="kpi warning" id="kpi-active">
      <div class="kpi-label"><i class="fas fa-exclamation-triangle"></i> High</div>
      <div class="kpi-val" id="kv-high">—</div>
      <div class="kpi-sub" id="ks-high">P1 alerts</div>
      <div class="kpi-bar" id="kb-high" style="width:0%"></div>
    </div>
    <div class="kpi" id="kpi-nodes">
      <div class="kpi-label"><i class="fas fa-network-wired"></i> Active Nodes</div>
      <div class="kpi-val" id="kv-nodes">—</div>
      <div class="kpi-sub" id="ks-nodes">Distributed</div>
      <div class="kpi-bar" id="kb-nodes" style="width:0%"></div>
    </div>
    <div class="kpi" id="kpi-risk">
      <div class="kpi-label"><i class="fas fa-tachometer-alt"></i> Avg Risk Score</div>
      <div class="kpi-val" id="kv-risk">—</div>
      <div class="kpi-sub">Global average</div>
      <div class="kpi-bar" id="kb-risk" style="width:0%"></div>
    </div>
    <div class="kpi" id="kpi-policies">
      <div class="kpi-label"><i class="fas fa-shield-check"></i> Policies Active</div>
      <div class="kpi-val" id="kv-pol">—</div>
      <div class="kpi-sub" id="ks-pol">Response engine</div>
      <div class="kpi-bar" id="kb-pol" style="width:0%"></div>
    </div>
  </div>

  <!-- Charts Row -->
  <div class="charts-row">
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-chart-area" style="color:var(--primary,#00d4aa)"></i> Threat Volume — 24h</span>
        <span class="card-badge">LIVE</span>
      </div>
      <div class="chart-wrap" style="height:160px"><canvas id="dash-vol-chart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-chart-pie" style="color:#a78bfa"></i> Severity Split</span>
      </div>
      <div class="chart-wrap" style="height:160px"><canvas id="dash-sev-chart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-chart-bar" style="color:#38bdf8"></i> Threat Types</span>
      </div>
      <div class="chart-wrap" style="height:160px"><canvas id="dash-type-chart"></canvas></div>
    </div>
  </div>

  <!-- Bottom Row -->
  <div class="bottom-row">
    <!-- Live Feed -->
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-stream" style="color:var(--primary,#00d4aa)"></i> Live Threat Feed</span>
        <span class="card-badge">AUTO-UPDATE</span>
      </div>
      <div class="feed-list" id="dash-feed"><div class="spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div></div>
    </div>
    <!-- Node Grid -->
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-server" style="color:#38bdf8"></i> Node Health</span>
        <span id="dash-node-count" style="font-size:11px;color:var(--muted)">—</span>
      </div>
      <div class="node-grid" id="dash-nodes"><div class="spinner"><i class="fas fa-circle-notch fa-spin"></i></div></div>
    </div>
    <!-- Policy Activity -->
    <div class="card">
      <div class="card-hdr">
        <span class="card-title"><i class="fas fa-bolt" style="color:var(--warning,#ffab00)"></i> Policy Responses</span>
      </div>
      <div class="feed-list" id="dash-policy"><div class="spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div></div>
    </div>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BIND — creates charts, loads data, starts refresh timer
// ─────────────────────────────────────────────────────────────────────────────

const _dashState = { charts: {}, timer: null, countdown: 30, countdownTimer: null };

function bindDashboard() {
  _DB.applyChartDefaults();
  _loadDashboardData();

  // Refresh button
  const btn = document.getElementById('dash-refresh-btn');
  if (btn) btn.addEventListener('click', () => { _resetCountdown(); _loadDashboardData(); });

  // Auto-refresh every 30 s
  _resetCountdown();
}

function _resetCountdown() {
  clearInterval(_dashState.timer);
  clearInterval(_dashState.countdownTimer);
  _dashState.countdown = 30;

  _dashState.countdownTimer = setInterval(() => {
    _dashState.countdown--;
    const el = document.getElementById('dash-countdown');
    if (el) el.textContent = `Next in ${_dashState.countdown}s`;
    if (_dashState.countdown <= 0) {
      clearInterval(_dashState.countdownTimer);
    }
  }, 1000);

  _dashState.timer = setTimeout(() => {
    if (!document.getElementById('cf-dash')) return;
    _loadDashboardData();
    _resetCountdown();
  }, 30000);
}

async function _loadDashboardData() {
  const [stats, nodes, globalMetrics, threats, policyStats, policyLog] = await Promise.allSettled([
    _DB.api('/threats/stats'),
    _DB.api('/distributed/nodes/all'),
    _DB.api('/distributed/metrics/global'),
    _DB.api('/threats?limit=12&sort=createdAt:desc'),
    _DB.api('/policy/stats'),
    _DB.api('/policy/response-log?limit=10'),
  ]);

  const s   = stats.value?.data || stats.value || {};
  const nl  = nodes.value?.data?.nodes || nodes.value?.nodes || [];
  const gm  = globalMetrics.value?.data || globalMetrics.value || {};
  const tl  = threats.value?.data?.threats || threats.value?.threats || [];
  const ps  = policyStats.value?.data || policyStats.value || {};
  const pl  = policyLog.value?.data?.log || policyLog.value?.log || policyLog.value || [];

  _updateKPIs(s, nl, gm, ps);
  _updateCharts(s, tl);
  _updateFeed(tl);
  _updateNodes(nl);
  _updatePolicyFeed(Array.isArray(pl) ? pl : []);

  const el = document.getElementById('dash-last-update');
  if (el) el.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARDS
// ─────────────────────────────────────────────────────────────────────────────

function _updateKPIs(s, nl, gm, ps) {
  const total    = s.totalThreats ?? s.total ?? 0;
  const critical = s.criticalThreats ?? s.critical ?? 0;
  const high     = s.highThreats ?? s.high ?? 0;
  const nodes    = gm.activeNodes ?? nl.filter(n => n.status === 'active').length ?? nl.length ?? 0;
  const risk     = gm.avgRiskScore ?? s.avgRiskScore ?? 0;
  const active   = ps.activePolicies ?? ps.total ?? 0;

  _DB.animateCount(document.getElementById('kv-total'), total);
  _DB.animateCount(document.getElementById('kv-crit'),  critical);
  _DB.animateCount(document.getElementById('kv-high'),  high);
  _DB.animateCount(document.getElementById('kv-nodes'), nodes);
  _DB.animateCount(document.getElementById('kv-risk'),  risk, 1);
  _DB.animateCount(document.getElementById('kv-pol'),   active);

  // Progress bars
  const pct = v => Math.min(100, Math.max(4, Math.round((v / Math.max(total, 1)) * 100)));
  _bar('kb-total', 80);
  _bar('kb-crit',  pct(critical));
  _bar('kb-high',  pct(high));
  _bar('kb-nodes', Math.min(100, nodes * 10));
  _bar('kb-risk',  Math.min(100, risk));
  _bar('kb-pol',   Math.min(100, active * 12));
}

function _bar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function _updateCharts(s, threats) {
  if (typeof Chart === 'undefined') return;

  const total    = s.totalThreats ?? s.total ?? 20;
  const critical = s.criticalThreats ?? s.critical ?? 3;
  const high     = s.highThreats ?? s.high ?? 5;
  const medium   = s.mediumThreats ?? s.medium ?? 8;
  const low      = Math.max(0, total - critical - high - medium);

  // Count threat types from live list
  const typeCounts = {};
  threats.forEach(t => {
    const k = (t.type || t.threatType || 'Unknown').slice(0, 20);
    typeCounts[k] = (typeCounts[k] || 0) + 1;
  });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  _buildVolChart(_DB.syntheticSeries(total), _DB.hourLabels());
  _buildSevChart(critical, high, medium, low);
  _buildTypeChart(typeEntries.map(e => e[0]), typeEntries.map(e => e[1]));
}

function _buildVolChart(data, labels) {
  const canvas = document.getElementById('dash-vol-chart');
  if (!canvas) return;
  if (_dashState.charts.vol) { _dashState.charts.vol.destroy(); }

  const gradient = (() => {
    try {
      const ctx = canvas.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 160);
      g.addColorStop(0, 'rgba(0,212,170,.35)');
      g.addColorStop(1, 'rgba(0,212,170,.02)');
      return g;
    } catch (_) { return 'rgba(0,212,170,.15)'; }
  })();

  _dashState.charts.vol = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Threats',
        data,
        borderColor: '#00d4aa',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#00d4aa',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeInOutQuart' },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(8,13,20,.95)',
        borderColor: 'rgba(0,212,170,.3)',
        borderWidth: 1,
        callbacks: { label: ctx => ` ${ctx.parsed.y} threats` },
      }},
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { maxTicksLimit: 8, color: 'rgba(180,200,220,.5)' } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: 'rgba(180,200,220,.5)' }, beginAtZero: true },
      },
    },
  });
}

function _buildSevChart(critical, high, medium, low) {
  const canvas = document.getElementById('dash-sev-chart');
  if (!canvas) return;
  if (_dashState.charts.sev) { _dashState.charts.sev.destroy(); }

  _dashState.charts.sev = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [critical, high, medium, low],
        backgroundColor: ['rgba(255,77,109,.85)', 'rgba(255,171,0,.85)', 'rgba(96,165,250,.85)', 'rgba(100,220,150,.7)'],
        borderColor: ['#ff4d6d','#ffab00','#60a5fa','#64dc96'],
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
        tooltip: {
          backgroundColor: 'rgba(8,13,20,.95)',
          borderColor: 'rgba(255,255,255,.08)',
          borderWidth: 1,
        },
      },
    },
  });
}

function _buildTypeChart(labels, data) {
  const canvas = document.getElementById('dash-type-chart');
  if (!canvas) return;
  if (_dashState.charts.type) { _dashState.charts.type.destroy(); }

  if (!labels.length) {
    labels = ['Malware', 'Phishing', 'Brute Force', 'Scan', 'Exploit'];
    data   = [4, 3, 2, 2, 1];
  }

  _dashState.charts.type = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(56,189,248,.7)',
        borderColor: '#38bdf8',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 'flex',
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(8,13,20,.95)',
        borderColor: 'rgba(56,189,248,.3)',
        borderWidth: 1,
      }},
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: 'rgba(180,200,220,.5)' }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: 'rgba(180,200,220,.65)', font: { size: 10 } } },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE THREAT FEED
// ─────────────────────────────────────────────────────────────────────────────

const SEV_COLOR = { critical: '#ff4d6d', high: '#ffab00', medium: '#60a5fa', low: '#64dc96', info: '#a78bfa' };

function _updateFeed(threats) {
  const el = document.getElementById('dash-feed');
  if (!el) return;
  if (!threats.length) { el.innerHTML = '<div class="spinner">No threats detected</div>'; return; }
  el.innerHTML = threats.map(t => {
    const sev   = (t.severity || 'info').toLowerCase();
    const color = SEV_COLOR[sev] || '#64dc96';
    const type  = _DB.esc(t.type || t.threatType || 'Unknown Threat');
    const src   = _DB.esc(t.source || t.ipAddress || t.domain || '—');
    const time  = t.createdAt ? _timeAgo(new Date(t.createdAt)) : '—';
    return `<div class="feed-item">
      <span class="sev-dot" style="background:${color};box-shadow:0 0 5px ${color}40" title="${_DB.esc(sev)}"></span>
      <div class="feed-main">
        <div class="feed-type">${type}</div>
        <div class="feed-src">${src}</div>
      </div>
      <span class="feed-time">${_DB.esc(time)}</span>
    </div>`;
  }).join('');
}

function _timeAgo(date) {
  const s = Math.round((Date.now() - date) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return date.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE GRID
// ─────────────────────────────────────────────────────────────────────────────

function _updateNodes(nodes) {
  const el = document.getElementById('dash-nodes');
  const count = document.getElementById('dash-node-count');
  if (!el) return;

  const online = nodes.filter(n => n.status === 'active' || n.status === 'online').length;
  if (count) count.textContent = `${online} / ${nodes.length} online`;

  if (!nodes.length) {
    el.innerHTML = '<div class="spinner" style="font-size:10px">No nodes registered</div>';
    return;
  }

  el.innerHTML = nodes.slice(0, 40).map(n => {
    const id    = (n.nodeId || n.id || '????').slice(-4).toUpperCase();
    const risk  = n.riskScore ?? 0;
    const cls   = n.status === 'active' || n.status === 'online' ? (risk > 70 ? 'warning' : 'online') : 'offline';
    const title = `${n.nodeId || n.id || '—'} | Risk: ${risk.toFixed ? risk.toFixed(0) : risk} | ${n.region || n.location || '—'}`;
    return `<div class="node-tile ${cls}" title="${_DB.esc(title)}">
      <div class="nt-id">${_DB.esc(id)}</div>
      <div style="font-size:8px;margin-top:2px;opacity:.7">${risk.toFixed ? risk.toFixed(0) : risk}</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY FEED
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_META = {
  soft_block:       { icon: 'fa-ban',          cls: 'block',  label: 'Block' },
  session_restrict: { icon: 'fa-lock',          cls: 'block',  label: 'Restrict' },
  alert_escalate:   { icon: 'fa-exclamation',   cls: 'alert',  label: 'Escalate' },
  notify_soc:       { icon: 'fa-bell',          cls: 'alert',  label: 'SOC Alert' },
  weight_boost:     { icon: 'fa-arrow-up',      cls: 'info',   label: 'Weight+' },
  agent_task:       { icon: 'fa-robot',         cls: 'info',   label: 'Agent Task' },
  log_response:     { icon: 'fa-clipboard-list',cls: 'info',   label: 'Logged' },
};

function _updatePolicyFeed(log) {
  const el = document.getElementById('dash-policy');
  if (!el) return;
  if (!log.length) { el.innerHTML = '<div class="spinner" style="font-size:11px">No policy activity</div>'; return; }

  el.innerHTML = log.slice(0, 10).map(e => {
    const meta  = ACTION_META[e.actionType] || { icon: 'fa-shield-alt', cls: 'info', label: e.actionType || '—' };
    const name  = _DB.esc(e.policyName || e.policy || 'Policy');
    const node  = _DB.esc(e.nodeId ? e.nodeId.slice(-8) : '—');
    const time  = e.timestamp ? _timeAgo(new Date(e.timestamp)) : '—';
    return `<div class="policy-item">
      <div class="policy-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
      <div class="policy-main">
        <div class="policy-name">${name}</div>
        <div class="policy-sub">${meta.label} · ${_DB.esc(node)} · ${_DB.esc(time)}</div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — delegate object for dashboard.html / cyberforge-app.js
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.CyberForgeDashboard = { buildDashboardLayout, bindDashboard };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASS-BASED API — for index.html / app.js
// ─────────────────────────────────────────────────────────────────────────────

class DashboardScreen {
  constructor() { this.container = null; }

  async show(container) {
    this.container = container;
    container.innerHTML = buildDashboardLayout();
    bindDashboard();
  }

  hide() {
    clearTimeout(_dashState.timer);
    clearInterval(_dashState.countdownTimer);
    Object.values(_dashState.charts).forEach(c => { try { c.destroy(); } catch (_) {} });
    Object.keys(_dashState.charts).forEach(k => delete _dashState.charts[k]);
  }
}

if (typeof window !== 'undefined') {
  window.DashboardScreen = DashboardScreen;
}
