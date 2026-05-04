/**
 * BehavioralAnalysisScreen
 * CyberForge — SPA screen class
 * Tokens only: no hardcoded colours. XSS-safe via _esc().
 */

class BehavioralAnalysisScreen {
  constructor() {
    this._container = null;
    this._analysisPanel = null;
    this._tableBody = null;
    this._data = [];
    this._detailsVisible = false;
  }

  // ---------------------------------------------------------------------------
  // XSS helper
  // ---------------------------------------------------------------------------
  _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Static fallback data
  // ---------------------------------------------------------------------------
  _staticData() {
    return [
      { entity: 'jdoe@corp.com',     type: 'Off-hours Login',       score: 92, severity: 'critical', firstSeen: '2026-04-30 02:14', status: 'Active' },
      { entity: 'WORKSTATION-042',   type: 'Lateral Movement',      score: 87, severity: 'high',     firstSeen: '2026-04-30 09:31', status: 'Investigating' },
      { entity: 'svc_backup',        type: 'Privilege Escalation',  score: 78, severity: 'high',     firstSeen: '2026-04-29 18:05', status: 'Investigating' },
      { entity: 'msmith@corp.com',   type: 'Data Exfiltration',     score: 65, severity: 'warning',  firstSeen: '2026-04-29 14:22', status: 'Active' },
      { entity: 'FILESERVER-01',     type: 'Anomalous Access Rate', score: 54, severity: 'warning',  firstSeen: '2026-04-29 11:40', status: 'Resolved' },
      { entity: 'api_gateway',       type: 'Unexpected Protocol',   score: 44, severity: 'info',     firstSeen: '2026-04-28 08:17', status: 'Resolved' },
      { entity: 'rjones@corp.com',   type: 'Geo-velocity Anomaly',  score: 71, severity: 'high',     firstSeen: '2026-04-30 06:58', status: 'Active' },
      { entity: 'DESKTOP-115',       type: 'DNS Tunnelling',        score: 83, severity: 'critical', firstSeen: '2026-04-30 07:42', status: 'Investigating' },
    ];
  }

  // ---------------------------------------------------------------------------
  // Hourly bar data (last 24 h, pseudo-random but deterministic per hour)
  // ---------------------------------------------------------------------------
  _hourlyData() {
    const seed = [3, 1, 0, 2, 1, 0, 5, 8, 14, 18, 22, 19, 17, 21, 16, 13, 11, 14, 19, 23, 17, 12, 8, 5];
    const now = new Date();
    const currentHour = now.getHours();
    return seed.map((count, i) => ({
      hour: ((currentHour - 23 + i + 24) % 24),
      count,
    }));
  }

  // ---------------------------------------------------------------------------
  // Fetch from backend, fall back to static
  // ---------------------------------------------------------------------------
  async _fetchData() {
    try {
      const res = await fetch('http://localhost:3001/api/threats?type=behavioral&limit=20');
      if (!res.ok) throw new Error('non-2xx');
      const json = await res.json();
      const threats = Array.isArray(json) ? json : (json.data || json.threats || []);
      if (!threats.length) return this._staticData();
      return threats.map(t => ({
        entity:    t.source || t.entity || t.host || 'Unknown',
        type:      t.type   || t.anomalyType || 'Behavioral Anomaly',
        score:     Math.min(100, Math.max(0, parseInt(t.score || t.severity_score || 50, 10))),
        severity:  this._mapSeverity(t.severity),
        firstSeen: t.timestamp || t.firstSeen || t.created_at || '—',
        status:    t.status || 'Active',
      }));
    } catch (_) {
      return this._staticData();
    }
  }

  _mapSeverity(s) {
    const v = String(s || '').toLowerCase();
    if (v === 'critical') return 'critical';
    if (v === 'high')     return 'high';
    if (v === 'medium' || v === 'warning') return 'warning';
    return 'info';
  }

  _severityBadgeClass(severity) {
    const map = { critical: 'error', high: 'error', warning: 'warning', info: 'info' };
    return map[severity] || 'info';
  }

