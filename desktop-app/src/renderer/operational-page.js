/**
 * CyberForge — Operational Page Layouts
 * Provides buildOperationalPage / bindOperationalPage / getSidebarScreenMeta
 * for all sidebar screens not handled by the main renderScreen switch.
 */

window.CyberForgeOperational = (() => {
  const API_BASE = () =>
    localStorage.getItem('cyberforge_backend_url') ||
    'https://cyberforge-ddd97655464f.herokuapp.com';

  const token = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {})
  });

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function apiFetch(path) {
    try {
      const r = await fetch(`${API_BASE()}${path}`, { headers: headers() });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // META
  // ─────────────────────────────────────────────────────────────────────────

  const META = {
    'signal-pipeline':       { title: 'Signal Pipeline',       section: 'Intelligence', description: 'Real-time signal ingestion and feature extraction' },
    'pipeline-ingest':       { title: 'Ingest',                section: 'Signal Pipeline', description: 'Raw signal intake from endpoints and sensors' },
    'pipeline-normalize':    { title: 'Normalize',             section: 'Signal Pipeline', description: 'Signal normalisation and deduplication' },
    'pipeline-analyze':      { title: 'Analyze',               section: 'Signal Pipeline', description: 'Feature extraction and ML enrichment' },
    'pipeline-reason':       { title: 'Reason',                section: 'Signal Pipeline', description: 'Autonomous reasoning and verdict generation' },
    'agent-center':          { title: 'Agent Center',          section: 'Agents', description: 'Central control for all AI agents' },
    'alerts':                { title: 'Alerts',                section: 'Response', description: 'Active threat alerts across all nodes' },
    'alerts-critical':       { title: 'Critical Alerts',       section: 'Alerts', description: 'P0 threats requiring immediate action' },
    'alerts-high':           { title: 'High Alerts',           section: 'Alerts', description: 'P1 threats under investigation' },
    'alerts-evidence':       { title: 'Alert Evidence',        section: 'Alerts', description: 'Supporting evidence for active alerts' },
    'investigations':        { title: 'Investigations',        section: 'Response', description: 'Open and closed investigations' },
    'investigations-active': { title: 'Active Investigations', section: 'Investigations', description: 'Ongoing threat investigations' },
    'investigations-closed': { title: 'Closed Investigations', section: 'Investigations', description: 'Resolved and archived investigations' },
    'incident-timeline':     { title: 'Incident Timeline',     section: 'Response', description: 'Chronological event timeline' },
    'timeline-today':        { title: "Today's Events",        section: 'Timeline', description: 'Events from the past 24 hours' },
    'timeline-week':         { title: 'This Week',             section: 'Timeline', description: 'Events from the past 7 days' },
    'timeline-all':          { title: 'All Events',            section: 'Timeline', description: 'Complete event history' },
    'datadog-metrics':       { title: 'Metrics',               section: 'Observability', description: 'System and agent performance metrics' },
    'metrics-agent':         { title: 'Agent Metrics',         section: 'Metrics', description: 'Per-agent performance statistics' },
    'metrics-system':        { title: 'System Metrics',        section: 'Metrics', description: 'Host and process resource usage' },
    'errors':                { title: 'Error Log',             section: 'Observability', description: 'System and API errors' },
    'latency':               { title: 'Latency',               section: 'Observability', description: 'Request and processing latency statistics' },
    'privacy':               { title: 'Privacy',               section: 'Settings', description: 'Data privacy controls' },
    'privacy-mode':          { title: 'Privacy Mode',          section: 'Privacy', description: 'Toggle stealth and local-only operation' },
    'privacy-data':          { title: 'Data Control',          section: 'Privacy', description: 'Manage what data is stored and shared' },
    'system-logs':           { title: 'System Logs',           section: 'Settings', description: 'Audit trail and system event log' },
    'logs-agent':            { title: 'Agent Logs',            section: 'System Logs', description: 'Logs from AI agent activity' },
    'logs-system':           { title: 'System Logs',           section: 'System Logs', description: 'OS and application event logs' },
    'logs-export':           { title: 'Export Logs',           section: 'System Logs', description: 'Download and export log archives' },
    'settings-general':      { title: 'General Settings',      section: 'Settings', description: 'Application preferences' },
    'settings-agent':        { title: 'Agent Config',          section: 'Settings', description: 'AI agent configuration and tuning' },
    'settings-network':      { title: 'Network Settings',      section: 'Settings', description: 'Proxy, DNS, and connectivity options' },
  };

  function getSidebarScreenMeta(s) {
    return META[s] || { title: s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), section: '', description: '' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED COMPONENTS
  // ─────────────────────────────────────────────────────────────────────────

  function pageHeader(screen) {
    const m = getSidebarScreenMeta(screen);
    return `
      <div style="padding:20px 24px 0;border-bottom:1px solid var(--cf-border);margin-bottom:20px">
        ${m.section ? `<div style="font-size:11px;color:var(--cf-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${esc(m.section)}</div>` : ''}
        <h2 style="margin:0 0 4px;font-size:20px;font-weight:600;color:var(--cf-text)">${esc(m.title)}</h2>
        ${m.description ? `<p style="margin:0 0 16px;font-size:13px;color:var(--cf-text-muted)">${esc(m.description)}</p>` : ''}
      </div>`;
  }

  function loadingRow() {
    return `<div style="padding:40px;text-align:center;color:var(--cf-text-muted)"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>`;
  }

  function emptyRow(msg) {
    return `<div style="padding:40px;text-align:center;color:var(--cf-text-muted)">${msg}</div>`;
  }

  function kpiCard(icon, label, value, sub = '') {
    return `
      <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px 20px;min-width:140px">
        <div style="display:flex;align-items:center;gap:8px;color:var(--cf-text-muted);font-size:12px;margin-bottom:8px">
          <i class="fas ${esc(icon)}"></i> ${esc(label)}
        </div>
        <div style="font-size:24px;font-weight:700;color:var(--cf-text)">${esc(String(value))}</div>
        ${sub ? `<div style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">${esc(sub)}</div>` : ''}
      </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNAL PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  function buildSignalPipelineLayout(screen) {
    const stages = [
      { id: 'ingest',    icon: 'fa-satellite-dish', label: 'Ingest',    desc: 'Endpoint telemetry, network flows, and sensor feeds' },
      { id: 'normalize', icon: 'fa-sliders-h',      label: 'Normalize', desc: 'Schema normalisation, dedup, and timestamp alignment' },
      { id: 'analyze',   icon: 'fa-brain',          label: 'Analyze',   desc: 'ML feature extraction and threat scoring' },
      { id: 'reason',    icon: 'fa-project-diagram',label: 'Reason',    desc: 'Graph reasoning and autonomous verdict generation' },
    ];
    const active = screen.replace('pipeline-', '');
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div style="display:flex;gap:0;margin-bottom:28px;background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:10px;overflow:hidden">
          ${stages.map((s, i) => `
            <div style="flex:1;padding:18px 16px;${active === s.id ? 'background:var(--cf-primary-alpha);border-bottom:2px solid var(--cf-primary)' : ''}${i < stages.length - 1 ? 'border-right:1px solid var(--cf-border)' : ''}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <i class="fas ${esc(s.icon)}" style="color:${active === s.id ? 'var(--cf-primary)' : 'var(--cf-text-muted)'}"></i>
                <span style="font-weight:600;font-size:13px;color:var(--cf-text)">${esc(s.label)}</span>
                ${active === s.id ? '<span style="margin-left:auto;font-size:10px;background:var(--cf-primary);color:#fff;padding:1px 7px;border-radius:10px">ACTIVE</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--cf-text-muted)">${esc(s.desc)}</div>
            </div>`).join('')}
        </div>
        <div id="pipeline-kpis" style="display:flex;gap:12px;margin-bottom:24px">${loadingRow()}</div>
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:12px">Recent Pipeline Events</div>
          <div id="pipeline-events">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindSignalPipeline() {
    const kpisEl = document.getElementById('pipeline-kpis');
    const eventsEl = document.getElementById('pipeline-events');
    if (!kpisEl) return;

    const [stats, aiStatus] = await Promise.all([
      apiFetch('/api/threats/stats'),
      apiFetch('/api/ai/monitoring/status')
    ]);

    const s = stats?.data || stats || {};
    const a = aiStatus?.data || aiStatus || {};
    kpisEl.innerHTML = [
      kpiCard('fa-database', 'Signals Today', s.totalThreats ?? '—'),
      kpiCard('fa-check-circle', 'Processed', s.resolvedThreats ?? '—'),
      kpiCard('fa-robot', 'AI Status', a.status ?? 'Unknown'),
      kpiCard('fa-clock', 'Avg Latency', a.avgLatency ? `${a.avgLatency}ms` : '—'),
    ].join('');

    const threats = await apiFetch('/api/threats?limit=8');
    const list = threats?.data?.threats || threats?.threats || [];
    if (!eventsEl) return;
    if (!list.length) { eventsEl.innerHTML = emptyRow('No recent pipeline events'); return; }
    eventsEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="color:var(--cf-text-muted)">
        <th style="text-align:left;padding:6px 8px;font-weight:500">Time</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Source</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Type</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Severity</th>
      </tr></thead>
      <tbody>${list.map(t => `
        <tr style="border-top:1px solid var(--cf-border)">
          <td style="padding:6px 8px;color:var(--cf-text-muted)">${esc(t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '—')}</td>
          <td style="padding:6px 8px">${esc(t.source || t.ipAddress || '—')}</td>
          <td style="padding:6px 8px">${esc(t.type || t.threatType || '—')}</td>
          <td style="padding:6px 8px"><span style="color:${t.severity === 'critical' ? 'var(--cf-danger)' : t.severity === 'high' ? 'var(--cf-warning)' : 'var(--cf-text-muted)'}">${esc(t.severity || '—')}</span></td>
        </tr>`).join('')}</tbody></table>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AGENT CENTER
  // ─────────────────────────────────────────────────────────────────────────

  function buildAgentCenterLayout() {
    return `
      ${pageHeader('agent-center')}
      <div style="padding:0 24px 24px">
        <div id="agent-center-kpis" style="display:flex;gap:12px;margin-bottom:24px">${loadingRow()}</div>
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:12px">Agent Fleet</div>
          <div id="agent-center-list">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindAgentCenter() {
    const kpisEl = document.getElementById('agent-center-kpis');
    const listEl = document.getElementById('agent-center-list');
    if (!kpisEl) return;

    const [agentList, agentAlerts] = await Promise.all([
      apiFetch('/api/agent/list'),
      apiFetch('/api/agent/alerts?limit=5')
    ]);

    const agents = agentList?.data?.agents || agentList?.agents || [];
    const alerts = agentAlerts?.data?.data?.alerts || agentAlerts?.data?.alerts || [];
    const online = agents.filter(a => a.status === 'running' || a.status === 'active').length;

    kpisEl.innerHTML = [
      kpiCard('fa-robot', 'Total Agents', agents.length),
      kpiCard('fa-circle', 'Online', online, 'active'),
      kpiCard('fa-bell', 'Recent Alerts', alerts.length),
    ].join('');

    if (!listEl) return;
    if (!agents.length) { listEl.innerHTML = emptyRow('No agents registered'); return; }
    listEl.innerHTML = agents.map(a => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--cf-border)">
        <span style="width:8px;height:8px;border-radius:50%;background:${a.status === 'running' || a.status === 'active' ? 'var(--cf-success)' : 'var(--cf-text-muted)'};flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${esc(a.name || a.agentName || 'Agent')}</span>
        <span style="font-size:11px;color:var(--cf-text-muted)">${esc(a.status || 'unknown')}</span>
        <button onclick="window.CyberForgeOperational._toggleAgent(${JSON.stringify(esc(a.name || a.agentName || ''))},'${a.status === 'running' || a.status === 'active' ? 'stop' : 'start'}')"
          style="font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid var(--cf-border);background:transparent;color:var(--cf-text);cursor:pointer">
          ${a.status === 'running' || a.status === 'active' ? 'Stop' : 'Start'}
        </button>
      </div>`).join('');
  }

  async function _toggleAgent(name, action) {
    await apiFetch(`/api/agent/${action}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ALERTS
  // ─────────────────────────────────────────────────────────────────────────

  const SEVERITY_FILTER = { alerts: null, 'alerts-critical': 'critical', 'alerts-high': 'high', 'alerts-evidence': null };

  function buildAlertsLayout(screen) {
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div id="alerts-kpis" style="display:flex;gap:12px;margin-bottom:24px">${loadingRow()}</div>
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div id="alerts-table">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindAlerts(screen) {
    const kpisEl = document.getElementById('alerts-kpis');
    const tableEl = document.getElementById('alerts-table');
    if (!kpisEl) return;

    const stats = await apiFetch('/api/threats/stats');
    const s = stats?.data || stats || {};
    kpisEl.innerHTML = [
      kpiCard('fa-exclamation-triangle', 'Critical', s.criticalThreats ?? '—', 'P0'),
      kpiCard('fa-exclamation-circle', 'High', s.highThreats ?? '—', 'P1'),
      kpiCard('fa-info-circle', 'Medium', s.mediumThreats ?? '—', 'P2'),
      kpiCard('fa-check-circle', 'Resolved', s.resolvedThreats ?? '—'),
    ].join('');

    const sev = SEVERITY_FILTER[screen];
    const path = sev ? `/api/threats?severity=${sev}&limit=20` : '/api/threats?limit=20';
    const data = await apiFetch(path);
    const threats = data?.data?.threats || data?.threats || [];

    if (!tableEl) return;
    if (!threats.length) { tableEl.innerHTML = emptyRow('No alerts found'); return; }
    tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="color:var(--cf-text-muted)">
        <th style="text-align:left;padding:6px 8px;font-weight:500">Severity</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Type</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Source</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Status</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Time</th>
      </tr></thead>
      <tbody>${threats.map(t => `
        <tr style="border-top:1px solid var(--cf-border)">
          <td style="padding:6px 8px"><span style="color:${t.severity === 'critical' ? 'var(--cf-danger)' : t.severity === 'high' ? 'var(--cf-warning)' : 'var(--cf-success)'};font-weight:600">${esc(t.severity || '—')}</span></td>
          <td style="padding:6px 8px">${esc(t.type || t.threatType || '—')}</td>
          <td style="padding:6px 8px;font-family:monospace;font-size:11px">${esc(t.source || t.ipAddress || '—')}</td>
          <td style="padding:6px 8px">${esc(t.status || '—')}</td>
          <td style="padding:6px 8px;color:var(--cf-text-muted)">${esc(t.createdAt ? new Date(t.createdAt).toLocaleString() : '—')}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INVESTIGATIONS
  // ─────────────────────────────────────────────────────────────────────────

  function buildInvestigationsLayout(screen) {
    const statusFilter = screen === 'investigations-active' ? 'open' : screen === 'investigations-closed' ? 'resolved' : null;
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:12px">Investigations</div>
          <div id="investigations-list" data-filter="${esc(statusFilter || '')}">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindInvestigations() {
    const listEl = document.getElementById('investigations-list');
    if (!listEl) return;
    const filter = listEl.dataset.filter;
    const path = filter ? `/api/threats?status=${filter}&limit=20` : '/api/threats?limit=20';
    const data = await apiFetch(path);
    const items = data?.data?.threats || data?.threats || [];
    if (!items.length) { listEl.innerHTML = emptyRow('No investigations found'); return; }
    listEl.innerHTML = items.map(t => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--cf-border);align-items:flex-start">
        <span style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${t.status === 'resolved' ? 'var(--cf-success)' : 'var(--cf-warning)'}"></span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${esc(t.type || t.threatType || 'Unknown Threat')}</div>
          <div style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">${esc(t.source || t.description || '—')} · ${esc(t.severity || '—')} severity</div>
        </div>
        <span style="font-size:11px;color:var(--cf-text-muted)">${esc(t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—')}</span>
      </div>`).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INCIDENT TIMELINE
  // ─────────────────────────────────────────────────────────────────────────

  function buildTimelineLayout(screen) {
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div id="timeline-events">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindTimeline(screen) {
    const el = document.getElementById('timeline-events');
    if (!el) return;
    const since = screen === 'timeline-today'
      ? new Date(Date.now() - 86400000).toISOString()
      : screen === 'timeline-week'
        ? new Date(Date.now() - 7 * 86400000).toISOString()
        : null;
    const path = since ? `/api/audit/logs?since=${encodeURIComponent(since)}&limit=30` : '/api/audit/logs?limit=30';
    const data = await apiFetch(path);
    const events = data?.data?.logs || data?.logs || [];
    if (!events.length) { el.innerHTML = emptyRow('No events in this time range'); return; }
    el.innerHTML = `<div style="position:relative;padding-left:20px">
      <div style="position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--cf-border)"></div>
      ${events.map(e => `
        <div style="position:relative;margin-bottom:16px">
          <div style="position:absolute;left:-17px;top:4px;width:8px;height:8px;border-radius:50%;background:var(--cf-primary);border:2px solid var(--cf-bg)"></div>
          <div style="font-size:11px;color:var(--cf-text-muted);margin-bottom:2px">${esc(e.timestamp ? new Date(e.timestamp).toLocaleString() : '—')}</div>
          <div style="font-size:13px;font-weight:500">${esc(e.action || '—')}</div>
          <div style="font-size:11px;color:var(--cf-text-muted)">${esc(e.resource || '')} ${e.outcome ? `· ${e.outcome}` : ''}</div>
        </div>`).join('')}
    </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS
  // ─────────────────────────────────────────────────────────────────────────

  function buildMetricsLayout(screen) {
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div id="metrics-kpis" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px">${loadingRow()}</div>
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:12px">Node Statistics</div>
          <div id="metrics-nodes">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindMetrics(screen) {
    const kpisEl = document.getElementById('metrics-kpis');
    const nodesEl = document.getElementById('metrics-nodes');
    if (!kpisEl) return;

    const [global, stats] = await Promise.all([
      apiFetch('/api/distributed/metrics/global'),
      apiFetch('/api/distributed/metrics/stats')
    ]);

    const g = global?.data || global || {};
    const st = stats?.data || stats || {};
    kpisEl.innerHTML = [
      kpiCard('fa-server', 'Active Nodes', g.activeNodes ?? st.totalNodes ?? '—'),
      kpiCard('fa-shield-alt', 'Avg Risk Score', g.avgRiskScore != null ? g.avgRiskScore.toFixed(1) : '—'),
      kpiCard('fa-exchange-alt', 'Correlations', g.totalCorrelations ?? '—'),
      kpiCard('fa-tachometer-alt', 'Threat Rate', g.threatRate != null ? `${g.threatRate}/h` : '—'),
    ].join('');

    if (!nodesEl) return;
    const nodes = await apiFetch('/api/distributed/nodes/all');
    const nodeList = nodes?.data?.nodes || nodes?.nodes || [];
    if (!nodeList.length) { nodesEl.innerHTML = emptyRow('No nodes registered'); return; }
    nodesEl.innerHTML = nodeList.slice(0, 12).map(n => `
      <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--cf-border);align-items:center">
        <span style="width:8px;height:8px;border-radius:50%;background:${n.status === 'active' ? 'var(--cf-success)' : 'var(--cf-text-muted)'}"></span>
        <span style="flex:1;font-size:12px;font-family:monospace">${esc(n.nodeId || n.id || '—')}</span>
        <span style="font-size:11px;color:var(--cf-text-muted)">${esc(n.region || n.location || '—')}</span>
        <span style="font-size:11px;color:${n.riskScore > 70 ? 'var(--cf-danger)' : 'var(--cf-text-muted)'}">Risk: ${n.riskScore != null ? n.riskScore.toFixed(0) : '—'}</span>
      </div>`).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERRORS
  // ─────────────────────────────────────────────────────────────────────────

  function buildErrorsLayout() {
    return `
      ${pageHeader('errors')}
      <div style="padding:0 24px 24px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div id="errors-list">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindErrors() {
    const el = document.getElementById('errors-list');
    if (!el) return;
    const data = await apiFetch('/api/audit/logs?outcome=failure&limit=30');
    const logs = data?.data?.logs || data?.logs || [];
    if (!logs.length) { el.innerHTML = emptyRow('No errors recorded'); return; }
    el.innerHTML = logs.map(e => `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--cf-border);align-items:flex-start">
        <i class="fas fa-times-circle" style="color:var(--cf-danger);margin-top:2px;flex-shrink:0"></i>
        <div style="flex:1">
          <div style="font-size:13px">${esc(e.action || '—')}</div>
          <div style="font-size:11px;color:var(--cf-text-muted)">${esc(e.resource || '')} ${e.details ? `· ${JSON.stringify(e.details).slice(0, 60)}` : ''}</div>
        </div>
        <span style="font-size:11px;color:var(--cf-text-muted);white-space:nowrap">${esc(e.timestamp ? new Date(e.timestamp).toLocaleString() : '—')}</span>
      </div>`).join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LATENCY
  // ─────────────────────────────────────────────────────────────────────────

  function buildLatencyLayout() {
    return `
      ${pageHeader('latency')}
      <div style="padding:0 24px 24px">
        <div id="latency-kpis" style="display:flex;gap:12px;margin-bottom:24px">${loadingRow()}</div>
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:12px">Endpoint Latency</div>
          <div id="latency-table">${loadingRow()}</div>
        </div>
      </div>`;
  }

  async function bindLatency() {
    const kpisEl = document.getElementById('latency-kpis');
    const tableEl = document.getElementById('latency-table');
    if (!kpisEl) return;

    const health = await apiFetch('/api/distributed/health');
    const h = health?.data || health || {};
    kpisEl.innerHTML = [
      kpiCard('fa-clock', 'Backend RTT', h.latency ? `${h.latency}ms` : '—'),
      kpiCard('fa-server', 'Status', h.status || '—'),
      kpiCard('fa-heartbeat', 'Uptime', h.uptime ? `${Math.round(h.uptime / 60)}m` : '—'),
    ].join('');

    if (!tableEl) return;
    const endpoints = [
      { name: 'Threats API', path: '/api/threats/stats' },
      { name: 'AI Service',  path: '/api/ai/ml-health' },
      { name: 'Distributed', path: '/api/distributed/health' },
      { name: 'Policy',      path: '/api/policy/stats' },
    ];
    const results = await Promise.all(endpoints.map(async e => {
      const t0 = performance.now();
      await apiFetch(e.path);
      return { name: e.name, ms: Math.round(performance.now() - t0) };
    }));
    tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="color:var(--cf-text-muted)">
        <th style="text-align:left;padding:6px 8px;font-weight:500">Endpoint</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Latency</th>
        <th style="text-align:left;padding:6px 8px;font-weight:500">Status</th>
      </tr></thead>
      <tbody>${results.map(r => `
        <tr style="border-top:1px solid var(--cf-border)">
          <td style="padding:6px 8px">${esc(r.name)}</td>
          <td style="padding:6px 8px;color:${r.ms > 1000 ? 'var(--cf-danger)' : r.ms > 400 ? 'var(--cf-warning)' : 'var(--cf-success)'}">${r.ms}ms</td>
          <td style="padding:6px 8px"><span style="color:${r.ms < 9000 ? 'var(--cf-success)' : 'var(--cf-danger)'}">●</span></td>
        </tr>`).join('')}</tbody></table>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYSTEM LOGS
  // ─────────────────────────────────────────────────────────────────────────

  function buildSystemLogsLayout(screen) {
    const sub = { 'logs-agent': 'agent', 'logs-system': 'system', 'logs-export': null };
    const category = sub[screen] || null;
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        ${screen === 'logs-export' ? buildLogsExport() : `
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:16px">
          <div id="syslogs-table" data-cat="${esc(category || '')}">${loadingRow()}</div>
        </div>`}
      </div>`;
  }

  function buildLogsExport() {
    return `
      <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:24px;max-width:480px">
        <h3 style="margin:0 0 16px;font-size:15px">Export Audit Log</h3>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--cf-text-muted);display:block;margin-bottom:4px">Since</label>
          <input type="date" id="export-since" style="width:100%;padding:6px 10px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:4px;color:var(--cf-text);font-size:13px">
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;color:var(--cf-text-muted);display:block;margin-bottom:4px">Limit</label>
          <input type="number" id="export-limit" value="500" style="width:100%;padding:6px 10px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:4px;color:var(--cf-text);font-size:13px">
        </div>
        <button id="export-logs-btn" style="padding:8px 20px;background:var(--cf-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
          <i class="fas fa-download"></i> Download JSON
        </button>
      </div>`;
  }

  async function bindSystemLogs(screen) {
    if (screen === 'logs-export') {
      const btn = document.getElementById('export-logs-btn');
      if (btn) btn.addEventListener('click', async () => {
        const since = document.getElementById('export-since')?.value;
        const limit = document.getElementById('export-limit')?.value || 500;
        const path = `/api/audit/logs?limit=${limit}${since ? `&since=${encodeURIComponent(new Date(since).toISOString())}` : ''}`;
        const data = await apiFetch(path);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `cyberforge-audit-${Date.now()}.json`; a.click();
      });
      return;
    }
    const tableEl = document.getElementById('syslogs-table');
    if (!tableEl) return;
    const cat = tableEl.dataset.cat;
    const path = cat ? `/api/audit/logs?limit=30&action=${cat}` : '/api/audit/logs?limit=30';
    const data = await apiFetch(path);
    const logs = data?.data?.logs || data?.logs || [];
    if (!logs.length) { tableEl.innerHTML = emptyRow('No log entries found'); return; }
    tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace">
      <thead><tr style="color:var(--cf-text-muted)">
        <th style="text-align:left;padding:5px 8px;font-weight:500;font-family:inherit">Time</th>
        <th style="text-align:left;padding:5px 8px;font-weight:500;font-family:inherit">Action</th>
        <th style="text-align:left;padding:5px 8px;font-weight:500;font-family:inherit">Resource</th>
        <th style="text-align:left;padding:5px 8px;font-weight:500;font-family:inherit">Outcome</th>
      </tr></thead>
      <tbody>${logs.map(e => `
        <tr style="border-top:1px solid var(--cf-border)">
          <td style="padding:5px 8px;color:var(--cf-text-muted)">${esc(e.timestamp ? new Date(e.timestamp).toLocaleString() : '—')}</td>
          <td style="padding:5px 8px">${esc(e.action || '—')}</td>
          <td style="padding:5px 8px;color:var(--cf-text-muted)">${esc(e.resource || '—')}</td>
          <td style="padding:5px 8px;color:${e.outcome === 'failure' ? 'var(--cf-danger)' : 'var(--cf-success)'}">${esc(e.outcome || '—')}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVACY
  // ─────────────────────────────────────────────────────────────────────────

  function buildPrivacyLayout(screen) {
    if (screen === 'privacy-data') {
      return `
        ${pageHeader(screen)}
        <div style="padding:0 24px 24px;max-width:600px">
          <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:20px">
            <h3 style="margin:0 0 16px;font-size:14px">Data Retention Controls</h3>
            ${['Threat scan history', 'Agent decision log', 'Network capture data', 'Browser intelligence sessions'].map(item => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--cf-border)">
                <span style="font-size:13px">${esc(item)}</span>
                <select style="background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:4px;color:var(--cf-text);padding:4px 8px;font-size:12px">
                  <option>30 days</option><option>7 days</option><option>Never</option>
                </select>
              </div>`).join('')}
            <button style="margin-top:16px;padding:8px 20px;background:var(--cf-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Save Preferences</button>
          </div>
        </div>`;
    }
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px;max-width:600px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:20px">
          <h3 style="margin:0 0 16px;font-size:14px">Privacy Mode</h3>
          ${[
            { label: 'Local-only operation', desc: 'Disable all outbound telemetry and cloud sync', key: 'cf-privacy-local' },
            { label: 'Stealth mode', desc: 'Suppress visible indicators and notifications', key: 'cf-privacy-stealth' },
            { label: 'Anonymise logs', desc: 'Hash user IDs in all log output', key: 'cf-privacy-anon' },
          ].map(opt => `
            <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--cf-border)">
              <input type="checkbox" id="${esc(opt.key)}" ${localStorage.getItem(opt.key) === 'true' ? 'checked' : ''} style="margin-top:2px">
              <div>
                <label for="${esc(opt.key)}" style="font-size:13px;cursor:pointer">${esc(opt.label)}</label>
                <div style="font-size:11px;color:var(--cf-text-muted);margin-top:2px">${esc(opt.desc)}</div>
              </div>
            </div>`).join('')}
          <button id="save-privacy-btn" style="margin-top:16px;padding:8px 20px;background:var(--cf-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Save</button>
        </div>
      </div>`;
  }

  function bindPrivacy(screen) {
    const btn = document.getElementById('save-privacy-btn');
    if (btn) btn.addEventListener('click', () => {
      ['cf-privacy-local', 'cf-privacy-stealth', 'cf-privacy-anon'].forEach(k => {
        const el = document.getElementById(k);
        if (el) localStorage.setItem(k, String(el.checked));
      });
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save'; }, 2000);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS CHILD PAGES
  // ─────────────────────────────────────────────────────────────────────────

  function buildSettingsChildLayout(screen) {
    if (screen === 'settings-network') {
      return `
        ${pageHeader(screen)}
        <div style="padding:0 24px 24px;max-width:560px">
          <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:20px">
            ${[
              { label: 'Backend URL', key: 'cyberforge_backend_url', placeholder: 'https://…', type: 'url' },
              { label: 'WebSocket URL', key: 'cyberforge_ws_url', placeholder: 'wss://…', type: 'url' },
              { label: 'HTTP Proxy', key: 'cyberforge_proxy', placeholder: 'http://proxy:8080', type: 'url' },
            ].map(f => `
              <div style="margin-bottom:14px">
                <label style="font-size:12px;color:var(--cf-text-muted);display:block;margin-bottom:4px">${esc(f.label)}</label>
                <input type="${esc(f.type)}" id="net-${esc(f.key)}" value="${esc(localStorage.getItem(f.key) || '')}" placeholder="${esc(f.placeholder)}"
                  style="width:100%;padding:7px 10px;background:var(--cf-bg);border:1px solid var(--cf-border);border-radius:4px;color:var(--cf-text);font-size:13px;box-sizing:border-box">
              </div>`).join('')}
            <button id="save-network-btn" style="padding:8px 20px;background:var(--cf-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Save</button>
          </div>
        </div>`;
    }
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:20px;max-width:560px;color:var(--cf-text-muted);font-size:13px">
          Settings for <strong>${esc(getSidebarScreenMeta(screen).title)}</strong> are managed in the main Settings screen.
        </div>
      </div>`;
  }

  function bindSettingsChild(screen) {
    const btn = document.getElementById('save-network-btn');
    if (btn) btn.addEventListener('click', () => {
      ['cyberforge_backend_url', 'cyberforge_ws_url', 'cyberforge_proxy'].forEach(k => {
        const v = document.getElementById(`net-${k}`)?.value?.trim();
        if (v) localStorage.setItem(k, v); else localStorage.removeItem(k);
      });
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save'; }, 2000);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  function buildOperationalPage(screen) {
    if (!screen) return '';

    if (screen === 'signal-pipeline' || screen.startsWith('pipeline-'))
      return buildSignalPipelineLayout(screen);
    if (screen === 'agent-center')
      return buildAgentCenterLayout();
    if (screen === 'alerts' || screen.startsWith('alerts-'))
      return buildAlertsLayout(screen);
    if (screen === 'investigations' || screen.startsWith('investigations-'))
      return buildInvestigationsLayout(screen);
    if (screen === 'incident-timeline' || screen.startsWith('timeline-'))
      return buildTimelineLayout(screen);
    if (screen === 'datadog-metrics' || screen.startsWith('metrics-'))
      return buildMetricsLayout(screen);
    if (screen === 'errors')
      return buildErrorsLayout();
    if (screen === 'latency')
      return buildLatencyLayout();
    if (screen === 'system-logs' || screen.startsWith('logs-'))
      return buildSystemLogsLayout(screen);
    if (screen === 'privacy' || screen.startsWith('privacy-'))
      return buildPrivacyLayout(screen);
    if (screen.startsWith('settings-'))
      return buildSettingsChildLayout(screen);

    // Generic fallback for any other unhandled screen
    const m = getSidebarScreenMeta(screen);
    return `
      ${pageHeader(screen)}
      <div style="padding:0 24px 24px">
        <div style="background:var(--cf-surface-2);border:1px solid var(--cf-border);border-radius:8px;padding:40px;text-align:center;color:var(--cf-text-muted)">
          <i class="fas fa-tools" style="font-size:32px;margin-bottom:12px;display:block;opacity:.4"></i>
          <div style="font-size:14px;font-weight:500;margin-bottom:6px">${esc(m.title)}</div>
          <div style="font-size:12px">This screen is under development.</div>
        </div>
      </div>`;
  }

  function bindOperationalPage(screen) {
    if (!screen) return;
    if (screen === 'signal-pipeline' || screen.startsWith('pipeline-')) { bindSignalPipeline(); return; }
    if (screen === 'agent-center') { bindAgentCenter(); return; }
    if (screen === 'alerts' || screen.startsWith('alerts-')) { bindAlerts(screen); return; }
    if (screen === 'investigations' || screen.startsWith('investigations-')) { bindInvestigations(); return; }
    if (screen === 'incident-timeline' || screen.startsWith('timeline-')) { bindTimeline(screen); return; }
    if (screen === 'datadog-metrics' || screen.startsWith('metrics-')) { bindMetrics(screen); return; }
    if (screen === 'errors') { bindErrors(); return; }
    if (screen === 'latency') { bindLatency(); return; }
    if (screen === 'system-logs' || screen.startsWith('logs-')) { bindSystemLogs(screen); return; }
    if (screen === 'privacy' || screen.startsWith('privacy-')) { bindPrivacy(screen); return; }
    if (screen.startsWith('settings-')) { bindSettingsChild(screen); return; }
  }

  return { buildOperationalPage, bindOperationalPage, getSidebarScreenMeta, _toggleAgent };
})();
