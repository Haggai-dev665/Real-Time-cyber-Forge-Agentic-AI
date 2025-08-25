/**
 * Real-Time Monitor Screen
 * Live monitoring of system security events and network activity
 */

class RealTimeMonitorScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.updateInterval = null;
        this.charts = {};
        this.eventLog = [];
        this.filters = {
            severity: 'all',
            type: 'all',
            timeRange: '1h'
        };
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        this.initializeComponents();
        
        // Load initial data
        await this.loadData();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        this.stopRealTimeUpdates();
        this.destroyCharts();
    }

    createHTML() {
        return `
            <div class="real-time-monitor-screen">
                <!-- Header -->
                <div class="monitor-header">
                    <div class="header-info">
                        <h2><i class="fas fa-chart-line"></i> Real-Time Monitor</h2>
                        <p>Live system security monitoring and event tracking</p>
                    </div>
                    <div class="header-controls">
                        <div class="status-indicator active" id="monitor-status">
                            <i class="fas fa-circle"></i> Live
                        </div>
                        <button class="btn btn-secondary btn-sm" id="pause-monitor">
                            <i class="fas fa-pause"></i> Pause
                        </button>
                        <button class="btn btn-primary btn-sm" id="export-data">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <!-- Live Stats Grid -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="threats-blocked">0</h3>
                            <p>Threats Blocked</p>
                            <span class="stat-change positive">+5 this hour</span>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-network-wired"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="active-connections">0</h3>
                            <p>Active Connections</p>
                            <span class="stat-change">Normal</span>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="security-alerts">0</h3>
                            <p>Security Alerts</p>
                            <span class="stat-change negative">+2 new</span>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-tachometer-alt"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="system-load">0%</h3>
                            <p>System Load</p>
                            <span class="stat-change">Optimal</span>
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="monitor-content">
                    <!-- Charts Section -->
                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Network Traffic</h3>
                            <canvas id="traffic-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Threat Detection</h3>
                            <canvas id="threats-chart"></canvas>
                        </div>
                    </div>

                    <!-- Events Section -->
                    <div class="events-section">
                        <div class="events-header">
                            <h3>Live Security Events</h3>
                            <div class="event-filters">
                                <select id="severity-filter">
                                    <option value="all">All Severities</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                <select id="type-filter">
                                    <option value="all">All Types</option>
                                    <option value="malware">Malware</option>
                                    <option value="intrusion">Intrusion</option>
                                    <option value="anomaly">Anomaly</option>
                                </select>
                            </div>
                        </div>
                        <div class="events-list" id="events-list">
                            <!-- Events will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Initialize charts
        this.initializeCharts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize filters
        this.initializeFilters();
    }

    initializeCharts() {
        const trafficCtx = document.getElementById('traffic-chart');
        const threatsCtx = document.getElementById('threats-chart');

        if (trafficCtx) {
            this.charts.traffic = new Chart(trafficCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Incoming',
                        data: [],
                        borderColor: '#00f5ff',
                        backgroundColor: 'rgba(0, 245, 255, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Outgoing',
                        data: [],
                        borderColor: '#4ecdc4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    animation: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        if (threatsCtx) {
            this.charts.threats = new Chart(threatsCtx, {
                type: 'bar',
                data: {
                    labels: ['Malware', 'Intrusion', 'Phishing', 'DDoS', 'Other'],
                    datasets: [{
                        label: 'Threats Detected',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#ff6b6b',
                            '#feca57',
                            '#ff9ff3',
                            '#54a0ff',
                            '#5f27cd'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    animation: false
                }
            });
        }
    }

    setupEventListeners() {
        // Pause/Resume monitoring
        const pauseBtn = document.getElementById('pause-monitor');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.toggleMonitoring());
        }

        // Export data
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Filter change handlers
        const severityFilter = document.getElementById('severity-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (severityFilter) {
            severityFilter.addEventListener('change', (e) => {
                this.filters.severity = e.target.value;
                this.applyFilters();
            });
        }
        
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filters.type = e.target.value;
                this.applyFilters();
            });
        }
    }

    initializeFilters() {
        // Set default filter values
        document.getElementById('severity-filter').value = this.filters.severity;
        document.getElementById('type-filter').value = this.filters.type;
    }

    async loadData() {
        // Simulate loading real-time data
        this.updateStats();
        this.updateCharts();
        this.loadEvents();
    }

    updateStats() {
        document.getElementById('threats-blocked').textContent = Math.floor(Math.random() * 100);
        document.getElementById('active-connections').textContent = Math.floor(Math.random() * 500);
        document.getElementById('security-alerts').textContent = Math.floor(Math.random() * 20);
        document.getElementById('system-load').textContent = Math.floor(Math.random() * 100) + '%';
    }

    updateCharts() {
        if (this.charts.traffic) {
            const now = new Date();
            const labels = this.charts.traffic.data.labels;
            const datasets = this.charts.traffic.data.datasets;

            // Add new data point
            labels.push(now.toLocaleTimeString());
            datasets[0].data.push(Math.random() * 100);
            datasets[1].data.push(Math.random() * 80);

            // Keep only last 20 points
            if (labels.length > 20) {
                labels.shift();
                datasets[0].data.shift();
                datasets[1].data.shift();
            }

            this.charts.traffic.update('none');
        }

        if (this.charts.threats) {
            const data = this.charts.threats.data.datasets[0].data;
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.floor(Math.random() * 10);
            }
            this.charts.threats.update('none');
        }
    }

    loadEvents() {
        const eventsList = document.getElementById('events-list');
        if (!eventsList) return;

        // Simulate real-time events
        const eventTypes = ['malware', 'intrusion', 'anomaly', 'phishing'];
        const severities = ['critical', 'high', 'medium', 'low'];
        
        const newEvent = {
            id: Date.now(),
            type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
            message: 'Security event detected',
            timestamp: new Date(),
            source: '192.168.1.' + Math.floor(Math.random() * 255)
        };

        this.eventLog.unshift(newEvent);
        
        // Keep only last 100 events
        if (this.eventLog.length > 100) {
            this.eventLog = this.eventLog.slice(0, 100);
        }

        this.renderEvents();
    }

    renderEvents() {
        const eventsList = document.getElementById('events-list');
        if (!eventsList) return;

        const filteredEvents = this.eventLog.filter(event => {
            if (this.filters.severity !== 'all' && event.severity !== this.filters.severity) {
                return false;
            }
            if (this.filters.type !== 'all' && event.type !== this.filters.type) {
                return false;
            }
            return true;
        });

        eventsList.innerHTML = filteredEvents.map(event => `
            <div class="event-item ${event.severity}">
                <div class="event-icon">
                    <i class="fas fa-${this.getEventIcon(event.type)}"></i>
                </div>
                <div class="event-content">
                    <div class="event-header">
                        <span class="event-type">${event.type.toUpperCase()}</span>
                        <span class="event-severity ${event.severity}">${event.severity.toUpperCase()}</span>
                        <span class="event-time">${event.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <div class="event-message">${event.message}</div>
                    <div class="event-source">Source: ${event.source}</div>
                </div>
            </div>
        `).join('');
    }

    getEventIcon(type) {
        const icons = {
            malware: 'virus',
            intrusion: 'user-secret',
            anomaly: 'exclamation-triangle',
            phishing: 'fish'
        };
        return icons[type] || 'shield-alt';
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.isActive) {
                this.updateStats();
                this.updateCharts();
                
                // Add new event occasionally
                if (Math.random() < 0.3) {
                    this.loadEvents();
                }
            }
        }, 2000);
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    toggleMonitoring() {
        const pauseBtn = document.getElementById('pause-monitor');
        const statusIndicator = document.getElementById('monitor-status');
        
        if (this.updateInterval) {
            this.stopRealTimeUpdates();
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Paused';
            statusIndicator.classList.remove('active');
            statusIndicator.classList.add('paused');
        } else {
            this.startRealTimeUpdates();
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Live';
            statusIndicator.classList.remove('paused');
            statusIndicator.classList.add('active');
        }
    }

    applyFilters() {
        this.renderEvents();
    }

    exportData() {
        const data = {
            events: this.eventLog,
            timestamp: new Date().toISOString(),
            filters: this.filters
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-monitor-${Date.now()}.json`;
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
window.RealTimeMonitorScreen = RealTimeMonitorScreen;