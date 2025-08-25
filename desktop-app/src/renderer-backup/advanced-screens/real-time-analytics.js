/**
 * Real-time Analytics Screen
 * Advanced analytics and monitoring dashboard
 */

class RealTimeAnalyticsScreen {
    constructor(uiInstance) {
        this.ui = uiInstance;
        this.charts = {};
        this.metrics = {};
        this.isInitialized = false;
        this.updateInterval = null;
        this.websocket = null;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('📊 Initializing Real-time Analytics...');
        
        // Create analytics HTML
        this.createAnalyticsHTML();
        
        // Initialize charts and visualizations
        await this.initializeCharts();
        
        // Setup WebSocket for real-time data
        this.setupWebSocket();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        this.isInitialized = true;
        console.log('✅ Real-time Analytics initialized');
    }

    createAnalyticsHTML() {
        const container = document.getElementById('analytics');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-container">
                <!-- Analytics Header -->
                <div class="analytics-header animated fadeInDown">
                    <div class="analytics-title">
                        <h2><i class="fas fa-chart-line"></i> Real-time Analytics</h2>
                        <p>Comprehensive security metrics and insights</p>
                    </div>
                    <div class="analytics-controls">
                        <div class="time-range-selector">
                            <label>Time Range:</label>
                            <select id="time-range">
                                <option value="1h">Last Hour</option>
                                <option value="6h">Last 6 Hours</option>
                                <option value="24h" selected>Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" id="export-report">
                            <i class="fas fa-download"></i> Export Report
                        </button>
                    </div>
                </div>

                <!-- KPI Dashboard -->
                <div class="kpi-dashboard animated fadeInUp">
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <div class="kpi-icon threat">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="kpi-trend">
                                <span class="trend-indicator up">↗</span>
                                <span class="trend-percentage">+15%</span>
                            </div>
                        </div>
                        <div class="kpi-content">
                            <h3 id="threats-today">0</h3>
                            <p>Threats Detected Today</p>
                        </div>
                        <div class="kpi-footer">
                            <div class="mini-chart" id="threats-mini-chart"></div>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-header">
                            <div class="kpi-icon analysis">
                                <i class="fas fa-search"></i>
                            </div>
                            <div class="kpi-trend">
                                <span class="trend-indicator up">↗</span>
                                <span class="trend-percentage">+8%</span>
                            </div>
                        </div>
                        <div class="kpi-content">
                            <h3 id="analyses-completed">0</h3>
                            <p>Analyses Completed</p>
                        </div>
                        <div class="kpi-footer">
                            <div class="mini-chart" id="analyses-mini-chart"></div>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-header">
                            <div class="kpi-icon performance">
                                <i class="fas fa-tachometer-alt"></i>
                            </div>
                            <div class="kpi-trend">
                                <span class="trend-indicator down">↘</span>
                                <span class="trend-percentage">-5%</span>
                            </div>
                        </div>
                        <div class="kpi-content">
                            <h3 id="avg-response-time">0ms</h3>
                            <p>Avg Response Time</p>
                        </div>
                        <div class="kpi-footer">
                            <div class="mini-chart" id="performance-mini-chart"></div>
                        </div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-header">
                            <div class="kpi-icon accuracy">
                                <i class="fas fa-bullseye"></i>
                            </div>
                            <div class="kpi-trend">
                                <span class="trend-indicator up">↗</span>
                                <span class="trend-percentage">+2%</span>
                            </div>
                        </div>
                        <div class="kpi-content">
                            <h3 id="detection-accuracy">0%</h3>
                            <p>Detection Accuracy</p>
                        </div>
                        <div class="kpi-footer">
                            <div class="mini-chart" id="accuracy-mini-chart"></div>
                        </div>
                    </div>
                </div>

                <!-- Main Charts Grid -->
                <div class="charts-grid animated fadeInUp delay-1">
                    <!-- Threat Detection Timeline -->
                    <div class="chart-card large">
                        <div class="chart-header">
                            <h3><i class="fas fa-timeline"></i> Threat Detection Timeline</h3>
                            <div class="chart-controls">
                                <button class="btn btn-sm" id="pause-updates">
                                    <i class="fas fa-pause"></i> Pause
                                </button>
                                <button class="btn btn-sm" id="fullscreen-timeline">
                                    <i class="fas fa-expand"></i>
                                </button>
                            </div>
                        </div>
                        <div class="chart-content">
                            <canvas id="threat-timeline-chart"></canvas>
                        </div>
                    </div>

                    <!-- Threat Categories -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3><i class="fas fa-chart-pie"></i> Threat Categories</h3>
                        </div>
                        <div class="chart-content">
                            <canvas id="threat-categories-chart"></canvas>
                        </div>
                    </div>

                    <!-- Geographic Threat Map -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3><i class="fas fa-globe"></i> Geographic Distribution</h3>
                        </div>
                        <div class="chart-content">
                            <div id="threat-map" class="threat-map">
                                <!-- Interactive map will be rendered here -->
                                <div class="map-placeholder">
                                    <i class="fas fa-map-marked-alt"></i>
                                    <p>Interactive threat map</p>
                                    <div class="threat-locations">
                                        <div class="threat-location" style="top: 30%; left: 20%;">
                                            <div class="threat-pulse"></div>
                                            <div class="threat-info">
                                                <span>USA</span>
                                                <span>45 threats</span>
                                            </div>
                                        </div>
                                        <div class="threat-location" style="top: 40%; left: 70%;">
                                            <div class="threat-pulse"></div>
                                            <div class="threat-info">
                                                <span>Europe</span>
                                                <span>32 threats</span>
                                            </div>
                                        </div>
                                        <div class="threat-location" style="top: 60%; left: 80%;">
                                            <div class="threat-pulse"></div>
                                            <div class="threat-info">
                                                <span>Asia</span>
                                                <span>28 threats</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- System Performance -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3><i class="fas fa-server"></i> System Performance</h3>
                        </div>
                        <div class="chart-content">
                            <div class="performance-metrics">
                                <div class="metric-item">
                                    <div class="metric-label">CPU Usage</div>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: 65%"></div>
                                    </div>
                                    <div class="metric-value">65%</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Memory</div>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: 45%"></div>
                                    </div>
                                    <div class="metric-value">45%</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Network I/O</div>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: 78%"></div>
                                    </div>
                                    <div class="metric-value">78%</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">Disk Usage</div>
                                    <div class="metric-bar">
                                        <div class="metric-fill" style="width: 32%"></div>
                                    </div>
                                    <div class="metric-value">32%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Real-time Activity Feed -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3><i class="fas fa-stream"></i> Live Activity Feed</h3>
                            <div class="activity-status">
                                <div class="status-dot active"></div>
                                <span>Live</span>
                            </div>
                        </div>
                        <div class="chart-content">
                            <div id="activity-feed" class="activity-feed">
                                <!-- Real-time activities will be populated here -->
                            </div>
                        </div>
                    </div>

                    <!-- Alert Summary -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <h3><i class="fas fa-bell"></i> Alert Summary</h3>
                        </div>
                        <div class="chart-content">
                            <div class="alert-summary">
                                <div class="alert-level critical">
                                    <div class="alert-count" id="critical-alerts">0</div>
                                    <div class="alert-label">Critical</div>
                                </div>
                                <div class="alert-level high">
                                    <div class="alert-count" id="high-alerts">0</div>
                                    <div class="alert-label">High</div>
                                </div>
                                <div class="alert-level medium">
                                    <div class="alert-count" id="medium-alerts">0</div>
                                    <div class="alert-label">Medium</div>
                                </div>
                                <div class="alert-level low">
                                    <div class="alert-count" id="low-alerts">0</div>
                                    <div class="alert-label">Low</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Analytics -->
                <div class="advanced-analytics animated fadeInUp delay-2">
                    <div class="analytics-card">
                        <div class="card-header">
                            <h3><i class="fas fa-brain"></i> AI Insights</h3>
                        </div>
                        <div class="card-content">
                            <div id="ai-insights" class="insights-container">
                                <div class="insight-item">
                                    <div class="insight-icon">
                                        <i class="fas fa-trend-up"></i>
                                    </div>
                                    <div class="insight-content">
                                        <h4>Increasing Threat Activity</h4>
                                        <p>Malware detection rates have increased by 15% in the last 6 hours, primarily from suspicious email attachments.</p>
                                        <div class="insight-actions">
                                            <button class="btn btn-sm">Investigate</button>
                                            <button class="btn btn-sm">Set Alert</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="insight-item">
                                    <div class="insight-icon">
                                        <i class="fas fa-shield-alt"></i>
                                    </div>
                                    <div class="insight-content">
                                        <h4>Model Performance Optimal</h4>
                                        <p>All ML models are performing within expected parameters with 95%+ accuracy.</p>
                                        <div class="insight-actions">
                                            <button class="btn btn-sm">View Details</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initializeCharts() {
        // Initialize Chart.js charts if available
        if (typeof Chart !== 'undefined') {
            await this.createThreatTimelineChart();
            await this.createThreatCategoriesChart();
        }
    }

    async createThreatTimelineChart() {
        const ctx = document.getElementById('threat-timeline-chart');
        if (!ctx) return;

        this.charts.threatTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Threats Detected',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Threats Mitigated',
                    data: [],
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    async createThreatCategoriesChart() {
        const ctx = document.getElementById('threat-categories-chart');
        if (!ctx) return;

        this.charts.threatCategories = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Malware', 'Phishing', 'Suspicious Content', 'Network Anomaly', 'Other'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        '#ff6b6b',
                        '#4ecdc4',
                        '#45b7d1',
                        '#f9ca24',
                        '#a55eea'
                    ],
                    borderWidth: 0,
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff'
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }

    setupWebSocket() {
        // Setup WebSocket connection for real-time data
        try {
            this.websocket = new WebSocket(`ws://localhost:8000/analytics`);
            
            this.websocket.onopen = () => {
                console.log('📡 Analytics WebSocket connected');
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealTimeData(data);
            };
            
            this.websocket.onclose = () => {
                console.log('📡 Analytics WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    }

    setupEventListeners() {
        // Time range selector
        const timeRange = document.getElementById('time-range');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.updateTimeRange(e.target.value);
            });
        }

        // Export report
        const exportBtn = document.getElementById('export-report');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }

        // Pause/resume updates
        const pauseBtn = document.getElementById('pause-updates');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.toggleUpdates());
        }