  _statusStyle(status) {
    const s = String(status).toLowerCase();
    if (s === 'active')        return 'error';
    if (s === 'investigating') return 'warning';
    if (s === 'resolved')      return 'success';
    return 'info';
  }

  // ---------------------------------------------------------------------------
  // Stats computation
  // ---------------------------------------------------------------------------
  _stats(data) {
    const anomalies   = data.length;
    const deviations  = data.filter(d => d.score >= 70).length;
    const users       = new Set(data.map(d => d.entity)).size;
    const eventsPerSec = Math.floor(Math.random() * 900) + 200; // simulated
    return { anomalies, deviations, users, eventsPerSec };
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  _renderStats(stats) {
    const items = [
      { label: 'Anomalies Detected',  value: stats.anomalies,   icon: '⚠' },
      { label: 'Baseline Deviations', value: stats.deviations,  icon: '📊' },
      { label: 'Users Monitored',     value: stats.users,       icon: '👤' },
      { label: 'Events / sec',        value: stats.eventsPerSec, icon: '⚡' },
    ];
    return `
      <div class="ba-stats-row">
        ${items.map(it => `
          <div class="ba-stat-card cf-card">
            <div class="ba-stat-icon">${it.icon}</div>
            <div class="ba-stat-value">${this._esc(String(it.value))}</div>
            <div class="ba-stat-label">${this._esc(it.label)}</div>
          </div>
        `).join('')}
      </div>`;
  }

  _renderTimeline() {
    const hourly  = this._hourlyData();
    const maxVal  = Math.max(...hourly.map(h => h.count), 1);
    const bars    = hourly.map(h => {
      const pct     = Math.round((h.count / maxVal) * 100);
      const opacity = 0.3 + (pct / 100) * 0.7;
      const label   = String(h.hour).padStart(2, '0') + ':00';
      return `
        <div class="ba-bar-wrap" title="${this._esc(label)}: ${this._esc(String(h.count))} anomalies">
          <div class="ba-bar" style="height:${pct}%;opacity:${opacity.toFixed(2)}"></div>
          <div class="ba-bar-label">${this._esc(String(h.hour).padStart(2,'0'))}</div>
        </div>`;
    }).join('');

    return `
      <div class="cf-card ba-timeline-card">
        <div class="cf-card-header">
          <h3 class="cf-card-title">Anomaly Timeline — Last 24 Hours</h3>
        </div>
        <div class="cf-card-body">
          <div class="ba-chart">${bars}</div>
          <div class="ba-chart-legend">
            <span class="ba-legend-dot"></span>
            <span style="font-size:var(--cf-text-xs);color:var(--cf-text-muted)">Anomaly Events per Hour</span>
          </div>
        </div>
      </div>`;
  }

  _renderTable(data) {
    const rows = data.map((row, idx) => {
      const badgeClass  = this._severityBadgeClass(row.severity);
      const statusClass = this._statusStyle(row.status);
      const barWidth    = Math.min(100, row.score);
      return `
        <tr class="ba-row" data-idx="${idx}">
          <td class="ba-cell">
            <span class="ba-entity-name">${this._esc(row.entity)}</span>
          </td>
          <td class="ba-cell">${this._esc(row.type)}</td>
          <td class="ba-cell">
            <div class="ba-score-wrap">
              <div class="ba-score-bar">
                <div class="ba-score-fill" style="width:${barWidth}%"></div>
              </div>
              <span class="ba-score-val">${this._esc(String(row.score))}%</span>
            </div>
          </td>
          <td class="ba-cell">
            <span class="cf-badge ${this._esc(badgeClass)}">${this._esc(row.severity.toUpperCase())}</span>
          </td>
          <td class="ba-cell ba-mono">${this._esc(row.firstSeen)}</td>
          <td class="ba-cell">
            <span class="cf-badge ${this._esc(statusClass)}">${this._esc(row.status)}</span>
          </td>
          <td class="ba-cell">
            <button class="cf-btn sm ba-analyze-btn" data-idx="${idx}">Analyze Pattern</button>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="cf-card">
        <div class="cf-card-header">
          <h3 class="cf-card-title">Anomaly Events</h3>
          <span class="cf-badge info">${data.length} Events</span>
        </div>
        <div class="cf-card-body ba-table-body">
          <table class="ba-table">
            <thead>
              <tr>
                <th class="ba-th">Entity</th>
                <th class="ba-th">Anomaly Type</th>
                <th class="ba-th">Deviation Score</th>
                <th class="ba-th">Severity</th>
                <th class="ba-th">First Seen</th>
                <th class="ba-th">Status</th>
                <th class="ba-th">Action</th>
              </tr>
            </thead>
            <tbody id="ba-tbody">${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  _renderDetailsPanel() {
    return `
      <div class="cf-card ba-details-panel" id="ba-details-panel" style="display:none">
        <div class="cf-card-header">
          <h3 class="cf-card-title" id="ba-details-title">Pattern Analysis</h3>
          <button class="cf-btn sm" id="ba-details-close">Close</button>
        </div>
        <div class="cf-card-body">
          <div id="ba-details-content" class="ba-details-content">
            <div class="cf-loading"><div class="cf-spinner"></div></div>
          </div>
        </div>
      </div>`;
  }

  _buildHTML(data) {
    const stats = this._stats(data);
    return `
      <style>
        /* ── BehavioralAnalysisScreen local styles ── */
        .ba-stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: var(--cf-space-4);
          margin-bottom: var(--cf-space-6);
        }
        .ba-stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--cf-space-5);
          text-align: center;
          gap: var(--cf-space-2);
        }
        .ba-stat-icon { font-size: var(--cf-text-2xl); }
        .ba-stat-value {
          font-size: var(--cf-text-2xl);
          font-weight: var(--cf-weight-bold);
          color: var(--cf-interactive-default);
          font-family: var(--cf-font-mono);
        }
        .ba-stat-label {
          font-size: var(--cf-text-xs);
          color: var(--cf-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Timeline */
        .ba-timeline-card { margin-bottom: var(--cf-space-6); }
        .ba-chart {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 120px;
          padding: var(--cf-space-3) 0;
          border-bottom: 1px solid var(--cf-border-light);
        }
        .ba-bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          gap: 4px;
          cursor: default;
        }
        .ba-bar {
          width: 100%;
          background: var(--cf-interactive-default);
          border-radius: var(--cf-radius-sm) var(--cf-radius-sm) 0 0;
          min-height: 3px;
          transition: opacity 0.2s;
        }
        .ba-bar-wrap:hover .ba-bar { opacity: 1 !important; }
        .ba-bar-label {
          font-size: 9px;
          color: var(--cf-text-muted);
          font-family: var(--cf-font-mono);
        }
        .ba-chart-legend {
          display: flex;
          align-items: center;
          gap: var(--cf-space-2);
          margin-top: var(--cf-space-2);
        }
        .ba-legend-dot {
          width: 10px; height: 10px;
          border-radius: var(--cf-radius-full);
          background: var(--cf-interactive-default);
          opacity: 0.8;
          display: inline-block;
        }

        /* Table */
        .ba-table-body { overflow-x: auto; padding: 0; }
        .ba-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--cf-text-sm);
        }
        .ba-th {
          text-align: left;
          padding: var(--cf-space-3) var(--cf-space-4);
          background: var(--cf-table-header-bg);
          color: var(--cf-text-secondary);
          font-size: var(--cf-text-xs);
          font-weight: var(--cf-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--cf-table-border);
          white-space: nowrap;
        }
        .ba-row { border-bottom: 1px solid var(--cf-border-light); }
        .ba-row:hover { background: var(--cf-table-row-hover); }
        .ba-cell {
          padding: var(--cf-space-3) var(--cf-space-4);
          color: var(--cf-text-primary);
          vertical-align: middle;
        }
        .ba-entity-name {
          font-weight: var(--cf-weight-medium);
          font-family: var(--cf-font-mono);
          font-size: var(--cf-text-xs);
        }
        .ba-mono { font-family: var(--cf-font-mono); font-size: var(--cf-text-xs); }

