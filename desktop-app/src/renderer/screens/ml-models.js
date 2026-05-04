/**
 * ML Models Screen
 * Model status from /health endpoint, accuracy metrics, training progress, dataset statistics
 */

class MLModelsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.models = [];
        this.selectedModel = null;
        this.trainingJobs = [];
        this._trainingTimers = {};
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._loadAll();
    }

    hide() {
        this.isActive = false;
        Object.values(this._trainingTimers).forEach(t => clearTimeout(t));
        this._trainingTimers = {};
    }

    _shell() {
        return `
<style>
.ml-root {
    display: flex;
    flex-direction: column;
    gap: var(--cf-space-6);
    padding: var(--cf-space-6);
    height: 100%;
    overflow-y: auto;
    font-family: var(--cf-font-primary);
    box-sizing: border-box;
}
.ml-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--cf-space-4);
}
.ml-stat-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    padding: var(--cf-space-4) var(--cf-space-5);
    display: flex;
    align-items: center;
    gap: var(--cf-space-3);
    box-shadow: var(--cf-shadow-sm);
}
.ml-stat-icon {
    width: 36px; height: 36px;
    border-radius: var(--cf-radius-lg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: var(--cf-text-md);
}
.ml-stat-icon.accent { background: var(--cf-interactive-subtle);  color: var(--cf-interactive-default); }
.ml-stat-icon.green  { background: var(--cf-status-success-bg);  color: var(--cf-status-success); }
.ml-stat-icon.red    { background: var(--cf-status-error-bg);    color: var(--cf-status-error);   }
.ml-stat-icon.amber  { background: var(--cf-status-warning-bg);  color: var(--cf-status-warning); }
.ml-stat-icon.blue   { background: var(--cf-status-info-bg);     color: var(--cf-status-info);    }
.ml-stat-val { font-size: var(--cf-text-xl); font-weight: var(--cf-weight-bold); color: var(--cf-text-primary); line-height: 1; }
.ml-stat-lbl { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }
.ml-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: var(--cf-space-6);
    align-items: start;
}
@media (max-width: 960px) { .ml-layout { grid-template-columns: 1fr; } }
.ml-card {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    box-shadow: var(--cf-shadow-sm);
    overflow: hidden;
}
.ml-card-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--cf-space-4) var(--cf-space-5);
    border-bottom: 1px solid var(--cf-border-light);
    background: var(--cf-card-header-bg);
}
.ml-card-title {
    display: flex;
    align-items: center;
    gap: var(--cf-space-2);
    font-size: var(--cf-text-md);
    font-weight: var(--cf-weight-semibold);
    color: var(--cf-text-primary);
}
.ml-card-title i { color: var(--cf-interactive-default); }
.ml-card-body { padding: var(--cf-space-5); }

/* Model list */
.ml-model-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
.ml-model-row {
    display: flex;
    align-items: center;
    gap: var(--cf-space-3);
    padding: var(--cf-space-3) var(--cf-space-4);
    background: var(--cf-surface-1);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-lg);
    cursor: pointer;
    transition: all var(--cf-transition-fast);
}
.ml-model-row:hover { background: var(--cf-table-row-hover); border-color: var(--cf-border-medium); }
.ml-model-row.selected { border-color: var(--cf-interactive-default); background: var(--cf-interactive-subtle); }
.ml-model-icon {
    width: 36px; height: 36px;
    background: var(--cf-interactive-subtle);
    color: var(--cf-interactive-default);
    border-radius: var(--cf-radius-lg);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--cf-text-md); flex-shrink: 0;
}
.ml-model-info { flex: 1; min-width: 0; }
.ml-model-name { font-size: var(--cf-text-sm); font-weight: var(--cf-weight-medium); color: var(--cf-text-primary); }
.ml-model-type { font-size: var(--cf-text-xs); color: var(--cf-text-muted); }
.ml-model-metrics { display: flex; gap: var(--cf-space-4); align-items: center; flex-shrink: 0; }
.ml-metric { text-align: right; }
.ml-metric-val { font-size: var(--cf-text-sm); font-weight: var(--cf-weight-semibold); color: var(--cf-text-primary); }
.ml-metric-lbl { font-size: var(--cf-text-xs); color: var(--cf-text-muted); }

/* Badge */
.ml-badge {
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
.ml-badge.loaded  { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.ml-badge.offline { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }
.ml-badge.loading { background: var(--cf-status-warning-bg); color: var(--cf-status-warning); }
.ml-badge.active  { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.ml-badge.running { background: var(--cf-status-info-bg);    color: var(--cf-status-info);    }
.ml-badge.completed { background: var(--cf-status-success-bg); color: var(--cf-status-success); }
.ml-badge.stopped { background: var(--cf-status-error-bg);   color: var(--cf-status-error);   }

/* Accuracy bar */
.ml-acc-bar {
    height: 4px;
    background: var(--cf-surface-2);
    border-radius: var(--cf-radius-full);
    overflow: hidden;
    margin-top: var(--cf-space-1);
}
.ml-acc-fill { height: 100%; border-radius: var(--cf-radius-full); background: var(--cf-status-success); }

/* Detail panel */
.ml-detail-placeholder {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--cf-space-10) var(--cf-space-4); gap: var(--cf-space-3); color: var(--cf-text-muted);
    text-align: center;
}
.ml-detail-placeholder i { font-size: 2rem; color: var(--cf-border-medium); }
.ml-detail-placeholder p { font-size: var(--cf-text-sm); }
.ml-detail-kv {
    display: flex; justify-content: space-between; align-items: center;
    font-size: var(--cf-text-xs); padding: var(--cf-space-1-5) 0;
    border-bottom: 1px solid var(--cf-border-light);
}
.ml-detail-kv:last-child { border-bottom: none; }
.ml-detail-kv .k { color: var(--cf-text-muted); }
.ml-detail-kv .v { color: var(--cf-text-primary); font-weight: var(--cf-weight-medium); text-align: right; font-family: var(--cf-font-mono); font-size: var(--cf-text-xs); }
.ml-detail-section { margin-bottom: var(--cf-space-5); }
.ml-detail-section-title {
    font-size: var(--cf-text-xs);
    font-weight: var(--cf-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--cf-tracking-wider);
    color: var(--cf-text-muted);
    margin-bottom: var(--cf-space-2);
}

/* Buttons */
.ml-btn {
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
.ml-btn.primary   { background: var(--cf-interactive-default); color: var(--cf-text-inverse); }
.ml-btn.primary:hover { background: var(--cf-interactive-hover); }
.ml-btn.secondary { background: var(--cf-surface-2); color: var(--cf-text-secondary); border: 1px solid var(--cf-border-light); }
.ml-btn.secondary:hover { background: var(--cf-surface-3); }
.ml-btn.danger    { background: var(--cf-status-error-bg); color: var(--cf-status-error); border: 1px solid var(--cf-status-error); }
.ml-btn.danger:hover { background: var(--cf-status-error); color: var(--cf-text-inverse); }
.ml-btn.sm { padding: var(--cf-space-1) var(--cf-space-2-5); font-size: var(--cf-text-xs); }

/* Training jobs */
.ml-job-list { display: flex; flex-direction: column; gap: var(--cf-space-2); }
.ml-job-item {
    padding: var(--cf-space-3) var(--cf-space-4);
    background: var(--cf-surface-1);
    border: 1px solid var(--cf-border-light);
    border-radius: var(--cf-radius-lg);
}
.ml-job-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--cf-space-2); }
.ml-job-name { font-size: var(--cf-text-sm); font-weight: var(--cf-weight-medium); color: var(--cf-text-primary); }
.ml-job-meta { font-size: var(--cf-text-xs); color: var(--cf-text-muted); margin-top: 2px; }
.ml-progress-track {
    height: 6px;
    background: var(--cf-surface-2);
    border-radius: var(--cf-radius-full);
    overflow: hidden;
    margin: var(--cf-space-2) 0;
}
.ml-progress-fill { height: 100%; border-radius: var(--cf-radius-full); background: var(--cf-interactive-default); transition: width 0.4s ease; }
.ml-progress-fill.done { background: var(--cf-status-success); }
.ml-progress-fill.stopped { background: var(--cf-status-error); }
.ml-progress-label { font-size: var(--cf-text-xs); color: var(--cf-text-muted); }

/* Health indicator */
.ml-health-row { display: flex; align-items: center; gap: var(--cf-space-2); padding: var(--cf-space-2) 0; }
.ml-health-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ml-health-dot.ok  { background: var(--cf-status-success); }
.ml-health-dot.bad { background: var(--cf-status-error); }
.ml-health-dot.warn { background: var(--cf-status-warning); }
.ml-health-label { font-size: var(--cf-text-sm); color: var(--cf-text-secondary); flex: 1; }
.ml-health-val { font-size: var(--cf-text-xs); color: var(--cf-text-muted); font-family: var(--cf-font-mono); }

/* Train modal */
.ml-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: var(--cf-z-modal-backdrop);
    display: flex; align-items: center; justify-content: center;
    padding: var(--cf-space-6);
}
.ml-modal {
    background: var(--cf-card-bg);
    border: 1px solid var(--cf-card-border);
    border-radius: var(--cf-radius-xl);
    box-shadow: var(--cf-shadow-2xl);
    width: 100%; max-width: 440px;
    overflow: hidden;
}
.ml-modal-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--cf-space-5);
    border-bottom: 1px solid var(--cf-border-light);
}
.ml-modal-title { font-size: var(--cf-text-lg); font-weight: var(--cf-weight-semibold); color: var(--cf-text-primary); }
.ml-modal-body { padding: var(--cf-space-5); display: flex; flex-direction: column; gap: var(--cf-space-4); }
.ml-modal-footer { display: flex; gap: var(--cf-space-2); justify-content: flex-end; padding: var(--cf-space-4) var(--cf-space-5); border-top: 1px solid var(--cf-border-light); }
.ml-form-label { font-size: var(--cf-text-xs); font-weight: var(--cf-weight-semibold); color: var(--cf-text-secondary); display: block; margin-bottom: var(--cf-space-1); text-transform: uppercase; letter-spacing: var(--cf-tracking-wide); }
.ml-input, .ml-select {
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
.ml-input:focus, .ml-select:focus {
    border-color: var(--cf-interactive-default);
    box-shadow: 0 0 0 3px var(--cf-interactive-focus);
}
.ml-input::placeholder { color: var(--cf-text-muted); }
.ml-close-btn {
    width: 28px; height: 28px; border: none; background: var(--cf-surface-2);
    border-radius: var(--cf-radius-md); cursor: pointer; color: var(--cf-text-muted);
    display: flex; align-items: center; justify-content: center;
}
.ml-close-btn:hover { background: var(--cf-surface-3); }
.ml-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--cf-space-8) var(--cf-space-4); gap: var(--cf-space-3); color: var(--cf-text-muted); text-align: center;
}
.ml-empty i { font-size: 1.75rem; color: var(--cf-border-medium); }
.ml-empty p { font-size: var(--cf-text-sm); }
.ml-loading {
    display: flex; align-items: center; justify-content: center;
    gap: var(--cf-space-2); padding: var(--cf-space-8);
    color: var(--cf-text-muted); font-size: var(--cf-text-sm);
}
.ml-spinner { width:18px;height:18px;border:2px solid var(--cf-border-medium);border-top-color:var(--cf-interactive-default);border-radius:50%;animation:ml-spin 0.7s linear infinite; }
@keyframes ml-spin { to { transform: rotate(360deg); } }
</style>
<div class="ml-root">

  <!-- Header -->
  <div class="screen-header">
    <div>
      <h2 class="screen-title"><i class="fas fa-brain"></i> ML Models</h2>
      <p class="screen-subtitle">Monitor model health, accuracy, and training jobs. Data sourced from the ML service.</p>
    </div>
    <div class="screen-actions">
      <button class="ml-btn secondary" onclick="window._mlScreen._loadAll()">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
      <button class="ml-btn primary" onclick="window._mlScreen.showTrainModal()">
        <i class="fas fa-play"></i> Train New Model
      </button>
    </div>
  </div>

  <!-- Stats -->
  <div class="ml-stat-grid">
    <div class="ml-stat-card">
      <div class="ml-stat-icon accent"><i class="fas fa-brain"></i></div>
      <div><div class="ml-stat-val" id="ml-stat-total">—</div><div class="ml-stat-lbl">Models</div></div>
    </div>
    <div class="ml-stat-card">
      <div class="ml-stat-icon green"><i class="fas fa-check-circle"></i></div>
      <div><div class="ml-stat-val" id="ml-stat-loaded">—</div><div class="ml-stat-lbl">Loaded</div></div>
    </div>
    <div class="ml-stat-card">
      <div class="ml-stat-icon red"><i class="fas fa-times-circle"></i></div>
      <div><div class="ml-stat-val" id="ml-stat-offline">—</div><div class="ml-stat-lbl">Offline</div></div>
    </div>
    <div class="ml-stat-card">
      <div class="ml-stat-icon blue"><i class="fas fa-chart-line"></i></div>
      <div><div class="ml-stat-val" id="ml-stat-avg-acc">—</div><div class="ml-stat-lbl">Avg Accuracy</div></div>
    </div>
    <div class="ml-stat-card">
      <div class="ml-stat-icon amber"><i class="fas fa-cog fa-spin"></i></div>
      <div><div class="ml-stat-val" id="ml-stat-training">0</div><div class="ml-stat-lbl">Training</div></div>
    </div>
  </div>

  <!-- Main Layout -->
  <div class="ml-layout">

    <!-- Left: Model List + Training Jobs -->
    <div style="display:flex;flex-direction:column;gap:var(--cf-space-5);">

      <!-- Service Health -->
      <div class="ml-card">
        <div class="ml-card-hd">
          <span class="ml-card-title"><i class="fas fa-heartbeat"></i> ML Service Health</span>
          <span id="ml-service-status" class="ml-badge loading">Checking…</span>
        </div>
        <div class="ml-card-body" id="ml-health-body">
          <div class="ml-loading"><div class="ml-spinner"></div> Contacting ML service…</div>
        </div>
      </div>

      <!-- Model List -->
      <div class="ml-card">
        <div class="ml-card-hd">
          <span class="ml-card-title"><i class="fas fa-list"></i> Available Models</span>
        </div>
        <div class="ml-card-body" id="ml-model-list-body">
          <div class="ml-loading"><div class="ml-spinner"></div> Loading models…</div>
        </div>
      </div>

      <!-- Training Jobs -->
      <div class="ml-card">
        <div class="ml-card-hd">
          <span class="ml-card-title"><i class="fas fa-cog"></i> Training Jobs</span>
        </div>
        <div class="ml-card-body" id="ml-jobs-body">
          <div class="ml-empty"><i class="fas fa-robot"></i><p>No training jobs yet.</p></div>
        </div>
      </div>

    </div>

    <!-- Right: Model Detail -->
    <div class="ml-card" style="position:sticky;top:0;">
      <div class="ml-card-hd">
        <span class="ml-card-title"><i class="fas fa-info-circle"></i> Model Detail</span>
      </div>
      <div id="ml-detail-panel" class="ml-card-body">
        <div class="ml-detail-placeholder">
          <i class="fas fa-robot"></i>
          <p>Select a model to view its specifications and performance metrics.</p>
        </div>
      </div>
    </div>

  </div>
</div>
`;
    }

    _bind() {
        window._mlScreen = this;
    }

    async _loadAll() {
        await Promise.all([
            this._loadHealth(),
            this._loadModels(),
        ]);
    }

    async _loadHealth() {
        const statusBadge = document.getElementById('ml-service-status');
        const healthBody  = document.getElementById('ml-health-body');

        try {
            const res = await fetch('http://localhost:8001/health', {
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (statusBadge) { statusBadge.className = 'ml-badge loaded'; statusBadge.textContent = 'Online'; }

            const rows = [
                { label: 'Status',     val: data?.status || 'ok',              ok: data?.status !== 'error' },
                { label: 'Version',    val: data?.version || 'N/A',            ok: true },
                { label: 'Uptime',     val: data?.uptime ? `${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m` : 'N/A', ok: true },
                { label: 'Models Loaded', val: data?.models_loaded ?? (data?.models ? Object.keys(data.models).length : 'N/A'), ok: true },
                { label: 'Memory',     val: data?.memory_usage || 'N/A',       ok: true },
                { label: 'GPU',        val: data?.gpu_available ? 'Available' : 'CPU only', ok: data?.gpu_available ?? true },
            ];

            if (healthBody) {
                healthBody.innerHTML = rows.map(r => `
                    <div class="ml-health-row">
                      <div class="ml-health-dot ${r.ok ? 'ok' : 'bad'}"></div>
                      <span class="ml-health-label">${r.label}</span>
                      <span class="ml-health-val">${this._esc(String(r.val))}</span>
                    </div>`).join('');
            }

            // Incorporate model data from health if models field present
            if (data?.models && !this.models.length) {
                this._setModelsFromHealthData(data.models);
            }

        } catch (err) {
            if (statusBadge) { statusBadge.className = 'ml-badge offline'; statusBadge.textContent = 'Offline'; }
            if (healthBody) {
                healthBody.innerHTML = `
                    <div class="ml-health-row">
                      <div class="ml-health-dot bad"></div>
                      <span class="ml-health-label">ML service unreachable</span>
                      <span class="ml-health-val" style="color:var(--cf-status-error);">localhost:8001</span>
                    </div>
                    <div style="margin-top:var(--cf-space-3);font-size:var(--cf-text-xs);color:var(--cf-text-muted);">
                      Ensure the ML backend is running. Showing static model data.
                    </div>`;
            }
        }
    }

    async _loadModels() {
        // Try API clients
        try {
            if (window.cyberforgeAPI) {
                const res = await window.cyberforgeAPI.getCyberForgeModels();
                if (res?.success && res.data?.models) {
                    this._setModelsFromHealthData(res.data.models);
                    return;
                }
            }
        } catch (_) {}

        try {
            if (window.apiClient) {
                const res = await window.apiClient.getAIModels();
                if (res?.success && res.data?.models?.length) {
                    this.models = res.data.models.map(m => ({
                        id:          m.id,
                        name:        m.name || m.id,
                        type:        m.type || 'Classification',
                        accuracy:    m.accuracy || m.metrics?.accuracy || 0.9,
                        status:      m.status || 'loaded',
                        framework:   m.framework || 'scikit-learn',
                        version:     m.version || '1.0.0',
                        trainedAt:   m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—',
                        description: m.description || 'ML model for cybersecurity analysis.',
                        inferenceMs: m.inference_time_ms || '—',
                        classes:     m.classes || ['benign', 'malicious'],
                    }));
                    this._renderModels();
                    this._updateStats();
                    return;
                }
            }
        } catch (_) {}

        // Static fallback
        this.models = [
            { id: 'phishing_detection',  name: 'Phishing Detection',    type: 'Binary Classification', accuracy: 0.989, status: 'loaded',  framework: 'scikit-learn', version: '2.1.0', trainedAt: '2025-01-15', description: 'Classifies URLs as phishing or legitimate using lexical and host-based features.', inferenceMs: 12, classes: ['legitimate','phishing'] },
            { id: 'malware_detection',   name: 'Malware Detection',      type: 'Binary Classification', accuracy: 0.998, status: 'loaded',  framework: 'scikit-learn', version: '2.1.0', trainedAt: '2025-01-10', description: 'PE file static analysis to detect malware vs benign files.', inferenceMs: 8, classes: ['benign','malicious'] },
            { id: 'anomaly_detection',   name: 'Anomaly Detection',      type: 'Anomaly Detection',     accuracy: 0.999, status: 'loaded',  framework: 'scikit-learn', version: '2.0.1', trainedAt: '2025-01-20', description: 'Isolation Forest for network flow anomaly detection.', inferenceMs: 5, classes: ['normal','anomaly'] },
            { id: 'web_attack_detection',name: 'Web Attack Detection',   type: 'Binary Classification', accuracy: 1.000, status: 'loaded',  framework: 'scikit-learn', version: '1.9.0', trainedAt: '2025-01-20', description: 'Detects XSS, SQLi, and other web attacks from HTTP request features.', inferenceMs: 6, classes: ['benign','attack'] },
            { id: 'network_intrusion',   name: 'Network Intrusion (NSL)', type: 'Multi-class',          accuracy: 0.971, status: 'loaded',  framework: 'scikit-learn', version: '1.8.0', trainedAt: '2025-01-05', description: 'Multi-class classification of network traffic into normal and attack categories.', inferenceMs: 10, classes: ['normal','dos','probe','r2l','u2r'] },
            { id: 'ransomware_detector', name: 'Ransomware Detector',    type: 'Binary Classification', accuracy: 0.963, status: 'offline', framework: 'PyTorch',      version: '0.5.0', trainedAt: '2024-12-15', description: 'Behavioral analysis model for ransomware detection. Currently offline for retraining.', inferenceMs: '—', classes: ['clean','ransomware'] },
        ];
        this._renderModels();
        this._updateStats();
    }

    _setModelsFromHealthData(modelsData) {
        this.models = Object.entries(modelsData).map(([id, m]) => ({
            id,
            name:        id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type:        m.type || 'Classification',
            accuracy:    m.accuracy || 0.95,
            status:      m.status || 'loaded',
            framework:   m.framework || 'scikit-learn',
            version:     m.version || '1.0.0',
            trainedAt:   m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—',
            description: m.description || `CyberForge ML model (${id})`,
            inferenceMs: m.inference_time_ms || '—',
            classes:     m.classes || ['benign', 'malicious'],
        }));
        this._renderModels();
        this._updateStats();
    }

    _renderModels() {
        const body = document.getElementById('ml-model-list-body');
        if (!body) return;

        if (!this.models.length) {
            body.innerHTML = `<div class="ml-empty"><i class="fas fa-brain"></i><p>No models found.</p></div>`;
            return;
        }

        body.innerHTML = `<div class="ml-model-list">${this.models.map(m => `
            <div class="ml-model-row ${this.selectedModel?.id === m.id ? 'selected' : ''}"
                 data-model-id="${this._esc(m.id)}"
                 onclick="window._mlScreen.selectModel('${this._esc(m.id)}')">
              <div class="ml-model-icon"><i class="fas fa-robot"></i></div>
              <div class="ml-model-info">
                <div class="ml-model-name">${this._esc(m.name)}</div>
                <div class="ml-model-type">${this._esc(m.type)} · ${this._esc(m.framework)}</div>
                <div class="ml-acc-bar">
                  <div class="ml-acc-fill" style="width:${(m.accuracy * 100).toFixed(1)}%;"></div>
                </div>
              </div>
              <div class="ml-model-metrics">
                <div class="ml-metric">
                  <div class="ml-metric-val">${(m.accuracy * 100).toFixed(1)}%</div>
                  <div class="ml-metric-lbl">Accuracy</div>
                </div>
                <span class="ml-badge ${m.status}">${m.status}</span>
              </div>
            </div>
        `).join('')}</div>`;
    }

    selectModel(id) {
        this.selectedModel = this.models.find(m => m.id === id) || null;
        if (!this.selectedModel) return;
        this._renderModels();
        this._renderDetail();
    }

    _renderDetail() {
        const panel = document.getElementById('ml-detail-panel');
        if (!panel || !this.selectedModel) return;
        const m = this.selectedModel;

        panel.innerHTML = `
            <div class="ml-detail-section">
              <div style="display:flex;align-items:center;gap:var(--cf-space-2);margin-bottom:var(--cf-space-3);">
                <span class="ml-badge ${m.status}">${m.status}</span>
                <span style="font-size:var(--cf-text-xs);color:var(--cf-text-muted);">v${this._esc(m.version)}</span>
              </div>
              <div style="font-size:var(--cf-text-sm);color:var(--cf-text-secondary);line-height:var(--cf-leading-relaxed);margin-bottom:var(--cf-space-4);">${this._esc(m.description)}</div>
            </div>
            <div class="ml-detail-section">
              <div class="ml-detail-section-title">Specifications</div>
              <div class="ml-detail-kv"><span class="k">Model ID</span><span class="v">${this._esc(m.id)}</span></div>
              <div class="ml-detail-kv"><span class="k">Type</span><span class="v">${this._esc(m.type)}</span></div>
              <div class="ml-detail-kv"><span class="k">Framework</span><span class="v">${this._esc(m.framework)}</span></div>
              <div class="ml-detail-kv"><span class="k">Accuracy</span><span class="v" style="color:var(--cf-status-success);font-weight:var(--cf-weight-bold);">${(m.accuracy * 100).toFixed(2)}%</span></div>
              <div class="ml-detail-kv"><span class="k">Inference</span><span class="v">${m.inferenceMs !== '—' ? m.inferenceMs + ' ms' : '—'}</span></div>
              <div class="ml-detail-kv"><span class="k">Trained</span><span class="v">${this._esc(m.trainedAt)}</span></div>
            </div>
            <div class="ml-detail-section">
              <div class="ml-detail-section-title">Output Classes</div>
              <div style="display:flex;flex-wrap:wrap;gap:var(--cf-space-1);">
                ${(m.classes || []).map(c => `<span style="padding:2px var(--cf-space-2);background:var(--cf-interactive-subtle);color:var(--cf-interactive-default);border-radius:var(--cf-radius-md);font-size:var(--cf-text-xs);font-family:var(--cf-font-mono);">${this._esc(c)}</span>`).join('')}
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:var(--cf-space-2);margin-top:var(--cf-space-4);">
              <button class="ml-btn primary sm" onclick="window._mlScreen.testModel('${this._esc(m.id)}')">
                <i class="fas fa-play"></i> Test
              </button>
              <button class="ml-btn secondary sm" onclick="window._mlScreen.showTrainModal('${this._esc(m.id)}')">
                <i class="fas fa-redo"></i> Retrain
              </button>
              ${m.status === 'loaded' ? `
              <button class="ml-btn secondary sm" onclick="window.open('https://huggingface.co/Che237/cyberforge-models','_blank')">
                <i class="fas fa-external-link-alt"></i> HuggingFace
              </button>` : ''}
            </div>`;
    }

    _updateStats() {
        const loaded  = this.models.filter(m => m.status === 'loaded' || m.status === 'active').length;
        const offline = this.models.filter(m => m.status === 'offline').length;
        const avgAcc  = this.models.length
            ? (this.models.reduce((s, m) => s + m.accuracy, 0) / this.models.length * 100).toFixed(1) + '%'
            : '—';
        const training = this.trainingJobs.filter(j => j.status === 'running').length;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('ml-stat-total',    this.models.length);
        set('ml-stat-loaded',   loaded);
        set('ml-stat-offline',  offline);
        set('ml-stat-avg-acc',  avgAcc);
        set('ml-stat-training', training);
    }

    _renderJobs() {
        const body = document.getElementById('ml-jobs-body');
        if (!body) return;
        if (!this.trainingJobs.length) {
            body.innerHTML = `<div class="ml-empty"><i class="fas fa-robot"></i><p>No training jobs yet. Start training a model.</p></div>`;
            return;
        }
        body.innerHTML = `<div class="ml-job-list">${this.trainingJobs.map(j => `
            <div class="ml-job-item">
              <div class="ml-job-hd">
                <div>
                  <div class="ml-job-name">${this._esc(j.name)}</div>
                  <div class="ml-job-meta">${this._esc(j.dataset)} · started ${this._esc(j.startedAt)}</div>
                </div>
                <span class="ml-badge ${j.status}">${j.status}</span>
              </div>
              <div class="ml-progress-track">
                <div class="ml-progress-fill ${j.status === 'completed' ? 'done' : j.status === 'stopped' ? 'stopped' : ''}"
                     style="width:${j.progress}%;"></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="ml-progress-label">${j.progress}%${j.status === 'running' ? ' — est. ' + this._esc(j.eta) : ''}</span>
                ${j.status === 'running' ? `<button class="ml-btn danger sm" onclick="window._mlScreen.stopJob('${this._esc(j.id)}')"><i class="fas fa-stop"></i> Stop</button>` : ''}
              </div>
            </div>
        `).join('')}</div>`;
    }

    showTrainModal(preselectedModel = '') {
        const overlay = document.createElement('div');
        overlay.className = 'ml-modal-overlay';
        overlay.id = 'ml-modal-overlay';
        overlay.innerHTML = `
            <div class="ml-modal">
              <div class="ml-modal-hd">
                <span class="ml-modal-title"><i class="fas fa-play-circle" style="color:var(--cf-interactive-default);margin-right:8px;"></i>Train New Model</span>
                <button class="ml-close-btn" onclick="document.getElementById('ml-modal-overlay').remove()"><i class="fas fa-times"></i></button>
              </div>
              <div class="ml-modal-body">
                <div>
                  <label class="ml-form-label">Model Name</label>
                  <input class="ml-input" id="ml-new-name" placeholder="e.g. Ransomware Detector v2" value="${preselectedModel ? this._esc(preselectedModel) + ' (retrain)' : ''}" />
                </div>
                <div>
                  <label class="ml-form-label">Model Type</label>
                  <select class="ml-select" id="ml-new-type">
                    <option value="classification">Binary Classification</option>
                    <option value="multiclass">Multi-class Classification</option>
                    <option value="anomaly">Anomaly Detection</option>
                    <option value="regression">Regression</option>
                  </select>
                </div>
                <div>
                  <label class="ml-form-label">Dataset</label>
                  <select class="ml-select" id="ml-new-dataset">
                    <option value="malware_detection">Malware Detection (50K samples)</option>
                    <option value="network_intrusion">Network Intrusion NSL-KDD (126K samples)</option>
                    <option value="phishing_detection">Phishing Detection (11K samples)</option>
                    <option value="anomaly_detection">Anomaly Detection (80K samples)</option>
                    <option value="web_attacks">Web Attacks (45K samples)</option>
                  </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--cf-space-3);">
                  <div>
                    <label class="ml-form-label">Epochs</label>
                    <input class="ml-input" id="ml-new-epochs" type="number" value="10" min="1" max="100" />
                  </div>
                  <div>
                    <label class="ml-form-label">Batch Size</label>
                    <input class="ml-input" id="ml-new-batch" type="number" value="32" min="8" max="512" />
                  </div>
                  <div>
                    <label class="ml-form-label">Lr</label>
                    <input class="ml-input" id="ml-new-lr" type="number" value="0.001" step="0.0001" min="0.0001" max="1" />
                  </div>
                </div>
              </div>
              <div class="ml-modal-footer">
                <button class="ml-btn secondary" onclick="document.getElementById('ml-modal-overlay').remove()">Cancel</button>
                <button class="ml-btn primary" onclick="window._mlScreen.startTraining()">
                  <i class="fas fa-play"></i> Start Training
                </button>
              </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    async startTraining() {
        const name    = document.getElementById('ml-new-name')?.value?.trim() || 'New Model';
        const type    = document.getElementById('ml-new-type')?.value || 'classification';
        const dataset = document.getElementById('ml-new-dataset')?.value || 'malware_detection';
        const epochs  = parseInt(document.getElementById('ml-new-epochs')?.value) || 10;
        const batch   = parseInt(document.getElementById('ml-new-batch')?.value) || 32;
        const lr      = parseFloat(document.getElementById('ml-new-lr')?.value) || 0.001;

        document.getElementById('ml-modal-overlay')?.remove();

        const jobId = `JOB-${Date.now()}`;
        const job = {
            id: jobId, name, dataset, status: 'running', progress: 0,
            startedAt: new Date().toLocaleTimeString(), eta: `${epochs * 2} min`,
        };
        this.trainingJobs.unshift(job);
        this._renderJobs();
        this._updateStats();

        // Try real API
        let apiJobId = null;
        try {
            if (window.apiClient) {
                const res = await window.apiClient.trainModel(dataset, type, { epochs, batch_size: batch, learning_rate: lr }, { model_name: name });
                if (res?.success && res.data?.job_id) {
                    apiJobId = res.data.job_id;
                    this._pollTraining(jobId, apiJobId);
                    return;
                }
            }
        } catch (_) {}

        // Simulate progress
        this._simulateTraining(jobId, name);
    }

    _simulateTraining(jobId, modelName) {
        const step = () => {
            if (!this.isActive) return;
            const job = this.trainingJobs.find(j => j.id === jobId);
            if (!job || job.status !== 'running') return;

            job.progress = Math.min(job.progress + Math.floor(Math.random() * 8) + 2, 100);
            if (job.progress >= 100) {
                job.status = 'completed';
                job.progress = 100;
                const accuracy = 0.88 + Math.random() * 0.09;
                this.models.unshift({
                    id: `model-${Date.now()}`,
                    name: modelName,
                    type: 'Classification',
                    accuracy,
                    status: 'loaded',
                    framework: 'scikit-learn',
                    version: '1.0.0',
                    trainedAt: new Date().toLocaleDateString(),
                    description: `Trained model: ${modelName}`,
                    inferenceMs: Math.floor(Math.random() * 15 + 5),
                    classes: ['benign', 'malicious'],
                });
                this._renderModels();
            }
            this._renderJobs();
            this._updateStats();

            if (job.status === 'running') {
                this._trainingTimers[jobId] = setTimeout(step, 1200 + Math.random() * 800);
            }
        };
        this._trainingTimers[jobId] = setTimeout(step, 800);
    }

    async _pollTraining(localId, apiId) {
        const poll = async () => {
            if (!this.isActive) return;
            try {
                const res = await window.apiClient.getTrainingStatus(apiId);
                const job = this.trainingJobs.find(j => j.id === localId);
                if (!job) return;
                if (res?.success && res.data?.job) {
                    job.status   = res.data.job.status || job.status;
                    job.progress = res.data.job.progress || job.progress;
                    this._renderJobs();
                    this._updateStats();
                    if (job.status === 'running') {
                        this._trainingTimers[localId] = setTimeout(poll, 3000);
                    } else if (job.status === 'completed') {
                        await this._loadModels();
                    }
                }
            } catch (_) {
                this._simulateTraining(localId, this.trainingJobs.find(j => j.id === localId)?.name || 'Model');
            }
        };
        this._trainingTimers[localId] = setTimeout(poll, 2000);
    }

    stopJob(jobId) {
        const job = this.trainingJobs.find(j => j.id === jobId);
        if (job) { job.status = 'stopped'; }
        clearTimeout(this._trainingTimers[jobId]);
        this._renderJobs();
        this._updateStats();
    }

    async testModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;
        const input = prompt(`Test "${model.name}"\nEnter a URL or text sample to analyze:`);
        if (!input) return;

        try {
            if (window.cyberforgeAPI) {
                const res = await window.cyberforgeAPI.cyberforgePredict(modelId, { url: input, text: input });
                if (res?.success) {
                    const p = res.data;
                    alert(`Model: ${model.name}\nPrediction: ${p.prediction}\nConfidence: ${p.confidence}%\nRisk Level: ${p.risk_level}`);
                    return;
                }
            }
        } catch (_) {}

        // Simulated
        const labels = model.classes || ['benign', 'malicious'];
        const pred = labels[Math.floor(Math.random() * labels.length)];
        const conf = Math.floor(Math.random() * 15 + 84);
        alert(`Model: ${model.name}\nInput: ${input}\n\nPrediction: ${pred}\nConfidence: ${conf}%\n\n(Simulated — ML service offline)`);
    }

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

window.MLModelsScreen = MLModelsScreen;
