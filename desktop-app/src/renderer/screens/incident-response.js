/**
 * Incident Response Screen
 * Incident list from backend, timeline panel, status workflow, create incident via ML service
 */

class IncidentResponseScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.incidents = [];
        this.activeIncident = null;
        this._activeFilter = 'all';
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadIncidents();
    }

    hide() {
        this.isActive = false;
    }

    _shell() {
        return `
<style>
.ir-root {
    display: flex;
    flex-direction: column;
    gap: var(--cf-space-6);
    padding: var(--cf-space-6);
    height: 100%;
    overflow-y: auto;
    font-family: var(--cf-font-primary);
    box-sizing: border-box;
}
.ir-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: var(--cf-space-4);
}
.ir-stat-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    padding: var(--cf-space-4) var(--cf-space-5);
    display: flex;
    align-items: center;
    gap: var(--cf-space-3);
    box-shadow: var(--cf-shadow-sm);
}
.ir-stat-icon {
    width: 36px; height: 36px;
    border-radius: var(--cf-radius-lg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: var(--cf-text-md);
}
.ir-stat-icon.red    { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.ir-stat-icon.amber  { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.ir-stat-icon.blue   { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.ir-stat-icon.green  { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.ir-stat-icon.accent { background: var(--cf-interactive-subtle); color: var(--cf-interactive-default); }
.ir-stat-val { font-size: var(--cf-text-xl); font-weight: var(--cf-weight-bold); color: var(--cf-text-primary); line-height: 1; }
.ir-stat-lbl { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }
.ir-layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--cf-space-6);
    align-items: start;
}
@media (max-width: 960px) { .ir-layout { grid-template-columns: 1fr; } }
.ir-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    box-shadow: var(--cf-shadow-sm);
    overflow: hidden;
}
.ir-card-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--cf-space-4) var(--cf-space-5);
    border-bottom: 1px solid var(--cf-border-light);
    background: var(--cf-card-header-bg);
    flex-wrap: wrap;
    gap: var(--cf-space-2);
}
.ir-card-title {
    display: flex;
    align-items: center;
    gap: var(--cf-space-2);
    font-size: var(--cf-text-md);
    font-weight: var(--cf-weight-semibold);
    color: var(--cf-text-primary);
}
.ir-card-title i { color: var(--cf-interactive-default); }
.ir-card-body { padding: var(--cf-space-5); }

/* Filter tabs */
.ir-filter-row {
    display: flex;
    gap: var(--cf-space-1);
    flex-wrap: wrap;
}
.ir-filter-btn {
    padding: var(--cf-space-1) var(--cf-space-3);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-full);
    background: transparent;
    color: var(--cf-text-secondary);
    font-size: var(--cf-text-xs);
    font-weight: var(--cf-weight-medium);
    cursor: pointer;
    transition: all var(--cf-transition-fast);
}
.ir-filter-btn.active,
.ir-filter-btn:hover {
    background: var(--cf-interactive-default);
    color: var(--cf-text-inverse);
    border-color: var(--cf-interactive-default);
}

/* Buttons */
.ir-btn {
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
.ir-btn.primary   { background: var(--cf-interactive-default); color: var(--cf-text-inverse); }
.ir-btn.primary:hover { background: var(--cf-interactive-hover); }
.ir-btn.danger    { background: var(--cf-status-error-bg); color: var(--cf-status-error); border: 1px solid var(--cf-status-error); }
.ir-btn.danger:hover { background: var(--cf-status-error); color: var(--cf-text-inverse); }
.ir-btn.success   { background: var(--cf-status-success-bg); color: var(--cf-status-success); border: 1px solid var(--cf-status-success); }
.ir-btn.success:hover { background: var(--cf-status-success); color: var(--cf-text-inverse); }
.ir-btn.secondary { background: var(--cf-surface-2); color: var(--cf-text-secondary); border: 1px solid var(--cf-border-light); }
.ir-btn.secondary:hover { background: var(--cf-surface-3); }
.ir-btn.sm { padding: var(--cf-space-1) var(--cf-space-2); font-size: var(--cf-text-xs); }

/* Incident list */
.ir-incident-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
.ir-incident-row {
    display: flex;
    align-items: flex-start;
    gap: var(--cf-space-3);
    padding: var(--cf-space-3) var(--cf-space-4);
    background: var(--cf-surface-1);
    border: 1px solid var(--cf-border-light);
    border-left: 3px solid var(--cf-border-medium);
    border-radius: var(--cf-radius-lg);
    cursor: pointer;
    transition: all var(--cf-transition-fast);
}
.ir-incident-row:hover { background: var(--cf-table-row-hover); border-left-color: var(--cf-interactive-default); }
.ir-incident-row.selected { border-left-color: var(--cf-interactive-default); background: var(--cf-interactive-subtle); }
.ir-incident-row.critical { border-left-color: var(--cf-status-error); }
.ir-incident-row.high     { border-left-color: var(--cf-status-warning); }
.ir-incident-row.medium   { border-left-color: var(--cf-status-info); }
.ir-incident-row.low      { border-left-color: var(--cf-status-success); }
.ir-incident-body { flex: 1; min-width: 0; }
.ir-incident-meta {
    display: flex; align-items: center; gap: var(--cf-space-2);
    margin-top: var(--cf-space-1); flex-wrap: wrap;
}
.ir-incident-id   { font-family: var(--cf-font-mono); font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
.ir-incident-time { font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
.ir-incident-title { font-size: var(--cf-text-sm); font-weight: var(--cf-weight-medium); color: var(--cf-text-primary); margin-bottom: var(--cf-space-1); }
.ir-incident-desc  { font-size: var(--cf-text-xs); color: var(--cf-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; }
.ir-status-actions { display: flex; gap: var(--cf-space-1); flex-direction: column; align-items: flex-end; }

/* Badge */
.ir-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--cf-space-2);
    border-radius: var(--cf-radius-full);
    font-size: var(--cf-text-2xs);
    font-weight: var(--cf-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--cf-tracking-wider);
    white-space: nowrap;
}
.ir-badge.critical     { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.ir-badge.high         { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.ir-badge.medium       { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.ir-badge.low          { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.ir-badge.active       { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.ir-badge.investigating{ background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.ir-badge.contained    { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.ir-badge.resolved     { background: var(--cf-status-success-bg); color: var(--cf-status-success); }

/* Right panel */
.ir-detail-placeholder {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--cf-space-10) var(--cf-space-6); gap: var(--cf-space-3); color: var(--cf-text-muted);
}
.ir-detail-placeholder i { font-size: 2rem; color: var(--cf-border-medium); }
.ir-detail-placeholder p  { font-size: var(--cf-text-sm); }

.ir-detail-section { margin-bottom: var(--cf-space-5); }
.ir-detail-section-title {
    font-size: var(--cf-text-xs);
    font-weight: var(--cf-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--cf-tracking-wider);
    color: var(--cf-text-muted);
    margin-bottom: var(--cf-space-2);
}
.ir-detail-kv { display: flex; justify-content: space-between; font-size: var(--cf-text-xs); padding: var(--cf-space-1) 0; border-bottom: 1px solid var(--cf-border-light); }
.ir-detail-kv:last-child { border-bottom: none; }
.ir-detail-kv .k { color: var(--cf-text-muted); }
.ir-detail-kv .v { color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); text-align: right; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ir-systems { display: flex; flex-wrap: wrap; gap: var(--cf-space-1); }
.ir-system-tag {
    padding: 2px var(--cf-space-2);
    background: var(--cf-interactive-subtle);
    color: var(--cf-interactive-default);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-md);
    font-size: var(--cf-text-xs);
    font-family: var(--cf-font-mono);
}

/* Timeline */
.ir-timeline { display: flex; flex-direction: column; gap: 0; }
.ir-tl-item {
    display: flex;
    gap: var(--cf-space-3);
    padding-bottom: var(--cf-space-4);
    position: relative;
}
.ir-tl-item:last-child { padding-bottom: 0; }
.ir-tl-marker-col { display: flex; flex-direction: column; align-items: center; width: 24px; flex-shrink: 0; }
.ir-tl-dot {
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px;
    flex-shrink: 0;
    z-index: 1;
}
.ir-tl-dot.completed  { background: var(--cf-status-success-bg); color: var(--cf-status-success); border: 2px solid var(--cf-status-success); }
.ir-tl-dot.in-progress { background: var(--cf-status-info-bg);   color: var(--cf-status-info);   border: 2px solid var(--cf-status-info); }
.ir-tl-dot.pending    { background: var(--cf-surface-2);          color: var(--cf-text-muted);    border: 2px solid var(--cf-border-medium); }
.ir-tl-line { flex: 1; width: 2px; background: var(--cf-border-light); min-height: var(--cf-space-4); }
.ir-tl-item:last-child .ir-tl-line { display: none; }
.ir-tl-content { flex: 1; padding-top: 2px; }
.ir-tl-action { font-size: var(--cf-text-sm); color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); }
.ir-tl-time   { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }

/* Create form */
.ir-form-row { margin-bottom: var(--cf-space-4); }
.ir-form-label { font-size: var(--cf-text-xs); font-weight: var(--cf-weight-semibold); color: var(--cf-text-secondary); display: block; margin-bottom: var(--cf-space-1-5); text-transform: uppercase; letter-spacing: var(--cf-tracking-wide); }
.ir-input, .ir-select, .ir-textarea {
    width: 100%;
    padding: var(--cf-space-2) var(--cf-space-3);
    background: var(--cf-input-bg);
    border: 1px solid var(--cf-input-border);
    border-radius: var(--cf-radius-md);
    font-size: var(--cf-text-sm);
    font-family: var(--cf-font-primary);
    color: var(--cf-text-primary);
    outline: none;
    box-sizing: border-box;
    transition: border-color var(--cf-transition-fast), box-shadow var(--cf-transition-fast);
}
.ir-input:focus, .ir-select:focus, .ir-textarea:focus {
    border-color: var(--cf-interactive-default);
    box-shadow: 0 0 0 3px var(--cf-interactive-focus);
}
.ir-input::placeholder, .ir-textarea::placeholder { color: var(--cf-text-muted); }
.ir-textarea { resize: vertical; min-height: 80px; }
.ir-select { cursor: pointer; }

/* Modal overlay */
.ir-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: var(--cf-z-modal-backdrop);
    display: flex; align-items: center; justify-content: center;
    padding: var(--cf-space-6);
}
.ir-modal {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    box-shadow: var(--cf-shadow-2xl);
    width: 100%; max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
}
.ir-modal-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--cf-space-5);
    border-bottom: 1px solid var(--cf-border-light);
}
.ir-modal-title { font-size: var(--cf-text-lg); font-weight: var(--cf-weight-semibold); color: var(--cf-text-primary); }
.ir-modal-body { padding: var(--cf-space-5); }
.ir-modal-footer {
    display: flex; gap: var(--cf-space-2); justify-content: flex-end;
    padding: var(--cf-space-4) var(--cf-space-5);
    border-top: 1px solid var(--cf-border-light);
}
.ir-close-btn {
    width: 28px; height: 28px; border: none; background: var(--cf-surface-2);
    border-radius: var(--cf-radius-md); cursor: pointer; color: var(--cf-text-muted);
    display: flex; align-items: center; justify-content: center;
    transition: background var(--cf-transition-fast);
}
.ir-close-btn:hover { background: var(--cf-surface-3); }

.ir-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--cf-space-10) var(--cf-space-6); gap: var(--cf-space-3); color: var(--cf-text-muted);
}
.ir-empty i { font-size: 2rem; color: var(--cf-border-medium); }
.ir-empty p { font-size: var(--cf-text-sm); }
.ir-loading {
    display: flex; align-items: center; justify-content: center;
    gap: var(--cf-space-2); padding: var(--cf-space-8);
    color: var(--cf-text-muted); font-size: var(--cf-text-sm);
}
.ir-spinner { width:18px;height:18px;border:2px solid var(--cf-border-medium);border-top-color:var(--cf-interactive-default);border-radius:50%;animation:ir-spin 0.7s linear infinite; }
@keyframes ir-spin { to { transform: rotate(360deg); } }
</style>
<div class="ir-root">

  <!-- Header -->
  <div class="screen-header">
    <div>
      <h2 class="screen-title"><i class="fas fa-shield-exclamation"></i> Incident Response</h2>
      <p class="screen-subtitle">Manage and coordinate security incidents. Track status workflow from detection to resolution.</p>
    </div>
    <div class="screen-actions">
      <button class="ir-btn primary" onclick="window._irScreen.showCreateModal()">
        <i class="fas fa-plus"></i> New Incident
      </button>
    </div>
  </div>

  <!-- Stats -->
  <div class="ir-stat-grid">
    <div class="ir-stat-card">
      <div class="ir-stat-icon accent"><i class="fas fa-clipboard-list"></i></div>
      <div><div class="ir-stat-val" id="ir-stat-total">0</div><div class="ir-stat-lbl">Total Incidents</div></div>
    </div>
    <div class="ir-stat-card">
      <div class="ir-stat-icon red"><i class="fas fa-exclamation-circle"></i></div>
      <div><div class="ir-stat-val" id="ir-stat-active">0</div><div class="ir-stat-lbl">Active</div></div>
    </div>
    <div class="ir-stat-card">
      <div class="ir-stat-icon amber"><i class="fas fa-search"></i></div>
      <div><div class="ir-stat-val" id="ir-stat-investigating">0</div><div class="ir-stat-lbl">Investigating</div></div>
    </div>
    <div class="ir-stat-card">
      <div class="ir-stat-icon blue"><i class="fas fa-lock"></i></div>
      <div><div class="ir-stat-val" id="ir-stat-contained">0</div><div class="ir-stat-lbl">Contained</div></div>
    </div>
    <div class="ir-stat-card">
      <div class="ir-stat-icon green"><i class="fas fa-check-circle"></i></div>
      <div><div class="ir-stat-val" id="ir-stat-resolved">0</div><div class="ir-stat-lbl">Resolved</div></div>
    </div>
  </div>

  <!-- Main Layout -->
  <div class="ir-layout">

    <!-- Incident List -->
    <div class="ir-card">
      <div class="ir-card-hd">
        <span class="ir-card-title"><i class="fas fa-list"></i> Incidents</span>
        <div class="ir-filter-row" id="ir-filter-row">
          <button class="ir-filter-btn active" data-filter="all">All</button>
          <button class="ir-filter-btn" data-filter="active">Active</button>
          <button class="ir-filter-btn" data-filter="investigating">Investigating</button>
          <button class="ir-filter-btn" data-filter="contained">Contained</button>
          <button class="ir-filter-btn" data-filter="resolved">Resolved</button>
        </div>
      </div>
      <div class="ir-card-body" id="ir-incident-list-body">
        <div class="ir-loading"><div class="ir-spinner"></div> Loading incidents…</div>
      </div>
    </div>

    <!-- Detail + Timeline Panel -->
    <div style="display:flex;flex-direction:column;gap:var(--cf-space-5);">

      <!-- Incident Detail -->
      <div class="ir-card">
        <div class="ir-card-hd">
          <span class="ir-card-title"><i class="fas fa-info-circle"></i> Incident Detail</span>
        </div>
        <div id="ir-detail-panel" class="ir-card-body">
          <div class="ir-detail-placeholder">
            <i class="fas fa-clipboard-list"></i>
            <p>Select an incident to view details.</p>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="ir-card">
        <div class="ir-card-hd">
          <span class="ir-card-title"><i class="fas fa-history"></i> Response Timeline</span>
        </div>
        <div id="ir-timeline-panel" class="ir-card-body">
          <div class="ir-detail-placeholder">
            <i class="fas fa-history"></i>
            <p>Select an incident to view timeline.</p>
          </div>
        </div>
      </div>

    </div>
  </div>

</div>
`;
    }

    _bind() {
        window._irScreen = this;

        // Filter buttons
        const filterRow = document.getElementById('ir-filter-row');
        if (filterRow) {
            filterRow.querySelectorAll('.ir-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    filterRow.querySelectorAll('.ir-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this._activeFilter = btn.dataset.filter;
                    this._renderList();
                });
            });
        }
    }

    async _loadIncidents() {
        try {
            const res = await fetch('http://localhost:3001/api/threats?status=active&severity=high&limit=20', {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const threats = json?.data?.threats || json?.threats || [];
            if (threats.length) {
                this.incidents = threats.map((t, i) => ({
                    id:             t.id || `INC-${String(i + 1).padStart(3,'0')}`,
                    title:          t.name || t.title || 'Security Incident',
                    severity:       t.severity || 'medium',
                    status:         t.status === 'active' ? 'active' : (t.status || 'active'),
                    assignee:       t.assignee || 'Security Team',
                    description:    t.description || 'Security incident detected and under investigation.',
                    affectedSystems: t.affectedSystems || t.affected_systems || ['SYS-01'],
                    created:        t.createdAt ? new Date(t.createdAt) : new Date(Date.now() - Math.random() * 86400000 * 3),
                    updated:        t.updatedAt ? new Date(t.updatedAt) : new Date(),
                    timeline: [
                        { time: new Date(Date.now() - 120 * 60000).toLocaleTimeString(), action: 'Incident detected', status: 'completed' },
                        { time: new Date(Date.now() - 100 * 60000).toLocaleTimeString(), action: 'Alert triggered', status: 'completed' },
                        { time: new Date(Date.now() -  60 * 60000).toLocaleTimeString(), action: 'Team notified', status: 'completed' },
                        { time: new Date(Date.now() -  30 * 60000).toLocaleTimeString(), action: 'Investigation started', status: 'in-progress' },
                    ],
                }));
                this._renderList();
                this._updateStats();
                return;
            }
        } catch (_) { /* fall through */ }

        // Fallback incidents
        this.incidents = [
            {
                id: 'INC-001', title: 'Data Breach — Customer Database', severity: 'critical',
                status: 'active', assignee: 'Security Team Alpha',
                description: 'Unauthorized access detected to the customer database server. PII data may be at risk.',
                affectedSystems: ['DB-PROD-01', 'WEB-APP-02'],
                created: new Date(Date.now() - 240 * 60000), updated: new Date(Date.now() - 30 * 60000),
                timeline: [
                    { time: '10:30', action: 'Incident detected by IDS', status: 'completed' },
                    { time: '10:35', action: 'Security team notified', status: 'completed' },
                    { time: '10:45', action: 'Systems isolated', status: 'completed' },
                    { time: '11:00', action: 'Forensic analysis started', status: 'in-progress' },
                    { time: '11:30', action: 'Executive notification pending', status: 'pending' },
                ],
            },
            {
                id: 'INC-002', title: 'Malware on Executive Workstation', severity: 'high',
                status: 'investigating', assignee: 'SOC Analyst 1',
                description: 'Advanced persistent threat detected on executive workstation. Possible lateral movement.',
                affectedSystems: ['WS-EXEC-03'],
                created: new Date(Date.now() - 180 * 60000), updated: new Date(Date.now() - 60 * 60000),
                timeline: [
                    { time: '12:15', action: 'Malware detected', status: 'completed' },
                    { time: '12:20', action: 'Workstation quarantined', status: 'completed' },
                    { time: '12:30', action: 'Malware analysis initiated', status: 'in-progress' },
                ],
            },
            {
                id: 'INC-003', title: 'Phishing Campaign — Email Gateway', severity: 'medium',
                status: 'contained', assignee: 'Email Security Team',
                description: 'Coordinated phishing campaign targeting employees via spoofed HR emails.',
                affectedSystems: ['EMAIL-GATEWAY'],
                created: new Date(Date.now() - 360 * 60000), updated: new Date(Date.now() - 120 * 60000),
                timeline: [
                    { time: '09:00', action: 'Phishing emails detected', status: 'completed' },
                    { time: '09:15', action: 'Email filters updated', status: 'completed' },
                    { time: '09:30', action: 'User awareness notice sent', status: 'completed' },
                ],
            },
            {
                id: 'INC-004', title: 'DDoS Attack — Web Services', severity: 'high',
                status: 'resolved', assignee: 'Network Team',
                description: 'Distributed denial-of-service attack against public web services. Mitigated via upstream filtering.',
                affectedSystems: ['WEB-LB-01', 'WEB-LB-02'],
                created: new Date(Date.now() - 720 * 60000), updated: new Date(Date.now() - 200 * 60000),
                timeline: [
                    { time: '06:00', action: 'Elevated traffic detected', status: 'completed' },
                    { time: '06:10', action: 'DDoS confirmed', status: 'completed' },
                    { time: '06:20', action: 'Upstream scrubbing enabled', status: 'completed' },
                    { time: '07:00', action: 'Services restored', status: 'completed' },
                ],
            },
        ];
        this._renderList();
        this._updateStats();
    }

    _renderList() {
        const body = document.getElementById('ir-incident-list-body');
        if (!body) return;

        const filtered = this._activeFilter === 'all'
            ? this.incidents
            : this.incidents.filter(i => i.status === this._activeFilter);

        if (!filtered.length) {
            body.innerHTML = `<div class="ir-empty"><i class="fas fa-clipboard-list"></i><p>No incidents in this category.</p></div>`;
            return;
        }

        body.innerHTML = `<div class="ir-incident-list">${filtered.map(inc => `
            <div class="ir-incident-row ${inc.severity} ${this.activeIncident?.id === inc.id ? 'selected' : ''}"
                 data-id="${this._esc(inc.id)}"
                 onclick="window._irScreen.selectIncident('${this._esc(inc.id)}')">
              <div class="ir-incident-body">
                <div class="ir-incident-title">${this._esc(inc.title)}</div>
                <div class="ir-incident-desc">${this._esc(inc.description)}</div>
                <div class="ir-incident-meta">
                  <span class="ir-incident-id">${this._esc(inc.id)}</span>
                  <span class="ir-badge ${inc.severity}">${inc.severity}</span>
                  <span class="ir-badge ${inc.status}">${inc.status}</span>
                  <span class="ir-incident-time">${inc.created.toLocaleTimeString()}</span>
                </div>
              </div>
              <div class="ir-status-actions">
                ${this._workflowNextBtn(inc)}
              </div>
            </div>
        `).join('')}</div>`;
    }

    _workflowNextBtn(inc) {
        const next = { active: 'investigating', investigating: 'contained', contained: 'resolved' };
        const label = { active: 'Investigate', investigating: 'Contain', contained: 'Resolve' };
        const cls   = { active: 'secondary', investigating: 'secondary', contained: 'success' };
        const nextStatus = next[inc.status];
        if (!nextStatus) return `<span class="ir-badge resolved">Resolved</span>`;
        return `<button class="ir-btn ${cls[inc.status] || 'secondary'} sm" onclick="event.stopPropagation();window._irScreen.advanceStatus('${this._esc(inc.id)}')">
            ${label[inc.status] || 'Advance'}
        </button>`;
    }

    selectIncident(id) {
        this.activeIncident = this.incidents.find(i => i.id === id) || null;
        if (!this.activeIncident) return;
        this._renderList();
        this._renderDetail();
        this._renderTimeline();
    }

    advanceStatus(id) {
        const inc = this.incidents.find(i => i.id === id);
        if (!inc) return;
        const next = { active: 'investigating', investigating: 'contained', contained: 'resolved' };
        const nextStatus = next[inc.status];
        if (!nextStatus) return;

        const actionLabel = {
            investigating: 'Investigation started',
            contained: 'Incident contained',
            resolved: 'Incident resolved',
        };

        inc.status = nextStatus;
        inc.updated = new Date();
        inc.timeline.push({
            time: new Date().toLocaleTimeString(),
            action: actionLabel[nextStatus] || `Status changed to ${nextStatus}`,
            status: 'completed',
        });

        this._renderList();
        this._updateStats();
        if (this.activeIncident?.id === id) {
            this._renderDetail();
            this._renderTimeline();
        }
    }

    _renderDetail() {
        const panel = document.getElementById('ir-detail-panel');
        if (!panel || !this.activeIncident) return;
        const inc = this.activeIncident;

        panel.innerHTML = `
            <div class="ir-detail-section">
              <div class="ir-detail-section-title">Overview</div>
              <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);margin-bottom:var(--cf-space-3);">${this._esc(inc.description)}</div>
              <div class="ir-detail-kv"><span class="k">ID</span><span class="v" style="font-family:var(--cf-font-mono);">${this._esc(inc.id)}</span></div>
              <div class="ir-detail-kv"><span class="k">Severity</span><span class="v"><span class="ir-badge ${inc.severity}">${inc.severity}</span></span></div>
              <div class="ir-detail-kv"><span class="k">Status</span><span class="v"><span class="ir-badge ${inc.status}">${inc.status}</span></span></div>
              <div class="ir-detail-kv"><span class="k">Assignee</span><span class="v">${this._esc(inc.assignee)}</span></div>
              <div class="ir-detail-kv"><span class="k">Created</span><span class="v">${inc.created.toLocaleString()}</span></div>
              <div class="ir-detail-kv"><span class="k">Updated</span><span class="v">${inc.updated.toLocaleString()}</span></div>
            </div>
            <div class="ir-detail-section">
              <div class="ir-detail-section-title">Affected Systems</div>
              <div class="ir-systems">
                ${inc.affectedSystems.map(s => `<span class="ir-system-tag">${this._esc(s)}</span>`).join('')}
              </div>
            </div>
            <div style="display:flex;gap:var(--cf-space-2);flex-wrap:wrap;margin-top:var(--cf-space-4);">
              ${this._workflowNextBtn(inc)}
              <button class="ir-btn danger sm" onclick="window._irScreen.escalate('${this._esc(inc.id)}')">
                <i class="fas fa-arrow-up"></i> Escalate
              </button>
            </div>`;
    }

    _renderTimeline() {
        const panel = document.getElementById('ir-timeline-panel');
        if (!panel || !this.activeIncident) return;
        const items = this.activeIncident.timeline || [];

        if (!items.length) {
            panel.innerHTML = `<div class="ir-empty"><i class="fas fa-history"></i><p>No timeline events.</p></div>`;
            return;
        }

        const iconMap = { completed: 'fa-check', 'in-progress': 'fa-spinner fa-spin', pending: 'fa-clock' };
        panel.innerHTML = `<div class="ir-timeline">${items.map(ev => `
            <div class="ir-tl-item">
              <div class="ir-tl-marker-col">
                <div class="ir-tl-dot ${ev.status.replace('-','').replace(' ','')}">
                  <i class="fas ${iconMap[ev.status] || 'fa-circle'}"></i>
                </div>
                <div class="ir-tl-line"></div>
              </div>
              <div class="ir-tl-content">
                <div class="ir-tl-action">${this._esc(ev.action)}</div>
                <div class="ir-tl-time">${this._esc(ev.time)}</div>
              </div>
            </div>
        `).join('')}</div>`;
    }

    _updateStats() {
        const counts = { total: this.incidents.length, active: 0, investigating: 0, contained: 0, resolved: 0 };
        this.incidents.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('ir-stat-total',         counts.total);
        set('ir-stat-active',        counts.active);
        set('ir-stat-investigating', counts.investigating);
        set('ir-stat-contained',     counts.contained);
        set('ir-stat-resolved',      counts.resolved);
    }

    showCreateModal() {
        const overlay = document.createElement('div');
        overlay.className = 'ir-modal-overlay';
        overlay.id = 'ir-modal-overlay';
        overlay.innerHTML = `
            <div class="ir-modal">
              <div class="ir-modal-hd">
                <span class="ir-modal-title"><i class="fas fa-plus-circle" style="color:var(--cf-interactive-default);margin-right:8px;"></i>Create New Incident</span>
                <button class="ir-close-btn" onclick="document.getElementById('ir-modal-overlay').remove()">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="ir-modal-body">
                <div class="ir-form-row">
                  <label class="ir-form-label">Title</label>
                  <input class="ir-input" id="ir-new-title" placeholder="Brief description of the incident" />
                </div>
                <div class="ir-form-row">
                  <label class="ir-form-label">Severity</label>
                  <select class="ir-select" id="ir-new-severity">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium" selected>Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div class="ir-form-row">
                  <label class="ir-form-label">Description</label>
                  <textarea class="ir-textarea" id="ir-new-desc" placeholder="Describe the incident in detail…"></textarea>
                </div>
                <div class="ir-form-row">
                  <label class="ir-form-label">Assignee</label>
                  <select class="ir-select" id="ir-new-assignee">
                    <option>Security Team Alpha</option>
                    <option>SOC Analyst 1</option>
                    <option>SOC Analyst 2</option>
                    <option>Incident Response Team</option>
                    <option>Network Team</option>
                  </select>
                </div>
                <div class="ir-form-row">
                  <label class="ir-form-label">Affected Systems (comma-separated)</label>
                  <input class="ir-input" id="ir-new-systems" placeholder="SYS-01, SYS-02" />
                </div>
              </div>
              <div class="ir-modal-footer">
                <button class="ir-btn secondary" onclick="document.getElementById('ir-modal-overlay').remove()">Cancel</button>
                <button class="ir-btn primary" onclick="window._irScreen.saveIncident()">
                  <i class="fas fa-save"></i> Create Incident
                </button>
              </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    async saveIncident() {
        const title    = document.getElementById('ir-new-title')?.value?.trim() || 'New Incident';
        const severity = document.getElementById('ir-new-severity')?.value || 'medium';
        const desc     = document.getElementById('ir-new-desc')?.value?.trim() || 'No description provided.';
        const assignee = document.getElementById('ir-new-assignee')?.value || 'Security Team';
        const systems  = (document.getElementById('ir-new-systems')?.value || '')
            .split(',').map(s => s.trim()).filter(Boolean);

        // Try ML service for incident analysis
        let mlInsight = null;
        try {
            const res = await fetch('http://localhost:8001/agent/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'incident_analysis', title, severity, description: desc }),
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) mlInsight = await res.json();
        } catch (_) { /* ML offline */ }

        const now = new Date();
        const newIncident = {
            id: `INC-${String(this.incidents.length + 1).padStart(3,'0')}`,
            title, severity, desc, assignee,
            status: 'active',
            description: desc,
            affectedSystems: systems.length ? systems : ['TBD'],
            created: now, updated: now,
            timeline: [
                { time: now.toLocaleTimeString(), action: 'Incident created', status: 'completed' },
                ...(mlInsight ? [{ time: now.toLocaleTimeString(), action: 'ML analysis submitted', status: 'completed' }] : []),
            ],
        };

        this.incidents.unshift(newIncident);
        document.getElementById('ir-modal-overlay')?.remove();
        this._renderList();
        this._updateStats();
        this.selectIncident(newIncident.id);
    }

    escalate(id) {
        const inc = this.incidents.find(i => i.id === id);
        if (!inc) return;
        inc.timeline.push({ time: new Date().toLocaleTimeString(), action: 'Escalated to management', status: 'completed' });
        if (this.activeIncident?.id === id) this._renderTimeline();
    }

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

window.IncidentResponseScreen = IncidentResponseScreen;