        /* Score bar */
        .ba-score-wrap { display: flex; align-items: center; gap: var(--cf-space-2); min-width: 110px; }
        .ba-score-bar {
          flex: 1;
          height: 6px;
          background: var(--cf-surface-2);
          border-radius: var(--cf-radius-full);
          overflow: hidden;
        }
        .ba-score-fill {
          height: 100%;
          background: var(--cf-interactive-default);
          border-radius: var(--cf-radius-full);
          transition: width 0.4s ease;
        }
        .ba-score-val {
          font-size: var(--cf-text-xs);
          font-family: var(--cf-font-mono);
          color: var(--cf-text-secondary);
          white-space: nowrap;
        }

        /* Details panel */
        .ba-details-panel { margin-top: var(--cf-space-6); }
        .ba-details-content {
          font-size: var(--cf-text-sm);
          color: var(--cf-text-primary);
          line-height: 1.7;
          white-space: pre-wrap;
          font-family: var(--cf-font-primary);
        }
        .ba-details-content .ba-result-text {
          padding: var(--cf-space-4);
          background: var(--cf-surface-1);
          border-radius: var(--cf-radius-md);
          border: 1px solid var(--cf-border-light);
        }
        .ba-error-msg {
          color: var(--cf-status-error);
          background: var(--cf-status-error-bg);
          padding: var(--cf-space-3) var(--cf-space-4);
          border-radius: var(--cf-radius-md);
          font-size: var(--cf-text-sm);
        }
      </style>

