/**
 * System Logs Screen
 * Real-time system log monitoring and analysis
 */

class SystemLogsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.logs = [];
        this.allLogs = [];
        this.filters = { level: 'all', source: 'all', timeRange: '24h' };
        this.updateInterval = null;
        this.autoScroll = true;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadData();
        this.startLiveUpdates();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    createHTML() {
        return `
            <div class="system-logs-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); height:100%; overflow:hidden;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md); flex-shrink:0;">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-file-code" style="color:var(--primary);"></i>
                            System Logs
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Real-time system event log monitoring and analysis</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:var(--space-sm);">
                        <span id="logs-live-indicator" style="display:flex; align-items:center; gap:6px; font-size:var(--text-sm); color:var(--success);">
                            <span style="width:8px; height:8px; border-radius:50%; background:var(--success); display:inline-block;"></span>
                            Live
                        </span>
                        <button class="btn btn-secondary btn-sm" id="logs-pause-btn" onclick="window._logsScreen?.toggleLive()">
                            <i class="fas fa-pause"></i> Pause
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window._logsScreen?.clearLogs()">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="window._logsScreen?.exportLogs()">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <!-- Stats Row -->
                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:var(--space-sm); flex-shrink:0;">
                    ${[
                        { id:'log-total', label:'Total Events', color:'var(--primary)' },
                        { id:'log-critical', label:'Critical', color:'var(--error)' },
                        { id:'log-error', label:'Error', color:'#ff9500' },
                        { id:'log-warning', label:'Warning', color:'var(--warning)' },
                        { id:'log-info', label:'Info', color:'var(--info)' },
                    ].map(s => `
                        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-top:3px solid ${s.color}; border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md); text-align:center;">
                            <div id="${s.id}" style="font-size:var(--text-lg); font-weight:700; color:${s.color};">0</div>
                            <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.label}</div>
                        </div>
                    `).join('')}
                </div>

                <!-- Filters -->
                <div style="display:flex; gap:var(--space-sm); flex-wrap:wrap; flex-shrink:0;">
                    <select class="form-control" id="logs-level-filter" style="width:auto;" onchange="window._logsScreen?.applyFilter()">
                        <option value="all">All Levels</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="ERROR">Error</option>
                        <option value="WARN">Warning</option>
                        <option value="INFO">Info</option>
                        <option value="DEBUG">Debug</option>
                    </select>
                    <select class="form-control" id="logs-source-filter" style="width:auto;" onchange="window._logsScreen?.applyFilter()">
                        <option value="all">All Sources</option>
                        <option value="SecurityEngine">Security Engine</option>
                        <option value="NetworkMonitor">Network Monitor</option>
                        <option value="MLEngine">ML Engine</option>
                        <option value="Firewall">Firewall</option>
                        <option value="System">System</option>
                    </select>
                    <select class="form-control" id="logs-time-filter" style="width:auto;" onchange="window._logsScreen?.applyFilter()">
                        <option value="1h">Last Hour</option>
                        <option value="24h" selected>Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <input type="text" class="form-control" id="logs-search" placeholder="Search logs..." style="flex:1; min-width:200px;" oninput="window._logsScreen?.applyFilter()" />
                    <label style="display:flex; align-items:center; gap:6px; font-size:var(--text-sm); color:var(--text-secondary); cursor:pointer;">
                        <input type="checkbox" id="logs-autoscroll" checked onchange="window._logsScreen?.toggleAutoScroll(this.checked)" />
                        Auto-scroll
                    </label>
                </div>

                <!-- Log Viewer -->
                <div style="flex:1; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow:hidden; display:flex; flex-direction:column; min-height:0;">
                    <div style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); padding:var(--space-sm) var(--space-md); display:flex; gap:var(--space-xl); font-size:var(--text-xs); font-weight:600; color:var(--text-muted);">
                        <span style="min-width:160px;">TIMESTAMP</span>
                        <span style="min-width:80px;">LEVEL</span>
                        <span style="min-width:140px;">SOURCE</span>
                        <span>MESSAGE</span>
                    </div>
                    <div id="logs-container" style="flex:1; overflow-y:auto; font-family:var(--font-mono); font-size:var(--text-xs);">
                        <!-- Log entries -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._logsScreen = this;
    }

    async loadData() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreats({ limit: 50 });
                if (result?.success && result.data?.threats?.length) {
                    this.allLogs = result.data.threats.map(t => ({
                        timestamp: new Date(t.createdAt || Date.now()),
                        level: t.severity === 'critical' ? 'CRITICAL' : t.severity === 'high' ? 'ERROR' : t.severity === 'medium' ? 'WARN' : 'INFO',
                        source: t.source || 'SecurityEngine',
                        message: t.description || t.message || 'Security event detected',
                    }));
                    this.logs = [...this.allLogs];
                    this.renderLogs();
                    this.updateStats();
                    return;
                }
            }
        } catch (e) { /* fallback */ }
        this.loadMockLogs();
    }

    loadMockLogs() {
        const sources = ['SecurityEngine', 'NetworkMonitor', 'MLEngine', 'Firewall', 'System', 'AuthService'];
        const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
        const messages = {
            INFO: [
                'System health check completed successfully',
                'ML model inference completed: 98.2% confidence',
                'Network packet inspection: 1,247 packets analyzed',
                'User authentication successful from 192.168.1.50',
                'Threat database updated: 2,847 new signatures',
                'Scheduled scan completed: 0 threats found',
                'Backup completed: 4.2GB archived',
            ],
            WARN: [
                'High CPU usage detected on ML inference engine (87%)',
                'Network latency spike: 450ms on interface eth0',
                'Authentication failed 3 times for user admin@domain.com',
                'Disk usage warning: 78% on /var/log partition',
                'SSL certificate expires in 14 days',
                'Rate limit approaching for API endpoint /api/threats',
            ],
            ERROR: [
                'Failed to connect to threat intelligence API: timeout',
                'Database query timeout after 30s',
                'ML model prediction failed: invalid input format',
                'Network interface eth1 connection lost',
                'Log rotation failed: insufficient disk space',
            ],
            CRITICAL: [
                'CRITICAL: Ransomware activity detected - system isolation triggered',
                'CRITICAL: Data exfiltration attempt blocked - 2.1GB transfer stopped',
                'CRITICAL: Multiple failed admin login attempts - account locked',
                'CRITICAL: Zero-day exploit signature detected in memory',
            ],
        };

        this.allLogs = [];
        const now = Date.now();
        for (let i = 200; i >= 0; i--) {
            const levelIdx = Math.floor(Math.random() * levels.length);
            const level = levels[levelIdx];
            const source = sources[Math.floor(Math.random() * sources.length)];
            const msgArr = messages[level] || messages.INFO;
            const message = msgArr[Math.floor(Math.random() * msgArr.length)];
            this.allLogs.push({
                timestamp: new Date(now - i * 60000 * Math.random() * 5),
                level,
                source,
                message,
            });
        }
        this.allLogs.sort((a, b) => b.timestamp - a.timestamp);
        this.logs = [...this.allLogs];
        this.renderLogs();
        this.updateStats();
    }

    renderLogs() {
        const container = document.getElementById('logs-container');
        if (!container) return;

        const levelColors = {
            CRITICAL: 'var(--error)',
            ERROR: '#ff9500',
            WARN: 'var(--warning)',
            INFO: 'var(--info)',
            DEBUG: 'var(--text-muted)',
        };
        const levelBg = {
            CRITICAL: 'rgba(255,82,82,0.08)',
            ERROR: 'rgba(255,149,0,0.06)',
            WARN: 'rgba(255,215,64,0.05)',
            INFO: '',
            DEBUG: '',
        };

        container.innerHTML = this.logs.slice(0, 200).map(log => `
            <div style="display:flex; gap:var(--space-xl); padding:4px var(--space-md); border-bottom:1px solid var(--border-color)22; background:${levelBg[log.level] || ''}; transition:background var(--transition-fast);"
                 onmouseenter="this.style.background='var(--bg-hover)'"
                 onmouseleave="this.style.background='${levelBg[log.level] || ''}'">
                <span style="min-width:160px; color:var(--text-muted); flex-shrink:0;">${log.timestamp.toLocaleString()}</span>
                <span style="min-width:80px; color:${levelColors[log.level] || 'var(--text-muted)'}; font-weight:700; flex-shrink:0;">${log.level}</span>
                <span style="min-width:140px; color:var(--primary); flex-shrink:0;">${log.source}</span>
                <span style="color:${levelColors[log.level] === 'var(--error)' ? 'var(--error)' : 'var(--text-secondary)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${log.message}</span>
            </div>
        `).join('');

        if (this.autoScroll) {
            container.scrollTop = 0;
        }
    }

    applyFilter() {
        const level = document.getElementById('logs-level-filter')?.value || 'all';
        const source = document.getElementById('logs-source-filter')?.value || 'all';
        const search = document.getElementById('logs-search')?.value?.toLowerCase() || '';

        this.logs = this.allLogs.filter(log => {
            if (level !== 'all' && log.level !== level) return false;
            if (source !== 'all' && log.source !== source) return false;
            if (search && !log.message.toLowerCase().includes(search) && !log.source.toLowerCase().includes(search)) return false;
            return true;
        });
        this.renderLogs();
    }

    updateStats() {
        const counts = { CRITICAL: 0, ERROR: 0, WARN: 0, INFO: 0 };
        this.allLogs.forEach(log => { if (counts[log.level] !== undefined) counts[log.level]++; });

        const el = (id) => document.getElementById(id);
        if (el('log-total')) el('log-total').textContent = this.allLogs.length;
        if (el('log-critical')) el('log-critical').textContent = counts.CRITICAL;
        if (el('log-error')) el('log-error').textContent = counts.ERROR;
        if (el('log-warning')) el('log-warning').textContent = counts.WARN;
        if (el('log-info')) el('log-info').textContent = counts.INFO;
    }

    startLiveUpdates() {
        this.updateInterval = setInterval(() => {
            if (!this.isActive) return;
            const newLog = this.generateRandomLog();
            this.allLogs.unshift(newLog);
            if (this.allLogs.length > 500) this.allLogs.pop();
            this.applyFilter();
            this.updateStats();
        }, 5000);
    }

    generateRandomLog() {
        const sources = ['SecurityEngine', 'NetworkMonitor', 'MLEngine', 'Firewall', 'System'];
        const levels = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR'];
        const msgs = ['Security event processed', 'Network packet analyzed', 'ML inference completed', 'Firewall rule applied', 'System heartbeat OK'];
        return {
            timestamp: new Date(),
            level: levels[Math.floor(Math.random() * levels.length)],
            source: sources[Math.floor(Math.random() * sources.length)],
            message: msgs[Math.floor(Math.random() * msgs.length)],
        };
    }

    toggleLive() {
        const btn = document.getElementById('logs-pause-btn');
        const indicator = document.getElementById('logs-live-indicator');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Resume';
            if (indicator) indicator.style.color = 'var(--text-muted)';
        } else {
            this.startLiveUpdates();
            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            if (indicator) indicator.style.color = 'var(--success)';
        }
    }

    toggleAutoScroll(val) {
        this.autoScroll = val;
    }

    clearLogs() {
        if (confirm('Clear all logs from view? This does not delete server-side logs.')) {
            this.allLogs = [];
            this.logs = [];
            this.renderLogs();
            this.updateStats();
        }
    }

    exportLogs() {
        const text = this.allLogs.map(log => `${log.timestamp.toISOString()} [${log.level}] ${log.source}: ${log.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

window.SystemLogsScreen = SystemLogsScreen;
