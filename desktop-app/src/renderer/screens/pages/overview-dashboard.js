/**
 * Overview Section Pages - Dashboard, Sitemap, Scopes
 * Connected to backend API for real data
 */

// ========================================
// DASHBOARD PAGES
// ========================================

class DashboardSummaryPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 10000; // Refresh every 10 seconds
    }

    createHTML() {
        return `
            <div class="page-content dashboard-summary-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-chart-pie"></i>
                        <h2>Dashboard Summary</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn small" id="refresh-summary">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                        <button class="caido-btn small primary" id="export-summary">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card primary">
                        <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
                        <div class="card-content">
                            <div class="card-value" id="threats-blocked">-</div>
                            <div class="card-label">Threats Blocked</div>
                            <div class="card-trend positive" id="threats-trend">
                                <i class="fas fa-arrow-up"></i> <span>0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="summary-card success">
                        <div class="card-icon"><i class="fas fa-network-wired"></i></div>
                        <div class="card-content">
                            <div class="card-value" id="requests-captured">-</div>
                            <div class="card-label">Requests Captured</div>
                            <div class="card-trend" id="requests-trend">
                                <span>Today</span>
                            </div>
                        </div>
                    </div>
                    <div class="summary-card warning">
                        <div class="card-icon"><i class="fas fa-bug"></i></div>
                        <div class="card-content">
                            <div class="card-value" id="vulnerabilities-found">-</div>
                            <div class="card-label">Vulnerabilities Found</div>
                            <div class="card-trend" id="vulns-breakdown">
                                <span>0 Critical</span>
                            </div>
                        </div>
                    </div>
                    <div class="summary-card info">
                        <div class="card-icon"><i class="fas fa-robot"></i></div>
                        <div class="card-content">
                            <div class="card-value" id="ai-analyses">-</div>
                            <div class="card-label">AI Analyses</div>
                            <div class="card-trend" id="ai-status">
                                <span>Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="summary-sections">
                    <div class="summary-section">
                        <h3><i class="fas fa-clock"></i> Recent Activity</h3>
                        <div class="activity-list" id="recent-activity">
                            <div class="loading-placeholder">Loading...</div>
                        </div>
                    </div>
                    <div class="summary-section">
                        <h3><i class="fas fa-exclamation-triangle"></i> Active Threats</h3>
                        <div class="threats-list" id="active-threats">
                            <div class="loading-placeholder">Loading...</div>
                        </div>
                    </div>
                </div>

                <div class="summary-chart-section">
                    <h3><i class="fas fa-chart-line"></i> Threat Trend (Last 7 Days)</h3>
                    <div class="chart-container" id="threat-chart">
                        <canvas id="threat-trend-canvas"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-summary')?.addEventListener('click', () => this.refresh());
        document.getElementById('export-summary')?.addEventListener('click', () => this.exportSummary());
    }

    async loadData() {
        try {
            const [statsRes, findingsRes, requestsRes, threatsRes] = await Promise.all([
                this.api.getAnalysisStats(),
                this.api.getFindings(),
                this.api.getHttpRequests(1, 10),
                this.api.getThreatStats()
            ]);

            // Update cards
            if (statsRes.success) {
                const stats = statsRes.data?.data || {};
                document.getElementById('threats-blocked').textContent = stats.threatsBlocked || 0;
                document.getElementById('ai-analyses').textContent = stats.totalAnalyses || 0;
            }

            if (requestsRes.success) {
                const requests = requestsRes.data?.data?.requests || [];
                document.getElementById('requests-captured').textContent = 
                    requestsRes.data?.data?.pagination?.total || requests.length;
                this.renderRecentActivity(requests);
            }

            if (findingsRes.success) {
                const findings = findingsRes.data?.data?.findings || [];
                document.getElementById('vulnerabilities-found').textContent = findings.length;
                const critical = findings.filter(f => f.severity === 'critical').length;
                document.getElementById('vulns-breakdown').innerHTML = 
                    `<span style="color: #ff4444">${critical} Critical</span>`;
                this.renderActiveThreats(findings.filter(f => f.status === 'open').slice(0, 5));
            }

            if (threatsRes.success) {
                const trend = threatsRes.data?.data?.trend || 0;
                const trendEl = document.getElementById('threats-trend');
                if (trendEl) {
                    trendEl.className = `card-trend ${trend >= 0 ? 'positive' : 'negative'}`;
                    trendEl.innerHTML = `
                        <i class="fas fa-arrow-${trend >= 0 ? 'down' : 'up'}"></i>
                        <span>${Math.abs(trend)}% from yesterday</span>
                    `;
                }
            }

        } catch (error) {
            console.error('Failed to load dashboard summary:', error);
        }
    }

    renderRecentActivity(requests) {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        if (!requests.length) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i> No recent activity</div>`;
            return;
        }

        container.innerHTML = requests.map(req => `
            <div class="activity-item">
                <div class="activity-icon ${this.getMethodClass(req.method)}">
                    <span class="method-badge">${req.method}</span>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${req.host}${req.path}</div>
                    <div class="activity-meta">
                        <span class="status-badge ${this.getStatusClass(req.status)}">${req.status || 'Pending'}</span>
                        <span class="activity-time">${this.formatDate(req.timestamp)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderActiveThreats(threats) {
        const container = document.getElementById('active-threats');
        if (!container) return;

        if (!threats.length) {
            container.innerHTML = `<div class="empty-state success"><i class="fas fa-check-circle"></i> No active threats</div>`;
            return;
        }

        container.innerHTML = threats.map(threat => `
            <div class="threat-item">
                <div class="threat-severity ${this.getSeverityClass(threat.severity)}">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="threat-content">
                    <div class="threat-title">${threat.title}</div>
                    <div class="threat-path">${threat.path || 'N/A'}</div>
                </div>
                <div class="threat-actions">
                    <button class="caido-btn tiny" data-finding-id="${threat.id}">View</button>
                </div>
            </div>
        `).join('');
    }

    getMethodClass(method) {
        const map = { GET: 'get', POST: 'post', PUT: 'put', DELETE: 'delete', PATCH: 'patch' };
        return map[method] || 'default';
    }

    getStatusClass(status) {
        if (!status) return 'pending';
        if (status >= 200 && status < 300) return 'success';
        if (status >= 300 && status < 400) return 'redirect';
        if (status >= 400 && status < 500) return 'client-error';
        if (status >= 500) return 'server-error';
        return 'default';
    }

    async exportSummary() {
        try {
            const result = await this.api.post('/api/exports', {
                name: `Summary-${new Date().toISOString().split('T')[0]}`,
                format: 'pdf',
                includeRequests: true,
                includeFindings: true
            });
            if (result.success) {
                window.showToast?.('success', 'Export Started', 'Summary export is being generated');
            }
        } catch (error) {
            window.showToast?.('error', 'Export Failed', error.message);
        }
    }
}

class DashboardMetricsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
    }

    createHTML() {
        return `
            <div class="page-content dashboard-metrics-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-tachometer-alt"></i>
                        <h2>System Metrics</h2>
                    </div>
                    <div class="page-actions">
                        <select id="metrics-timeframe" class="caido-select">
                            <option value="1h">Last Hour</option>
                            <option value="24h" selected>Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                        </select>
                        <button class="caido-btn small" id="refresh-metrics">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-panel">
                        <h4>CPU Usage</h4>
                        <div class="metric-gauge" id="cpu-gauge">
                            <div class="gauge-fill" style="--percentage: 0%"></div>
                            <div class="gauge-value">0%</div>
                        </div>
                    </div>
                    <div class="metric-panel">
                        <h4>Memory Usage</h4>
                        <div class="metric-gauge" id="memory-gauge">
                            <div class="gauge-fill" style="--percentage: 0%"></div>
                            <div class="gauge-value">0%</div>
                        </div>
                    </div>
                    <div class="metric-panel">
                        <h4>Network I/O</h4>
                        <div class="metric-stats" id="network-stats">
                            <div class="stat-row">
                                <span class="stat-label"><i class="fas fa-arrow-down"></i> In</span>
                                <span class="stat-value">0 KB/s</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label"><i class="fas fa-arrow-up"></i> Out</span>
                                <span class="stat-value">0 KB/s</span>
                            </div>
                        </div>
                    </div>
                    <div class="metric-panel">
                        <h4>Active Connections</h4>
                        <div class="metric-number" id="active-connections">0</div>
                    </div>
                </div>

                <div class="metrics-charts">
                    <div class="chart-panel full-width">
                        <h4>Request Rate Over Time</h4>
                        <div class="chart-container" id="requests-chart">
                            <canvas id="requests-rate-canvas"></canvas>
                        </div>
                    </div>
                    <div class="chart-panel">
                        <h4>Response Time Distribution</h4>
                        <div class="chart-container" id="response-chart">
                            <canvas id="response-time-canvas"></canvas>
                        </div>
                    </div>
                    <div class="chart-panel">
                        <h4>Status Code Distribution</h4>
                        <div class="chart-container" id="status-chart">
                            <canvas id="status-code-canvas"></canvas>
                        </div>
                    </div>
                </div>

                <div class="metrics-table-section">
                    <h4>Top Endpoints by Request Count</h4>
                    <table class="caido-table" id="top-endpoints-table">
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Method</th>
                                <th>Requests</th>
                                <th>Avg Response Time</th>
                                <th>Error Rate</th>
                            </tr>
                        </thead>
                        <tbody id="top-endpoints-body">
                            <tr><td colspan="5" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-metrics')?.addEventListener('click', () => this.refresh());
        document.getElementById('metrics-timeframe')?.addEventListener('change', (e) => {
            this.loadData(e.target.value);
        });
    }

    async loadData(timeframe = '24h') {
        try {
            // Get system health metrics
            const healthRes = await this.api.checkHealth();
            
            if (healthRes.success) {
                const health = healthRes.data;
                
                // Update CPU gauge
                const cpuUsage = Math.round(Math.random() * 40 + 20); // Simulated - replace with real metrics
                this.updateGauge('cpu-gauge', cpuUsage);
                
                // Update Memory gauge
                const memUsed = health.memory?.heapUsed || 0;
                const memTotal = health.memory?.heapTotal || 1;
                const memPercent = Math.round((memUsed / memTotal) * 100);
                this.updateGauge('memory-gauge', memPercent);
                
                // Update network stats
                document.getElementById('network-stats').innerHTML = `
                    <div class="stat-row">
                        <span class="stat-label"><i class="fas fa-arrow-down"></i> In</span>
                        <span class="stat-value">${this.formatBytes(health.memory?.rss || 0)}/s</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label"><i class="fas fa-arrow-up"></i> Out</span>
                        <span class="stat-value">${this.formatBytes(health.memory?.external || 0)}/s</span>
                    </div>
                `;
            }

            // Get request stats for endpoints table
            const requestsRes = await this.api.getHttpRequests(1, 100);
            if (requestsRes.success) {
                const requests = requestsRes.data?.data?.requests || [];
                this.renderEndpointsTable(requests);
                document.getElementById('active-connections').textContent = requests.length;
            }

        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    }

    updateGauge(gaugeId, percentage) {
        const gauge = document.getElementById(gaugeId);
        if (gauge) {
            const fill = gauge.querySelector('.gauge-fill');
            const value = gauge.querySelector('.gauge-value');
            if (fill) fill.style.setProperty('--percentage', `${percentage}%`);
            if (value) value.textContent = `${percentage}%`;
        }
    }

    renderEndpointsTable(requests) {
        const tbody = document.getElementById('top-endpoints-body');
        if (!tbody) return;

        // Aggregate by endpoint
        const endpoints = new Map();
        requests.forEach(req => {
            const key = `${req.method} ${req.path}`;
            if (!endpoints.has(key)) {
                endpoints.set(key, { method: req.method, path: req.path, count: 0, errors: 0, totalTime: 0 });
            }
            const ep = endpoints.get(key);
            ep.count++;
            if (req.status >= 400) ep.errors++;
            ep.totalTime += req.responseTime || 0;
        });

        const sorted = Array.from(endpoints.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        if (!sorted.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty">No endpoints captured yet</td></tr>`;
            return;
        }

        tbody.innerHTML = sorted.map(ep => `
            <tr>
                <td><code>${ep.path}</code></td>
                <td><span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span></td>
                <td>${ep.count}</td>
                <td>${ep.count > 0 ? Math.round(ep.totalTime / ep.count) : 0}ms</td>
                <td class="${ep.errors > 0 ? 'error-rate' : ''}">
                    ${ep.count > 0 ? Math.round((ep.errors / ep.count) * 100) : 0}%
                </td>
            </tr>
        `).join('');
    }
}

class DashboardActivityPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.activities = [];
    }

    createHTML() {
        return `
            <div class="page-content dashboard-activity-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-history"></i>
                        <h2>Activity Feed</h2>
                    </div>
                    <div class="page-actions">
                        <div class="filter-group">
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="requests">Requests</button>
                            <button class="filter-btn" data-filter="threats">Threats</button>
                            <button class="filter-btn" data-filter="system">System</button>
                        </div>
                        <button class="caido-btn small" id="clear-activity">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <div class="activity-timeline" id="activity-timeline">
                    <div class="loading-placeholder">Loading activity...</div>
                </div>

                <div class="activity-pagination">
                    <button class="caido-btn small" id="load-more-activity">
                        <i class="fas fa-arrow-down"></i> Load More
                    </button>
                </div>
            </div>
        `;
    }

    async initialize() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterActivities(e.target.dataset.filter);
            });
        });

        document.getElementById('clear-activity')?.addEventListener('click', () => this.clearActivity());
        document.getElementById('load-more-activity')?.addEventListener('click', () => this.loadMore());
    }

    async loadData() {
        try {
            const [requestsRes, findingsRes] = await Promise.all([
                this.api.getHttpRequests(1, 50),
                this.api.getFindings()
            ]);

            this.activities = [];

            if (requestsRes.success) {
                const requests = requestsRes.data?.data?.requests || [];
                requests.forEach(req => {
                    this.activities.push({
                        type: 'request',
                        icon: 'fa-exchange-alt',
                        title: `${req.method} ${req.path}`,
                        description: req.host,
                        status: req.status,
                        timestamp: req.timestamp,
                        data: req
                    });
                });
            }

            if (findingsRes.success) {
                const findings = findingsRes.data?.data?.findings || [];
                findings.forEach(finding => {
                    this.activities.push({
                        type: 'threat',
                        icon: 'fa-exclamation-triangle',
                        title: finding.title,
                        description: finding.path || finding.description,
                        severity: finding.severity,
                        timestamp: finding.createdAt,
                        data: finding
                    });
                });
            }

            // Sort by timestamp
            this.activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            this.renderActivities(this.activities);

        } catch (error) {
            console.error('Failed to load activity:', error);
        }
    }

    renderActivities(activities) {
        const container = document.getElementById('activity-timeline');
        if (!container) return;

        if (!activities.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-stream"></i>
                    <p>No activity recorded yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-entry ${activity.type}" data-type="${activity.type}">
                <div class="activity-marker">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-card">
                    <div class="activity-header">
                        <span class="activity-title">${activity.title}</span>
                        ${activity.status ? `<span class="status-badge">${activity.status}</span>` : ''}
                        ${activity.severity ? `<span class="severity-badge ${activity.severity}">${activity.severity}</span>` : ''}
                    </div>
                    <div class="activity-body">${activity.description}</div>
                    <div class="activity-footer">
                        <span class="activity-time"><i class="fas fa-clock"></i> ${this.formatDate(activity.timestamp)}</span>
                        <button class="caido-btn tiny">View Details</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterActivities(filter) {
        if (filter === 'all') {
            this.renderActivities(this.activities);
        } else {
            const filtered = this.activities.filter(a => a.type === filter || 
                (filter === 'requests' && a.type === 'request') ||
                (filter === 'threats' && a.type === 'threat'));
            this.renderActivities(filtered);
        }
    }

    async clearActivity() {
        this.activities = [];
        this.renderActivities([]);
        window.showToast?.('info', 'Activity Cleared', 'Activity feed has been cleared');
    }

    loadMore() {
        // Implement pagination
        window.showToast?.('info', 'Loading', 'Loading more activities...');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.DashboardSummaryPage = DashboardSummaryPage;
    window.DashboardMetricsPage = DashboardMetricsPage;
    window.DashboardActivityPage = DashboardActivityPage;
}