      <div class="screen-header">
        <div>
          <h1 class="screen-title">Behavioral Analysis</h1>
          <p class="screen-subtitle">User and entity behavior analytics — anomaly detection and pattern investigation</p>
        </div>
        <div class="screen-actions">
          <button class="cf-btn sm" id="ba-refresh-btn">Refresh</button>
        </div>
      </div>

      ${this._renderStats(stats)}
      ${this._renderTimeline()}
      ${this._renderTable(data)}
      ${this._renderDetailsPanel()}
    `;
  }

  // ---------------------------------------------------------------------------
  // Analyze a row via ML endpoint
  // ---------------------------------------------------------------------------
  async _analyzePattern(idx) {
    const row    = this._data[idx];
    if (!row) return;
    const panel  = this._container.querySelector('#ba-details-panel');
    const title  = this._container.querySelector('#ba-details-title');
    const content = this._container.querySelector('#ba-details-content');

    title.textContent = `Pattern Analysis — ${row.entity}`;
    content.innerHTML = '<div class="cf-loading"><div class="cf-spinner"></div></div>';
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const res = await fetch('http://localhost:8001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:   'behavioral analysis of entity ' + row.entity,
          context: 'behavioral',
        }),
      });
      if (!res.ok) throw new Error(`ML service returned ${res.status}`);
      const json = await res.json();
      const text = json.result || json.analysis || json.response || JSON.stringify(json, null, 2);
      content.innerHTML = `<div class="ba-result-text">${this._esc(text)}</div>`;
    } catch (err) {
      content.innerHTML = `<div class="ba-error-msg">Analysis unavailable: ${this._esc(err.message)}</div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  _bindEvents() {
    // Analyze buttons
    this._container.addEventListener('click', e => {
      const btn = e.target.closest('.ba-analyze-btn');
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10);
        this._analyzePattern(idx);
        return;
      }
      if (e.target.id === 'ba-details-close') {
        const panel = this._container.querySelector('#ba-details-panel');
        if (panel) panel.style.display = 'none';
        return;
      }
      if (e.target.id === 'ba-refresh-btn') {
        this._reload();
      }
    });
  }

  async _reload() {
    if (!this._container) return;
    this._data = await this._fetchData();
    this._container.innerHTML = this._buildHTML(this._data);
    this._bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  async show(container) {
    this._container = container;
    container.innerHTML = '<div class="cf-loading"><div class="cf-spinner"></div></div>';
    this._data = await this._fetchData();
    container.innerHTML = this._buildHTML(this._data);
    this._bindEvents();
  }

  hide() {
    this._container = null;
  }
}

window.BehavioralAnalysisScreen = BehavioralAnalysisScreen;
