/**
 * Security Metrics Screen
 * Security metrics dashboard and analytics
 */

class SecurityMetricsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.charts = {};
        this.metrics = {};
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadMetrics();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        this.destroyCharts();
    }

    createHTML() {
        return `
            <div class="security-metrics-screen">
                <!-- Header -->
                <div class="metrics-header">
                    <div class="header-info">
                        <h2><i class="fas fa-chart-bar"></i> Security Metrics</h2>
                        <p>Comprehensive security performance analytics and KPIs</p>
                    </div>
                    <div class="header-controls">
                        <select id="time-range" class="form-control">
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d" selected>Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                        </select>
                        <button class="btn btn-secondary" id="export-metrics">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <!-- KPI Dashboard -->
                <div class="kpi-dashboard">
                    <div class="kpi-card">
                        <div class="kpi-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="kpi-content">
                            <h3 id="threats-blocked">0</h3>
                            <p>Threats Blocked</p>
                            <span class="kpi-change positive" id="threats-change">+12.5%</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="kpi-content">
                            <h3 id="response-time">0</h3>
                            <p>Avg Response Time</p>
                            <span class="kpi-change negative" id="response-change">+2.3min</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-icon">
                            <i class="fas fa-eye"></i>
                        </div>
                        <div class="kpi-content">
                            <h3 id="detection-rate">0%</h3>
                            <p>Detection Rate</p>
                            <span class="kpi-change positive" id="detection-change">+3.2%</span>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-icon">
                            <i class="fas fa-bug"></i>
                        </div>
                        <div class="kpi-content">
                            <h3 id="false-positives">0</h3>
                            <p>False Positives</p>
                            <span class="kpi-change positive" id="fp-change">-15.7%</span>
                        </div>
                    </div>
                </div>

                <!-- Charts Grid -->
                <div class="charts-grid">
                    <!-- Threat Detection Chart -->
                    <div class="chart-container">
                        <h3>Threat Detection Trends</h3>
                        <canvas id="threat-detection-chart"></canvas>
                    </div>

                    <!-- Response Time Chart -->
                    <div class="chart-container">
                        <h3>Incident Response Times</h3>
                        <canvas id="response-time-chart"></canvas>
                    </div>

                    <!-- Security Coverage -->
                    <div class="chart-container">
                        <h3>Security Coverage</h3>
                        <canvas id="coverage-chart"></canvas>
                    </div>

                    <!-- Threat Sources -->
                    <div class="chart-container">
                        <h3>Threat Sources Distribution</h3>
                        <canvas id="threat-sources-chart"></canvas>
                    </div>
                </div>

                <!-- Performance Metrics -->
                <div class="performance-section">
                    <h3>Security Performance Metrics</h3>
                    <div class="metrics-table-container">
                        <table class="metrics-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Current Value</th>
                                    <th>Target</th>
                                    <th>Performance</th>
                                    <th>Trend</th>
                                </tr>
                            </thead>
                            <tbody id="metrics-table-body">
                                <!-- Metrics will be populated here -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Compliance Score -->
                <div class="compliance-section">
                    <h3>Security Compliance Score</h3>
                    <div class="compliance-dashboard">
                        <div class="compliance-score-circle">
                            <canvas id="compliance-score-chart"></canvas>
                            <div class="score-overlay">
                                <span class="score-value" id="compliance-score">0</span>
                                <span class="score-label">Overall Score</span>
                            </div>
                        </div>
                        <div class="compliance-breakdown">
                            <div class="compliance-item">
                                <span class="label">Policy Compliance</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: 92%"></div>
                                </div>
                                <span class="value">92%</span>
                            </div>
                            <div class="compliance-item">
                                <span class="label">Security Controls</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: 88%"></div>
                                </div>
                                <span class="value">88%</span>
                            </div>
                            <div class="compliance-item">
                                <span class="label">Risk Management</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: 85%"></div>
                                </div>
                                <span class="value">85%</span>
                            </div>
                            <div class="compliance-item">
                                <span class="label">Incident Response</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: 94%"></div>
                                </div>
                                <span class="value">94%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
        this.initializeCharts();
    }

    setupEventListeners() {
        const timeRange = document.getElementById('time-range');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.loadMetrics(e.target.value);
            });
        }

        const exportBtn = document.getElementById('export-metrics');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMetrics());
        }
    }

    initializeCharts() {
        // Threat Detection Chart
        const threatCtx = document.getElementById('threat-detection-chart');
        if (threatCtx) {
            this.charts.threatDetection = new Chart(threatCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Threats Detected',
                        data: [45, 52, 38, 67, 73, 29, 41],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Threats Blocked',
                        data: [43, 50, 36, 65, 71, 27, 39],
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.4
                    }]
                },
                options: { responsive: true }
            });
        }

        // Response Time Chart
        const responseCtx = document.getElementById('response-time-chart');
        if (responseCtx) {
            this.charts.responseTime = new Chart(responseCtx, {
                type: 'bar',
                data: {
                    labels: ['Critical', 'High', 'Medium', 'Low'],
                    datasets: [{
                        label: 'Response Time (minutes)',
                        data: [5, 15, 45, 120],
                        backgroundColor: ['#ff6b6b', '#feca57', '#48dbfb', '#0abde3']
                    }]
                },
                options: { responsive: true }
            });
        }

        // Security Coverage Chart
        const coverageCtx = document.getElementById('coverage-chart');
        if (coverageCtx) {
            this.charts.coverage = new Chart(coverageCtx, {
                type: 'radar',
                data: {
                    labels: ['Network', 'Endpoint', 'Email', 'Web', 'Cloud', 'Mobile'],
                    datasets: [{
                        label: 'Security Coverage',
                        data: [85, 92, 78, 88, 73, 67],
                        borderColor: '#00f5ff',
                        backgroundColor: 'rgba(0, 245, 255, 0.2)'
                    }]
                },
                options: { 
                    responsive: true,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }

        // Threat Sources Chart
        const sourcesCtx = document.getElementById('threat-sources-chart');
        if (sourcesCtx) {
            this.charts.threatSources = new Chart(sourcesCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Malware', 'Phishing', 'DDoS', 'Intrusion', 'Other'],
                    datasets: [{
                        data: [35, 25, 15, 20, 5],
                        backgroundColor: [
                            '#ff6b6b',
                            '#feca57',
                            '#48dbfb',
                            '#ff9ff3',
                            '#54a0ff'
                        ]
                    }]
                },
                options: { responsive: true }
            });
        }

        // Compliance Score Chart
        const complianceCtx = document.getElementById('compliance-score-chart');
        if (complianceCtx) {
            this.charts.complianceScore = new Chart(complianceCtx, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [89, 11],
                        backgroundColor: ['#4ecdc4', '#e9ecef'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }

    async loadMetrics(timeRange = '7d') {
        // Simulate loading metrics data
        this.metrics = {
            threatsBlocked: 1247,
            responseTime: 12.5,
            detectionRate: 94.7,
            falsePositives: 23,
            complianceScore: 89
        };

        this.updateKPIs();
        this.updateMetricsTable();
        this.updateComplianceScore();
    }

    updateKPIs() {
        document.getElementById('threats-blocked').textContent = this.metrics.threatsBlocked.toLocaleString();
        document.getElementById('response-time').textContent = this.metrics.responseTime + 'min';
        document.getElementById('detection-rate').textContent = this.metrics.detectionRate + '%';
        document.getElementById('false-positives').textContent = this.metrics.falsePositives;
    }

    updateMetricsTable() {
        const tableBody = document.getElementById('metrics-table-body');
        if (!tableBody) return;

        const metricsData = [
            {
                metric: 'Mean Time to Detection (MTTD)',
                current: '4.2 minutes',
                target: '< 5 minutes',
                performance: 'Good',
                trend: 'up'
            },
            {
                metric: 'Mean Time to Response (MTTR)',
                current: '12.5 minutes',
                target: '< 15 minutes',
                performance: 'Good',
                trend: 'down'
            },
            {
                metric: 'Security Coverage',
                current: '87.3%',
                target: '> 90%',
                performance: 'Below Target',
                trend: 'up'
            },
            {
                metric: 'False Positive Rate',
                current: '2.1%',
                target: '< 3%',
                performance: 'Excellent',
                trend: 'down'
            },
            {
                metric: 'Patch Compliance',
                current: '94.7%',
                target: '> 95%',
                performance: 'Below Target',
                trend: 'up'
            }
        ];

        tableBody.innerHTML = metricsData.map(metric => `
            <tr>
                <td>${metric.metric}</td>
                <td>${metric.current}</td>
                <td>${metric.target}</td>
                <td><span class="performance-badge ${metric.performance.toLowerCase().replace(' ', '-')}">${metric.performance}</span></td>
                <td><i class="fas fa-arrow-${metric.trend} trend-${metric.trend}"></i></td>
            </tr>
        `).join('');
    }

    updateComplianceScore() {
        document.getElementById('compliance-score').textContent = this.metrics.complianceScore;
    }

    exportMetrics() {
        const exportData = {
            kpis: this.metrics,
            timestamp: new Date().toISOString(),
            timeRange: document.getElementById('time-range').value
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-metrics-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
}

// Export to global scope
window.SecurityMetricsScreen = SecurityMetricsScreen;