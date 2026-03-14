/**
 * Network Analysis Screen
 * Real-time network traffic analysis and security monitoring
 */

class NetworkAnalysisScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.connections = [];
        this.charts = {};
        this.updateInterval = null;
        this.selectedInterface = 'all';
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadData();
        this.startRealTimeUpdates();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        Object.values(this.charts).forEach(c => c?.destroy?.());
        this.charts = {};
    }

    createHTML() {
        return `
            <div class="network-analysis-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-network-wired" style="color:var(--primary);"></i>
                            Network Analysis
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Real-time network traffic analysis, monitoring, and anomaly detection</p>
                    </div>
                    <div style="display:flex; gap:var(--space-sm); align-items:center;">
                        <select class="form-control" id="net-interface" style="width:auto;" onchange="window._netScreen?.changeInterface(this.value)">
                            <option value="all">All Interfaces</option>
                            <option value="eth0">eth0 (LAN)</option>
                            <option value="eth1">eth1 (WAN)</option>
                            <option value="wlan0">wlan0 (WiFi)</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="window._netScreen?.exportCapture()">
                            <i class="fas fa-download"></i> Export PCAP
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:var(--space-md);">
                    ${[
                        { id:'net-connections', label:'Active Connections', icon:'plug', color:'var(--primary)' },
                        { id:'net-traffic-in', label:'Inbound (MB/s)', icon:'arrow-down', color:'var(--success)' },
                        { id:'net-traffic-out', label:'Outbound (MB/s)', icon:'arrow-up', color:'#ff9500' },
                        { id:'net-anomalies', label:'Anomalies', icon:'exclamation-triangle', color:'var(--error)' },
                        { id:'net-blocked', label:'Blocked', icon:'ban', color:'var(--warning)' },
                    ].map(s => `
                        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-md); display:flex; align-items:center; gap:var(--space-md);">
                            <div style="width:40px; height:40px; border-radius:50%; background:${s.color}22; display:flex; align-items:center; justify-content:center; color:${s.color}; font-size:var(--text-lg); flex-shrink:0;">
                                <i class="fas fa-${s.icon}"></i>
                            </div>
                            <div>
                                <div id="${s.id}" style="font-size:var(--text-xl); font-weight:700; color:var(--text-primary);">0</div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.label}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Charts Row -->
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:var(--space-lg);">
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                            <i class="fas fa-chart-line" style="color:var(--primary);"></i> Network Traffic (Real-time)
                        </h3>
                        <canvas id="net-traffic-chart" style="max-height:200px;"></canvas>
                    </div>
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                            <i class="fas fa-chart-pie" style="color:var(--primary);"></i> Protocol Distribution
                        </h3>
                        <canvas id="net-protocol-chart" style="max-height:200px;"></canvas>
                    </div>
                </div>

                <!-- Top Talkers & Anomalies -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-lg);">
                    <!-- Top Talkers -->
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                            <i class="fas fa-sort-amount-down" style="color:var(--primary);"></i> Top Talkers
                        </h3>
                        <div id="net-top-talkers" style="display:flex; flex-direction:column; gap:var(--space-xs);">
                            <!-- Populated by JS -->
                        </div>
                    </div>

                    <!-- Active Anomalies -->
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                            <i class="fas fa-exclamation-triangle" style="color:var(--error);"></i> Network Anomalies
                        </h3>
                        <div id="net-anomalies-list" style="display:flex; flex-direction:column; gap:var(--space-xs);">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                </div>

                <!-- Active Connections Table -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">
                            <i class="fas fa-table" style="color:var(--primary);"></i> Active Connections
                        </h3>
                        <input type="text" class="form-control" id="net-conn-search" placeholder="Filter connections..." style="width:200px;" oninput="window._netScreen?.filterConnections(this.value)" />
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:var(--text-xs); font-family:var(--font-mono);">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color);">
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:left; color:var(--text-muted); font-weight:600;">Protocol</th>
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:left; color:var(--text-muted); font-weight:600;">Source IP:Port</th>
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:left; color:var(--text-muted); font-weight:600;">Destination IP:Port</th>
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:center; color:var(--text-muted); font-weight:600;">State</th>
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:right; color:var(--text-muted); font-weight:600;">Bytes</th>
                                    <th style="padding:var(--space-xs) var(--space-sm); text-align:center; color:var(--text-muted); font-weight:600;">Risk</th>
                                </tr>
                            </thead>
                            <tbody id="net-connections-body">
                                <!-- Populated by JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._netScreen = this;
    }

    async loadData() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreatStats();
                if (result?.success) {
                    const data = result.data || {};
                    const el = (id) => document.getElementById(id);
                    if (el('net-connections')) el('net-connections').textContent = data.active_connections || 1247;
                    if (el('net-anomalies')) el('net-anomalies').textContent = data.network_anomalies || 12;
                }
            }
        } catch (e) { /* fallback */ }
        this.loadMockData();
        this.initCharts();
    }

    loadMockData() {
        this.connections = [
            { proto:'TCP', src:'192.168.1.10:54231', dst:'8.8.8.8:443', state:'ESTABLISHED', bytes:'2.4 MB', risk:'low' },
            { proto:'TCP', src:'192.168.1.20:49152', dst:'185.220.101.45:80', state:'ESTABLISHED', bytes:'845 KB', risk:'critical' },
            { proto:'UDP', src:'192.168.1.30:53', dst:'8.8.4.4:53', state:'ACTIVE', bytes:'12 KB', risk:'low' },
            { proto:'TCP', src:'10.0.0.5:22', dst:'203.0.113.10:4444', state:'ESTABLISHED', bytes:'1.1 MB', risk:'high' },
            { proto:'TCP', src:'192.168.1.100:80', dst:'198.51.100.20:54321', state:'CLOSE_WAIT', bytes:'56 KB', risk:'medium' },
            { proto:'ICMP', src:'192.168.1.50', dst:'192.168.1.1', state:'ACTIVE', bytes:'4 KB', risk:'low' },
            { proto:'TCP', src:'172.16.0.5:443', dst:'104.18.21.226:443', state:'ESTABLISHED', bytes:'890 KB', risk:'low' },
            { proto:'TCP', src:'192.168.1.15:34567', dst:'91.195.240.117:8080', state:'ESTABLISHED', bytes:'3.2 MB', risk:'high' },
        ];
        this.renderConnections(this.connections);

        // Top talkers
        const talkers = document.getElementById('net-top-talkers');
        if (talkers) {
            const topTalkers = [
                { ip:'192.168.1.20', bytes:'45.2 MB', packets:12847, pct:38 },
                { ip:'10.0.0.5', bytes:'28.1 MB', packets:8234, pct:24 },
                { ip:'172.16.0.5', bytes:'15.9 MB', packets:4521, pct:13 },
                { ip:'192.168.1.10', bytes:'12.4 MB', packets:3201, pct:10 },
                { ip:'192.168.1.100', bytes:'8.7 MB', packets:2450, pct:7 },
            ];
            talkers.innerHTML = topTalkers.map(t => `
                <div style="display:flex; align-items:center; gap:var(--space-sm); padding:var(--space-xs) 0;">
                    <span style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-secondary); min-width:120px;">${t.ip}</span>
                    <div style="flex:1; background:var(--bg-secondary); border-radius:99px; height:6px; overflow:hidden;">
                        <div style="width:${t.pct}%; height:100%; background:var(--primary); border-radius:99px;"></div>
                    </div>
                    <span style="font-size:var(--text-xs); color:var(--text-muted); min-width:60px; text-align:right;">${t.bytes}</span>
                </div>
            `).join('');
        }

        // Anomalies
        const anomalyList = document.getElementById('net-anomalies-list');
        if (anomalyList) {
            const anomalies = [
                { type:'Port Scan', src:'192.168.1.20', severity:'high', desc:'Sequential port scanning detected' },
                { type:'C2 Communication', src:'10.0.0.5', severity:'critical', desc:'Known C2 server connection' },
                { type:'Data Exfil', src:'192.168.1.15', severity:'high', desc:'Large outbound data transfer' },
                { type:'DNS Tunneling', src:'192.168.1.30', severity:'medium', desc:'Unusual DNS query patterns' },
            ];
            const severityColors = { critical:'var(--error)', high:'#ff9500', medium:'var(--warning)' };
            anomalyList.innerHTML = anomalies.map(a => `
                <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid ${severityColors[a.severity]}; border-radius:var(--radius-sm); padding:var(--space-sm) var(--space-md);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                        <span style="font-size:var(--text-xs); font-weight:600; color:${severityColors[a.severity]};">${a.type}</span>
                        <span style="font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted);">${a.src}</span>
                    </div>
                    <span style="font-size:var(--text-xs); color:var(--text-secondary);">${a.desc}</span>
                </div>
            `).join('');
        }

        const el = (id) => document.getElementById(id);
        if (el('net-connections')) el('net-connections').textContent = this.connections.length + 1239;
        if (el('net-traffic-in')) el('net-traffic-in').textContent = (Math.random()*50+20).toFixed(1);
        if (el('net-traffic-out')) el('net-traffic-out').textContent = (Math.random()*30+10).toFixed(1);
        if (el('net-anomalies')) el('net-anomalies').textContent = 4;
        if (el('net-blocked')) el('net-blocked').textContent = 23;
    }

    renderConnections(connections) {
        const tbody = document.getElementById('net-connections-body');
        if (!tbody) return;

        const riskColors = { critical:'var(--error)', high:'#ff9500', medium:'var(--warning)', low:'var(--success)' };

        tbody.innerHTML = connections.map(c => `
            <tr style="border-bottom:1px solid var(--border-color)11;"
                onmouseenter="this.style.background='var(--bg-hover)'"
                onmouseleave="this.style.background=''">
                <td style="padding:4px var(--space-sm); color:var(--primary);">${c.proto}</td>
                <td style="padding:4px var(--space-sm); color:var(--text-secondary);">${c.src}</td>
                <td style="padding:4px var(--space-sm); color:var(--text-secondary);">${c.dst}</td>
                <td style="padding:4px var(--space-sm); text-align:center; color:var(--text-muted);">${c.state}</td>
                <td style="padding:4px var(--space-sm); text-align:right; color:var(--text-muted);">${c.bytes}</td>
                <td style="padding:4px var(--space-sm); text-align:center;">
                    <span style="background:${riskColors[c.risk]}22; color:${riskColors[c.risk]}; padding:1px 6px; border-radius:99px; font-size:10px; text-transform:uppercase;">${c.risk}</span>
                </td>
            </tr>
        `).join('');
    }

    filterConnections(query) {
        const q = query.toLowerCase();
        const filtered = this.connections.filter(c => c.src.includes(q) || c.dst.includes(q) || c.proto.toLowerCase().includes(q));
        this.renderConnections(filtered);
    }

    initCharts() {
        const trafficCtx = document.getElementById('net-traffic-chart');
        if (trafficCtx && typeof Chart !== 'undefined') {
            if (this.charts.traffic) this.charts.traffic.destroy();
            const labels = Array.from({length:20}, (_,i) => {
                const d = new Date(Date.now() - (19-i)*3000);
                return d.toLocaleTimeString();
            });
            this.charts.traffic = new Chart(trafficCtx, {
                type:'line',
                data: {
                    labels,
                    datasets: [
                        { label:'Inbound (MB/s)', data: Array.from({length:20}, () => Math.random()*50+20), borderColor:'var(--success)', backgroundColor:'rgba(105,240,174,0.1)', tension:0.4, fill:true },
                        { label:'Outbound (MB/s)', data: Array.from({length:20}, () => Math.random()*30+10), borderColor:'#ff9500', backgroundColor:'rgba(255,149,0,0.1)', tension:0.4, fill:true },
                    ]
                },
                options: { responsive:true, animation:false, plugins:{legend:{labels:{color:'var(--text-secondary)',font:{size:11}}}}, scales:{ y:{beginAtZero:true,grid:{color:'var(--border-color)'},ticks:{color:'var(--text-muted)'}}, x:{grid:{color:'var(--border-color)'},ticks:{color:'var(--text-muted)',maxTicksLimit:8}} } }
            });
        }

        const protoCtx = document.getElementById('net-protocol-chart');
        if (protoCtx && typeof Chart !== 'undefined') {
            if (this.charts.protocol) this.charts.protocol.destroy();
            this.charts.protocol = new Chart(protoCtx, {
                type:'doughnut',
                data: {
                    labels:['TCP','UDP','ICMP','HTTP','HTTPS','Other'],
                    datasets:[{ data:[42,28,8,10,8,4], backgroundColor:['#7c4dff','#00b0ff','#69f0ae','#ff9500','#ffd740','#ff5252'], borderWidth:0 }]
                },
                options: { responsive:true, animation:false, plugins:{legend:{position:'right',labels:{color:'var(--text-secondary)',font:{size:11}}}} }
            });
        }
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (!this.isActive) return;
            const inEl = document.getElementById('net-traffic-in');
            const outEl = document.getElementById('net-traffic-out');
            if (inEl) inEl.textContent = (Math.random()*50+20).toFixed(1);
            if (outEl) outEl.textContent = (Math.random()*30+10).toFixed(1);

            if (this.charts.traffic) {
                const ds = this.charts.traffic.data;
                ds.labels.push(new Date().toLocaleTimeString());
                ds.labels.shift();
                ds.datasets[0].data.push(Math.random()*50+20);
                ds.datasets[0].data.shift();
                ds.datasets[1].data.push(Math.random()*30+10);
                ds.datasets[1].data.shift();
                this.charts.traffic.update('none');
            }
        }, 3000);
    }

    changeInterface(iface) {
        this.selectedInterface = iface;
        this.loadData();
    }

    exportCapture() {
        alert('Exporting network capture...\nGenerating PCAP file with current session data.');
    }
}

window.NetworkAnalysisScreen = NetworkAnalysisScreen;