        // Fullscreen timeline
        const fullscreenBtn = document.getElementById('fullscreen-timeline');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
    }

    handleRealTimeData(data) {
        switch (data.type) {
            case 'threat_detected':
                this.updateThreatMetrics(data);
                this.addActivityFeedItem(data);
                break;
            case 'analysis_completed':
                this.updateAnalysisMetrics(data);
                break;
            case 'system_performance':
                this.updatePerformanceMetrics(data);
                break;
            case 'alert_generated':
                this.updateAlertSummary(data);
                break;
        }
    }

    updateThreatMetrics(data) {
        // Update threat counters
        const threatsToday = document.getElementById('threats-today');
        if (threatsToday) {
            const current = parseInt(threatsToday.textContent) || 0;
            this.animateNumber(threatsToday, current + 1);
        }

        // Update timeline chart
        if (this.charts.threatTimeline) {
            const chart = this.charts.threatTimeline;
            const now = new Date().toLocaleTimeString();
            
            chart.data.labels.push(now);
            chart.data.datasets[0].data.push(data.count || 1);
            
            // Keep only last 50 data points
            if (chart.data.labels.length > 50) {
                chart.data.labels.shift();
                chart.data.datasets.forEach(dataset => dataset.data.shift());
            }
            
            chart.update('none');
        }
    }

    updateAnalysisMetrics(data) {
        const analysesCompleted = document.getElementById('analyses-completed');
        if (analysesCompleted) {
            const current = parseInt(analysesCompleted.textContent) || 0;
            this.animateNumber(analysesCompleted, current + 1);
        }
    }

    updatePerformanceMetrics(data) {
        if (data.responseTime) {
            const responseTime = document.getElementById('avg-response-time');
            if (responseTime) {
                this.animateNumber(responseTime, data.responseTime, 'ms');
            }
        }

        if (data.accuracy) {
            const accuracy = document.getElementById('detection-accuracy');
            if (accuracy) {
                this.animateNumber(accuracy, Math.round(data.accuracy * 100), '%');
            }
        }
    }

    updateAlertSummary(data) {
        const alertLevel = data.severity || 'medium';
        const alertElement = document.getElementById(`${alertLevel}-alerts`);
        
        if (alertElement) {
            const current = parseInt(alertElement.textContent) || 0;
            this.animateNumber(alertElement, current + 1);
        }
    }

    addActivityFeedItem(data) {
        const feed = document.getElementById('activity-feed');
        if (!feed) return;

        const item = document.createElement('div');
        item.className = 'activity-item animated slideInRight';
        item.innerHTML = `
            <div class="activity-time">${new Date().toLocaleTimeString()}</div>
            <div class="activity-content">
                <div class="activity-icon ${data.severity || 'medium'}">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="activity-details">
                    <span class="activity-title">${data.title || 'Threat Detected'}</span>
                    <span class="activity-description">${data.description || 'New security threat identified'}</span>
                </div>
            </div>
            <div class="activity-status ${data.status || 'active'}">
                ${data.status || 'Active'}
            </div>
        `;

        feed.insertBefore(item, feed.firstChild);

        // Keep only last 10 items
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            this.simulateRealTimeData();
            this.updateSystemMetrics();
        }, 3000);
    }

    simulateRealTimeData() {
        // Simulate various real-time events
        const events = [
            {
                type: 'threat_detected',
                title: 'Malware Detected',
                description: 'Suspicious file behavior detected',
                severity: 'high',
                status: 'active'
            },
            {
                type: 'analysis_completed',
                title: 'URL Analysis Complete',
                description: 'Phishing analysis completed successfully',
                severity: 'info',
                status: 'completed'
            },
            {
                type: 'system_performance',
                responseTime: 150 + Math.random() * 100,
                accuracy: 0.85 + Math.random() * 0.1
            }
        ];

        const randomEvent = events[Math.floor(Math.random() * events.length)];
        this.handleRealTimeData(randomEvent);
    }

    updateSystemMetrics() {
        // Update system performance metrics
        const metrics = [
            { id: 'cpu', value: 40 + Math.random() * 40 },
            { id: 'memory', value: 30 + Math.random() * 50 },
            { id: 'network', value: 50 + Math.random() * 40 },
            { id: 'disk', value: 20 + Math.random() * 30 }
        ];

        metrics.forEach(metric => {
            const bar = document.querySelector(`.metric-item:nth-child(${metrics.indexOf(metric) + 1}) .metric-fill`);
            const value = document.querySelector(`.metric-item:nth-child(${metrics.indexOf(metric) + 1}) .metric-value`);
            
            if (bar && value) {
                bar.style.width = `${metric.value}%`;
                value.textContent = `${Math.round(metric.value)}%`;
            }
        });
    }

    updateTimeRange(range) {
        console.log(`Updating time range to: ${range}`);
        // Implement time range filtering logic
        this.loadHistoricalData(range);
    }

    async loadHistoricalData(range) {
        try {
            // Simulate loading historical data
            // In a real implementation, this would fetch data from the backend
            console.log(`Loading historical data for ${range}`);
        } catch (error) {
            console.error('Failed to load historical data:', error);
        }
    }

    exportReport() {
        this.ui.showNotification('Info', 'Generating analytics report...', 'info');
        
        // Simulate report generation
        setTimeout(() => {
            this.ui.showNotification('Success', 'Analytics report downloaded', 'success');
        }, 2000);
    }

    toggleUpdates() {
        const btn = document.getElementById('pause-updates');
        if (!btn) return;

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            btn.innerHTML = '<i class="fas fa-play"></i> Resume';
            btn.classList.add('paused');
        } else {
            this.startRealTimeUpdates();
            btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            btn.classList.remove('paused');
        }
    }

    toggleFullscreen() {
        const timelineCard = document.querySelector('.chart-card.large');
        if (timelineCard) {
            timelineCard.classList.toggle('fullscreen');
            
            if (this.charts.threatTimeline) {
                setTimeout(() => this.charts.threatTimeline.resize(), 300);
            }
        }
    }

    animateNumber(element, target, suffix = '') {
        const start = parseInt(element.textContent) || 0;
        const increment = (target - start) / 20;
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.round(current) + suffix;
        }, 50);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.websocket) {
            this.websocket.close();
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        this.isInitialized = false;
    }
}

// Export for global access
window.RealTimeAnalyticsScreen = RealTimeAnalyticsScreen;