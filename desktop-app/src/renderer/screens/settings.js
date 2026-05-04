/**
 * Settings Screen — CyberForge
 * Application configuration: theme, service URLs, notifications, data retention.
 */

class SettingsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.dirty = false;
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.dirty = false;
        this.container.innerHTML = this._shell();
        this._loadSaved();
        this._bind();
    }

    hide() { this.isActive = false; }

    /* ── Persistence ──────────────────────────────────────────── */

    _loadSaved() {
        const fields = ['cf-backend-url', 'cf-ml-url', 'cf-theme', 'cf-notifications',
            'cf-auto-update', 'cf-scan-freq', 'cf-data-retention'];
        fields.forEach(key => {
            const val = localStorage.getItem(key);
            if (val == null) return;
            const el = document.getElementById(key);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = val === 'true';
            else el.value = val;
        });
    }

    _save() {
        const fields = {
            'cf-backend-url':     'text',
            'cf-ml-url':          'text',
            'cf-theme':           'text',
            'cf-notifications':   'checkbox',
            'cf-auto-update':     'checkbox',
            'cf-scan-freq':       'text',
            'cf-data-retention':  'text',
        };

        Object.entries(fields).forEach(([key, type]) => {
            const el = document.getElementById(key);
            if (!el) return;
            const val = type === 'checkbox' ? el.checked : el.value;
            localStorage.setItem(key, val);
        });

        // Apply theme change immediately
        const themeEl = document.getElementById('cf-theme');
        if (themeEl) {
            document.documentElement.setAttribute('data-theme', themeEl.value);
            localStorage.setItem('cf-theme', themeEl.value);
            window.dispatchEvent(new CustomEvent('cf-theme-change', { detail: { theme: themeEl.value } }));
        }

        this.dirty = false;
        this._showToast('Settings saved successfully');
    }

    _showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:9999;
            background:var(--cf-status-success);color:white;
            padding:10px 20px;border-radius:var(--cf-radius-lg);
            font-size:13px;font-weight:500;box-shadow:var(--cf-shadow-lg);
            animation:toastSlideIn 0.2s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /* ── Controls ─────────────────────────────────────────────── */

    _bind() {
        document.getElementById('settings-save')?.addEventListener('click', () => this._save());
        document.getElementById('settings-reset')?.addEventListener('click', () => {
            if (confirm('Reset all settings to defaults?')) {
                localStorage.clear();
                this._loadSaved();
                this._showToast('Settings reset to defaults');
            }
        });

        // Mark dirty on any change
        this.container.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => { this.dirty = true; });
        });
    }

    /* ── Shell ────────────────────────────────────────────────── */

    _shell() {
        const backendUrl = localStorage.getItem('cf-backend-url') || window.CF_API?.BACKEND || 'https://cyberforge-ddd97655464f.herokuapp.com';
        const mlUrl = localStorage.getItem('cf-ml-url') || window.CF_API?.ML || 'https://che237-cyberforge-models.hf.space';

        return `
<style>
.settings-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--cf-space-5); }
.settings-section { display:flex; flex-direction:column; gap:var(--cf-space-4); }
.settings-row {
    display:flex; align-items:center; justify-content:space-between;
    padding:var(--cf-space-4) 0; border-bottom:1px solid var(--cf-border-light);
    gap:var(--cf-space-4);
}
.settings-row:last-child { border-bottom:none; }
.settings-label { flex:1; }
.settings-label-text { font-size:var(--cf-text-sm); font-weight:var(--cf-weight-medium); color:var(--cf-text-primary); }
.settings-label-desc { font-size:var(--cf-text-xs); color:var(--cf-text-muted); margin-top:2px; }
.settings-control { flex-shrink:0; }
.settings-control select, .settings-control input[type="text"], .settings-control input[type="url"] {
    padding:var(--cf-space-2) var(--cf-space-3); min-width:180px;
    background:var(--cf-input-bg); border:1px solid var(--cf-input-border);
    border-radius:var(--cf-radius-md); color:var(--cf-text-primary);
    font-size:var(--cf-text-sm); font-family:var(--cf-font-primary);
}
.settings-control input[type="url"] { min-width:240px; font-family:var(--cf-font-mono); }
.cf-toggle {
    position:relative; width:44px; height:24px; cursor:pointer;
    appearance:none; -webkit-appearance:none;
    background:var(--cf-border-medium); border-radius:12px;
    transition:background 0.2s ease; flex-shrink:0;
}
.cf-toggle:checked { background:var(--cf-interactive-default); }
.cf-toggle::before {
    content:''; position:absolute; top:3px; left:3px;
    width:18px; height:18px; border-radius:50%; background:white;
    transition:transform 0.2s ease; box-shadow:0 1px 3px rgba(0,0,0,0.2);
}
.cf-toggle:checked::before { transform:translateX(20px); }
@media (max-width:900px) { .settings-grid { grid-template-columns:1fr; } }
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-6)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Settings</h1>
            <p class="screen-subtitle">Configure CyberForge behavior, services, and preferences</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn danger" id="settings-reset"><i class="fas fa-undo"></i> Reset</button>
            <button class="cf-btn primary" id="settings-save"><i class="fas fa-save"></i> Save Changes</button>
        </div>
    </div>

    <div class="settings-grid">

        <!-- Appearance -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-palette"></i> Appearance</h3>
            </div>
            <div class="cf-card-body">
                <div class="settings-section">
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Theme</div>
                            <div class="settings-label-desc">Color scheme for the interface</div>
                        </div>
                        <div class="settings-control">
                            <select id="cf-theme">
                                <option value="dark">Dark (Default)</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notifications -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-bell"></i> Notifications</h3>
            </div>
            <div class="cf-card-body">
                <div class="settings-section">
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Threat Alerts</div>
                            <div class="settings-label-desc">Show desktop notifications for new threats</div>
                        </div>
                        <div class="settings-control">
                            <input type="checkbox" class="cf-toggle" id="cf-notifications" checked>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Auto Update</div>
                            <div class="settings-label-desc">Automatically refresh threat data</div>
                        </div>
                        <div class="settings-control">
                            <input type="checkbox" class="cf-toggle" id="cf-auto-update" checked>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Scan Frequency</div>
                            <div class="settings-label-desc">How often to run background scans</div>
                        </div>
                        <div class="settings-control">
                            <select id="cf-scan-freq">
                                <option value="realtime">Real-time</option>
                                <option value="hourly">Hourly</option>
                                <option value="daily" selected>Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Service Configuration -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-server"></i> Service Endpoints</h3>
            </div>
            <div class="cf-card-body">
                <div class="settings-section">
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Backend API URL</div>
                            <div class="settings-label-desc">Node.js REST API (default: localhost:3001)</div>
                        </div>
                        <div class="settings-control">
                            <input type="url" id="cf-backend-url" value="${backendUrl}" placeholder="http://localhost:3001">
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">ML Services URL</div>
                            <div class="settings-label-desc">FastAPI ML service (default: localhost:8001)</div>
                        </div>
                        <div class="settings-control">
                            <input type="url" id="cf-ml-url" value="${mlUrl}" placeholder="http://localhost:8001">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Data Management -->
        <div class="cf-card">
            <div class="cf-card-header">
                <h3 class="cf-card-title"><i class="fas fa-database"></i> Data Management</h3>
            </div>
            <div class="cf-card-body">
                <div class="settings-section">
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Data Retention</div>
                            <div class="settings-label-desc">How long to keep threat records</div>
                        </div>
                        <div class="settings-control">
                            <select id="cf-data-retention">
                                <option value="7">7 days</option>
                                <option value="30" selected>30 days</option>
                                <option value="90">90 days</option>
                                <option value="365">1 year</option>
                                <option value="0">Forever</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">
                            <div class="settings-label-text">Clear Local Cache</div>
                            <div class="settings-label-desc">Remove cached threat data and analysis results</div>
                        </div>
                        <div class="settings-control">
                            <button class="cf-btn sm danger" onclick="localStorage.clear(); this.textContent='Cleared'">
                                <i class="fas fa-trash"></i> Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <!-- About -->
    <div class="cf-card">
        <div class="cf-card-header">
            <h3 class="cf-card-title"><i class="fas fa-info-circle"></i> About CyberForge</h3>
        </div>
        <div class="cf-card-body">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--cf-space-4)">
                ${[
                    ['Version', '1.0.0'],
                    ['AI Engine', 'Gemini + ChromaDB'],
                    ['ML Framework', 'TensorFlow/PyTorch'],
                    ['Research', 'Thesis Project 2026'],
                ].map(([k, v]) => `
                    <div style="padding:var(--cf-space-4);background:var(--cf-surface-1);border-radius:var(--cf-radius-lg);border:1px solid var(--cf-border-light)">
                        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--cf-text-muted);font-weight:600;margin-bottom:4px">${k}</div>
                        <div style="font-size:var(--cf-text-sm);font-weight:var(--cf-weight-semibold);color:var(--cf-text-primary)">${v}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

</div>`;
    }
}

window.SettingsScreen = SettingsScreen;
