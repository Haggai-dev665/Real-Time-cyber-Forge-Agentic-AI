/**
 * Real-Time Monitor Screen — CyberForge
 * Live threat event feed and system activity monitoring.
 */

class RealTimeMonitorScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.pollTimer = null;
        this.events = [];
        this.maxEvents = 100;
        this.BACKEND = window.CF_API?.API || 'https://cyberforge-ddd97655464f.herokuapp.com/api';
        this.ML = window.CF_API?.ML || 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml';
        this.paused = false;
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.container.innerHTML = this._shell();
        this._bind();
        await this._poll();
        this._startPoll();
    }

    hide() {
        this.isActive = false;
        clearInterval(this.pollTimer);
    }

    /* ── Polling ──────────────────────────────────────────────── */

    async _poll() {
        if (this.paused) return;
        await Promise.allSettled([
            this._fetchThreats(),
            this._fetchHealth(),
        ]);
        this._updateTimestamp();
    }

    async _fetchThreats() {
        try {
            const res = await fetch(`${this.BACKEND}/threats?limit=50&status=active`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            const threats = json.data?.threats ?? json.threats ?? json.data ?? [];

            if (!threats.length) return;

            const latest = threats.filter(t => {
                const ts = t.detection?.timestamp || t.timestamp || t.createdAt;
                return ts && (Date.now() - new Date(ts).getTime()) < 5 * 60 * 1000;
            });

            if (latest.length) {
                latest.forEach(t => this._addEvent(t));
            } else {
                threats.slice(0, 5).forEach(t => this._addEvent(t));
            }

            this._renderFeed();
            this._updateCounters(threats);
        } catch {
            this._setConnectionStatus(false, 'backend');
        }
    }

    async _fetchHealth() {
        try {
            const [bkRes, mlRes] = await Promise.allSettled([
                fetch(`${this.BACKEND.replace('/api', '')}/health`, { signal: AbortSignal.timeout(18000) }),
                fetch(`${this.ML}/health`, { signal: AbortSignal.timeout(18000) }),
            ]);
            this._setConnectionStatus(
                bkRes.status === 'fulfilled' && bkRes.value.ok, 'backend'
            );
            this._setConnectionStatus(
                mlRes.status === 'fulfilled' && mlRes.value.ok, 'ml'
            );
        } catch {
            this._setConnectionStatus(false, 'backend');
            this._setConnectionStatus(false, 'ml');
        }
    }

    _addEvent(t) {
        const id = t._id || t.id || Math.random().toString(36);
        if (this.events.find(e => e.id === id)) return;
        this.events.unshift({
            id,
            severity: t.severity || 'low',
            type: t.type || t.threatType || 'Unknown',
            source: t.source?.url || t.source || t.sourceUrl || '—',
            time: new Date(t.detection?.timestamp || t.timestamp || t.createdAt || Date.now()),
            status: t.status || 'active',
        });
        if (this.events.length > this.maxEvents) this.events.pop();
    }

    _renderFeed() {
        const feed = document.getElementById('rtm-feed');
        if (!feed) return;

        if (!this.events.length) {
            feed.innerHTML = `<div class="cf-empty" style="padding:40px">
                <div class="cf-empty-icon"><i class="fas fa-shield-check"></i></div>
                <div class="cf-empty-title">No events detected</div>
                <div class="cf-empty-text">Monitoring is active — events will appear here as they're detected.</div>
            </div>`;
            return;
        }

        feed.innerHTML = this.events.map(e => `
            <div class="rtm-event sev-${e.severity}">
                <div class="rtm-event-left">
                    <span class="rtm-sev-dot sev-dot-${e.severity}"></span>
                    <span class="rtm-type">${this._esc(e.type)}</span>
                </div>
                <span class="rtm-source truncate">${this._esc(e.source)}</span>
                <span class="cf-badge ${this._sevBadge(e.severity)}" style="flex-shrink:0">${e.severity}</span>
                <span class="rtm-time">${e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
        `).join('');
    }

    _updateCounters(threats) {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        threats.forEach(t => {
            const s = (t.severity || 'low').toLowerCase();
            if (counts[s] !== undefined) counts[s]++;
        });
        const el = document.getElementById('rtm-total');
        if (el) el.textContent = threats.length;
        ['critical', 'high', 'medium', 'low'].forEach(s => {
            const c = document.getElementById(`rtm-${s}`);
            if (c) c.textContent = counts[s];
        });
    }

    _setConnectionStatus(online, service) {
        const dot = document.getElementById(`rtm-dot-${service}`);
        const text = document.getElementById(`rtm-text-${service}`);
        if (!dot || !text) return;
        dot.className = `rtm-status-dot ${online ? 'online' : 'offline'}`;
        text.textContent = online ? 'Connected' : 'Offline';
        text.style.color = online ? 'var(--cf-status-success)' : 'var(--cf-status-error)';
    }

    _updateTimestamp() {
        const el = document.getElementById('rtm-last-update');
        if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }

    _startPoll() {
        this.pollTimer = setInterval(() => { if (this.isActive) this._poll(); }, 10000);
    }

    /* ── Controls ─────────────────────────────────────────────── */

    _bind() {
        document.getElementById('rtm-pause')?.addEventListener('click', (e) => {
            this.paused = !this.paused;
            e.currentTarget.innerHTML = this.paused
                ? '<i class="fas fa-play"></i> Resume'
                : '<i class="fas fa-pause"></i> Pause';
        });

        document.getElementById('rtm-clear')?.addEventListener('click', () => {
            this.events = [];
            this._renderFeed();
        });

        document.getElementById('rtm-refresh')?.addEventListener('click', () => this._poll());
    }

    _sevBadge(s) { return { critical: 'error', high: 'error', medium: 'warning', low: 'info' }[s] || 'info'; }
    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    /* ── Shell ────────────────────────────────────────────────── */

    _shell() {
        return `
<style>
.rtm-layout { display:grid; grid-template-columns:3fr 1fr; gap:var(--cf-space-4); height:calc(100vh - 180px); }
.rtm-feed-wrap { display:flex; flex-direction:column; overflow:hidden; }
.rtm-feed {
    flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:2px;
    padding:var(--cf-space-2);
    background:var(--cf-console-bg); border-radius:var(--cf-radius-lg);
    border:1px solid var(--cf-border-light);
    font-family:var(--cf-font-mono);
}
.rtm-event {
    display:flex; align-items:center; gap:var(--cf-space-3);
    padding:6px var(--cf-space-3); border-radius:var(--cf-radius-sm);
    font-size:12px; min-height:32px; border-left:3px solid transparent;
    background:var(--cf-surface-0); margin-bottom:1px;
    transition:background 0.1s ease;
}
.rtm-event:hover { background:var(--cf-surface-1); }
.rtm-event.sev-critical { border-left-color:var(--cf-status-error); }
.rtm-event.sev-high     { border-left-color:var(--cf-status-error); }
.rtm-event.sev-medium   { border-left-color:var(--cf-status-warning); }
.rtm-event.sev-low      { border-left-color:var(--cf-status-info); }
.rtm-event-left { display:flex; align-items:center; gap:8px; flex-shrink:0; width:180px; }
.rtm-sev-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.rtm-sev-dot.sev-dot-critical, .rtm-sev-dot.sev-dot-high { background:var(--cf-status-error); }
.rtm-sev-dot.sev-dot-medium { background:var(--cf-status-warning); }
.rtm-sev-dot.sev-dot-low { background:var(--cf-status-info); }
.rtm-type { font-weight:600; color:var(--cf-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rtm-source { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--cf-text-muted); font-size:11px; }
.rtm-time { flex-shrink:0; color:var(--cf-text-muted); font-size:11px; width:80px; text-align:right; }
.rtm-sidebar { display:flex; flex-direction:column; gap:var(--cf-space-4); overflow-y:auto; }
.rtm-counter-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--cf-space-2); }
.rtm-counter {
    background:var(--cf-surface-1); border:1px solid var(--cf-border-light);
    border-radius:var(--cf-radius-lg); padding:var(--cf-space-3); text-align:center;
}
.rtm-counter-val { font-size:var(--cf-text-xl); font-weight:var(--cf-weight-bold); font-family:var(--cf-font-mono); color:var(--cf-text-primary); }
.rtm-counter-val.red   { color:var(--cf-status-error); }
.rtm-counter-val.amber { color:var(--cf-status-warning); }
.rtm-counter-val.blue  { color:var(--cf-status-info); }
.rtm-counter-lbl { font-size:10px; color:var(--cf-text-muted); margin-top:2px; }
.rtm-status-row { display:flex; align-items:center; justify-content:space-between; padding:var(--cf-space-2) 0; border-bottom:1px solid var(--cf-border-light); font-size:13px; }
.rtm-status-row:last-child { border-bottom:none; }
.rtm-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:var(--cf-status-error); }
.rtm-status-dot.online { background:var(--cf-status-success); animation:rtmPulse 2s ease infinite; }
@keyframes rtmPulse { 0%,100%{box-shadow:0 0 0 0 rgba(246,157,57,.4)} 50%{box-shadow:0 0 0 4px transparent} }
@media(max-width:1000px) { .rtm-layout { grid-template-columns:1fr; } }
</style>

<div style="display:flex;flex-direction:column;gap:var(--cf-space-5)">

    <div class="screen-header">
        <div>
            <h1 class="screen-title">Real-Time Monitor</h1>
            <p class="screen-subtitle" id="rtm-last-update">Polling every 10 seconds...</p>
        </div>
        <div class="screen-actions">
            <button class="cf-btn" id="rtm-clear"><i class="fas fa-trash-alt"></i> Clear</button>
            <button class="cf-btn" id="rtm-pause"><i class="fas fa-pause"></i> Pause</button>
            <button class="cf-btn primary" id="rtm-refresh"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
    </div>

    <div class="rtm-layout">

        <!-- Feed -->
        <div class="rtm-feed-wrap">
            <div class="cf-card-title" style="margin-bottom:var(--cf-space-3)">
                <i class="fas fa-stream" style="color:var(--cf-interactive-default)"></i>
                Live Event Feed
                <span class="cf-badge live" style="margin-left:4px"><i class="fas fa-circle" style="font-size:7px"></i> Live</span>
            </div>
            <div id="rtm-feed" class="rtm-feed">
                <div class="cf-loading" style="padding:32px"><div class="cf-spinner"></div><span>Starting monitor...</span></div>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="rtm-sidebar">

            <!-- Counters -->
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-tachometer-alt"></i> Live Counts</h3>
                </div>
                <div class="cf-card-body">
                    <div style="margin-bottom:var(--cf-space-3)">
                        <div style="font-size:var(--cf-text-3xl);font-weight:700;font-family:var(--cf-font-mono);color:var(--cf-text-primary);text-align:center" id="rtm-total">—</div>
                        <div style="text-align:center;font-size:12px;color:var(--cf-text-muted)">Total Active</div>
                    </div>
                    <div class="rtm-counter-grid">
                        <div class="rtm-counter"><div class="rtm-counter-val red" id="rtm-critical">—</div><div class="rtm-counter-lbl">Critical</div></div>
                        <div class="rtm-counter"><div class="rtm-counter-val red" id="rtm-high">—</div><div class="rtm-counter-lbl">High</div></div>
                        <div class="rtm-counter"><div class="rtm-counter-val amber" id="rtm-medium">—</div><div class="rtm-counter-lbl">Medium</div></div>
                        <div class="rtm-counter"><div class="rtm-counter-val blue" id="rtm-low">—</div><div class="rtm-counter-lbl">Low</div></div>
                    </div>
                </div>
            </div>

            <!-- Service Status -->
            <div class="cf-card">
                <div class="cf-card-header">
                    <h3 class="cf-card-title"><i class="fas fa-heartbeat"></i> Service Health</h3>
                </div>
                <div class="cf-card-body">
                    <div class="rtm-status-row">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="rtm-status-dot" id="rtm-dot-backend"></span>
                            <span style="font-size:13px;color:var(--cf-text-primary)">Backend API</span>
                        </div>
                        <span id="rtm-text-backend" style="font-size:12px;color:var(--cf-status-error);font-weight:500">Checking...</span>
                    </div>
                    <div class="rtm-status-row">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="rtm-status-dot" id="rtm-dot-ml"></span>
                            <span style="font-size:13px;color:var(--cf-text-primary)">ML Services</span>
                        </div>
                        <span id="rtm-text-ml" style="font-size:12px;color:var(--cf-status-error);font-weight:500">Checking...</span>
                    </div>
                    <div class="rtm-status-row">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="rtm-status-dot online"></span>
                            <span style="font-size:13px;color:var(--cf-text-primary)">AI Agent</span>
                        </div>
                        <span style="font-size:12px;color:var(--cf-status-success);font-weight:500">Active</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>`;
    }
}

window.RealTimeMonitorScreen = RealTimeMonitorScreen;
